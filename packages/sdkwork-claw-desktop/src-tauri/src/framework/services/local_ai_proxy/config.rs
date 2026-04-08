use super::{
    LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION, LOCAL_AI_PROXY_DEFAULT_BIND_HOST,
    LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY, LOCAL_AI_PROXY_DEFAULT_PORT,
    LOCAL_AI_PROXY_PUBLIC_BASE_HOST_CANDIDATES,
};
use crate::framework::{paths::AppPaths, FrameworkError, Result};
use serde_json::Value;
use std::{
    fs,
    net::{IpAddr, ToSocketAddrs},
};

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct LocalAiProxyConfigFile {
    pub(super) schema_version: u32,
    pub(super) bind_host: String,
    pub(super) public_base_host: String,
    pub(super) requested_port: u16,
    pub(super) client_api_key: String,
}

pub(super) fn ensure_local_ai_proxy_config(paths: &AppPaths) -> Result<LocalAiProxyConfigFile> {
    if !paths.local_ai_proxy_config_file.exists() {
        let config = LocalAiProxyConfigFile {
            schema_version: LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION,
            bind_host: LOCAL_AI_PROXY_DEFAULT_BIND_HOST.to_string(),
            public_base_host: default_local_ai_proxy_public_host(),
            requested_port: LOCAL_AI_PROXY_DEFAULT_PORT,
            client_api_key: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
        };
        fs::write(
            &paths.local_ai_proxy_config_file,
            format!("{}\n", serde_json::to_string_pretty(&config)?),
        )?;
        return Ok(config);
    }

    let content = fs::read_to_string(&paths.local_ai_proxy_config_file)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid local ai proxy config: {error}"))
    })?;
    let object = parsed.as_object().ok_or_else(|| {
        FrameworkError::ValidationFailed("local ai proxy config must be a JSON object".to_string())
    })?;

    Ok(LocalAiProxyConfigFile {
        schema_version: object
            .get("schemaVersion")
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION),
        bind_host: object
            .get("bindHost")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(LOCAL_AI_PROXY_DEFAULT_BIND_HOST)
            .to_string(),
        requested_port: object
            .get("requestedPort")
            .and_then(Value::as_u64)
            .and_then(|value| u16::try_from(value).ok())
            .unwrap_or(LOCAL_AI_PROXY_DEFAULT_PORT),
        client_api_key: object
            .get("clientApiKey")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)
            .to_string(),
        public_base_host: normalize_local_ai_proxy_public_host(
            object.get("publicBaseHost").and_then(Value::as_str),
        ),
    })
}

pub(crate) fn default_local_ai_proxy_public_host() -> String {
    let mut resolver = resolve_local_ai_proxy_public_host_addresses;
    resolve_default_local_ai_proxy_public_host_with_resolver(&mut resolver)
}

fn normalize_local_ai_proxy_public_host(value: Option<&str>) -> String {
    let mut resolver = resolve_local_ai_proxy_public_host_addresses;
    normalize_local_ai_proxy_public_host_with_resolver(value, &mut resolver)
}

fn normalize_local_ai_proxy_public_host_with_resolver<F>(
    value: Option<&str>,
    resolver: &mut F,
) -> String
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    let Some(candidate) = value
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
    else {
        return resolve_default_local_ai_proxy_public_host_with_resolver(resolver);
    };

    if local_ai_proxy_public_host_is_loopback_safe_with_resolver(candidate, resolver) {
        return candidate.to_string();
    }

    resolve_default_local_ai_proxy_public_host_with_resolver(resolver)
}

pub(super) fn resolve_default_local_ai_proxy_public_host_with_resolver<F>(
    resolver: &mut F,
) -> String
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    for candidate in LOCAL_AI_PROXY_PUBLIC_BASE_HOST_CANDIDATES {
        if local_ai_proxy_public_host_is_loopback_safe_with_resolver(candidate, resolver) {
            return candidate.to_string();
        }
    }

    "127.0.0.1".to_string()
}

fn local_ai_proxy_public_host_is_loopback_safe_with_resolver<F>(
    host: &str,
    resolver: &mut F,
) -> bool
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    let candidate = host.trim().trim_matches(['[', ']']);
    if candidate.is_empty() {
        return false;
    }

    let addresses = resolver(candidate);
    !addresses.is_empty() && addresses.iter().all(IpAddr::is_loopback)
}

fn resolve_local_ai_proxy_public_host_addresses(host: &str) -> Vec<IpAddr> {
    if let Ok(address) = host.parse::<IpAddr>() {
        return vec![address];
    }

    (host, 0)
        .to_socket_addrs()
        .map(|entries| entries.map(|entry| entry.ip()).collect())
        .unwrap_or_default()
}
