use axum::{
    body::Body,
    http::{
        header::{self, HeaderValue},
        Request, StatusCode,
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    Router,
};

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

    assets
        .attach(router)
        .with_state(state)
        .layer(middleware::from_fn(host_control_plane_cors))
}

async fn host_control_plane_cors(request: Request<Body>, next: Next) -> Response {
    let is_claw_route = request.uri().path().starts_with("/claw/");
    let origin = request.headers().get(header::ORIGIN).cloned();
    let is_preflight = is_claw_route
        && request.method() == axum::http::Method::OPTIONS
        && origin.is_some()
        && request
            .headers()
            .contains_key(header::ACCESS_CONTROL_REQUEST_METHOD);

    if is_preflight {
        let mut response = StatusCode::NO_CONTENT.into_response();
        append_cors_headers(response.headers_mut(), origin.as_ref());
        return response;
    }

    let mut response = next.run(request).await;
    if is_claw_route && origin.is_some() {
        append_cors_headers(response.headers_mut(), origin.as_ref());
    }
    response
}

fn append_cors_headers(
    headers: &mut axum::http::HeaderMap,
    origin: Option<&HeaderValue>,
) {
    let Some(origin) = origin else {
        return;
    };

    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static(
            "authorization, content-type, accept, x-claw-browser-session",
        ),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("www-authenticate, x-claw-correlation-id"),
    );
    headers.insert(
        header::VARY,
        HeaderValue::from_static("Origin, Access-Control-Request-Method, Access-Control-Request-Headers"),
    );
}
