#![allow(dead_code)]

use crate::framework::services::{
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
    ffi::OsStr,
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant, SystemTime},
};
use sysinfo::{ProcessesToUpdate, System};

const DEFAULT_RESTART_WINDOW_MS: u64 = 60_000;
const DEFAULT_RESTART_BACKOFF_MS: u64 = 5_000;
const DEFAULT_MAX_RESTARTS: usize = 3;
const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_OPENCLAW_GATEWAY_READY_TIMEOUT_MS: u64 = 30_000;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

pub const SERVICE_ID_OPENCLAW_GATEWAY: &str = "openclaw_gateway";

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

    pub fn start_openclaw_gateway(&self, paths: &AppPaths) -> Result<()> {
        let runtime = self
            .lock_openclaw_runtime()?
            .clone()
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;
        reap_stale_openclaw_gateway_processes(paths)?;
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
        command.creation_flags(managed_process_creation_flags());
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

#[cfg(windows)]
fn managed_process_creation_flags() -> u32 {
    CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
}

#[cfg(windows)]
fn configure_command_for_windows_utility(command: &mut Command) {
    command.creation_flags(utility_process_creation_flags());
}

#[cfg(windows)]
fn utility_process_creation_flags() -> u32 {
    CREATE_NO_WINDOW
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

fn reap_stale_openclaw_gateway_processes(paths: &AppPaths) -> Result<()> {
    let stale_pids = find_stale_openclaw_gateway_process_ids(paths)?;
    if stale_pids.is_empty() {
        return Ok(());
    }

    terminate_process_ids(&stale_pids)?;

    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if find_stale_openclaw_gateway_process_ids(paths)?.is_empty() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err(FrameworkError::Timeout(format!(
        "stale openclaw gateway processes did not stop within 5000ms under {}",
        paths.openclaw_runtime_dir.display()
    )))
}

fn find_stale_openclaw_gateway_process_ids(paths: &AppPaths) -> Result<Vec<u32>> {
    let managed_runtime_root = normalize_process_match_path(&paths.openclaw_runtime_dir);
    let current_process_id = std::process::id();
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    Ok(system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let pid = pid.as_u32();
            if pid == current_process_id {
                return None;
            }

            if !process.cmd().iter().any(|segment| {
                let segment = normalize_command_segment(segment);
                segment.starts_with(&managed_runtime_root) && segment.ends_with("openclaw.mjs")
            }) {
                return None;
            }

            if !process
                .cmd()
                .iter()
                .any(|segment| normalize_command_segment(segment) == "gateway")
            {
                return None;
            }

            Some(pid)
        })
        .collect())
}

fn normalize_process_match_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn normalize_command_segment(segment: &OsStr) -> String {
    segment
        .to_string_lossy()
        .replace('/', "\\")
        .trim_matches('"')
        .to_ascii_lowercase()
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
fn terminate_process_id(pid: u32) -> Result<()> {
    let pid = pid.to_string();
    let mut command = Command::new("taskkill");
    configure_command_for_windows_utility(&mut command);
    let _ = command
        .args(["/PID", pid.as_str(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    Ok(())
}

#[cfg(not(windows))]
fn terminate_process_id(pid: u32) -> Result<()> {
    unsafe {
        libc::kill(pid as i32, libc::SIGKILL);
    }
    Ok(())
}

#[cfg(windows)]
fn terminate_process_ids(pids: &[u32]) -> Result<()> {
    if pids.is_empty() {
        return Ok(());
    }

    let mut command = Command::new("taskkill");
    configure_command_for_windows_utility(&mut command);
    for pid in pids {
        let pid = pid.to_string();
        command.args(["/PID", pid.as_str()]);
    }
    let _ = command
        .args(["/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    Ok(())
}

#[cfg(not(windows))]
fn terminate_process_ids(pids: &[u32]) -> Result<()> {
    for pid in pids {
        terminate_process_id(*pid)?;
    }
    Ok(())
}

#[cfg(windows)]
fn request_process_shutdown(child: &mut Child) -> Result<()> {
    let pid = child.id().to_string();
    let mut command = Command::new("taskkill");
    configure_command_for_windows_utility(&mut command);
    let _ = command
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
    let mut command = Command::new("taskkill");
    configure_command_for_windows_utility(&mut command);
    let _ = command
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
        configure_command_for_managed_process, force_process_shutdown, wait_for_gateway_ready,
        ManagedServiceLifecycle, SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY,
    };
    #[cfg(windows)]
    use super::{
        managed_process_creation_flags, utility_process_creation_flags, CREATE_NEW_PROCESS_GROUP,
        CREATE_NO_WINDOW,
    };
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::openclaw_runtime::ActivatedOpenClawRuntime,
    };
    use std::{
        fs,
        net::TcpListener,
        process::Command,
        time::{Duration, UNIX_EPOCH},
    };

    #[test]
    fn supervisor_registers_default_background_services() {
        let service = SupervisorService::new();

        assert_eq!(
            service.managed_service_ids(),
            vec![SERVICE_ID_OPENCLAW_GATEWAY.to_string()]
        );
    }

    #[test]
    fn supervisor_plans_shutdown_in_reverse_startup_order() {
        let service = SupervisorService::new();

        assert_eq!(
            service.planned_shutdown_order(),
            vec![SERVICE_ID_OPENCLAW_GATEWAY.to_string()]
        );
    }

    #[test]
    fn supervisor_requests_manual_restart_for_managed_services() {
        let service = SupervisorService::new();
        service
            .record_running(SERVICE_ID_OPENCLAW_GATEWAY, Some(42))
            .expect("service should be running");

        service
            .request_restart(SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("manual restart request");

        let snapshot = service.snapshot().expect("snapshot");
        let openclaw_gateway = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw gateway service");

        assert_eq!(openclaw_gateway.lifecycle, ManagedServiceLifecycle::Starting);
        assert_eq!(openclaw_gateway.pid, None);
        assert_eq!(openclaw_gateway.last_exit_code, None);
    }

    #[test]
    fn supervisor_requests_all_services_in_startup_order() {
        let service = SupervisorService::new();

        assert_eq!(
            service.request_restart_all().expect("restart plan"),
            vec![SERVICE_ID_OPENCLAW_GATEWAY.to_string()]
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
            .register_restart_attempt(
                SERVICE_ID_OPENCLAW_GATEWAY,
                UNIX_EPOCH + Duration::from_secs(10),
            )
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
    fn supervisor_reclaims_stale_openclaw_gateway_before_refreshing_the_managed_port() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut runtime = fake_gateway_runtime(&paths);
        let gateway_port = reserve_test_loopback_port();
        runtime.gateway_port = gateway_port;
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {gateway_port}\n  }}\n}}\n"),
        )
        .expect("config file");

        let mut stale_gateway = Command::new(&runtime.node_path);
        configure_command_for_managed_process(&mut stale_gateway);
        stale_gateway.arg(&runtime.cli_path);
        stale_gateway.arg("gateway");
        stale_gateway.current_dir(&runtime.runtime_dir);
        stale_gateway.envs(runtime.managed_env());
        let mut stale_gateway = stale_gateway.spawn().expect("spawn stale gateway");
        wait_for_gateway_ready(&mut stale_gateway, gateway_port, 5_000)
            .expect("stale gateway should become ready");

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        service
            .start_openclaw_gateway(&paths)
            .expect("start gateway after reclaiming stale process");

        let refreshed = service
            .configured_openclaw_runtime()
            .expect("configured runtime")
            .expect("runtime");
        assert_eq!(refreshed.gateway_port, gateway_port);

        service.begin_shutdown().expect("shutdown");
        let _ = force_process_shutdown(&mut stale_gateway);
        let _ = stale_gateway.wait();
    }

    #[test]
    fn fake_gateway_runtime_reserves_a_unique_loopback_port_per_test_runtime() {
        let first_root = tempfile::tempdir().expect("first temp dir");
        let second_root = tempfile::tempdir().expect("second temp dir");
        let first_paths = resolve_paths_for_root(first_root.path()).expect("first paths");
        let second_paths = resolve_paths_for_root(second_root.path()).expect("second paths");

        let first_runtime = fake_gateway_runtime(&first_paths);
        let second_runtime = fake_gateway_runtime(&second_paths);

        assert_ne!(first_runtime.gateway_port, second_runtime.gateway_port);
    }

    #[cfg(windows)]
    #[test]
    fn managed_process_creation_flags_hide_console_windows() {
        assert_eq!(
            managed_process_creation_flags(),
            CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
        );
    }

    #[cfg(windows)]
    #[test]
    fn utility_process_creation_flags_hide_console_windows() {
        assert_eq!(utility_process_creation_flags(), CREATE_NO_WINDOW);
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
        let cli_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");
        let gateway_port = reserve_test_loopback_port();

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {gateway_port}\n  }}\n}}\n"),
        )
        .expect("config file");
        fs::write(
            &cli_path,
            format!(
                "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? {gateway_port});\nconst server = net.createServer();\nconst start = () => server.listen(gatewayPort, '127.0.0.1');\nsetTimeout(start, {listen_delay_ms});\nsetInterval(() => {{}}, 1000);\n"
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
        let cli_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");
        let gateway_port = reserve_test_loopback_port();

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {gateway_port}\n  }}\n}}\n"),
        )
        .expect("config file");
        fs::write(
            &cli_path,
            format!(
                "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? {gateway_port});\nconst server = net.createServer();\nconst start = () => server.listen(gatewayPort, '127.0.0.1');\nsetTimeout(start, {listen_delay_ms});\nsetInterval(() => {{}}, 1000);\n"
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

    fn reserve_test_loopback_port() -> u16 {
        let listener =
            TcpListener::bind(("127.0.0.1", 0)).expect("bind loopback listener for test port");
        let port = listener.local_addr().expect("listener addr").port();
        drop(listener);
        port
    }

}
