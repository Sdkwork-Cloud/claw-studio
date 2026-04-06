use super::{
    local_ai_proxy_observability::{
        LocalAiProxyLoggedMessage, LocalAiProxyMessageCaptureSettings,
        LocalAiProxyMessageLogRecord, LocalAiProxyMessageLogsQuery,
        LocalAiProxyObservabilityRepository, LocalAiProxyPaginatedResult,
        LocalAiProxyRequestLogInsert, LocalAiProxyRequestLogRecord, LocalAiProxyRequestLogsQuery,
    },
    local_ai_proxy_snapshot::{
        write_local_ai_proxy_snapshot, LocalAiProxyRouteSnapshot, LocalAiProxySnapshot,
        LOCAL_AI_PROXY_DEFAULT_BIND_HOST, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
        LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL, LOCAL_AI_PROXY_DEFAULT_PORT,
    },
    storage::StorageService,
};
use crate::framework::{config::AppConfig, paths::AppPaths, FrameworkError, Result};
use axum::{
    body::{Body, Bytes},
    extract::{OriginalUri, Path as AxumPath, State},
    http::{
        header::{AUTHORIZATION, CONTENT_TYPE},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs,
    net::{IpAddr, ToSocketAddrs},
    path::Path,
    result::Result as StdResult,
    sync::{mpsc, Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::oneshot;
use uuid::Uuid;

pub const SERVICE_ID_LOCAL_AI_PROXY: &str = "local_ai_proxy";
const LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION: u32 = 1;
const OPENCLAW_LOCAL_PROXY_PROVIDER_ID: &str = "sdkwork-local-proxy";
const OPENCLAW_LOCAL_PROXY_PROVIDER_OPENAI_API: &str = "openai-completions";
const OPENCLAW_LOCAL_PROXY_PROVIDER_ANTHROPIC_API: &str = "anthropic-messages";
const OPENCLAW_LOCAL_PROXY_PROVIDER_GEMINI_API: &str = "google-generative-ai";
const OPENCLAW_LOCAL_PROXY_PROVIDER_AUTH: &str = "api-key";
const ANTHROPIC_CLIENT_PROTOCOL: &str = "anthropic";
const GEMINI_CLIENT_PROTOCOL: &str = "gemini";
const ANTHROPIC_VERSION_HEADER: &str = "anthropic-version";
const ANTHROPIC_BETA_HEADER: &str = "anthropic-beta";
const DEFAULT_ANTHROPIC_VERSION: &str = "2023-06-01";
const X_API_KEY_HEADER: &str = "x-api-key";
const X_GOOG_API_KEY_HEADER: &str = "x-goog-api-key";
const LOCAL_AI_PROXY_PUBLIC_BASE_HOST_CANDIDATES: [&str; 3] =
    ["ai.sdkwork.localhost", "localhost", "127.0.0.1"];
type ProxyHttpResult<T> = StdResult<T, (StatusCode, Json<Value>)>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum OpenAiStreamEndpoint {
    ChatCompletions,
    Responses,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct ParsedSseEvent {
    event: Option<String>,
    data: String,
}

#[derive(Debug)]
struct OpenAiTranslatedStreamState {
    endpoint: OpenAiStreamEndpoint,
    stream_id: String,
    model: String,
    accumulated_text: String,
    usage: LocalAiProxyTokenUsage,
    role_sent: bool,
    response_created: bool,
    done_emitted: bool,
    finish_reason: Option<String>,
}

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
struct LocalAiProxyTokenUsage {
    total_tokens: u64,
    input_tokens: u64,
    output_tokens: u64,
    cache_tokens: u64,
}

#[derive(Clone, Debug)]
struct LocalAiProxyRequestAuditContext {
    id: String,
    created_at: u64,
    route_id: String,
    route_name: String,
    provider_id: String,
    client_protocol: String,
    upstream_protocol: String,
    endpoint: String,
    model_id: Option<String>,
    base_url: String,
    request_preview: Option<String>,
    request_body: Option<String>,
    messages: Vec<LocalAiProxyLoggedMessage>,
}

#[derive(Clone, Debug, Default)]
struct LocalAiProxyObservabilityStore {
    route_metrics: HashMap<String, LocalAiProxyRouteMetricsState>,
    route_tests: HashMap<String, LocalAiProxyRouteTestRecord>,
}

#[derive(Clone, Debug, Default)]
struct LocalAiProxyRouteMetricsState {
    client_protocol: String,
    upstream_protocol: String,
    request_count: u64,
    success_count: u64,
    failure_count: u64,
    total_tokens: u64,
    input_tokens: u64,
    output_tokens: u64,
    cache_tokens: u64,
    cumulative_latency_ms: u64,
    last_latency_ms: Option<u64>,
    last_used_at: Option<u64>,
    last_error: Option<String>,
    recent_request_timestamps_ms: VecDeque<u64>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalAiProxyConfigFile {
    schema_version: u32,
    bind_host: String,
    public_base_host: String,
    requested_port: u16,
    client_api_key: String,
}

#[derive(Clone, Debug, Default)]
pub struct LocalAiProxyService {
    runtime: Arc<Mutex<LocalAiProxyRuntime>>,
}

#[derive(Debug)]
struct LocalAiProxyRuntime {
    lifecycle: LocalAiProxyLifecycle,
    health: Option<LocalAiProxyServiceHealth>,
    snapshot: Option<LocalAiProxySnapshot>,
    last_error: Option<String>,
    handle: Option<LocalAiProxyHandle>,
    observability: Arc<Mutex<LocalAiProxyObservabilityStore>>,
    observability_repo: Option<LocalAiProxyObservabilityRepository>,
}

#[derive(Debug)]
struct LocalAiProxyHandle {
    shutdown: Option<oneshot::Sender<()>>,
    join_handle: Option<std::thread::JoinHandle<()>>,
}

#[derive(Clone)]
struct LocalAiProxyAppState {
    client: reqwest::Client,
    snapshot: Arc<Mutex<LocalAiProxySnapshot>>,
    observability: Arc<Mutex<LocalAiProxyObservabilityStore>>,
    observability_repo: LocalAiProxyObservabilityRepository,
}

impl Default for LocalAiProxyRuntime {
    fn default() -> Self {
        Self {
            lifecycle: LocalAiProxyLifecycle::Stopped,
            health: None,
            snapshot: None,
            last_error: None,
            handle: None,
            observability: Arc::new(Mutex::new(LocalAiProxyObservabilityStore::default())),
            observability_repo: None,
        }
    }
}

impl LocalAiProxyService {
    pub fn new() -> Self {
        Self {
            runtime: Arc::new(Mutex::new(LocalAiProxyRuntime::default())),
        }
    }

    pub fn ensure_snapshot(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
    ) -> Result<LocalAiProxySnapshot> {
        let _ = self.ensure_observability_repo(paths)?;
        let proxy_config = ensure_local_ai_proxy_config(paths)?;
        fs::write(
            &paths.local_ai_proxy_token_file,
            format!("{}\n", proxy_config.client_api_key),
        )?;
        let mut snapshot = super::local_ai_proxy_snapshot::materialize_local_ai_proxy_snapshot(
            paths,
            config,
            storage,
            proxy_config.requested_port,
            proxy_config.client_api_key.clone(),
        );
        snapshot.bind_host = proxy_config.bind_host.clone();
        write_local_ai_proxy_snapshot(&paths.local_ai_proxy_snapshot_file, &snapshot)?;
        let mut runtime = self.lock_runtime()?;
        runtime.snapshot = Some(snapshot.clone());
        runtime.last_error = None;
        let mut store = lock_observability(&runtime.observability)?;
        reconcile_observability_store(&mut store, &snapshot);
        Ok(snapshot)
    }

    pub fn start(
        &self,
        paths: &AppPaths,
        snapshot: LocalAiProxySnapshot,
    ) -> Result<LocalAiProxyServiceHealth> {
        let _ = self.stop();
        let failed_snapshot = snapshot.clone();
        let start_result = (|| -> Result<LocalAiProxyServiceHealth> {
            let observability_repo = self.ensure_observability_repo(paths)?;
            let proxy_config = ensure_local_ai_proxy_config(paths)?;
            fs::write(
                &paths.local_ai_proxy_token_file,
                format!("{}\n", snapshot.auth_token),
            )?;
            write_local_ai_proxy_snapshot(&paths.local_ai_proxy_snapshot_file, &snapshot)?;
            if let Some(parent) = paths.local_ai_proxy_log_file.parent() {
                fs::create_dir_all(parent)?;
            }
            let observability = {
                let runtime = self.lock_runtime()?;
                runtime.observability.clone()
            };
            {
                let mut store = lock_observability(&observability)?;
                reconcile_observability_store(&mut store, &snapshot);
            }
            let state = LocalAiProxyAppState {
                client: reqwest::Client::new(),
                snapshot: Arc::new(Mutex::new(snapshot.clone())),
                observability,
                observability_repo,
            };
            let bind_host = snapshot.bind_host.clone();
            let requested_port = snapshot.requested_port;
            let log_path = paths.local_ai_proxy_log_file.clone();
            let (ready_tx, ready_rx) = mpsc::channel();
            let (shutdown_tx, shutdown_rx) = oneshot::channel();

            let join_handle = thread::spawn(move || {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(error) => {
                        let _ =
                            ready_tx.send(Err(format!("failed to build tokio runtime: {error}")));
                        return;
                    }
                };

                runtime.block_on(async move {
                    let listener = match tokio::net::TcpListener::bind((
                        bind_host.as_str(),
                        requested_port,
                    ))
                    .await
                    {
                        Ok(listener) => listener,
                        Err(error)
                            if requested_port > 0
                                && error.kind() == std::io::ErrorKind::AddrInUse =>
                        {
                            match tokio::net::TcpListener::bind((bind_host.as_str(), 0)).await {
                                Ok(listener) => listener,
                                Err(fallback_error) => {
                                    let _ = ready_tx.send(Err(format!(
                                        "failed to bind local ai proxy on requested port {requested_port} and dynamic fallback: {fallback_error}"
                                    )));
                                    return;
                                }
                            }
                        }
                        Err(error) => {
                            let _ = ready_tx.send(Err(format!(
                                "failed to bind local ai proxy: {error}"
                            )));
                            return;
                        }
                    };
                    let active_port = match listener.local_addr() {
                        Ok(address) => address.port(),
                        Err(error) => {
                            let _ = ready_tx.send(Err(format!(
                                "failed to resolve local ai proxy address: {error}"
                            )));
                            return;
                        }
                    };
                    if ready_tx.send(Ok(active_port)).is_err() {
                        return;
                    }

                    if let Err(error) = axum::serve(listener, build_router(state))
                        .with_graceful_shutdown(async move {
                            let _ = shutdown_rx.await;
                        })
                        .await
                    {
                        let _ = append_proxy_log(
                            &log_path,
                            &format!("local ai proxy serve loop stopped unexpectedly: {error}"),
                        );
                    }
                });
            });

            let active_port = ready_rx
                .recv_timeout(Duration::from_secs(10))
                .map_err(|_| {
                    FrameworkError::Timeout(
                        "timed out waiting for the local ai proxy to bind a loopback port"
                            .to_string(),
                    )
                })?
                .map_err(FrameworkError::Internal)?;
            let health = build_health(
                &snapshot,
                active_port,
                &proxy_config.public_base_host,
                paths,
            );

            let mut runtime = self.lock_runtime()?;
            runtime.lifecycle = LocalAiProxyLifecycle::Running;
            runtime.health = Some(health.clone());
            runtime.snapshot = Some(snapshot);
            runtime.last_error = None;
            runtime.handle = Some(LocalAiProxyHandle {
                shutdown: Some(shutdown_tx),
                join_handle: Some(join_handle),
            });

            Ok(health)
        })();

        if let Err(error) = &start_result {
            let _ = self.record_failed_status(Some(failed_snapshot), &error.to_string());
        }

        start_result
    }

    pub fn stop(&self) -> Result<()> {
        let mut handle = {
            let mut runtime = self.lock_runtime()?;
            runtime.lifecycle = LocalAiProxyLifecycle::Stopped;
            runtime.health = None;
            runtime.handle.take()
        };

        if let Some(handle) = handle.as_mut() {
            if let Some(shutdown) = handle.shutdown.take() {
                let _ = shutdown.send(());
            }
            if let Some(join_handle) = handle.join_handle.take() {
                let _ = join_handle.join();
            }
        }

        Ok(())
    }

    pub fn project_managed_openclaw_provider(
        &self,
        paths: &AppPaths,
        snapshot: &LocalAiProxySnapshot,
        health: &LocalAiProxyServiceHealth,
    ) -> Result<()> {
        let route = snapshot.default_route().ok_or_else(|| {
            FrameworkError::ValidationFailed(
                "cannot project local ai proxy into openclaw config without a default route"
                    .to_string(),
            )
        })?;
        let default_model_id = resolve_default_route_model_id(route)?;
        let mut root = read_openclaw_config_root(&paths.openclaw_config_file)?;
        let overwrite_defaults =
            should_overwrite_managed_provider_defaults(&root, OPENCLAW_LOCAL_PROXY_PROVIDER_ID);
        let provider_root = ensure_json_object_mut(
            &mut root,
            &["models", "providers", OPENCLAW_LOCAL_PROXY_PROVIDER_ID],
        );
        let existing_models = provider_root
            .get("models")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let projected_base_url = resolve_projected_openclaw_provider_base_url(route, health);
        let projected_api = resolve_projected_openclaw_provider_api(route);

        provider_root.insert("baseUrl".to_string(), Value::String(projected_base_url));
        provider_root.insert(
            "apiKey".to_string(),
            Value::String(snapshot.auth_token.trim().to_string()),
        );
        provider_root.insert("api".to_string(), Value::String(projected_api.to_string()));
        clear_legacy_openclaw_provider_runtime_config(provider_root);
        provider_root.insert(
            "auth".to_string(),
            Value::String(OPENCLAW_LOCAL_PROXY_PROVIDER_AUTH.to_string()),
        );
        provider_root.insert(
            "models".to_string(),
            Value::Array(build_openclaw_provider_models(
                existing_models,
                route,
                &default_model_id,
            )),
        );

        if overwrite_defaults {
            write_managed_provider_defaults(
                &mut root,
                OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
                &default_model_id,
                route.reasoning_model_id.as_deref(),
            );
        }

        write_openclaw_config_root(&paths.openclaw_config_file, &root)
    }

    pub fn status(&self) -> Result<LocalAiProxyServiceStatus> {
        let runtime = self.lock_runtime()?;
        let snapshot = runtime.snapshot.clone();
        let observability = runtime.observability.clone();
        let route_metrics = snapshot
            .as_ref()
            .map(|value| build_route_metrics(value, &observability))
            .transpose()?
            .unwrap_or_default();
        let route_tests = snapshot
            .as_ref()
            .map(|value| collect_route_tests(value, &observability))
            .transpose()?
            .unwrap_or_default();
        Ok(LocalAiProxyServiceStatus {
            lifecycle: runtime.lifecycle.clone(),
            health: runtime.health.clone(),
            route_metrics,
            route_tests,
            last_error: runtime.last_error.clone(),
        })
    }

    pub fn observability_db_path(&self, paths: &AppPaths) -> Result<String> {
        Ok(self.ensure_observability_repo(paths)?.db_path_string())
    }

    pub fn message_capture_settings(
        &self,
        paths: &AppPaths,
    ) -> Result<LocalAiProxyMessageCaptureSettings> {
        self.ensure_observability_repo(paths)?
            .message_capture_settings()
    }

    pub fn update_message_capture_settings(
        &self,
        paths: &AppPaths,
        enabled: bool,
    ) -> Result<LocalAiProxyMessageCaptureSettings> {
        self.ensure_observability_repo(paths)?
            .update_message_capture_settings(enabled, current_time_ms())
    }

    pub fn list_request_logs(
        &self,
        paths: &AppPaths,
        query: LocalAiProxyRequestLogsQuery,
    ) -> Result<LocalAiProxyPaginatedResult<LocalAiProxyRequestLogRecord>> {
        self.ensure_observability_repo(paths)?
            .list_request_logs(query)
    }

    pub fn list_message_logs(
        &self,
        paths: &AppPaths,
        query: LocalAiProxyMessageLogsQuery,
    ) -> Result<LocalAiProxyPaginatedResult<LocalAiProxyMessageLogRecord>> {
        self.ensure_observability_repo(paths)?
            .list_message_logs(query)
    }

    pub fn test_route_by_id(&self, route_id: &str) -> Result<LocalAiProxyRouteTestRecord> {
        let route_id = route_id.trim();
        if route_id.is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "local ai proxy route id is required".to_string(),
            ));
        }

        let (snapshot, observability) = {
            let runtime = self.lock_runtime()?;
            (runtime.snapshot.clone(), runtime.observability.clone())
        };
        let snapshot = snapshot.ok_or_else(|| {
            FrameworkError::Conflict(
                "local ai proxy snapshot is unavailable; ensure the proxy is initialized first"
                    .to_string(),
            )
        })?;
        let route = snapshot
            .routes
            .iter()
            .find(|entry| entry.id == route_id)
            .cloned()
            .ok_or_else(|| FrameworkError::NotFound(format!("local ai proxy route {route_id}")))?;

        let record = probe_route(&route)?;
        let mut store = lock_observability(&observability)?;
        store.route_tests.insert(route.id.clone(), record.clone());
        Ok(record)
    }

    fn lock_runtime(&self) -> Result<MutexGuard<'_, LocalAiProxyRuntime>> {
        self.runtime.lock().map_err(|_| {
            FrameworkError::Internal("local ai proxy runtime lock poisoned".to_string())
        })
    }

    fn record_failed_status(
        &self,
        snapshot: Option<LocalAiProxySnapshot>,
        message: &str,
    ) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        runtime.lifecycle = LocalAiProxyLifecycle::Failed;
        runtime.health = None;
        runtime.snapshot = snapshot;
        runtime.last_error = Some(message.trim().to_string());
        runtime.handle = None;
        Ok(())
    }

    fn ensure_observability_repo(
        &self,
        paths: &AppPaths,
    ) -> Result<LocalAiProxyObservabilityRepository> {
        let mut runtime = self.lock_runtime()?;
        if let Some(repository) = runtime.observability_repo.clone() {
            return Ok(repository);
        }

        let repository = LocalAiProxyObservabilityRepository::new(
            paths.local_ai_proxy_observability_db_file.clone(),
        )?;
        runtime.observability_repo = Some(repository.clone());
        Ok(repository)
    }
}

fn lock_observability(
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
) -> Result<MutexGuard<'_, LocalAiProxyObservabilityStore>> {
    observability.lock().map_err(|_| {
        FrameworkError::Internal("local ai proxy observability lock poisoned".to_string())
    })
}

fn resolve_projected_openclaw_provider_api(route: &LocalAiProxyRouteSnapshot) -> &'static str {
    match route.client_protocol.trim() {
        ANTHROPIC_CLIENT_PROTOCOL => OPENCLAW_LOCAL_PROXY_PROVIDER_ANTHROPIC_API,
        GEMINI_CLIENT_PROTOCOL => OPENCLAW_LOCAL_PROXY_PROVIDER_GEMINI_API,
        _ => OPENCLAW_LOCAL_PROXY_PROVIDER_OPENAI_API,
    }
}

fn resolve_projected_openclaw_provider_base_url(
    route: &LocalAiProxyRouteSnapshot,
    health: &LocalAiProxyServiceHealth,
) -> String {
    let trimmed = health.base_url.trim();
    if route.client_protocol.trim() != GEMINI_CLIENT_PROTOCOL {
        return trimmed.to_string();
    }

    let root = trimmed.trim_end_matches("/v1").trim_end_matches('/');
    if root.is_empty() {
        trimmed.to_string()
    } else {
        root.to_string()
    }
}

struct ProxyRouteOutcome {
    response: Response,
    status: StatusCode,
    usage: LocalAiProxyTokenUsage,
    error: Option<String>,
    response_preview: Option<String>,
    response_body: Option<String>,
}

fn build_json_outcome(
    status: StatusCode,
    body: Value,
    usage: LocalAiProxyTokenUsage,
) -> ProxyHttpResult<ProxyRouteOutcome> {
    let response_preview = extract_response_preview_from_value(&body);
    let response_body = serde_json::to_string_pretty(&body).ok();
    Ok(ProxyRouteOutcome {
        response: build_json_response(status, body)?,
        status,
        usage,
        error: None,
        response_preview,
        response_body,
    })
}

async fn build_buffered_upstream_response(
    response: reqwest::Response,
) -> ProxyHttpResult<ProxyRouteOutcome> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("application/json"));
    let bytes = response.bytes().await.map_err(|error| {
        proxy_error(
            StatusCode::BAD_GATEWAY,
            &format!("Local AI proxy failed to read upstream response body: {error}"),
        )
    })?;
    let text = String::from_utf8_lossy(&bytes).trim().to_string();
    let json = serde_json::from_slice::<Value>(&bytes).ok();
    let usage = json.as_ref().map(extract_token_usage).unwrap_or_default();
    let error = (!status.is_success()).then(|| resolve_error_message(json.as_ref(), &text, status));
    let response_preview = json
        .as_ref()
        .and_then(extract_response_preview_from_value)
        .or_else(|| trim_optional_text(&text));
    let response = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, content_type)
        .body(Body::from(bytes))
        .map_err(|build_error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build buffered response: {build_error}"),
            )
        })?;

    Ok(ProxyRouteOutcome {
        response,
        status,
        usage,
        error,
        response_preview,
        response_body: trim_optional_text(&text),
    })
}

fn record_proxy_route_outcome(
    state: &LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    elapsed: Duration,
    result: &ProxyHttpResult<ProxyRouteOutcome>,
) {
    let now_ms = current_time_ms();
    let latency_ms = elapsed.as_millis().min(u128::from(u64::MAX)) as u64;
    let mut store = match state.observability.lock() {
        Ok(value) => value,
        Err(_) => {
            return;
        }
    };
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
    entry.request_count += 1;
    entry.cumulative_latency_ms = entry.cumulative_latency_ms.saturating_add(latency_ms);
    entry.last_latency_ms = Some(latency_ms);
    entry.last_used_at = Some(now_ms);
    entry.recent_request_timestamps_ms.push_back(now_ms);
    while entry
        .recent_request_timestamps_ms
        .front()
        .copied()
        .is_some_and(|timestamp| now_ms.saturating_sub(timestamp) > 60_000)
    {
        entry.recent_request_timestamps_ms.pop_front();
    }

    match result {
        Ok(outcome) if outcome.status.is_success() => {
            entry.success_count += 1;
            entry.total_tokens = entry
                .total_tokens
                .saturating_add(outcome.usage.total_tokens);
            entry.input_tokens = entry
                .input_tokens
                .saturating_add(outcome.usage.input_tokens);
            entry.output_tokens = entry
                .output_tokens
                .saturating_add(outcome.usage.output_tokens);
            entry.cache_tokens = entry
                .cache_tokens
                .saturating_add(outcome.usage.cache_tokens);
            entry.last_error = None;
        }
        Ok(outcome) => {
            entry.failure_count += 1;
            entry.last_error =
                Some(outcome.error.clone().unwrap_or_else(|| {
                    format!("route request failed with status {}", outcome.status)
                }));
        }
        Err(error) => {
            entry.failure_count += 1;
            entry.last_error = Some(extract_proxy_error_message(error));
        }
    }
}

fn record_proxy_route_usage_adjustment(
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
    route_id: &str,
    usage: &LocalAiProxyTokenUsage,
) {
    if usage == &LocalAiProxyTokenUsage::default() {
        return;
    }

    let mut store = match observability.lock() {
        Ok(value) => value,
        Err(_) => {
            return;
        }
    };
    let Some(entry) = store.route_metrics.get_mut(route_id) else {
        return;
    };
    entry.total_tokens = entry.total_tokens.saturating_add(usage.total_tokens);
    entry.input_tokens = entry.input_tokens.saturating_add(usage.input_tokens);
    entry.output_tokens = entry.output_tokens.saturating_add(usage.output_tokens);
    entry.cache_tokens = entry.cache_tokens.saturating_add(usage.cache_tokens);
}

fn record_proxy_request_log(
    state: &LocalAiProxyAppState,
    context: &LocalAiProxyRequestAuditContext,
    elapsed: Duration,
    result: &ProxyHttpResult<ProxyRouteOutcome>,
) {
    let insert = match result {
        Ok(outcome) => LocalAiProxyRequestLogInsert {
            id: context.id.clone(),
            created_at: context.created_at,
            route_id: context.route_id.clone(),
            route_name: context.route_name.clone(),
            provider_id: context.provider_id.clone(),
            client_protocol: context.client_protocol.clone(),
            upstream_protocol: context.upstream_protocol.clone(),
            endpoint: context.endpoint.clone(),
            status: if outcome.status.is_success() {
                "succeeded".to_string()
            } else {
                "failed".to_string()
            },
            model_id: context.model_id.clone(),
            base_url: context.base_url.clone(),
            ttft_ms: None,
            total_duration_ms: duration_to_ms(elapsed),
            total_tokens: outcome.usage.total_tokens,
            input_tokens: outcome.usage.input_tokens,
            output_tokens: outcome.usage.output_tokens,
            cache_tokens: outcome.usage.cache_tokens,
            request_preview: context.request_preview.clone(),
            response_preview: outcome.response_preview.clone(),
            error: outcome.error.clone(),
            request_body: context.request_body.clone(),
            response_body: outcome.response_body.clone(),
            response_status: Some(outcome.status.as_u16()),
            messages: context.messages.clone(),
        },
        Err((status, body)) => {
            let response_body = serde_json::to_string_pretty(&body.0).ok();
            LocalAiProxyRequestLogInsert {
                id: context.id.clone(),
                created_at: context.created_at,
                route_id: context.route_id.clone(),
                route_name: context.route_name.clone(),
                provider_id: context.provider_id.clone(),
                client_protocol: context.client_protocol.clone(),
                upstream_protocol: context.upstream_protocol.clone(),
                endpoint: context.endpoint.clone(),
                status: "failed".to_string(),
                model_id: context.model_id.clone(),
                base_url: context.base_url.clone(),
                ttft_ms: None,
                total_duration_ms: duration_to_ms(elapsed),
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_tokens: 0,
                request_preview: context.request_preview.clone(),
                response_preview: extract_response_preview_from_value(&body.0).or_else(|| {
                    trim_optional_text(&extract_proxy_error_message(&(
                        status.clone(),
                        body.clone(),
                    )))
                }),
                error: Some(extract_proxy_error_message(&(status.clone(), body.clone()))),
                request_body: context.request_body.clone(),
                response_body,
                response_status: Some(status.as_u16()),
                messages: context.messages.clone(),
            }
        }
    };

    let _ = state.observability_repo.insert_request_log(insert);
}

fn record_completed_stream_request_log(
    repository: &LocalAiProxyObservabilityRepository,
    context: LocalAiProxyRequestAuditContext,
    status: StatusCode,
    started_at: Instant,
    usage: LocalAiProxyTokenUsage,
    ttft_ms: Option<u64>,
    response_text: Option<String>,
) {
    let response_preview = response_text
        .as_ref()
        .and_then(|value| trim_optional_text(value));
    let _ = repository.insert_request_log(LocalAiProxyRequestLogInsert {
        id: context.id,
        created_at: context.created_at,
        route_id: context.route_id,
        route_name: context.route_name,
        provider_id: context.provider_id,
        client_protocol: context.client_protocol,
        upstream_protocol: context.upstream_protocol,
        endpoint: context.endpoint,
        status: if status.is_success() {
            "succeeded".to_string()
        } else {
            "failed".to_string()
        },
        model_id: context.model_id,
        base_url: context.base_url,
        ttft_ms,
        total_duration_ms: duration_to_ms(started_at.elapsed()),
        total_tokens: usage.total_tokens,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_tokens: usage.cache_tokens,
        request_preview: context.request_preview,
        response_preview: response_preview.clone(),
        error: (!status.is_success()).then(|| format!("stream completed with status {status}")),
        request_body: context.request_body,
        response_body: response_text,
        response_status: Some(status.as_u16()),
        messages: context.messages,
    });
}

fn build_request_audit_context(
    route: &LocalAiProxyRouteSnapshot,
    endpoint: &str,
    body: &Bytes,
) -> LocalAiProxyRequestAuditContext {
    let payload = serde_json::from_slice::<Value>(body).ok();
    let messages = payload
        .as_ref()
        .map(|value| extract_logged_messages(route, endpoint, value))
        .unwrap_or_default();
    let request_body = payload
        .as_ref()
        .and_then(|value| serde_json::to_string_pretty(value).ok())
        .or_else(|| trim_optional_text(&String::from_utf8_lossy(body)));

    LocalAiProxyRequestAuditContext {
        id: Uuid::new_v4().simple().to_string(),
        created_at: current_time_ms(),
        route_id: route.id.clone(),
        route_name: route.name.clone(),
        provider_id: route.provider_id.clone(),
        client_protocol: route.client_protocol.clone(),
        upstream_protocol: route.upstream_protocol.clone(),
        endpoint: endpoint.to_string(),
        model_id: payload
            .as_ref()
            .and_then(|value| extract_logged_model_id(route, endpoint, value)),
        base_url: route.upstream_base_url.clone(),
        request_preview: resolve_request_preview(&messages)
            .or_else(|| trim_optional_text(&String::from_utf8_lossy(body))),
        request_body,
        messages,
    }
}

fn extract_logged_model_id(
    route: &LocalAiProxyRouteSnapshot,
    endpoint: &str,
    payload: &Value,
) -> Option<String> {
    payload
        .get("model")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| parse_model_id_from_endpoint(endpoint))
        .or_else(|| {
            (!route.default_model_id.trim().is_empty()).then(|| route.default_model_id.clone())
        })
}

fn parse_model_id_from_endpoint(endpoint: &str) -> Option<String> {
    endpoint
        .split("models/")
        .nth(1)
        .and_then(|value| value.split(':').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn extract_logged_messages(
    route: &LocalAiProxyRouteSnapshot,
    endpoint: &str,
    payload: &Value,
) -> Vec<LocalAiProxyLoggedMessage> {
    match route.client_protocol.as_str() {
        ANTHROPIC_CLIENT_PROTOCOL => collect_anthropic_logged_messages(payload),
        GEMINI_CLIENT_PROTOCOL => collect_gemini_logged_messages(payload),
        _ if endpoint.contains("responses") => collect_openai_response_logged_messages(payload),
        _ => collect_openai_logged_messages(payload),
    }
}

fn collect_openai_logged_messages(payload: &Value) -> Vec<LocalAiProxyLoggedMessage> {
    let mut messages = Vec::new();
    if let Some(system) = payload.get("instructions").and_then(Value::as_str) {
        push_logged_message(&mut messages, "system", system, None, Some("instructions"));
    }
    if let Some(array) = payload.get("messages").and_then(Value::as_array) {
        for entry in array {
            push_logged_message(
                &mut messages,
                entry.get("role").and_then(Value::as_str).unwrap_or("user"),
                &extract_text_from_value(entry.get("content").unwrap_or(entry)),
                entry.get("name").and_then(Value::as_str),
                Some("message"),
            );
        }
    } else if let Some(input) = payload.get("input") {
        push_logged_message(
            &mut messages,
            "user",
            &extract_text_from_value(input),
            None,
            Some("input"),
        );
    }
    messages
}

fn collect_openai_response_logged_messages(payload: &Value) -> Vec<LocalAiProxyLoggedMessage> {
    let mut messages = Vec::new();
    if let Some(instructions) = payload.get("instructions").and_then(Value::as_str) {
        push_logged_message(
            &mut messages,
            "system",
            instructions,
            None,
            Some("instructions"),
        );
    }
    match payload.get("input") {
        Some(Value::Array(entries)) => {
            for entry in entries {
                push_logged_message(
                    &mut messages,
                    entry.get("role").and_then(Value::as_str).unwrap_or("user"),
                    &extract_text_from_value(entry),
                    None,
                    Some("input"),
                );
            }
        }
        Some(value) => {
            push_logged_message(
                &mut messages,
                "user",
                &extract_text_from_value(value),
                None,
                Some("input"),
            );
        }
        None => {}
    }
    messages
}

fn collect_anthropic_logged_messages(payload: &Value) -> Vec<LocalAiProxyLoggedMessage> {
    let mut messages = Vec::new();
    if let Some(system) = payload.get("system") {
        push_logged_message(
            &mut messages,
            "system",
            &extract_text_from_value(system),
            None,
            Some("system"),
        );
    }
    if let Some(array) = payload.get("messages").and_then(Value::as_array) {
        for entry in array {
            push_logged_message(
                &mut messages,
                entry.get("role").and_then(Value::as_str).unwrap_or("user"),
                &extract_text_from_value(entry.get("content").unwrap_or(entry)),
                None,
                Some("message"),
            );
        }
    }
    messages
}

fn collect_gemini_logged_messages(payload: &Value) -> Vec<LocalAiProxyLoggedMessage> {
    let mut messages = Vec::new();
    if let Some(system) = payload.get("systemInstruction") {
        push_logged_message(
            &mut messages,
            "system",
            &extract_text_from_value(system),
            None,
            Some("systemInstruction"),
        );
    }
    if let Some(array) = payload.get("contents").and_then(Value::as_array) {
        for entry in array {
            push_logged_message(
                &mut messages,
                entry.get("role").and_then(Value::as_str).unwrap_or("user"),
                &extract_text_from_value(entry.get("parts").unwrap_or(entry)),
                None,
                Some("content"),
            );
        }
    } else if let Some(content) = payload.get("content") {
        push_logged_message(
            &mut messages,
            "user",
            &extract_text_from_value(content),
            None,
            Some("content"),
        );
    }
    messages
}

fn push_logged_message(
    messages: &mut Vec<LocalAiProxyLoggedMessage>,
    role: &str,
    content: &str,
    name: Option<&str>,
    kind: Option<&str>,
) {
    let Some(content) = trim_optional_text(content) else {
        return;
    };
    messages.push(LocalAiProxyLoggedMessage {
        index: messages.len() as u32,
        role: role.trim().to_string(),
        content,
        name: name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        kind: kind
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
    });
}

fn extract_text_from_value(value: &Value) -> String {
    let mut parts = Vec::new();
    collect_text_fragments(value, &mut parts);
    parts.join("\n").trim().to_string()
}

fn collect_text_fragments(value: &Value, parts: &mut Vec<String>) {
    match value {
        Value::String(text) => {
            if !text.trim().is_empty() {
                parts.push(text.trim().to_string());
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_text_fragments(item, parts);
            }
        }
        Value::Object(object) => {
            for key in ["text", "content", "parts", "input_text", "output_text"] {
                if let Some(candidate) = object.get(key) {
                    collect_text_fragments(candidate, parts);
                    return;
                }
            }
        }
        _ => {}
    }
}

fn resolve_request_preview(messages: &[LocalAiProxyLoggedMessage]) -> Option<String> {
    messages
        .iter()
        .rev()
        .find(|message| message.role == "user")
        .or_else(|| messages.last())
        .and_then(|message| trim_optional_text(&message.content))
}

fn extract_response_preview_from_value(value: &Value) -> Option<String> {
    for pointer in [
        "/choices/0/message/content",
        "/choices/0/delta/content",
        "/output_text",
        "/output/0/content/0/text",
        "/content/0/text",
        "/candidates/0/content/parts",
        "/message/content/0/text",
    ] {
        if let Some(candidate) = value.pointer(pointer) {
            let preview = extract_text_from_value(candidate);
            if let Some(preview) = trim_optional_text(&preview) {
                return Some(preview);
            }
        }
    }

    None
}

fn duration_to_ms(duration: Duration) -> u64 {
    if duration.is_zero() {
        return 0;
    }

    let millis = duration.as_millis().min(u128::from(u64::MAX)) as u64;
    millis.max(1)
}

fn trim_optional_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut normalized = trimmed.chars().take(4_000).collect::<String>();
    if trimmed.chars().count() > 4_000 {
        normalized.push_str("...");
    }
    Some(normalized)
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

fn reconcile_observability_store(
    store: &mut LocalAiProxyObservabilityStore,
    snapshot: &LocalAiProxySnapshot,
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

fn build_route_metrics(
    snapshot: &LocalAiProxySnapshot,
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

fn collect_route_tests(
    snapshot: &LocalAiProxySnapshot,
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

fn extract_token_usage(payload: &Value) -> LocalAiProxyTokenUsage {
    let input_tokens = value_u64(payload, "/usage/prompt_tokens")
        .or_else(|| value_u64(payload, "/usage/input_tokens"))
        .or_else(|| value_u64(payload, "/usageMetadata/promptTokenCount"))
        .unwrap_or(0);
    let output_tokens = value_u64(payload, "/usage/completion_tokens")
        .or_else(|| value_u64(payload, "/usage/output_tokens"))
        .or_else(|| value_u64(payload, "/usageMetadata/candidatesTokenCount"))
        .unwrap_or(0);
    let anthropic_cache_tokens = value_u64(payload, "/usage/cache_creation_input_tokens")
        .unwrap_or(0)
        .saturating_add(value_u64(payload, "/usage/cache_read_input_tokens").unwrap_or(0));
    let cache_tokens = value_u64(payload, "/usage/cache_tokens")
        .or_else(|| value_u64(payload, "/usage/prompt_tokens_details/cached_tokens"))
        .or_else(|| value_u64(payload, "/usage/input_tokens_details/cached_tokens"))
        .or_else(|| value_u64(payload, "/usageMetadata/cachedContentTokenCount"))
        .unwrap_or(anthropic_cache_tokens);
    let prompt_completion_total = input_tokens.saturating_add(output_tokens);
    let total_tokens = value_u64(payload, "/usage/total_tokens")
        .or_else(|| value_u64(payload, "/usageMetadata/totalTokenCount"))
        .unwrap_or_else(|| {
            if prompt_completion_total > 0 {
                prompt_completion_total
            } else {
                cache_tokens
            }
        });

    LocalAiProxyTokenUsage {
        total_tokens,
        input_tokens,
        output_tokens,
        cache_tokens,
    }
}

fn value_u64(payload: &Value, pointer: &str) -> Option<u64> {
    payload.pointer(pointer).and_then(Value::as_u64)
}

fn resolve_error_message(payload: Option<&Value>, text: &str, status: StatusCode) -> String {
    extract_error_message_from_payload(payload)
        .or_else(|| (!text.is_empty()).then(|| text.to_string()))
        .unwrap_or_else(|| format!("upstream returned status {status}"))
}

fn extract_error_message_from_payload(payload: Option<&Value>) -> Option<String> {
    let Some(payload) = payload else {
        return None;
    };

    payload
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| payload.pointer("/error").and_then(Value::as_str))
        .or_else(|| payload.pointer("/message").and_then(Value::as_str))
        .or_else(|| payload.pointer("/detail").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn extract_proxy_error_message(error: &(StatusCode, Json<Value>)) -> String {
    resolve_error_message(Some(&error.1 .0), "", error.0)
}

fn probe_route(route: &LocalAiProxyRouteSnapshot) -> Result<LocalAiProxyRouteTestRecord> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to create tokio runtime for local ai proxy route probe: {error}"
            ))
        })?;

    Ok(runtime.block_on(async { probe_route_async(route).await }))
}

async fn probe_route_async(route: &LocalAiProxyRouteSnapshot) -> LocalAiProxyRouteTestRecord {
    let tested_at = current_time_ms();
    let started_at = Instant::now();
    let capability = route_probe_capability(route).to_string();
    let model_id =
        (!route.default_model_id.trim().is_empty()).then(|| route.default_model_id.clone());

    let outcome = if !route.enabled {
        Err("route is disabled".to_string())
    } else if model_id.is_none() {
        Err("route is missing a default model id".to_string())
    } else {
        let client = reqwest::Client::new();
        match route.upstream_protocol.as_str() {
            "anthropic" => probe_anthropic_route(&client, route).await,
            "gemini" => probe_gemini_route(&client, route).await,
            _ => probe_openai_compatible_route(&client, route).await,
        }
    };

    LocalAiProxyRouteTestRecord {
        route_id: route.id.clone(),
        status: if outcome.is_ok() {
            "passed".to_string()
        } else {
            "failed".to_string()
        },
        tested_at,
        latency_ms: Some(started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64),
        checked_capability: capability,
        model_id,
        error: outcome.err(),
    }
}

fn route_probe_capability(route: &LocalAiProxyRouteSnapshot) -> &'static str {
    match route.upstream_protocol.as_str() {
        "anthropic" => "messages",
        "gemini" => "generateContent",
        _ => "chat",
    }
}

async fn probe_openai_compatible_route(
    client: &reqwest::Client,
    route: &LocalAiProxyRouteSnapshot,
) -> StdResult<(), String> {
    let body = Bytes::from(
        json!({
            "model": route.default_model_id,
            "messages": [{ "role": "user", "content": "ping" }],
            "max_tokens": 1,
            "temperature": 0,
        })
        .to_string(),
    );
    let request =
        build_openai_compatible_upstream_request(client, route, "chat/completions", None, body)
            .map_err(|error| extract_proxy_error_message(&error))?;
    let response = request
        .send()
        .await
        .map_err(|error| format!("route probe upstream request failed: {error}"))?;
    ensure_probe_response_success(response).await
}

async fn probe_anthropic_route(
    client: &reqwest::Client,
    route: &LocalAiProxyRouteSnapshot,
) -> StdResult<(), String> {
    let response = client
        .post(format!(
            "{}/messages",
            route.upstream_base_url.trim_end_matches('/')
        ))
        .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
        .header(X_API_KEY_HEADER, route.api_key.trim())
        .header(ANTHROPIC_VERSION_HEADER, DEFAULT_ANTHROPIC_VERSION)
        .body(
            json!({
                "model": route.default_model_id,
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "ping" }],
            })
            .to_string(),
        )
        .send()
        .await
        .map_err(|error| format!("route probe upstream request failed: {error}"))?;
    ensure_probe_response_success(response).await
}

async fn probe_gemini_route(
    client: &reqwest::Client,
    route: &LocalAiProxyRouteSnapshot,
) -> StdResult<(), String> {
    let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
    let response = client
        .post(build_gemini_upstream_request_url(
            route,
            api_version,
            &format!("{}:generateContent", route.default_model_id),
            None,
        ))
        .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
        .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
        .body(
            json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": "ping" }],
                }],
                "generationConfig": {
                    "maxOutputTokens": 1,
                }
            })
            .to_string(),
        )
        .send()
        .await
        .map_err(|error| format!("route probe upstream request failed: {error}"))?;
    ensure_probe_response_success(response).await
}

async fn ensure_probe_response_success(response: reqwest::Response) -> StdResult<(), String> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }

    let text = response
        .text()
        .await
        .unwrap_or_else(|error| format!("failed to read upstream probe error: {error}"));
    let payload = serde_json::from_str::<Value>(&text).ok();
    Err(resolve_error_message(payload.as_ref(), text.trim(), status))
}

fn build_router(state: LocalAiProxyAppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/v1/health", get(health_handler))
        .route("/v1/models", get(models_handler))
        .route("/v1/chat/completions", post(chat_completions_handler))
        .route("/v1/responses", post(openai_responses_handler))
        .route("/v1/embeddings", post(openai_embeddings_handler))
        .route("/v1/messages", post(anthropic_messages_handler))
        .route("/v1beta/models", get(gemini_models_handler_v1beta))
        .route(
            "/v1beta/models/{model_action}",
            post(gemini_model_action_handler_v1beta),
        )
        .route(
            "/v1/models/{model_action}",
            post(gemini_model_action_handler_v1),
        )
        .with_state(state)
}

async fn health_handler(State(state): State<LocalAiProxyAppState>) -> ProxyHttpResult<Json<Value>> {
    let snapshot = current_snapshot(&state)?;
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

async fn models_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
) -> ProxyHttpResult<Json<Value>> {
    let snapshot = current_snapshot(&state)?;
    require_client_auth(&headers, &snapshot.auth_token)?;
    let route = require_route_for_protocol(&snapshot, LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL)?;

    Ok(Json(json!({
        "object": "list",
        "data": route.models.iter().map(|model| json!({
            "id": model.id,
            "object": "model",
            "created": 0,
            "owned_by": route.provider_id,
        })).collect::<Vec<_>>(),
    })))
}

async fn chat_completions_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    openai_compatible_passthrough_handler(state, headers, original_uri, body, "chat/completions")
        .await
}

async fn openai_responses_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    openai_compatible_passthrough_handler(state, headers, original_uri, body, "responses").await
}

async fn openai_embeddings_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    openai_compatible_passthrough_handler(state, headers, original_uri, body, "embeddings").await
}

async fn openai_compatible_passthrough_handler(
    state: LocalAiProxyAppState,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
    endpoint_suffix: &str,
) -> ProxyHttpResult<Response> {
    let snapshot = current_snapshot(&state)?;
    require_client_auth(&headers, &snapshot.auth_token)?;
    let route = require_route_for_protocol(&snapshot, LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL)?;

    match route.upstream_protocol.as_str() {
        "anthropic" => {
            return anthropic_openai_compatible_handler(state, route, endpoint_suffix, body).await
        }
        "gemini" => {
            return gemini_openai_compatible_handler(state, route, endpoint_suffix, body).await
        }
        _ => {}
    }

    let payload = parse_json_body(&body)?;
    let streaming = is_openai_stream_request(&payload);
    let started_at = Instant::now();
    let audit_context =
        build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = async {
        let response = build_openai_compatible_upstream_request(
            &state.client,
            route,
            endpoint_suffix,
            original_uri.0.query(),
            body,
        )?
        .send()
        .await
        .map_err(|error| {
            proxy_error(
                StatusCode::BAD_GATEWAY,
                &format!("Local AI proxy upstream request failed: {error}"),
            )
        })?;

        if streaming && response.status().is_success() {
            let status = response.status();
            let observability_repo = state.observability_repo.clone();
            let request_audit_context = audit_context.clone();
            let request_started_at = started_at.clone();
            return Ok(ProxyRouteOutcome {
                response: build_passthrough_response(
                    response,
                    started_at.clone(),
                    move |ttft_ms, response_text| {
                        record_completed_stream_request_log(
                            &observability_repo,
                            request_audit_context,
                            status,
                            request_started_at,
                            LocalAiProxyTokenUsage::default(),
                            ttft_ms,
                            response_text,
                        );
                    },
                )
                .await?,
                status,
                usage: LocalAiProxyTokenUsage::default(),
                error: None,
                response_preview: None,
                response_body: None,
            });
        }

        build_buffered_upstream_response(response).await
    }
    .await;

    record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn anthropic_openai_compatible_handler(
    state: LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let stream_endpoint = openai_stream_endpoint_for_suffix(endpoint_suffix).ok();
    let started_at = Instant::now();
    let audit_context =
        build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = match endpoint_suffix {
        "chat/completions" => {
            let payload = parse_json_body(&body)?;
            let streaming = is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body = build_anthropic_request_from_openai_chat(route, &payload)?;
            let response = state
                .client
                .post(format!(
                    "{}/messages",
                    route.upstream_base_url.trim_end_matches('/')
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_API_KEY_HEADER, route.api_key.trim())
                .header(ANTHROPIC_VERSION_HEADER, DEFAULT_ANTHROPIC_VERSION)
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at.clone();
                Ok(ProxyRouteOutcome {
                    response: build_translated_openai_sse_response(
                        status,
                        response,
                        OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(OpenAiStreamEndpoint::ChatCompletions),
                            requested_model_id,
                            "chatcmpl-local-proxy",
                        ),
                        handle_anthropic_openai_stream_frame,
                        started_at.clone(),
                        move |usage, ttft_ms, response_text| {
                            record_proxy_route_usage_adjustment(&observability, &route_id, &usage);
                            record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    build_openai_chat_completion_from_anthropic(route, &upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "responses" => {
            let payload = parse_json_body(&body)?;
            let streaming = is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body = build_anthropic_request_from_openai_response(route, &payload)?;
            let response = state
                .client
                .post(format!(
                    "{}/messages",
                    route.upstream_base_url.trim_end_matches('/')
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_API_KEY_HEADER, route.api_key.trim())
                .header(ANTHROPIC_VERSION_HEADER, DEFAULT_ANTHROPIC_VERSION)
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at.clone();
                Ok(ProxyRouteOutcome {
                    response: build_translated_openai_sse_response(
                        status,
                        response,
                        OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(OpenAiStreamEndpoint::Responses),
                            requested_model_id,
                            "resp-local-proxy",
                        ),
                        handle_anthropic_openai_stream_frame,
                        started_at.clone(),
                        move |usage, ttft_ms, response_text| {
                            record_proxy_route_usage_adjustment(&observability, &route_id, &usage);
                            record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    build_openai_response_from_anthropic(route, &upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "embeddings" => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            "Anthropic routes do not expose an embeddings adapter through the local AI proxy.",
        )),
        _ => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported OpenAI-compatible endpoint: {endpoint_suffix}"),
        )),
    };

    record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn gemini_openai_compatible_handler(
    state: LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let stream_endpoint = openai_stream_endpoint_for_suffix(endpoint_suffix).ok();
    let started_at = Instant::now();
    let audit_context =
        build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = match endpoint_suffix {
        "chat/completions" => {
            let payload = parse_json_body(&body)?;
            let streaming = is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body = build_gemini_request_from_openai_chat(route, &payload)?;
            let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
            let response = state
                .client
                .post(build_gemini_upstream_request_url(
                    route,
                    api_version,
                    &format!(
                        "{}:{}",
                        requested_model_id,
                        if streaming {
                            "streamGenerateContent"
                        } else {
                            "generateContent"
                        }
                    ),
                    streaming.then_some("alt=sse"),
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at.clone();
                Ok(ProxyRouteOutcome {
                    response: build_translated_openai_sse_response(
                        status,
                        response,
                        OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(OpenAiStreamEndpoint::ChatCompletions),
                            requested_model_id,
                            "chatcmpl-local-proxy",
                        ),
                        handle_gemini_openai_stream_frame,
                        started_at.clone(),
                        move |usage, ttft_ms, response_text| {
                            record_proxy_route_usage_adjustment(&observability, &route_id, &usage);
                            record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    build_openai_chat_completion_from_gemini(route, &upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "responses" => {
            let payload = parse_json_body(&body)?;
            let streaming = is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body = build_gemini_request_from_openai_response(route, &payload)?;
            let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
            let response = state
                .client
                .post(build_gemini_upstream_request_url(
                    route,
                    api_version,
                    &format!(
                        "{}:{}",
                        requested_model_id,
                        if streaming {
                            "streamGenerateContent"
                        } else {
                            "generateContent"
                        }
                    ),
                    streaming.then_some("alt=sse"),
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at.clone();
                Ok(ProxyRouteOutcome {
                    response: build_translated_openai_sse_response(
                        status,
                        response,
                        OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(OpenAiStreamEndpoint::Responses),
                            requested_model_id,
                            "resp-local-proxy",
                        ),
                        handle_gemini_openai_stream_frame,
                        started_at.clone(),
                        move |usage, ttft_ms, response_text| {
                            record_proxy_route_usage_adjustment(&observability, &route_id, &usage);
                            record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    build_openai_response_from_gemini(route, &upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "embeddings" => {
            let payload = parse_json_body(&body)?;
            let model_id = resolve_request_model_id(route, &payload)?;
            let request_body = build_gemini_request_from_openai_embeddings(&payload)?;
            let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
            let response = state
                .client
                .post(build_gemini_upstream_request_url(
                    route,
                    api_version,
                    &format!("{model_id}:embedContent"),
                    None,
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    build_openai_embeddings_from_gemini(&upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        _ => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported OpenAI-compatible endpoint: {endpoint_suffix}"),
        )),
    };

    record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

fn build_openai_compatible_upstream_request(
    client: &reqwest::Client,
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    query: Option<&str>,
    body: Bytes,
) -> ProxyHttpResult<reqwest::RequestBuilder> {
    let upstream_url = build_openai_compatible_upstream_request_url(route, endpoint_suffix, query)?;
    let mut request = client
        .post(upstream_url)
        .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
        .body(body.to_vec());

    if route.upstream_protocol == "azure-openai" {
        request = request.header(X_API_KEY_HEADER, route.api_key.trim());
    } else {
        request = request.bearer_auth(route.api_key.trim());
    }

    Ok(request)
}

fn build_openai_compatible_upstream_request_url(
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    query: Option<&str>,
) -> ProxyHttpResult<String> {
    let base = normalize_openai_compatible_upstream_base_url(route);
    let mut url = reqwest::Url::parse(&base).map_err(|error| {
        proxy_error(
            StatusCode::BAD_GATEWAY,
            &format!("Invalid local AI proxy upstream base URL: {error}"),
        )
    })?;
    let joined_path = format!(
        "{}/{}",
        url.path().trim_end_matches('/'),
        endpoint_suffix.trim_start_matches('/')
    );
    let merged_query = merge_query_strings(url.query(), query);
    url.set_path(&joined_path);
    url.set_query(merged_query.as_deref());
    Ok(url.to_string())
}

fn normalize_openai_compatible_upstream_base_url(route: &LocalAiProxyRouteSnapshot) -> String {
    let trimmed = route.upstream_base_url.trim().trim_end_matches('/');
    if route.upstream_protocol != "azure-openai" {
        return trimmed.to_string();
    }

    if trimmed.ends_with("/openai/v1") {
        return trimmed.to_string();
    }
    if trimmed.ends_with("/openai") {
        return format!("{trimmed}/v1");
    }

    format!("{trimmed}/openai/v1")
}

fn merge_query_strings(base_query: Option<&str>, request_query: Option<&str>) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(base) = base_query.map(str::trim).filter(|value| !value.is_empty()) {
        parts.push(base.to_string());
    }
    if let Some(request) = request_query
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        parts.push(request.to_string());
    }

    (!parts.is_empty()).then(|| parts.join("&"))
}

async fn anthropic_messages_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let snapshot = current_snapshot(&state)?;
    require_client_auth(&headers, &snapshot.auth_token)?;
    let route = require_route_for_protocol(&snapshot, ANTHROPIC_CLIENT_PROTOCOL)?;
    let payload = parse_json_body(&body)?;
    let streaming = payload
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let started_at = Instant::now();
    let audit_context = build_request_audit_context(route, "/v1/messages", &body);
    let result = async {
        let mut request = state
            .client
            .post(format!(
                "{}/messages",
                route.upstream_base_url.trim_end_matches('/')
            ))
            .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .header(X_API_KEY_HEADER, route.api_key.trim())
            .header(
                ANTHROPIC_VERSION_HEADER,
                header_text(&headers, ANTHROPIC_VERSION_HEADER)
                    .unwrap_or_else(|| DEFAULT_ANTHROPIC_VERSION.to_string()),
            );
        if let Some(beta) = header_text(&headers, ANTHROPIC_BETA_HEADER) {
            request = request.header(ANTHROPIC_BETA_HEADER, beta);
        }

        let response = request.body(body.to_vec()).send().await.map_err(|error| {
            proxy_error(
                StatusCode::BAD_GATEWAY,
                &format!("Local AI proxy upstream request failed: {error}"),
            )
        })?;

        if streaming && response.status().is_success() {
            let status = response.status();
            let observability_repo = state.observability_repo.clone();
            let request_audit_context = audit_context.clone();
            let request_started_at = started_at.clone();
            return Ok(ProxyRouteOutcome {
                response: build_passthrough_response(
                    response,
                    started_at.clone(),
                    move |ttft_ms, response_text| {
                        record_completed_stream_request_log(
                            &observability_repo,
                            request_audit_context,
                            status,
                            request_started_at,
                            LocalAiProxyTokenUsage::default(),
                            ttft_ms,
                            response_text,
                        );
                    },
                )
                .await?,
                status,
                usage: LocalAiProxyTokenUsage::default(),
                error: None,
                response_preview: None,
                response_body: None,
            });
        }

        build_buffered_upstream_response(response).await
    }
    .await;

    record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn gemini_models_handler_v1beta(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
) -> ProxyHttpResult<Json<Value>> {
    gemini_models_handler(state, headers, "v1beta").await
}

async fn gemini_models_handler(
    state: LocalAiProxyAppState,
    headers: HeaderMap,
    api_version: &str,
) -> ProxyHttpResult<Json<Value>> {
    let snapshot = current_snapshot(&state)?;
    require_client_auth(&headers, &snapshot.auth_token)?;
    let route = require_route_for_protocol(&snapshot, GEMINI_CLIENT_PROTOCOL)?;

    Ok(Json(json!({
        "models": route.models.iter().map(|model| {
            json!({
                "name": format!("models/{}", model.id),
                "displayName": model.name,
                "description": format!("Local AI proxy route \"{}\" on {}.", route.name, api_version),
                "supportedGenerationMethods": gemini_supported_generation_methods(route, &model.id),
            })
        }).collect::<Vec<_>>(),
    })))
}

async fn gemini_model_action_handler_v1beta(
    State(state): State<LocalAiProxyAppState>,
    AxumPath(model_action): AxumPath<String>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    gemini_model_action_handler(state, model_action, headers, original_uri, body, "v1beta").await
}

async fn gemini_model_action_handler_v1(
    State(state): State<LocalAiProxyAppState>,
    AxumPath(model_action): AxumPath<String>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    gemini_model_action_handler(state, model_action, headers, original_uri, body, "v1").await
}

async fn gemini_model_action_handler(
    state: LocalAiProxyAppState,
    model_action: String,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
    api_version: &str,
) -> ProxyHttpResult<Response> {
    let snapshot = current_snapshot(&state)?;
    require_client_auth(&headers, &snapshot.auth_token)?;
    let route = require_route_for_protocol(&snapshot, GEMINI_CLIENT_PROTOCOL)?;
    let (model_id, action) = parse_model_action(&model_action).ok_or_else(|| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            "Invalid Gemini model action. Expected a path like models/{model}:generateContent.",
        )
    })?;
    if !matches!(
        action,
        "generateContent" | "streamGenerateContent" | "embedContent" | "batchEmbedContents"
    ) {
        return Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported Gemini model action: {action}"),
        ));
    }
    if !route.models.iter().any(|model| model.id == model_id) {
        return Err(proxy_error(
            StatusCode::NOT_FOUND,
            &format!(
                "Gemini model \"{model_id}\" is not exposed by local AI proxy route \"{}\".",
                route.name
            ),
        ));
    }
    if !gemini_supported_generation_methods(route, model_id)
        .into_iter()
        .any(|supported_action| supported_action == action)
    {
        return Err(proxy_error(
            StatusCode::BAD_REQUEST,
            &format!(
                "Gemini model \"{model_id}\" on local AI proxy route \"{}\" does not support action \"{action}\".",
                route.name
            ),
        ));
    }

    let streaming = action == "streamGenerateContent";
    let started_at = Instant::now();
    let audit_context = build_request_audit_context(
        route,
        &format!("/{api_version}/models/{model_action}"),
        &body,
    );
    let result = async {
        let response = state
            .client
            .post(build_gemini_upstream_request_url(
                route,
                api_version,
                &model_action,
                original_uri.0.query(),
            ))
            .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
            .body(body.to_vec())
            .send()
            .await
            .map_err(|error| {
                proxy_error(
                    StatusCode::BAD_GATEWAY,
                    &format!("Local AI proxy upstream request failed: {error}"),
                )
            })?;

        if streaming && response.status().is_success() {
            let status = response.status();
            let observability_repo = state.observability_repo.clone();
            let request_audit_context = audit_context.clone();
            let request_started_at = started_at;
            return Ok(ProxyRouteOutcome {
                response: build_passthrough_response(
                    response,
                    started_at,
                    move |ttft_ms, response_text| {
                        record_completed_stream_request_log(
                            &observability_repo,
                            request_audit_context,
                            status,
                            request_started_at,
                            LocalAiProxyTokenUsage::default(),
                            ttft_ms,
                            response_text,
                        );
                    },
                )
                .await?,
                status,
                usage: LocalAiProxyTokenUsage::default(),
                error: None,
                response_preview: None,
                response_body: None,
            });
        }

        build_buffered_upstream_response(response).await
    }
    .await;

    record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn build_passthrough_response<G>(
    response: reqwest::Response,
    request_started_at: Instant,
    on_complete: G,
) -> ProxyHttpResult<Response>
where
    G: FnOnce(Option<u64>, Option<String>) + Send + 'static,
{
    let status = response.status();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("application/json"));
    let stream = async_stream::stream! {
        let mut upstream = response;
        let mut preview = String::new();
        let mut first_chunk_latency_ms = None;
        let mut on_complete = Some(on_complete);

        loop {
            match upstream.chunk().await {
                Ok(Some(chunk)) => {
                    if first_chunk_latency_ms.is_none() {
                        first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
                    }
                    if preview.len() < 4_000 {
                        preview.push_str(&String::from_utf8_lossy(&chunk));
                    }
                    yield Ok::<Bytes, std::io::Error>(chunk);
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        if let Some(on_complete) = on_complete.take() {
            on_complete(first_chunk_latency_ms, trim_optional_text(&preview));
        }
    };
    let mut builder = Response::builder().status(status);
    builder = builder.header(CONTENT_TYPE, content_type);
    builder.body(Body::from_stream(stream)).map_err(|error| {
        proxy_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Local AI proxy failed to build response: {error}"),
        )
    })
}

impl OpenAiTranslatedStreamState {
    fn new(endpoint: OpenAiStreamEndpoint, model: impl Into<String>, id_prefix: &str) -> Self {
        Self {
            endpoint,
            stream_id: format!("{id_prefix}-{}", Uuid::new_v4().simple()),
            model: model.into(),
            accumulated_text: String::new(),
            usage: LocalAiProxyTokenUsage::default(),
            role_sent: false,
            response_created: false,
            done_emitted: false,
            finish_reason: None,
        }
    }

    fn update_stream_id(&mut self, stream_id: Option<&str>) {
        if let Some(value) = stream_id.map(str::trim).filter(|value| !value.is_empty()) {
            self.stream_id = value.to_string();
        }
    }

    fn update_model(&mut self, model: Option<&str>) {
        if let Some(value) = model.map(str::trim).filter(|value| !value.is_empty()) {
            self.model = value.to_string();
        }
    }

    fn ensure_response_created(&mut self) -> Option<Bytes> {
        if self.endpoint != OpenAiStreamEndpoint::Responses || self.response_created {
            return None;
        }

        self.response_created = true;
        Some(sse_json_bytes(build_openai_response_created_event(
            &self.stream_id,
            &self.model,
        )))
    }

    fn push_text_delta(&mut self, text: &str) -> Vec<Bytes> {
        if text.is_empty() {
            return Vec::new();
        }

        self.accumulated_text.push_str(text);

        match self.endpoint {
            OpenAiStreamEndpoint::ChatCompletions => {
                let mut events = Vec::new();
                if !self.role_sent {
                    self.role_sent = true;
                    events.push(sse_json_bytes(build_openai_chat_stream_chunk(
                        &self.stream_id,
                        &self.model,
                        json!({ "role": "assistant" }),
                        None,
                    )));
                }
                events.push(sse_json_bytes(build_openai_chat_stream_chunk(
                    &self.stream_id,
                    &self.model,
                    json!({ "content": text }),
                    None,
                )));
                events
            }
            OpenAiStreamEndpoint::Responses => {
                let mut events = Vec::new();
                if let Some(created) = self.ensure_response_created() {
                    events.push(created);
                }
                events.push(sse_json_bytes(build_openai_response_delta_event(
                    &self.stream_id,
                    text,
                )));
                events
            }
        }
    }

    fn complete(&mut self, finish_reason: Option<&str>) -> Vec<Bytes> {
        if let Some(value) = finish_reason
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            self.finish_reason = Some(value.to_string());
        }

        if self.done_emitted {
            return Vec::new();
        }
        self.done_emitted = true;

        match self.endpoint {
            OpenAiStreamEndpoint::ChatCompletions => {
                let finish_reason = self.finish_reason.as_deref().unwrap_or("stop");
                vec![
                    sse_json_bytes(build_openai_chat_stream_chunk(
                        &self.stream_id,
                        &self.model,
                        json!({}),
                        Some(finish_reason),
                    )),
                    sse_done_bytes(),
                ]
            }
            OpenAiStreamEndpoint::Responses => {
                let mut events = Vec::new();
                if let Some(created) = self.ensure_response_created() {
                    events.push(created);
                }
                events.push(sse_json_bytes(build_openai_response_completed_event(
                    &self.stream_id,
                    &self.model,
                    &self.accumulated_text,
                    &self.usage,
                )));
                events
            }
        }
    }

    fn merge_usage(&mut self, usage: &LocalAiProxyTokenUsage) {
        self.usage.input_tokens = self.usage.input_tokens.max(usage.input_tokens);
        self.usage.output_tokens = self.usage.output_tokens.max(usage.output_tokens);
        self.usage.cache_tokens = self.usage.cache_tokens.max(usage.cache_tokens);
        let prompt_completion_total = self
            .usage
            .input_tokens
            .saturating_add(self.usage.output_tokens);
        let merged_total = usage.total_tokens.max(if prompt_completion_total > 0 {
            prompt_completion_total
        } else {
            self.usage.cache_tokens
        });
        self.usage.total_tokens = self.usage.total_tokens.max(merged_total);
    }

    fn merge_usage_from_payload(&mut self, payload: &Value) {
        let usage = extract_token_usage(payload);
        self.merge_usage(&usage);
    }
}

fn openai_stream_endpoint_for_suffix(
    endpoint_suffix: &str,
) -> ProxyHttpResult<OpenAiStreamEndpoint> {
    match endpoint_suffix {
        "chat/completions" => Ok(OpenAiStreamEndpoint::ChatCompletions),
        "responses" => Ok(OpenAiStreamEndpoint::Responses),
        _ => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported OpenAI-compatible streaming endpoint: {endpoint_suffix}"),
        )),
    }
}

fn is_openai_stream_request(payload: &Value) -> bool {
    payload
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn build_openai_response_object_from_stream(id: &str, model: &str, text: &str) -> Value {
    json!({
        "id": id,
        "object": "response",
        "model": model,
        "output": [{
            "type": "message",
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": text,
                "annotations": []
            }]
        }]
    })
}

fn build_openai_response_usage(usage: &LocalAiProxyTokenUsage) -> Option<Value> {
    if usage == &LocalAiProxyTokenUsage::default() {
        return None;
    }

    let mut response_usage = json!({
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "total_tokens": usage.total_tokens,
    });
    if usage.cache_tokens > 0 {
        response_usage["input_tokens_details"] = json!({
            "cached_tokens": usage.cache_tokens,
        });
    }

    Some(response_usage)
}

fn build_openai_chat_stream_chunk(
    id: &str,
    model: &str,
    delta: Value,
    finish_reason: Option<&str>,
) -> Value {
    json!({
        "id": id,
        "object": "chat.completion.chunk",
        "created": 0,
        "model": model,
        "choices": [{
            "index": 0,
            "delta": delta,
            "finish_reason": finish_reason
        }]
    })
}

fn build_openai_response_created_event(id: &str, model: &str) -> Value {
    json!({
        "type": "response.created",
        "response": {
            "id": id,
            "object": "response",
            "model": model,
            "output": []
        }
    })
}

fn build_openai_response_delta_event(id: &str, delta: &str) -> Value {
    json!({
        "type": "response.output_text.delta",
        "response_id": id,
        "output_index": 0,
        "content_index": 0,
        "delta": delta
    })
}

fn build_openai_response_completed_event(
    id: &str,
    model: &str,
    text: &str,
    usage: &LocalAiProxyTokenUsage,
) -> Value {
    let mut response = build_openai_response_object_from_stream(id, model, text);
    if let Some(response_usage) = build_openai_response_usage(usage) {
        response["usage"] = response_usage;
    }

    json!({
        "type": "response.completed",
        "response": response
    })
}

fn sse_json_bytes(value: Value) -> Bytes {
    Bytes::from(format!("data: {}\n\n", value))
}

fn sse_done_bytes() -> Bytes {
    Bytes::from("data: [DONE]\n\n")
}

fn drain_sse_frames(buffer: &mut String) -> Vec<ParsedSseEvent> {
    *buffer = buffer.replace("\r\n", "\n");
    let mut frames = Vec::new();

    while let Some(index) = buffer.find("\n\n") {
        let frame_text = buffer[..index].to_string();
        *buffer = buffer[index + 2..].to_string();
        if let Some(frame) = parse_sse_frame(&frame_text) {
            frames.push(frame);
        }
    }

    frames
}

fn flush_sse_frame(buffer: &mut String) -> Option<ParsedSseEvent> {
    *buffer = buffer.replace("\r\n", "\n");
    let trailing = buffer.trim();
    if trailing.is_empty() {
        return None;
    }

    parse_sse_frame(trailing)
}

fn parse_sse_frame(frame: &str) -> Option<ParsedSseEvent> {
    let mut event = None;
    let mut data_lines = Vec::new();

    for line in frame.lines() {
        if let Some(value) = line.strip_prefix("event:") {
            event = Some(value.trim().to_string());
            continue;
        }
        if let Some(value) = line.strip_prefix("data:") {
            data_lines.push(value.trim_start().to_string());
        }
    }

    if data_lines.is_empty() {
        return None;
    }

    Some(ParsedSseEvent {
        event,
        data: data_lines.join("\n"),
    })
}

async fn build_translated_openai_sse_response<F, G>(
    status: StatusCode,
    response: reqwest::Response,
    mut state: OpenAiTranslatedStreamState,
    mut map_frame: F,
    request_started_at: Instant,
    on_complete: G,
) -> ProxyHttpResult<Response>
where
    F: FnMut(&mut OpenAiTranslatedStreamState, ParsedSseEvent) -> Vec<Bytes> + Send + 'static,
    G: FnOnce(LocalAiProxyTokenUsage, Option<u64>, Option<String>) + Send + 'static,
{
    let stream = async_stream::stream! {
        let mut upstream = response;
        let mut buffer = String::new();
        let mut first_chunk_latency_ms = None;
        let mut on_complete = Some(on_complete);

        loop {
            match upstream.chunk().await {
                Ok(Some(chunk)) => {
                    buffer.push_str(&String::from_utf8_lossy(&chunk));
                    for frame in drain_sse_frames(&mut buffer) {
                        for translated_chunk in map_frame(&mut state, frame) {
                            if first_chunk_latency_ms.is_none() {
                                first_chunk_latency_ms =
                                    Some(duration_to_ms(request_started_at.elapsed()));
                            }
                            yield Ok::<Bytes, std::io::Error>(translated_chunk);
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        if let Some(frame) = flush_sse_frame(&mut buffer) {
            for translated_chunk in map_frame(&mut state, frame) {
                if first_chunk_latency_ms.is_none() {
                    first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
                }
                yield Ok::<Bytes, std::io::Error>(translated_chunk);
            }
        }

        for translated_chunk in state.complete(None) {
            if first_chunk_latency_ms.is_none() {
                first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
            }
            yield Ok::<Bytes, std::io::Error>(translated_chunk);
        }

        if let Some(on_complete) = on_complete.take() {
            on_complete(
                state.usage.clone(),
                first_chunk_latency_ms,
                trim_optional_text(&state.accumulated_text),
            );
        }
    };

    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, HeaderValue::from_static("text/event-stream"))
        .body(Body::from_stream(stream))
        .map_err(|error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build translated SSE response: {error}"),
            )
        })
}

fn handle_anthropic_openai_stream_frame(
    state: &mut OpenAiTranslatedStreamState,
    frame: ParsedSseEvent,
) -> Vec<Bytes> {
    if frame.data.trim() == "[DONE]" {
        return state.complete(None);
    }

    let Ok(payload) = serde_json::from_str::<Value>(&frame.data) else {
        return Vec::new();
    };

    let event_name = frame
        .event
        .as_deref()
        .or_else(|| payload.get("type").and_then(Value::as_str))
        .unwrap_or_default();

    match event_name {
        "message_start" => {
            state.update_stream_id(payload.pointer("/message/id").and_then(Value::as_str));
            state.update_model(payload.pointer("/message/model").and_then(Value::as_str));
            if let Some(message) = payload.get("message") {
                state.merge_usage_from_payload(message);
            }
            state.ensure_response_created().into_iter().collect()
        }
        "content_block_delta" => {
            if payload.pointer("/delta/type").and_then(Value::as_str) != Some("text_delta") {
                return Vec::new();
            }

            payload
                .pointer("/delta/text")
                .and_then(Value::as_str)
                .map(|text| state.push_text_delta(text))
                .unwrap_or_default()
        }
        "message_delta" => {
            state.merge_usage_from_payload(&payload);
            state.finish_reason = payload
                .pointer("/delta/stop_reason")
                .and_then(Value::as_str)
                .map(|reason| map_anthropic_stop_reason(Some(reason)))
                .map(str::to_string);
            Vec::new()
        }
        "message_stop" => {
            let finish_reason = state.finish_reason.clone();
            state.complete(finish_reason.as_deref())
        }
        _ => Vec::new(),
    }
}

fn map_gemini_finish_reason(reason: Option<&str>) -> Option<&'static str> {
    match reason.unwrap_or_default() {
        "MAX_TOKENS" => Some("length"),
        "STOP" | "FINISH_REASON_UNSPECIFIED" => Some("stop"),
        "" => None,
        _ => Some("stop"),
    }
}

fn handle_gemini_openai_stream_frame(
    state: &mut OpenAiTranslatedStreamState,
    frame: ParsedSseEvent,
) -> Vec<Bytes> {
    if frame.data.trim() == "[DONE]" {
        return state.complete(None);
    }

    let Ok(payload) = serde_json::from_str::<Value>(&frame.data) else {
        return Vec::new();
    };

    let mut events = Vec::new();
    state.merge_usage_from_payload(&payload);
    let text = extract_gemini_response_text(&payload);
    if !text.is_empty() {
        events.extend(state.push_text_delta(&text));
    }

    let finish_reason = map_gemini_finish_reason(
        payload
            .pointer("/candidates/0/finishReason")
            .and_then(Value::as_str),
    );
    if finish_reason.is_some() {
        events.extend(state.complete(finish_reason));
    }

    events
}

fn current_snapshot(state: &LocalAiProxyAppState) -> ProxyHttpResult<LocalAiProxySnapshot> {
    state
        .snapshot
        .lock()
        .map(|snapshot| snapshot.clone())
        .map_err(|_| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Local AI proxy snapshot lock is unavailable.",
            )
        })
}

fn require_route_for_protocol<'a>(
    snapshot: &'a LocalAiProxySnapshot,
    client_protocol: &str,
) -> ProxyHttpResult<&'a LocalAiProxyRouteSnapshot> {
    snapshot
        .route_for_client_protocol(client_protocol)
        .ok_or_else(|| {
            proxy_error(
                StatusCode::SERVICE_UNAVAILABLE,
                &format!("No active {client_protocol} route is available for the local AI proxy."),
            )
        })
}

fn require_client_auth(headers: &HeaderMap, expected_token: &str) -> ProxyHttpResult<()> {
    let expected_header = format!("Bearer {}", expected_token.trim());
    let authorization = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    let x_api_key = header_text(headers, X_API_KEY_HEADER).unwrap_or_default();
    let x_goog_api_key = header_text(headers, X_GOOG_API_KEY_HEADER).unwrap_or_default();

    if authorization == expected_header
        || x_api_key == expected_token.trim()
        || x_goog_api_key == expected_token.trim()
    {
        return Ok(());
    }

    Err(proxy_error(
        StatusCode::UNAUTHORIZED,
        "Local AI proxy client authorization failed.",
    ))
}

fn proxy_error(status: StatusCode, message: &str) -> (StatusCode, Json<Value>) {
    (status, Json(json!({ "error": message })))
}

fn header_text(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn parse_json_body(body: &Bytes) -> ProxyHttpResult<Value> {
    serde_json::from_slice(body).map_err(|error| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            &format!("Invalid JSON request body for local AI proxy: {error}"),
        )
    })
}

async fn parse_json_response(response: reqwest::Response) -> ProxyHttpResult<Value> {
    response.json::<Value>().await.map_err(|error| {
        proxy_error(
            StatusCode::BAD_GATEWAY,
            &format!("Local AI proxy failed to decode upstream JSON response: {error}"),
        )
    })
}

fn build_json_response(status: StatusCode, body: Value) -> ProxyHttpResult<Response> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
        .body(Body::from(body.to_string()))
        .map_err(|error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build JSON response: {error}"),
            )
        })
}

fn resolve_request_model_id(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<String> {
    payload
        .get("model")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            if route.default_model_id.trim().is_empty() {
                None
            } else {
                Some(route.default_model_id.trim().to_string())
            }
        })
        .ok_or_else(|| {
            proxy_error(
                StatusCode::BAD_REQUEST,
                "OpenAI-compatible request must specify a non-empty model id.",
            )
        })
}

fn extract_openai_text_content(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        }
        Value::Array(items) => {
            let parts = items
                .iter()
                .filter_map(extract_openai_text_content)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>();
            (!parts.is_empty()).then(|| parts.join("\n"))
        }
        Value::Object(object) => object
            .get("text")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .or_else(|| object.get("content").and_then(extract_openai_text_content)),
        _ => None,
    }
}

fn extract_openai_chat_conversation(
    payload: &Value,
) -> ProxyHttpResult<(Option<String>, Vec<(String, String)>)> {
    let messages = payload
        .get("messages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            proxy_error(
                StatusCode::BAD_REQUEST,
                "OpenAI-compatible chat requests must include a messages array.",
            )
        })?;
    let mut system_parts = Vec::new();
    let mut conversation = Vec::new();

    for entry in messages {
        let Some(object) = entry.as_object() else {
            continue;
        };
        let role = object
            .get("role")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        let Some(content) = object
            .get("content")
            .and_then(extract_openai_text_content)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };

        match role {
            "system" => system_parts.push(content),
            "user" | "assistant" => conversation.push((role.to_string(), content)),
            _ => {}
        }
    }

    if conversation.is_empty() {
        return Err(proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI-compatible chat requests must include at least one user or assistant message.",
        ));
    }

    Ok((
        (!system_parts.is_empty()).then(|| system_parts.join("\n\n")),
        conversation,
    ))
}

fn extract_openai_response_conversation(
    payload: &Value,
) -> ProxyHttpResult<(Option<String>, Vec<(String, String)>)> {
    let system = payload
        .get("instructions")
        .and_then(extract_openai_text_content)
        .filter(|value| !value.is_empty());
    let input = payload.get("input").ok_or_else(|| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI responses requests must include an input field.",
        )
    })?;

    let conversation = match input {
        Value::String(text) => {
            let trimmed = text.trim();
            (!trimmed.is_empty())
                .then(|| vec![("user".to_string(), trimmed.to_string())])
                .unwrap_or_default()
        }
        Value::Array(items) => items
            .iter()
            .filter_map(|entry| match entry {
                Value::String(text) => {
                    let trimmed = text.trim();
                    (!trimmed.is_empty()).then(|| ("user".to_string(), trimmed.to_string()))
                }
                Value::Object(object) => {
                    let role = object
                        .get("role")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .unwrap_or("user");
                    let content = object
                        .get("content")
                        .and_then(extract_openai_text_content)
                        .filter(|value| !value.is_empty())?;
                    Some((role.to_string(), content))
                }
                _ => None,
            })
            .collect::<Vec<_>>(),
        _ => Vec::new(),
    };

    if conversation.is_empty() {
        return Err(proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI responses requests must include at least one text input.",
        ));
    }

    Ok((system, conversation))
}

fn read_request_max_tokens(payload: &Value, fallback: u64) -> u64 {
    payload
        .get("max_tokens")
        .and_then(Value::as_u64)
        .or_else(|| payload.get("max_completion_tokens").and_then(Value::as_u64))
        .or_else(|| payload.get("max_output_tokens").and_then(Value::as_u64))
        .unwrap_or(fallback)
}

fn build_anthropic_request_from_openai_chat(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    let (system, conversation) = extract_openai_chat_conversation(payload)?;
    let mut root = serde_json::Map::new();
    root.insert("model".to_string(), Value::String(model_id));
    root.insert(
        "max_tokens".to_string(),
        Value::from(read_request_max_tokens(payload, 8192)),
    );
    root.insert(
        "messages".to_string(),
        Value::Array(
            conversation
                .into_iter()
                .map(|(role, content)| {
                    json!({
                        "role": role,
                        "content": content,
                    })
                })
                .collect(),
        ),
    );
    if let Some(system) = system {
        root.insert("system".to_string(), Value::String(system));
    }
    if let Some(value) = payload.get("temperature").and_then(Value::as_f64) {
        root.insert("temperature".to_string(), Value::from(value));
    }
    if let Some(value) = payload.get("top_p").and_then(Value::as_f64) {
        root.insert("top_p".to_string(), Value::from(value));
    }
    if is_openai_stream_request(payload) {
        root.insert("stream".to_string(), Value::Bool(true));
    }

    Ok(Value::Object(root))
}

fn build_anthropic_request_from_openai_response(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    let (system, conversation) = extract_openai_response_conversation(payload)?;
    let mut root = serde_json::Map::new();
    root.insert("model".to_string(), Value::String(model_id));
    root.insert(
        "max_tokens".to_string(),
        Value::from(read_request_max_tokens(payload, 8192)),
    );
    root.insert(
        "messages".to_string(),
        Value::Array(
            conversation
                .into_iter()
                .map(|(role, content)| {
                    json!({
                        "role": if role == "assistant" { "assistant" } else { "user" },
                        "content": content,
                    })
                })
                .collect(),
        ),
    );
    if let Some(system) = system {
        root.insert("system".to_string(), Value::String(system));
    }
    if is_openai_stream_request(payload) {
        root.insert("stream".to_string(), Value::Bool(true));
    }

    Ok(Value::Object(root))
}

fn build_gemini_request_from_openai_chat(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let _ = resolve_request_model_id(route, payload)?;
    let (system, conversation) = extract_openai_chat_conversation(payload)?;
    Ok(build_gemini_generate_content_payload(
        &conversation,
        system.as_deref(),
        payload,
    ))
}

fn build_gemini_request_from_openai_response(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let _ = resolve_request_model_id(route, payload)?;
    let (system, conversation) = extract_openai_response_conversation(payload)?;
    Ok(build_gemini_generate_content_payload(
        &conversation,
        system.as_deref(),
        payload,
    ))
}

fn build_gemini_generate_content_payload(
    conversation: &[(String, String)],
    system: Option<&str>,
    payload: &Value,
) -> Value {
    let mut contents = Vec::new();
    for (role, content) in conversation.iter() {
        contents.push(json!({
            "role": if role == "assistant" { "model" } else { "user" },
            "parts": [{ "text": content }],
        }));
    }

    let mut generation_config = serde_json::Map::new();
    if let Some(value) = payload.get("temperature").and_then(Value::as_f64) {
        generation_config.insert("temperature".to_string(), Value::from(value));
    }
    if let Some(value) = payload.get("top_p").and_then(Value::as_f64) {
        generation_config.insert("topP".to_string(), Value::from(value));
    }
    generation_config.insert(
        "maxOutputTokens".to_string(),
        Value::from(read_request_max_tokens(payload, 8192)),
    );

    let mut root = serde_json::Map::new();
    root.insert("contents".to_string(), Value::Array(contents));
    if let Some(system) = system.map(str::trim).filter(|value| !value.is_empty()) {
        root.insert(
            "systemInstruction".to_string(),
            json!({
                "parts": [{ "text": system }]
            }),
        );
    }
    root.insert(
        "generationConfig".to_string(),
        Value::Object(generation_config),
    );
    Value::Object(root)
}

fn build_gemini_request_from_openai_embeddings(payload: &Value) -> ProxyHttpResult<Value> {
    let input = payload.get("input").ok_or_else(|| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI embeddings requests must include an input field.",
        )
    })?;
    let Some(text) = extract_openai_text_content(input).filter(|value| !value.is_empty()) else {
        return Err(proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI embeddings requests must include a non-empty text input.",
        ));
    };

    Ok(json!({
        "content": {
            "parts": [{ "text": text }]
        }
    }))
}

fn extract_anthropic_response_text(payload: &Value) -> String {
    payload
        .get("content")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|entry| entry.get("text").and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
}

fn map_anthropic_stop_reason(reason: Option<&str>) -> &'static str {
    match reason.unwrap_or_default() {
        "max_tokens" => "length",
        _ => "stop",
    }
}

fn build_openai_chat_completion_from_anthropic(
    route: &LocalAiProxyRouteSnapshot,
    upstream_body: &Value,
) -> Value {
    let content = extract_anthropic_response_text(upstream_body);
    let prompt_tokens = upstream_body
        .pointer("/usage/input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let completion_tokens = upstream_body
        .pointer("/usage/output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);

    json!({
        "id": upstream_body.get("id").and_then(Value::as_str).unwrap_or("chatcmpl-local-proxy"),
        "object": "chat.completion",
        "created": 0,
        "model": upstream_body.get("model").and_then(Value::as_str).unwrap_or(route.default_model_id.as_str()),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": content,
            },
            "finish_reason": map_anthropic_stop_reason(upstream_body.get("stop_reason").and_then(Value::as_str)),
        }],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
    })
}

fn extract_gemini_response_text(payload: &Value) -> String {
    payload
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|entry| entry.get("text").and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
}

fn build_openai_chat_completion_from_gemini(
    route: &LocalAiProxyRouteSnapshot,
    upstream_body: &Value,
) -> Value {
    json!({
        "id": "chatcmpl-local-proxy",
        "object": "chat.completion",
        "created": 0,
        "model": route.default_model_id,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": extract_gemini_response_text(upstream_body),
            },
            "finish_reason": "stop",
        }]
    })
}

fn build_openai_response_from_anthropic(
    route: &LocalAiProxyRouteSnapshot,
    upstream_body: &Value,
) -> Value {
    let text = extract_anthropic_response_text(upstream_body);
    let usage = extract_token_usage(upstream_body);
    let mut response = json!({
        "id": upstream_body.get("id").and_then(Value::as_str).unwrap_or("resp-local-proxy"),
        "object": "response",
        "model": upstream_body.get("model").and_then(Value::as_str).unwrap_or(route.default_model_id.as_str()),
        "output": [{
            "type": "message",
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": text,
                "annotations": []
            }]
        }]
    });
    if let Some(response_usage) = build_openai_response_usage(&usage) {
        response["usage"] = response_usage;
    }
    response
}

fn build_openai_response_from_gemini(
    route: &LocalAiProxyRouteSnapshot,
    upstream_body: &Value,
) -> Value {
    let usage = extract_token_usage(upstream_body);
    let mut response = json!({
        "id": "resp-local-proxy",
        "object": "response",
        "model": route.default_model_id,
        "output": [{
            "type": "message",
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": extract_gemini_response_text(upstream_body),
                "annotations": []
            }]
        }]
    });
    if let Some(response_usage) = build_openai_response_usage(&usage) {
        response["usage"] = response_usage;
    }
    response
}

fn build_openai_embeddings_from_gemini(upstream_body: &Value) -> Value {
    json!({
        "object": "list",
        "data": [{
            "object": "embedding",
            "index": 0,
            "embedding": upstream_body.pointer("/embedding/values").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
        }]
    })
}

fn infer_gemini_default_api_version(base_url: &str) -> &'static str {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        "v1"
    } else {
        "v1beta"
    }
}

fn parse_model_action(model_action: &str) -> Option<(&str, &str)> {
    let (model_id, action) = model_action.split_once(':')?;
    let model_id = model_id.trim();
    let action = action.trim();
    if model_id.is_empty() || action.is_empty() {
        return None;
    }

    Some((model_id, action))
}

fn gemini_supported_generation_methods(
    route: &LocalAiProxyRouteSnapshot,
    model_id: &str,
) -> Vec<&'static str> {
    let is_embedding = route.embedding_model_id.as_deref() == Some(model_id);
    let is_generation = route.default_model_id == model_id
        || route.reasoning_model_id.as_deref() == Some(model_id)
        || !is_embedding;

    let mut methods = Vec::new();
    if is_generation {
        methods.push("generateContent");
        methods.push("streamGenerateContent");
    }
    if is_embedding {
        methods.push("embedContent");
        methods.push("batchEmbedContents");
    }
    methods
}

fn build_gemini_upstream_request_url(
    route: &LocalAiProxyRouteSnapshot,
    api_version: &str,
    model_action: &str,
    query: Option<&str>,
) -> String {
    let base = normalize_gemini_upstream_base_url(&route.upstream_base_url, api_version);
    let mut url = format!("{}/models/{}", base.trim_end_matches('/'), model_action);
    if let Some(query) = query.map(str::trim).filter(|value| !value.is_empty()) {
        url.push('?');
        url.push_str(query);
    }
    url
}

fn normalize_gemini_upstream_base_url(base_url: &str, api_version: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/v1beta") || trimmed.ends_with("/v1") {
        let prefix = trimmed
            .rsplit_once('/')
            .map(|(prefix, _)| prefix)
            .unwrap_or(trimmed);
        return format!("{prefix}/{api_version}");
    }

    format!("{trimmed}/{api_version}")
}

fn build_health(
    snapshot: &LocalAiProxySnapshot,
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

fn collect_default_route_health(
    snapshot: &LocalAiProxySnapshot,
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

fn ensure_local_ai_proxy_config(paths: &AppPaths) -> Result<LocalAiProxyConfigFile> {
    if !paths.local_ai_proxy_config_file.exists() {
        let config = LocalAiProxyConfigFile {
            schema_version: LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION,
            bind_host: LOCAL_AI_PROXY_DEFAULT_BIND_HOST.to_string(),
            public_base_host: default_local_ai_proxy_public_host(),
            requested_port: LOCAL_AI_PROXY_DEFAULT_PORT,
            client_api_key: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
        };
        fs::write(
            &paths.local_ai_proxy_config_file,
            format!("{}\n", serde_json::to_string_pretty(&config)?),
        )?;
        return Ok(config);
    }

    let content = fs::read_to_string(&paths.local_ai_proxy_config_file)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid local ai proxy config: {error}"))
    })?;
    let object = parsed.as_object().ok_or_else(|| {
        FrameworkError::ValidationFailed("local ai proxy config must be a JSON object".to_string())
    })?;

    Ok(LocalAiProxyConfigFile {
        schema_version: object
            .get("schemaVersion")
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION),
        bind_host: object
            .get("bindHost")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(LOCAL_AI_PROXY_DEFAULT_BIND_HOST)
            .to_string(),
        requested_port: object
            .get("requestedPort")
            .and_then(Value::as_u64)
            .and_then(|value| u16::try_from(value).ok())
            .unwrap_or(LOCAL_AI_PROXY_DEFAULT_PORT),
        client_api_key: object
            .get("clientApiKey")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)
            .to_string(),
        public_base_host: normalize_local_ai_proxy_public_host(
            object.get("publicBaseHost").and_then(Value::as_str),
        ),
    })
}

pub(crate) fn default_local_ai_proxy_public_host() -> String {
    let mut resolver = resolve_local_ai_proxy_public_host_addresses;
    resolve_default_local_ai_proxy_public_host_with_resolver(&mut resolver)
}

fn normalize_local_ai_proxy_public_host(value: Option<&str>) -> String {
    let mut resolver = resolve_local_ai_proxy_public_host_addresses;
    normalize_local_ai_proxy_public_host_with_resolver(value, &mut resolver)
}

fn normalize_local_ai_proxy_public_host_with_resolver<F>(
    value: Option<&str>,
    resolver: &mut F,
) -> String
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    let Some(candidate) = value
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
    else {
        return resolve_default_local_ai_proxy_public_host_with_resolver(resolver);
    };

    if local_ai_proxy_public_host_is_loopback_safe_with_resolver(candidate, resolver) {
        return candidate.to_string();
    }

    resolve_default_local_ai_proxy_public_host_with_resolver(resolver)
}

fn resolve_default_local_ai_proxy_public_host_with_resolver<F>(resolver: &mut F) -> String
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    for candidate in LOCAL_AI_PROXY_PUBLIC_BASE_HOST_CANDIDATES {
        if local_ai_proxy_public_host_is_loopback_safe_with_resolver(candidate, resolver) {
            return candidate.to_string();
        }
    }

    "127.0.0.1".to_string()
}

fn local_ai_proxy_public_host_is_loopback_safe_with_resolver<F>(
    host: &str,
    resolver: &mut F,
) -> bool
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    let candidate = host.trim().trim_matches(['[', ']']);
    if candidate.is_empty() {
        return false;
    }

    let addresses = resolver(candidate);
    !addresses.is_empty() && addresses.iter().all(IpAddr::is_loopback)
}

fn resolve_local_ai_proxy_public_host_addresses(host: &str) -> Vec<IpAddr> {
    if let Ok(address) = host.parse::<IpAddr>() {
        return vec![address];
    }

    (host, 0)
        .to_socket_addrs()
        .map(|entries| entries.map(|entry| entry.ip()).collect())
        .unwrap_or_default()
}

fn is_loopback_host(value: &str) -> bool {
    let normalized = value.trim().trim_matches(['[', ']']).to_ascii_lowercase();
    normalized == "127.0.0.1"
        || normalized == "::1"
        || normalized == "localhost"
        || normalized.ends_with(".localhost")
}

fn read_openclaw_config_root(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let content = fs::read_to_string(path)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid managed openclaw config: {error}"))
    })?;

    if parsed.is_object() {
        return Ok(parsed);
    }

    Err(FrameworkError::ValidationFailed(format!(
        "managed openclaw config must be a JSON object: {}",
        path.display()
    )))
}

fn write_openclaw_config_root(path: &Path, root: &Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, format!("{}\n", serde_json::to_string_pretty(root)?))?;
    Ok(())
}

fn resolve_default_route_model_id(route: &LocalAiProxyRouteSnapshot) -> Result<String> {
    route.default_model_id
        .trim()
        .to_string()
        .chars()
        .next()
        .map(|_| route.default_model_id.trim().to_string())
        .or_else(|| {
            route.models
                .iter()
                .find_map(|model| {
                    let model_id = model.id.trim();
                    (!model_id.is_empty()).then(|| model_id.to_string())
                })
        })
        .ok_or_else(|| {
            FrameworkError::ValidationFailed(
                "local ai proxy default route must expose at least one model before it can be projected into openclaw"
                    .to_string(),
            )
        })
}

fn clear_legacy_openclaw_provider_runtime_config(
    provider_root: &mut serde_json::Map<String, Value>,
) {
    for key in ["temperature", "topP", "maxTokens", "timeoutMs", "streaming"] {
        provider_root.remove(key);
    }
}

fn should_overwrite_managed_provider_defaults(root: &Value, provider_id: &str) -> bool {
    let Some(primary) = get_nested_string(root, &["agents", "defaults", "model", "primary"]) else {
        return true;
    };
    let Some((provider_key, _)) = primary.split_once('/') else {
        return true;
    };
    provider_key.trim() == provider_id.trim()
}

fn write_managed_provider_defaults(
    root: &mut Value,
    provider_id: &str,
    default_model_id: &str,
    reasoning_model_id: Option<&str>,
) {
    let defaults_model = ensure_json_object_mut(root, &["agents", "defaults", "model"]);
    defaults_model.insert(
        "primary".to_string(),
        Value::String(build_openclaw_model_ref(provider_id, default_model_id)),
    );
    defaults_model.insert(
        "fallbacks".to_string(),
        Value::Array(
            reasoning_model_id
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .filter(|value| *value != default_model_id)
                .map(|value| Value::String(build_openclaw_model_ref(provider_id, value)))
                .into_iter()
                .collect(),
        ),
    );
}

fn build_openclaw_model_ref(provider_id: &str, model_id: &str) -> String {
    format!("{}/{}", provider_id.trim(), model_id.trim())
}

fn build_openclaw_provider_models(
    existing_models: Vec<Value>,
    route: &LocalAiProxyRouteSnapshot,
    default_model_id: &str,
) -> Vec<Value> {
    let mut existing_by_id = std::collections::BTreeMap::new();
    let mut passthrough = Vec::new();
    for model in existing_models {
        let Some(model_id) = model
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            passthrough.push(model);
            continue;
        };
        existing_by_id.insert(model_id.to_string(), model);
    }

    let mut next = route
        .models
        .iter()
        .map(|model| {
            let model_id = model.id.trim();
            let mut next_model = existing_by_id
                .remove(model_id)
                .and_then(|value| value.as_object().cloned())
                .unwrap_or_default();
            next_model.insert("id".to_string(), Value::String(model_id.to_string()));
            next_model.insert(
                "name".to_string(),
                Value::String(model.name.trim().to_string()),
            );
            next_model.insert(
                "reasoning".to_string(),
                Value::Bool(route.reasoning_model_id.as_deref() == Some(model_id)),
            );
            next_model.insert(
                "input".to_string(),
                Value::Array(vec![Value::String("text".to_string())]),
            );
            next_model.insert(
                "cost".to_string(),
                json!({ "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }),
            );
            next_model.insert(
                "contextWindow".to_string(),
                Value::Number(serde_json::Number::from(
                    if route.embedding_model_id.as_deref() == Some(model_id) {
                        8_192
                    } else if route.reasoning_model_id.as_deref() == Some(model_id) {
                        200_000
                    } else {
                        128_000
                    },
                )),
            );
            next_model.insert(
                "maxTokens".to_string(),
                Value::Number(serde_json::Number::from(
                    if route.embedding_model_id.as_deref() == Some(model_id) {
                        8_192
                    } else {
                        32_000
                    },
                )),
            );
            Value::Object(next_model)
        })
        .collect::<Vec<_>>();

    if !route
        .models
        .iter()
        .any(|model| model.id.trim() == default_model_id.trim())
    {
        next.push(json!({
            "id": default_model_id.trim(),
            "name": default_model_id.trim(),
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 32000
        }));
    }

    next.extend(passthrough);
    next
}

fn ensure_json_object_mut<'a>(
    root: &'a mut Value,
    path: &[&str],
) -> &'a mut serde_json::Map<String, Value> {
    if !root.is_object() {
        *root = Value::Object(serde_json::Map::new());
    }

    let mut current = root;
    for segment in path {
        let object = current
            .as_object_mut()
            .expect("json object root should stay object");
        current = object
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Object(serde_json::Map::new()));
        if !current.is_object() {
            *current = Value::Object(serde_json::Map::new());
        }
    }

    current
        .as_object_mut()
        .expect("json object path should resolve to object")
}

fn get_nested_string(root: &Value, path: &[&str]) -> Option<String> {
    let mut current = root;
    for segment in path {
        current = current.get(*segment)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn append_proxy_log(path: &Path, message: &str) -> Result<()> {
    let mut current = if path.exists() {
        fs::read_to_string(path)?
    } else {
        String::new()
    };
    current.push_str(message);
    current.push('\n');
    fs::write(path, current)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        extract_token_usage, LocalAiProxyService, LocalAiProxyTokenUsage, OpenAiStreamEndpoint,
        OpenAiTranslatedStreamState,
    };
    use crate::framework::{
        config::AppConfig,
        paths::resolve_paths_for_root,
        services::local_ai_proxy_snapshot::{
            create_system_default_local_ai_proxy_snapshot, materialize_local_ai_proxy_snapshot,
            LocalAiProxyModelSnapshot, LocalAiProxyRouteSnapshot, LocalAiProxySnapshot,
            LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY, LOCAL_AI_PROXY_DEFAULT_PORT,
            LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE,
        },
        services::storage::StorageService,
        storage::{StorageProfileConfig, StorageProviderKind, StoragePutTextRequest},
    };
    use axum::{
        body::Bytes,
        extract::State,
        http::{HeaderMap, StatusCode},
        response::IntoResponse,
        routing::post,
        Json, Router,
    };
    use serde_json::{json, Value};
    use std::{
        fs,
        sync::{Arc, Mutex},
        time::{Duration, Instant},
    };

    #[test]
    fn local_ai_proxy_binds_only_to_loopback() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        assert_eq!(
            health.base_url,
            expected_test_public_v1_base_url(health.active_port)
        );
        assert!(health.loopback_only);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_health_exposes_protocol_default_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);

        let health = super::build_health(&snapshot, 18_791, &expected_test_public_host(), &paths);

        assert_eq!(
            health
                .default_routes
                .iter()
                .map(|route| route.client_protocol.as_str())
                .collect::<Vec<_>>(),
            vec!["openai-compatible", "anthropic", "gemini"]
        );
        assert_eq!(
            health
                .default_routes
                .iter()
                .map(|route| route.name.as_str())
                .collect::<Vec<_>>(),
            vec![
                "SDKWork Default",
                "SDKWork Anthropic Default",
                "SDKWork Gemini Default"
            ]
        );
        assert!(health
            .default_routes
            .iter()
            .all(|route| route.managed_by == "system-default"));
        assert!(health
            .default_routes
            .iter()
            .all(|route| route.model_count == 3));
    }

    #[test]
    fn local_ai_proxy_default_public_host_prefers_branded_host_when_it_resolves_to_loopback() {
        let mut resolver = |host: &str| match host {
            "ai.sdkwork.localhost" => vec!["127.0.0.1".parse().expect("loopback ip")],
            "localhost" => vec!["127.0.0.1".parse().expect("loopback ip")],
            "127.0.0.1" => vec!["127.0.0.1".parse().expect("loopback ip")],
            _ => Vec::new(),
        };

        assert_eq!(
            super::resolve_default_local_ai_proxy_public_host_with_resolver(&mut resolver),
            "ai.sdkwork.localhost"
        );
    }

    #[test]
    fn local_ai_proxy_default_public_host_falls_back_when_branded_host_is_not_loopback_safe() {
        let mut resolver = |host: &str| match host {
            "ai.sdkwork.localhost" => vec!["198.18.0.9".parse().expect("non-loopback ip")],
            "localhost" => vec![
                "127.0.0.1".parse().expect("ipv4 loopback"),
                "::1".parse().expect("ipv6 loopback"),
            ],
            "127.0.0.1" => vec!["127.0.0.1".parse().expect("loopback ip")],
            _ => Vec::new(),
        };

        assert_eq!(
            super::resolve_default_local_ai_proxy_public_host_with_resolver(&mut resolver),
            "localhost"
        );
    }

    #[test]
    fn local_ai_proxy_start_failure_marks_runtime_failed_and_records_the_error() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let mut snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);
        snapshot.bind_host = "invalid host name".to_string();

        let error = service
            .start(&paths, snapshot.clone())
            .expect_err("start should fail for an invalid bind host");
        let status = service.status().expect("status after failed start");

        assert!(error.to_string().contains("failed to bind local ai proxy"));
        assert_eq!(status.lifecycle, super::LocalAiProxyLifecycle::Failed);
        assert!(status.health.is_none());
        assert!(status
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains("failed to bind local ai proxy"));
    }

    #[test]
    fn local_ai_proxy_health_endpoint_reports_running_status() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let body = request_json("GET", &format!("{}/health", health.base_url), None, None);

        assert_eq!(body["status"], "ok");
        assert_eq!(body["service"], "local-ai-proxy");
        assert_eq!(
            body["defaultRouteId"],
            "local-ai-proxy-system-default-openai-compatible"
        );
        assert_eq!(body["defaultRouteName"], "SDKWork Default");
        assert_eq!(
            body["defaultRoutes"]
                .as_array()
                .expect("defaultRoutes array")
                .iter()
                .filter_map(|route| route.get("clientProtocol").and_then(Value::as_str))
                .collect::<Vec<_>>(),
            vec!["openai-compatible", "anthropic", "gemini"]
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_models_endpoint_projects_default_route_models() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-custom".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-custom".to_string(),
                name: "Custom OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: "https://api.openai.com/v1".to_string(),
                api_key: "sk-live".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "o4-mini".to_string(),
                        name: "o4-mini".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let body = request_json(
            "GET",
            &format!("{}/models", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            None,
        );

        assert_eq!(body["object"], "list");
        assert_eq!(body["data"][0]["id"], "gpt-5.4");
        assert_eq!(body["data"][1]["id"], "o4-mini");

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_chat_completions_forwards_to_selected_upstream_with_bearer_auth() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "hello" }],
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.authorization.as_deref(),
            Some("Bearer upstream-secret")
        );
        assert_eq!(capture.body["model"], "gpt-5.4");
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_route_metrics_after_successful_request() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "hello metrics" }],
            })),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-upstream")
            .expect("route metrics");

        assert_eq!(metrics.client_protocol, "openai-compatible");
        assert_eq!(metrics.upstream_protocol, "openai-compatible");
        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.rpm, 1);
        assert_eq!(metrics.total_tokens, 0);
        assert_eq!(metrics.input_tokens, 0);
        assert_eq!(metrics.output_tokens, 0);
        assert_eq!(metrics.cache_tokens, 0);
        assert!(metrics.average_latency_ms <= metrics.last_latency_ms.unwrap_or(u64::MAX));
        assert!(metrics.last_latency_ms.is_some());
        assert!(metrics.last_used_at.is_some());
        assert_eq!(metrics.last_error, None);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_translated_usage_when_upstream_usage_is_present() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [{ "role": "user", "content": "hello usage" }],
            })),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-anthropic-openai")
            .expect("route metrics");

        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.input_tokens, 12);
        assert_eq!(metrics.output_tokens, 8);
        assert_eq!(metrics.total_tokens, 20);
        assert_eq!(metrics.cache_tokens, 0);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_anthropic_streaming_usage_after_translation() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai-stream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai-stream".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [{ "role": "user", "content": "hello usage stream" }],
                "stream": true,
            }),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-anthropic-openai-stream")
            .expect("route metrics");

        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.input_tokens, 12);
        assert_eq!(metrics.output_tokens, 8);
        assert_eq!(metrics.total_tokens, 20);
        assert_eq!(metrics.cache_tokens, 0);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_gemini_streaming_usage_after_translation() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai-stream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai-stream".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gemini-2.5-pro",
                "messages": [{ "role": "user", "content": "hello usage stream" }],
                "stream": true,
            }),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-gemini-openai-stream")
            .expect("route metrics");

        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.input_tokens, 10);
        assert_eq!(metrics.output_tokens, 8);
        assert_eq!(metrics.total_tokens, 18);
        assert_eq!(metrics.cache_tokens, 0);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn extract_token_usage_does_not_double_count_cached_prompt_tokens_when_total_absent() {
        let usage = extract_token_usage(&json!({
            "usage": {
                "prompt_tokens": 12_307,
                "completion_tokens": 6,
                "prompt_tokens_details": {
                    "cached_tokens": 4_096
                }
            }
        }));

        assert_eq!(usage.input_tokens, 12_307);
        assert_eq!(usage.output_tokens, 6);
        assert_eq!(usage.cache_tokens, 4_096);
        assert_eq!(usage.total_tokens, 12_313);
    }

    #[test]
    fn extract_token_usage_reads_openai_responses_cached_input_tokens() {
        let usage = extract_token_usage(&json!({
            "usage": {
                "input_tokens": 12_307,
                "output_tokens": 6,
                "total_tokens": 12_313,
                "input_tokens_details": {
                    "cached_tokens": 4_096
                }
            }
        }));

        assert_eq!(usage.input_tokens, 12_307);
        assert_eq!(usage.output_tokens, 6);
        assert_eq!(usage.cache_tokens, 4_096);
        assert_eq!(usage.total_tokens, 12_313);
    }

    #[test]
    fn openai_stream_usage_merge_does_not_double_count_cached_prompt_tokens_in_total() {
        let mut state = OpenAiTranslatedStreamState::new(
            OpenAiStreamEndpoint::ChatCompletions,
            "gpt-5.4",
            "test-stream",
        );

        state.merge_usage(&LocalAiProxyTokenUsage {
            total_tokens: 12_307,
            input_tokens: 12_307,
            output_tokens: 0,
            cache_tokens: 4_096,
        });
        state.merge_usage(&LocalAiProxyTokenUsage {
            total_tokens: 0,
            input_tokens: 12_307,
            output_tokens: 6,
            cache_tokens: 4_096,
        });

        assert_eq!(state.usage.input_tokens, 12_307);
        assert_eq!(state.usage.output_tokens, 6);
        assert_eq!(state.usage.cache_tokens, 4_096);
        assert_eq!(state.usage.total_tokens, 12_313);
    }

    #[test]
    fn local_ai_proxy_persists_request_logs_with_stream_timings_and_message_capture_opt_in() {
        use crate::framework::services::local_ai_proxy_observability::{
            LocalAiProxyMessageLogsQuery, LocalAiProxyRequestLogsQuery,
        };

        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-observability".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-observability".to_string(),
                name: "OpenAI Observability".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let initial_settings = service
            .message_capture_settings(&paths)
            .expect("initial message capture settings");
        assert_eq!(initial_settings.enabled, false);

        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "capture disabled first" }],
            })),
        );

        let first_request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs after first request");
        let request_log = first_request_logs.items.first().expect("request log");
        assert_eq!(first_request_logs.total, 1);
        assert_eq!(request_log.provider_id, "openai");
        assert_eq!(request_log.model_id.as_deref(), Some("gpt-5.4"));
        assert_eq!(request_log.status, "succeeded");
        assert!(request_log.total_duration_ms > 0);

        let first_message_logs = service
            .list_message_logs(&paths, LocalAiProxyMessageLogsQuery::default())
            .expect("message logs should be queryable");
        assert_eq!(first_message_logs.total, 0);

        let updated_settings = service
            .update_message_capture_settings(&paths, true)
            .expect("enable message capture");
        assert_eq!(updated_settings.enabled, true);

        let _ = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "capture enabled second" }],
                "stream": true,
            }),
        );

        let request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs");
        let latest_request_log = request_logs.items.first().expect("latest request log");
        assert_eq!(request_logs.total, 2);
        assert_eq!(latest_request_log.provider_id, "openai");
        assert_eq!(latest_request_log.status, "succeeded");
        assert!(latest_request_log.ttft_ms.is_some());
        assert!(latest_request_log.total_duration_ms >= latest_request_log.ttft_ms.unwrap_or(0));

        let message_logs = service
            .list_message_logs(&paths, LocalAiProxyMessageLogsQuery::default())
            .expect("list message logs");
        let latest_message_log = message_logs.items.first().expect("message log");
        assert_eq!(message_logs.total, 1);
        assert_eq!(latest_message_log.provider_id, "openai");
        assert_eq!(latest_message_log.message_count, 1);
        assert_eq!(latest_message_log.messages[0].role, "user");
        assert_eq!(
            latest_message_log.messages[0].content,
            "capture enabled second"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_request_logs_capture_openai_prompt_completion_and_cache_usage() {
        use crate::framework::services::local_ai_proxy_observability::LocalAiProxyRequestLogsQuery;

        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-openai-usage".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-openai-usage".to_string(),
                name: "OpenAI Usage".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "usage detail request" }],
            })),
        );

        let request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs");
        let latest_request_log = request_logs.items.first().expect("latest request log");

        assert_eq!(latest_request_log.total_tokens, 12_313);
        assert_eq!(latest_request_log.prompt_tokens, 12_307);
        assert_eq!(latest_request_log.completion_tokens, 6);
        assert_eq!(latest_request_log.input_tokens, 12_307);
        assert_eq!(latest_request_log.output_tokens, 6);
        assert_eq!(latest_request_log.cache_tokens, 4_096);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_request_logs_capture_openai_responses_input_output_and_cache_usage() {
        use crate::framework::services::local_ai_proxy_observability::LocalAiProxyRequestLogsQuery;

        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-openai-responses-usage".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-openai-responses-usage".to_string(),
                name: "OpenAI Responses Usage".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "input": "responses usage detail request",
            })),
        );
        assert_eq!(
            response.pointer("/usage/input_tokens"),
            Some(&json!(12_307))
        );
        assert_eq!(response.pointer("/usage/output_tokens"), Some(&json!(6)));
        assert_eq!(
            response.pointer("/usage/total_tokens"),
            Some(&json!(12_313))
        );
        assert_eq!(
            response.pointer("/usage/input_tokens_details/cached_tokens"),
            Some(&json!(4_096))
        );

        let request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs");
        let latest_request_log = request_logs.items.first().expect("latest request log");

        assert_eq!(latest_request_log.endpoint, "/v1/responses");
        assert_eq!(latest_request_log.total_tokens, 12_313);
        assert_eq!(latest_request_log.prompt_tokens, 12_307);
        assert_eq!(latest_request_log.completion_tokens, 6);
        assert_eq!(latest_request_log.input_tokens, 12_307);
        assert_eq!(latest_request_log.output_tokens, 6);
        assert_eq!(latest_request_log.cache_tokens, 4_096);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_test_route_by_id_records_latest_successful_probe() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let result = service
            .test_route_by_id("route-upstream")
            .expect("probe should complete");

        assert_eq!(result.route_id, "route-upstream");
        assert_eq!(result.status, "passed");
        assert_eq!(result.checked_capability, "chat");
        assert_eq!(result.model_id.as_deref(), Some("gpt-5.4"));
        assert!(result.latency_ms.is_some());
        assert_eq!(result.error, None);

        let status = service.status().expect("status");
        let latest = status
            .route_tests
            .iter()
            .find(|entry| entry.route_id == "route-upstream")
            .expect("latest route test");
        assert_eq!(latest.status, "passed");
        assert_eq!(latest.checked_capability, "chat");

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_test_route_by_id_records_latest_failed_probe() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-failed-probe".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-failed-probe".to_string(),
                name: "Failed Probe Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: "http://127.0.0.1:9/v1".to_string(),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let result = service
            .test_route_by_id("route-failed-probe")
            .expect("probe should return a failure record");

        assert_eq!(result.route_id, "route-failed-probe");
        assert_eq!(result.status, "failed");
        assert_eq!(result.checked_capability, "chat");
        assert_eq!(result.model_id.as_deref(), Some("gpt-5.4"));
        assert!(result
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("failed"));

        let status = service.status().expect("status");
        let latest = status
            .route_tests
            .iter()
            .find(|entry| entry.route_id == "route-failed-probe")
            .expect("latest route test");
        assert_eq!(latest.status, "failed");
        assert!(latest
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("failed"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_endpoint_forwards_to_selected_upstream_with_bearer_auth() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "input": "hello responses",
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/responses"));
        assert_eq!(
            capture.authorization.as_deref(),
            Some("Bearer upstream-secret")
        );
        assert_eq!(capture.body["model"], "gpt-5.4");
        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "responses proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_anthropic_upstream_preserves_usage() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "claude-sonnet-4-20250514".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "input": "hello anthropic response",
            })),
        );

        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "anthropic proxied response"
        );
        assert_eq!(response.pointer("/usage/input_tokens"), Some(&json!(12)));
        assert_eq!(response.pointer("/usage/output_tokens"), Some(&json!(8)));
        assert_eq!(response.pointer("/usage/total_tokens"), Some(&json!(20)));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_gemini_upstream_preserves_usage() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gemini-2.5-pro",
                "input": "hello gemini response",
            })),
        );

        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "gemini proxied response"
        );
        assert_eq!(response.pointer("/usage/input_tokens"), Some(&json!(10)));
        assert_eq!(response.pointer("/usage/output_tokens"), Some(&json!(8)));
        assert_eq!(response.pointer("/usage/total_tokens"), Some(&json!(18)));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_embeddings_endpoint_forwards_to_selected_upstream_with_bearer_auth() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/embeddings", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "text-embedding-3-large",
                "input": "embed this text",
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/embeddings"));
        assert_eq!(
            capture.authorization.as_deref(),
            Some("Bearer upstream-secret")
        );
        assert_eq!(capture.body["model"], "text-embedding-3-large");
        assert_eq!(response["data"][0]["embedding"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_azure_openai_chat_completions_maps_to_v1_endpoint_with_api_key_header() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-azure".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-azure".to_string(),
                name: "Azure OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "azure-openai".to_string(),
                provider_id: "azure-openai".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "azure-upstream-secret".to_string(),
                default_model_id: "gpt-4.1".to_string(),
                reasoning_model_id: Some("gpt-4.1".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-4.1".to_string(),
                        name: "GPT-4.1".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-4.1",
                "messages": [{ "role": "user", "content": "hello azure" }],
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/openai/v1/chat/completions"));
        assert_eq!(capture.authorization, None);
        assert_eq!(capture.x_api_key.as_deref(), Some("azure-upstream-secret"));
        assert_eq!(capture.body["model"], "gpt-4.1");
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_anthropic_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [
                    { "role": "system", "content": "You are a precise assistant." },
                    { "role": "user", "content": "hello anthropic through openai" }
                ],
                "max_tokens": 256,
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/messages"));
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_api_key.as_deref(),
            Some("anthropic-upstream-secret")
        );
        assert_eq!(capture.anthropic_version.as_deref(), Some("2023-06-01"));
        assert_eq!(capture.body["model"], "claude-sonnet-4-20250514");
        assert_eq!(capture.body["system"], "You are a precise assistant.");
        assert_eq!(
            capture.body["messages"][0]["content"],
            "hello anthropic through openai"
        );
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "anthropic proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_anthropic_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [
                    { "role": "system", "content": "You are a precise assistant." },
                    { "role": "user", "content": "hello anthropic streaming" }
                ],
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/messages"));
        assert_eq!(capture.body["stream"], true);
        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first translated chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"object\":\"chat.completion.chunk\""));
        assert!(body.contains("anthropic stream chunk 1"));
        assert!(body.contains("anthropic stream chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_gemini_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gemini-2.5-pro",
                "messages": [
                    { "role": "system", "content": "You are a concise assistant." },
                    { "role": "user", "content": "hello gemini through openai" }
                ],
                "max_tokens": 512,
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:generateContent")
        );
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["systemInstruction"]["parts"][0]["text"],
            "You are a concise assistant."
        );
        assert_eq!(capture.body["contents"][0]["role"], "user");
        assert_eq!(
            capture.body["contents"][0]["parts"][0]["text"],
            "hello gemini through openai"
        );
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "gemini proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_gemini_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gemini-2.5-pro",
                "messages": [
                    { "role": "system", "content": "You are a concise assistant." },
                    { "role": "user", "content": "hello gemini streaming" }
                ],
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse")
        );
        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first translated chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"object\":\"chat.completion.chunk\""));
        assert!(body.contains("gemini stream chunk 1"));
        assert!(body.contains("gemini stream chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_anthropic_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "claude-sonnet-4-20250514".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (_, content_type, body) = request_streaming_response(
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "claude-sonnet-4-20250514",
                "input": "hello anthropic response stream",
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/messages"));
        assert_eq!(capture.body["stream"], true);
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"type\":\"response.output_text.delta\""));
        assert!(body.contains("anthropic stream chunk 1"));
        assert!(body.contains("anthropic stream chunk 2"));
        assert!(body.contains("\"type\":\"response.completed\""));
        assert!(body
            .contains("\"usage\":{\"input_tokens\":12,\"output_tokens\":8,\"total_tokens\":20}"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_gemini_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (_, content_type, body) = request_streaming_response(
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gemini-2.5-pro",
                "input": "hello gemini response stream",
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse")
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"type\":\"response.output_text.delta\""));
        assert!(body.contains("gemini stream chunk 1"));
        assert!(body.contains("gemini stream chunk 2"));
        assert!(body.contains("\"type\":\"response.completed\""));
        assert!(body
            .contains("\"usage\":{\"input_tokens\":10,\"output_tokens\":8,\"total_tokens\":18}"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_embeddings_translate_to_gemini_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/embeddings", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "text-embedding-004",
                "input": "embed this through gemini"
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/text-embedding-004:embedContent")
        );
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["content"]["parts"][0]["text"],
            "embed this through gemini"
        );
        assert_eq!(response["data"][0]["embedding"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_chat_completions_streaming_passthrough_preserves_first_chunk_latency() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "hello stream" }],
                "stream": true,
            }),
        );

        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("proxied chunk 1"));
        assert!(body.contains("proxied chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_anthropic_messages_endpoint_forwards_to_selected_upstream_with_native_headers(
    ) {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic".to_string(),
                name: "Anthropic Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "anthropic".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "claude-sonnet-4-20250514".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                }],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!("{}/messages", health.base_url),
            &[
                ("x-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
                ("anthropic-version", "2023-06-01"),
            ],
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 128,
                "messages": [{ "role": "user", "content": "hello anthropic" }],
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_api_key.as_deref(),
            Some("anthropic-upstream-secret")
        );
        assert_eq!(capture.anthropic_version.as_deref(), Some("2023-06-01"));
        assert_eq!(capture.body["model"], "claude-sonnet-4-20250514");
        assert_eq!(response["content"][0]["text"], "anthropic proxied response");

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_generate_content_endpoint_forwards_to_selected_upstream_with_native_headers(
    ) {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!(
                "{}/v1beta/models/gemini-2.5-pro:generateContent",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            Some(json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": "hello gemini" }]
                }]
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:generateContent")
        );
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["contents"][0]["parts"][0]["text"],
            "hello gemini"
        );
        assert_eq!(
            response["candidates"][0]["content"]["parts"][0]["text"],
            "gemini proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_embed_content_endpoint_forwards_to_selected_upstream_with_native_headers(
    ) {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!(
                "{}/v1beta/models/text-embedding-004:embedContent",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            Some(json!({
                "content": {
                    "parts": [{ "text": "embed this content" }]
                }
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/text-embedding-004:embedContent")
        );
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["content"]["parts"][0]["text"],
            "embed this content"
        );
        assert_eq!(response["embedding"]["values"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_v1_generate_content_endpoint_preserves_requested_api_version() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: format!("{}/v1beta", upstream.base_url),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!(
                "{}/v1/models/gemini-2.5-pro:generateContent",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            Some(json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": "hello gemini stable" }]
                }]
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1/models/gemini-2.5-pro:generateContent")
        );
        assert_eq!(
            response["candidates"][0]["content"]["parts"][0]["text"],
            "gemini proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_models_endpoint_projects_route_models_in_native_shape() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: "https://generativelanguage.googleapis.com".to_string(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "GET",
            &format!(
                "{}/v1beta/models",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            None,
        );

        assert_eq!(response["models"][0]["name"], "models/gemini-2.5-pro");
        assert_eq!(
            response["models"][0]["supportedGenerationMethods"][0],
            "generateContent"
        );
        assert_eq!(response["models"][1]["name"], "models/text-embedding-004");
        assert_eq!(
            response["models"][1]["supportedGenerationMethods"][0],
            "embedContent"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_native_endpoint_rejects_models_not_exposed_by_route() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async {
            let response = reqwest::Client::new()
                .post(format!(
                    "{}/v1beta/models/gemini-2.5-flash:generateContent",
                    expected_test_public_root_base_url(health.active_port)
                ))
                .header("content-type", "application/json")
                .header("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)
                .body(
                    json!({
                        "contents": [{
                            "role": "user",
                            "parts": [{ "text": "hello" }]
                        }]
                    })
                    .to_string(),
                )
                .send()
                .await
                .expect("request");

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
            let body = response.json::<Value>().await.expect("json body");
            assert_eq!(
                body["error"],
                "Gemini model \"gemini-2.5-flash\" is not exposed by local AI proxy route \"Gemini Route\"."
            );
        });
        assert!(upstream.capture.lock().expect("capture").is_none());

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_native_endpoint_rejects_unsupported_model_actions() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async {
            let response = reqwest::Client::new()
                .post(format!(
                    "{}/v1beta/models/text-embedding-004:generateContent",
                    expected_test_public_root_base_url(health.active_port)
                ))
                .header("content-type", "application/json")
                .header("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)
                .body(
                    json!({
                        "contents": [{
                            "role": "user",
                            "parts": [{ "text": "hello" }]
                        }]
                    })
                    .to_string(),
                )
                .send()
                .await
                .expect("request");

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            let body = response.json::<Value>().await.expect("json body");
            assert_eq!(
                body["error"],
                "Gemini model \"text-embedding-004\" on local AI proxy route \"Gemini Route\" does not support action \"generateContent\"."
            );
        });
        assert!(upstream.capture.lock().expect("capture").is_none());

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn project_managed_openclaw_provider_writes_local_proxy_provider_and_defaults() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = sample_projection_snapshot();
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project managed openclaw provider");

        let projected = read_json(&paths.openclaw_config_file);
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            health.base_url
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["apiKey"],
            LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["api"],
            "openai-completions"
        );
        let provider = projected["models"]["providers"]["sdkwork-local-proxy"]
            .as_object()
            .expect("provider object");
        assert!(!provider.contains_key("streaming"));
        assert_eq!(
            projected["agents"]["defaults"]["model"]["primary"],
            "sdkwork-local-proxy/gpt-5.4"
        );
        assert_eq!(
            projected["agents"]["defaults"]["model"]["fallbacks"][0],
            "sdkwork-local-proxy/o4-mini"
        );
    }

    #[test]
    fn project_managed_openclaw_provider_preserves_non_managed_defaults() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = sample_projection_snapshot();
        let health = sample_projection_health();

        fs::write(
            &paths.openclaw_config_file,
            r#"{
  "models": {
    "providers": {
      "anthropic": {
        "baseUrl": "https://api.anthropic.com/v1",
        "apiKey": "sk-anthropic",
        "models": [
          { "id": "claude-sonnet-4-5", "name": "Claude Sonnet 4.5" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-5"
      }
    }
  }
}
"#,
        )
        .expect("seed openclaw config");

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project managed openclaw provider");

        let projected = read_json(&paths.openclaw_config_file);
        assert_eq!(
            projected["agents"]["defaults"]["model"]["primary"],
            "anthropic/claude-sonnet-4-5"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            health.base_url
        );
    }

    #[test]
    fn local_ai_proxy_falls_back_to_dynamic_port_when_requested_port_is_busy() {
        let busy_listener = std::net::TcpListener::bind(("127.0.0.1", 0)).expect("busy listener");
        let busy_port = busy_listener
            .local_addr()
            .expect("busy listener addr")
            .port();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            requested_port: busy_port,
            ..sample_projection_snapshot()
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy with fallback port");

        assert_ne!(health.active_port, busy_port);
        assert_eq!(
            health.base_url,
            expected_test_public_v1_base_url(health.active_port)
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn project_managed_openclaw_provider_enables_streaming_for_translated_protocols_when_proxy_can_translate(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 18_791,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: "https://api.anthropic.com/v1".to_string(),
                api_key: "sk-anthropic".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project managed openclaw provider");

        let projected = read_json(&paths.openclaw_config_file);
        let provider = projected["models"]["providers"]["sdkwork-local-proxy"]
            .as_object()
            .expect("provider object");
        assert!(!provider.contains_key("streaming"));
    }

    #[test]
    fn project_managed_openclaw_provider_uses_anthropic_messages_for_native_anthropic_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            default_route_id: "route-anthropic".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic".to_string(),
                name: "Anthropic Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "anthropic".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: "https://api.anthropic.com/v1".to_string(),
                api_key: "sk-anthropic".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
            ..sample_projection_snapshot()
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project managed openclaw provider");

        let projected = read_json(&paths.openclaw_config_file);
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            health.base_url
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["api"],
            "anthropic-messages"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["auth"],
            "api-key"
        );
    }

    #[test]
    fn project_managed_openclaw_provider_uses_google_generative_ai_for_native_gemini_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: "https://generativelanguage.googleapis.com".to_string(),
                api_key: "sk-gemini".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "text-embedding-004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
            ..sample_projection_snapshot()
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project managed openclaw provider");

        let projected = read_json(&paths.openclaw_config_file);
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            expected_test_public_root_base_url(18_791)
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["api"],
            "google-generative-ai"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["auth"],
            "api-key"
        );
    }

    #[test]
    fn project_managed_openclaw_provider_does_not_persist_legacy_route_runtime_config_fields() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-sqlite".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }];
        let storage = StorageService::new();

        storage
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    profile_id: Some("default-sqlite".to_string()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: "route-openai".to_string(),
                    value: r#"{
  "id": "route-openai",
  "name": "OpenAI",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "openai-compatible",
  "upstreamProtocol": "openai-compatible",
  "providerId": "openai",
  "upstreamBaseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-openai",
  "defaultModelId": "gpt-5.4",
  "reasoningModelId": "o4-mini",
  "embeddingModelId": "text-embedding-3-large",
  "models": [
    { "id": "gpt-5.4", "name": "GPT-5.4" },
    { "id": "o4-mini", "name": "o4-mini" },
    { "id": "text-embedding-3-large", "name": "text-embedding-3-large" }
  ],
  "config": {
    "temperature": 0.35,
    "topP": 0.9,
    "maxTokens": 24000,
    "timeoutMs": 90000,
    "streaming": false
  },
  "exposeTo": ["openclaw"]
}"#
                    .to_string(),
                },
            )
            .expect("seed provider center route with runtime config");

        let snapshot = materialize_local_ai_proxy_snapshot(
            &paths,
            &config,
            &storage,
            LOCAL_AI_PROXY_DEFAULT_PORT,
            LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
        );
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project managed openclaw provider");

        let projected = read_json(&paths.openclaw_config_file);
        let provider = projected["models"]["providers"]["sdkwork-local-proxy"]
            .as_object()
            .expect("provider object");
        assert!(!provider.contains_key("temperature"));
        assert!(!provider.contains_key("topP"));
        assert!(!provider.contains_key("maxTokens"));
        assert!(!provider.contains_key("timeoutMs"));
        assert!(!provider.contains_key("streaming"));
    }

    fn sample_projection_snapshot() -> LocalAiProxySnapshot {
        LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 18_791,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-sdkwork".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-sdkwork".to_string(),
                name: "SDKWork Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "system-default".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "sdkwork".to_string(),
                provider_id: "sdkwork".to_string(),
                upstream_base_url: "https://ai.sdkwork.com".to_string(),
                api_key: "sk-sdkwork-upstream".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "o4-mini".to_string(),
                        name: "o4-mini".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: Some("Managed local proxy provider".to_string()),
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        }
    }

    fn sample_projection_health() -> super::LocalAiProxyServiceHealth {
        super::LocalAiProxyServiceHealth {
            base_url: expected_test_public_v1_base_url(18_791),
            active_port: 18_791,
            loopback_only: true,
            default_route_id: "route-sdkwork".to_string(),
            default_route_name: "SDKWork Route".to_string(),
            default_routes: vec![super::LocalAiProxyDefaultRouteHealth {
                client_protocol: "openai-compatible".to_string(),
                id: "route-sdkwork".to_string(),
                name: "SDKWork Route".to_string(),
                managed_by: "system-default".to_string(),
                upstream_protocol: "sdkwork".to_string(),
                upstream_base_url: "https://ai.sdkwork.com".to_string(),
                model_count: 3,
            }],
            upstream_base_url: "https://ai.sdkwork.com".to_string(),
            model_count: 3,
            snapshot_path: "snapshot.json".to_string(),
            log_path: "proxy.log".to_string(),
        }
    }

    fn expected_test_public_host() -> String {
        super::default_local_ai_proxy_public_host()
    }

    fn expected_test_public_root_base_url(port: u16) -> String {
        format!("http://{}:{port}", expected_test_public_host())
    }

    fn expected_test_public_v1_base_url(port: u16) -> String {
        format!("{}/v1", expected_test_public_root_base_url(port))
    }

    fn read_json(path: &std::path::Path) -> Value {
        serde_json::from_str(&fs::read_to_string(path).expect("read projected config"))
            .expect("projected config json")
    }

    fn request_json(
        method: &str,
        url: &str,
        bearer_token: Option<&str>,
        body: Option<Value>,
    ) -> Value {
        let mut headers = Vec::new();
        if let Some(token) = bearer_token {
            headers.push(("authorization", format!("Bearer {token}")));
        }

        let header_refs = headers
            .iter()
            .map(|(name, value)| (*name, value.as_str()))
            .collect::<Vec<_>>();

        request_json_with_headers(method, url, &header_refs, body)
    }

    fn request_json_with_headers(
        method: &str,
        url: &str,
        headers: &[(&str, &str)],
        body: Option<Value>,
    ) -> Value {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async move {
            let client = reqwest::Client::new();
            let mut request = match method {
                "GET" => client.get(url),
                "POST" => client.post(url),
                other => panic!("unsupported method: {other}"),
            };

            for (name, value) in headers {
                request = request.header(*name, *value);
            }
            if let Some(payload) = body {
                request = request.header("content-type", "application/json");
                request = request.body(payload.to_string());
            }

            let response = request.send().await.expect("request");
            let status = response.status();
            let text = response.text().await.expect("response text");
            assert!(
                status.is_success(),
                "expected successful response, got {status}: {text}"
            );
            serde_json::from_str(&text).expect("response json")
        })
    }

    fn request_streaming_response(
        url: &str,
        bearer_token: Option<&str>,
        body: Value,
    ) -> (Duration, String, String) {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async move {
            let client = reqwest::Client::new();
            let mut request = client
                .post(url)
                .header("content-type", "application/json")
                .header("accept", "text/event-stream, application/json")
                .body(body.to_string());
            if let Some(token) = bearer_token {
                request = request.bearer_auth(token);
            }

            let start = Instant::now();
            let mut response = request.send().await.expect("request");
            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.expect("response text");
                panic!("expected successful response, got {status}: {text}");
            }

            let content_type = response
                .headers()
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default()
                .to_string();
            let first_chunk = response
                .chunk()
                .await
                .expect("first chunk read")
                .expect("first chunk");
            let first_chunk_latency = start.elapsed();
            let mut body_bytes = first_chunk.to_vec();
            while let Some(chunk) = response.chunk().await.expect("chunk read") {
                body_bytes.extend_from_slice(&chunk);
            }

            (
                first_chunk_latency,
                content_type,
                String::from_utf8(body_bytes).expect("streaming response utf8"),
            )
        })
    }

    #[derive(Clone, Debug, PartialEq)]
    struct UpstreamCapture {
        path: Option<String>,
        authorization: Option<String>,
        x_api_key: Option<String>,
        x_goog_api_key: Option<String>,
        anthropic_version: Option<String>,
        body: Value,
    }

    struct TestUpstreamServer {
        base_url: String,
        capture: Arc<Mutex<Option<UpstreamCapture>>>,
        shutdown: Option<tokio::sync::oneshot::Sender<()>>,
        join_handle: Option<std::thread::JoinHandle<()>>,
    }

    impl TestUpstreamServer {
        fn start() -> Self {
            let capture = Arc::new(Mutex::new(None));
            let state = capture.clone();
            let (ready_tx, ready_rx) = std::sync::mpsc::channel();
            let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

            let join_handle = std::thread::spawn(move || {
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("tokio runtime");

                runtime.block_on(async move {
                    async fn chat_handler(
                        State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                        headers: HeaderMap,
                        uri: axum::http::Uri,
                        Json(body): Json<Value>,
                    ) -> axum::response::Response {
                        let stream = body
                            .get("stream")
                            .and_then(Value::as_bool)
                            .unwrap_or(false);
                        let detailed_usage_requested = body
                            .pointer("/messages/0/content")
                            .and_then(Value::as_str)
                            .map(|value| value.contains("usage detail request"))
                            .unwrap_or(false);
                        *capture.lock().expect("capture") = Some(UpstreamCapture {
                            path: uri.path_and_query().map(|value| value.to_string()),
                            authorization: headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_api_key: headers
                                .get("x-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_goog_api_key: headers
                                .get("x-goog-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            anthropic_version: headers
                                .get("anthropic-version")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            body,
                        });

                        if stream {
                            let stream = async_stream::stream! {
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "data: {\"choices\":[{\"delta\":{\"content\":\"proxied chunk 1\"}}]}\n\n",
                                ));
                                tokio::time::sleep(Duration::from_millis(900)).await;
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "data: {\"choices\":[{\"delta\":{\"content\":\"proxied chunk 2\"}}]}\n\n",
                                ));
                                yield Ok::<Bytes, std::io::Error>(Bytes::from("data: [DONE]\n\n"));
                            };

                            return axum::response::Response::builder()
                                .status(StatusCode::OK)
                                .header("content-type", "text/event-stream")
                                .body(axum::body::Body::from_stream(stream))
                                .expect("stream response");
                        }

                        (
                            StatusCode::OK,
                            Json(json!({
                                "id": "chatcmpl-local-proxy",
                                "object": "chat.completion",
                                "choices": [
                                    {
                                        "index": 0,
                                        "message": {
                                            "role": "assistant",
                                            "content": "proxied response"
                                        }
                                    }
                                ],
                                "usage": detailed_usage_requested.then_some(json!({
                                    "prompt_tokens": 12_307,
                                    "completion_tokens": 6,
                                    "total_tokens": 12_313,
                                    "prompt_tokens_details": {
                                        "cached_tokens": 4_096
                                    }
                                }))
                            })),
                        )
                            .into_response()
                    }

                    async fn responses_handler(
                        State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                        headers: HeaderMap,
                        uri: axum::http::Uri,
                        Json(body): Json<Value>,
                    ) -> impl IntoResponse {
                        let detailed_usage_requested = body
                            .pointer("/input")
                            .map(Value::to_string)
                            .map(|value| value.contains("responses usage detail request"))
                            .unwrap_or(false);
                        *capture.lock().expect("capture") = Some(UpstreamCapture {
                            path: uri.path_and_query().map(|value| value.to_string()),
                            authorization: headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_api_key: headers
                                .get("x-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_goog_api_key: headers
                                .get("x-goog-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            anthropic_version: headers
                                .get("anthropic-version")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            body,
                        });

                        (
                            StatusCode::OK,
                            Json(json!({
                                "id": "resp_local_proxy",
                                "object": "response",
                                "output": [
                                    {
                                        "type": "message",
                                        "role": "assistant",
                                        "content": [
                                            {
                                                "type": "output_text",
                                                "text": "responses proxied response"
                                            }
                                        ]
                                    }
                                ],
                                "usage": detailed_usage_requested.then_some(json!({
                                    "input_tokens": 12_307,
                                    "output_tokens": 6,
                                    "total_tokens": 12_313,
                                    "input_tokens_details": {
                                        "cached_tokens": 4_096
                                    }
                                }))
                            })),
                        )
                    }

                    async fn embeddings_handler(
                        State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                        headers: HeaderMap,
                        uri: axum::http::Uri,
                        Json(body): Json<Value>,
                    ) -> impl IntoResponse {
                        *capture.lock().expect("capture") = Some(UpstreamCapture {
                            path: uri.path_and_query().map(|value| value.to_string()),
                            authorization: headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_api_key: headers
                                .get("x-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_goog_api_key: headers
                                .get("x-goog-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            anthropic_version: headers
                                .get("anthropic-version")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            body,
                        });

                        (
                            StatusCode::OK,
                            Json(json!({
                                "object": "list",
                                "data": [
                                    {
                                        "object": "embedding",
                                        "index": 0,
                                        "embedding": [0.12, 0.34, 0.56]
                                    }
                                ]
                            })),
                        )
                    }

                    async fn anthropic_messages_handler(
                        State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                        headers: HeaderMap,
                        uri: axum::http::Uri,
                        Json(body): Json<Value>,
                    ) -> axum::response::Response {
                        let stream = body
                            .get("stream")
                            .and_then(Value::as_bool)
                            .unwrap_or(false);
                        *capture.lock().expect("capture") = Some(UpstreamCapture {
                            path: uri.path_and_query().map(|value| value.to_string()),
                            authorization: headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_api_key: headers
                                .get("x-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_goog_api_key: headers
                                .get("x-goog-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            anthropic_version: headers
                                .get("anthropic-version")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            body,
                        });

                        if stream {
                            let stream = async_stream::stream! {
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg-local-proxy\",\"model\":\"claude-sonnet-4-20250514\",\"usage\":{\"input_tokens\":12,\"output_tokens\":0},\"content\":[]}}\n\n",
                                ));
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"anthropic stream chunk 1\"}}\n\n",
                                ));
                                tokio::time::sleep(Duration::from_millis(900)).await;
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"anthropic stream chunk 2\"}}\n\n",
                                ));
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":8}}\n\n",
                                ));
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
                                ));
                            };

                            return axum::response::Response::builder()
                                .status(StatusCode::OK)
                                .header("content-type", "text/event-stream")
                                .body(axum::body::Body::from_stream(stream))
                                .expect("stream response");
                        }

                        (
                            StatusCode::OK,
                            Json(json!({
                                "id": "msg-local-proxy",
                                "type": "message",
                                "model": "claude-sonnet-4-20250514",
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": "anthropic proxied response"
                                    }
                                ],
                                "usage": {
                                    "input_tokens": 12,
                                    "output_tokens": 8
                                }
                            })),
                        )
                            .into_response()
                    }

                    async fn gemini_generate_handler(
                        State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                        headers: HeaderMap,
                        uri: axum::http::Uri,
                        Json(body): Json<Value>,
                    ) -> axum::response::Response {
                        let stream = uri.path().contains(":streamGenerateContent");
                        *capture.lock().expect("capture") = Some(UpstreamCapture {
                            path: uri.path_and_query().map(|value| value.to_string()),
                            authorization: headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_api_key: headers
                                .get("x-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_goog_api_key: headers
                                .get("x-goog-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            anthropic_version: headers
                                .get("anthropic-version")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            body,
                        });

                        if stream {
                            let stream = async_stream::stream! {
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"gemini stream chunk 1\"}]}}]}\n\n",
                                ));
                                tokio::time::sleep(Duration::from_millis(900)).await;
                                yield Ok::<Bytes, std::io::Error>(Bytes::from(
                                    "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"gemini stream chunk 2\"}],\"role\":\"model\"},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":10,\"candidatesTokenCount\":8,\"totalTokenCount\":18}}\n\n",
                                ));
                            };

                            return axum::response::Response::builder()
                                .status(StatusCode::OK)
                                .header("content-type", "text/event-stream")
                                .body(axum::body::Body::from_stream(stream))
                                .expect("stream response");
                        }

                        (
                            StatusCode::OK,
                            Json(json!({
                                "candidates": [
                                    {
                                        "content": {
                                            "parts": [
                                                { "text": "gemini proxied response" }
                                            ]
                                        }
                                    }
                                ],
                                "usageMetadata": {
                                    "promptTokenCount": 10,
                                    "candidatesTokenCount": 8,
                                    "totalTokenCount": 18
                                }
                            })),
                        )
                            .into_response()
                    }

                    async fn gemini_embed_handler(
                        State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                        headers: HeaderMap,
                        uri: axum::http::Uri,
                        Json(body): Json<Value>,
                    ) -> impl IntoResponse {
                        *capture.lock().expect("capture") = Some(UpstreamCapture {
                            path: uri.path_and_query().map(|value| value.to_string()),
                            authorization: headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_api_key: headers
                                .get("x-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            x_goog_api_key: headers
                                .get("x-goog-api-key")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            anthropic_version: headers
                                .get("anthropic-version")
                                .and_then(|value| value.to_str().ok())
                                .map(|value| value.to_string()),
                            body,
                        });

                        (
                            StatusCode::OK,
                            Json(json!({
                                "embedding": {
                                    "values": [0.12, 0.34, 0.56]
                                }
                            })),
                        )
                    }

                    let router = Router::new()
                        .route("/v1/chat/completions", post(chat_handler))
                        .route("/openai/v1/chat/completions", post(chat_handler))
                        .route("/v1/responses", post(responses_handler))
                        .route("/v1/embeddings", post(embeddings_handler))
                        .route("/v1/messages", post(anthropic_messages_handler))
                        .route(
                            "/v1beta/models/gemini-2.5-pro:generateContent",
                            post(gemini_generate_handler),
                        )
                        .route(
                            "/v1beta/models/gemini-2.5-pro:streamGenerateContent",
                            post(gemini_generate_handler),
                        )
                        .route(
                            "/v1/models/gemini-2.5-pro:generateContent",
                            post(gemini_generate_handler),
                        )
                        .route(
                            "/v1/models/gemini-2.5-pro:streamGenerateContent",
                            post(gemini_generate_handler),
                        )
                        .route(
                            "/v1beta/models/text-embedding-004:embedContent",
                            post(gemini_embed_handler),
                        )
                        .with_state(state);
                    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
                        .await
                        .expect("bind upstream server");
                    ready_tx
                        .send(listener.local_addr().expect("local addr").port())
                        .expect("send upstream port");
                    axum::serve(listener, router)
                        .with_graceful_shutdown(async move {
                            let _ = shutdown_rx.await;
                        })
                        .await
                        .expect("serve upstream");
                });
            });

            let port = ready_rx.recv().expect("upstream port");

            Self {
                base_url: format!("http://127.0.0.1:{port}"),
                capture,
                shutdown: Some(shutdown_tx),
                join_handle: Some(join_handle),
            }
        }

        fn capture(&self) -> UpstreamCapture {
            self.capture
                .lock()
                .expect("capture")
                .clone()
                .expect("captured request")
        }
    }

    impl Drop for TestUpstreamServer {
        fn drop(&mut self) {
            if let Some(shutdown) = self.shutdown.take() {
                let _ = shutdown.send(());
            }
            if let Some(join_handle) = self.join_handle.take() {
                let _ = join_handle.join();
            }
        }
    }
}
