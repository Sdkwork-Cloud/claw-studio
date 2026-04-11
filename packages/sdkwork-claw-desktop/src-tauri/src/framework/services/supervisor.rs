#![allow(dead_code)]

use crate::framework::services::openclaw_runtime::{
    ActivatedOpenClawRuntime, OpenClawRuntimeService,
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
    env,
    ffi::OsStr,
    fs,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant, SystemTime},
};
use sysinfo::{ProcessStatus, ProcessesToUpdate, System};
#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0},
    System::Threading::{
        OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    },
};

const DEFAULT_RESTART_WINDOW_MS: u64 = 60_000;
const DEFAULT_RESTART_BACKOFF_MS: u64 = 5_000;
const DEFAULT_MAX_RESTARTS: usize = 3;
const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_OPENCLAW_GATEWAY_READY_TIMEOUT_MS: u64 = 30_000;
const DEFAULT_OPENCLAW_GATEWAY_START_RETRY_ATTEMPTS: usize = 3;
const DEFAULT_OPENCLAW_GATEWAY_START_RETRY_DELAY_MS: u64 = 250;
const DEFAULT_OPENCLAW_GATEWAY_HEALTH_PROBE_INTERVAL_MS: u64 = 500;
const DEFAULT_OPENCLAW_GATEWAY_HEALTH_PROBE_TIMEOUT_MS: u64 = 750;
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
    paths: Option<AppPaths>,
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

#[derive(Clone, Debug, PartialEq, Eq)]
enum GatewayProbeStatus {
    Ready,
    Pending(String),
}

impl GatewayProbeStatus {
    fn is_ready(&self) -> bool {
        matches!(self, Self::Ready)
    }

    fn detail(self) -> String {
        match self {
            Self::Ready => "ready".to_string(),
            Self::Pending(detail) => detail,
        }
    }
}

impl SupervisorService {
    pub fn for_paths(paths: &AppPaths) -> Self {
        Self::build(Some(paths.clone()))
    }

    pub fn new() -> Self {
        Self::build(None)
    }

    fn build(paths: Option<AppPaths>) -> Self {
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
            paths,
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
        self.configured_openclaw_runtime()?
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;

        if self.is_service_running(SERVICE_ID_OPENCLAW_GATEWAY)? {
            return Ok(Vec::new());
        }

        let paths = self.paths.as_ref().ok_or_else(|| {
            FrameworkError::Internal(
                "supervisor service paths are not configured for default-service startup"
                    .to_string(),
            )
        })?;
        self.start_openclaw_gateway(paths)?;

        Ok(vec![SERVICE_ID_OPENCLAW_GATEWAY.to_string()])
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

    pub fn prepare_openclaw_runtime_activation(&self, paths: &AppPaths) -> Result<()> {
        reap_stale_openclaw_gateway_processes(paths)
    }

    pub fn start_openclaw_gateway(&self, paths: &AppPaths) -> Result<()> {
        let runtime = self
            .lock_openclaw_runtime()?
            .clone()
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;
        self.prepare_openclaw_runtime_activation(paths)?;
        let runtime = OpenClawRuntimeService::new().refresh_configured_runtime(paths, &runtime)?;
        *self.lock_openclaw_runtime()? = Some(runtime.clone());

        self.request_restart(SERVICE_ID_OPENCLAW_GATEWAY)?;
        let mut last_failure = None;

        for attempt in 0..DEFAULT_OPENCLAW_GATEWAY_START_RETRY_ATTEMPTS {
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
                    match wait_for_gateway_ready(
                        &mut child,
                        &runtime,
                        DEFAULT_OPENCLAW_GATEWAY_READY_TIMEOUT_MS,
                    ) {
                        Ok(()) => {
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
                            return Ok(());
                        }
                        Err(error) => {
                            let retryable = should_retry_openclaw_gateway_start_failure(&error);
                            let _ = force_process_shutdown(&mut child);
                            let _ = child.wait();
                            if retryable
                                && attempt + 1 < DEFAULT_OPENCLAW_GATEWAY_START_RETRY_ATTEMPTS
                            {
                                last_failure = Some(error);
                                thread::sleep(Duration::from_millis(
                                    DEFAULT_OPENCLAW_GATEWAY_START_RETRY_DELAY_MS,
                                ));
                                continue;
                            }
                            let _ = self.record_stopped(
                                SERVICE_ID_OPENCLAW_GATEWAY,
                                None,
                                Some(error.to_string()),
                            );
                            return Err(error);
                        }
                    }
                }
                Err(error) => {
                    let retryable = should_retry_openclaw_gateway_spawn_error(&error);
                    let failure = FrameworkError::Io(error);
                    if retryable && attempt + 1 < DEFAULT_OPENCLAW_GATEWAY_START_RETRY_ATTEMPTS {
                        last_failure = Some(failure);
                        thread::sleep(Duration::from_millis(
                            DEFAULT_OPENCLAW_GATEWAY_START_RETRY_DELAY_MS,
                        ));
                        continue;
                    }
                    let _ = self.record_stopped(
                        SERVICE_ID_OPENCLAW_GATEWAY,
                        None,
                        Some(failure.to_string()),
                    );
                    return Err(failure);
                }
            }
        }

        let failure = last_failure.unwrap_or_else(|| {
            FrameworkError::Internal(
                "openclaw gateway start loop exhausted without producing a final result".to_string(),
            )
        });
        let _ = self.record_stopped(
            SERVICE_ID_OPENCLAW_GATEWAY,
            None,
            Some(failure.to_string()),
        );
        Err(failure)
    }

    pub fn restart_openclaw_gateway(&self, paths: &AppPaths) -> Result<()> {
        let _ = self.stop_openclaw_gateway();
        self.start_openclaw_gateway(paths)
    }

    pub fn stop_openclaw_gateway(&self) -> Result<()> {
        self.stop_service_process(SERVICE_ID_OPENCLAW_GATEWAY)
    }

    pub fn is_service_running(&self, service_id: &str) -> Result<bool> {
        self.refresh_service_runtime_state(service_id)?;
        let runtime = self.lock_runtime()?;
        let service = runtime.services.get(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;

        Ok(matches!(
            service.lifecycle,
            ManagedServiceLifecycle::Running
        ))
    }

    pub fn is_openclaw_gateway_running(&self) -> Result<bool> {
        self.is_service_running(SERVICE_ID_OPENCLAW_GATEWAY)
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
        for service_id in self.managed_service_ids() {
            self.refresh_service_runtime_state(service_id.as_str())?;
        }
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

    fn refresh_service_runtime_state(&self, service_id: &str) -> Result<()> {
        let lifecycle = {
            let runtime = self.lock_runtime()?;
            let service = runtime.services.get(service_id).ok_or_else(|| {
                FrameworkError::NotFound(format!("managed service not found: {service_id}"))
            })?;
            service.lifecycle.clone()
        };

        if matches!(
            lifecycle,
            ManagedServiceLifecycle::Stopped | ManagedServiceLifecycle::Stopping
        ) {
            return Ok(());
        }

        let (observed_pid, exited_children, handle_present) = {
            let mut managed_processes = self.lock_managed_processes()?;
            let Some(handle) = managed_processes.get_mut(service_id) else {
                return Ok(());
            };

            let mut observed_pid = None;
            let mut exited_children = Vec::new();
            for child_handle in handle.children.iter_mut() {
                observed_pid = Some(child_handle.child.id());
                if let Some(status) = child_handle.child.try_wait()? {
                    exited_children.push((child_handle.label.clone(), status.code()));
                }
            }

            if !exited_children.is_empty() {
                managed_processes.remove(service_id);
            }

            (observed_pid, exited_children, true)
        };

        if !exited_children.is_empty() {
            let exit_code = exited_children.first().and_then(|(_, code)| *code);
            let detail = exited_children
                .iter()
                .map(|(label, code)| match code {
                    Some(value) => format!("{label} exited with code {value}"),
                    None => format!("{label} exited without an exit code"),
                })
                .collect::<Vec<_>>()
                .join(", ");
            self.record_stopped(
                service_id,
                exit_code,
                Some(format!(
                    "managed service {service_id} exited unexpectedly: {detail}"
                )),
            )?;
            return Ok(());
        }

        if !handle_present || matches!(lifecycle, ManagedServiceLifecycle::Starting) {
            return Ok(());
        }

        if service_id == SERVICE_ID_OPENCLAW_GATEWAY {
            let Some(runtime) = self.configured_openclaw_runtime()? else {
                return Ok(());
            };

            let readiness = probe_gateway_ready(&runtime, true);
            if readiness.is_ready() {
                if matches!(lifecycle, ManagedServiceLifecycle::Failed) {
                    self.record_running(service_id, observed_pid)?;
                }
            } else if !matches!(lifecycle, ManagedServiceLifecycle::Failed) {
                self.record_health_check_failed(
                    service_id,
                    observed_pid,
                    format!(
                        "managed OpenClaw gateway on 127.0.0.1:{} is not ready ({})",
                        runtime.gateway_port,
                        readiness.detail()
                    ),
                )?;
            }
        }

        Ok(())
    }

    fn record_health_check_failed(
        &self,
        service_id: &str,
        pid: Option<u32>,
        last_error: String,
    ) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        let service = runtime.services.get_mut(service_id).ok_or_else(|| {
            FrameworkError::NotFound(format!("managed service not found: {service_id}"))
        })?;
        service.pid = pid.or(service.pid);
        service.last_error = Some(last_error);
        service.lifecycle = ManagedServiceLifecycle::Failed;
        Ok(())
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
    vec![ManagedServiceDefinition {
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
    }]
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

fn wait_for_gateway_ready(
    child: &mut Child,
    runtime: &ActivatedOpenClawRuntime,
    timeout_ms: u64,
) -> Result<()> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let loopback = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, runtime.gateway_port));
    let mut next_health_probe_at = Instant::now();
    let mut last_probe_detail =
        "loopback listener is not yet accepting readiness probes".to_string();

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait()? {
            return Err(FrameworkError::ProcessFailed {
                command: "openclaw gateway".to_string(),
                exit_code: status.code(),
                stderr_tail: format!("gateway exited before becoming ready on {}", loopback),
            });
        }

        let include_health_probe = Instant::now() >= next_health_probe_at;
        let readiness = probe_gateway_ready(runtime, include_health_probe);
        if readiness.is_ready() {
            return Ok(());
        }
        last_probe_detail = readiness.detail();
        if include_health_probe {
            next_health_probe_at = Instant::now()
                + Duration::from_millis(DEFAULT_OPENCLAW_GATEWAY_HEALTH_PROBE_INTERVAL_MS);
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err(FrameworkError::Timeout(format!(
        "openclaw gateway did not become ready on {} within {}ms ({})",
        loopback, timeout_ms, last_probe_detail,
    )))
}

fn should_retry_openclaw_gateway_start_failure(error: &FrameworkError) -> bool {
    match error {
        FrameworkError::Io(io_error) => should_retry_openclaw_gateway_spawn_error(io_error),
        FrameworkError::ProcessFailed {
            command,
            stderr_tail,
            ..
        } => command == "openclaw gateway" && stderr_tail.contains("before becoming ready"),
        _ => false,
    }
}

fn should_retry_openclaw_gateway_spawn_error(error: &std::io::Error) -> bool {
    cfg!(windows)
        && (error.kind() == std::io::ErrorKind::PermissionDenied
            || matches!(error.raw_os_error(), Some(5 | 32 | 33)))
}

fn probe_gateway_ready(
    runtime: &ActivatedOpenClawRuntime,
    include_health_probe: bool,
) -> GatewayProbeStatus {
    let invoke_probe = probe_gateway_invoke_ready(runtime);
    if invoke_probe.is_ready() {
        return invoke_probe;
    }

    if !include_health_probe {
        return invoke_probe;
    }

    let health_probe =
        probe_gateway_cli_health_ready(runtime, DEFAULT_OPENCLAW_GATEWAY_HEALTH_PROBE_TIMEOUT_MS);
    if health_probe.is_ready() {
        return health_probe;
    }

    GatewayProbeStatus::Pending(format!(
        "{}; {}",
        invoke_probe.detail(),
        health_probe.detail()
    ))
}

fn probe_gateway_invoke_ready(runtime: &ActivatedOpenClawRuntime) -> GatewayProbeStatus {
    let loopback = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, runtime.gateway_port));
    let mut stream = match TcpStream::connect_timeout(&loopback, Duration::from_millis(200)) {
        Ok(stream) => stream,
        Err(error) => {
            return GatewayProbeStatus::Pending(format!(
                "invoke probe could not connect to {}: {}",
                loopback, error
            ));
        }
    };

    if stream
        .set_read_timeout(Some(Duration::from_millis(300)))
        .is_err()
        || stream
            .set_write_timeout(Some(Duration::from_millis(300)))
            .is_err()
    {
        return GatewayProbeStatus::Pending(format!(
            "invoke probe could not configure socket timeouts for {}",
            loopback
        ));
    }

    let payload = r#"{"tool":"cron","action":"status","args":{}}"#;
    let request = format!(
        "POST /tools/invoke HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nAccept: application/json\r\nConnection: close\r\nContent-Length: {length}\r\n\r\n{payload}",
        port = runtime.gateway_port,
        token = runtime.gateway_auth_token,
        length = payload.len(),
    );

    if let Err(error) = stream.write_all(request.as_bytes()) {
        return GatewayProbeStatus::Pending(format!(
            "invoke probe write failed for {}: {}",
            loopback, error
        ));
    }
    if let Err(error) = stream.flush() {
        return GatewayProbeStatus::Pending(format!(
            "invoke probe flush failed for {}: {}",
            loopback, error
        ));
    }

    let mut response = Vec::new();
    if let Err(error) = stream.read_to_end(&mut response) {
        return GatewayProbeStatus::Pending(format!(
            "invoke probe read failed for {}: {}",
            loopback, error
        ));
    }

    let response_text = String::from_utf8_lossy(&response);
    if response_text.starts_with("HTTP/1.1 200") || response_text.starts_with("HTTP/1.0 200") {
        return GatewayProbeStatus::Ready;
    }

    let status_line = response_text
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .unwrap_or("invoke probe returned an empty response");
    GatewayProbeStatus::Pending(format!("invoke probe returned {}", status_line))
}

fn probe_gateway_cli_health_ready(
    runtime: &ActivatedOpenClawRuntime,
    timeout_ms: u64,
) -> GatewayProbeStatus {
    if !is_loopback_port_accepting(runtime.gateway_port) {
        return GatewayProbeStatus::Pending(format!(
            "gateway health probe skipped because 127.0.0.1:{} is not accepting connections",
            runtime.gateway_port
        ));
    }

    let mut command = Command::new(&runtime.node_path);
    configure_command_for_managed_process(&mut command);
    command.arg(&runtime.cli_path);
    command.arg("gateway");
    command.arg("health");
    command.arg("--json");
    command.arg("--timeout");
    command.arg(timeout_ms.to_string());
    command.arg("--config");
    command.arg(&runtime.config_path);
    command.current_dir(&runtime.runtime_dir);
    command.envs(runtime.managed_env());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return GatewayProbeStatus::Pending(format!(
                "gateway health probe failed to spawn: {}",
                error
            ));
        }
    };

    let deadline = Instant::now() + Duration::from_millis(timeout_ms.saturating_add(250));
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(status)) => {
                let (stdout, stderr) = collect_child_output(&mut child);
                if status.success() {
                    return GatewayProbeStatus::Ready;
                }

                let detail = summarize_probe_output(&stderr)
                    .or_else(|| summarize_probe_output(&stdout))
                    .unwrap_or_else(|| {
                        format!(
                            "gateway health probe exited with status {}",
                            status
                                .code()
                                .map(|value| value.to_string())
                                .unwrap_or_else(|| "unknown".to_string())
                        )
                    });
                return GatewayProbeStatus::Pending(detail);
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(error) => {
                let _ = force_process_shutdown(&mut child);
                let _ = child.wait();
                return GatewayProbeStatus::Pending(format!(
                    "gateway health probe wait failed: {}",
                    error
                ));
            }
        }
    }

    let _ = force_process_shutdown(&mut child);
    let _ = child.wait();
    GatewayProbeStatus::Pending(format!(
        "gateway health probe timed out after {}ms",
        timeout_ms
    ))
}

fn collect_child_output(child: &mut Child) -> (String, String) {
    let mut stdout = String::new();
    if let Some(mut pipe) = child.stdout.take() {
        let _ = pipe.read_to_string(&mut stdout);
    }

    let mut stderr = String::new();
    if let Some(mut pipe) = child.stderr.take() {
        let _ = pipe.read_to_string(&mut stderr);
    }

    (stdout, stderr)
}

fn summarize_probe_output(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| {
            if line.len() > 200 {
                format!("{}...", &line[..200])
            } else {
                line.to_string()
            }
        })
}

fn reap_stale_openclaw_gateway_processes(paths: &AppPaths) -> Result<()> {
    let stale_pids = find_stale_openclaw_gateway_process_ids(paths)?;
    if stale_pids.is_empty() {
        return Ok(());
    }

    let configured_port = configured_managed_openclaw_gateway_port(paths);
    terminate_process_ids(&stale_pids)?;

    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if find_stale_openclaw_gateway_process_ids(paths)?.is_empty() {
            return Ok(());
        }

        if configured_port
            .map(|port| !is_loopback_port_accepting(port))
            .unwrap_or(false)
        {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(100));
    }

    let remaining_processes = describe_stale_openclaw_gateway_processes(paths);
    let port_diagnostic = configured_port
        .map(|port| {
            format!(
                "configured gateway port {port} listening={}",
                is_loopback_port_accepting(port)
            )
        })
        .unwrap_or_else(|| "configured gateway port unavailable".to_string());

    Err(FrameworkError::Timeout(format!(
        "stale openclaw gateway processes did not stop within 5000ms under {} ({port_diagnostic}; remaining processes: {})",
        paths.openclaw_runtime_dir.display(),
        if remaining_processes.is_empty() {
            "none".to_string()
        } else {
            remaining_processes.join(" | ")
        }
    )))
}

fn configured_managed_openclaw_gateway_port(paths: &AppPaths) -> Option<u16> {
    let config = fs::read_to_string(&paths.openclaw_config_file).ok()?;
    let parsed = json5::from_str::<serde_json::Value>(&config).ok()?;
    parsed
        .get("gateway")
        .and_then(|value| value.get("port"))
        .and_then(|value| value.as_u64())
        .and_then(|value| u16::try_from(value).ok())
        .filter(|port| *port > 0)
}

fn is_loopback_port_accepting(port: u16) -> bool {
    let loopback = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port));
    TcpStream::connect_timeout(&loopback, Duration::from_millis(200)).is_ok()
}

fn describe_stale_openclaw_gateway_processes(paths: &AppPaths) -> Vec<String> {
    let managed_runtime_root = normalize_process_match_path(&paths.openclaw_runtime_dir);
    let current_process_id = std::process::id();
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    system
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

            Some(format!(
                "pid={pid} status={:?} cmd={}",
                process.status(),
                process
                    .cmd()
                    .iter()
                    .map(|segment| segment.to_string_lossy())
                    .collect::<Vec<_>>()
                    .join(" ")
            ))
        })
        .collect()
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

            if matches!(
                process.status(),
                ProcessStatus::Dead | ProcessStatus::Zombie
            ) {
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
    let Some(handle) = open_terminable_process_handle(pid)? else {
        return Ok(());
    };
    let _handle = WindowsHandle(handle);

    let terminated = unsafe { TerminateProcess(handle, 1) };
    if terminated == 0 {
        return Err(FrameworkError::Internal(format!(
            "failed to terminate stale openclaw gateway process {pid}: {}",
            std::io::Error::last_os_error()
        )));
    }

    let wait_result = unsafe { WaitForSingleObject(handle, 5_000) };
    if wait_result != WAIT_OBJECT_0 {
        return Err(FrameworkError::Timeout(format!(
            "stale openclaw gateway process {pid} did not exit after native termination"
        )));
    }

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
    for pid in pids {
        terminate_process_id(*pid)?;
    }
    Ok(())
}

#[cfg(windows)]
struct WindowsHandle(HANDLE);

#[cfg(windows)]
impl Drop for WindowsHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(windows)]
fn open_terminable_process_handle(pid: u32) -> Result<Option<HANDLE>> {
    let handle = unsafe { OpenProcess(PROCESS_TERMINATE | PROCESS_SYNCHRONIZE, 0, pid) };
    if !handle.is_null() {
        return Ok(Some(handle));
    }

    match std::io::Error::last_os_error().raw_os_error() {
        Some(87) => Ok(None),
        _ => Err(FrameworkError::Internal(format!(
            "failed to open stale openclaw gateway process {pid}: {}",
            std::io::Error::last_os_error()
        ))),
    }
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
    use super::force_process_shutdown;
    use super::{
        configure_command_for_managed_process, terminate_process_id, wait_for_gateway_ready,
        ManagedServiceLifecycle, SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY,
    };
    #[cfg(windows)]
    use super::{managed_process_creation_flags, CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
    use crate::framework::{
        paths::resolve_paths_for_root, services::openclaw_runtime::ActivatedOpenClawRuntime,
    };
    use std::{
        fs,
        net::TcpListener,
        process::Command,
        thread,
        time::{Duration, Instant, UNIX_EPOCH},
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
        let openclaw = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");

        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Starting);
        assert_eq!(openclaw.pid, None);
        assert_eq!(openclaw.last_exit_code, None);
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
    fn bootstrap_start_default_services_starts_configured_openclaw_gateway() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = SupervisorService::for_paths(&paths);
        let runtime = fake_gateway_runtime(&paths);

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");

        let started = service
            .start_default_services()
            .expect("start default services");

        assert_eq!(started, vec![SERVICE_ID_OPENCLAW_GATEWAY.to_string()]);

        let snapshot = service.snapshot().expect("snapshot");
        let openclaw = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Running);
        assert!(openclaw.pid.is_some());

        service.begin_shutdown().expect("shutdown");
    }

    #[test]
    fn bootstrap_start_default_services_fails_without_a_configured_openclaw_runtime() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = SupervisorService::for_paths(&paths);

        let error = service
            .start_default_services()
            .expect_err("default services should require a configured openclaw runtime");

        assert!(error.to_string().contains("configured openclaw runtime"));
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
    fn supervisor_waits_for_gateway_http_invoke_readiness_before_marking_openclaw_running() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime_with_http_ready_delay_ms(&paths, 0, 1_200);

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");

        let started_at = Instant::now();
        service
            .start_openclaw_gateway(&paths)
            .expect("gateway should wait for invoke readiness");
        let elapsed = started_at.elapsed();

        assert!(
            elapsed >= Duration::from_millis(1_000),
            "expected supervisor to wait for HTTP invoke readiness, only waited {:?}",
            elapsed
        );

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
    fn supervisor_retries_gateway_start_when_the_first_cold_start_exits_immediately() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime_with_script(
            &paths,
            "import fs from 'node:fs';\nimport http from 'node:http';\nconst args = process.argv.slice(2);\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst attemptPath = `${configPath}.startup-attempt`;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst expectedAuthorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}`;\nif (args[0] === 'gateway' && args[1] === 'health') {\n  process.stdout.write(JSON.stringify({ ok: true, result: { status: 'ok' } }));\n  process.exit(0);\n}\nconst attempt = (fs.existsSync(attemptPath) ? Number(fs.readFileSync(attemptPath, 'utf8')) : 0) + 1;\nfs.writeFileSync(attemptPath, String(attempt));\nif (attempt === 1) {\n  process.stderr.write('transient cold-start failure');\n  process.exit(1);\n}\nconst server = http.createServer((req, res) => {\n  if (req.url !== '/tools/invoke' || req.method !== 'POST') {\n    res.writeHead(404, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: false, error: { message: 'unexpected path' } }));\n    return;\n  }\n  if ((req.headers.authorization ?? '') !== expectedAuthorization) {\n    res.writeHead(401, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: false, error: { message: 'unauthorized' } }));\n    return;\n  }\n  let body = '';\n  req.setEncoding('utf8');\n  req.on('data', (chunk) => { body += chunk; });\n  req.on('end', () => {\n    const payload = body.trim() ? JSON.parse(body) : {};\n    res.writeHead(200, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: true, result: { method: payload.action ? `${payload.tool}.${payload.action}` : payload.tool ?? 'unknown' } }));\n  });\n});\nserver.listen(gatewayPort, '127.0.0.1');\nsetInterval(() => {}, 1000);\n"
                .to_string(),
        );
        let attempt_path = runtime.config_path.with_extension("json.startup-attempt");

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        service
            .start_openclaw_gateway(&paths)
            .expect("gateway should recover from the first cold-start exit");

        assert_eq!(
            fs::read_to_string(&attempt_path).expect("startup attempt marker"),
            "2"
        );

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
    fn wait_for_gateway_ready_accepts_the_allowlisted_cron_status_probe() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime_with_script(
            &paths,
            "import fs from 'node:fs';\nimport http from 'node:http';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst expectedAuthorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}`;\nconst server = http.createServer((req, res) => {\n  if (req.url !== '/tools/invoke' || req.method !== 'POST') {\n    res.writeHead(404, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: false, error: { message: 'unexpected path' } }));\n    return;\n  }\n  if ((req.headers.authorization ?? '') !== expectedAuthorization) {\n    res.writeHead(401, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: false, error: { message: 'unauthorized' } }));\n    return;\n  }\n  let body = '';\n  req.setEncoding('utf8');\n  req.on('data', (chunk) => { body += chunk; });\n  req.on('end', () => {\n    const payload = body.trim() ? JSON.parse(body) : {};\n    if (payload.tool !== 'cron' || payload.action !== 'status') {\n      res.writeHead(404, { 'content-type': 'application/json' });\n      res.end(JSON.stringify({ ok: false, error: { message: `unexpected method ${payload.tool ?? 'missing'}.${payload.action ?? 'missing'}` } }));\n      return;\n    }\n    res.writeHead(200, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: true, result: { method: `${payload.tool}.${payload.action}` } }));\n  });\n});\nserver.listen(gatewayPort, '127.0.0.1');\nsetInterval(() => {}, 1000);\n"
                .to_string(),
        );

        let mut gateway = Command::new(&runtime.node_path);
        configure_command_for_managed_process(&mut gateway);
        gateway.arg(&runtime.cli_path);
        gateway.arg("gateway");
        gateway.current_dir(&runtime.runtime_dir);
        gateway.envs(runtime.managed_env());
        let mut gateway = gateway.spawn().expect("spawn gateway");

        let readiness = wait_for_gateway_ready(&mut gateway, &runtime, 5_000);

        let _ = force_process_shutdown(&mut gateway);
        let _ = gateway.wait();

        readiness.expect("gateway should become ready via the allowlisted cron.status probe");
    }

    #[test]
    fn wait_for_gateway_ready_accepts_gateway_health_when_http_tools_invoke_is_unavailable() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime_with_script(
            &paths,
            "import fs from 'node:fs';\nimport http from 'node:http';\nconst args = process.argv.slice(2);\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst readyPath = `${configPath}.health-ready`;\nif (args[0] === 'gateway' && args[1] === 'health') {\n  if (fs.existsSync(readyPath)) {\n    process.stdout.write(JSON.stringify({ ok: true, result: { status: 'ok' } }));\n    process.exit(0);\n  }\n  process.stderr.write('gateway warming');\n  process.exit(1);\n}\nif (args[0] !== 'gateway') {\n  process.stderr.write(`unexpected args: ${args.join(' ')}`);\n  process.exit(1);\n}\nconst server = http.createServer((req, res) => {\n  res.writeHead(404, { 'content-type': 'application/json' });\n  res.end(JSON.stringify({ ok: false, error: { message: 'tools invoke unavailable during startup' } }));\n});\nserver.listen(gatewayPort, '127.0.0.1', () => {\n  setTimeout(() => {\n    fs.writeFileSync(readyPath, 'ok');\n  }, 700);\n});\nsetInterval(() => {}, 1000);\n"
                .to_string(),
        );

        let mut gateway = Command::new(&runtime.node_path);
        configure_command_for_managed_process(&mut gateway);
        gateway.arg(&runtime.cli_path);
        gateway.arg("gateway");
        gateway.current_dir(&runtime.runtime_dir);
        gateway.envs(runtime.managed_env());
        let mut gateway = gateway.spawn().expect("spawn gateway");

        let readiness = wait_for_gateway_ready(&mut gateway, &runtime, 5_000);

        let _ = force_process_shutdown(&mut gateway);
        let _ = gateway.wait();

        readiness.expect(
            "gateway should become ready via upstream gateway health even when /tools/invoke stays unavailable",
        );
    }

    #[test]
    fn supervisor_marks_the_openclaw_gateway_unhealthy_when_the_loopback_listener_disappears() {
        let service = SupervisorService::new();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_gateway_runtime_with_script(
            &paths,
            "import fs from 'node:fs';\nimport http from 'node:http';\nconst args = process.argv.slice(2);\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst expectedAuthorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}`;\nif (args[0] === 'gateway' && args[1] === 'health') {\n  process.stdout.write(JSON.stringify({ ok: true, result: { status: 'ok' } }));\n  process.exit(0);\n}\nconst server = http.createServer((req, res) => {\n  if (req.url !== '/tools/invoke' || req.method !== 'POST') {\n    res.writeHead(404, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: false, error: { message: 'unexpected path' } }));\n    return;\n  }\n  if ((req.headers.authorization ?? '') !== expectedAuthorization) {\n    res.writeHead(401, { 'content-type': 'application/json' });\n    res.end(JSON.stringify({ ok: false, error: { message: 'unauthorized' } }));\n    return;\n  }\n  res.writeHead(200, { 'content-type': 'application/json' });\n  res.end(JSON.stringify({ ok: true, result: { method: 'health' } }));\n});\nserver.listen(gatewayPort, '127.0.0.1', () => {\n  setTimeout(() => {\n    server.close(() => {});\n  }, 300);\n});\nsetInterval(() => {}, 1000);\n"
                .to_string(),
        );

        service
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        service
            .start_openclaw_gateway(&paths)
            .expect("start gateway");

        thread::sleep(Duration::from_millis(700));

        assert!(
            !service
                .is_openclaw_gateway_running()
                .expect("gateway running state"),
            "gateway should no longer be reported as running after its loopback listener disappears"
        );

        let snapshot = service.snapshot().expect("snapshot");
        let openclaw = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Failed);
        assert!(openclaw
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains("not ready"));

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
        #[cfg(windows)]
        let stale_gateway_pid = stale_gateway.id();
        wait_for_gateway_ready(&mut stale_gateway, &runtime, 5_000)
            .expect("stale gateway should become ready");
        #[cfg(windows)]
        drop(stale_gateway);

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
        #[cfg(windows)]
        let _ = terminate_process_id(stale_gateway_pid);
        #[cfg(not(windows))]
        {
            let _ = force_process_shutdown(&mut stale_gateway);
            let _ = stale_gateway.wait();
        }
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
    fn fake_gateway_runtime(paths: &crate::framework::paths::AppPaths) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_delay_ms(paths, 0)
    }

    #[cfg(windows)]
    fn fake_gateway_runtime_with_http_ready_delay_ms(
        paths: &crate::framework::paths::AppPaths,
        listen_delay_ms: u64,
        ready_delay_ms: u64,
    ) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_script(
            paths,
            format!(
                "import fs from 'node:fs';\nimport http from 'node:http';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst expectedAuthorization = `Bearer ${{process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}}`;\nconst readyAt = Date.now() + {ready_delay_ms};\nconst server = http.createServer((req, res) => {{\n  if (req.url !== '/tools/invoke' || req.method !== 'POST') {{\n    res.writeHead(404, {{ 'content-type': 'application/json' }});\n    res.end(JSON.stringify({{ ok: false, error: {{ message: 'unexpected path' }} }}));\n    return;\n  }}\n  if ((req.headers.authorization ?? '') !== expectedAuthorization) {{\n    res.writeHead(401, {{ 'content-type': 'application/json' }});\n    res.end(JSON.stringify({{ ok: false, error: {{ message: 'unauthorized' }} }}));\n    return;\n  }}\n  let body = '';\n  req.setEncoding('utf8');\n  req.on('data', (chunk) => {{ body += chunk; }});\n  req.on('end', () => {{\n    const payload = body.trim() ? JSON.parse(body) : {{}};\n    if (Date.now() < readyAt) {{\n      res.writeHead(503, {{ 'content-type': 'application/json' }});\n      res.end(JSON.stringify({{ ok: false, error: {{ message: 'gateway warming' }} }}));\n      return;\n    }}\n    res.writeHead(200, {{ 'content-type': 'application/json' }});\n    res.end(JSON.stringify({{ ok: true, result: {{ method: payload.action ? `${{payload.tool}}.${{payload.action}}` : payload.tool ?? 'unknown' }} }}));\n  }});\n}});\nconst start = () => server.listen(gatewayPort, '127.0.0.1');\nsetTimeout(start, {listen_delay_ms});\nsetInterval(() => {{}}, 1000);\n"
            ),
        )
    }

    #[cfg(windows)]
    fn fake_gateway_runtime_with_delay_ms(
        paths: &crate::framework::paths::AppPaths,
        listen_delay_ms: u64,
    ) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_http_ready_delay_ms(paths, listen_delay_ms, 0)
    }

    #[cfg(not(windows))]
    fn fake_gateway_runtime(paths: &crate::framework::paths::AppPaths) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_delay_ms(paths, 0)
    }

    #[cfg(not(windows))]
    fn fake_gateway_runtime_with_http_ready_delay_ms(
        paths: &crate::framework::paths::AppPaths,
        listen_delay_ms: u64,
        ready_delay_ms: u64,
    ) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_script(
            paths,
            format!(
                "import fs from 'node:fs';\nimport http from 'node:http';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? 18789);\nconst expectedAuthorization = `Bearer ${{process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}}`;\nconst readyAt = Date.now() + {ready_delay_ms};\nconst server = http.createServer((req, res) => {{\n  if (req.url !== '/tools/invoke' || req.method !== 'POST') {{\n    res.writeHead(404, {{ 'content-type': 'application/json' }});\n    res.end(JSON.stringify({{ ok: false, error: {{ message: 'unexpected path' }} }}));\n    return;\n  }}\n  if ((req.headers.authorization ?? '') !== expectedAuthorization) {{\n    res.writeHead(401, {{ 'content-type': 'application/json' }});\n    res.end(JSON.stringify({{ ok: false, error: {{ message: 'unauthorized' }} }}));\n    return;\n  }}\n  let body = '';\n  req.setEncoding('utf8');\n  req.on('data', (chunk) => {{ body += chunk; }});\n  req.on('end', () => {{\n    const payload = body.trim() ? JSON.parse(body) : {{}};\n    if (Date.now() < readyAt) {{\n      res.writeHead(503, {{ 'content-type': 'application/json' }});\n      res.end(JSON.stringify({{ ok: false, error: {{ message: 'gateway warming' }} }}));\n      return;\n    }}\n    res.writeHead(200, {{ 'content-type': 'application/json' }});\n    res.end(JSON.stringify({{ ok: true, result: {{ method: payload.action ? `${{payload.tool}}.${{payload.action}}` : payload.tool ?? 'unknown' }} }}));\n  }});\n}});\nconst start = () => server.listen(gatewayPort, '127.0.0.1');\nsetTimeout(start, {listen_delay_ms});\nsetInterval(() => {{}}, 1000);\n"
            ),
        )
    }

    #[cfg(not(windows))]
    fn fake_gateway_runtime_with_delay_ms(
        paths: &crate::framework::paths::AppPaths,
        listen_delay_ms: u64,
    ) -> ActivatedOpenClawRuntime {
        fake_gateway_runtime_with_http_ready_delay_ms(paths, listen_delay_ms, 0)
    }

    fn fake_gateway_runtime_with_script(
        paths: &crate::framework::paths::AppPaths,
        script: String,
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
        fs::write(&cli_path, script).expect("cli file");

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
