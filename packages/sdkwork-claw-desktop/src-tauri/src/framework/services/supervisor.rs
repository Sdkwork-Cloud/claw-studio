#![allow(dead_code)]

use crate::framework::{
    paths::AppPaths,
    kernel::{DesktopSupervisorInfo, DesktopSupervisorServiceInfo},
    FrameworkError, Result,
};
use crate::framework::services::openclaw_runtime::ActivatedOpenClawRuntime;
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
#[cfg(unix)]
use std::io;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const DEFAULT_RESTART_WINDOW_MS: u64 = 60_000;
const DEFAULT_RESTART_BACKOFF_MS: u64 = 5_000;
const DEFAULT_MAX_RESTARTS: usize = 3;
const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS: u64 = 10_000;
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
    child: Child,
}

impl SupervisorService {
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
            managed_processes: Arc::new(Mutex::new(HashMap::new())),
        }
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

    pub fn configure_openclaw_gateway(&self, runtime: &ActivatedOpenClawRuntime) -> Result<()> {
        *self.lock_openclaw_runtime()? = Some(runtime.clone());
        Ok(())
    }

    pub fn configured_openclaw_runtime(&self) -> Result<Option<ActivatedOpenClawRuntime>> {
        Ok(self.lock_openclaw_runtime()?.clone())
    }

    pub fn start_openclaw_gateway(&self, paths: &AppPaths) -> Result<()> {
        let runtime = self
            .lock_openclaw_runtime()?
            .clone()
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;

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
                if let Err(error) = wait_for_gateway_ready(&mut child, runtime.gateway_port, 10_000)
                {
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
                    ManagedServiceProcessHandle { child },
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
        let graceful_shutdown_timeout_ms =
            self.require_definition(service_id)?.graceful_shutdown_timeout_ms;

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

        let exit_code = terminate_managed_process(&mut handle.child, graceful_shutdown_timeout_ms)?;
        self.record_stopped(service_id, exit_code, None)
    }

    fn lock_openclaw_runtime(&self) -> Result<MutexGuard<'_, Option<ActivatedOpenClawRuntime>>> {
        self.openclaw_runtime
            .lock()
            .map_err(|_| FrameworkError::Internal("openclaw runtime lock poisoned".to_string()))
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
    use crate::framework::{paths::resolve_paths_for_root, services::openclaw_runtime::ActivatedOpenClawRuntime};
    use std::{fs, time::{Duration, UNIX_EPOCH}};

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

    #[cfg(windows)]
    fn fake_gateway_runtime(paths: &crate::framework::paths::AppPaths) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-gateway");
        let runtime_dir = install_dir.join("runtime");
        let node_path = std::path::PathBuf::from("node");
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");
        let gateway_port = 18_789;

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &cli_path,
            format!(
                "import net from 'node:net';\nconst server = net.createServer();\nserver.listen({gateway_port}, '127.0.0.1');\nsetInterval(() => {{}}, 1000);\n"
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
        let install_dir = paths.openclaw_runtime_dir.join("test-gateway");
        let runtime_dir = install_dir.join("runtime");
        let node_path = std::path::PathBuf::from("node");
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");
        let gateway_port = 18_789;

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &cli_path,
            format!(
                "import net from 'node:net';\nconst server = net.createServer();\nserver.listen({gateway_port}, '127.0.0.1');\nsetInterval(() => {{}}, 1000);\n"
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
}
