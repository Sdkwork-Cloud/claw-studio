# Claw Server Node Session Replaced Session Phase 14 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically mark older same-node sessions as replaced when a newer session is admitted, and stop lease-bound runtime actions from the replaced session from remaining authoritative.

**Architecture:** Keep host-core responsible for replacement lifecycle rules. Admission should detect earlier live sessions for the same `nodeId`, mark them as `replaced`, and link them to the new session as successor metadata. Lease-bound runtime actions should reject replaced sessions centrally from the shared lease-validation path. The server host should remain thin and only surface the richer replacement error.

**Tech Stack:** Rust, axum, serde, host-core node-session registry, cargo test

---

### Task 1: Add replaced-session lifecycle rules in host-core

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-replaced-session-phase14-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing host-core tests**

Add host-core coverage that:
- admits two sessions for the same `nodeId`
- expects the older session to transition to `replaced` and record the successor session id
- attempts a lease-bound runtime action on the replaced session and expects a dedicated replacement error

- [ ] **Step 2: Run the host-core tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_admit_replaces_older_same_node_session`
Expected: FAIL because older sessions currently remain admitted.

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_rejects_runtime_actions_for_replaced_session`
Expected: FAIL because lease validation does not yet classify replaced sessions.

- [ ] **Step 3: Implement the minimal replacement lifecycle**

Add:
- a `replaced` node-session state
- admit-time transition of older same-node sessions to `replaced`
- successor metadata propagation onto the replaced session row
- shared lease validation that rejects runtime actions from replaced sessions

- [ ] **Step 4: Re-run the host-core tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_admit_replaces_older_same_node_session node_session_registry_rejects_runtime_actions_for_replaced_session`
Expected: PASS

### Task 2: Surface replacement lifecycle through the server routes

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that:
- creates two sessions for the same `nodeId`
- admits the successor session
- calls a lease-bound runtime action on the replaced session

Expect:
- HTTP `409 Conflict`
- the response body clearly indicates the session was replaced
- `GET /claw/internal/v1/node-sessions` continues to show the successor session as authoritative

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_heartbeat_rejects_replaced_session`
Expected: FAIL because the route still treats the older session as active.

- [ ] **Step 3: Implement the route mapping**

Update the server node-session error mapper so replaced-session errors return a clear `409` response while the list route continues to surface the successor session.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_heartbeat_rejects_replaced_session`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that admitting a newer same-node session replaces older runtime sessions and blocks further lease-bound actions from the replaced session.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-replaced-session-phase14-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 14 slice files are touched.
