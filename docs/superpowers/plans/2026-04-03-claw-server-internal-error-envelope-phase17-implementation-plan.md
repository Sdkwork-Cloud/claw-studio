# Claw Server Internal Error Envelope Phase 17 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the current `/claw/internal/v1/node-sessions*` non-2xx responses from plain text into one machine-readable JSON error envelope so runtime nodes can make explicit restart, refresh, and retry decisions.

**Architecture:** Keep the migration narrow and incremental. Reuse the existing host-core internal error concepts, but apply them only to the internal node-session route family in the server shell for now. Do not refactor `/claw/manage/v1/*`, `/claw/api/v1/*`, or compatibility gateway errors in this slice. Update the manual OpenAPI publication so internal non-2xx responses become truthful JSON envelope descriptions.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add failing tests for representative internal error envelopes

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-internal-error-envelope-phase17-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server tests**

Add server integration tests that expect:
- invalid internal node-session request bodies return JSON `error` envelopes instead of plain text
- replaced or expired runtime session failures return machine-readable internal `error.code` and `error.resolution`
- stale desired-state acknowledgements return a JSON state-conflict envelope

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_`
Expected: FAIL because the internal route family still returns plain-text non-2xx responses.

### Task 2: Implement JSON envelope mapping for internal node-session failures

**Files:**
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/error.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`

- [ ] **Step 1: Make the shared internal error model serializable and route-safe**

Add the fields and enum serialization needed for JSON HTTP responses while keeping the host-core type reusable by future combined-mode or node-shell work.

- [ ] **Step 2: Map validation and node-session runtime failures**

Cover at least:
- invalid JSON body
- session not found
- invalid hello/lease assumptions
- expired or replaced sessions
- stale acknowledgements and desired-state conflicts
- internal store failures

- [ ] **Step 3: Emit consistent headers and body shape**

Return:
- `application/json`
- `x-claw-correlation-id`
- an `error` envelope whose `httpStatus` matches the HTTP status code

- [ ] **Step 4: Re-run the focused internal route tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_node_sessions_`
Expected: PASS

### Task 3: Refresh OpenAPI/docs and verify the slice

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update manual OpenAPI publication**

Document internal non-2xx responses as JSON error envelopes for the migrated node-session routes.

- [ ] **Step 2: Update runtime reference**

Document that `/claw/internal/v1/node-sessions*` now returns machine-readable JSON envelopes for non-2xx outcomes.

- [ ] **Step 3: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 4: Inspect the diff**

Run: `git status --short -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-internal-error-envelope-phase17-implementation-plan.md packages/sdkwork-claw-host-core/src-host/src/internal/error.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: the Phase 17 slice stays constrained to the internal error-envelope path.
