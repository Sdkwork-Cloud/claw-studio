pub mod platform;
pub mod types;

use self::{
    platform::resolve_current_platform_service_spec,
    types::{
        DesktopKernelControlSocketInfo, DesktopKernelEndpointInfo, DesktopKernelHostInfo,
        DesktopKernelHostServiceInfo, DesktopKernelProvenanceInfo, DesktopKernelRuntimeStatusInfo,
        DesktopKernelTopologyInfo,
    },
};
use crate::framework::{
    kernel::DesktopSupervisorInfo,
    paths::AppPaths,
    services::{
        openclaw_runtime::{load_manifest, ActivatedOpenClawRuntime, OPENCLAW_RUNTIME_ID},
        supervisor::SERVICE_ID_OPENCLAW_GATEWAY,
    },
    Result,
};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(test)]
mod tests {
    use super::{
        platform::{resolve_platform_service_spec, KernelHostPlatform},
        types::KernelServiceManagerKind,
    };
    use crate::framework::paths::resolve_paths_for_root;

    fn normalize(path: &std::path::Path) -> String {
        path.to_string_lossy().replace('\\', "/")
    }

    #[test]
    fn platform_service_specs_cover_windows_macos_and_linux_hosts() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let windows = resolve_platform_service_spec(KernelHostPlatform::Windows, &paths);
        assert_eq!(windows.service_manager, KernelServiceManagerKind::WindowsService);
        assert_eq!(windows.service_name, "ClawStudioOpenClawKernel");
        assert!(normalize(&windows.launch_target).ends_with(
            "machine/runtime/kernel-host/claw-studio-kernel-host.exe"
        ));
        assert!(normalize(&windows.service_config_path).ends_with(
            "machine/state/kernel-host/windows-service.json"
        ));

        let macos = resolve_platform_service_spec(KernelHostPlatform::Macos, &paths);
        assert_eq!(
            macos.service_manager,
            KernelServiceManagerKind::LaunchdLaunchAgent
        );
        assert_eq!(macos.service_name, "ai.sdkwork.clawstudio.openclaw");
        assert!(normalize(&macos.launch_target).ends_with(
            "machine/runtime/kernel-host/claw-studio-kernel-host"
        ));
        assert!(normalize(&macos.service_config_path).ends_with(
            "machine/state/kernel-host/ai.sdkwork.clawstudio.openclaw.plist"
        ));

        let linux = resolve_platform_service_spec(KernelHostPlatform::Linux, &paths);
        assert_eq!(linux.service_manager, KernelServiceManagerKind::SystemdUser);
        assert_eq!(linux.service_name, "claw-studio-openclaw");
        assert!(normalize(&linux.launch_target).ends_with(
            "machine/runtime/kernel-host/claw-studio-kernel-host"
        ));
        assert!(normalize(&linux.service_config_path).ends_with(
            "machine/state/kernel-host/claw-studio-openclaw.service"
        ));
    }
}

pub fn build_desktop_kernel_host_info(
    paths: &AppPaths,
    runtime: Option<&ActivatedOpenClawRuntime>,
    supervisor: &DesktopSupervisorInfo,
) -> Result<DesktopKernelHostInfo> {
    const DEFAULT_PREFERRED_PORT: u16 = 18_789;

    let service_spec = resolve_current_platform_service_spec(paths);
    let managed_service = supervisor
        .services
        .iter()
        .find(|service| service.id == SERVICE_ID_OPENCLAW_GATEWAY);
    let lifecycle = managed_service
        .map(|service| service.lifecycle.as_str())
        .unwrap_or("stopped");
    let runtime_state = match lifecycle {
        "running" => "running",
        "starting" => "starting",
        "failed" => "failedSafe",
        "stopping" => "stopped",
        _ => "stopped",
    };
    let runtime_health = match runtime_state {
        "running" => "healthy",
        "failedSafe" => "failedSafe",
        _ => "degraded",
    };
    let active_port = runtime
        .map(|configured| configured.gateway_port)
        .unwrap_or(DEFAULT_PREFERRED_PORT);
    let manifest = runtime.and_then(|configured| {
        load_manifest(&configured.install_dir.join("manifest.json")).ok()
    });
    let install_key = runtime.map(|configured| configured.install_key.clone());

    Ok(DesktopKernelHostInfo {
        topology: DesktopKernelTopologyInfo {
            kind: "localManagedNative".to_string(),
            state: "installed".to_string(),
            label: "Built-In Native Runtime".to_string(),
            recommended: true,
        },
        runtime: DesktopKernelRuntimeStatusInfo {
            state: runtime_state.to_string(),
            health: runtime_health.to_string(),
            reason: match runtime_state {
                "running" => "Kernel attached to a healthy local OpenClaw gateway.".to_string(),
                "starting" => "Kernel launch is in progress.".to_string(),
                "failedSafe" => {
                    "Kernel entered failed-safe mode after exhausting restart attempts."
                        .to_string()
                }
                _ => "Kernel is provisioned but not currently running.".to_string(),
            },
            started_by: "appSupervisor".to_string(),
            last_transition_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        },
        endpoint: DesktopKernelEndpointInfo {
            preferred_port: DEFAULT_PREFERRED_PORT,
            active_port,
            base_url: format!("http://127.0.0.1:{active_port}"),
            websocket_url: format!("ws://127.0.0.1:{active_port}"),
            loopback_only: true,
            dynamic_port: active_port != DEFAULT_PREFERRED_PORT,
            endpoint_source: if active_port == DEFAULT_PREFERRED_PORT {
                "configured".to_string()
            } else {
                "allocated".to_string()
            },
        },
        host: DesktopKernelHostServiceInfo {
            service_manager: service_spec.service_manager.as_str().to_string(),
            ownership: "appSupervisor".to_string(),
            service_name: service_spec.service_name,
            service_config_path: service_spec
                .service_config_path
                .to_string_lossy()
                .into_owned(),
            startup_mode: service_spec.startup_mode,
            attach_supported: service_spec.attach_supported,
            repair_supported: service_spec.repair_supported,
            control_socket: Some(DesktopKernelControlSocketInfo {
                socket_kind: service_spec.control_socket_kind,
                location: service_spec.control_socket_location,
                available: false,
            }),
        },
        provenance: DesktopKernelProvenanceInfo {
            runtime_id: OPENCLAW_RUNTIME_ID.to_string(),
            install_key,
            openclaw_version: manifest.as_ref().map(|item| item.openclaw_version.clone()),
            node_version: manifest.as_ref().map(|item| item.node_version.clone()),
            platform: manifest
                .as_ref()
                .map(|item| item.platform.clone())
                .unwrap_or_else(|| crate::platform::current_target().to_string()),
            arch: manifest
                .as_ref()
                .map(|item| item.arch.clone())
                .unwrap_or_else(|| crate::platform::current_arch().to_string()),
            install_source: "bundled".to_string(),
            config_path: runtime
                .map(|configured| configured.config_path.to_string_lossy().into_owned())
                .unwrap_or_else(|| paths.openclaw_config_file.to_string_lossy().into_owned()),
            runtime_home_dir: runtime
                .map(|configured| configured.home_dir.to_string_lossy().into_owned())
                .unwrap_or_else(|| paths.openclaw_home_dir.to_string_lossy().into_owned()),
            runtime_install_dir: runtime.map(|configured| {
                configured.install_dir.to_string_lossy().into_owned()
            }),
        },
    })
}
