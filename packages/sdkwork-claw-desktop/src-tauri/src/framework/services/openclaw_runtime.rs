use crate::{
    framework::{layout::set_active_runtime_version, paths::AppPaths, FrameworkError, Result},
    platform,
};
use sdkwork_claw_host_core::port_allocator::{
    allocate_tcp_listener, PortAllocationRequest, PortRange,
};
use serde_json::{Map, Number, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

pub const OPENCLAW_RUNTIME_ID: &str = "openclaw";
const BUNDLED_RESOURCE_DIR: &str = "openclaw";
const NESTED_BUNDLED_RESOURCE_DIR: &str = "resources/openclaw";
const BUNDLED_RUNTIME_ARCHIVE_FILE_NAME: &str = "runtime.zip";
const PREPARED_RUNTIME_SIDECAR_MANIFEST_FILE_NAME: &str = ".sdkwork-openclaw-runtime.json";
const DEFAULT_GATEWAY_PORT: u16 = 18_789;
const TAURI_CONTROL_UI_ALLOWED_ORIGINS: [&str; 3] = [
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
];
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

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedOpenClawRuntimeSidecarManifest {
    #[serde(flatten)]
    manifest: BundledOpenClawManifest,
    #[serde(default)]
    runtime_integrity: Option<PreparedOpenClawRuntimeIntegrityManifest>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedOpenClawRuntimeIntegrityManifest {
    schema_version: u32,
    files: Vec<PreparedOpenClawRuntimeIntegrityFile>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedOpenClawRuntimeIntegrityFile {
    relative_path: String,
    size: u64,
    sha256: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuntimeSidecarValidation {
    Missing,
    Match,
    Mismatch,
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
        let bundled_manifest_path = resource_root.join("manifest.json");
        let manifest = load_manifest(&bundled_manifest_path)?;
        validate_manifest_target(&manifest)?;

        if manifest.runtime_id != OPENCLAW_RUNTIME_ID {
            return Err(FrameworkError::ValidationFailed(format!(
                "unsupported bundled runtime id {}",
                manifest.runtime_id
            )));
        }

        let bundled_runtime_dir = resource_root.join("runtime");
        let bundled_runtime_archive_path = resource_root.join(BUNDLED_RUNTIME_ARCHIVE_FILE_NAME);
        if !bundled_runtime_dir.exists() && !bundled_runtime_archive_path.exists() {
            return Err(FrameworkError::NotFound(format!(
                "bundled runtime payload not found under {} (expected {} or {})",
                resource_root.display(),
                bundled_runtime_dir.display(),
                bundled_runtime_archive_path.display()
            )));
        }

        let install_key = manifest.install_key();
        let install_dir = paths.openclaw_runtime_dir.join(&install_key);
        let expected_runtime_dir = install_dir.join("runtime");

        if bundled_runtime_dir.exists() {
            ensure_runtime_installation_from_directory(
                &bundled_runtime_dir,
                &bundled_manifest_path,
                &manifest,
                &install_dir,
                &expected_runtime_dir,
            )?;
        } else {
            ensure_runtime_installation_from_archive(
                &bundled_runtime_archive_path,
                &bundled_manifest_path,
                &manifest,
                &install_dir,
                &expected_runtime_dir,
            )?;
        }

        let install_dir = resolve_launch_runtime_install_dir(&install_dir, &manifest)?
            .ok_or_else(|| {
                FrameworkError::NotFound(format!(
                    "bundled openclaw runtime is incomplete under {}",
                    install_dir.display()
                ))
            })?;
        let runtime_dir = install_dir.join("runtime");
        let node_path = install_dir.join(&manifest.node_relative_path);
        let cli_path = install_dir.join(&manifest.cli_relative_path);
        if !node_path.exists() || !cli_path.exists() {
            return Err(FrameworkError::NotFound(format!(
                "bundled openclaw runtime is incomplete under {}",
                install_dir.display()
            )));
        }

        let managed_state =
            ensure_managed_openclaw_state(paths, Some(manifest.openclaw_version.as_str()))?;
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

        let managed_state = ensure_managed_openclaw_state(paths, None)?;

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

fn ensure_runtime_installation_from_directory(
    bundled_runtime_dir: &Path,
    bundled_manifest_path: &Path,
    manifest: &BundledOpenClawManifest,
    install_dir: &Path,
    runtime_dir: &Path,
) -> Result<()> {
    if resolve_launch_runtime_install_dir(install_dir, manifest)?.is_some() {
        return Ok(());
    }

    let staging_dir = staged_runtime_install_dir(install_dir, unix_timestamp_ms()?);
    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)?;
    }

    fs::create_dir_all(&staging_dir)?;
    copy_directory_recursive(bundled_runtime_dir, &staging_dir.join("runtime"))?;
    fs::copy(bundled_manifest_path, staging_dir.join("manifest.json"))?;
    validate_materialized_runtime_installation(
        &staging_dir,
        manifest,
        "bundled runtime directory payload",
    )?;

    if let Some(parent) = install_dir.parent() {
        fs::create_dir_all(parent)?;
    }

    if install_dir.exists() {
        fs::remove_dir_all(install_dir).map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to replace existing bundled runtime install root {}: {error}",
                install_dir.display()
            ))
        })?;
    }

    fs::rename(&staging_dir, install_dir).map_err(|error| {
        FrameworkError::Internal(format!(
            "failed to finalize bundled runtime install root {} from {}: {error}",
            install_dir.display(),
            staging_dir.display()
        ))
    })?;

    if !runtime_dir.exists() {
        return Err(FrameworkError::Internal(format!(
            "failed to finalize bundled runtime installation at {}",
            install_dir.display()
        )));
    }

    Ok(())
}

fn ensure_runtime_installation_from_archive(
    bundled_runtime_archive_path: &Path,
    bundled_manifest_path: &Path,
    manifest: &BundledOpenClawManifest,
    install_dir: &Path,
    runtime_dir: &Path,
) -> Result<()> {
    if resolve_launch_runtime_install_dir(install_dir, manifest)?.is_some() {
        return Ok(());
    }

    let staging_dir = staged_runtime_install_dir(install_dir, unix_timestamp_ms()?);
    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)?;
    }

    fs::create_dir_all(&staging_dir)?;
    extract_bundled_runtime_archive(bundled_runtime_archive_path, &staging_dir)?;
    if !staging_dir.join("runtime").exists() {
        return Err(FrameworkError::ValidationFailed(format!(
            "bundled runtime archive did not materialize a runtime directory under {}",
            staging_dir.display()
        )));
    }
    fs::copy(bundled_manifest_path, staging_dir.join("manifest.json"))?;
    validate_materialized_runtime_installation(
        &staging_dir,
        manifest,
        "bundled runtime archive payload",
    )?;

    if let Some(parent) = install_dir.parent() {
        fs::create_dir_all(parent)?;
    }

    if install_dir.exists() {
        fs::remove_dir_all(install_dir).map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to replace existing bundled runtime install root {}: {error}",
                install_dir.display()
            ))
        })?;
    }

    fs::rename(&staging_dir, install_dir).map_err(|error| {
        FrameworkError::Internal(format!(
            "failed to finalize bundled runtime install root {} from {}: {error}",
            install_dir.display(),
            staging_dir.display()
        ))
    })?;

    if !runtime_dir.exists() {
        return Err(FrameworkError::Internal(format!(
            "failed to finalize bundled runtime installation at {}",
            install_dir.display()
        )));
    }

    Ok(())
}

fn runtime_install_root_is_complete(
    install_dir: &Path,
    manifest: &BundledOpenClawManifest,
) -> bool {
    let manifest_path = install_dir.join("manifest.json");
    let runtime_dir = install_dir.join("runtime");
    let node_path = install_dir.join(&manifest.node_relative_path);
    let cli_path = install_dir.join(&manifest.cli_relative_path);
    install_dir.exists()
        && manifest_path.exists()
        && node_path.exists()
        && cli_path.exists()
        && manifest_file_matches(&manifest_path, manifest)
        && matches!(
            runtime_sidecar_manifest_validation(&runtime_dir, manifest),
            RuntimeSidecarValidation::Match
        )
}

fn staged_runtime_install_dir(install_dir: &Path, timestamp_ms: u128) -> PathBuf {
    let parent = install_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let install_name = install_dir
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| OPENCLAW_RUNTIME_ID.to_string());
    parent.join(format!("{install_name}.staging-{timestamp_ms}"))
}

fn matching_staged_runtime_install_dirs(
    install_dir: &Path,
    manifest: &BundledOpenClawManifest,
) -> Result<Vec<PathBuf>> {
    let Some(parent) = install_dir.parent() else {
        return Ok(Vec::new());
    };
    if !parent.exists() {
        return Ok(Vec::new());
    }

    let prefix = format!("{}.staging-", manifest.install_key());
    let mut candidates = fs::read_dir(parent)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_dir()))
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .map(|value| value.to_string_lossy().starts_with(&prefix))
                .unwrap_or(false)
        })
        .filter(|path| runtime_install_root_is_complete(path, manifest))
        .collect::<Vec<_>>();
    candidates.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
    });
    candidates.reverse();
    Ok(candidates)
}

fn resolve_launch_runtime_install_dir(
    install_dir: &Path,
    manifest: &BundledOpenClawManifest,
) -> Result<Option<PathBuf>> {
    if runtime_install_root_is_complete(install_dir, manifest) {
        return Ok(Some(install_dir.to_path_buf()));
    }

    let mut staged_candidates = matching_staged_runtime_install_dirs(install_dir, manifest)?;
    let Some(candidate) = staged_candidates.drain(..).next() else {
        return Ok(None);
    };

    if install_dir.exists() {
        return Err(FrameworkError::Internal(format!(
            "failed to finalize bundled runtime install root {} because a blocking path still exists; staged runtime candidate remains at {}",
            install_dir.display(),
            candidate.display()
        )));
    }

    fs::rename(&candidate, install_dir).map_err(|error| {
        FrameworkError::Internal(format!(
            "failed to finalize bundled runtime install root {} from staged candidate {}: {error}",
            install_dir.display(),
            candidate.display()
        ))
    })?;

    if runtime_install_root_is_complete(install_dir, manifest) {
        return Ok(Some(install_dir.to_path_buf()));
    }

    Err(FrameworkError::Internal(format!(
        "bundled runtime staged candidate {} did not materialize a complete install root at {}",
        candidate.display(),
        install_dir.display()
    )))
}

fn validate_materialized_runtime_installation(
    install_root: &Path,
    manifest: &BundledOpenClawManifest,
    context_label: &str,
) -> Result<()> {
    let runtime_dir = install_root.join("runtime");
    let manifest_path = install_root.join("manifest.json");
    let node_path = install_root.join(&manifest.node_relative_path);
    let cli_path = install_root.join(&manifest.cli_relative_path);

    if !runtime_dir.exists() {
        return Err(FrameworkError::ValidationFailed(format!(
            "{context_label} did not materialize a runtime directory under {}",
            install_root.display()
        )));
    }

    if !manifest_path.exists() || !manifest_file_matches(&manifest_path, manifest) {
        return Err(FrameworkError::ValidationFailed(format!(
            "{context_label} did not materialize a matching bundled manifest under {}",
            install_root.display()
        )));
    }

    if !node_path.exists() || !cli_path.exists() {
        return Err(FrameworkError::ValidationFailed(format!(
            "{context_label} is missing the bundled Node or CLI entrypoint under {}",
            install_root.display()
        )));
    }

    match runtime_sidecar_manifest_validation(&runtime_dir, manifest) {
        RuntimeSidecarValidation::Match => Ok(()),
        RuntimeSidecarValidation::Missing => Err(FrameworkError::ValidationFailed(format!(
            "{context_label} is missing the runtime sidecar under {}",
            runtime_dir.display()
        ))),
        RuntimeSidecarValidation::Mismatch => Err(FrameworkError::ValidationFailed(format!(
            "{context_label} runtime sidecar failed integrity validation under {}",
            runtime_dir.display()
        ))),
    }
}

fn manifest_file_matches(path: &Path, expected: &BundledOpenClawManifest) -> bool {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<BundledOpenClawManifest>(&content).ok())
        .is_some_and(|manifest| manifest == *expected)
}

fn resolve_runtime_sidecar_manifest_path(runtime_dir: impl AsRef<Path>) -> PathBuf {
    runtime_dir
        .as_ref()
        .join(PREPARED_RUNTIME_SIDECAR_MANIFEST_FILE_NAME)
}

fn runtime_sidecar_manifest_validation(
    runtime_dir: impl AsRef<Path>,
    expected: &BundledOpenClawManifest,
) -> RuntimeSidecarValidation {
    let runtime_dir = runtime_dir.as_ref();
    let sidecar_path = resolve_runtime_sidecar_manifest_path(runtime_dir);
    if !sidecar_path.exists() {
        return RuntimeSidecarValidation::Missing;
    }

    fs::read_to_string(sidecar_path)
        .ok()
        .and_then(|content| {
            serde_json::from_str::<PreparedOpenClawRuntimeSidecarManifest>(&content).ok()
        })
        .map_or(RuntimeSidecarValidation::Mismatch, |sidecar_manifest| {
            if sidecar_manifest.manifest == *expected
                && runtime_integrity_manifest_matches(
                    runtime_dir,
                    sidecar_manifest.runtime_integrity.as_ref(),
                )
            {
                RuntimeSidecarValidation::Match
            } else {
                RuntimeSidecarValidation::Mismatch
            }
        })
}

fn runtime_integrity_manifest_matches(
    runtime_dir: &Path,
    runtime_integrity: Option<&PreparedOpenClawRuntimeIntegrityManifest>,
) -> bool {
    let Some(runtime_integrity) = runtime_integrity else {
        return false;
    };

    if runtime_integrity.schema_version != 1 || runtime_integrity.files.is_empty() {
        return false;
    }

    runtime_integrity
        .files
        .iter()
        .all(|entry| runtime_integrity_file_matches(runtime_dir, entry))
}

fn runtime_integrity_file_matches(
    runtime_dir: &Path,
    entry: &PreparedOpenClawRuntimeIntegrityFile,
) -> bool {
    let relative_path = PathBuf::from(&entry.relative_path);
    if relative_path.as_os_str().is_empty() || relative_path.is_absolute() {
        return false;
    }
    if relative_path.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::Prefix(_)
                | std::path::Component::RootDir
        )
    }) {
        return false;
    }

    let absolute_path = runtime_dir.join(&relative_path);
    let metadata = match fs::metadata(&absolute_path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    if !metadata.is_file() || metadata.len() != entry.size {
        return false;
    }

    sha256_file_hex(&absolute_path).is_ok_and(|digest| digest.eq_ignore_ascii_case(&entry.sha256))
}

fn sha256_file_hex(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let digest = hasher.finalize();
    Ok(digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>())
}

fn extract_bundled_runtime_archive(archive_path: &Path, destination_dir: &Path) -> Result<()> {
    let extract_result = if cfg!(windows) {
        extract_windows_bundled_runtime_archive(archive_path, destination_dir)
    } else {
        extract_unix_bundled_runtime_archive(archive_path, destination_dir)
    };

    extract_result
}

fn escape_powershell_literal(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

fn extract_windows_bundled_runtime_archive(
    archive_path: &Path,
    destination_dir: &Path,
) -> Result<()> {
    let command = format!(
        "$ErrorActionPreference = 'Stop'; Expand-Archive -Force -LiteralPath '{}' -DestinationPath '{}'",
        escape_powershell_literal(archive_path),
        escape_powershell_literal(destination_dir)
    );
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &command])
        .output()?;

    if !output.status.success() {
        return Err(FrameworkError::ProcessFailed {
            command: "powershell Expand-Archive".to_string(),
            exit_code: output.status.code(),
            stderr_tail: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    Ok(())
}

fn extract_unix_bundled_runtime_archive(archive_path: &Path, destination_dir: &Path) -> Result<()> {
    let output = Command::new("unzip")
        .args([
            "-qq",
            archive_path.to_string_lossy().as_ref(),
            "-d",
            destination_dir.to_string_lossy().as_ref(),
        ])
        .output()?;

    if !output.status.success() {
        return Err(FrameworkError::ProcessFailed {
            command: "unzip -qq".to_string(),
            exit_code: output.status.code(),
            stderr_tail: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    Ok(())
}

fn ensure_managed_openclaw_state(
    paths: &AppPaths,
    bundled_openclaw_version: Option<&str>,
) -> Result<ManagedOpenClawState> {
    fs::create_dir_all(&paths.openclaw_home_dir)?;
    fs::create_dir_all(&paths.openclaw_state_dir)?;
    fs::create_dir_all(&paths.openclaw_workspace_dir)?;

    let mut config = read_managed_config(&paths.openclaw_config_file)?;
    sanitize_legacy_provider_runtime_config(&mut config);
    set_nested_string(&mut config, &["gateway", "mode"], "local");
    set_nested_string(&mut config, &["gateway", "bind"], "loopback");
    let configured_port = get_nested_u16(&config, &["gateway", "port"]).filter(|port| *port > 0);
    let gateway_port = allocate_gateway_port(configured_port.unwrap_or(DEFAULT_GATEWAY_PORT))?;
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
    ensure_managed_control_ui_allowed_origins(&mut config);
    ensure_nested_string_array_contains(&mut config, &["gateway", "tools", "allow"], "cron");
    set_nested_string(
        &mut config,
        &["agents", "defaults", "workspace"],
        &paths.openclaw_workspace_dir.to_string_lossy(),
    );
    if let Some(version) = bundled_openclaw_version {
        set_nested_string(&mut config, &["meta", "lastTouchedVersion"], version);
        set_nested_string(
            &mut config,
            &["meta", "lastTouchedAt"],
            &current_rfc3339_timestamp()?,
        );
    }

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

fn ensure_managed_control_ui_allowed_origins(config: &mut Value) {
    for origin in TAURI_CONTROL_UI_ALLOWED_ORIGINS {
        ensure_nested_string_array_contains(
            config,
            &["gateway", "controlUi", "allowedOrigins"],
            origin,
        );
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

fn current_rfc3339_timestamp() -> Result<String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to format managed openclaw metadata timestamp: {error}"
            ))
        })
}

fn unix_timestamp_ms() -> Result<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?
        .as_millis())
}

fn allocate_gateway_port(requested_port: u16) -> Result<u16> {
    let allocation = allocate_tcp_listener(PortAllocationRequest {
        bind_host: "127.0.0.1".to_string(),
        requested_port,
        fallback_range: Some(PortRange::new(
            requested_port,
            requested_port.saturating_add(31),
        )),
        allow_ephemeral_fallback: true,
    })
    .map_err(FrameworkError::Conflict)?;

    let active_port = allocation.active_port;
    drop(allocation.into_listener());
    Ok(active_port)
}

#[cfg(test)]
mod tests {
    use super::{
        copy_directory_recursive, load_manifest, normalized_target_arch,
        normalized_target_platform, resolve_bundled_resource_root,
        resolve_bundled_resource_root_with_manifest_dir, resolve_runtime_sidecar_manifest_path,
        sha256_file_hex, staged_runtime_install_dir, BundledOpenClawManifest,
        OpenClawRuntimeService, PreparedOpenClawRuntimeIntegrityFile,
        PreparedOpenClawRuntimeIntegrityManifest, PreparedOpenClawRuntimeSidecarManifest,
        BUNDLED_RUNTIME_ARCHIVE_FILE_NAME, DEFAULT_GATEWAY_PORT, OPENCLAW_RUNTIME_ID,
        PREPARED_RUNTIME_SIDECAR_MANIFEST_FILE_NAME, TAURI_CONTROL_UI_ALLOWED_ORIGINS,
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
                .pointer("/gateway/controlUi/allowedOrigins")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>()),
            Some(TAURI_CONTROL_UI_ALLOWED_ORIGINS.to_vec())
        );
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
        assert_eq!(
            config
                .pointer("/meta/lastTouchedVersion")
                .and_then(Value::as_str),
            Some(TEST_BUNDLED_OPENCLAW_VERSION)
        );
        assert!(config
            .pointer("/meta/lastTouchedAt")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty()));

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
    fn activation_fails_when_a_blocking_non_directory_already_exists_at_the_final_install_root() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let bundled_manifest =
            load_manifest(&resource_root.join("manifest.json")).expect("bundled manifest");
        let install_dir = paths.openclaw_runtime_dir.join(bundled_manifest.install_key());
        fs::create_dir_all(
            install_dir
                .parent()
                .expect("managed runtime install parent directory"),
        )
        .expect("runtime parent");
        fs::write(&install_dir, "blocked").expect("blocking install root marker");
        let service = OpenClawRuntimeService::new();

        let error = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect_err("activation should fail instead of silently falling back to a staging runtime");

        assert!(error
            .to_string()
            .contains("install root"));

        let active = if paths.active_file.exists() {
            serde_json::from_str::<ActiveState>(
                &fs::read_to_string(&paths.active_file).expect("active file"),
            )
            .expect("active json")
        } else {
            ActiveState::default()
        };
        assert_eq!(
            active
                .runtimes
                .get(OPENCLAW_RUNTIME_ID)
                .and_then(|entry| entry.active_version.as_deref()),
            None
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
    fn staged_install_directory_keeps_the_full_install_key_prefix() {
        let install_dir = std::path::PathBuf::from(
            "D:/runtime/openclaw/2026.4.2-windows-x64",
        );

        let staged_dir = staged_runtime_install_dir(&install_dir, 123);

        assert_eq!(
            staged_dir.file_name().and_then(|value| value.to_str()),
            Some("2026.4.2-windows-x64.staging-123")
        );
    }

    #[test]
    fn reuses_matching_staged_install_when_the_final_install_directory_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();
        let bundled_manifest =
            load_manifest(&resource_root.join("manifest.json")).expect("bundled manifest");
        let install_key = bundled_manifest.install_key();
        let install_dir = paths.openclaw_runtime_dir.join(&install_key);
        let staged_dir = staged_runtime_install_dir(&install_dir, 123);
        let runtime_dir = staged_dir.join("runtime");

        copy_directory_recursive(&resource_root.join("runtime"), &runtime_dir)
            .expect("copy runtime into staged dir");
        fs::copy(resource_root.join("manifest.json"), staged_dir.join("manifest.json"))
            .expect("copy manifest into staged dir");
        assert!(resolve_runtime_sidecar_manifest_path(&runtime_dir).exists());

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime from staged install");

        assert_eq!(activated.install_key, install_key);
        assert_eq!(activated.install_dir, install_dir);
        assert!(activated.install_dir.exists());
        assert!(activated.runtime_dir.exists());
        assert!(!staged_dir.exists());
    }

    #[test]
    fn reuses_existing_install_when_matching_runtime_sidecar_is_present() {
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

        let bundled_manifest =
            load_manifest(&resource_root.join("manifest.json")).expect("bundled manifest");
        write_runtime_sidecar_manifest(&first.runtime_dir, &bundled_manifest);

        fs::remove_file(
            resource_root
                .join("runtime")
                .join("package")
                .join("node_modules")
                .join("@aws-sdk")
                .join("client-bedrock")
                .join("package.json"),
        )
        .expect("remove bundled dependency sentinel");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert_eq!(first.install_key, second.install_key);
        assert!(sentinel.exists());
    }

    #[test]
    fn reinstalls_existing_install_when_runtime_sidecar_integrity_mismatch_is_detected() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let sentinel = first.install_dir.join("sentinel.txt");
        fs::write(&sentinel, "stale").expect("sentinel");

        let bundled_manifest =
            load_manifest(&resource_root.join("manifest.json")).expect("bundled manifest");
        write_runtime_sidecar_manifest(&first.runtime_dir, &bundled_manifest);

        fs::write(
            first
                .runtime_dir
                .join("package")
                .join("node_modules")
                .join("openclaw")
                .join("package.json"),
            "{\n  \"name\": \"openclaw\",\n  \"version\": \"tampered\"\n}\n",
        )
        .expect("tamper installed openclaw package json");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert_eq!(first.install_key, second.install_key);
        assert!(!sentinel.exists());
        assert!(second
            .runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("package.json")
            .exists());
        assert!(fs::read_to_string(
            second
                .runtime_dir
                .join("package")
                .join("node_modules")
                .join("openclaw")
                .join("package.json")
        )
        .expect("restored openclaw package json")
        .contains(TEST_BUNDLED_OPENCLAW_VERSION));
    }

    #[test]
    fn reinstalls_existing_install_when_runtime_sidecar_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let bundled_manifest =
            load_manifest(&resource_root.join("manifest.json")).expect("bundled manifest");
        write_runtime_sidecar_manifest(&resource_root.join("runtime"), &bundled_manifest);

        let service = OpenClawRuntimeService::new();
        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let sentinel = first.install_dir.join("sentinel.txt");
        fs::write(&sentinel, "stale").expect("sentinel");

        let installed_sidecar_path = resolve_runtime_sidecar_manifest_path(&first.runtime_dir);
        assert!(installed_sidecar_path.exists());
        fs::remove_file(&installed_sidecar_path).expect("remove installed sidecar");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert_eq!(first.install_key, second.install_key);
        assert!(!sentinel.exists());
        assert!(resolve_runtime_sidecar_manifest_path(&second.runtime_dir).exists());
    }

    #[test]
    fn reinstalls_archived_install_when_runtime_sidecar_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let bundled_manifest =
            load_manifest(&resource_root.join("manifest.json")).expect("bundled manifest");
        write_runtime_sidecar_manifest(&resource_root.join("runtime"), &bundled_manifest);
        create_test_runtime_archive(&resource_root);
        fs::remove_dir_all(resource_root.join("runtime")).expect("remove source runtime dir");

        let service = OpenClawRuntimeService::new();
        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let sentinel = first.install_dir.join("sentinel.txt");
        fs::write(&sentinel, "stale").expect("sentinel");

        let installed_sidecar_path = resolve_runtime_sidecar_manifest_path(&first.runtime_dir);
        assert!(installed_sidecar_path.exists());
        fs::remove_file(&installed_sidecar_path).expect("remove installed sidecar");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert_eq!(first.install_key, second.install_key);
        assert!(!sentinel.exists());
        assert!(resolve_runtime_sidecar_manifest_path(&second.runtime_dir).exists());
    }

    #[test]
    fn reinstalls_existing_install_when_a_root_runtime_dependency_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let sentinel = first.install_dir.join("sentinel.txt");
        fs::write(&sentinel, "stale").expect("sentinel");

        fs::remove_file(
            first
                .install_dir
                .join("runtime")
                .join("package")
                .join("node_modules")
                .join("@buape")
                .join("carbon")
                .join("package.json"),
        )
        .expect("remove root dependency sentinel");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert!(second
            .install_dir
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("@buape")
            .join("carbon")
            .join("package.json")
            .exists());
        assert!(!sentinel.exists());
    }

    #[test]
    fn reinstalls_existing_install_when_a_bundled_plugin_runtime_dependency_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        let first = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("first activation");
        let sentinel = first.install_dir.join("sentinel.txt");
        fs::write(&sentinel, "stale").expect("sentinel");

        fs::remove_file(
            first
                .install_dir
                .join("runtime")
                .join("package")
                .join("node_modules")
                .join("@aws-sdk")
                .join("client-bedrock")
                .join("package.json"),
        )
        .expect("remove bundled plugin dependency sentinel");

        let second = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("second activation");

        assert!(second
            .install_dir
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("@aws-sdk")
            .join("client-bedrock")
            .join("package.json")
            .exists());
        assert!(!sentinel.exists());
    }

    #[test]
    fn installs_bundled_runtime_from_runtime_archive_bridge() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_archived_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activate archived runtime");

        assert!(activated.node_path.exists());
        assert!(activated.cli_path.exists());
        assert!(
            activated.install_dir.join("manifest.json").exists(),
            "archived bundled runtime install should restore manifest.json",
        );
    }

    #[test]
    fn rejects_directory_bundled_runtime_when_runtime_sidecar_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        fs::remove_file(resource_root.join("runtime").join(PREPARED_RUNTIME_SIDECAR_MANIFEST_FILE_NAME))
            .expect("remove bundled runtime sidecar");
        let service = OpenClawRuntimeService::new();

        let error = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect_err("missing bundled runtime sidecar should fail");

        assert!(error
            .to_string()
            .contains("runtime sidecar"));
    }

    #[test]
    fn rejects_archived_bundled_runtime_when_runtime_sidecar_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        fs::remove_file(resource_root.join("runtime").join(PREPARED_RUNTIME_SIDECAR_MANIFEST_FILE_NAME))
            .expect("remove bundled runtime sidecar");
        create_test_runtime_archive(&resource_root);
        fs::remove_dir_all(resource_root.join("runtime")).expect("remove source runtime dir");
        let service = OpenClawRuntimeService::new();

        let error = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect_err("archived runtime without sidecar should fail");

        assert!(error
            .to_string()
            .contains("runtime sidecar"));
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
        let (busy_port, occupied_ports) = reserve_contiguous_port_window(1);

        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {busy_port}\n  }}\n}}\n"),
        )
        .expect("seed config file");

        let activated = service
            .ensure_bundled_runtime_from_root(&paths, &resource_root)
            .expect("activated runtime");

        drop(occupied_ports);

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
        assert_eq!(
            config
                .pointer("/gateway/controlUi/allowedOrigins")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>()),
            Some(TAURI_CONTROL_UI_ALLOWED_ORIGINS.to_vec())
        );
    }

    #[test]
    fn preserves_existing_control_ui_origins_while_appending_tauri_webview_origins() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let resource_root =
            create_bundled_runtime_fixture(temp.path(), TEST_BUNDLED_OPENCLAW_VERSION);
        let service = OpenClawRuntimeService::new();

        fs::write(
            &paths.openclaw_config_file,
            r#"{
  gateway: {
    controlUi: {
      allowedOrigins: ["https://control.example.com"],
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
                .pointer("/gateway/controlUi/allowedOrigins")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>()),
            Some(
                std::iter::once("https://control.example.com")
                    .chain(TAURI_CONTROL_UI_ALLOWED_ORIGINS)
                    .collect::<Vec<_>>()
            )
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
        let (busy_port, occupied_ports) = reserve_contiguous_port_window(1);

        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {busy_port}\n  }}\n}}\n"),
        )
        .expect("seed config file");

        let refreshed = service
            .refresh_configured_runtime(&paths, &activated)
            .expect("refreshed runtime");

        drop(occupied_ports);

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

    fn create_archived_bundled_runtime_fixture(
        root: &std::path::Path,
        version: &str,
    ) -> std::path::PathBuf {
        let resource_root = create_bundled_runtime_fixture(root, version);
        create_test_runtime_archive(&resource_root);
        std::fs::remove_dir_all(resource_root.join("runtime")).expect("remove runtime dir");
        resource_root
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
        let openclaw_package_json_path = resource_root
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("package.json");
        let bundled_plugin_package_json_path = resource_root
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("dist")
            .join("extensions")
            .join("amazon-bedrock")
            .join("package.json");
        let carbon_package_json_path = resource_root
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("@buape")
            .join("carbon")
            .join("package.json");
        let client_bedrock_package_json_path = resource_root
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("@aws-sdk")
            .join("client-bedrock")
            .join("package.json");
        fs::create_dir_all(
            openclaw_package_json_path
                .parent()
                .expect("openclaw package json parent"),
        )
        .expect("openclaw package dir");
        fs::create_dir_all(
            bundled_plugin_package_json_path
                .parent()
                .expect("bundled plugin package json parent"),
        )
        .expect("bundled plugin package dir");
        fs::create_dir_all(
            carbon_package_json_path
                .parent()
                .expect("carbon package json parent"),
        )
        .expect("carbon package dir");
        fs::create_dir_all(
            client_bedrock_package_json_path
                .parent()
                .expect("client bedrock package json parent"),
        )
        .expect("client bedrock package dir");
        fs::write(
            &openclaw_package_json_path,
            r#"{
  "name": "openclaw",
  "version": "2026.4.2",
  "dependencies": {
    "@buape/carbon": "0.0.0-beta-20260327000044"
  }
}
"#,
        )
        .expect("openclaw package json");
        fs::write(
            &bundled_plugin_package_json_path,
            r#"{
  "name": "@openclaw/amazon-bedrock-provider",
  "version": "2026.4.2-beta.1",
  "dependencies": {
    "@aws-sdk/client-bedrock": "3.1020.0"
  }
}
"#,
        )
        .expect("bundled plugin package json");
        fs::write(
            &carbon_package_json_path,
            r#"{
  "name": "@buape/carbon",
  "version": "0.0.0-beta-20260327000044"
}
"#,
        )
        .expect("carbon package json");
        fs::write(
            &client_bedrock_package_json_path,
            r#"{
  "name": "@aws-sdk/client-bedrock",
  "version": "3.1020.0"
}
"#,
        )
        .expect("client-bedrock package json");
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
        write_runtime_sidecar_manifest(&runtime_root, &manifest);

        resource_root
    }

    fn create_test_runtime_archive(resource_root: &std::path::Path) {
        let archive_path = resource_root.join(BUNDLED_RUNTIME_ARCHIVE_FILE_NAME);

        if cfg!(windows) {
            let command = format!(
                "$ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath '{destination}') {{ Remove-Item -LiteralPath '{destination}' -Force }}; Compress-Archive -Path 'runtime' -DestinationPath '{destination}' -Force",
                destination = archive_path.to_string_lossy().replace('\'', "''"),
            );
            let output = std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", &command])
                .current_dir(resource_root)
                .output()
                .expect("create windows runtime archive");
            assert!(
                output.status.success(),
                "windows runtime archive creation failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            return;
        }

        let output = std::process::Command::new("zip")
            .args([
                "-q",
                "-r",
                archive_path.to_string_lossy().as_ref(),
                "runtime",
            ])
            .current_dir(resource_root)
            .output()
            .expect("create unix runtime archive");
        assert!(
            output.status.success(),
            "unix runtime archive creation failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn write_runtime_sidecar_manifest(
        runtime_dir: &std::path::Path,
        manifest: &BundledOpenClawManifest,
    ) {
        let integrity_files = [
            manifest
                .node_relative_path
                .trim_start_matches("runtime/")
                .to_string(),
            manifest
                .cli_relative_path
                .trim_start_matches("runtime/")
                .to_string(),
            "package/node_modules/openclaw/package.json".to_string(),
            "package/node_modules/@buape/carbon/package.json".to_string(),
            "package/node_modules/@aws-sdk/client-bedrock/package.json".to_string(),
        ]
        .into_iter()
        .map(|relative_path| {
            let absolute_path = runtime_dir.join(&relative_path);
            let metadata = fs::metadata(&absolute_path).expect("runtime integrity file metadata");
            PreparedOpenClawRuntimeIntegrityFile {
                relative_path,
                size: metadata.len(),
                sha256: sha256_file_hex(&absolute_path).expect("runtime integrity sha256"),
            }
        })
        .collect::<Vec<_>>();
        let sidecar = PreparedOpenClawRuntimeSidecarManifest {
            manifest: manifest.clone(),
            runtime_integrity: Some(PreparedOpenClawRuntimeIntegrityManifest {
                schema_version: 1,
                files: integrity_files,
            }),
        };
        fs::write(
            runtime_dir.join(".sdkwork-openclaw-runtime.json"),
            format!(
                "{}\n",
                serde_json::to_string_pretty(&sidecar).expect("runtime sidecar json")
            ),
        )
        .expect("runtime sidecar manifest");
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
