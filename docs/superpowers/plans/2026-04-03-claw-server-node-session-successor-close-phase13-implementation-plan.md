# Claw Server Node Session Successor Close Phase 13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add minimal successor-aware close semantics so a closed session can point at its replacement and server list views continue to surface the replacement session for the same node.

**Architecture:** Keep host-core responsible for persisting close metadata and exposing successor hints on session records. Keep the server host thin by limiting it to successor-aware session selection in the merged live-session view. This slice does not introduce full replaced-session state transitions or successor validation orchestration; it only preserves operator-visible correctness when an old session hands off to a known replacement.

**Tech Stack:** Rust, axum, serde, host-core node-session registry, cargo test

---

### Task 1: Persist successor hints in host-core close handling

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-successor-close-phase13-implementation-plan.md`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing host-core test**

Add a host-core test that:
- creates two admitted sessions for the same `nodeId`
- closes the older session with `successorHint = <newer session id>`

Expect:
- the close response returns `replacementExpected = true`
- the closed session record persists `successorSessionId`
- the successor session remains admitted

- [ ] **Step 2: Run the host-core test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_close_records_successor_hint`
Expected: FAIL because live session records do not yet persist successor metadata.

- [ ] **Step 3: Implement the minimal host-core successor persistence**

Add:
- optional successor metadata on live session records
- close handling that stores `successorHint` on the closed session row

- [ ] **Step 4: Re-run the host-core test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml node_session_registry_close_records_successor_hint`
Expected: PASS

### Task 2: Keep merged node-session lists authoritative on the successor

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server route test**

Add a server integration test that:
- creates and admits two sessions for the same `nodeId`
- closes the older one with `successorHint` pointing to the newer session
- fetches `GET /claw/internal/v1/node-sessions`

Expect:
- the list view still returns the successor session for that node
- the returned row remains `state = admitted`

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_close_with_successor_keeps_successor_visible`
Expected: FAIL because merged live-session selection currently falls back to `lastSeenAt` and can let the closed session shadow its successor.

- [ ] **Step 3: Implement successor-preferred selection**

Update the merged live-session selection so a session referenced by another same-node session's `successorSessionId` remains authoritative for operational lists.

- [ ] **Step 4: Re-run the server test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_close_with_successor_keeps_successor_visible`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that close operations can preserve a successor hint and keep the successor visible in node-session operational lists.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-node-session-successor-close-phase13-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 13 slice files are touched.
