use crate::framework::{paths::AppPaths, FrameworkError, Result};
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
use toml_edit::{value, DocumentMut, Item, Table};

const CODEX_PROVIDER_ID: &str = "api_router";
const OPENCODE_SCHEMA_URL: &str = "https://opencode.ai/config.json";
const CLAUDE_SETTINGS_SCHEMA_URL: &str = "https://json.schemastore.org/claude-code-settings.json";
const OPENAI_API_KEY_ENV_KEY: &str = "OPENAI_API_KEY";
const OPENAI_BASE_URL_ENV_KEY: &str = "OPENAI_BASE_URL";
const ANTHROPIC_AUTH_TOKEN_ENV_KEY: &str = "ANTHROPIC_AUTH_TOKEN";
const ANTHROPIC_BASE_URL_ENV_KEY: &str = "ANTHROPIC_BASE_URL";
const GEMINI_ENV_KEY: &str = "GEMINI_API_KEY";
const GOOGLE_GEMINI_BASE_URL_ENV_KEY: &str = "GOOGLE_GEMINI_BASE_URL";
const GEMINI_API_KEY_AUTH_MECHANISM_ENV_KEY: &str = "GEMINI_API_KEY_AUTH_MECHANISM";
const MANAGED_ENV_BLOCK_ID: &str = "claw-studio-api-router-env";

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ApiRouterInstallerClientId {
    Codex,
    ClaudeCode,
    Opencode,
    Openclaw,
    Gemini,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiRouterInstallerCompatibility {
    Openai,
    Anthropic,
    Gemini,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiRouterInstallerInstallMode {
    Standard,
    Env,
    Both,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiRouterInstallerEnvScope {
    User,
    System,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ApiRouterInstallerOpenClawApiKeyStrategy {
    Shared,
    PerInstance,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterInstallerModel {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterInstallerProvider {
    pub id: String,
    pub channel_id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub compatibility: ApiRouterInstallerCompatibility,
    pub models: Vec<ApiRouterInstallerModel>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterInstallerOpenClawOptions {
    pub instance_ids: Vec<String>,
    #[serde(default = "default_openclaw_api_key_strategy")]
    pub api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
    #[serde(default)]
    pub router_provider_id: Option<String>,
    #[serde(default)]
    pub model_mapping_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterClientInstallRequest {
    pub client_id: ApiRouterInstallerClientId,
    pub provider: ApiRouterInstallerProvider,
    pub install_mode: Option<ApiRouterInstallerInstallMode>,
    pub env_scope: Option<ApiRouterInstallerEnvScope>,
    pub open_claw: Option<ApiRouterInstallerOpenClawOptions>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiRouterInstalledFileAction {
    Created,
    Updated,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterInstalledFile {
    pub path: String,
    pub action: ApiRouterInstalledFileAction,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApiRouterInstalledEnvironmentShell {
    Powershell,
    Sh,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterInstalledEnvironment {
    pub scope: ApiRouterInstallerEnvScope,
    pub shell: ApiRouterInstalledEnvironmentShell,
    pub target: String,
    pub variables: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterClientInstallResult {
    pub client_id: ApiRouterInstallerClientId,
    pub written_files: Vec<ApiRouterInstalledFile>,
    pub updated_environments: Vec<ApiRouterInstalledEnvironment>,
    pub updated_instance_ids: Vec<String>,
    pub open_claw_instances: Vec<ApiRouterInstalledOpenClawInstance>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterInstalledOpenClawInstance {
    pub instance_id: String,
    pub endpoint: String,
    pub api_key: String,
    pub api_key_project_id: String,
    pub api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
    pub selected_provider_id: Option<String>,
    pub model_mapping_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct InstallerRuntime {
    home_dir: PathBuf,
    platform: InstallPlatform,
    system_env_dir: PathBuf,
}

#[derive(Clone, Debug, Default)]
pub struct ApiRouterInstallerService;

impl ApiRouterInstallerService {
    pub fn new() -> Self {
        Self
    }

    pub fn install_client_setup(
        &self,
        paths: &AppPaths,
        request: ApiRouterClientInstallRequest,
    ) -> Result<ApiRouterClientInstallResult> {
        let runtime = InstallerRuntime::from_env()?;
        self.install_client_setup_with_runtime(paths, request, &runtime)
    }

    pub fn install_openclaw_instances(
        &self,
        paths: &AppPaths,
        request: ApiRouterClientInstallRequest,
        open_claw_instances: Vec<ApiRouterInstalledOpenClawInstance>,
    ) -> Result<ApiRouterClientInstallResult> {
        validate_request(&request)?;

        if request.client_id != ApiRouterInstallerClientId::Openclaw {
            return Err(FrameworkError::ValidationFailed(
                "resolved OpenClaw bindings can only be installed for the OpenClaw client"
                    .to_string(),
            ));
        }

        install_openclaw(&request, paths, open_claw_instances)
    }

    fn install_client_setup_with_runtime(
        &self,
        paths: &AppPaths,
        request: ApiRouterClientInstallRequest,
        runtime: &InstallerRuntime,
    ) -> Result<ApiRouterClientInstallResult> {
        validate_request(&request)?;

        match request.client_id {
            ApiRouterInstallerClientId::Codex => install_codex(&request, runtime),
            ApiRouterInstallerClientId::ClaudeCode => install_claude_code(&request, runtime),
            ApiRouterInstallerClientId::Opencode => install_opencode(&request, runtime),
            ApiRouterInstallerClientId::Openclaw => {
                install_openclaw(&request, paths, build_default_openclaw_instances(&request)?)
            }
            ApiRouterInstallerClientId::Gemini => install_gemini(&request, runtime),
        }
    }
}

fn default_openclaw_api_key_strategy() -> ApiRouterInstallerOpenClawApiKeyStrategy {
    ApiRouterInstallerOpenClawApiKeyStrategy::Shared
}

impl Default for ApiRouterInstallerOpenClawApiKeyStrategy {
    fn default() -> Self {
        default_openclaw_api_key_strategy()
    }
}

impl InstallerRuntime {
    fn from_env() -> Result<Self> {
        let platform = current_install_platform();
        Ok(Self {
            home_dir: resolve_home_dir()?,
            platform,
            system_env_dir: resolve_system_env_dir(platform),
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ModelRole {
    Primary,
    Reasoning,
    Embedding,
    Fallback,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)]
enum InstallPlatform {
    Windows,
    Macos,
    Linux,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawProviderManifest {
    id: String,
    instance_id: String,
    name: String,
    provider: String,
    endpoint: String,
    api_key_source: String,
    status: String,
    default_model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    embedding_model_id: Option<String>,
    description: String,
    icon: String,
    last_checked_at: String,
    capabilities: Vec<String>,
    models: Vec<OpenClawProviderModel>,
    config: OpenClawProviderConfig,
    router_config: OpenClawRouterConfig,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawProviderModel {
    id: String,
    name: String,
    role: String,
    context_window: String,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawProviderConfig {
    temperature: f64,
    top_p: f64,
    max_tokens: u64,
    timeout_ms: u64,
    streaming: bool,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawRouterConfig {
    gateway_base_url: String,
    api_key_project_id: String,
    api_key_strategy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    selected_provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model_mapping_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct EnvVariableAssignment {
    key: String,
    value: String,
}

fn resolve_install_mode(
    request: &ApiRouterClientInstallRequest,
) -> ApiRouterInstallerInstallMode {
    request.install_mode.unwrap_or(match request.client_id {
        ApiRouterInstallerClientId::Gemini => ApiRouterInstallerInstallMode::Standard,
        ApiRouterInstallerClientId::Codex
        | ApiRouterInstallerClientId::ClaudeCode
        | ApiRouterInstallerClientId::Opencode
        | ApiRouterInstallerClientId::Openclaw => ApiRouterInstallerInstallMode::Standard,
    })
}

fn resolve_env_scope(request: &ApiRouterClientInstallRequest) -> ApiRouterInstallerEnvScope {
    request.env_scope.unwrap_or(ApiRouterInstallerEnvScope::User)
}

fn supports_install_mode(
    client_id: &ApiRouterInstallerClientId,
    mode: ApiRouterInstallerInstallMode,
) -> bool {
    match client_id {
        ApiRouterInstallerClientId::Codex
        | ApiRouterInstallerClientId::ClaudeCode
        | ApiRouterInstallerClientId::Opencode => {
            matches!(
                mode,
                ApiRouterInstallerInstallMode::Standard
                    | ApiRouterInstallerInstallMode::Env
                    | ApiRouterInstallerInstallMode::Both
            )
        }
        ApiRouterInstallerClientId::Gemini => {
            matches!(
                mode,
                ApiRouterInstallerInstallMode::Standard
                    | ApiRouterInstallerInstallMode::Env
                    | ApiRouterInstallerInstallMode::Both
            )
        }
        ApiRouterInstallerClientId::Openclaw => mode == ApiRouterInstallerInstallMode::Standard,
    }
}

fn uses_google_hosted_gemini_endpoint(base_url: &str) -> bool {
    base_url.to_ascii_lowercase().contains("googleapis.com")
}

fn resolve_gemini_auth_mechanism(base_url: &str) -> &'static str {
    if uses_google_hosted_gemini_endpoint(base_url) {
        "x-goog-api-key"
    } else {
        "bearer"
    }
}

fn build_environment_variables(
    request: &ApiRouterClientInstallRequest,
) -> Vec<EnvVariableAssignment> {
    match request.client_id {
        ApiRouterInstallerClientId::Codex => vec![
            EnvVariableAssignment {
                key: OPENAI_API_KEY_ENV_KEY.to_string(),
                value: request.provider.api_key.clone(),
            },
            EnvVariableAssignment {
                key: OPENAI_BASE_URL_ENV_KEY.to_string(),
                value: request.provider.base_url.clone(),
            },
        ],
        ApiRouterInstallerClientId::ClaudeCode => vec![
            EnvVariableAssignment {
                key: ANTHROPIC_AUTH_TOKEN_ENV_KEY.to_string(),
                value: request.provider.api_key.clone(),
            },
            EnvVariableAssignment {
                key: ANTHROPIC_BASE_URL_ENV_KEY.to_string(),
                value: request.provider.base_url.clone(),
            },
        ],
        ApiRouterInstallerClientId::Opencode => match request.provider.compatibility {
            ApiRouterInstallerCompatibility::Anthropic => vec![
                EnvVariableAssignment {
                    key: ANTHROPIC_AUTH_TOKEN_ENV_KEY.to_string(),
                    value: request.provider.api_key.clone(),
                },
                EnvVariableAssignment {
                    key: ANTHROPIC_BASE_URL_ENV_KEY.to_string(),
                    value: request.provider.base_url.clone(),
                },
            ],
            ApiRouterInstallerCompatibility::Openai => vec![
                EnvVariableAssignment {
                    key: OPENAI_API_KEY_ENV_KEY.to_string(),
                    value: request.provider.api_key.clone(),
                },
                EnvVariableAssignment {
                    key: OPENAI_BASE_URL_ENV_KEY.to_string(),
                    value: request.provider.base_url.clone(),
                },
            ],
            ApiRouterInstallerCompatibility::Gemini => Vec::new(),
        },
        ApiRouterInstallerClientId::Gemini => vec![
            EnvVariableAssignment {
                key: GEMINI_ENV_KEY.to_string(),
                value: request.provider.api_key.clone(),
            },
            EnvVariableAssignment {
                key: GOOGLE_GEMINI_BASE_URL_ENV_KEY.to_string(),
                value: request.provider.base_url.clone(),
            },
            EnvVariableAssignment {
                key: GEMINI_API_KEY_AUTH_MECHANISM_ENV_KEY.to_string(),
                value: resolve_gemini_auth_mechanism(request.provider.base_url.as_str()).to_string(),
            },
        ],
        ApiRouterInstallerClientId::Openclaw => Vec::new(),
    }
}

fn validate_request(request: &ApiRouterClientInstallRequest) -> Result<()> {
    validate_provider(&request.provider)?;
    let install_mode = resolve_install_mode(request);

    if !supports_install_mode(&request.client_id, install_mode) {
        return Err(FrameworkError::ValidationFailed(format!(
            "requested install mode {:?} is unavailable for {:?}",
            install_mode, request.client_id
        )));
    }

    match request.client_id {
        ApiRouterInstallerClientId::ClaudeCode => {
            if request.provider.compatibility != ApiRouterInstallerCompatibility::Anthropic {
                return Err(FrameworkError::ValidationFailed(
                    "Claude Code requires an anthropic-compatible provider".to_string(),
                ));
            }
        }
        ApiRouterInstallerClientId::Codex => {
            if request.provider.compatibility != ApiRouterInstallerCompatibility::Openai {
                return Err(FrameworkError::ValidationFailed(
                    "Codex requires an openai-compatible provider".to_string(),
                ));
            }
        }
        ApiRouterInstallerClientId::Opencode => {}
        ApiRouterInstallerClientId::Openclaw => {
            let open_claw = request.open_claw.as_ref().ok_or_else(|| {
                FrameworkError::ValidationFailed(
                    "OpenClaw installation requires instance selections".to_string(),
                )
            })?;

            if open_claw.instance_ids.is_empty() {
                return Err(FrameworkError::ValidationFailed(
                    "OpenClaw installation requires at least one instance".to_string(),
                ));
            }

            for instance_id in &open_claw.instance_ids {
                if instance_id.trim().is_empty() {
                    return Err(FrameworkError::ValidationFailed(
                        "OpenClaw instance identifiers must not be empty".to_string(),
                    ));
                }
            }

            if open_claw
                .router_provider_id
                .as_deref()
                .is_some_and(|value| value.trim().is_empty())
            {
                return Err(FrameworkError::ValidationFailed(
                    "OpenClaw router provider id must not be blank".to_string(),
                ));
            }

            if open_claw
                .model_mapping_id
                .as_deref()
                .is_some_and(|value| value.trim().is_empty())
            {
                return Err(FrameworkError::ValidationFailed(
                    "OpenClaw model mapping id must not be blank".to_string(),
                ));
            }
        }
        ApiRouterInstallerClientId::Gemini => {
            if request.provider.compatibility != ApiRouterInstallerCompatibility::Gemini {
                return Err(FrameworkError::ValidationFailed(
                    "Gemini CLI requires a gemini-compatible provider".to_string(),
                ));
            }
        }
    }

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Env | ApiRouterInstallerInstallMode::Both
    ) && build_environment_variables(request).is_empty()
    {
        return Err(FrameworkError::ValidationFailed(
            "requested environment installation does not have any variables to persist"
                .to_string(),
        ));
    }

    Ok(())
}

fn validate_provider(provider: &ApiRouterInstallerProvider) -> Result<()> {
    if provider.id.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider id must not be empty".to_string(),
        ));
    }

    if provider.channel_id.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider channel id must not be empty".to_string(),
        ));
    }

    if provider.name.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider name must not be empty".to_string(),
        ));
    }

    if provider.base_url.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider base url must not be empty".to_string(),
        ));
    }

    if provider.api_key.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider api key must not be empty".to_string(),
        ));
    }

    if provider.models.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "provider must include at least one model".to_string(),
        ));
    }

    for model in &provider.models {
        if model.id.trim().is_empty() || model.name.trim().is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "every provider model must include both id and name".to_string(),
            ));
        }
    }

    Ok(())
}

fn resolve_codex_active_profile(config: &DocumentMut) -> Option<String> {
    config
        .as_table()
        .get("profile")
        .and_then(Item::as_value)
        .and_then(toml_edit::Value::as_str)
        .map(str::trim)
        .filter(|profile_name| !profile_name.is_empty())
        .map(ToOwned::to_owned)
}

fn ensure_toml_table<'a>(
    parent: &'a mut Table,
    key: &str,
    error_message: &str,
) -> Result<&'a mut Table> {
    if !parent.contains_key(key) {
        parent.insert(key, Item::Table(Table::new()));
    }

    parent
        .get_mut(key)
        .and_then(Item::as_table_mut)
        .ok_or_else(|| FrameworkError::Internal(error_message.to_string()))
}

fn upsert_codex_model_selection(config: &mut DocumentMut, model_id: &str) -> Result<()> {
    let active_profile = resolve_codex_active_profile(config);

    if let Some(profile_name) = active_profile {
        let should_remove_shared_defaults = config
            .as_table()
            .get("model_provider")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str)
            == Some(CODEX_PROVIDER_ID);

        let profiles = ensure_toml_table(
            config.as_table_mut(),
            "profiles",
            "codex profiles table could not be materialized",
        )?;
        let profile = ensure_toml_table(
            profiles,
            profile_name.as_str(),
            "codex active profile table could not be materialized",
        )?;

        profile["model"] = value(model_id);
        profile["model_provider"] = value(CODEX_PROVIDER_ID);

        if should_remove_shared_defaults {
            let root = config.as_table_mut();
            root.remove("model");
            root.remove("model_provider");
        }

        return Ok(());
    }

    config["model"] = value(model_id);
    config["model_provider"] = value(CODEX_PROVIDER_ID);

    Ok(())
}

fn install_codex(
    request: &ApiRouterClientInstallRequest,
    runtime: &InstallerRuntime,
) -> Result<ApiRouterClientInstallResult> {
    let install_mode = resolve_install_mode(request);
    let mut written_files = Vec::new();
    let mut updated_environments = Vec::new();

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Standard | ApiRouterInstallerInstallMode::Both
    ) {
        let primary_model = primary_model(&request.provider)?;
        let config_path = runtime.home_dir.join(".codex").join("config.toml");
        let auth_path = runtime.home_dir.join(".codex").join("auth.json");
        let mut config = load_toml_document(&config_path)?;

        upsert_codex_model_selection(&mut config, primary_model.id.as_str())?;

        let model_providers = ensure_toml_table(
            config.as_table_mut(),
            "model_providers",
            "codex model providers table could not be materialized",
        )?;
        let provider_table = ensure_toml_table(
            model_providers,
            CODEX_PROVIDER_ID,
            "codex model provider configuration could not be materialized",
        )?;

        provider_table["name"] = value(request.provider.name.as_str());
        provider_table["base_url"] = value(request.provider.base_url.as_str());
        provider_table["wire_api"] = value("responses");
        provider_table["requires_openai_auth"] = value(true);
        provider_table.remove("env_key");

        let config_content = format!("{}\n", config);
        let auth_content = serialize_json_value(&Value::Object(Map::from_iter([
            (
                "auth_mode".to_string(),
                Value::String("apikey".to_string()),
            ),
            (
                "OPENAI_API_KEY".to_string(),
                Value::String(request.provider.api_key.clone()),
            ),
        ])))?;
        written_files.push(write_text_file(&config_path, &config_content)?);
        written_files.push(write_text_file(&auth_path, &auth_content)?);
    }

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Env | ApiRouterInstallerInstallMode::Both
    ) {
        let (env_files, env_targets) = install_environment_variables(request, runtime)?;
        written_files.extend(env_files);
        updated_environments.extend(env_targets);
    }

    Ok(ApiRouterClientInstallResult {
        client_id: ApiRouterInstallerClientId::Codex,
        written_files,
        updated_environments,
        updated_instance_ids: Vec::new(),
        open_claw_instances: Vec::new(),
    })
}

fn install_claude_code(
    request: &ApiRouterClientInstallRequest,
    runtime: &InstallerRuntime,
) -> Result<ApiRouterClientInstallResult> {
    let install_mode = resolve_install_mode(request);
    let mut written_files = Vec::new();
    let mut updated_environments = Vec::new();

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Standard | ApiRouterInstallerInstallMode::Both
    ) {
        let primary_model = primary_model(&request.provider)?;
        let settings_path = runtime.home_dir.join(".claude").join("settings.json");
        let (mut settings, _) = load_json_object(&settings_path, false)?;

        settings.insert(
            "$schema".to_string(),
            Value::String(CLAUDE_SETTINGS_SCHEMA_URL.to_string()),
        );
        settings.insert("model".to_string(), Value::String(primary_model.id.clone()));

        let env = ensure_object_field(&mut settings, "env")?;
        env.insert(
            ANTHROPIC_AUTH_TOKEN_ENV_KEY.to_string(),
            Value::String(request.provider.api_key.clone()),
        );
        env.insert(
            ANTHROPIC_BASE_URL_ENV_KEY.to_string(),
            Value::String(request.provider.base_url.clone()),
        );

        let content = serialize_json_object(settings)?;
        written_files.push(write_text_file(&settings_path, &content)?);
    }

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Env | ApiRouterInstallerInstallMode::Both
    ) {
        let (env_files, env_targets) = install_environment_variables(request, runtime)?;
        written_files.extend(env_files);
        updated_environments.extend(env_targets);
    }

    Ok(ApiRouterClientInstallResult {
        client_id: ApiRouterInstallerClientId::ClaudeCode,
        written_files,
        updated_environments,
        updated_instance_ids: Vec::new(),
        open_claw_instances: Vec::new(),
    })
}

fn install_opencode(
    request: &ApiRouterClientInstallRequest,
    runtime: &InstallerRuntime,
) -> Result<ApiRouterClientInstallResult> {
    let install_mode = resolve_install_mode(request);
    let mut written_files = Vec::new();
    let mut updated_environments = Vec::new();

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Standard | ApiRouterInstallerInstallMode::Both
    ) {
        let primary_model = primary_model(&request.provider)?;
        let config_path = resolve_opencode_config_path(&runtime.home_dir);
        let auth_path = resolve_opencode_auth_path(&runtime.home_dir);
        let allow_comments = config_path
            .extension()
            .map(|value| value.to_string_lossy().eq_ignore_ascii_case("jsonc"))
            .unwrap_or(false);
        let (mut config, _) = load_json_object(&config_path, allow_comments)?;
        let (mut auth_store, _) = load_json_object(&auth_path, false)?;

        config.insert(
            "$schema".to_string(),
            Value::String(OPENCODE_SCHEMA_URL.to_string()),
        );

        let providers = ensure_object_field(&mut config, "provider")?;
        let auth_provider_key = match request.provider.compatibility {
            ApiRouterInstallerCompatibility::Openai => {
                let api_router_provider = ensure_object_field(providers, "api-router")?;
                api_router_provider.insert(
                    "npm".to_string(),
                    Value::String(opencode_openai_provider_package(
                        request.provider.channel_id.as_str(),
                    )
                    .to_string()),
                );
                api_router_provider.insert(
                    "name".to_string(),
                    Value::String(request.provider.name.clone()),
                );

                let options = ensure_object_field(api_router_provider, "options")?;
                options.insert(
                    "baseURL".to_string(),
                    Value::String(request.provider.base_url.clone()),
                );
                options.remove("apiKey");

                let models = ensure_object_field(api_router_provider, "models")?;
                merge_opencode_models(models, &request.provider.models, &request.provider.name)?;
                config.insert(
                    "model".to_string(),
                    Value::String(format!("api-router/{}", primary_model.id)),
                );
                "api-router"
            }
            ApiRouterInstallerCompatibility::Anthropic => {
                let anthropic_provider = ensure_object_field(providers, "anthropic")?;
                let options = ensure_object_field(anthropic_provider, "options")?;
                options.insert(
                    "baseURL".to_string(),
                    Value::String(request.provider.base_url.clone()),
                );
                options.remove("apiKey");

                let models = ensure_object_field(anthropic_provider, "models")?;
                merge_opencode_models(models, &request.provider.models, &request.provider.name)?;
                config.insert(
                    "model".to_string(),
                    Value::String(format!("anthropic/{}", primary_model.id)),
                );
                "anthropic"
            }
            ApiRouterInstallerCompatibility::Gemini => {
                return Err(FrameworkError::ValidationFailed(
                    "OpenCode requires an openai-compatible or anthropic-compatible provider"
                        .to_string(),
                ));
            }
        };

        let auth_entry = ensure_object_field(&mut auth_store, auth_provider_key)?;
        auth_entry.insert("type".to_string(), Value::String("api".to_string()));
        auth_entry.insert(
            "key".to_string(),
            Value::String(request.provider.api_key.clone()),
        );

        let content = serialize_json_object(config)?;
        let auth_content = serialize_json_object(auth_store)?;
        written_files.push(write_text_file(&config_path, &content)?);
        written_files.push(write_text_file(&auth_path, &auth_content)?);
    }

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Env | ApiRouterInstallerInstallMode::Both
    ) {
        let (env_files, env_targets) = install_environment_variables(request, runtime)?;
        written_files.extend(env_files);
        updated_environments.extend(env_targets);
    }

    Ok(ApiRouterClientInstallResult {
        client_id: ApiRouterInstallerClientId::Opencode,
        written_files,
        updated_environments,
        updated_instance_ids: Vec::new(),
        open_claw_instances: Vec::new(),
    })
}

fn install_gemini(
    request: &ApiRouterClientInstallRequest,
    runtime: &InstallerRuntime,
) -> Result<ApiRouterClientInstallResult> {
    let install_mode = resolve_install_mode(request);
    let mut written_files = Vec::new();
    let mut updated_environments = Vec::new();

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Standard | ApiRouterInstallerInstallMode::Both
    ) {
        let primary_model = primary_model(&request.provider)?;
        let settings_path = runtime.home_dir.join(".gemini").join("settings.json");
        let env_path = runtime.home_dir.join(".gemini").join(".env");
        let (mut settings, _) = load_json_object(&settings_path, false)?;

        let model = ensure_object_field(&mut settings, "model")?;
        model.insert("name".to_string(), Value::String(primary_model.id.clone()));

        let security = ensure_object_field(&mut settings, "security")?;
        let auth = ensure_object_field(security, "auth")?;
        auth.insert(
            "selectedType".to_string(),
            Value::String("gemini-api-key".to_string()),
        );

        let settings_content = serialize_json_object(settings)?;
        written_files.push(write_text_file(&settings_path, &settings_content)?);
        written_files.push(write_text_file(
            &env_path,
            &render_sh_env_file(&build_environment_variables(request)),
        )?);
    }

    if matches!(
        install_mode,
        ApiRouterInstallerInstallMode::Env | ApiRouterInstallerInstallMode::Both
    ) {
        let (env_files, env_targets) = install_environment_variables(request, runtime)?;
        written_files.extend(env_files);
        updated_environments.extend(env_targets);
    }

    Ok(ApiRouterClientInstallResult {
        client_id: ApiRouterInstallerClientId::Gemini,
        written_files,
        updated_environments,
        updated_instance_ids: Vec::new(),
        open_claw_instances: Vec::new(),
    })
}

fn install_openclaw(
    request: &ApiRouterClientInstallRequest,
    paths: &AppPaths,
    open_claw_instances: Vec<ApiRouterInstalledOpenClawInstance>,
) -> Result<ApiRouterClientInstallResult> {
    let open_claw = request.open_claw.as_ref().ok_or_else(|| {
        FrameworkError::ValidationFailed("OpenClaw installation requires instances".to_string())
    })?;
    validate_openclaw_instances(open_claw, &open_claw_instances)?;
    let mut written_files = Vec::new();

    for open_claw_instance in &open_claw_instances {
        let path = paths
            .integrations_dir
            .join("openclaw")
            .join("instances")
            .join(open_claw_instance.instance_id.as_str())
            .join("providers")
            .join(format!("provider-api-router-{}.json", request.provider.id));
        let manifest = build_openclaw_provider_manifest(&request.provider, open_claw_instance)?;
        let content = serialize_json_value(&serde_json::to_value(manifest)?)?;
        written_files.push(write_text_file(&path, &content)?);
    }

    Ok(ApiRouterClientInstallResult {
        client_id: ApiRouterInstallerClientId::Openclaw,
        written_files,
        updated_environments: Vec::new(),
        updated_instance_ids: open_claw.instance_ids.clone(),
        open_claw_instances,
    })
}

fn build_openclaw_provider_manifest(
    provider: &ApiRouterInstallerProvider,
    open_claw_instance: &ApiRouterInstalledOpenClawInstance,
) -> Result<OpenClawProviderManifest> {
    let primary_model = primary_model(provider)?;
    let reasoning_model_id = infer_reasoning_model_id(&provider.models);
    let embedding_model_id = infer_embedding_model_id(&provider.models);

    let models = provider
        .models
        .iter()
        .map(|model| {
            let role = infer_model_role(
                model.id.as_str(),
                primary_model.id.as_str(),
                reasoning_model_id.as_deref(),
                embedding_model_id.as_deref(),
            );

            OpenClawProviderModel {
                id: model.id.clone(),
                name: model.name.clone(),
                role: role_to_string(role).to_string(),
                context_window: infer_model_context_window(role).to_string(),
            }
        })
        .collect();

    Ok(OpenClawProviderManifest {
        id: format!("provider-api-router-{}", provider.id),
        instance_id: open_claw_instance.instance_id.clone(),
        name: provider.name.clone(),
        provider: "api-router".to_string(),
        endpoint: open_claw_instance.endpoint.clone(),
        api_key_source: open_claw_instance.api_key.clone(),
        status: "ready".to_string(),
        default_model_id: primary_model.id.clone(),
        reasoning_model_id,
        embedding_model_id,
        description: format!("Managed from API Router using {}.", provider.name),
        icon: get_openclaw_icon(provider.channel_id.as_str()).to_string(),
        last_checked_at: "just now".to_string(),
        capabilities: vec![
            "API Router".to_string(),
            "Managed Route".to_string(),
            "OpenClaw".to_string(),
        ],
        models,
        config: OpenClawProviderConfig {
            temperature: 0.2,
            top_p: 1.0,
            max_tokens: 8192,
            timeout_ms: 60_000,
            streaming: true,
        },
        router_config: OpenClawRouterConfig {
            gateway_base_url: open_claw_instance.endpoint.clone(),
            api_key_project_id: open_claw_instance.api_key_project_id.clone(),
            api_key_strategy: openclaw_api_key_strategy_to_string(
                open_claw_instance.api_key_strategy,
            )
            .to_string(),
            selected_provider_id: open_claw_instance.selected_provider_id.clone(),
            model_mapping_id: open_claw_instance.model_mapping_id.clone(),
        },
    })
}

fn build_default_openclaw_instances(
    request: &ApiRouterClientInstallRequest,
) -> Result<Vec<ApiRouterInstalledOpenClawInstance>> {
    let open_claw = request.open_claw.as_ref().ok_or_else(|| {
        FrameworkError::ValidationFailed("OpenClaw installation requires instances".to_string())
    })?;
    let selected_provider_id =
        normalize_optional_string_value(open_claw.router_provider_id.as_deref());
    let model_mapping_id =
        normalize_optional_string_value(open_claw.model_mapping_id.as_deref());
    let shared_project_id = build_openclaw_project_id(None, open_claw.api_key_strategy);

    Ok(open_claw
        .instance_ids
        .iter()
        .map(|instance_id| ApiRouterInstalledOpenClawInstance {
            instance_id: instance_id.clone(),
            endpoint: request.provider.base_url.clone(),
            api_key: request.provider.api_key.clone(),
            api_key_project_id: match open_claw.api_key_strategy {
                ApiRouterInstallerOpenClawApiKeyStrategy::Shared => shared_project_id.clone(),
                ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => {
                    build_openclaw_project_id(
                        Some(instance_id.as_str()),
                        ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
                    )
                }
            },
            api_key_strategy: open_claw.api_key_strategy,
            selected_provider_id: selected_provider_id.clone(),
            model_mapping_id: model_mapping_id.clone(),
        })
        .collect())
}

fn validate_openclaw_instances(
    options: &ApiRouterInstallerOpenClawOptions,
    open_claw_instances: &[ApiRouterInstalledOpenClawInstance],
) -> Result<()> {
    use std::collections::BTreeSet;

    let expected = options
        .instance_ids
        .iter()
        .map(|value| value.trim().to_string())
        .collect::<BTreeSet<_>>();
    let actual = open_claw_instances
        .iter()
        .map(|value| value.instance_id.trim().to_string())
        .collect::<BTreeSet<_>>();

    if expected != actual {
        return Err(FrameworkError::ValidationFailed(
            "OpenClaw instance bindings must match the selected instance ids".to_string(),
        ));
    }

    for instance in open_claw_instances {
        if instance.endpoint.trim().is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "OpenClaw instance endpoint must not be empty".to_string(),
            ));
        }
        if instance.api_key.trim().is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "OpenClaw instance api key must not be empty".to_string(),
            ));
        }
        if instance.api_key_project_id.trim().is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "OpenClaw instance api key project id must not be empty".to_string(),
            ));
        }
    }

    Ok(())
}

fn build_openclaw_project_id(
    instance_id: Option<&str>,
    strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
) -> String {
    match strategy {
        ApiRouterInstallerOpenClawApiKeyStrategy::Shared => "project-openclaw-shared".to_string(),
        ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => format!(
            "project-openclaw-{}",
            sanitize_identifier(instance_id.unwrap_or("instance"))
        ),
    }
}

fn sanitize_identifier(value: &str) -> String {
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

fn normalize_optional_string_value(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn openclaw_api_key_strategy_to_string(
    strategy: ApiRouterInstallerOpenClawApiKeyStrategy,
) -> &'static str {
    match strategy {
        ApiRouterInstallerOpenClawApiKeyStrategy::Shared => "shared",
        ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance => "per-instance",
    }
}

fn resolve_home_dir() -> Result<PathBuf> {
    #[cfg(windows)]
    let candidates = ["USERPROFILE", "HOME"];
    #[cfg(not(windows))]
    let candidates = ["HOME"];

    for key in candidates {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(PathBuf::from(trimmed));
            }
        }
    }

    Err(FrameworkError::NotFound(
        "user home directory could not be resolved".to_string(),
    ))
}

fn current_install_platform() -> InstallPlatform {
    #[cfg(windows)]
    {
        InstallPlatform::Windows
    }

    #[cfg(target_os = "macos")]
    {
        InstallPlatform::Macos
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        InstallPlatform::Linux
    }
}

fn resolve_system_env_dir(platform: InstallPlatform) -> PathBuf {
    match platform {
        InstallPlatform::Windows => std::env::var("ProgramData")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData")),
        InstallPlatform::Macos | InstallPlatform::Linux => PathBuf::from("/etc/profile.d"),
    }
}

fn opencode_openai_provider_package(channel_id: &str) -> &'static str {
    if channel_id.eq_ignore_ascii_case("openai") {
        "@ai-sdk/openai"
    } else {
        "@ai-sdk/openai-compatible"
    }
}

fn resolve_opencode_config_path(home_dir: &Path) -> PathBuf {
    resolve_opencode_config_path_for_platform(home_dir, current_install_platform())
}

fn resolve_opencode_config_path_for_platform(
    home_dir: &Path,
    platform: InstallPlatform,
) -> PathBuf {
    let candidates = match platform {
        InstallPlatform::Windows => vec![
            home_dir
                .join(".config")
                .join("opencode")
                .join("opencode.jsonc"),
            home_dir
                .join(".config")
                .join("opencode")
                .join("opencode.json"),
            home_dir
                .join("AppData")
                .join("Roaming")
                .join("opencode")
                .join("opencode.jsonc"),
            home_dir
                .join("AppData")
                .join("Roaming")
                .join("opencode")
                .join("opencode.json"),
        ],
        InstallPlatform::Macos | InstallPlatform::Linux => vec![
            home_dir
                .join(".config")
                .join("opencode")
                .join("opencode.jsonc"),
            home_dir
                .join(".config")
                .join("opencode")
                .join("opencode.json"),
            home_dir
                .join(".local")
                .join("share")
                .join("opencode")
                .join("opencode.jsonc"),
            home_dir
                .join(".local")
                .join("share")
                .join("opencode")
                .join("opencode.json"),
        ],
    };

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    home_dir
        .join(".config")
        .join("opencode")
        .join("opencode.json")
}

fn resolve_opencode_auth_path(home_dir: &Path) -> PathBuf {
    resolve_opencode_auth_path_for_platform(home_dir, current_install_platform())
}

fn resolve_opencode_auth_path_for_platform(
    home_dir: &Path,
    platform: InstallPlatform,
) -> PathBuf {
    let official_path = home_dir
        .join(".local")
        .join("share")
        .join("opencode")
        .join("auth.json");

    if platform == InstallPlatform::Windows {
        let legacy_path = home_dir
            .join("AppData")
            .join("Roaming")
            .join("opencode")
            .join("auth.json");
        if legacy_path.exists() {
            return legacy_path;
        }
    }

    official_path
}

fn primary_model(provider: &ApiRouterInstallerProvider) -> Result<&ApiRouterInstallerModel> {
    provider.models.first().ok_or_else(|| {
        FrameworkError::ValidationFailed(
            "provider must include at least one model for installation".to_string(),
        )
    })
}

fn read_text_if_exists(path: &Path) -> Result<Option<String>> {
    if !path.exists() {
        return Ok(None);
    }

    Ok(Some(fs::read_to_string(path)?))
}

fn load_toml_document(path: &Path) -> Result<DocumentMut> {
    let Some(content) = read_text_if_exists(path)? else {
        return Ok(DocumentMut::new());
    };

    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Ok(DocumentMut::new());
    }

    trimmed.parse::<DocumentMut>().map_err(|error| {
        FrameworkError::Conflict(format!(
            "unable to merge existing Codex config at {}: {error}",
            path.display()
        ))
    })
}

fn load_json_object(path: &Path, allow_comments: bool) -> Result<(Map<String, Value>, bool)> {
    let Some(content) = read_text_if_exists(path)? else {
        return Ok((Map::new(), false));
    };

    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Ok((Map::new(), true));
    }

    let normalized = if allow_comments {
        strip_json_comments(trimmed)
    } else {
        trimmed.to_string()
    };

    let value: Value = serde_json::from_str(normalized.as_str()).map_err(|error| {
        FrameworkError::Conflict(format!(
            "unable to merge existing JSON config at {}: {error}",
            path.display()
        ))
    })?;

    match value {
        Value::Object(map) => Ok((map, true)),
        _ => Err(FrameworkError::Conflict(format!(
            "expected the root of {} to be a JSON object",
            path.display()
        ))),
    }
}

fn ensure_object_field<'a>(
    parent: &'a mut Map<String, Value>,
    key: &str,
) -> Result<&'a mut Map<String, Value>> {
    let needs_init = !matches!(parent.get(key), Some(Value::Object(_)));
    if needs_init {
        parent.insert(key.to_string(), Value::Object(Map::new()));
    }

    parent
        .get_mut(key)
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            FrameworkError::Internal(format!(
                "unable to materialize nested object field \"{key}\""
            ))
        })
}

fn serialize_json_object(map: Map<String, Value>) -> Result<String> {
    serialize_json_value(&Value::Object(map))
}

fn serialize_json_value(value: &Value) -> Result<String> {
    let mut content = serde_json::to_string_pretty(value)?;
    content.push('\n');
    Ok(content)
}

fn write_text_file(path: &Path, content: &str) -> Result<ApiRouterInstalledFile> {
    let existed = path.exists();

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(path, content)?;

    Ok(ApiRouterInstalledFile {
        path: path.to_string_lossy().into_owned(),
        action: if existed {
            ApiRouterInstalledFileAction::Updated
        } else {
            ApiRouterInstalledFileAction::Created
        },
    })
}

fn render_powershell_env_file(variables: &[EnvVariableAssignment]) -> String {
    let mut content = variables
        .iter()
        .map(|variable| {
            format!(
                "$env:{} = {}",
                variable.key,
                quote_env_value(variable.value.as_str())
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    content.push('\n');
    content
}

fn render_sh_env_file(variables: &[EnvVariableAssignment]) -> String {
    let mut content = variables
        .iter()
        .map(|variable| {
            format!(
                "export {}={}",
                variable.key,
                quote_env_value(variable.value.as_str())
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    content.push('\n');
    content
}

fn upsert_managed_block(existing: &str, block_id: &str, body: &str, newline: &str) -> String {
    let normalized_existing = existing.replace("\r\n", "\n");
    let start_marker = format!("# >>> {block_id} >>>");
    let end_marker = format!("# <<< {block_id} <<<");
    let block_body = body.trim_end_matches('\n');
    let block = format!("{start_marker}\n{block_body}\n{end_marker}\n");

    let output = match (
        normalized_existing.find(start_marker.as_str()),
        normalized_existing.find(end_marker.as_str()),
    ) {
        (Some(start_index), Some(end_index)) if end_index >= start_index => {
            let after_end = end_index + end_marker.len();
            let suffix = normalized_existing[after_end..]
                .trim_start_matches('\n')
                .to_string();
            let prefix = normalized_existing[..start_index]
                .trim_end_matches('\n')
                .to_string();
            if prefix.is_empty() {
                if suffix.is_empty() {
                    block.clone()
                } else {
                    format!("{block}\n{suffix}\n")
                }
            } else if suffix.is_empty() {
                format!("{prefix}\n\n{block}")
            } else {
                format!("{prefix}\n\n{block}\n{suffix}\n")
            }
        }
        _ => {
            let trimmed = normalized_existing.trim_end_matches('\n');
            if trimmed.is_empty() {
                block.clone()
            } else {
                format!("{trimmed}\n\n{block}")
            }
        }
    };

    if newline == "\r\n" {
        output.replace('\n', "\r\n")
    } else {
        output
    }
}

fn build_powershell_loader(env_path: &Path) -> String {
    let path = quote_env_value(&env_path.to_string_lossy());
    format!("if (Test-Path {path}) {{ . {path} }}")
}

fn build_sh_loader(env_path: &Path) -> String {
    let path = quote_env_value(&env_path.to_string_lossy());
    format!("[ -f {path} ] && . {path}")
}

fn write_profile_loader(path: &Path, loader: &str) -> Result<ApiRouterInstalledFile> {
    let existing = read_text_if_exists(path)?.unwrap_or_default();
    let newline = detect_newline_style(Some(existing.as_str()));
    let content = upsert_managed_block(existing.as_str(), MANAGED_ENV_BLOCK_ID, loader, newline);
    write_text_file(path, &content)
}

fn resolve_windows_user_env_path(home_dir: &Path) -> PathBuf {
    home_dir
        .join(".claw-studio")
        .join("api-router")
        .join("env.ps1")
}

fn resolve_windows_user_profile_path(home_dir: &Path) -> PathBuf {
    home_dir
        .join("Documents")
        .join("PowerShell")
        .join("Microsoft.PowerShell_profile.ps1")
}

fn resolve_windows_system_env_path(runtime: &InstallerRuntime) -> PathBuf {
    runtime
        .system_env_dir
        .join("claw-studio")
        .join("api-router-env.ps1")
}

fn resolve_windows_system_profile_path(runtime: &InstallerRuntime) -> PathBuf {
    runtime
        .system_env_dir
        .join("PowerShell")
        .join("profile.ps1")
}

fn resolve_unix_user_env_path(home_dir: &Path) -> PathBuf {
    home_dir
        .join(".config")
        .join("claw-studio")
        .join("api-router")
        .join("env.sh")
}

fn resolve_unix_user_profile_paths(runtime: &InstallerRuntime) -> Vec<PathBuf> {
    let mut paths = vec![runtime.home_dir.join(".profile")];
    let bashrc = runtime.home_dir.join(".bashrc");
    let zshrc = runtime.home_dir.join(".zshrc");

    if runtime.platform == InstallPlatform::Linux || bashrc.exists() {
        paths.push(bashrc);
    }

    if runtime.platform == InstallPlatform::Macos || zshrc.exists() {
        paths.push(zshrc);
    }

    paths
}

fn resolve_unix_system_env_path(runtime: &InstallerRuntime) -> PathBuf {
    runtime.system_env_dir.join("claw-studio-api-router.sh")
}

fn install_environment_variables(
    request: &ApiRouterClientInstallRequest,
    runtime: &InstallerRuntime,
) -> Result<(Vec<ApiRouterInstalledFile>, Vec<ApiRouterInstalledEnvironment>)> {
    let variables = build_environment_variables(request);
    if variables.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }

    let scope = resolve_env_scope(request);

    match runtime.platform {
        InstallPlatform::Windows => install_powershell_environment(
            runtime,
            scope,
            &variables,
        ),
        InstallPlatform::Macos | InstallPlatform::Linux => {
            install_sh_environment(runtime, scope, &variables)
        }
    }
}

fn install_powershell_environment(
    runtime: &InstallerRuntime,
    scope: ApiRouterInstallerEnvScope,
    variables: &[EnvVariableAssignment],
) -> Result<(Vec<ApiRouterInstalledFile>, Vec<ApiRouterInstalledEnvironment>)> {
    let env_path = match scope {
        ApiRouterInstallerEnvScope::User => resolve_windows_user_env_path(&runtime.home_dir),
        ApiRouterInstallerEnvScope::System => resolve_windows_system_env_path(runtime),
    };
    let profile_path = match scope {
        ApiRouterInstallerEnvScope::User => resolve_windows_user_profile_path(&runtime.home_dir),
        ApiRouterInstallerEnvScope::System => resolve_windows_system_profile_path(runtime),
    };
    let mut written_files = vec![write_text_file(&env_path, &render_powershell_env_file(variables))?];
    written_files.push(write_profile_loader(
        &profile_path,
        build_powershell_loader(&env_path).as_str(),
    )?);

    Ok((
        written_files,
        vec![ApiRouterInstalledEnvironment {
            scope,
            shell: ApiRouterInstalledEnvironmentShell::Powershell,
            target: env_path.to_string_lossy().into_owned(),
            variables: variables.iter().map(|variable| variable.key.clone()).collect(),
        }],
    ))
}

fn install_sh_environment(
    runtime: &InstallerRuntime,
    scope: ApiRouterInstallerEnvScope,
    variables: &[EnvVariableAssignment],
) -> Result<(Vec<ApiRouterInstalledFile>, Vec<ApiRouterInstalledEnvironment>)> {
    match scope {
        ApiRouterInstallerEnvScope::User => {
            let env_path = resolve_unix_user_env_path(&runtime.home_dir);
            let mut written_files =
                vec![write_text_file(&env_path, &render_sh_env_file(variables))?];
            let loader = build_sh_loader(&env_path);

            for profile_path in resolve_unix_user_profile_paths(runtime) {
                written_files.push(write_profile_loader(&profile_path, loader.as_str())?);
            }

            Ok((
                written_files,
                vec![ApiRouterInstalledEnvironment {
                    scope,
                    shell: ApiRouterInstalledEnvironmentShell::Sh,
                    target: env_path.to_string_lossy().into_owned(),
                    variables: variables.iter().map(|variable| variable.key.clone()).collect(),
                }],
            ))
        }
        ApiRouterInstallerEnvScope::System => {
            let env_path = resolve_unix_system_env_path(runtime);
            Ok((
                vec![write_text_file(&env_path, &render_sh_env_file(variables))?],
                vec![ApiRouterInstalledEnvironment {
                    scope,
                    shell: ApiRouterInstalledEnvironmentShell::Sh,
                    target: env_path.to_string_lossy().into_owned(),
                    variables: variables.iter().map(|variable| variable.key.clone()).collect(),
                }],
            ))
        }
    }
}

fn merge_opencode_models(
    target: &mut Map<String, Value>,
    models: &[ApiRouterInstallerModel],
    provider_name: &str,
) -> Result<()> {
    for model in models {
        let needs_init = !matches!(target.get(model.id.as_str()), Some(Value::Object(_)));
        if needs_init {
            target.insert(model.id.clone(), Value::Object(Map::new()));
        }

        let model_entry = target
            .get_mut(model.id.as_str())
            .and_then(Value::as_object_mut)
            .ok_or_else(|| {
                FrameworkError::Internal(format!(
                    "unable to materialize opencode model entry {}",
                    model.id
                ))
            })?;

        model_entry.insert(
            "name".to_string(),
            Value::String(format!("{provider_name} / {}", model.name)),
        );
    }

    Ok(())
}

fn detect_newline_style(existing: Option<&str>) -> &'static str {
    if existing
        .map(|value| value.contains("\r\n"))
        .unwrap_or(false)
        || cfg!(windows)
    {
        "\r\n"
    } else {
        "\n"
    }
}

fn quote_env_value(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn strip_json_comments(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaping = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some(character) = chars.next() {
        if in_line_comment {
            if character == '\n' {
                in_line_comment = false;
                output.push(character);
            }
            continue;
        }

        if in_block_comment {
            if character == '*' && chars.peek() == Some(&'/') {
                let _ = chars.next();
                in_block_comment = false;
            } else if character == '\n' {
                output.push(character);
            }
            continue;
        }

        if in_string {
            output.push(character);

            if escaping {
                escaping = false;
                continue;
            }

            if character == '\\' {
                escaping = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
            output.push(character);
            continue;
        }

        if character == '/' && chars.peek() == Some(&'/') {
            let _ = chars.next();
            in_line_comment = true;
            continue;
        }

        if character == '/' && chars.peek() == Some(&'*') {
            let _ = chars.next();
            in_block_comment = true;
            continue;
        }

        output.push(character);
    }

    output
}

fn infer_reasoning_model_id(models: &[ApiRouterInstallerModel]) -> Option<String> {
    let keywords = [
        "reason", "reasoner", "thinking", "r1", "o1", "o3", "o4", "t1", "k1", "opus",
    ];

    for model in models {
        let haystack = format!("{} {}", model.id, model.name).to_ascii_lowercase();
        if keywords.iter().any(|keyword| haystack.contains(keyword)) {
            return Some(model.id.clone());
        }
    }

    models.get(1).map(|model| model.id.clone())
}

fn infer_embedding_model_id(models: &[ApiRouterInstallerModel]) -> Option<String> {
    let keywords = ["embed", "embedding", "bge", "vector"];

    models
        .iter()
        .find(|model| {
            let haystack = format!("{} {}", model.id, model.name).to_ascii_lowercase();
            keywords.iter().any(|keyword| haystack.contains(keyword))
        })
        .map(|model| model.id.clone())
}

fn infer_model_role(
    model_id: &str,
    primary_model_id: &str,
    reasoning_model_id: Option<&str>,
    embedding_model_id: Option<&str>,
) -> ModelRole {
    if model_id == primary_model_id {
        ModelRole::Primary
    } else if embedding_model_id == Some(model_id) {
        ModelRole::Embedding
    } else if reasoning_model_id == Some(model_id) {
        ModelRole::Reasoning
    } else {
        ModelRole::Fallback
    }
}

fn infer_model_context_window(role: ModelRole) -> &'static str {
    match role {
        ModelRole::Embedding => "8K",
        ModelRole::Reasoning => "200K",
        ModelRole::Primary | ModelRole::Fallback => "128K",
    }
}

fn role_to_string(role: ModelRole) -> &'static str {
    match role {
        ModelRole::Primary => "primary",
        ModelRole::Reasoning => "reasoning",
        ModelRole::Embedding => "embedding",
        ModelRole::Fallback => "fallback",
    }
}

fn get_openclaw_icon(channel_id: &str) -> &'static str {
    match channel_id {
        "openai" => "OA",
        "anthropic" => "AT",
        "google" => "GG",
        "xai" => "XI",
        "deepseek" => "DS",
        "qwen" => "QW",
        "zhipu" => "ZP",
        "moonshot" => "KI",
        "minimax" => "MM",
        _ => "AR",
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ApiRouterClientInstallRequest, ApiRouterInstallerClientId, ApiRouterInstallerCompatibility,
        ApiRouterInstalledOpenClawInstance, ApiRouterInstallerEnvScope,
        ApiRouterInstallerInstallMode, ApiRouterInstallerModel,
        ApiRouterInstallerOpenClawApiKeyStrategy, ApiRouterInstallerOpenClawOptions,
        ApiRouterInstallerProvider, ApiRouterInstallerService, InstallPlatform, InstallerRuntime,
        resolve_unix_system_env_path, resolve_unix_user_env_path, resolve_windows_user_env_path,
        resolve_windows_user_profile_path,
        resolve_opencode_auth_path, resolve_opencode_auth_path_for_platform,
        resolve_opencode_config_path_for_platform,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use serde_json::Value;
    use std::{fs, path::PathBuf};
    use toml_edit::{DocumentMut, Item};

    fn build_runtime(home_dir: &std::path::Path) -> InstallerRuntime {
        InstallerRuntime {
            home_dir: home_dir.to_path_buf(),
            platform: InstallPlatform::Linux,
            system_env_dir: home_dir.join(".system-env"),
        }
    }

    fn build_runtime_for_platform(
        home_dir: &std::path::Path,
        platform: InstallPlatform,
    ) -> InstallerRuntime {
        InstallerRuntime {
            home_dir: home_dir.to_path_buf(),
            platform,
            system_env_dir: home_dir.join(".system-env"),
        }
    }

    fn expected_codex_auth_path(home_dir: &std::path::Path) -> std::path::PathBuf {
        home_dir.join(".codex").join("auth.json")
    }

    fn expected_opencode_auth_path(home_dir: &std::path::Path) -> std::path::PathBuf {
        resolve_opencode_auth_path(home_dir)
    }

    fn build_provider(
        compatibility: ApiRouterInstallerCompatibility,
    ) -> ApiRouterInstallerProvider {
        ApiRouterInstallerProvider {
            id: "provider-openai-1".to_string(),
            channel_id: match compatibility {
                ApiRouterInstallerCompatibility::Openai => "openai".to_string(),
                ApiRouterInstallerCompatibility::Anthropic => "anthropic".to_string(),
                ApiRouterInstallerCompatibility::Gemini => "google".to_string(),
            },
            name: "Global API Router".to_string(),
            base_url: match compatibility {
                ApiRouterInstallerCompatibility::Openai => {
                    "https://api-router.example.com/v1".to_string()
                }
                ApiRouterInstallerCompatibility::Anthropic => {
                    "https://api-router.example.com/anthropic".to_string()
                }
                ApiRouterInstallerCompatibility::Gemini => {
                    "https://generativelanguage.googleapis.com/v1beta".to_string()
                }
            },
            api_key: "sk-router-live-secret".to_string(),
            compatibility: compatibility.clone(),
            models: vec![
                match compatibility {
                    ApiRouterInstallerCompatibility::Gemini => ApiRouterInstallerModel {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    ApiRouterInstallerCompatibility::Openai
                    | ApiRouterInstallerCompatibility::Anthropic => ApiRouterInstallerModel {
                        id: "gpt-4.1-mini".to_string(),
                        name: "GPT-4.1 Mini".to_string(),
                    },
                },
                ApiRouterInstallerModel {
                    id: "text-embedding-3-large".to_string(),
                    name: "Text Embedding 3 Large".to_string(),
                },
            ],
        }
    }

    fn build_request(
        client_id: ApiRouterInstallerClientId,
        compatibility: ApiRouterInstallerCompatibility,
    ) -> ApiRouterClientInstallRequest {
        ApiRouterClientInstallRequest {
            client_id,
            provider: build_provider(compatibility),
            install_mode: None,
            env_scope: None,
            open_claw: None,
        }
    }

    #[test]
    fn installs_codex_config_and_auth_json_for_api_key_flow() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();

        let result = service
            .install_client_setup_with_runtime(
                &paths,
                build_request(
                    ApiRouterInstallerClientId::Codex,
                    ApiRouterInstallerCompatibility::Openai,
                ),
                &runtime,
            )
            .expect("codex install");

        assert_eq!(result.written_files.len(), 2);

        let config_path = home.join(".codex").join("config.toml");
        let auth_path = expected_codex_auth_path(&home);
        let config = fs::read_to_string(&config_path).expect("codex config");
        let auth: Value =
            serde_json::from_str(&fs::read_to_string(&auth_path).expect("auth content"))
                .expect("auth json");

        assert!(config.contains("model_provider = \"api_router\""));
        assert!(config.contains("requires_openai_auth = true"));
        assert!(config.contains("wire_api = \"responses\""));
        assert!(!config.contains("env_key = \"OPENAI_API_KEY\""));
        assert_eq!(auth["auth_mode"], "apikey");
        assert_eq!(auth["OPENAI_API_KEY"], "sk-router-live-secret");
    }

    #[test]
    fn installs_codex_into_active_profile_without_overwriting_shared_defaults() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let config_path = home.join(".codex").join("config.toml");
        fs::create_dir_all(config_path.parent().expect("config parent")).expect("config dir");
        fs::write(
            &config_path,
            r#"profile = "work"
model = "gpt-5"
model_provider = "openai"

[profiles.work]
approval_policy = "never"
"#,
        )
        .expect("seed codex config");

        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();

        service
            .install_client_setup_with_runtime(
                &paths,
                build_request(
                    ApiRouterInstallerClientId::Codex,
                    ApiRouterInstallerCompatibility::Openai,
                ),
                &runtime,
            )
            .expect("codex install");

        let config = fs::read_to_string(&config_path).expect("codex config");
        let parsed = config.parse::<DocumentMut>().expect("parse codex config");
        let root = parsed.as_table();
        let active_profile = root
            .get("profile")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let top_level_model = root
            .get("model")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let top_level_provider = root
            .get("model_provider")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let work_profile = root
            .get("profiles")
            .and_then(Item::as_table)
            .and_then(|profiles| profiles.get("work"))
            .and_then(Item::as_table)
            .expect("work profile");
        let work_model = work_profile
            .get("model")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let work_provider = work_profile
            .get("model_provider")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let work_approval_policy = work_profile
            .get("approval_policy")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);

        assert_eq!(active_profile, Some("work"));
        assert_eq!(top_level_model, Some("gpt-5"));
        assert_eq!(top_level_provider, Some("openai"));
        assert_eq!(work_model, Some("gpt-4.1-mini"));
        assert_eq!(work_provider, Some("api_router"));
        assert_eq!(work_approval_policy, Some("never"));
        assert!(config.contains("[model_providers.api_router]"));
        assert!(config.contains("requires_openai_auth = true"));
        assert!(config.contains("wire_api = \"responses\""));
        assert!(config.contains("base_url = \"https://api-router.example.com/v1\""));
    }

    #[test]
    fn migrates_legacy_codex_shared_api_router_selection_into_active_profile() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let config_path = home.join(".codex").join("config.toml");
        fs::create_dir_all(config_path.parent().expect("config parent")).expect("config dir");
        fs::write(
            &config_path,
            r#"profile = "work"
model = "gpt-4.1-mini"
model_provider = "api_router"

[profiles.work]
approval_policy = "never"

[model_providers.api_router]
name = "Legacy API Router"
base_url = "https://old-router.example.com/v1"
wire_api = "chat"
requires_openai_auth = false
env_key = "OPENAI_API_KEY"
"#,
        )
        .expect("seed codex config");

        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();

        service
            .install_client_setup_with_runtime(
                &paths,
                build_request(
                    ApiRouterInstallerClientId::Codex,
                    ApiRouterInstallerCompatibility::Openai,
                ),
                &runtime,
            )
            .expect("codex install");

        let config = fs::read_to_string(&config_path).expect("codex config");
        let parsed = config.parse::<DocumentMut>().expect("parse codex config");
        let root = parsed.as_table();
        let top_level_model = root
            .get("model")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let top_level_provider = root
            .get("model_provider")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let work_profile = root
            .get("profiles")
            .and_then(Item::as_table)
            .and_then(|profiles| profiles.get("work"))
            .and_then(Item::as_table)
            .expect("work profile");
        let work_model = work_profile
            .get("model")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);
        let work_provider = work_profile
            .get("model_provider")
            .and_then(Item::as_value)
            .and_then(toml_edit::Value::as_str);

        assert_eq!(top_level_model, None);
        assert_eq!(top_level_provider, None);
        assert_eq!(work_model, Some("gpt-4.1-mini"));
        assert_eq!(work_provider, Some("api_router"));
        assert!(config.contains("name = \"Global API Router\""));
        assert!(config.contains("base_url = \"https://api-router.example.com/v1\""));
        assert!(config.contains("wire_api = \"responses\""));
        assert!(config.contains("requires_openai_auth = true"));
        assert!(!config.contains("env_key = \"OPENAI_API_KEY\""));
    }

    #[test]
    fn merges_claude_code_settings_without_dropping_existing_keys() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let settings_path = home.join(".claude").join("settings.json");
        fs::create_dir_all(settings_path.parent().expect("settings parent")).expect("settings dir");
        fs::write(
            &settings_path,
            r#"{
  "theme": "dark",
  "env": {
    "EXISTING_FLAG": "1"
  }
}
"#,
        )
        .expect("seed settings");
        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();

        let result = service
            .install_client_setup_with_runtime(
                &paths,
                build_request(
                    ApiRouterInstallerClientId::ClaudeCode,
                    ApiRouterInstallerCompatibility::Anthropic,
                ),
                &runtime,
            )
            .expect("claude install");

        assert_eq!(result.written_files.len(), 1);

        let settings: Value =
            serde_json::from_str(&fs::read_to_string(&settings_path).expect("settings content"))
                .expect("settings json");

        assert_eq!(settings["theme"], "dark");
        assert_eq!(settings["model"], "gpt-4.1-mini");
        assert_eq!(settings["env"]["EXISTING_FLAG"], "1");
        assert_eq!(
            settings["env"]["ANTHROPIC_AUTH_TOKEN"],
            "sk-router-live-secret"
        );
        assert_eq!(
            settings["env"]["ANTHROPIC_BASE_URL"],
            "https://api-router.example.com/anthropic"
        );
    }

    #[test]
    fn updates_existing_opencode_jsonc_configuration() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let config_path = home.join(".config").join("opencode").join("opencode.jsonc");
        fs::create_dir_all(config_path.parent().expect("config parent")).expect("config dir");
        fs::write(
            &config_path,
            r#"{
  // keep this provider
  "provider": {
    "github-copilot": {
      "npm": "@ai-sdk/openai-compatible"
    }
  }
}
"#,
        )
        .expect("seed opencode config");
        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();

        let result = service
            .install_client_setup_with_runtime(
                &paths,
                build_request(
                    ApiRouterInstallerClientId::Opencode,
                    ApiRouterInstallerCompatibility::Openai,
                ),
                &runtime,
            )
            .expect("opencode install");

        assert_eq!(result.written_files.len(), 2);

        let config: Value =
            serde_json::from_str(&fs::read_to_string(&config_path).expect("config content"))
                .expect("config json");
        let auth_path = expected_opencode_auth_path(&home);
        let auth: Value =
            serde_json::from_str(&fs::read_to_string(&auth_path).expect("auth content"))
                .expect("auth json");

        assert_eq!(
            config["provider"]["github-copilot"]["npm"],
            "@ai-sdk/openai-compatible"
        );
        assert_eq!(
            config["provider"]["api-router"]["name"],
            "Global API Router"
        );
        assert_eq!(config["provider"]["api-router"]["npm"], "@ai-sdk/openai");
        assert_eq!(
            config["provider"]["api-router"]["options"]["baseURL"],
            "https://api-router.example.com/v1"
        );
        assert!(config["provider"]["api-router"]["options"]["apiKey"].is_null());
        assert_eq!(config["model"], "api-router/gpt-4.1-mini");
        assert_eq!(auth["api-router"]["type"], "api");
        assert_eq!(auth["api-router"]["key"], "sk-router-live-secret");
    }

    #[test]
    fn installs_opencode_with_openai_compatible_provider_for_non_openai_routes() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();
        let request = ApiRouterClientInstallRequest {
            client_id: ApiRouterInstallerClientId::Opencode,
            provider: ApiRouterInstallerProvider {
                id: "provider-openai-compatible-1".to_string(),
                channel_id: "moonshot".to_string(),
                name: "Moonshot Route".to_string(),
                base_url: "https://api.moonshot.cn/v1".to_string(),
                api_key: "moonshot-router-live-secret".to_string(),
                compatibility: ApiRouterInstallerCompatibility::Openai,
                models: vec![ApiRouterInstallerModel {
                    id: "kimi-k2-0905-preview".to_string(),
                    name: "Kimi K2 Preview".to_string(),
                }],
            },
            install_mode: None,
            env_scope: None,
            open_claw: None,
        };

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("opencode moonshot install");

        assert_eq!(result.written_files.len(), 2);

        let config_path = home.join(".config").join("opencode").join("opencode.json");
        let config: Value =
            serde_json::from_str(&fs::read_to_string(&config_path).expect("config content"))
                .expect("config json");

        assert_eq!(
            config["provider"]["api-router"]["npm"],
            "@ai-sdk/openai-compatible"
        );
        assert_eq!(config["model"], "api-router/kimi-k2-0905-preview");
    }

    #[test]
    fn prefers_official_windows_opencode_paths_when_no_legacy_files_exist() {
        let home = PathBuf::from(r"C:\Users\tester");

        assert_eq!(
            resolve_opencode_config_path_for_platform(&home, InstallPlatform::Windows),
            home.join(".config").join("opencode").join("opencode.json")
        );
        assert_eq!(
            resolve_opencode_auth_path_for_platform(&home, InstallPlatform::Windows),
            home.join(".local").join("share").join("opencode").join("auth.json")
        );
    }

    #[test]
    fn uses_xdg_opencode_paths_for_linux_and_macos() {
        let linux_home = PathBuf::from("/home/tester");
        let macos_home = PathBuf::from("/Users/tester");

        assert_eq!(
            resolve_opencode_config_path_for_platform(&linux_home, InstallPlatform::Linux),
            linux_home.join(".config").join("opencode").join("opencode.json")
        );
        assert_eq!(
            resolve_opencode_auth_path_for_platform(&linux_home, InstallPlatform::Linux),
            linux_home.join(".local").join("share").join("opencode").join("auth.json")
        );

        assert_eq!(
            resolve_opencode_config_path_for_platform(&macos_home, InstallPlatform::Macos),
            macos_home.join(".config").join("opencode").join("opencode.json")
        );
        assert_eq!(
            resolve_opencode_auth_path_for_platform(&macos_home, InstallPlatform::Macos),
            macos_home.join(".local").join("share").join("opencode").join("auth.json")
        );
    }

    #[test]
    fn reuses_legacy_windows_opencode_paths_when_existing_files_are_present() {
        let temp = tempfile::tempdir().expect("temp dir");
        let home = temp.path().join("home");
        let legacy_config_path = home
            .join("AppData")
            .join("Roaming")
            .join("opencode")
            .join("opencode.jsonc");
        let legacy_auth_path = home
            .join("AppData")
            .join("Roaming")
            .join("opencode")
            .join("auth.json");

        fs::create_dir_all(legacy_config_path.parent().expect("legacy config parent"))
            .expect("legacy config dir");
        fs::write(&legacy_config_path, "{}\n").expect("legacy config");
        fs::write(&legacy_auth_path, "{}\n").expect("legacy auth");

        assert_eq!(
            resolve_opencode_config_path_for_platform(&home, InstallPlatform::Windows),
            legacy_config_path
        );
        assert_eq!(
            resolve_opencode_auth_path_for_platform(&home, InstallPlatform::Windows),
            legacy_auth_path
        );
    }

    #[test]
    fn installs_gemini_cli_settings_and_env_files() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime(&home);
        let service = ApiRouterInstallerService::new();
        let request = ApiRouterClientInstallRequest {
            client_id: ApiRouterInstallerClientId::Gemini,
            provider: ApiRouterInstallerProvider {
                id: "provider-google-1".to_string(),
                channel_id: "google".to_string(),
                name: "Gemini Router".to_string(),
                base_url: "https://generativelanguage.googleapis.com/v1beta".to_string(),
                api_key: "google-router-live-secret".to_string(),
                compatibility: ApiRouterInstallerCompatibility::Gemini,
                models: vec![ApiRouterInstallerModel {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
            },
            install_mode: Some(ApiRouterInstallerInstallMode::Standard),
            env_scope: None,
            open_claw: None,
        };

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("gemini install");

        assert_eq!(result.written_files.len(), 2);

        let settings_path = home.join(".gemini").join("settings.json");
        let env_path = home.join(".gemini").join(".env");
        let settings: Value =
            serde_json::from_str(&fs::read_to_string(&settings_path).expect("settings content"))
                .expect("settings json");
        let env = fs::read_to_string(&env_path).expect("env content");

        assert_eq!(settings["model"]["name"], "gemini-2.5-pro");
        assert_eq!(
            settings["security"]["auth"]["selectedType"],
            "gemini-api-key"
        );
        assert!(env.contains("GEMINI_API_KEY=\"google-router-live-secret\""));
        assert!(env.contains(
            "GOOGLE_GEMINI_BASE_URL=\"https://generativelanguage.googleapis.com/v1beta\""
        ));
        assert!(env.contains(
            "GEMINI_API_KEY_AUTH_MECHANISM=\"x-goog-api-key\""
        ));
        assert!(result.updated_environments.is_empty());
    }

    #[test]
    fn installs_both_gemini_standard_and_shell_environment_for_routed_gateways() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime_for_platform(&home, InstallPlatform::Macos);
        let service = ApiRouterInstallerService::new();
        let request = ApiRouterClientInstallRequest {
            client_id: ApiRouterInstallerClientId::Gemini,
            provider: ApiRouterInstallerProvider {
                id: "provider-google-router-1".to_string(),
                channel_id: "google".to_string(),
                name: "Gemini Router".to_string(),
                base_url: "https://api-router.example.com/gemini".to_string(),
                api_key: "google-router-live-secret".to_string(),
                compatibility: ApiRouterInstallerCompatibility::Gemini,
                models: vec![ApiRouterInstallerModel {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
            },
            install_mode: Some(ApiRouterInstallerInstallMode::Both),
            env_scope: Some(ApiRouterInstallerEnvScope::User),
            open_claw: None,
        };

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("gemini install");

        assert_eq!(result.updated_environments.len(), 1);
        assert!(!result.written_files.is_empty());

        let shell_env_path = resolve_unix_user_env_path(&home);
        let shell_env = fs::read_to_string(&shell_env_path).expect("shell env");
        assert!(shell_env.contains("export GEMINI_API_KEY=\"google-router-live-secret\""));
        assert!(shell_env.contains(
            "export GOOGLE_GEMINI_BASE_URL=\"https://api-router.example.com/gemini\""
        ));
        assert!(shell_env.contains(
            "export GEMINI_API_KEY_AUTH_MECHANISM=\"bearer\""
        ));

        let zshrc = fs::read_to_string(home.join(".zshrc")).expect("zshrc");
        assert!(zshrc.contains("claw-studio-api-router-env"));
        assert!(zshrc.contains("env.sh"));
    }

    #[test]
    fn installs_environment_only_shell_setup_for_gemini() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime_for_platform(&home, InstallPlatform::Linux);
        let service = ApiRouterInstallerService::new();
        let request = ApiRouterClientInstallRequest {
            client_id: ApiRouterInstallerClientId::Gemini,
            provider: ApiRouterInstallerProvider {
                id: "provider-google-router-1".to_string(),
                channel_id: "google".to_string(),
                name: "Gemini Router".to_string(),
                base_url: "https://api-router.example.com/gemini".to_string(),
                api_key: "google-router-live-secret".to_string(),
                compatibility: ApiRouterInstallerCompatibility::Gemini,
                models: vec![ApiRouterInstallerModel {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
            },
            install_mode: Some(ApiRouterInstallerInstallMode::Env),
            env_scope: Some(ApiRouterInstallerEnvScope::User),
            open_claw: None,
        };

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("gemini env install");

        assert_eq!(result.updated_environments.len(), 1);
        assert!(!home.join(".gemini").join("settings.json").exists());
        assert!(!home.join(".gemini").join(".env").exists());
        assert!(resolve_unix_user_env_path(&home).exists());
    }

    #[test]
    fn installs_environment_only_shell_setup_for_codex() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime_for_platform(&home, InstallPlatform::Linux);
        let service = ApiRouterInstallerService::new();
        let mut request = build_request(
            ApiRouterInstallerClientId::Codex,
            ApiRouterInstallerCompatibility::Openai,
        );
        request.install_mode = Some(ApiRouterInstallerInstallMode::Env);
        request.env_scope = Some(ApiRouterInstallerEnvScope::User);

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("codex env install");

        assert_eq!(result.updated_environments.len(), 1);
        assert!(!home.join(".codex").join("config.toml").exists());
        assert!(!home.join(".codex").join("auth.json").exists());

        let shell_env = fs::read_to_string(resolve_unix_user_env_path(&home)).expect("shell env");
        assert!(shell_env.contains("export OPENAI_API_KEY=\"sk-router-live-secret\""));
        assert!(shell_env.contains("export OPENAI_BASE_URL=\"https://api-router.example.com/v1\""));
    }

    #[test]
    fn installs_windows_powershell_environment_for_codex_both_mode() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime_for_platform(&home, InstallPlatform::Windows);
        let service = ApiRouterInstallerService::new();
        let mut request = build_request(
            ApiRouterInstallerClientId::Codex,
            ApiRouterInstallerCompatibility::Openai,
        );
        request.install_mode = Some(ApiRouterInstallerInstallMode::Both);
        request.env_scope = Some(ApiRouterInstallerEnvScope::User);

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("codex both install");

        assert_eq!(result.updated_environments.len(), 1);
        assert!(resolve_windows_user_env_path(&home).exists());
        assert!(resolve_windows_user_profile_path(&home).exists());

        let env_file =
            fs::read_to_string(resolve_windows_user_env_path(&home)).expect("powershell env");
        assert!(env_file.contains("$env:OPENAI_API_KEY = \"sk-router-live-secret\""));
        assert!(env_file.contains("$env:OPENAI_BASE_URL = \"https://api-router.example.com/v1\""));
    }

    #[test]
    fn installs_system_scope_shell_environment_file_on_linux() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let home = temp.path().join("home");
        let runtime = build_runtime_for_platform(&home, InstallPlatform::Linux);
        let service = ApiRouterInstallerService::new();
        let mut request = build_request(
            ApiRouterInstallerClientId::Codex,
            ApiRouterInstallerCompatibility::Openai,
        );
        request.install_mode = Some(ApiRouterInstallerInstallMode::Both);
        request.env_scope = Some(ApiRouterInstallerEnvScope::System);

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("codex system env install");

        assert_eq!(result.updated_environments.len(), 1);
        let system_env_path = resolve_unix_system_env_path(&runtime);
        assert!(system_env_path.exists());
    }

    #[test]
    fn rejects_openclaw_environment_only_mode() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let runtime = build_runtime(temp.path());
        let service = ApiRouterInstallerService::new();
        let mut request = build_request(
            ApiRouterInstallerClientId::Openclaw,
            ApiRouterInstallerCompatibility::Openai,
        );
        request.install_mode = Some(ApiRouterInstallerInstallMode::Env);
        request.open_claw = Some(ApiRouterInstallerOpenClawOptions {
            instance_ids: vec!["local-built-in".to_string()],
            ..Default::default()
        });

        let error = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect_err("openclaw env mode should fail");

        assert!(error
            .to_string()
            .contains("requested install mode"));
    }

    #[test]
    fn writes_managed_openclaw_provider_manifests_for_selected_instances() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let runtime = InstallerRuntime {
            home_dir: PathBuf::from("unused"),
            platform: InstallPlatform::Linux,
            system_env_dir: PathBuf::from("/unused/system"),
        };
        let service = ApiRouterInstallerService::new();
        let mut request = build_request(
            ApiRouterInstallerClientId::Openclaw,
            ApiRouterInstallerCompatibility::Openai,
        );
        request.open_claw = Some(ApiRouterInstallerOpenClawOptions {
            instance_ids: vec!["local-built-in".to_string(), "home-nas".to_string()],
            ..Default::default()
        });

        let result = service
            .install_client_setup_with_runtime(&paths, request, &runtime)
            .expect("openclaw install");

        assert_eq!(
            result.updated_instance_ids,
            vec!["local-built-in", "home-nas"]
        );
        assert_eq!(result.written_files.len(), 2);

        let provider_path = paths
            .integrations_dir
            .join("openclaw")
            .join("instances")
            .join("local-built-in")
            .join("providers")
            .join("provider-api-router-provider-openai-1.json");
        let manifest: Value =
            serde_json::from_str(&fs::read_to_string(provider_path).expect("manifest content"))
                .expect("manifest json");

        assert_eq!(manifest["provider"], "api-router");
        assert_eq!(manifest["endpoint"], "https://api-router.example.com/v1");
        assert_eq!(manifest["defaultModelId"], "gpt-4.1-mini");
    }

    #[test]
    fn installs_resolved_openclaw_provider_manifests_with_router_config_metadata() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let service = ApiRouterInstallerService::new();
        let mut request = build_request(
            ApiRouterInstallerClientId::Openclaw,
            ApiRouterInstallerCompatibility::Openai,
        );
        request.open_claw = Some(ApiRouterInstallerOpenClawOptions {
            instance_ids: vec!["local-built-in".to_string(), "home-nas".to_string()],
            api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
            router_provider_id: Some("provider-openai-1".to_string()),
            model_mapping_id: Some("model-mapping-openclaw".to_string()),
        });

        let result = service
            .install_openclaw_instances(
                &paths,
                request,
                vec![
                    ApiRouterInstalledOpenClawInstance {
                        instance_id: "local-built-in".to_string(),
                        endpoint: "http://127.0.0.1:8080/v1".to_string(),
                        api_key: "sk-ar-v1-local".to_string(),
                        api_key_project_id: "project-openclaw-local".to_string(),
                        api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
                        selected_provider_id: Some("provider-openai-1".to_string()),
                        model_mapping_id: Some("model-mapping-openclaw".to_string()),
                    },
                    ApiRouterInstalledOpenClawInstance {
                        instance_id: "home-nas".to_string(),
                        endpoint: "http://127.0.0.1:8080/v1".to_string(),
                        api_key: "sk-ar-v1-home".to_string(),
                        api_key_project_id: "project-openclaw-home".to_string(),
                        api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
                        selected_provider_id: Some("provider-openai-1".to_string()),
                        model_mapping_id: Some("model-mapping-openclaw".to_string()),
                    },
                ],
            )
            .expect("resolved openclaw install");

        assert_eq!(result.updated_instance_ids, vec!["local-built-in", "home-nas"]);
        assert_eq!(result.open_claw_instances.len(), 2);

        let provider_path = paths
            .integrations_dir
            .join("openclaw")
            .join("instances")
            .join("local-built-in")
            .join("providers")
            .join("provider-api-router-provider-openai-1.json");
        let manifest: Value =
            serde_json::from_str(&fs::read_to_string(provider_path).expect("manifest content"))
                .expect("manifest json");

        assert_eq!(manifest["endpoint"], "http://127.0.0.1:8080/v1");
        assert_eq!(manifest["apiKeySource"], "sk-ar-v1-local");
        assert_eq!(manifest["routerConfig"]["apiKeyProjectId"], "project-openclaw-local");
        assert_eq!(manifest["routerConfig"]["apiKeyStrategy"], "per-instance");
        assert_eq!(manifest["routerConfig"]["selectedProviderId"], "provider-openai-1");
        assert_eq!(manifest["routerConfig"]["modelMappingId"], "model-mapping-openclaw");
    }
}
