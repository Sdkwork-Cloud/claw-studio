#![recursion_limit = "256"]

mod bootstrap;
mod http;

use axum::serve;
use sdkwork_claw_host_core::host_core_metadata;
use tokio::net::TcpListener;

use crate::{bootstrap::build_server_state, http::router::build_router};

#[tokio::main]
async fn main() {
    let metadata = host_core_metadata();
    let state = build_server_state();
    let mode = state.mode;
    let listen_address = state.listen_address();
    let app = build_router(state);
    let listener = TcpListener::bind(listen_address)
        .await
        .expect("server listener should bind");

    println!(
        "{} [{}] listening on http://{}",
        metadata.package_name, mode, listen_address
    );

    serve(listener, app)
        .await
        .expect("server should continue serving requests");
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    use crate::{
        bootstrap::{build_server_state, build_server_state_with_rollout_data_dir},
        http::router::build_router,
    };

    #[tokio::test]
    async fn health_route_returns_ok() {
        let app = build_router(build_server_state());
        let response = app
            .oneshot(
                Request::get("/claw/health/live")
                    .body(Body::empty())
                    .expect("health request should build"),
            )
            .await
            .expect("health request should succeed");

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn manage_rollout_list_route_returns_seeded_rollouts() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("list"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/manage/v1/rollouts")
                    .body(Body::empty())
                    .expect("rollout list request should build"),
            )
            .await
            .expect("rollout list request should succeed");
        let status = response.status();
        let body = response_body_text(response).await;

        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("\"rollout-a\""));
    }

    #[tokio::test]
    async fn manage_rollout_preview_and_start_routes_return_live_records() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("preview-start"),
        ));

        let preview_response = app
            .clone()
            .oneshot(
                Request::post("/claw/manage/v1/rollouts/rollout-a:preview")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"includeTargets":true,"forceRecompute":false}"#,
                    ))
                    .expect("rollout preview request should build"),
            )
            .await
            .expect("rollout preview request should succeed");
        let preview_status = preview_response.status();
        let preview_body = response_body_text(preview_response).await;

        assert_eq!(preview_status, StatusCode::OK);
        assert!(preview_body.contains("\"rolloutId\":\"rollout-a\""));
        assert!(preview_body.contains("\"phase\":\"ready\""));

        let start_response = app
            .oneshot(
                Request::post("/claw/manage/v1/rollouts/rollout-a:start")
                    .body(Body::empty())
                    .expect("rollout start request should build"),
            )
            .await
            .expect("rollout start request should succeed");
        let start_status = start_response.status();
        let start_body = response_body_text(start_response).await;

        assert_eq!(start_status, StatusCode::OK);
        assert!(start_body.contains("\"id\":\"rollout-a\""));
        assert!(start_body.contains("\"phase\":\"promoting\""));
    }

    #[tokio::test]
    async fn manage_rollout_item_route_returns_requested_rollout() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("rollout-item"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/manage/v1/rollouts/rollout-a")
                    .body(Body::empty())
                    .expect("rollout item request should build"),
            )
            .await
            .expect("rollout item request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(body.get("id").and_then(Value::as_str), Some("rollout-a"));
        assert_eq!(body.get("phase").and_then(Value::as_str), Some("draft"));
        assert_eq!(body.get("targetCount").and_then(Value::as_u64), Some(2));
    }

    #[tokio::test]
    async fn manage_rollout_targets_route_returns_preview_targets() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("rollout-targets"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/manage/v1/rollouts/rollout-a/targets")
                    .body(Body::empty())
                    .expect("rollout targets request should build"),
            )
            .await
            .expect("rollout targets request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;
        let items = body
            .get("items")
            .and_then(Value::as_array)
            .expect("rollout targets response should include items");

        assert_eq!(status, StatusCode::OK);
        assert_eq!(body.get("rolloutId").and_then(Value::as_str), Some("rollout-a"));
        assert_eq!(body.get("total").and_then(Value::as_u64), Some(2));
        assert!(items.iter().any(|item| {
            item.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && item.get("preflightOutcome").and_then(Value::as_str) == Some("admissible")
                && item.get("desiredStateRevision").and_then(Value::as_u64).is_some()
                && item.get("desiredStateHash").and_then(Value::as_str).is_some()
        }));
    }

    #[tokio::test]
    async fn manage_rollout_target_item_route_returns_requested_target() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("rollout-target-item"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/manage/v1/rollouts/rollout-a/targets/local-built-in")
                    .body(Body::empty())
                    .expect("rollout target item request should build"),
            )
            .await
            .expect("rollout target item request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            body.get("nodeId").and_then(Value::as_str),
            Some("local-built-in")
        );
        assert_eq!(
            body.get("preflightOutcome").and_then(Value::as_str),
            Some("admissible")
        );
        assert!(body.get("desiredStateRevision").and_then(Value::as_u64).is_some());
        assert!(body.get("desiredStateHash").and_then(Value::as_str).is_some());
    }

    #[tokio::test]
    async fn manage_rollout_waves_route_returns_grouped_wave_summary() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("rollout-waves"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/manage/v1/rollouts/rollout-b/waves")
                    .body(Body::empty())
                    .expect("rollout waves request should build"),
            )
            .await
            .expect("rollout waves request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;
        let items = body
            .get("items")
            .and_then(Value::as_array)
            .expect("rollout waves response should include items");

        assert_eq!(status, StatusCode::OK);
        assert_eq!(body.get("rolloutId").and_then(Value::as_str), Some("rollout-b"));
        assert_eq!(body.get("total").and_then(Value::as_u64), Some(2));
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].get("waveId").and_then(Value::as_str), Some("wave-1"));
        assert_eq!(items[0].get("index").and_then(Value::as_u64), Some(1));
        assert_eq!(items[0].get("phase").and_then(Value::as_str), Some("failed"));
        assert_eq!(items[0].get("targetCount").and_then(Value::as_u64), Some(1));
        assert_eq!(items[0].get("blockedCount").and_then(Value::as_u64), Some(1));
        assert_eq!(items[1].get("waveId").and_then(Value::as_str), Some("wave-2"));
        assert_eq!(items[1].get("index").and_then(Value::as_u64), Some(2));
        assert_eq!(items[1].get("phase").and_then(Value::as_str), Some("failed"));
        assert_eq!(items[1].get("targetCount").and_then(Value::as_u64), Some(1));
        assert_eq!(items[1].get("blockedCount").and_then(Value::as_u64), Some(1));
    }

    #[tokio::test]
    async fn manage_rollout_missing_route_returns_error_envelope() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("rollout-missing-envelope"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/manage/v1/rollouts/rollout-missing")
                    .body(Body::empty())
                    .expect("missing rollout request should build"),
            )
            .await
            .expect("missing rollout request should return a response");
        let status = response.status();
        let correlation_id = response
            .headers()
            .get("x-claw-correlation-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
            .expect("missing rollout response should include x-claw-correlation-id");
        let body = response_body_json(response).await;
        let error = body
            .get("error")
            .and_then(Value::as_object)
            .expect("missing rollout response should include an error envelope");

        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(error.get("code").and_then(Value::as_str), Some("rollout_not_found"));
        assert_eq!(error.get("category").and_then(Value::as_str), Some("state"));
        assert_eq!(error.get("httpStatus").and_then(Value::as_u64), Some(404));
        assert_eq!(
            error.get("resolution").and_then(Value::as_str),
            Some("fix_request")
        );
        assert_eq!(
            error.get("correlationId").and_then(Value::as_str),
            Some(correlation_id.as_str())
        );
    }

    #[tokio::test]
    async fn manage_rollout_preview_invalid_body_returns_error_envelope() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("rollout-preview-invalid-body-envelope"),
        ));
        let response = app
            .oneshot(
                Request::post("/claw/manage/v1/rollouts/rollout-a:preview")
                    .header("content-type", "application/json")
                    .body(Body::from("{"))
                    .expect("invalid preview request should build"),
            )
            .await
            .expect("invalid preview request should return a response");
        let status = response.status();
        let correlation_id = response
            .headers()
            .get("x-claw-correlation-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
            .expect("invalid preview response should include x-claw-correlation-id");
        let body = response_body_json(response).await;
        let error = body
            .get("error")
            .and_then(Value::as_object)
            .expect("invalid preview response should include an error envelope");

        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(error.get("code").and_then(Value::as_str), Some("invalid_body"));
        assert_eq!(error.get("category").and_then(Value::as_str), Some("validation"));
        assert_eq!(error.get("httpStatus").and_then(Value::as_u64), Some(400));
        assert_eq!(
            error.get("correlationId").and_then(Value::as_str),
            Some(correlation_id.as_str())
        );
    }

    #[tokio::test]
    async fn internal_host_platform_route_returns_server_status() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("host-platform"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/internal/v1/host-platform")
                    .body(Body::empty())
                    .expect("host platform request should build"),
            )
            .await
            .expect("host platform request should succeed");
        let status = response.status();
        let body = response_body_text(response).await;

        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("\"mode\":\"server\""));
        assert!(body.contains("\"manageBasePath\":\"/claw/manage/v1\""));
        assert!(body.contains("\"internalBasePath\":\"/claw/internal/v1\""));
    }

    #[tokio::test]
    async fn public_api_discovery_route_returns_native_public_metadata() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("api-discovery"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/api/v1/discovery")
                    .body(Body::empty())
                    .expect("public api discovery request should build"),
            )
            .await
            .expect("public api discovery request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(body.get("family").and_then(Value::as_str), Some("api"));
        assert_eq!(body.get("version").and_then(Value::as_str), Some("v1"));
        assert_eq!(
            body.get("basePath").and_then(Value::as_str),
            Some("/claw/api/v1")
        );
        assert_eq!(body.get("hostMode").and_then(Value::as_str), Some("server"));
        assert_eq!(
            body.get("openapiDocumentUrl").and_then(Value::as_str),
            Some("/claw/openapi/v1.json")
        );
        assert!(body
            .get("capabilityKeys")
            .and_then(Value::as_array)
            .is_some_and(|items| items
                .iter()
                .any(|item| item.as_str() == Some("api.discovery.read"))));
    }

    #[tokio::test]
    async fn openapi_discovery_route_returns_native_document_metadata() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("openapi-discovery"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/openapi/discovery")
                    .body(Body::empty())
                    .expect("openapi discovery request should build"),
            )
            .await
            .expect("openapi discovery request should succeed");
        let status = response.status();

        assert_eq!(status, StatusCode::OK);
        let body = response_body_json(response).await;
        assert_eq!(body.get("family").and_then(Value::as_str), Some("openapi"));
        assert!(body
            .get("documents")
            .and_then(Value::as_array)
            .is_some_and(|documents| {
                documents.iter().any(|document| {
                    document.get("id").and_then(Value::as_str) == Some("claw-native-v1")
                        && document.get("url").and_then(Value::as_str)
                            == Some("/claw/openapi/v1.json")
                        && document
                            .get("apiFamilies")
                            .and_then(Value::as_array)
                            .is_some_and(|families| {
                                families.iter().any(|family| family.as_str() == Some("api"))
                            })
                })
            }));
    }

    #[tokio::test]
    async fn openapi_v1_document_route_lists_current_native_paths() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("openapi-v1"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/openapi/v1.json")
                    .body(Body::empty())
                    .expect("openapi document request should build"),
            )
            .await
            .expect("openapi document request should succeed");
        let status = response.status();

        assert_eq!(status, StatusCode::OK);
        let body = response_body_json(response).await;
        let paths = body
            .get("paths")
            .and_then(Value::as_object)
            .expect("openapi document should include paths");
        assert_eq!(body.get("openapi").and_then(Value::as_str), Some("3.1.0"));
        assert!(paths.contains_key("/claw/health/live"));
        assert!(paths.contains_key("/claw/api/v1/discovery"));
        assert!(paths.contains_key("/claw/internal/v1/node-sessions"));
        assert!(paths.contains_key("/claw/internal/v1/node-sessions:hello"));
        assert!(paths.contains_key("/claw/internal/v1/node-sessions/{sessionId}:admit"));
        assert!(paths.contains_key("/claw/internal/v1/node-sessions/{sessionId}:heartbeat"));
        assert!(paths.contains_key(
            "/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state"
        ));
        assert!(paths.contains_key(
            "/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state"
        ));
        assert!(paths.contains_key("/claw/internal/v1/node-sessions/{sessionId}:close"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts/{rolloutId}"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts/{rolloutId}/targets"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts/{rolloutId}/waves"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts/{rolloutId}:preview"));
        assert!(paths.contains_key("/claw/manage/v1/rollouts/{rolloutId}:start"));
    }

    #[tokio::test]
    async fn openapi_v1_document_declares_json_manage_error_envelopes() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("openapi-manage-errors"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/openapi/v1.json")
                    .body(Body::empty())
                    .expect("openapi document request should build"),
            )
            .await
            .expect("openapi document request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;
        let paths = body
            .get("paths")
            .and_then(Value::as_object)
            .expect("openapi document should include paths");
        let rollout_item_get = paths
            .get("/claw/manage/v1/rollouts/{rolloutId}")
            .and_then(Value::as_object)
            .and_then(|path| path.get("get"))
            .and_then(Value::as_object)
            .expect("rollout item path should expose a GET operation");
        let preview_post = paths
            .get("/claw/manage/v1/rollouts/{rolloutId}:preview")
            .and_then(Value::as_object)
            .and_then(|path| path.get("post"))
            .and_then(Value::as_object)
            .expect("rollout preview path should expose a POST operation");

        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            rollout_item_get
                .get("responses")
                .and_then(Value::as_object)
                .and_then(|responses| responses.get("404"))
                .and_then(Value::as_object)
                .and_then(|response| response.get("content"))
                .and_then(Value::as_object)
                .and_then(|content| content.get("application/json"))
                .and_then(Value::as_object)
                .and_then(|json| json.get("schema"))
                .and_then(Value::as_object)
                .and_then(|schema| schema.get("$ref"))
                .and_then(Value::as_str),
            Some("#/components/schemas/InternalErrorEnvelope")
        );
        assert_eq!(
            preview_post
                .get("responses")
                .and_then(Value::as_object)
                .and_then(|responses| responses.get("400"))
                .and_then(Value::as_object)
                .and_then(|response| response.get("content"))
                .and_then(Value::as_object)
                .and_then(|content| content.get("application/json"))
                .and_then(Value::as_object)
                .and_then(|json| json.get("schema"))
                .and_then(Value::as_object)
                .and_then(|schema| schema.get("$ref"))
                .and_then(Value::as_str),
            Some("#/components/schemas/InternalErrorEnvelope")
        );
    }

    #[tokio::test]
    async fn internal_node_sessions_route_returns_projected_combined_sessions() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions"),
        ));
        let response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions request should build"),
            )
            .await
            .expect("node sessions request should succeed");
        let status = response.status();
        let body = response_body_json(response).await;
        let sessions = body
            .as_array()
            .expect("node sessions response should be a json array");

        assert_eq!(status, StatusCode::OK);
        assert_eq!(sessions.len(), 2);
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("state").and_then(Value::as_str) == Some("admitted")
                && session.get("compatibilityState").and_then(Value::as_str) == Some("compatible")
        }));
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("managed-remote")
                && session.get("state").and_then(Value::as_str) == Some("admitted")
                && session.get("compatibilityState").and_then(Value::as_str) == Some("compatible")
                && session.get("desiredStateRevision").and_then(Value::as_u64).is_some()
                && session.get("desiredStateHash").and_then(Value::as_str).is_some()
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_hello_creates_live_session_visible_in_list() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-hello"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_status = hello_response.status();
        let hello_body = response_body_json(hello_response).await;

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_status = list_response.status();
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(hello_status, StatusCode::OK);
        assert_eq!(
            hello_body.get("nextAction").and_then(Value::as_str),
            Some("callAdmit")
        );
        assert_eq!(list_status, StatusCode::OK);
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("state").and_then(Value::as_str) == Some("pending")
                && session.get("compatibilityState").and_then(Value::as_str) == Some("compatible")
        }));
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("managed-remote")
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_admit_transitions_live_session_state() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-admit"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");
        let hello_token = hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("hello response should include helloToken");

        let admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{hello_token}"}}"#
                )))
                .expect("node admit request should build"),
            )
            .await
            .expect("node admit request should succeed");
        let admit_status = admit_response.status();
        let admit_body = response_body_json(admit_response).await;

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(admit_status, StatusCode::OK);
        assert_eq!(
            admit_body.get("sessionId").and_then(Value::as_str),
            Some(session_id)
        );
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("state").and_then(Value::as_str) == Some("admitted")
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_admit_invalid_body_returns_error_envelope() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-admit-invalid-body"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");

        let invalid_admit_response = app
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(r#"{"unexpected":"value"}"#))
                .expect("invalid admit request should build"),
            )
            .await
            .expect("invalid admit request should return a response");
        let invalid_admit_status = invalid_admit_response.status();
        let invalid_admit_correlation_id = invalid_admit_response
            .headers()
            .get("x-claw-correlation-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
            .expect("invalid admit response should include x-claw-correlation-id");
        let invalid_admit_body = response_body_json(invalid_admit_response).await;
        let error = invalid_admit_body
            .get("error")
            .and_then(Value::as_object)
            .expect("invalid admit response should include an error envelope");

        assert_eq!(invalid_admit_status, StatusCode::BAD_REQUEST);
        assert_eq!(
            error.get("code").and_then(Value::as_str),
            Some("invalid_body")
        );
        assert_eq!(
            error.get("category").and_then(Value::as_str),
            Some("validation")
        );
        assert_eq!(
            error.get("resolution").and_then(Value::as_str),
            Some("fix_request")
        );
        assert_eq!(
            error.get("correlationId").and_then(Value::as_str),
            Some(invalid_admit_correlation_id.as_str())
        );
    }

    #[tokio::test]
    async fn internal_node_sessions_heartbeat_refreshes_live_session() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-heartbeat"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");
        let hello_token = hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("hello response should include helloToken");

        let admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{hello_token}"}}"#
                )))
                .expect("node admit request should build"),
            )
            .await
            .expect("node admit request should succeed");
        let admit_body = response_body_json(admit_response).await;
        let lease_id = admit_body
            .get("lease")
            .and_then(Value::as_object)
            .and_then(|lease| lease.get("leaseId"))
            .and_then(Value::as_str)
            .expect("admit response should include leaseId");

        let heartbeat_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:heartbeat"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"leaseId":"{lease_id}"}}"#
                )))
                .expect("node heartbeat request should build"),
            )
            .await
            .expect("node heartbeat request should succeed");
        let heartbeat_status = heartbeat_response.status();
        let heartbeat_body = response_body_json(heartbeat_response).await;

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(heartbeat_status, StatusCode::OK);
        assert_eq!(
            heartbeat_body
                .get("lease")
                .and_then(Value::as_object)
                .and_then(|lease| lease.get("leaseId"))
                .and_then(Value::as_str),
            Some(lease_id)
        );
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("state").and_then(Value::as_str) == Some("admitted")
                && session.get("lastSeenAt").and_then(Value::as_u64).is_some_and(|value| value > 0)
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_pull_desired_state_returns_projection_then_not_modified() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-pull"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");
        let hello_token = hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("hello response should include helloToken");

        let admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{hello_token}"}}"#
                )))
                .expect("node admit request should build"),
            )
            .await
            .expect("node admit request should succeed");
        let admit_body = response_body_json(admit_response).await;
        let lease_id = admit_body
            .get("lease")
            .and_then(Value::as_object)
            .and_then(|lease| lease.get("leaseId"))
            .and_then(Value::as_str)
            .expect("admit response should include leaseId");

        let first_pull_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:pull-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "supportedConfigProjectionVersions":["v1"],
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"]
                    }}"#
                )))
                .expect("node pull desired state request should build"),
            )
            .await
            .expect("node pull desired state request should succeed");
        let first_pull_status = first_pull_response.status();
        let first_pull_body = response_body_json(first_pull_response).await;
        let desired_state_revision = first_pull_body
            .get("desiredStateRevision")
            .and_then(Value::as_u64)
            .expect("projection response should include desiredStateRevision");
        let desired_state_hash = first_pull_body
            .get("desiredStateHash")
            .and_then(Value::as_str)
            .expect("projection response should include desiredStateHash");

        let second_pull_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:pull-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "knownRevision":{desired_state_revision},
                      "knownHash":"{desired_state_hash}",
                      "supportedConfigProjectionVersions":["v1"],
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"]
                    }}"#
                )))
                .expect("node pull desired state request should build"),
            )
            .await
            .expect("node pull desired state request should succeed");
        let second_pull_status = second_pull_response.status();
        let second_pull_body = response_body_json(second_pull_response).await;

        assert_eq!(first_pull_status, StatusCode::OK);
        assert_eq!(
            first_pull_body.get("mode").and_then(Value::as_str),
            Some("projection")
        );
        assert_eq!(
            first_pull_body
                .get("projection")
                .and_then(Value::as_object)
                .and_then(|projection| projection.get("nodeId"))
                .and_then(Value::as_str),
            Some("local-built-in")
        );
        assert_eq!(second_pull_status, StatusCode::OK);
        assert_eq!(
            second_pull_body.get("mode").and_then(Value::as_str),
            Some("notModified")
        );
    }

    #[tokio::test]
    async fn internal_node_sessions_ack_desired_state_records_apply_markers() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-ack"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");
        let hello_token = hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("hello response should include helloToken");

        let admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{hello_token}"}}"#
                )))
                .expect("node admit request should build"),
            )
            .await
            .expect("node admit request should succeed");
        let admit_body = response_body_json(admit_response).await;
        let lease_id = admit_body
            .get("lease")
            .and_then(Value::as_object)
            .and_then(|lease| lease.get("leaseId"))
            .and_then(Value::as_str)
            .expect("admit response should include leaseId");

        let pull_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:pull-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "supportedConfigProjectionVersions":["v1"],
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"]
                    }}"#
                )))
                .expect("node pull desired state request should build"),
            )
            .await
            .expect("node pull desired state request should succeed");
        let pull_body = response_body_json(pull_response).await;
        let desired_state_revision = pull_body
            .get("desiredStateRevision")
            .and_then(Value::as_u64)
            .expect("pull response should include desiredStateRevision");
        let desired_state_hash = pull_body
            .get("desiredStateHash")
            .and_then(Value::as_str)
            .expect("pull response should include desiredStateHash");

        let ack_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:ack-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "desiredStateRevision":{desired_state_revision},
                      "desiredStateHash":"{desired_state_hash}",
                      "result":"applied",
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"],
                      "observedEndpoints":["http://127.0.0.1:18797"],
                      "applySummary":{{
                        "appliedAt":4567,
                        "errors":[],
                        "warnings":[],
                        "compatibilityReasons":[]
                      }}
                    }}"#
                )))
                .expect("node ack desired state request should build"),
            )
            .await
            .expect("node ack desired state request should succeed");
        let ack_status = ack_response.status();
        let ack_body = response_body_json(ack_response).await;

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_status = list_response.status();
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(ack_status, StatusCode::OK);
        assert_eq!(
            ack_body.get("recorded").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            ack_body.get("nextExpectedRevision").and_then(Value::as_u64),
            Some(desired_state_revision)
        );
        assert_eq!(list_status, StatusCode::OK);
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("lastAppliedRevision").and_then(Value::as_u64)
                    == Some(desired_state_revision)
                && session.get("lastKnownGoodRevision").and_then(Value::as_u64)
                    == Some(desired_state_revision)
                && session.get("lastApplyResult").and_then(Value::as_str) == Some("applied")
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_ack_desired_state_rejects_stale_revision() {
        let rollout_data_dir = create_test_rollout_data_dir("node-sessions-stale-ack");
        let app = build_router(build_server_state_with_rollout_data_dir(
            rollout_data_dir.clone(),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");
        let hello_token = hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("hello response should include helloToken");

        let admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{hello_token}"}}"#
                )))
                .expect("node admit request should build"),
            )
            .await
            .expect("node admit request should succeed");
        let admit_body = response_body_json(admit_response).await;
        let lease_id = admit_body
            .get("lease")
            .and_then(Value::as_object)
            .and_then(|lease| lease.get("leaseId"))
            .and_then(Value::as_str)
            .expect("admit response should include leaseId");

        let first_pull_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:pull-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "supportedConfigProjectionVersions":["v1"],
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"]
                    }}"#
                )))
                .expect("initial pull request should build"),
            )
            .await
            .expect("initial pull request should succeed");
        let first_pull_body = response_body_json(first_pull_response).await;
        let desired_state_revision = first_pull_body
            .get("desiredStateRevision")
            .and_then(Value::as_u64)
            .expect("initial pull response should include desiredStateRevision");
        let desired_state_hash = first_pull_body
            .get("desiredStateHash")
            .and_then(Value::as_str)
            .expect("initial pull response should include desiredStateHash");

        advance_rollout_target_semantic_payload(
            &rollout_data_dir,
            "rollout-a",
            "local-built-in",
            ";generation=2",
        );
        let refreshed_app = build_router(build_server_state_with_rollout_data_dir(
            rollout_data_dir.clone(),
        ));

        let refreshed_pull_response = refreshed_app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:pull-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "knownRevision":{desired_state_revision},
                      "knownHash":"{desired_state_hash}",
                      "supportedConfigProjectionVersions":["v1"],
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"]
                    }}"#
                )))
                .expect("refreshed pull request should build"),
            )
            .await
            .expect("refreshed pull request should succeed");
        let refreshed_pull_status = refreshed_pull_response.status();
        let refreshed_pull_body = response_body_json(refreshed_pull_response).await;
        let next_desired_state_revision = refreshed_pull_body
            .get("desiredStateRevision")
            .and_then(Value::as_u64)
            .expect("refreshed pull response should include desiredStateRevision");

        let stale_ack_response = refreshed_app
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:ack-desired-state"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "desiredStateRevision":{desired_state_revision},
                      "desiredStateHash":"{desired_state_hash}",
                      "result":"applied",
                      "effectiveCapabilities":["desired-state.pull","runtime.apply"],
                      "observedEndpoints":["http://127.0.0.1:18797"],
                      "applySummary":{{
                        "appliedAt":4567,
                        "errors":[],
                        "warnings":[],
                        "compatibilityReasons":[]
                      }}
                    }}"#
                )))
                .expect("stale ack request should build"),
            )
            .await
            .expect("stale ack request should return a response");
        let stale_ack_status = stale_ack_response.status();
        let stale_ack_correlation_id = stale_ack_response
            .headers()
            .get("x-claw-correlation-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
            .expect("stale ack response should include x-claw-correlation-id");
        let stale_ack_body = response_body_json(stale_ack_response).await;
        let stale_ack_error = stale_ack_body
            .get("error")
            .and_then(Value::as_object)
            .expect("stale ack response should include an error envelope");

        assert_eq!(refreshed_pull_status, StatusCode::OK);
        assert_eq!(
            refreshed_pull_body.get("mode").and_then(Value::as_str),
            Some("projection")
        );
        assert!(next_desired_state_revision > desired_state_revision);
        assert_eq!(stale_ack_status, StatusCode::CONFLICT);
        assert_eq!(
            stale_ack_error.get("code").and_then(Value::as_str),
            Some("stale_ack")
        );
        assert_eq!(
            stale_ack_error.get("category").and_then(Value::as_str),
            Some("state")
        );
        assert_eq!(
            stale_ack_error.get("resolution").and_then(Value::as_str),
            Some("fetch_latest_projection")
        );
        assert_eq!(
            stale_ack_error.get("correlationId").and_then(Value::as_str),
            Some(stale_ack_correlation_id.as_str())
        );
    }

    #[tokio::test]
    async fn internal_node_sessions_heartbeat_rejects_expired_lease() {
        let state = build_server_state_with_rollout_data_dir(create_test_rollout_data_dir(
            "node-sessions-expired-lease",
        ));
        let compatibility_preview = state
            .rollout_control_plane
            .preview_node_session_compatibility("rollout-a", "local-built-in")
            .expect("compatibility preview should succeed");
        let hello = state
            .node_session_registry
            .hello(
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview,
                1_000,
            )
            .expect("hello should create a live session");
        let admit = state
            .node_session_registry
            .admit(
                &hello.session_id,
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2_000,
            )
            .expect("admit should transition the session");
        let session_id = hello.session_id.clone();
        let lease_id = admit.lease.lease_id.clone();
        let app = build_router(state);

        let response = app
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:heartbeat"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"leaseId":"{lease_id}"}}"#
                )))
                .expect("node heartbeat request should build"),
            )
            .await
            .expect("node heartbeat request should return a response");
        let status = response.status();
        let body = response_body_text(response).await;

        assert_eq!(status, StatusCode::CONFLICT);
        assert!(body.contains("expired"));
    }

    #[tokio::test]
    async fn internal_node_sessions_close_transitions_live_session_to_closed() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-close"),
        ));
        let hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("node hello request should build"),
            )
            .await
            .expect("node hello request should succeed");
        let hello_body = response_body_json(hello_response).await;
        let session_id = hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("hello response should include sessionId");
        let hello_token = hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("hello response should include helloToken");

        let admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{hello_token}"}}"#
                )))
                .expect("node admit request should build"),
            )
            .await
            .expect("node admit request should succeed");
        let admit_body = response_body_json(admit_response).await;
        let lease_id = admit_body
            .get("lease")
            .and_then(Value::as_object)
            .and_then(|lease| lease.get("leaseId"))
            .and_then(Value::as_str)
            .expect("admit response should include leaseId");

        let close_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{session_id}:close"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "leaseId":"{lease_id}",
                      "reason":"shutdown"
                    }}"#
                )))
                .expect("node close request should build"),
            )
            .await
            .expect("node close request should succeed");
        let close_status = close_response.status();
        let close_body = response_body_json(close_response).await;

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_status = list_response.status();
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(close_status, StatusCode::OK);
        assert_eq!(close_body.get("closed").and_then(Value::as_bool), Some(true));
        assert_eq!(
            close_body
                .get("replacementExpected")
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(list_status, StatusCode::OK);
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("state").and_then(Value::as_str) == Some("closed")
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_close_with_successor_keeps_successor_visible() {
        let state = build_server_state_with_rollout_data_dir(create_test_rollout_data_dir(
            "node-sessions-close-successor",
        ));
        let compatibility_preview = state
            .rollout_control_plane
            .preview_node_session_compatibility("rollout-a", "local-built-in")
            .expect("compatibility preview should succeed");
        let first_hello = state
            .node_session_registry
            .hello(
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview.clone(),
                1_000,
            )
            .expect("first hello should create a live session");
        let first_admit = state
            .node_session_registry
            .admit(
                &first_hello.session_id,
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionAdmitInput {
                    hello_token: first_hello.hello_token.clone(),
                },
                2_000,
            )
            .expect("first admit should transition the session");
        let second_hello = state
            .node_session_registry
            .hello(
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloInput {
                    boot_id: "boot-local-2".to_string(),
                    node_claim: sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: sdkwork_claw_host_core::internal::node_sessions::NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview,
                3_000,
            )
            .expect("second hello should create the successor session");
        state
            .node_session_registry
            .admit(
                &second_hello.session_id,
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionAdmitInput {
                    hello_token: second_hello.hello_token.clone(),
                },
                4_000,
            )
            .expect("second admit should transition the successor session");
        state
            .node_session_registry
            .close(
                &first_hello.session_id,
                sdkwork_claw_host_core::internal::node_sessions::NodeSessionCloseInput {
                    lease_id: first_admit.lease.lease_id.clone(),
                    reason: "restart".to_string(),
                    successor_hint: Some(second_hello.session_id.clone()),
                },
                5_000,
            )
            .expect("close should persist the successor hint");
        let app = build_router(state);

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_status = list_response.status();
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(list_status, StatusCode::OK);
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("sessionId").and_then(Value::as_str)
                    == Some(second_hello.session_id.as_str())
                && session.get("state").and_then(Value::as_str) == Some("admitted")
        }));
    }

    #[tokio::test]
    async fn internal_node_sessions_heartbeat_rejects_replaced_session() {
        let app = build_router(build_server_state_with_rollout_data_dir(
            create_test_rollout_data_dir("node-sessions-replaced-heartbeat"),
        ));
        let first_hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-1",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("first node hello request should build"),
            )
            .await
            .expect("first node hello request should succeed");
        let first_hello_body = response_body_json(first_hello_response).await;
        let first_session_id = first_hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("first hello response should include sessionId");
        let first_hello_token = first_hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("first hello response should include helloToken");

        let first_admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{first_session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{first_hello_token}"}}"#
                )))
                .expect("first node admit request should build"),
            )
            .await
            .expect("first node admit request should succeed");
        let first_admit_body = response_body_json(first_admit_response).await;
        let first_lease_id = first_admit_body
            .get("lease")
            .and_then(Value::as_object)
            .and_then(|lease| lease.get("leaseId"))
            .and_then(Value::as_str)
            .expect("first admit response should include leaseId");

        let second_hello_response = app
            .clone()
            .oneshot(
                Request::post("/claw/internal/v1/node-sessions:hello")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                          "bootId":"boot-local-2",
                          "nodeClaim":{
                            "claimedNodeId":"local-built-in",
                            "hostPlatform":"linux",
                            "hostArch":"x64"
                          },
                          "versionManifest":{
                            "internalApiVersion":"v1",
                            "configProjectionVersion":"v1"
                          },
                          "capabilities":["desired-state.pull","runtime.apply"]
                        }"#,
                    ))
                    .expect("second node hello request should build"),
            )
            .await
            .expect("second node hello request should succeed");
        let second_hello_body = response_body_json(second_hello_response).await;
        let second_session_id = second_hello_body
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("second hello response should include sessionId");
        let second_hello_token = second_hello_body
            .get("helloToken")
            .and_then(Value::as_str)
            .expect("second hello response should include helloToken");

        let second_admit_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{second_session_id}:admit"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"helloToken":"{second_hello_token}"}}"#
                )))
                .expect("second node admit request should build"),
            )
            .await
            .expect("second node admit request should succeed");
        let second_admit_status = second_admit_response.status();
        let _second_admit_body = response_body_json(second_admit_response).await;

        let replaced_heartbeat_response = app
            .clone()
            .oneshot(
                Request::post(format!(
                    "/claw/internal/v1/node-sessions/{first_session_id}:heartbeat"
                ))
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"leaseId":"{first_lease_id}"}}"#
                )))
                .expect("replaced heartbeat request should build"),
            )
            .await
            .expect("replaced heartbeat request should return a response");
        let replaced_heartbeat_status = replaced_heartbeat_response.status();
        let replaced_heartbeat_correlation_id = replaced_heartbeat_response
            .headers()
            .get("x-claw-correlation-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
            .expect("replaced heartbeat response should include x-claw-correlation-id");
        let replaced_heartbeat_body = response_body_json(replaced_heartbeat_response).await;
        let replaced_heartbeat_error = replaced_heartbeat_body
            .get("error")
            .and_then(Value::as_object)
            .expect("replaced heartbeat response should include an error envelope");

        let list_response = app
            .oneshot(
                Request::get("/claw/internal/v1/node-sessions")
                    .body(Body::empty())
                    .expect("node sessions list request should build"),
            )
            .await
            .expect("node sessions list request should succeed");
        let list_body = response_body_json(list_response).await;
        let sessions = list_body
            .as_array()
            .expect("node sessions list response should be a json array");

        assert_eq!(second_admit_status, StatusCode::OK);
        assert_eq!(replaced_heartbeat_status, StatusCode::CONFLICT);
        assert_eq!(
            replaced_heartbeat_error.get("code").and_then(Value::as_str),
            Some("session_replaced")
        );
        assert_eq!(
            replaced_heartbeat_error.get("category").and_then(Value::as_str),
            Some("session")
        );
        assert_eq!(
            replaced_heartbeat_error.get("resolution").and_then(Value::as_str),
            Some("restart_session")
        );
        assert_eq!(
            replaced_heartbeat_error
                .get("correlationId")
                .and_then(Value::as_str),
            Some(replaced_heartbeat_correlation_id.as_str())
        );
        assert!(sessions.iter().any(|session| {
            session.get("nodeId").and_then(Value::as_str) == Some("local-built-in")
                && session.get("sessionId").and_then(Value::as_str) == Some(second_session_id)
                && session.get("state").and_then(Value::as_str) == Some("admitted")
        }));
    }

    async fn response_body_text(response: axum::response::Response) -> String {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body should be readable");
        String::from_utf8(bytes.to_vec()).expect("response body should be valid utf-8")
    }

    async fn response_body_json(response: axum::response::Response) -> Value {
        serde_json::from_str(&response_body_text(response).await)
            .expect("response body should be valid json")
    }

    fn create_test_rollout_data_dir(label: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "sdkwork-claw-server-rollouts-{label}-{}-{unique_suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test rollout directory should be created");
        directory
    }

    fn advance_rollout_target_semantic_payload(
        rollout_data_dir: &PathBuf,
        rollout_id: &str,
        node_id: &str,
        suffix: &str,
    ) {
        let rollout_store_path = rollout_data_dir.join("rollouts.json");
        let raw = fs::read_to_string(&rollout_store_path)
            .expect("seeded rollout store should be readable");
        let mut catalog: Value =
            serde_json::from_str(&raw).expect("seeded rollout store should contain valid json");
        let rollouts = catalog
            .get_mut("rollouts")
            .and_then(Value::as_array_mut)
            .expect("seeded rollout catalog should include rollouts");
        let rollout = rollouts
            .iter_mut()
            .find(|rollout| {
                rollout
                    .get("record")
                    .and_then(Value::as_object)
                    .and_then(|record| record.get("id"))
                    .and_then(Value::as_str)
                    == Some(rollout_id)
            })
            .expect("target rollout should exist");
        let targets = rollout
            .get_mut("targets")
            .and_then(Value::as_array_mut)
            .expect("target rollout should include targets");
        let target = targets
            .iter_mut()
            .find(|target| target.get("node_id").and_then(Value::as_str) == Some(node_id))
            .expect("target node should exist");
        let target_object = target
            .as_object_mut()
            .expect("target node should be represented as an object");
        let semantic_payload = target_object
            .get("semantic_payload")
            .and_then(Value::as_str)
            .expect("target node should include semantic_payload")
            .to_string();

        target_object.insert(
            "semantic_payload".to_string(),
            Value::String(format!("{semantic_payload}{suffix}")),
        );
        fs::write(
            &rollout_store_path,
            serde_json::to_string_pretty(&catalog)
                .expect("updated rollout catalog should serialize back to json"),
        )
        .expect("updated rollout catalog should be writable");
    }
}
