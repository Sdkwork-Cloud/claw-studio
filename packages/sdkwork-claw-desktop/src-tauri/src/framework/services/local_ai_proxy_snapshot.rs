use super::storage::StorageService;
use crate::framework::{
    config::AppConfig,
    paths::AppPaths,
    storage::{
        StorageDeleteRequest, StorageGetTextRequest, StorageListKeysRequest, StorageProviderKind,
        StoragePutTextRequest,
    },
    FrameworkError, Result,
};
use serde_json::{Number, Value};
use std::{collections::BTreeMap, fs, path::Path};

pub const LOCAL_AI_PROXY_SCHEMA_VERSION: u32 = 1;
pub const LOCAL_AI_PROXY_DEFAULT_BIND_HOST: &str = "127.0.0.1";
pub const LOCAL_AI_PROXY_DEFAULT_PORT: u16 = 18_791;
pub const LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL: &str = "https://ai.sdkwork.com";
pub const LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY: &str = "sk_sdkwork_api_key";
pub const LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE: &str = "studio.provider-center";
pub const LOCAL_AI_PROXY_PROVIDER_CENTER_CATALOG_SCHEMA_VERSION: u32 = 1;
pub const LOCAL_AI_PROXY_DEFAULT_ROUTE_ID: &str = "local-ai-proxy-system-default-openai-compatible";
pub const LOCAL_AI_PROXY_DEFAULT_PROVIDER_ID: &str = "sdkwork";
pub const LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL: &str = "openai-compatible";
const LOCAL_AI_PROXY_REQUIRED_DEFAULT_CLIENT_PROTOCOLS: [&str; 3] =
    ["anthropic", "gemini", "openai-compatible"];

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiProxyModelSnapshot {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiProxyRouteRuntimeConfigSnapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<Number>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<Number>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub streaming: Option<bool>,
}

fn local_ai_proxy_runtime_config_is_empty(value: &LocalAiProxyRouteRuntimeConfigSnapshot) -> bool {
    value.temperature.is_none()
        && value.top_p.is_none()
        && value.max_tokens.is_none()
        && value.timeout_ms.is_none()
        && value.streaming.is_none()
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiProxyRouteSnapshot {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub is_default: bool,
    pub managed_by: String,
    pub client_protocol: String,
    pub upstream_protocol: String,
    pub provider_id: String,
    pub upstream_base_url: String,
    pub api_key: String,
    pub default_model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding_model_id: Option<String>,
    pub models: Vec<LocalAiProxyModelSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub expose_to: Vec<String>,
    #[serde(
        default,
        skip_serializing_if = "local_ai_proxy_runtime_config_is_empty"
    )]
    pub runtime_config: LocalAiProxyRouteRuntimeConfigSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiProxySnapshot {
    pub schema_version: u32,
    pub bind_host: String,
    pub requested_port: u16,
    pub auth_token: String,
    pub default_route_id: String,
    pub routes: Vec<LocalAiProxyRouteSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiProxyProviderCenterRouteRecord {
    pub key: String,
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiProxyProviderCenterCatalogSnapshot {
    pub schema_version: u32,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    pub routes: Vec<LocalAiProxyProviderCenterRouteRecord>,
}

impl LocalAiProxySnapshot {
    pub fn route_for_client_protocol(
        &self,
        client_protocol: &str,
    ) -> Option<&LocalAiProxyRouteSnapshot> {
        self.routes
            .iter()
            .find(|route| {
                route.enabled && route.client_protocol == client_protocol && route.is_default
            })
            .or_else(|| {
                self.routes
                    .iter()
                    .find(|route| route.enabled && route.client_protocol == client_protocol)
            })
    }

    pub fn default_route(&self) -> Option<&LocalAiProxyRouteSnapshot> {
        self.route_for_client_protocol(LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL)
            .or_else(|| {
                self.routes
                    .iter()
                    .find(|route| route.enabled && route.is_default)
            })
            .or_else(|| self.routes.iter().find(|route| route.enabled))
    }
}

pub fn create_system_default_local_ai_proxy_snapshot(
    requested_port: u16,
    auth_token: impl Into<String>,
) -> LocalAiProxySnapshot {
    LocalAiProxySnapshot {
        schema_version: LOCAL_AI_PROXY_SCHEMA_VERSION,
        bind_host: LOCAL_AI_PROXY_DEFAULT_BIND_HOST.to_string(),
        requested_port,
        auth_token: auth_token.into(),
        default_route_id: LOCAL_AI_PROXY_DEFAULT_ROUTE_ID.to_string(),
        routes: create_required_system_default_local_ai_proxy_routes(),
    }
}

fn create_required_system_default_local_ai_proxy_routes() -> Vec<LocalAiProxyRouteSnapshot> {
    LOCAL_AI_PROXY_REQUIRED_DEFAULT_CLIENT_PROTOCOLS
        .iter()
        .map(|client_protocol| {
            create_system_default_local_ai_proxy_route_for_protocol(client_protocol)
        })
        .collect()
}

fn create_system_default_local_ai_proxy_route_for_protocol(
    client_protocol: &str,
) -> LocalAiProxyRouteSnapshot {
    let models = vec![
        LocalAiProxyModelSnapshot {
            id: "sdkwork-chat".to_string(),
            name: "SDKWork Chat".to_string(),
        },
        LocalAiProxyModelSnapshot {
            id: "sdkwork-reasoning".to_string(),
            name: "SDKWork Reasoning".to_string(),
        },
        LocalAiProxyModelSnapshot {
            id: "sdkwork-embedding".to_string(),
            name: "SDKWork Embedding".to_string(),
        },
    ];

    LocalAiProxyRouteSnapshot {
        id: if client_protocol == LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL {
            LOCAL_AI_PROXY_DEFAULT_ROUTE_ID.to_string()
        } else {
            format!("local-ai-proxy-system-default-{client_protocol}")
        },
        name: if client_protocol == LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL {
            "SDKWork Default".to_string()
        } else {
            format!("SDKWork {} Default", titleize(client_protocol))
        },
        enabled: true,
        is_default: true,
        managed_by: "system-default".to_string(),
        client_protocol: client_protocol.to_string(),
        upstream_protocol: "sdkwork".to_string(),
        provider_id: LOCAL_AI_PROXY_DEFAULT_PROVIDER_ID.to_string(),
        upstream_base_url: LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL.to_string(),
        api_key: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
        default_model_id: models[0].id.clone(),
        reasoning_model_id: Some(models[1].id.clone()),
        embedding_model_id: Some(models[2].id.clone()),
        models,
        notes: None,
        expose_to: if client_protocol == LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL {
            vec!["openclaw".to_string()]
        } else {
            vec!["desktop-clients".to_string(), "openclaw".to_string()]
        },
        runtime_config: LocalAiProxyRouteRuntimeConfigSnapshot {
            temperature: Number::from_f64(0.2),
            top_p: Number::from_f64(1.0),
            max_tokens: Some(8_192),
            timeout_ms: Some(60_000),
            streaming: Some(true),
        },
    }
}

pub fn materialize_local_ai_proxy_snapshot(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    requested_port: u16,
    auth_token: impl Into<String>,
) -> LocalAiProxySnapshot {
    let auth_token = auth_token.into();
    let routes = load_provider_center_routes(paths, config, storage);
    if routes.is_empty() {
        return create_system_default_local_ai_proxy_snapshot(requested_port, auth_token);
    }

    let normalized_routes = normalize_routes(routes);
    let default_route_id = normalized_routes
        .iter()
        .find(|route| {
            route.enabled
                && route.client_protocol == LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL
                && route.is_default
        })
        .or_else(|| {
            normalized_routes.iter().find(|route| {
                route.enabled && route.client_protocol == LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL
            })
        })
        .or_else(|| {
            normalized_routes
                .iter()
                .find(|route| route.enabled && route.is_default)
        })
        .or_else(|| normalized_routes.iter().find(|route| route.enabled))
        .map(|route| route.id.clone())
        .unwrap_or_else(|| LOCAL_AI_PROXY_DEFAULT_ROUTE_ID.to_string());

    LocalAiProxySnapshot {
        schema_version: LOCAL_AI_PROXY_SCHEMA_VERSION,
        bind_host: LOCAL_AI_PROXY_DEFAULT_BIND_HOST.to_string(),
        requested_port,
        auth_token,
        default_route_id,
        routes: normalized_routes,
    }
}

pub fn write_local_ai_proxy_snapshot(path: &Path, snapshot: &LocalAiProxySnapshot) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(
        path,
        format!("{}\n", serde_json::to_string_pretty(snapshot)?),
    )?;
    Ok(())
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn load_local_ai_proxy_snapshot(path: &Path) -> Result<LocalAiProxySnapshot> {
    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

pub fn export_provider_center_catalog(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
) -> Result<LocalAiProxyProviderCenterCatalogSnapshot> {
    let Some(profile_id) = resolve_provider_center_profile_id(config) else {
        return Ok(LocalAiProxyProviderCenterCatalogSnapshot {
            schema_version: LOCAL_AI_PROXY_PROVIDER_CENTER_CATALOG_SCHEMA_VERSION,
            namespace: LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string(),
            profile_id: None,
            routes: Vec::new(),
        });
    };

    let listed = storage.list_keys(
        paths,
        config,
        StorageListKeysRequest {
            profile_id: Some(profile_id.clone()),
            namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
        },
    )?;

    let mut routes = Vec::new();
    for key in listed.keys {
        let value = storage
            .get_text(
                paths,
                config,
                StorageGetTextRequest {
                    profile_id: Some(profile_id.clone()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: key.clone(),
                },
            )?
            .value
            .unwrap_or_default();
        routes.push(LocalAiProxyProviderCenterRouteRecord { key, value });
    }
    routes.sort_by(|left, right| left.key.cmp(&right.key));

    Ok(LocalAiProxyProviderCenterCatalogSnapshot {
        schema_version: LOCAL_AI_PROXY_PROVIDER_CENTER_CATALOG_SCHEMA_VERSION,
        namespace: LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string(),
        profile_id: Some(profile_id),
        routes,
    })
}

pub fn restore_provider_center_catalog(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    catalog: &LocalAiProxyProviderCenterCatalogSnapshot,
) -> Result<()> {
    if catalog.schema_version != LOCAL_AI_PROXY_PROVIDER_CENTER_CATALOG_SCHEMA_VERSION {
        return Err(FrameworkError::ValidationFailed(format!(
            "unsupported local ai proxy provider center catalog schema version: {}",
            catalog.schema_version
        )));
    }

    if catalog.namespace != LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE {
        return Err(FrameworkError::ValidationFailed(format!(
            "unsupported local ai proxy provider center catalog namespace: {}",
            catalog.namespace
        )));
    }

    let profile_id = resolve_provider_center_profile_id(config).ok_or_else(|| {
        FrameworkError::NotFound(
            "writable sqlite storage profile for the local ai proxy provider center".to_string(),
        )
    })?;

    let listed = storage.list_keys(
        paths,
        config,
        StorageListKeysRequest {
            profile_id: Some(profile_id.clone()),
            namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
        },
    )?;

    for key in listed.keys {
        storage.delete(
            paths,
            config,
            StorageDeleteRequest {
                profile_id: Some(profile_id.clone()),
                namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                key,
            },
        )?;
    }

    for route in &catalog.routes {
        storage.put_text(
            paths,
            config,
            StoragePutTextRequest {
                profile_id: Some(profile_id.clone()),
                namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                key: route.key.clone(),
                value: route.value.clone(),
            },
        )?;
    }

    Ok(())
}

fn load_provider_center_routes(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
) -> Vec<LocalAiProxyRouteSnapshot> {
    let Some(profile_id) = resolve_provider_center_profile_id(config) else {
        return Vec::new();
    };

    let listed = match storage.list_keys(
        paths,
        config,
        StorageListKeysRequest {
            profile_id: Some(profile_id.clone()),
            namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
        },
    ) {
        Ok(listed) => listed,
        Err(_) => return Vec::new(),
    };

    let mut routes = Vec::new();
    for key in listed.keys {
        let value = match storage.get_text(
            paths,
            config,
            StorageGetTextRequest {
                profile_id: Some(profile_id.clone()),
                namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                key,
            },
        ) {
            Ok(response) => response.value,
            Err(_) => None,
        };

        let Some(value) = value else {
            continue;
        };
        if let Some(route) = parse_route_snapshot(&value) {
            routes.push(route);
        }
    }

    routes
}

pub fn resolve_provider_center_profile_id(config: &AppConfig) -> Option<String> {
    let storage_config = config.storage.normalized();
    let writable_sqlite_profiles = storage_config
        .profiles
        .iter()
        .filter(|profile| profile.provider == StorageProviderKind::Sqlite && !profile.read_only)
        .collect::<Vec<_>>();

    if let Some(profile) = writable_sqlite_profiles
        .iter()
        .find(|profile| profile.id == storage_config.active_profile_id)
    {
        return Some(profile.id.clone());
    }

    if let Some(profile) = writable_sqlite_profiles.first() {
        return Some(profile.id.clone());
    }

    storage_config
        .profiles
        .iter()
        .find(|profile| profile.id == "default-sqlite" && !profile.read_only)
        .map(|profile| profile.id.clone())
}

fn parse_route_snapshot(value: &str) -> Option<LocalAiProxyRouteSnapshot> {
    let parsed = serde_json::from_str::<Value>(value).ok()?;
    let object = parsed.as_object()?;
    let managed_by =
        normalize_string(object.get("managedBy")).unwrap_or_else(|| "user".to_string());
    let provider_id = normalize_provider_id(
        object
            .get("providerId")
            .or_else(|| object.get("channelId"))
            .or_else(|| object.get("id")),
    );
    let client_protocol = normalize_client_protocol(object.get("clientProtocol"))
        .unwrap_or_else(|| infer_client_protocol(&provider_id));
    if managed_by == "system-default" {
        return Some(create_system_default_local_ai_proxy_route_for_protocol(
            &client_protocol,
        ));
    }

    let upstream_protocol = normalize_upstream_protocol(object.get("upstreamProtocol"))
        .unwrap_or_else(|| infer_upstream_protocol(&provider_id));
    let mut models = normalize_models(object.get("models"));
    let default_model_id = normalize_string(object.get("defaultModelId"))
        .or_else(|| models.first().map(|model| model.id.clone()))
        .unwrap_or_default();
    if !default_model_id.is_empty() && !models.iter().any(|model| model.id == default_model_id) {
        models.push(LocalAiProxyModelSnapshot {
            id: default_model_id.clone(),
            name: default_model_id.clone(),
        });
    }
    let reasoning_model_id = normalize_optional_model_id(object.get("reasoningModelId"), &models);
    let embedding_model_id = normalize_optional_model_id(object.get("embeddingModelId"), &models);
    let runtime_config = normalize_runtime_config(object.get("config"));

    Some(LocalAiProxyRouteSnapshot {
        id: normalize_string(object.get("id"))
            .unwrap_or_else(|| format!("local-ai-route-{}", provider_id)),
        name: normalize_string(object.get("name"))
            .unwrap_or_else(|| titleize(&provider_id))
            .trim()
            .to_string(),
        enabled: object
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        is_default: object
            .get("isDefault")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        managed_by,
        client_protocol,
        upstream_protocol,
        provider_id: provider_id.clone(),
        upstream_base_url: normalize_string(object.get("upstreamBaseUrl"))
            .or_else(|| normalize_string(object.get("baseUrl")))
            .unwrap_or_else(|| LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL.to_string()),
        api_key: normalize_string(object.get("apiKey")).unwrap_or_default(),
        default_model_id,
        reasoning_model_id,
        embedding_model_id,
        models,
        notes: normalize_string(object.get("notes")),
        expose_to: normalize_string_list(object.get("exposeTo"), "openclaw"),
        runtime_config,
    })
}

fn normalize_routes(routes: Vec<LocalAiProxyRouteSnapshot>) -> Vec<LocalAiProxyRouteSnapshot> {
    let mut grouped = BTreeMap::<String, Vec<LocalAiProxyRouteSnapshot>>::new();
    for route in routes {
        grouped
            .entry(route.client_protocol.clone())
            .or_default()
            .push(route);
    }

    let mut normalized = Vec::new();
    for (_client_protocol, mut protocol_routes) in grouped {
        let default_index = protocol_routes
            .iter()
            .position(|route| route.enabled && route.is_default)
            .or_else(|| protocol_routes.iter().position(|route| route.enabled));
        if let Some(default_index) = default_index {
            for (index, route) in protocol_routes.iter_mut().enumerate() {
                route.is_default = index == default_index;
            }
        }
        protocol_routes.sort_by(|left, right| {
            right
                .is_default
                .cmp(&left.is_default)
                .then_with(|| left.managed_by.cmp(&right.managed_by))
                .then_with(|| left.name.cmp(&right.name))
                .then_with(|| left.id.cmp(&right.id))
        });

        normalized.extend(protocol_routes);
    }

    for client_protocol in LOCAL_AI_PROXY_REQUIRED_DEFAULT_CLIENT_PROTOCOLS {
        let has_enabled_default = normalized.iter().any(|route| {
            route.client_protocol == client_protocol && route.enabled && route.is_default
        });
        if has_enabled_default {
            continue;
        }

        normalized.push(create_system_default_local_ai_proxy_route_for_protocol(
            client_protocol,
        ));
    }

    normalized.sort_by(|left, right| {
        left.client_protocol
            .cmp(&right.client_protocol)
            .then_with(|| right.is_default.cmp(&left.is_default))
            .then_with(|| left.managed_by.cmp(&right.managed_by))
            .then_with(|| left.name.cmp(&right.name))
            .then_with(|| left.id.cmp(&right.id))
    });
    normalized
}

fn normalize_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_provider_id(value: Option<&Value>) -> String {
    normalize_string(value)
        .unwrap_or_else(|| LOCAL_AI_PROXY_DEFAULT_PROVIDER_ID.to_string())
        .trim()
        .to_lowercase()
}

fn normalize_client_protocol(value: Option<&Value>) -> Option<String> {
    let normalized = normalize_string(value)?;
    match normalized.as_str() {
        "openai-compatible" | "anthropic" | "gemini" => Some(normalized),
        _ => None,
    }
}

fn normalize_upstream_protocol(value: Option<&Value>) -> Option<String> {
    let normalized = normalize_string(value)?;
    match normalized.as_str() {
        "openai-compatible" | "anthropic" | "gemini" | "ollama" | "azure-openai" | "openrouter"
        | "sdkwork" => Some(normalized),
        _ => None,
    }
}

fn normalize_models(value: Option<&Value>) -> Vec<LocalAiProxyModelSnapshot> {
    let mut models = Vec::new();
    let Some(items) = value.and_then(Value::as_array) else {
        return models;
    };

    for entry in items {
        let Some(object) = entry.as_object() else {
            continue;
        };
        let Some(id) = normalize_string(object.get("id")) else {
            continue;
        };
        if models.iter().any(|model| model.id == id) {
            continue;
        }
        models.push(LocalAiProxyModelSnapshot {
            name: normalize_string(object.get("name")).unwrap_or_else(|| id.clone()),
            id,
        });
    }

    models
}

fn normalize_optional_model_id(
    value: Option<&Value>,
    models: &[LocalAiProxyModelSnapshot],
) -> Option<String> {
    let normalized = normalize_string(value)?;
    models
        .iter()
        .any(|model| model.id == normalized)
        .then_some(normalized)
}

fn normalize_string_list(value: Option<&Value>, fallback: &str) -> Vec<String> {
    let Some(items) = value.and_then(Value::as_array) else {
        return vec![fallback.to_string()];
    };

    let mut entries = items
        .iter()
        .filter_map(|entry| entry.as_str())
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    entries.sort();
    entries.dedup();
    if entries.is_empty() {
        return vec![fallback.to_string()];
    }
    entries
}

fn normalize_json_number(value: Option<&Value>) -> Option<Number> {
    match value {
        Some(Value::Number(number)) => Some(number.clone()),
        Some(Value::String(raw)) => raw.trim().parse::<f64>().ok().and_then(Number::from_f64),
        _ => None,
    }
}

fn normalize_runtime_config(value: Option<&Value>) -> LocalAiProxyRouteRuntimeConfigSnapshot {
    let object = value.and_then(Value::as_object);

    LocalAiProxyRouteRuntimeConfigSnapshot {
        temperature: normalize_json_number(object.and_then(|object| object.get("temperature"))),
        top_p: normalize_json_number(object.and_then(|object| object.get("topP"))),
        max_tokens: object
            .and_then(|object| object.get("maxTokens"))
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok()),
        timeout_ms: object
            .and_then(|object| object.get("timeoutMs"))
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok()),
        streaming: object
            .and_then(|object| object.get("streaming"))
            .and_then(Value::as_bool),
    }
}

fn infer_upstream_protocol(provider_id: &str) -> String {
    match provider_id {
        "anthropic" => "anthropic".to_string(),
        "google" | "gemini" => "gemini".to_string(),
        "ollama" => "ollama".to_string(),
        "azure" | "azure-openai" => "azure-openai".to_string(),
        "openrouter" => "openrouter".to_string(),
        "sdkwork" => "sdkwork".to_string(),
        _ => "openai-compatible".to_string(),
    }
}

fn infer_client_protocol(provider_id: &str) -> String {
    match infer_upstream_protocol(provider_id).as_str() {
        "anthropic" => "anthropic".to_string(),
        "gemini" => "gemini".to_string(),
        _ => LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL.to_string(),
    }
}

fn titleize(value: &str) -> String {
    value
        .split(['-', '_'])
        .filter(|segment| !segment.is_empty())
        .map(|segment| {
            let mut chars = segment.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::{
        load_local_ai_proxy_snapshot, materialize_local_ai_proxy_snapshot, parse_route_snapshot,
        write_local_ai_proxy_snapshot, LocalAiProxyModelSnapshot, LocalAiProxyRouteSnapshot,
        LocalAiProxySnapshot, LOCAL_AI_PROXY_DEFAULT_PORT,
        LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL, LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE,
    };
    use crate::framework::{
        config::AppConfig,
        paths::resolve_paths_for_root,
        services::storage::StorageService,
        storage::{StorageProfileConfig, StorageProviderKind, StoragePutTextRequest},
    };

    #[test]
    fn local_ai_proxy_snapshot_serializes_and_deserializes_deterministically() {
        let temp = tempfile::tempdir().expect("temp dir");
        let snapshot_path = temp.path().join("local-ai-proxy.snapshot.json");
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: LOCAL_AI_PROXY_DEFAULT_PORT,
            auth_token: "test-local-proxy-token".to_string(),
            default_route_id: "route-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-openai".to_string(),
                name: "OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: "https://api.openai.com/v1".to_string(),
                api_key: "sk-live".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "o4-mini".to_string(),
                        name: "o4-mini".to_string(),
                    },
                ],
                notes: Some("managed route".to_string()),
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        write_local_ai_proxy_snapshot(&snapshot_path, &snapshot).expect("write snapshot");

        let written = std::fs::read_to_string(&snapshot_path).expect("snapshot text");
        assert_eq!(
            written,
            format!(
                "{}\n",
                serde_json::to_string_pretty(&snapshot).expect("snapshot json")
            )
        );

        let loaded = load_local_ai_proxy_snapshot(&snapshot_path).expect("load snapshot");

        assert_eq!(loaded, snapshot);
    }

    #[test]
    fn local_ai_proxy_snapshot_uses_system_default_route_when_provider_center_is_empty() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let config = AppConfig::default();
        let storage = StorageService::new();
        let snapshot = materialize_local_ai_proxy_snapshot(
            &paths,
            &config,
            &storage,
            LOCAL_AI_PROXY_DEFAULT_PORT,
            "token",
        );

        assert_eq!(
            snapshot.default_route_id,
            "local-ai-proxy-system-default-openai-compatible"
        );
        assert_eq!(snapshot.routes.len(), 3);
        assert_eq!(
            snapshot
                .routes
                .iter()
                .map(|route| route.client_protocol.as_str())
                .collect::<Vec<_>>(),
            vec!["anthropic", "gemini", "openai-compatible"]
        );
        assert!(snapshot
            .routes
            .iter()
            .all(|route| route.upstream_base_url == LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL));
        assert!(snapshot
            .routes
            .iter()
            .all(|route| route.provider_id == "sdkwork"));
        assert_eq!(
            snapshot
                .route_for_client_protocol("anthropic")
                .map(|route| route.client_protocol.as_str()),
            Some("anthropic")
        );
        assert_eq!(
            snapshot
                .route_for_client_protocol("gemini")
                .map(|route| route.client_protocol.as_str()),
            Some("gemini")
        );
    }

    #[test]
    fn local_ai_proxy_snapshot_prefers_provider_center_routes_over_the_system_default() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-sqlite".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }];
        let storage = StorageService::new();

        storage
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    profile_id: Some("default-sqlite".to_string()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: "route-openai".to_string(),
                    value: r#"{
  "id": "route-openai",
  "name": "OpenAI",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "openai-compatible",
  "upstreamProtocol": "openai-compatible",
  "providerId": "openai",
  "upstreamBaseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-live",
  "defaultModelId": "gpt-5.4",
  "reasoningModelId": "o4-mini",
  "models": [
    { "id": "gpt-5.4", "name": "GPT-5.4" },
    { "id": "o4-mini", "name": "o4-mini" }
  ],
  "exposeTo": ["openclaw"]
}"#
                    .to_string(),
                },
            )
            .expect("seed provider center route");

        let snapshot = materialize_local_ai_proxy_snapshot(
            &paths,
            &config,
            &storage,
            LOCAL_AI_PROXY_DEFAULT_PORT,
            "token",
        );

        assert_eq!(snapshot.default_route_id, "route-openai");
        assert_eq!(
            snapshot
                .routes
                .iter()
                .find(|route| route.id == "route-openai")
                .map(|route| route.provider_id.as_str()),
            Some("openai")
        );
        assert_eq!(
            snapshot
                .routes
                .iter()
                .find(|route| route.id == "route-openai")
                .map(|route| route.upstream_base_url.as_str()),
            Some("https://api.openai.com/v1")
        );
    }

    #[test]
    fn local_ai_proxy_snapshot_prefers_openai_compatible_default_route_as_global_default() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-sqlite".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }];
        let storage = StorageService::new();

        storage
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    profile_id: Some("default-sqlite".to_string()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: "route-anthropic".to_string(),
                    value: r#"{
  "id": "route-anthropic",
  "name": "Anthropic",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "anthropic",
  "upstreamProtocol": "anthropic",
  "providerId": "anthropic",
  "upstreamBaseUrl": "https://api.anthropic.com/v1",
  "apiKey": "sk-anthropic",
  "defaultModelId": "claude-sonnet-4-20250514",
  "models": [
    { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4" }
  ],
  "exposeTo": ["desktop-clients"]
}"#
                    .to_string(),
                },
            )
            .expect("seed anthropic provider center route");
        storage
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    profile_id: Some("default-sqlite".to_string()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: "route-openai".to_string(),
                    value: r#"{
  "id": "route-openai",
  "name": "OpenAI",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "openai-compatible",
  "upstreamProtocol": "openai-compatible",
  "providerId": "openai",
  "upstreamBaseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-openai",
  "defaultModelId": "gpt-5.4",
  "models": [
    { "id": "gpt-5.4", "name": "GPT-5.4" }
  ],
  "exposeTo": ["openclaw"]
}"#
                    .to_string(),
                },
            )
            .expect("seed openai provider center route");

        let snapshot = materialize_local_ai_proxy_snapshot(
            &paths,
            &config,
            &storage,
            LOCAL_AI_PROXY_DEFAULT_PORT,
            "token",
        );

        assert_eq!(snapshot.default_route_id, "route-openai");
        assert_eq!(
            snapshot
                .default_route()
                .map(|route| route.client_protocol.as_str()),
            Some("openai-compatible")
        );
    }

    #[test]
    fn local_ai_proxy_snapshot_rejects_upstream_only_client_protocols() {
        let route = parse_route_snapshot(
            r#"{
  "id": "route-sdkwork-invalid-client",
  "name": "Anthropic via SDKWork",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "sdkwork",
  "upstreamProtocol": "sdkwork",
  "providerId": "anthropic",
  "upstreamBaseUrl": "https://ai.sdkwork.com",
  "apiKey": "sk-test",
  "defaultModelId": "claude-sonnet-4-20250514",
  "models": [
    { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4" }
  ],
  "exposeTo": ["openclaw"]
}"#,
        )
        .expect("parse route snapshot");

        assert_eq!(route.client_protocol, "anthropic");
        assert_eq!(route.upstream_protocol, "sdkwork");
    }

    #[test]
    fn local_ai_proxy_snapshot_preserves_native_ollama_upstream_routes() {
        let route = parse_route_snapshot(
            r#"{
  "id": "route-ollama-native",
  "name": "Ollama Native",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "openai-compatible",
  "upstreamProtocol": "ollama",
  "providerId": "ollama",
  "upstreamBaseUrl": "http://127.0.0.1:11434",
  "apiKey": "ollama-local",
  "defaultModelId": "glm-4.7-flash",
  "models": [
    { "id": "glm-4.7-flash", "name": "GLM 4.7 Flash" }
  ],
  "exposeTo": ["openclaw"]
}"#,
        )
        .expect("parse ollama route snapshot");

        assert_eq!(route.client_protocol, "openai-compatible");
        assert_eq!(route.upstream_protocol, "ollama");
        assert_eq!(route.provider_id, "ollama");
        assert_eq!(route.upstream_base_url, "http://127.0.0.1:11434");
    }
}
