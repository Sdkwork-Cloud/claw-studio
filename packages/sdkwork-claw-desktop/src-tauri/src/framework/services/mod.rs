use crate::framework::{
    config::AppConfig, kernel::DesktopKernelInfo, paths::AppPaths, policy::ExecutionPolicy,
    storage::StorageInfo, Result,
};
use crate::framework::kernel_host::{
    build_desktop_kernel_host_info,
    native_kernel_host_is_running,
    service_manager::KernelHostServiceManager,
    types::DesktopKernelHostInfo,
};
use std::path::{Component, Path};

pub mod browser;
pub mod component_host;
pub mod components;
pub mod dialog;
pub mod filesystem;
pub mod integrations;
pub mod jobs;
pub mod kernel;
pub mod notifications;
pub mod openclaw_runtime;
pub mod path_registration;
pub mod payments;
pub mod permissions;
pub mod process;
pub mod provider_client_setup;
pub mod retention;
pub mod security;
pub mod storage;
pub mod studio;
pub mod supervisor;
pub mod system;
pub mod upgrades;

use self::{
    browser::BrowserService,
    component_host::ComponentHostService,
    components::ComponentRegistryService,
    dialog::DialogService,
    filesystem::FileSystemService,
    integrations::IntegrationService,
    jobs::JobService,
    kernel::{KernelDomainSnapshots, KernelService},
    notifications::NotificationService,
    openclaw_runtime::OpenClawRuntimeService,
    path_registration::PathRegistrationService,
    payments::PaymentService,
    permissions::PermissionService,
    process::ProcessService,
    provider_client_setup::ProviderClientSetupService,
    retention::RetentionService,
    security::SecurityService,
    storage::StorageService,
    studio::StudioService,
    supervisor::SupervisorService,
    system::SystemService,
    upgrades::ComponentUpgradeService,
};

#[derive(Clone, Debug)]
pub struct FrameworkServices {
    pub system: SystemService,
    pub browser: BrowserService,
    pub component_host: ComponentHostService,
    pub components: ComponentRegistryService,
    pub dialog: DialogService,
    pub filesystem: FileSystemService,
    pub security: SecurityService,
    pub notifications: NotificationService,
    pub payments: PaymentService,
    pub integrations: IntegrationService,
    pub permissions: PermissionService,
    pub openclaw_runtime: OpenClawRuntimeService,
    pub path_registration: PathRegistrationService,
    pub process: ProcessService,
    pub provider_client_setup: ProviderClientSetupService,
    pub jobs: JobService,
    #[allow(dead_code)]
    pub retention: RetentionService,
    pub storage: StorageService,
    pub studio: StudioService,
    pub kernel: KernelService,
    pub kernel_host_manager: KernelHostServiceManager,
    pub supervisor: SupervisorService,
    #[allow(dead_code)]
    pub upgrades: ComponentUpgradeService,
}

impl FrameworkServices {
    pub fn new(paths: &AppPaths, config: &AppConfig) -> Result<Self> {
        Self::with_kernel_host_manager(paths, config, KernelHostServiceManager::new())
    }

    fn with_kernel_host_manager(
        paths: &AppPaths,
        config: &AppConfig,
        kernel_host_manager: KernelHostServiceManager,
    ) -> Result<Self> {
        let policy = ExecutionPolicy::for_paths_with_security(paths, &config.security)?;

        Ok(Self {
            system: SystemService::new(),
            browser: BrowserService::with_security(&config.security),
            component_host: ComponentHostService::new(),
            components: ComponentRegistryService::new(),
            dialog: DialogService::new(),
            filesystem: FileSystemService::new(),
            security: SecurityService::new(),
            notifications: NotificationService::new(),
            payments: PaymentService::new(),
            integrations: IntegrationService::new(),
            permissions: PermissionService::new(),
            openclaw_runtime: OpenClawRuntimeService::new(),
            path_registration: PathRegistrationService::new(),
            process: ProcessService::new(policy),
            provider_client_setup: ProviderClientSetupService::new(),
            jobs: JobService::with_max_concurrent_process_jobs(config.process.max_concurrent_jobs),
            retention: RetentionService::new(),
            storage: StorageService::new(),
            studio: StudioService::new(),
            kernel: KernelService::new(),
            kernel_host_manager,
            supervisor: SupervisorService::for_paths(paths),
            upgrades: ComponentUpgradeService::new(),
        })
    }

    pub fn desktop_storage_info(&self, paths: &AppPaths, config: &AppConfig) -> StorageInfo {
        let normalized = AppConfig {
            storage: config.storage.normalized(),
            ..config.clone()
        };
        self.storage.storage_info(paths, &normalized)
    }

    pub fn desktop_kernel_info(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
    ) -> Result<DesktopKernelInfo> {
        let normalized = AppConfig {
            storage: config.storage.normalized(),
            ..config.clone()
        };
        let active_job_count = self.jobs.active_job_count()?;
        let active_process_job_count = self.jobs.active_process_job_count()?;
        let supervisor = self.supervisor.kernel_info()?;
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        let host =
            build_desktop_kernel_host_info(paths, configured_openclaw_runtime.as_ref(), &supervisor)?;

        Ok(self.kernel.kernel_info(
            paths,
            KernelDomainSnapshots {
                filesystem: self.filesystem.kernel_info(paths),
                security: self.security.kernel_info(&normalized),
                process: self.process.kernel_info(
                    &normalized,
                    active_job_count,
                    active_process_job_count,
                )?,
                permissions: self.permissions.kernel_info(&normalized),
                notifications: self.notifications.kernel_info(&normalized),
                payments: self.payments.kernel_info(&normalized),
                integrations: self.integrations.kernel_info(paths, &normalized)?,
                supervisor,
                bundled_components: self.components.kernel_info(paths)?,
                storage: self.storage.storage_info(paths, &normalized),
                host,
            },
        ))
    }

    pub fn desktop_kernel_host_status(&self, paths: &AppPaths) -> Result<DesktopKernelHostInfo> {
        let supervisor = self.supervisor.kernel_info()?;
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        build_desktop_kernel_host_info(paths, configured_openclaw_runtime.as_ref(), &supervisor)
    }

    pub fn ensure_desktop_kernel_running(&self, paths: &AppPaths) -> Result<DesktopKernelHostInfo> {
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        if native_kernel_host_is_running(paths, configured_openclaw_runtime.as_ref())? {
            return self.desktop_kernel_host_status(paths);
        }
        if should_use_native_kernel_host_manager(paths) {
            if self
                .kernel_host_manager
                .ensure_running(paths, configured_openclaw_runtime.as_ref())
                .unwrap_or(false)
            {
                return self.desktop_kernel_host_status(paths);
            }
        }

        if !self
            .supervisor
            .is_service_running(supervisor::SERVICE_ID_OPENCLAW_GATEWAY)?
        {
            self.supervisor.start_openclaw_gateway(paths)?;
        }

        self.desktop_kernel_host_status(paths)
    }

    pub fn restart_desktop_kernel(&self, paths: &AppPaths) -> Result<DesktopKernelHostInfo> {
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        if should_use_native_kernel_host_manager(paths) {
            if self
                .kernel_host_manager
                .restart(paths, configured_openclaw_runtime.as_ref())
                .unwrap_or(false)
            {
                return self.desktop_kernel_host_status(paths);
            }
        }

        self.supervisor.restart_openclaw_gateway(paths)?;
        self.desktop_kernel_host_status(paths)
    }
}

fn should_use_native_kernel_host_manager(paths: &AppPaths) -> bool {
    !path_contains_dev_build_segment(&paths.install_root, ".tauri-target")
        && !path_contains_dev_build_segment(&paths.install_root, "target-dev")
}

fn path_contains_dev_build_segment(path: &Path, segment: &str) -> bool {
    path.components().any(|component| match component {
        Component::Normal(value) => value.to_string_lossy().eq_ignore_ascii_case(segment),
        _ => false,
    })
}

#[cfg(test)]
mod tests {
    use super::{path_contains_dev_build_segment, should_use_native_kernel_host_manager, FrameworkServices};
    use crate::framework::{
        config::AppConfig,
        kernel_host::{
            service_manager::{KernelHostServiceManager, KernelHostServicePlatformOps},
            types::{KernelHostOwnershipMarker, KernelPlatformServiceSpec},
            write_kernel_host_ownership_marker,
        },
        paths::resolve_paths_for_root,
        services::{openclaw_runtime::ActivatedOpenClawRuntime, supervisor},
    };
    use std::{
        fs,
        net::TcpListener,
        path::PathBuf,
        sync::{Arc, Mutex},
        time::{SystemTime, UNIX_EPOCH},
    };

    fn fake_runtime(paths: &crate::framework::paths::AppPaths, gateway_port: u16) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-runtime");
        let runtime_dir = install_dir.join("runtime");
        let node_path = resolve_test_node_executable();
        let cli_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &cli_path,
            format!(
                "import fs from 'node:fs';\nimport net from 'node:net';\nconst configPath = process.env.OPENCLAW_CONFIG_PATH;\nconst config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\nconst gatewayPort = Number(config.gateway?.port ?? {gateway_port});\nconst server = net.createServer();\nserver.listen(gatewayPort, '127.0.0.1');\nsetInterval(() => {{}}, 1000);\n"
            ),
        )
        .expect("cli file");

        ActivatedOpenClawRuntime {
            install_key: "test-runtime".to_string(),
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

    #[test]
    fn ensure_desktop_kernel_running_attaches_to_a_running_native_host_before_falling_back() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let services = FrameworkServices::new(&paths, &AppConfig::default()).expect("services");
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener");
        let gateway_port = listener.local_addr().expect("listener addr").port();
        let runtime = fake_runtime(&paths, gateway_port);

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        write_kernel_host_ownership_marker(
            &paths,
            &KernelHostOwnershipMarker {
                service_name: "claw-studio-openclaw".to_string(),
                active_port: gateway_port,
                started_at_ms: 123,
                host_pid: Some(7),
            },
        )
        .expect("write marker");

        let info = services
            .ensure_desktop_kernel_running(&paths)
            .expect("kernel status");

        assert_eq!(info.runtime.started_by, "nativeService");
        assert_eq!(info.host.ownership, "nativeService");

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "stopped");
    }

    #[test]
    fn ensure_desktop_kernel_running_prefers_native_service_manager_before_supervisor_spawn() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(paths.clone(), runtime.gateway_port));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        let info = services
            .ensure_desktop_kernel_running(&paths)
            .expect("ensure desktop kernel");

        assert_eq!(info.host.ownership, "nativeService");
        assert_eq!(backend.events(), vec!["install".to_string(), "start".to_string()]);

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "stopped");
    }

    #[test]
    fn ensure_desktop_kernel_running_skips_native_service_manager_for_tauri_dev_paths() {
        let root = tempfile::tempdir().expect("temp dir");
        let mut paths = resolve_paths_for_root(root.path()).expect("paths");
        paths.install_root = root.path().join(".tauri-target").join("dev").join("debug");
        std::fs::create_dir_all(&paths.install_root).expect("create tauri dev install root");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(paths.clone(), runtime.gateway_port));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        let info = services
            .ensure_desktop_kernel_running(&paths)
            .expect("ensure desktop kernel");

        assert_eq!(info.host.ownership, "appSupervisor");
        assert!(backend.events().is_empty());

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "running");

        services.supervisor.begin_shutdown().expect("shutdown");
        services
            .supervisor
            .complete_shutdown()
            .expect("complete shutdown");
    }

    #[test]
    fn restart_desktop_kernel_restarts_native_service_when_available() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(paths.clone(), runtime.gateway_port));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        services
            .ensure_desktop_kernel_running(&paths)
            .expect("initial ensure");

        let info = services
            .restart_desktop_kernel(&paths)
            .expect("restart desktop kernel");

        assert_eq!(info.host.ownership, "nativeService");
        assert_eq!(
            backend.events(),
            vec![
                "install".to_string(),
                "start".to_string(),
                "install".to_string(),
                "stop".to_string(),
                "start".to_string(),
            ]
        );
    }

    #[test]
    fn native_kernel_host_manager_is_disabled_for_dev_build_roots() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        assert_eq!(
            path_contains_dev_build_segment(
                &root.path().join(".tauri-target").join("dev").join("debug"),
                ".tauri-target",
            ),
            true
        );
        assert_eq!(
            path_contains_dev_build_segment(&root.path().join("target-dev").join("debug"), "target-dev"),
            true
        );
        assert_eq!(should_use_native_kernel_host_manager(&paths), true);
    }

    fn reserve_loopback_port() -> u16 {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener");
        let port = listener.local_addr().expect("listener addr").port();
        drop(listener);
        port
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for framework service tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .expect("node should be available on PATH for framework service tests")
    }

    #[derive(Debug)]
    struct FakeKernelHostPlatformOps {
        paths: crate::framework::paths::AppPaths,
        gateway_port: u16,
        events: Mutex<Vec<String>>,
        listener: Mutex<Option<TcpListener>>,
    }

    impl FakeKernelHostPlatformOps {
        fn new(paths: crate::framework::paths::AppPaths, gateway_port: u16) -> Self {
            Self {
                paths,
                gateway_port,
                events: Mutex::new(Vec::new()),
                listener: Mutex::new(None),
            }
        }

        fn events(&self) -> Vec<String> {
            self.events.lock().expect("events").clone()
        }
    }

    impl KernelHostServicePlatformOps for FakeKernelHostPlatformOps {
        fn install_or_update(&self, _spec: &KernelPlatformServiceSpec) -> crate::framework::Result<()> {
            self.events.lock().expect("events").push("install".to_string());
            Ok(())
        }

        fn start(&self, spec: &KernelPlatformServiceSpec) -> crate::framework::Result<()> {
            self.events.lock().expect("events").push("start".to_string());
            let listener =
                TcpListener::bind(("127.0.0.1", self.gateway_port)).expect("gateway listener");
            *self.listener.lock().expect("listener") = Some(listener);
            write_kernel_host_ownership_marker(
                &self.paths,
                &KernelHostOwnershipMarker {
                    service_name: spec.service_name.clone(),
                    active_port: self.gateway_port,
                    started_at_ms: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    host_pid: Some(64),
                },
            )?;
            Ok(())
        }

        fn stop(&self, _spec: &KernelPlatformServiceSpec) -> crate::framework::Result<()> {
            self.events.lock().expect("events").push("stop".to_string());
            self.listener.lock().expect("listener").take();
            let _ = crate::framework::kernel_host::clear_kernel_host_ownership_marker(&self.paths);
            Ok(())
        }
    }
}
