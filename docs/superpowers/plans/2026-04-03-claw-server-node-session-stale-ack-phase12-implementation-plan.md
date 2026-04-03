# Claw Server Node Session Stale Ack Phase 12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish stale `ack-desired-state` requests from true desired-state conflicts so the internal runtime protocol can tell a late node acknowledgement from a malformed or mismatched target acknowledgement.

**Architecture:** Keep the server host thin and preserve host-core as the source of node-session protocol semantics. Host-core should classify stale acknowledgements when the node reports an older desired-state revision than the live session currently expects, while retaining the broader conflict branch for hash mismatches and future or malformed revisions. The server route should only surface the richer host-core error cleanly.

**Tech Stack:** Rust, axum, serde, host-core node-session registry, cargo test

---

### Task 1: Define stale-ack behavior in host-core

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-stale-ack-phase12-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing host-core test**

Add a host-core test that:
- creates a live session through `hello -> admit`
- pulls revision `N`
- advances the session target to revision `N+1`
- submits an `ack-desired-state` request for the older revision `N`

Expect:
- the registry rejects the request with a dedicated stale-ack error
- the session record keeps the newer desired-state target intact
- apply markers are not overwritten by the stale acknowledgement

- [ ] **Step 2: Run the host-core test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_ack_desired_state_rejects_stale_revision`
Expected: FAIL because stale acknowledgements currently collapse into the generic desired-state conflict branch.

- [ ] **Step 3: Implement the minimal host-core stale-ack classification**

Add:
- a dedicated stale-ack registry error variant
- classification logic that treats `input.desired_state_revision < current_revision` as stale
- unchanged persistence semantics for genuine conflicts and successful acknowledgements

- [ ] **Step 4: Re-run the host-core test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_ack_desired_state_rejects_stale_revision`
Expected: PASS

### Task 2: Expose stale-ack semantics through the server route

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that:
- creates a live session through `:hello` and `:admit`
- pulls the current desired state
- rebuilds the server state from the same data directory after advancing the rollout preview to a newer desired-state revision
- submits an `:ack-desired-state` request using the older pulled revision

Expect:
- HTTP `409 Conflict`
- the response body clearly indicates the acknowledgement is stale

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_ack_desired_state_rejects_stale_revision`
Expected: FAIL because the server still reports the older generic desired-state conflict message.

- [ ] **Step 3: Implement the route mapping**

Update the server node-session error mapper so the new stale-ack error returns a clear `409` response without changing the rest of the route flow.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_ack_desired_state_rejects_stale_revision`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that `ack-desired-state` now distinguishes stale acknowledgements from generic desired-state conflicts.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-stale-ack-phase12-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 12 slice files are touched.
