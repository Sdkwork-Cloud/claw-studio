# Claw Compatibility Conformance And Credential Design

**Date:** 2026-04-02

## Goal

Define the compatibility gateway, credential, and secret-management standard for `Claw Studio` so that:

- `/claw/gateway/*` and official provider alias paths can be published under one canonical domain without contract drift
- `OpenAI`, `Anthropic`, and `Gemini` compatible clients see protocol-native request, response, error, and streaming behavior
- compatibility credentials are issued, rotated, revoked, and audited independently from platform-native auth tokens
- `desktop` and `server` share one logical secret model while keeping different storage and operational postures
- future management APIs can manage gateway credentials and secret records without inventing a second auth model

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-manage-resource-model-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-manage-resource-model-design.md)

It narrows two V7 backlog items:

- compatibility conformance matrix
- secret backend specification

It also further refines two canonical management resources:

- `GatewayCredential`
- `SecretRecord`

It does not yet define:

- full OpenAPI contracts for `/claw/manage/v1/gateway-credentials/*`, which are partly refined by `2026-04-02-claw-manage-credential-and-secret-api-design.md`
- full OpenAPI contracts for `/claw/manage/v1/secret-records/*`, which are partly refined by `2026-04-02-claw-manage-credential-and-secret-api-design.md`
- billing and quota commercial policy
- control-plane and node-host version-skew protocol

## Source Snapshot

This design is grounded in the current workspace state on 2026-04-02.

Relevant local implementation signals:

- the desktop Rust runtime already uses `axum 0.8`, `tokio`, `reqwest`, and `rusqlite`
- the current local proxy already exposes:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/responses`
  - `POST /v1/embeddings`
  - `POST /v1/messages`
  - `GET /v1beta/models`
  - `POST /v1beta/models/{model}:generateContent`
  - `POST /v1beta/models/{model}:streamGenerateContent`
  - `POST /v1beta/models/{model}:embedContent`
  - `POST /v1/models/{model}:generateContent`
  - `POST /v1/models/{model}:streamGenerateContent`
- the current local proxy already translates OpenAI-compatible requests toward Anthropic and Gemini upstreams
- the current local proxy already preserves Anthropic native headers and Gemini native model-action paths in tests
- the current local proxy currently uses one shared local `auth_token`
- the current local proxy currently emits a simplified error body shaped like `{ "error": "<message>" }`

This means the compatibility subsystem already has a concrete implementation baseline, but it does not yet have a complete conformance and credential standard.

## Current Problem

The platform already speaks multiple compatibility surfaces, but several important rules are still implicit or under-specified:

- governed `/claw/gateway/*` paths and official alias paths are not yet defined as formally isomorphic contracts
- the ambiguous alias path `GET /v1/models` needs one stable resolution rule under a single external domain
- the current local shared auth token is not sufficient for long-term protocol-specific credential governance
- provider-native error envelopes are not yet standardized
- secret storage needs to distinguish between inbound credential verification and recoverable upstream provider secrets
- audit and logging rules need protocol-specific redaction requirements, especially for Gemini query-string keys

Without these rules, the platform risks producing a compatibility surface that works in a happy path but drifts under failure, operations, or scale.

## Design Principles

### 1. One external domain, two compatibility path families

The platform should publish one canonical external domain, while supporting both:

- governed paths under `/claw/gateway/*`
- official alias paths without `/claw`

### 2. Governed paths must be protocol-isomorphic

For a given protocol family, the governed path and the official alias path must behave the same on the wire except for the path prefix.

That means:

- same auth transport requirements
- same request and response shapes
- same status codes where feasible
- same streaming framing semantics
- same error envelope family

### 3. Protocol resolution must fail closed

When the path is ambiguous, the router must resolve the protocol deterministically or reject the request. It must not guess and silently forward to the wrong provider family.

### 4. One credential class per purpose

The platform must not blur together:

- platform-native management tokens
- compatibility client credentials
- upstream provider API secrets
- node enrollment or node identity credentials

Each has different security, rotation, audit, and storage requirements.

### 5. No silent feature erosion

If an inbound request uses a feature that the effective route, model, or adapter cannot honor, the gateway should reject explicitly instead of silently dropping the field.

### 6. Secret management must separate verifiers from recoverable secrets

Inbound compatibility credentials should usually be stored as verifiers. Upstream provider secrets usually need recoverable encrypted storage. The platform should model those as different secret classes.

## Compatibility Publication Model

### Canonical External Domain

Server, Docker, and Kubernetes deployments should expose one canonical domain, for example:

- `https://api.example.com`

Published path families:

- platform-native APIs: `/claw/*`
- governed compatibility APIs: `/claw/gateway/*`
- official provider alias paths: `/v1/*`, `/v1beta/*`, and provider-standard model action paths

### Governed Compatibility Roots

The governed roots should be:

- OpenAI-compatible:
  - `/claw/gateway/openai/v1/*`
- Anthropic-compatible:
  - `/claw/gateway/anthropic/v1/*`
- Gemini-compatible:
  - `/claw/gateway/gemini/v1beta/*`
  - `/claw/gateway/gemini/v1/*`

### Official Alias Roots

The public alias roots should be:

- OpenAI-compatible:
  - `/v1/*`
- Anthropic-compatible:
  - `/v1/*`
- Gemini-compatible:
  - `/v1beta/*`
  - `/v1/models/{model}:*`

### Isomorphism Rule

For the same resolved protocol family:

- `/claw/gateway/openai/v1/chat/completions` and `/v1/chat/completions` must expose the same OpenAI-compatible contract
- `/claw/gateway/anthropic/v1/messages` and `/v1/messages` must expose the same Anthropic-compatible contract
- `/claw/gateway/gemini/v1beta/models/{model}:generateContent` and `/v1beta/models/{model}:generateContent` must expose the same Gemini-compatible contract

The governed path is for governance, observability, and operational clarity. It is not a second protocol flavor.

## Minimum Endpoint Matrix

| Protocol family | Governed roots | Official alias roots | Minimum required endpoints | Outbound contract |
| --- | --- | --- | --- | --- |
| OpenAI-compatible | `/claw/gateway/openai/v1/*` | `/v1/*` | `GET /models`, `POST /chat/completions`, `POST /responses`, `POST /embeddings` | OpenAI JSON and OpenAI SSE |
| Anthropic-compatible | `/claw/gateway/anthropic/v1/*` | `/v1/*` | `GET /models`, `POST /messages` | Anthropic JSON and Anthropic streaming |
| Gemini-compatible | `/claw/gateway/gemini/v1beta/*`, `/claw/gateway/gemini/v1/*` | `/v1beta/*`, `/v1/models/{model}:*` | `GET /v1beta/models`, `POST /v1beta/models/{model}:generateContent`, `POST /v1beta/models/{model}:streamGenerateContent`, `POST /v1beta/models/{model}:embedContent`, plus provider-standard `/v1/models/{model}:*` action paths where required | Gemini JSON and Gemini native streaming |

### Compatibility Support Modes

Each endpoint implementation should declare one support mode:

- `exact-pass-through`
- `translated-compatible`
- `explicitly-unsupported`

Rules:

- Anthropic native and Gemini native paths should prefer `exact-pass-through`
- OpenAI-compatible paths may use `translated-compatible` when routing to Anthropic or Gemini upstreams
- unsupported features or endpoints must fail explicitly instead of degrading silently

## Alias Protocol Resolution

### Unique Alias Paths

The following alias paths resolve without ambiguity:

- `POST /v1/chat/completions` -> OpenAI-compatible
- `POST /v1/responses` -> OpenAI-compatible
- `POST /v1/embeddings` -> OpenAI-compatible
- `POST /v1/messages` -> Anthropic-compatible
- `GET /v1beta/models` -> Gemini-compatible
- `POST /v1beta/models/{model}:*` -> Gemini-compatible
- `POST /v1/models/{model}:*` -> Gemini-compatible

### Ambiguous Alias Path

The initial minimum surface has one intentionally ambiguous alias path:

- `GET /v1/models`

Resolution order:

1. If the presented compatibility credential is bound to one protocol family, use that protocol family.
2. If `anthropic-version` is present, resolve to `anthropic`.
3. If `x-api-key` is present and `Authorization: Bearer` is not present, resolve to `anthropic`.
4. If `Authorization: Bearer` is present, resolve to `openai`.
5. Otherwise reject as unresolved and fail closed.

### Production Guidance

In production, ambiguous alias access should rely on protocol-bound compatibility credentials instead of heuristic resolution. Header-based heuristics are a compatibility fallback, not the primary governance model.

### Pre-Resolution Failure Exception

Most compatibility responses must follow the resolved protocol envelope.

There is one exception:

- if the router cannot yet resolve a protocol family, it may return a small neutral compatibility negotiation error

Recommended neutral shape:

```json
{
  "error": {
    "message": "Unable to resolve compatibility protocol for this request.",
    "category": "protocol_resolution",
    "code": "ambiguous_protocol"
  }
}
```

This exception is allowed only before protocol resolution completes.

## Request And Response Conformance Rules

### Auth Transport Rules

| Protocol family | Accepted client auth on alias path | Accepted client auth on governed path | Notes |
| --- | --- | --- | --- |
| OpenAI-compatible | `Authorization: Bearer <secret>` | `Authorization: Bearer <secret>` | Platform-native management tokens must not work here. |
| Anthropic-compatible | `x-api-key: <secret>` | `x-api-key: <secret>` | `anthropic-version` is required for native Anthropic behavior. |
| Gemini-compatible | query `key=<secret>` or `x-goog-api-key: <secret>` | query `key=<secret>` or `x-goog-api-key: <secret>` | Query-key transport is supported for compatibility but must be redacted everywhere internally. |

### Request Feature Matrix

| Feature family | OpenAI-compatible inbound | Anthropic native | Gemini native | Translation rule |
| --- | --- | --- | --- | --- |
| Model selection | Required | Required | Required | Must validate against exposed model policy before upstream dispatch. |
| Basic text messages and prompts | Required | Required | Required | Preserve semantics; reject only if model or route cannot support the requested content mode. |
| Streaming flag | Required where endpoint supports it | Required where endpoint supports it | Native stream endpoint required | Outbound stream format must follow the inbound protocol family, not the upstream transport. |
| Tool definitions and tool choice | Conditional | Conditional | Conditional | Translate only when the target adapter can preserve intent. Otherwise reject explicitly. |
| Structured JSON output or response format | Conditional | Conditional | Conditional | Only allowed when the target adapter can enforce or faithfully project the requested structure. |
| Reasoning or thinking controls | Conditional | Conditional | Conditional | Treat as policy hints only when a credible mapping exists. Otherwise reject on compatibility surfaces that claim exactness. |
| Image or multimodal input | Conditional | Conditional | Conditional | Allow only when the resolved model capability and route policy both permit it. |
| Audio input or output | Not in minimum V1 conformance | Not in minimum V1 conformance | Not in minimum V1 conformance | Reject explicitly until endpoint and model capability guarantees exist. |
| Embeddings | Required for OpenAI-compatible surface | Not part of native minimum surface | Required for Gemini native minimum surface | Translate OpenAI embeddings only when the adapter has a defined embedding mapping. |
| Metadata and user tags | Conditional | Conditional | Conditional | May be passed through, normalized to audit metadata, or rejected. Must not be silently dropped. |
| Caching, prediction, store flags, logprobs, seed, citations, web search | Not in minimum V1 conformance | Not in minimum V1 conformance | Not in minimum V1 conformance | Reject explicitly unless a later spec promotes them to supported status. |

### Unsupported Feature Rule

If a feature is unsupported for the effective route, model, or adapter:

- reject with a provider-family error envelope when the protocol is resolved
- do not silently drop the field
- include a stable machine-readable error code where feasible

### Model Visibility Rule

Compatibility paths such as `/v1/models`, `/v1beta/models`, and governed equivalents must only list models that are allowed by all of:

- the credential binding
- the tenant or workspace scope
- the effective model policy
- the effective route exposure policy

## Streaming Semantics

### OpenAI-Compatible Streaming

OpenAI-compatible streaming must use:

- `text/event-stream`
- `data: {json}\n\n` chunk framing
- terminal `data: [DONE]\n\n`

If the upstream protocol is Anthropic or Gemini:

- internal event translation may occur
- the client must still observe OpenAI-compatible SSE framing

### Anthropic Native Streaming

Anthropic native requests must preserve Anthropic-style event-stream behavior, including required version headers and event ordering semantics expected by Anthropic-compatible clients.

### Gemini Native Streaming

Gemini native requests must preserve Gemini native path shape and requested API version:

- `v1beta` requests remain `v1beta`
- `v1` model-action requests remain `v1`

If the provider-standard streaming mode requires additional query parameters such as `alt=sse`, the gateway may add or forward them internally, but the visible external contract must still look like the resolved Gemini surface.

### Post-Start Failure Rule

Once a stream has emitted protocol-visible data:

- the gateway must not switch to a different non-stream error envelope
- it should emit a protocol-consistent terminal event where the protocol permits it
- otherwise it should terminate the stream and record the request as incomplete in audit and observability data

## Error Envelope Standard

### Resolved Protocol Errors

When a protocol family is resolved, error responses should follow these families:

| Protocol family | Target error family |
| --- | --- |
| OpenAI-compatible | `{ "error": { "message", "type", "param", "code" } }` |
| Anthropic-compatible | `{ "type": "error", "error": { "type", "message" } }` |
| Gemini-compatible | `{ "error": { "code", "message", "status", "details?" } }` |

Rules:

- status codes should remain meaningful and vendor-aligned where feasible
- provider-family error codes should be stable enough for client retries and operator diagnostics
- internal stack traces, upstream raw credentials, and internal route secrets must never appear in the response body

### Internal Failure Mapping

The gateway should map internal failures into provider-family categories such as:

- authentication failure
- permission or policy denial
- model not found
- unsupported feature
- upstream unavailable
- rate limited
- internal transient failure

### Important Correction To Current Local Proxy

The current local proxy shape:

```json
{ "error": "..." }
```

is not sufficient for long-term protocol conformance. It is acceptable as a local implementation starting point, but not as the final compatibility contract.

## Credential Taxonomy

The platform should formally distinguish:

- `platform session or management token`
- `gateway compatibility credential`
- `upstream provider secret`
- `node join credential`
- `node identity credential`
- `plugin or sidecar runtime secret`

Rules:

- platform-native management credentials must not authenticate to compatibility alias paths
- gateway compatibility credentials must not automatically grant `/claw/manage/*` or `/claw/api/*` access
- upstream provider secrets are never presented by external compatibility clients
- node and plugin credentials must remain outside the ordinary compatibility token lifecycle

## Gateway Credential Model

### Resource Mapping

`GatewayCredential` is the canonical management resource for compatibility-client authentication.

Its secret-bearing material should be represented through a linked `SecretRecord`, not through inline plaintext fields on ordinary management reads.

### Required Spec Areas

Every gateway credential should define at minimum:

- `protocolFamily`
- `authTransport`
- `allowedPathFamilies`
- `routeBindings`
- `modelPolicyRef`
- `scopeBinding`
- `subject`
- `expiresAt`
- `rateLimitProfileRef`
- `rotationPolicy`
- `revealPolicy`
- `secretRecordRef`

### Required Status Areas

Every gateway credential should report at minimum:

- `activeVersionId`
- `lastUsedAt`
- `lastRotatedAt`
- `revocationState`
- `rotationState`
- `failedAuthCount`
- `usageSummary`

### Single-Protocol Rule

One compatibility credential must bind to exactly one protocol family:

- `openai`
- `anthropic`
- `gemini`

One principal may own multiple credentials, but each credential is single-protocol.

### Path Entitlement Rule

One credential may authorize both:

- governed `/claw/gateway/{protocol}/*` paths
- official alias paths for the same protocol family

It must not authorize a different protocol family.

### Issuance Rule

At issuance time:

- the gateway returns the raw secret only once unless a one-time reveal policy is explicitly supported
- the management API returns metadata plus a safe public prefix on subsequent reads
- audit must record the issuance event without storing the plaintext secret

### Rotation Rule

Rotation should create a new credential version rather than mutating the existing secret in place.

Recommended lifecycle:

1. issue a new version
2. allow optional bounded overlap
3. update dependent clients
4. revoke or expire the previous version
5. record completion in audit

### Revocation Rule

Revocation must:

- immediately deny new requests using the revoked credential version
- preserve metadata and audit history
- not require deleting the whole credential resource

### Model Filtering Rule

Credential bindings must affect both:

- what inference requests are allowed
- what discovery endpoints such as `/v1/models` or `/v1beta/models` are allowed to reveal

## Secret Provider Standard

### Secret Classes

The secret system should support at least three material classes:

- `verifier`
- `recoverable`
- `externalReference`

### Verifier Secrets

Use `verifier` secrets for inbound client-presented compatibility credentials.

Rules:

- store a public identifier or prefix plus a non-reversible verifier
- do not persist the full plaintext credential for later recovery
- verification should use a strong password-hashing or token-verifier algorithm such as `Argon2id`

### Recoverable Secrets

Use `recoverable` secrets for materials the platform must present upstream, such as:

- upstream provider API keys
- database passwords
- cache credentials
- outbound webhook or integration secrets

Rules:

- encrypt at rest using envelope encryption or an equivalent key hierarchy
- store metadata separately from encrypted payload
- support re-encryption when the master key source rotates

### External Reference Secrets

Use `externalReference` when the secret payload is stored in an external system and Claw stores only:

- a provider reference
- a stable lookup handle
- capability metadata

### Built-In Desktop Provider

Desktop should use this logical model:

- secret metadata in SQLite
- verifier secrets in SQLite using a strong verifier format
- recoverable secrets in the platform OS secret store where available
- encrypted local fallback only when the OS secret facility is unavailable or not usable

Recommended desktop fallback order:

- Windows:
  - OS secret facility first, for example `DPAPI` or Windows-managed credential storage
  - encrypted local fallback only if OS binding is not available
- macOS:
  - Keychain first
  - encrypted local fallback only if Keychain is unavailable
- Linux:
  - Secret Service or `libsecret` first
  - encrypted local fallback only in explicitly acknowledged degraded mode

### Built-In Server Provider

Server should use this logical model:

- metadata in the primary relational database
- verifier secrets in the database as non-recoverable verifier records
- recoverable secret payloads stored encrypted at rest
- master key source supplied by environment, file-mounted key material, OS secret facility, or external KMS plugin

### Required Server Key-Hierarchy Rule

The built-in server provider should separate:

- application metadata records
- encrypted secret records
- master or key-encryption key source

Backups and exports must not silently downgrade encrypted material into plaintext.

### Secret Store SPI

The host core should define a `SecretStore` capability with operations such as:

- `createVerifierSecret`
- `verifySecret`
- `createRecoverableSecret`
- `resolveRecoverableSecret`
- `rotateSecret`
- `revokeSecret`
- `rekeySecret`
- `describeSecret`

Business features, browser code, and ordinary plugins should not receive raw backend-specific secret-store handles.

### Recommended Rust Security Building Blocks

The implementation should prefer mature Rust ecosystem primitives rather than custom cryptography.

Recommended baseline:

- verifier hashing: `argon2` with `Argon2id`
- authenticated encryption: `aes-gcm` or `chacha20poly1305` from the `RustCrypto` ecosystem
- randomness: `getrandom`
- secret memory hygiene: `zeroize`
- TLS and node identity integration: the same `rustls` ecosystem already used by the host HTTP stack

Exact crate selection may still evolve, but the platform should avoid bespoke cryptographic implementations.

### Browser Boundary Rule

Browser clients should be able to:

- create secret-bearing resources through management APIs
- observe metadata, health, and rotation posture

Browser clients should not be able to:

- retrieve ordinary plaintext secret bodies after issuance
- bypass server-side authorization to resolve recoverable secrets directly

## Logging, Audit, And Redaction Rules

### Redaction Must Happen Before Persistence

Sensitive material must be removed or masked before it enters:

- access logs
- structured application logs
- traces
- metrics labels
- audit payloads
- debug request captures

### Protocol-Specific Redaction Matrix

| Protocol family | Sensitive client material | Redaction requirement |
| --- | --- | --- |
| OpenAI-compatible | `Authorization: Bearer <secret>` | Never log the bearer secret. Keep at most a safe public prefix or credential id. |
| Anthropic-compatible | `x-api-key: <secret>` | Never log raw header value. Preserve non-secret headers such as `anthropic-version`. |
| Gemini-compatible | query `key=<secret>`, `x-goog-api-key: <secret>` | Query key must be removed or masked before access logging, tracing, metrics, and audit. Header values must also be redacted. |

### Query-String Sanitization Rule

Gemini query-string secrets require special handling.

The gateway must sanitize the request URI before it is written to:

- request logs
- trace spans
- metrics dimensions
- audit metadata

This sanitization must happen before the raw URI is persisted anywhere.

### Audit Requirements

The audit subsystem should record:

- credential issuance
- credential reveal when supported
- credential rotation
- credential revocation
- upstream secret create, update, rotate, and delete
- failed compatibility authentication attempts
- policy denials on compatibility paths

Audit should reference:

- resource id
- credential id or public prefix
- actor principal
- scope
- result
- correlation id

Audit should not contain raw secret material.

### Debug Capture Rule

If request or response capture is enabled for diagnostics:

- it must be explicitly opt-in
- secret-bearing headers and query parameters must still be redacted
- request bodies should be subject to content-aware masking rules when they contain secret-like fields

## Explicit Review Findings Against The Current Local Proxy

This architecture review identifies these concrete gaps in the current local proxy implementation baseline:

1. The shared local `auth_token` is a useful local bootstrap mechanism, but it is not sufficient as the long-term compatibility credential model because it does not encode protocol family, scope binding, rotation policy, or route entitlement.
2. The current generic `proxy_error()` shape is too weak for provider-native conformance and should be treated as transitional.
3. The current runtime contracts expose local proxy URLs and route summaries, but they do not yet model credential class, secret posture, or compatibility publication policy.
4. Existing tests already cover core route preservation and translation behavior, but a dedicated conformance fixture suite is still needed for failure envelopes, unsupported-feature behavior, and alias-path ambiguity handling.

## Remaining Gaps After This Spec

This document closes major architecture gaps, but several follow-up areas remain:

- endpoint-by-endpoint OpenAPI contracts for gateway credential management
- endpoint-by-endpoint OpenAPI contracts for secret record management
- external KMS or vault plugin SPI
- backup, export, and restore rules for encrypted secret records
- quota and billing enforcement behavior tied to gateway credentials
- version-skew rules for compatibility capabilities across control plane and node host

## Acceptance Criteria

This spec is successful when:

- governed compatibility paths and official alias paths are defined as protocol-isomorphic contracts
- ambiguous alias routing has one documented fail-closed resolution rule
- compatibility credentials are clearly separated from platform-native auth tokens
- inbound compatibility credentials and recoverable upstream secrets use different secret classes
- desktop and server secret backends share one logical model without forcing the same storage implementation
- logging, audit, traces, and metrics all have protocol-specific redaction rules, including Gemini query-string keys
- the current local proxy can be judged against a concrete future conformance target instead of ad hoc expectations
