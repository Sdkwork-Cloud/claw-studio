# Claw Server Node Session Ack Desired State Phase 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimal `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state` flow so admitted live node sessions can report desired-state apply results and persist last-applied plus last-known-good markers.

**Architecture:** Keep the server host thin. The HTTP layer should only parse the ack action and delegate to host-core. Host-core should remain the authority for lease validation, desired-state revision and hash conflict checks, session persistence, and management-posture responses, while rollout control-plane integration stays out of the ack path for this slice.

**Tech Stack:** Rust, axum, serde, host-core node-session registry, cargo test

---

### Task 1: Define the minimal Phase 9 ack contract

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-ack-desired-state-phase9-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing host-core tests**

Add host-core tests that verify:
- `hello -> admit -> pull-desired-state -> ack-desired-state` records `lastAppliedRevision`, `lastAppliedHash`, `lastKnownGoodRevision`, `lastKnownGoodHash`, and `lastApplyResult`
- acking a revision or hash that does not match the current session desired state fails with a conflict-style registry error

- [ ] **Step 2: Run the host-core tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_ack_desired_state_records_apply_markers`
Expected: FAIL because the ack contract and registry method do not exist yet.

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_ack_desired_state_rejects_conflicting_revision`
Expected: FAIL because the ack contract and conflict guard do not exist yet.

- [ ] **Step 3: Add the minimal host-core ack contract**

Implement:
- `NodeSessionAckDesiredStateInput`
- `NodeSessionAckDesiredStateResponse`
- `NodeSessionDesiredStateAckResult`
- minimal `applySummary`
- persistence of last-applied and last-known-good markers on live session records
- a conflict error when acked revision/hash does not match the current desired state bound to the session

- [ ] **Step 4: Re-run the host-core tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_ack_desired_state_records_apply_markers`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_ack_desired_state_rejects_conflicting_revision`
Expected: PASS

### Task 2: Expose the ack route in the server host

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that performs:
- `POST /claw/internal/v1/node-sessions:hello`
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`
- `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state`
- `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state`

Expect:
- HTTP 200
- ack response returns `recorded = true`
- list response shows persisted `lastAppliedRevision`, `lastKnownGoodRevision`, and `lastApplyResult`

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_ack_desired_state_records_apply_markers`
Expected: FAIL because the route action is not wired yet.

- [ ] **Step 3: Implement the route**

Wire `ack-desired-state` into the existing action handler and delegate persistence to the node-session registry.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_ack_desired_state_records_apply_markers`
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
- `ack-desired-state`

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-ack-desired-state-phase9-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 9 slice files are touched.
