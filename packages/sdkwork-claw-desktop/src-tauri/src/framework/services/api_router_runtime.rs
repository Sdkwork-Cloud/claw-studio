use crate::framework::{paths::AppPaths, FrameworkError, Result};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};

pub(crate) const DEFAULT_GATEWAY_BIND: &str = "127.0.0.1:12100";
pub(crate) const DEFAULT_ADMIN_BIND: &str = "127.0.0.1:12101";
pub(crate) const DEFAULT_PORTAL_BIND: &str = "127.0.0.1:12102";
pub(crate) const DEFAULT_WEB_BIND: &str = "127.0.0.1:12103";
const DEFAULT_GATEWAY_HEALTH_PATH: &str = "/health";
const DEFAULT_ADMIN_HEALTH_PATH: &str = "/admin/health";
const DEFAULT_PORTAL_HEALTH_PATH: &str = "/portal/health";
const DEFAULT_PROBE_TIMEOUT_MS: u64 = 300;
pub(crate) const ROUTER_CONFIG_FILE_NAMES: [&str; 3] = ["config.yaml", "config.yml", "config.json"];
const DEFAULT_BIND_HOST: &str = "127.0.0.1";
const HOST_BASE_PORT_ENV: &str = "SDKWORK_API_ROUTER_BASE_PORT";
const HOST_GATEWAY_BIND_ENV: &str = "SDKWORK_API_ROUTER_GATEWAY_BIND";
const HOST_ADMIN_BIND_ENV: &str = "SDKWORK_API_ROUTER_ADMIN_BIND";
const HOST_PORTAL_BIND_ENV: &str = "SDKWORK_API_ROUTER_PORTAL_BIND";
const HOST_WEB_BIND_ENV: &str = "SDKWORK_API_ROUTER_WEB_BIND";
const HOST_ENABLE_ADMIN_ENV: &str = "SDKWORK_API_ROUTER_ENABLE_ADMIN";
const HOST_ENABLE_PORTAL_ENV: &str = "SDKWORK_API_ROUTER_ENABLE_PORTAL";
const UPSTREAM_GATEWAY_BIND_ENV: &str = "SDKWORK_GATEWAY_BIND";
const UPSTREAM_ADMIN_BIND_ENV: &str = "SDKWORK_ADMIN_BIND";
const UPSTREAM_PORTAL_BIND_ENV: &str = "SDKWORK_PORTAL_BIND";
const UPSTREAM_WEB_BIND_ENV: &str = "SDKWORK_WEB_BIND";
const UPSTREAM_ENABLE_ADMIN_ENV: &str = "SDKWORK_ENABLE_ADMIN";
const UPSTREAM_ENABLE_PORTAL_ENV: &str = "SDKWORK_ENABLE_PORTAL";

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApiRouterRuntimeMode {
    AttachedExternal,
    ManagedActive,
    NeedsManagedStart,
    Conflicted,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApiRouterManagedMode {
    InProcess,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApiRouterConfigSource {
    Defaults,
    File,
    Env,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterEndpointRuntimeStatus {
    pub bind_addr: String,
    pub health_url: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_base_url: Option<String>,
    pub healthy: bool,
    pub port_available: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRouterRuntimeStatus {
    pub mode: ApiRouterRuntimeMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommended_managed_mode: Option<ApiRouterManagedMode>,
    pub shared_root_dir: String,
    pub config_dir: String,
    pub config_source: ApiRouterConfigSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_config_file: Option<String>,
    pub admin: ApiRouterEndpointRuntimeStatus,
    pub portal: ApiRouterEndpointRuntimeStatus,
    pub gateway: ApiRouterEndpointRuntimeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_site_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub portal_site_base_url: Option<String>,
    pub reason: String,
}

#[derive(Clone, Debug, Default)]
pub struct ApiRouterRuntimeService;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LoadedApiRouterConfig {
    pub config_dir: PathBuf,
    pub gateway_bind: String,
    pub admin_bind: String,
    pub portal_bind: String,
    pub web_bind: String,
    pub enable_admin: bool,
    pub enable_portal: bool,
    pub config_source: ApiRouterConfigSource,
    pub resolved_config_file: Option<PathBuf>,
    pub bind_env_overrides: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
struct ApiRouterConfigFile {
    gateway_bind: Option<String>,
    admin_bind: Option<String>,
    portal_bind: Option<String>,
    web_bind: Option<String>,
    enable_admin: Option<bool>,
    enable_portal: Option<bool>,
}

impl ApiRouterRuntimeService {
    pub fn new() -> Self {
        Self
    }

    pub fn inspect(&self, paths: &AppPaths) -> Result<ApiRouterRuntimeStatus> {
        let shared_root_dir = shared_router_root(paths);
        let config = load_router_config(&shared_root_dir)?;
        inspect_router_runtime(shared_root_dir, config)
    }
}

pub(crate) fn shared_router_root(paths: &AppPaths) -> PathBuf {
    let shared_namespace_root = paths
        .user_root
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| paths.user_root.clone());
    shared_namespace_root.join("router")
}

impl ApiRouterRuntimeStatus {
    pub fn with_managed_active(mut self, managed_active: bool) -> Self {
        if managed_active
            && self.gateway.healthy
            && endpoint_satisfies_required_health(&self.admin)
            && endpoint_satisfies_required_health(&self.portal)
        {
            self.mode = ApiRouterRuntimeMode::ManagedActive;
            self.recommended_managed_mode = None;
            self.reason =
                "Claw Studio is managing the sdkwork-api-router runtime for this session."
                    .to_string();
        }

        self
    }
}

fn inspect_router_runtime(
    shared_root_dir: PathBuf,
    config: LoadedApiRouterConfig,
) -> Result<ApiRouterRuntimeStatus> {
    let admin = inspect_endpoint(
        &config.admin_bind,
        DEFAULT_ADMIN_HEALTH_PATH,
        config.enable_admin,
        config
            .enable_admin
            .then(|| public_admin_base_url(&config.web_bind))
            .transpose()?,
    )?;
    let portal = inspect_endpoint(
        &config.portal_bind,
        DEFAULT_PORTAL_HEALTH_PATH,
        config.enable_portal,
        config
            .enable_portal
            .then(|| public_portal_base_url(&config.web_bind))
            .transpose()?,
    )?;
    let gateway = inspect_endpoint(
        &config.gateway_bind,
        DEFAULT_GATEWAY_HEALTH_PATH,
        true,
        Some(public_gateway_base_url(&config.web_bind)?),
    )?;

    let (mode, recommended_managed_mode, reason) = if gateway.healthy
        && endpoint_satisfies_required_health(&admin)
        && endpoint_satisfies_required_health(&portal)
    {
        (
            ApiRouterRuntimeMode::AttachedExternal,
            None,
            "Detected a healthy independently started sdkwork-api-router runtime.".to_string(),
        )
    } else if gateway.port_available
        && endpoint_satisfies_required_port_availability(&admin)
        && endpoint_satisfies_required_port_availability(&portal)
    {
        (
            ApiRouterRuntimeMode::NeedsManagedStart,
            Some(ApiRouterManagedMode::InProcess),
            "No healthy external sdkwork-api-router runtime is attached; start the managed in-process runtime.".to_string(),
        )
    } else {
        (
            ApiRouterRuntimeMode::Conflicted,
            None,
            "The configured sdkwork-api-router ports are occupied but the runtime health probe failed.".to_string(),
        )
    };

    Ok(ApiRouterRuntimeStatus {
        mode,
        recommended_managed_mode,
        shared_root_dir: shared_root_dir.to_string_lossy().into_owned(),
        config_dir: config.config_dir.to_string_lossy().into_owned(),
        config_source: config.config_source,
        resolved_config_file: config
            .resolved_config_file
            .map(|path| path.to_string_lossy().into_owned()),
        admin,
        portal,
        gateway,
        admin_site_base_url: config
            .enable_admin
            .then(|| public_site_base_url(&config.web_bind, "/admin"))
            .transpose()?,
        portal_site_base_url: config
            .enable_portal
            .then(|| public_site_base_url(&config.web_bind, "/portal"))
            .transpose()?,
        reason,
    })
}

pub(crate) fn load_router_config(shared_root_dir: &Path) -> Result<LoadedApiRouterConfig> {
    load_router_config_with_env(shared_root_dir, &current_process_env())
}

pub(crate) fn load_router_config_with_env(
    shared_root_dir: &Path,
    env: &HashMap<String, String>,
) -> Result<LoadedApiRouterConfig> {
    fs::create_dir_all(shared_root_dir)?;

    let mut config = LoadedApiRouterConfig {
        config_dir: shared_root_dir.to_path_buf(),
        gateway_bind: DEFAULT_GATEWAY_BIND.to_string(),
        admin_bind: DEFAULT_ADMIN_BIND.to_string(),
        portal_bind: DEFAULT_PORTAL_BIND.to_string(),
        web_bind: DEFAULT_WEB_BIND.to_string(),
        enable_admin: true,
        enable_portal: true,
        config_source: ApiRouterConfigSource::Defaults,
        resolved_config_file: None,
        bind_env_overrides: BTreeMap::new(),
    };

    for file_name in ROUTER_CONFIG_FILE_NAMES {
        let path = shared_root_dir.join(file_name);
        if !path.exists() {
            continue;
        }

        let content = fs::read_to_string(&path)?;
        let parsed = parse_router_config(&path, &content)?;
        config.gateway_bind = parsed
            .gateway_bind
            .unwrap_or_else(|| DEFAULT_GATEWAY_BIND.to_string());
        config.admin_bind = parsed
            .admin_bind
            .unwrap_or_else(|| DEFAULT_ADMIN_BIND.to_string());
        config.portal_bind = parsed
            .portal_bind
            .unwrap_or_else(|| DEFAULT_PORTAL_BIND.to_string());
        config.web_bind = parsed.web_bind.unwrap_or_else(|| DEFAULT_WEB_BIND.to_string());
        config.enable_admin = parsed.enable_admin.unwrap_or(true);
        config.enable_portal = parsed.enable_portal.unwrap_or(true);
        config.config_source = ApiRouterConfigSource::File;
        config.resolved_config_file = Some(path);
        break;
    }

    let bind_env_overrides = resolve_bind_env_overrides(env)?;
    let web_bind_override = resolve_bind_override(
        env,
        HOST_WEB_BIND_ENV,
        UPSTREAM_WEB_BIND_ENV,
        resolve_host_base_port(env)?
            .map(|port| bind_for_port(port, 3))
            .transpose()?,
    );
    let enable_admin_override =
        resolve_boolean_override(env, HOST_ENABLE_ADMIN_ENV, UPSTREAM_ENABLE_ADMIN_ENV)?;
    let enable_portal_override =
        resolve_boolean_override(env, HOST_ENABLE_PORTAL_ENV, UPSTREAM_ENABLE_PORTAL_ENV)?;
    if let Some(bind) = bind_env_overrides.get(UPSTREAM_GATEWAY_BIND_ENV) {
        config.gateway_bind = bind.clone();
    }
    if let Some(bind) = bind_env_overrides.get(UPSTREAM_ADMIN_BIND_ENV) {
        config.admin_bind = bind.clone();
    }
    if let Some(bind) = bind_env_overrides.get(UPSTREAM_PORTAL_BIND_ENV) {
        config.portal_bind = bind.clone();
    }
    if let Some(bind) = web_bind_override {
        config.web_bind = bind;
    }
    if let Some(enabled) = enable_admin_override {
        config.enable_admin = enabled;
    }
    if let Some(enabled) = enable_portal_override {
        config.enable_portal = enabled;
    }
    if !bind_env_overrides.is_empty()
        || non_empty_env_value(env, HOST_WEB_BIND_ENV).is_some()
        || non_empty_env_value(env, UPSTREAM_WEB_BIND_ENV).is_some()
        || non_empty_env_value(env, HOST_ENABLE_ADMIN_ENV).is_some()
        || non_empty_env_value(env, UPSTREAM_ENABLE_ADMIN_ENV).is_some()
        || non_empty_env_value(env, HOST_ENABLE_PORTAL_ENV).is_some()
        || non_empty_env_value(env, UPSTREAM_ENABLE_PORTAL_ENV).is_some()
    {
        config.config_source = ApiRouterConfigSource::Env;
    }
    config.bind_env_overrides = bind_env_overrides;

    Ok(config)
}

fn current_process_env() -> HashMap<String, String> {
    std::env::vars().collect()
}

fn resolve_bind_env_overrides(values: &HashMap<String, String>) -> Result<BTreeMap<String, String>> {
    let base_port = resolve_host_base_port(values)?;
    let gateway_bind = resolve_bind_override(
        values,
        HOST_GATEWAY_BIND_ENV,
        UPSTREAM_GATEWAY_BIND_ENV,
        base_port.map(|port| bind_for_port(port, 0)).transpose()?,
    );
    let admin_bind = resolve_bind_override(
        values,
        HOST_ADMIN_BIND_ENV,
        UPSTREAM_ADMIN_BIND_ENV,
        base_port.map(|port| bind_for_port(port, 1)).transpose()?,
    );
    let portal_bind = resolve_bind_override(
        values,
        HOST_PORTAL_BIND_ENV,
        UPSTREAM_PORTAL_BIND_ENV,
        base_port.map(|port| bind_for_port(port, 2)).transpose()?,
    );

    let mut overrides = BTreeMap::new();
    if let Some(bind) = gateway_bind {
        overrides.insert(UPSTREAM_GATEWAY_BIND_ENV.to_string(), bind);
    }
    if let Some(bind) = admin_bind {
        overrides.insert(UPSTREAM_ADMIN_BIND_ENV.to_string(), bind);
    }
    if let Some(bind) = portal_bind {
        overrides.insert(UPSTREAM_PORTAL_BIND_ENV.to_string(), bind);
    }

    Ok(overrides)
}

fn resolve_host_base_port(values: &HashMap<String, String>) -> Result<Option<u16>> {
    let Some(raw) = values
        .get(HOST_BASE_PORT_ENV)
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    let port = raw.parse::<u32>().map_err(|error| {
        FrameworkError::ValidationFailed(format!(
            "invalid {} value {raw}: {error}",
            HOST_BASE_PORT_ENV
        ))
    })?;
    if port > u16::MAX as u32 || port + 3 > u16::MAX as u32 {
        return Err(FrameworkError::ValidationFailed(format!(
            "invalid {} value {raw}: expected a base port that keeps gateway/admin/portal/web within 0-65535",
            HOST_BASE_PORT_ENV
        )));
    }

    Ok(Some(port as u16))
}

fn bind_for_port(base_port: u16, offset: u16) -> Result<String> {
    let port = u32::from(base_port) + u32::from(offset);
    if port > u32::from(u16::MAX) {
        return Err(FrameworkError::ValidationFailed(format!(
            "invalid {} value {}: derived port {} is out of range",
            HOST_BASE_PORT_ENV, base_port, port
        )));
    }

    Ok(format!("{DEFAULT_BIND_HOST}:{}", port))
}

fn resolve_bind_override(
    values: &HashMap<String, String>,
    host_key: &str,
    upstream_key: &str,
    fallback: Option<String>,
) -> Option<String> {
    non_empty_env_value(values, host_key)
        .or_else(|| non_empty_env_value(values, upstream_key))
        .or(fallback)
}

fn resolve_boolean_override(
    values: &HashMap<String, String>,
    host_key: &str,
    upstream_key: &str,
) -> Result<Option<bool>> {
    let Some(raw) = non_empty_env_value(values, host_key)
        .or_else(|| non_empty_env_value(values, upstream_key))
    else {
        return Ok(None);
    };

    parse_bool_env(&raw, host_key).map(Some)
}

fn non_empty_env_value(values: &HashMap<String, String>, key: &str) -> Option<String> {
    values
        .get(key)
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn parse_bool_env(value: &str, key: &str) -> Result<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => Err(FrameworkError::ValidationFailed(format!(
            "invalid {key} value {value}: expected true/false"
        ))),
    }
}

fn parse_router_config(path: &Path, content: &str) -> Result<ApiRouterConfigFile> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "json" => json5::from_str::<ApiRouterConfigFile>(content).map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "failed to parse router config JSON {}: {error}",
                path.display()
            ))
        }),
        "yaml" | "yml" => serde_yaml::from_str::<ApiRouterConfigFile>(content).map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "failed to parse router config YAML {}: {error}",
                path.display()
            ))
        }),
        _ => Err(FrameworkError::ValidationFailed(format!(
            "unsupported router config format: {}",
            path.display()
        ))),
    }
}

fn inspect_endpoint(
    bind_addr: &str,
    health_path: &str,
    enabled: bool,
    public_base_url: Option<String>,
) -> Result<ApiRouterEndpointRuntimeStatus> {
    let socket_addr = parse_socket_addr(bind_addr)?;
    let health_url = format!("http://{}{}", socket_addr, health_path);

    Ok(ApiRouterEndpointRuntimeStatus {
        bind_addr: socket_addr.to_string(),
        health_url,
        enabled,
        public_base_url,
        healthy: enabled && probe_health(&socket_addr, health_path, DEFAULT_PROBE_TIMEOUT_MS),
        port_available: !enabled || TcpListener::bind(socket_addr).is_ok(),
    })
}

fn parse_socket_addr(bind_addr: &str) -> Result<SocketAddr> {
    bind_addr.parse::<SocketAddr>().map_err(|error| {
        FrameworkError::ValidationFailed(format!(
            "invalid router bind address {bind_addr}: {error}"
        ))
    })
}

fn probe_health(socket_addr: &SocketAddr, health_path: &str, timeout_ms: u64) -> bool {
    let timeout = Duration::from_millis(timeout_ms);
    let mut stream = match TcpStream::connect_timeout(socket_addr, timeout) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

    let request =
        format!("GET {health_path} HTTP/1.1\r\nHost: {socket_addr}\r\nConnection: close\r\n\r\n");

    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

fn endpoint_satisfies_required_health(endpoint: &ApiRouterEndpointRuntimeStatus) -> bool {
    !endpoint.enabled || endpoint.healthy
}

fn endpoint_satisfies_required_port_availability(endpoint: &ApiRouterEndpointRuntimeStatus) -> bool {
    !endpoint.enabled || endpoint.port_available
}

fn public_gateway_base_url(web_bind: &str) -> Result<String> {
    public_site_base_url(web_bind, "/api")
}

fn public_admin_base_url(web_bind: &str) -> Result<String> {
    public_site_base_url(web_bind, "/api/admin")
}

fn public_portal_base_url(web_bind: &str) -> Result<String> {
    public_site_base_url(web_bind, "/api/portal")
}

fn public_site_base_url(web_bind: &str, suffix: &str) -> Result<String> {
    Ok(format!("http://{}{}", parse_socket_addr(web_bind)?, suffix))
}

#[cfg(test)]
mod tests {
    use super::{
        inspect_router_runtime, load_router_config_with_env, shared_router_root,
        ApiRouterConfigSource, ApiRouterManagedMode, ApiRouterRuntimeMode,
        ApiRouterRuntimeService, DEFAULT_ADMIN_BIND, DEFAULT_GATEWAY_BIND,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use serde_json::Value;
    use std::{
        collections::HashMap,
        fs,
        io::{Read, Write},
        net::TcpListener,
        path::Path,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        thread::{self, JoinHandle},
        time::Duration,
    };

    struct TestHealthServer {
        bind_addr: String,
        shutdown: Arc<AtomicBool>,
        handle: Option<JoinHandle<()>>,
    }

    impl TestHealthServer {
        fn start(expected_path: &'static str) -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
            listener
                .set_nonblocking(true)
                .expect("listener non blocking");
            let bind_addr = listener.local_addr().expect("local addr").to_string();
            let shutdown = Arc::new(AtomicBool::new(false));
            let shutdown_signal = shutdown.clone();
            let handle = thread::spawn(move || {
                while !shutdown_signal.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((mut stream, _)) => {
                            let mut buffer = [0_u8; 1024];
                            let bytes_read = stream.read(&mut buffer).unwrap_or(0);
                            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
                            let status = if request.starts_with(&format!("GET {expected_path} ")) {
                                "200 OK"
                            } else {
                                "404 Not Found"
                            };
                            let body = if status == "200 OK" { "ok" } else { "missing" };
                            let response = format!(
                                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                                body.len()
                            );
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.flush();
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(_) => break,
                    }
                }
            });

            Self {
                bind_addr,
                shutdown,
                handle: Some(handle),
            }
        }
    }

    impl Drop for TestHealthServer {
        fn drop(&mut self) {
            self.shutdown.store(true, Ordering::Relaxed);
            let _ = TcpListener::bind("127.0.0.1:0");
            if let Some(handle) = self.handle.take() {
                let _ = handle.join();
            }
        }
    }

    fn reserve_available_bind_addr() -> String {
        TcpListener::bind("127.0.0.1:0")
            .expect("listener")
            .local_addr()
            .expect("local addr")
            .to_string()
    }

    fn router_root_for(paths: &crate::framework::paths::AppPaths) -> std::path::PathBuf {
        shared_router_root(paths)
    }

    fn write_router_config(root: &Path, filename: &str, content: &str) {
        fs::create_dir_all(root).expect("router root");
        fs::write(root.join(filename), content).expect("router config");
    }

    #[test]
    fn detects_attached_external_router_when_both_health_endpoints_are_ready() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        let admin_server = TestHealthServer::start("/admin/health");
        let portal_server = TestHealthServer::start("/portal/health");
        let gateway_server = TestHealthServer::start("/health");
        let web_bind = reserve_available_bind_addr();
        write_router_config(
            &router_root,
            "config.json",
            &format!(
                "{{\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"gateway_bind\":\"{}\",\"web_bind\":\"{}\"}}",
                admin_server.bind_addr, portal_server.bind_addr, gateway_server.bind_addr, web_bind
            ),
        );

        let status = ApiRouterRuntimeService::new()
            .inspect(&paths)
            .expect("runtime status");

        assert_eq!(status.mode, ApiRouterRuntimeMode::AttachedExternal);
        assert_eq!(status.recommended_managed_mode, None);
        assert_eq!(status.config_source, ApiRouterConfigSource::File);
        assert_eq!(
            status.resolved_config_file,
            Some(
                router_root
                    .join("config.json")
                    .to_string_lossy()
                    .into_owned()
            )
        );
        assert!(status.admin.healthy);
        assert!(status.gateway.healthy);
        assert!(!status.admin.port_available);
        assert!(!status.gateway.port_available);
    }

    #[test]
    fn recommends_managed_in_process_start_when_router_ports_are_free() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        let admin_bind = reserve_available_bind_addr();
        let portal_bind = reserve_available_bind_addr();
        let gateway_bind = reserve_available_bind_addr();
        let web_bind = reserve_available_bind_addr();
        write_router_config(
            &router_root,
            "config.yaml",
            &format!(
                "admin_bind: \"{admin_bind}\"\nportal_bind: \"{portal_bind}\"\ngateway_bind: \"{gateway_bind}\"\nweb_bind: \"{web_bind}\"\n"
            ),
        );

        let status = ApiRouterRuntimeService::new()
            .inspect(&paths)
            .expect("runtime status");

        assert_eq!(status.mode, ApiRouterRuntimeMode::NeedsManagedStart);
        assert_eq!(
            status.recommended_managed_mode,
            Some(ApiRouterManagedMode::InProcess)
        );
        assert_eq!(status.config_source, ApiRouterConfigSource::File);
        assert!(!status.admin.healthy);
        assert!(!status.gateway.healthy);
        assert!(status.admin.port_available);
        assert!(status.gateway.port_available);
    }

    #[test]
    fn marks_healthy_runtime_as_managed_active_when_owned_by_claw() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        let admin_server = TestHealthServer::start("/admin/health");
        let portal_server = TestHealthServer::start("/portal/health");
        let gateway_server = TestHealthServer::start("/health");
        let web_bind = reserve_available_bind_addr();
        write_router_config(
            &router_root,
            "config.json",
            &format!(
                "{{\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"gateway_bind\":\"{}\",\"web_bind\":\"{}\"}}",
                admin_server.bind_addr, portal_server.bind_addr, gateway_server.bind_addr, web_bind
            ),
        );

        let status = ApiRouterRuntimeService::new()
            .inspect(&paths)
            .expect("runtime status")
            .with_managed_active(true);

        assert_eq!(status.mode, ApiRouterRuntimeMode::ManagedActive);
        assert_eq!(status.recommended_managed_mode, None);
        assert_eq!(
            status.reason,
            "Claw Studio is managing the sdkwork-api-router runtime for this session."
        );
    }

    #[test]
    fn marks_runtime_conflicted_when_ports_are_occupied_but_health_probe_fails() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        let admin_listener = TcpListener::bind("127.0.0.1:0").expect("admin listener");
        let portal_listener = TcpListener::bind("127.0.0.1:0").expect("portal listener");
        let gateway_listener = TcpListener::bind("127.0.0.1:0").expect("gateway listener");
        let web_bind = reserve_available_bind_addr();
        write_router_config(
            &router_root,
            "config.json",
            &format!(
                "{{\"admin_bind\":\"{}\",\"portal_bind\":\"{}\",\"gateway_bind\":\"{}\",\"web_bind\":\"{}\"}}",
                admin_listener.local_addr().expect("admin addr"),
                portal_listener.local_addr().expect("portal addr"),
                gateway_listener.local_addr().expect("gateway addr"),
                web_bind
            ),
        );

        let status = ApiRouterRuntimeService::new()
            .inspect(&paths)
            .expect("runtime status");

        assert_eq!(status.mode, ApiRouterRuntimeMode::Conflicted);
        assert_eq!(status.recommended_managed_mode, None);
        assert!(!status.admin.healthy);
        assert!(!status.gateway.healthy);
        assert!(!status.admin.port_available);
        assert!(!status.gateway.port_available);
    }

    #[test]
    fn loads_default_binds_when_no_shared_router_config_exists() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);

        let config = load_router_config_with_env(&router_root, &HashMap::new())
            .expect("runtime config");

        assert_eq!(config.gateway_bind, DEFAULT_GATEWAY_BIND);
        assert_eq!(config.admin_bind, DEFAULT_ADMIN_BIND);
        assert_eq!(config.config_source, ApiRouterConfigSource::Defaults);
        assert_eq!(config.resolved_config_file, None);
    }

    #[test]
    fn inspects_default_runtime_endpoints_when_no_shared_router_config_exists() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);

        let status = inspect_router_runtime(
            router_root.clone(),
            load_router_config_with_env(&router_root, &HashMap::new()).expect("runtime config"),
        )
        .expect("runtime status");

        assert_eq!(status.config_source, ApiRouterConfigSource::Defaults);
        assert_eq!(status.gateway.bind_addr, "127.0.0.1:12100");
        assert_eq!(status.gateway.health_url, "http://127.0.0.1:12100/health");
        assert_eq!(status.admin.bind_addr, "127.0.0.1:12101");
        assert_eq!(
            status.admin.health_url,
            "http://127.0.0.1:12101/admin/health"
        );
    }

    #[test]
    fn runtime_status_serializes_public_host_urls_and_portal_endpoint_defaults() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let status = ApiRouterRuntimeService::new()
            .inspect(&paths)
            .expect("runtime status");
        let value = serde_json::to_value(&status).expect("serialized runtime status");

        assert_eq!(value["gateway"]["bindAddr"], Value::String("127.0.0.1:12100".to_string()));
        assert_eq!(
            value["admin"]["bindAddr"],
            Value::String("127.0.0.1:12101".to_string())
        );
        assert_eq!(
            value["portal"]["bindAddr"],
            Value::String("127.0.0.1:12102".to_string())
        );
        assert_eq!(
            value["gateway"]["publicBaseUrl"],
            Value::String("http://127.0.0.1:12103/api".to_string())
        );
        assert_eq!(
            value["admin"]["publicBaseUrl"],
            Value::String("http://127.0.0.1:12103/api/admin".to_string())
        );
        assert_eq!(
            value["portal"]["publicBaseUrl"],
            Value::String("http://127.0.0.1:12103/api/portal".to_string())
        );
        assert_eq!(value["admin"]["enabled"], Value::Bool(true));
        assert_eq!(value["portal"]["enabled"], Value::Bool(true));
        assert_eq!(
            value["adminSiteBaseUrl"],
            Value::String("http://127.0.0.1:12103/admin".to_string())
        );
        assert_eq!(
            value["portalSiteBaseUrl"],
            Value::String("http://127.0.0.1:12103/portal".to_string())
        );
    }

    #[test]
    fn load_router_config_supports_host_base_port_overrides() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        let env = std::collections::HashMap::from([(
            "SDKWORK_API_ROUTER_BASE_PORT".to_string(),
            "13100".to_string(),
        )]);

        let config = load_router_config_with_env(&router_root, &env).expect("runtime config");

        assert_eq!(config.gateway_bind, "127.0.0.1:13100");
        assert_eq!(config.admin_bind, "127.0.0.1:13101");
        assert_eq!(config.portal_bind, "127.0.0.1:13102");
        assert_eq!(config.config_source, ApiRouterConfigSource::Env);
        assert_eq!(
            config.bind_env_overrides.get("SDKWORK_GATEWAY_BIND"),
            Some(&"127.0.0.1:13100".to_string())
        );
        assert_eq!(
            config.bind_env_overrides.get("SDKWORK_ADMIN_BIND"),
            Some(&"127.0.0.1:13101".to_string())
        );
        assert_eq!(
            config.bind_env_overrides.get("SDKWORK_PORTAL_BIND"),
            Some(&"127.0.0.1:13102".to_string())
        );
    }

    #[test]
    fn load_router_config_prefers_host_bind_env_over_file_values() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        write_router_config(
            &router_root,
            "config.json",
            "{\"gateway_bind\":\"127.0.0.1:22100\",\"admin_bind\":\"127.0.0.1:22101\",\"portal_bind\":\"127.0.0.1:22102\"}",
        );
        let env = std::collections::HashMap::from([
            (
                "SDKWORK_API_ROUTER_GATEWAY_BIND".to_string(),
                "127.0.0.1:23100".to_string(),
            ),
            (
                "SDKWORK_API_ROUTER_ADMIN_BIND".to_string(),
                "127.0.0.1:23101".to_string(),
            ),
        ]);

        let config = load_router_config_with_env(&router_root, &env).expect("runtime config");

        assert_eq!(config.gateway_bind, "127.0.0.1:23100");
        assert_eq!(config.admin_bind, "127.0.0.1:23101");
        assert_eq!(config.portal_bind, "127.0.0.1:22102");
        assert_eq!(config.config_source, ApiRouterConfigSource::Env);
        assert_eq!(
            config.resolved_config_file,
            Some(router_root.join("config.json"))
        );
    }

    #[test]
    fn load_router_config_rejects_invalid_host_base_port() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let router_root = router_root_for(&paths);
        let env = std::collections::HashMap::from([(
            "SDKWORK_API_ROUTER_BASE_PORT".to_string(),
            "70000".to_string(),
        )]);

        let error =
            load_router_config_with_env(&router_root, &env).expect_err("invalid base port");

        assert!(error.to_string().contains("SDKWORK_API_ROUTER_BASE_PORT"));
    }
}
