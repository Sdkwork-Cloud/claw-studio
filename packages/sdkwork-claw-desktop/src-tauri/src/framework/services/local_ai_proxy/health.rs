use super::{
    is_loopback_host,
    observability_store::{
        lock_observability, LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState,
    },
    request_context,
    support::proxy_error,
    types::{
        LocalAiProxyAppState, LocalAiProxyDefaultRouteHealth, LocalAiProxyRouteRuntimeMetrics,
        LocalAiProxyRouteTestRecord, LocalAiProxyServiceHealth, ProxyHttpResult,
    },
    LocalAiProxyRouteSnapshot, ANTHROPIC_CLIENT_PROTOCOL, GEMINI_CLIENT_PROTOCOL,
    LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
};
use crate::framework::{paths::AppPaths, Result};
use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
};

pub(super) fn reconcile_observability_store(
    store: &mut LocalAiProxyObservabilityStore,
    snapshot: &super::LocalAiProxySnapshot,
) {
    let route_ids = snapshot
        .routes
        .iter()
        .map(|route| route.id.clone())
        .collect::<HashSet<_>>();
    store
        .route_metrics
        .retain(|route_id, _| route_ids.contains(route_id));
    store
        .route_tests
        .retain(|route_id, _| route_ids.contains(route_id));

    for route in &snapshot.routes {
        let entry = store
            .route_metrics
            .entry(route.id.clone())
            .or_insert_with(|| LocalAiProxyRouteMetricsState {
                client_protocol: route.client_protocol.clone(),
                upstream_protocol: route.upstream_protocol.clone(),
                ..Default::default()
            });
        entry.client_protocol = route.client_protocol.clone();
        entry.upstream_protocol = route.upstream_protocol.clone();
    }
}

pub(super) fn build_route_metrics(
    snapshot: &super::LocalAiProxySnapshot,
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
) -> Result<Vec<LocalAiProxyRouteRuntimeMetrics>> {
    let store = lock_observability(observability)?;
    let mut metrics = snapshot
        .routes
        .iter()
        .map(|route| {
            let route_state = store.route_metrics.get(&route.id);
            let latest_test = store.route_tests.get(&route.id);
            LocalAiProxyRouteRuntimeMetrics {
                route_id: route.id.clone(),
                client_protocol: route.client_protocol.clone(),
                upstream_protocol: route.upstream_protocol.clone(),
                health: derive_route_health(route, route_state, latest_test).to_string(),
                request_count: route_state.map(|value| value.request_count).unwrap_or(0),
                success_count: route_state.map(|value| value.success_count).unwrap_or(0),
                failure_count: route_state.map(|value| value.failure_count).unwrap_or(0),
                rpm: route_state
                    .map(|value| value.recent_request_timestamps_ms.len() as u64)
                    .unwrap_or(0),
                total_tokens: route_state.map(|value| value.total_tokens).unwrap_or(0),
                input_tokens: route_state.map(|value| value.input_tokens).unwrap_or(0),
                output_tokens: route_state.map(|value| value.output_tokens).unwrap_or(0),
                cache_tokens: route_state.map(|value| value.cache_tokens).unwrap_or(0),
                average_latency_ms: route_state
                    .filter(|value| value.request_count > 0)
                    .map(|value| value.cumulative_latency_ms / value.request_count)
                    .unwrap_or(0),
                last_latency_ms: route_state.and_then(|value| value.last_latency_ms),
                last_used_at: route_state.and_then(|value| value.last_used_at),
                last_error: route_state.and_then(|value| value.last_error.clone()),
            }
        })
        .collect::<Vec<_>>();
    metrics.sort_by(|left, right| left.route_id.cmp(&right.route_id));
    Ok(metrics)
}

pub(super) fn collect_route_tests(
    snapshot: &super::LocalAiProxySnapshot,
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
) -> Result<Vec<LocalAiProxyRouteTestRecord>> {
    let store = lock_observability(observability)?;
    let valid_route_ids = snapshot
        .routes
        .iter()
        .map(|route| route.id.as_str())
        .collect::<HashSet<_>>();
    let mut tests = store
        .route_tests
        .values()
        .filter(|record| valid_route_ids.contains(record.route_id.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    tests.sort_by(|left, right| left.route_id.cmp(&right.route_id));
    Ok(tests)
}

pub(super) async fn health_handler(
    State(state): State<LocalAiProxyAppState>,
) -> ProxyHttpResult<Json<Value>> {
    let snapshot = request_context::current_snapshot(&state)?;
    let route = snapshot.default_route().ok_or_else(|| {
        proxy_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "No active default route is available for the local AI proxy.",
        )
    })?;
    let default_routes = collect_default_route_health(&snapshot);

    Ok(Json(json!({
        "status": "ok",
        "service": "local-ai-proxy",
        "defaultRouteId": route.id,
        "defaultRouteName": route.name,
        "modelCount": route.models.len(),
        "upstreamBaseUrl": route.upstream_base_url,
        "defaultRoutes": default_routes.iter().map(|item| json!({
            "clientProtocol": item.client_protocol,
            "id": item.id,
            "name": item.name,
            "managedBy": item.managed_by,
            "upstreamProtocol": item.upstream_protocol,
            "upstreamBaseUrl": item.upstream_base_url,
            "modelCount": item.model_count,
        })).collect::<Vec<_>>(),
    })))
}

pub(super) fn build_health(
    snapshot: &super::LocalAiProxySnapshot,
    active_port: u16,
    public_base_host: &str,
    paths: &AppPaths,
) -> LocalAiProxyServiceHealth {
    let default_routes = collect_default_route_health(snapshot);
    let route = snapshot
        .default_route()
        .cloned()
        .unwrap_or_else(|| LocalAiProxyRouteSnapshot {
            id: snapshot.default_route_id.clone(),
            name: "Unavailable".to_string(),
            enabled: false,
            is_default: true,
            managed_by: "system-default".to_string(),
            client_protocol: LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL.to_string(),
            upstream_protocol: "sdkwork".to_string(),
            provider_id: "sdkwork".to_string(),
            upstream_base_url: String::new(),
            api_key: String::new(),
            default_model_id: String::new(),
            reasoning_model_id: None,
            embedding_model_id: None,
            models: Vec::new(),
            notes: None,
            expose_to: Vec::new(),
            runtime_config: Default::default(),
        });

    LocalAiProxyServiceHealth {
        base_url: format!("http://{}:{}/v1", public_base_host.trim(), active_port),
        active_port,
        loopback_only: is_loopback_host(snapshot.bind_host.trim()),
        default_route_id: route.id,
        default_route_name: route.name,
        default_routes,
        upstream_base_url: route.upstream_base_url,
        model_count: route.models.len(),
        snapshot_path: paths
            .local_ai_proxy_snapshot_file
            .to_string_lossy()
            .into_owned(),
        log_path: paths.local_ai_proxy_log_file.to_string_lossy().into_owned(),
    }
}

fn derive_route_health(
    route: &LocalAiProxyRouteSnapshot,
    route_state: Option<&LocalAiProxyRouteMetricsState>,
    latest_test: Option<&LocalAiProxyRouteTestRecord>,
) -> &'static str {
    if !route.enabled {
        return "disabled";
    }
    if latest_test
        .map(|value| value.status.as_str() == "failed")
        .unwrap_or(false)
    {
        return "failed";
    }
    if let Some(value) = route_state {
        if value.failure_count > 0 && value.success_count == 0 {
            return "failed";
        }
        if value.failure_count > 0 {
            return "degraded";
        }
        if value.success_count > 0 {
            return "healthy";
        }
    }
    if latest_test
        .map(|value| value.status.as_str() == "passed")
        .unwrap_or(false)
    {
        return "healthy";
    }

    "degraded"
}

fn collect_default_route_health(
    snapshot: &super::LocalAiProxySnapshot,
) -> Vec<LocalAiProxyDefaultRouteHealth> {
    [
        LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
        ANTHROPIC_CLIENT_PROTOCOL,
        GEMINI_CLIENT_PROTOCOL,
    ]
    .iter()
    .filter_map(|client_protocol| {
        snapshot
            .route_for_client_protocol(client_protocol)
            .map(|route| LocalAiProxyDefaultRouteHealth {
                client_protocol: route.client_protocol.clone(),
                id: route.id.clone(),
                name: route.name.clone(),
                managed_by: route.managed_by.clone(),
                upstream_protocol: route.upstream_protocol.clone(),
                upstream_base_url: route.upstream_base_url.clone(),
                model_count: route.models.len(),
            })
    })
    .collect()
}
