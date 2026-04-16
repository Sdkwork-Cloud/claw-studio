# Claw Unified Host Port And Real-Time OpenAPI Design

**Date:** 2026-04-17

## Goal

Define the canonical publication model for every server-style HTTP API in `Claw Studio` so that:

- desktop and server shells expose one built-in webserver port as the single external host entry
- platform-native APIs remain clearly namespaced under `/claw/*`
- `local-ai-proxy` preserves exact provider-standard paths so callers only change `baseURL` and `apiKey`
- OpenAPI 3.1 documents are generated from the live mounted route set instead of a second handwritten source
- startup emits the current schema catalog and gateway endpoint map for operators, tooling, and future SDK generation

This spec is intentionally limited to HTTP publication, proxy path ownership, and OpenAPI generation.

It does not redesign:

- provider translation internals inside `local-ai-proxy`
- credential or secret-governance policy
- WebSocket proxy behavior beyond discovery metadata rules
- kernel filesystem layout or kernel config ownership

## Relationship To Existing Design

This spec refines and narrows:

- [2026-04-04-claw-one-host-runtime-multi-shell-convergence-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-04-claw-one-host-runtime-multi-shell-convergence-design.md)
- [2026-04-02-claw-compatibility-conformance-and-credential-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-compatibility-conformance-and-credential-design.md)
- [2026-04-13-multi-kernel-platform-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md)

This document supersedes older assumptions in one specific area:

- `local-ai-proxy` must not be published under `/claw/gateway/local-ai/*`
- provider-compatible alias paths must not be duplicated behind a second governed compatibility prefix for the built-in host port
- the built-in host must not rely on a giant one-file OpenAPI document that mixes native platform APIs and provider compatibility APIs into one contract

## Source Snapshot

This design is grounded in the current workspace state on 2026-04-17.

Confirmed local implementation signals:

- `packages/sdkwork-claw-server/src-host/src/http/router.rs` already mounts native same-origin route families under:
  - `/claw/health/*`
  - `/claw/api/v1/*`
  - `/claw/openapi/*`
  - `/claw/internal/v1/*`
  - `/claw/manage/v1/*`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs` already reuses the same Rust router inside desktop embedded-host mode
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs` already exposes exact provider-facing routes at root-native paths such as `/v1/chat/completions`, `/v1/messages`, and `/v1beta/models`
- `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs` already publishes manual OpenAPI 3.1 JSON for the native `/claw/*` families
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_control.rs` and related runtime wiring still use OpenClaw gateway HTTP at `/tools/invoke`
- workspace scripts confirm that the older `sdkwork-api-router` runtime is no longer a valid implementation source, so this host-owned publication model must become the single source of truth

## Current Problem

The current built-in host story is incomplete in four ways:

1. The host port already unifies native `/claw/*` APIs, but it does not yet authoritatively unify every server-style HTTP surface behind the same entry point.
2. `local-ai-proxy` already has correct provider-native paths, but a new `/claw/gateway/local-ai/*` prefix would break the required compatibility model where clients only swap `baseURL` and `apiKey`.
3. OpenAPI publication still documents only the native `/claw/*` families, so provider compatibility and OpenClaw gateway proxy contracts are not discoverable from the built-in host.
4. Startup does not yet emit one authoritative schema catalog and gateway endpoint snapshot, so docs, tooling, and runtime inspection can drift.

## Final Decision

Adopt **One Host Port, One Discovery Surface, Multiple Live OpenAPI Documents**.

The authoritative publication model becomes:

- one built-in webserver port per host shell
- one discovery endpoint at `/claw/openapi/discovery`
- one native platform document for `/claw/*`
- one local AI compatibility document for root-native provider paths
- one OpenClaw gateway proxy document for host-governed OpenClaw proxy routes
- one runtime-generated schema snapshot directory written at startup and refreshed whenever the live published surface changes

## Route Taxonomy

### 1. Native platform APIs stay under `/claw/*`

These remain the authoritative platform-owned APIs:

- `/claw/health/*`
- `/claw/api/v1/*`
- `/claw/openapi/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`

Rule:

- anything that is platform-native, operator-facing, or host-coordination-specific must stay under `/claw/*`

### 2. `local-ai-proxy` keeps exact provider-standard paths

These routes must be mounted on the same built-in host port with no extra prefix:

- `GET /health`
- `GET /v1/health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`
- `POST /v1/messages`
- `GET /v1beta/models`
- `POST /v1beta/models/{modelAction}`
- `POST /v1/models/{modelAction}`

Rules:

- no `/claw/gateway/local-ai/*`
- no `/claw/gateway/openai/*`
- no dual publication where the same `local-ai-proxy` contract exists both at a root-native path and at a governed alias path
- the wire contract must remain provider-compatible so OpenAI-compatible clients, Claude Code, and Gemini-compatible callers only need to change `baseURL` and `apiKey`

Rationale:

- compatibility clients resolve paths relative to the configured base URL
- forcing an extra path prefix breaks that contract and turns the proxy into a custom API instead of a standards-compatible endpoint

### 3. OpenClaw proxy APIs stay host-governed under `/claw/gateway/openclaw/*`

OpenClaw gateway proxying is still valuable on the unified host port, but it must not collide with the provider-standard root paths owned by `local-ai-proxy`.

The first-wave host-governed OpenClaw proxy surface is:

- `POST /claw/gateway/openclaw/tools/invoke`

The following routes are allowed when the built-in OpenClaw runtime reports that the corresponding HTTP surface is available:

- `POST /claw/gateway/openclaw/v1/chat/completions`
- `POST /claw/gateway/openclaw/v1/responses`

Rules:

- OpenClaw proxy routes must never claim `/v1/*` on the unified host, because those root-native compatibility paths belong to `local-ai-proxy`
- OpenClaw proxy routes are host-governed routes, not provider-standard alias routes
- WebSocket publication, if proxied later, must be described in discovery metadata and not forced into OpenAPI `paths`

### 4. Static assets and bootstrap pages are excluded from OpenAPI

These built-in host surfaces are not OpenAPI-managed APIs:

- `/`
- static asset paths
- `/sdkwork-claw-bootstrap.json`

## API Inventory

### Native Platform Inventory

The native document continues to own:

- `health`
- `api`
- `internal`
- `manage`

Current concrete roots remain:

- `/claw/health/live`
- `/claw/health/ready`
- `/claw/api/v1/discovery`
- `/claw/api/v1/studio/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`

### Local AI Compatibility Inventory

The local AI compatibility document owns:

- root health and operational probe endpoints
- OpenAI-compatible paths
- Anthropic-compatible paths
- Gemini-compatible paths

The document must describe the exact published paths listed in Route Taxonomy section 2, not a prefixed variant.

### OpenClaw Gateway Proxy Inventory

The OpenClaw gateway proxy document owns:

- `/claw/gateway/openclaw/tools/invoke`
- any additional `/claw/gateway/openclaw/*` HTTP routes that are actively mounted by the host based on live runtime capabilities

## OpenAPI Publication Model

### One discovery endpoint, multiple documents

`GET /claw/openapi/discovery` remains the authoritative entry point and is extended to publish multiple documents.

The built-in host must publish at least these document IDs when the corresponding API family is active:

- `claw-native-v1`
- `local-ai-compat-v1`
- `openclaw-gateway-v1`

Recommended document URLs:

- `/claw/openapi/v1.json`
- `/claw/openapi/local-ai-compat-v1.json`
- `/claw/openapi/openclaw-gateway-v1.json`

### OpenAPI version

All generated documents use:

- `openapi: 3.1.0`

### Discovery payload shape

The existing discovery shape is extended, not replaced.

Each document entry should expose:

- `id`
- `title`
- `version`
- `format`
- `url`
- `apiFamilies`
- `proxyTarget`
- `generatedAt`
- `runtimeCapability`

Recommended `runtimeCapability` values:

- `always`
- `local-ai-proxy`
- `openclaw-gateway-http`

Recommended `proxyTarget` values:

- `native-host`
- `local-ai-proxy`
- `openclaw-gateway`

### Document ownership rules

- `claw-native-v1` describes only `/claw/*` platform-native families
- `local-ai-compat-v1` describes only root-native compatibility paths owned by `local-ai-proxy`
- `openclaw-gateway-v1` describes only `/claw/gateway/openclaw/*` proxy routes

No path may appear in more than one live OpenAPI document.

### Custom OpenAPI extensions

Custom metadata is allowed, but it must stay minimal and stable.

Approved extension fields:

- `x-sdkwork-generated-at`
- `x-sdkwork-api-families`
- `x-sdkwork-proxy-target`
- `x-sdkwork-runtime-capability`

## Real-Time Generation Model

### One source of truth

The host must stop treating route mounting and OpenAPI assembly as separate truth sources.

The design standard is:

- route registration and OpenAPI registration happen together
- mounted routes and published documents derive from the same live registry snapshot
- document `generatedAt` changes only when the published route set or route metadata changes

Recommended internal decomposition:

- `ApiSurfaceRegistry`
- `OpenApiDocumentBuilder`
- `StartupSchemaPublisher`

Responsibilities:

- `ApiSurfaceRegistry` owns live route family registration, owning document ID, capability predicates, and startup publication metadata
- `OpenApiDocumentBuilder` converts the current registry snapshot into OpenAPI 3.1 JSON documents and discovery metadata
- `StartupSchemaPublisher` writes the current discovery and document snapshots to disk and emits startup logs

### Capability-driven publication

OpenAPI publication must reflect the live mounted surface, not the theoretical maximum surface.

Rules:

- `claw-native-v1` is always present
- `local-ai-compat-v1` is present only when the built-in host mounts the root-native `local-ai-proxy` routes
- `openclaw-gateway-v1` is present only when the built-in host mounts the OpenClaw gateway proxy routes
- inactive documents must not be advertised in discovery

### No checked-in generated schema files

The repository remains source-only.

Rules:

- generated OpenAPI documents are runtime artifacts, not checked-in contract snapshots
- tests assert generation behavior and route parity
- docs may reference the stable runtime URLs, but not commit generated JSON into source control

## Startup Publication Requirements

At built-in host startup, after port binding succeeds and before the host is considered fully ready, the runtime must:

1. Generate the live discovery payload.
2. Generate each active OpenAPI document.
3. Write them to the runtime schema directory.
4. Emit one structured startup catalog log that includes schema URLs and active gateway endpoints.

### Runtime file publication

Recommended runtime directory:

- `<runtime_data_dir>/openapi/`

Required files:

- `<runtime_data_dir>/openapi/discovery.json`
- `<runtime_data_dir>/openapi/claw-native-v1.json`

Conditionally required files:

- `<runtime_data_dir>/openapi/local-ai-compat-v1.json`
- `<runtime_data_dir>/openapi/openclaw-gateway-v1.json`

File writes must be atomic so readers never observe partial JSON.

### Structured startup output

Startup must emit a machine-readable record that includes:

- `hostBaseUrl`
- `openapiDiscoveryUrl`
- `documents`
- `gatewayEndpoints`

Recommended `gatewayEndpoints` entries:

- native discovery endpoints under `/claw/*`
- root-native `local-ai-proxy` endpoints such as `/v1/chat/completions`, `/v1/messages`, and `/v1beta/models`
- OpenClaw proxy endpoints under `/claw/gateway/openclaw/*`

### Refresh behavior

If the live published surface changes during runtime, the host must refresh:

- in-memory discovery metadata
- in-memory OpenAPI document responses
- runtime schema files

This refresh is required for capability changes such as:

- `local-ai-proxy` becoming enabled or disabled
- OpenClaw gateway HTTP proxy routes becoming available or unavailable

## Error Handling Rules

- OpenAPI generation failure for optional surfaces must not silently produce stale discovery metadata
- if runtime schema publication fails, startup must fail fast for server mode and mark embedded-host startup as failed for desktop mode
- discovery must never advertise a document URL whose in-memory handler is absent
- route collisions between root-native provider paths and `/claw/*` or `/claw/gateway/openclaw/*` paths must fail at router construction time

## Rejected Alternatives

### Option A: Prefix all compatibility APIs under `/claw/gateway/*`

Rejected because:

- it breaks the required provider-compatibility rule for `local-ai-proxy`
- OpenAI-compatible clients, Claude Code, and Gemini callers could no longer work by only changing `baseURL` and `apiKey`

### Option B: Publish one giant combined OpenAPI document

Rejected because:

- native platform APIs and provider compatibility APIs evolve at different rates
- a combined document makes capability-driven publication and ownership boundaries harder to reason about
- it increases the chance of stale or duplicated paths

### Option C: Keep separate ports and only document them

Rejected because:

- the task is specifically to unify server-style HTTP publication behind the built-in webserver
- separate ports preserve operational ambiguity and complicate tooling

## Testing Strategy

### 1. Router composition tests

Add or extend tests that prove:

- native `/claw/*` routes remain mounted
- root-native `local-ai-proxy` routes are mounted exactly as `/v1/*`, `/v1beta/*`, and `/health`
- no `/claw/gateway/local-ai/*` routes are mounted
- OpenClaw proxy routes mount only under `/claw/gateway/openclaw/*`

### 2. Discovery and document parity tests

Add tests that prove:

- every discovery document URL resolves successfully
- every mounted published route appears in exactly one owning document
- document `generatedAt` remains stable across unchanged reads
- discovery stops advertising optional documents when the corresponding capability is absent

### 3. Startup publication tests

Add tests that prove:

- startup writes `discovery.json` and all active document files
- startup emits the gateway endpoint catalog with the expected root-native and `/claw/*` paths
- schema files refresh when the live mounted surface changes

### 4. Compatibility conformance smoke tests

Add host-level tests that prove:

- OpenAI-compatible callers can use `/v1/chat/completions` and `/v1/responses` without an extra path prefix
- Anthropic-compatible callers can use `/v1/messages` without an extra path prefix
- Gemini-compatible callers can use `/v1beta/models` and `/v1/models/{modelAction}` without an extra path prefix

### 5. Documentation regression checks

Update reference docs so they clearly distinguish:

- native `/claw/*` platform APIs
- root-native `local-ai-proxy` compatibility APIs
- `/claw/gateway/openclaw/*` OpenClaw proxy APIs

## Non-Negotiable Rules

- `local-ai-proxy` owns the provider-standard root-native paths on the unified host port
- `/claw/*` remains reserved for platform-native APIs
- OpenClaw proxy publication must not steal `/v1/*` from `local-ai-proxy`
- OpenAPI publication must derive from the live mounted route set
- startup must emit both schema URLs and gateway endpoint URLs as authoritative runtime output

## Outcome

This design makes the built-in host professionally consistent:

- one host port
- one discovery endpoint
- exact compatibility paths where standards require them
- explicit namespacing where platform governance requires it
- one live route registry
- one real-time OpenAPI publication pipeline

That is the simplest model that preserves compatibility, avoids duplicate route truths, and gives desktop and server the same authoritative runtime contract.
