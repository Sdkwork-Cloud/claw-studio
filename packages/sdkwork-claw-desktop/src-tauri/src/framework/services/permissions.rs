use crate::framework::{
    config::AppConfig,
    kernel::{DesktopPermissionInfo, DesktopPermissionStatus, DesktopPermissionsInfo},
};

#[derive(Clone, Debug, Default)]
pub struct PermissionService;

impl PermissionService {
    pub fn new() -> Self {
        Self
    }

    pub fn kernel_info(&self, config: &AppConfig) -> DesktopPermissionsInfo {
        DesktopPermissionsInfo {
            entries: vec![
                DesktopPermissionInfo {
                    key: "filesystem.managedRoots".to_string(),
                    status: DesktopPermissionStatus::Managed,
                    required: true,
                    detail: "Filesystem access is constrained to managed runtime roots.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "process.restrictedSpawn".to_string(),
                    status: DesktopPermissionStatus::Managed,
                    required: true,
                    detail: "Child process execution is limited to allowlisted commands and managed working directories.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "browser.externalHttp".to_string(),
                    status: DesktopPermissionStatus::Managed,
                    required: false,
                    detail: if config.security.allow_external_http {
                        "External http/https links are allowed by security policy.".to_string()
                    } else {
                        "External http/https links are denied by security policy; only mailto/tel remain available.".to_string()
                    },
                },
                DesktopPermissionInfo {
                    key: "notifications.userConsent".to_string(),
                    status: DesktopPermissionStatus::Planned,
                    required: config.notifications.require_user_consent,
                    detail: if config.notifications.enabled {
                        "Notification delivery is reserved behind future native permission adapters.".to_string()
                    } else {
                        "Notifications are disabled in config and native permission adapters are not active.".to_string()
                    },
                },
                DesktopPermissionInfo {
                    key: "integrations.pluginTrust".to_string(),
                    status: if config.integrations.allow_unsigned_plugins {
                        DesktopPermissionStatus::Planned
                    } else {
                        DesktopPermissionStatus::Managed
                    },
                    required: config.integrations.plugins_enabled,
                    detail: if config.integrations.allow_unsigned_plugins {
                        "Unsigned plugin governance is relaxed in config and should be hardened before enabling third-party plugin execution.".to_string()
                    } else {
                        "Plugin trust policy requires signed plugins before future native adapters are enabled.".to_string()
                    },
                },
                DesktopPermissionInfo {
                    key: "payments.providerAccess".to_string(),
                    status: DesktopPermissionStatus::Planned,
                    required: config.payments.provider != "none",
                    detail: "Payment provider credentials and secure authorization remain reserved for a later native adapter.".to_string(),
                },
            ],
        }
    }
}
