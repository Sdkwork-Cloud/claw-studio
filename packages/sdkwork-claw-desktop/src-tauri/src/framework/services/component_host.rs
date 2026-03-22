use crate::framework::{
    components::{PackagedComponentDefinition, PackagedComponentKind, PackagedComponentStartupMode},
    kernel::{
        DesktopComponentCapabilityInfo, DesktopComponentCatalogInfo, DesktopComponentControlResult,
        DesktopComponentDocumentationRef, DesktopComponentEndpointInfo, DesktopComponentInfo,
        DesktopComponentServiceBindingInfo,
    },
    layout::ComponentsState,
    paths::AppPaths,
    FrameworkError, Result,
};
use serde::de::DeserializeOwned;
use std::{collections::HashMap, fs, path::Path};

use super::{
    components::ComponentRegistryService,
    supervisor::{ManagedServiceLifecycle, SupervisorService},
};

const CODEX_APP_SERVER_LISTEN_URL: &str = "ws://127.0.0.1:46110";
const OPENCLAW_GATEWAY_URL: &str = "ws://127.0.0.1:18789";
const SDKWORK_GATEWAY_URL: &str = "http://127.0.0.1:8080/v1";
const SDKWORK_ADMIN_URL: &str = "http://127.0.0.1:8081/admin";
const SDKWORK_PORTAL_URL: &str = "http://127.0.0.1:8082/portal";
const SDKWORK_WEB_ADMIN_URL: &str = "http://127.0.0.1:3001/admin";
const SDKWORK_WEB_PORTAL_URL: &str = "http://127.0.0.1:3001/portal";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ComponentControlAction {
    Start,
    Stop,
    Restart,
}

impl ComponentControlAction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
        }
    }

    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "start" => Ok(Self::Start),
            "stop" => Ok(Self::Stop),
            "restart" => Ok(Self::Restart),
            _ => Err(FrameworkError::ValidationFailed(format!(
                "unsupported component control action: {value}"
            ))),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct ComponentHostService;

impl ComponentHostService {
    pub fn new() -> Self {
        Self
    }

    pub fn component_catalog(
        &self,
        paths: &AppPaths,
        supervisor: &SupervisorService,
    ) -> Result<DesktopComponentCatalogInfo> {
        let resources = ComponentRegistryService::new().load_resources(paths)?;
        let components_state = read_json_file::<ComponentsState>(&paths.components_file)?;
        let supervisor_snapshot = supervisor.snapshot()?;
        let service_map = supervisor_snapshot
            .services
            .into_iter()
            .map(|service| (service.id.clone(), service))
            .collect::<HashMap<_, _>>();

        let components = resources
            .registry
            .components
            .into_iter()
            .map(|definition| {
                let component_state = components_state.entries.get(&definition.id);
                let services = definition
                    .service_ids
                    .iter()
                    .filter_map(|service_id| service_map.get(service_id))
                    .map(|service| DesktopComponentServiceBindingInfo {
                        service_id: service.id.clone(),
                        lifecycle: managed_service_lifecycle_label(&service.lifecycle).to_string(),
                        pid: service.pid,
                        last_error: service.last_error.clone(),
                    })
                    .collect::<Vec<_>>();

                Ok(DesktopComponentInfo {
                    id: definition.id.clone(),
                    display_name: definition.display_name.clone(),
                    kind: component_kind_label(&definition.kind).to_string(),
                    startup_mode: startup_mode_label(&definition.startup_mode).to_string(),
                    bundled_version: component_state
                        .map(|entry| entry.bundled_version.clone())
                        .unwrap_or_else(|| definition.bundled_version.clone()),
                    active_version: component_state.and_then(|entry| entry.active_version.clone()),
                    fallback_version: component_state
                        .and_then(|entry| entry.fallback_version.clone()),
                    repository_url: component_source_url(&definition),
                    source_commit: definition.commit.clone(),
                    install_subdir: definition.install_subdir.clone(),
                    runtime_status: component_runtime_status(&definition, &services),
                    service_ids: definition.service_ids.clone(),
                    services,
                    endpoints: component_endpoints(&definition),
                    capabilities: component_capabilities(&definition),
                    docs: component_docs(&definition),
                })
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(DesktopComponentCatalogInfo {
            default_startup_component_ids: resources.service_defaults.auto_start_component_ids,
            components,
        })
    }

    pub fn control_component(
        &self,
        paths: &AppPaths,
        supervisor: &SupervisorService,
        component_id: &str,
        action: ComponentControlAction,
    ) -> Result<DesktopComponentControlResult> {
        let resources = ComponentRegistryService::new().load_resources(paths)?;
        let definition = resources
            .registry
            .components
            .into_iter()
            .find(|component| component.id == component_id)
            .ok_or_else(|| FrameworkError::NotFound(format!("component not found: {component_id}")))?;

        if definition.startup_mode == PackagedComponentStartupMode::Embedded {
            return Ok(DesktopComponentControlResult {
                component_id: component_id.to_string(),
                action: action.as_str().to_string(),
                outcome: "embedded".to_string(),
                affected_service_ids: Vec::new(),
            });
        }

        let service_map = supervisor
            .snapshot()?
            .services
            .into_iter()
            .map(|service| (service.id.clone(), service))
            .collect::<HashMap<_, _>>();

        let mut changed = false;
        for service_id in &definition.service_ids {
            let lifecycle = service_map
                .get(service_id)
                .map(|service| service.lifecycle.clone());

            match action {
                ComponentControlAction::Start => {
                    if !matches!(lifecycle, Some(ManagedServiceLifecycle::Running)) {
                        supervisor.request_restart(service_id)?;
                        changed = true;
                    }
                }
                ComponentControlAction::Stop => {
                    if !matches!(lifecycle, Some(ManagedServiceLifecycle::Stopped)) {
                        supervisor.stop_service(service_id)?;
                        changed = true;
                    }
                }
                ComponentControlAction::Restart => {
                    supervisor.request_restart(service_id)?;
                    changed = true;
                }
            }
        }

        Ok(DesktopComponentControlResult {
            component_id: component_id.to_string(),
            action: action.as_str().to_string(),
            outcome: if definition.service_ids.is_empty() {
                "noop".to_string()
            } else if changed {
                match action {
                    ComponentControlAction::Start => "started".to_string(),
                    ComponentControlAction::Stop => "stopped".to_string(),
                    ComponentControlAction::Restart => "restarted".to_string(),
                }
            } else {
                "noop".to_string()
            },
            affected_service_ids: definition.service_ids,
        })
    }
}

fn read_json_file<T>(path: &Path) -> Result<T>
where
    T: DeserializeOwned,
{
    let content = fs::read_to_string(path).map_err(|error| {
        FrameworkError::Io(std::io::Error::new(
            error.kind(),
            format!("failed to read {}: {error}", path.display()),
        ))
    })?;
    Ok(serde_json::from_str::<T>(&content)?)
}

fn managed_service_lifecycle_label(lifecycle: &ManagedServiceLifecycle) -> &'static str {
    match lifecycle {
        ManagedServiceLifecycle::Starting => "starting",
        ManagedServiceLifecycle::Running => "running",
        ManagedServiceLifecycle::Stopping => "stopping",
        ManagedServiceLifecycle::Stopped => "stopped",
        ManagedServiceLifecycle::Failed => "failed",
    }
}

fn component_kind_label(kind: &PackagedComponentKind) -> &'static str {
    match kind {
        PackagedComponentKind::Binary => "binary",
        PackagedComponentKind::NodeApp => "nodeApp",
        PackagedComponentKind::ServiceGroup => "serviceGroup",
        PackagedComponentKind::EmbeddedLibrary => "embeddedLibrary",
    }
}

fn startup_mode_label(mode: &PackagedComponentStartupMode) -> &'static str {
    match mode {
        PackagedComponentStartupMode::AutoStart => "autoStart",
        PackagedComponentStartupMode::Manual => "manual",
        PackagedComponentStartupMode::Embedded => "embedded",
    }
}

fn component_runtime_status(
    definition: &PackagedComponentDefinition,
    services: &[DesktopComponentServiceBindingInfo],
) -> String {
    if definition.startup_mode == PackagedComponentStartupMode::Embedded {
        return "embedded".to_string();
    }
    if services.is_empty() {
        return "stopped".to_string();
    }

    let running = services.iter().filter(|service| service.lifecycle == "running").count();
    let failed = services.iter().filter(|service| service.lifecycle == "failed").count();
    let transition = services
        .iter()
        .filter(|service| matches!(service.lifecycle.as_str(), "starting" | "stopping"))
        .count();

    if failed > 0 && running == 0 {
        return "failed".to_string();
    }
    if transition > 0 {
        return "transitioning".to_string();
    }
    if running == services.len() {
        return "running".to_string();
    }
    if running == 0 {
        return "stopped".to_string();
    }
    if failed > 0 {
        return "degraded".to_string();
    }

    "partial".to_string()
}

fn component_source_url(definition: &PackagedComponentDefinition) -> Option<String> {
    definition.source_url.clone().or_else(|| {
        Some(match definition.id.as_str() {
            "codex" => "https://github.com/openai/codex".to_string(),
            "openclaw" => "https://github.com/openclaw/openclaw".to_string(),
            "zeroclaw" => "https://github.com/zeroclaw-labs/zeroclaw".to_string(),
            "ironclaw" => "https://github.com/nearai/ironclaw".to_string(),
            "sdkwork-api-router" => "https://github.com/Sdkwork-Cloud/sdkwork-api-router".to_string(),
            "hub-installer" => "https://github.com/Sdkwork-Cloud/hub-installer".to_string(),
            _ => return None,
        })
    })
}

fn component_docs(definition: &PackagedComponentDefinition) -> Vec<DesktopComponentDocumentationRef> {
    match definition.id.as_str() {
        "codex" => vec![
            repo_doc(definition, "Overview", "README.md"),
            repo_doc(definition, "CLI entry", "codex-rs/cli/src/main.rs"),
        ],
        "openclaw" => vec![
            repo_doc(definition, "Overview", "README.md"),
            repo_doc(definition, "CLI entry", "openclaw.mjs"),
        ],
        "zeroclaw" => vec![
            repo_doc(definition, "Overview", "README.md"),
            repo_doc(definition, "CLI entry", "src/main.rs"),
            repo_doc(definition, "Reference docs", "docs/reference/README.md"),
        ],
        "ironclaw" => vec![
            repo_doc(definition, "Overview", "README.md"),
            repo_doc(definition, "CLI entry", "src/main.rs"),
            repo_doc(definition, "LLM providers", "docs/LLM_PROVIDERS.md"),
        ],
        "sdkwork-api-router" => vec![
            repo_doc(definition, "Overview", "README.md"),
            repo_doc(definition, "Gateway API", "docs/api-reference/gateway-api.md"),
            repo_doc(definition, "Admin API", "docs/api-reference/admin-api.md"),
            repo_doc(definition, "Portal API", "docs/api-reference/portal-api.md"),
        ],
        "hub-installer" => vec![
            repo_doc(definition, "Overview", "README.md"),
            repo_doc(definition, "Rust library", "rust/src/lib.rs"),
            repo_doc(definition, "Install policy", "docs/install-policy.md"),
        ],
        _ => Vec::new(),
    }
}

fn repo_doc(
    definition: &PackagedComponentDefinition,
    label: &str,
    relative_path: &str,
) -> DesktopComponentDocumentationRef {
    let location = component_source_url(definition)
        .map(|repository| {
            let base = repository.trim_end_matches(".git");
            if let Some(commit) = definition.commit.as_deref() {
                format!("{base}/blob/{commit}/{relative_path}")
            } else {
                format!("{base}/blob/main/{relative_path}")
            }
        })
        .unwrap_or_else(|| relative_path.to_string());

    DesktopComponentDocumentationRef {
        label: label.to_string(),
        location,
    }
}

fn component_endpoints(definition: &PackagedComponentDefinition) -> Vec<DesktopComponentEndpointInfo> {
    match definition.id.as_str() {
        "codex" => vec![DesktopComponentEndpointInfo {
            id: "app-server".to_string(),
            label: "Codex App Server".to_string(),
            transport: "websocket".to_string(),
            target: CODEX_APP_SERVER_LISTEN_URL.to_string(),
            description: "Desktop-managed Codex app-server websocket for IDE or local client integration."
                .to_string(),
        }],
        "openclaw" => vec![DesktopComponentEndpointInfo {
            id: "gateway".to_string(),
            label: "OpenClaw Gateway".to_string(),
            transport: "websocket".to_string(),
            target: OPENCLAW_GATEWAY_URL.to_string(),
            description: "OpenClaw gateway control plane websocket.".to_string(),
        }],
        "sdkwork-api-router" => vec![
            DesktopComponentEndpointInfo {
                id: "gateway-v1".to_string(),
                label: "Gateway API".to_string(),
                transport: "http".to_string(),
                target: SDKWORK_GATEWAY_URL.to_string(),
                description: "OpenAI-compatible /v1 gateway endpoint.".to_string(),
            },
            DesktopComponentEndpointInfo {
                id: "admin-api".to_string(),
                label: "Admin API".to_string(),
                transport: "http".to_string(),
                target: SDKWORK_ADMIN_URL.to_string(),
                description: "Operator-facing /admin API.".to_string(),
            },
            DesktopComponentEndpointInfo {
                id: "portal-api".to_string(),
                label: "Portal API".to_string(),
                transport: "http".to_string(),
                target: SDKWORK_PORTAL_URL.to_string(),
                description: "Developer portal /portal API.".to_string(),
            },
            DesktopComponentEndpointInfo {
                id: "admin-site".to_string(),
                label: "Admin Web".to_string(),
                transport: "http".to_string(),
                target: SDKWORK_WEB_ADMIN_URL.to_string(),
                description: "Bundled admin web surface served by router-web-service.".to_string(),
            },
            DesktopComponentEndpointInfo {
                id: "portal-site".to_string(),
                label: "Portal Web".to_string(),
                transport: "http".to_string(),
                target: SDKWORK_WEB_PORTAL_URL.to_string(),
                description: "Bundled portal web surface served by router-web-service.".to_string(),
            },
        ],
        _ => Vec::new(),
    }
}

fn component_capabilities(
    definition: &PackagedComponentDefinition,
) -> Vec<DesktopComponentCapabilityInfo> {
    match definition.id.as_str() {
        "codex" => vec![
            capability("interactive-cli", "Interactive CLI", "cli", "Local coding assistant CLI with TUI and session resume support.", &["codex"]),
            capability("non-interactive-exec", "Batch Exec", "cli", "Non-interactive exec and review workflows.", &["codex exec", "codex review"]),
            capability("mcp-and-app-server", "MCP / App Server", "rpc", "MCP server mode plus websocket app-server transport.", &["codex mcp", "codex app-server"]),
        ],
        "openclaw" => vec![
            capability("gateway", "Gateway Control Plane", "websocket", "Gateway daemon and websocket control plane for channels and clients.", &["openclaw gateway --port 18789"]),
            capability("assistant-cli", "Assistant CLI", "cli", "Agent, onboarding, doctor, and message-send command surface.", &["openclaw onboard", "openclaw agent", "openclaw message send", "openclaw doctor"]),
            capability("web-and-channel-surface", "Web and Channel Surface", "http", "Gateway-served control UI, WebChat, and channel integrations.", &["docs.openclaw.ai/web", "docs.openclaw.ai/channels"]),
        ],
        "zeroclaw" => vec![
            capability("agent-runtime", "Agent Runtime", "cli", "Interactive or single-shot agent execution.", &["zeroclaw agent"]),
            capability("gateway", "Gateway / Webhook Surface", "http", "Gateway-hosted webhook and health endpoints for channels.", &["zeroclaw gateway", "GET /health"]),
            capability("ops", "Operations Surface", "cli", "Onboard, service control, self-test, and doctor flows.", &["zeroclaw onboard", "zeroclaw service", "zeroclaw self-test"]),
        ],
        "ironclaw" => vec![
            capability("assistant-runtime", "Assistant Runtime", "cli", "Primary agent run loop with REPL, routines, and workers.", &["ironclaw run", "ironclaw status"]),
            capability("webhook-and-web-gateway", "Webhook / Web Gateway", "http", "Webhook server, HTTP channel, and web gateway support.", &["WebhookServer", "GatewayChannel", "HttpChannel"]),
            capability("ops-and-extensions", "Ops / Extension Surface", "cli", "Setup, service, MCP, tools, skills, and registry commands.", &["ironclaw onboard", "ironclaw service", "ironclaw mcp", "ironclaw tools"]),
        ],
        "sdkwork-api-router" => vec![
            capability("openai-gateway", "OpenAI-Compatible Gateway", "http", "Gateway service exposing OpenAI-compatible /v1 routes.", &["gateway-service"]),
            capability("admin-portal-apis", "Admin / Portal APIs", "http", "Separate operator and developer API surfaces.", &["admin-api-service", "portal-api-service"]),
            capability("bundled-web-host", "Bundled Web Host", "http", "Pingora-backed host for admin and portal sites.", &["router-web-service"]),
        ],
        "hub-installer" => vec![
            capability("embedded-install-engine", "Embedded Install Engine", "embedded", "In-process Rust install engine for inspect/install/uninstall/backup.", &["run_hub_install", "run_hub_uninstall"]),
            capability("registry-runtime", "Registry and Policy Runtime", "embedded", "Manifest registry, install policy resolution, runtime probing, and state tracking.", &["InstallEngine", "SoftwareRegistry", "resolve_install_policy"]),
        ],
        _ => Vec::new(),
    }
}

fn capability(
    key: &str,
    label: &str,
    kind: &str,
    description: &str,
    entrypoints: &[&str],
) -> DesktopComponentCapabilityInfo {
    DesktopComponentCapabilityInfo {
        key: key.to_string(),
        label: label.to_string(),
        kind: kind.to_string(),
        description: description.to_string(),
        entrypoints: entrypoints.iter().map(|entry| entry.to_string()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::{ComponentControlAction, ComponentHostService};
    use crate::framework::paths::resolve_paths_for_root;
    use crate::framework::services::supervisor::SupervisorService;

    #[test]
    fn component_host_catalog_exposes_router_endpoints_and_docs() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::new();
        supervisor.record_running("codex", Some(41)).expect("codex running");
        supervisor
            .record_running("sdkwork_api_router_gateway", Some(42))
            .expect("router gateway running");
        supervisor
            .record_running("sdkwork_api_router_admin_api", Some(43))
            .expect("router admin running");
        supervisor
            .record_running("sdkwork_api_router_portal_api", Some(44))
            .expect("router portal running");
        supervisor
            .record_running("sdkwork_api_router_web_server", Some(45))
            .expect("router web running");

        let catalog = ComponentHostService::new()
            .component_catalog(&paths, &supervisor)
            .expect("component catalog");

        assert_eq!(
            catalog.default_startup_component_ids,
            vec!["codex".to_string(), "sdkwork-api-router".to_string()]
        );
        let codex = catalog
            .components
            .iter()
            .find(|component| component.id == "codex")
            .expect("codex component");
        assert_eq!(codex.runtime_status, "running");
        assert!(
            codex
                .endpoints
                .iter()
                .any(|endpoint| endpoint.target == "ws://127.0.0.1:46110")
        );
        let router = catalog
            .components
            .iter()
            .find(|component| component.id == "sdkwork-api-router")
            .expect("router component");
        assert_eq!(router.runtime_status, "running");
        assert_eq!(router.service_ids.len(), 4);
        assert!(
            router
                .docs
                .iter()
                .any(|doc| doc.label == "Gateway API" && doc.location.contains("gateway-api.md"))
        );
    }

    #[test]
    fn component_host_control_can_start_and_stop_manual_components() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::new();
        let service = ComponentHostService::new();

        let started = service
            .control_component(&paths, &supervisor, "openclaw", ComponentControlAction::Start)
            .expect("start openclaw");
        let snapshot = supervisor.snapshot().expect("snapshot after start");
        let openclaw = snapshot
            .services
            .iter()
            .find(|managed_service| managed_service.id == "openclaw")
            .expect("openclaw state");

        assert_eq!(started.outcome, "started");
        assert_eq!(openclaw.lifecycle, crate::framework::services::supervisor::ManagedServiceLifecycle::Starting);

        let stopped = service
            .control_component(&paths, &supervisor, "openclaw", ComponentControlAction::Stop)
            .expect("stop openclaw");
        let snapshot = supervisor.snapshot().expect("snapshot after stop");
        let openclaw = snapshot
            .services
            .iter()
            .find(|managed_service| managed_service.id == "openclaw")
            .expect("openclaw state");

        assert_eq!(stopped.outcome, "stopped");
        assert_eq!(openclaw.lifecycle, crate::framework::services::supervisor::ManagedServiceLifecycle::Stopped);
    }
}
