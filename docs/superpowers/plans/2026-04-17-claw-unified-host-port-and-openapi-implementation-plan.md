# Claw Unified Host Port And OpenAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all server-style HTTP publication behind the built-in host port while keeping `/claw/*` for platform-native APIs, preserving exact root-native `local-ai-proxy` compatibility paths, and publishing live OpenAPI 3.1 discovery plus schema snapshots at startup.

**Architecture:** Keep `local-ai-proxy` as its own runtime for now, but let the built-in host become the only externally relevant port by mounting host-owned reverse-proxy surfaces and publishing one live API-surface catalog that both the router and `/claw/openapi/*` consume. Native platform APIs stay under `/claw/*`, `local-ai-proxy` owns the provider-standard root paths, and OpenClaw host-governed proxy routes stay under `/claw/gateway/openclaw/*`. Startup writes the active schema catalog to the runtime data directory and logs the active gateway endpoints from the same live catalog.

**Tech Stack:** Rust (`axum`, `tokio`, `serde`, `serde_json`, `reqwest`), existing `sdkwork-claw-server` and `sdkwork-claw-desktop` crates, cargo tests, workspace docs.

---

## File Structure

### Existing files to modify

- `packages/sdkwork-claw-server/src-host/Cargo.toml`
  Add the HTTP client dependency needed for host-owned reverse proxying.
- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
  Extend `ServerState` with live published-surface and proxy-target metadata.
- `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
  Register the new API-surface and proxy route modules.
- `packages/sdkwork-claw-server/src-host/src/http/router.rs`
  Mount root-native local AI compatibility routes, governed OpenClaw proxy routes, and keep asset fallback after API routes.
- `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
  Replace the single-document manual publication path with handlers backed by the live API-surface catalog.
- `packages/sdkwork-claw-server/src-host/src/main.rs`
  Add end-to-end tests and startup schema publication/logging for server mode.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
  Pass `LocalAiProxyService` into desktop host bootstrap.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
  Expand embedded-host tests to cover root-native local AI compatibility publication and multi-document discovery.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
  Project desktop `local-ai-proxy` and OpenClaw gateway runtime data into the embedded host `ServerState`.
- `docs/reference/api-reference.md`
  Document the new route taxonomy and multi-document discovery model.
- `docs/reference/claw-server-runtime.md`
  Document unified host-port publication, startup schema output, and active document URLs.
- `docs/zh-CN/reference/api-reference.md`
  Keep the Chinese API reference aligned.
- `docs/zh-CN/reference/claw-server-runtime.md`
  Keep the Chinese runtime reference aligned.

### New files to create

- `packages/sdkwork-claw-server/src-host/src/http/api_surface.rs`
  Single source of truth for active document metadata, route inventories, discovery payloads, runtime schema snapshots, and startup endpoint catalogs.
- `packages/sdkwork-claw-server/src-host/src/http/routes/local_ai_compat.rs`
  Host-owned reverse proxy routes for `/health`, `/v1/*`, and `/v1beta/*` root-native compatibility paths.
- `packages/sdkwork-claw-server/src-host/src/http/routes/openclaw_gateway_proxy.rs`
  Host-owned governed proxy routes for `/claw/gateway/openclaw/*`, starting with `/tools/invoke`.

### Tests to add or expand

- `packages/sdkwork-claw-server/src-host/src/http/api_surface.rs`
  Unit tests for discovery/document ownership and schema snapshot serialization.
- `packages/sdkwork-claw-server/src-host/src/http/routes/local_ai_compat.rs`
  Unit tests for root-native path forwarding and header/query preservation.
- `packages/sdkwork-claw-server/src-host/src/http/routes/openclaw_gateway_proxy.rs`
  Unit tests for governed path forwarding and upstream capability gating.
- `packages/sdkwork-claw-server/src-host/src/main.rs`
  End-to-end server tests for discovery, document parity, and startup schema publication.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
  Embedded-host tests for root-native provider paths and multi-document `/claw/openapi/discovery`.

## Task 1: Add failing tests for live unified host publication

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

- [ ] **Step 1: Write the failing server tests**

Add server tests that expect:

- `/claw/openapi/discovery` can advertise more than one document from a live catalog
- `/claw/openapi/discovery` only advertises optional documents when the corresponding surface is active
- the native document remains at `/claw/openapi/v1.json`
- the optional document URLs are:
  - `/claw/openapi/local-ai-compat-v1.json`
  - `/claw/openapi/openclaw-gateway-v1.json`

- [ ] **Step 2: Write the failing embedded-host tests**

Add desktop embedded-host tests that expect:

- `GET /v1/models` is served from the built-in host port when `local-ai-proxy` is running
- `POST /v1/chat/completions` and `POST /v1/messages` are reachable on the built-in host port without an extra prefix
- `/claw/openapi/discovery` advertises `local-ai-compat-v1` when the local AI surface is active
- `/claw/openapi/discovery` advertises `openclaw-gateway-v1` only when the managed OpenClaw gateway proxy surface is active

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi_discovery_route
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_root_native_local_ai_proxy_routes
```

Expected:

- server tests fail because discovery only publishes one document today
- desktop tests fail because the embedded host does not currently own `/v1/*` and `/health`

- [ ] **Step 4: Commit the failing-test scaffold**

```bash
git add packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs
git commit -m "test: cover unified host publication surfaces"
```

## Task 2: Add the live API-surface catalog and desktop publication wiring

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/api_surface.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`

- [ ] **Step 1: Write the failing unit tests for the catalog and desktop projection**

Add tests that expect:

- `build_api_surface_catalog(&ServerState)` returns `claw-native-v1` always
- the catalog includes `local-ai-compat-v1` only when the state carries an active local AI proxy target
- the catalog includes `openclaw-gateway-v1` only when the state carries an active OpenClaw gateway proxy target
- the desktop embedded-host state builder can project `local-ai-proxy` health and OpenClaw gateway metadata into `ServerState`

- [ ] **Step 2: Run the focused unit tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml api_surface
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml build_embedded_host_server_state
```

Expected: FAIL because there is no shared live API-surface catalog and the desktop host state does not receive local AI publication data.

- [ ] **Step 3: Implement the minimal live-catalog and state wiring**

Create concrete production types instead of placeholders. Minimum shape:

```rust
pub struct PublishedProxyTarget {
    pub id: &'static str,
    pub base_url: String,
    pub auth_token: Option<String>,
}

pub struct ApiSurfaceCatalog {
    pub generated_at: u64,
    pub documents: Vec<PublishedOpenApiDocument>,
    pub gateway_endpoints: Vec<String>,
}
```

Implement:

- `ServerState` fields for optional `local-ai-proxy` and OpenClaw proxy targets
- `build_api_surface_catalog(&ServerState)`
- desktop bootstrap/context changes so embedded-host startup receives `LocalAiProxyService` and can project its live health into the state

- [ ] **Step 4: Re-run the focused unit tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml api_surface
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml build_embedded_host_server_state
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/api_surface.rs packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs
git commit -m "feat: add live api surface catalog state"
```

## Task 3: Mount host-owned proxy routes on the unified host port

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/local_ai_compat.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/openclaw_gateway_proxy.rs`
- Modify: `packages/sdkwork-claw-server/src-host/Cargo.toml`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

- [ ] **Step 1: Write the failing proxy route tests**

Add tests that expect:

- `/health`, `/v1/health`, `/v1/models`, `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/messages`, `/v1beta/models`, `/v1beta/models/{modelAction}`, and `/v1/models/{modelAction}` are routed through the host when the `local-ai-proxy` target exists
- `/claw/gateway/openclaw/tools/invoke` is routed through the host when the OpenClaw target exists
- `/claw/gateway/local-ai/*` is absent
- static asset fallback does not swallow the root-native compatibility routes

- [ ] **Step 2: Run the focused proxy tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml local_ai_compat
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openclaw_gateway_proxy
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_root_native_local_ai_proxy_routes
```

Expected: FAIL because the router does not yet mount the proxy surfaces.

- [ ] **Step 3: Implement the minimal host-owned proxy routes**

Use one concrete forwarding helper per surface. Required behavior:

```rust
async fn forward_local_ai_request(...) -> Response
async fn forward_openclaw_gateway_request(...) -> Response
```

Rules to implement:

- preserve the exact root-native `local-ai-proxy` paths
- forward request method, body, query string, content type, and auth headers needed by the upstream surface
- do not create `/claw/gateway/local-ai/*`
- keep OpenClaw proxying under `/claw/gateway/openclaw/*`
- mount API routes before static assets so `/v1/*` does not fall through to the browser shell

- [ ] **Step 4: Re-run the focused proxy tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml local_ai_compat
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openclaw_gateway_proxy
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_root_native_local_ai_proxy_routes
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/Cargo.toml packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/local_ai_compat.rs packages/sdkwork-claw-server/src-host/src/http/routes/openclaw_gateway_proxy.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs
git commit -m "feat: mount unified host proxy routes"
```

## Task 4: Rebuild OpenAPI discovery and startup schema publication from the live catalog

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/api_surface.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

- [ ] **Step 1: Write the failing discovery, document, and schema-publication tests**

Add tests that expect:

- `/claw/openapi/discovery` returns one document for plain server mode and multiple documents when optional proxy surfaces are active
- `/claw/openapi/local-ai-compat-v1.json` describes only root-native compatibility paths
- `/claw/openapi/openclaw-gateway-v1.json` describes only governed OpenClaw proxy paths
- startup writes:
  - `<runtime_data_dir>/openapi/discovery.json`
  - `<runtime_data_dir>/openapi/claw-native-v1.json`
  - optional `<runtime_data_dir>/openapi/local-ai-compat-v1.json`
  - optional `<runtime_data_dir>/openapi/openclaw-gateway-v1.json`

- [ ] **Step 2: Run the focused OpenAPI tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_openapi_discovery_documents
```

Expected: FAIL because discovery and schema output are still single-document and startup does not write runtime schema snapshots.

- [ ] **Step 3: Implement the live multi-document publication pipeline**

Use the catalog as the single source of truth. Minimum public helpers:

```rust
pub fn build_openapi_discovery(state: &ServerState) -> Value
pub fn build_openapi_document(state: &ServerState, document_id: &str) -> Option<Value>
pub fn write_runtime_openapi_snapshots(state: &ServerState, base_url: &str) -> Result<Vec<PathBuf>>
```

Implementation rules:

- `claw-native-v1` remains at `/claw/openapi/v1.json`
- optional documents are only advertised when their surfaces are active
- no path appears in more than one live document
- startup writes schema files atomically
- startup logs one machine-readable endpoint catalog derived from the same live catalog

- [ ] **Step 4: Re-run the focused OpenAPI tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_openapi_discovery_documents
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/api_surface.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs
git commit -m "feat: publish live multi-document openapi catalogs"
```

## Task 5: Refresh references and run full verification

**Files:**
- Modify: `docs/reference/api-reference.md`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/zh-CN/reference/api-reference.md`
- Modify: `docs/zh-CN/reference/claw-server-runtime.md`
- Modify: `docs/superpowers/plans/2026-04-17-claw-unified-host-port-and-openapi-implementation-plan.md`

- [ ] **Step 1: Update the reference docs**

Document:

- `/claw/*` as the native platform namespace
- root-native `local-ai-proxy` compatibility paths on the same host port
- `/claw/gateway/openclaw/*` as the governed OpenClaw proxy namespace
- `/claw/openapi/discovery` with:
  - `/claw/openapi/v1.json`
  - `/claw/openapi/local-ai-compat-v1.json`
  - `/claw/openapi/openclaw-gateway-v1.json`
- startup runtime schema snapshots under `<runtime_data_dir>/openapi/`

- [ ] **Step 2: Run the verification suite**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Inspect the diff**

Run:

```bash
git diff -- docs/reference/api-reference.md docs/reference/claw-server-runtime.md docs/zh-CN/reference/api-reference.md docs/zh-CN/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-17-claw-unified-host-port-and-openapi-implementation-plan.md packages/sdkwork-claw-server/src-host/Cargo.toml packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/http/routes/local_ai_compat.rs packages/sdkwork-claw-server/src-host/src/http/routes/openclaw_gateway_proxy.rs packages/sdkwork-claw-server/src-host/src/http/api_surface.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs
```

Expected: only the unified host-port and OpenAPI slice files are touched.

- [ ] **Step 4: Commit**

```bash
git add docs/reference/api-reference.md docs/reference/claw-server-runtime.md docs/zh-CN/reference/api-reference.md docs/zh-CN/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-17-claw-unified-host-port-and-openapi-implementation-plan.md packages/sdkwork-claw-server/src-host/Cargo.toml packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/http/routes/local_ai_compat.rs packages/sdkwork-claw-server/src-host/src/http/routes/openclaw_gateway_proxy.rs packages/sdkwork-claw-server/src-host/src/http/api_surface.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs
git commit -m "feat: unify host port publication and live openapi catalogs"
```

## Execution Notes

- Do not collapse `local-ai-proxy` into the embedded host runtime in this slice. The external publication must unify first; internal process topology can be revisited later.
- Do not introduce `/claw/gateway/local-ai/*` aliases.
- Do not expand this slice into credential-governance or provider translation redesign.
- If a new route is mounted on the unified host port, add it to the live API-surface catalog before considering the implementation complete.
