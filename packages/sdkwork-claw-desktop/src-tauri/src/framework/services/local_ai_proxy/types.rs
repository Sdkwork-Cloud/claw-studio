use super::observability_store::LocalAiProxyObservabilityStore;
use crate::framework::services::{
    local_ai_proxy_observability::LocalAiProxyObservabilityRepository,
    local_ai_proxy_snapshot::LocalAiProxySnapshot,
};
use axum::{http::StatusCode, Json};
use serde_json::Value;
use std::{
    result::Result as StdResult,
    sync::{Arc, Mutex},
};

pub(super) type ProxyHttpResult<T> = StdResult<T, (StatusCode, Json<Value>)>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LocalAiProxyLifecycle {
    Running,
    Stopped,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LocalAiProxyDefaultRouteHealth {
    pub client_protocol: String,
    pub id: String,
    pub name: String,
    pub managed_by: String,
    pub upstream_protocol: String,
    pub upstream_base_url: String,
    pub model_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LocalAiProxyServiceHealth {
    pub base_url: String,
    pub active_port: u16,
    pub loopback_only: bool,
    pub default_route_id: String,
    pub default_route_name: String,
    pub default_routes: Vec<LocalAiProxyDefaultRouteHealth>,
    pub upstream_base_url: String,
    pub model_count: usize,
    pub snapshot_path: String,
    pub log_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LocalAiProxyServiceStatus {
    pub lifecycle: LocalAiProxyLifecycle,
    pub health: Option<LocalAiProxyServiceHealth>,
    pub route_metrics: Vec<LocalAiProxyRouteRuntimeMetrics>,
    pub route_tests: Vec<LocalAiProxyRouteTestRecord>,
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LocalAiProxyRouteRuntimeMetrics {
    pub route_id: String,
    pub client_protocol: String,
    pub upstream_protocol: String,
    pub health: String,
    pub request_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub rpm: u64,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_tokens: u64,
    pub average_latency_ms: u64,
    pub last_latency_ms: Option<u64>,
    pub last_used_at: Option<u64>,
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LocalAiProxyRouteTestRecord {
    pub route_id: String,
    pub status: String,
    pub tested_at: u64,
    pub latency_ms: Option<u64>,
    pub checked_capability: String,
    pub model_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(super) struct LocalAiProxyTokenUsage {
    pub(super) total_tokens: u64,
    pub(super) input_tokens: u64,
    pub(super) output_tokens: u64,
    pub(super) cache_tokens: u64,
}

#[derive(Clone)]
pub(super) struct LocalAiProxyAppState {
    pub(super) client: reqwest::Client,
    pub(super) snapshot: Arc<Mutex<LocalAiProxySnapshot>>,
    pub(super) observability: Arc<Mutex<LocalAiProxyObservabilityStore>>,
    pub(super) observability_repo: LocalAiProxyObservabilityRepository,
}
