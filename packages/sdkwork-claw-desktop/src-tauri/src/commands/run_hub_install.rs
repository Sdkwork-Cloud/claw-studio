use crate::{
    commands::hub_install_progress::{emit_hub_install_progress, HubInstallProgressOperationKind},
    framework::{runtime, FrameworkError, Result as FrameworkResult},
    state::AppState,
};
use hub_installer_rs::{
    manifest::{ManifestCommand, ManifestShell},
    types::{
        ContainerRuntimePreference, EffectiveRuntimePlatform, InstallControlLevel, InstallScope,
    },
    ApplyManifestOptions, DependencyInstallOptions, DependencyInstallReport, InstallEngine,
    ManifestDataItem, ManifestInstallationDescriptor, ManifestInstallationDirectories,
    ManifestInstallationDirectory, ManifestInstallationMethod, ManifestMigrationStrategy,
    ProgressEvent, RegistryDependencyInstallOptions, RegistryDependencyInstallResult,
    RegistryInstallAssessmentResult, RegistryInstallOptions, RegistryInstallResult,
};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};
use tauri::{path::BaseDirectory, AppHandle, Manager, Runtime};
pub(crate) const BUNDLED_REGISTRY_RELATIVE_PATH: &str =
    "hub-installer/registry/software-registry.yaml";

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunHubInstallRequest {
    pub software_name: String,
    #[serde(default)]
    pub registry_source: Option<String>,
    #[serde(default)]
    pub request_id: Option<String>,
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

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunHubDependencyInstallRequest {
    #[serde(flatten)]
    pub install: RunHubInstallRequest,
    #[serde(default)]
    pub dependency_ids: Vec<String>,
    #[serde(default)]
    pub continue_on_error: bool,
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
pub struct HubInstallAssessmentCommand {
    pub description: String,
    pub command_line: String,
    pub shell_kind: Option<String>,
    pub working_directory: Option<String>,
    pub requires_elevation: bool,
    pub auto_run: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentDependency {
    pub id: String,
    pub description: Option<String>,
    pub required: bool,
    pub check_type: String,
    pub target: String,
    pub status: String,
    pub supports_auto_remediation: bool,
    pub remediation_commands: Vec<HubInstallAssessmentCommand>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentInstallationMethod {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub summary: String,
    pub supported: Option<bool>,
    pub documentation_url: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentInstallationDirectory {
    pub id: Option<String>,
    pub path: String,
    pub customizable: Option<bool>,
    pub purpose: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentInstallationDirectories {
    pub install_root: Option<HubInstallAssessmentInstallationDirectory>,
    pub work_root: Option<HubInstallAssessmentInstallationDirectory>,
    pub bin_dir: Option<HubInstallAssessmentInstallationDirectory>,
    pub data_root: Option<HubInstallAssessmentInstallationDirectory>,
    pub additional: Vec<HubInstallAssessmentInstallationDirectory>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentInstallation {
    pub method: HubInstallAssessmentInstallationMethod,
    pub alternatives: Vec<HubInstallAssessmentInstallationMethod>,
    pub directories: Option<HubInstallAssessmentInstallationDirectories>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentDataItem {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub path: Option<String>,
    pub description: Option<String>,
    pub includes: Vec<String>,
    pub sensitive: Option<bool>,
    pub backup_by_default: Option<bool>,
    pub uninstall_by_default: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentMigrationStrategy {
    pub id: String,
    pub source: String,
    pub title: String,
    pub mode: String,
    pub summary: String,
    pub supported: Option<bool>,
    pub documentation_url: Option<String>,
    pub preview_commands: Vec<HubInstallAssessmentCommand>,
    pub apply_commands: Vec<HubInstallAssessmentCommand>,
    pub data_item_ids: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
    pub dependency_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentRuntime {
    pub host_platform: String,
    pub requested_runtime_platform: String,
    pub effective_runtime_platform: String,
    pub container_runtime_preference: Option<String>,
    pub resolved_container_runtime: Option<String>,
    pub wsl_distribution: Option<String>,
    pub available_wsl_distributions: Vec<String>,
    pub wsl_available: bool,
    pub host_docker_available: bool,
    pub wsl_docker_available: bool,
    pub runtime_home_dir: Option<String>,
    pub command_availability: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallAssessmentResult {
    pub registry_name: String,
    pub registry_source: String,
    pub software_name: String,
    pub manifest_source: String,
    pub manifest_name: String,
    pub manifest_description: Option<String>,
    pub manifest_homepage: Option<String>,
    pub ready: bool,
    pub requires_elevated_setup: bool,
    pub platform: String,
    pub effective_runtime_platform: String,
    pub resolved_install_scope: String,
    pub resolved_install_root: String,
    pub resolved_work_root: String,
    pub resolved_bin_dir: String,
    pub resolved_data_root: String,
    pub install_control_level: String,
    pub install_status: Option<String>,
    pub dependencies: Vec<HubInstallAssessmentDependency>,
    pub issues: Vec<HubInstallAssessmentIssue>,
    pub recommendations: Vec<String>,
    pub installation: Option<HubInstallAssessmentInstallation>,
    pub data_items: Vec<HubInstallAssessmentDataItem>,
    pub migration_strategies: Vec<HubInstallAssessmentMigrationStrategy>,
    pub runtime: HubInstallAssessmentRuntime,
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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallDependencyReport {
    pub dependency_id: String,
    pub description: Option<String>,
    pub target: String,
    pub required: bool,
    pub status_before: String,
    pub status_after: String,
    pub attempted_auto_remediation: bool,
    pub success: bool,
    pub skipped: bool,
    pub duration_ms: u128,
    pub step_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallDependencyResult {
    pub registry_name: String,
    pub registry_source: String,
    pub software_name: String,
    pub manifest_source: String,
    pub manifest_source_input: String,
    pub manifest_source_kind: String,
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
    pub dependency_reports: Vec<HubInstallDependencyReport>,
}

#[tauri::command]
pub async fn run_hub_install(
    request: RunHubInstallRequest,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<HubInstallResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("installer.run_hub_install", move || {
        run_hub_install_at(&app, &state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn inspect_hub_install(
    request: RunHubInstallRequest,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<HubInstallAssessmentResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("installer.inspect_hub_install", move || {
        inspect_hub_install_at(&app, &state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn run_hub_dependency_install(
    request: RunHubDependencyInstallRequest,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<HubInstallDependencyResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("installer.run_hub_dependency_install", move || {
        run_hub_dependency_install_at(&app, &state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

pub fn run_hub_install_at<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    request: RunHubInstallRequest,
) -> FrameworkResult<HubInstallResult> {
    let software_name = validate_software_name(&request.software_name)?.to_owned();
    let progress_software_name = software_name.clone();
    let request_id = request.request_id.clone();
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
            emit_hub_install_progress(
                &event_app,
                request_id.as_deref(),
                &progress_software_name,
                HubInstallProgressOperationKind::Install,
                event,
            );
        },
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    Ok(HubInstallResult::from(result))
}

pub fn inspect_hub_install_at<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    request: RunHubInstallRequest,
) -> FrameworkResult<HubInstallAssessmentResult> {
    let software_name = validate_software_name(&request.software_name)?.to_owned();
    let registry_source = resolve_registry_source(
        request.registry_source.as_deref(),
        resolve_bundled_registry_path(app),
        vendor_registry_source(),
    )?;
    let options = build_registry_install_options(state, &software_name, request, &registry_source)?;
    let result = InstallEngine::inspect_from_registry(&software_name, options)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    Ok(HubInstallAssessmentResult::from(result))
}

pub fn run_hub_dependency_install_at<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    request: RunHubDependencyInstallRequest,
) -> FrameworkResult<HubInstallDependencyResult> {
    let software_name = validate_software_name(&request.install.software_name)?.to_owned();
    let progress_software_name = software_name.clone();
    let request_id = request.install.request_id.clone();
    let registry_source = resolve_registry_source(
        request.install.registry_source.as_deref(),
        resolve_bundled_registry_path(app),
        vendor_registry_source(),
    )?;
    let apply_options =
        build_registry_install_options(state, &software_name, request.install, &registry_source)?;
    let event_app = app.clone();

    let result = InstallEngine::install_dependencies_from_registry_with_observer(
        &software_name,
        RegistryDependencyInstallOptions {
            registry_source: Some(registry_source.display().to_string()),
            dependencies: DependencyInstallOptions {
                apply: apply_options.apply,
                dependency_ids: request.dependency_ids,
                continue_on_error: request.continue_on_error,
            },
        },
        &move |event: &ProgressEvent| {
            emit_hub_install_progress(
                &event_app,
                request_id.as_deref(),
                &progress_software_name,
                HubInstallProgressOperationKind::DependencyInstall,
                event,
            );
        },
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    Ok(HubInstallDependencyResult::from(result))
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

pub(crate) fn resolve_registry_source(
    override_source: Option<&str>,
    bundled_registry: Option<PathBuf>,
    vendor_registry: PathBuf,
) -> FrameworkResult<PathBuf> {
    if let Some(source) = override_source
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
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

pub(crate) fn resolve_bundled_registry_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .resolve(BUNDLED_REGISTRY_RELATIVE_PATH, BaseDirectory::Resource)
        .ok()
}

pub(crate) fn vendor_registry_source() -> PathBuf {
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
        Some(value) if value.eq_ignore_ascii_case("macos") => {
            Ok(Some(EffectiveRuntimePlatform::Macos))
        }
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

impl From<RegistryInstallAssessmentResult> for HubInstallAssessmentResult {
    fn from(value: RegistryInstallAssessmentResult) -> Self {
        let assessment = value.assessment_result;

        Self {
            registry_name: value.registry_name,
            registry_source: value.registry_source,
            software_name: value.software_name,
            manifest_source: value.manifest_source,
            manifest_name: assessment.manifest_name,
            manifest_description: assessment.manifest_description,
            manifest_homepage: assessment.manifest_homepage,
            ready: assessment.ready,
            requires_elevated_setup: assessment.requires_elevated_setup,
            platform: assessment.platform.as_str().to_string(),
            effective_runtime_platform: assessment.effective_runtime_platform.as_str().to_string(),
            resolved_install_scope: install_scope_to_string(assessment.resolved_install_scope),
            resolved_install_root: assessment.resolved_install_root,
            resolved_work_root: assessment.resolved_work_root,
            resolved_bin_dir: assessment.resolved_bin_dir,
            resolved_data_root: assessment.resolved_data_root,
            install_control_level: install_control_level_to_string(
                assessment.install_control_level,
            ),
            install_status: assessment
                .install_status
                .map(|status| install_status_label(status).to_string()),
            dependencies: assessment
                .dependencies
                .into_iter()
                .map(|dependency| HubInstallAssessmentDependency {
                    id: dependency.id,
                    description: dependency.description,
                    required: dependency.required,
                    check_type: dependency.check_type,
                    target: dependency.target,
                    status: dependency.status,
                    supports_auto_remediation: dependency.supports_auto_remediation,
                    remediation_commands: dependency
                        .remediation_commands
                        .into_iter()
                        .map(|command| HubInstallAssessmentCommand {
                            description: command.description,
                            command_line: command.command_line,
                            shell_kind: command
                                .shell_kind
                                .map(|shell_kind| shell_kind_label(shell_kind).to_string()),
                            working_directory: command.working_directory,
                            requires_elevation: command.requires_elevation,
                            auto_run: command.auto_run,
                        })
                        .collect(),
                })
                .collect(),
            issues: assessment
                .issues
                .into_iter()
                .map(|issue| HubInstallAssessmentIssue {
                    severity: issue.severity,
                    code: issue.code,
                    message: issue.message,
                    dependency_id: issue.dependency_id,
                })
                .collect(),
            recommendations: assessment.recommendations,
            installation: assessment
                .installation
                .map(HubInstallAssessmentInstallation::from),
            data_items: assessment
                .data_items
                .into_iter()
                .map(HubInstallAssessmentDataItem::from)
                .collect(),
            migration_strategies: assessment
                .migration_strategies
                .into_iter()
                .map(HubInstallAssessmentMigrationStrategy::from)
                .collect(),
            runtime: HubInstallAssessmentRuntime {
                host_platform: assessment.runtime.host_platform.as_str().to_string(),
                requested_runtime_platform: assessment
                    .runtime
                    .requested_runtime_platform
                    .as_str()
                    .to_string(),
                effective_runtime_platform: assessment
                    .runtime
                    .effective_runtime_platform
                    .as_str()
                    .to_string(),
                container_runtime_preference: assessment
                    .runtime
                    .container_runtime_preference
                    .map(|preference| container_runtime_preference_label(preference).to_string()),
                resolved_container_runtime: assessment
                    .runtime
                    .resolved_container_runtime
                    .map(|runtime| container_runtime_label(runtime).to_string()),
                wsl_distribution: assessment.runtime.wsl_distribution,
                available_wsl_distributions: assessment.runtime.available_wsl_distributions,
                wsl_available: assessment.runtime.wsl_available,
                host_docker_available: assessment.runtime.host_docker_available,
                wsl_docker_available: assessment.runtime.wsl_docker_available,
                runtime_home_dir: assessment.runtime.runtime_home_dir,
                command_availability: assessment.runtime.command_availability,
            },
        }
    }
}

impl From<DependencyInstallReport> for HubInstallDependencyReport {
    fn from(value: DependencyInstallReport) -> Self {
        Self {
            dependency_id: value.dependency_id,
            description: value.description,
            target: value.target,
            required: value.required,
            status_before: value.status_before,
            status_after: value.status_after,
            attempted_auto_remediation: value.attempted_auto_remediation,
            success: value.success,
            skipped: value.skipped,
            duration_ms: value.duration_ms,
            step_count: value.step_count,
            error: value.error,
        }
    }
}

impl From<RegistryDependencyInstallResult> for HubInstallDependencyResult {
    fn from(value: RegistryDependencyInstallResult) -> Self {
        let dependency = value.dependency_result;

        Self {
            registry_name: value.registry_name,
            registry_source: value.registry_source,
            software_name: value.software_name,
            manifest_source: value.manifest_source,
            manifest_source_input: dependency.manifest_source_input,
            manifest_source_kind: dependency.manifest_source_kind,
            manifest_name: dependency.manifest_name,
            success: dependency.success,
            duration_ms: dependency.duration_ms,
            platform: dependency.platform.as_str().to_string(),
            effective_runtime_platform: dependency.effective_runtime_platform.as_str().to_string(),
            resolved_install_scope: install_scope_to_string(dependency.resolved_install_scope),
            resolved_install_root: dependency.resolved_install_root,
            resolved_work_root: dependency.resolved_work_root,
            resolved_bin_dir: dependency.resolved_bin_dir,
            resolved_data_root: dependency.resolved_data_root,
            install_control_level: install_control_level_to_string(
                dependency.install_control_level,
            ),
            dependency_reports: dependency
                .dependency_reports
                .into_iter()
                .map(HubInstallDependencyReport::from)
                .collect(),
        }
    }
}

impl From<ManifestInstallationMethod> for HubInstallAssessmentInstallationMethod {
    fn from(value: ManifestInstallationMethod) -> Self {
        Self {
            id: value.id,
            label: value.label,
            kind: value.r#type,
            summary: value.summary,
            supported: value.supported,
            documentation_url: value.documentation_url,
            notes: value.notes,
        }
    }
}

impl From<ManifestInstallationDirectory> for HubInstallAssessmentInstallationDirectory {
    fn from(value: ManifestInstallationDirectory) -> Self {
        Self {
            id: value.id,
            path: value.path,
            customizable: value.customizable,
            purpose: value.purpose,
        }
    }
}

impl From<ManifestInstallationDirectories> for HubInstallAssessmentInstallationDirectories {
    fn from(value: ManifestInstallationDirectories) -> Self {
        Self {
            install_root: value
                .install_root
                .map(HubInstallAssessmentInstallationDirectory::from),
            work_root: value
                .work_root
                .map(HubInstallAssessmentInstallationDirectory::from),
            bin_dir: value
                .bin_dir
                .map(HubInstallAssessmentInstallationDirectory::from),
            data_root: value
                .data_root
                .map(HubInstallAssessmentInstallationDirectory::from),
            additional: value
                .additional
                .into_iter()
                .map(HubInstallAssessmentInstallationDirectory::from)
                .collect(),
        }
    }
}

impl From<ManifestInstallationDescriptor> for HubInstallAssessmentInstallation {
    fn from(value: ManifestInstallationDescriptor) -> Self {
        Self {
            method: HubInstallAssessmentInstallationMethod::from(value.method),
            alternatives: value
                .alternatives
                .into_iter()
                .map(HubInstallAssessmentInstallationMethod::from)
                .collect(),
            directories: value
                .directories
                .map(HubInstallAssessmentInstallationDirectories::from),
        }
    }
}

impl From<ManifestDataItem> for HubInstallAssessmentDataItem {
    fn from(value: ManifestDataItem) -> Self {
        Self {
            id: value.id,
            title: value.title,
            kind: value.kind,
            path: value.path,
            description: value.description,
            includes: value.includes,
            sensitive: value.sensitive,
            backup_by_default: value.backup_by_default,
            uninstall_by_default: value.uninstall_by_default,
        }
    }
}

impl From<ManifestMigrationStrategy> for HubInstallAssessmentMigrationStrategy {
    fn from(value: ManifestMigrationStrategy) -> Self {
        Self {
            id: value.id,
            source: value.source,
            title: value.title,
            mode: value.mode,
            summary: value.summary,
            supported: value.supported,
            documentation_url: value.documentation_url,
            preview_commands: value
                .preview_commands
                .into_iter()
                .map(map_manifest_command)
                .collect(),
            apply_commands: value
                .apply_commands
                .into_iter()
                .map(map_manifest_command)
                .collect(),
            data_item_ids: value.data_item_ids,
            warnings: value.warnings,
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

fn install_status_label(value: hub_installer_rs::state::InstallRecordStatus) -> &'static str {
    match value {
        hub_installer_rs::state::InstallRecordStatus::Installed => "installed",
        hub_installer_rs::state::InstallRecordStatus::Uninstalled => "uninstalled",
    }
}

fn container_runtime_preference_label(value: ContainerRuntimePreference) -> &'static str {
    match value {
        ContainerRuntimePreference::Auto => "auto",
        ContainerRuntimePreference::Host => "host",
        ContainerRuntimePreference::Wsl => "wsl",
    }
}

fn container_runtime_label(value: hub_installer_rs::types::ContainerRuntime) -> &'static str {
    match value {
        hub_installer_rs::types::ContainerRuntime::Host => "host",
        hub_installer_rs::types::ContainerRuntime::Wsl => "wsl",
    }
}

fn shell_kind_label(value: hub_installer_rs::types::ShellKind) -> &'static str {
    match value {
        hub_installer_rs::types::ShellKind::Bash => "bash",
        hub_installer_rs::types::ShellKind::Powershell => "powershell",
        hub_installer_rs::types::ShellKind::Cmd => "cmd",
    }
}

fn map_manifest_command(command: ManifestCommand) -> HubInstallAssessmentCommand {
    let description = command.description.unwrap_or_else(|| command.run.clone());

    HubInstallAssessmentCommand {
        description,
        command_line: command.run,
        shell_kind: manifest_shell_label(command.shell).map(str::to_string),
        working_directory: command.cwd,
        requires_elevation: command.elevated.unwrap_or(false),
        auto_run: false,
    }
}

fn manifest_shell_label(value: Option<ManifestShell>) -> Option<&'static str> {
    match value {
        Some(ManifestShell::Bash) => Some("bash"),
        Some(ManifestShell::Powershell) => Some("powershell"),
        Some(ManifestShell::Cmd) => Some("cmd"),
        Some(ManifestShell::Auto) | None => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        map_manifest_command, resolve_registry_source, validate_software_name,
        vendor_registry_source, HubInstallAssessmentDataItem, HubInstallAssessmentInstallation,
        HubInstallAssessmentMigrationStrategy, HubInstallAssessmentResult,
    };
    use hub_installer_rs::{
        engine::{
            InstallAssessmentResult, InstallAssessmentRuntime, RegistryInstallAssessmentResult,
        },
        manifest::{ManifestCommand, ManifestShell},
        state::InstallRecordStatus,
        types::{EffectiveRuntimePlatform, InstallControlLevel, InstallScope, SupportedPlatform},
        ManifestDataItem, ManifestInstallationDescriptor, ManifestInstallationDirectories,
        ManifestInstallationDirectory, ManifestInstallationMethod, ManifestMigrationStrategy,
        ProgressEvent,
    };
    use std::{collections::BTreeMap, path::PathBuf};

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

        assert_eq!(resolved, PathBuf::from("D:/custom/software-registry.yaml"),);
    }

    #[test]
    fn falls_back_to_vendor_registry_when_no_override_is_provided() {
        let vendor_registry = vendor_registry_source();
        let resolved = resolve_registry_source(None, None, vendor_registry.clone())
            .expect("vendor registry fallback");

        assert_eq!(resolved, vendor_registry);
        assert!(resolved.exists());
    }

    #[test]
    fn maps_manifest_descriptors_into_frontend_installation_payload() {
        let installation = HubInstallAssessmentInstallation::from(ManifestInstallationDescriptor {
            method: ManifestInstallationMethod {
                id: "source-build".to_string(),
                label: "Source build".to_string(),
                r#type: "source".to_string(),
                summary: "Clone the repository and build locally.".to_string(),
                supported: Some(true),
                documentation_url: Some("https://example.com/install".to_string()),
                notes: vec!["Use WSL on Windows.".to_string()],
            },
            alternatives: vec![ManifestInstallationMethod {
                id: "npm-global".to_string(),
                label: "npm global install".to_string(),
                r#type: "package".to_string(),
                summary: "Install from npm.".to_string(),
                supported: Some(false),
                documentation_url: None,
                notes: Vec::new(),
            }],
            directories: Some(ManifestInstallationDirectories {
                install_root: Some(ManifestInstallationDirectory {
                    id: Some("install-root".to_string()),
                    path: "{{hub_install_root}}".to_string(),
                    customizable: Some(true),
                    purpose: Some("Managed binary root.".to_string()),
                }),
                work_root: None,
                bin_dir: None,
                data_root: None,
                additional: vec![ManifestInstallationDirectory {
                    id: Some("workspace-home".to_string()),
                    path: "~/.openclaw".to_string(),
                    customizable: Some(false),
                    purpose: Some("OpenClaw home.".to_string()),
                }],
            }),
        });

        assert_eq!(installation.method.label, "Source build");
        assert_eq!(installation.method.kind, "source");
        assert_eq!(installation.alternatives.len(), 1);
        assert_eq!(
            installation
                .directories
                .as_ref()
                .and_then(|directories| directories.install_root.as_ref())
                .and_then(|directory| directory.customizable),
            Some(true)
        );
        assert_eq!(
            installation
                .directories
                .as_ref()
                .map(|directories| directories.additional.len()),
            Some(1)
        );
    }

    #[test]
    fn maps_manifest_data_and_migration_descriptors_into_frontend_payload() {
        let data_item = HubInstallAssessmentDataItem::from(ManifestDataItem {
            id: "ironclaw-postgres".to_string(),
            title: "PostgreSQL state".to_string(),
            kind: "database".to_string(),
            path: Some("postgres://localhost/ironclaw".to_string()),
            description: Some("Primary data store.".to_string()),
            includes: vec!["memory".to_string(), "routines".to_string()],
            sensitive: Some(true),
            backup_by_default: Some(true),
            uninstall_by_default: "manual".to_string(),
        });
        let migration = HubInstallAssessmentMigrationStrategy::from(ManifestMigrationStrategy {
            id: "from-openclaw".to_string(),
            source: "openclaw".to_string(),
            title: "Review OpenClaw data".to_string(),
            mode: "manual".to_string(),
            summary: "Inspect data before importing.".to_string(),
            supported: Some(false),
            documentation_url: Some("https://example.com/migrate".to_string()),
            preview_commands: vec![ManifestCommand {
                id: Some("preview".to_string()),
                description: Some("Preview migration".to_string()),
                run: "zeroclaw migrate openclaw --dry-run".to_string(),
                shell: Some(ManifestShell::Bash),
                cwd: Some("~/work".to_string()),
                env: Default::default(),
                timeout_ms: None,
                continue_on_error: None,
                elevated: Some(false),
                when: None,
            }],
            apply_commands: vec![ManifestCommand {
                id: Some("apply".to_string()),
                description: None,
                run: "zeroclaw migrate openclaw".to_string(),
                shell: Some(ManifestShell::Bash),
                cwd: None,
                env: Default::default(),
                timeout_ms: None,
                continue_on_error: None,
                elevated: Some(true),
                when: None,
            }],
            data_item_ids: vec!["ironclaw-postgres".to_string()],
            warnings: vec!["Export PostgreSQL separately.".to_string()],
        });

        assert_eq!(data_item.kind, "database");
        assert_eq!(data_item.uninstall_by_default, "manual");
        assert_eq!(migration.preview_commands.len(), 1);
        assert_eq!(
            migration.preview_commands[0].shell_kind.as_deref(),
            Some("bash")
        );
        assert!(!migration.preview_commands[0].auto_run);
        assert_eq!(
            migration.apply_commands[0].description,
            "zeroclaw migrate openclaw"
        );
        assert!(migration.apply_commands[0].requires_elevation);
    }

    #[test]
    fn maps_manifest_commands_without_auto_shell_to_manual_frontend_commands() {
        let command = map_manifest_command(ManifestCommand {
            id: None,
            description: None,
            run: "openclaw channels list".to_string(),
            shell: Some(ManifestShell::Auto),
            cwd: None,
            env: Default::default(),
            timeout_ms: None,
            continue_on_error: None,
            elevated: None,
            when: None,
        });

        assert_eq!(command.description, "openclaw channels list");
        assert_eq!(command.command_line, "openclaw channels list");
        assert_eq!(command.shell_kind, None);
        assert!(!command.auto_run);
    }

    #[test]
    fn maps_install_status_into_frontend_assessment_payload() {
        let assessment = HubInstallAssessmentResult::from(RegistryInstallAssessmentResult {
            registry_name: "Hub Installer Official Registry".to_string(),
            registry_source: "registry/software-registry.yaml".to_string(),
            software_name: "openclaw-wsl".to_string(),
            manifest_source: "registry/manifests/openclaw-wsl.hub.yaml".to_string(),
            assessment_result: InstallAssessmentResult {
                manifest_name: "OpenClaw Install (WSL)".to_string(),
                manifest_description: Some("Install OpenClaw inside WSL.".to_string()),
                manifest_homepage: Some("https://docs.openclaw.ai/install".to_string()),
                platform: SupportedPlatform::Windows,
                effective_runtime_platform: EffectiveRuntimePlatform::Wsl,
                resolved_install_scope: InstallScope::User,
                resolved_install_root: "C:/Users/admin/.sdkwork/install/openclaw".to_string(),
                resolved_work_root: "C:/Users/admin/.sdkwork/work/openclaw".to_string(),
                resolved_bin_dir: "C:/Users/admin/.sdkwork/bin".to_string(),
                resolved_data_root: "C:/Users/admin/.sdkwork/data/openclaw".to_string(),
                install_control_level: InstallControlLevel::Managed,
                install_status: Some(InstallRecordStatus::Installed),
                ready: true,
                requires_elevated_setup: false,
                dependencies: Vec::new(),
                issues: Vec::new(),
                recommendations: Vec::new(),
                installation: None,
                data_items: Vec::new(),
                migration_strategies: Vec::new(),
                runtime: InstallAssessmentRuntime {
                    host_platform: SupportedPlatform::Windows,
                    requested_runtime_platform: EffectiveRuntimePlatform::Wsl,
                    effective_runtime_platform: EffectiveRuntimePlatform::Wsl,
                    container_runtime_preference: None,
                    resolved_container_runtime: None,
                    wsl_distribution: Some("Ubuntu-24.04".to_string()),
                    available_wsl_distributions: vec!["Ubuntu-24.04".to_string()],
                    wsl_available: true,
                    host_docker_available: true,
                    wsl_docker_available: true,
                    runtime_home_dir: Some("/home/admin".to_string()),
                    command_availability: BTreeMap::new(),
                },
            },
        });

        assert_eq!(assessment.install_status.as_deref(), Some("installed"));
    }

    #[test]
    fn progress_payload_carries_request_metadata_without_nesting_the_event_shape() {
        let payload = crate::commands::hub_install_progress::HubInstallProgressPayload::new(
            Some("install-request-1".to_string()),
            "openclaw-wsl".to_string(),
            crate::commands::hub_install_progress::HubInstallProgressOperationKind::Install,
            ProgressEvent::StepStarted {
                step_id: "install".to_string(),
                description: "Install OpenClaw".to_string(),
            },
        );

        let value = serde_json::to_value(payload).expect("progress payload should serialize");

        assert_eq!(value["requestId"], "install-request-1");
        assert_eq!(value["softwareName"], "openclaw-wsl");
        assert_eq!(value["operationKind"], "install");
        assert_eq!(value["type"], "stepStarted");
        assert_eq!(value["stepId"], "install");
    }
}
