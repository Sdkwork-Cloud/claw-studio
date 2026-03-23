use crate::{
    framework::{
        paths::AppPaths,
        services::api_router_runtime::{
            load_router_config_with_env, shared_router_root, LoadedApiRouterConfig,
            ROUTER_CONFIG_FILE_NAMES,
        },
        FrameworkError, Result,
    },
    platform,
};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

pub const API_ROUTER_RUNTIME_ID: &str = "sdkwork-api-router";
const BUNDLED_RESOURCE_DIR: &str = "sdkwork-api-router-runtime";
const NESTED_BUNDLED_RESOURCE_DIR: &str = "resources/sdkwork-api-router-runtime";
const MANAGED_SECRET_FILE_NAME: &str = "claw-managed-secrets.json";
const MANAGED_SECRET_SCHEMA_VERSION: u32 = 1;
const DEFAULT_LEGACY_CREDENTIAL_MASTER_KEY: &str = "local-dev-master-key";

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledApiRouterManifest {
    pub schema_version: u32,
    pub runtime_id: String,
    pub router_version: String,
    pub platform: String,
    pub arch: String,
    pub gateway_relative_path: String,
    pub admin_relative_path: String,
    pub portal_relative_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ManagedApiRouterProcessSpec {
    pub command_path: PathBuf,
    pub args: Vec<String>,
    pub working_dir: Option<PathBuf>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ActivatedApiRouterRuntime {
    pub install_key: String,
    pub install_dir: PathBuf,
    pub shared_root_dir: PathBuf,
    pub bind_env_overrides: BTreeMap<String, String>,
    pub managed_secrets: ManagedApiRouterSecretBundle,
    pub gateway: ManagedApiRouterProcessSpec,
    pub admin: ManagedApiRouterProcessSpec,
    pub portal: ManagedApiRouterProcessSpec,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedApiRouterSecretBundle {
    pub schema_version: u32,
    pub admin_jwt_signing_secret: String,
    pub portal_jwt_signing_secret: String,
    pub credential_master_key: String,
}

#[derive(Clone, Debug, Default)]
pub struct ApiRouterManagedRuntimeService;

impl BundledApiRouterManifest {
    pub fn install_key(&self) -> String {
        format!("{}-{}-{}", self.router_version, self.platform, self.arch)
    }
}

impl ActivatedApiRouterRuntime {
    pub fn managed_env(&self) -> BTreeMap<String, String> {
        let mut env = BTreeMap::from([
            (
                "SDKWORK_CONFIG_DIR".to_string(),
                self.shared_root_dir.to_string_lossy().into_owned(),
            ),
            (
                "SDKWORK_ADMIN_JWT_SIGNING_SECRET".to_string(),
                self.managed_secrets.admin_jwt_signing_secret.clone(),
            ),
            (
                "SDKWORK_PORTAL_JWT_SIGNING_SECRET".to_string(),
                self.managed_secrets.portal_jwt_signing_secret.clone(),
            ),
            (
                "SDKWORK_CREDENTIAL_MASTER_KEY".to_string(),
                self.managed_secrets.credential_master_key.clone(),
            ),
            (
                "SDKWORK_CREDENTIAL_LEGACY_MASTER_KEYS".to_string(),
                DEFAULT_LEGACY_CREDENTIAL_MASTER_KEY.to_string(),
            ),
        ]);
        env.extend(self.bind_env_overrides.clone());
        env
    }
}

impl ApiRouterManagedRuntimeService {
    pub fn new() -> Self {
        Self
    }

    pub fn ensure_bundled_runtime<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        paths: &AppPaths,
    ) -> Result<ActivatedApiRouterRuntime> {
        let resource_dir = app.path().resource_dir().map_err(FrameworkError::from)?;
        let resource_root = resolve_bundled_resource_root(&resource_dir)?;
        self.ensure_bundled_runtime_from_root(paths, &resource_root)
    }

    pub fn ensure_bundled_runtime_from_root(
        &self,
        paths: &AppPaths,
        resource_root: &Path,
    ) -> Result<ActivatedApiRouterRuntime> {
        self.ensure_bundled_runtime_from_root_with_env(
            paths,
            resource_root,
            &std::env::vars().collect::<HashMap<_, _>>(),
        )
    }

    pub(crate) fn ensure_bundled_runtime_from_root_with_env(
        &self,
        paths: &AppPaths,
        resource_root: &Path,
        env: &HashMap<String, String>,
    ) -> Result<ActivatedApiRouterRuntime> {
        let manifest = load_manifest(&resource_root.join("manifest.json"))?;
        validate_manifest_target(&manifest)?;

        if manifest.runtime_id != API_ROUTER_RUNTIME_ID {
            return Err(FrameworkError::ValidationFailed(format!(
                "unsupported bundled runtime id {}",
                manifest.runtime_id
            )));
        }

        let bundled_runtime_dir = resource_root.join("runtime");
        if !bundled_runtime_dir.exists() {
            return Err(FrameworkError::NotFound(format!(
                "bundled sdkwork-api-router runtime resources not found under {}",
                bundled_runtime_dir.display()
            )));
        }

        let install_key = manifest.install_key();
        let install_dir = paths
            .managed_runtimes_dir
            .join("sdkwork-api-router")
            .join(&install_key);
        let runtime_dir = install_dir.join("runtime");
        let manifest_path = install_dir.join("manifest.json");
        let shared_root_dir = shared_router_root(paths);
        let router_config = load_router_config_with_env(&shared_root_dir, env)?;
        let managed_secrets = load_or_create_managed_secret_bundle(&shared_root_dir)?;
        ensure_managed_router_config(&shared_root_dir, &router_config)?;

        ensure_runtime_installation(
            &bundled_runtime_dir,
            &resource_root.join("manifest.json"),
            &manifest,
            &install_dir,
            &runtime_dir,
            &manifest_path,
        )?;

        let gateway_path = install_dir.join(&manifest.gateway_relative_path);
        let admin_path = install_dir.join(&manifest.admin_relative_path);
        let portal_path = install_dir.join(&manifest.portal_relative_path);
        let admin_site_index_path = runtime_site_index_path(&install_dir, "admin");
        let portal_site_index_path = runtime_site_index_path(&install_dir, "portal");
        if !gateway_path.exists()
            || !admin_path.exists()
            || !portal_path.exists()
            || !admin_site_index_path.exists()
            || !portal_site_index_path.exists()
        {
            return Err(FrameworkError::NotFound(format!(
                "bundled sdkwork-api-router runtime is incomplete under {}",
                install_dir.display()
            )));
        }

        ensure_executable_file(&gateway_path)?;
        ensure_executable_file(&admin_path)?;
        ensure_executable_file(&portal_path)?;

        Ok(ActivatedApiRouterRuntime {
            install_key,
            install_dir: install_dir.clone(),
            shared_root_dir,
            bind_env_overrides: router_config.bind_env_overrides,
            managed_secrets,
            gateway: ManagedApiRouterProcessSpec {
                command_path: gateway_path,
                args: Vec::new(),
                working_dir: Some(install_dir.clone()),
            },
            admin: ManagedApiRouterProcessSpec {
                command_path: admin_path,
                args: Vec::new(),
                working_dir: Some(install_dir.clone()),
            },
            portal: ManagedApiRouterProcessSpec {
                command_path: portal_path,
                args: Vec::new(),
                working_dir: Some(install_dir.clone()),
            },
        })
    }
}

fn resolve_bundled_resource_root(resource_dir: &Path) -> Result<PathBuf> {
    let direct = resource_dir.join(BUNDLED_RESOURCE_DIR);
    if direct.exists() {
        return Ok(direct);
    }

    let nested = resource_dir.join(NESTED_BUNDLED_RESOURCE_DIR);
    if nested.exists() {
        return Ok(nested);
    }

    Err(FrameworkError::NotFound(format!(
        "bundled sdkwork-api-router runtime resources not found under {} or {}",
        direct.display(),
        nested.display()
    )))
}

fn ensure_runtime_installation(
    bundled_runtime_dir: &Path,
    bundled_manifest_path: &Path,
    manifest: &BundledApiRouterManifest,
    install_dir: &Path,
    runtime_dir: &Path,
    manifest_path: &Path,
) -> Result<()> {
    let gateway_path = install_dir.join(&manifest.gateway_relative_path);
    let admin_path = install_dir.join(&manifest.admin_relative_path);
    let portal_path = install_dir.join(&manifest.portal_relative_path);
    let admin_site_index_path = runtime_site_index_path(install_dir, "admin");
    let portal_site_index_path = runtime_site_index_path(install_dir, "portal");
    if install_dir.exists()
        && gateway_path.exists()
        && admin_path.exists()
        && portal_path.exists()
        && admin_site_index_path.exists()
        && portal_site_index_path.exists()
        && manifest_path.exists()
    {
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
            "failed to finalize bundled sdkwork-api-router runtime installation at {}",
            install_dir.display()
        )));
    }

    Ok(())
}

fn runtime_site_index_path(install_dir: &Path, site_label: &str) -> PathBuf {
    install_dir
        .join("runtime")
        .join("sites")
        .join(site_label)
        .join("index.html")
}

fn ensure_managed_router_config(
    shared_root_dir: &Path,
    router_config: &LoadedApiRouterConfig,
) -> Result<()> {
    fs::create_dir_all(shared_root_dir)?;
    fs::create_dir_all(shared_root_dir.join("extensions"))?;

    if ROUTER_CONFIG_FILE_NAMES
        .iter()
        .any(|file_name| shared_root_dir.join(file_name).exists())
    {
        return Ok(());
    }

    let config = serde_json::json!({
        "gateway_bind": router_config.gateway_bind,
        "admin_bind": router_config.admin_bind,
        "portal_bind": router_config.portal_bind,
        "web_bind": router_config.web_bind,
        "database_url": "sqlite://sdkwork-api-server.db",
        "secret_local_file": "secrets.json",
        "extension_paths": ["extensions"],
        "enable_connector_extensions": true,
        "enable_native_dynamic_extensions": false,
        "enable_admin": router_config.enable_admin,
        "enable_portal": router_config.enable_portal,
    });
    let config_path = shared_root_dir.join("config.json");
    fs::write(
        &config_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&config).map_err(FrameworkError::from)?
        ),
    )?;
    Ok(())
}

fn load_manifest(path: &Path) -> Result<BundledApiRouterManifest> {
    let content = fs::read_to_string(path)?;
    serde_json::from_str::<BundledApiRouterManifest>(&content).map_err(Into::into)
}

fn validate_manifest_target(manifest: &BundledApiRouterManifest) -> Result<()> {
    let expected_platform = normalized_target_platform();
    let expected_arch = normalized_target_arch();

    if manifest.platform != expected_platform || manifest.arch != expected_arch {
        return Err(FrameworkError::ValidationFailed(format!(
            "bundled sdkwork-api-router runtime target mismatch: expected {expected_platform}-{expected_arch}, received {}-{}",
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

fn load_or_create_managed_secret_bundle(
    shared_root_dir: &Path,
) -> Result<ManagedApiRouterSecretBundle> {
    fs::create_dir_all(shared_root_dir)?;
    let path = shared_root_dir.join(MANAGED_SECRET_FILE_NAME);
    if path.exists() {
        let content = fs::read_to_string(&path)?;
        return serde_json::from_str::<ManagedApiRouterSecretBundle>(&content).map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "failed to parse managed api router secret bundle {}: {error}",
                path.display()
            ))
        });
    }

    let bundle = ManagedApiRouterSecretBundle {
        schema_version: MANAGED_SECRET_SCHEMA_VERSION,
        admin_jwt_signing_secret: generate_secret_value(),
        portal_jwt_signing_secret: generate_secret_value(),
        credential_master_key: generate_secret_value(),
    };

    fs::write(
        &path,
        serde_json::to_string_pretty(&bundle).map_err(FrameworkError::from)?,
    )?;
    ensure_private_file(&path)?;
    Ok(bundle)
}

fn generate_secret_value() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}

#[cfg(unix)]
fn ensure_executable_file(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(unix)]
fn ensure_private_file(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o600);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn ensure_executable_file(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(not(unix))]
fn ensure_private_file(_path: &Path) -> Result<()> {
    Ok(())
}

fn unix_timestamp_ms() -> Result<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?
        .as_millis())
}

#[cfg(test)]
mod tests {
    use super::{
        normalized_target_arch, normalized_target_platform, resolve_bundled_resource_root,
        ApiRouterManagedRuntimeService, BundledApiRouterManifest, API_ROUTER_RUNTIME_ID,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use std::fs;

    #[test]
    fn installs_bundled_runtime_into_managed_directory_and_resolves_process_specs() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        let expected_install_key = format!(
            "2026.3.20-{}-{}",
            normalized_target_platform(),
            normalized_target_arch()
        );

        assert_eq!(activated.install_key, expected_install_key);
        assert!(activated.install_dir.exists());
        assert!(activated.gateway.command_path.exists());
        assert!(activated.admin.command_path.exists());
        assert!(activated.portal.command_path.exists());
        assert!(activated
            .install_dir
            .join("runtime")
            .join("sites")
            .join("admin")
            .join("index.html")
            .exists());
        assert!(activated
            .install_dir
            .join("runtime")
            .join("sites")
            .join("portal")
            .join("index.html")
            .exists());
        assert_eq!(
            activated.shared_root_dir,
            paths
                .user_root
                .parent()
                .expect("shared namespace root")
                .join("router")
        );
        assert!(paths
            .managed_runtimes_dir
            .join("sdkwork-api-router")
            .join(&expected_install_key)
            .join("manifest.json")
            .exists());
    }

    #[test]
    fn writes_host_managed_router_config_with_12100_plus_ports_when_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        let config_path = activated.shared_root_dir.join("config.json");
        let config = fs::read_to_string(&config_path).expect("managed config");

        assert!(config.contains("\"gateway_bind\": \"127.0.0.1:12100\""));
        assert!(config.contains("\"admin_bind\": \"127.0.0.1:12101\""));
        assert!(config.contains("\"portal_bind\": \"127.0.0.1:12102\""));
    }

    #[test]
    fn writes_host_managed_router_config_with_public_web_bind_and_enabled_sites_by_default() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        let config_path = activated.shared_root_dir.join("config.json");
        let config = fs::read_to_string(&config_path).expect("managed config");

        assert!(config.contains("\"web_bind\": \"127.0.0.1:12103\""));
        assert!(config.contains("\"enable_admin\": true"));
        assert!(config.contains("\"enable_portal\": true"));
    }

    #[test]
    fn preserves_existing_router_config_when_shared_root_is_already_configured() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();
        let shared_root_dir = paths
            .user_root
            .parent()
            .expect("shared namespace root")
            .join("router");
        let existing_config_path = shared_root_dir.join("config.yaml");

        fs::create_dir_all(&shared_root_dir).expect("shared root dir");
        fs::write(
            &existing_config_path,
            "gateway_bind: \"127.0.0.1:23100\"\nadmin_bind: \"127.0.0.1:23101\"\nportal_bind: \"127.0.0.1:23102\"\n",
        )
        .expect("existing config");

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        assert_eq!(
            fs::read_to_string(&existing_config_path).expect("existing config"),
            "gateway_bind: \"127.0.0.1:23100\"\nadmin_bind: \"127.0.0.1:23101\"\nportal_bind: \"127.0.0.1:23102\"\n"
        );
        assert!(!activated.shared_root_dir.join("config.json").exists());
    }

    #[test]
    fn rejects_bundled_runtime_for_a_different_target() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture_for_target(temp.path(), "2026.3.20", "windows", "x64");
        let service = ApiRouterManagedRuntimeService::new();

        if normalized_target_platform() == "windows" && normalized_target_arch() == "x64" {
            return;
        }

        let error = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect_err("target mismatch should fail");

        assert!(error.to_string().contains("target mismatch"));
    }

    #[test]
    fn resolves_bundled_runtime_from_nested_resources_directory() {
        let temp = tempfile::tempdir().expect("temp dir");
        let resource_dir = temp.path().join("target").join("debug");
        let nested_resource_root = resource_dir
            .join("resources")
            .join("sdkwork-api-router-runtime");
        fs::create_dir_all(&nested_resource_root).expect("nested resource root");

        let resolved =
            resolve_bundled_resource_root(&resource_dir).expect("resolved resource root");

        assert_eq!(resolved, nested_resource_root);
    }

    #[test]
    fn persists_managed_runtime_secret_bundle_and_reuses_it_across_activations() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();

        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");
        let managed_env = first.managed_env();

        assert_eq!(
            managed_env.get("SDKWORK_CONFIG_DIR"),
            Some(&first.shared_root_dir.to_string_lossy().into_owned())
        );
        assert!(managed_env
            .get("SDKWORK_ADMIN_JWT_SIGNING_SECRET")
            .is_some_and(|value| !value.trim().is_empty()));
        assert!(managed_env
            .get("SDKWORK_PORTAL_JWT_SIGNING_SECRET")
            .is_some_and(|value| !value.trim().is_empty()));
        assert!(managed_env
            .get("SDKWORK_CREDENTIAL_MASTER_KEY")
            .is_some_and(|value| !value.trim().is_empty()));
        assert_eq!(
            managed_env.get("SDKWORK_CREDENTIAL_LEGACY_MASTER_KEYS"),
            Some(&"local-dev-master-key".to_string())
        );
        assert_eq!(
            managed_env.get("SDKWORK_ADMIN_JWT_SIGNING_SECRET"),
            second.managed_env().get("SDKWORK_ADMIN_JWT_SIGNING_SECRET")
        );
        assert_eq!(
            managed_env.get("SDKWORK_PORTAL_JWT_SIGNING_SECRET"),
            second
                .managed_env()
                .get("SDKWORK_PORTAL_JWT_SIGNING_SECRET")
        );
        assert_eq!(
            managed_env.get("SDKWORK_CREDENTIAL_MASTER_KEY"),
            second.managed_env().get("SDKWORK_CREDENTIAL_MASTER_KEY")
        );
        assert!(first
            .shared_root_dir
            .join("claw-managed-secrets.json")
            .exists());
    }

    #[test]
    fn reinstalls_bundled_runtime_when_existing_install_is_missing_site_bundle() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let missing_admin_site_dir = activated
            .install_dir
            .join("runtime")
            .join("sites")
            .join("admin");
        fs::remove_dir_all(&missing_admin_site_dir).expect("remove admin site");

        let reactivated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("reactivated runtime");

        assert!(reactivated
            .install_dir
            .join("runtime")
            .join("sites")
            .join("admin")
            .join("index.html")
            .exists());
        assert!(reactivated
            .install_dir
            .join("runtime")
            .join("sites")
            .join("portal")
            .join("index.html")
            .exists());
    }

    #[test]
    fn writes_host_managed_router_config_from_host_base_port_override() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();
        let env = std::collections::HashMap::from([(
            "SDKWORK_API_ROUTER_BASE_PORT".to_string(),
            "14100".to_string(),
        )]);

        let activated = service
            .ensure_bundled_runtime_from_root_with_env(&paths, &resource_root, &env)
            .expect("activated runtime");
        let config_path = activated.shared_root_dir.join("config.json");
        let config = fs::read_to_string(&config_path).expect("managed config");

        assert!(config.contains("\"gateway_bind\": \"127.0.0.1:14100\""));
        assert!(config.contains("\"admin_bind\": \"127.0.0.1:14101\""));
        assert!(config.contains("\"portal_bind\": \"127.0.0.1:14102\""));
        assert!(config.contains("\"web_bind\": \"127.0.0.1:14103\""));
    }

    #[test]
    fn managed_runtime_writes_web_bind_and_site_enable_flags_from_host_env() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();
        let env = std::collections::HashMap::from([
            (
                "SDKWORK_API_ROUTER_WEB_BIND".to_string(),
                "127.0.0.1:15103".to_string(),
            ),
            (
                "SDKWORK_API_ROUTER_ENABLE_ADMIN".to_string(),
                "false".to_string(),
            ),
            (
                "SDKWORK_API_ROUTER_ENABLE_PORTAL".to_string(),
                "true".to_string(),
            ),
        ]);

        let activated = service
            .ensure_bundled_runtime_from_root_with_env(&paths, &resource_root, &env)
            .expect("activated runtime");
        let config_path = activated.shared_root_dir.join("config.json");
        let config = fs::read_to_string(&config_path).expect("managed config");

        assert!(config.contains("\"web_bind\": \"127.0.0.1:15103\""));
        assert!(config.contains("\"enable_admin\": false"));
        assert!(config.contains("\"enable_portal\": true"));
    }

    #[test]
    fn managed_runtime_maps_host_bind_overrides_into_router_process_env() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root = create_bundled_runtime_fixture(temp.path(), "2026.3.20");
        let service = ApiRouterManagedRuntimeService::new();
        let env = std::collections::HashMap::from([
            (
                "SDKWORK_API_ROUTER_GATEWAY_BIND".to_string(),
                "127.0.0.1:15100".to_string(),
            ),
            (
                "SDKWORK_API_ROUTER_ADMIN_BIND".to_string(),
                "127.0.0.1:15101".to_string(),
            ),
            (
                "SDKWORK_API_ROUTER_PORTAL_BIND".to_string(),
                "127.0.0.1:15102".to_string(),
            ),
        ]);

        let activated = service
            .ensure_bundled_runtime_from_root_with_env(&paths, &resource_root, &env)
            .expect("activated runtime");
        let managed_env = activated.managed_env();

        assert_eq!(
            managed_env.get("SDKWORK_GATEWAY_BIND"),
            Some(&"127.0.0.1:15100".to_string())
        );
        assert_eq!(
            managed_env.get("SDKWORK_ADMIN_BIND"),
            Some(&"127.0.0.1:15101".to_string())
        );
        assert_eq!(
            managed_env.get("SDKWORK_PORTAL_BIND"),
            Some(&"127.0.0.1:15102".to_string())
        );
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
        let resource_root = root.join(format!("bundled-api-router-{platform}-{arch}"));
        let runtime_root = resource_root.join("runtime");
        let gateway_relative_path = if platform == "windows" {
            "runtime/gateway-service.exe"
        } else {
            "runtime/gateway-service"
        };
        let admin_relative_path = if platform == "windows" {
            "runtime/admin-api-service.exe"
        } else {
            "runtime/admin-api-service"
        };
        let portal_relative_path = if platform == "windows" {
            "runtime/portal-api-service.exe"
        } else {
            "runtime/portal-api-service"
        };
        let gateway_path = resource_root.join(gateway_relative_path);
        let admin_path = resource_root.join(admin_relative_path);
        let portal_path = resource_root.join(portal_relative_path);

        fs::create_dir_all(gateway_path.parent().expect("gateway parent")).expect("gateway dir");
        fs::create_dir_all(admin_path.parent().expect("admin parent")).expect("admin dir");
        fs::create_dir_all(portal_path.parent().expect("portal parent")).expect("portal dir");
        fs::create_dir_all(runtime_root.join("sites").join("admin")).expect("admin site dir");
        fs::create_dir_all(runtime_root.join("sites").join("portal")).expect("portal site dir");
        fs::write(&gateway_path, "gateway").expect("gateway file");
        fs::write(&admin_path, "admin").expect("admin file");
        fs::write(&portal_path, "portal").expect("portal file");
        fs::write(
            runtime_root.join("sites").join("admin").join("index.html"),
            "<!doctype html><title>admin</title>",
        )
        .expect("admin site");
        fs::write(
            runtime_root.join("sites").join("portal").join("index.html"),
            "<!doctype html><title>portal</title>",
        )
        .expect("portal site");
        assert!(runtime_root.exists());

        let manifest = BundledApiRouterManifest {
            schema_version: 1,
            runtime_id: API_ROUTER_RUNTIME_ID.to_string(),
            router_version: version.to_string(),
            platform: platform.to_string(),
            arch: arch.to_string(),
            gateway_relative_path: gateway_relative_path.to_string(),
            admin_relative_path: admin_relative_path.to_string(),
            portal_relative_path: portal_relative_path.to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");

        resource_root
    }
}
