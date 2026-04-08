use super::{
    openai_compatible::extract_token_usage,
    response_translation::{
        extract_gemini_response_text, extract_ollama_response_text, map_anthropic_stop_reason,
        map_ollama_done_reason,
    },
    support::{duration_to_ms, proxy_error, trim_optional_text},
    types::LocalAiProxyTokenUsage,
    types::ProxyHttpResult,
};
use axum::{
    body::{Body, Bytes},
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
};
use serde_json::{json, Value};
use std::time::Instant;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum OpenAiStreamEndpoint {
    ChatCompletions,
    Responses,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct ParsedSseEvent {
    event: Option<String>,
    data: String,
}

#[derive(Debug)]
pub(super) struct OpenAiTranslatedStreamState {
    endpoint: OpenAiStreamEndpoint,
    stream_id: String,
    model: String,
    accumulated_text: String,
    pub(super) usage: LocalAiProxyTokenUsage,
    role_sent: bool,
    response_created: bool,
    done_emitted: bool,
    finish_reason: Option<String>,
}

pub(super) async fn build_passthrough_response<G>(
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
    pub(super) fn new(
        endpoint: OpenAiStreamEndpoint,
        model: impl Into<String>,
        id_prefix: &str,
    ) -> Self {
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

    pub(super) fn merge_usage(&mut self, usage: &LocalAiProxyTokenUsage) {
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

pub(super) fn openai_stream_endpoint_for_suffix(
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

pub(super) fn is_openai_stream_request(payload: &Value) -> bool {
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

pub(super) fn build_openai_response_usage(usage: &LocalAiProxyTokenUsage) -> Option<Value> {
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

fn drain_json_line_payloads(buffer: &mut String) -> Vec<Value> {
    *buffer = buffer.replace("\r\n", "\n");
    let mut frames = Vec::new();

    while let Some(index) = buffer.find('\n') {
        let frame_text = buffer[..index].trim().to_string();
        *buffer = buffer[index + 1..].to_string();
        if frame_text.is_empty() {
            continue;
        }
        if let Ok(payload) = serde_json::from_str::<Value>(&frame_text) {
            frames.push(payload);
        }
    }

    frames
}

fn flush_json_line_payload(buffer: &mut String) -> Option<Value> {
    *buffer = buffer.replace("\r\n", "\n");
    let trailing = buffer.trim();
    if trailing.is_empty() {
        return None;
    }

    serde_json::from_str::<Value>(trailing).ok()
}

pub(super) async fn build_translated_openai_sse_response<F, G>(
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

pub(super) async fn build_translated_openai_jsonl_response<F, G>(
    status: StatusCode,
    response: reqwest::Response,
    mut state: OpenAiTranslatedStreamState,
    mut map_frame: F,
    request_started_at: Instant,
    on_complete: G,
) -> ProxyHttpResult<Response>
where
    F: FnMut(&mut OpenAiTranslatedStreamState, Value) -> Vec<Bytes> + Send + 'static,
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
                    for frame in drain_json_line_payloads(&mut buffer) {
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

        if let Some(frame) = flush_json_line_payload(&mut buffer) {
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
                &format!("Local AI proxy failed to build translated JSONL response: {error}"),
            )
        })
}

pub(super) fn handle_anthropic_openai_stream_frame(
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

pub(super) fn handle_gemini_openai_stream_frame(
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

pub(super) fn handle_ollama_openai_stream_frame(
    state: &mut OpenAiTranslatedStreamState,
    payload: Value,
) -> Vec<Bytes> {
    let mut events = Vec::new();
    state.update_model(payload.get("model").and_then(Value::as_str));
    state.merge_usage_from_payload(&payload);

    let text = extract_ollama_response_text(&payload);
    if !text.is_empty() {
        events.extend(state.push_text_delta(&text));
    }

    let has_tool_calls = payload
        .pointer("/message/tool_calls")
        .and_then(Value::as_array)
        .map(|items| !items.is_empty())
        .unwrap_or(false);
    if payload
        .get("done")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let finish_reason = if has_tool_calls {
            Some("tool_calls")
        } else {
            map_ollama_done_reason(payload.get("done_reason").and_then(Value::as_str))
        };
        events.extend(state.complete(finish_reason));
    }

    events
}
