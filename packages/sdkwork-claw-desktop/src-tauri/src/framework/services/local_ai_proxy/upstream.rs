use super::{
    support::proxy_error, types::ProxyHttpResult, LocalAiProxyRouteSnapshot, X_API_KEY_HEADER,
};
use axum::{
    body::Bytes,
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
};

pub(super) fn build_openai_compatible_upstream_request(
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

pub(super) fn infer_gemini_default_api_version(base_url: &str) -> &'static str {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        "v1"
    } else {
        "v1beta"
    }
}

pub(super) fn build_gemini_upstream_request_url(
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

pub(super) fn build_ollama_upstream_request_url(
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
) -> String {
    format!(
        "{}/{}",
        route.upstream_base_url.trim().trim_end_matches('/'),
        endpoint_suffix.trim_start_matches('/')
    )
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
