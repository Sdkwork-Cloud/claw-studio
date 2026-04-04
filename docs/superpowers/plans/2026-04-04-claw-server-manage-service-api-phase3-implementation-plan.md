# Claw Server Manage Service API Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the native `claw-server` service lifecycle shell through `/claw/manage/v1/service` so browser management can inspect and control the local service using the same Rust control plane as the CLI.

**Architecture:** Keep service lifecycle logic in `src-host/src/service.rs`, and do not create a second HTTP-only implementation. Instead, add a reusable runtime contract to `ServerState`, add an injectable service-control-plane boundary for tests and future desktop embedding, and mount new manage routes that delegate to that boundary. Rollout routes remain unchanged except for router composition. OpenAPI and docs must describe the new manage surface.

**Tech Stack:** Rust (`axum`, `serde`, `serde_json`, `tokio`, existing `sdkwork-claw-server` crate), existing auth/error envelope helpers, existing service lifecycle planner/executor in `service.rs`, VitePress docs.

---

## File Structure

### Existing files to modify

- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `packages/sdkwork-claw-server/src-host/src/service.rs`
- `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- `docs/reference/claw-server-runtime.md`
- `docs/reference/environment.md`
- `docs/zh-CN/reference/claw-server-runtime.md`
- `docs/zh-CN/reference/environment.md`
- `scripts/check-server-platform-foundation.mjs`

### New files to create

- `packages/sdkwork-claw-server/src-host/src/http/routes/manage_service.rs`

### New or expanded tests

- `packages/sdkwork-claw-server/src-host/src/main.rs`

### Task 1: Add a reusable service control-plane boundary to server state

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/service.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests for injected service control**

Add tests that prove:

- `ServerState` can host a fake service controller for HTTP tests
- the fake controller sees the resolved config path and runtime contract
- the HTTP layer can read service state without calling the real platform manager

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_service
```

Expected: FAIL because the server state does not yet expose a reusable service controller boundary.

- [ ] **Step 3: Implement the minimal server runtime/service control boundary**

Add:

- a runtime contract snapshot in `ServerState`
- an injectable service control-plane handle around the existing lifecycle executor
- default OS-backed behavior for normal runtime use

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_service
```

Expected: PASS for the new boundary tests.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/service.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: add claw server service control boundary"
```

### Task 2: Add `/claw/manage/v1/service` routes

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_service.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing manage-route tests**

Add tests that verify:

- `GET /claw/manage/v1/service` returns structured service status
- `POST /claw/manage/v1/service:install` delegates to the service control plane
- `POST /claw/manage/v1/service:start`
- `POST /claw/manage/v1/service:stop`
- `POST /claw/manage/v1/service:restart`
- manage auth still applies

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_service_route
```

Expected: FAIL because the manage service routes do not exist yet.

- [ ] **Step 3: Implement the minimal manage service routes**

Add:

- `GET /claw/manage/v1/service`
- `POST /claw/manage/v1/service:install`
- `POST /claw/manage/v1/service:start`
- `POST /claw/manage/v1/service:stop`
- `POST /claw/manage/v1/service:restart`

Use existing manage auth helpers and shared error envelopes.

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_service_route
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_service.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: add claw server manage service routes"
```

### Task 3: Publish manage API and docs

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`
- Modify: `docs/zh-CN/reference/claw-server-runtime.md`
- Modify: `docs/zh-CN/reference/environment.md`
- Modify: `scripts/check-server-platform-foundation.mjs`

- [ ] **Step 1: Write the failing OpenAPI/doc checks**

Add assertions for:

- `/claw/manage/v1/service`
- `/claw/manage/v1/service:install`
- `/claw/manage/v1/service:start`
- `/claw/manage/v1/service:stop`
- `/claw/manage/v1/service:restart`

- [ ] **Step 2: Run the focused contract checks and verify they fail**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
```

Expected: FAIL because the new manage service API is not documented yet.

- [ ] **Step 3: Implement the minimal contract updates**

Update OpenAPI, runtime docs, and environment docs so the browser-manage service surface is documented as the native way to control the local server service.

- [ ] **Step 4: Re-run the contract checks and verify they pass**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs docs/reference/claw-server-runtime.md docs/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md docs/zh-CN/reference/environment.md scripts/check-server-platform-foundation.mjs
git commit -m "docs: publish claw server manage service api"
```

### Task 4: Verify the phase 3 slice

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Run the full verification set**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
pnpm check:server
pnpm docs:build
```

Expected: all pass.

- [ ] **Step 2: Manually exercise the route contract**

Run the server or call the route tests to confirm the browser-manage surface returns structured JSON and that it still uses the same Rust lifecycle logic.

- [ ] **Step 3: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/service.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_service.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs docs/reference/claw-server-runtime.md docs/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md docs/zh-CN/reference/environment.md scripts/check-server-platform-foundation.mjs docs/superpowers/plans/2026-04-04-claw-server-manage-service-api-phase3-implementation-plan.md
git commit -m "feat: add claw server manage service api"
```
