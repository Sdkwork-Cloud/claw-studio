use crate::{
    framework::{layout::set_active_runtime_version, paths::AppPaths, FrameworkError, Result},
    platform,
};
use serde_json::{Map, Number, Value};
use std::{
    collections::BTreeMap,
    fs,
    net::{Ipv4Addr, SocketAddrV4, TcpListener},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

pub const OPENCLAW_RUNTIME_ID: &str = "openclaw";
const BUNDLED_RESOURCE_DIR: &str = "openclaw";
const NESTED_BUNDLED_RESOURCE_DIR: &str = "resources/openclaw";
const DEFAULT_GATEWAY_PORT: u16 = 18_789;
const LEGACY_PROVIDER_RUNTIME_CONFIG_KEYS: [&str; 5] =
    ["temperature", "topP", "maxTokens", "timeoutMs", "streaming"];

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledOpenClawManifest {
    pub schema_version: u32,
    pub runtime_id: String,
    pub openclaw_version: String,
    pub node_version: String,
    pub platform: String,
    pub arch: String,
    pub node_relative_path: String,
    pub cli_relative_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ActivatedOpenClawRuntime {
    pub install_key: String,
    pub install_dir: PathBuf,
    pub runtime_dir: PathBuf,
    pub node_path: PathBuf,
    pub cli_path: PathBuf,
    pub home_dir: PathBuf,
    pub state_dir: PathBuf,
    pub workspace_dir: PathBuf,
    pub config_path: PathBuf,
    pub gateway_port: u16,
    pub gateway_auth_token: String,
}

#[derive(Clone, Debug, Default)]
pub struct OpenClawRuntimeService;

#[derive(Clone, Debug, PartialEq, Eq)]
struct ManagedOpenClawState {
    home_dir: PathBuf,
    state_dir: PathBuf,
    workspace_dir: PathBuf,
    config_path: PathBuf,
    gateway_port: u16,
    gateway_auth_token: String,
}

impl BundledOpenClawManifest {
    pub fn install_key(&self) -> String {
        format!("{}-{}-{}", self.openclaw_version, self.platform, self.arch)
    }
}

impl ActivatedOpenClawRuntime {
    pub fn managed_env(&self) -> BTreeMap<String, String> {
        BTreeMap::from([
            (
                "OPENCLAW_HOME".to_string(),
                self.home_dir.to_string_lossy().into_owned(),
            ),
            (
                "OPENCLAW_STATE_DIR".to_string(),
                self.state_dir.to_string_lossy().into_owned(),
            ),
            (
                "OPENCLAW_CONFIG_PATH".to_string(),
                self.config_path.to_string_lossy().into_owned(),
            ),
            (
                "OPENCLAW_GATEWAY_TOKEN".to_string(),
                self.gateway_auth_token.clone(),
            ),
        ])
    }
}

impl OpenClawRuntimeService {
    pub fn new() -> Self {
        Self
    }

    pub fn ensure_bundled_runtime<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        paths: &AppPaths,
    ) -> Result<ActivatedOpenClawRuntime> {
        let resource_dir = app.path().resource_dir().map_err(FrameworkError::from)?;
        let resource_root = resolve_bundled_resource_root(&resource_dir)?;
        self.ensure_bundled_runtime_from_root(paths, &resource_root)
    }

    pub fn ensure_bundled_runtime_from_root(
        &self,
        paths: &AppPaths,
        resource_root: &Path,
    ) -> Result<ActivatedOpenClawRuntime> {
        let manifest = load_manifest(&resource_root.join("manifest.json"))?;
        validate_manifest_target(&manifest)?;

        if manifest.runtime_id != OPENCLAW_RUNTIME_ID {
            return Err(FrameworkError::ValidationFailed(format!(
                "unsupported bundled runtime id {}",
                manifest.runtime_id
            )));
        }

        let bundled_runtime_dir = resource_root.join("runtime");
        if !bundled_runtime_dir.exists() {
            return Err(FrameworkError::NotFound(format!(
                "bundled runtime directory not found: {}",
                bundled_runtime_dir.display()
            )));
        }

        let install_key = manifest.install_key();
        let install_dir = paths.openclaw_runtime_dir.join(&install_key);
        let runtime_dir = install_dir.join("runtime");
        let manifest_path = install_dir.join("manifest.json");

        ensure_runtime_installation(
            &bundled_runtime_dir,
            &resource_root.join("manifest.json"),
            &manifest,
            &install_dir,
            &runtime_dir,
            &manifest_path,
        )?;

        let node_path = install_dir.join(&manifest.node_relative_path);
        let cli_path = install_dir.join(&manifest.cli_relative_path);
        if !node_path.exists() || !cli_path.exists() {
            return Err(FrameworkError::NotFound(format!(
                "bundled openclaw runtime is incomplete under {}",
                install_dir.display()
            )));
        }

        let managed_state = ensure_managed_openclaw_state(paths)?;
        set_active_runtime_version(paths, OPENCLAW_RUNTIME_ID, &install_key)?;

        Ok(ActivatedOpenClawRuntime {
            install_key,
            install_dir,
            runtime_dir,
            node_path,
            cli_path,
            home_dir: managed_state.home_dir,
            state_dir: managed_state.state_dir,
            workspace_dir: managed_state.workspace_dir,
            config_path: managed_state.config_path,
            gateway_port: managed_state.gateway_port,
            gateway_auth_token: managed_state.gateway_auth_token,
        })
    }

    pub fn refresh_configured_runtime(
        &self,
        paths: &AppPaths,
        runtime: &ActivatedOpenClawRuntime,
    ) -> Result<ActivatedOpenClawRuntime> {
        if !runtime.node_path.exists()
            || !runtime.cli_path.exists()
            || !runtime.runtime_dir.exists()
        {
            return Err(FrameworkError::NotFound(format!(
                "configured openclaw runtime is incomplete under {}",
                runtime.install_dir.display()
            )));
        }

        let managed_state = ensure_managed_openclaw_state(paths)?;

        Ok(ActivatedOpenClawRuntime {
            install_key: runtime.install_key.clone(),
            install_dir: runtime.install_dir.clone(),
            runtime_dir: runtime.runtime_dir.clone(),
            node_path: runtime.node_path.clone(),
            cli_path: runtime.cli_path.clone(),
            home_dir: managed_state.home_dir,
            state_dir: managed_state.state_dir,
            workspace_dir: managed_state.workspace_dir,
            config_path: managed_state.config_path,
            gateway_port: managed_state.gateway_port,
            gateway_auth_token: managed_state.gateway_auth_token,
        })
    }
}

pub(crate) fn resolve_bundled_resource_root(resource_dir: &Path) -> Result<PathBuf> {
    resolve_bundled_resource_root_with_manifest_dir(
        resource_dir,
        Path::new(env!("CARGO_MANIFEST_DIR")),
    )
}

fn resolve_bundled_resource_root_with_manifest_dir(
    resource_dir: &Path,
    manifest_dir: &Path,
) -> Result<PathBuf> {
    let candidates = [
        resource_dir.join(BUNDLED_RESOURCE_DIR),
        resource_dir.join(NESTED_BUNDLED_RESOURCE_DIR),
        manifest_dir.join("resources").join(BUNDLED_RESOURCE_DIR),
    ];

    for candidate in candidates.iter() {
        if candidate.exists() {
            return Ok(candidate.to_path_buf());
        }
    }

    let candidate_paths = candidates
        .iter()
        .map(|candidate| candidate.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");

    Err(FrameworkError::NotFound(format!(
        "bundled openclaw runtime resources not found under any of: {candidate_paths}"
    )))
}

fn ensure_runtime_installation(
    bundled_runtime_dir: &Path,
    bundled_manifest_path: &Path,
    manifest: &BundledOpenClawManifest,
    install_dir: &Path,
    runtime_dir: &Path,
    manifest_path: &Path,
) -> Result<()> {
    let node_path = install_dir.join(&manifest.node_relative_path);
    let cli_path = install_dir.join(&manifest.cli_relative_path);
    if install_dir.exists() && node_path.exists() && cli_path.exists() && manifest_path.exists() {
        return Ok(());
    }

    if install_dir.exists() {
        fs::remove_dir_all(install_dir)?;
    }

    let staging_dir = install_dir.with_extension(format!("staging-{}", unix_timestamp_ms()?));
    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)?;
    }

    fs::create_dir_all(&staging_dir)?;
    copy_directory_recursive(bundled_runtime_dir, &staging_dir.join("runtime"))?;
    fs::copy(bundled_manifest_path, staging_dir.join("manifest.json"))?;

    if let Some(parent) = install_dir.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::rename(&staging_dir, install_dir)?;
    if !runtime_dir.exists() {
        return Err(FrameworkError::Internal(format!(
            "failed to finalize bundled runtime installation at {}",
            install_dir.display()
        )));
    }

    Ok(())
}

fn ensure_managed_openclaw_state(paths: &AppPaths) -> Result<ManagedOpenClawState> {
    fs::create_dir_all(&paths.openclaw_home_dir)?;
    fs::create_dir_all(&paths.openclaw_state_dir)?;
    fs::create_dir_all(&paths.openclaw_workspace_dir)?;

    let mut config = read_managed_config(&paths.openclaw_config_file)?;
    sanitize_legacy_provider_runtime_config(&mut config);
    set_nested_string(&mut config, &["gateway", "mode"], "local");
    set_nested_string(&mut config, &["gateway", "bind"], "loopback");
    let configured_port = get_nested_u16(&config, &["gateway", "port"]).filter(|port| *port > 0);
    let gateway_port = match configured_port {
        Some(port) if is_loopback_port_available(port) => port,
        Some(port) => find_available_gateway_port(port)?,
        None => find_available_gateway_port(DEFAULT_GATEWAY_PORT)?,
    };
    let gateway_auth_token = get_nested_string(&config, &["gateway", "auth", "token"])
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(generate_gateway_auth_token);
    set_nested_u16(&mut config, &["gateway", "port"], gateway_port);
    set_nested_string(&mut config, &["gateway", "auth", "mode"], "token");
    set_nested_string(
        &mut config,
        &["gateway", "auth", "token"],
        gateway_auth_token.as_str(),
    );
    ensure_nested_string_array_contains(&mut config, &["gateway", "tools", "allow"], "cron");
    set_nested_string(
        &mut config,
        &["agents", "defaults", "workspace"],
        &paths.openclaw_workspace_dir.to_string_lossy(),
    );

    fs::write(
        &paths.openclaw_config_file,
        format!("{}\n", serde_json::to_string_pretty(&config)?),
    )?;

    Ok(ManagedOpenClawState {
        home_dir: paths.openclaw_home_dir.clone(),
        state_dir: paths.openclaw_state_dir.clone(),
        workspace_dir: paths.openclaw_workspace_dir.clone(),
        config_path: paths.openclaw_config_file.clone(),
        gateway_port,
        gateway_auth_token,
    })
}

fn read_managed_config(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }

    let content = fs::read_to_string(path)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid managed openclaw config: {error}"))
    })?;

    if parsed.is_object() {
        return Ok(parsed);
    }

    Err(FrameworkError::ValidationFailed(format!(
        "managed openclaw config must be a JSON object: {}",
        path.display()
    )))
}

fn sanitize_legacy_provider_runtime_config(config: &mut Value) {
    let Some(models_root) = config.get_mut("models").and_then(Value::as_object_mut) else {
        return;
    };
    let Some(providers_root) = models_root
        .get_mut("providers")
        .and_then(Value::as_object_mut)
    else {
        return;
    };

    for provider in providers_root.values_mut() {
        let Some(provider_root) = provider.as_object_mut() else {
            continue;
        };

        for key in LEGACY_PROVIDER_RUNTIME_CONFIG_KEYS {
            provider_root.remove(key);
        }
    }
}

pub(crate) fn load_manifest(path: &Path) -> Result<BundledOpenClawManifest> {
    let content = fs::read_to_string(path)?;
    serde_json::from_str::<BundledOpenClawManifest>(&content).map_err(Into::into)
}

fn validate_manifest_target(manifest: &BundledOpenClawManifest) -> Result<()> {
    let expected_platform = normalized_target_platform();
    let expected_arch = normalized_target_arch();

    if manifest.platform != expected_platform || manifest.arch != expected_arch {
        return Err(FrameworkError::ValidationFailed(format!(
            "bundled openclaw runtime target mismatch: expected {expected_platform}-{expected_arch}, received {}-{}",
            manifest.platform, manifest.arch
        )));
    }

    Ok(())
}

fn normalized_target_platform() -> &'static str {
    match platform::current_target() {
        "windows" => "windows",
        "macos" => "macos",
        "linux" => "linux",
        other => other,
    }
}

fn normalized_target_arch() -> &'static str {
    match platform::current_arch() {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    }
}

fn copy_directory_recursive(source: &Path, target: &Path) -> Result<()> {
    fs::create_dir_all(target)?;

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let entry_path = entry.path();
        let target_path = target.join(entry.file_name());

        if entry.file_type()?.is_dir() {
            copy_directory_recursive(&entry_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry_path, target_path)?;
        }
    }

    Ok(())
}

fn set_nested_string(value: &mut Value, path: &[&str], next: &str) {
    set_nested_value(value, path, Value::String(next.to_string()));
}

fn set_nested_u16(value: &mut Value, path: &[&str], next: u16) {
    set_nested_value(value, path, Value::Number(Number::from(next)));
}

fn ensure_nested_string_array_contains(value: &mut Value, path: &[&str], item: &str) {
    let mut current = value;
    for segment in &path[..path.len() - 1] {
        let object = current.as_object_mut().expect("nested config objects");
        current = object
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if !current.is_object() {
            *current = Value::Object(Map::new());
        }
    }

    let entry = current
        .as_object_mut()
        .expect("nested config objects")
        .entry(path[path.len() - 1].to_string())
        .or_insert_with(|| Value::Array(Vec::new()));
    if !entry.is_array() {
        *entry = Value::Array(Vec::new());
    }

    let items = entry.as_array_mut().expect("nested config arrays");
    if items.iter().any(|value| value.as_str() == Some(item)) {
        return;
    }

    items.push(Value::String(item.to_string()));
}

fn set_nested_value(value: &mut Value, path: &[&str], next: Value) {
    if path.is_empty() {
        *value = next;
        return;
    }

    let mut current = value;
    for segment in &path[..path.len() - 1] {
        let object = current.as_object_mut().expect("nested config objects");
        current = object
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if !current.is_object() {
            *current = Value::Object(Map::new());
        }
    }

    current
        .as_object_mut()
        .expect("nested config objects")
        .insert(path[path.len() - 1].to_string(), next);
}

fn get_nested_u16(value: &Value, path: &[&str]) -> Option<u16> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }
    current
        .as_u64()
        .and_then(|number| u16::try_from(number).ok())
}

fn get_nested_string(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }

    current.as_str().map(|item| item.to_string())
}

fn generate_gateway_auth_token() -> String {
    Uuid::new_v4().simple().to_string()
}

fn unix_timestamp_ms() -> Result<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?
        .as_millis())
}

fn find_available_gateway_port(preferred_port: u16) -> Result<u16> {
    for candidate in preferred_port..preferred_port.saturating_add(32) {
        if is_loopback_port_available(candidate) {
            return Ok(candidate);
        }
    }

    reserve_any_loopback_port().ok_or_else(|| {
        FrameworkError::Conflict(
            "failed to reserve an available loopback port for the bundled openclaw gateway"
                .to_string(),
        )
    })
}

fn is_loopback_port_available(port: u16) -> bool {
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    TcpListener::bind(address).is_ok()
}

fn reserve_any_loopback_port() -> Option<u16> {
    TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))
        .ok()?
        .local_addr()
        .ok()
        .map(|address| address.port())
}

#[cfg(test)]
mod tests {
    use super::{
        normalized_target_arch, normalized_target_platform, resolve_bundled_resource_root,
        resolve_bundled_resource_root_with_manifest_dir, BundledOpenClawManifest,
        OpenClawRuntimeService, DEFAULT_GATEWAY_PORT, OPENCLAW_RUNTIME_ID,
    };
    use crate::framework::{layout::ActiveState, paths::resolve_paths_for_root};
    use serde_json::Value;
    use std::fs;

    const TEST_BUNDLED_OPENCLAW_VERSION: &str = env!("SDKWORK_BUNDLED_OPENCLAW_VERSION");

    #[test]
    fn installs_bundled_runtime_into_managed_directory_and_activates_it() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        let expected_install_key = format!(
            "{}-{}-{}",
            TEST_BUNDLED_OPENCLAW_VERSION,
            normalized_target_platform(),
            normalized_target_arch()
        );

        assert_eq!(activated.install_key, expected_install_key);
        assert!(activated.install_dir.exists());
        assert!(activated.runtime_dir.exists());
        assert!(activated.node_path.exists());
        assert!(activated.cli_path.exists());
        assert_eq!(
            activated.cli_path,
            activated
                .install_dir
                .join("runtime")
                .join("package")
                .join("node_modules")
                .join("openclaw")
                .join("openclaw.mjs")
        );
        assert_eq!(activated.home_dir, paths.openclaw_home_dir);
        assert_eq!(activated.state_dir, paths.openclaw_state_dir);
        assert_eq!(activated.workspace_dir, paths.openclaw_workspace_dir);
        assert_eq!(activated.config_path, paths.openclaw_config_file);
        assert!(activated.gateway_port >= DEFAULT_GATEWAY_PORT);
        assert!(paths
            .openclaw_runtime_dir
            .join(&expected_install_key)
            .join("manifest.json")
            .exists());

        let config = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_config_file).expect("config file"),
        )
        .expect("config json");
        assert_eq!(
            config.pointer("/gateway/mode").and_then(Value::as_str),
            Some("local")
        );
        assert_eq!(
            config.pointer("/gateway/bind").and_then(Value::as_str),
            Some("loopback")
        );
        assert_eq!(
            config
                .pointer("/gateway/http/endpoints/chatCompletions/enabled")
                .and_then(Value::as_bool),
            None
        );
        assert_eq!(
            config
                .pointer("/gateway/http/endpoints/responses/enabled")
                .and_then(Value::as_bool),
            None
        );
        assert_eq!(
            config.pointer("/gateway/auth/mode").and_then(Value::as_str),
            Some("token")
        );
        assert!(config
            .pointer("/gateway/auth/token")
            .and_then(Value::as_str)
            .is_some_and(|token| !token.trim().is_empty()));
        assert_eq!(
            config
                .pointer("/gateway/tools/allow")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>()),
            Some(vec!["cron"])
        );
        assert_eq!(
            config
                .pointer("/agents/defaults/workspace")
                .and_then(Value::as_str),
            Some(paths.openclaw_workspace_dir.to_string_lossy().as_ref())
        );

        let active = serde_json::from_str::<ActiveState>(
            &fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        assert_eq!(
            active
                .runtimes
                .get(OPENCLAW_RUNTIME_ID)
                .and_then(|entry| entry.active_version.as_deref()),
            Some(expected_install_key.as_str())
        );
    }

    #[test]
    fn reuses_existing_install_when_the_bundled_runtime_key_matches() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let sentinel = first.install_dir.join("sentinel.txt");
        fs::write(&sentinel, "keep").expect("sentinel");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert_eq!(first.install_key, second.install_key);
        assert!(sentinel.exists());
    }

    #[test]
    fn rejects_bundled_runtime_for_a_different_target() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture_for_target(
            temp.path(),
            TEST_BUNDLED_OPENCLAW_VERSION,
            "windows",
            "x64",
        );
        let service = OpenClawRuntimeService::new();

        if normalized_target_platform() == "windows" && normalized_target_arch() == "x64" {
            return;
        }

        let error = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect_err("target mismatch should fail");

        assert!(error.to_string().contains("target mismatch"));
    }

    #[test]
    fn rewrites_busy_gateway_ports_to_an_available_loopback_port() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();
        let busy_port = super::find_available_gateway_port(DEFAULT_GATEWAY_PORT)
            .expect("available busy-port candidate");
        let busy_listener = std::net::TcpListener::bind(("127.0.0.1", busy_port))
            .expect("busy gateway port listener");

        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {busy_port}\n  }}\n}}\n"),
        )
        .expect("seed config file");

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        drop(busy_listener);

        assert_ne!(activated.gateway_port, busy_port);

        let config = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_config_file).expect("config file"),
        )
        .expect("config json");
        assert_eq!(
            config.pointer("/gateway/port").and_then(Value::as_u64),
            Some(u64::from(activated.gateway_port))
        );
    }

    #[test]
    fn falls_back_to_os_assigned_port_when_preferred_window_is_unavailable() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();
        let (preferred_port, occupied_ports) = reserve_contiguous_port_window(32);

        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {preferred_port}\n  }}\n}}\n"),
        )
        .expect("seed config file");

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        drop(occupied_ports);

        assert!(activated.gateway_port > 0);
        assert!(
            activated.gateway_port < preferred_port
                || activated.gateway_port >= preferred_port.saturating_add(32)
        );

        let config = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_config_file).expect("config file"),
        )
        .expect("config json");
        assert_eq!(
            config.pointer("/gateway/port").and_then(Value::as_u64),
            Some(u64::from(activated.gateway_port))
        );
    }

    #[test]
    fn refresh_configured_runtime_uses_the_saved_gateway_port_when_available() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();
        let configured_port = 28_789;
        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {configured_port}\n  }}\n}}\n"),
        )
        .expect("seed config file");

        let refreshed = service
            .refresh_configured_runtime(&paths, &activated)
            .expect("refreshed runtime");

        assert_eq!(refreshed.gateway_port, configured_port);
    }

    #[test]
    fn preserves_existing_gateway_http_endpoint_flags_when_adding_cron() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        fs::write(
            &paths.openclaw_config_file,
            r#"{
  gateway: {
    tools: {
      allow: ["gateway", "cron"],
    },
    http: {
      endpoints: {
        chatCompletions: { enabled: false },
        responses: { enabled: false },
      },
    },
  },
}
"#,
        )
        .expect("seed config file");

        service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        let config = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_config_file).expect("config file"),
        )
        .expect("config json");
        assert_eq!(
            config
                .pointer("/gateway/tools/allow")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>()),
            Some(vec!["gateway", "cron"])
        );
        assert_eq!(
            config
                .pointer("/gateway/http/endpoints/chatCompletions/enabled")
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            config
                .pointer("/gateway/http/endpoints/responses/enabled")
                .and_then(Value::as_bool),
            Some(false)
        );
    }

    #[test]
    fn ensure_bundled_runtime_sanitizes_legacy_provider_runtime_fields() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        fs::write(
            &paths.openclaw_config_file,
            r#"{
  "models": {
    "providers": {
      "sdkwork-local-proxy": {
        "baseUrl": "http://127.0.0.1:18791/v1",
        "apiKey": "sk_sdkwork_api_key",
        "temperature": 0.35,
        "topP": 0.9,
        "maxTokens": 24000,
        "timeoutMs": 90000,
        "streaming": false,
        "models": [
          { "id": "gpt-5.4", "name": "GPT-5.4" }
        ]
      }
    }
  }
}
"#,
        )
        .expect("seed config file");

        service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        let config = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_config_file).expect("config file"),
        )
        .expect("config json");
        let provider = config
            .pointer("/models/providers/sdkwork-local-proxy")
            .and_then(Value::as_object)
            .expect("provider object");

        assert!(!provider.contains_key("temperature"));
        assert!(!provider.contains_key("topP"));
        assert!(!provider.contains_key("maxTokens"));
        assert!(!provider.contains_key("timeoutMs"));
        assert!(!provider.contains_key("streaming"));
    }

    #[test]
    fn refresh_configured_runtime_rewrites_busy_gateway_ports() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();
        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");
        let busy_port = super::find_available_gateway_port(DEFAULT_GATEWAY_PORT)
            .expect("available busy-port candidate");
        let busy_listener = std::net::TcpListener::bind(("127.0.0.1", busy_port))
            .expect("busy gateway port listener");

        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {busy_port}\n  }}\n}}\n"),
        )
        .expect("seed config file");

        let refreshed = service
            .refresh_configured_runtime(&paths, &activated)
            .expect("refreshed runtime");

        drop(busy_listener);

        assert_ne!(refreshed.gateway_port, busy_port);
        let config = serde_json::from_str::<Value>(
            &fs::read_to_string(&paths.openclaw_config_file).expect("config file"),
        )
        .expect("config json");
        assert_eq!(
            config.pointer("/gateway/port").and_then(Value::as_u64),
            Some(u64::from(refreshed.gateway_port))
        );
    }

    #[test]
    fn resolves_bundled_runtime_from_nested_resources_directory() {
        let temp = tempfile::tempdir().expect("temp dir");
        let resource_dir = temp.path().join("target").join("debug");
        let nested_resource_root = resource_dir.join("resources").join("openclaw");
        fs::create_dir_all(&nested_resource_root).expect("nested resource root");

        let resolved =
            resolve_bundled_resource_root(&resource_dir).expect("resolved resource root");

        assert_eq!(resolved, nested_resource_root);
    }

    #[test]
    fn resolves_bundled_runtime_from_source_resources_directory_when_dev_target_resources_are_missing(
    ) {
        let temp = tempfile::tempdir().expect("temp dir");
        let manifest_dir = temp.path().join("src-tauri");
        let resource_dir = temp.path().join("target").join("debug");
        let source_resource_root = manifest_dir.join("resources").join("openclaw");
        fs::create_dir_all(&source_resource_root).expect("source resource root");

        let resolved =
            resolve_bundled_resource_root_with_manifest_dir(&resource_dir, &manifest_dir)
                .expect("resolved source resource root");

        assert_eq!(resolved, source_resource_root);
    }

    fn create_bundled_runtime_fixture(root: &std::path::Path, version: &str) -> std::path::PathBuf {
        create_bundled_runtime_fixture_for_target(
            root,
            version,
            normalized_target_platform(),
            normalized_target_arch(),
        )
    }

    fn create_bundled_runtime_fixture_for_target(
        root: &std::path::Path,
        version: &str,
        platform: &str,
        arch: &str,
    ) -> std::path::PathBuf {
        let resource_root = root.join(format!("bundled-openclaw-{platform}-{arch}"));
        let runtime_root = resource_root.join("runtime");
        let node_relative_path = if platform == "windows" {
            "runtime/node/node.exe"
        } else {
            "runtime/node/bin/node"
        };
        let cli_relative_path = "runtime/package/node_modules/openclaw/openclaw.mjs";
        let node_path = resource_root.join(node_relative_path);
        let cli_path = resource_root.join(cli_relative_path);

        fs::create_dir_all(node_path.parent().expect("node parent")).expect("node dir");
        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&node_path, "node").expect("node file");
        fs::write(&cli_path, "console.log('openclaw');").expect("cli file");
        assert!(runtime_root.exists());

        let manifest = BundledOpenClawManifest {
            schema_version: 1,
            runtime_id: OPENCLAW_RUNTIME_ID.to_string(),
            openclaw_version: version.to_string(),
            node_version: "22.16.0".to_string(),
            platform: platform.to_string(),
            arch: arch.to_string(),
            node_relative_path: node_relative_path.to_string(),
            cli_relative_path: cli_relative_path.to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");

        resource_root
    }

    fn reserve_contiguous_port_window(size: u16) -> (u16, Vec<std::net::TcpListener>) {
        for start in 20_000..60_000u16.saturating_sub(size) {
            let mut listeners = Vec::new();
            let mut success = true;

            for port in start..start.saturating_add(size) {
                match std::net::TcpListener::bind(("127.0.0.1", port)) {
                    Ok(listener) => listeners.push(listener),
                    Err(_) => {
                        success = false;
                        break;
                    }
                }
            }

            if success {
                return (start, listeners);
            }
        }

        panic!("failed to reserve a contiguous loopback port window for the test");
    }
}
