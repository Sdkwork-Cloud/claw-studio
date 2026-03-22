use super::{storage::StorageService, supervisor::SupervisorService};
use crate::framework::{
    config::AppConfig,
    layout::ActiveState,
    paths::AppPaths,
    storage::{
        StorageDeleteRequest, StorageGetTextRequest, StorageListKeysRequest, StorageProviderKind,
        StoragePutTextRequest,
    },
    FrameworkError, Result,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

mod openclaw_control;
mod openclaw_workbench;

use openclaw_control::{
    clone_openclaw_task, delete_openclaw_task, list_openclaw_task_executions,
    require_running_openclaw_runtime, run_openclaw_task_now, update_openclaw_task_status,
};
use openclaw_workbench::build_openclaw_workbench_snapshot;

const INSTANCE_NAMESPACE: &str = "studio.instances";
const INSTANCE_REGISTRY_KEY: &str = "registry";
const CHAT_NAMESPACE: &str = "studio.chat";
const CONVERSATION_KEY_PREFIX: &str = "conversation:";
const DEFAULT_INSTANCE_ID: &str = "local-built-in";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioRuntimeKind {
    Openclaw,
    Zeroclaw,
    Ironclaw,
    Custom,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StudioInstanceDeploymentMode {
    LocalManaged,
    LocalExternal,
    Remote,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceTransportKind {
    OpenclawGatewayWs,
    ZeroclawHttp,
    IronclawWeb,
    OpenaiHttp,
    CustomHttp,
    CustomWs,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceStatus {
    Online,
    Offline,
    Starting,
    Error,
    Syncing,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceCapability {
    Chat,
    Health,
    Files,
    Memory,
    Tasks,
    Tools,
    Models,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceIconType {
    Apple,
    Box,
    Server,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioStorageBinding {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    pub provider: StorageProviderKind,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StudioInstanceConfig {
    pub port: String,
    pub sandbox: bool,
    pub auto_update: bool,
    pub log_level: String,
    pub cors_origins: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub websocket_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
}

impl Default for StudioInstanceConfig {
    fn default() -> Self {
        Self {
            port: "18789".to_string(),
            sandbox: true,
            auto_update: true,
            log_level: "info".to_string(),
            cors_origins: "*".to_string(),
            workspace_path: None,
            base_url: Some("http://127.0.0.1:18789".to_string()),
            websocket_url: Some("ws://127.0.0.1:18789".to_string()),
            auth_token: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceRecord {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub runtime_kind: StudioRuntimeKind,
    pub deployment_mode: StudioInstanceDeploymentMode,
    pub transport_kind: StudioInstanceTransportKind,
    pub status: StudioInstanceStatus,
    pub is_built_in: bool,
    pub is_default: bool,
    pub icon_type: StudioInstanceIconType,
    pub version: String,
    pub type_label: String,
    pub host: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub websocket_url: Option<String>,
    pub cpu: u32,
    pub memory: u32,
    pub total_memory: String,
    pub uptime: String,
    pub capabilities: Vec<StudioInstanceCapability>,
    pub storage: StudioStorageBinding,
    pub config: StudioInstanceConfig,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioConversationRole {
    User,
    Assistant,
    System,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioConversationMessageStatus {
    Complete,
    Streaming,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioConversationMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: StudioConversationRole,
    pub content: String,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_instance_id: Option<String>,
    pub status: StudioConversationMessageStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioConversationRecord {
    pub id: String,
    pub title: String,
    pub primary_instance_id: String,
    pub participant_instance_ids: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub message_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_preview: Option<String>,
    pub messages: Vec<StudioConversationMessage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceHealthStatus {
    Healthy,
    Attention,
    Degraded,
    Offline,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceCapabilityStatus {
    Ready,
    Degraded,
    ConfigurationRequired,
    Unsupported,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceLifecycleOwner {
    AppManaged,
    ExternalProcess,
    RemoteService,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceAuthMode {
    Token,
    None,
    External,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceEndpointKind {
    Http,
    Websocket,
    OpenaiChatCompletions,
    Dashboard,
    Sse,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceEndpointStatus {
    Ready,
    ConfigurationRequired,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceExposure {
    Loopback,
    Private,
    Remote,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceStorageStatus {
    Ready,
    ConfigurationRequired,
    Planned,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceObservabilityStatus {
    Ready,
    Limited,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceCapabilitySource {
    Runtime,
    Config,
    Storage,
    Integration,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceEndpointSource {
    Config,
    Derived,
    Runtime,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceMetricsSource {
    Runtime,
    Derived,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceDataAccessScope {
    Config,
    Logs,
    Files,
    Memory,
    Tasks,
    Tools,
    Models,
    Connectivity,
    Storage,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceDataAccessMode {
    ManagedFile,
    ManagedDirectory,
    StorageBinding,
    RemoteEndpoint,
    MetadataOnly,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceDataAccessStatus {
    Ready,
    Limited,
    ConfigurationRequired,
    Planned,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioInstanceArtifactKind {
    ConfigFile,
    LogFile,
    WorkspaceDirectory,
    RuntimeDirectory,
    Endpoint,
    StorageBinding,
    Dashboard,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceArtifactStatus {
    Available,
    Configured,
    Missing,
    Remote,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StudioInstanceDetailSource {
    Runtime,
    Config,
    Storage,
    Integration,
    Derived,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceHealthCheck {
    pub id: String,
    pub label: String,
    pub status: StudioInstanceHealthStatus,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceHealthSnapshot {
    pub score: u8,
    pub status: StudioInstanceHealthStatus,
    pub checks: Vec<StudioInstanceHealthCheck>,
    pub evaluated_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceLifecycleSnapshot {
    pub owner: StudioInstanceLifecycleOwner,
    pub start_stop_supported: bool,
    pub config_writable: bool,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceConnectivityEndpoint {
    pub id: String,
    pub label: String,
    pub kind: StudioInstanceEndpointKind,
    pub status: StudioInstanceEndpointStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub exposure: StudioInstanceExposure,
    pub auth: StudioInstanceAuthMode,
    pub source: StudioInstanceEndpointSource,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceConnectivitySnapshot {
    pub primary_transport: StudioInstanceTransportKind,
    pub endpoints: Vec<StudioInstanceConnectivityEndpoint>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceStorageSnapshot {
    pub status: StudioInstanceStorageStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    pub provider: StorageProviderKind,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    pub durable: bool,
    pub queryable: bool,
    pub transactional: bool,
    pub remote: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceCapabilitySnapshot {
    pub id: StudioInstanceCapability,
    pub status: StudioInstanceCapabilityStatus,
    pub detail: String,
    pub source: StudioInstanceCapabilitySource,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceObservabilitySnapshot {
    pub status: StudioInstanceObservabilityStatus,
    pub log_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_file_path: Option<String>,
    pub log_preview: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<u64>,
    pub metrics_source: StudioInstanceMetricsSource,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceDataAccessEntry {
    pub id: String,
    pub label: String,
    pub scope: StudioInstanceDataAccessScope,
    pub mode: StudioInstanceDataAccessMode,
    pub status: StudioInstanceDataAccessStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    pub readonly: bool,
    pub authoritative: bool,
    pub detail: String,
    pub source: StudioInstanceDetailSource,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceDataAccessSnapshot {
    pub routes: Vec<StudioInstanceDataAccessEntry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceArtifactRecord {
    pub id: String,
    pub label: String,
    pub kind: StudioInstanceArtifactKind,
    pub status: StudioInstanceArtifactStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    pub readonly: bool,
    pub detail: String,
    pub source: StudioInstanceDetailSource,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceRuntimeNote {
    pub title: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchChannelRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub enabled: bool,
    pub field_count: u32,
    pub configured_field_count: u32,
    pub setup_steps: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchTaskScheduleConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_value: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_unit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron_expression: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchTaskExecutionRecord {
    pub id: String,
    pub task_id: String,
    pub status: String,
    pub trigger: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<String>,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchTaskRecord {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub prompt: String,
    pub schedule: String,
    pub schedule_mode: String,
    pub schedule_config: StudioWorkbenchTaskScheduleConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron_expression: Option<String>,
    pub action_type: String,
    pub status: String,
    pub execution_content: String,
    pub delivery_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delivery_channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delivery_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_run: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_execution: Option<StudioWorkbenchTaskExecutionRecord>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchCronTasksSnapshot {
    pub tasks: Vec<StudioWorkbenchTaskRecord>,
    pub task_executions_by_id: BTreeMap<String, Vec<StudioWorkbenchTaskExecutionRecord>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchLLMProviderModelRecord {
    pub id: String,
    pub name: String,
    pub role: String,
    pub context_window: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchLLMProviderConfigRecord {
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: u32,
    pub timeout_ms: u32,
    pub streaming: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchLLMProviderRecord {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub api_key_source: String,
    pub status: String,
    pub default_model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding_model_id: Option<String>,
    pub description: String,
    pub icon: String,
    pub last_checked_at: String,
    pub capabilities: Vec<String>,
    pub models: Vec<StudioWorkbenchLLMProviderModelRecord>,
    pub config: StudioWorkbenchLLMProviderConfigRecord,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchAgentProfile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub avatar: String,
    pub system_prompt: String,
    pub creator: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchAgentRecord {
    pub agent: StudioWorkbenchAgentProfile,
    pub focus_areas: Vec<String>,
    pub automation_fit_score: u8,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchSkillRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub rating: f64,
    pub downloads: u64,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readme: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchFileRecord {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category: String,
    pub language: String,
    pub size: String,
    pub updated_at: String,
    pub status: String,
    pub description: String,
    pub content: String,
    pub is_readonly: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchMemoryEntryRecord {
    pub id: String,
    pub title: String,
    pub r#type: String,
    pub summary: String,
    pub source: String,
    pub updated_at: String,
    pub retention: String,
    pub tokens: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchToolRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub status: String,
    pub access: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioWorkbenchSnapshot {
    pub channels: Vec<StudioWorkbenchChannelRecord>,
    pub cron_tasks: StudioWorkbenchCronTasksSnapshot,
    pub llm_providers: Vec<StudioWorkbenchLLMProviderRecord>,
    pub agents: Vec<StudioWorkbenchAgentRecord>,
    pub skills: Vec<StudioWorkbenchSkillRecord>,
    pub files: Vec<StudioWorkbenchFileRecord>,
    pub memory: Vec<StudioWorkbenchMemoryEntryRecord>,
    pub tools: Vec<StudioWorkbenchToolRecord>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioInstanceDetailRecord {
    pub instance: StudioInstanceRecord,
    pub config: StudioInstanceConfig,
    pub logs: String,
    pub health: StudioInstanceHealthSnapshot,
    pub lifecycle: StudioInstanceLifecycleSnapshot,
    pub storage: StudioInstanceStorageSnapshot,
    pub connectivity: StudioInstanceConnectivitySnapshot,
    pub observability: StudioInstanceObservabilitySnapshot,
    pub data_access: StudioInstanceDataAccessSnapshot,
    pub artifacts: Vec<StudioInstanceArtifactRecord>,
    pub capabilities: Vec<StudioInstanceCapabilitySnapshot>,
    pub official_runtime_notes: Vec<StudioInstanceRuntimeNote>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workbench: Option<StudioWorkbenchSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioCreateInstanceInput {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub runtime_kind: StudioRuntimeKind,
    pub deployment_mode: StudioInstanceDeploymentMode,
    pub transport_kind: StudioInstanceTransportKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_type: Option<StudioInstanceIconType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub websocket_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<PartialStudioStorageBinding>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<PartialStudioInstanceConfig>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StudioUpdateInstanceInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_type: Option<StudioInstanceIconType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub websocket_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<StudioInstanceStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<PartialStudioInstanceConfig>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioUpdateInstanceLlmProviderConfigInput {
    pub endpoint: String,
    pub api_key_source: String,
    pub default_model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding_model_id: Option<String>,
    pub config: StudioWorkbenchLLMProviderConfigRecord,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PartialStudioStorageBinding {
    pub profile_id: Option<String>,
    pub provider: Option<StorageProviderKind>,
    pub namespace: Option<String>,
    pub database: Option<String>,
    pub connection_hint: Option<String>,
    pub endpoint: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PartialStudioInstanceConfig {
    pub port: Option<String>,
    pub sandbox: Option<bool>,
    pub auto_update: Option<bool>,
    pub log_level: Option<String>,
    pub cors_origins: Option<String>,
    pub workspace_path: Option<String>,
    pub base_url: Option<String>,
    pub websocket_url: Option<String>,
    pub auth_token: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstanceRegistryDocument {
    version: u32,
    instances: Vec<StudioInstanceRecord>,
}

impl Default for InstanceRegistryDocument {
    fn default() -> Self {
        Self {
            version: 1,
            instances: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct StudioService;

impl StudioService {
    pub fn new() -> Self {
        Self
    }

    pub fn list_instances(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
    ) -> Result<Vec<StudioInstanceRecord>> {
        Ok(self.load_instance_registry(paths, config, storage)?.instances)
    }

    pub fn get_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
    ) -> Result<Option<StudioInstanceRecord>> {
        Ok(self
            .load_instance_registry(paths, config, storage)?
            .instances
            .into_iter()
            .find(|instance| instance.id == id))
    }

    pub fn create_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        input: StudioCreateInstanceInput,
    ) -> Result<StudioInstanceRecord> {
        let mut registry = self.load_instance_registry(paths, config, storage)?;
        let created_at = unix_timestamp_ms()?;
        let storage_binding = merge_storage_binding(
            default_storage_binding(config),
            input.storage.unwrap_or_default(),
        );
        let instance_config = merge_instance_config(StudioInstanceConfig::default(), input.config);
        let capabilities = default_capabilities_for_runtime(&input.runtime_kind);
        let port = input.port.or_else(|| {
            instance_config
                .port
                .parse::<u16>()
                .ok()
                .filter(|value| *value > 0)
        });

        let record = StudioInstanceRecord {
            id: format!("instance-{}", created_at),
            name: input.name.trim().to_string(),
            description: normalize_optional_string(input.description),
            runtime_kind: input.runtime_kind,
            deployment_mode: input.deployment_mode,
            transport_kind: input.transport_kind,
            status: StudioInstanceStatus::Offline,
            is_built_in: false,
            is_default: registry.instances.is_empty(),
            icon_type: input.icon_type.unwrap_or(StudioInstanceIconType::Server),
            version: input.version.unwrap_or_else(|| "custom".to_string()),
            type_label: input.type_label.unwrap_or_else(|| "Managed Instance".to_string()),
            host: input.host.unwrap_or_else(|| "127.0.0.1".to_string()),
            port,
            base_url: input.base_url.or(instance_config.base_url.clone()),
            websocket_url: input.websocket_url.or(instance_config.websocket_url.clone()),
            cpu: 0,
            memory: 0,
            total_memory: "Unknown".to_string(),
            uptime: "-".to_string(),
            capabilities,
            storage: storage_binding,
            config: instance_config,
            created_at,
            updated_at: created_at,
            last_seen_at: None,
        };

        registry.instances.push(record.clone());
        normalize_default_instance(&mut registry.instances);
        self.write_instance_registry(paths, config, storage, &registry)?;
        Ok(record)
    }

    pub fn update_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
        input: StudioUpdateInstanceInput,
    ) -> Result<StudioInstanceRecord> {
        let mut registry = self.load_instance_registry(paths, config, storage)?;
        let index = registry
            .instances
            .iter()
            .position(|instance| instance.id == id)
            .ok_or_else(|| FrameworkError::NotFound(format!("instance \"{id}\"")))?;

        let current = registry.instances[index].clone();
        let next_port = input.port.or(current.port);
        let merged_config = merge_instance_config(current.config.clone(), input.config);

        registry.instances[index] = StudioInstanceRecord {
            name: input.name.unwrap_or(current.name),
            description: input
                .description
                .map(Some)
                .map(normalize_optional_string)
                .unwrap_or(current.description),
            icon_type: input.icon_type.unwrap_or(current.icon_type),
            version: input.version.unwrap_or(current.version),
            type_label: input.type_label.unwrap_or(current.type_label),
            host: input.host.unwrap_or(current.host),
            port: next_port,
            base_url: input.base_url.or(current.base_url),
            websocket_url: input.websocket_url.or(current.websocket_url),
            status: input.status.unwrap_or(current.status),
            is_default: input.is_default.unwrap_or(current.is_default),
            config: merged_config,
            updated_at: unix_timestamp_ms()?,
            ..current
        };

        if registry.instances[index].id == DEFAULT_INSTANCE_ID {
            self.sync_built_in_runtime_config(paths, &registry.instances[index].config)?;
        }

        if input.is_default == Some(true) {
            for (current_index, instance) in registry.instances.iter_mut().enumerate() {
                if current_index != index {
                    instance.is_default = false;
                }
            }
        }

        normalize_default_instance(&mut registry.instances);
        let updated = registry.instances[index].clone();
        self.write_instance_registry(paths, config, storage, &registry)?;
        Ok(updated)
    }

    pub fn delete_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
    ) -> Result<bool> {
        if id == DEFAULT_INSTANCE_ID {
            return Err(FrameworkError::Conflict(
                "the built-in instance cannot be deleted".to_string(),
            ));
        }

        let mut registry = self.load_instance_registry(paths, config, storage)?;
        let initial_len = registry.instances.len();
        registry.instances.retain(|instance| instance.id != id);
        if registry.instances.len() == initial_len {
            return Ok(false);
        }

        normalize_default_instance(&mut registry.instances);
        self.write_instance_registry(paths, config, storage, &registry)?;

        let keys = storage.list_keys(
            paths,
            config,
            StorageListKeysRequest {
                profile_id: None,
                namespace: Some(CHAT_NAMESPACE.to_string()),
            },
        )?;
        for key in keys.keys {
            if !key.starts_with(CONVERSATION_KEY_PREFIX) {
                continue;
            }

            let Some(mut conversation) = self.read_conversation(paths, config, storage, &key)?
            else {
                continue;
            };

            if conversation.primary_instance_id != id
                && !conversation
                    .participant_instance_ids
                    .iter()
                    .any(|value| value == id)
            {
                continue;
            }

            conversation
                .participant_instance_ids
                .retain(|participant_id| participant_id != id);

            if conversation.primary_instance_id == id {
                let Some(next_primary_instance_id) =
                    conversation.participant_instance_ids.first().cloned()
                else {
                    let _ = storage.delete(
                        paths,
                        config,
                        StorageDeleteRequest {
                            profile_id: None,
                            namespace: Some(CHAT_NAMESPACE.to_string()),
                            key,
                        },
                    )?;
                    continue;
                };

                conversation.primary_instance_id = next_primary_instance_id;
            }

            conversation.updated_at = conversation.updated_at.max(unix_timestamp_ms()?);
            let _ = self.put_conversation(paths, config, storage, conversation)?;
        }

        Ok(true)
    }

    pub fn start_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        id: &str,
    ) -> Result<Option<StudioInstanceRecord>> {
        let instance = self.get_instance(paths, config, storage, id)?;
        let Some(instance) = instance else {
            return Ok(None);
        };

        if instance.id == DEFAULT_INSTANCE_ID
            && instance.deployment_mode == StudioInstanceDeploymentMode::LocalManaged
        {
            supervisor.start_openclaw_gateway(paths)?;
        }

        Ok(Some(self.set_instance_status(
            paths,
            config,
            storage,
            id,
            StudioInstanceStatus::Online,
        )?))
    }

    pub fn stop_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        id: &str,
    ) -> Result<Option<StudioInstanceRecord>> {
        let instance = self.get_instance(paths, config, storage, id)?;
        let Some(instance) = instance else {
            return Ok(None);
        };

        if instance.id == DEFAULT_INSTANCE_ID
            && instance.deployment_mode == StudioInstanceDeploymentMode::LocalManaged
        {
            supervisor.stop_openclaw_gateway()?;
        }

        Ok(Some(self.set_instance_status(
            paths,
            config,
            storage,
            id,
            StudioInstanceStatus::Offline,
        )?))
    }

    pub fn restart_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        id: &str,
    ) -> Result<Option<StudioInstanceRecord>> {
        let instance = self.get_instance(paths, config, storage, id)?;
        let Some(instance) = instance else {
            return Ok(None);
        };

        if instance.id == DEFAULT_INSTANCE_ID
            && instance.deployment_mode == StudioInstanceDeploymentMode::LocalManaged
        {
            supervisor.restart_openclaw_gateway(paths)?;
        }

        Ok(Some(self.set_instance_status(
            paths,
            config,
            storage,
            id,
            StudioInstanceStatus::Online,
        )?))
    }

    pub fn set_instance_status(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
        status: StudioInstanceStatus,
    ) -> Result<StudioInstanceRecord> {
        let mut registry = self.load_instance_registry(paths, config, storage)?;
        let index = registry
            .instances
            .iter()
            .position(|instance| instance.id == id)
            .ok_or_else(|| FrameworkError::NotFound(format!("instance \"{id}\"")))?;

        let now = unix_timestamp_ms()?;
        registry.instances[index].status = status;
        registry.instances[index].updated_at = now;
        registry.instances[index].last_seen_at = Some(now);

        let updated = registry.instances[index].clone();
        self.write_instance_registry(paths, config, storage, &registry)?;
        Ok(updated)
    }

    pub fn get_instance_config(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
    ) -> Result<Option<StudioInstanceConfig>> {
        Ok(self
            .get_instance(paths, config, storage, id)?
            .map(|instance| instance.config))
    }

    pub fn update_instance_config(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
        next_config: StudioInstanceConfig,
    ) -> Result<Option<StudioInstanceConfig>> {
        let updated = self.update_instance(
            paths,
            config,
            storage,
            id,
            StudioUpdateInstanceInput {
                port: next_config.port.parse::<u16>().ok(),
                base_url: next_config.base_url.clone(),
                websocket_url: next_config.websocket_url.clone(),
                config: Some(PartialStudioInstanceConfig {
                    port: Some(next_config.port.clone()),
                    sandbox: Some(next_config.sandbox),
                    auto_update: Some(next_config.auto_update),
                    log_level: Some(next_config.log_level.clone()),
                    cors_origins: Some(next_config.cors_origins.clone()),
                    workspace_path: next_config.workspace_path.clone(),
                    base_url: next_config.base_url.clone(),
                    websocket_url: next_config.websocket_url.clone(),
                    auth_token: next_config.auth_token.clone(),
                }),
                ..StudioUpdateInstanceInput::default()
            },
        )?;

        Ok(Some(updated.config))
    }

    pub fn get_instance_logs(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
    ) -> Result<String> {
        if id == DEFAULT_INSTANCE_ID {
            let log_file = paths.logs_dir.join("openclaw-gateway.log");
            if log_file.exists() {
                return Ok(fs::read_to_string(log_file)?);
            }
        }

        if let Some(instance) = self.get_instance(paths, config, storage, id)? {
            return Ok(format!(
                "[{}] instance={} status={:?} transport={:?}",
                instance.updated_at, instance.id, instance.status, instance.transport_kind
            ));
        }

        Ok(String::new())
    }

    pub fn update_instance_file_content(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        file_id: &str,
        content: &str,
    ) -> Result<bool> {
        self.require_built_in_managed_openclaw_instance(paths, config, storage, instance_id)?;
        let file_path = Path::new(file_id);
        let instance = self
            .get_instance(paths, config, storage, instance_id)?
            .ok_or_else(|| FrameworkError::NotFound(format!("instance \"{instance_id}\"")))?;
        let workbench = build_openclaw_workbench_snapshot(paths, &instance)?
            .ok_or_else(|| FrameworkError::Conflict("workbench snapshot unavailable".to_string()))?;
        let is_writable = workbench
            .files
            .iter()
            .any(|file| file.path == file_id && !file.is_readonly);

        if !is_writable {
            return Err(FrameworkError::Conflict(format!(
                "workbench file \"{file_id}\" is read-only"
            )));
        }

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(file_path, content)?;
        Ok(true)
    }

    pub fn update_instance_llm_provider_config(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        provider_id: &str,
        update: StudioUpdateInstanceLlmProviderConfigInput,
    ) -> Result<bool> {
        self.require_built_in_managed_openclaw_instance(paths, config, storage, instance_id)?;

        let mut root = read_json5_object(&paths.openclaw_config_file)?;
        let provider_path = ["models", "providers", provider_id];

        if !update.endpoint.trim().is_empty() {
            set_nested_string(&mut root, &["models", "providers", provider_id, "baseUrl"], update.endpoint.trim());
        }
        set_nested_value(
            &mut root,
            &["models", "providers", provider_id, "apiKey"],
            if update.api_key_source.trim().is_empty() {
                Value::Null
            } else {
                Value::String(update.api_key_source.trim().to_string())
            },
        );
        set_nested_value(
            &mut root,
            &["models", "providers", provider_id, "temperature"],
            Number::from_f64(update.config.temperature)
                .map(Value::Number)
                .unwrap_or(Value::Number(Number::from(0))),
        );
        set_nested_value(
            &mut root,
            &["models", "providers", provider_id, "topP"],
            Number::from_f64(update.config.top_p)
                .map(Value::Number)
                .unwrap_or(Value::Number(Number::from(1))),
        );
        set_nested_value(
            &mut root,
            &["models", "providers", provider_id, "maxTokens"],
            Value::Number(Number::from(update.config.max_tokens)),
        );
        set_nested_value(
            &mut root,
            &["models", "providers", provider_id, "timeoutMs"],
            Value::Number(Number::from(update.config.timeout_ms)),
        );
        set_nested_bool(
            &mut root,
            &["models", "providers", provider_id, "streaming"],
            update.config.streaming,
        );

        let existing_models = get_nested_value(
            &root,
            &[provider_path[0], provider_path[1], provider_path[2], "models"],
        )
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let next_models = upsert_openclaw_provider_models(
            existing_models,
            update.default_model_id.as_str(),
            update.reasoning_model_id.as_deref(),
            update.embedding_model_id.as_deref(),
        );
        set_nested_value(
            &mut root,
            &["models", "providers", provider_id, "models"],
            Value::Array(next_models),
        );

        write_openclaw_config_file(paths, &root)?;
        Ok(true)
    }

    pub fn clone_instance_task(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        instance_id: &str,
        task_id: &str,
        name: Option<&str>,
    ) -> Result<()> {
        self.require_managed_openclaw_task_instance(paths, config, storage, instance_id)?;
        let runtime = require_running_openclaw_runtime(supervisor)?;
        clone_openclaw_task(paths, &runtime, task_id, name)
    }

    pub fn run_instance_task_now(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        instance_id: &str,
        task_id: &str,
    ) -> Result<StudioWorkbenchTaskExecutionRecord> {
        self.require_managed_openclaw_task_instance(paths, config, storage, instance_id)?;
        let runtime = require_running_openclaw_runtime(supervisor)?;
        run_openclaw_task_now(paths, &runtime, task_id)
    }

    pub fn list_instance_task_executions(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>> {
        self.require_managed_openclaw_task_instance(paths, config, storage, instance_id)?;
        list_openclaw_task_executions(paths, task_id)
    }

    pub fn update_instance_task_status(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        instance_id: &str,
        task_id: &str,
        status: &str,
    ) -> Result<()> {
        self.require_managed_openclaw_task_instance(paths, config, storage, instance_id)?;
        let runtime = require_running_openclaw_runtime(supervisor)?;
        update_openclaw_task_status(paths, &runtime, task_id, status)
    }

    pub fn delete_instance_task(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        instance_id: &str,
        task_id: &str,
    ) -> Result<bool> {
        self.require_managed_openclaw_task_instance(paths, config, storage, instance_id)?;
        let runtime = require_running_openclaw_runtime(supervisor)?;
        delete_openclaw_task(paths, &runtime, task_id)
    }

    pub fn get_instance_detail(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
    ) -> Result<Option<StudioInstanceDetailRecord>> {
        let Some(instance) = self.get_instance(paths, config, storage, id)? else {
            return Ok(None);
        };
        let logs = self.get_instance_logs(paths, config, storage, id)?;
        let config = instance.config.clone();
        let storage_snapshot = build_storage_snapshot_for_instance(&instance);
        let connectivity = build_connectivity_snapshot(&instance);
        let observability = build_observability_snapshot(paths, &instance, &logs);
        let data_access = build_data_access_snapshot(
            paths,
            &instance,
            &storage_snapshot,
            &connectivity,
            &observability,
        );
        let artifacts =
            build_artifacts(paths, &instance, &storage_snapshot, &connectivity, &observability);
        let health =
            build_health_snapshot(&instance, &storage_snapshot, &connectivity, &observability)?;
        let lifecycle = build_lifecycle_snapshot(&instance);
        let capabilities = build_capability_snapshots(&instance, &storage_snapshot);
        let official_runtime_notes = build_official_runtime_notes(&instance);
        let workbench = if instance.id == DEFAULT_INSTANCE_ID
            && instance.is_built_in
            && instance.runtime_kind == StudioRuntimeKind::Openclaw
            && instance.deployment_mode == StudioInstanceDeploymentMode::LocalManaged
        {
            build_openclaw_workbench_snapshot(paths, &instance)?
        } else {
            None
        };

        Ok(Some(StudioInstanceDetailRecord {
            instance,
            config,
            logs,
            health,
            lifecycle,
            storage: storage_snapshot,
            connectivity,
            observability,
            data_access,
            artifacts,
            capabilities,
            official_runtime_notes,
            workbench,
        }))
    }

    pub fn list_conversations(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
    ) -> Result<Vec<StudioConversationRecord>> {
        let response = storage.list_keys(
            paths,
            config,
            StorageListKeysRequest {
                profile_id: None,
                namespace: Some(CHAT_NAMESPACE.to_string()),
            },
        )?;
        let mut conversations = Vec::new();

        for key in response.keys {
            if !key.starts_with(CONVERSATION_KEY_PREFIX) {
                continue;
            }

            let Some(conversation) = self.read_conversation(paths, config, storage, &key)? else {
                continue;
            };
            if conversation.primary_instance_id == instance_id
                || conversation
                    .participant_instance_ids
                    .iter()
                    .any(|participant_id| participant_id == instance_id)
            {
                conversations.push(conversation);
            }
        }

        conversations.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        Ok(conversations)
    }

    pub fn put_conversation(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        mut record: StudioConversationRecord,
    ) -> Result<StudioConversationRecord> {
        let registry = self.load_instance_registry(paths, config, storage)?;
        let instance_ids = registry
            .instances
            .iter()
            .map(|instance| instance.id.as_str())
            .collect::<BTreeSet<_>>();

        if !instance_ids.contains(record.primary_instance_id.as_str()) {
            return Err(FrameworkError::NotFound(format!(
                "instance \"{}\"",
                record.primary_instance_id
            )));
        }

        record.participant_instance_ids = normalize_participant_instance_ids(
            &record.primary_instance_id,
            std::mem::take(&mut record.participant_instance_ids),
        );

        if let Some(missing_participant_id) = record
            .participant_instance_ids
            .iter()
            .find(|participant_id| !instance_ids.contains(participant_id.as_str()))
        {
            return Err(FrameworkError::NotFound(format!(
                "instance \"{}\"",
                missing_participant_id
            )));
        }

        for message in record.messages.iter_mut() {
            message.conversation_id = record.id.clone();
        }

        record.message_count = record.messages.len() as u64;
        record.last_message_preview = record
            .messages
            .last()
            .map(|message| message.content.chars().take(120).collect::<String>());
        if let Some(last_message) = record.messages.last() {
            record.updated_at = last_message.updated_at.max(record.updated_at);
        }

        storage.put_text(
            paths,
            config,
            StoragePutTextRequest {
                profile_id: None,
                namespace: Some(CHAT_NAMESPACE.to_string()),
                key: conversation_storage_key(&record.id),
                value: serde_json::to_string_pretty(&record)?,
            },
        )?;

        Ok(record)
    }

    pub fn delete_conversation(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        id: &str,
    ) -> Result<bool> {
        Ok(storage
            .delete(
                paths,
                config,
                StorageDeleteRequest {
                    profile_id: None,
                    namespace: Some(CHAT_NAMESPACE.to_string()),
                    key: conversation_storage_key(id),
                },
            )?
            .existed)
    }

    fn load_instance_registry(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
    ) -> Result<InstanceRegistryDocument> {
        let response = storage.get_text(
            paths,
            config,
            StorageGetTextRequest {
                profile_id: None,
                namespace: Some(INSTANCE_NAMESPACE.to_string()),
                key: INSTANCE_REGISTRY_KEY.to_string(),
            },
        )?;
        let mut document = response
            .value
            .as_deref()
            .map(serde_json::from_str::<InstanceRegistryDocument>)
            .transpose()?
            .unwrap_or_default();

        let builtin = build_built_in_instance(paths, config)?;
        let mut changed = upsert_built_in_instance(&mut document.instances, builtin);
        changed |= normalize_default_instance(&mut document.instances);

        if changed {
            self.write_instance_registry(paths, config, storage, &document)?;
        }

        Ok(document)
    }

    fn write_instance_registry(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        document: &InstanceRegistryDocument,
    ) -> Result<()> {
        storage.put_text(
            paths,
            config,
            StoragePutTextRequest {
                profile_id: None,
                namespace: Some(INSTANCE_NAMESPACE.to_string()),
                key: INSTANCE_REGISTRY_KEY.to_string(),
                value: serde_json::to_string_pretty(document)?,
            },
        )?;
        Ok(())
    }

    fn read_conversation(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        key: &str,
    ) -> Result<Option<StudioConversationRecord>> {
        let response = storage.get_text(
            paths,
            config,
            StorageGetTextRequest {
                profile_id: None,
                namespace: Some(CHAT_NAMESPACE.to_string()),
                key: key.to_string(),
            },
        )?;

        response
            .value
            .as_deref()
            .map(serde_json::from_str::<StudioConversationRecord>)
            .transpose()
            .map_err(Into::into)
    }

    fn sync_built_in_runtime_config(
        &self,
        paths: &AppPaths,
        config: &StudioInstanceConfig,
    ) -> Result<()> {
        let mut root = read_json5_object(&paths.openclaw_config_file)?;
        set_nested_u16(
            &mut root,
            &["gateway", "port"],
            config.port.parse::<u16>().unwrap_or(18_789),
        );
        set_nested_string(&mut root, &["studio", "logLevel"], config.log_level.as_str());
        set_nested_string(
            &mut root,
            &["studio", "corsOrigins"],
            config.cors_origins.as_str(),
        );
        set_nested_bool(&mut root, &["studio", "sandbox"], config.sandbox);
        set_nested_bool(&mut root, &["studio", "autoUpdate"], config.auto_update);
        set_nested_bool(
            &mut root,
            &["gateway", "http", "endpoints", "chatCompletions", "enabled"],
            true,
        );
        set_nested_string(&mut root, &["gateway", "auth", "mode"], "token");
        if let Some(auth_token) = config.auth_token.as_deref() {
            set_nested_string(&mut root, &["gateway", "auth", "token"], auth_token);
        }
        if let Some(workspace_path) = config.workspace_path.as_deref() {
            set_nested_string(&mut root, &["agents", "defaults", "workspace"], workspace_path);
        }

        write_openclaw_config_file(paths, &root)?;
        Ok(())
    }

    fn require_built_in_managed_openclaw_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
    ) -> Result<StudioInstanceRecord> {
        let instance = self
            .get_instance(paths, config, storage, instance_id)?
            .ok_or_else(|| FrameworkError::NotFound(format!("instance \"{instance_id}\"")))?;

        if instance.id != DEFAULT_INSTANCE_ID
            || !instance.is_built_in
            || instance.runtime_kind != StudioRuntimeKind::Openclaw
            || instance.deployment_mode != StudioInstanceDeploymentMode::LocalManaged
        {
            return Err(FrameworkError::Conflict(
                "runtime-backed OpenClaw workspace operations are only available for the built-in managed OpenClaw instance"
                    .to_string(),
            ));
        }

        Ok(instance)
    }

    fn require_managed_openclaw_task_instance(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
    ) -> Result<StudioInstanceRecord> {
        self.require_built_in_managed_openclaw_instance(paths, config, storage, instance_id)
            .map_err(|error| match error {
                FrameworkError::Conflict(_) => FrameworkError::Conflict(
                    "runtime-backed task operations are only available for the built-in managed OpenClaw instance"
                        .to_string(),
                ),
                other => other,
            })
    }
}

fn build_health_snapshot(
    instance: &StudioInstanceRecord,
    storage: &StudioInstanceStorageSnapshot,
    connectivity: &StudioInstanceConnectivitySnapshot,
    observability: &StudioInstanceObservabilitySnapshot,
) -> Result<StudioInstanceHealthSnapshot> {
    let runtime_status = health_status_for_instance(instance);
    let endpoint_ready = connectivity
        .endpoints
        .iter()
        .any(|endpoint| endpoint.status == StudioInstanceEndpointStatus::Ready);
    let storage_ready = storage.status == StudioInstanceStorageStatus::Ready;
    let logs_ready = observability.log_available;
    let baseline = match runtime_status {
        StudioInstanceHealthStatus::Healthy => 88,
        StudioInstanceHealthStatus::Attention => 62,
        StudioInstanceHealthStatus::Offline => 30,
        StudioInstanceHealthStatus::Degraded => 18,
    };
    let mut score = baseline - (instance.cpu as i32 / 4) - (instance.memory as i32 / 5);
    if endpoint_ready {
        score += 6;
    }
    if storage_ready {
        score += 6;
    }
    if logs_ready {
        score += 4;
    }
    let score = score.clamp(0, 100) as u8;

    let checks = vec![
        StudioInstanceHealthCheck {
            id: "runtime-status".to_string(),
            label: "Runtime status".to_string(),
            status: runtime_status.clone(),
            detail: format!("Instance is {:?}.", instance.status),
        },
        StudioInstanceHealthCheck {
            id: "connectivity".to_string(),
            label: "Connectivity".to_string(),
            status: if endpoint_ready {
                StudioInstanceHealthStatus::Healthy
            } else if instance.status == StudioInstanceStatus::Offline {
                StudioInstanceHealthStatus::Offline
            } else {
                StudioInstanceHealthStatus::Attention
            },
            detail: if endpoint_ready {
                "Endpoint metadata is configured.".to_string()
            } else {
                "No reachable endpoint metadata is configured.".to_string()
            },
        },
        StudioInstanceHealthCheck {
            id: "storage".to_string(),
            label: "Storage".to_string(),
            status: match storage.status {
                StudioInstanceStorageStatus::Ready => StudioInstanceHealthStatus::Healthy,
                StudioInstanceStorageStatus::ConfigurationRequired => {
                    StudioInstanceHealthStatus::Attention
                }
                StudioInstanceStorageStatus::Planned => StudioInstanceHealthStatus::Attention,
                StudioInstanceStorageStatus::Unavailable => StudioInstanceHealthStatus::Degraded,
            },
            detail: format!("Storage provider is {:?}.", storage.provider),
        },
        StudioInstanceHealthCheck {
            id: "observability".to_string(),
            label: "Observability".to_string(),
            status: match observability.status {
                StudioInstanceObservabilityStatus::Ready => StudioInstanceHealthStatus::Healthy,
                StudioInstanceObservabilityStatus::Limited => StudioInstanceHealthStatus::Attention,
                StudioInstanceObservabilityStatus::Unavailable => {
                    StudioInstanceHealthStatus::Degraded
                }
            },
            detail: if observability.log_available {
                "Logs are available for inspection.".to_string()
            } else {
                "No logs are currently available.".to_string()
            },
        },
    ];

    Ok(StudioInstanceHealthSnapshot {
        score,
        status: if instance.status == StudioInstanceStatus::Offline {
            StudioInstanceHealthStatus::Offline
        } else if score >= 80 {
            StudioInstanceHealthStatus::Healthy
        } else if score >= 55 {
            StudioInstanceHealthStatus::Attention
        } else {
            StudioInstanceHealthStatus::Degraded
        },
        checks,
        evaluated_at: unix_timestamp_ms()?,
    })
}

fn health_status_for_instance(instance: &StudioInstanceRecord) -> StudioInstanceHealthStatus {
    match instance.status {
        StudioInstanceStatus::Online => StudioInstanceHealthStatus::Healthy,
        StudioInstanceStatus::Starting | StudioInstanceStatus::Syncing => {
            StudioInstanceHealthStatus::Attention
        }
        StudioInstanceStatus::Offline => StudioInstanceHealthStatus::Offline,
        StudioInstanceStatus::Error => StudioInstanceHealthStatus::Degraded,
    }
}

fn build_lifecycle_snapshot(instance: &StudioInstanceRecord) -> StudioInstanceLifecycleSnapshot {
    let owner = match instance.deployment_mode {
        StudioInstanceDeploymentMode::LocalManaged => StudioInstanceLifecycleOwner::AppManaged,
        StudioInstanceDeploymentMode::LocalExternal => {
            StudioInstanceLifecycleOwner::ExternalProcess
        }
        StudioInstanceDeploymentMode::Remote => StudioInstanceLifecycleOwner::RemoteService,
    };

    StudioInstanceLifecycleSnapshot {
        owner: owner.clone(),
        start_stop_supported: owner == StudioInstanceLifecycleOwner::AppManaged,
        config_writable: owner != StudioInstanceLifecycleOwner::RemoteService,
        notes: match owner {
            StudioInstanceLifecycleOwner::AppManaged => {
                vec!["Lifecycle is managed by Claw Studio.".to_string()]
            }
            StudioInstanceLifecycleOwner::ExternalProcess => {
                vec!["Lifecycle is owned by an external local process.".to_string()]
            }
            StudioInstanceLifecycleOwner::RemoteService => {
                vec!["Lifecycle is owned by a remote deployment.".to_string()]
            }
        },
    }
}

fn build_storage_snapshot_for_instance(
    instance: &StudioInstanceRecord,
) -> StudioInstanceStorageSnapshot {
    let (durable, queryable, transactional, remote) =
        storage_capabilities_for_provider(&instance.storage.provider);

    StudioInstanceStorageSnapshot {
        status: storage_status_for_binding(&instance.storage),
        profile_id: instance.storage.profile_id.clone(),
        provider: instance.storage.provider.clone(),
        namespace: instance.storage.namespace.clone(),
        database: instance.storage.database.clone(),
        connection_hint: instance.storage.connection_hint.clone(),
        endpoint: instance.storage.endpoint.clone(),
        durable,
        queryable,
        transactional,
        remote,
    }
}

fn storage_status_for_binding(binding: &StudioStorageBinding) -> StudioInstanceStorageStatus {
    match binding.provider {
        StorageProviderKind::Memory | StorageProviderKind::LocalFile => {
            StudioInstanceStorageStatus::Ready
        }
        StorageProviderKind::Sqlite => {
            if binding.namespace.trim().is_empty() {
                StudioInstanceStorageStatus::ConfigurationRequired
            } else {
                StudioInstanceStorageStatus::Ready
            }
        }
        StorageProviderKind::Postgres => {
            if binding.connection_hint.is_some() {
                StudioInstanceStorageStatus::Ready
            } else {
                StudioInstanceStorageStatus::ConfigurationRequired
            }
        }
        StorageProviderKind::RemoteApi => {
            if binding.endpoint.is_some() {
                StudioInstanceStorageStatus::Planned
            } else {
                StudioInstanceStorageStatus::ConfigurationRequired
            }
        }
    }
}

fn storage_capabilities_for_provider(kind: &StorageProviderKind) -> (bool, bool, bool, bool) {
    match kind {
        StorageProviderKind::Memory => (false, true, false, false),
        StorageProviderKind::LocalFile => (true, false, false, false),
        StorageProviderKind::Sqlite => (true, true, true, false),
        StorageProviderKind::Postgres => (true, true, true, true),
        StorageProviderKind::RemoteApi => (true, true, false, true),
    }
}

fn build_connectivity_snapshot(
    instance: &StudioInstanceRecord,
) -> StudioInstanceConnectivitySnapshot {
    let mut endpoints = Vec::new();

    if let Some(base_url) = instance.base_url.as_deref() {
        endpoints.push(connectivity_endpoint(
            instance,
            "gateway-http",
            "HTTP endpoint",
            StudioInstanceEndpointKind::Http,
            Some(base_url.to_string()),
            StudioInstanceEndpointSource::Config,
        ));
    }

    if let Some(websocket_url) = instance.websocket_url.as_deref() {
        endpoints.push(connectivity_endpoint(
            instance,
            "gateway-ws",
            "Gateway WebSocket",
            StudioInstanceEndpointKind::Websocket,
            Some(websocket_url.to_string()),
            StudioInstanceEndpointSource::Config,
        ));
    }

    if let Some(base_url) = instance.base_url.as_deref() {
        match instance.runtime_kind {
            StudioRuntimeKind::Openclaw => endpoints.push(connectivity_endpoint(
                instance,
                "openai-http-chat",
                "OpenAI Chat Completions",
                StudioInstanceEndpointKind::OpenaiChatCompletions,
                Some(format!("{}/v1/chat/completions", base_url.trim_end_matches('/'))),
                StudioInstanceEndpointSource::Derived,
            )),
            StudioRuntimeKind::Zeroclaw => endpoints.push(connectivity_endpoint(
                instance,
                "dashboard",
                "Gateway Dashboard",
                StudioInstanceEndpointKind::Dashboard,
                Some(base_url.to_string()),
                StudioInstanceEndpointSource::Derived,
            )),
            StudioRuntimeKind::Ironclaw => endpoints.push(connectivity_endpoint(
                instance,
                "gateway-sse",
                "Realtime Gateway",
                StudioInstanceEndpointKind::Sse,
                Some(base_url.to_string()),
                StudioInstanceEndpointSource::Derived,
            )),
            StudioRuntimeKind::Custom => {}
        }
    }

    StudioInstanceConnectivitySnapshot {
        primary_transport: instance.transport_kind.clone(),
        endpoints,
    }
}

fn connectivity_endpoint(
    instance: &StudioInstanceRecord,
    id: &str,
    label: &str,
    kind: StudioInstanceEndpointKind,
    url: Option<String>,
    source: StudioInstanceEndpointSource,
) -> StudioInstanceConnectivityEndpoint {
    StudioInstanceConnectivityEndpoint {
        id: id.to_string(),
        label: label.to_string(),
        kind,
        status: if url.is_some() {
            StudioInstanceEndpointStatus::Ready
        } else {
            StudioInstanceEndpointStatus::ConfigurationRequired
        },
        url,
        exposure: endpoint_exposure_for_instance(instance),
        auth: endpoint_auth_for_instance(instance),
        source,
    }
}

fn endpoint_exposure_for_instance(instance: &StudioInstanceRecord) -> StudioInstanceExposure {
    if instance.deployment_mode == StudioInstanceDeploymentMode::Remote {
        return StudioInstanceExposure::Remote;
    }

    if instance.host == "127.0.0.1" || instance.host.eq_ignore_ascii_case("localhost") {
        StudioInstanceExposure::Loopback
    } else {
        StudioInstanceExposure::Private
    }
}

fn endpoint_auth_for_instance(instance: &StudioInstanceRecord) -> StudioInstanceAuthMode {
    if instance.config.auth_token.is_some() {
        StudioInstanceAuthMode::Token
    } else if instance.deployment_mode == StudioInstanceDeploymentMode::Remote {
        StudioInstanceAuthMode::External
    } else {
        StudioInstanceAuthMode::Unknown
    }
}

fn build_observability_snapshot(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    logs: &str,
) -> StudioInstanceObservabilitySnapshot {
    let log_preview = logs
        .lines()
        .map(str::trim_end)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .rev()
        .take(5)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>();
    let log_file_path = if instance.id == DEFAULT_INSTANCE_ID {
        Some(
            paths
                .logs_dir
                .join("openclaw-gateway.log")
                .to_string_lossy()
                .into_owned(),
        )
    } else {
        None
    };

    StudioInstanceObservabilitySnapshot {
        status: if !log_preview.is_empty() {
            StudioInstanceObservabilityStatus::Ready
        } else if instance.id == DEFAULT_INSTANCE_ID {
            StudioInstanceObservabilityStatus::Limited
        } else {
            StudioInstanceObservabilityStatus::Unavailable
        },
        log_available: !log_preview.is_empty(),
        log_file_path,
        log_preview,
        last_seen_at: instance.last_seen_at,
        metrics_source: StudioInstanceMetricsSource::Derived,
    }
}

fn build_data_access_snapshot(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    storage: &StudioInstanceStorageSnapshot,
    connectivity: &StudioInstanceConnectivitySnapshot,
    observability: &StudioInstanceObservabilitySnapshot,
) -> StudioInstanceDataAccessSnapshot {
    let mut routes = Vec::new();
    let registry_target = Some("studio.instances registry metadata".to_string());
    let workspace_target = local_workspace_target(paths, instance);
    let primary_endpoint = primary_connectivity_target(connectivity);
    let openai_endpoint = connectivity
        .endpoints
        .iter()
        .find(|endpoint| endpoint.id == "openai-http-chat")
        .and_then(|endpoint| endpoint.url.clone());

    match instance.deployment_mode {
        StudioInstanceDeploymentMode::LocalManaged => {
            routes.push(data_access_entry(
                "config",
                "Configuration",
                StudioInstanceDataAccessScope::Config,
                StudioInstanceDataAccessMode::ManagedFile,
                StudioInstanceDataAccessStatus::Ready,
                Some(paths.openclaw_config_file.to_string_lossy().into_owned()),
                false,
                true,
                "Claw Studio reads and writes the managed runtime configuration file directly.",
                StudioInstanceDetailSource::Config,
            ));
            routes.push(data_access_entry(
                "logs",
                "Logs",
                StudioInstanceDataAccessScope::Logs,
                StudioInstanceDataAccessMode::ManagedFile,
                if observability.log_file_path.is_some() {
                    StudioInstanceDataAccessStatus::Ready
                } else {
                    StudioInstanceDataAccessStatus::Limited
                },
                observability.log_file_path.clone(),
                true,
                true,
                "Log inspection comes from the managed gateway log file owned by Claw Studio.",
                StudioInstanceDetailSource::Derived,
            ));
            routes.push(data_access_entry(
                "files",
                "Workspace",
                StudioInstanceDataAccessScope::Files,
                StudioInstanceDataAccessMode::ManagedDirectory,
                if workspace_target.is_some() {
                    StudioInstanceDataAccessStatus::Ready
                } else {
                    StudioInstanceDataAccessStatus::ConfigurationRequired
                },
                workspace_target,
                false,
                true,
                "Runtime workspace files live in the managed local workspace directory.",
                StudioInstanceDetailSource::Runtime,
            ));
        }
        StudioInstanceDeploymentMode::LocalExternal => {
            routes.push(data_access_entry(
                "config",
                "Configuration",
                StudioInstanceDataAccessScope::Config,
                StudioInstanceDataAccessMode::MetadataOnly,
                StudioInstanceDataAccessStatus::Ready,
                registry_target.clone(),
                false,
                false,
                "Claw Studio stores operator metadata for this local-external runtime, but does not own its native config file.",
                StudioInstanceDetailSource::Integration,
            ));
            routes.push(data_access_entry(
                "logs",
                "Logs",
                StudioInstanceDataAccessScope::Logs,
                StudioInstanceDataAccessMode::MetadataOnly,
                if observability.log_available {
                    StudioInstanceDataAccessStatus::Limited
                } else {
                    StudioInstanceDataAccessStatus::Planned
                },
                observability.log_file_path.clone(),
                true,
                false,
                "Log visibility is limited unless explicit local diagnostics are configured for the external runtime.",
                StudioInstanceDetailSource::Integration,
            ));
            routes.push(data_access_entry(
                "files",
                "Workspace",
                StudioInstanceDataAccessScope::Files,
                if instance.config.workspace_path.is_some() {
                    StudioInstanceDataAccessMode::ManagedDirectory
                } else {
                    StudioInstanceDataAccessMode::MetadataOnly
                },
                if instance.config.workspace_path.is_some() {
                    StudioInstanceDataAccessStatus::Limited
                } else {
                    StudioInstanceDataAccessStatus::Planned
                },
                instance.config.workspace_path.clone(),
                false,
                false,
                "Workspace access depends on explicitly configured external runtime paths.",
                StudioInstanceDetailSource::Config,
            ));
        }
        StudioInstanceDeploymentMode::Remote => {
            routes.push(data_access_entry(
                "config",
                "Configuration",
                StudioInstanceDataAccessScope::Config,
                StudioInstanceDataAccessMode::MetadataOnly,
                StudioInstanceDataAccessStatus::Ready,
                registry_target.clone(),
                false,
                false,
                "Remote instance configuration is represented by Claw Studio metadata, not a locally managed runtime file.",
                StudioInstanceDetailSource::Integration,
            ));
            routes.push(data_access_entry(
                "logs",
                "Logs",
                StudioInstanceDataAccessScope::Logs,
                StudioInstanceDataAccessMode::MetadataOnly,
                if observability.log_available {
                    StudioInstanceDataAccessStatus::Limited
                } else {
                    StudioInstanceDataAccessStatus::Planned
                },
                None,
                true,
                false,
                "Remote log transport is not yet integrated, so Claw Studio currently exposes metadata posture only.",
                StudioInstanceDetailSource::Integration,
            ));
            routes.push(data_access_entry(
                "files",
                "Workspace",
                StudioInstanceDataAccessScope::Files,
                StudioInstanceDataAccessMode::MetadataOnly,
                StudioInstanceDataAccessStatus::Planned,
                instance.config.workspace_path.clone(),
                false,
                false,
                "Remote runtimes do not expose a Claw Studio-owned workspace directory by default.",
                StudioInstanceDetailSource::Integration,
            ));
        }
    }

    let storage_status = data_access_status_for_storage(storage);
    let storage_target = storage_target(storage);
    routes.push(data_access_entry(
        "memory",
        "Memory",
        StudioInstanceDataAccessScope::Memory,
        StudioInstanceDataAccessMode::StorageBinding,
        storage_status.clone(),
        storage_target.clone(),
        false,
        storage.status == StudioInstanceStorageStatus::Ready,
        "Memory truth is anchored to the configured storage binding for this runtime.",
        StudioInstanceDetailSource::Storage,
    ));

    let tasks_mode = if instance.runtime_kind == StudioRuntimeKind::Zeroclaw && primary_endpoint.is_some() {
        StudioInstanceDataAccessMode::RemoteEndpoint
    } else if storage.status == StudioInstanceStorageStatus::Ready {
        StudioInstanceDataAccessMode::StorageBinding
    } else {
        StudioInstanceDataAccessMode::MetadataOnly
    };
    let tasks_target = if tasks_mode == StudioInstanceDataAccessMode::RemoteEndpoint {
        primary_endpoint.clone()
    } else if tasks_mode == StudioInstanceDataAccessMode::StorageBinding {
        storage_target.clone()
    } else {
        registry_target.clone()
    };
    routes.push(data_access_entry(
        "tasks",
        "Tasks",
        StudioInstanceDataAccessScope::Tasks,
        tasks_mode,
        if tasks_target.is_some() {
            if matches!(instance.runtime_kind, StudioRuntimeKind::Zeroclaw)
                && primary_endpoint.is_some()
            {
                StudioInstanceDataAccessStatus::Ready
            } else {
                storage_status.clone()
            }
        } else {
            StudioInstanceDataAccessStatus::ConfigurationRequired
        },
        tasks_target,
        false,
        primary_endpoint.is_some() || storage.status == StudioInstanceStorageStatus::Ready,
        "Task detail is linked either through runtime endpoints or the bound storage plane, depending on the runtime.",
        if primary_endpoint.is_some() && instance.runtime_kind == StudioRuntimeKind::Zeroclaw {
            StudioInstanceDetailSource::Runtime
        } else {
            StudioInstanceDetailSource::Storage
        },
    ));

    routes.push(data_access_entry(
        "tools",
        "Tools",
        StudioInstanceDataAccessScope::Tools,
        if primary_endpoint.is_some() {
            StudioInstanceDataAccessMode::RemoteEndpoint
        } else {
            StudioInstanceDataAccessMode::MetadataOnly
        },
        if primary_endpoint.is_some() {
            StudioInstanceDataAccessStatus::Planned
        } else {
            StudioInstanceDataAccessStatus::ConfigurationRequired
        },
        primary_endpoint.clone(),
        true,
        false,
        "Tool detail depends on runtime-specific adapters and is currently limited to endpoint posture.",
        StudioInstanceDetailSource::Integration,
    ));

    routes.push(data_access_entry(
        "models",
        "Models",
        StudioInstanceDataAccessScope::Models,
        if openai_endpoint.is_some() || primary_endpoint.is_some() {
            StudioInstanceDataAccessMode::RemoteEndpoint
        } else {
            StudioInstanceDataAccessMode::MetadataOnly
        },
        if openai_endpoint.is_some() || primary_endpoint.is_some() {
            StudioInstanceDataAccessStatus::Planned
        } else {
            StudioInstanceDataAccessStatus::ConfigurationRequired
        },
        openai_endpoint.or(primary_endpoint),
        false,
        false,
        "Model/provider detail requires runtime-specific adapters beyond the base endpoint metadata.",
        StudioInstanceDetailSource::Integration,
    ));

    StudioInstanceDataAccessSnapshot { routes }
}

fn build_artifacts(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    storage: &StudioInstanceStorageSnapshot,
    connectivity: &StudioInstanceConnectivitySnapshot,
    observability: &StudioInstanceObservabilitySnapshot,
) -> Vec<StudioInstanceArtifactRecord> {
    let mut artifacts = Vec::new();

    if instance.id == DEFAULT_INSTANCE_ID {
        artifacts.push(artifact_record(
            "config-file",
            "Config File",
            StudioInstanceArtifactKind::ConfigFile,
            StudioInstanceArtifactStatus::Available,
            Some(paths.openclaw_config_file.to_string_lossy().into_owned()),
            false,
            "Managed OpenClaw runtime configuration file.",
            StudioInstanceDetailSource::Config,
        ));
        artifacts.push(artifact_record(
            "runtime-directory",
            "Runtime Directory",
            StudioInstanceArtifactKind::RuntimeDirectory,
            StudioInstanceArtifactStatus::Available,
            Some(paths.openclaw_runtime_dir.to_string_lossy().into_owned()),
            true,
            "Bundled OpenClaw runtime directory managed by Claw Studio.",
            StudioInstanceDetailSource::Runtime,
        ));
    }

    if let Some(workspace_path) = local_workspace_target(paths, instance) {
        artifacts.push(artifact_record(
            "workspace-directory",
            "Workspace Directory",
            StudioInstanceArtifactKind::WorkspaceDirectory,
            if instance.deployment_mode == StudioInstanceDeploymentMode::Remote {
                StudioInstanceArtifactStatus::Planned
            } else {
                StudioInstanceArtifactStatus::Available
            },
            Some(workspace_path),
            false,
            "Workspace directory or configured runtime workspace root.",
            StudioInstanceDetailSource::Config,
        ));
    }

    if let Some(log_file_path) = observability.log_file_path.clone() {
        artifacts.push(artifact_record(
            "log-file",
            "Log File",
            StudioInstanceArtifactKind::LogFile,
            StudioInstanceArtifactStatus::Available,
            Some(log_file_path),
            true,
            "Primary runtime log file exposed by the detail snapshot.",
            StudioInstanceDetailSource::Derived,
        ));
    }

    if let Some(base_url) = instance.base_url.clone() {
        artifacts.push(artifact_record(
            "gateway-endpoint",
            "Gateway Endpoint",
            StudioInstanceArtifactKind::Endpoint,
            if instance.deployment_mode == StudioInstanceDeploymentMode::Remote {
                StudioInstanceArtifactStatus::Remote
            } else {
                StudioInstanceArtifactStatus::Configured
            },
            Some(base_url.clone()),
            true,
            "Primary configured runtime endpoint.",
            StudioInstanceDetailSource::Config,
        ));

        if instance.runtime_kind == StudioRuntimeKind::Zeroclaw {
            artifacts.push(artifact_record(
                "dashboard",
                "Gateway Dashboard",
                StudioInstanceArtifactKind::Dashboard,
                if instance.deployment_mode == StudioInstanceDeploymentMode::Remote {
                    StudioInstanceArtifactStatus::Remote
                } else {
                    StudioInstanceArtifactStatus::Configured
                },
                Some(base_url),
                true,
                "ZeroClaw dashboard surface derived from the configured gateway URL.",
                StudioInstanceDetailSource::Derived,
            ));
        }
    } else if connectivity.endpoints.is_empty() {
        artifacts.push(artifact_record(
            "gateway-endpoint",
            "Gateway Endpoint",
            StudioInstanceArtifactKind::Endpoint,
            StudioInstanceArtifactStatus::Missing,
            None,
            true,
            "No runtime endpoint is configured for this instance.",
            StudioInstanceDetailSource::Config,
        ));
    }

    artifacts.push(artifact_record(
        "storage-binding",
        "Storage Binding",
        StudioInstanceArtifactKind::StorageBinding,
        artifact_status_for_storage(storage),
        storage_target(storage),
        false,
        "Storage profile, namespace, and backing database or endpoint bound to this instance.",
        StudioInstanceDetailSource::Storage,
    ));

    artifacts
}

fn data_access_entry(
    id: &str,
    label: &str,
    scope: StudioInstanceDataAccessScope,
    mode: StudioInstanceDataAccessMode,
    status: StudioInstanceDataAccessStatus,
    target: Option<String>,
    readonly: bool,
    authoritative: bool,
    detail: &str,
    source: StudioInstanceDetailSource,
) -> StudioInstanceDataAccessEntry {
    StudioInstanceDataAccessEntry {
        id: id.to_string(),
        label: label.to_string(),
        scope,
        mode,
        status,
        target,
        readonly,
        authoritative,
        detail: detail.to_string(),
        source,
    }
}

fn artifact_record(
    id: &str,
    label: &str,
    kind: StudioInstanceArtifactKind,
    status: StudioInstanceArtifactStatus,
    location: Option<String>,
    readonly: bool,
    detail: &str,
    source: StudioInstanceDetailSource,
) -> StudioInstanceArtifactRecord {
    StudioInstanceArtifactRecord {
        id: id.to_string(),
        label: label.to_string(),
        kind,
        status,
        location,
        readonly,
        detail: detail.to_string(),
        source,
    }
}

fn data_access_status_for_storage(
    storage: &StudioInstanceStorageSnapshot,
) -> StudioInstanceDataAccessStatus {
    match storage.status {
        StudioInstanceStorageStatus::Ready => StudioInstanceDataAccessStatus::Ready,
        StudioInstanceStorageStatus::ConfigurationRequired => {
            StudioInstanceDataAccessStatus::ConfigurationRequired
        }
        StudioInstanceStorageStatus::Planned => StudioInstanceDataAccessStatus::Planned,
        StudioInstanceStorageStatus::Unavailable => StudioInstanceDataAccessStatus::Unavailable,
    }
}

fn artifact_status_for_storage(
    storage: &StudioInstanceStorageSnapshot,
) -> StudioInstanceArtifactStatus {
    match storage.status {
        StudioInstanceStorageStatus::Ready => StudioInstanceArtifactStatus::Configured,
        StudioInstanceStorageStatus::ConfigurationRequired => StudioInstanceArtifactStatus::Missing,
        StudioInstanceStorageStatus::Planned => StudioInstanceArtifactStatus::Planned,
        StudioInstanceStorageStatus::Unavailable => StudioInstanceArtifactStatus::Missing,
    }
}

fn storage_target(storage: &StudioInstanceStorageSnapshot) -> Option<String> {
    storage
        .endpoint
        .clone()
        .or_else(|| storage.database.clone())
        .or_else(|| Some(storage.namespace.clone()))
}

fn local_workspace_target(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
) -> Option<String> {
    if instance.id == DEFAULT_INSTANCE_ID {
        return Some(paths.openclaw_workspace_dir.to_string_lossy().into_owned());
    }

    instance.config.workspace_path.clone()
}

fn primary_connectivity_target(
    connectivity: &StudioInstanceConnectivitySnapshot,
) -> Option<String> {
    connectivity
        .endpoints
        .iter()
        .find(|endpoint| endpoint.status == StudioInstanceEndpointStatus::Ready)
        .and_then(|endpoint| endpoint.url.clone())
}

fn build_capability_snapshots(
    instance: &StudioInstanceRecord,
    storage: &StudioInstanceStorageSnapshot,
) -> Vec<StudioInstanceCapabilitySnapshot> {
    const ALL_CAPABILITIES: [StudioInstanceCapability; 7] = [
        StudioInstanceCapability::Chat,
        StudioInstanceCapability::Health,
        StudioInstanceCapability::Files,
        StudioInstanceCapability::Memory,
        StudioInstanceCapability::Tasks,
        StudioInstanceCapability::Tools,
        StudioInstanceCapability::Models,
    ];

    ALL_CAPABILITIES
        .into_iter()
        .map(|capability| {
            let supported = instance.capabilities.contains(&capability);
            let (status, detail, source) = if !supported {
                (
                    StudioInstanceCapabilityStatus::Unsupported,
                    "This runtime is not currently modeled as supporting this capability."
                        .to_string(),
                    StudioInstanceCapabilitySource::Runtime,
                )
            } else if matches!(
                capability,
                StudioInstanceCapability::Memory | StudioInstanceCapability::Tasks
            ) && storage.status != StudioInstanceStorageStatus::Ready
            {
                (
                    StudioInstanceCapabilityStatus::ConfigurationRequired,
                    "Capability depends on a configured durable storage binding.".to_string(),
                    StudioInstanceCapabilitySource::Storage,
                )
            } else if matches!(
                capability,
                StudioInstanceCapability::Files | StudioInstanceCapability::Tools
            ) && instance.deployment_mode != StudioInstanceDeploymentMode::LocalManaged
            {
                (
                    StudioInstanceCapabilityStatus::Planned,
                    "Runtime may support this, but Claw Studio has not integrated this external detail surface yet."
                        .to_string(),
                    StudioInstanceCapabilitySource::Integration,
                )
            } else {
                (
                    StudioInstanceCapabilityStatus::Ready,
                    "Advertised by the runtime record.".to_string(),
                    StudioInstanceCapabilitySource::Runtime,
                )
            };

            StudioInstanceCapabilitySnapshot {
                id: capability,
                status,
                detail,
                source,
            }
        })
        .collect()
}

fn build_official_runtime_notes(
    instance: &StudioInstanceRecord,
) -> Vec<StudioInstanceRuntimeNote> {
    match instance.runtime_kind {
        StudioRuntimeKind::Openclaw => vec![StudioInstanceRuntimeNote {
            title: "Gateway-first transport".to_string(),
            content: "OpenClaw centers its runtime around the Gateway WebSocket and can also expose an OpenAI-compatible HTTP chat endpoint on the same gateway port.".to_string(),
            source_url: Some("https://docs.openclaw.ai/gateway/openai-http-api".to_string()),
        }],
        StudioRuntimeKind::Zeroclaw => vec![StudioInstanceRuntimeNote {
            title: "Gateway and dashboard".to_string(),
            content: "ZeroClaw ships as a single Rust binary and exposes a gateway/dashboard surface that can be run locally or remotely.".to_string(),
            source_url: Some("https://github.com/zeroclaw-labs/zeroclaw".to_string()),
        }],
        StudioRuntimeKind::Ironclaw => vec![StudioInstanceRuntimeNote {
            title: "Database-first runtime".to_string(),
            content: "IronClaw expects PostgreSQL plus pgvector and emphasizes persistent storage, routines, and realtime gateway streaming.".to_string(),
            source_url: Some("https://github.com/nearai/ironclaw".to_string()),
        }],
        StudioRuntimeKind::Custom => vec![StudioInstanceRuntimeNote {
            title: "Custom runtime".to_string(),
            content: "This instance uses a custom runtime binding. Connectivity and capability surfaces depend on the configured metadata.".to_string(),
            source_url: None,
        }],
    }
}

fn default_capabilities_for_runtime(
    runtime_kind: &StudioRuntimeKind,
) -> Vec<StudioInstanceCapability> {
    match runtime_kind {
        StudioRuntimeKind::Openclaw => vec![
            StudioInstanceCapability::Chat,
            StudioInstanceCapability::Health,
            StudioInstanceCapability::Files,
            StudioInstanceCapability::Memory,
            StudioInstanceCapability::Tasks,
            StudioInstanceCapability::Tools,
            StudioInstanceCapability::Models,
        ],
        StudioRuntimeKind::Zeroclaw => vec![
            StudioInstanceCapability::Chat,
            StudioInstanceCapability::Health,
            StudioInstanceCapability::Memory,
            StudioInstanceCapability::Tasks,
            StudioInstanceCapability::Tools,
            StudioInstanceCapability::Models,
        ],
        StudioRuntimeKind::Ironclaw => vec![
            StudioInstanceCapability::Chat,
            StudioInstanceCapability::Health,
            StudioInstanceCapability::Memory,
            StudioInstanceCapability::Tasks,
            StudioInstanceCapability::Models,
        ],
        StudioRuntimeKind::Custom => vec![
            StudioInstanceCapability::Chat,
            StudioInstanceCapability::Health,
        ],
    }
}

fn build_built_in_instance(paths: &AppPaths, config: &AppConfig) -> Result<StudioInstanceRecord> {
    let active_version = fs::read_to_string(&paths.active_file)
        .ok()
        .and_then(|content| serde_json::from_str::<ActiveState>(&content).ok())
        .and_then(|active| active.runtimes.get("openclaw").cloned())
        .and_then(|entry| entry.active_version)
        .unwrap_or_else(|| "bundled".to_string());
    let root = read_json5_object(&paths.openclaw_config_file)?;
    let port = get_nested_u16(&root, &["gateway", "port"]).unwrap_or(18_789);
    let workspace_path = get_nested_string(&root, &["agents", "defaults", "workspace"]);
    let log_level =
        get_nested_string(&root, &["studio", "logLevel"]).unwrap_or_else(|| "info".to_string());
    let cors_origins =
        get_nested_string(&root, &["studio", "corsOrigins"]).unwrap_or_else(|| "*".to_string());
    let sandbox = get_nested_bool(&root, &["studio", "sandbox"]).unwrap_or(true);
    let auto_update = get_nested_bool(&root, &["studio", "autoUpdate"]).unwrap_or(true);
    let auth_token = get_nested_string(&root, &["gateway", "auth", "token"]);
    let timestamp = unix_timestamp_ms()?;

    Ok(StudioInstanceRecord {
        id: DEFAULT_INSTANCE_ID.to_string(),
        name: "Local Built-In".to_string(),
        description: Some("Bundled local OpenClaw runtime managed by Claw Studio.".to_string()),
        runtime_kind: StudioRuntimeKind::Openclaw,
        deployment_mode: StudioInstanceDeploymentMode::LocalManaged,
        transport_kind: StudioInstanceTransportKind::OpenclawGatewayWs,
        status: StudioInstanceStatus::Online,
        is_built_in: true,
        is_default: true,
        icon_type: StudioInstanceIconType::Server,
        version: active_version,
        type_label: "Built-In OpenClaw".to_string(),
        host: "127.0.0.1".to_string(),
        port: Some(port),
        base_url: Some(format!("http://127.0.0.1:{port}")),
        websocket_url: Some(format!("ws://127.0.0.1:{port}")),
        cpu: 0,
        memory: 0,
        total_memory: "Unknown".to_string(),
        uptime: "-".to_string(),
        capabilities: vec![
            StudioInstanceCapability::Chat,
            StudioInstanceCapability::Health,
            StudioInstanceCapability::Files,
            StudioInstanceCapability::Memory,
            StudioInstanceCapability::Tasks,
            StudioInstanceCapability::Tools,
            StudioInstanceCapability::Models,
        ],
        storage: default_storage_binding(config),
        config: StudioInstanceConfig {
            port: port.to_string(),
            sandbox,
            auto_update,
            log_level,
            cors_origins,
            workspace_path,
            base_url: Some(format!("http://127.0.0.1:{port}")),
            websocket_url: Some(format!("ws://127.0.0.1:{port}")),
            auth_token,
        },
        created_at: timestamp,
        updated_at: timestamp,
        last_seen_at: Some(timestamp),
    })
}

fn upsert_built_in_instance(
    instances: &mut Vec<StudioInstanceRecord>,
    built_in: StudioInstanceRecord,
) -> bool {
    let Some(index) = instances
        .iter()
        .position(|instance| instance.id == DEFAULT_INSTANCE_ID)
    else {
        instances.insert(0, built_in);
        return true;
    };

    let previous = instances[index].clone();
    let merged = StudioInstanceRecord {
        created_at: previous.created_at,
        is_default: previous.is_default,
        status: previous.status.clone(),
        updated_at: previous.updated_at,
        last_seen_at: previous.last_seen_at,
        ..built_in
    };

    if previous != merged {
        instances[index] = merged;
        return true;
    }

    false
}

fn normalize_default_instance(instances: &mut Vec<StudioInstanceRecord>) -> bool {
    if instances.is_empty() {
        return false;
    }

    let default_id = instances
        .iter()
        .find(|instance| instance.is_default)
        .map(|instance| instance.id.clone())
        .unwrap_or_else(|| {
            instances
                .iter()
                .find(|instance| instance.id == DEFAULT_INSTANCE_ID)
                .map(|instance| instance.id.clone())
                .unwrap_or_else(|| instances[0].id.clone())
        });

    let mut changed = false;
    for instance in instances.iter_mut() {
        let should_be_default = instance.id == default_id;
        if instance.is_default != should_be_default {
            instance.is_default = should_be_default;
            changed = true;
        }
    }

    changed
}

fn default_storage_binding(config: &AppConfig) -> StudioStorageBinding {
    let normalized = config.storage.normalized();
    let active_profile = normalized
        .profiles
        .iter()
        .find(|profile| profile.id == normalized.active_profile_id)
        .cloned()
        .unwrap_or_default();

    StudioStorageBinding {
        profile_id: Some(active_profile.id),
        provider: active_profile.provider,
        namespace: active_profile.namespace,
        database: active_profile.database,
        connection_hint: active_profile.connection.map(|_| "configured".to_string()),
        endpoint: active_profile.endpoint,
    }
}

fn merge_storage_binding(
    current: StudioStorageBinding,
    input: PartialStudioStorageBinding,
) -> StudioStorageBinding {
    StudioStorageBinding {
        profile_id: input.profile_id.or(current.profile_id),
        provider: input.provider.unwrap_or(current.provider),
        namespace: input.namespace.unwrap_or(current.namespace),
        database: input.database.or(current.database),
        connection_hint: input.connection_hint.or(current.connection_hint),
        endpoint: input.endpoint.or(current.endpoint),
    }
}

fn merge_instance_config(
    current: StudioInstanceConfig,
    input: Option<PartialStudioInstanceConfig>,
) -> StudioInstanceConfig {
    let Some(input) = input else {
        return current;
    };

    StudioInstanceConfig {
        port: input.port.unwrap_or(current.port),
        sandbox: input.sandbox.unwrap_or(current.sandbox),
        auto_update: input.auto_update.unwrap_or(current.auto_update),
        log_level: input.log_level.unwrap_or(current.log_level),
        cors_origins: input.cors_origins.unwrap_or(current.cors_origins),
        workspace_path: input.workspace_path.or(current.workspace_path),
        base_url: input.base_url.or(current.base_url),
        websocket_url: input.websocket_url.or(current.websocket_url),
        auth_token: input.auth_token.or(current.auth_token),
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn normalize_participant_instance_ids(
    primary_instance_id: &str,
    participant_instance_ids: Vec<String>,
) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut normalized = Vec::new();

    if seen.insert(primary_instance_id.to_string()) {
        normalized.push(primary_instance_id.to_string());
    }

    for participant_instance_id in participant_instance_ids {
        let trimmed = participant_instance_id.trim();
        if trimmed.is_empty() {
            continue;
        }

        if seen.insert(trimmed.to_string()) {
            normalized.push(trimmed.to_string());
        }
    }

    normalized
}

fn conversation_storage_key(id: &str) -> String {
    format!("{CONVERSATION_KEY_PREFIX}{id}")
}

fn unix_timestamp_ms() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?
        .as_millis() as u64)
}

fn read_json5_object(path: &std::path::Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }

    let content = fs::read_to_string(path)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid json5 config: {error}"))
    })?;

    if parsed.is_object() {
        Ok(parsed)
    } else {
        Err(FrameworkError::ValidationFailed(format!(
            "expected config object at {}",
            path.display()
        )))
    }
}

fn set_nested_string(value: &mut Value, path: &[&str], next: &str) {
    set_nested_value(value, path, Value::String(next.to_string()));
}

fn set_nested_bool(value: &mut Value, path: &[&str], next: bool) {
    set_nested_value(value, path, Value::Bool(next));
}

fn set_nested_u16(value: &mut Value, path: &[&str], next: u16) {
    set_nested_value(value, path, Value::Number(Number::from(next)));
}

fn set_nested_value(value: &mut Value, path: &[&str], next: Value) {
    if path.is_empty() {
        *value = next;
        return;
    }

    let mut current = value;
    for segment in &path[..path.len() - 1] {
        let object = current.as_object_mut().expect("nested objects");
        current = object
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if !current.is_object() {
            *current = Value::Object(Map::new());
        }
    }

    current
        .as_object_mut()
        .expect("nested objects")
        .insert(path[path.len() - 1].to_string(), next);
}

fn write_openclaw_config_file(paths: &AppPaths, root: &Value) -> Result<()> {
    fs::write(
        &paths.openclaw_config_file,
        format!("{}\n", serde_json::to_string_pretty(root)?),
    )?;
    Ok(())
}

fn build_openclaw_provider_model_value(id: &str, role: &str, existing: Option<&Value>) -> Value {
    let mut next = existing
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    next.insert("id".to_string(), Value::String(id.to_string()));
    if !next.contains_key("name") {
        next.insert("name".to_string(), Value::String(id.to_string()));
    }
    next.insert("role".to_string(), Value::String(role.to_string()));
    Value::Object(next)
}

fn upsert_openclaw_provider_models(
    existing_models: Vec<Value>,
    default_model_id: &str,
    reasoning_model_id: Option<&str>,
    embedding_model_id: Option<&str>,
) -> Vec<Value> {
    let mut existing_by_id = BTreeMap::new();
    let mut passthrough = Vec::new();

    for item in existing_models {
        let Some(item_id) = item
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            passthrough.push(item);
            continue;
        };

        existing_by_id.insert(item_id.to_string(), item);
    }

    let default_model_id = default_model_id.trim();
    let reasoning_model_id = reasoning_model_id.map(str::trim);
    let embedding_model_id = embedding_model_id.map(str::trim);
    let mut next = Vec::new();

    if !default_model_id.is_empty() {
        next.push(build_openclaw_provider_model_value(
            default_model_id,
            "primary",
            existing_by_id.get(default_model_id),
        ));
    }
    if let Some(reasoning_model_id) = reasoning_model_id.filter(|value| !value.is_empty()) {
        if reasoning_model_id != default_model_id {
            next.push(build_openclaw_provider_model_value(
                reasoning_model_id,
                "reasoning",
                existing_by_id.get(reasoning_model_id),
            ));
        }
    }
    if let Some(embedding_model_id) = embedding_model_id.filter(|value| !value.is_empty()) {
        if embedding_model_id != default_model_id && Some(embedding_model_id) != reasoning_model_id
        {
            next.push(build_openclaw_provider_model_value(
                embedding_model_id,
                "embedding",
                existing_by_id.get(embedding_model_id),
            ));
        }
    }

    for (id, item) in existing_by_id {
        if id == default_model_id
            || reasoning_model_id == Some(id.as_str())
            || embedding_model_id == Some(id.as_str())
        {
            continue;
        }
        next.push(item);
    }
    next.extend(passthrough);
    next
}

fn get_nested_string(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }

    current.as_str().map(|item| item.to_string())
}

fn get_nested_bool(value: &Value, path: &[&str]) -> Option<bool> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }

    current.as_bool()
}

fn get_nested_u16(value: &Value, path: &[&str]) -> Option<u16> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }

    current.as_u64().and_then(|item| u16::try_from(item).ok())
}

fn get_nested_value<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }

    Some(current)
}

#[cfg(test)]
mod tests {
    use super::{
        StudioConversationMessage, StudioConversationMessageStatus, StudioConversationRecord,
        StudioConversationRole, StudioCreateInstanceInput, StudioInstanceAuthMode,
        StudioInstanceArtifactKind, StudioInstanceCapability,
        StudioInstanceCapabilityStatus, StudioInstanceDataAccessMode,
        StudioInstanceDataAccessScope, StudioInstanceDeploymentMode,
        StudioInstanceLifecycleOwner, StudioInstanceStorageStatus,
        StudioInstanceTransportKind, StudioRuntimeKind, StudioService,
        DEFAULT_INSTANCE_ID,
    };
    use crate::framework::{
        config::AppConfig,
        paths::resolve_paths_for_root,
        services::{
            openclaw_runtime::ActivatedOpenClawRuntime, storage::StorageService,
            supervisor::{SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
        },
        storage::StorageProviderKind,
    };
    use serde_json::Value;
    use std::fs;

    fn studio_context() -> (
        tempfile::TempDir,
        crate::framework::paths::AppPaths,
        AppConfig,
        StorageService,
        StudioService,
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let config = AppConfig::default();
        let storage = StorageService::new();
        let service = StudioService::new();

        (root, paths, config, storage, service)
    }

    fn configured_openclaw_supervisor(
        paths: &crate::framework::paths::AppPaths,
    ) -> SupervisorService {
        let supervisor = SupervisorService::new();
        let runtime = create_openclaw_runtime_fixture(paths);

        supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        supervisor
            .record_running(SERVICE_ID_OPENCLAW_GATEWAY, Some(42))
            .expect("record running");

        supervisor
    }

    fn create_openclaw_runtime_fixture(
        paths: &crate::framework::paths::AppPaths,
    ) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-runtime");
        let runtime_dir = install_dir.join("runtime");
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");
        let node_path = resolve_test_node_executable();

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &cli_path,
            r#"import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const capturePath = path.join(process.env.OPENCLAW_STATE_DIR, 'capture.jsonl');
const method = args[2];
const paramsIndex = args.indexOf('--params');
const params = paramsIndex >= 0 ? JSON.parse(args[paramsIndex + 1]) : null;
fs.mkdirSync(path.dirname(capturePath), { recursive: true });
fs.appendFileSync(capturePath, JSON.stringify({ method, params }) + '\n');

if (method === 'cron.run') {
  process.stdout.write(JSON.stringify({ ok: true, enqueued: true, runId: 'run-123' }));
  process.exit(0);
}

if (method === 'cron.remove') {
  process.stdout.write(JSON.stringify({ removed: true }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({ ok: true, method, params }));
"#,
        )
        .expect("cli script");

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
            gateway_port: 18_789,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for OpenClaw studio tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .expect("node should be available on PATH for OpenClaw studio tests")
    }

    fn read_gateway_call_captures(
        paths: &crate::framework::paths::AppPaths,
    ) -> Vec<Value> {
        let capture_path = paths.openclaw_state_dir.join("capture.jsonl");
        fs::read_to_string(capture_path)
            .unwrap_or_default()
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str::<Value>(line).expect("capture json"))
            .collect()
    }

    #[test]
    fn list_instances_seeds_built_in_default_instance() {
        let (_root, paths, config, storage, service) = studio_context();

        let instances = service
            .list_instances(&paths, &config, &storage)
            .expect("list instances");

        assert_eq!(instances.len(), 1);
        assert_eq!(instances[0].id, DEFAULT_INSTANCE_ID);
        assert!(instances[0].is_built_in);
        assert!(instances[0].is_default);
        assert_eq!(instances[0].runtime_kind, StudioRuntimeKind::Openclaw);
        assert_eq!(
            instances[0].deployment_mode,
            StudioInstanceDeploymentMode::LocalManaged
        );
    }

    #[test]
    fn built_in_instance_reads_http_auth_from_managed_openclaw_config() {
        let (_root, paths, config, storage, service) = studio_context();
        fs::write(
            &paths.openclaw_config_file,
            r#"{
  gateway: {
    port: 19876,
    auth: {
      mode: "token",
      token: "studio-token",
    },
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
}
"#,
        )
        .expect("seed managed config");

        let instances = service
            .list_instances(&paths, &config, &storage)
            .expect("list instances");
        let built_in = instances
            .into_iter()
            .find(|instance| instance.id == DEFAULT_INSTANCE_ID)
            .expect("built-in instance");

        assert_eq!(built_in.base_url.as_deref(), Some("http://127.0.0.1:19876"));
        assert_eq!(built_in.config.base_url.as_deref(), Some("http://127.0.0.1:19876"));
        assert_eq!(built_in.config.auth_token.as_deref(), Some("studio-token"));
    }

    #[test]
    fn remote_instance_crud_round_trips_with_storage_binding_metadata() {
        let (_root, paths, config, storage, service) = studio_context();

        let created = service
            .create_instance(
                &paths,
                &config,
                &storage,
                StudioCreateInstanceInput {
                    name: "Zero Remote".to_string(),
                    description: Some("Remote ZeroClaw".to_string()),
                    runtime_kind: StudioRuntimeKind::Zeroclaw,
                    deployment_mode: StudioInstanceDeploymentMode::Remote,
                    transport_kind: StudioInstanceTransportKind::ZeroclawHttp,
                    icon_type: None,
                    version: Some("0.9.0".to_string()),
                    type_label: Some("Remote ZeroClaw".to_string()),
                    host: Some("zeroclaw.example.com".to_string()),
                    port: Some(8443),
                    base_url: Some("https://zeroclaw.example.com".to_string()),
                    websocket_url: Some("wss://zeroclaw.example.com/ws".to_string()),
                    storage: Some(super::PartialStudioStorageBinding {
                        provider: Some(StorageProviderKind::Postgres),
                        namespace: Some("studio.instances.remote".to_string()),
                        database: Some("claw_studio".to_string()),
                        connection_hint: Some("configured".to_string()),
                        endpoint: Some("postgresql://zeroclaw.example.com".to_string()),
                        ..super::PartialStudioStorageBinding::default()
                    }),
                    config: Some(super::PartialStudioInstanceConfig {
                        base_url: Some("https://zeroclaw.example.com".to_string()),
                        websocket_url: Some("wss://zeroclaw.example.com/ws".to_string()),
                        port: Some("8443".to_string()),
                        ..super::PartialStudioInstanceConfig::default()
                    }),
                },
            )
            .expect("create instance");

        assert_eq!(created.runtime_kind, StudioRuntimeKind::Zeroclaw);
        assert_eq!(created.storage.provider, StorageProviderKind::Postgres);
        assert_eq!(created.storage.database.as_deref(), Some("claw_studio"));
        assert!(!created.is_default);

        let updated = service
            .update_instance(
                &paths,
                &config,
                &storage,
                &created.id,
                super::StudioUpdateInstanceInput {
                    is_default: Some(true),
                    version: Some("1.0.0".to_string()),
                    ..super::StudioUpdateInstanceInput::default()
                },
            )
            .expect("update instance");

        let listed = service
            .list_instances(&paths, &config, &storage)
            .expect("list updated instances");

        assert_eq!(updated.version, "1.0.0");
        assert!(listed
            .iter()
            .any(|instance| instance.id == updated.id && instance.is_default));
        assert!(listed
            .iter()
            .any(|instance| instance.id == DEFAULT_INSTANCE_ID && !instance.is_default));

        let deleted = service
            .delete_instance(&paths, &config, &storage, &created.id)
            .expect("delete instance");
        let remaining = service
            .list_instances(&paths, &config, &storage)
            .expect("list remaining instances");

        assert!(deleted);
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, DEFAULT_INSTANCE_ID);
        assert!(remaining[0].is_default);
    }

    #[test]
    fn conversations_follow_participants_and_reassign_when_primary_instance_is_deleted() {
        let (_root, paths, config, storage, service) = studio_context();
        let remote = service
            .create_instance(
                &paths,
                &config,
                &storage,
                StudioCreateInstanceInput {
                    name: "Iron Remote".to_string(),
                    description: Some("Remote IronClaw".to_string()),
                    runtime_kind: StudioRuntimeKind::Ironclaw,
                    deployment_mode: StudioInstanceDeploymentMode::Remote,
                    transport_kind: StudioInstanceTransportKind::IronclawWeb,
                    icon_type: None,
                    version: Some("0.3.0".to_string()),
                    type_label: Some("Remote IronClaw".to_string()),
                    host: Some("ironclaw.example.com".to_string()),
                    port: Some(443),
                    base_url: Some("https://ironclaw.example.com".to_string()),
                    websocket_url: None,
                    storage: None,
                    config: None,
                },
            )
            .expect("create remote instance");

        let stored = service
            .put_conversation(
                &paths,
                &config,
                &storage,
                StudioConversationRecord {
                    id: "conversation-1".to_string(),
                    title: "Cross-instance".to_string(),
                    primary_instance_id: remote.id.clone(),
                    participant_instance_ids: vec![
                        DEFAULT_INSTANCE_ID.to_string(),
                        remote.id.clone(),
                        DEFAULT_INSTANCE_ID.to_string(),
                    ],
                    created_at: 10,
                    updated_at: 12,
                    message_count: 0,
                    last_message_preview: None,
                    messages: vec![
                        StudioConversationMessage {
                            id: "message-1".to_string(),
                            conversation_id: "stale-id".to_string(),
                            role: StudioConversationRole::User,
                            content: "hello".to_string(),
                            created_at: 10,
                            updated_at: 10,
                            model: Some("gpt-4.1".to_string()),
                            sender_instance_id: Some(DEFAULT_INSTANCE_ID.to_string()),
                            status: StudioConversationMessageStatus::Complete,
                        },
                        StudioConversationMessage {
                            id: "message-2".to_string(),
                            conversation_id: "stale-id".to_string(),
                            role: StudioConversationRole::Assistant,
                            content: "world".to_string(),
                            created_at: 11,
                            updated_at: 12,
                            model: Some("ironclaw".to_string()),
                            sender_instance_id: Some(remote.id.clone()),
                            status: StudioConversationMessageStatus::Complete,
                        },
                    ],
                },
            )
            .expect("store conversation");

        let built_in_view = service
            .list_conversations(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
            .expect("list built-in conversations");
        let remote_view = service
            .list_conversations(&paths, &config, &storage, &remote.id)
            .expect("list remote conversations");

        assert_eq!(stored.primary_instance_id, remote.id);
        assert_eq!(
            stored.participant_instance_ids,
            vec![remote.id.clone(), DEFAULT_INSTANCE_ID.to_string()]
        );
        assert_eq!(stored.messages[0].conversation_id, "conversation-1");
        assert_eq!(built_in_view.len(), 1);
        assert_eq!(remote_view.len(), 1);

        let deleted = service
            .delete_instance(&paths, &config, &storage, &remote.id)
            .expect("delete remote participant");
        let reassigned = service
            .list_conversations(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
            .expect("list reassigned conversations");

        assert!(deleted);
        assert_eq!(reassigned.len(), 1);
        assert_eq!(reassigned[0].primary_instance_id, DEFAULT_INSTANCE_ID);
        assert_eq!(
            reassigned[0].participant_instance_ids,
            vec![DEFAULT_INSTANCE_ID.to_string()]
        );
    }

    #[test]
    fn put_conversation_rejects_unknown_participants() {
        let (_root, paths, config, storage, service) = studio_context();

        let error = service
            .put_conversation(
                &paths,
                &config,
                &storage,
                StudioConversationRecord {
                    id: "conversation-invalid".to_string(),
                    title: "Invalid".to_string(),
                    primary_instance_id: DEFAULT_INSTANCE_ID.to_string(),
                    participant_instance_ids: vec!["missing-instance".to_string()],
                    created_at: 1,
                    updated_at: 1,
                    message_count: 0,
                    last_message_preview: None,
                    messages: Vec::new(),
                },
            )
            .expect_err("missing participant should fail");

        assert_eq!(error.to_string(), "not found: instance \"missing-instance\"");
    }

    #[test]
    fn built_in_instance_detail_reports_gateway_and_openai_http_endpoints() {
        let (_root, paths, config, storage, service) = studio_context();
        fs::write(
            &paths.openclaw_config_file,
            r#"{
  gateway: {
    port: 19876,
    auth: {
      mode: "token",
      token: "studio-token",
    },
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
  studio: {
    logLevel: "debug",
    corsOrigins: "http://localhost:3001",
    sandbox: true,
    autoUpdate: true,
  },
}
"#,
        )
        .expect("seed managed config");
        fs::write(
            paths.logs_dir.join("openclaw-gateway.log"),
            "gateway booted\nchat completions ready\n",
        )
        .expect("seed managed log");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
            .expect("load instance detail")
            .expect("built-in detail");

        assert_eq!(detail.instance.runtime_kind, StudioRuntimeKind::Openclaw);
        assert_eq!(detail.lifecycle.owner, StudioInstanceLifecycleOwner::AppManaged);
        assert!(detail.lifecycle.start_stop_supported);
        assert_eq!(detail.storage.provider, StorageProviderKind::LocalFile);
        assert!(detail
            .connectivity
            .endpoints
            .iter()
            .any(|endpoint| endpoint.id == "gateway-ws"
                && endpoint.url.as_deref() == Some("ws://127.0.0.1:19876")
                && endpoint.auth == StudioInstanceAuthMode::Token));
        assert!(detail
            .connectivity
            .endpoints
            .iter()
            .any(|endpoint| endpoint.id == "openai-http-chat"
                && endpoint.url.as_deref()
                    == Some("http://127.0.0.1:19876/v1/chat/completions")));
        assert!(detail.observability.log_available);
        assert!(detail
            .data_access
            .routes
            .iter()
            .any(|route| route.scope == StudioInstanceDataAccessScope::Config
                && route.mode == StudioInstanceDataAccessMode::ManagedFile
                && route.authoritative
                && route.target.as_deref()
                    == Some(paths.openclaw_config_file.to_string_lossy().as_ref())));
        assert!(detail
            .artifacts
            .iter()
            .any(|artifact| artifact.kind == StudioInstanceArtifactKind::WorkspaceDirectory
                && artifact.location.as_deref()
                    == Some(paths.openclaw_workspace_dir.to_string_lossy().as_ref())));
        assert!(detail
            .capabilities
            .iter()
            .any(|capability| capability.id == StudioInstanceCapability::Chat
                && capability.status == StudioInstanceCapabilityStatus::Ready));
    }

    #[test]
    fn built_in_instance_detail_includes_openclaw_workbench_sections() {
        let (_root, paths, config, storage, service) = studio_context();
        fs::write(
            &paths.openclaw_config_file,
            r#"{
  gateway: {
    port: 19876,
    auth: {
      mode: "token",
      token: "studio-token",
    },
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
  studio: {
    logLevel: "debug",
    corsOrigins: "http://localhost:3001",
    sandbox: true,
    autoUpdate: true,
  },
}
"#,
        )
        .expect("seed managed config");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
            .expect("load instance detail")
            .expect("built-in detail");
        let serialized = serde_json::to_value(&detail).expect("serialize detail");
        let workbench = serialized
            .get("workbench")
            .and_then(Value::as_object)
            .expect("detail should include workbench snapshot");

        for key in [
            "channels",
            "cronTasks",
            "llmProviders",
            "agents",
            "skills",
            "files",
            "memory",
            "tools",
        ] {
            assert!(
                workbench.contains_key(key),
                "expected workbench to include {key}"
            );
        }
    }

    #[test]
    fn built_in_instance_detail_includes_skills_from_configured_extra_dirs() {
        let (root, paths, config, storage, service) = studio_context();
        let extra_skills_dir = root.path().join("extra-skills");
        let skill_dir = extra_skills_dir.join("diagnostics-helper");
        fs::create_dir_all(&skill_dir).expect("create extra skill dir");
        fs::write(
            skill_dir.join("SKILL.md"),
            r#"---
name: diagnostics-helper
description: Inspects runtime diagnostics.
---

# Diagnostics Helper

Reads runtime diagnostics and summarizes them.
"#,
        )
        .expect("write extra skill");

        let extra_skills_path = extra_skills_dir.to_string_lossy().replace('\\', "\\\\");
        fs::write(
            &paths.openclaw_config_file,
            format!(
                r#"{{
  gateway: {{
    port: 19876,
    auth: {{
      mode: "token",
      token: "studio-token",
    }},
    http: {{
      endpoints: {{
        chatCompletions: {{ enabled: true }},
      }},
    }},
  }},
  skills: {{
    load: {{
      extraDirs: ["{}"],
    }},
  }},
}}
"#,
                extra_skills_path
            ),
        )
        .expect("seed managed config");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
            .expect("load instance detail")
            .expect("built-in detail");
        let workbench = detail.workbench.expect("detail workbench");

        assert!(workbench
            .skills
            .iter()
            .any(|skill| skill.id == "diagnostics-helper"));
    }

    #[test]
    fn built_in_openclaw_allows_writing_bootstrap_files_in_configured_agent_workspaces() {
        let (root, paths, config, storage, service) = studio_context();
        let reviewer_workspace = root.path().join("reviewer-workspace");
        fs::create_dir_all(&reviewer_workspace).expect("create reviewer workspace");

        let reviewer_agents_file = reviewer_workspace.join("AGENTS.md");
        fs::write(&reviewer_agents_file, "# reviewer\n").expect("seed reviewer bootstrap");

        let reviewer_workspace_path = reviewer_workspace.to_string_lossy().replace('\\', "\\\\");
        fs::write(
            &paths.openclaw_config_file,
            format!(
                r#"{{
  gateway: {{
    port: 19876,
    auth: {{
      mode: "token",
      token: "studio-token",
    }},
  }},
  agents: {{
    list: [
      {{
        id: "main",
        default: true,
      }},
      {{
        id: "reviewer",
        name: "Reviewer",
        workspace: "{}",
      }},
    ],
  }},
}}
"#,
                reviewer_workspace_path
            ),
        )
        .expect("seed managed config");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
            .expect("load instance detail")
            .expect("built-in detail");
        let workbench = detail.workbench.expect("detail workbench");
        let reviewer_agents_path = reviewer_agents_file.to_string_lossy().into_owned();
        let reviewer_file = workbench
            .files
            .iter()
            .find(|file| file.path == reviewer_agents_path)
            .expect("reviewer workspace file");

        assert!(
            !reviewer_file.is_readonly,
            "configured agent workspace bootstrap files should be writable"
        );

        service
            .update_instance_file_content(
                &paths,
                &config,
                &storage,
                DEFAULT_INSTANCE_ID,
                &reviewer_agents_path,
                "# reviewer updated\n",
            )
            .expect("update reviewer workspace bootstrap");

        assert_eq!(
            fs::read_to_string(&reviewer_agents_file).expect("read updated bootstrap"),
            "# reviewer updated\n"
        );
    }

    #[test]
    fn built_in_openclaw_task_controls_delegate_to_the_runtime_bridge() {
        let (_root, paths, config, storage, service) = studio_context();
        let supervisor = configured_openclaw_supervisor(&paths);

        fs::create_dir_all(paths.openclaw_state_dir.join("cron").join("runs"))
            .expect("cron run dir");
        fs::write(
            paths.openclaw_state_dir.join("cron").join("jobs.json"),
            r#"{
  "version": 1,
  "jobs": [
    {
      "id": "job-1",
      "name": "Nightly Review",
      "description": "Summarize overnight updates.",
      "enabled": true,
      "deleteAfterRun": false,
      "agentId": "main",
      "sessionKey": "agent:main:cron:job-1",
      "schedule": {
        "kind": "cron",
        "expr": "0 7 * * *",
        "tz": "Asia/Shanghai",
        "staggerMs": 0
      },
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Summarize overnight updates.",
        "model": "openai/gpt-5.4",
        "fallbacks": ["openai/gpt-5.3"],
        "thinking": "medium",
        "timeoutSeconds": 600,
        "lightContext": true
      },
      "delivery": {
        "mode": "announce",
        "channel": "telegram",
        "to": "123456",
        "accountId": "bot-default",
        "bestEffort": true
      },
      "failureAlert": false,
      "createdAtMs": 100,
      "updatedAtMs": 101,
      "state": {
        "nextRunAtMs": 200
      }
    }
  ]
}"#,
        )
        .expect("jobs store");
        fs::write(
            paths
                .openclaw_state_dir
                .join("cron")
                .join("runs")
                .join("job-1.jsonl"),
            r#"{"action":"finished","status":"ok","runAtMs":1700000000000,"ts":1700000005000,"summary":"Completed review."}
"#,
        )
        .expect("run log");

        service
            .clone_instance_task(
                &paths,
                &config,
                &storage,
                &supervisor,
                DEFAULT_INSTANCE_ID,
                "job-1",
                Some("Nightly Review Copy"),
            )
            .expect("clone task");
        let queued = service
            .run_instance_task_now(
                &paths,
                &config,
                &storage,
                &supervisor,
                DEFAULT_INSTANCE_ID,
                "job-1",
            )
            .expect("queue run");
        let executions = service
            .list_instance_task_executions(
                &paths,
                &config,
                &storage,
                DEFAULT_INSTANCE_ID,
                "job-1",
            )
            .expect("list executions");
        service
            .update_instance_task_status(
                &paths,
                &config,
                &storage,
                &supervisor,
                DEFAULT_INSTANCE_ID,
                "job-1",
                "paused",
            )
            .expect("pause task");
        let deleted = service
            .delete_instance_task(
                &paths,
                &config,
                &storage,
                &supervisor,
                DEFAULT_INSTANCE_ID,
                "job-1",
            )
            .expect("delete task");

        let captures = read_gateway_call_captures(&paths);
        assert_eq!(captures.len(), 4);
        assert_eq!(
            captures[0].get("method").and_then(Value::as_str),
            Some("cron.add")
        );
        assert_eq!(
            captures[1].get("method").and_then(Value::as_str),
            Some("cron.run")
        );
        assert_eq!(
            captures[2].get("method").and_then(Value::as_str),
            Some("cron.update")
        );
        assert_eq!(
            captures[3].get("method").and_then(Value::as_str),
            Some("cron.remove")
        );
        assert_eq!(queued.details.as_deref(), Some("runId=run-123"));
        assert_eq!(executions.len(), 1);
        assert_eq!(executions[0].summary, "Completed review.");
        assert!(deleted);
    }

    #[test]
    fn remote_instances_reject_runtime_backed_openclaw_task_controls() {
        let (_root, paths, config, storage, service) = studio_context();
        let supervisor = configured_openclaw_supervisor(&paths);
        let remote = service
            .create_instance(
                &paths,
                &config,
                &storage,
                StudioCreateInstanceInput {
                    name: "Zero Remote".to_string(),
                    description: Some("Remote ZeroClaw".to_string()),
                    runtime_kind: StudioRuntimeKind::Zeroclaw,
                    deployment_mode: StudioInstanceDeploymentMode::Remote,
                    transport_kind: StudioInstanceTransportKind::ZeroclawHttp,
                    icon_type: None,
                    version: Some("0.9.0".to_string()),
                    type_label: Some("Remote ZeroClaw".to_string()),
                    host: Some("zeroclaw.example.com".to_string()),
                    port: Some(8443),
                    base_url: Some("https://zeroclaw.example.com".to_string()),
                    websocket_url: Some("wss://zeroclaw.example.com/ws".to_string()),
                    storage: None,
                    config: None,
                },
            )
            .expect("create remote instance");

        let error = service
            .clone_instance_task(
                &paths,
                &config,
                &storage,
                &supervisor,
                &remote.id,
                "job-1",
                None,
            )
            .expect_err("remote runtime should be rejected");

        assert!(error
            .to_string()
            .contains("built-in managed OpenClaw instance"));
    }

    #[test]
    fn remote_openclaw_instance_detail_does_not_reuse_built_in_local_workbench() {
        let (_root, paths, config, storage, service) = studio_context();
        fs::write(
            &paths.openclaw_config_file,
            r#"{
  gateway: {
    port: 19876,
    auth: {
      mode: "token",
      token: "studio-token",
    },
  },
}
"#,
        )
        .expect("seed managed config");

        let remote = service
            .create_instance(
                &paths,
                &config,
                &storage,
                StudioCreateInstanceInput {
                    name: "OpenClaw Remote".to_string(),
                    description: Some("Remote OpenClaw gateway".to_string()),
                    runtime_kind: StudioRuntimeKind::Openclaw,
                    deployment_mode: StudioInstanceDeploymentMode::Remote,
                    transport_kind: StudioInstanceTransportKind::OpenclawGatewayWs,
                    icon_type: None,
                    version: Some("2026.3.13".to_string()),
                    type_label: Some("Remote OpenClaw".to_string()),
                    host: Some("openclaw.example.com".to_string()),
                    port: Some(18789),
                    base_url: Some("https://openclaw.example.com".to_string()),
                    websocket_url: Some("wss://openclaw.example.com/ws".to_string()),
                    storage: None,
                    config: Some(super::PartialStudioInstanceConfig {
                        base_url: Some("https://openclaw.example.com".to_string()),
                        websocket_url: Some("wss://openclaw.example.com/ws".to_string()),
                        port: Some("18789".to_string()),
                        auth_token: Some("remote-token".to_string()),
                        ..super::PartialStudioInstanceConfig::default()
                    }),
                },
            )
            .expect("create remote openclaw");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, &remote.id)
            .expect("load instance detail")
            .expect("remote openclaw detail");

        assert_eq!(detail.instance.runtime_kind, StudioRuntimeKind::Openclaw);
        assert_eq!(
            detail.instance.deployment_mode,
            StudioInstanceDeploymentMode::Remote
        );
        assert!(
            detail.workbench.is_none(),
            "remote OpenClaw detail should not reuse the built-in local workbench snapshot"
        );
    }

    #[test]
    fn zeroclaw_remote_instance_detail_reports_external_lifecycle_and_dashboard_endpoint() {
        let (_root, paths, config, storage, service) = studio_context();
        let remote = service
            .create_instance(
                &paths,
                &config,
                &storage,
                StudioCreateInstanceInput {
                    name: "Zero Remote".to_string(),
                    description: Some("Remote ZeroClaw gateway".to_string()),
                    runtime_kind: StudioRuntimeKind::Zeroclaw,
                    deployment_mode: StudioInstanceDeploymentMode::Remote,
                    transport_kind: StudioInstanceTransportKind::ZeroclawHttp,
                    icon_type: None,
                    version: Some("1.0.0".to_string()),
                    type_label: Some("ZeroClaw Remote".to_string()),
                    host: Some("zeroclaw.example.com".to_string()),
                    port: Some(42617),
                    base_url: Some("https://zeroclaw.example.com".to_string()),
                    websocket_url: Some("wss://zeroclaw.example.com/ws".to_string()),
                    storage: Some(super::PartialStudioStorageBinding {
                        provider: Some(StorageProviderKind::Postgres),
                        namespace: Some("studio.remote.zeroclaw".to_string()),
                        database: Some("claw_studio".to_string()),
                        connection_hint: Some("configured".to_string()),
                        endpoint: Some("postgresql://zeroclaw.example.com".to_string()),
                        ..super::PartialStudioStorageBinding::default()
                    }),
                    config: Some(super::PartialStudioInstanceConfig {
                        base_url: Some("https://zeroclaw.example.com".to_string()),
                        websocket_url: Some("wss://zeroclaw.example.com/ws".to_string()),
                        port: Some("42617".to_string()),
                        ..super::PartialStudioInstanceConfig::default()
                    }),
                },
            )
            .expect("create zeroclaw remote");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, &remote.id)
            .expect("load instance detail")
            .expect("zeroclaw detail");

        assert_eq!(detail.instance.runtime_kind, StudioRuntimeKind::Zeroclaw);
        assert_eq!(detail.lifecycle.owner, StudioInstanceLifecycleOwner::RemoteService);
        assert!(!detail.lifecycle.start_stop_supported);
        assert_eq!(detail.storage.provider, StorageProviderKind::Postgres);
        assert_eq!(
            detail.storage.status,
            StudioInstanceStorageStatus::Ready
        );
        assert!(detail
            .data_access
            .routes
            .iter()
            .any(|route| route.scope == StudioInstanceDataAccessScope::Tasks
                && route.mode == StudioInstanceDataAccessMode::RemoteEndpoint));
        assert!(detail
            .connectivity
            .endpoints
            .iter()
            .any(|endpoint| endpoint.id == "gateway-http"
                && endpoint.url.as_deref() == Some("https://zeroclaw.example.com")));
        assert!(detail
            .artifacts
            .iter()
            .any(|artifact| artifact.kind == StudioInstanceArtifactKind::Dashboard
                && artifact.location.as_deref() == Some("https://zeroclaw.example.com")));
        assert!(detail
            .official_runtime_notes
            .iter()
            .any(|note| note.title.contains("gateway") || note.title.contains("dashboard")));
    }

    #[test]
    fn ironclaw_remote_instance_detail_highlights_database_requirements() {
        let (_root, paths, config, storage, service) = studio_context();
        let remote = service
            .create_instance(
                &paths,
                &config,
                &storage,
                StudioCreateInstanceInput {
                    name: "Iron Remote".to_string(),
                    description: Some("Remote IronClaw".to_string()),
                    runtime_kind: StudioRuntimeKind::Ironclaw,
                    deployment_mode: StudioInstanceDeploymentMode::Remote,
                    transport_kind: StudioInstanceTransportKind::IronclawWeb,
                    icon_type: None,
                    version: Some("0.3.0".to_string()),
                    type_label: Some("IronClaw Remote".to_string()),
                    host: Some("ironclaw.example.com".to_string()),
                    port: Some(443),
                    base_url: Some("https://ironclaw.example.com".to_string()),
                    websocket_url: Some("wss://ironclaw.example.com/ws".to_string()),
                    storage: Some(super::PartialStudioStorageBinding {
                        provider: Some(StorageProviderKind::Postgres),
                        namespace: Some("studio.remote.ironclaw".to_string()),
                        database: Some("ironclaw".to_string()),
                        connection_hint: Some("configured".to_string()),
                        endpoint: Some("postgresql://ironclaw.example.com".to_string()),
                        ..super::PartialStudioStorageBinding::default()
                    }),
                    config: Some(super::PartialStudioInstanceConfig {
                        base_url: Some("https://ironclaw.example.com".to_string()),
                        websocket_url: Some("wss://ironclaw.example.com/ws".to_string()),
                        port: Some("443".to_string()),
                        ..super::PartialStudioInstanceConfig::default()
                    }),
                },
            )
            .expect("create ironclaw remote");

        let detail = service
            .get_instance_detail(&paths, &config, &storage, &remote.id)
            .expect("load instance detail")
            .expect("ironclaw detail");

        assert_eq!(detail.instance.runtime_kind, StudioRuntimeKind::Ironclaw);
        assert_eq!(detail.lifecycle.owner, StudioInstanceLifecycleOwner::RemoteService);
        assert!(detail.storage.queryable);
        assert!(detail.storage.transactional);
        assert!(detail
            .data_access
            .routes
            .iter()
            .any(|route| route.scope == StudioInstanceDataAccessScope::Memory
                && route.mode == StudioInstanceDataAccessMode::StorageBinding
                && route.authoritative
                && route.target.as_deref()
                    == Some("postgresql://ironclaw.example.com")));
        assert!(detail
            .artifacts
            .iter()
            .any(|artifact| artifact.kind == StudioInstanceArtifactKind::StorageBinding
                && artifact.location.as_deref()
                    == Some("postgresql://ironclaw.example.com")));
        assert!(detail
            .capabilities
            .iter()
            .any(|capability| capability.id == StudioInstanceCapability::Memory));
        assert!(detail
            .official_runtime_notes
            .iter()
            .any(|note| note.content.contains("PostgreSQL") || note.content.contains("pgvector")));
    }
}
