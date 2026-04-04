use axum::Router;

use crate::bootstrap::ServerState;
use crate::http::routes::api_public::api_public_routes;
use crate::http::routes::health::health_routes;
use crate::http::routes::internal_node_sessions::internal_node_session_routes;
use crate::http::routes::manage_openclaw::manage_openclaw_routes;
use crate::http::routes::manage_rollouts::manage_rollout_routes;
use crate::http::routes::manage_service::manage_service_routes;
use crate::http::routes::openapi::openapi_routes;
use crate::http::static_assets::StaticAssetMount;

pub fn build_router(state: ServerState) -> Router {
    let assets = StaticAssetMount::from_web_dist(state.web_dist_dir.clone());
    let manage_router = if state.supports_manage_service_api() {
        manage_rollout_routes()
            .merge(manage_service_routes())
            .merge(manage_openclaw_routes())
    } else {
        manage_rollout_routes().merge(manage_openclaw_routes())
    };
    let router = Router::new()
        .nest("/claw/health", health_routes())
        .nest("/claw/api/v1", api_public_routes())
        .nest("/claw/openapi", openapi_routes())
        .nest("/claw/internal/v1", internal_node_session_routes())
        .nest("/claw/manage/v1", manage_router);

    assets.attach(router).with_state(state)
}
