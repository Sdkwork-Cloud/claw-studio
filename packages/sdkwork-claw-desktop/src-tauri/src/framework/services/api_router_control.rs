use crate::framework::{
    services::api_router::{
        ApiRouterInstalledOpenClawInstance, ApiRouterInstallerOpenClawApiKeyStrategy,
        ApiRouterInstallerOpenClawOptions,
    },
    services::api_router_runtime::{ApiRouterHealthStatus, ApiRouterOwnershipMode, ApiRouterRuntimeService},
    FrameworkError, Result,
};
use getrandom::getrandom;
use rusqlite::{params, Connection};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
    sync::Arc,
    time::Duration,
};
use time::{
    format_description::{well_known::Rfc3339, FormatItem},
    macros::format_description,
    Date, OffsetDateTime, Time,
};

const CLAW_OVERLAY_FILE_NAME: &str = "control-plane.json";
const OVERLAY_VERSION: u32 = 1;
const DEFAULT_TENANT_ID: &str = "claw-studio";
const DEFAULT_TENANT_NAME: &str = "Claw Studio";
const DEFAULT_PROJECT_ENVIRONMENT: &str = "production";
const DEFAULT_GROUP_ID: &str = "shared-core";
const PRIMARY_CREDENTIAL_KEY_REFERENCE: &str = "api_key";
const MANAGED_API_KEY_PREFIX: &str = "sk-ar-v1-";
const WARNING_THRESHOLD_DAYS: i64 = 14;
const DATE_ONLY_FORMAT: &[FormatItem<'static>] = format_description!("[year]-[month]-[day]");

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterProviderQuery {
    pub channel_id: Option<String>,
    pub keyword: Option<String>,
    pub group_id: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterUnifiedApiKeyQuery {
    pub keyword: Option<String>,
    pub group_id: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterModelMappingQuery {
    pub keyword: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterUsageRecordsQuery {
    pub api_key_id: Option<String>,
    pub time_range: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<usize>,
    pub page_size: Option<usize>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterProviderModelInput {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterProxyProviderCreate {
    pub channel_id: String,
    pub name: String,
    pub api_key: String,
    pub group_id: String,
    pub base_url: String,
    pub models: Vec<ApiRouterProviderModelInput>,
    pub expires_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterProxyProviderUpdate {
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub group_id: Option<String>,
    #[serde(default)]
    pub expires_at: Option<Option<String>>,
    pub status: Option<String>,
    pub base_url: Option<String>,
    pub models: Option<Vec<ApiRouterProviderModelInput>>,
    #[serde(default)]
    pub notes: Option<Option<String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterUnifiedApiKeyCreate {
    pub name: String,
    pub group_id: String,
    pub api_key: Option<String>,
    pub source: Option<String>,
    pub expires_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterUnifiedApiKeyUpdate {
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub source: Option<String>,
    pub group_id: Option<String>,
    #[serde(default)]
    pub expires_at: Option<Option<String>>,
    pub status: Option<String>,
    #[serde(default)]
    pub model_mapping_id: Option<Option<String>>,
    #[serde(default)]
    pub notes: Option<Option<String>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterModelRef {
    pub channel_id: String,
    pub channel_name: String,
    pub model_id: String,
    pub model_name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterModelMappingRuleInput {
    pub id: Option<String>,
    pub source: ApiRouterModelRef,
    pub target: ApiRouterModelRef,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterModelMappingCreate {
    pub name: String,
    pub description: Option<String>,
    pub effective_from: String,
    pub effective_to: String,
    pub rules: Vec<ApiRouterModelMappingRuleInput>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterModelMappingUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub effective_from: Option<String>,
    pub effective_to: Option<String>,
    pub rules: Option<Vec<ApiRouterModelMappingRuleInput>>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct ControlPlaneOverlay {
    #[serde(default = "overlay_version")]
    version: u32,
    #[serde(default)]
    provider_locals: BTreeMap<String, ProviderLocal>,
    #[serde(default)]
    unified_key_locals: BTreeMap<String, UnifiedKeyLocal>,
    #[serde(default)]
    model_mappings: BTreeMap<String, StoredModelMapping>,
    #[serde(default)]
    openclaw_projects: BTreeMap<String, OpenClawProjectLocal>,
    #[serde(default)]
    openclaw_instances: BTreeMap<String, OpenClawInstanceLocal>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct ProviderLocal {
    #[serde(default = "default_group_id_string")]
    group_id: String,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    expires_at: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    model_names: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct UnifiedKeyLocal {
    #[serde(default = "default_group_id_string")]
    group_id: String,
    #[serde(default = "default_source_string")]
    source: String,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    model_mapping_id: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    plaintext_key: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct OpenClawProjectLocal {
    #[serde(default)]
    plaintext_key: Option<String>,
    #[serde(default = "default_openclaw_api_key_strategy")]
    api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
    #[serde(default)]
    last_installed_at: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct OpenClawInstanceLocal {
    #[serde(default)]
    project_id: String,
    #[serde(default = "default_openclaw_api_key_strategy")]
    api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
    #[serde(default)]
    selected_provider_id: Option<String>,
    #[serde(default)]
    model_mapping_id: Option<String>,
    #[serde(default)]
    last_installed_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredModelMapping {
    id: String,
    name: String,
    description: String,
    status: String,
    effective_from: String,
    effective_to: String,
    created_at: String,
    rules: Vec<StoredModelMappingRule>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredModelMappingRule {
    id: String,
    source: ApiRouterModelRef,
    target: ApiRouterModelRef,
}

#[derive(Clone, Debug)]
struct ProviderView {
    id: String,
    channel_id: String,
    name: String,
    api_key: String,
    group_id: String,
    request_count: u64,
    token_count: u64,
    spend_usd: f64,
    expires_at: Option<String>,
    status: String,
    created_at: String,
    base_url: String,
    models: Vec<ApiRouterProviderModelInput>,
    notes: Option<String>,
}

#[derive(Clone, Debug)]
struct UnifiedKeyView {
    id: String,
    name: String,
    api_key: String,
    source: String,
    group_id: String,
    request_count: u64,
    token_count: u64,
    spend_usd: f64,
    expires_at: Option<String>,
    status: String,
    created_at: String,
    model_mapping_id: Option<String>,
    notes: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct ChannelRow {
    id: String,
    name: String,
}

#[derive(Clone, Debug, Deserialize)]
struct ProviderRow {
    id: String,
    channel_id: String,
    base_url: String,
    display_name: String,
}

#[derive(Clone, Debug, Deserialize)]
struct ModelRow {
    external_name: String,
    provider_id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct CredentialRow {
    tenant_id: String,
    provider_id: String,
    key_reference: String,
}

#[derive(Clone, Debug, Deserialize)]
struct ProjectRow {
    id: String,
    name: String,
}

#[derive(Clone, Debug, Deserialize)]
struct GatewayApiKeyRow {
    tenant_id: String,
    project_id: String,
    environment: String,
    hashed_key: String,
    label: String,
    #[serde(default)]
    notes: Option<String>,
    created_at_ms: i64,
    #[serde(default)]
    last_used_at_ms: Option<i64>,
    #[serde(default)]
    expires_at_ms: Option<i64>,
    active: bool,
}

#[derive(Clone, Debug, Deserialize)]
struct UsageRow {
    project_id: String,
    model: String,
    #[serde(alias = "provider")]
    provider_id: String,
    units: i64,
    amount: f64,
    input_tokens: i64,
    output_tokens: i64,
    total_tokens: i64,
    created_at_ms: i64,
}

#[derive(Clone, Debug, Serialize)]
struct AdminProviderBindingRequest {
    channel_id: String,
    is_primary: bool,
}

#[derive(Clone, Debug, Serialize)]
struct AdminSaveProviderRequest {
    id: String,
    channel_id: String,
    adapter_kind: String,
    base_url: String,
    display_name: String,
    channel_bindings: Vec<AdminProviderBindingRequest>,
}

#[derive(Clone, Debug, Serialize)]
struct AdminSaveCredentialRequest {
    tenant_id: String,
    provider_id: String,
    key_reference: String,
    secret_value: String,
}

#[derive(Clone, Debug, Serialize)]
struct AdminSaveModelRequest {
    external_name: String,
    provider_id: String,
    capabilities: Vec<String>,
    streaming: bool,
    context_window: Option<u64>,
}

trait ApiRouterAdminClient: Send + Sync {
    fn list_channels(&self, token: &str) -> Result<Vec<ChannelRow>>;
    fn list_providers(&self, token: &str) -> Result<Vec<ProviderRow>>;
    fn list_credentials(&self, token: &str) -> Result<Vec<CredentialRow>>;
    fn list_models(&self, token: &str) -> Result<Vec<ModelRow>>;
    fn list_projects(&self, token: &str) -> Result<Vec<ProjectRow>>;
    fn list_api_keys(&self, token: &str) -> Result<Vec<GatewayApiKeyRow>>;
    fn list_usage_records(&self, token: &str) -> Result<Vec<UsageRow>>;
    fn save_provider(&self, token: &str, input: &AdminSaveProviderRequest) -> Result<()>;
    fn delete_provider(&self, token: &str, provider_id: &str) -> Result<()>;
    fn save_credential(&self, token: &str, input: &AdminSaveCredentialRequest) -> Result<()>;
    fn delete_credential(
        &self,
        token: &str,
        tenant_id: &str,
        provider_id: &str,
        key_reference: &str,
    ) -> Result<()>;
    fn save_model(&self, token: &str, input: &AdminSaveModelRequest) -> Result<()>;
    fn delete_model(&self, token: &str, external_name: &str, provider_id: &str) -> Result<()>;
}

#[derive(Clone, Debug)]
struct HttpApiRouterAdminClient {
    runtime: ApiRouterRuntimeService,
}

#[derive(Clone)]
pub struct ApiRouterControlService {
    runtime: ApiRouterRuntimeService,
    admin_client: Arc<dyn ApiRouterAdminClient>,
}

impl std::fmt::Debug for ApiRouterControlService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiRouterControlService").finish()
    }
}

impl ApiRouterControlService {
    pub fn new(runtime: ApiRouterRuntimeService) -> Self {
        let admin_client = Arc::new(HttpApiRouterAdminClient {
            runtime: runtime.clone(),
        });
        Self {
            runtime,
            admin_client,
        }
    }

    pub fn get_runtime_status(&self) -> Result<Value> {
        let snapshot = self.runtime.ensure_started_or_attached()?;
        let health = self.runtime.probe_health().unwrap_or(ApiRouterHealthStatus {
            admin_healthy: false,
            gateway_healthy: false,
        });
        let auth_session_ready = self.runtime.has_auth_session().unwrap_or(false);

        Ok(json!({
            "ownership": ownership_mode_to_value(&snapshot.ownership),
            "routerHomeDir": snapshot.router_home_dir.to_string_lossy(),
            "metadataDir": self.runtime.metadata_dir().to_string_lossy(),
            "databasePath": self.runtime.database_path().to_string_lossy(),
            "extractionDir": snapshot.extraction_dir.to_string_lossy(),
            "adminBaseUrl": self.runtime.admin_base_url(),
            "gatewayBaseUrl": self.runtime.gateway_base_url(),
            "adminHealthy": health.admin_healthy,
            "gatewayHealthy": health.gateway_healthy,
            "authSessionReady": auth_session_ready,
            "adminAuthReady": auth_session_ready && health.admin_healthy,
            "adminPid": snapshot.admin_pid,
            "gatewayPid": snapshot.gateway_pid,
        }))
    }

    pub fn provision_openclaw_instances(
        &self,
        input: &ApiRouterInstallerOpenClawOptions,
    ) -> Result<Vec<ApiRouterInstalledOpenClawInstance>> {
        validate_openclaw_install_options(input)?;

        if !self.runtime.has_auth_session()? {
            return Err(FrameworkError::Conflict(
                "desktop auth session is not available".to_string(),
            ));
        }

        let mut conn = self.open_connection()?;
        let mut overlay = self.load_overlay()?;
        let gateway_base_url = self.runtime.gateway_base_url();
        let selected_provider_id = normalize_optional_string(input.router_provider_id.as_deref());
        let model_mapping_id = normalize_optional_string(input.model_mapping_id.as_deref());

        if let Some(provider_id) = selected_provider_id.as_deref() {
            let provider_exists = load_provider_rows(&conn)?
                .into_iter()
                .any(|provider| provider.id == provider_id);
            if !provider_exists {
                return Err(FrameworkError::NotFound(format!("provider {provider_id}")));
            }
        }

        if let Some(model_mapping_id) = model_mapping_id.as_deref() {
            if !overlay.model_mappings.contains_key(model_mapping_id) {
                return Err(FrameworkError::NotFound(format!(
                    "model mapping {model_mapping_id}"
                )));
            }
        }

        let now_ms = now_epoch_millis()?;
        let installed_at = now_rfc3339()?;
        let tx = conn.transaction()?;
        upsert_tenant(&tx, DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME)?;

        let shared_project_id = build_openclaw_project_id(None, input.api_key_strategy);
        let mut project_keys = BTreeMap::<String, String>::new();
        let mut bindings = Vec::new();

        for instance_id in &input.instance_ids {
            let project_id = match input.api_key_strategy {
                ApiRouterInstallerOpenClawApiKeyStrategy::Shared => shared_project_id.clone(),
                ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => build_openclaw_project_id(
                    Some(instance_id.as_str()),
                    ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
                ),
            };

            let api_key = if let Some(existing) = project_keys.get(&project_id) {
                existing.clone()
            } else {
                let value = resolve_or_create_openclaw_project(
                    &tx,
                    &mut overlay,
                    project_id.as_str(),
                    instance_id.as_str(),
                    input.api_key_strategy,
                    now_ms,
                    installed_at.as_str(),
                )?;
                project_keys.insert(project_id.clone(), value.clone());
                value
            };

            if let Some(provider_id) = selected_provider_id.as_deref() {
                upsert_project_routing_preferences(
                    &tx,
                    project_id.as_str(),
                    provider_id,
                    now_ms,
                )?;
            } else {
                delete_project_routing_preferences(&tx, project_id.as_str())?;
            }

            overlay.openclaw_instances.insert(
                instance_id.clone(),
                OpenClawInstanceLocal {
                    project_id: project_id.clone(),
                    api_key_strategy: input.api_key_strategy,
                    selected_provider_id: selected_provider_id.clone(),
                    model_mapping_id: model_mapping_id.clone(),
                    last_installed_at: Some(installed_at.clone()),
                },
            );

            bindings.push(ApiRouterInstalledOpenClawInstance {
                instance_id: instance_id.clone(),
                endpoint: gateway_base_url.clone(),
                api_key,
                api_key_project_id: project_id,
                api_key_strategy: input.api_key_strategy,
                selected_provider_id: selected_provider_id.clone(),
                model_mapping_id: model_mapping_id.clone(),
            });
        }

        tx.commit()?;
        self.persist_overlay(&overlay)?;
        Ok(bindings)
    }

    pub fn get_channels(&self) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let mut overlay = self.load_overlay()?;
        let channels = self.admin_client.list_channels(&token)?;
        let providers = self.load_provider_views_from_admin(&token, &mut overlay, false)?;
        self.persist_overlay(&overlay)?;
        Ok(build_channel_values_with_catalog(&channels, &providers))
    }

    pub fn get_groups(&self) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        Ok(default_groups()
            .into_iter()
            .map(|(id, name, description)| {
                json!({
                    "id": id,
                    "name": name,
                    "description": description,
                })
            })
            .collect())
    }

    pub fn get_proxy_providers(&self, query: ApiRouterProviderQuery) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let mut overlay = self.load_overlay()?;
        let mut providers = self.load_provider_views_from_admin(&token, &mut overlay, true)?;
        self.persist_overlay(&overlay)?;

        providers.retain(|provider| provider_matches_query(provider, &query));
        Ok(providers.into_iter().map(provider_to_value).collect())
    }

    pub fn create_proxy_provider(&self, input: ApiRouterProxyProviderCreate) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        validate_provider_create(&input)?;
        let token = self.runtime.issue_admin_token()?.token;
        let provider_id = generate_id("provider");
        let normalized_models = normalize_provider_models(&input.models);

        self.admin_client.save_provider(
            &token,
            &AdminSaveProviderRequest {
                id: provider_id.clone(),
                channel_id: input.channel_id.trim().to_string(),
                adapter_kind: "openai".to_string(),
                base_url: input.base_url.trim().to_string(),
                display_name: input.name.trim().to_string(),
                channel_bindings: vec![AdminProviderBindingRequest {
                    channel_id: input.channel_id.trim().to_string(),
                    is_primary: true,
                }],
            },
        )?;
        self.admin_client.save_credential(
            &token,
            &AdminSaveCredentialRequest {
                tenant_id: DEFAULT_TENANT_ID.to_string(),
                provider_id: provider_id.clone(),
                key_reference: PRIMARY_CREDENTIAL_KEY_REFERENCE.to_string(),
                secret_value: input.api_key.trim().to_string(),
            },
        )?;
        for model in &normalized_models {
            self.admin_client.save_model(
                &token,
                &AdminSaveModelRequest {
                    external_name: model.id.clone(),
                    provider_id: provider_id.clone(),
                    capabilities: vec!["chat".to_string()],
                    streaming: true,
                    context_window: None,
                },
            )?;
        }

        let mut overlay = self.load_overlay()?;
        overlay.provider_locals.insert(
            provider_id.clone(),
            ProviderLocal {
                group_id: normalize_group_id(Some(input.group_id.as_str())),
                status: Some("active".to_string()),
                expires_at: input.expires_at.filter(|value| !value.trim().is_empty()),
                notes: normalize_optional_string(input.notes.as_deref()),
                api_key: Some(input.api_key.trim().to_string()),
                created_at: Some(now_rfc3339()?),
                model_names: normalized_models
                    .iter()
                    .map(|model| (model.id.clone(), model.name.clone()))
                    .collect(),
            },
        );
        self.persist_overlay(&overlay)?;

        let mut refreshed_overlay = self.load_overlay()?;
        let provider = self
            .load_provider_views_from_admin(&token, &mut refreshed_overlay, false)?
            .into_iter()
            .find(|item| item.id == provider_id)
            .ok_or_else(|| FrameworkError::NotFound("created provider".to_string()))?;
        self.persist_overlay(&refreshed_overlay)?;
        Ok(provider_to_value(provider))
    }

    pub fn update_proxy_provider_group(&self, id: &str, group_id: &str) -> Result<Value> {
        self.update_provider_local(id, |local| {
            local.group_id = normalize_group_id(Some(group_id));
        })
    }

    pub fn update_proxy_provider_status(&self, id: &str, status: &str) -> Result<Value> {
        validate_status_value(status)?;
        self.update_provider_local(id, |local| {
            local.status = Some(status.trim().to_string());
        })
    }

    pub fn update_proxy_provider(
        &self,
        id: &str,
        update: ApiRouterProxyProviderUpdate,
    ) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        let provider_id = id.trim();
        if provider_id.is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "provider id must not be empty".to_string(),
            ));
        }

        let token = self.runtime.issue_admin_token()?.token;
        let conn = self.open_connection()?;
        let existing_rows = load_provider_rows(&conn)?;
        let existing = existing_rows
            .into_iter()
            .find(|row| row.id == provider_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("provider {provider_id}")))?;
        let current_models = load_model_rows(&conn)?
            .into_iter()
            .filter(|row| row.provider_id == provider_id)
            .collect::<Vec<_>>();

        let next_models = update
            .models
            .as_ref()
            .map(|models| normalize_provider_models(models.as_slice()))
            .unwrap_or_else(|| {
                current_models
                    .iter()
                    .map(|row| ApiRouterProviderModelInput {
                        id: row.external_name.clone(),
                        name: row.external_name.clone(),
                    })
                    .collect()
            });

        self.admin_client.save_provider(
            &token,
            &AdminSaveProviderRequest {
                id: provider_id.to_string(),
                channel_id: existing.channel_id.clone(),
                adapter_kind: "openai".to_string(),
                base_url: update
                    .base_url
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .unwrap_or(existing.base_url.as_str())
                    .to_string(),
                display_name: update
                    .name
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .unwrap_or(existing.display_name.as_str())
                    .to_string(),
                channel_bindings: vec![AdminProviderBindingRequest {
                    channel_id: existing.channel_id.clone(),
                    is_primary: true,
                }],
            },
        )?;

        if let Some(api_key) = update.api_key.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            self.admin_client.save_credential(
                &token,
                &AdminSaveCredentialRequest {
                    tenant_id: DEFAULT_TENANT_ID.to_string(),
                    provider_id: provider_id.to_string(),
                    key_reference: PRIMARY_CREDENTIAL_KEY_REFERENCE.to_string(),
                    secret_value: api_key.to_string(),
                },
            )?;
        }

        let current_model_ids = current_models
            .iter()
            .map(|row| row.external_name.clone())
            .collect::<BTreeSet<_>>();
        let next_model_ids = next_models
            .iter()
            .map(|model| model.id.clone())
            .collect::<BTreeSet<_>>();

        for removed in current_model_ids.difference(&next_model_ids) {
            self.admin_client.delete_model(&token, removed, provider_id)?;
        }
        for model in &next_models {
            if !current_model_ids.contains(&model.id) || update.models.is_some() {
                self.admin_client.save_model(
                    &token,
                    &AdminSaveModelRequest {
                        external_name: model.id.clone(),
                        provider_id: provider_id.to_string(),
                        capabilities: vec!["chat".to_string()],
                        streaming: true,
                        context_window: None,
                    },
                )?;
            }
        }

        self.update_provider_local(provider_id, |local| {
            if let Some(group_id) = update.group_id.as_deref() {
                local.group_id = normalize_group_id(Some(group_id));
            }
            if let Some(status) = update.status.as_deref() {
                local.status = Some(status.trim().to_string());
            }
            if let Some(expires_at) = update.expires_at.as_ref() {
                local.expires_at =
                    expires_at.as_deref().and_then(|value| normalize_optional_string(Some(value)));
            }
            if let Some(notes) = update.notes.as_ref() {
                local.notes =
                    notes.as_deref().and_then(|value| normalize_optional_string(Some(value)));
            }
            if let Some(api_key) = update.api_key.as_deref() {
                local.api_key = normalize_optional_string(Some(api_key));
            }
            if update.models.is_some() {
                local.model_names = next_models
                    .iter()
                    .map(|model| (model.id.clone(), model.name.clone()))
                    .collect();
            }
        })
    }

    pub fn delete_proxy_provider(&self, id: &str) -> Result<bool> {
        self.runtime.ensure_started_or_attached()?;
        let provider_id = id.trim();
        if provider_id.is_empty() {
            return Ok(false);
        }

        let token = self.runtime.issue_admin_token()?.token;
        let conn = self.open_connection()?;
        for model in load_model_rows(&conn)?
            .into_iter()
            .filter(|row| row.provider_id == provider_id)
        {
            self.admin_client
                .delete_model(&token, &model.external_name, provider_id)?;
        }
        for credential in load_credential_rows(&conn)?
            .into_iter()
            .filter(|row| row.provider_id == provider_id)
        {
            self.admin_client.delete_credential(
                &token,
                &credential.tenant_id,
                provider_id,
                &credential.key_reference,
            )?;
        }
        self.admin_client.delete_provider(&token, provider_id)?;

        let mut overlay = self.load_overlay()?;
        overlay.provider_locals.remove(provider_id);
        self.persist_overlay(&overlay)?;
        Ok(true)
    }

    pub fn get_usage_record_api_keys(&self) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let mut overlay = self.load_overlay()?;
        let unified_keys = self.load_unified_key_views_from_admin(&token, &mut overlay, false)?;
        let projects = self.admin_client.list_projects(&token)?;
        self.persist_overlay(&overlay)?;

        let mut options = unified_keys
            .into_iter()
            .map(|item| {
                json!({
                    "id": item.id,
                    "label": item.name,
                })
            })
            .collect::<Vec<_>>();

        let seen_ids = options
            .iter()
            .filter_map(|value| value.get("id").and_then(Value::as_str).map(str::to_string))
            .collect::<BTreeSet<_>>();
        for project in projects {
            if !seen_ids.contains(&project.id) {
                options.push(json!({
                    "id": project.id,
                    "label": project.name,
                }));
            }
        }

        Ok(options)
    }

    pub fn get_usage_record_summary(&self, query: ApiRouterUsageRecordsQuery) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let rows = self.load_filtered_usage_rows(self.admin_client.list_usage_records(&token)?, &query)?;
        let project_names = BTreeMap::new();
        Ok(build_usage_summary_value(&rows, &project_names))
    }

    pub fn get_usage_records(&self, query: ApiRouterUsageRecordsQuery) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let projects = self.admin_client.list_projects(&token)?;
        let providers = self.admin_client.list_providers(&token)?;
        let project_names = project_name_lookup(&projects);
        let provider_names = provider_name_lookup(&providers);
        let mut rows = self.load_filtered_usage_rows(self.admin_client.list_usage_records(&token)?, &query)?;

        sort_usage_rows(&mut rows, query.sort_by.as_deref(), query.sort_order.as_deref());

        let page = query.page.unwrap_or(1).max(1);
        let page_size = query.page_size.unwrap_or(20).max(1);
        let total = rows.len();
        let start = (page - 1) * page_size;
        let end = start.saturating_add(page_size).min(total);
        let items = if start >= total {
            Vec::new()
        } else {
            rows[start..end]
                .iter()
                .enumerate()
                .map(|(index, row)| usage_row_to_value(row, &project_names, &provider_names, index))
                .collect()
        };

        Ok(json!({
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "hasMore": end < total,
        }))
    }

    pub fn get_unified_api_keys(&self, query: ApiRouterUnifiedApiKeyQuery) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let mut overlay = self.load_overlay()?;
        let mut items = self.load_unified_key_views_from_admin(&token, &mut overlay, true)?;
        self.persist_overlay(&overlay)?;

        items.retain(|item| unified_key_matches_query(item, &query));
        Ok(items.into_iter().map(unified_key_to_value).collect())
    }

    pub fn create_unified_api_key(&self, input: ApiRouterUnifiedApiKeyCreate) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        validate_unified_key_create(&input)?;
        let token = self.runtime.issue_admin_token()?.token;
        let now_ms = now_epoch_millis()?;
        let project_id = generate_id("project");
        let source = normalize_unified_key_source(input.source.as_deref());
        let plaintext_key = match source.as_str() {
            "custom" => input
                .api_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .ok_or_else(|| {
                    FrameworkError::ValidationFailed(
                        "custom unified api keys require an api key value".to_string(),
                    )
                })?,
            _ => generate_managed_api_key()?,
        };
        let hashed_key = sha256_hex(&plaintext_key);

        let mut conn = self.open_connection()?;
        let tx = conn.transaction()?;
        upsert_tenant(&tx, DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME)?;
        upsert_project(
            &tx,
            DEFAULT_TENANT_ID,
            &project_id,
            input.name.trim(),
        )?;
        upsert_gateway_api_key(
            &tx,
            &GatewayApiKeyRow {
                tenant_id: DEFAULT_TENANT_ID.to_string(),
                project_id: project_id.clone(),
                environment: DEFAULT_PROJECT_ENVIRONMENT.to_string(),
                hashed_key,
                label: input.name.trim().to_string(),
                notes: normalize_optional_string(input.notes.as_deref()),
                created_at_ms: now_ms,
                last_used_at_ms: None,
                expires_at_ms: parse_optional_iso_to_epoch_ms(input.expires_at.as_deref())?,
                active: true,
            },
        )?;
        tx.commit()?;

        let mut overlay = self.load_overlay()?;
        overlay.unified_key_locals.insert(
            project_id.clone(),
            UnifiedKeyLocal {
                group_id: normalize_group_id(Some(input.group_id.as_str())),
                source,
                status: Some("active".to_string()),
                model_mapping_id: None,
                notes: normalize_optional_string(input.notes.as_deref()),
                plaintext_key: Some(plaintext_key),
            },
        );
        self.persist_overlay(&overlay)?;

        let mut refreshed_overlay = self.load_overlay()?;
        let item = self
            .load_unified_key_views_from_admin(&token, &mut refreshed_overlay, false)?
            .into_iter()
            .find(|value| value.id == project_id)
            .ok_or_else(|| FrameworkError::NotFound("created unified api key".to_string()))?;
        self.persist_overlay(&refreshed_overlay)?;
        Ok(unified_key_to_value(item))
    }

    pub fn update_unified_api_key_group(&self, id: &str, group_id: &str) -> Result<Value> {
        self.update_unified_key_local(id, None, |local| {
            local.group_id = normalize_group_id(Some(group_id));
        })
    }

    pub fn update_unified_api_key_status(&self, id: &str, status: &str) -> Result<Value> {
        validate_status_value(status)?;
        let active = status != "disabled";
        self.update_unified_key_local(id, Some(active), |local| {
            local.status = Some(status.trim().to_string());
        })
    }

    pub fn assign_unified_api_key_model_mapping(
        &self,
        id: &str,
        model_mapping_id: Option<&str>,
    ) -> Result<Value> {
        let overlay = self.load_overlay()?;
        if let Some(mapping_id) = model_mapping_id {
            if !overlay.model_mappings.contains_key(mapping_id.trim()) {
                return Err(FrameworkError::NotFound(format!(
                    "model mapping {}",
                    mapping_id.trim()
                )));
            }
        }
        drop(overlay);

        self.update_unified_key_local(id, None, |local| {
            local.model_mapping_id = model_mapping_id.and_then(|value| normalize_optional_string(Some(value)));
        })
    }

    pub fn update_unified_api_key(
        &self,
        id: &str,
        update: ApiRouterUnifiedApiKeyUpdate,
    ) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let project_id = id.trim();
        if project_id.is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "unified api key id must not be empty".to_string(),
            ));
        }

        let mut conn = self.open_connection()?;
        let existing_keys = load_gateway_api_key_rows(&conn)?
            .into_iter()
            .filter(|row| row.project_id == project_id)
            .collect::<Vec<_>>();
        if existing_keys.is_empty() {
            return Err(FrameworkError::NotFound(format!("unified api key {project_id}")));
        }
        let current = existing_keys
            .iter()
            .max_by_key(|row| row.created_at_ms)
            .cloned()
            .ok_or_else(|| FrameworkError::NotFound(format!("unified api key {project_id}")))?;
        let mut overlay = self.load_overlay()?;
        let local = overlay
            .unified_key_locals
            .entry(project_id.to_string())
            .or_insert_with(|| default_unified_key_local(&current));

        let next_source = update
            .source
            .as_deref()
            .map(|value| normalize_unified_key_source(Some(value)))
            .unwrap_or_else(|| normalize_unified_key_source(Some(local.source.as_str())));
        let replacement_plaintext = if update.api_key.is_some() || update.source.is_some() {
            Some(match next_source.as_str() {
                "custom" => update
                    .api_key
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
                    .ok_or_else(|| {
                        FrameworkError::ValidationFailed(
                            "custom unified api keys require an api key value".to_string(),
                        )
                    })?,
                _ => generate_managed_api_key()?,
            })
        } else {
            None
        };

        let next_name = update
            .name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(current.label.as_str())
            .to_string();
        let next_expires_at_ms = match update.expires_at {
            Some(value) => parse_optional_iso_to_epoch_ms(value.as_deref())?,
            None => current.expires_at_ms,
        };
        let tx = conn.transaction()?;
        upsert_project(&tx, &current.tenant_id, project_id, &next_name)?;
        if let Some(plaintext) = replacement_plaintext.as_ref() {
            delete_gateway_api_keys_for_project(&tx, project_id)?;
            upsert_gateway_api_key(
                &tx,
                &GatewayApiKeyRow {
                    tenant_id: current.tenant_id.clone(),
                    project_id: project_id.to_string(),
                    environment: current.environment.clone(),
                    hashed_key: sha256_hex(plaintext),
                    label: next_name.clone(),
                    notes: update
                        .notes
                        .as_ref()
                        .map(|value| {
                            value
                                .as_deref()
                                .and_then(|raw| normalize_optional_string(Some(raw)))
                        })
                        .unwrap_or_else(|| local.notes.clone()),
                    created_at_ms: now_epoch_millis()?,
                    last_used_at_ms: None,
                    expires_at_ms: next_expires_at_ms,
                    active: update.status.as_deref().map(|value| value != "disabled").unwrap_or(current.active),
                },
            )?;
        } else {
            update_gateway_api_key_project_metadata(
                &tx,
                project_id,
                &next_name,
                update
                    .notes
                    .as_ref()
                    .map(|value| {
                        value
                            .as_deref()
                            .and_then(|raw| normalize_optional_string(Some(raw)))
                    })
                    .unwrap_or_else(|| local.notes.clone()),
                next_expires_at_ms,
                update
                    .status
                    .as_deref()
                    .map(|value| value != "disabled")
                    .unwrap_or(current.active),
            )?;
        }
        tx.commit()?;

        local.source = next_source;
        if let Some(group_id) = update.group_id.as_deref() {
            local.group_id = normalize_group_id(Some(group_id));
        }
        if let Some(status) = update.status.as_deref() {
            local.status = Some(status.trim().to_string());
        }
        if let Some(model_mapping_id) = update.model_mapping_id {
            local.model_mapping_id = model_mapping_id.and_then(|value| normalize_optional_string(Some(value.as_str())));
        }
        if let Some(notes) = update.notes {
            local.notes = notes.and_then(|value| normalize_optional_string(Some(value.as_str())));
        }
        if let Some(plaintext) = replacement_plaintext {
            local.plaintext_key = Some(plaintext);
        }
        self.persist_overlay(&overlay)?;

        let mut refreshed_overlay = self.load_overlay()?;
        let item = self
            .load_unified_key_views_from_admin(&token, &mut refreshed_overlay, false)?
            .into_iter()
            .find(|value| value.id == project_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("unified api key {project_id}")))?;
        self.persist_overlay(&refreshed_overlay)?;
        Ok(unified_key_to_value(item))
    }

    pub fn delete_unified_api_key(&self, id: &str) -> Result<bool> {
        self.runtime.ensure_started_or_attached()?;
        let project_id = id.trim();
        if project_id.is_empty() {
            return Ok(false);
        }

        let mut conn = self.open_connection()?;
        let existing = load_gateway_api_key_rows(&conn)?
            .into_iter()
            .any(|row| row.project_id == project_id);
        if !existing {
            return Ok(false);
        }

        let tx = conn.transaction()?;
        delete_gateway_api_keys_for_project(&tx, project_id)?;
        delete_project(&tx, project_id)?;
        tx.commit()?;

        let mut overlay = self.load_overlay()?;
        overlay.unified_key_locals.remove(project_id);
        self.persist_overlay(&overlay)?;
        Ok(true)
    }

    pub fn get_model_catalog(&self) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        let token = self.runtime.issue_admin_token()?.token;
        let mut overlay = self.load_overlay()?;
        let channels = self.admin_client.list_channels(&token)?;
        let providers = self.load_provider_views_from_admin(&token, &mut overlay, false)?;
        self.persist_overlay(&overlay)?;
        Ok(build_model_catalog_values_with_catalog(&channels, &providers))
    }

    pub fn get_model_mappings(&self, query: ApiRouterModelMappingQuery) -> Result<Vec<Value>> {
        self.runtime.ensure_started_or_attached()?;
        let overlay = self.load_overlay()?;
        let mut items = overlay.model_mappings.into_values().collect::<Vec<_>>();
        items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        items.retain(|item| model_mapping_matches_query(item, &query));
        Ok(items.into_iter().map(model_mapping_to_value).collect())
    }

    pub fn create_model_mapping(&self, input: ApiRouterModelMappingCreate) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        validate_model_mapping_create(&input)?;
        let mapping = StoredModelMapping {
            id: generate_id("model-mapping"),
            name: input.name.trim().to_string(),
            description: input.description.unwrap_or_default().trim().to_string(),
            status: "active".to_string(),
            effective_from: input.effective_from,
            effective_to: input.effective_to,
            created_at: now_rfc3339()?,
            rules: input
                .rules
                .into_iter()
                .map(|rule| StoredModelMappingRule {
                    id: rule
                        .id
                        .filter(|value| !value.trim().is_empty())
                        .unwrap_or_else(|| generate_id("model-mapping-rule")),
                    source: rule.source,
                    target: rule.target,
                })
                .collect(),
        };

        let mut overlay = self.load_overlay()?;
        overlay
            .model_mappings
            .insert(mapping.id.clone(), mapping.clone());
        self.persist_overlay(&overlay)?;
        Ok(model_mapping_to_value(mapping))
    }

    pub fn update_model_mapping(
        &self,
        id: &str,
        update: ApiRouterModelMappingUpdate,
    ) -> Result<Value> {
        self.runtime.ensure_started_or_attached()?;
        let mapping_id = id.trim();
        let mut overlay = self.load_overlay()?;
        let mapping = overlay
            .model_mappings
            .get_mut(mapping_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("model mapping {mapping_id}")))?;

        if let Some(name) = update.name.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            mapping.name = name.to_string();
        }
        if let Some(description) = update.description {
            mapping.description = description.trim().to_string();
        }
        if let Some(status) = update.status.as_deref() {
            validate_status_value(status)?;
            mapping.status = status.trim().to_string();
        }
        if let Some(effective_from) = update.effective_from {
            mapping.effective_from = effective_from;
        }
        if let Some(effective_to) = update.effective_to {
            mapping.effective_to = effective_to;
        }
        if let Some(rules) = update.rules {
            mapping.rules = rules
                .into_iter()
                .map(|rule| StoredModelMappingRule {
                    id: rule
                        .id
                        .filter(|value| !value.trim().is_empty())
                        .unwrap_or_else(|| generate_id("model-mapping-rule")),
                    source: rule.source,
                    target: rule.target,
                })
                .collect();
        }

        let value = model_mapping_to_value(mapping.clone());
        self.persist_overlay(&overlay)?;
        Ok(value)
    }

    pub fn update_model_mapping_status(&self, id: &str, status: &str) -> Result<Value> {
        self.update_model_mapping(
            id,
            ApiRouterModelMappingUpdate {
                status: Some(status.trim().to_string()),
                ..ApiRouterModelMappingUpdate::default()
            },
        )
    }

    pub fn delete_model_mapping(&self, id: &str) -> Result<bool> {
        self.runtime.ensure_started_or_attached()?;
        let mapping_id = id.trim();
        let mut overlay = self.load_overlay()?;
        let removed = overlay.model_mappings.remove(mapping_id).is_some();
        if !removed {
            return Ok(false);
        }
        for local in overlay.unified_key_locals.values_mut() {
            if local.model_mapping_id.as_deref() == Some(mapping_id) {
                local.model_mapping_id = None;
            }
        }
        self.persist_overlay(&overlay)?;
        Ok(true)
    }

    fn update_provider_local<F>(&self, id: &str, mut apply: F) -> Result<Value>
    where
        F: FnMut(&mut ProviderLocal),
    {
        self.runtime.ensure_started_or_attached()?;
        let provider_id = id.trim();
        let conn = self.open_connection()?;
        let provider_exists = load_provider_rows(&conn)?
            .into_iter()
            .any(|row| row.id == provider_id);
        if !provider_exists {
            return Err(FrameworkError::NotFound(format!("provider {provider_id}")));
        }

        let mut overlay = self.load_overlay()?;
        let local = overlay
            .provider_locals
            .entry(provider_id.to_string())
            .or_insert_with(default_provider_local);
        apply(local);
        self.persist_overlay(&overlay)?;

        let token = self.runtime.issue_admin_token()?.token;
        let mut refreshed_overlay = self.load_overlay()?;
        let provider = self
            .load_provider_views_from_admin(&token, &mut refreshed_overlay, false)?
            .into_iter()
            .find(|item| item.id == provider_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("provider {provider_id}")))?;
        self.persist_overlay(&refreshed_overlay)?;
        Ok(provider_to_value(provider))
    }

    fn update_unified_key_local<F>(&self, id: &str, active: Option<bool>, mut apply: F) -> Result<Value>
    where
        F: FnMut(&mut UnifiedKeyLocal),
    {
        self.runtime.ensure_started_or_attached()?;
        let project_id = id.trim();
        let mut conn = self.open_connection()?;
        let existing_keys = load_gateway_api_key_rows(&conn)?
            .into_iter()
            .filter(|row| row.project_id == project_id)
            .collect::<Vec<_>>();
        let current = existing_keys
            .into_iter()
            .max_by_key(|row| row.created_at_ms)
            .ok_or_else(|| FrameworkError::NotFound(format!("unified api key {project_id}")))?;

        if let Some(next_active) = active {
            let tx = conn.transaction()?;
            update_gateway_api_key_project_metadata(
                &tx,
                project_id,
                &current.label,
                current.notes.clone(),
                current.expires_at_ms,
                next_active,
            )?;
            tx.commit()?;
        }

        let mut overlay = self.load_overlay()?;
        let local = overlay
            .unified_key_locals
            .entry(project_id.to_string())
            .or_insert_with(|| default_unified_key_local(&current));
        apply(local);
        self.persist_overlay(&overlay)?;

        let token = self.runtime.issue_admin_token()?.token;
        let mut refreshed_overlay = self.load_overlay()?;
        let item = self
            .load_unified_key_views_from_admin(&token, &mut refreshed_overlay, false)?
            .into_iter()
            .find(|value| value.id == project_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("unified api key {project_id}")))?;
        self.persist_overlay(&refreshed_overlay)?;
        Ok(unified_key_to_value(item))
    }
}

fn overlay_version() -> u32 {
    OVERLAY_VERSION
}

fn default_group_id_string() -> String {
    DEFAULT_GROUP_ID.to_string()
}

fn default_source_string() -> String {
    "system-generated".to_string()
}

fn default_openclaw_api_key_strategy() -> ApiRouterInstallerOpenClawApiKeyStrategy {
    ApiRouterInstallerOpenClawApiKeyStrategy::Shared
}

impl ApiRouterControlService {
    fn open_connection(&self) -> Result<Connection> {
        let database_path = self.runtime.database_path();
        if let Some(parent) = database_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(database_path)?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(|error| FrameworkError::Internal(error.to_string()))?;
        ensure_required_tables(&conn)?;
        ensure_default_channels(&conn)?;
        Ok(conn)
    }

    fn load_overlay(&self) -> Result<ControlPlaneOverlay> {
        let overlay_path = self.overlay_path();
        if !overlay_path.is_file() {
            return Ok(ControlPlaneOverlay::default());
        }

        let content = fs::read_to_string(overlay_path)?;
        let mut overlay: ControlPlaneOverlay = serde_json::from_str(&content)?;
        if overlay.version == 0 {
            overlay.version = OVERLAY_VERSION;
        }
        Ok(overlay)
    }

    fn persist_overlay(&self, overlay: &ControlPlaneOverlay) -> Result<()> {
        let overlay_path = self.overlay_path();
        if let Some(parent) = overlay_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let temp_path = overlay_path.with_extension("json.tmp");
        let content = serde_json::to_string_pretty(overlay)?;
        fs::write(&temp_path, content)?;
        if overlay_path.is_file() {
            fs::remove_file(&overlay_path)?;
        }
        fs::rename(temp_path, overlay_path)?;
        Ok(())
    }

    fn overlay_path(&self) -> PathBuf {
        self.runtime.metadata_dir().join(CLAW_OVERLAY_FILE_NAME)
    }

    fn load_provider_views_from_admin(
        &self,
        token: &str,
        overlay: &mut ControlPlaneOverlay,
        include_usage: bool,
    ) -> Result<Vec<ProviderView>> {
        let providers = self.admin_client.list_providers(token)?;
        let models = self.admin_client.list_models(token)?;
        let credentials = self.admin_client.list_credentials(token)?;
        let usage_by_provider = if include_usage {
            aggregate_provider_usage(self.admin_client.list_usage_records(token)?)
        } else {
            BTreeMap::new()
        };
        self.load_provider_views(
            providers.as_slice(),
            models.as_slice(),
            credentials.as_slice(),
            &usage_by_provider,
            overlay,
        )
    }

    fn load_provider_views(
        &self,
        providers: &[ProviderRow],
        models: &[ModelRow],
        credentials: &[CredentialRow],
        usage_by_provider: &BTreeMap<String, (u64, u64, f64)>,
        overlay: &mut ControlPlaneOverlay,
    ) -> Result<Vec<ProviderView>> {
        let mut changed = false;
        let views = providers
            .iter()
            .map(|provider| {
                let provider_models = models
                    .iter()
                    .filter(|row| row.provider_id == provider.id)
                    .map(|row| ApiRouterProviderModelInput {
                        id: row.external_name.clone(),
                        name: overlay
                            .provider_locals
                            .get(&provider.id)
                            .and_then(|local| local.model_names.get(&row.external_name))
                            .cloned()
                            .unwrap_or_else(|| row.external_name.clone()),
                    })
                    .collect::<Vec<_>>();

                let credential_present = credentials.iter().any(|row| row.provider_id == provider.id);
                let local = overlay
                    .provider_locals
                    .entry(provider.id.clone())
                    .or_insert_with(|| {
                        changed = true;
                        ProviderLocal {
                            group_id: DEFAULT_GROUP_ID.to_string(),
                            status: Some(if credential_present {
                                "active".to_string()
                            } else {
                                "warning".to_string()
                            }),
                            expires_at: None,
                            notes: None,
                            api_key: None,
                            created_at: Some(now_rfc3339().unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())),
                            model_names: provider_models
                                .iter()
                                .map(|model| (model.id.clone(), model.name.clone()))
                                .collect(),
                        }
                    });

                for model in &provider_models {
                    if !local.model_names.contains_key(&model.id) {
                        local.model_names.insert(model.id.clone(), model.name.clone());
                        changed = true;
                    }
                }

                let usage = usage_by_provider
                    .get(&provider.id)
                    .cloned()
                    .unwrap_or_default();
                ProviderView {
                    id: provider.id.clone(),
                    channel_id: provider.channel_id.clone(),
                    name: provider.display_name.clone(),
                    api_key: local.api_key.clone().unwrap_or_default(),
                    group_id: normalize_group_id(Some(local.group_id.as_str())),
                    request_count: usage.0,
                    token_count: usage.1,
                    spend_usd: usage.2,
                    expires_at: local.expires_at.clone(),
                    status: effective_status(local.status.as_deref(), local.expires_at.as_deref()),
                    created_at: local
                        .created_at
                        .clone()
                        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string()),
                    base_url: provider.base_url.clone(),
                    models: provider_models,
                    notes: local.notes.clone(),
                }
            })
            .collect::<Vec<_>>();

        let _ = changed;
        Ok(views)
    }

    fn load_unified_key_views_from_admin(
        &self,
        token: &str,
        overlay: &mut ControlPlaneOverlay,
        include_usage: bool,
    ) -> Result<Vec<UnifiedKeyView>> {
        let projects = self.admin_client.list_projects(token)?;
        let gateway_keys = self.admin_client.list_api_keys(token)?;
        let usage_by_project = if include_usage {
            aggregate_project_usage(self.admin_client.list_usage_records(token)?)
        } else {
            BTreeMap::new()
        };
        self.load_unified_key_views(
            projects.as_slice(),
            gateway_keys.as_slice(),
            &usage_by_project,
            overlay,
        )
    }

    fn load_unified_key_views(
        &self,
        projects: &[ProjectRow],
        gateway_keys: &[GatewayApiKeyRow],
        usage_by_project: &BTreeMap<String, (u64, u64, f64)>,
        overlay: &mut ControlPlaneOverlay,
    ) -> Result<Vec<UnifiedKeyView>> {
        let mut latest_key_by_project = BTreeMap::<String, GatewayApiKeyRow>::new();

        for key in gateway_keys.iter().cloned() {
            match latest_key_by_project.get(&key.project_id) {
                Some(current) if current.created_at_ms >= key.created_at_ms => {}
                _ => {
                    latest_key_by_project.insert(key.project_id.clone(), key);
                }
            }
        }

        let mut changed = false;
        let mut views = Vec::new();
        for (project_id, row) in latest_key_by_project {
            let project_name = projects
                .iter()
                .find(|project| project.id == project_id)
                .map(|project| project.name.clone())
                .unwrap_or_else(|| row.label.clone());
            let local = overlay
                .unified_key_locals
                .entry(project_id.clone())
                .or_insert_with(|| {
                    changed = true;
                    default_unified_key_local(&row)
                });
            let usage = usage_by_project
                .get(&project_id)
                .cloned()
                .unwrap_or_default();
            views.push(UnifiedKeyView {
                id: project_id,
                name: project_name,
                api_key: local.plaintext_key.clone().unwrap_or_default(),
                source: normalize_unified_key_source(Some(local.source.as_str())),
                group_id: normalize_group_id(Some(local.group_id.as_str())),
                request_count: usage.0,
                token_count: usage.1,
                spend_usd: usage.2,
                expires_at: epoch_ms_to_iso(row.expires_at_ms),
                status: if !row.active {
                    "disabled".to_string()
                } else {
                    effective_status(local.status.as_deref(), epoch_ms_to_iso(row.expires_at_ms).as_deref())
                },
                created_at: epoch_ms_to_iso(Some(row.created_at_ms))
                    .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string()),
                model_mapping_id: local.model_mapping_id.clone(),
                notes: local.notes.clone().or(row.notes.clone()),
            });
        }

        let _ = changed;
        views.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        Ok(views)
    }

    fn load_filtered_usage_rows(
        &self,
        mut rows: Vec<UsageRow>,
        query: &ApiRouterUsageRecordsQuery,
    ) -> Result<Vec<UsageRow>> {
        if let Some(api_key_id) = query
            .api_key_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty() && *value != "all")
        {
            rows.retain(|row| row.project_id == api_key_id);
        }

        if let Some((start_ms, end_ms)) = resolve_usage_time_range(query)? {
            rows.retain(|row| row.created_at_ms >= start_ms && row.created_at_ms <= end_ms);
        }

        Ok(rows)
    }
}

impl ApiRouterAdminClient for HttpApiRouterAdminClient {
    fn list_channels(&self, token: &str) -> Result<Vec<ChannelRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/channels",
        )
    }

    fn list_providers(&self, token: &str) -> Result<Vec<ProviderRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/providers",
        )
    }

    fn list_credentials(&self, token: &str) -> Result<Vec<CredentialRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/credentials",
        )
    }

    fn list_models(&self, token: &str) -> Result<Vec<ModelRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/models",
        )
    }

    fn list_projects(&self, token: &str) -> Result<Vec<ProjectRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/projects",
        )
    }

    fn list_api_keys(&self, token: &str) -> Result<Vec<GatewayApiKeyRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/api-keys",
        )
    }

    fn list_usage_records(&self, token: &str) -> Result<Vec<UsageRow>> {
        get_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/usage/records",
        )
    }

    fn save_provider(&self, token: &str, input: &AdminSaveProviderRequest) -> Result<()> {
        post_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/providers",
            input,
        )
    }

    fn delete_provider(&self, token: &str, provider_id: &str) -> Result<()> {
        delete_admin(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            &format!("/providers/{}", urlencoding::encode(provider_id)),
        )
    }

    fn save_credential(&self, token: &str, input: &AdminSaveCredentialRequest) -> Result<()> {
        post_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/credentials",
            input,
        )
    }

    fn delete_credential(
        &self,
        token: &str,
        tenant_id: &str,
        provider_id: &str,
        key_reference: &str,
    ) -> Result<()> {
        delete_admin(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            &format!(
                "/credentials/{}/providers/{}/keys/{}",
                urlencoding::encode(tenant_id),
                urlencoding::encode(provider_id),
                urlencoding::encode(key_reference),
            ),
        )
    }

    fn save_model(&self, token: &str, input: &AdminSaveModelRequest) -> Result<()> {
        post_admin_json(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            "/models",
            input,
        )
    }

    fn delete_model(&self, token: &str, external_name: &str, provider_id: &str) -> Result<()> {
        delete_admin(
            self.runtime.admin_base_url().trim_end_matches('/'),
            token,
            &format!(
                "/models/{}/providers/{}",
                urlencoding::encode(external_name),
                urlencoding::encode(provider_id),
            ),
        )
    }
}

fn post_admin_json<T: Serialize>(base_url: &str, token: &str, path: &str, body: &T) -> Result<()> {
    let request_body =
        serde_json::to_value(body).map_err(|error| FrameworkError::Internal(error.to_string()))?;
    ureq::post(&format!("{base_url}{path}"))
        .set("authorization", &format!("Bearer {token}"))
        .set("content-type", "application/json")
        .send_json(request_body)
        .map(|_| ())
        .map_err(map_ureq_error)
}

fn get_admin_json<T: DeserializeOwned>(base_url: &str, token: &str, path: &str) -> Result<T> {
    let response = ureq::get(&format!("{base_url}{path}"))
        .set("authorization", &format!("Bearer {token}"))
        .call()
        .map_err(map_ureq_error)?;
    let body = response
        .into_string()
        .map_err(|error| FrameworkError::Internal(format!("failed to read admin api response: {error}")))?;
    serde_json::from_str(&body)
        .map_err(|error| FrameworkError::Internal(format!("failed to decode admin api response: {error}")))
}

fn delete_admin(base_url: &str, token: &str, path: &str) -> Result<()> {
    ureq::delete(&format!("{base_url}{path}"))
        .set("authorization", &format!("Bearer {token}"))
        .call()
        .map(|_| ())
        .map_err(map_ureq_error)
}

fn map_ureq_error(error: ureq::Error) -> FrameworkError {
    match error {
        ureq::Error::Status(status, response) => {
            let message = response.into_string().unwrap_or_else(|_| "admin request failed".to_string());
            FrameworkError::Internal(format!("admin api request failed with status {status}: {message}"))
        }
        ureq::Error::Transport(transport) => {
            FrameworkError::Internal(format!("admin api transport error: {transport}"))
        }
    }
}

fn ensure_required_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS tenant_records (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tenant_projects (
            id TEXT PRIMARY KEY NOT NULL,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS catalog_channels (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS catalog_proxy_providers (
            id TEXT PRIMARY KEY NOT NULL,
            channel_id TEXT NOT NULL,
            extension_id TEXT NOT NULL DEFAULT '',
            adapter_kind TEXT NOT NULL DEFAULT 'openai',
            base_url TEXT NOT NULL DEFAULT 'http://localhost',
            display_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS catalog_provider_channel_bindings (
            provider_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            is_primary INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (provider_id, channel_id)
        );
        CREATE TABLE IF NOT EXISTS credential_records (
            tenant_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            key_reference TEXT NOT NULL,
            secret_backend TEXT NOT NULL DEFAULT 'database_encrypted',
            secret_local_file TEXT,
            secret_keyring_service TEXT,
            secret_master_key_id TEXT,
            secret_ciphertext TEXT,
            secret_key_version INTEGER,
            PRIMARY KEY (tenant_id, provider_id, key_reference)
        );
        CREATE TABLE IF NOT EXISTS catalog_models (
            external_name TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            capabilities TEXT NOT NULL DEFAULT '[]',
            streaming INTEGER NOT NULL DEFAULT 0,
            context_window INTEGER,
            PRIMARY KEY (external_name, provider_id)
        );
        CREATE TABLE IF NOT EXISTS usage_records (
            project_id TEXT NOT NULL,
            model TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            units INTEGER NOT NULL DEFAULT 0,
            amount REAL NOT NULL DEFAULT 0,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0,
            created_at_ms INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS identity_gateway_api_keys (
            hashed_key TEXT PRIMARY KEY NOT NULL,
            tenant_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            environment TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT '',
            notes TEXT,
            created_at_ms INTEGER NOT NULL DEFAULT 0,
            last_used_at_ms INTEGER,
            expires_at_ms INTEGER,
            active INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS project_routing_preferences (
            project_id TEXT PRIMARY KEY NOT NULL,
            preset_id TEXT NOT NULL DEFAULT '',
            strategy TEXT NOT NULL DEFAULT 'deterministic_priority',
            ordered_provider_ids_json TEXT NOT NULL DEFAULT '[]',
            default_provider_id TEXT,
            max_cost REAL,
            max_latency_ms INTEGER,
            require_healthy INTEGER NOT NULL DEFAULT 0,
            preferred_region TEXT,
            updated_at_ms INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn ensure_default_channels(conn: &Connection) -> Result<()> {
    for (id, name, _, _) in default_channel_catalog() {
        conn.execute(
            "INSERT INTO catalog_channels (id, name) VALUES (?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name",
            params![id, name],
        )
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    }
    Ok(())
}

fn ownership_mode_to_value(mode: &ApiRouterOwnershipMode) -> &'static str {
    match mode {
        ApiRouterOwnershipMode::Uninitialized => "uninitialized",
        ApiRouterOwnershipMode::Attached => "attached",
        ApiRouterOwnershipMode::Managed => "managed",
        ApiRouterOwnershipMode::Stopped => "stopped",
    }
}

fn default_groups() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        (
            "team-ops",
            "Ops Routing",
            "Production-grade providers used by operator workflows and automations.",
        ),
        (
            "shared-core",
            "Shared Core",
            "Shared team pool for chat, experiments, and cross-workspace use.",
        ),
        (
            "client-vip",
            "Client VIP",
            "Premium routes reserved for latency-sensitive or SLA-backed traffic.",
        ),
        (
            "sandbox-lab",
            "Sandbox Lab",
            "Disposable or low-risk providers for experiments and feature validation.",
        ),
    ]
}

fn default_channel_catalog() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        ("openai", "OpenAI", "OpenAI", "GPT-4.1 / o-series"),
        ("anthropic", "Anthropic", "Anthropic", "Claude 3.7 / 4"),
        ("google", "Google", "Google DeepMind", "Gemini 2.x"),
        ("xai", "xAI", "xAI", "Grok 2 / 3"),
        ("meta", "Meta", "Meta AI", "Llama 4 / Llama 3"),
        ("mistral", "Mistral", "Mistral AI", "Mistral Large / Codestral"),
        ("cohere", "Cohere", "Cohere", "Command / Embed"),
        (
            "amazon-nova",
            "Amazon Nova",
            "Amazon Web Services",
            "Nova Pro / Nova Micro",
        ),
        ("microsoft", "Microsoft", "Microsoft AI", "Phi / MAI"),
        ("nvidia", "NVIDIA", "NVIDIA", "Nemotron / NIM"),
        ("deepseek", "DeepSeek", "DeepSeek", "DeepSeek V3 / R1"),
        ("qwen", "Qwen", "Alibaba Cloud", "Qwen 2.5 / QwQ"),
        ("zhipu", "Zhipu", "Zhipu AI", "GLM-4.x"),
        ("baidu", "Baidu", "Baidu AI Cloud", "ERNIE / X1"),
        (
            "tencent-hunyuan",
            "Tencent Hunyuan",
            "Tencent Cloud",
            "Hunyuan Turbo / T1",
        ),
        ("doubao", "Doubao", "ByteDance", "Doubao / Seed"),
        ("moonshot", "Moonshot AI", "Moonshot AI", "Kimi / K1"),
        ("minimax", "MiniMax", "MiniMax", "MiniMax Text / M1"),
        ("stepfun", "StepFun", "StepFun", "Step / Step-R"),
        ("sensenova", "SenseNova", "SenseTime", "SenseChat / SenseNova"),
        (
            "baichuan",
            "Baichuan",
            "Baichuan Intelligence",
            "Baichuan 4 / M1",
        ),
        ("yi", "Yi", "01.AI", "Yi / Yi Vision"),
        ("iflytek-spark", "iFlytek Spark", "iFlytek", "Spark / Xinghuo"),
        (
            "huawei-pangu",
            "Huawei Pangu",
            "Huawei Cloud",
            "Pangu / Pangu Pro",
        ),
    ]
}

#[cfg(test)]
fn build_channel_values(providers: &[ProviderView]) -> Vec<Value> {
    build_channel_values_with_catalog(&[], providers)
}

fn build_channel_values_with_catalog(channels: &[ChannelRow], providers: &[ProviderView]) -> Vec<Value> {
    resolved_channel_catalog(channels, providers)
        .into_iter()
        .map(|(id, name, vendor, model_family)| {
            let channel_providers = providers
                .iter()
                .filter(|provider| provider.channel_id == id)
                .collect::<Vec<_>>();

            json!({
                "id": id,
                "name": name,
                "vendor": vendor,
                "description": format!("{vendor} routed channel"),
                "modelFamily": model_family,
                "providerCount": channel_providers.len(),
                "activeProviderCount": channel_providers
                    .iter()
                    .filter(|provider| provider.status == "active")
                    .count(),
                "warningProviderCount": channel_providers
                    .iter()
                    .filter(|provider| provider.status == "warning" || provider.status == "expired")
                    .count(),
                "disabledProviderCount": channel_providers
                    .iter()
                    .filter(|provider| provider.status == "disabled")
                    .count(),
            })
        })
        .collect()
}

#[cfg(test)]
fn build_model_catalog_values(providers: &[ProviderView]) -> Vec<Value> {
    build_model_catalog_values_with_catalog(&[], providers)
}

fn build_model_catalog_values_with_catalog(channels: &[ChannelRow], providers: &[ProviderView]) -> Vec<Value> {
    let mut grouped = BTreeMap::<String, BTreeMap<String, String>>::new();
    for provider in providers {
        let channel_models = grouped.entry(provider.channel_id.clone()).or_default();
        for model in &provider.models {
            channel_models
                .entry(model.id.clone())
                .or_insert_with(|| model.name.clone());
        }
    }

    resolved_channel_catalog(channels, providers)
        .into_iter()
        .filter_map(|(channel_id, channel_name, _, _)| {
            let models = grouped.get(&channel_id)?;
            let mut values = models
                .iter()
                .map(|(model_id, model_name)| {
                    json!({
                        "modelId": model_id,
                        "modelName": model_name,
                    })
                })
                .collect::<Vec<_>>();
            values.sort_by(|left, right| {
                left.get("modelName")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .cmp(
                        right
                            .get("modelName")
                            .and_then(Value::as_str)
                            .unwrap_or_default(),
                    )
            });

            Some(json!({
                "channelId": channel_id,
                "channelName": channel_name,
                "models": values,
            }))
        })
        .collect()
}

fn resolved_channel_catalog(
    channels: &[ChannelRow],
    providers: &[ProviderView],
) -> Vec<(String, String, String, String)> {
    let default_catalog = default_channel_catalog();
    let default_names = default_catalog
        .iter()
        .map(|(id, _, _, _)| (*id).to_string())
        .collect::<BTreeSet<_>>();
    let api_channel_names = channels
        .iter()
        .map(|channel| (channel.id.clone(), channel.name.clone()))
        .collect::<BTreeMap<_, _>>();
    let mut extras = api_channel_names
        .iter()
        .filter(|(id, _)| !default_names.contains(*id))
        .map(|(id, name)| (id.clone(), name.clone()))
        .collect::<BTreeMap<_, _>>();

    for provider in providers {
        if !default_names.contains(&provider.channel_id) {
            extras
                .entry(provider.channel_id.clone())
                .or_insert_with(|| provider.channel_id.clone());
        }
    }

    let mut resolved = default_catalog
        .into_iter()
        .map(|(id, default_name, vendor, model_family)| {
            (
                id.to_string(),
                api_channel_names
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| default_name.to_string()),
                vendor.to_string(),
                model_family.to_string(),
            )
        })
        .collect::<Vec<_>>();

    resolved.extend(
        extras
            .into_iter()
            .map(|(id, name)| (id, name.clone(), name, "Custom".to_string())),
    );
    resolved
}

fn provider_to_value(provider: ProviderView) -> Value {
    json!({
        "id": provider.id,
        "channelId": provider.channel_id,
        "name": provider.name,
        "apiKey": provider.api_key,
        "groupId": provider.group_id,
        "usage": {
            "requestCount": provider.request_count,
            "tokenCount": provider.token_count,
            "spendUsd": provider.spend_usd,
            "period": "30d",
        },
        "expiresAt": provider.expires_at,
        "status": provider.status,
        "createdAt": provider.created_at,
        "baseUrl": provider.base_url,
        "models": provider.models,
        "notes": provider.notes,
    })
}

fn unified_key_to_value(item: UnifiedKeyView) -> Value {
    json!({
        "id": item.id,
        "name": item.name,
        "apiKey": item.api_key,
        "source": item.source,
        "groupId": item.group_id,
        "usage": {
            "requestCount": item.request_count,
            "tokenCount": item.token_count,
            "spendUsd": item.spend_usd,
            "period": "30d",
        },
        "expiresAt": item.expires_at,
        "status": item.status,
        "createdAt": item.created_at,
        "modelMappingId": item.model_mapping_id,
        "notes": item.notes,
    })
}

fn model_mapping_to_value(mapping: StoredModelMapping) -> Value {
    json!({
        "id": mapping.id,
        "name": mapping.name,
        "description": mapping.description,
        "status": mapping.status,
        "effectiveFrom": mapping.effective_from,
        "effectiveTo": mapping.effective_to,
        "createdAt": mapping.created_at,
        "rules": mapping.rules,
    })
}

fn usage_row_to_value(
    row: &UsageRow,
    project_names: &BTreeMap<String, String>,
    provider_names: &BTreeMap<String, String>,
    index: usize,
) -> Value {
    let prompt_tokens = row.input_tokens.max(0) as u64;
    let completion_tokens = row.output_tokens.max(0) as u64;
    let total_tokens = row.total_tokens.max(0) as u64;
    let cached_tokens = total_tokens.saturating_sub(prompt_tokens + completion_tokens);
    let ttft_ms = ((prompt_tokens / 24) + 90).clamp(90, 800);
    let duration_ms =
        (ttft_ms + (completion_tokens / 4) + (cached_tokens / 8) + 180).clamp(180, 12_000);
    let api_key_name = project_names
        .get(&row.project_id)
        .cloned()
        .unwrap_or_else(|| row.project_id.clone());
    let provider_name = provider_names
        .get(&row.provider_id)
        .cloned()
        .unwrap_or_else(|| row.provider_id.clone());
    let endpoint = if row.model.to_ascii_lowercase().contains("embed") {
        "/embeddings"
    } else {
        "/responses"
    };
    let id_suffix = sha256_hex(
        format!(
            "{}|{}|{}|{}|{}",
            row.project_id, row.provider_id, row.model, row.created_at_ms, index
        )
        .as_str(),
    );

    json!({
        "id": format!("usage-{}", &id_suffix[..12]),
        "apiKeyId": row.project_id,
        "apiKeyName": api_key_name,
        "model": row.model,
        "reasoningEffort": infer_reasoning_effort(&row.model),
        "endpoint": endpoint,
        "type": if total_tokens > 8_000 { "streaming" } else { "standard" },
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "cachedTokens": cached_tokens,
        "costUsd": row.amount.max(0.0),
        "ttftMs": ttft_ms,
        "durationMs": duration_ms,
        "startedAt": epoch_ms_to_iso(Some(row.created_at_ms))
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string()),
        "userAgent": format!("Claw Studio via {}", provider_name),
    })
}

fn build_usage_summary_value(
    rows: &[UsageRow],
    _project_names: &BTreeMap<String, String>,
) -> Value {
    let total_requests = rows
        .iter()
        .map(|row| row.units.max(1) as u64)
        .sum::<u64>();
    let prompt_tokens = rows
        .iter()
        .map(|row| row.input_tokens.max(0) as u64)
        .sum::<u64>();
    let completion_tokens = rows
        .iter()
        .map(|row| row.output_tokens.max(0) as u64)
        .sum::<u64>();
    let total_tokens = rows
        .iter()
        .map(|row| row.total_tokens.max(0) as u64)
        .sum::<u64>();
    let cached_tokens = total_tokens.saturating_sub(prompt_tokens + completion_tokens);
    let total_spend = rows.iter().map(|row| row.amount.max(0.0)).sum::<f64>();
    let average_duration_ms = if rows.is_empty() {
        0
    } else {
        let total_duration = rows
            .iter()
            .map(|row| {
                let prompt = row.input_tokens.max(0) as u64;
                let completion = row.output_tokens.max(0) as u64;
                ((prompt / 24) + 90 + (completion / 4) + 180).clamp(180, 12_000)
            })
            .sum::<u64>();
        total_duration / rows.len() as u64
    };

    json!({
        "totalRequests": total_requests,
        "totalTokens": total_tokens,
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "cachedTokens": cached_tokens,
        "totalSpendUsd": total_spend,
        "averageDurationMs": average_duration_ms,
    })
}

fn provider_matches_query(provider: &ProviderView, query: &ApiRouterProviderQuery) -> bool {
    if let Some(channel_id) = query
        .channel_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "all")
    {
        if provider.channel_id != channel_id {
            return false;
        }
    }

    if let Some(group_id) = query
        .group_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "all")
    {
        if provider.group_id != normalize_group_id(Some(group_id)) {
            return false;
        }
    }

    if let Some(keyword) = query
        .keyword
        .as_deref()
        .and_then(|value| normalize_optional_string(Some(value)))
    {
        let keyword = keyword.to_ascii_lowercase();
        let model_matches = provider.models.iter().any(|model| {
            model.id.to_ascii_lowercase().contains(&keyword)
                || model.name.to_ascii_lowercase().contains(&keyword)
        });
        if !provider.id.to_ascii_lowercase().contains(&keyword)
            && !provider.name.to_ascii_lowercase().contains(&keyword)
            && !provider.base_url.to_ascii_lowercase().contains(&keyword)
            && !provider
                .notes
                .as_deref()
                .unwrap_or_default()
                .to_ascii_lowercase()
                .contains(&keyword)
            && !model_matches
        {
            return false;
        }
    }

    true
}

fn unified_key_matches_query(item: &UnifiedKeyView, query: &ApiRouterUnifiedApiKeyQuery) -> bool {
    if let Some(group_id) = query
        .group_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "all")
    {
        if item.group_id != normalize_group_id(Some(group_id)) {
            return false;
        }
    }

    if let Some(keyword) = query
        .keyword
        .as_deref()
        .and_then(|value| normalize_optional_string(Some(value)))
    {
        let keyword = keyword.to_ascii_lowercase();
        if !item.id.to_ascii_lowercase().contains(&keyword)
            && !item.name.to_ascii_lowercase().contains(&keyword)
            && !item.source.to_ascii_lowercase().contains(&keyword)
            && !item
                .notes
                .as_deref()
                .unwrap_or_default()
                .to_ascii_lowercase()
                .contains(&keyword)
            && !item.api_key.to_ascii_lowercase().contains(&keyword)
        {
            return false;
        }
    }

    true
}

fn model_mapping_matches_query(
    item: &StoredModelMapping,
    query: &ApiRouterModelMappingQuery,
) -> bool {
    let Some(keyword) = query
        .keyword
        .as_deref()
        .and_then(|value| normalize_optional_string(Some(value)))
    else {
        return true;
    };
    let keyword = keyword.to_ascii_lowercase();

    item.id.to_ascii_lowercase().contains(&keyword)
        || item.name.to_ascii_lowercase().contains(&keyword)
        || item.description.to_ascii_lowercase().contains(&keyword)
        || item.rules.iter().any(|rule| {
            rule.source.model_id.to_ascii_lowercase().contains(&keyword)
                || rule.source.model_name.to_ascii_lowercase().contains(&keyword)
                || rule.target.model_id.to_ascii_lowercase().contains(&keyword)
                || rule.target.model_name.to_ascii_lowercase().contains(&keyword)
        })
}

fn normalize_provider_models(
    models: &[ApiRouterProviderModelInput],
) -> Vec<ApiRouterProviderModelInput> {
    let mut seen = BTreeSet::new();
    let mut normalized = Vec::new();
    for model in models {
        let id = model.id.trim();
        if id.is_empty() || !seen.insert(id.to_string()) {
            continue;
        }
        normalized.push(ApiRouterProviderModelInput {
            id: id.to_string(),
            name: if model.name.trim().is_empty() {
                id.to_string()
            } else {
                model.name.trim().to_string()
            },
        });
    }
    normalized
}

fn normalize_group_id(value: Option<&str>) -> String {
    value
        .and_then(|value| normalize_optional_string(Some(value)))
        .unwrap_or_else(default_group_id_string)
}

fn normalize_optional_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn build_openclaw_project_id(
    instance_id: Option<&str>,
    strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
) -> String {
    match strategy {
        ApiRouterInstallerOpenClawApiKeyStrategy::Shared => "project-openclaw-shared".to_string(),
        ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => format!(
            "project-openclaw-{}",
            sanitize_openclaw_identifier(instance_id.unwrap_or("instance"))
        ),
    }
}

fn sanitize_openclaw_identifier(value: &str) -> String {
    let mut normalized = value
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    normalized = normalized.trim_matches('-').to_string();
    while normalized.contains("--") {
        normalized = normalized.replace("--", "-");
    }

    if normalized.is_empty() {
        "instance".to_string()
    } else {
        normalized
    }
}

fn build_openclaw_project_name(
    instance_id: &str,
    strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
) -> String {
    match strategy {
        ApiRouterInstallerOpenClawApiKeyStrategy::Shared => "OpenClaw Shared Access".to_string(),
        ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => {
            format!("OpenClaw {}", sanitize_openclaw_identifier(instance_id))
        }
    }
}

fn build_openclaw_gateway_label(
    instance_id: &str,
    strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
) -> String {
    match strategy {
        ApiRouterInstallerOpenClawApiKeyStrategy::Shared => "OpenClaw shared gateway".to_string(),
        ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => {
            format!("OpenClaw {}", sanitize_openclaw_identifier(instance_id))
        }
    }
}

fn normalize_unified_key_source(value: Option<&str>) -> String {
    match value.unwrap_or_default().trim() {
        "custom" => "custom".to_string(),
        _ => default_source_string(),
    }
}

fn validate_provider_create(input: &ApiRouterProxyProviderCreate) -> Result<()> {
    if input.channel_id.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider channel id must not be empty".to_string(),
        ));
    }
    if input.name.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider name must not be empty".to_string(),
        ));
    }
    if input.api_key.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider api key must not be empty".to_string(),
        ));
    }
    if input.group_id.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider group id must not be empty".to_string(),
        ));
    }
    if !is_http_url(input.base_url.as_str()) {
        return Err(FrameworkError::ValidationFailed(
            "provider base url must start with http:// or https://".to_string(),
        ));
    }
    if normalize_provider_models(&input.models).is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider must contain at least one model".to_string(),
        ));
    }
    let _ = parse_optional_iso_to_epoch_ms(input.expires_at.as_deref())?;
    Ok(())
}

fn validate_unified_key_create(input: &ApiRouterUnifiedApiKeyCreate) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "unified api key name must not be empty".to_string(),
        ));
    }
    if input.group_id.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "unified api key group id must not be empty".to_string(),
        ));
    }
    if normalize_unified_key_source(input.source.as_deref()) == "custom"
        && input
            .api_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
    {
        return Err(FrameworkError::ValidationFailed(
            "custom unified api keys require an api key value".to_string(),
        ));
    }
    let _ = parse_optional_iso_to_epoch_ms(input.expires_at.as_deref())?;
    Ok(())
}

fn validate_model_mapping_create(input: &ApiRouterModelMappingCreate) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "model mapping name must not be empty".to_string(),
        ));
    }
    if input.rules.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "model mappings require at least one routing rule".to_string(),
        ));
    }
    let effective_from = parse_optional_iso_to_epoch_ms(Some(input.effective_from.as_str()))?
        .ok_or_else(|| FrameworkError::ValidationFailed("effectiveFrom is required".to_string()))?;
    let effective_to = parse_optional_iso_to_epoch_ms(Some(input.effective_to.as_str()))?
        .ok_or_else(|| FrameworkError::ValidationFailed("effectiveTo is required".to_string()))?;
    if effective_from > effective_to {
        return Err(FrameworkError::ValidationFailed(
            "effectiveFrom must be earlier than or equal to effectiveTo".to_string(),
        ));
    }
    Ok(())
}

fn validate_openclaw_install_options(input: &ApiRouterInstallerOpenClawOptions) -> Result<()> {
    if input.instance_ids.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "OpenClaw installation requires at least one instance".to_string(),
        ));
    }

    for instance_id in &input.instance_ids {
        if instance_id.trim().is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "OpenClaw instance identifiers must not be empty".to_string(),
            ));
        }
    }

    if input
        .router_provider_id
        .as_deref()
        .is_some_and(|value| value.trim().is_empty())
    {
        return Err(FrameworkError::ValidationFailed(
            "OpenClaw router provider id must not be blank".to_string(),
        ));
    }

    if input
        .model_mapping_id
        .as_deref()
        .is_some_and(|value| value.trim().is_empty())
    {
        return Err(FrameworkError::ValidationFailed(
            "OpenClaw model mapping id must not be blank".to_string(),
        ));
    }

    Ok(())
}

fn validate_status_value(status: &str) -> Result<()> {
    match status.trim() {
        "active" | "warning" | "disabled" | "expired" => Ok(()),
        other => Err(FrameworkError::ValidationFailed(format!(
            "unsupported status value: {other}"
        ))),
    }
}

fn default_provider_local() -> ProviderLocal {
    ProviderLocal {
        group_id: default_group_id_string(),
        status: Some("active".to_string()),
        expires_at: None,
        notes: None,
        api_key: None,
        created_at: Some(
            now_rfc3339().unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
        ),
        model_names: BTreeMap::new(),
    }
}

fn default_unified_key_local(row: &GatewayApiKeyRow) -> UnifiedKeyLocal {
    UnifiedKeyLocal {
        group_id: default_group_id_string(),
        source: default_source_string(),
        status: Some(if row.active {
            "active".to_string()
        } else {
            "disabled".to_string()
        }),
        model_mapping_id: None,
        notes: row.notes.clone(),
        plaintext_key: None,
    }
}

fn effective_status(status: Option<&str>, expires_at: Option<&str>) -> String {
    if matches!(status, Some("disabled")) {
        return "disabled".to_string();
    }

    if let Some(expiry) =
        expires_at.and_then(|value| parse_optional_iso_to_epoch_ms(Some(value)).ok().flatten())
    {
        let now = now_epoch_millis().unwrap_or(0);
        if expiry < now {
            return "expired".to_string();
        }
        let remaining_days = (expiry - now) / (24 * 60 * 60 * 1000);
        if remaining_days <= WARNING_THRESHOLD_DAYS {
            return "warning".to_string();
        }
    }

    match status.unwrap_or("active") {
        "warning" => "warning".to_string(),
        "expired" => "expired".to_string(),
        "disabled" => "disabled".to_string(),
        _ => "active".to_string(),
    }
}

fn aggregate_provider_usage(rows: Vec<UsageRow>) -> BTreeMap<String, (u64, u64, f64)> {
    let mut aggregates = BTreeMap::<String, (u64, u64, f64)>::new();
    for row in rows {
        let entry = aggregates.entry(row.provider_id).or_insert((0, 0, 0.0));
        entry.0 += row.units.max(1) as u64;
        entry.1 += row.total_tokens.max(0) as u64;
        entry.2 += row.amount.max(0.0);
    }
    aggregates
}

fn aggregate_project_usage(rows: Vec<UsageRow>) -> BTreeMap<String, (u64, u64, f64)> {
    let mut aggregates = BTreeMap::<String, (u64, u64, f64)>::new();
    for row in rows {
        let entry = aggregates.entry(row.project_id).or_insert((0, 0, 0.0));
        entry.0 += row.units.max(1) as u64;
        entry.1 += row.total_tokens.max(0) as u64;
        entry.2 += row.amount.max(0.0);
    }
    aggregates
}

fn project_name_lookup(projects: &[ProjectRow]) -> BTreeMap<String, String> {
    projects
        .iter()
        .map(|row| (row.id.clone(), row.name.clone()))
        .collect()
}

fn provider_name_lookup(providers: &[ProviderRow]) -> BTreeMap<String, String> {
    providers
        .iter()
        .map(|row| (row.id.clone(), row.display_name.clone()))
        .collect()
}

fn sort_usage_rows(rows: &mut [UsageRow], sort_by: Option<&str>, sort_order: Option<&str>) {
    let by_model = matches!(sort_by.unwrap_or("time"), "model");
    let ascending = matches!(sort_order.unwrap_or("desc"), "asc");
    rows.sort_by(|left, right| {
        let ordering = if by_model {
            left.model
                .to_ascii_lowercase()
                .cmp(&right.model.to_ascii_lowercase())
                .then_with(|| left.created_at_ms.cmp(&right.created_at_ms))
        } else {
            left.created_at_ms.cmp(&right.created_at_ms)
        };
        if ascending {
            ordering
        } else {
            ordering.reverse()
        }
    });
}

fn resolve_usage_time_range(query: &ApiRouterUsageRecordsQuery) -> Result<Option<(i64, i64)>> {
    let time_range = query.time_range.as_deref().unwrap_or("30d");
    if time_range == "custom" {
        let start_ms = parse_date_boundary(query.start_date.as_deref(), false)?;
        let end_ms = parse_date_boundary(query.end_date.as_deref(), true)?;
        return match (start_ms, end_ms) {
            (None, None) => Ok(None),
            (Some(start), Some(end)) if start > end => Ok(Some((1, 0))),
            (Some(start), Some(end)) => Ok(Some((start, end))),
            (Some(start), None) => Ok(Some((start, i64::MAX))),
            (None, Some(end)) => Ok(Some((0, end))),
        };
    }

    let now = now_epoch_millis()?;
    let start = match time_range {
        "24h" => now - 24 * 60 * 60 * 1000,
        "7d" => now - 7 * 24 * 60 * 60 * 1000,
        "30d" | "" => now - 30 * 24 * 60 * 60 * 1000,
        _ => return Ok(None),
    };
    Ok(Some((start, now)))
}

fn now_rfc3339() -> Result<String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| FrameworkError::Internal(format!("failed to format current time: {error}")))
}

fn now_epoch_millis() -> Result<i64> {
    i64::try_from(OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000)
        .map_err(|error| FrameworkError::Internal(format!("failed to calculate epoch millis: {error}")))
}

fn epoch_ms_to_iso(value: Option<i64>) -> Option<String> {
    let millis = value?;
    OffsetDateTime::from_unix_timestamp_nanos(i128::from(millis) * 1_000_000)
        .ok()
        .and_then(|value| value.format(&Rfc3339).ok())
}

fn parse_optional_iso_to_epoch_ms(value: Option<&str>) -> Result<Option<i64>> {
    let Some(value) = normalize_optional_string(value) else {
        return Ok(None);
    };
    parse_datetime_like(value.as_str(), false).map(Some)
}

fn generate_id(prefix: &str) -> String {
    let mut bytes = [0_u8; 8];
    let suffix = if getrandom(&mut bytes).is_ok() {
        bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    } else {
        format!("{:x}", now_epoch_millis().unwrap_or(0))
    };
    format!("{}-{}", prefix.trim(), suffix)
}

fn generate_managed_api_key() -> Result<String> {
    let mut bytes = [0_u8; 24];
    getrandom(&mut bytes)
        .map_err(|error| FrameworkError::Internal(format!("failed to generate api key: {error}")))?;
    Ok(format!(
        "{MANAGED_API_KEY_PREFIX}{}",
        bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    ))
}

fn sha256_hex(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn infer_reasoning_effort(model: &str) -> &'static str {
    let model = model.to_ascii_lowercase();
    if model.contains("r1")
        || model.contains("o3")
        || model.contains("o4")
        || model.contains("reason")
        || model.contains("thinking")
    {
        return "xhigh";
    }
    if model.contains("sonnet")
        || model.contains("opus")
        || model.contains("pro")
        || model.contains("deepseek")
    {
        return "high";
    }
    if model.contains("mini") || model.contains("flash") {
        return "low";
    }
    if model.contains("nano") {
        return "minimal";
    }
    "medium"
}

fn is_http_url(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.starts_with("http://") || trimmed.starts_with("https://")
}

fn parse_datetime_like(value: &str, end_of_day: bool) -> Result<i64> {
    if let Ok(datetime) = OffsetDateTime::parse(value, &Rfc3339) {
        return i64::try_from(datetime.unix_timestamp_nanos() / 1_000_000).map_err(|error| {
            FrameworkError::Internal(format!("failed to convert datetime to epoch millis: {error}"))
        });
    }

    let date = Date::parse(value, DATE_ONLY_FORMAT).map_err(|error| {
        FrameworkError::ValidationFailed(format!("failed to parse date \"{value}\": {error}"))
    })?;
    let time = if end_of_day {
        Time::from_hms_milli(23, 59, 59, 999).map_err(|error| {
            FrameworkError::Internal(format!("failed to build end-of-day time: {error}"))
        })?
    } else {
        Time::MIDNIGHT
    };
    i64::try_from(date.with_time(time).assume_utc().unix_timestamp_nanos() / 1_000_000)
        .map_err(|error| {
            FrameworkError::Internal(format!("failed to convert date to epoch millis: {error}"))
        })
}

fn parse_date_boundary(value: Option<&str>, end_of_day: bool) -> Result<Option<i64>> {
    let Some(value) = normalize_optional_string(value) else {
        return Ok(None);
    };
    parse_datetime_like(value.as_str(), end_of_day).map(Some)
}

fn load_provider_rows(conn: &Connection) -> Result<Vec<ProviderRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, channel_id, base_url, display_name
         FROM catalog_proxy_providers
         ORDER BY display_name COLLATE NOCASE ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ProviderRow {
            id: row.get(0)?,
            channel_id: row.get(1)?,
            base_url: row.get(2)?,
            display_name: row.get(3)?,
        })
    })?;
    rows.collect::<std::result::Result<Vec<_>, _>>().map_err(Into::into)
}

fn load_model_rows(conn: &Connection) -> Result<Vec<ModelRow>> {
    let mut stmt = conn.prepare(
        "SELECT external_name, provider_id
         FROM catalog_models
         ORDER BY provider_id ASC, external_name COLLATE NOCASE ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ModelRow {
            external_name: row.get(0)?,
            provider_id: row.get(1)?,
        })
    })?;
    rows.collect::<std::result::Result<Vec<_>, _>>().map_err(Into::into)
}

fn load_credential_rows(conn: &Connection) -> Result<Vec<CredentialRow>> {
    let mut stmt = conn.prepare(
        "SELECT tenant_id, provider_id, key_reference
         FROM credential_records
         ORDER BY provider_id ASC, key_reference COLLATE NOCASE ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CredentialRow {
            tenant_id: row.get(0)?,
            provider_id: row.get(1)?,
            key_reference: row.get(2)?,
        })
    })?;
    rows.collect::<std::result::Result<Vec<_>, _>>().map_err(Into::into)
}

fn load_gateway_api_key_rows(conn: &Connection) -> Result<Vec<GatewayApiKeyRow>> {
    let mut stmt = conn.prepare(
        "SELECT tenant_id, project_id, environment, hashed_key, label, notes, created_at_ms,
                last_used_at_ms, expires_at_ms, active
         FROM identity_gateway_api_keys
         ORDER BY created_at_ms DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(GatewayApiKeyRow {
            tenant_id: row.get(0)?,
            project_id: row.get(1)?,
            environment: row.get(2)?,
            hashed_key: row.get(3)?,
            label: row.get(4)?,
            notes: row.get(5)?,
            created_at_ms: row.get(6)?,
            last_used_at_ms: row.get(7)?,
            expires_at_ms: row.get(8)?,
            active: row.get::<_, i64>(9)? != 0,
        })
    })?;
    rows.collect::<std::result::Result<Vec<_>, _>>().map_err(Into::into)
}

fn upsert_tenant(tx: &rusqlite::Transaction<'_>, id: &str, name: &str) -> Result<()> {
    tx.execute(
        "INSERT INTO tenant_records (id, name) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name",
        params![id, name],
    )?;
    Ok(())
}

fn upsert_project(
    tx: &rusqlite::Transaction<'_>,
    tenant_id: &str,
    id: &str,
    name: &str,
) -> Result<()> {
    tx.execute(
        "INSERT INTO tenant_projects (id, tenant_id, name) VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET tenant_id = excluded.tenant_id, name = excluded.name",
        params![id, tenant_id, name],
    )?;
    Ok(())
}

fn resolve_or_create_openclaw_project(
    tx: &rusqlite::Transaction<'_>,
    overlay: &mut ControlPlaneOverlay,
    project_id: &str,
    instance_id: &str,
    strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
    created_at_ms: i64,
    installed_at: &str,
) -> Result<String> {
    let api_key = overlay
        .openclaw_projects
        .get(project_id)
        .and_then(|local| local.plaintext_key.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(generate_managed_api_key()?);

    upsert_project(
        tx,
        DEFAULT_TENANT_ID,
        project_id,
        build_openclaw_project_name(instance_id, strategy).as_str(),
    )?;
    upsert_gateway_api_key(
        tx,
        &GatewayApiKeyRow {
            tenant_id: DEFAULT_TENANT_ID.to_string(),
            project_id: project_id.to_string(),
            environment: DEFAULT_PROJECT_ENVIRONMENT.to_string(),
            hashed_key: sha256_hex(api_key.as_str()),
            label: build_openclaw_gateway_label(instance_id, strategy),
            notes: Some("Managed by Claw Studio for OpenClaw".to_string()),
            created_at_ms,
            last_used_at_ms: None,
            expires_at_ms: None,
            active: true,
        },
    )?;

    overlay.openclaw_projects.insert(
        project_id.to_string(),
        OpenClawProjectLocal {
            plaintext_key: Some(api_key.clone()),
            api_key_strategy: strategy,
            last_installed_at: Some(installed_at.to_string()),
        },
    );

    Ok(api_key)
}

fn upsert_gateway_api_key(
    tx: &rusqlite::Transaction<'_>,
    row: &GatewayApiKeyRow,
) -> Result<()> {
    tx.execute(
        "INSERT INTO identity_gateway_api_keys (
            hashed_key, tenant_id, project_id, environment, label, notes, created_at_ms,
            last_used_at_ms, expires_at_ms, active
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(hashed_key) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            project_id = excluded.project_id,
            environment = excluded.environment,
            label = excluded.label,
            notes = excluded.notes,
            created_at_ms = excluded.created_at_ms,
            last_used_at_ms = excluded.last_used_at_ms,
            expires_at_ms = excluded.expires_at_ms,
            active = excluded.active",
        params![
            row.hashed_key,
            row.tenant_id,
            row.project_id,
            row.environment,
            row.label,
            row.notes,
            row.created_at_ms,
            row.last_used_at_ms,
            row.expires_at_ms,
            if row.active { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

fn upsert_project_routing_preferences(
    tx: &rusqlite::Transaction<'_>,
    project_id: &str,
    provider_id: &str,
    updated_at_ms: i64,
) -> Result<()> {
    let ordered_provider_ids_json = serde_json::to_string(&vec![provider_id.to_string()])
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    tx.execute(
        "INSERT INTO project_routing_preferences (
            project_id, preset_id, strategy, ordered_provider_ids_json, default_provider_id,
            max_cost, max_latency_ms, require_healthy, preferred_region, updated_at_ms
         ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, 0, NULL, ?6)
         ON CONFLICT(project_id) DO UPDATE SET
            preset_id = excluded.preset_id,
            strategy = excluded.strategy,
            ordered_provider_ids_json = excluded.ordered_provider_ids_json,
            default_provider_id = excluded.default_provider_id,
            max_cost = excluded.max_cost,
            max_latency_ms = excluded.max_latency_ms,
            require_healthy = excluded.require_healthy,
            preferred_region = excluded.preferred_region,
            updated_at_ms = excluded.updated_at_ms",
        params![
            project_id,
            "claw-studio-openclaw",
            "deterministic_priority",
            ordered_provider_ids_json,
            provider_id,
            updated_at_ms,
        ],
    )?;
    Ok(())
}

fn delete_project_routing_preferences(
    tx: &rusqlite::Transaction<'_>,
    project_id: &str,
) -> Result<()> {
    tx.execute(
        "DELETE FROM project_routing_preferences WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}

fn update_gateway_api_key_project_metadata(
    tx: &rusqlite::Transaction<'_>,
    project_id: &str,
    label: &str,
    notes: Option<String>,
    expires_at_ms: Option<i64>,
    active: bool,
) -> Result<()> {
    tx.execute(
        "UPDATE identity_gateway_api_keys
         SET label = ?1, notes = ?2, expires_at_ms = ?3, active = ?4
         WHERE project_id = ?5",
        params![label, notes, expires_at_ms, if active { 1 } else { 0 }, project_id],
    )?;
    Ok(())
}

fn delete_gateway_api_keys_for_project(
    tx: &rusqlite::Transaction<'_>,
    project_id: &str,
) -> Result<()> {
    tx.execute(
        "DELETE FROM identity_gateway_api_keys WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}

fn delete_project(tx: &rusqlite::Transaction<'_>, project_id: &str) -> Result<()> {
    tx.execute("DELETE FROM tenant_projects WHERE id = ?1", params![project_id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        build_channel_values, build_model_catalog_values, build_usage_summary_value,
        generate_managed_api_key, AdminSaveCredentialRequest, AdminSaveModelRequest,
        AdminSaveProviderRequest, ApiRouterAdminClient, ApiRouterControlService,
        ApiRouterInstallerOpenClawOptions, ApiRouterInstallerOpenClawApiKeyStrategy,
        ApiRouterModelRef, ApiRouterProviderQuery, ApiRouterUsageRecordsQuery, ChannelRow,
        ControlPlaneOverlay, CredentialRow, GatewayApiKeyRow, ModelRow, ProjectRow, ProviderLocal,
        ProviderRow, ProviderView, StoredModelMapping, UnifiedKeyLocal, UsageRow,
    };
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::api_router_runtime::{
            ApiRouterDesktopAuthSession, ApiRouterHealthChecker, ApiRouterHealthStatus,
            ApiRouterProcessHandle, ApiRouterProcessKind, ApiRouterProcessSpawner,
            ApiRouterRuntimeOptions, ApiRouterRuntimeService,
        },
        Result,
    };
    use rusqlite::params;
    use serde_json::Value;
    use sha2::{Digest, Sha256};
    use std::{collections::BTreeMap, fs, io::Write, path::Path, path::PathBuf, sync::Arc};
    use zip::write::SimpleFileOptions;

    #[derive(Clone)]
    struct HealthyChecker;

    impl ApiRouterHealthChecker for HealthyChecker {
        fn probe(&self) -> Result<ApiRouterHealthStatus> {
            Ok(ApiRouterHealthStatus {
                admin_healthy: true,
                gateway_healthy: true,
            })
        }
    }

    #[derive(Clone)]
    struct NoopSpawner;

    impl ApiRouterProcessSpawner for NoopSpawner {
        fn spawn(
            &self,
            _kind: ApiRouterProcessKind,
            _executable: &Path,
            _router_home_dir: &Path,
            _env: &BTreeMap<String, String>,
        ) -> Result<Box<dyn ApiRouterProcessHandle>> {
            panic!("control service tests should not spawn router processes");
        }
    }

    #[derive(Clone, Default)]
    struct MockApiRouterAdminClient {
        channels: Vec<ChannelRow>,
        providers: Vec<ProviderRow>,
        credentials: Vec<CredentialRow>,
        models: Vec<ModelRow>,
        projects: Vec<ProjectRow>,
        api_keys: Vec<GatewayApiKeyRow>,
        usage_records: Vec<UsageRow>,
    }

    impl ApiRouterAdminClient for MockApiRouterAdminClient {
        fn list_channels(&self, _token: &str) -> Result<Vec<ChannelRow>> {
            Ok(self.channels.clone())
        }

        fn list_providers(&self, _token: &str) -> Result<Vec<ProviderRow>> {
            Ok(self.providers.clone())
        }

        fn list_credentials(&self, _token: &str) -> Result<Vec<CredentialRow>> {
            Ok(self.credentials.clone())
        }

        fn list_models(&self, _token: &str) -> Result<Vec<ModelRow>> {
            Ok(self.models.clone())
        }

        fn list_projects(&self, _token: &str) -> Result<Vec<ProjectRow>> {
            Ok(self.projects.clone())
        }

        fn list_api_keys(&self, _token: &str) -> Result<Vec<GatewayApiKeyRow>> {
            Ok(self.api_keys.clone())
        }

        fn list_usage_records(&self, _token: &str) -> Result<Vec<UsageRow>> {
            Ok(self.usage_records.clone())
        }

        fn save_provider(&self, _token: &str, _input: &AdminSaveProviderRequest) -> Result<()> {
            panic!("mock admin client save_provider should not be called in read tests");
        }

        fn delete_provider(&self, _token: &str, _provider_id: &str) -> Result<()> {
            panic!("mock admin client delete_provider should not be called in read tests");
        }

        fn save_credential(&self, _token: &str, _input: &AdminSaveCredentialRequest) -> Result<()> {
            panic!("mock admin client save_credential should not be called in read tests");
        }

        fn delete_credential(
            &self,
            _token: &str,
            _tenant_id: &str,
            _provider_id: &str,
            _key_reference: &str,
        ) -> Result<()> {
            panic!("mock admin client delete_credential should not be called in read tests");
        }

        fn save_model(&self, _token: &str, _input: &AdminSaveModelRequest) -> Result<()> {
            panic!("mock admin client save_model should not be called in read tests");
        }

        fn delete_model(&self, _token: &str, _external_name: &str, _provider_id: &str) -> Result<()> {
            panic!("mock admin client delete_model should not be called in read tests");
        }
    }

    fn create_test_artifacts(root: &Path) -> PathBuf {
        let artifact_root = root.join("artifacts");
        let target_dir = artifact_root.join("windows-x64");
        fs::create_dir_all(&target_dir).expect("target dir");

        let archive_path = target_dir.join("router-test.zip");
        let archive_file = fs::File::create(&archive_path).expect("archive file");
        let mut archive = zip::ZipWriter::new(archive_file);
        let options = SimpleFileOptions::default();

        archive
            .start_file("admin-api-service.exe", options)
            .expect("start admin entry");
        archive.write_all(b"admin-test").expect("write admin");
        archive
            .start_file("gateway-service.exe", options)
            .expect("start gateway entry");
        archive.write_all(b"gateway-test").expect("write gateway");
        archive.finish().expect("finish archive");

        let mut hasher = Sha256::new();
        hasher.update(fs::read(&archive_path).expect("read archive"));
        let sha256 = hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        fs::write(
            artifact_root.join("manifest.json"),
            serde_json::json!({
                "version": "0.1.0-test",
                "archives": {
                    "windows-x64": {
                        "path": "windows-x64/router-test.zip",
                        "sha256": sha256,
                        "binaries": ["admin-api-service.exe", "gateway-service.exe"]
                    }
                }
            })
            .to_string(),
        )
        .expect("manifest");

        artifact_root
    }

    fn build_test_runtime(root: &Path) -> ApiRouterRuntimeService {
        let runtime = ApiRouterRuntimeService::new_with_dependencies(
            ApiRouterRuntimeOptions {
                artifact_root: create_test_artifacts(root),
                managed_root_dir: root.join("managed"),
                router_home_dir: root.join("home").join(".sdkwork").join("router"),
                target_key: "windows-x64".to_string(),
            },
            Arc::new(HealthyChecker),
            Arc::new(NoopSpawner),
        );
        runtime
            .sync_auth_session(ApiRouterDesktopAuthSession {
                user_id: "operator-1".to_string(),
                email: "operator@example.com".to_string(),
                display_name: "Operator".to_string(),
            })
            .expect("sync auth session");
        runtime
            .ensure_started_or_attached()
            .expect("ensure runtime ready");
        runtime.issue_admin_token().expect("prime admin token");
        runtime
    }

    fn build_test_service(root: &Path) -> ApiRouterControlService {
        ApiRouterControlService::new(build_test_runtime(root))
    }

    fn build_test_service_with_admin_client(
        root: &Path,
        admin_client: Arc<dyn ApiRouterAdminClient>,
    ) -> ApiRouterControlService {
        ApiRouterControlService {
            runtime: build_test_runtime(root),
            admin_client,
        }
    }

    fn seed_provider(service: &ApiRouterControlService, provider_id: &str) {
        let conn = service.open_connection().expect("open connection");
        conn.execute(
            "INSERT INTO catalog_proxy_providers (
                id, channel_id, extension_id, adapter_kind, base_url, display_name
             ) VALUES (?1, ?2, '', 'openai', ?3, ?4)",
            params![
                provider_id,
                "openai",
                "https://provider.example.com/v1",
                "Pinned Provider",
            ],
        )
        .expect("seed provider");
    }

    fn seed_model_mapping(service: &ApiRouterControlService, mapping_id: &str) {
        let mut overlay = service.load_overlay().expect("load overlay");
        overlay.model_mappings.insert(
            mapping_id.to_string(),
            StoredModelMapping {
                id: mapping_id.to_string(),
                name: "OpenClaw Mapping".to_string(),
                description: "Route OpenClaw requests through a stable mapping".to_string(),
                status: "active".to_string(),
                effective_from: "2026-03-20T00:00:00Z".to_string(),
                effective_to: "2026-12-31T00:00:00Z".to_string(),
                created_at: "2026-03-20T00:00:00Z".to_string(),
                rules: vec![super::StoredModelMappingRule {
                    id: "rule-1".to_string(),
                    source: ApiRouterModelRef {
                        channel_id: "openai".to_string(),
                        channel_name: "OpenAI".to_string(),
                        model_id: "gpt-5.4".to_string(),
                        model_name: "GPT-5.4".to_string(),
                    },
                    target: ApiRouterModelRef {
                        channel_id: "openai".to_string(),
                        channel_name: "OpenAI".to_string(),
                        model_id: "gpt-4.1".to_string(),
                        model_name: "GPT-4.1".to_string(),
                    },
                }],
            },
        );
        service.persist_overlay(&overlay).expect("persist overlay");
    }

    fn load_overlay_for_test(service: &ApiRouterControlService) -> ControlPlaneOverlay {
        service.load_overlay().expect("load overlay")
    }

    fn provider(
        id: &str,
        channel_id: &str,
        status: &str,
        models: &[(&str, &str)],
    ) -> ProviderView {
        ProviderView {
            id: id.to_string(),
            channel_id: channel_id.to_string(),
            name: format!("{id}-name"),
            api_key: "sk-test".to_string(),
            group_id: "shared-core".to_string(),
            request_count: 0,
            token_count: 0,
            spend_usd: 0.0,
            expires_at: None,
            status: status.to_string(),
            created_at: "2026-03-20T00:00:00Z".to_string(),
            base_url: "http://127.0.0.1:8080/v1".to_string(),
            models: models
                .iter()
                .map(|(id, name)| super::ApiRouterProviderModelInput {
                    id: (*id).to_string(),
                    name: (*name).to_string(),
                })
                .collect(),
            notes: None,
        }
    }

    #[test]
    fn build_channel_values_counts_provider_statuses_per_channel() {
        let values = build_channel_values(&[
            provider("provider-openai-1", "openai", "active", &[("gpt-5.4", "GPT-5.4")]),
            provider("provider-openai-2", "openai", "warning", &[("gpt-4.1", "GPT-4.1")]),
            provider("provider-openai-3", "openai", "disabled", &[("gpt-4o", "GPT-4o")]),
            provider(
                "provider-anthropic-1",
                "anthropic",
                "active",
                &[("claude-sonnet-4", "Claude Sonnet 4")],
            ),
        ]);

        let openai = values
            .iter()
            .find(|value| value.get("id") == Some(&Value::String("openai".to_string())))
            .expect("openai channel");
        let anthropic = values
            .iter()
            .find(|value| value.get("id") == Some(&Value::String("anthropic".to_string())))
            .expect("anthropic channel");

        assert_eq!(openai.get("providerCount").and_then(Value::as_u64), Some(3));
        assert_eq!(openai.get("activeProviderCount").and_then(Value::as_u64), Some(1));
        assert_eq!(openai.get("warningProviderCount").and_then(Value::as_u64), Some(1));
        assert_eq!(openai.get("disabledProviderCount").and_then(Value::as_u64), Some(1));
        assert_eq!(anthropic.get("providerCount").and_then(Value::as_u64), Some(1));
        assert_eq!(anthropic.get("activeProviderCount").and_then(Value::as_u64), Some(1));
    }

    #[test]
    fn build_model_catalog_values_groups_and_deduplicates_models_by_channel() {
        let values = build_model_catalog_values(&[
            provider(
                "provider-openai-1",
                "openai",
                "active",
                &[("gpt-5.4", "GPT-5.4"), ("gpt-4.1", "GPT-4.1")],
            ),
            provider(
                "provider-openai-2",
                "openai",
                "active",
                &[("gpt-5.4", "GPT-5.4"), ("o4-mini", "o4-mini")],
            ),
            provider(
                "provider-google-1",
                "google",
                "active",
                &[("gemini-2.5-pro", "Gemini 2.5 Pro")],
            ),
        ]);

        let openai = values
            .iter()
            .find(|value| value.get("channelId") == Some(&Value::String("openai".to_string())))
            .expect("openai catalog");
        let models = openai
            .get("models")
            .and_then(Value::as_array)
            .expect("openai models");

        assert_eq!(models.len(), 3);
        assert!(models.iter().any(|item| item.get("modelId") == Some(&Value::String("gpt-5.4".to_string()))));
        assert!(values
            .iter()
            .any(|value| value.get("channelId") == Some(&Value::String("google".to_string()))));
    }

    #[test]
    fn build_usage_summary_value_accumulates_request_token_and_cost_totals() {
        let mut project_names = BTreeMap::new();
        project_names.insert("project-a".to_string(), "Project A".to_string());
        project_names.insert("project-b".to_string(), "Project B".to_string());

        let value = build_usage_summary_value(
            &[
                UsageRow {
                    project_id: "project-a".to_string(),
                    model: "gpt-5.4".to_string(),
                    provider_id: "provider-openai-1".to_string(),
                    units: 1,
                    amount: 1.25,
                    input_tokens: 120,
                    output_tokens: 40,
                    total_tokens: 160,
                    created_at_ms: 1_700_000_000_000,
                },
                UsageRow {
                    project_id: "project-b".to_string(),
                    model: "claude-sonnet-4".to_string(),
                    provider_id: "provider-anthropic-1".to_string(),
                    units: 1,
                    amount: 2.5,
                    input_tokens: 300,
                    output_tokens: 90,
                    total_tokens: 390,
                    created_at_ms: 1_700_000_300_000,
                },
            ],
            &project_names,
        );

        assert_eq!(value.get("totalRequests").and_then(Value::as_u64), Some(2));
        assert_eq!(value.get("totalTokens").and_then(Value::as_u64), Some(550));
        assert_eq!(value.get("promptTokens").and_then(Value::as_u64), Some(420));
        assert_eq!(value.get("completionTokens").and_then(Value::as_u64), Some(130));
        assert_eq!(value.get("cachedTokens").and_then(Value::as_u64), Some(0));
        assert_eq!(value.get("totalSpendUsd").and_then(Value::as_f64), Some(3.75));
    }

    #[test]
    fn generate_managed_api_key_uses_router_prefix() {
        let value = generate_managed_api_key().expect("managed api key");

        assert!(value.starts_with("sk-ar-v1-"));
        assert!(value.len() > "sk-ar-v1-".len());
    }

    #[test]
    fn provision_openclaw_shared_strategy_reuses_project_key_and_persists_routing_metadata() {
        let temp = tempfile::tempdir().expect("temp dir");
        let _paths = resolve_paths_for_root(temp.path()).expect("paths");
        let service = build_test_service(temp.path());
        seed_provider(&service, "provider-openai-1");
        seed_model_mapping(&service, "model-mapping-openclaw");

        let bindings = service
            .provision_openclaw_instances(&ApiRouterInstallerOpenClawOptions {
                instance_ids: vec!["local-built-in".to_string(), "home-nas".to_string()],
                api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy::Shared,
                router_provider_id: Some("provider-openai-1".to_string()),
                model_mapping_id: Some("model-mapping-openclaw".to_string()),
            })
            .expect("provision shared openclaw");

        assert_eq!(bindings.len(), 2);
        assert!(bindings.iter().all(|binding| binding.endpoint == "http://127.0.0.1:8080/v1"));
        assert_eq!(bindings[0].api_key, bindings[1].api_key);
        assert_eq!(bindings[0].api_key_project_id, bindings[1].api_key_project_id);
        assert_eq!(
            bindings[0].selected_provider_id.as_deref(),
            Some("provider-openai-1")
        );
        assert_eq!(
            bindings[0].model_mapping_id.as_deref(),
            Some("model-mapping-openclaw")
        );

        let overlay = load_overlay_for_test(&service);
        assert_eq!(overlay.openclaw_projects.len(), 1);
        assert_eq!(overlay.openclaw_instances.len(), 2);
        assert_eq!(
            overlay
                .openclaw_instances
                .get("local-built-in")
                .expect("local overlay")
                .project_id,
            bindings[0].api_key_project_id
        );
        assert_eq!(
            overlay
                .openclaw_instances
                .get("home-nas")
                .expect("home overlay")
                .project_id,
            bindings[0].api_key_project_id
        );

        let conn = service.open_connection().expect("open connection");
        let gateway_rows = conn
            .query_row(
                "SELECT COUNT(*) FROM identity_gateway_api_keys WHERE project_id = ?1",
                params![bindings[0].api_key_project_id.as_str()],
                |row| row.get::<_, i64>(0),
            )
            .expect("gateway key count");
        assert_eq!(gateway_rows, 1);

        let (default_provider_id, ordered_provider_ids_json): (String, String) = conn
            .query_row(
                "SELECT default_provider_id, ordered_provider_ids_json
                 FROM project_routing_preferences
                 WHERE project_id = ?1",
                params![bindings[0].api_key_project_id.as_str()],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("routing preferences");
        assert_eq!(default_provider_id, "provider-openai-1");
        assert_eq!(ordered_provider_ids_json, "[\"provider-openai-1\"]");
    }

    #[test]
    fn provision_openclaw_per_instance_strategy_creates_distinct_projects_and_keys() {
        let temp = tempfile::tempdir().expect("temp dir");
        let _paths = resolve_paths_for_root(temp.path()).expect("paths");
        let service = build_test_service(temp.path());

        let bindings = service
            .provision_openclaw_instances(&ApiRouterInstallerOpenClawOptions {
                instance_ids: vec!["local-built-in".to_string(), "home-nas".to_string()],
                api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
                router_provider_id: None,
                model_mapping_id: None,
            })
            .expect("provision per-instance openclaw");

        assert_eq!(bindings.len(), 2);
        assert_ne!(bindings[0].api_key, bindings[1].api_key);
        assert_ne!(bindings[0].api_key_project_id, bindings[1].api_key_project_id);
        assert!(
            bindings
                .iter()
                .all(|binding| binding.api_key.starts_with("sk-ar-v1-"))
        );

        let overlay = load_overlay_for_test(&service);
        assert_eq!(overlay.openclaw_projects.len(), 2);
        assert_eq!(overlay.openclaw_instances.len(), 2);
        assert_eq!(
            overlay
                .openclaw_instances
                .get("local-built-in")
                .expect("local overlay")
                .api_key_strategy,
            ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance
        );
        assert_eq!(
            overlay
                .openclaw_instances
                .get("home-nas")
                .expect("home overlay")
                .api_key_strategy,
            ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance
        );

        let conn = service.open_connection().expect("open connection");
        let project_count = conn
            .query_row(
                "SELECT COUNT(DISTINCT project_id) FROM identity_gateway_api_keys",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("project count");
        let routing_count = conn
            .query_row(
                "SELECT COUNT(*) FROM project_routing_preferences",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("routing count");
        assert_eq!(project_count, 2);
        assert_eq!(routing_count, 0);
    }

    #[test]
    fn proxy_provider_channel_and_model_catalog_reads_use_admin_api_data() {
        let temp = tempfile::tempdir().expect("temp dir");
        let _paths = resolve_paths_for_root(temp.path()).expect("paths");
        let service = build_test_service_with_admin_client(
            temp.path(),
            Arc::new(MockApiRouterAdminClient {
                channels: vec![ChannelRow {
                    id: "openai".to_string(),
                    name: "OpenAI".to_string(),
                }],
                providers: vec![ProviderRow {
                    id: "provider-openai-admin".to_string(),
                    channel_id: "openai".to_string(),
                    base_url: "https://openai.example.com/v1".to_string(),
                    display_name: "Admin-backed OpenAI".to_string(),
                }],
                credentials: vec![CredentialRow {
                    tenant_id: "claw-studio".to_string(),
                    provider_id: "provider-openai-admin".to_string(),
                    key_reference: "api_key".to_string(),
                }],
                models: vec![ModelRow {
                    external_name: "gpt-5.4".to_string(),
                    provider_id: "provider-openai-admin".to_string(),
                }],
                usage_records: vec![UsageRow {
                    project_id: "project-shared".to_string(),
                    model: "gpt-5.4".to_string(),
                    provider_id: "provider-openai-admin".to_string(),
                    units: 2,
                    amount: 1.25,
                    input_tokens: 120,
                    output_tokens: 30,
                    total_tokens: 150,
                    created_at_ms: 1_700_000_000_000,
                }],
                ..MockApiRouterAdminClient::default()
            }),
        );
        let mut overlay = service.load_overlay().expect("load overlay");
        overlay.provider_locals.insert(
            "provider-openai-admin".to_string(),
            ProviderLocal {
                group_id: "team-ops".to_string(),
                status: Some("active".to_string()),
                expires_at: None,
                notes: Some("Synced from admin API".to_string()),
                api_key: Some("sk-provider-admin".to_string()),
                created_at: Some("2026-03-20T00:00:00Z".to_string()),
                model_names: BTreeMap::from([("gpt-5.4".to_string(), "GPT-5.4".to_string())]),
            },
        );
        service.persist_overlay(&overlay).expect("persist overlay");

        let providers = service
            .get_proxy_providers(ApiRouterProviderQuery::default())
            .expect("provider list");
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].get("id").and_then(Value::as_str), Some("provider-openai-admin"));
        assert_eq!(providers[0].get("name").and_then(Value::as_str), Some("Admin-backed OpenAI"));
        assert_eq!(providers[0].pointer("/usage/requestCount").and_then(Value::as_u64), Some(2));
        assert_eq!(providers[0].pointer("/models/0/modelId").and_then(Value::as_str), None);
        assert_eq!(providers[0].pointer("/models/0/id").and_then(Value::as_str), Some("gpt-5.4"));

        let channels = service.get_channels().expect("channel list");
        let openai = channels
            .iter()
            .find(|value| value.get("id") == Some(&Value::String("openai".to_string())))
            .expect("openai channel");
        assert_eq!(openai.get("providerCount").and_then(Value::as_u64), Some(1));
        assert_eq!(openai.get("activeProviderCount").and_then(Value::as_u64), Some(1));

        let model_catalog = service.get_model_catalog().expect("model catalog");
        let openai_catalog = model_catalog
            .iter()
            .find(|value| value.get("channelId") == Some(&Value::String("openai".to_string())))
            .expect("openai catalog");
        let models = openai_catalog
            .get("models")
            .and_then(Value::as_array)
            .expect("catalog models");
        assert!(models.iter().any(|item| {
            item.get("modelId") == Some(&Value::String("gpt-5.4".to_string()))
                && item.get("modelName") == Some(&Value::String("GPT-5.4".to_string()))
        }));
    }

    #[test]
    fn unified_key_and_usage_reads_use_admin_api_data() {
        let temp = tempfile::tempdir().expect("temp dir");
        let _paths = resolve_paths_for_root(temp.path()).expect("paths");
        let now_ms = super::now_epoch_millis().expect("now");
        let service = build_test_service_with_admin_client(
            temp.path(),
            Arc::new(MockApiRouterAdminClient {
                providers: vec![ProviderRow {
                    id: "provider-openai-admin".to_string(),
                    channel_id: "openai".to_string(),
                    base_url: "https://openai.example.com/v1".to_string(),
                    display_name: "Admin-backed OpenAI".to_string(),
                }],
                projects: vec![ProjectRow {
                    id: "project-openclaw-shared".to_string(),
                    name: "OpenClaw Shared Access".to_string(),
                }],
                api_keys: vec![GatewayApiKeyRow {
                    tenant_id: "claw-studio".to_string(),
                    project_id: "project-openclaw-shared".to_string(),
                    environment: "production".to_string(),
                    hashed_key: "hash-openclaw-shared".to_string(),
                    label: "OpenClaw shared gateway".to_string(),
                    notes: None,
                    created_at_ms: 1_700_000_100_000,
                    last_used_at_ms: None,
                    expires_at_ms: None,
                    active: true,
                }],
                usage_records: vec![UsageRow {
                    project_id: "project-openclaw-shared".to_string(),
                    model: "gpt-4.1".to_string(),
                    provider_id: "provider-openai-admin".to_string(),
                    units: 1,
                    amount: 0.75,
                    input_tokens: 300,
                    output_tokens: 120,
                    total_tokens: 420,
                    created_at_ms: now_ms,
                }],
                ..MockApiRouterAdminClient::default()
            }),
        );
        let mut overlay = service.load_overlay().expect("load overlay");
        overlay.unified_key_locals.insert(
            "project-openclaw-shared".to_string(),
            UnifiedKeyLocal {
                group_id: "shared-core".to_string(),
                source: "system-generated".to_string(),
                status: Some("active".to_string()),
                model_mapping_id: Some("mapping-openclaw".to_string()),
                notes: Some("Shared router key".to_string()),
                plaintext_key: Some("sk-ar-v1-openclawshared".to_string()),
            },
        );
        service.persist_overlay(&overlay).expect("persist overlay");

        let unified_keys = service
            .get_unified_api_keys(super::ApiRouterUnifiedApiKeyQuery::default())
            .expect("unified api keys");
        assert_eq!(unified_keys.len(), 1);
        assert_eq!(
            unified_keys[0].get("id").and_then(Value::as_str),
            Some("project-openclaw-shared")
        );
        assert_eq!(
            unified_keys[0].get("name").and_then(Value::as_str),
            Some("OpenClaw Shared Access")
        );
        assert_eq!(
            unified_keys[0].get("apiKey").and_then(Value::as_str),
            Some("sk-ar-v1-openclawshared")
        );
        assert_eq!(
            unified_keys[0].pointer("/usage/tokenCount").and_then(Value::as_u64),
            Some(420)
        );

        let api_key_options = service.get_usage_record_api_keys().expect("usage key options");
        assert!(api_key_options.iter().any(|value| {
            value.get("id") == Some(&Value::String("project-openclaw-shared".to_string()))
                && value.get("label")
                    == Some(&Value::String("OpenClaw Shared Access".to_string()))
        }));

        let summary = service
            .get_usage_record_summary(ApiRouterUsageRecordsQuery::default())
            .expect("usage summary");
        assert_eq!(summary.get("totalRequests").and_then(Value::as_u64), Some(1));
        assert_eq!(summary.get("totalTokens").and_then(Value::as_u64), Some(420));
        assert_eq!(summary.get("totalSpendUsd").and_then(Value::as_f64), Some(0.75));

        let records = service
            .get_usage_records(ApiRouterUsageRecordsQuery::default())
            .expect("usage records");
        assert_eq!(records.get("total").and_then(Value::as_u64), Some(1));
        let items = records
            .get("items")
            .and_then(Value::as_array)
            .expect("usage items");
        assert_eq!(items.len(), 1);
        assert_eq!(
            items[0].get("apiKeyName").and_then(Value::as_str),
            Some("OpenClaw Shared Access")
        );
        assert_eq!(items[0].get("costUsd").and_then(Value::as_f64), Some(0.75));
    }
}
