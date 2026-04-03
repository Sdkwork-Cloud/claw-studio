# Claw Server Manage Error Envelope Phase 21 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate non-`2xx` `/claw/manage/v1/rollouts*` server responses from plain text to a machine-readable JSON error envelope so management APIs stop diverging from the native internal route family.

**Architecture:** Keep `sdkwork-claw-server` responsible for HTTP transport while reusing the existing host-core envelope shape instead of inventing a second JSON schema. Extract a small server-local error-response helper so internal and manage route families can share correlation-id stamping and envelope rendering without moving HTTP concerns into host-core.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add failing tests for manage route error envelopes

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-manage-error-envelope-phase21-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write failing server tests**

Add server integration tests that expect:
- `GET /claw/manage/v1/rollouts/{rolloutId}` missing-rollout failures return a JSON error envelope plus `x-claw-correlation-id`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview` invalid-body failures return a JSON error envelope
- the native OpenAPI document declares JSON error responses for migrated manage routes

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_missing_route_returns_error_envelope`
Expected: FAIL because manage routes still return plain text.

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_preview_invalid_body_returns_error_envelope`
Expected: FAIL because invalid preview bodies still return plain text.

### Task 2: Implement shared server error-envelope rendering and migrate manage routes

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/error_response.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`

- [ ] **Step 1: Add a shared server-local error-response helper**

Provide helper functions for:
- correlation id generation
- `x-claw-correlation-id` stamping
- rendering `InternalErrorEnvelope` as an Axum `Response`

- [ ] **Step 2: Migrate manage routes to JSON error responses**

Map current manage failures into explicit codes such as:
- `invalid_body`
- `invalid_request`
- `rollout_not_found`
- `preview_required`
- `rollout_blocked`
- `dependency_unavailable`
- `internal_failure`

- [ ] **Step 3: Reuse the shared helper from internal routes**

Replace duplicated internal-route error rendering with the shared helper without changing current internal semantics.

- [ ] **Step 4: Re-run focused server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_`
Expected: PASS for the migrated manage envelope tests and existing manage route tests.

### Task 3: Refresh publication/docs and verify the slice

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-rollout-api.md`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update manual OpenAPI publication**

Document that migrated manage-route failures now return `application/json` using the native error envelope schema.

- [ ] **Step 2: Update runtime and rollout references**

Document that manage rollout route failures are now machine-readable and correlated.

- [ ] **Step 3: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 4: Inspect the diff**

Run: `git status --short -- docs/reference/claw-rollout-api.md docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-manage-error-envelope-phase21-implementation-plan.md packages/sdkwork-claw-server/src-host/src/http/error_response.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: the Phase 21 slice stays constrained to manage/internal error transport, docs, and tests.
