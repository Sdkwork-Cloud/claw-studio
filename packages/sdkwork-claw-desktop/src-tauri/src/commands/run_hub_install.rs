use crate::{
    framework::{FrameworkError, Result as FrameworkResult},
    state::AppState,
};
use hub_installer_rs::{
    ApplyManifestOptions, InstallEngine, ProgressEvent, RegistryInstallOptions,
    RegistryInstallResult,
    types::{ContainerRuntimePreference, EffectiveRuntimePlatform, InstallControlLevel, InstallScope},
};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter, Manager, Runtime, path::BaseDirectory};

const HUB_INSTALLER_PROGRESS_EVENT: &str = "hub-installer:progress";
const BUNDLED_REGISTRY_RELATIVE_PATH: &str = "hub-installer/registry/software-registry.yaml";

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunHubInstallRequest {
    pub software_name: String,
    #[serde(default)]
    pub registry_source: Option<String>,
    #[serde(default)]
    pub install_scope: Option<String>,
    #[serde(default)]
    pub effective_runtime_platform: Option<String>,
    #[serde(default)]
    pub container_runtime_preference: Option<String>,
    #[serde(default)]
    pub wsl_distribution: Option<String>,
    #[serde(default)]
    pub docker_context: Option<String>,
    #[serde(default)]
    pub docker_host: Option<String>,
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default)]
    pub verbose: bool,
    #[serde(default)]
    pub sudo: bool,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub installer_home: Option<String>,
    #[serde(default)]
    pub install_root: Option<String>,
    #[serde(default)]
    pub work_root: Option<String>,
    #[serde(default)]
    pub bin_dir: Option<String>,
    #[serde(default)]
    pub data_root: Option<String>,
    #[serde(default)]
    pub variables: BTreeMap<String, String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallStageReport {
    pub stage: String,
    pub success: bool,
    pub duration_ms: u128,
    pub total_steps: usize,
    pub failed_steps: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallArtifactReport {
    pub artifact_id: String,
    pub artifact_type: String,
    pub success: bool,
    pub duration_ms: u128,
    pub detail: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallResult {
    pub registry_name: String,
    pub registry_source: String,
    pub software_name: String,
    pub manifest_source: String,
    pub manifest_name: String,
    pub success: bool,
    pub duration_ms: u128,
    pub platform: String,
    pub effective_runtime_platform: String,
    pub resolved_install_scope: String,
    pub resolved_install_root: String,
    pub resolved_work_root: String,
    pub resolved_bin_dir: String,
    pub resolved_data_root: String,
    pub install_control_level: String,
    pub stage_reports: Vec<HubInstallStageReport>,
    pub artifact_reports: Vec<HubInstallArtifactReport>,
}

#[tauri::command]
pub fn run_hub_install(
    request: RunHubInstallRequest,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<HubInstallResult, String> {
    run_hub_install_at(&app, &state, request).map_err(|error| error.to_string())
}

pub fn run_hub_install_at<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    request: RunHubInstallRequest,
) -> FrameworkResult<HubInstallResult> {
    let software_name = validate_software_name(&request.software_name)?.to_owned();
    let registry_source = resolve_registry_source(
        request.registry_source.as_deref(),
        resolve_bundled_registry_path(app),
        vendor_registry_source(),
    )?;
    let options = build_registry_install_options(state, &software_name, request, &registry_source)?;
    let event_app = app.clone();

    let result = InstallEngine::install_from_registry_with_observer(
        &software_name,
        options,
        &move |event: &ProgressEvent| {
            let _ = event_app.emit(HUB_INSTALLER_PROGRESS_EVENT, event.clone());
        },
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    Ok(HubInstallResult::from(result))
}

fn build_registry_install_options(
    state: &AppState,
    software_name: &str,
    request: RunHubInstallRequest,
    registry_source: &Path,
) -> FrameworkResult<RegistryInstallOptions> {
    let mut variables = request.variables.clone();
    variables
        .entry("sdkwork_product".to_string())
        .or_insert_with(|| software_name.to_string());

    let default_installer_home = state
        .context
        .paths
        .user_root
        .join("hub-installer")
        .display()
        .to_string();

    Ok(RegistryInstallOptions {
        registry_source: Some(registry_source.display().to_string()),
        apply: ApplyManifestOptions {
            effective_runtime_platform: parse_effective_runtime_platform(
                request.effective_runtime_platform.as_deref(),
            )?,
            container_runtime: parse_container_runtime_preference(
                request.container_runtime_preference.as_deref(),
            )?,
            wsl_distribution: request.wsl_distribution.clone(),
            docker_context: request.docker_context.clone(),
            docker_host: request.docker_host.clone(),
            dry_run: request.dry_run,
            verbose: request.verbose,
            progress: true,
            sudo: request.sudo,
            timeout_ms: request.timeout_ms,
            software_name: Some(software_name.to_string()),
            installer_home: Some(request.installer_home.unwrap_or(default_installer_home)),
            install_scope: parse_install_scope(request.install_scope.as_deref())?,
            install_root: request.install_root.clone(),
            work_root: request.work_root.clone(),
            bin_dir: request.bin_dir.clone(),
            data_root: request.data_root.clone(),
            variables,
            ..Default::default()
        },
    })
}

fn validate_software_name(software_name: &str) -> FrameworkResult<&str> {
    let trimmed = software_name.trim();
    if trimmed.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "hub installer softwareName must not be empty".to_string(),
        ));
    }

    Ok(trimmed)
}

fn resolve_registry_source(
    override_source: Option<&str>,
    bundled_registry: Option<PathBuf>,
    vendor_registry: PathBuf,
) -> FrameworkResult<PathBuf> {
    if let Some(source) = override_source.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(source));
    }

    if let Some(path) = bundled_registry.filter(|path| path.exists()) {
        return Ok(path);
    }

    if vendor_registry.exists() {
        return Ok(vendor_registry);
    }

    Err(FrameworkError::NotFound(
        "hub-installer registry assets".to_string(),
    ))
}

fn resolve_bundled_registry_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .resolve(BUNDLED_REGISTRY_RELATIVE_PATH, BaseDirectory::Resource)
        .ok()
}

fn vendor_registry_source() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("vendor")
        .join("hub-installer")
        .join("registry")
        .join("software-registry.yaml")
}

fn parse_install_scope(value: Option<&str>) -> FrameworkResult<Option<InstallScope>> {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(None),
        Some(value) if value.eq_ignore_ascii_case("system") => Ok(Some(InstallScope::System)),
        Some(value) if value.eq_ignore_ascii_case("user") => Ok(Some(InstallScope::User)),
        Some(other) => Err(FrameworkError::ValidationFailed(format!(
            "unsupported install scope {other}",
        ))),
    }
}

fn parse_effective_runtime_platform(
    value: Option<&str>,
) -> FrameworkResult<Option<EffectiveRuntimePlatform>> {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(None),
        Some(value) if value.eq_ignore_ascii_case("windows") => {
            Ok(Some(EffectiveRuntimePlatform::Windows))
        }
        Some(value) if value.eq_ignore_ascii_case("macos") => Ok(Some(EffectiveRuntimePlatform::Macos)),
        Some(value) if value.eq_ignore_ascii_case("ubuntu") => {
            Ok(Some(EffectiveRuntimePlatform::Ubuntu))
        }
        Some(value) if value.eq_ignore_ascii_case("android") => {
            Ok(Some(EffectiveRuntimePlatform::Android))
        }
        Some(value) if value.eq_ignore_ascii_case("ios") => Ok(Some(EffectiveRuntimePlatform::Ios)),
        Some(value) if value.eq_ignore_ascii_case("wsl") => Ok(Some(EffectiveRuntimePlatform::Wsl)),
        Some(other) => Err(FrameworkError::ValidationFailed(format!(
            "unsupported effective runtime platform {other}",
        ))),
    }
}

fn parse_container_runtime_preference(
    value: Option<&str>,
) -> FrameworkResult<Option<ContainerRuntimePreference>> {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(None),
        Some(value) if value.eq_ignore_ascii_case("auto") => {
            Ok(Some(ContainerRuntimePreference::Auto))
        }
        Some(value) if value.eq_ignore_ascii_case("host") => {
            Ok(Some(ContainerRuntimePreference::Host))
        }
        Some(value) if value.eq_ignore_ascii_case("wsl") => {
            Ok(Some(ContainerRuntimePreference::Wsl))
        }
        Some(other) => Err(FrameworkError::ValidationFailed(format!(
            "unsupported container runtime preference {other}",
        ))),
    }
}

impl From<RegistryInstallResult> for HubInstallResult {
    fn from(value: RegistryInstallResult) -> Self {
        let apply = value.apply_result;

        Self {
            registry_name: value.registry_name,
            registry_source: value.registry_source,
            software_name: value.software_name,
            manifest_source: value.manifest_source,
            manifest_name: apply.manifest_name,
            success: apply.success,
            duration_ms: apply.duration_ms,
            platform: apply.platform.as_str().to_string(),
            effective_runtime_platform: apply.effective_runtime_platform.as_str().to_string(),
            resolved_install_scope: install_scope_to_string(apply.resolved_install_scope),
            resolved_install_root: apply.resolved_install_root,
            resolved_work_root: apply.resolved_work_root,
            resolved_bin_dir: apply.resolved_bin_dir,
            resolved_data_root: apply.resolved_data_root,
            install_control_level: install_control_level_to_string(apply.install_control_level),
            stage_reports: apply
                .stage_reports
                .into_iter()
                .map(|report| HubInstallStageReport {
                    stage: report.stage,
                    success: report.success,
                    duration_ms: report.duration_ms,
                    total_steps: report.total_steps,
                    failed_steps: report.failed_steps,
                })
                .collect(),
            artifact_reports: apply
                .artifact_reports
                .into_iter()
                .map(|report| HubInstallArtifactReport {
                    artifact_id: report.artifact_id,
                    artifact_type: report.artifact_type,
                    success: report.success,
                    duration_ms: report.duration_ms,
                    detail: report.detail,
                })
                .collect(),
        }
    }
}

fn install_scope_to_string(scope: InstallScope) -> String {
    match scope {
        InstallScope::System => "system".to_string(),
        InstallScope::User => "user".to_string(),
    }
}

fn install_control_level_to_string(level: InstallControlLevel) -> String {
    match level {
        InstallControlLevel::Managed => "managed".to_string(),
        InstallControlLevel::Partial => "partial".to_string(),
        InstallControlLevel::Opaque => "opaque".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_registry_source, validate_software_name, vendor_registry_source};
    use std::path::PathBuf;

    #[test]
    fn rejects_empty_software_name() {
        let error = validate_software_name("   ").expect_err("empty software name should fail");

        assert!(error
            .to_string()
            .contains("hub installer softwareName must not be empty"));
    }

    #[test]
    fn prefers_explicit_registry_source() {
        let vendor_registry = vendor_registry_source();
        let resolved = resolve_registry_source(
            Some("D:/custom/software-registry.yaml"),
            Some(PathBuf::from("D:/ignored/resource/software-registry.yaml")),
            vendor_registry,
        )
        .expect("registry source");

        assert_eq!(
            resolved,
            PathBuf::from("D:/custom/software-registry.yaml"),
        );
    }

    #[test]
    fn falls_back_to_vendor_registry_when_no_override_is_provided() {
        let vendor_registry = vendor_registry_source();
        let resolved = resolve_registry_source(None, None, vendor_registry.clone())
            .expect("vendor registry fallback");

        assert_eq!(resolved, vendor_registry);
        assert!(resolved.exists());
    }
}
