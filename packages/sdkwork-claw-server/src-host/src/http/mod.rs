pub mod auth;
pub mod cors_policy;
pub mod error_response;
pub mod router;
pub mod routes {
    pub mod api_public;
    pub mod health;
    pub mod internal_node_sessions;
    pub mod manage_openclaw;
    pub mod manage_rollouts;
    pub mod manage_service;
    pub mod openapi;
}
pub mod static_assets;
