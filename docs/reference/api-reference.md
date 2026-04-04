# API Reference Overview

## Scope

This page is the entry point for the currently published native Claw Studio API surface.

It documents the route families that are already implemented in the Rust host and explains how they relate to runtime mode, authentication, and OpenAPI publication.

## Base Path Policy

The current native platform API is published under `/claw/*`.

Implemented route families:

| Family | Base Path | Purpose |
| --- | --- | --- |
| Health | `/claw/health/*` | liveness and readiness checks |
| Public API | `/claw/api/v1/*` | public native discovery and bootstrap metadata |
| OpenAPI | `/claw/openapi/*` | machine-readable API discovery and OpenAPI publication |
| Internal | `/claw/internal/v1/*` | host runtime coordination and node-session state |
| Manage | `/claw/manage/v1/*` | operator-facing rollout and control-plane reads/actions |

## How To Resolve The Base URL

The same product surface can run in different host modes, but the canonical `/claw/*` HTTP API is only available when a Rust host is present.

| Mode | Native API Access | Base URL |
| --- | --- | --- |
| Web workspace | not stable; browser preview uses the default mock or preview bridge | not a published `/claw/*` endpoint |
| Desktop runtime | embedded loopback HTTP for canonical hosted flows; server lifecycle routes stay disabled | resolve from runtime `browserBaseUrl` metadata, typically `http://127.0.0.1:<dynamic-port>` |
| Native server | same-origin HTTP | `http://<host>:<port>` |
| Container | same-origin HTTP through the exposed container port | `http://<host>:<port>` or ingress URL |
| Kubernetes | same-origin HTTP through service or ingress | `https://<domain>` or service URL |

For current packaged server bundles, the default local address remains `http://127.0.0.1:18797` unless `CLAW_SERVER_HOST` or `CLAW_SERVER_PORT` is overridden.

## Discovery Endpoints

The Rust host currently publishes two discovery surfaces in `server` mode and in hosted `desktopCombined` browser flows:

| Endpoint | Purpose |
| --- | --- |
| `GET /claw/api/v1/discovery` | public native API discovery for browser/bootstrap and future SDK consumers |
| `GET /claw/openapi/discovery` | OpenAPI document discovery |
| `GET /claw/openapi/v1.json` | OpenAPI 3.1 JSON document for currently implemented native routes |

## Current Endpoint Matrix

### Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/health/live` | liveness probe |
| `GET` | `/claw/health/ready` | readiness probe |

### Public API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/api/v1/discovery` | native public discovery and bootstrap metadata |
| `GET` | `/claw/api/v1/studio/instances` | list canonical studio instances |
| `POST` | `/claw/api/v1/studio/instances` | create one studio instance |
| `GET` | `/claw/api/v1/studio/instances/{id}` | read one studio instance |
| `PUT` | `/claw/api/v1/studio/instances/{id}` | update one studio instance |
| `DELETE` | `/claw/api/v1/studio/instances/{id}` | delete one studio instance |
| `POST` | `/claw/api/v1/studio/instances/{id}:start` | start one studio instance |
| `POST` | `/claw/api/v1/studio/instances/{id}:stop` | stop one studio instance |
| `POST` | `/claw/api/v1/studio/instances/{id}:restart` | restart one studio instance |
| `GET` | `/claw/api/v1/studio/instances/{id}/detail` | read rich instance detail |
| `GET` | `/claw/api/v1/studio/instances/{id}/config` | read instance config |
| `PUT` | `/claw/api/v1/studio/instances/{id}/config` | update instance config |
| `GET` | `/claw/api/v1/studio/instances/{id}/logs` | read instance log projection |
| `GET` | `/claw/api/v1/studio/instances/{id}/conversations` | list instance conversations |
| `PUT` | `/claw/api/v1/studio/conversations/{conversationId}` | upsert one conversation |
| `DELETE` | `/claw/api/v1/studio/conversations/{conversationId}` | delete one conversation |

### OpenAPI

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/openapi/discovery` | discover published OpenAPI documents |
| `GET` | `/claw/openapi/v1.json` | download the current OpenAPI 3.1 document |

### Internal

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/internal/v1/host-platform` | read host platform status, capabilities, and state-store projection |
| `GET` | `/claw/internal/v1/node-sessions` | list merged live and projected node sessions |
| `POST` | `/claw/internal/v1/node-sessions:hello` | register a node runtime and receive a lease proposal |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:admit` | admit a hello-created session |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:heartbeat` | refresh a live lease and receive posture hints |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state` | fetch current desired state for one node runtime |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state` | record apply or reject results for a desired-state revision |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:close` | gracefully close a live session |

### Manage

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/manage/v1/rollouts` | list rollout records |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}` | read one rollout record |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets` | read the preview-derived target list |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` | read one preview-derived rollout target |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/waves` | read preview-derived rollout wave summaries |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:preview` | compute or refresh rollout preview |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:start` | start a rollout after preview succeeds |
| `GET` | `/claw/manage/v1/host-endpoints` | list canonical host endpoint records |
| `GET` | `/claw/manage/v1/openclaw/runtime` | read managed OpenClaw runtime projection |
| `GET` | `/claw/manage/v1/openclaw/gateway` | read managed OpenClaw gateway projection |
| `POST` | `/claw/manage/v1/openclaw/gateway/invoke` | invoke the managed OpenClaw gateway |
| `GET` | `/claw/manage/v1/service` | read native service status projection, `server` mode only |
| `POST` | `/claw/manage/v1/service:install` | install native service, `server` mode only |
| `POST` | `/claw/manage/v1/service:start` | start native service, `server` mode only |
| `POST` | `/claw/manage/v1/service:stop` | stop native service, `server` mode only |
| `POST` | `/claw/manage/v1/service:restart` | restart native service, `server` mode only |

Important mode note:

- `desktopCombined` publishes the canonical hosted `studio`, `internal`, `openapi`, and non-service `manage` flows through its embedded loopback host.
- `/claw/manage/v1/service*` is intentionally omitted from `desktopCombined` and only exists in `server` mode.

## Authentication Model

Authentication is currently optional and based on HTTP basic auth.

| Surface | Default | Optional Credentials |
| --- | --- | --- |
| Browser shell | open | `CLAW_SERVER_MANAGE_USERNAME` and `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/manage/v1/*` | open | `CLAW_SERVER_MANAGE_USERNAME` and `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/internal/v1/*` | open | `CLAW_SERVER_INTERNAL_USERNAME` and `CLAW_SERVER_INTERNAL_PASSWORD` |

Important behavior:

- when internal credentials are omitted, the internal surface falls back to the manage credentials
- when manage credentials are configured, browser shell routes and static assets share the same basic-auth challenge as `/claw/manage/v1/*`

## Quick Examples

Set a local base URL first:

```bash
export CLAW_BASE_URL=http://127.0.0.1:18797
```

Readiness probe:

```bash
curl -i "$CLAW_BASE_URL/claw/health/ready"
```

Public discovery:

```bash
curl "$CLAW_BASE_URL/claw/api/v1/discovery"
```

Download the current OpenAPI document:

```bash
curl "$CLAW_BASE_URL/claw/openapi/v1.json"
```

List rollouts with HTTP basic auth enabled:

```bash
curl -u operator:manage-secret \
  "$CLAW_BASE_URL/claw/manage/v1/rollouts"
```

Preview one rollout:

```bash
curl -u operator:manage-secret \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"includeTargets":true,"forceRecompute":false}' \
  "$CLAW_BASE_URL/claw/manage/v1/rollouts/rollout-a:preview"
```

Read host platform status with dedicated internal credentials:

```bash
curl -u internal:internal-secret \
  "$CLAW_BASE_URL/claw/internal/v1/host-platform"
```

## Route Family Details

### Health

- `GET /claw/health/live`
- `GET /claw/health/ready`

Use these for load balancers, uptime probes, and deployment readiness checks.

### Public API

- `GET /claw/api/v1/discovery`

This is intentionally the first published public native route. It exposes discovery metadata rather than full product-domain resources.

### Internal API

Current internal routes include:

- `GET /claw/internal/v1/host-platform`
- `GET /claw/internal/v1/node-sessions`
- `POST /claw/internal/v1/node-sessions:hello`
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`
- `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat`
- `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state`
- `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state`
- `POST /claw/internal/v1/node-sessions/{sessionId}:close`

These routes are intended for runtime coordination, live session state, and desired-state flow control.

### Manage API

Current manage routes include:

- `GET /claw/manage/v1/rollouts`
- `GET /claw/manage/v1/rollouts/{rolloutId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview`
- `POST /claw/manage/v1/rollouts/{rolloutId}:start`

These routes support the first native rollout control-plane slice.

## Example Payloads

Public discovery example:

```json
{
  "family": "api",
  "version": "v1",
  "basePath": "/claw/api/v1",
  "hostMode": "server",
  "hostVersion": "0.1.0",
  "openapiDocumentUrl": "/claw/openapi/v1.json",
  "healthLiveUrl": "/claw/health/live",
  "healthReadyUrl": "/claw/health/ready",
  "capabilityKeys": ["api.discovery.read"],
  "generatedAt": 1743600000000
}
```

Error envelope example:

```json
{
  "error": {
    "code": "rollout_not_found",
    "category": "state",
    "message": "The requested rollout was not found.",
    "httpStatus": 404,
    "retryable": false,
    "resolution": "fix_request",
    "correlationId": "claw-1234567890"
  }
}
```

You should treat the `x-claw-correlation-id` response header as the primary request trace id for logs, browser diagnostics, and operator support workflows.

## Error Model

Migrated internal and manage routes return a machine-readable JSON error envelope rather than plain-text failures.

The current error body includes fields such as:

- `error.code`
- `error.category`
- `error.httpStatus`
- `error.retryable`
- `error.resolution`
- `error.correlationId`

Responses also include the `x-claw-correlation-id` header.

## Versioning And Stability

- The currently published native surface uses `v1` path versioning.
- The OpenAPI document is intentionally truth-first and only publishes routes that are already implemented.
- The route family layout is stable enough for tooling and operator automation, but product-domain public APIs beyond discovery are still deferred.

## Current OpenAPI Boundary

The published OpenAPI document is intentionally limited to already-implemented native routes. It currently covers:

- `health`
- `api`
- `internal`
- `manage`

It does not yet claim:

- unimplemented product-domain `/claw/api/v1/*` resources
- plugin-managed HTTP surfaces
- compatibility gateway aliases that are still architecture-only

## Compatibility Gateway Boundary

Claw Studio architecture work also defines compatibility gateway surfaces for upstream ecosystems such as OpenAI, Claude, and Gemini. Those compatibility paths must preserve upstream path conventions such as `/v1/*` or `/v1beta/*` on the same domain when enabled.

Important boundary:

- those compatibility gateways are not part of the currently published native `/claw/*` OpenAPI document
- this reference site documents them only when they are implemented and shipped

## Related Documents

- [Claw Server Runtime](/reference/claw-server-runtime)
- [Claw Rollout API](/reference/claw-rollout-api)
- [Commands](/reference/commands)
- [Environment](/reference/environment)
