# Claw Server Node Session Close Phase 11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimal `POST /claw/internal/v1/node-sessions/{sessionId}:close` flow so admitted live node sessions can terminate gracefully and persist a closed runtime state.

**Architecture:** Keep the server host thin. The HTTP route should only parse the close action and delegate to host-core. Host-core should remain the authority for lease validation, state transition to `closed`, and persisted session freshness updates. This slice intentionally preserves closed records for diagnostics instead of deleting them or implementing replacement handoff semantics.

**Tech Stack:** Rust, axum, serde, host-core node-session registry, cargo test

---

### Task 1: Define the minimal Phase 11 close contract

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-close-phase11-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing host-core test**

Add a host-core test that performs `hello -> admit -> close` and expects:
- the close response returns `closed = true`
- the persisted session state becomes `closed`
- `lastSeenAt` is refreshed to the close timestamp

- [ ] **Step 2: Run the host-core test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_close_transitions_session_to_closed`
Expected: FAIL because the close contract and registry method do not exist yet.

- [ ] **Step 3: Add the minimal host-core close contract**

Implement:
- `NodeSessionCloseInput`
- `NodeSessionCloseResponse`
- a registry method that validates the active lease and persists `state = closed`

- [ ] **Step 4: Re-run the host-core test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_close_transitions_session_to_closed`
Expected: PASS

### Task 2: Expose the close route in the server host

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that performs:
- `POST /claw/internal/v1/node-sessions:hello`
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`
- `POST /claw/internal/v1/node-sessions/{sessionId}:close`

Expect:
- HTTP 200
- close response returns `closed = true`
- list response shows the live session in `state = closed`

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_close_transitions_live_session_to_closed`
Expected: FAIL because the route action is not wired yet.

- [ ] **Step 3: Implement the route**

Wire `close` into the existing node-session action handler and delegate persistence to the node-session registry.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_close_transitions_live_session_to_closed`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that server mode now supports graceful close for internal node sessions.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-close-phase11-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 11 slice files are touched.
