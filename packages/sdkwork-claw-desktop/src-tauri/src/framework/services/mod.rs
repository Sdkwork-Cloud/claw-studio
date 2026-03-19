use crate::framework::{
    config::AppConfig, kernel::DesktopKernelInfo, paths::AppPaths, policy::ExecutionPolicy,
    storage::StorageInfo, Result,
};

pub mod api_router;
pub mod browser;
pub mod dialog;
pub mod filesystem;
pub mod integrations;
pub mod jobs;
pub mod kernel;
pub mod notifications;
pub mod payments;
pub mod permissions;
pub mod process;
pub mod retention;
pub mod security;
pub mod storage;
pub mod system;

use self::{
    api_router::ApiRouterInstallerService,
    browser::BrowserService,
    dialog::DialogService,
    filesystem::FileSystemService,
    integrations::IntegrationService,
    jobs::JobService,
    kernel::{KernelDomainSnapshots, KernelService},
    notifications::NotificationService,
    payments::PaymentService,
    permissions::PermissionService,
    process::ProcessService,
    retention::RetentionService,
    security::SecurityService,
    storage::StorageService,
    system::SystemService,
};

#[derive(Clone, Debug)]
pub struct FrameworkServices {
    pub api_router: ApiRouterInstallerService,
    pub system: SystemService,
    pub browser: BrowserService,
    pub dialog: DialogService,
    pub filesystem: FileSystemService,
    pub security: SecurityService,
    pub notifications: NotificationService,
    pub payments: PaymentService,
    pub integrations: IntegrationService,
    pub permissions: PermissionService,
    pub process: ProcessService,
    pub jobs: JobService,
    pub retention: RetentionService,
    pub storage: StorageService,
    pub kernel: KernelService,
}

impl FrameworkServices {
    pub fn new(paths: &AppPaths, config: &AppConfig) -> Result<Self> {
        let policy = ExecutionPolicy::for_paths_with_security(paths, &config.security)?;

        Ok(Self {
            api_router: ApiRouterInstallerService::new(),
            system: SystemService::new(),
            browser: BrowserService::with_security(&config.security),
            dialog: DialogService::new(),
            filesystem: FileSystemService::new(),
            security: SecurityService::new(),
            notifications: NotificationService::new(),
            payments: PaymentService::new(),
            integrations: IntegrationService::new(),
            permissions: PermissionService::new(),
            process: ProcessService::new(policy),
            jobs: JobService::with_max_concurrent_process_jobs(config.process.max_concurrent_jobs),
            retention: RetentionService::new(),
            storage: StorageService::new(),
            kernel: KernelService::new(),
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
                storage: self.storage.storage_info(paths, &normalized),
            },
        ))
    }
}
