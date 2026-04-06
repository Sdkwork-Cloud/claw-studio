# Claw Server Node Session Runtime Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real internal node-session runtime slice for server mode so `/claw/internal/v1/node-sessions:hello` can create a session and `/claw/internal/v1/node-sessions` can surface live session state instead of relying only on rollout preview projections.

**Architecture:** Keep the slice narrow. Introduce a host-core node-session registry persisted under the server data directory, implement a minimal `:hello` control-plane handshake that creates a `pending` or `blocked` session with a lease proposal and compatibility preview, and merge live sessions with the existing rollout-derived read model so browser operational views stay useful before the full admit/heartbeat lifecycle lands.

**Tech Stack:** Rust, `axum`, serde JSON, existing host-core file-store helpers, existing rollout control plane, server route tests.

---

## Scope Check

This plan covers one vertical slice only:

- persistent node-session registry in host-core
- `POST /claw/internal/v1/node-sessions:hello`
- `GET /claw/internal/v1/node-sessions` returning live sessions over projection fallback

Explicitly deferred:

- `:admit`
- `:heartbeat`
- `:pull-desired-state`
- `:ack-desired-state`
- auth, mTLS, lease enforcement, and stale-session rejection
- public browser or SDK consumers for `:hello`

## File Structure

Target structure for the Phase 5 implementation:

- Planning:
  - Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-runtime-phase5-implementation-plan.md`
- Host-core runtime:
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Server runtime:
  - Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Documentation:
  - Modify: `docs/reference/claw-server-runtime.md`

### Task 1: Add Failing Runtime Tests

**Files:**

- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Add a failing host-core test for hello creating a live pending session**

```rust
let response = registry.hello(input, preview, 1234)?;
let sessions = registry.list_sessions()?;
assert_eq!(response.next_action, NodeSessionNextAction::CallAdmit);
assert_eq!(sessions[0].state, NodeSessionState::Pending);
```

- [ ] **Step 2: Add a failing server route test for POST hello followed by GET list**

```rust
let hello = app.clone().oneshot(Request::post("/claw/internal/v1/node-sessions:hello")...);
let list = app.oneshot(Request::get("/claw/internal/v1/node-sessions")...);
assert!(list_body.contains("\"state\":\"pending\""));
```

- [ ] **Step 3: Run focused Rust tests**

Run:

- `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry`
- `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_hello`

Expected: FAIL before implementation.

### Task 2: Implement Minimal Host-Core Session Registry

**Files:**

- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Add persisted session registry and minimal hello request/response contracts**

```rust
pub struct NodeSessionRegistry { ... }
pub struct NodeSessionHelloInput { ... }
pub struct NodeSessionHelloResponse { ... }
```

- [ ] **Step 2: Add rollout compatibility preview helper for hello**

```rust
pub fn preview_node_session_compatibility(...)
```

- [ ] **Step 3: Re-run focused host-core tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Expected: PASS.

### Task 3: Wire Server Hello And Live List Merge

**Files:**

- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Add the registry to server state and implement the hello route**

```rust
let response = state.node_session_registry.hello(request, preview, now)?;
```

- [ ] **Step 2: Merge live sessions over rollout projections for the list route**

```rust
let sessions = merge_node_sessions(projected, live);
```

- [ ] **Step 3: Re-run server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 4: Run workspace lint**

Run: `pnpm.cmd lint`

Expected: PASS.
