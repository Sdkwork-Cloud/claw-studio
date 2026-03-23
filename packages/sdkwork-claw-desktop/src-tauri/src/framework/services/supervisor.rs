#![allow(dead_code)]

use crate::framework::services::{
    api_router_managed_runtime::{ActivatedApiRouterRuntime, ManagedApiRouterProcessSpec},
    api_router_runtime::{load_router_config, shared_router_root, ApiRouterRuntimeService},
    api_router_web_server::{
        probe_api_router_web_server, upstream_base_url_for_bind, ApiRouterWebServerConfig,
        ApiRouterWebServerHandle, RuntimeSite,
    },
    openclaw_runtime::{ActivatedOpenClawRuntime, OpenClawRuntimeService},
};
use crate::framework::{
    kernel::{DesktopSupervisorInfo, DesktopSupervisorServiceInfo},
    paths::AppPaths,
    FrameworkError, Result,
};
#[cfg(unix)]
use std::io;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    collections::{BTreeMap, HashMap},
    env, fs,
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant, SystemTime},
};

const DEFAULT_RESTART_WINDOW_MS: u64 = 60_000;
const DEFAULT_RESTART_BACKOFF_MS: u64 = 5_000;
const DEFAULT_MAX_RESTARTS: usize = 3;
const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_OPENCLAW_GATEWAY_READY_TIMEOUT_MS: u64 = 30_000;
const DEFAULT_API_ROUTER_READY_TIMEOUT_MS: u64 = 10_000;
const HOST_ADMIN_SITE_DIR_ENV: &str = "SDKWORK_API_ROUTER_ADMIN_SITE_DIR";
const HOST_PORTAL_SITE_DIR_ENV: &str = "SDKWORK_API_ROUTER_PORTAL_SITE_DIR";
const UPSTREAM_ADMIN_SITE_DIR_ENV: &str = "SDKWORK_ADMIN_SITE_DIR";
const UPSTREAM_PORTAL_SITE_DIR_ENV: &str = "SDKWORK_PORTAL_SITE_DIR";
#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

pub const SERVICE_ID_OPENCLAW_GATEWAY: &str = "openclaw_gateway";
pub const SERVICE_ID_WEB_SERVER: &str = "web_server";
pub const SERVICE_ID_API_ROUTER: &str = "api_router";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SupervisorLifecycle {
    Starting,
    Running,
    Stopping,
    Stopped,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ManagedServiceLifecycle {
    Starting,
    Running,
    Stopping,
    Stopped,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RestartPolicy {
    pub max_restarts: usize,
    pub window_ms: u64,
    pub backoff_ms: u64,
}

impl RestartPolicy {
    pub fn crash_only_default() -> Self {
        Self {
            max_restarts: DEFAULT_MAX_RESTARTS,
            window_ms: DEFAULT_RESTART_WINDOW_MS,
            backoff_ms: DEFAULT_RESTART_BACKOFF_MS,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ManagedServiceHealthCheck {
    None,
    ProcessAlive,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ManagedServiceDefinition {
    pub id: String,
    pub display_name: String,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub env: BTreeMap<String, String>,
    pub startup_order: u16,
    pub graceful_shutdown_timeout_ms: u64,
    pub restart_policy: RestartPolicy,
    pub health_check: ManagedServiceHealthCheck,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ManagedServiceSnapshot {
    pub id: String,
    pub display_name: String,
    pub lifecycle: ManagedServiceLifecycle,
    pub startup_order: u16,
    pub pid: Option<u32>,
    pub last_exit_code: Option<i32>,
    pub restart_count: usize,
    pub last_error: Option<String>,
    pub graceful_shutdown_timeout_ms: u64,
    pub restart_policy: RestartPolicy,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SupervisorSnapshot {
    pub lifecycle: SupervisorLifecycle,
    pub shutdown_requested: bool,
    pub services: Vec<ManagedServiceSnapshot>,
}

#[derive(Clone, Debug)]
pub struct SupervisorService {
    definitions: Arc<Vec<ManagedServiceDefinition>>,
    runtime: Arc<Mutex<SupervisorRuntime>>,
    openclaw_runtime: Arc<Mutex<Option<ActivatedOpenClawRuntime>>>,
    api_router_runtime: Arc<Mutex<Option<ActivatedApiRouterRuntime>>>,
    web_server: Arc<Mutex<Option<ApiRouterWebServerHandle>>>,
    managed_processes: Arc<Mutex<HashMap<String, ManagedServiceProcessHandle>>>,
}

#[derive(Clone, Debug)]
struct SupervisorRuntime {
    lifecycle: SupervisorLifecycle,
    shutdown_requested: bool,
    services: HashMap<String, ManagedServiceRuntime>,
}

#[derive(Clone, Debug)]
struct ManagedServiceRuntime {
    lifecycle: ManagedServiceLifecycle,
    pid: Option<u32>,
    last_exit_code: Option<i32>,
    restart_count: usize,
    recent_restart_attempts: Vec<SystemTime>,
    last_error: Option<String>,
}

#[derive(Debug)]
struct ManagedServiceProcessHandle {
    children: Vec<ManagedChildProcessHandle>,
}

#[derive(Debug)]
struct ManagedChildProcessHandle {
    label: String,
    child: Child,
}

impl SupervisorService {
    pub fn for_paths(_paths: &AppPaths) -> Self {
        Self::new()
    }

    pub fn new() -> Self {
        let definitions = default_managed_services();
        let services = definitions
            .iter()
            .map(|definition| {
                (
                    definition.id.clone(),
                    ManagedServiceRuntime {
                        lifecycle: ManagedServiceLifecycle::Stopped,
                        pid: None,
                        last_exit_code: None,
                        restart_count: 0,
                        recent_restart_attempts: Vec::new(),
                        last_error: None,
                    },
                )
            })
            .collect();

        Self {
            definitions: Arc::new(definitions),
            runtime: Arc::new(Mutex::new(SupervisorRuntime {
                lifecycle: SupervisorLifecycle::Running,
                shutdown_requested: false,
                services,
            })),
            openclaw_runtime: Arc::new(Mutex::new(None)),
            api_router_runtime: Arc::new(Mutex::new(None)),
            web_server: Arc::new(Mutex::new(None)),
            managed_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_default_services(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    pub fn managed_service_ids(&self) -> Vec<String> {
        self.definitions
            .iter()
            .map(|definition| definition.id.clone())
            .collect()
    }

    pub fn planned_startup_order(&self) -> Vec<String> {
        let mut definitions = self.definitions.iter().collect::<Vec<_>>();
        definitions.sort_by_key(|definition| definition.startup_order);
        definitions
            .into_iter()
            .map(|definition| definition.id.clone())
            .collect()
    }

    pub fn planned_shutdown_order(&self) -> Vec<String> {
        let mut ids = self.planned_startup_order();
        ids.reverse();
        ids
    }

    pub fn register_restart_attempt(&self, service_id: &str, at: SystemTime) -> Result<bool> {
        let definition = self.require_definition(service_id)?;
        let mut runtime = self.lock_runtime()?;
        if runtime.shutdown_requested {
            return Ok(false);
        }

        let service = runtime.services.get_mut(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;

        let window = Duration::from_millis(definition.restart_policy.window_ms);
        service
            .recent_restart_attempts
            .retain(|timestamp| match at.duration_since(*timestamp) {
                Ok(elapsed) => elapsed <= window,
                Err(_) => true,
            });

        if service.recent_restart_attempts.len() >= definition.restart_policy.max_restarts {
            service.lifecycle = ManagedServiceLifecycle::Failed;
            service.last_error = Some(format!(
                "restart budget exhausted for {} within {}ms",
                service_id, definition.restart_policy.window_ms
            ));
            runtime.lifecycle = SupervisorLifecycle::Failed;
            return Ok(false);
        }

        service.recent_restart_attempts.push(at);
        service.restart_count += 1;
        service.lifecycle = ManagedServiceLifecycle::Starting;
        service.last_error = None;
        runtime.lifecycle = SupervisorLifecycle::Running;
        Ok(true)
    }

    pub fn request_restart(&self, service_id: &str) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        if runtime.shutdown_requested {
            return Err(FrameworkError::Conflict(
                "application shutdown has already been requested".to_string(),
            ));
        }

        let service = runtime.services.get_mut(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;
        service.lifecycle = ManagedServiceLifecycle::Starting;
        service.pid = None;
        service.last_exit_code = None;
        service.last_error = None;
        runtime.lifecycle = SupervisorLifecycle::Running;
        Ok(())
    }

    pub fn request_restart_all(&self) -> Result<Vec<String>> {
        let planned_services = self.planned_startup_order();
        for service_id in &planned_services {
            self.request_restart(service_id)?;
        }

        Ok(planned_services)
    }

    pub fn stop_service(&self, service_id: &str) -> Result<()> {
        self.stop_service_process(service_id)
    }

    pub fn configure_openclaw_gateway(&self, runtime: &ActivatedOpenClawRuntime) -> Result<()> {
        *self.lock_openclaw_runtime()? = Some(runtime.clone());
        Ok(())
    }

    pub fn configured_openclaw_runtime(&self) -> Result<Option<ActivatedOpenClawRuntime>> {
        Ok(self.lock_openclaw_runtime()?.clone())
    }

    pub fn configure_api_router_runtime(&self, runtime: &ActivatedApiRouterRuntime) -> Result<()> {
        *self.lock_api_router_runtime()? = Some(runtime.clone());
        Ok(())
    }

    pub fn configured_api_router_runtime(&self) -> Result<Option<ActivatedApiRouterRuntime>> {
        Ok(self.lock_api_router_runtime()?.clone())
    }

    pub fn start_openclaw_gateway(&self, paths: &AppPaths) -> Result<()> {
        let runtime = self
            .lock_openclaw_runtime()?
            .clone()
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;
        let runtime = OpenClawRuntimeService::new().refresh_configured_runtime(paths, &runtime)?;
        *self.lock_openclaw_runtime()? = Some(runtime.clone());

        self.request_restart(SERVICE_ID_OPENCLAW_GATEWAY)?;

        let log_file_path = paths.logs_dir.join("openclaw-gateway.log");
        if let Some(parent) = log_file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let stdout = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)?;
        let stderr = stdout.try_clone()?;
        let mut command = Command::new(&runtime.node_path);
        configure_command_for_managed_process(&mut command);
        command.arg(&runtime.cli_path);
        command.arg("gateway");
        command.current_dir(&runtime.runtime_dir);
        command.env("PATH", prepend_path_env(&paths.user_bin_dir));
        command.envs(runtime.managed_env());
        command.stdout(Stdio::from(stdout));
        command.stderr(Stdio::from(stderr));

        match command.spawn() {
            Ok(mut child) => {
                if let Err(error) = wait_for_gateway_ready(
                    &mut child,
                    runtime.gateway_port,
                    DEFAULT_OPENCLAW_GATEWAY_READY_TIMEOUT_MS,
                ) {
                    let _ = force_process_shutdown(&mut child);
                    let _ = child.wait();
                    let _ = self.record_stopped(
                        SERVICE_ID_OPENCLAW_GATEWAY,
                        None,
                        Some(error.to_string()),
                    );
                    return Err(error);
                }
                let pid = child.id();
                self.lock_managed_processes()?.insert(
                    SERVICE_ID_OPENCLAW_GATEWAY.to_string(),
                    ManagedServiceProcessHandle {
                        children: vec![ManagedChildProcessHandle {
                            label: "gateway".to_string(),
                            child,
                        }],
                    },
                );
                self.record_running(SERVICE_ID_OPENCLAW_GATEWAY, Some(pid))?;
                Ok(())
            }
            Err(error) => {
                let failure = FrameworkError::Io(error);
                let _ = self.record_stopped(
                    SERVICE_ID_OPENCLAW_GATEWAY,
                    None,
                    Some(failure.to_string()),
                );
                Err(failure)
            }
        }
    }

    pub fn restart_openclaw_gateway(&self, paths: &AppPaths) -> Result<()> {
        let _ = self.stop_openclaw_gateway();
        self.start_openclaw_gateway(paths)
    }

    pub fn stop_openclaw_gateway(&self) -> Result<()> {
        self.stop_service_process(SERVICE_ID_OPENCLAW_GATEWAY)
    }

    pub fn start_web_server(&self, paths: &AppPaths) -> Result<()> {
        if self.is_service_running(SERVICE_ID_WEB_SERVER)? {
            return Ok(());
        }

        self.request_restart(SERVICE_ID_WEB_SERVER)?;
        let config = self.resolve_api_router_web_server_config(paths)?;
        let handle = ApiRouterWebServerHandle::start(config)?;
        if !probe_api_router_web_server(handle.bind_addr(), 500) {
            let bind_addr = handle.bind_addr().to_string();
            let mut handle = handle;
            let _ = handle.stop();
            let error = FrameworkError::Timeout(format!(
                "api router web server did not become ready on {} within 500ms",
                bind_addr
            ));
            let _ = self.record_stopped(SERVICE_ID_WEB_SERVER, None, Some(error.to_string()));
            return Err(error);
        }

        *self.lock_web_server()? = Some(handle);
        self.record_running(SERVICE_ID_WEB_SERVER, None)?;
        Ok(())
    }

    pub fn restart_web_server(&self, paths: &AppPaths) -> Result<()> {
        let _ = self.stop_web_server();
        self.start_web_server(paths)
    }

    pub fn stop_web_server(&self) -> Result<()> {
        {
            let mut runtime = self.lock_runtime()?;
            if let Some(service) = runtime.services.get_mut(SERVICE_ID_WEB_SERVER) {
                service.lifecycle = ManagedServiceLifecycle::Stopping;
            }
        }

        let Some(mut handle) = self.lock_web_server()?.take() else {
            self.record_stopped(SERVICE_ID_WEB_SERVER, None, None)?;
            return Ok(());
        };

        match handle.stop() {
            Ok(()) => self.record_stopped(SERVICE_ID_WEB_SERVER, None, None),
            Err(error) => {
                let _ = self.record_stopped(SERVICE_ID_WEB_SERVER, None, Some(error.to_string()));
                Err(error)
            }
        }
    }

    pub fn start_api_router(&self, paths: &AppPaths) -> Result<()> {
        let runtime = self
            .lock_api_router_runtime()?
            .clone()
            .ok_or_else(|| FrameworkError::NotFound("configured api router runtime".to_string()))?;
        let router_config = load_router_config(&runtime.shared_root_dir)?;

        self.request_restart(SERVICE_ID_API_ROUTER)?;

        let mut children = Vec::new();
        let managed_env = runtime.managed_env();

        let gateway_log_path = paths.logs_dir.join("sdkwork-api-router-gateway.log");
        let gateway_child =
            spawn_managed_api_router_process(&runtime.gateway, &gateway_log_path, &managed_env)?;
        children.push(ManagedChildProcessHandle {
            label: "gateway".to_string(),
            child: gateway_child,
        });

        if router_config.enable_admin {
            let admin_log_path = paths.logs_dir.join("sdkwork-api-router-admin.log");
            match spawn_managed_api_router_process(&runtime.admin, &admin_log_path, &managed_env) {
                Ok(admin_child) => {
                    children.push(ManagedChildProcessHandle {
                        label: "admin".to_string(),
                        child: admin_child,
                    });
                }
                Err(error) => {
                    let _ = terminate_process_group(
                        &mut children,
                        DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
                    );
                    let _ =
                        self.record_stopped(SERVICE_ID_API_ROUTER, None, Some(error.to_string()));
                    return Err(error);
                }
            }
        }

        if router_config.enable_portal {
            let portal_log_path = paths.logs_dir.join("sdkwork-api-router-portal.log");
            match spawn_managed_api_router_process(&runtime.portal, &portal_log_path, &managed_env)
            {
                Ok(portal_child) => {
                    children.push(ManagedChildProcessHandle {
                        label: "portal".to_string(),
                        child: portal_child,
                    });
                }
                Err(error) => {
                    let _ = terminate_process_group(
                        &mut children,
                        DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
                    );
                    let _ =
                        self.record_stopped(SERVICE_ID_API_ROUTER, None, Some(error.to_string()));
                    return Err(error);
                }
            }
        }

        if let Err(error) = self.restart_web_server(paths) {
            let _ = terminate_process_group(&mut children, DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS);
            let _ = self.record_stopped(SERVICE_ID_API_ROUTER, None, Some(error.to_string()));
            return Err(error);
        }

        if let Err(error) = wait_for_api_router_ready(paths, DEFAULT_API_ROUTER_READY_TIMEOUT_MS) {
            let _ = terminate_process_group(&mut children, DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS);
            let _ = self.stop_web_server();
            let _ = self.record_stopped(SERVICE_ID_API_ROUTER, None, Some(error.to_string()));
            return Err(error);
        }

        let pid = children.first().map(|child| child.child.id());
        self.lock_managed_processes()?.insert(
            SERVICE_ID_API_ROUTER.to_string(),
            ManagedServiceProcessHandle { children },
        );
        self.record_running(SERVICE_ID_API_ROUTER, pid)?;
        Ok(())
    }

    pub fn restart_api_router(&self, paths: &AppPaths) -> Result<()> {
        let _ = self.stop_api_router();
        self.start_api_router(paths)
    }

    pub fn stop_api_router(&self) -> Result<()> {
        self.stop_service_process(SERVICE_ID_API_ROUTER)
    }

    pub fn is_service_running(&self, service_id: &str) -> Result<bool> {
        let runtime = self.lock_runtime()?;
        let service = runtime.services.get(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;

        Ok(matches!(
            service.lifecycle,
            ManagedServiceLifecycle::Running
        ))
    }

    pub fn begin_shutdown(&self) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        runtime.shutdown_requested = true;
        runtime.lifecycle = SupervisorLifecycle::Stopping;
        for service in runtime.services.values_mut() {
            service.lifecycle = match service.lifecycle {
                ManagedServiceLifecycle::Running | ManagedServiceLifecycle::Starting => {
                    ManagedServiceLifecycle::Stopping
                }
                ManagedServiceLifecycle::Failed => ManagedServiceLifecycle::Failed,
                _ => ManagedServiceLifecycle::Stopped,
            };
        }
        drop(runtime);
        self.stop_api_router()?;
        self.stop_web_server()?;
        self.stop_openclaw_gateway()?;
        Ok(())
    }

    pub fn complete_shutdown(&self) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        runtime.lifecycle = SupervisorLifecycle::Stopped;
        for service in runtime.services.values_mut() {
            service.lifecycle = ManagedServiceLifecycle::Stopped;
            service.pid = None;
        }
        Ok(())
    }

    pub fn record_running(&self, service_id: &str, pid: Option<u32>) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        let service = runtime.services.get_mut(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;
        service.lifecycle = ManagedServiceLifecycle::Running;
        service.pid = pid;
        service.last_error = None;
        runtime.lifecycle = SupervisorLifecycle::Running;
        Ok(())
    }

    pub fn record_stopped(
        &self,
        service_id: &str,
        exit_code: Option<i32>,
        last_error: Option<String>,
    ) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        let service = runtime.services.get_mut(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;
        service.pid = None;
        service.last_exit_code = exit_code;
        service.last_error = last_error;
        service.lifecycle = if service.last_error.is_some() {
            ManagedServiceLifecycle::Failed
        } else {
            ManagedServiceLifecycle::Stopped
        };
        Ok(())
    }

    pub fn snapshot(&self) -> Result<SupervisorSnapshot> {
        let runtime = self.lock_runtime()?;
        let services = self
            .definitions
            .iter()
            .map(|definition| {
                let service = runtime.services.get(&definition.id).ok_or_else(|| {
                    FrameworkError::NotFound(format!(
                        "managed service runtime not found: {}",
                        definition.id
                    ))
                })?;

                Ok(ManagedServiceSnapshot {
                    id: definition.id.clone(),
                    display_name: definition.display_name.clone(),
                    lifecycle: service.lifecycle.clone(),
                    startup_order: definition.startup_order,
                    pid: service.pid,
                    last_exit_code: service.last_exit_code,
                    restart_count: service.restart_count,
                    last_error: service.last_error.clone(),
                    graceful_shutdown_timeout_ms: definition.graceful_shutdown_timeout_ms,
                    restart_policy: definition.restart_policy.clone(),
                })
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(SupervisorSnapshot {
            lifecycle: runtime.lifecycle.clone(),
            shutdown_requested: runtime.shutdown_requested,
            services,
        })
    }

    pub fn kernel_info(&self) -> Result<DesktopSupervisorInfo> {
        let snapshot = self.snapshot()?;
        let managed_service_ids = snapshot
            .services
            .iter()
            .map(|service| service.id.clone())
            .collect::<Vec<_>>();
        let services = snapshot
            .services
            .into_iter()
            .map(|service| DesktopSupervisorServiceInfo {
                id: service.id,
                display_name: service.display_name,
                lifecycle: managed_service_lifecycle_label(&service.lifecycle).to_string(),
                pid: service.pid,
                last_exit_code: service.last_exit_code,
                restart_count: service.restart_count,
                last_error: service.last_error,
            })
            .collect::<Vec<_>>();

        Ok(DesktopSupervisorInfo {
            lifecycle: supervisor_lifecycle_label(&snapshot.lifecycle).to_string(),
            shutdown_requested: snapshot.shutdown_requested,
            service_count: services.len(),
            managed_service_ids,
            services,
        })
    }

    fn require_definition(&self, service_id: &str) -> Result<&ManagedServiceDefinition> {
        self.definitions
            .iter()
            .find(|definition| definition.id == service_id)
            .ok_or_else(|| {
                FrameworkError::NotFound(format!("managed service not found: {service_id}"))
            })
    }

    fn lock_runtime(&self) -> Result<MutexGuard<'_, SupervisorRuntime>> {
        self.runtime
            .lock()
            .map_err(|_| FrameworkError::Internal("supervisor runtime lock poisoned".to_string()))
    }

    fn stop_service_process(&self, service_id: &str) -> Result<()> {
        let graceful_shutdown_timeout_ms = self
            .require_definition(service_id)?
            .graceful_shutdown_timeout_ms;

        {
            let mut runtime = self.lock_runtime()?;
            if let Some(service) = runtime.services.get_mut(service_id) {
                service.lifecycle = ManagedServiceLifecycle::Stopping;
            }
        }

        let Some(mut handle) = self.lock_managed_processes()?.remove(service_id) else {
            self.record_stopped(service_id, None, None)?;
            return Ok(());
        };

        let (exit_code, last_error) =
            terminate_process_group(&mut handle.children, graceful_shutdown_timeout_ms)?;
        self.record_stopped(service_id, exit_code, last_error)
    }

    fn resolve_api_router_web_server_config(
        &self,
        paths: &AppPaths,
    ) -> Result<ApiRouterWebServerConfig> {
        let router_root = shared_router_root(paths);
        let router_config = load_router_config(&router_root)?;
        let configured_runtime = self.lock_api_router_runtime()?.clone();
        let runtime = configured_runtime.as_ref();
        let env = current_process_env();

        Ok(ApiRouterWebServerConfig {
            bind_addr: router_config.web_bind,
            gateway_upstream_base_url: upstream_base_url_for_bind(&router_config.gateway_bind)?,
            admin_upstream_base_url: upstream_base_url_for_bind(&router_config.admin_bind)?,
            portal_upstream_base_url: upstream_base_url_for_bind(&router_config.portal_bind)?,
            admin_site_dir: resolve_api_router_site_dir(runtime, &env, RuntimeSite::Admin),
            portal_site_dir: resolve_api_router_site_dir(runtime, &env, RuntimeSite::Portal),
            enable_admin: router_config.enable_admin,
            enable_portal: router_config.enable_portal,
        })
    }

    fn lock_openclaw_runtime(&self) -> Result<MutexGuard<'_, Option<ActivatedOpenClawRuntime>>> {
        self.openclaw_runtime
            .lock()
            .map_err(|_| FrameworkError::Internal("openclaw runtime lock poisoned".to_string()))
    }

    fn lock_api_router_runtime(&self) -> Result<MutexGuard<'_, Option<ActivatedApiRouterRuntime>>> {
        self.api_router_runtime
            .lock()
            .map_err(|_| FrameworkError::Internal("api router runtime lock poisoned".to_string()))
    }

    fn lock_web_server(&self) -> Result<MutexGuard<'_, Option<ApiRouterWebServerHandle>>> {
        self.web_server.lock().map_err(|_| {
            FrameworkError::Internal("api router web server lock poisoned".to_string())
        })
    }

    fn lock_managed_processes(
        &self,
    ) -> Result<MutexGuard<'_, HashMap<String, ManagedServiceProcessHandle>>> {
        self.managed_processes.lock().map_err(|_| {
            FrameworkError::Internal("managed process registry lock poisoned".to_string())
        })
    }

    #[cfg(test)]
    pub fn openclaw_gateway_launch_snapshot(&self) -> Result<Option<(String, Vec<String>)>> {
        Ok(self.lock_openclaw_runtime()?.as_ref().map(|runtime| {
            (
                runtime.node_path.to_string_lossy().into_owned(),
                vec![
                    runtime.cli_path.to_string_lossy().into_owned(),
                    "gateway".to_string(),
                ],
            )
        }))
    }

    #[cfg(test)]
    pub fn api_router_web_server_bind_addr(&self) -> Result<Option<String>> {
        Ok(self
            .lock_web_server()?
            .as_ref()
            .map(|handle| handle.bind_addr().to_string()))
    }
}

impl Default for SupervisorService {
    fn default() -> Self {
        Self::new()
    }
}

fn default_managed_services() -> Vec<ManagedServiceDefinition> {
    vec![
        ManagedServiceDefinition {
            id: SERVICE_ID_OPENCLAW_GATEWAY.to_string(),
            display_name: "OpenClaw Gateway".to_string(),
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 10,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_WEB_SERVER.to_string(),
            display_name: "Embedded Web Server".to_string(),
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 20,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_API_ROUTER.to_string(),
            display_name: "API-Router".to_string(),
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 30,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
    ]
}

fn supervisor_lifecycle_label(lifecycle: &SupervisorLifecycle) -> &'static str {
    match lifecycle {
        SupervisorLifecycle::Starting => "starting",
        SupervisorLifecycle::Running => "running",
        SupervisorLifecycle::Stopping => "stopping",
        SupervisorLifecycle::Stopped => "stopped",
        SupervisorLifecycle::Failed => "failed",
    }
}

fn managed_service_lifecycle_label(lifecycle: &ManagedServiceLifecycle) -> &'static str {
    match lifecycle {
        ManagedServiceLifecycle::Starting => "starting",
        ManagedServiceLifecycle::Running => "running",
        ManagedServiceLifecycle::Stopping => "stopping",
        ManagedServiceLifecycle::Stopped => "stopped",
        ManagedServiceLifecycle::Failed => "failed",
    }
}

fn prepend_path_env(user_bin_dir: &std::path::Path) -> String {
    let current = env::var_os("PATH")
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    let separator = if cfg!(windows) { ';' } else { ':' };
    let user_bin = user_bin_dir.to_string_lossy();

    if current
        .split(separator)
        .any(|entry| entry.eq_ignore_ascii_case(user_bin.as_ref()))
    {
        return current;
    }

    if current.is_empty() {
        return user_bin.into_owned();
    }

    format!("{user_bin}{separator}{current}")
}

fn current_process_env() -> HashMap<String, String> {
    std::env::vars().collect()
}

fn resolve_api_router_site_dir(
    runtime: Option<&ActivatedApiRouterRuntime>,
    env: &HashMap<String, String>,
    site: RuntimeSite,
) -> Option<PathBuf> {
    let explicit = match site {
        RuntimeSite::Admin => env
            .get(HOST_ADMIN_SITE_DIR_ENV)
            .or_else(|| env.get(UPSTREAM_ADMIN_SITE_DIR_ENV)),
        RuntimeSite::Portal => env
            .get(HOST_PORTAL_SITE_DIR_ENV)
            .or_else(|| env.get(UPSTREAM_PORTAL_SITE_DIR_ENV)),
    }
    .map(String::as_str)
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(PathBuf::from);
    if let Some(path) = explicit.filter(|path| path.join("index.html").is_file()) {
        return Some(path);
    }

    let mut candidates = Vec::new();
    if let Some(runtime) = runtime {
        candidates.push(runtime.install_dir.join("sites").join(site.label()));
        candidates.push(
            runtime
                .install_dir
                .join("runtime")
                .join("sites")
                .join(site.label()),
        );
    }
    if let Ok(cwd) = env::current_dir() {
        match site {
            RuntimeSite::Admin => {
                candidates.push(
                    cwd.join(".codex-tools")
                        .join("sdkwork-api-router")
                        .join("apps")
                        .join("sdkwork-router-admin")
                        .join("dist"),
                );
                candidates.push(cwd.join("apps").join("sdkwork-router-admin").join("dist"));
            }
            RuntimeSite::Portal => {
                candidates.push(
                    cwd.join(".codex-tools")
                        .join("sdkwork-api-router")
                        .join("apps")
                        .join("sdkwork-router-portal")
                        .join("dist"),
                );
                candidates.push(cwd.join("apps").join("sdkwork-router-portal").join("dist"));
            }
        }
    }

    candidates
        .into_iter()
        .find(|path| path.is_dir() && path.join("index.html").is_file())
}

fn configure_command_for_managed_process(command: &mut Command) {
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NEW_PROCESS_GROUP);
    }

    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }
}

fn terminate_managed_process(child: &mut Child, timeout_ms: u64) -> Result<Option<i32>> {
    if let Some(status) = child.try_wait()? {
        return Ok(status.code());
    }

    request_process_shutdown(child)?;
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait()? {
            return Ok(status.code());
        }
        thread::sleep(Duration::from_millis(50));
    }

    force_process_shutdown(child)?;
    Ok(child.wait()?.code())
}

fn wait_for_gateway_ready(child: &mut Child, port: u16, timeout_ms: u64) -> Result<()> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let loopback = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port));

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait()? {
            return Err(FrameworkError::ProcessFailed {
                command: "openclaw gateway".to_string(),
                exit_code: status.code(),
                stderr_tail: format!("gateway exited before becoming ready on {}", loopback),
            });
        }

        if TcpStream::connect_timeout(&loopback, Duration::from_millis(200)).is_ok() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err(FrameworkError::Timeout(format!(
        "openclaw gateway did not become ready on {} within {}ms",
        loopback, timeout_ms
    )))
}

fn spawn_managed_api_router_process(
    spec: &ManagedApiRouterProcessSpec,
    log_file_path: &std::path::Path,
    managed_env: &BTreeMap<String, String>,
) -> Result<Child> {
    if let Some(parent) = log_file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let stdout = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file_path)?;
    let stderr = stdout.try_clone()?;
    let mut command = Command::new(&spec.command_path);
    configure_command_for_managed_process(&mut command);
    command.args(&spec.args);
    if let Some(working_dir) = &spec.working_dir {
        command.current_dir(working_dir);
    }
    command.envs(managed_env);
    command.stdout(Stdio::from(stdout));
    command.stderr(Stdio::from(stderr));
    command.spawn().map_err(Into::into)
}

fn wait_for_api_router_ready(paths: &AppPaths, timeout_ms: u64) -> Result<()> {
    let service = ApiRouterRuntimeService::new();
    let router_config = load_router_config(&shared_router_root(paths))?;
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut last_reason = None;

    while Instant::now() < deadline {
        let status = service.inspect(paths)?;
        let host_healthy = probe_api_router_web_server(&router_config.web_bind, 200);
        if status.gateway.healthy
            && (!status.admin.enabled || status.admin.healthy)
            && (!status.portal.enabled || status.portal.healthy)
            && host_healthy
        {
            return Ok(());
        }

        last_reason = Some(format!(
            "{}; adminHealthy={} portalHealthy={} hostHealthy={}",
            status.reason, status.admin.healthy, status.portal.healthy, host_healthy
        ));
        thread::sleep(Duration::from_millis(100));
    }

    Err(FrameworkError::Timeout(format!(
        "sdkwork-api-router did not become ready within {}ms{}",
        timeout_ms,
        last_reason
            .as_deref()
            .map(|reason| format!("; last observation: {reason}"))
            .unwrap_or_default()
    )))
}

fn terminate_process_group(
    children: &mut Vec<ManagedChildProcessHandle>,
    timeout_ms: u64,
) -> Result<(Option<i32>, Option<String>)> {
    let mut first_exit_code = None;
    let mut first_error = None;

    for child in children.iter_mut() {
        match terminate_managed_process(&mut child.child, timeout_ms) {
            Ok(exit_code) => {
                if first_exit_code.is_none() {
                    first_exit_code = exit_code;
                }
            }
            Err(error) => {
                if first_error.is_none() {
                    first_error =
                        Some(format!("failed to stop {} process: {}", child.label, error));
                }
            }
        }
    }

    Ok((first_exit_code, first_error))
}

#[cfg(windows)]
fn request_process_shutdown(child: &mut Child) -> Result<()> {
    let pid = child.id().to_string();
    let _ = Command::new("taskkill")
        .args(["/PID", pid.as_str(), "/T"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    Ok(())
}

#[cfg(not(windows))]
fn request_process_shutdown(child: &mut Child) -> Result<()> {
    let pid = child.id() as i32;
    unsafe {
        libc::killpg(pid, libc::SIGTERM);
    }
    Ok(())
}

#[cfg(windows)]
fn force_process_shutdown(child: &mut Child) -> Result<()> {
    let pid = child.id().to_string();
    let _ = Command::new("taskkill")
        .args(["/PID", pid.as_str(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    if child.try_wait()?.is_none() {
        child.kill()?;
    }

    Ok(())
}

#[cfg(not(windows))]
fn force_process_shutdown(child: &mut Child) -> Result<()> {
    let pid = child.id() as i32;
    unsafe {
        libc::killpg(pid, libc::SIGKILL);
    }
    if child.try_wait()?.is_none() {
        child.kill()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        ManagedServiceLifecycle, SupervisorService, SERVICE_ID_API_ROUTER,
        SERVICE_ID_OPENCLAW_GATEWAY, SERVICE_ID_WEB_SERVER,
    };
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::{
            api_router_managed_runtime::{
                ActivatedApiRouterRuntime, ManagedApiRouterProcessSpec,
                ManagedApiRouterSecretBundle,
            },
            api_router_runtime::load_router_config,
            openclaw_runtime::ActivatedOpenClawRuntime,
        },
    };
    use std::{
        fs,
        time::{Duration, UNIX_EPOCH},
    };

    #[test]
    fn supervisor_registers_default_background_services() {
        let service = SupervisorService::new();

        assert_eq!(
            service.managed_service_ids(),
            vec![
                SERVICE_ID_OPENCLAW_GATEWAY.to_string(),
                SERVICE_ID_WEB_SERVER.to_string(),
                SERVICE_ID_API_ROUTER.to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_plans_shutdown_in_reverse_startup_order() {
        let service = SupervisorService::new();

        assert_eq!(
            service.planned_shutdown_order(),
            vec![
                SERVICE_ID_API_ROUTER.to_string(),
                SERVICE_ID_WEB_SERVER.to_string(),
                SERVICE_ID_OPENCLAW_GATEWAY.to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_requests_manual_restart_for_managed_services() {
        let service = SupervisorService::new();
        service
            .record_running("api_router", Some(42))
            .expect("service should be running");

        service
            .request_restart("api_router")
            .expect("manual restart request");

        let snapshot = service.snapshot().expect("snapshot");
        let api_router = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_API_ROUTER)
            .expect("api router service");

        assert_eq!(api_router.lifecycle, ManagedServiceLifecycle::Starting);
        assert_eq!(api_router.pid, None);
        assert_eq!(api_router.last_exit_code, None);
    }

    #[test]
    fn supervisor_requests_all_services_in_startup_order() {
        let service = SupervisorService::new();

        assert_eq!(
            service.request_restart_all().expect("restart plan"),
            vec![
                SERVICE_ID_OPENCLAW_GATEWAY.to_string(),
                SERVICE_ID_WEB_SERVER.to_string(),
                SERVICE_ID_API_ROUTER.to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_throttles_restart_storms_within_the_policy_window() {
        let service = SupervisorService::new();
        let started_at = UNIX_EPOCH + Duration::from_secs(1_000);

        assert!(service
            .register_restart_attempt(SERVICE_ID_OPENCLAW_GATEWAY, started_at)
            .expect("first restart"));
        assert!(service
            .register_restart_attempt(
                SERVICE_ID_OPENCLAW_GATEWAY,
                started_at + Duration::from_secs(5),
            )
            .expect("second restart"));
        assert!(service
            .register_restart_attempt(
                SERVICE_ID_OPENCLAW_GATEWAY,
                started_at + Duration::from_secs(10),
            )
            .expect("third restart"));
        assert!(!service
            .register_restart_attempt(
                SERVICE_ID_OPENCLAW_GATEWAY,
                started_at + Duration::from_secs(15),
            )
            .expect("fourth restart should be blocked"));
    }

    #[test]
    fn supervisor_disables_restarts_after_intentional_shutdown() {
        let service = SupervisorService::new();

        service.begin_shutdown().expect("begin shutdown");

        assert!(!service
            .register_restart_attempt(SERVICE_ID_API_ROUTER, UNIX_EPOCH + Duration::from_secs(10))
            .expect("restart should be disabled"));
    }

    #[test]
    fn supervisor_configures_openclaw_gateway_launch_from_runtime() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime(&paths);

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");

        let launch = service
            .openclaw_gateway_launch_snapshot()
            .expect("launch snapshot")
            .expect("configured launch");

        assert_eq!(launch.0, runtime.node_path.to_string_lossy());
        assert_eq!(
            launch.1,
            vec![
                runtime.cli_path.to_string_lossy().into_owned(),
                "gateway".to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_starts_and_stops_configured_openclaw_gateway_process() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime(&paths);

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        service
            .start_openclaw_gateway(&paths)
            .expect("start gateway");

        let running = service.snapshot().expect("running snapshot");
        let openclaw = running
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Running);
        assert!(openclaw.pid.is_some());

        service.begin_shutdown().expect("shutdown");

        let stopped = service.snapshot().expect("stopped snapshot");
        let openclaw = stopped
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Stopped);
        assert_eq!(openclaw.pid, None);
    }

    #[test]
    fn supervisor_start_refreshes_openclaw_runtime_from_managed_config() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime(&paths);
        let configured_port = 28_789;

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {configured_port}\n  }}\n}}\n"),
        )
        .expect("seed updated config");

        service
            .start_openclaw_gateway(&paths)
            .expect("start gateway with refreshed port");

        let refreshed = service
            .configured_openclaw_runtime()
            .expect("configured runtime")
            .expect("runtime");
        assert_eq!(refreshed.gateway_port, configured_port);

        service.begin_shutdown().expect("shutdown");
    }

    #[test]
    fn supervisor_allows_slow_openclaw_gateway_startup_within_the_readiness_window() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime_with_delay_ms(&paths, 11_000);

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        service
            .start_openclaw_gateway(&paths)
            .expect("slow gateway should still become ready");

        let running = service.snapshot().expect("running snapshot");
        let openclaw = running
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Running);
        assert!(openclaw.pid.is_some());

        service.begin_shutdown().expect("shutdown");
    }

    #[test]
    fn supervisor_starts_and_stops_configured_api_router_process_group() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_api_router_runtime(&paths);

        service
            .configure_api_router_runtime(&runtime)
            .expect("configure router runtime");
        service.start_api_router(&paths).expect("start api router");

        let running = service.snapshot().expect("running snapshot");
        let api_router = running
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_API_ROUTER)
            .expect("api router service");
        assert_eq!(api_router.lifecycle, ManagedServiceLifecycle::Running);
        assert!(api_router.pid.is_some());

        service.stop_api_router().expect("stop api router");

        let stopped = service.snapshot().expect("stopped snapshot");
        let api_router = stopped
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_API_ROUTER)
            .expect("api router service");
        assert_eq!(api_router.lifecycle, ManagedServiceLifecycle::Stopped);
        assert_eq!(api_router.pid, None);
    }

    #[test]
    fn supervisor_serves_bundled_api_router_admin_and_portal_sites_through_unified_web_bind() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_api_router_runtime(&paths);
        let web_bind = load_router_config(&runtime.shared_root_dir)
            .expect("router config")
            .web_bind;

        service
            .configure_api_router_runtime(&runtime)
            .expect("configure router runtime");
        service.start_api_router(&paths).expect("start api router");

        let admin_response = fetch_test_http_response(&web_bind, "/admin/");
        let portal_response = fetch_test_http_response(&web_bind, "/portal/");

        assert!(admin_response.starts_with("HTTP/1.1 200"));
        assert!(admin_response.contains("sdkwork-api-router test admin"));
        assert!(portal_response.starts_with("HTTP/1.1 200"));
        assert!(portal_response.contains("sdkwork-api-router test portal"));

        service.stop_api_router().expect("stop api router");
    }

    #[cfg(windows)]
    fn fake_gateway_runtime(paths: &crate::framework::paths::AppPaths) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_delay_ms(paths, 0)
    }

    #[cfg(windows)]
    fn fake_gateway_runtime_with_delay_ms(
        paths: &crate::framework::paths::AppPaths,
        listen_delay_ms: u64,
    ) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-gateway");
        let runtime_dir = install_dir.join("runtime");
        let node_path = resolve_test_node_executable();
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");
        let gateway_port = 18_789;

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {gateway_port}\n  }}\n}}\n"),
        )
        .expect("config file");
        fs::write(
            &cli_path,
            format!(
                "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst server = net.createServer();\nconst start = () => server.listen(gatewayPort, '127.0.0.1');\nsetTimeout(start, {listen_delay_ms});\nsetInterval(() => {{}}, 1000);\n"
            ),
        )
        .expect("cli file");

        ActivatedOpenClawRuntime {
            install_key: "test-gateway".to_string(),
            install_dir,
            runtime_dir,
            node_path,
            cli_path,
            home_dir: paths.openclaw_home_dir.clone(),
            state_dir: paths.openclaw_state_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    #[cfg(not(windows))]
    fn fake_gateway_runtime(paths: &crate::framework::paths::AppPaths) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_delay_ms(paths, 0)
    }

    #[cfg(not(windows))]
    fn fake_gateway_runtime_with_delay_ms(
        paths: &crate::framework::paths::AppPaths,
        listen_delay_ms: u64,
    ) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-gateway");
        let runtime_dir = install_dir.join("runtime");
        let node_path = resolve_test_node_executable();
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");
        let gateway_port = 18_789;

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {gateway_port}\n  }}\n}}\n"),
        )
        .expect("config file");
        fs::write(
            &cli_path,
            format!(
                "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst server = net.createServer();\nconst start = () => server.listen(gatewayPort, '127.0.0.1');\nsetTimeout(start, {listen_delay_ms});\nsetInterval(() => {{}}, 1000);\n"
            ),
        )
        .expect("cli file");

        ActivatedOpenClawRuntime {
            install_key: "test-gateway".to_string(),
            install_dir,
            runtime_dir,
            node_path,
            cli_path,
            home_dir: paths.openclaw_home_dir.clone(),
            state_dir: paths.openclaw_state_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for OpenClaw supervisor tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .expect("node should be available on PATH for OpenClaw supervisor tests")
    }

    fn reserve_available_bind_addr() -> String {
        std::net::TcpListener::bind("127.0.0.1:0")
            .expect("reserve bind addr")
            .local_addr()
            .expect("local addr")
            .to_string()
    }

    #[cfg(windows)]
    fn fake_api_router_runtime(
        paths: &crate::framework::paths::AppPaths,
    ) -> ActivatedApiRouterRuntime {
        let install_dir = paths
            .managed_runtimes_dir
            .join("api-router")
            .join("test-router");
        let gateway_script = install_dir.join("gateway.mjs");
        let admin_script = install_dir.join("admin.mjs");
        let portal_script = install_dir.join("portal.mjs");
        let router_root = paths
            .user_root
            .parent()
            .expect("shared root")
            .join("router");
        let admin_site_dir = install_dir.join("runtime").join("sites").join("admin");
        let portal_site_dir = install_dir.join("runtime").join("sites").join("portal");
        let gateway_bind = reserve_available_bind_addr();
        let admin_bind = reserve_available_bind_addr();
        let portal_bind = reserve_available_bind_addr();
        let web_bind = reserve_available_bind_addr();

        fs::create_dir_all(&install_dir).expect("router install dir");
        fs::create_dir_all(&router_root).expect("router root");
        fs::create_dir_all(&admin_site_dir).expect("admin site dir");
        fs::create_dir_all(&portal_site_dir).expect("portal site dir");
        fs::write(
            router_root.join("config.json"),
            format!(
                "{{\"gateway_bind\":\"{}\",\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"web_bind\":\"{}\"}}\n",
                gateway_bind, admin_bind, portal_bind, web_bind
            ),
        )
        .expect("router config");
        fs::write(
            admin_site_dir.join("index.html"),
            "<!doctype html><title>sdkwork-api-router test admin</title>",
        )
        .expect("admin site");
        fs::write(
            portal_site_dir.join("index.html"),
            "<!doctype html><title>sdkwork-api-router test portal</title>",
        )
        .expect("portal site");
        fs::write(
            &gateway_script,
            format!(
                "import net from 'node:net';\nconst bind = '{}';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {{\n  socket.once('data', (chunk) => {{\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${{status}}\\r\\nContent-Length: ${{body.length}}\\r\\nConnection: close\\r\\n\\r\\n${{body}}`);\n  }});\n}});\nserver.listen(Number(port), host);\nsetInterval(() => {{}}, 1000);\n",
                gateway_bind
            ),
        )
        .expect("gateway script");
        fs::write(
            &admin_script,
            format!(
                "import net from 'node:net';\nconst bind = '{}';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {{\n  socket.once('data', (chunk) => {{\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /admin/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${{status}}\\r\\nContent-Length: ${{body.length}}\\r\\nConnection: close\\r\\n\\r\\n${{body}}`);\n  }});\n}});\nserver.listen(Number(port), host);\nsetInterval(() => {{}}, 1000);\n",
                admin_bind
            ),
        )
        .expect("admin script");
        fs::write(
            &portal_script,
            format!(
                "import net from 'node:net';\nconst bind = '{}';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {{\n  socket.once('data', (chunk) => {{\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /portal/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${{status}}\\r\\nContent-Length: ${{body.length}}\\r\\nConnection: close\\r\\n\\r\\n${{body}}`);\n  }});\n}});\nserver.listen(Number(port), host);\nsetInterval(() => {{}}, 1000);\n",
                portal_bind
            ),
        )
        .expect("portal script");

        ActivatedApiRouterRuntime {
            install_key: "test-router".to_string(),
            install_dir,
            shared_root_dir: router_root,
            bind_env_overrides: std::collections::BTreeMap::new(),
            managed_secrets: ManagedApiRouterSecretBundle {
                schema_version: 1,
                admin_jwt_signing_secret: "test-admin-jwt-signing-secret".to_string(),
                portal_jwt_signing_secret: "test-portal-jwt-signing-secret".to_string(),
                credential_master_key: "test-credential-master-key".to_string(),
            },
            gateway: ManagedApiRouterProcessSpec {
                command_path: std::path::PathBuf::from("node"),
                args: vec![gateway_script.to_string_lossy().into_owned()],
                working_dir: None,
            },
            admin: ManagedApiRouterProcessSpec {
                command_path: std::path::PathBuf::from("node"),
                args: vec![admin_script.to_string_lossy().into_owned()],
                working_dir: None,
            },
            portal: ManagedApiRouterProcessSpec {
                command_path: std::path::PathBuf::from("node"),
                args: vec![portal_script.to_string_lossy().into_owned()],
                working_dir: None,
            },
        }
    }

    #[cfg(not(windows))]
    fn fake_api_router_runtime(
        paths: &crate::framework::paths::AppPaths,
    ) -> ActivatedApiRouterRuntime {
        let install_dir = paths
            .managed_runtimes_dir
            .join("api-router")
            .join("test-router");
        let gateway_script = install_dir.join("gateway.mjs");
        let admin_script = install_dir.join("admin.mjs");
        let portal_script = install_dir.join("portal.mjs");
        let router_root = paths
            .user_root
            .parent()
            .expect("shared root")
            .join("router");
        let admin_site_dir = install_dir.join("runtime").join("sites").join("admin");
        let portal_site_dir = install_dir.join("runtime").join("sites").join("portal");
        let gateway_bind = reserve_available_bind_addr();
        let admin_bind = reserve_available_bind_addr();
        let portal_bind = reserve_available_bind_addr();
        let web_bind = reserve_available_bind_addr();

        fs::create_dir_all(&install_dir).expect("router install dir");
        fs::create_dir_all(&router_root).expect("router root");
        fs::create_dir_all(&admin_site_dir).expect("admin site dir");
        fs::create_dir_all(&portal_site_dir).expect("portal site dir");
        fs::write(
            router_root.join("config.json"),
            format!(
                "{{\"gateway_bind\":\"{}\",\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"web_bind\":\"{}\"}}\n",
                gateway_bind, admin_bind, portal_bind, web_bind
            ),
        )
        .expect("router config");
        fs::write(
            admin_site_dir.join("index.html"),
            "<!doctype html><title>sdkwork-api-router test admin</title>",
        )
        .expect("admin site");
        fs::write(
            portal_site_dir.join("index.html"),
            "<!doctype html><title>sdkwork-api-router test portal</title>",
        )
        .expect("portal site");
        fs::write(
            &gateway_script,
            format!(
                "import net from 'node:net';\nconst bind = '{}';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {{\n  socket.once('data', (chunk) => {{\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${{status}}\\r\\nContent-Length: ${{body.length}}\\r\\nConnection: close\\r\\n\\r\\n${{body}}`);\n  }});\n}});\nserver.listen(Number(port), host);\nsetInterval(() => {{}}, 1000);\n",
                gateway_bind
            ),
        )
        .expect("gateway script");
        fs::write(
            &admin_script,
            format!(
                "import net from 'node:net';\nconst bind = '{}';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {{\n  socket.once('data', (chunk) => {{\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /admin/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${{status}}\\r\\nContent-Length: ${{body.length}}\\r\\nConnection: close\\r\\n\\r\\n${{body}}`);\n  }});\n}});\nserver.listen(Number(port), host);\nsetInterval(() => {{}}, 1000);\n",
                admin_bind
            ),
        )
        .expect("admin script");
        fs::write(
            &portal_script,
            format!(
                "import net from 'node:net';\nconst bind = '{}';\nconst [host, port] = bind.split(':');\nconst server = net.createServer((socket) => {{\n  socket.once('data', (chunk) => {{\n    const request = chunk.toString();\n    const ok = request.startsWith('GET /portal/health ');\n    const body = ok ? 'ok' : 'missing';\n    const status = ok ? '200 OK' : '404 Not Found';\n    socket.end(`HTTP/1.1 ${{status}}\\r\\nContent-Length: ${{body.length}}\\r\\nConnection: close\\r\\n\\r\\n${{body}}`);\n  }});\n}});\nserver.listen(Number(port), host);\nsetInterval(() => {{}}, 1000);\n",
                portal_bind
            ),
        )
        .expect("portal script");

        ActivatedApiRouterRuntime {
            install_key: "test-router".to_string(),
            install_dir,
            shared_root_dir: router_root,
            bind_env_overrides: std::collections::BTreeMap::new(),
            managed_secrets: ManagedApiRouterSecretBundle {
                schema_version: 1,
                admin_jwt_signing_secret: "test-admin-jwt-signing-secret".to_string(),
                portal_jwt_signing_secret: "test-portal-jwt-signing-secret".to_string(),
                credential_master_key: "test-credential-master-key".to_string(),
            },
            gateway: ManagedApiRouterProcessSpec {
                command_path: std::path::PathBuf::from("node"),
                args: vec![gateway_script.to_string_lossy().into_owned()],
                working_dir: None,
            },
            admin: ManagedApiRouterProcessSpec {
                command_path: std::path::PathBuf::from("node"),
                args: vec![admin_script.to_string_lossy().into_owned()],
                working_dir: None,
            },
            portal: ManagedApiRouterProcessSpec {
                command_path: std::path::PathBuf::from("node"),
                args: vec![portal_script.to_string_lossy().into_owned()],
                working_dir: None,
            },
        }
    }

    fn fetch_test_http_response(bind_addr: &str, path: &str) -> String {
        use std::io::{Read, Write};
        use std::net::TcpStream;

        let mut stream = TcpStream::connect(bind_addr).expect("connect test http stream");
        let request =
            format!("GET {path} HTTP/1.1\r\nHost: {bind_addr}\r\nConnection: close\r\n\r\n");
        stream
            .write_all(request.as_bytes())
            .expect("write test http request");
        stream.flush().expect("flush test http request");

        let mut response = String::new();
        stream
            .read_to_string(&mut response)
            .expect("read test http response");
        response
    }
}
