use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post, put},
    Json, Router,
};
use sdkwork_claw_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};
use sdkwork_claw_host_studio::{StudioOpenClawGatewayInvokePayload, StudioPublicApiProvider};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::{
    bootstrap::ServerState,
    http::{
        auth::authorize_public_studio_request, error_response::categorized_error_response,
    },
};

pub fn api_public_routes() -> Router<ServerState> {
    Router::new()
        .route("/discovery", get(get_public_api_discovery))
        .route(
            "/studio/instances",
            get(list_public_studio_instances).post(create_public_studio_instance),
        )
        .route(
            "/studio/instances/{id}/conversations",
            get(list_public_studio_conversations),
        )
        .route(
            "/studio/instances/{id}/detail",
            get(get_public_studio_instance_detail),
        )
        .route(
            "/studio/instances/{id}/config",
            get(get_public_studio_instance_config).put(put_public_studio_instance_config),
        )
        .route(
            "/studio/instances/{id}/logs",
            get(get_public_studio_instance_logs),
        )
        .route(
            "/studio/instances/{id}/gateway/invoke",
            post(post_public_studio_instance_openclaw_gateway_invoke),
        )
        .route(
            "/studio/instances/{id}/tasks",
            post(post_public_studio_instance_task),
        )
        .route(
            "/studio/instances/{id}/tasks/{taskIdRoute}",
            put(put_public_studio_instance_task)
                .post(post_public_studio_instance_task_action)
                .delete(delete_public_studio_instance_task),
        )
        .route(
            "/studio/instances/{id}/tasks/{taskId}/executions",
            get(get_public_studio_instance_task_executions),
        )
        .route(
            "/studio/instances/{id}/files/{fileId}",
            put(put_public_studio_instance_file_content),
        )
        .route(
            "/studio/instances/{id}/llm-providers/{providerId}",
            put(put_public_studio_instance_llm_provider_config),
        )
        .route(
            "/studio/conversations/{conversationId}",
            put(put_public_studio_conversation).delete(delete_public_studio_conversation),
        )
        .route(
            "/studio/instances/{id}",
            get(get_public_studio_instance)
                .put(put_public_studio_instance)
                .post(post_public_studio_instance_action)
                .delete(delete_public_studio_instance),
        )
}

async fn get_public_api_discovery(
    State(state): State<ServerState>,
) -> Json<PublicApiDiscoveryRecord> {
    let mut capability_keys = vec!["api.discovery.read".to_string()];
    if state.studio_public_api.is_some() {
        capability_keys.push("api.studio.instances.read".to_string());
        capability_keys.push("api.studio.instances.write".to_string());
        capability_keys.push("api.studio.conversations.read".to_string());
        capability_keys.push("api.studio.conversations.write".to_string());
    }

    Json(PublicApiDiscoveryRecord {
        family: "api".to_string(),
        version: "v1".to_string(),
        base_path: "/claw/api/v1".to_string(),
        host_mode: state.mode.to_string(),
        host_version: state.host_platform_version(),
        openapi_document_url: "/claw/openapi/v1.json".to_string(),
        health_live_url: "/claw/health/live".to_string(),
        health_ready_url: "/claw/health/ready".to_string(),
        capability_keys,
        generated_at: state.host_platform_updated_at(),
    })
}

async fn list_public_studio_instances(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .list_instances()
        .map(Json)
        .map_err(|error| studio_public_api_projection_error(&state, "list studio instances", error))
}

async fn create_public_studio_instance(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider.create_instance(input).map(Json).map_err(|error| {
        studio_public_api_projection_error(&state, "create the requested studio instance", error)
    })
}

async fn get_public_studio_instance(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .get_instance(id.as_str())
        .map(|record| Json(record.unwrap_or(Value::Null)))
        .map_err(|error| studio_public_api_projection_error(&state, "get studio instance", error))
}

async fn put_public_studio_instance(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .update_instance(id.as_str(), input)
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "update the requested studio instance",
                error,
            )
        })
}

async fn delete_public_studio_instance(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<bool>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .delete_instance(id.as_str())
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "delete the requested studio instance",
                error,
            )
        })
}

async fn post_public_studio_instance_action(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    let (instance_id, action) = if let Some(instance_id) = id.strip_suffix(":start") {
        (instance_id, "start")
    } else if let Some(instance_id) = id.strip_suffix(":stop") {
        (instance_id, "stop")
    } else if let Some(instance_id) = id.strip_suffix(":restart") {
        (instance_id, "restart")
    } else {
        return Err(studio_public_api_unknown_instance_action_response(
            &state,
            id.as_str(),
        ));
    };

    let response = match action {
        "start" => provider.start_instance(instance_id).map_err(|error| {
            studio_public_api_projection_error(&state, "start the requested studio instance", error)
        })?,
        "stop" => provider.stop_instance(instance_id).map_err(|error| {
            studio_public_api_projection_error(&state, "stop the requested studio instance", error)
        })?,
        "restart" => provider.restart_instance(instance_id).map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "restart the requested studio instance",
                error,
            )
        })?,
        _ => {
            return Err(studio_public_api_unknown_instance_action_response(
                &state,
                id.as_str(),
            ))
        }
    };

    Ok(Json(response.unwrap_or(Value::Null)))
}

async fn list_public_studio_conversations(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .list_conversations(id.as_str())
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "list studio conversations for the requested instance",
                error,
            )
        })
}

async fn get_public_studio_instance_detail(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .get_instance_detail(id.as_str())
        .map(|record| Json(record.unwrap_or(Value::Null)))
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "get the studio instance detail projection",
                error,
            )
        })
}

async fn get_public_studio_instance_config(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .get_instance_config(id.as_str())
        .map(|record| Json(record.unwrap_or(Value::Null)))
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "get the studio instance config projection",
                error,
            )
        })
}

async fn put_public_studio_instance_config(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(config): Json<Value>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .update_instance_config(id.as_str(), config)
        .map(|record| Json(record.unwrap_or(Value::Null)))
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "update the requested studio instance config projection",
                error,
            )
        })
}

async fn get_public_studio_instance_logs(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<String>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .get_instance_logs(id.as_str())
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "get the studio instance logs projection",
                error,
            )
        })
}

async fn post_public_studio_instance_openclaw_gateway_invoke(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<StudioOpenClawGatewayInvokePayload>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .invoke_openclaw_gateway(id.as_str(), payload.request, payload.options)
        .map(Json)
        .map_err(|error| studio_public_api_openclaw_gateway_error_response(&state, id.as_str(), error))
}

async fn post_public_studio_instance_task(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .create_instance_task(id.as_str(), payload)
        .map(|_| Json(Value::Null))
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "create the requested studio workbench task",
                error,
            )
        })
}

async fn put_public_studio_instance_task(
    Path((id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .update_instance_task(id.as_str(), task_id.as_str(), payload)
        .map(|_| Json(Value::Null))
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "update the requested studio workbench task",
                error,
            )
        })
}

async fn delete_public_studio_instance_task(
    Path((id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<bool>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .delete_instance_task(id.as_str(), task_id.as_str())
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "delete the requested studio workbench task",
                error,
            )
        })
}

async fn get_public_studio_instance_task_executions(
    Path((id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .list_instance_task_executions(id.as_str(), task_id.as_str())
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "list the requested studio workbench task executions",
                error,
            )
        })
}

async fn post_public_studio_instance_task_action(
    Path((id, task_id_action)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    body: Bytes,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    if let Some(task_id) = task_id_action.strip_suffix(":clone") {
        let input = if body.is_empty() {
            StudioTaskCloneInput::default()
        } else {
            parse_task_action_body::<StudioTaskCloneInput>(&state, &body, "clone studio task")?
        };
        return provider
            .clone_instance_task(id.as_str(), task_id, input.name)
            .map(|_| Json(Value::Null))
            .map_err(|error| {
                studio_public_api_projection_error(
                    &state,
                    "clone the requested studio workbench task",
                    error,
                )
            });
    }

    if let Some(task_id) = task_id_action.strip_suffix(":run") {
        return provider
            .run_instance_task_now(id.as_str(), task_id)
            .map(Json)
            .map_err(|error| {
                studio_public_api_projection_error(
                    &state,
                    "run the requested studio workbench task immediately",
                    error,
                )
            });
    }

    if let Some(task_id) = task_id_action.strip_suffix(":status") {
        let input =
            parse_task_action_body::<StudioTaskStatusInput>(&state, &body, "update studio task status")?;
        return provider
            .update_instance_task_status(id.as_str(), task_id, input.status)
            .map(|_| Json(Value::Null))
            .map_err(|error| {
                studio_public_api_projection_error(
                    &state,
                    "update the requested studio workbench task status",
                    error,
                )
            });
    }

    Err(studio_public_api_unknown_task_action_response(
        &state,
        task_id_action.as_str(),
    ))
}

async fn put_public_studio_instance_file_content(
    Path((id, file_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<StudioFileContentInput>,
) -> Result<Json<bool>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .update_instance_file_content(id.as_str(), file_id.as_str(), input.content)
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "update the requested studio workbench file content",
                error,
            )
        })
}

async fn put_public_studio_instance_llm_provider_config(
    Path((id, provider_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<Value>,
) -> Result<Json<bool>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .update_instance_llm_provider_config(id.as_str(), provider_id.as_str(), input)
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "update the requested studio llm provider configuration",
                error,
            )
        })
}

async fn put_public_studio_conversation(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(mut record): Json<Value>,
) -> Result<Json<Value>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    if let Some(object) = record.as_object_mut() {
        object.insert("id".to_string(), Value::String(id.clone()));
    }

    provider
        .put_conversation(id.as_str(), record)
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "upsert the requested studio conversation projection",
                error,
            )
        })
}

async fn delete_public_studio_conversation(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<bool>, Response> {
    authorize_public_studio_request(&headers, &state)?;
    let provider = require_studio_public_api_provider(&state)?;
    provider
        .delete_conversation(id.as_str())
        .map(Json)
        .map_err(|error| {
            studio_public_api_projection_error(
                &state,
                "delete the requested studio conversation projection",
                error,
            )
        })
}

fn require_studio_public_api_provider(
    state: &ServerState,
) -> Result<Arc<dyn StudioPublicApiProvider>, Response> {
    state
        .studio_public_api
        .clone()
        .ok_or_else(|| studio_public_api_unavailable_response(state))
}

fn studio_public_api_unavailable_response(state: &ServerState) -> Response {
    categorized_error_response(
        "studio_public_api_unavailable",
        InternalErrorCategory::Dependency,
        "The canonical studio public API is not available for the active host shell.",
        StatusCode::SERVICE_UNAVAILABLE,
        true,
        InternalErrorResolution::WaitAndRetry,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_unknown_instance_action_response(state: &ServerState, id: &str) -> Response {
    categorized_error_response(
        "studio_public_api_unknown_instance_action",
        InternalErrorCategory::Validation,
        &format!(
            "The canonical studio public API does not support instance action route \"{id}\"."
        ),
        StatusCode::NOT_FOUND,
        false,
        InternalErrorResolution::FixRequest,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_unknown_task_action_response(
    state: &ServerState,
    task_id_action: &str,
) -> Response {
    categorized_error_response(
        "studio_public_api_unknown_task_action",
        InternalErrorCategory::Validation,
        &format!(
            "The canonical studio public API does not support workbench task action route \"{task_id_action}\"."
        ),
        StatusCode::NOT_FOUND,
        false,
        InternalErrorResolution::FixRequest,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_projection_error(
    state: &ServerState,
    action: &str,
    error: String,
) -> Response {
    categorized_error_response(
        "studio_public_api_projection_failed",
        InternalErrorCategory::System,
        &format!("The canonical studio public API could not {action}: {error}"),
        StatusCode::INTERNAL_SERVER_ERROR,
        false,
        InternalErrorResolution::Retry,
        state.host_platform_updated_at(),
    )
}

fn parse_task_action_body<T>(
    state: &ServerState,
    body: &Bytes,
    action: &str,
) -> Result<T, Response>
where
    T: DeserializeOwned,
{
    serde_json::from_slice(body).map_err(|error| {
        categorized_error_response(
            "studio_public_api_invalid_task_action_body",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not {action} because the request body was invalid JSON: {error}"
            ),
            StatusCode::BAD_REQUEST,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        )
    })
}

fn studio_public_api_openclaw_gateway_error_response(
    state: &ServerState,
    instance_id: &str,
    error: String,
) -> Response {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("does not exist") {
        return categorized_error_response(
            "studio_public_api_openclaw_gateway_instance_missing",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not find studio instance \"{instance_id}\" for OpenClaw gateway invocation."
            ),
            StatusCode::NOT_FOUND,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    if normalized.contains("does not expose a managed openclaw gateway")
        || normalized.contains("invalid")
        || normalized.contains("required")
        || normalized.contains("unsupported")
    {
        return categorized_error_response(
            "studio_public_api_openclaw_gateway_invalid_request",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API rejected the OpenClaw gateway invocation request for studio instance \"{instance_id}\": {error}"
            ),
            StatusCode::BAD_REQUEST,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    categorized_error_response(
        "studio_public_api_openclaw_gateway_unavailable",
        InternalErrorCategory::Dependency,
        &format!(
            "The canonical studio public API could not reach the managed OpenClaw gateway for studio instance \"{instance_id}\": {error}"
        ),
        StatusCode::SERVICE_UNAVAILABLE,
        true,
        InternalErrorResolution::WaitAndRetry,
        state.host_platform_updated_at(),
    )
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct StudioTaskCloneInput {
    name: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StudioTaskStatusInput {
    status: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StudioFileContentInput {
    content: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicApiDiscoveryRecord {
    family: String,
    version: String,
    base_path: String,
    host_mode: String,
    host_version: String,
    openapi_document_url: String,
    health_live_url: String,
    health_ready_url: String,
    capability_keys: Vec<String>,
    generated_at: u64,
}
