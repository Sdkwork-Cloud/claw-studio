use crate::framework::{
    kernel_host::{
        clear_kernel_host_ownership_marker,
        platform::resolve_current_platform_service_spec,
        types::KernelHostOwnershipMarker,
        write_kernel_host_ownership_marker,
    },
    paths::AppPaths,
    services::{
        openclaw_runtime::{resolve_bundled_resource_root, OpenClawRuntimeService},
        path_registration::PathRegistrationService,
        supervisor::SupervisorService,
    },
    FrameworkError, Result,
};
use std::{
    ffi::{OsStr, OsString},
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
#[cfg(windows)]
use std::sync::OnceLock;
#[cfg(windows)]
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult, ServiceStatusHandle},
    service_dispatcher,
};

const REGISTER_OPENCLAW_CLI_FLAG: &str = "--register-openclaw-cli";
pub(crate) const RUN_OPENCLAW_CLI_FLAG: &str = "--run-openclaw-cli";
const RUN_KERNEL_HOST_SERVICE_FLAG: &str = "--run-kernel-host-service";
const MACHINE_ROOT_FLAG: &str = "--machine-root";
const USER_ROOT_FLAG: &str = "--user-root";
#[cfg(windows)]
const WINDOWS_SERVICE_CONTROLLER_CONNECT_ERROR: i32 = 1063;
#[cfg(windows)]
const WINDOWS_KERNEL_HOST_SERVICE_WAIT_HINT: Duration = Duration::from_secs(30);

#[cfg(windows)]
#[derive(Clone, Debug)]
struct WindowsKernelHostLaunchContext {
    service_name: String,
    machine_root: Option<PathBuf>,
    user_root: Option<PathBuf>,
}

#[cfg(windows)]
static WINDOWS_KERNEL_HOST_LAUNCH_CONTEXT: OnceLock<WindowsKernelHostLaunchContext> =
    OnceLock::new();

#[cfg(windows)]
define_windows_service!(ffi_kernel_host_service_main, windows_kernel_host_service_main);

#[derive(Clone, Debug, PartialEq, Eq)]
enum InternalCliAction {
    RegisterOpenClawCli,
    RunOpenClawCli(Vec<OsString>),
    RunKernelHostService {
        machine_root: Option<OsString>,
        user_root: Option<OsString>,
    },
}

pub fn maybe_handle_internal_cli_action() -> bool {
    match resolve_internal_cli_action(std::env::args_os()) {
        Some(InternalCliAction::RegisterOpenClawCli) => {
            if let Err(error) = register_openclaw_cli_for_current_install() {
                eprintln!("failed to register embedded openclaw cli: {error}");
                std::process::exit(1);
            }
            true
        }
        Some(InternalCliAction::RunOpenClawCli(cli_args)) => {
            let exit_code = match run_openclaw_cli_for_current_install(&cli_args) {
                Ok(code) => code,
                Err(error) => {
                    eprintln!("failed to run embedded openclaw cli: {error}");
                    1
                }
            };
            std::process::exit(exit_code);
        }
        Some(InternalCliAction::RunKernelHostService {
            machine_root,
            user_root,
        }) => {
            if let Err(error) = run_kernel_host_service_for_current_install(
                machine_root.as_deref(),
                user_root.as_deref(),
            ) {
                eprintln!("failed to run embedded kernel host service: {error}");
                std::process::exit(1);
            }
            true
        }
        None => false,
    }
}

fn resolve_internal_cli_action<I, S>(args: I) -> Option<InternalCliAction>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut args = args.into_iter();
    while let Some(arg) = args.next() {
        if arg.as_ref() == OsStr::new(REGISTER_OPENCLAW_CLI_FLAG) {
            return Some(InternalCliAction::RegisterOpenClawCli);
        }

        if arg.as_ref() == OsStr::new(RUN_OPENCLAW_CLI_FLAG) {
            return Some(InternalCliAction::RunOpenClawCli(
                args.map(|value| value.as_ref().to_os_string()).collect(),
            ));
        }

        if arg.as_ref() == OsStr::new(RUN_KERNEL_HOST_SERVICE_FLAG) {
            let mut machine_root = None;
            let mut user_root = None;
            let remaining = args
                .map(|value| value.as_ref().to_os_string())
                .collect::<Vec<_>>();
            let mut index = 0usize;
            while index < remaining.len() {
                if remaining[index].as_os_str() == OsStr::new(MACHINE_ROOT_FLAG) {
                    if let Some(value) = remaining.get(index + 1) {
                        machine_root = Some(value.clone());
                    }
                    index += 2;
                    continue;
                }
                if remaining[index].as_os_str() == OsStr::new(USER_ROOT_FLAG) {
                    if let Some(value) = remaining.get(index + 1) {
                        user_root = Some(value.clone());
                    }
                    index += 2;
                    continue;
                }
                index += 1;
            }
            return Some(InternalCliAction::RunKernelHostService {
                machine_root,
                user_root,
            });
        }
    }

    None
}

fn register_openclaw_cli_for_current_install() -> Result<()> {
    let paths = crate::framework::paths::resolve_paths_from_current_process()?;
    let resource_root = resolve_current_bundled_resource_root()?;
    let runtime =
        OpenClawRuntimeService::new().ensure_bundled_runtime_from_root(&paths, &resource_root)?;

    let path_registration = PathRegistrationService::new();
    path_registration.install_openclaw_shims(&paths, &runtime)?;
    path_registration.ensure_user_bin_on_path(&paths)?;

    Ok(())
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn register_openclaw_cli_for_paths_and_install_root(
    paths: &AppPaths,
    install_root: &Path,
) -> Result<()> {
    let runtime = OpenClawRuntimeService::new()
        .ensure_bundled_runtime_from_root(paths, &resolve_bundled_resource_root(install_root)?)?;

    let path_registration = PathRegistrationService::new();
    path_registration.install_openclaw_shims(paths, &runtime)?;
    path_registration.ensure_user_bin_on_path(paths)?;

    Ok(())
}

fn run_openclaw_cli_for_current_install(cli_args: &[OsString]) -> Result<i32> {
    let paths = crate::framework::paths::resolve_paths_from_current_process()?;
    let resource_root = resolve_current_bundled_resource_root()?;
    run_openclaw_cli_for_paths_and_install_root_with_resource_root(&paths, &resource_root, cli_args)
}

fn run_kernel_host_service_for_current_install(
    machine_root: Option<&OsStr>,
    user_root: Option<&OsStr>,
) -> Result<()> {
    let machine_root = machine_root.map(PathBuf::from);
    let user_root = user_root.map(PathBuf::from);

    #[cfg(windows)]
    {
        if try_run_windows_kernel_host_service(
            machine_root.clone(),
            user_root.clone(),
        )? {
            return Ok(());
        }
    }

    KernelHostRuntimeLoop::start(machine_root, user_root)?.monitor(None)
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn run_openclaw_cli_for_paths_and_install_root(
    paths: &AppPaths,
    install_root: &Path,
    cli_args: &[OsString],
) -> Result<i32> {
    let resource_root = resolve_bundled_resource_root(install_root)?;
    run_openclaw_cli_for_paths_and_install_root_with_resource_root(paths, &resource_root, cli_args)
}

fn run_openclaw_cli_for_paths_and_install_root_with_resource_root(
    paths: &AppPaths,
    resource_root: &Path,
    cli_args: &[OsString],
) -> Result<i32> {
    let runtime =
        OpenClawRuntimeService::new().ensure_bundled_runtime_from_root(paths, resource_root)?;
    let mut command = Command::new(&runtime.node_path);
    command.arg(&runtime.cli_path);
    command.args(cli_args);
    command.current_dir(&runtime.runtime_dir);
    command.stdin(Stdio::inherit());
    command.stdout(Stdio::inherit());
    command.stderr(Stdio::inherit());
    command.envs(runtime.managed_env());

    let status = command.status()?;
    Ok(status
        .code()
        .unwrap_or(if status.success() { 0 } else { 1 }))
}

fn resolve_current_bundled_resource_root() -> Result<PathBuf> {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let resource_dir =
        tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default())
            .map_err(|error| {
                crate::framework::FrameworkError::Internal(format!(
                    "failed to resolve current bundled resource directory: {error}"
                ))
            })?;

    resolve_bundled_resource_root(&resource_dir)
}

fn loopback_port_is_ready(port: u16) -> bool {
    let loopback = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port));
    TcpStream::connect_timeout(&loopback, Duration::from_millis(200)).is_ok()
}

struct KernelHostRuntimeLoop {
    paths: AppPaths,
    runtime: crate::framework::services::openclaw_runtime::ActivatedOpenClawRuntime,
    supervisor: SupervisorService,
}

impl KernelHostRuntimeLoop {
    fn start(machine_root: Option<PathBuf>, user_root: Option<PathBuf>) -> Result<Self> {
        let paths = crate::framework::paths::resolve_paths_from_current_process_with_overrides(
            machine_root,
            user_root,
        )?;
        let resource_root = resolve_current_bundled_resource_root()?;
        let runtime =
            OpenClawRuntimeService::new().ensure_bundled_runtime_from_root(&paths, &resource_root)?;
        let supervisor = SupervisorService::new();
        let service_spec = resolve_current_platform_service_spec(&paths);

        supervisor.configure_openclaw_gateway(&runtime)?;
        supervisor.start_openclaw_gateway(&paths)?;
        write_kernel_host_ownership_marker(
            &paths,
            &KernelHostOwnershipMarker {
                service_name: service_spec.service_name,
                active_port: runtime.gateway_port,
                started_at_ms: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                host_pid: Some(std::process::id()),
            },
        )?;

        Ok(Self {
            paths,
            runtime,
            supervisor,
        })
    }

    fn monitor(self, shutdown_rx: Option<&mpsc::Receiver<()>>) -> Result<()> {
        loop {
            match shutdown_rx {
                Some(receiver) => match receiver.recv_timeout(Duration::from_secs(1)) {
                    Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                        self.shutdown();
                        return Ok(());
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                },
                None => thread::sleep(Duration::from_secs(1)),
            }

            if loopback_port_is_ready(self.runtime.gateway_port) {
                continue;
            }

            self.shutdown();
            return Err(FrameworkError::Conflict(format!(
                "kernel host lost the managed OpenClaw gateway on 127.0.0.1:{}",
                self.runtime.gateway_port
            )));
        }
    }

    fn shutdown(&self) {
        let _ = self.supervisor.stop_openclaw_gateway();
        let _ = clear_kernel_host_ownership_marker(&self.paths);
    }
}

#[cfg(windows)]
fn try_run_windows_kernel_host_service(
    machine_root: Option<PathBuf>,
    user_root: Option<PathBuf>,
) -> Result<bool> {
    let paths = crate::framework::paths::resolve_paths_from_current_process_with_overrides(
        machine_root.clone(),
        user_root.clone(),
    )?;
    let service_name = resolve_current_platform_service_spec(&paths).service_name;
    WINDOWS_KERNEL_HOST_LAUNCH_CONTEXT.get_or_init(|| WindowsKernelHostLaunchContext {
        service_name: service_name.clone(),
        machine_root,
        user_root,
    });

    match service_dispatcher::start(service_name, ffi_kernel_host_service_main) {
        Ok(()) => Ok(true),
        Err(error)
            if matches!(
                &error,
                windows_service::Error::Winapi(inner)
                    if inner.raw_os_error() == Some(WINDOWS_SERVICE_CONTROLLER_CONNECT_ERROR)
            ) =>
        {
            Ok(false)
        }
        Err(error) => Err(map_windows_service_error(error)),
    }
}

#[cfg(windows)]
fn windows_kernel_host_service_main(_arguments: Vec<OsString>) {
    let _ = run_windows_kernel_host_service();
}

#[cfg(windows)]
fn run_windows_kernel_host_service() -> Result<()> {
    let launch_context = WINDOWS_KERNEL_HOST_LAUNCH_CONTEXT
        .get()
        .cloned()
        .ok_or_else(|| FrameworkError::Internal("missing windows kernel host launch context".to_string()))?;
    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    let status_handle = service_control_handler::register(
        &launch_context.service_name,
        move |control_event| match control_event {
            ServiceControl::Stop => {
                let _ = shutdown_tx.send(());
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        },
    )
    .map_err(map_windows_service_error)?;

    set_windows_service_status(
        &status_handle,
        ServiceState::StartPending,
        ServiceControlAccept::empty(),
        ServiceExitCode::Win32(0),
        WINDOWS_KERNEL_HOST_SERVICE_WAIT_HINT,
    )?;

    let runtime_loop = match KernelHostRuntimeLoop::start(
        launch_context.machine_root,
        launch_context.user_root,
    ) {
        Ok(runtime_loop) => runtime_loop,
        Err(error) => {
            let _ = set_windows_service_status(
                &status_handle,
                ServiceState::Stopped,
                ServiceControlAccept::empty(),
                ServiceExitCode::Win32(1),
                Duration::default(),
            );
            return Err(error);
        }
    };

    set_windows_service_status(
        &status_handle,
        ServiceState::Running,
        ServiceControlAccept::STOP,
        ServiceExitCode::Win32(0),
        Duration::default(),
    )?;

    let result = runtime_loop.monitor(Some(&shutdown_rx));
    let exit_code = if result.is_ok() {
        ServiceExitCode::Win32(0)
    } else {
        ServiceExitCode::Win32(1)
    };
    let _ = set_windows_service_status(
        &status_handle,
        ServiceState::Stopped,
        ServiceControlAccept::empty(),
        exit_code,
        Duration::default(),
    );
    result
}

#[cfg(windows)]
fn set_windows_service_status(
    status_handle: &ServiceStatusHandle,
    current_state: ServiceState,
    controls_accepted: ServiceControlAccept,
    exit_code: ServiceExitCode,
    wait_hint: Duration,
) -> Result<()> {
    status_handle
        .set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state,
            controls_accepted,
            exit_code,
            checkpoint: 0,
            wait_hint,
            process_id: None,
        })
        .map_err(map_windows_service_error)
}

#[cfg(windows)]
fn map_windows_service_error(error: windows_service::Error) -> FrameworkError {
    match error {
        windows_service::Error::Winapi(inner) => FrameworkError::Io(inner),
        other => FrameworkError::Internal(format!("windows service error: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        register_openclaw_cli_for_paths_and_install_root, resolve_internal_cli_action,
        run_openclaw_cli_for_paths_and_install_root, InternalCliAction, RUN_OPENCLAW_CLI_FLAG,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use std::{ffi::OsString, fs};

    const TEST_BUNDLED_OPENCLAW_VERSION: &str = "2026.3.24";

    #[test]
    fn detects_internal_register_openclaw_cli_action() {
        let action = resolve_internal_cli_action(["claw-studio.exe", "--register-openclaw-cli"]);

        assert_eq!(action, Some(InternalCliAction::RegisterOpenClawCli));
    }

    #[test]
    fn detects_internal_run_openclaw_cli_action_and_forwards_remaining_args() {
        let action = resolve_internal_cli_action([
            "claw-studio.exe",
            RUN_OPENCLAW_CLI_FLAG,
            "doctor",
            "--json",
        ]);

        assert_eq!(
            action,
            Some(InternalCliAction::RunOpenClawCli(vec![
                OsString::from("doctor"),
                OsString::from("--json"),
            ]))
        );
    }

    #[test]
    fn detects_kernel_host_service_action_with_path_overrides() {
        let action = resolve_internal_cli_action([
            "claw-studio.exe",
            "--run-kernel-host-service",
            "--machine-root",
            "C:\\ProgramData\\SdkWork\\CrawStudio",
            "--user-root",
            "C:\\Users\\admin\\.sdkwork\\crawstudio",
        ]);

        assert_eq!(
            action,
            Some(InternalCliAction::RunKernelHostService {
                machine_root: Some(OsString::from("C:\\ProgramData\\SdkWork\\CrawStudio")),
                user_root: Some(OsString::from("C:\\Users\\admin\\.sdkwork\\crawstudio")),
            })
        );
    }

    #[test]
    fn internal_registration_prepares_runtime_and_user_shell_shims() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        create_bundled_runtime_fixture(&paths.install_root, None);

        register_openclaw_cli_for_paths_and_install_root(&paths, &paths.install_root)
            .expect("register openclaw cli");

        assert!(paths.user_bin_dir.join("openclaw.cmd").exists());
        assert!(paths.user_bin_dir.join("openclaw.ps1").exists());
        assert!(paths.user_bin_dir.join("openclaw").exists());

        let cmd = fs::read_to_string(paths.user_bin_dir.join("openclaw.cmd")).expect("cmd shim");
        assert!(cmd.contains(RUN_OPENCLAW_CLI_FLAG));
        assert!(!cmd.contains("OPENCLAW_GATEWAY_TOKEN"));

        let ps1 = fs::read_to_string(paths.user_bin_dir.join("openclaw.ps1")).expect("ps1 shim");
        assert!(ps1.contains(RUN_OPENCLAW_CLI_FLAG));
        assert!(!ps1.contains("OPENCLAW_GATEWAY_TOKEN"));

        let unix = fs::read_to_string(paths.user_bin_dir.join("openclaw")).expect("unix shim");
        assert!(unix.contains(RUN_OPENCLAW_CLI_FLAG));
        assert!(!unix.contains("OPENCLAW_GATEWAY_TOKEN"));

        let profile =
            fs::read_to_string(paths.user_root.join("profile.sh")).expect("managed profile");
        let export_line = format!(
            "export PATH=\"{}:$PATH\"",
            paths.user_bin_dir.to_string_lossy()
        );
        assert!(profile.contains(export_line.as_str()));
        assert!(paths.openclaw_config_file.exists());
    }

    #[test]
    fn internal_run_openclaw_cli_executes_managed_runtime_with_ephemeral_gateway_env() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let capture_path = paths.user_root.join("openclaw-cli-capture.json");
        create_bundled_runtime_fixture(&paths.install_root, Some(&capture_path));
        fs::write(
            &paths.openclaw_config_file,
            "{\n  \"gateway\": {\n    \"auth\": {\n      \"token\": \"test-token\"\n    }\n  }\n}\n",
        )
        .expect("seed openclaw config");

        let exit_code = run_openclaw_cli_for_paths_and_install_root(
            &paths,
            &paths.install_root,
            &[OsString::from("doctor"), OsString::from("--json")],
        )
        .expect("run embedded openclaw cli");

        assert_eq!(exit_code, 0);
        let capture = fs::read_to_string(&capture_path).expect("capture file");
        assert!(capture.contains("\"doctor\""));
        assert!(capture.contains("\"--json\""));
        assert!(capture.contains("\"test-token\""));
    }

    fn create_bundled_runtime_fixture(
        install_root: &std::path::Path,
        capture_path: Option<&std::path::Path>,
    ) {
        let resource_root = install_root.join("openclaw-runtime");
        let runtime_root = resource_root.join("runtime");
        let node_relative_path = resolve_test_node_executable()
            .to_string_lossy()
            .replace('\\', "/");
        let cli_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        let cli_source = match capture_path {
            Some(capture_path) => format!(
                "import fs from 'node:fs';\nconst payload = {{ args: process.argv.slice(2), token: process.env.OPENCLAW_GATEWAY_TOKEN ?? null }};\nfs.writeFileSync({}, `${{JSON.stringify(payload)}}\\n`);\n",
                serde_json::to_string(&capture_path.to_string_lossy().into_owned()).expect("capture path json"),
            ),
            None => "console.log('openclaw');\n".to_string(),
        };
        fs::write(&cli_path, cli_source).expect("cli file");

        let platform = match crate::platform::current_target() {
            "windows" => "windows",
            "macos" => "macos",
            "linux" => "linux",
            other => other,
        };
        let arch = match crate::platform::current_arch() {
            "x86_64" => "x64",
            "aarch64" => "arm64",
            other => other,
        };

        fs::write(
            resource_root.join("manifest.json"),
            format!(
                concat!(
                    "{{\n",
                    "  \"schemaVersion\": 1,\n",
                    "  \"runtimeId\": \"openclaw\",\n",
                    "  \"openclawVersion\": \"{version}\",\n",
                    "  \"nodeVersion\": \"22.16.0\",\n",
                    "  \"platform\": \"{platform}\",\n",
                    "  \"arch\": \"{arch}\",\n",
                    "  \"nodeRelativePath\": {node_relative_path_json},\n",
                    "  \"cliRelativePath\": \"runtime/package/node_modules/openclaw/openclaw.mjs\"\n",
                    "}}\n"
                ),
                version = TEST_BUNDLED_OPENCLAW_VERSION,
                platform = platform,
                arch = arch,
                node_relative_path_json =
                    serde_json::to_string(&node_relative_path).expect("node path json"),
            ),
        )
        .expect("manifest file");
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for internal cli tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .expect("node should be available on PATH for internal cli tests")
    }
}
