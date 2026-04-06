# Claw Server Node Session Lease Expiry Phase 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce lease expiry for live node-session runtime actions so expired sessions must restart from `:hello` instead of continuing with stale `heartbeat`, `pull-desired-state`, or `ack-desired-state` traffic.

**Architecture:** Keep lease validation centralized in host-core. The registry should distinguish invalid lease IDs from expired leases and reuse one helper across the runtime actions that depend on the session lease. The server host should only map the new error to the existing internal HTTP envelope shape.

**Tech Stack:** Rust, axum, serde, host-core node-session registry, cargo test

---

### Task 1: Define the lease-expiry behavior in host-core

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-lease-expiry-phase10-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing host-core test**

Add a host-core test that establishes an admitted session with an expired lease and verifies:
- `heartbeat`
- `pull-desired-state`
- `ack-desired-state`

all return a `LeaseExpired`-style registry error.

- [ ] **Step 2: Run the host-core test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_rejects_expired_lease_for_runtime_actions`
Expected: FAIL because runtime actions currently only compare `leaseId` and do not enforce expiry.

- [ ] **Step 3: Add the minimal host-core lease-expiry guard**

Implement:
- `LeaseExpired` in `NodeSessionRegistryError`
- one shared helper that checks lease id and expiry before runtime actions refresh the lease window

- [ ] **Step 4: Re-run the host-core test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_rejects_expired_lease_for_runtime_actions`
Expected: PASS

### Task 2: Expose the expired-lease error through the server host

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that seeds an expired admitted session and verifies `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat` returns `409 Conflict` with an expired-lease error message.

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_heartbeat_rejects_expired_lease`
Expected: FAIL because the server host does not currently expose a dedicated expired-lease error mapping.

- [ ] **Step 3: Implement the route error mapping**

Map `LeaseExpired` to a conflict response that clearly indicates the session must restart from `:hello`.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_heartbeat_rejects_expired_lease`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that lease-bound runtime actions now reject expired sessions and require a fresh `:hello`.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-lease-expiry-phase10-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 10 slice files are touched.
