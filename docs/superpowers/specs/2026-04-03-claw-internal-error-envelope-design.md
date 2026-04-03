# Claw Internal Error Envelope Design

**Date:** 2026-04-03

## Goal

Define the shared error envelope for `/claw/internal/v1/*` so that:

- control plane and node host share one machine-readable failure contract for session, compatibility, and desired-state operations
- transport failure is clearly separated from valid but degraded or blocked management posture
- retry, restart-session, re-enroll, upgrade, and operator-action decisions are explicit instead of inferred from prose
- logs, audit trails, and metrics can aggregate internal failures without leaking secret or credential material
- `desktop`, `server`, `node`, `docker`, and `k8s` preserve the same logical internal error model even when transport is collapsed locally

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md)
- [2026-04-02-claw-internal-node-session-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-internal-node-session-api-design.md)
- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

It narrows:

- the generic `/claw/internal/v1/*` error envelope
- canonical machine-readable error codes for internal node-session flows
- HTTP status and retry posture rules for internal control traffic
- redaction rules for internal error messages and details

It does not yet define:

- the native platform error envelope for `/claw/api/v1/*` or `/claw/manage/v1/*`
- provider-compatible compatibility-gateway error bodies for `/v1/*` or `/v1beta/*`
- final OpenAPI component schemas

## Current Problem

The internal session spec already names categories such as:

- `bootstrap_auth_failed`
- `node_identity_invalid`
- `session_unknown`
- `lease_expired`
- `compatibility_blocked`
- `projection_version_unsupported`
- `desired_state_conflict`
- `stale_ack`
- `quarantined`

But the architecture still lacks the shared envelope that carries them.

Without one internal error contract:

- control plane and node host may mix plain-text errors, ad hoc JSON, and partial posture responses
- blocked or quarantined state can be confused with transport failure
- retry behavior becomes guesswork
- logs and metrics cannot aggregate by stable code
- sensitive details can leak through inconsistent debug strings

## Design Principles

### 1. Internal APIs use one native error family

All `/claw/internal/v1/*` failures should return one Claw-native JSON error envelope. Internal APIs do not need provider-compatible error styles.

### 2. Error is not the same as posture

If the control plane can process a request and return an authoritative session or management posture, it should prefer a normal success response even when the posture is:

- `compatibleDegraded`
- `blocked`
- `quarantined`

The error envelope is for requests that cannot be honored as asked, not for every undesirable runtime state.

### 3. HTTP status and body must agree

Status code, machine code, and retry posture must tell the same story. The node should not need to guess which one is authoritative.

### 4. Retry guidance must be explicit

The envelope should tell the node whether it should:

- retry the same request
- restart the session from `:hello`
- fetch a newer projection
- wait for operator action
- upgrade or downgrade

### 5. No secret-bearing diagnostics

Error messages and details must be useful for operators without echoing:

- secrets
- bearer tokens
- verifier material
- full certificates or private key material
- Gemini `key=` query values

## Approach Options

Three error-shape approaches were considered.

### Option 1: HTTP status only

Pros:

- minimal wire design

Cons:

- weak machine readability
- poor retry guidance
- insufficient diagnostics for version and projection failures

### Option 2: JSON envelope only with `200 OK`

Pros:

- one body shape everywhere

Cons:

- breaks normal HTTP semantics
- obscures infrastructure behavior, logs, and metrics

### Option 3: Hybrid HTTP status plus stable JSON envelope

Pros:

- keeps standard transport semantics
- gives explicit machine codes and retry posture
- works cleanly behind proxies and inside combined mode

Cons:

- slightly more fields to define

### Recommendation

Use `Option 3`.

`/claw/internal/v1/*` should use normal HTTP status codes plus one shared JSON envelope in the response body for non-2xx outcomes.

## Success Posture Versus Error Posture

This distinction is required.

### Return `2xx` with normal endpoint response when:

- the request was processed correctly
- the control plane can still return authoritative posture
- the session is valid enough to answer
- the node is being informed that it is degraded, blocked, or quarantined as a managed state

Examples:

- `:admit` returns a valid body with `compatibilityResult = blocked`
- `:heartbeat` returns a valid body with a management posture that enters quarantine
- `:pull-desired-state` returns `notModified`
- `:ack-desired-state` records a node-reported `rejected` result

### Return non-`2xx` with error envelope when:

- authentication fails
- session identity or lease assumptions are no longer valid
- the request body is invalid
- the requested operation cannot be processed because of compatibility or state conflict
- the control plane is temporarily unable to serve the call

Examples:

- `bootstrap_auth_failed`
- `session_unknown`
- `lease_expired`
- `stale_ack`
- `projection_version_unsupported`

## Error Envelope Shape

All non-`2xx` responses under `/claw/internal/v1/*` should return:

```json
{
  "error": {
    "code": "lease_expired",
    "category": "session",
    "message": "The session lease is no longer valid.",
    "httpStatus": 409,
    "retryable": true,
    "resolution": "restart_session",
    "retryAfterSeconds": 0,
    "correlationId": "req_01HZY...",
    "timestamp": "2026-04-03T10:12:00Z",
    "context": {
      "endpoint": "/claw/internal/v1/node-sessions/ses_123:heartbeat",
      "nodeId": "nod_123",
      "sessionId": "ses_123",
      "leaseId": "lea_456"
    },
    "details": {
      "expectedLeaseState": "active",
      "observedLeaseState": "expired"
    }
  }
}
```

## Required Fields

The `error` object should contain:

- `code`
- `category`
- `message`
- `httpStatus`
- `retryable`
- `resolution`
- `correlationId`
- `timestamp`

Optional fields:

- `retryAfterSeconds`
- `context`
- `details`

## Field Intent

`code`

- stable machine-readable failure code

`category`

- broad error family such as `auth`, `trust`, `session`, `compatibility`, `state`, `validation`, `dependency`, `system`

`message`

- human-readable explanation safe for logs and operators

`httpStatus`

- body reflection of the HTTP status code

`retryable`

- whether automatic retry is safe in principle

`resolution`

- the next action the node or operator should take

`correlationId`

- request-scoped id for tracing across control plane and node logs

`timestamp`

- server-side timestamp for the error decision

`context`

- safe high-level request context

`details`

- code-specific structured diagnostics

## Transport Rules

### Media type

Error responses should use:

- `application/json`

### Correlation header

The response should include:

- `x-claw-correlation-id`

Its value should match `error.correlationId`.

### Retry header

When `retryable = true` and the retry should not happen immediately, the response should also include:

- `Retry-After`

### No alternate text fallback rule

Internal APIs should not return:

- HTML error pages
- plain-text stack traces
- framework-default error bodies

## Canonical Code Set

The following codes are the initial required internal set.

### Validation

- `invalid_request`
- `invalid_header`
- `invalid_body`

Default posture:

- `category = validation`
- `httpStatus = 400`
- `retryable = false`
- `resolution = fix_request`

### Auth

- `bootstrap_auth_failed`
- `node_identity_invalid`

Default posture:

- `category = auth`
- `httpStatus = 401`
- `retryable = false`

Recommended resolutions:

- `bootstrap_auth_failed` -> `re_authenticate`
- `node_identity_invalid` -> `refresh_identity`

### Trust

- `quarantined`

Default posture:

- `category = trust`
- `httpStatus = 403`
- `retryable = false`
- `resolution = operator_action_required`

### Session

- `session_unknown`
- `lease_expired`

Default posture:

- `category = session`
- `retryable = true`
- `resolution = restart_session`

Recommended status:

- `session_unknown` -> `404`
- `lease_expired` -> `409`

### Compatibility

- `compatibility_blocked`
- `projection_version_unsupported`

Default posture:

- `category = compatibility`
- `httpStatus = 409`
- `retryable = false`

Recommended resolutions:

- `compatibility_blocked` -> one of `upgrade_required`, `downgrade_required`, or `operator_action_required`
- `projection_version_unsupported` -> `upgrade_required`

### State Conflict

- `desired_state_conflict`
- `stale_ack`

Default posture:

- `category = state`
- `httpStatus = 409`
- `retryable = true`

Recommended resolutions:

- `desired_state_conflict` -> `fetch_latest_projection`
- `stale_ack` -> `fetch_latest_projection`

### Dependency And System

- `rate_limited`
- `dependency_unavailable`
- `internal_failure`

Default posture:

- `rate_limited` -> `429`, `retryable = true`, `resolution = wait_and_retry`
- `dependency_unavailable` -> `503`, `retryable = true`, `resolution = wait_and_retry`
- `internal_failure` -> `500`, `retryable = false` by default, `resolution = operator_action_required`

## Resolution Enum

The initial shared `resolution` vocabulary should include:

- `fix_request`
- `re_authenticate`
- `refresh_identity`
- `restart_session`
- `fetch_latest_projection`
- `wait_and_retry`
- `operator_action_required`
- `upgrade_required`
- `downgrade_required`

This list can grow, but the initial vocabulary should stay small and explicit.

## Structured Detail Rules

`details` should be code-specific and stable enough for machine use.

### Auth detail examples

May include:

- `authPhase`
- `credentialKind`
- `trustScope`

Must not include:

- plaintext secrets
- verifier material
- private keys

### Session detail examples

May include:

- `expectedLeaseState`
- `observedLeaseState`
- `knownSessionId`
- `currentBootId`

### Compatibility detail examples

May include:

- `compatibilityClass`
- `requiredInternalApiVersion`
- `reportedInternalApiVersion`
- `requiredConfigProjectionVersion`
- `supportedConfigProjectionVersions`
- `missingCapabilities`

### State conflict detail examples

May include:

- `expectedDesiredStateRevision`
- `receivedDesiredStateRevision`
- `expectedDesiredStateHash`
- `receivedDesiredStateHash`
- `lastKnownGoodRevision`

### Dependency detail examples

May include:

- `dependencyKind`
- `dependencyName`
- `availabilityState`

## Context Rules

`context` is for safe request identifiers, not for raw payload echo.

Recommended fields:

- `endpoint`
- `nodeId`
- `sessionId`
- `leaseId`
- `desiredStateRevision`
- `desiredStateHash`

Context should include only fields already safe to log.

## Endpoint-Specific Guidance

### `:hello`

Typical error codes:

- `invalid_request`
- `bootstrap_auth_failed`
- `dependency_unavailable`
- `internal_failure`

Compatibility preview that is merely blocked should still prefer a normal `hello` response with posture, not a transport error.

### `:admit`

Typical error codes:

- `node_identity_invalid`
- `session_unknown`
- `compatibility_blocked`
- `quarantined`

If the control plane can still return an authoritative `compatibilityResult` body, prefer `2xx` with blocked or quarantined posture. Use the error envelope when admission cannot proceed as a valid session operation.

### `:heartbeat`

Typical error codes:

- `session_unknown`
- `lease_expired`
- `node_identity_invalid`
- `dependency_unavailable`

Quarantine transitions may still be represented as a normal heartbeat response when the session remains valid enough to answer.

### `:pull-desired-state`

Typical error codes:

- `session_unknown`
- `lease_expired`
- `projection_version_unsupported`
- `compatibility_blocked`

### `:ack-desired-state`

Typical error codes:

- `session_unknown`
- `lease_expired`
- `stale_ack`
- `desired_state_conflict`

Important distinction:

- a node reporting `result = rejected` is a successful acknowledgment call and should normally return `2xx`
- `stale_ack` is for an acknowledgment that no longer matches the authoritative session or revision assumptions

## Retry Rules

The node should make decisions in this order:

1. If the response is `2xx`, process the normal response body and ignore generic retry logic.
2. If non-`2xx`, inspect `error.code` and `error.resolution`.
3. If `retryable = true` and `resolution = restart_session`, restart from `:hello`.
4. If `retryable = true` and `resolution = fetch_latest_projection`, pull the latest desired state or reconcile locally before retrying.
5. If `Retry-After` is present, honor it.
6. If `retryable = false`, surface operator or upgrade workflow rather than blind retry.

## Redaction And Audit Rules

All internal error logging, audit capture, and metrics extraction must redact:

- authorization headers
- `x-api-key`
- `x-goog-api-key`
- Gemini `key=` query values
- secret payloads
- certificate private key material

Audit and logs should key aggregation by:

- `error.code`
- `error.category`
- `httpStatus`
- `resolution`

not by unstructured message strings.

## Combined-Mode Interpretation

`desktop` combined and `server` combined modes may collapse the transport boundary, but local wrappers should still surface the same logical error code, category, and resolution model.

This prevents co-located deployments from drifting into a second internal error contract.

## Review Findings Closed By This Spec

This design resolves four gaps left by the previous spec set:

1. The node-session API now has a concrete shared envelope for the internal error categories it already named.
2. Blocked or quarantined posture is now separated from transport failure, preventing a common control-plane design mistake.
3. Retry and restart-session decisions are now explicit and machine-readable.
4. Internal error logs and audit trails now have one redaction and aggregation model.

## Remaining Gaps After This Spec

Still needed:

- native platform error envelope design for `/claw/api/v1/*` and `/claw/manage/v1/*`
- exact OpenAPI schemas for the internal error components
- rollout APIs that define how blocked, degraded, and retryable apply outcomes are promoted into rollout status

## Acceptance Criteria

This spec is successful when:

- `/claw/internal/v1/*` errors use one shared JSON envelope plus coherent HTTP status codes
- success posture and failure posture are explicitly distinguished
- the canonical internal session and projection error codes have stable transport and retry semantics
- retry, restart, projection-refresh, operator-action, and upgrade decisions are explicit
- internal error diagnostics are structured and redacted
