use crate::framework::{
    config::AppConfig,
    paths::AppPaths,
    services::{
        storage::StorageService,
        studio::{
            StudioConversationRecord, StudioCreateInstanceInput, StudioInstanceConfig,
            StudioService, StudioUpdateInstanceInput,
        },
        supervisor::SupervisorService,
    },
    FrameworkError, Result,
};
use sdkwork_claw_host_core::{
    host_endpoints::HostEndpointRecord,
    port_allocator::{allocate_tcp_listener, PortAllocationRequest},
};
use sdkwork_claw_host_studio::{
    build_typed_studio_public_api_provider, StudioOpenClawGatewayInvokeOptions,
    StudioOpenClawGatewayInvokeRequest, StudioPublicApiProvider, TypedStudioPublicApiBackend,
};
use sdkwork_claw_server::{
    bootstrap::{
        build_server_state_from_runtime_contract, ServerBoundEndpointContext, ServerState,
        ServerStateStoreSnapshot,
    },
    config::{
        ResolvedServerAuthConfig, ResolvedServerRuntimeConfig, ResolvedServerStateStoreConfig,
    },
    http::router::build_router,
};
use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    net::TcpListener,
    path::{Component, Path, PathBuf},
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use uuid::Uuid;

pub const DESKTOP_EMBEDDED_HOST_ENDPOINT_ID: &str = "claw-manage-http";
pub const DESKTOP_EMBEDDED_HOST_MODE: &str = "desktopCombined";
#[cfg_attr(not(test), allow(dead_code))]
pub const DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST: &str = "127.0.0.1";
pub const DESKTOP_EMBEDDED_HOST_MANAGE_BASE_PATH: &str = "/claw/manage/v1";
pub const DESKTOP_EMBEDDED_HOST_INTERNAL_BASE_PATH: &str = "/claw/internal/v1";
const DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR: &str = "web-dist";
const DESKTOP_EMBEDDED_HOST_NESTED_WEB_DIST_DIR: &str = "resources/web-dist";
const DESKTOP_EMBEDDED_HOST_FALLBACK_DIST_DIR: &str = "dist";
const DESKTOP_EMBEDDED_HOST_NESTED_FALLBACK_DIST_DIR: &str = "resources/dist";
const DESKTOP_SOURCE_FRONTEND_DIST_RELATIVE_PATH: &str = "../dist";
const DESKTOP_EMBEDDED_HOST_STARTUP_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedHostRuntimeSnapshot {
    pub mode: String,
    pub manage_base_path: String,
    pub internal_base_path: String,
    pub browser_base_url: String,
    pub endpoint: HostEndpointRecord,
    pub state_store_driver: String,
    pub state_store: ServerStateStoreSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedHostRuntimeStatus {
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

type SharedEmbeddedHostRuntimeStatus = Arc<Mutex<EmbeddedHostRuntimeStatus>>;

#[derive(Debug)]
pub struct EmbeddedHostServerHandle {
    snapshot: EmbeddedHostRuntimeSnapshot,
    shutdown_tx: Option<Sender<()>>,
    status: SharedEmbeddedHostRuntimeStatus,
    thread: Option<thread::JoinHandle<Result<()>>>,
}

impl EmbeddedHostServerHandle {
    pub fn snapshot(&self) -> &EmbeddedHostRuntimeSnapshot {
        &self.snapshot
    }

    pub fn status(&self) -> EmbeddedHostRuntimeStatus {
        read_embedded_host_runtime_status(&self.status)
    }

    #[cfg(test)]
    pub fn shutdown(mut self) -> Result<()> {
        self.stop_server()
    }

    fn stop_server(&mut self) -> Result<()> {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            mark_embedded_host_runtime_stopping(&self.status);
            let _ = shutdown_tx.send(());
        }

        if let Some(thread) = self.thread.take() {
            match thread.join() {
                Ok(Ok(())) => {
                    mark_embedded_host_runtime_stopped(&self.status);
                }
                Ok(Err(error)) => {
                    mark_embedded_host_runtime_failed(&self.status, error.to_string());
                    return Err(error);
                }
                Err(_) => {
                    let error = FrameworkError::Internal(
                        "embedded desktop host thread panicked during shutdown".to_string(),
                    );
                    mark_embedded_host_runtime_failed(&self.status, error.to_string());
                    return Err(error);
                }
            }
        }

        Ok(())
    }
}

impl Drop for EmbeddedHostServerHandle {
    fn drop(&mut self) {
        let _ = self.stop_server();
    }
}

pub fn start_embedded_host_server(
    paths: &AppPaths,
    config: &AppConfig,
    supervisor: &SupervisorService,
    bind_host: &str,
    requested_port: u16,
    allow_dynamic_port: bool,
) -> Result<EmbeddedHostServerHandle> {
    let bound_listener = allocate_tcp_listener(PortAllocationRequest {
        bind_host: bind_host.trim().to_string(),
        requested_port,
        fallback_range: None,
        allow_ephemeral_fallback: allow_dynamic_port,
    })
    .map_err(FrameworkError::Conflict)?;

    let bind_host = bound_listener.bind_host.clone();
    let requested_port = bound_listener.requested_port;
    let active_port = bound_listener.active_port;
    let dynamic_port = bound_listener.dynamic_port;
    let last_conflict_reason = bound_listener.last_conflict_reason.clone();
    let (server_state, snapshot) = build_embedded_host_server_state(
        paths,
        config,
        supervisor,
        bind_host,
        requested_port,
        active_port,
        dynamic_port,
        last_conflict_reason,
    )?;
    let listener = bound_listener.into_listener();
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<std::result::Result<(), String>>();
    let server_state_for_thread = server_state.clone();
    let runtime_status = new_embedded_host_runtime_status();
    let runtime_status_for_thread = runtime_status.clone();

    let thread = thread::spawn(move || {
        let startup_tx = ready_tx.clone();
        let run_result = run_embedded_host_server(
            listener,
            server_state_for_thread,
            shutdown_rx,
            startup_tx,
            runtime_status_for_thread.clone(),
        );
        match &run_result {
            Ok(()) => mark_embedded_host_runtime_stopped(&runtime_status_for_thread),
            Err(error) => {
                mark_embedded_host_runtime_failed(&runtime_status_for_thread, error.to_string())
            }
        }
        if let Err(error) = &run_result {
            let _ = ready_tx.send(Err(error.to_string()));
        }
        run_result
    });

    let mut handle = EmbeddedHostServerHandle {
        snapshot,
        shutdown_tx: Some(shutdown_tx),
        status: runtime_status,
        thread: Some(thread),
    };
    if let Err(error) =
        wait_for_embedded_host_startup(ready_rx, DESKTOP_EMBEDDED_HOST_STARTUP_TIMEOUT)
    {
        let _ = handle.stop_server();
        return Err(error);
    }

    Ok(handle)
}

fn run_embedded_host_server(
    listener: TcpListener,
    server_state: ServerState,
    shutdown_rx: mpsc::Receiver<()>,
    ready_tx: mpsc::Sender<std::result::Result<(), String>>,
    runtime_status: SharedEmbeddedHostRuntimeStatus,
) -> Result<()> {
    listener
        .set_nonblocking(true)
        .map_err(FrameworkError::from)?;
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| FrameworkError::Internal(format!("build tokio runtime: {error}")))?;

    runtime.block_on(async move {
        let listener = tokio::net::TcpListener::from_std(listener).map_err(|error| {
            FrameworkError::Internal(format!("attach embedded host tcp listener: {error}"))
        })?;
        let app = build_router(server_state);
        mark_embedded_host_runtime_ready(&runtime_status);
        let _ = ready_tx.send(Ok(()));
        let shutdown = async move {
            let _ = tokio::task::spawn_blocking(move || shutdown_rx.recv()).await;
        };

        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown)
            .await
            .map_err(|error| {
                FrameworkError::Internal(format!("serve embedded desktop host: {error}"))
            })
    })
}

fn wait_for_embedded_host_startup(
    ready_rx: mpsc::Receiver<std::result::Result<(), String>>,
    timeout: Duration,
) -> Result<()> {
    match ready_rx.recv_timeout(timeout) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(message)) => Err(FrameworkError::Internal(message)),
        Err(mpsc::RecvTimeoutError::Timeout) => Err(FrameworkError::Timeout(format!(
            "timed out waiting for the embedded desktop host to become ready within {}ms",
            timeout.as_millis()
        ))),
        Err(mpsc::RecvTimeoutError::Disconnected) => Err(FrameworkError::Internal(
            "embedded desktop host stopped before reporting ready".to_string(),
        )),
    }
}

fn new_embedded_host_runtime_status() -> SharedEmbeddedHostRuntimeStatus {
    Arc::new(Mutex::new(EmbeddedHostRuntimeStatus {
        lifecycle: "starting".to_string(),
        last_error: None,
    }))
}

fn read_embedded_host_runtime_status(
    runtime_status: &SharedEmbeddedHostRuntimeStatus,
) -> EmbeddedHostRuntimeStatus {
    runtime_status
        .lock()
        .expect("embedded host runtime status lock")
        .clone()
}

fn write_embedded_host_runtime_status(
    runtime_status: &SharedEmbeddedHostRuntimeStatus,
    lifecycle: &str,
    last_error: Option<String>,
) {
    let mut status = runtime_status
        .lock()
        .expect("embedded host runtime status lock");
    status.lifecycle = lifecycle.to_string();
    status.last_error = last_error;
}

fn mark_embedded_host_runtime_ready(runtime_status: &SharedEmbeddedHostRuntimeStatus) {
    write_embedded_host_runtime_status(runtime_status, "ready", None);
}

fn mark_embedded_host_runtime_stopping(runtime_status: &SharedEmbeddedHostRuntimeStatus) {
    let current = read_embedded_host_runtime_status(runtime_status);
    if current.lifecycle != "degraded" && current.lifecycle != "stopped" {
        write_embedded_host_runtime_status(runtime_status, "stopping", current.last_error);
    }
}

fn mark_embedded_host_runtime_stopped(runtime_status: &SharedEmbeddedHostRuntimeStatus) {
    let current = read_embedded_host_runtime_status(runtime_status);
    if current.lifecycle != "degraded" {
        write_embedded_host_runtime_status(runtime_status, "stopped", current.last_error);
    }
}

fn mark_embedded_host_runtime_failed(
    runtime_status: &SharedEmbeddedHostRuntimeStatus,
    message: impl Into<String>,
) {
    write_embedded_host_runtime_status(runtime_status, "degraded", Some(message.into()));
}

fn build_embedded_host_server_state(
    paths: &AppPaths,
    config: &AppConfig,
    supervisor: &SupervisorService,
    bind_host: String,
    requested_port: u16,
    active_port: u16,
    dynamic_port: bool,
    last_conflict_reason: Option<String>,
) -> Result<(ServerState, EmbeddedHostRuntimeSnapshot)> {
    let runtime_data_dir = paths.machine_state_dir.join("desktop-host");
    fs::create_dir_all(&runtime_data_dir)?;

    let runtime_config = ResolvedServerRuntimeConfig {
        host: bind_host.clone(),
        port: requested_port,
        data_dir: runtime_data_dir.clone(),
        web_dist_dir: resolve_embedded_host_web_dist_dir(paths),
        state_store: ResolvedServerStateStoreConfig {
            driver: "sqlite".to_string(),
            sqlite_path: Some(runtime_data_dir.join("host-state.sqlite3")),
            postgres_url: None,
            postgres_schema: None,
        },
        auth: ResolvedServerAuthConfig {
            manage_username: None,
            manage_password: None,
            internal_username: None,
            internal_password: None,
        },
        allow_insecure_public_bind: false,
    };
    let effective_config_path = runtime_data_dir.join("claw-server.config.json");
    let executable_path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("claw-desktop"));
    let mut server_state = build_server_state_from_runtime_contract(
        &runtime_config,
        effective_config_path,
        executable_path,
        ServerBoundEndpointContext {
            bind_host,
            requested_port,
            active_port,
            dynamic_port,
            last_conflict_reason,
        },
    );
    server_state.auth.browser_session_token = Some(Uuid::new_v4().simple().to_string());
    let shared_workbench_api = server_state.studio_public_api.clone().ok_or_else(|| {
        FrameworkError::Internal(
            "desktop embedded host is missing the shared studio public api provider".to_string(),
        )
    })?;
    server_state.set_mode(DESKTOP_EMBEDDED_HOST_MODE);
    server_state.studio_public_api = Some(build_typed_studio_public_api_provider(
        DesktopStudioPublicApiBackend::new(paths, config, supervisor, shared_workbench_api),
    ));

    let endpoint = server_state
        .openclaw_control_plane
        .list_host_endpoints()
        .into_iter()
        .find(|record| record.endpoint_id == DESKTOP_EMBEDDED_HOST_ENDPOINT_ID)
        .ok_or_else(|| {
            FrameworkError::Internal(
                "canonical desktop embedded host endpoint is missing from server state".to_string(),
            )
        })?;
    let browser_base_url = endpoint.base_url.clone().ok_or_else(|| {
        FrameworkError::Internal(
            "canonical desktop embedded host endpoint is missing a baseUrl".to_string(),
        )
    })?;
    let snapshot = EmbeddedHostRuntimeSnapshot {
        mode: DESKTOP_EMBEDDED_HOST_MODE.to_string(),
        manage_base_path: DESKTOP_EMBEDDED_HOST_MANAGE_BASE_PATH.to_string(),
        internal_base_path: DESKTOP_EMBEDDED_HOST_INTERNAL_BASE_PATH.to_string(),
        browser_base_url,
        endpoint,
        state_store_driver: server_state.state_store_driver.clone(),
        state_store: server_state.state_store.clone(),
    };

    Ok((server_state, snapshot))
}

fn resolve_embedded_host_web_dist_dir(paths: &AppPaths) -> PathBuf {
    resolve_embedded_host_web_dist_dir_with_manifest_dir(
        paths,
        Path::new(env!("CARGO_MANIFEST_DIR")),
    )
}

fn resolve_embedded_host_web_dist_dir_with_manifest_dir(
    paths: &AppPaths,
    manifest_dir: &Path,
) -> PathBuf {
    let mut candidates = vec![
        paths.install_root.join(DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR),
        paths
            .install_root
            .join(DESKTOP_EMBEDDED_HOST_NESTED_WEB_DIST_DIR),
        paths
            .install_root
            .join(DESKTOP_EMBEDDED_HOST_FALLBACK_DIST_DIR),
        paths
            .install_root
            .join(DESKTOP_EMBEDDED_HOST_NESTED_FALLBACK_DIST_DIR),
    ];

    if let Some(resource_dir) = resolve_current_resource_dir() {
        candidates.extend([
            resource_dir.join(DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR),
            resource_dir.join(DESKTOP_EMBEDDED_HOST_NESTED_WEB_DIST_DIR),
            resource_dir.join(DESKTOP_EMBEDDED_HOST_FALLBACK_DIST_DIR),
            resource_dir.join(DESKTOP_EMBEDDED_HOST_NESTED_FALLBACK_DIST_DIR),
        ]);
    }

    candidates.push(manifest_dir.join(DESKTOP_SOURCE_FRONTEND_DIST_RELATIVE_PATH));

    candidates
        .into_iter()
        .find(|candidate| candidate.join("index.html").is_file())
        .map(|candidate| normalize_embedded_host_candidate_path(&candidate))
        .unwrap_or_else(|| paths.install_root.join(DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR))
}

fn normalize_embedded_host_candidate_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(Path::new(std::path::MAIN_SEPARATOR_STR)),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(value) => normalized.push(value),
        }
    }
    normalized
}

fn resolve_current_resource_dir() -> Option<PathBuf> {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default()).ok()
}

#[derive(Clone, Debug)]
struct DesktopStudioPublicApiBackend {
    paths: AppPaths,
    config: AppConfig,
    storage: StorageService,
    studio: StudioService,
    supervisor: SupervisorService,
    shared_workbench_api: std::sync::Arc<dyn StudioPublicApiProvider>,
}

impl DesktopStudioPublicApiBackend {
    fn new(
        paths: &AppPaths,
        config: &AppConfig,
        supervisor: &SupervisorService,
        shared_workbench_api: std::sync::Arc<dyn StudioPublicApiProvider>,
    ) -> Self {
        Self {
            paths: paths.clone(),
            config: config.clone(),
            storage: StorageService::new(),
            studio: StudioService::new(),
            supervisor: supervisor.clone(),
            shared_workbench_api,
        }
    }
}

impl TypedStudioPublicApiBackend for DesktopStudioPublicApiBackend {
    type InstanceRecord = crate::framework::services::studio::StudioInstanceRecord;
    type CreateInstanceInput = StudioCreateInstanceInput;
    type UpdateInstanceInput = StudioUpdateInstanceInput;
    type InstanceDetailRecord = crate::framework::services::studio::StudioInstanceDetailRecord;
    type InstanceConfigRecord = StudioInstanceConfig;
    type ConversationRecord = StudioConversationRecord;

    fn list_instances(&self) -> std::result::Result<Vec<Self::InstanceRecord>, String> {
        self.studio
            .list_instances(&self.paths, &self.config, &self.storage)
            .map_err(|error| error.to_string())
    }

    fn create_instance(
        &self,
        input: Self::CreateInstanceInput,
    ) -> std::result::Result<Self::InstanceRecord, String> {
        self.studio
            .create_instance(&self.paths, &self.config, &self.storage, input)
            .map_err(|error| error.to_string())
    }

    fn get_instance(&self, id: &str) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .get_instance(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn update_instance(
        &self,
        id: &str,
        input: Self::UpdateInstanceInput,
    ) -> std::result::Result<Self::InstanceRecord, String> {
        self.studio
            .update_instance(&self.paths, &self.config, &self.storage, id, input)
            .map_err(|error| error.to_string())
    }

    fn delete_instance(&self, id: &str) -> std::result::Result<bool, String> {
        self.studio
            .delete_instance(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn start_instance(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .start_instance(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn stop_instance(&self, id: &str) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .stop_instance(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn restart_instance(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .restart_instance(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn get_instance_detail(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceDetailRecord>, String> {
        let mut detail = self
            .studio
            .get_instance_detail(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())?;
        let Some(detail_record) = detail.as_mut() else {
            return Ok(None);
        };
        if let Some(shared_detail) = self.shared_workbench_api.get_instance_detail(id)? {
            if let Some(workbench) = shared_detail.get("workbench").cloned() {
                detail_record.workbench =
                    Some(serde_json::from_value(workbench).map_err(|error| {
                        format!("deserialize shared studio workbench: {error}")
                    })?);
            }
        }
        Ok(detail)
    }

    fn get_instance_config(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceConfigRecord>, String> {
        self.studio
            .get_instance_config(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn update_instance_config(
        &self,
        id: &str,
        config: Self::InstanceConfigRecord,
    ) -> std::result::Result<Option<Self::InstanceConfigRecord>, String> {
        self.studio
            .update_instance_config(&self.paths, &self.config, &self.storage, id, config)
            .map_err(|error| error.to_string())
    }

    fn get_instance_logs(&self, id: &str) -> std::result::Result<String, String> {
        self.studio
            .get_instance_logs(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn create_instance_task(
        &self,
        instance_id: &str,
        payload: Value,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .create_instance_task(instance_id, payload)
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .update_instance_task(instance_id, task_id, payload)
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> std::result::Result<bool, String> {
        self.shared_workbench_api
            .update_instance_file_content(instance_id, file_id, content)
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> std::result::Result<bool, String> {
        self.shared_workbench_api
            .update_instance_llm_provider_config(instance_id, provider_id, update)
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .clone_instance_task(instance_id, task_id, name)
    }

    fn run_instance_task_now(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> std::result::Result<Value, String> {
        self.shared_workbench_api
            .run_instance_task_now(instance_id, task_id)
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> std::result::Result<Vec<Value>, String> {
        self.shared_workbench_api
            .list_instance_task_executions(instance_id, task_id)
            .and_then(|value| {
                value
                    .as_array()
                    .cloned()
                    .ok_or_else(|| "studio task executions payload must be an array".to_string())
            })
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .update_instance_task_status(instance_id, task_id, status)
    }

    fn delete_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> std::result::Result<bool, String> {
        self.shared_workbench_api
            .delete_instance_task(instance_id, task_id)
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> std::result::Result<serde_json::Value, String> {
        self.studio
            .invoke_openclaw_gateway(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                instance_id,
                &crate::framework::services::studio::StudioOpenClawGatewayInvokeRequest {
                    tool: request.tool,
                    action: request.action,
                    args: request.args,
                    session_key: request.session_key,
                    dry_run: request.dry_run,
                },
                &crate::framework::services::studio::StudioOpenClawGatewayInvokeOptions {
                    message_channel: options.message_channel,
                    account_id: options.account_id,
                    headers: options.headers,
                },
            )
            .map_err(|error| error.to_string())
    }

    fn list_conversations(
        &self,
        instance_id: &str,
    ) -> std::result::Result<Vec<Self::ConversationRecord>, String> {
        self.studio
            .list_conversations(&self.paths, &self.config, &self.storage, instance_id)
            .map_err(|error| error.to_string())
    }

    fn put_conversation(
        &self,
        id: &str,
        record: Self::ConversationRecord,
    ) -> std::result::Result<Self::ConversationRecord, String> {
        let mut record = record;
        record.id = id.to_string();

        self.studio
            .put_conversation(&self.paths, &self.config, &self.storage, record)
            .map_err(|error| error.to_string())
    }

    fn delete_conversation(&self, id: &str) -> std::result::Result<bool, String> {
        self.studio
            .delete_conversation(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_embedded_host_server_state, new_embedded_host_runtime_status,
        mark_embedded_host_runtime_failed, resolve_embedded_host_web_dist_dir,
        resolve_embedded_host_web_dist_dir_with_manifest_dir, start_embedded_host_server,
        wait_for_embedded_host_startup, EmbeddedHostRuntimeSnapshot, EmbeddedHostServerHandle,
        DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST, DESKTOP_EMBEDDED_HOST_MODE,
    };
    use crate::framework::{
        config::AppConfig, paths::resolve_paths_for_root, services::supervisor::SupervisorService,
        FrameworkError,
    };
    use sdkwork_claw_host_core::host_endpoints::HostEndpointRecord;
    use sdkwork_claw_server::bootstrap::ServerStateStoreSnapshot;
    use std::{fs, sync::mpsc, time::Duration};

    fn test_embedded_host_snapshot() -> EmbeddedHostRuntimeSnapshot {
        EmbeddedHostRuntimeSnapshot {
            mode: DESKTOP_EMBEDDED_HOST_MODE.to_string(),
            manage_base_path: "/claw/manage/v1".to_string(),
            internal_base_path: "/claw/internal/v1".to_string(),
            browser_base_url: "http://127.0.0.1:18797".to_string(),
            endpoint: HostEndpointRecord {
                endpoint_id: "claw-manage-http".to_string(),
                bind_host: "127.0.0.1".to_string(),
                requested_port: 18_797,
                active_port: Some(18_797),
                scheme: "http".to_string(),
                base_url: Some("http://127.0.0.1:18797".to_string()),
                websocket_url: None,
                loopback_only: true,
                dynamic_port: false,
                last_conflict_at: None,
                last_conflict_reason: None,
            },
            state_store_driver: "sqlite".to_string(),
            state_store: ServerStateStoreSnapshot {
                active_profile_id: "default-sqlite".to_string(),
                providers: Vec::new(),
                profiles: Vec::new(),
            },
        }
    }

    #[test]
    fn embedded_host_server_state_defaults_to_sqlite_state_store_driver() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::for_paths(&paths);

        let (server_state, snapshot) = build_embedded_host_server_state(
            &paths,
            &AppConfig::default(),
            &supervisor,
            "127.0.0.1".to_string(),
            18_797,
            18_797,
            false,
            None,
        )
        .expect("embedded host state");

        assert_eq!(snapshot.mode, DESKTOP_EMBEDDED_HOST_MODE);
        assert_eq!(server_state.mode, DESKTOP_EMBEDDED_HOST_MODE);
        assert_eq!(server_state.state_store_driver, "sqlite");
        assert_eq!(server_state.state_store.active_profile_id, "default-sqlite");
        assert!(
            server_state
                .state_store
                .profiles
                .iter()
                .any(|profile| profile.driver == "sqlite" && profile.active),
            "desktop embedded host should activate the sqlite state store profile by default"
        );
    }

    #[test]
    fn embedded_host_startup_wait_returns_internal_error_when_server_thread_reports_failure() {
        let (ready_tx, ready_rx) = mpsc::channel();
        ready_tx
            .send(Err(
                "failed to attach embedded host tcp listener".to_string(),
            ))
            .expect("ready channel should accept a startup failure");

        let error = wait_for_embedded_host_startup(ready_rx, Duration::from_millis(50))
            .expect_err("startup wait should surface the server-thread failure");

        assert!(matches!(
            error,
            FrameworkError::Internal(message)
                if message.contains("failed to attach embedded host tcp listener")
        ));
    }

    #[test]
    fn embedded_host_startup_wait_times_out_when_server_thread_never_reports_ready() {
        let (_ready_tx, ready_rx) = mpsc::channel::<std::result::Result<(), String>>();

        let error = wait_for_embedded_host_startup(ready_rx, Duration::from_millis(10))
            .expect_err("startup wait should time out when the server never reports ready");

        assert!(matches!(
            error,
            FrameworkError::Timeout(message)
                if message.contains("embedded desktop host")
        ));
    }

    #[test]
    fn embedded_host_server_handle_reports_ready_status_after_startup() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::for_paths(&paths);

        let handle = start_embedded_host_server(
            &paths,
            &AppConfig::default(),
            &supervisor,
            DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST,
            AppConfig::default().desktop_host.port,
            true,
        )
        .expect("embedded host should start");

        let status = handle.status();

        assert_eq!(status.lifecycle, "ready");
        assert_eq!(status.last_error, None);

        handle.shutdown().expect("shutdown embedded host");
    }

    #[test]
    fn embedded_host_server_handle_reports_degraded_status_after_background_failure() {
        let runtime_status = new_embedded_host_runtime_status();
        let runtime_status_for_thread = runtime_status.clone();
        let handle = EmbeddedHostServerHandle {
            snapshot: test_embedded_host_snapshot(),
            shutdown_tx: None,
            status: runtime_status,
            thread: Some(std::thread::spawn(move || {
                mark_embedded_host_runtime_failed(
                    &runtime_status_for_thread,
                    "embedded desktop host serve loop stopped unexpectedly",
                );
                Err(FrameworkError::Internal(
                    "embedded desktop host serve loop stopped unexpectedly".to_string(),
                ))
            })),
        };

        std::thread::sleep(Duration::from_millis(20));
        let status = handle.status();

        assert_eq!(status.lifecycle, "degraded");
        assert_eq!(
            status.last_error.as_deref(),
            Some("embedded desktop host serve loop stopped unexpectedly")
        );
    }

    #[test]
    fn embedded_host_shutdown_surfaces_server_thread_errors() {
        let handle = EmbeddedHostServerHandle {
            snapshot: test_embedded_host_snapshot(),
            shutdown_tx: None,
            status: new_embedded_host_runtime_status(),
            thread: Some(std::thread::spawn(|| {
                Err(FrameworkError::Internal(
                    "embedded desktop host serve loop stopped unexpectedly".to_string(),
                ))
            })),
        };

        let error = handle
            .shutdown()
            .expect_err("shutdown should surface embedded host thread errors");

        assert!(matches!(
            error,
            FrameworkError::Internal(message)
                if message.contains("serve loop stopped unexpectedly")
        ));
    }

    #[test]
    fn resolve_embedded_host_web_dist_dir_prefers_nested_resource_root() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let nested_resource_root = paths.install_root.join("resources").join("web-dist");
        fs::create_dir_all(&nested_resource_root).expect("nested resource root");
        fs::write(
            nested_resource_root.join("index.html"),
            "<html><head></head><body></body></html>",
        )
        .expect("resource index");

        let resolved = resolve_embedded_host_web_dist_dir(&paths);

        assert_eq!(resolved, nested_resource_root);
    }

    #[test]
    fn resolve_embedded_host_web_dist_dir_falls_back_to_source_frontend_dist_when_local_resources_are_missing(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let manifest_dir = root.path().join("src-tauri");
        let source_frontend_dist = root.path().join("dist");
        fs::create_dir_all(&manifest_dir).expect("manifest dir");
        fs::create_dir_all(&source_frontend_dist).expect("source frontend dist");
        fs::write(
            source_frontend_dist.join("index.html"),
            "<html><head></head><body></body></html>",
        )
        .expect("source dist index");

        let resolved = resolve_embedded_host_web_dist_dir_with_manifest_dir(&paths, &manifest_dir);

        assert_eq!(resolved, source_frontend_dist);
    }
}
