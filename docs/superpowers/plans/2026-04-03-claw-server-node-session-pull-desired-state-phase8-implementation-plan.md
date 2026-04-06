# Claw Server Node Session Pull Desired State Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimal `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state` flow so admitted live node sessions can fetch the current desired-state projection or receive a `notModified` result.

**Architecture:** Keep the server host thin. The server route should only parse the HTTP action and delegate to host-core. Host-core should reuse the existing rollout preview plus projection compiler state to resolve the node-targeted desired state, while the node-session registry remains responsible for lease validation, mode selection, and persisted session freshness updates.

**Tech Stack:** Rust, axum, serde, host-core rollout control plane, host-core node-session registry, cargo test

---

### Task 1: Define the minimal Phase 8 contract

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-pull-desired-state-phase8-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/projection/compiler.rs`

- [ ] **Step 1: Write the failing host-core test**

Add a host-core test that performs `hello -> admit -> pull-desired-state` and expects:
- first pull returns `mode = projection` with revision, hash, projection payload, and `applyPolicy`
- second pull with the same `knownRevision` and `knownHash` returns `mode = notModified`

- [ ] **Step 2: Run the host-core test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_pull_desired_state_returns_projection_then_not_modified`
Expected: FAIL because the pull contract and registry method do not exist yet.

- [ ] **Step 3: Add the minimal host-core contract**

Implement:
- `NodeSessionPullDesiredStateInput`
- `NodeSessionPullDesiredStateResponse`
- a minimal `applyPolicy`
- a registry method that validates `leaseId`, compares known revision/hash, and returns either `notModified` or the current projection

- [ ] **Step 4: Add rollout projection lookup**

Expose one control-plane helper that resolves the current node-targeted projection plus required capabilities for a rollout-targeted node without inventing a second projection model.

- [ ] **Step 5: Re-run the host-core test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_pull_desired_state_returns_projection_then_not_modified`
Expected: PASS

### Task 2: Expose the pull route in the server host

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that performs:
- `POST /claw/internal/v1/node-sessions:hello`
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`
- `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state`

Expect:
- HTTP 200
- first response returns `mode = projection`
- second response with matching revision/hash returns `mode = notModified`

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_pull_desired_state_returns_projection_then_not_modified`
Expected: FAIL because the route action is not wired yet.

- [ ] **Step 3: Implement the route**

Wire `pull-desired-state` into the existing action handler, delegate lookup to the rollout control plane, and pass the resolved projection into the node-session registry.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_pull_desired_state_returns_projection_then_not_modified`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that server mode now supports:
- `hello`
- `admit`
- `heartbeat`
- `pull-desired-state`

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- packages/sdkwork-claw-host-core packages/sdkwork-claw-server docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-pull-desired-state-phase8-implementation-plan.md`
Expected: only the Phase 8 slice files are touched.
