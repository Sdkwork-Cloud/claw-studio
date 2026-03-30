use crate::{
    framework::{
        services::provider_client_setup::{ProviderClientSetupRequest, ProviderClientSetupResult},
        Result as FrameworkResult,
    },
    state::AppState,
};

pub fn apply_provider_client_setup_at(
    state: &AppState,
    request: ProviderClientSetupRequest,
) -> FrameworkResult<ProviderClientSetupResult> {
    state
        .context
        .services
        .provider_client_setup
        .install_client_setup(&state.context.paths, request)
}

#[tauri::command]
pub fn apply_provider_client_setup(
    request: ProviderClientSetupRequest,
    state: tauri::State<'_, AppState>,
) -> Result<ProviderClientSetupResult, String> {
    apply_provider_client_setup_at(&state, request).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::apply_provider_client_setup_at;
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root, services::provider_client_setup::*,
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
        let state = AppState::from_context(context);
        let request = ProviderClientSetupRequest {
            client_id: ProviderClientSetupClientId::Openclaw,
            provider: ProviderClientSetupProvider {
                id: "provider-openai-1".to_string(),
                channel_id: "openai".to_string(),
                name: "Global API Router".to_string(),
                base_url: "https://api-router.example.com/v1".to_string(),
                api_key: "sk-router-live-secret".to_string(),
                compatibility: ProviderClientSetupCompatibility::Openai,
                models: vec![ProviderClientSetupModel {
                    id: "gpt-4.1-mini".to_string(),
                    name: "GPT-4.1 Mini".to_string(),
                }],
            },
            install_mode: None,
            env_scope: None,
            open_claw: Some(ProviderClientSetupOpenClawOptions {
                instance_ids: vec!["local-built-in".to_string()],
                api_key_strategy: None,
                route_provider_id: None,
                model_mapping_id: None,
            }),
        };

        let result = apply_provider_client_setup_at(&state, request).expect("install result");

        assert_eq!(result.updated_instance_ids, vec!["local-built-in"]);
        assert_eq!(result.written_files.len(), 1);
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

