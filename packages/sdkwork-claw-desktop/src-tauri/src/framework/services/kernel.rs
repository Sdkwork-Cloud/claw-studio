use crate::framework::{
    kernel::{
        DesktopCapabilityInfo, DesktopCapabilityStatus, DesktopFileSystemInfo,
        DesktopIntegrationInfo, DesktopKernelDirectories, DesktopKernelInfo,
        DesktopNotificationInfo, DesktopPaymentInfo, DesktopPermissionsInfo, DesktopProcessInfo,
        DesktopSecurityInfo,
    },
    paths::AppPaths,
    storage::StorageInfo,
};

#[derive(Clone, Debug, Default)]
pub struct KernelService;

pub struct KernelDomainSnapshots {
    pub filesystem: DesktopFileSystemInfo,
    pub security: DesktopSecurityInfo,
    pub process: DesktopProcessInfo,
    pub permissions: DesktopPermissionsInfo,
    pub notifications: DesktopNotificationInfo,
    pub payments: DesktopPaymentInfo,
    pub integrations: DesktopIntegrationInfo,
    pub storage: StorageInfo,
}

impl KernelService {
    pub fn new() -> Self {
        Self
    }

    pub fn kernel_info(
        &self,
        paths: &AppPaths,
        domains: KernelDomainSnapshots,
    ) -> DesktopKernelInfo {
        let capabilities = vec![
            DesktopCapabilityInfo {
                key: "filesystem".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} managed runtime roots are governed by the filesystem kernel.",
                    domains.filesystem.managed_roots.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "security".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} allowlisted process commands are enforced by policy.",
                    domains.security.allowed_spawn_commands.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "process".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} process profiles are registered, {} process jobs are active, and the max concurrent job budget is {}.",
                    domains.process.available_profiles.len(),
                    domains.process.active_process_job_count,
                    domains.process.max_concurrent_jobs
                ),
            },
            DesktopCapabilityInfo {
                key: "jobs".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} active jobs are currently tracked by the desktop kernel.",
                    domains.process.active_job_count
                ),
            },
            DesktopCapabilityInfo {
                key: "storage".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} storage provider kinds are registered for the desktop kernel.",
                    domains.storage.providers.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "notifications".to_string(),
                status: domains.notifications.status.clone(),
                detail: format!(
                    "Notification domain exposes {} providers with active provider \"{}\" and user consent policy {}.",
                    domains.notifications.available_providers.len(),
                    domains.notifications.provider,
                    if domains.notifications.require_user_consent {
                        "enabled"
                    } else {
                        "disabled"
                    }
                ),
            },
            DesktopCapabilityInfo {
                key: "permissions".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} permission policy entries are standardized across granted, managed, and planned desktop access surfaces.",
                    domains.permissions.entries.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "integrations".to_string(),
                status: domains.integrations.status.clone(),
                detail: format!(
                    "Integration domain exposes {} adapters across plugins at {} and bridges at {}.",
                    domains.integrations.available_adapters.len(),
                    domains.integrations.plugins_dir,
                    domains.integrations.integrations_dir
                ),
            },
            DesktopCapabilityInfo {
                key: "payments".to_string(),
                status: domains.payments.status.clone(),
                detail: format!(
                    "Payment domain exposes {} providers with active provider \"{}\" in {} mode.",
                    domains.payments.available_providers.len(),
                    domains.payments.provider,
                    if domains.payments.sandbox {
                        "sandbox"
                    } else {
                        "live"
                    }
                ),
            },
        ];

        DesktopKernelInfo {
            directories: DesktopKernelDirectories {
                install_root: paths.install_root.to_string_lossy().into_owned(),
                modules_dir: paths.modules_dir.to_string_lossy().into_owned(),
                runtimes_dir: paths.runtimes_dir.to_string_lossy().into_owned(),
                machine_root: paths.machine_root.to_string_lossy().into_owned(),
                machine_state_dir: paths.machine_state_dir.to_string_lossy().into_owned(),
                machine_store_dir: paths.machine_store_dir.to_string_lossy().into_owned(),
                machine_staging_dir: paths.machine_staging_dir.to_string_lossy().into_owned(),
                user_root: paths.user_root.to_string_lossy().into_owned(),
                studio_dir: paths.studio_dir.to_string_lossy().into_owned(),
                storage_dir: paths.storage_dir.to_string_lossy().into_owned(),
                plugins_dir: paths.plugins_dir.to_string_lossy().into_owned(),
                integrations_dir: paths.integrations_dir.to_string_lossy().into_owned(),
                backups_dir: paths.backups_dir.to_string_lossy().into_owned(),
            },
            capabilities,
            filesystem: domains.filesystem,
            security: domains.security,
            process: domains.process,
            permissions: domains.permissions,
            notifications: domains.notifications,
            payments: domains.payments,
            integrations: domains.integrations,
            storage: domains.storage,
        }
    }
}
