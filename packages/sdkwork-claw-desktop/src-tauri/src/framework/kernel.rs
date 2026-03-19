use crate::framework::storage::StorageInfo;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopCapabilityStatus {
    Ready,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapabilityInfo {
    pub key: String,
    pub status: DesktopCapabilityStatus,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelDirectories {
    pub install_root: String,
    pub modules_dir: String,
    pub runtimes_dir: String,
    pub machine_root: String,
    pub machine_state_dir: String,
    pub machine_store_dir: String,
    pub machine_staging_dir: String,
    pub user_root: String,
    pub studio_dir: String,
    pub storage_dir: String,
    pub plugins_dir: String,
    pub integrations_dir: String,
    pub backups_dir: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopFileSystemInfo {
    pub default_working_directory: String,
    pub managed_roots: Vec<String>,
    pub supports_binary_io: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSecurityInfo {
    pub strict_path_policy: bool,
    pub allow_external_http: bool,
    pub allow_custom_process_cwd: bool,
    pub allowed_spawn_commands: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopProcessProfileInfo {
    pub id: String,
    pub job_kind: String,
    pub command: String,
    pub args: Vec<String>,
    pub default_timeout_ms: u64,
    pub allow_cancellation: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopProcessInfo {
    pub default_timeout_ms: u64,
    pub max_concurrent_jobs: u32,
    pub active_job_count: usize,
    pub active_process_job_count: usize,
    pub available_profiles: Vec<DesktopProcessProfileInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopPermissionStatus {
    Granted,
    Managed,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopProviderAvailability {
    Ready,
    ConfigurationRequired,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPermissionInfo {
    pub key: String,
    pub status: DesktopPermissionStatus,
    pub required: bool,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPermissionsInfo {
    pub entries: Vec<DesktopPermissionInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationProviderInfo {
    pub id: String,
    pub label: String,
    pub availability: DesktopProviderAvailability,
    pub transport: String,
    pub requires_user_consent: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationInfo {
    pub enabled: bool,
    pub provider: String,
    pub require_user_consent: bool,
    pub status: DesktopCapabilityStatus,
    pub available_providers: Vec<DesktopNotificationProviderInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPaymentProviderInfo {
    pub id: String,
    pub label: String,
    pub availability: DesktopProviderAvailability,
    pub supports_sandbox: bool,
    pub remote: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPaymentInfo {
    pub provider: String,
    pub sandbox: bool,
    pub status: DesktopCapabilityStatus,
    pub available_providers: Vec<DesktopPaymentProviderInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopIntegrationAdapterInfo {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub availability: DesktopProviderAvailability,
    pub enabled: bool,
    pub requires_signed_plugins: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopIntegrationInfo {
    pub plugins_enabled: bool,
    pub remote_api_enabled: bool,
    pub allow_unsigned_plugins: bool,
    pub plugins_dir: String,
    pub integrations_dir: String,
    pub installed_plugin_count: usize,
    pub status: DesktopCapabilityStatus,
    pub available_adapters: Vec<DesktopIntegrationAdapterInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelInfo {
    pub directories: DesktopKernelDirectories,
    pub capabilities: Vec<DesktopCapabilityInfo>,
    pub filesystem: DesktopFileSystemInfo,
    pub security: DesktopSecurityInfo,
    pub process: DesktopProcessInfo,
    pub permissions: DesktopPermissionsInfo,
    pub notifications: DesktopNotificationInfo,
    pub payments: DesktopPaymentInfo,
    pub integrations: DesktopIntegrationInfo,
    pub storage: StorageInfo,
}
