pub use super::types::KernelHostPlatform;
use super::types::{KernelPlatformServiceSpec, KernelServiceManagerKind};
use crate::framework::paths::AppPaths;

pub fn current_kernel_host_platform() -> KernelHostPlatform {
    match crate::platform::current_target() {
        "windows" => KernelHostPlatform::Windows,
        "macos" => KernelHostPlatform::Macos,
        _ => KernelHostPlatform::Linux,
    }
}

pub fn resolve_current_platform_service_spec(paths: &AppPaths) -> KernelPlatformServiceSpec {
    resolve_platform_service_spec(current_kernel_host_platform(), paths)
}

pub fn resolve_platform_service_spec(
    platform: KernelHostPlatform,
    paths: &AppPaths,
) -> KernelPlatformServiceSpec {
    let state_dir = paths.machine_state_dir.join("kernel-host");
    let runtime_dir = paths.machine_runtime_dir.join("kernel-host");

    match platform {
        KernelHostPlatform::Windows => KernelPlatformServiceSpec {
            service_manager: KernelServiceManagerKind::WindowsService,
            service_name: "ClawStudioOpenClawKernel".to_string(),
            service_config_path: state_dir.join("windows-service.json"),
            launch_target: runtime_dir.join("claw-studio-kernel-host.exe"),
            control_socket_kind: "namedPipe".to_string(),
            control_socket_location: r"\\.\pipe\claw-studio-openclaw".to_string(),
            startup_mode: "auto".to_string(),
            attach_supported: true,
            repair_supported: true,
        },
        KernelHostPlatform::Macos => KernelPlatformServiceSpec {
            service_manager: KernelServiceManagerKind::LaunchdLaunchAgent,
            service_name: "ai.sdkwork.clawstudio.openclaw".to_string(),
            service_config_path: state_dir.join("ai.sdkwork.clawstudio.openclaw.plist"),
            launch_target: runtime_dir.join("claw-studio-kernel-host"),
            control_socket_kind: "unixDomainSocket".to_string(),
            control_socket_location: runtime_dir
                .join("kernel-host.sock")
                .to_string_lossy()
                .into_owned(),
            startup_mode: "auto".to_string(),
            attach_supported: true,
            repair_supported: true,
        },
        KernelHostPlatform::Linux => KernelPlatformServiceSpec {
            service_manager: KernelServiceManagerKind::SystemdUser,
            service_name: "claw-studio-openclaw".to_string(),
            service_config_path: state_dir.join("claw-studio-openclaw.service"),
            launch_target: runtime_dir.join("claw-studio-kernel-host"),
            control_socket_kind: "unixDomainSocket".to_string(),
            control_socket_location: runtime_dir
                .join("kernel-host.sock")
                .to_string_lossy()
                .into_owned(),
            startup_mode: "auto".to_string(),
            attach_supported: true,
            repair_supported: true,
        },
    }
}
