use crate::framework::{kernel_host::types::DesktopKernelHostInfo, storage::StorageInfo};

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
pub struct DesktopSupervisorServiceInfo {
    pub id: String,
    pub display_name: String,
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_exit_code: Option<i32>,
    pub restart_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSupervisorInfo {
    pub lifecycle: String,
    pub shutdown_requested: bool,
    pub service_count: usize,
    pub managed_service_ids: Vec<String>,
    pub services: Vec<DesktopSupervisorServiceInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBundledComponentInfo {
    pub id: String,
    pub display_name: String,
    pub kind: String,
    pub bundled_version: String,
    pub startup_mode: String,
    pub install_subdir: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBundledComponentsInfo {
    pub component_count: usize,
    pub default_startup_component_ids: Vec<String>,
    pub auto_upgrade_enabled: bool,
    pub approval_mode: String,
    pub components: Vec<DesktopBundledComponentInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyDefaultRouteInfo {
    pub client_protocol: String,
    pub id: String,
    pub name: String,
    pub managed_by: String,
    pub upstream_protocol: String,
    pub upstream_base_url: String,
    pub model_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyRouteRuntimeMetrics {
    pub route_id: String,
    pub client_protocol: String,
    pub upstream_protocol: String,
    pub health: String,
    pub request_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub rpm: u64,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_tokens: u64,
    pub average_latency_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyRouteTestRecord {
    pub route_id: String,
    pub status: String,
    pub tested_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    pub checked_capability: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyInfo {
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openai_compatible_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gemini_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_port: Option<u16>,
    pub loopback_only: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_route_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_route_name: Option<String>,
    pub default_routes: Vec<DesktopLocalAiProxyDefaultRouteInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream_base_url: Option<String>,
    pub model_count: usize,
    pub route_metrics: Vec<DesktopLocalAiProxyRouteRuntimeMetrics>,
    pub route_tests: Vec<DesktopLocalAiProxyRouteTestRecord>,
    pub message_capture_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observability_db_path: Option<String>,
    pub config_path: String,
    pub snapshot_path: String,
    pub log_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentDocumentationRef {
    pub label: String,
    pub location: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentEndpointInfo {
    pub id: String,
    pub label: String,
    pub transport: String,
    pub target: String,
    pub description: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentCapabilityInfo {
    pub key: String,
    pub label: String,
    pub kind: String,
    pub description: String,
    pub entrypoints: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentServiceBindingInfo {
    pub service_id: String,
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentInfo {
    pub id: String,
    pub display_name: String,
    pub kind: String,
    pub startup_mode: String,
    pub bundled_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_commit: Option<String>,
    pub install_subdir: String,
    pub runtime_status: String,
    pub service_ids: Vec<String>,
    pub services: Vec<DesktopComponentServiceBindingInfo>,
    pub endpoints: Vec<DesktopComponentEndpointInfo>,
    pub capabilities: Vec<DesktopComponentCapabilityInfo>,
    pub docs: Vec<DesktopComponentDocumentationRef>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentCatalogInfo {
    pub default_startup_component_ids: Vec<String>,
    pub components: Vec<DesktopComponentInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentControlResult {
    pub component_id: String,
    pub action: String,
    pub outcome: String,
    pub affected_service_ids: Vec<String>,
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
    pub supervisor: DesktopSupervisorInfo,
    pub local_ai_proxy: DesktopLocalAiProxyInfo,
    pub bundled_components: DesktopBundledComponentsInfo,
    pub storage: StorageInfo,
    pub host: DesktopKernelHostInfo,
}
