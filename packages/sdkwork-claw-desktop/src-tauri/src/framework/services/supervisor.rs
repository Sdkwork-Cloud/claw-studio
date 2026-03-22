#![allow(dead_code)]

use crate::framework::{
    kernel::{DesktopSupervisorInfo, DesktopSupervisorServiceInfo},
    paths::AppPaths,
    FrameworkError, Result,
};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, SystemTime},
};

const DEFAULT_RESTART_WINDOW_MS: u64 = 60_000;
const DEFAULT_RESTART_BACKOFF_MS: u64 = 5_000;
const DEFAULT_MAX_RESTARTS: usize = 3;
const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS: u64 = 10_000;
const CODEX_APP_SERVER_LISTEN_URL: &str = "ws://127.0.0.1:46110";
const OPENCLAW_GATEWAY_PORT: &str = "18789";
const API_ROUTER_CONFIG_DIR_NAME: &str = "sdkwork-api-router";
const API_ROUTER_WEB_BIND: &str = "127.0.0.1:3001";
const API_ROUTER_GATEWAY_TARGET: &str = "127.0.0.1:8080";
const API_ROUTER_ADMIN_TARGET: &str = "127.0.0.1:8081";
const API_ROUTER_PORTAL_TARGET: &str = "127.0.0.1:8082";

pub const SERVICE_ID_CODEX: &str = "codex";
pub const SERVICE_ID_OPENCLAW: &str = "openclaw";
pub const SERVICE_ID_ZEROCLAW: &str = "zeroclaw";
pub const SERVICE_ID_IRONCLAW: &str = "ironclaw";
pub const SERVICE_ID_API_ROUTER_GATEWAY: &str = "sdkwork_api_router_gateway";
pub const SERVICE_ID_API_ROUTER_ADMIN_API: &str = "sdkwork_api_router_admin_api";
pub const SERVICE_ID_API_ROUTER_PORTAL_API: &str = "sdkwork_api_router_portal_api";
pub const SERVICE_ID_API_ROUTER_WEB_SERVER: &str = "sdkwork_api_router_web_server";
pub const SERVICE_ID_OPENCLAW_GATEWAY: &str = SERVICE_ID_OPENCLAW;
pub const SERVICE_ID_WEB_SERVER: &str = SERVICE_ID_API_ROUTER_WEB_SERVER;
pub const SERVICE_ID_API_ROUTER: &str = SERVICE_ID_API_ROUTER_GATEWAY;

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
    pub auto_start: bool,
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
    processes: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
    intentional_stops: Arc<Mutex<HashSet<String>>>,
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

impl SupervisorService {
    pub fn new() -> Self {
        Self::from_definitions(default_managed_services())
    }

    pub fn from_definitions(definitions: Vec<ManagedServiceDefinition>) -> Self {
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
            processes: Arc::new(Mutex::new(HashMap::new())),
            intentional_stops: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn for_paths(paths: &AppPaths) -> Self {
        Self::from_definitions(managed_services_for_paths(paths))
    }

    pub fn managed_service_ids(&self) -> Vec<String> {
        let mut ids = self
            .definitions
            .iter()
            .map(|definition| definition.id.clone())
            .collect::<Vec<_>>();
        ids.sort_by_key(|id| managed_service_inventory_order(id));
        ids
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

    pub fn default_startup_service_ids(&self) -> Vec<String> {
        let mut definitions = self
            .definitions
            .iter()
            .filter(|definition| definition.auto_start)
            .collect::<Vec<_>>();
        definitions.sort_by_key(|definition| definition.startup_order);
        definitions
            .into_iter()
            .map(|definition| definition.id.clone())
            .collect()
    }

    pub fn register_restart_attempt(&self, service_id: &str, at: SystemTime) -> Result<bool> {
        let definition = self.require_definition(service_id)?;
        let mut runtime = self.lock_runtime()?;
        if runtime.shutdown_requested {
            return Ok(false);
        }

        let service = runtime
            .services
            .get_mut(service_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("managed service not found: {service_id}")))?;

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
        let definition = self.require_definition(service_id)?.clone();
        let mut runtime = self.lock_runtime()?;
        if runtime.shutdown_requested {
            return Err(FrameworkError::Conflict(
                "application shutdown has already been requested".to_string(),
            ));
        }

        let service = runtime
            .services
            .get_mut(service_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("managed service not found: {service_id}")))?;
        service.lifecycle = ManagedServiceLifecycle::Starting;
        service.pid = None;
        service.last_exit_code = None;
        service.last_error = None;
        runtime.lifecycle = SupervisorLifecycle::Running;
        drop(runtime);

        if definition.command.is_some() {
            self.spawn_managed_process(&definition)?;
        }

        Ok(())
    }

    pub fn request_restart_all(&self) -> Result<Vec<String>> {
        let planned_services = self.default_startup_service_ids();
        for service_id in &planned_services {
            self.request_restart(service_id)?;
        }

        Ok(planned_services)
    }

    pub fn start_default_services(&self) -> Result<Vec<String>> {
        self.request_restart_all()
    }

    pub fn stop_service(&self, service_id: &str) -> Result<()> {
        self.require_definition(service_id)?;
        self.terminate_process(service_id)?;

        let mut runtime = self.lock_runtime()?;
        let service = runtime
            .services
            .get_mut(service_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("managed service not found: {service_id}")))?;
        service.lifecycle = ManagedServiceLifecycle::Stopped;
        service.pid = None;
        service.last_error = None;
        Ok(())
    }

    pub fn begin_shutdown(&self) -> Result<()> {
        self.terminate_all_processes()?;
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
        Ok(())
    }

    pub fn complete_shutdown(&self) -> Result<()> {
        self.terminate_all_processes()?;
        let mut runtime = self.lock_runtime()?;
        runtime.lifecycle = SupervisorLifecycle::Stopped;
        for service in runtime.services.values_mut() {
            service.lifecycle = ManagedServiceLifecycle::Stopped;
            service.pid = None;
        }
        self.lock_processes()?.clear();
        self.lock_intentional_stops()?.clear();
        Ok(())
    }

    pub fn record_running(&self, service_id: &str, pid: Option<u32>) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        let service = runtime
            .services
            .get_mut(service_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("managed service not found: {service_id}")))?;
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
        let service = runtime
            .services
            .get_mut(service_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("managed service not found: {service_id}")))?;
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
        let managed_service_ids = self.managed_service_ids();
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
            .ok_or_else(|| FrameworkError::NotFound(format!("managed service not found: {service_id}")))
    }

    fn lock_runtime(&self) -> Result<MutexGuard<'_, SupervisorRuntime>> {
        self.runtime
            .lock()
            .map_err(|_| FrameworkError::Internal("supervisor runtime lock poisoned".to_string()))
    }

    fn lock_processes(
        &self,
    ) -> Result<MutexGuard<'_, HashMap<String, Arc<Mutex<Child>>>>> {
        self.processes
            .lock()
            .map_err(|_| FrameworkError::Internal("supervisor process lock poisoned".to_string()))
    }

    fn lock_intentional_stops(&self) -> Result<MutexGuard<'_, HashSet<String>>> {
        self.intentional_stops
            .lock()
            .map_err(|_| FrameworkError::Internal("supervisor intentional stop lock poisoned".to_string()))
    }

    fn mark_intentional_stop(&self, service_id: &str) -> Result<()> {
        self.lock_intentional_stops()?.insert(service_id.to_string());
        Ok(())
    }

    fn take_intentional_stop(&self, service_id: &str) -> Result<bool> {
        Ok(self.lock_intentional_stops()?.remove(service_id))
    }

    fn spawn_managed_process(&self, definition: &ManagedServiceDefinition) -> Result<()> {
        let command = definition.command.as_ref().ok_or_else(|| {
            FrameworkError::ValidationFailed(format!(
                "managed service {} is missing a command",
                definition.id
            ))
        })?;

        self.terminate_process(definition.id.as_str())?;

        let mut process = Command::new(command);
        process.args(&definition.args);
        process.stdin(Stdio::null());
        process.stdout(Stdio::null());
        process.stderr(Stdio::null());
        if let Some(cwd) = &definition.cwd {
            process.current_dir(cwd);
        }
        if !definition.env.is_empty() {
            process.envs(definition.env.iter().map(|(key, value)| (key, value)));
        }

        let child = Arc::new(Mutex::new(process.spawn()?));
        let pid = child
            .lock()
            .map_err(|_| FrameworkError::Internal("managed child process lock poisoned".to_string()))?
            .id();

        self.lock_processes()?
            .insert(definition.id.clone(), child.clone());
        self.record_running(definition.id.as_str(), Some(pid))?;

        let service = self.clone();
        let service_id = definition.id.clone();
        thread::spawn(move || {
            let exit_status = child
                .lock()
                .map_err(|_| {
                    FrameworkError::Internal("managed child process lock poisoned".to_string())
                })
                .and_then(|mut child| child.wait().map_err(FrameworkError::from));

            let intentional_stop = service.take_intentional_stop(service_id.as_str()).unwrap_or(false);
            let (exit_code, last_error) = match exit_status {
                Ok(status) if status.success() || intentional_stop => (status.code(), None),
                Ok(status) => (
                    status.code(),
                    Some(format!(
                        "managed service exited unsuccessfully: {} ({:?})",
                        service_id,
                        status.code()
                    )),
                ),
                Err(error) => (None, Some(error.to_string())),
            };

            let _ = service.lock_processes().map(|mut processes| {
                processes.remove(service_id.as_str());
            });
            let _ = service.record_stopped(service_id.as_str(), exit_code, last_error);
        });

        Ok(())
    }

    fn terminate_all_processes(&self) -> Result<()> {
        let service_ids = self
            .lock_processes()?
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        for service_id in service_ids {
            self.terminate_process(service_id.as_str())?;
        }
        Ok(())
    }

    fn terminate_process(&self, service_id: &str) -> Result<()> {
        let process = self.lock_processes()?.get(service_id).cloned();
        let Some(process) = process else {
            return Ok(());
        };

        let mut child = process
            .lock()
            .map_err(|_| FrameworkError::Internal("managed child process lock poisoned".to_string()))?;
        if child.try_wait()?.is_none() {
            self.mark_intentional_stop(service_id)?;
            child.kill()?;
        }
        Ok(())
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
            id: SERVICE_ID_CODEX.to_string(),
            display_name: "Codex".to_string(),
            auto_start: true,
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
            id: SERVICE_ID_API_ROUTER_GATEWAY.to_string(),
            display_name: "SdkWork API Router Gateway".to_string(),
            auto_start: true,
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
            id: SERVICE_ID_API_ROUTER_WEB_SERVER.to_string(),
            display_name: "SdkWork API Router Web Server".to_string(),
            auto_start: true,
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 50,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_API_ROUTER_ADMIN_API.to_string(),
            display_name: "SdkWork API Router Admin API".to_string(),
            auto_start: true,
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 30,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_API_ROUTER_PORTAL_API.to_string(),
            display_name: "SdkWork API Router Portal API".to_string(),
            auto_start: true,
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 40,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_OPENCLAW.to_string(),
            display_name: "OpenClaw".to_string(),
            auto_start: false,
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 60,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_ZEROCLAW.to_string(),
            display_name: "ZeroClaw".to_string(),
            auto_start: false,
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 70,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
        ManagedServiceDefinition {
            id: SERVICE_ID_IRONCLAW.to_string(),
            display_name: "IronClaw".to_string(),
            auto_start: false,
            command: None,
            args: Vec::new(),
            cwd: None,
            env: BTreeMap::new(),
            startup_order: 80,
            graceful_shutdown_timeout_ms: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        },
    ]
}

fn managed_services_for_paths(paths: &AppPaths) -> Vec<ManagedServiceDefinition> {
    let mut definitions = default_managed_services();
    let codex_command = paths
        .modules_dir
        .join("codex")
        .join("current")
        .join("bin")
        .join(platform_binary_name("codex"));
    let router_bin_dir = paths
        .modules_dir
        .join("sdkwork-api-router")
        .join("current")
        .join("bin");
    let router_web_dir = paths
        .modules_dir
        .join("sdkwork-api-router")
        .join("current")
        .join("web");
    let router_config_dir = paths
        .integrations_dir
        .join(API_ROUTER_CONFIG_DIR_NAME);
    let node_command = paths
        .runtimes_dir
        .join("node")
        .join("current")
        .join(platform_binary_name("node"));
    let openclaw_entry = paths
        .modules_dir
        .join("openclaw")
        .join("current")
        .join("app")
        .join("openclaw.mjs");

    for definition in &mut definitions {
        match definition.id.as_str() {
            SERVICE_ID_CODEX => {
                definition.command = Some(codex_command.to_string_lossy().into_owned());
                definition.args = vec![
                    "app-server".to_string(),
                    "--listen".to_string(),
                    CODEX_APP_SERVER_LISTEN_URL.to_string(),
                ];
                definition.cwd = Some(paths.install_root.clone());
            }
            SERVICE_ID_API_ROUTER_GATEWAY => {
                definition.command = Some(
                    router_bin_dir
                        .join(platform_binary_name("gateway-service"))
                        .to_string_lossy()
                        .into_owned(),
                );
                definition.cwd = Some(paths.install_root.clone());
                definition.env = router_service_env(&router_config_dir);
            }
            SERVICE_ID_API_ROUTER_ADMIN_API => {
                definition.command = Some(
                    router_bin_dir
                        .join(platform_binary_name("admin-api-service"))
                        .to_string_lossy()
                        .into_owned(),
                );
                definition.cwd = Some(paths.install_root.clone());
                definition.env = router_service_env(&router_config_dir);
            }
            SERVICE_ID_API_ROUTER_PORTAL_API => {
                definition.command = Some(
                    router_bin_dir
                        .join(platform_binary_name("portal-api-service"))
                        .to_string_lossy()
                        .into_owned(),
                );
                definition.cwd = Some(paths.install_root.clone());
                definition.env = router_service_env(&router_config_dir);
            }
            SERVICE_ID_API_ROUTER_WEB_SERVER => {
                definition.command = Some(
                    router_bin_dir
                        .join(platform_binary_name("router-web-service"))
                        .to_string_lossy()
                        .into_owned(),
                );
                definition.cwd = Some(paths.install_root.clone());
                definition.env = router_web_service_env(&router_web_dir);
            }
            SERVICE_ID_OPENCLAW => {
                definition.command = Some(node_command.to_string_lossy().into_owned());
                definition.args = vec![
                    openclaw_entry.to_string_lossy().into_owned(),
                    "gateway".to_string(),
                    "--port".to_string(),
                    OPENCLAW_GATEWAY_PORT.to_string(),
                ];
                definition.cwd = Some(
                    paths
                        .modules_dir
                        .join("openclaw")
                        .join("current")
                        .join("app"),
                );
            }
            _ => {}
        }
    }

    definitions
}

fn router_service_env(config_dir: &PathBuf) -> BTreeMap<String, String> {
    BTreeMap::from([
        (
            "SDKWORK_CONFIG_DIR".to_string(),
            config_dir.to_string_lossy().into_owned(),
        ),
    ])
}

fn router_web_service_env(router_web_dir: &PathBuf) -> BTreeMap<String, String> {
    BTreeMap::from([
        ("SDKWORK_WEB_BIND".to_string(), API_ROUTER_WEB_BIND.to_string()),
        (
            "SDKWORK_ADMIN_SITE_DIR".to_string(),
            router_web_dir.join("admin").to_string_lossy().into_owned(),
        ),
        (
            "SDKWORK_PORTAL_SITE_DIR".to_string(),
            router_web_dir.join("portal").to_string_lossy().into_owned(),
        ),
        (
            "SDKWORK_ADMIN_PROXY_TARGET".to_string(),
            API_ROUTER_ADMIN_TARGET.to_string(),
        ),
        (
            "SDKWORK_PORTAL_PROXY_TARGET".to_string(),
            API_ROUTER_PORTAL_TARGET.to_string(),
        ),
        (
            "SDKWORK_GATEWAY_PROXY_TARGET".to_string(),
            API_ROUTER_GATEWAY_TARGET.to_string(),
        ),
    ])
}

fn platform_binary_name(name: &str) -> String {
    #[cfg(windows)]
    {
        format!("{name}.exe")
    }

    #[cfg(not(windows))]
    {
        name.to_string()
    }
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

#[cfg(test)]
mod tests {
    use super::{
        default_managed_services, ManagedServiceDefinition, ManagedServiceHealthCheck,
        ManagedServiceLifecycle, RestartPolicy, SupervisorService, SERVICE_ID_API_ROUTER_WEB_SERVER,
        SERVICE_ID_CODEX,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use std::collections::BTreeMap;
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn supervisor_registers_default_background_services() {
        let service = SupervisorService::new();

        assert_eq!(
            service.managed_service_ids(),
            vec![
                "codex".to_string(),
                "openclaw".to_string(),
                "zeroclaw".to_string(),
                "ironclaw".to_string(),
                "sdkwork_api_router_gateway".to_string(),
                "sdkwork_api_router_admin_api".to_string(),
                "sdkwork_api_router_portal_api".to_string(),
                "sdkwork_api_router_web_server".to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_plans_shutdown_in_reverse_startup_order() {
        let service = SupervisorService::new();

        assert_eq!(
            service.planned_shutdown_order(),
            vec![
                "ironclaw".to_string(),
                "zeroclaw".to_string(),
                "openclaw".to_string(),
                "sdkwork_api_router_web_server".to_string(),
                "sdkwork_api_router_portal_api".to_string(),
                "sdkwork_api_router_admin_api".to_string(),
                "sdkwork_api_router_gateway".to_string(),
                "codex".to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_resolves_default_startup_subset_for_packaged_platform() {
        let service = SupervisorService::new();

        assert_eq!(
            service.default_startup_service_ids(),
            vec![
                "codex".to_string(),
                "sdkwork_api_router_gateway".to_string(),
                "sdkwork_api_router_admin_api".to_string(),
                "sdkwork_api_router_portal_api".to_string(),
                "sdkwork_api_router_web_server".to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_requests_manual_restart_for_managed_services() {
        let service = SupervisorService::new();
        service
            .record_running("sdkwork_api_router_gateway", Some(42))
            .expect("service should be running");

        service
            .request_restart("sdkwork_api_router_gateway")
            .expect("manual restart request");

        let snapshot = service.snapshot().expect("snapshot");
        let api_router = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == "sdkwork_api_router_gateway")
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
                "codex".to_string(),
                "sdkwork_api_router_gateway".to_string(),
                "sdkwork_api_router_admin_api".to_string(),
                "sdkwork_api_router_portal_api".to_string(),
                "sdkwork_api_router_web_server".to_string(),
            ]
        );
    }

    #[test]
    fn supervisor_throttles_restart_storms_within_the_policy_window() {
        let service = SupervisorService::new();
        let started_at = UNIX_EPOCH + Duration::from_secs(1_000);

        assert!(service
            .register_restart_attempt("codex", started_at)
            .expect("first restart"));
        assert!(service
            .register_restart_attempt(
                "codex",
                started_at + Duration::from_secs(5),
            )
            .expect("second restart"));
        assert!(service
            .register_restart_attempt(
                "codex",
                started_at + Duration::from_secs(10),
            )
            .expect("third restart"));
        assert!(!service
            .register_restart_attempt(
                "codex",
                started_at + Duration::from_secs(15),
            )
            .expect("fourth restart should be blocked"));
    }

    #[test]
    fn supervisor_disables_restarts_after_intentional_shutdown() {
        let service = SupervisorService::new();

        service.begin_shutdown().expect("begin shutdown");

        assert!(!service
            .register_restart_attempt("sdkwork_api_router_gateway", UNIX_EPOCH + Duration::from_secs(10))
            .expect("restart should be disabled"));
    }

    #[test]
    fn supervisor_starts_auto_start_processes_and_records_running_pid() {
        let service = SupervisorService::from_definitions(vec![test_managed_service_definition(
            "codex",
            true,
        )]);

        let started = service
            .start_default_services()
            .expect("default services should start");

        assert_eq!(started, vec!["codex".to_string()]);

        let snapshot = service.snapshot().expect("snapshot");
        let codex = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == "codex")
            .expect("codex service");

        assert_eq!(codex.lifecycle, ManagedServiceLifecycle::Running);
        assert!(codex.pid.is_some());
    }

    #[test]
    fn supervisor_shutdown_stops_running_processes() {
        let service = SupervisorService::from_definitions(vec![test_managed_service_definition(
            "codex",
            true,
        )]);

        service
            .start_default_services()
            .expect("default services should start");
        service.begin_shutdown().expect("begin shutdown");
        service.complete_shutdown().expect("complete shutdown");

        let snapshot = service.snapshot().expect("snapshot");
        let codex = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == "codex")
            .expect("codex service");

        assert_eq!(codex.lifecycle, ManagedServiceLifecycle::Stopped);
        assert_eq!(codex.pid, None);
    }

    #[test]
    fn supervisor_new_uses_packaged_default_definitions() {
        let service = SupervisorService::new();

        assert_eq!(service.definitions.len(), default_managed_services().len());
    }

    #[test]
    fn supervisor_for_paths_resolves_install_relative_commands_for_default_services() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let service = SupervisorService::for_paths(&paths);
        let codex = service
            .definitions
            .iter()
            .find(|definition| definition.id == SERVICE_ID_CODEX)
            .expect("codex definition");
        let router_web = service
            .definitions
            .iter()
            .find(|definition| definition.id == SERVICE_ID_API_ROUTER_WEB_SERVER)
            .expect("router web definition");

        assert!(
            codex
                .command
                .as_deref()
                .expect("codex command")
                .replace('\\', "/")
                .ends_with("/install/modules/codex/current/bin/codex.exe")
        );
        assert_eq!(
            router_web
                .env
                .get("SDKWORK_WEB_BIND")
                .map(String::as_str),
            Some("127.0.0.1:3001")
        );
        assert!(
            router_web
                .env
                .get("SDKWORK_ADMIN_SITE_DIR")
                .expect("admin site dir")
                .replace('\\', "/")
                .ends_with("/install/modules/sdkwork-api-router/current/web/admin")
        );
    }

    #[cfg(windows)]
    fn test_managed_service_definition(id: &str, auto_start: bool) -> ManagedServiceDefinition {
        ManagedServiceDefinition {
            id: id.to_string(),
            display_name: format!("Test {id}"),
            auto_start,
            command: Some("cmd.exe".to_string()),
            args: vec!["/C".to_string(), "ping -n 3 127.0.0.1 >nul".to_string()],
            cwd: Some(std::env::current_dir().expect("cwd")),
            env: BTreeMap::new(),
            startup_order: 10,
            graceful_shutdown_timeout_ms: 1_000,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        }
    }

    #[cfg(not(windows))]
    fn test_managed_service_definition(id: &str, auto_start: bool) -> ManagedServiceDefinition {
        ManagedServiceDefinition {
            id: id.to_string(),
            display_name: format!("Test {id}"),
            auto_start,
            command: Some("sh".to_string()),
            args: vec!["-c".to_string(), "sleep 2".to_string()],
            cwd: Some(std::env::current_dir().expect("cwd")),
            env: BTreeMap::new(),
            startup_order: 10,
            graceful_shutdown_timeout_ms: 1_000,
            restart_policy: RestartPolicy::crash_only_default(),
            health_check: ManagedServiceHealthCheck::ProcessAlive,
        }
    }
}

fn managed_service_inventory_order(service_id: &str) -> u8 {
    match service_id {
        SERVICE_ID_CODEX => 10,
        SERVICE_ID_OPENCLAW => 20,
        SERVICE_ID_ZEROCLAW => 30,
        SERVICE_ID_IRONCLAW => 40,
        SERVICE_ID_API_ROUTER_GATEWAY => 50,
        SERVICE_ID_API_ROUTER_ADMIN_API => 60,
        SERVICE_ID_API_ROUTER_PORTAL_API => 70,
        SERVICE_ID_API_ROUTER_WEB_SERVER => 80,
        _ => u8::MAX,
    }
}
