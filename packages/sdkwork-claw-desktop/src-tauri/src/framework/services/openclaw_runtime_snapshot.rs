use crate::{
    framework::{
        kernel::{
            DesktopOpenClawProviderProjectionInfo, DesktopOpenClawRuntimeInfo,
            DesktopOpenClawRuntimeStageInfo,
        },
        paths::AppPaths,
        services::{
            kernel_runtime_authority::KernelRuntimeAuthorityService,
            local_ai_proxy::{
                LocalAiProxyLifecycle, LocalAiProxyService, LocalAiProxyServiceStatus,
            },
            openclaw_runtime::{load_manifest, ActivatedOpenClawRuntime, OPENCLAW_RUNTIME_ID},
            supervisor::{
                ManagedServiceLifecycle, ManagedServiceSnapshot, SupervisorService,
                SERVICE_ID_OPENCLAW_GATEWAY,
            },
        },
        Result,
    },
    platform,
};
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

const MANAGED_PROVIDER_ID: &str = "sdkwork-local-proxy";

#[derive(Clone, Debug, Default)]
pub struct OpenClawRuntimeSnapshotService;

#[derive(Clone, Debug)]
struct ProviderProjectionEvidence {
    status: String,
    detail: String,
    base_url: Option<String>,
    api: Option<String>,
    auth: Option<String>,
    default_model: Option<String>,
    available: bool,
}

impl OpenClawRuntimeSnapshotService {
    pub fn new() -> Self {
        Self
    }

    pub fn kernel_info(
        &self,
        paths: &AppPaths,
        supervisor: &SupervisorService,
        local_ai_proxy: &LocalAiProxyService,
    ) -> Result<DesktopOpenClawRuntimeInfo> {
        let configured_runtime = supervisor.configured_openclaw_runtime()?;
        let supervisor_snapshot = supervisor.snapshot()?;
        let gateway_service = supervisor_snapshot
            .services
            .iter()
            .find(|service| service.id == SERVICE_ID_OPENCLAW_GATEWAY);
        let local_ai_proxy_status = local_ai_proxy.status()?;
        let (config_root, config_error) =
            load_openclaw_config_root(&readable_managed_openclaw_config_path(paths));
        let provider_projection = build_provider_projection(
            &config_root,
            config_error.as_deref(),
            &local_ai_proxy_status,
        );
        let startup_chain = build_startup_chain(
            configured_runtime.as_ref(),
            gateway_service,
            &local_ai_proxy_status,
            &provider_projection,
        );
        let manifest = configured_runtime
            .as_ref()
            .and_then(|runtime| load_manifest(&runtime.install_dir.join("manifest.json")).ok());

        Ok(DesktopOpenClawRuntimeInfo {
            runtime_id: OPENCLAW_RUNTIME_ID.to_string(),
            lifecycle: resolve_runtime_lifecycle(
                configured_runtime.as_ref(),
                gateway_service,
                &local_ai_proxy_status,
                &provider_projection,
            ),
            configured: configured_runtime.is_some(),
            install_key: configured_runtime
                .as_ref()
                .map(|runtime| runtime.install_key.clone()),
            openclaw_version: manifest
                .as_ref()
                .map(|manifest| manifest.openclaw_version.clone()),
            node_version: manifest
                .as_ref()
                .and_then(|manifest| manifest.external_node_version().map(str::to_string)),
            platform: manifest
                .as_ref()
                .map(|manifest| manifest.platform.clone())
                .unwrap_or_else(|| platform::current_target().to_string()),
            arch: manifest
                .as_ref()
                .map(|manifest| manifest.arch.clone())
                .unwrap_or_else(|| platform::current_arch().to_string()),
            install_dir: configured_runtime
                .as_ref()
                .map(|runtime| path_string(&runtime.install_dir)),
            runtime_dir: configured_runtime
                .as_ref()
                .map(|runtime| path_string(&runtime.runtime_dir)),
            home_dir: path_string(&paths.openclaw_home_dir),
            state_dir: path_string(&paths.openclaw_state_dir),
            workspace_dir: path_string(&paths.openclaw_workspace_dir),
            config_path: path_string(&authority_managed_openclaw_config_path(paths)),
            gateway_port: configured_runtime
                .as_ref()
                .map(|runtime| runtime.gateway_port),
            gateway_base_url: configured_runtime
                .as_ref()
                .map(|runtime| format!("http://127.0.0.1:{}", runtime.gateway_port)),
            local_ai_proxy_base_url: local_ai_proxy_status
                .health
                .as_ref()
                .map(|health| health.base_url.clone()),
            local_ai_proxy_snapshot_path: path_string(&paths.local_ai_proxy_snapshot_file),
            provider_projection: DesktopOpenClawProviderProjectionInfo {
                provider_id: MANAGED_PROVIDER_ID.to_string(),
                available: provider_projection.available,
                status: provider_projection.status,
                base_url: provider_projection.base_url,
                api: provider_projection.api,
                auth: provider_projection.auth,
                default_model: provider_projection.default_model,
            },
            startup_chain,
        })
    }
}

fn resolve_runtime_lifecycle(
    configured_runtime: Option<&ActivatedOpenClawRuntime>,
    gateway_service: Option<&ManagedServiceSnapshot>,
    local_ai_proxy_status: &LocalAiProxyServiceStatus,
    provider_projection: &ProviderProjectionEvidence,
) -> String {
    if configured_runtime.is_none() {
        return "inactive".to_string();
    }

    match gateway_service.map(|service| &service.lifecycle) {
        Some(ManagedServiceLifecycle::Starting) => "starting".to_string(),
        Some(ManagedServiceLifecycle::Stopping) => "stopping".to_string(),
        Some(ManagedServiceLifecycle::Failed) => "degraded".to_string(),
        Some(ManagedServiceLifecycle::Running) => {
            if matches!(
                local_ai_proxy_status.lifecycle,
                LocalAiProxyLifecycle::Running
            ) && provider_projection.status == "ready"
            {
                "ready".to_string()
            } else {
                "degraded".to_string()
            }
        }
        _ => "stopped".to_string(),
    }
}

fn build_startup_chain(
    configured_runtime: Option<&ActivatedOpenClawRuntime>,
    gateway_service: Option<&ManagedServiceSnapshot>,
    local_ai_proxy_status: &LocalAiProxyServiceStatus,
    provider_projection: &ProviderProjectionEvidence,
) -> Vec<DesktopOpenClawRuntimeStageInfo> {
    let configure_status = if let Some(runtime) = configured_runtime {
        DesktopOpenClawRuntimeStageInfo {
            id: "configureOpenClawGateway".to_string(),
            status: "ready".to_string(),
            detail: format!(
                "Gateway runtime is configured with install key {} on port {}.",
                runtime.install_key, runtime.gateway_port
            ),
        }
    } else {
        DesktopOpenClawRuntimeStageInfo {
            id: "configureOpenClawGateway".to_string(),
            status: "pending".to_string(),
            detail: "No built-in OpenClaw runtime is configured in the desktop supervisor yet."
                .to_string(),
        }
    };

    let ensure_proxy_status = DesktopOpenClawRuntimeStageInfo {
        id: "ensureLocalAiProxyReady".to_string(),
        status: match local_ai_proxy_status.lifecycle {
            LocalAiProxyLifecycle::Running => "ready".to_string(),
            LocalAiProxyLifecycle::Failed => "degraded".to_string(),
            LocalAiProxyLifecycle::Stopped => "pending".to_string(),
        },
        detail: match (
            &local_ai_proxy_status.lifecycle,
            local_ai_proxy_status.health.as_ref(),
        ) {
            (LocalAiProxyLifecycle::Running, Some(health)) => format!(
                "Local AI proxy is serving managed OpenClaw traffic at {}.",
                health.base_url
            ),
            (LocalAiProxyLifecycle::Failed, _) => local_ai_proxy_status
                .last_error
                .clone()
                .unwrap_or_else(|| "Local AI proxy failed to initialize.".to_string()),
            _ => {
                "Local AI proxy has not been started for the built-in OpenClaw runtime.".to_string()
            }
        },
    };

    let project_provider_status = DesktopOpenClawRuntimeStageInfo {
        id: "projectManagedOpenClawProvider".to_string(),
        status: provider_projection.status.clone(),
        detail: provider_projection.detail.clone(),
    };

    let mut stages = vec![
        configure_status,
        ensure_proxy_status,
        project_provider_status,
    ];
    if let Some(service) = gateway_service {
        if matches!(service.lifecycle, ManagedServiceLifecycle::Failed) {
            stages.push(DesktopOpenClawRuntimeStageInfo {
                id: "openclawGatewayHealth".to_string(),
                status: "degraded".to_string(),
                detail: service.last_error.clone().unwrap_or_else(|| {
                    "Bundled OpenClaw gateway entered a failed state.".to_string()
                }),
            });
        }
    }
    stages
}

fn build_provider_projection(
    config_root: &Value,
    config_error: Option<&str>,
    local_ai_proxy_status: &LocalAiProxyServiceStatus,
) -> ProviderProjectionEvidence {
    if let Some(error) = config_error {
        return ProviderProjectionEvidence {
            status: "degraded".to_string(),
            detail: format!("Managed OpenClaw config could not be parsed: {error}"),
            base_url: None,
            api: None,
            auth: None,
            default_model: None,
            available: false,
        };
    }

    let Some(provider) = config_root
        .pointer("/models/providers/sdkwork-local-proxy")
        .and_then(Value::as_object)
    else {
        return ProviderProjectionEvidence {
            status: "pending".to_string(),
            detail: "Managed local proxy provider has not been projected into openclaw.json."
                .to_string(),
            base_url: None,
            api: None,
            auth: None,
            default_model: None,
            available: false,
        };
    };

    let base_url = provider
        .get("baseUrl")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let api = provider
        .get("api")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let auth = provider
        .get("auth")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let default_model = config_root
        .pointer("/agents/defaults/model/primary")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let expected_proxy_base_url = local_ai_proxy_status
        .health
        .as_ref()
        .map(|health| health.base_url.as_str());
    let default_model_managed = default_model
        .as_deref()
        .map(|value| value.starts_with("sdkwork-local-proxy/"))
        .unwrap_or(false);

    let (status, detail) = match (
        expected_proxy_base_url,
        base_url.as_deref(),
        default_model_managed,
        &local_ai_proxy_status.lifecycle,
    ) {
        (Some(expected), Some(actual), true, LocalAiProxyLifecycle::Running)
            if expected == actual =>
        {
            (
                "ready".to_string(),
                format!(
                    "Managed provider projects the local AI proxy at {actual} with default model {}.",
                    default_model.as_deref().unwrap_or("unknown")
                ),
            )
        }
        (Some(expected), Some(actual), _, LocalAiProxyLifecycle::Running) => (
            "degraded".to_string(),
            format!(
                "Managed provider base URL {actual} or default model {} is out of sync with local proxy {expected}.",
                default_model.as_deref().unwrap_or("unknown")
            ),
        ),
        (_, Some(actual), _, _) => (
            "pending".to_string(),
            format!(
                "Managed provider is configured at {actual}, but the local AI proxy is not ready yet."
            ),
        ),
        _ => (
            "pending".to_string(),
            "Managed provider exists but is missing a projected base URL.".to_string(),
        ),
    };

    ProviderProjectionEvidence {
        status,
        detail,
        base_url,
        api,
        auth,
        default_model,
        available: true,
    }
}

fn load_openclaw_config_root(path: &Path) -> (Value, Option<String>) {
    if !path.exists() {
        return (Value::Object(Map::new()), None);
    }

    match fs::read_to_string(path) {
        Ok(content) => match json5::from_str::<Value>(&content) {
            Ok(value) if value.is_object() => (value, None),
            Ok(_) => (
                Value::Object(Map::new()),
                Some(format!("expected config object at {}", path.display())),
            ),
            Err(error) => (
                Value::Object(Map::new()),
                Some(format!(
                    "invalid json5 config at {}: {error}",
                    path.display()
                )),
            ),
        },
        Err(error) => (
            Value::Object(Map::new()),
            Some(format!("failed to read {}: {error}", path.display())),
        ),
    }
}

fn readable_managed_openclaw_config_path(paths: &AppPaths) -> PathBuf {
    let authority_path = authority_managed_openclaw_config_path(paths);
    if authority_path.exists() || !paths.openclaw_config_file.exists() {
        authority_path
    } else {
        paths.openclaw_config_file.clone()
    }
}

fn authority_managed_openclaw_config_path(paths: &AppPaths) -> PathBuf {
    KernelRuntimeAuthorityService::new()
        .active_openclaw_config_path(paths)
        .unwrap_or_else(|_| paths.openclaw_managed_config_file.clone())
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
