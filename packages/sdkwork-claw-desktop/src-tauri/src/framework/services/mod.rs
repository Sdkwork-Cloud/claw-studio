use crate::framework::{
    config::AppConfig, kernel::DesktopKernelInfo, paths::AppPaths, policy::ExecutionPolicy,
    storage::StorageInfo, Result,
};

pub mod api_router;
pub mod api_router_managed_runtime;
pub mod api_router_runtime;
pub mod api_router_web_server;
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
pub mod retention;
pub mod security;
pub mod storage;
pub mod studio;
pub mod supervisor;
pub mod system;
pub mod upgrades;

use self::{
    api_router::ApiRouterInstallerService,
    api_router_managed_runtime::ApiRouterManagedRuntimeService,
    api_router_runtime::ApiRouterRuntimeService,
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
    pub api_router: ApiRouterInstallerService,
    pub api_router_managed_runtime: ApiRouterManagedRuntimeService,
    pub api_router_runtime: ApiRouterRuntimeService,
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
    pub jobs: JobService,
    #[allow(dead_code)]
    pub retention: RetentionService,
    pub storage: StorageService,
    pub studio: StudioService,
    pub kernel: KernelService,
    pub supervisor: SupervisorService,
    #[allow(dead_code)]
    pub upgrades: ComponentUpgradeService,
}

impl FrameworkServices {
    pub fn new(paths: &AppPaths, config: &AppConfig) -> Result<Self> {
        let policy = ExecutionPolicy::for_paths_with_security(paths, &config.security)?;

        Ok(Self {
            api_router: ApiRouterInstallerService::new(),
            api_router_managed_runtime: ApiRouterManagedRuntimeService::new(),
            api_router_runtime: ApiRouterRuntimeService::new(),
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
            jobs: JobService::with_max_concurrent_process_jobs(config.process.max_concurrent_jobs),
            retention: RetentionService::new(),
            storage: StorageService::new(),
            studio: StudioService::new(),
            kernel: KernelService::new(),
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
                supervisor: self.supervisor.kernel_info()?,
                bundled_components: self.components.kernel_info(paths)?,
                storage: self.storage.storage_info(paths, &normalized),
            },
        ))
    }
}
