use crate::{
    framework::services::api_router_runtime::{ApiRouterAdminToken, ApiRouterDesktopAuthSession},
    state::AppState,
};

pub fn sync_auth_session_at(
    state: &AppState,
    session: ApiRouterDesktopAuthSession,
) -> Result<(), String> {
    state
        .context
        .services
        .api_router_runtime
        .sync_auth_session(session)
        .map_err(|error| error.to_string())
}

pub fn clear_auth_session_at(state: &AppState) -> Result<(), String> {
    state
        .context
        .services
        .api_router_runtime
        .clear_auth_session()
        .map_err(|error| error.to_string())
}

pub fn get_api_router_admin_token_at(state: &AppState) -> Result<ApiRouterAdminToken, String> {
    state
        .context
        .services
        .api_router_runtime
        .issue_admin_token()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn sync_auth_session(
    session: ApiRouterDesktopAuthSession,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    sync_auth_session_at(&state, session)
}

#[tauri::command]
pub fn clear_auth_session(state: tauri::State<'_, AppState>) -> Result<(), String> {
    clear_auth_session_at(&state)
}

#[tauri::command]
pub fn get_api_router_admin_token(
    state: tauri::State<'_, AppState>,
) -> Result<ApiRouterAdminToken, String> {
    get_api_router_admin_token_at(&state)
}

#[cfg(test)]
mod tests {
    use super::{
        clear_auth_session_at, get_api_router_admin_token_at, sync_auth_session_at,
    };
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
        state::AppState,
    };
    use std::sync::Arc;

    #[test]
    fn admin_token_requires_a_synced_desktop_session() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths,
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let error = get_api_router_admin_token_at(&state).expect_err("token should require session");

        assert!(error.contains("desktop auth session"));
    }

    #[test]
    fn synced_session_can_issue_and_clear_router_admin_tokens() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths,
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        sync_auth_session_at(
            &state,
            crate::framework::services::api_router_runtime::ApiRouterDesktopAuthSession {
                user_id: "user-123".to_string(),
                email: "operator@example.com".to_string(),
                display_name: "Operator".to_string(),
            },
        )
        .expect("sync session");

        let token = get_api_router_admin_token_at(&state).expect("admin token");
        assert!(!token.token.is_empty());
        assert_eq!(token.subject, "user-123");
        assert!(token.expires_at_epoch_seconds > 0);

        clear_auth_session_at(&state).expect("clear session");
        let error = get_api_router_admin_token_at(&state).expect_err("token should be cleared");
        assert!(error.contains("desktop auth session"));
    }
}
