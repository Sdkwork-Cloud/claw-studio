use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde_json::{Value, json};

use crate::bootstrap::ServerState;

pub fn openapi_routes() -> Router<ServerState> {
    Router::new()
        .route("/discovery", get(get_openapi_discovery))
        .route("/v1.json", get(get_openapi_v1_document))
}

async fn get_openapi_discovery(State(state): State<ServerState>) -> Json<Value> {
    Json(json!({
        "family": "openapi",
        "hostMode": state.mode,
        "generatedAt": state.host_platform_updated_at(),
        "documents": [
            {
                "id": "claw-native-v1",
                "title": "Claw Native Platform API",
                "version": "v1",
                "format": "openapi+json",
                "url": "/claw/openapi/v1.json",
                "apiFamilies": ["health", "api", "internal", "manage"]
            }
        ]
    }))
}

async fn get_openapi_v1_document(State(state): State<ServerState>) -> Json<Value> {
    Json(build_native_v1_document(&state))
}

fn build_native_v1_document(state: &ServerState) -> Value {
    json!({
        "openapi": "3.1.0",
        "info": {
            "title": "Claw Native Platform API",
            "version": "v1",
            "description": "OpenAPI publication for the currently implemented native Claw server route families.",
            "x-claw-hostVersion": state.host_platform_version()
        },
        "servers": [
            {
                "url": "/",
                "description": "Same-origin Claw server"
            }
        ],
        "tags": [
            {
                "name": "health",
                "description": "Server liveness and readiness probes."
            },
            {
                "name": "api",
                "description": "Public native product bootstrap APIs."
            },
            {
                "name": "internal",
                "description": "Internal host coordination APIs for node sessions and host status."
            },
            {
                "name": "manage",
                "description": "Operator-oriented rollout control-plane APIs."
            }
        ],
        "paths": build_paths(),
        "components": {
            "schemas": build_schemas()
        }
    })
}

fn build_paths() -> Value {
    json!({
        "/claw/health/live": {
            "get": {
                "tags": ["health"],
                "operationId": "healthLive",
                "summary": "Check server liveness",
                "responses": {
                    "200": {
                        "description": "Liveness probe succeeded."
                    }
                }
            }
        },
        "/claw/health/ready": {
            "get": {
                "tags": ["health"],
                "operationId": "healthReady",
                "summary": "Check server readiness",
                "responses": {
                    "200": {
                        "description": "Readiness probe succeeded."
                    }
                }
            }
        },
        "/claw/api/v1/discovery": {
            "get": {
                "tags": ["api"],
                "operationId": "apiDiscovery",
                "summary": "Read public native API discovery metadata",
                "responses": {
                    "200": json_response(
                        "Public native API discovery metadata.",
                        "#/components/schemas/PublicApiDiscoveryRecord"
                    )
                }
            }
        },
        "/claw/internal/v1/host-platform": {
            "get": {
                "tags": ["internal"],
                "operationId": "internalGetHostPlatformStatus",
                "summary": "Read host platform status",
                "responses": {
                    "200": json_response(
                        "Current host platform status.",
                        "#/components/schemas/HostPlatformStatusRecord"
                    )
                }
            }
        },
        "/claw/internal/v1/node-sessions": {
            "get": {
                "tags": ["internal"],
                "operationId": "internalListNodeSessions",
                "summary": "List live and projected node sessions",
                "responses": {
                    "200": json_array_response(
                        "Merged live and projected node sessions.",
                        "#/components/schemas/NodeSessionRecord"
                    ),
                    "500": internal_error_json_response("Node session list could not be loaded.")
                }
            }
        },
        "/claw/internal/v1/node-sessions:hello": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionHello",
                "summary": "Register a node session and receive a lease proposal",
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionHelloInput",
                    true,
                    "Node hello request."
                ),
                "responses": {
                    "200": json_response(
                        "Hello response with compatibility preview and lease proposal.",
                        "#/components/schemas/NodeSessionHelloResponse"
                    ),
                    "400": internal_error_json_response("The node hello request body was invalid."),
                    "409": internal_error_json_response("The node hello request could not be processed in the current control-plane state."),
                    "500": internal_error_json_response("Node hello could not be processed."),
                    "503": internal_error_json_response("A required control-plane dependency was unavailable.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:admit": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionAdmit",
                "summary": "Admit a previously created node session",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionAdmitInput",
                    true,
                    "Node admit request."
                ),
                "responses": {
                    "200": json_response(
                        "Admitted node session state.",
                        "#/components/schemas/NodeSessionAdmitResponse"
                    ),
                    "400": internal_error_json_response("The node session admit request body was invalid."),
                    "401": internal_error_json_response("The node session bootstrap token was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session could not be admitted in the current state."),
                    "500": internal_error_json_response("The node session could not be admitted.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:heartbeat": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionHeartbeat",
                "summary": "Refresh an admitted node session lease",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionHeartbeatInput",
                    true,
                    "Heartbeat request."
                ),
                "responses": {
                    "200": json_response(
                        "Refreshed node session lease and posture.",
                        "#/components/schemas/NodeSessionHeartbeatResponse"
                    ),
                    "400": internal_error_json_response("The node session heartbeat request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session lease was invalid, expired, or replaced."),
                    "500": internal_error_json_response("The heartbeat could not be processed.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionPullDesiredState",
                "summary": "Fetch the current desired state for a node session",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionPullDesiredStateInput",
                    true,
                    "Desired-state pull request."
                ),
                "responses": {
                    "200": json_response(
                        "Desired-state projection or not-modified response.",
                        "#/components/schemas/NodeSessionPullDesiredStateResponse"
                    ),
                    "400": internal_error_json_response("The desired-state pull request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session lease was invalid, expired, or replaced."),
                    "500": internal_error_json_response("The desired-state pull could not be processed."),
                    "503": internal_error_json_response("The control plane could not provide the requested desired-state projection.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionAckDesiredState",
                "summary": "Acknowledge desired-state application",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionAckDesiredStateInput",
                    true,
                    "Desired-state acknowledgement request."
                ),
                "responses": {
                    "200": json_response(
                        "Desired-state acknowledgement was recorded.",
                        "#/components/schemas/NodeSessionAckDesiredStateResponse"
                    ),
                    "400": internal_error_json_response("The desired-state acknowledgement request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The acknowledgement conflicted with the current session or desired state."),
                    "500": internal_error_json_response("The acknowledgement could not be processed.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:close": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionClose",
                "summary": "Gracefully close a node session",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionCloseInput",
                    true,
                    "Node session close request."
                ),
                "responses": {
                    "200": json_response(
                        "Node session was closed.",
                        "#/components/schemas/NodeSessionCloseResponse"
                    ),
                    "400": internal_error_json_response("The node session close request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session lease was invalid or expired."),
                    "500": internal_error_json_response("The node session could not be closed.")
                }
            }
        },
        "/claw/manage/v1/rollouts": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListRollouts",
                "summary": "List rollout records",
                "responses": {
                    "200": json_response(
                        "Current rollout list.",
                        "#/components/schemas/ManageRolloutListResult"
                    ),
                    "503": internal_error_json_response("The rollout list could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetRollout",
                "summary": "Read one rollout record",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested rollout record.",
                        "#/components/schemas/ManageRolloutRecord"
                    ),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "503": internal_error_json_response("The rollout record could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}/targets": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListRolloutTargets",
                "summary": "List rollout target preview records",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Current rollout target preview records.",
                        "#/components/schemas/ManageRolloutTargetListResult"
                    ),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "503": internal_error_json_response("The rollout target list could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetRolloutTarget",
                "summary": "Read one rollout target preview record",
                "parameters": [rollout_id_parameter(), node_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested rollout target preview record.",
                        "#/components/schemas/ManageRolloutTargetPreviewRecord"
                    ),
                    "404": internal_error_json_response("The requested rollout target was not found."),
                    "503": internal_error_json_response("The rollout target record could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}/waves": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListRolloutWaves",
                "summary": "List rollout wave summary records",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Current rollout wave summary records.",
                        "#/components/schemas/ManageRolloutWaveListResult"
                    ),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "503": internal_error_json_response("The rollout wave list could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}:preview": {
            "post": {
                "tags": ["manage"],
                "operationId": "managePreviewRollout",
                "summary": "Preview a rollout",
                "parameters": [rollout_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/PreviewRolloutRouteBody",
                    false,
                    "Optional rollout preview request body."
                ),
                "responses": {
                    "200": json_response(
                        "Rollout preview result.",
                        "#/components/schemas/ManageRolloutPreview"
                    ),
                    "400": internal_error_json_response("The rollout preview request body was invalid."),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "409": internal_error_json_response("The rollout preview could not proceed in the current state."),
                    "503": internal_error_json_response("The rollout preview could not be processed.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}:start": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageStartRollout",
                "summary": "Start a rollout after preview",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Started rollout record.",
                        "#/components/schemas/ManageRolloutRecord"
                    ),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "409": internal_error_json_response("The rollout could not be started in the current state."),
                    "503": internal_error_json_response("The rollout start operation could not be processed.")
                }
            }
        }
    })
}

fn build_schemas() -> Value {
    json!({
        "InternalErrorEnvelope": {
            "type": "object",
            "properties": {
                "error": schema_ref("#/components/schemas/InternalErrorRecord")
            }
        },
        "InternalErrorRecord": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "category": {
                    "type": "string",
                    "enum": [
                        "auth",
                        "trust",
                        "session",
                        "compatibility",
                        "state",
                        "validation",
                        "dependency",
                        "system"
                    ]
                },
                "message": {"type": "string"},
                "httpStatus": {"type": "integer", "minimum": 100, "maximum": 599},
                "retryable": {"type": "boolean"},
                "resolution": {
                    "type": "string",
                    "enum": [
                        "fix_request",
                        "re_authenticate",
                        "retry",
                        "wait_and_retry",
                        "restart_session",
                        "fetch_latest_projection",
                        "upgrade_required",
                        "operator_action"
                    ]
                },
                "correlationId": {"type": "string"},
                "timestamp": {"type": "string"}
            }
        },
        "PublicApiDiscoveryRecord": {
            "type": "object",
            "properties": {
                "family": {"type": "string"},
                "version": {"type": "string"},
                "basePath": {"type": "string"},
                "hostMode": {"type": "string"},
                "hostVersion": {"type": "string"},
                "openapiDocumentUrl": {"type": "string"},
                "healthLiveUrl": {"type": "string"},
                "healthReadyUrl": {"type": "string"},
                "capabilityKeys": string_array_schema(),
                "generatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "HostPlatformStatusRecord": {
            "type": "object",
            "properties": {
                "mode": {"type": "string"},
                "lifecycle": {"type": "string"},
                "hostId": {"type": "string"},
                "displayName": {"type": "string"},
                "version": {"type": "string"},
                "desiredStateProjectionVersion": {"type": "string"},
                "rolloutEngineVersion": {"type": "string"},
                "manageBasePath": {"type": "string"},
                "internalBasePath": {"type": "string"},
                "capabilityKeys": string_array_schema(),
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "NodeSessionRecord": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string"},
                "nodeId": {"type": "string"},
                "state": {
                    "type": "string",
                    "enum": ["pending", "admitted", "degraded", "blocked", "replaced", "closed"]
                },
                "compatibilityState": {
                    "type": "string",
                    "enum": ["compatible", "degraded", "blocked"]
                },
                "successorSessionId": {"type": "string"},
                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "desiredStateHash": {"type": "string"},
                "lastAppliedRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "lastAppliedHash": {"type": "string"},
                "lastKnownGoodRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "lastKnownGoodHash": {"type": "string"},
                "lastApplyResult": {
                    "type": "string",
                    "enum": ["accepted", "applied", "appliedDegraded", "rejected", "superseded"]
                },
                "lastSeenAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "NodeSessionHelloInput": {
            "type": "object",
            "properties": {
                "bootId": {"type": "string"},
                "nodeClaim": {
                    "type": "object",
                    "properties": {
                        "claimedNodeId": {"type": "string"},
                        "hostPlatform": {"type": "string"},
                        "hostArch": {"type": "string"}
                    }
                },
                "versionManifest": {
                    "type": "object",
                    "properties": {
                        "internalApiVersion": {"type": "string"},
                        "configProjectionVersion": {"type": "string"}
                    }
                },
                "capabilities": string_array_schema()
            }
        },
        "NodeSessionHelloResponse": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string"},
                "helloToken": {"type": "string"},
                "leaseProposal": {
                    "type": "object",
                    "properties": {
                        "leaseId": {"type": "string"},
                        "issuedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "expiresAt": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "admissionMode": {
                    "type": "string",
                    "enum": ["bootstrapRequired", "blocked"]
                },
                "compatibilityPreview": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "reason": {"type": "string"}
                    }
                },
                "nextAction": {
                    "type": "string",
                    "enum": ["callAdmit", "stopAndWait"]
                }
            }
        },
        "NodeSessionAdmitInput": {
            "type": "object",
            "properties": {
                "helloToken": {"type": "string"}
            }
        },
        "NodeSessionAdmitResponse": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string"},
                "lease": {
                    "type": "object",
                    "properties": {
                        "leaseId": {"type": "string"},
                        "issuedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "expiresAt": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "compatibilityResult": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "reason": {"type": "string"}
                    }
                },
                "effectiveCapabilities": string_array_schema(),
                "heartbeatPolicy": {
                    "type": "object",
                    "properties": {
                        "intervalSeconds": {"type": "integer", "minimum": 0},
                        "missTolerance": {"type": "integer", "minimum": 0},
                        "fullReportInterval": {"type": "integer", "minimum": 0}
                    }
                },
                "desiredStateCursor": {
                    "type": "object",
                    "properties": {
                        "currentRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "currentHash": {"type": "string"},
                        "requiredConfigProjectionVersion": {"type": "string"}
                    }
                }
            }
        },
        "NodeSessionHeartbeatInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "lastSeenRevision": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "NodeSessionHeartbeatResponse": {
            "type": "object",
            "properties": {
                "lease": {
                    "type": "object",
                    "properties": {
                        "leaseId": {"type": "string"},
                        "issuedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "expiresAt": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "compatibilityResult": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "reason": {"type": "string"}
                    }
                },
                "managementPosture": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "allowedOperations": string_array_schema()
                    }
                },
                "desiredStateHint": {
                    "type": "object",
                    "properties": {
                        "hasUpdate": {"type": "boolean"},
                        "targetRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "targetHash": {"type": "string"},
                        "mandatory": {"type": "boolean"}
                    }
                }
            }
        },
        "NodeSessionPullDesiredStateInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "knownRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "knownHash": {"type": "string"},
                "supportedConfigProjectionVersions": string_array_schema(),
                "effectiveCapabilities": string_array_schema()
            }
        },
        "NodeSessionPullDesiredStateResponse": {
            "oneOf": [
                {
                    "type": "object",
                    "properties": {
                        "mode": {"type": "string", "const": "notModified"},
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "configProjectionVersion": {"type": "string"}
                    }
                },
                {
                    "type": "object",
                    "properties": {
                        "mode": {"type": "string", "const": "projection"},
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "configProjectionVersion": {"type": "string"},
                        "requiredCapabilities": string_array_schema(),
                        "projection": {
                            "type": "object",
                            "properties": {
                                "nodeId": {"type": "string"},
                                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                                "desiredStateHash": {"type": "string"},
                                "configProjectionVersion": {"type": "string"},
                                "semanticPayload": {"type": "string"}
                            }
                        },
                        "applyPolicy": {
                            "type": "object",
                            "properties": {
                                "mandatory": {"type": "boolean"}
                            }
                        }
                    }
                }
            ]
        },
        "NodeSessionAckDesiredStateInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "desiredStateHash": {"type": "string"},
                "result": {
                    "type": "string",
                    "enum": ["accepted", "applied", "appliedDegraded", "rejected", "superseded"]
                },
                "effectiveCapabilities": string_array_schema(),
                "observedEndpoints": string_array_schema(),
                "applySummary": {
                    "type": "object",
                    "properties": {
                        "appliedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "lastKnownGoodRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "compatibilityReasons": string_array_schema(),
                        "errors": string_array_schema(),
                        "warnings": string_array_schema()
                    }
                }
            }
        },
        "NodeSessionAckDesiredStateResponse": {
            "type": "object",
            "properties": {
                "recorded": {"type": "boolean"},
                "nextExpectedRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "managementPosture": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "allowedOperations": string_array_schema()
                    }
                }
            }
        },
        "NodeSessionCloseInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "reason": {"type": "string"},
                "successorHint": {"type": "string"}
            }
        },
        "NodeSessionCloseResponse": {
            "type": "object",
            "properties": {
                "closed": {"type": "boolean"},
                "replacementExpected": {"type": "boolean"}
            }
        },
        "ManageRolloutRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "phase": {
                    "type": "string",
                    "enum": [
                        "draft",
                        "previewing",
                        "awaitingApproval",
                        "ready",
                        "promoting",
                        "paused",
                        "completed",
                        "failed",
                        "cancelled"
                    ]
                },
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "targetCount": {"type": "integer", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "ManageRolloutListResult": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutRecord")
                },
                "total": {"type": "integer", "minimum": 0}
            }
        },
        "ManageRolloutTargetPreviewRecord": {
            "type": "object",
            "properties": {
                "nodeId": {"type": "string"},
                "preflightOutcome": {
                    "type": "string",
                    "enum": [
                        "admissible",
                        "admissibleDegraded",
                        "blockedByVersion",
                        "blockedByCapability",
                        "blockedByTrust",
                        "blockedByPolicy"
                    ]
                },
                "blockedReason": {"type": "string"},
                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "desiredStateHash": {"type": "string"},
                "waveId": {"type": "string"}
            }
        },
        "ManageRolloutTargetListResult": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "total": {"type": "integer", "minimum": 0},
                "items": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutTargetPreviewRecord")
                }
            }
        },
        "ManageRolloutWaveRecord": {
            "type": "object",
            "properties": {
                "waveId": {"type": "string"},
                "index": {"type": "integer", "minimum": 1},
                "phase": {
                    "type": "string",
                    "enum": [
                        "pending",
                        "ready",
                        "promoting",
                        "verifying",
                        "completed",
                        "paused",
                        "failed",
                        "cancelled"
                    ]
                },
                "targetCount": {"type": "integer", "minimum": 0},
                "admissibleCount": {"type": "integer", "minimum": 0},
                "degradedCount": {"type": "integer", "minimum": 0},
                "blockedCount": {"type": "integer", "minimum": 0}
            }
        },
        "ManageRolloutWaveListResult": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "total": {"type": "integer", "minimum": 0},
                "items": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutWaveRecord")
                }
            }
        },
        "PreviewRolloutRouteBody": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "forceRecompute": {"type": "boolean"},
                "includeTargets": {"type": "boolean"}
            }
        },
        "ManageRolloutPreview": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "phase": {
                    "type": "string",
                    "enum": ["previewing", "awaitingApproval", "ready", "failed"]
                },
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "summary": {
                    "type": "object",
                    "properties": {
                        "totalTargets": {"type": "integer", "minimum": 0},
                        "admissibleTargets": {"type": "integer", "minimum": 0},
                        "degradedTargets": {"type": "integer", "minimum": 0},
                        "blockedTargets": {"type": "integer", "minimum": 0},
                        "predictedWaveCount": {"type": "integer", "minimum": 0}
                    }
                },
                "targets": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutTargetPreviewRecord")
                },
                "candidateRevisionSummary": {
                    "type": "object",
                    "properties": {
                        "totalTargets": {"type": "integer", "minimum": 0},
                        "minDesiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "maxDesiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "generatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        }
    })
}

fn json_response(description: &str, schema_ref_path: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "$ref": schema_ref_path
                }
            }
        }
    })
}

fn json_array_response(description: &str, schema_ref_path: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "type": "array",
                    "items": {
                        "$ref": schema_ref_path
                    }
                }
            }
        }
    })
}

fn json_request_body(schema_ref_path: &str, required: bool, description: &str) -> Value {
    json!({
        "required": required,
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "$ref": schema_ref_path
                }
            }
        }
    })
}

fn internal_error_json_response(description: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "$ref": "#/components/schemas/InternalErrorEnvelope"
                }
            }
        }
    })
}

fn session_id_parameter() -> Value {
    json!({
        "name": "sessionId",
        "in": "path",
        "required": true,
        "description": "Node session identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn rollout_id_parameter() -> Value {
    json!({
        "name": "rolloutId",
        "in": "path",
        "required": true,
        "description": "Rollout identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn node_id_parameter() -> Value {
    json!({
        "name": "nodeId",
        "in": "path",
        "required": true,
        "description": "Node identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn schema_ref(reference: &str) -> Value {
    json!({
        "$ref": reference
    })
}

fn string_array_schema() -> Value {
    json!({
        "type": "array",
        "items": {
            "type": "string"
        }
    })
}
