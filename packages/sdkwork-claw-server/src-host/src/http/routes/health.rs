use axum::{
    Router,
    http::StatusCode,
    routing::get,
};

use crate::bootstrap::ServerState;

pub fn health_routes() -> Router<ServerState> {
    Router::new()
        .route("/live", get(live))
        .route("/ready", get(ready))
}

async fn live() -> StatusCode {
    StatusCode::OK
}

async fn ready() -> StatusCode {
    StatusCode::OK
}
