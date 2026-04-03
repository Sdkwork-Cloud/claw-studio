# Claw Server Rollout Read Views Phase 18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first read-only rollout item and target inspection views under `/claw/manage/v1/*` so operators and the browser shell can inspect one rollout and its current per-target preflight/projection state without relying only on the list and `:preview` action.

**Architecture:** Keep the server host thin. Reuse the existing host-core rollout list and preview primitives instead of introducing a second rollout persistence or read-model stack. The server shell should expose `GET /claw/manage/v1/rollouts/{rolloutId}` and `GET /claw/manage/v1/rollouts/{rolloutId}/targets`, with the target view derived from the current persisted preview semantics. Do not add mutation routes, wave resources, or shared native error-envelope refactors in this slice.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add failing tests for rollout read-only manage views

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-rollout-read-views-phase18-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server tests**

Add server integration tests that expect:
- `GET /claw/manage/v1/rollouts/{rolloutId}` returns the requested rollout record
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets` returns per-target preview state for the rollout

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_`
Expected: FAIL because the read-only item and target routes do not exist yet.

### Task 2: Implement the rollout item and target routes

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`

- [ ] **Step 1: Add the item and target read routes**

Expose:
- `GET /claw/manage/v1/rollouts/{rolloutId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets`

- [ ] **Step 2: Reuse existing host-core data**

Implement:
- rollout item lookup from the current list surface
- target list lookup from the current preview surface with `includeTargets = true`

- [ ] **Step 3: Re-run the focused manage tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_`
Expected: PASS

### Task 3: Refresh publication/docs and verify the slice

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/claw-rollout-api.md`

- [ ] **Step 1: Update manual OpenAPI publication**

Document the rollout item and rollout target read routes in the native published OpenAPI document.

- [ ] **Step 2: Update runtime and rollout references**

Document that server mode now supports rollout item inspection and per-target target lists.

- [ ] **Step 3: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 4: Inspect the diff**

Run: `git status --short -- docs/reference/claw-rollout-api.md docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-rollout-read-views-phase18-implementation-plan.md packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: the Phase 18 slice stays constrained to rollout read-view files.
