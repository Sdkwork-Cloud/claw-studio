use super::types::LocalAiProxyRouteTestRecord;
use crate::framework::{FrameworkError, Result};
use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex, MutexGuard},
};

#[derive(Clone, Debug, Default)]
pub(super) struct LocalAiProxyObservabilityStore {
    pub(super) route_metrics: HashMap<String, LocalAiProxyRouteMetricsState>,
    pub(super) route_tests: HashMap<String, LocalAiProxyRouteTestRecord>,
}

#[derive(Clone, Debug, Default)]
pub(super) struct LocalAiProxyRouteMetricsState {
    pub(super) client_protocol: String,
    pub(super) upstream_protocol: String,
    pub(super) request_count: u64,
    pub(super) success_count: u64,
    pub(super) failure_count: u64,
    pub(super) total_tokens: u64,
    pub(super) input_tokens: u64,
    pub(super) output_tokens: u64,
    pub(super) cache_tokens: u64,
    pub(super) cumulative_latency_ms: u64,
    pub(super) last_latency_ms: Option<u64>,
    pub(super) last_used_at: Option<u64>,
    pub(super) last_error: Option<String>,
    pub(super) recent_request_timestamps_ms: VecDeque<u64>,
}

pub(super) fn lock_observability(
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
) -> Result<MutexGuard<'_, LocalAiProxyObservabilityStore>> {
    observability.lock().map_err(|_| {
        FrameworkError::Internal("local ai proxy observability lock poisoned".to_string())
    })
}
