use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use sdkwork_claw_host_core::host_endpoints::{
    HostEndpointRecord, OpenClawGatewayProjection, OpenClawRuntimeProjection,
};
use sdkwork_claw_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};
use sdkwork_claw_host_core::openclaw_control_plane::OpenClawGatewayInvokeRequest;
use serde_json::Value;

use crate::{
    bootstrap::ServerState,
    http::{auth::authorize_manage_request, error_response::categorized_error_response},
};

pub fn manage_openclaw_routes() -> Router<ServerState> {
    Router::new()
        .route("/host-endpoints", get(list_host_endpoints))
        .route("/openclaw/runtime", get(get_openclaw_runtime))
        .route("/openclaw/gateway", get(get_openclaw_gateway))
        .route("/openclaw/gateway/invoke", post(invoke_openclaw_gateway))
}

async fn list_host_endpoints(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<HostEndpointRecord>>, Response> {
    authorize_manage_request(&headers, &state)?;
    Ok(Json(state.openclaw_control_plane.list_host_endpoints()))
}

async fn get_openclaw_runtime(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<OpenClawRuntimeProjection>, Response> {
    authorize_manage_request(&headers, &state)?;
    Ok(Json(
        state
            .openclaw_control_plane
            .get_runtime(state.host_platform_updated_at()),
    ))
}

async fn get_openclaw_gateway(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<OpenClawGatewayProjection>, Response> {
    authorize_manage_request(&headers, &state)?;
    Ok(Json(
        state
            .openclaw_control_plane
            .get_gateway(state.host_platform_updated_at()),
    ))
}

async fn invoke_openclaw_gateway(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(request): Json<OpenClawGatewayInvokeRequest>,
) -> Result<Json<Value>, Response> {
    authorize_manage_request(&headers, &state)?;
    state
        .openclaw_control_plane
        .invoke_gateway(request, state.host_platform_updated_at())
        .map(Json)
        .map_err(|_error| {
            categorized_error_response(
                "openclaw_gateway_unavailable",
                InternalErrorCategory::Dependency,
                "The managed OpenClaw gateway is not available for this host shell.",
                StatusCode::SERVICE_UNAVAILABLE,
                true,
                InternalErrorResolution::WaitAndRetry,
                state.host_platform_updated_at(),
            )
        })
}
