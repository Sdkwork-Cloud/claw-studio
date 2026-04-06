use axum::{extract::State, http::StatusCode, routing::get, Router};

use crate::bootstrap::ServerState;

pub fn health_routes() -> Router<ServerState> {
    Router::new()
        .route("/live", get(live))
        .route("/ready", get(ready))
}

async fn live() -> StatusCode {
    StatusCode::OK
}

fn runtime_projection_is_ready(
    lifecycle: &str,
    base_url: Option<&str>,
    websocket_url: Option<&str>,
    active_port: Option<u16>,
) -> bool {
    lifecycle == "ready"
        && (base_url.is_some() || websocket_url.is_some() || active_port.is_some())
}

async fn ready(State(state): State<ServerState>) -> StatusCode {
    let updated_at = state.host_platform_updated_at();
    let runtime_ready = state
        .manage_openclaw_provider
        .get_runtime(updated_at)
        .ok()
        .is_some_and(|projection| {
            runtime_projection_is_ready(
                projection.lifecycle.as_str(),
                projection.base_url.as_deref(),
                projection.websocket_url.as_deref(),
                projection.active_port,
            )
        });
    let gateway_ready = state
        .manage_openclaw_provider
        .get_gateway(updated_at)
        .ok()
        .is_some_and(|projection| {
            runtime_projection_is_ready(
                projection.lifecycle.as_str(),
                projection.base_url.as_deref(),
                projection.websocket_url.as_deref(),
                projection.active_port,
            )
        });

    if runtime_ready && gateway_ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}
