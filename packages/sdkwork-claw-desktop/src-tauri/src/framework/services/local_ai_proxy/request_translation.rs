use super::{
    openai_compatible::resolve_request_model_id, streaming, support::proxy_error,
    types::ProxyHttpResult, LocalAiProxyRouteSnapshot,
};
use axum::http::StatusCode;
use serde_json::{json, Value};

pub(super) fn build_anthropic_request_from_openai_chat(
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
    if streaming::is_openai_stream_request(payload) {
        root.insert("stream".to_string(), Value::Bool(true));
    }

    Ok(Value::Object(root))
}

pub(super) fn build_anthropic_request_from_openai_response(
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
    if streaming::is_openai_stream_request(payload) {
        root.insert("stream".to_string(), Value::Bool(true));
    }

    Ok(Value::Object(root))
}

pub(super) fn build_gemini_request_from_openai_chat(
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

pub(super) fn build_gemini_request_from_openai_response(
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

pub(super) fn build_gemini_request_from_openai_embeddings(
    payload: &Value,
) -> ProxyHttpResult<Value> {
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

pub(super) fn build_ollama_request_from_openai_chat(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    let (system, conversation) = extract_openai_chat_conversation(payload)?;
    let mut root = serde_json::Map::new();
    root.insert("model".to_string(), Value::String(model_id));
    root.insert(
        "messages".to_string(),
        Value::Array(build_ollama_messages(system, conversation)),
    );
    root.insert(
        "stream".to_string(),
        Value::Bool(streaming::is_openai_stream_request(payload)),
    );
    if let Some(options) = build_ollama_request_options(payload) {
        root.insert("options".to_string(), options);
    }
    if let Some(tools) = payload.get("tools").cloned() {
        root.insert("tools".to_string(), tools);
    }

    Ok(Value::Object(root))
}

pub(super) fn build_ollama_request_from_openai_response(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    let (system, conversation) = extract_openai_response_conversation(payload)?;
    let mut root = serde_json::Map::new();
    root.insert("model".to_string(), Value::String(model_id));
    root.insert(
        "messages".to_string(),
        Value::Array(build_ollama_messages(system, conversation)),
    );
    root.insert(
        "stream".to_string(),
        Value::Bool(streaming::is_openai_stream_request(payload)),
    );
    if let Some(options) = build_ollama_request_options(payload) {
        root.insert("options".to_string(), options);
    }
    if let Some(tools) = payload.get("tools").cloned() {
        root.insert("tools".to_string(), tools);
    }

    Ok(Value::Object(root))
}

pub(super) fn build_ollama_request_from_openai_embeddings(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    let input = payload.get("input").ok_or_else(|| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI embeddings requests must include an input field.",
        )
    })?;

    let normalized_input = match input {
        Value::String(_) | Value::Array(_) => input.clone(),
        _ => extract_openai_text_content(input)
            .map(Value::String)
            .ok_or_else(|| {
                proxy_error(
                    StatusCode::BAD_REQUEST,
                    "OpenAI embeddings requests must include a non-empty text input.",
                )
            })?,
    };

    Ok(json!({
        "model": model_id,
        "input": normalized_input,
    }))
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

fn build_ollama_messages(
    system: Option<String>,
    conversation: Vec<(String, String)>,
) -> Vec<Value> {
    let mut messages = Vec::new();
    if let Some(system) = system
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        messages.push(json!({
            "role": "system",
            "content": system,
        }));
    }

    for (role, content) in conversation {
        messages.push(json!({
            "role": role,
            "content": content,
        }));
    }

    messages
}

fn build_ollama_request_options(payload: &Value) -> Option<Value> {
    let mut options = serde_json::Map::new();
    if let Some(value) = payload.get("temperature").and_then(Value::as_f64) {
        options.insert("temperature".to_string(), Value::from(value));
    }
    if let Some(value) = payload.get("top_p").and_then(Value::as_f64) {
        options.insert("top_p".to_string(), Value::from(value));
    }

    let max_tokens = read_request_max_tokens(payload, 8192);
    if max_tokens > 0 {
        options.insert("num_predict".to_string(), Value::from(max_tokens));
    }

    (!options.is_empty()).then(|| Value::Object(options))
}
