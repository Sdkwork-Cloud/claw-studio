# Claw Server Rollout Target Item Phase 19 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` so operators and future browser read models can inspect one rollout target directly without fetching and filtering the full target list client-side.

**Architecture:** Reuse the same preview-derived target read model introduced in Phase 18. Keep the server shell thin by deriving the target item from the existing persisted preview path with `includeTargets = true`, then filtering by `nodeId`. Do not add mutation semantics, separate persistence, or wave-state synthesis in this slice.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add a failing test for the rollout target item view

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-rollout-target-item-phase19-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server test**

Add a server integration test that expects:
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` returns the requested target preview record

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_target`
Expected: FAIL because the target item route does not exist yet.

### Task 2: Implement the target item route

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`

- [ ] **Step 1: Add the item route**

Expose:
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}`

- [ ] **Step 2: Reuse the existing preview-backed target list**

Implement:
- preview lookup with `includeTargets = true`
- one target lookup filtered by `nodeId`

- [ ] **Step 3: Re-run the focused route test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_target`
Expected: PASS

### Task 3: Refresh publication/docs and verify the slice

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-rollout-api.md`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update manual OpenAPI publication**

Document the rollout target item route in the native published OpenAPI document.

- [ ] **Step 2: Update runtime and rollout references**

Document that server mode now supports direct item reads for rollout targets.

- [ ] **Step 3: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 4: Inspect the diff**

Run: `git status --short -- docs/reference/claw-rollout-api.md docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-rollout-target-item-phase19-implementation-plan.md packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: the Phase 19 slice stays constrained to the rollout target item files.
