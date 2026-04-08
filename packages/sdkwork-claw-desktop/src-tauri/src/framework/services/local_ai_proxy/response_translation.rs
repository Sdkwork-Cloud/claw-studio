use super::{openai_compatible::extract_token_usage, streaming, LocalAiProxyRouteSnapshot};
use serde_json::{json, Value};

pub(super) fn build_openai_chat_completion_from_anthropic(
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

pub(super) fn build_openai_chat_completion_from_gemini(
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

pub(super) fn build_openai_response_from_anthropic(
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
    if let Some(response_usage) = streaming::build_openai_response_usage(&usage) {
        response["usage"] = response_usage;
    }
    response
}

pub(super) fn build_openai_response_from_gemini(
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
    if let Some(response_usage) = streaming::build_openai_response_usage(&usage) {
        response["usage"] = response_usage;
    }
    response
}

pub(super) fn build_openai_embeddings_from_gemini(upstream_body: &Value) -> Value {
    json!({
        "object": "list",
        "data": [{
            "object": "embedding",
            "index": 0,
            "embedding": upstream_body.pointer("/embedding/values").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
        }]
    })
}

pub(super) fn build_openai_chat_completion_from_ollama(
    route: &LocalAiProxyRouteSnapshot,
    upstream_body: &Value,
) -> Value {
    let content = extract_ollama_response_text(upstream_body);
    let usage = extract_token_usage(upstream_body);
    let tool_calls = build_openai_tool_calls_from_ollama(upstream_body);
    let finish_reason = if !tool_calls.is_empty() {
        "tool_calls"
    } else {
        map_ollama_done_reason(upstream_body.get("done_reason").and_then(Value::as_str))
            .unwrap_or("stop")
    };
    let mut message = json!({
        "role": "assistant",
        "content": content,
    });
    if !tool_calls.is_empty() {
        message["tool_calls"] = Value::Array(tool_calls);
        if content.is_empty() {
            message["content"] = Value::Null;
        }
    }

    json!({
        "id": "chatcmpl-local-proxy",
        "object": "chat.completion",
        "created": 0,
        "model": upstream_body.get("model").and_then(Value::as_str).unwrap_or(route.default_model_id.as_str()),
        "choices": [{
            "index": 0,
            "message": message,
            "finish_reason": finish_reason,
        }],
        "usage": {
            "prompt_tokens": usage.input_tokens,
            "completion_tokens": usage.output_tokens,
            "total_tokens": usage.total_tokens,
        }
    })
}

pub(super) fn build_openai_response_from_ollama(
    route: &LocalAiProxyRouteSnapshot,
    upstream_body: &Value,
) -> Value {
    let usage = extract_token_usage(upstream_body);
    let mut response = json!({
        "id": "resp-local-proxy",
        "object": "response",
        "model": upstream_body.get("model").and_then(Value::as_str).unwrap_or(route.default_model_id.as_str()),
        "output": [{
            "type": "message",
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": extract_ollama_response_text(upstream_body),
                "annotations": []
            }]
        }]
    });
    if let Some(response_usage) = streaming::build_openai_response_usage(&usage) {
        response["usage"] = response_usage;
    }
    response
}

pub(super) fn build_openai_embeddings_from_ollama(upstream_body: &Value) -> Value {
    let embedding = upstream_body
        .pointer("/embeddings/0")
        .cloned()
        .or_else(|| upstream_body.get("embedding").cloned())
        .unwrap_or_else(|| Value::Array(Vec::new()));

    json!({
        "object": "list",
        "data": [{
            "object": "embedding",
            "index": 0,
            "embedding": embedding,
        }]
    })
}

pub(super) fn extract_anthropic_response_text(payload: &Value) -> String {
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

pub(super) fn map_anthropic_stop_reason(reason: Option<&str>) -> &'static str {
    match reason.unwrap_or_default() {
        "max_tokens" => "length",
        _ => "stop",
    }
}

pub(super) fn extract_gemini_response_text(payload: &Value) -> String {
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

pub(super) fn extract_ollama_response_text(payload: &Value) -> String {
    payload
        .pointer("/message/content")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_default()
}

fn build_openai_tool_calls_from_ollama(payload: &Value) -> Vec<Value> {
    payload
        .pointer("/message/tool_calls")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .enumerate()
                .filter_map(|(index, entry)| {
                    let name = entry
                        .pointer("/function/name")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())?;
                    let arguments = entry
                        .pointer("/function/arguments")
                        .cloned()
                        .unwrap_or_else(|| Value::Object(Default::default()));
                    Some(json!({
                        "id": format!("call-local-proxy-{index}"),
                        "type": "function",
                        "function": {
                            "name": name,
                            "arguments": serde_json::to_string(&arguments).unwrap_or_else(|_| "{}".to_string()),
                        }
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub(super) fn map_ollama_done_reason(reason: Option<&str>) -> Option<&'static str> {
    match reason.unwrap_or_default() {
        "length" => Some("length"),
        "stop" | "tool_calls" => Some("stop"),
        "" => None,
        _ => Some("stop"),
    }
}
