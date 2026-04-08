use super::{
    observability_store::{LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState},
    response_io::{extract_proxy_error_message, ProxyRouteOutcome},
    support::{current_time_ms, duration_to_ms, trim_optional_text},
    types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult},
    LocalAiProxyRouteSnapshot, ANTHROPIC_CLIENT_PROTOCOL, GEMINI_CLIENT_PROTOCOL,
};
use crate::framework::services::local_ai_proxy_observability::{
    LocalAiProxyLoggedMessage, LocalAiProxyObservabilityRepository, LocalAiProxyRequestLogInsert,
};
use axum::{body::Bytes, http::StatusCode};
use serde_json::Value;
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use uuid::Uuid;

#[derive(Clone, Debug)]
pub(super) struct LocalAiProxyRequestAuditContext {
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

pub(super) fn record_proxy_route_outcome(
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

pub(super) fn record_proxy_route_usage_adjustment(
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

pub(super) fn record_proxy_request_log(
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

pub(super) fn record_completed_stream_request_log(
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

pub(super) fn build_request_audit_context(
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

pub(super) fn extract_response_preview_from_value(value: &Value) -> Option<String> {
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
