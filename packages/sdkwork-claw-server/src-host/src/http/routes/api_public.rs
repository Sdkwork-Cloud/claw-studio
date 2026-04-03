use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde::Serialize;

use crate::bootstrap::ServerState;

pub fn api_public_routes() -> Router<ServerState> {
    Router::new().route("/discovery", get(get_public_api_discovery))
}

async fn get_public_api_discovery(
    State(state): State<ServerState>,
) -> Json<PublicApiDiscoveryRecord> {
    Json(PublicApiDiscoveryRecord {
        family: "api".to_string(),
        version: "v1".to_string(),
        base_path: "/claw/api/v1".to_string(),
        host_mode: state.mode.to_string(),
        host_version: state.host_platform_version(),
        openapi_document_url: "/claw/openapi/v1.json".to_string(),
        health_live_url: "/claw/health/live".to_string(),
        health_ready_url: "/claw/health/ready".to_string(),
        capability_keys: vec!["api.discovery.read".to_string()],
        generated_at: state.host_platform_updated_at(),
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicApiDiscoveryRecord {
    family: String,
    version: String,
    base_path: String,
    host_mode: String,
    host_version: String,
    openapi_document_url: String,
    health_live_url: String,
    health_ready_url: String,
    capability_keys: Vec<String>,
    generated_at: u64,
}
