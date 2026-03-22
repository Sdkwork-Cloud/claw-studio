use crate::{
    framework::{
        services::api_router::{
            ApiRouterClientInstallRequest, ApiRouterClientInstallResult,
            ApiRouterInstallerClientId,
        },
        Result as FrameworkResult,
    },
    state::AppState,
};

pub fn install_api_router_client_setup_at(
    state: &AppState,
    request: ApiRouterClientInstallRequest,
) -> FrameworkResult<ApiRouterClientInstallResult> {
    if request.client_id == ApiRouterInstallerClientId::Openclaw {
        let open_claw = request.open_claw.clone().ok_or_else(|| {
            crate::framework::FrameworkError::ValidationFailed(
                "OpenClaw installation requires instance selections".to_string(),
            )
        })?;
        let open_claw_instances = state
            .context
            .services
            .api_router_control
            .provision_openclaw_instances(&open_claw)?;

        return state
            .context
            .services
            .api_router
            .install_openclaw_instances(&state.context.paths, request, open_claw_instances);
    }

    state
        .context
        .services
        .api_router
        .install_client_setup(&state.context.paths, request)
}

#[tauri::command]
pub fn install_api_router_client_setup(
    request: ApiRouterClientInstallRequest,
    state: tauri::State<'_, AppState>,
) -> Result<ApiRouterClientInstallResult, String> {
    install_api_router_client_setup_at(&state, request).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::install_api_router_client_setup_at;
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
            services::{
                api_router::*,
                api_router_runtime::ApiRouterDesktopAuthSession,
            },
        },
        state::AppState,
    };
    use std::sync::Arc;

    #[test]
    fn install_command_routes_openclaw_requests_through_framework_services() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        context
            .services
            .api_router_runtime
            .sync_auth_session(ApiRouterDesktopAuthSession {
                user_id: "user-openclaw".to_string(),
                email: "openclaw@example.com".to_string(),
                display_name: "OpenClaw".to_string(),
            })
            .expect("auth session");
        let state = AppState::from_context(context);
        let request = ApiRouterClientInstallRequest {
            client_id: ApiRouterInstallerClientId::Openclaw,
            provider: ApiRouterInstallerProvider {
                id: "provider-openai-1".to_string(),
                channel_id: "openai".to_string(),
                name: "Global API Router".to_string(),
                base_url: "https://api-router.example.com/v1".to_string(),
                api_key: "sk-router-live-secret".to_string(),
                compatibility: ApiRouterInstallerCompatibility::Openai,
                models: vec![ApiRouterInstallerModel {
                    id: "gpt-4.1-mini".to_string(),
                    name: "GPT-4.1 Mini".to_string(),
                }],
            },
            install_mode: None,
            env_scope: None,
            open_claw: Some(ApiRouterInstallerOpenClawOptions {
                instance_ids: vec!["local-built-in".to_string()],
                api_key_strategy: ApiRouterInstallerOpenClawApiKeyStrategy::PerInstance,
                router_provider_id: None,
                model_mapping_id: None,
            }),
        };

        let result = install_api_router_client_setup_at(&state, request).expect("install result");

        assert_eq!(result.updated_instance_ids, vec!["local-built-in"]);
        assert_eq!(result.written_files.len(), 1);
        assert_eq!(result.open_claw_instances.len(), 1);
        assert!(paths
            .integrations_dir
            .join("openclaw")
            .join("instances")
            .join("local-built-in")
            .join("providers")
            .join("provider-api-router-provider-openai-1.json")
            .exists());
    }
}
