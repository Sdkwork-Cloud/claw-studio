use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use sdkwork_claw_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};

use crate::{
    bootstrap::ServerState,
    http::{auth::authorize_manage_request, error_response::categorized_error_response},
    service::{
        execute_server_service_action, ServerServiceExecutionResult, ServerServiceLifecycleAction,
    },
};

pub fn manage_service_routes() -> Router<ServerState> {
    Router::new()
        .route("/service", get(get_service_status))
        .route("/service:install", post(install_service))
        .route("/service:start", post(start_service))
        .route("/service:stop", post(stop_service))
        .route("/service:restart", post(restart_service))
}

async fn get_service_status(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<ServerServiceExecutionResult>, Response> {
    authorize_manage_request(&headers, &state)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Status)
}

async fn install_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<ServerServiceExecutionResult>, Response> {
    authorize_manage_request(&headers, &state)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Install)
}

async fn start_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<ServerServiceExecutionResult>, Response> {
    authorize_manage_request(&headers, &state)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Start)
}

async fn stop_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<ServerServiceExecutionResult>, Response> {
    authorize_manage_request(&headers, &state)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Stop)
}

async fn restart_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<ServerServiceExecutionResult>, Response> {
    authorize_manage_request(&headers, &state)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Restart)
}

fn execute_service_action(
    state: &ServerState,
    action: ServerServiceLifecycleAction,
) -> Result<Json<ServerServiceExecutionResult>, Response> {
    execute_server_service_action(
        &state.service_control_plane,
        &state.runtime_contract,
        action,
    )
    .map(Json)
    .map_err(|_error| {
        categorized_error_response(
            "service_lifecycle_failed",
            InternalErrorCategory::System,
            "The native service control plane could not complete the requested action.",
            StatusCode::INTERNAL_SERVER_ERROR,
            false,
            InternalErrorResolution::OperatorAction,
            state.host_platform_updated_at(),
        )
    })
}
