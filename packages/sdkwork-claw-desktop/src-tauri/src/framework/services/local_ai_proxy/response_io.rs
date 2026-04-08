use super::{
    observability, openai_compatible,
    support::{proxy_error, trim_optional_text},
    types::{LocalAiProxyTokenUsage, ProxyHttpResult},
};
use axum::{
    body::Body,
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
    Json,
};
use serde_json::Value;

pub(super) struct ProxyRouteOutcome {
    pub(super) response: Response,
    pub(super) status: StatusCode,
    pub(super) usage: LocalAiProxyTokenUsage,
    pub(super) error: Option<String>,
    pub(super) response_preview: Option<String>,
    pub(super) response_body: Option<String>,
}

pub(super) fn build_json_outcome(
    status: StatusCode,
    body: Value,
    usage: LocalAiProxyTokenUsage,
) -> ProxyHttpResult<ProxyRouteOutcome> {
    let response_preview = observability::extract_response_preview_from_value(&body);
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

pub(super) async fn build_buffered_upstream_response(
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
    let usage = json
        .as_ref()
        .map(openai_compatible::extract_token_usage)
        .unwrap_or_default();
    let error = (!status.is_success()).then(|| resolve_error_message(json.as_ref(), &text, status));
    let response_preview = json
        .as_ref()
        .and_then(observability::extract_response_preview_from_value)
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

pub(super) fn resolve_error_message(
    payload: Option<&Value>,
    text: &str,
    status: StatusCode,
) -> String {
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

pub(super) fn extract_proxy_error_message(error: &(StatusCode, Json<Value>)) -> String {
    resolve_error_message(Some(&error.1 .0), "", error.0)
}

pub(super) async fn parse_json_response(response: reqwest::Response) -> ProxyHttpResult<Value> {
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
