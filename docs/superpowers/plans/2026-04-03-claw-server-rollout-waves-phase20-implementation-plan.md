# Claw Server Rollout Waves Phase 20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /claw/manage/v1/rollouts/{rolloutId}/waves` so operators can inspect the current predicted rollout wave breakdown without reverse-engineering it from per-target preview rows.

**Architecture:** Keep the server shell thin and read-only. Add the wave summary read model to `sdkwork-claw-host-core` so rollout behavior remains owned by the shared control plane, then expose it through the existing server catch-all manage route. Do not introduce new persistence, mutation routes, or a separate wave engine in this slice.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add a failing test for the rollout wave list view

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-rollout-waves-phase20-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server test**

Add a server integration test that expects:
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves` returns grouped wave summary records
- grouped results preserve wave ordering and aggregate target counts from the preview-derived targets

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_waves`
Expected: FAIL because the wave list route does not exist yet.

### Task 2: Implement the rollout wave list route

**Files:**
- Modify: `packages/sdkwork-claw-host-core/src-host/src/domain/rollout.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`

- [ ] **Step 1: Add the shared wave list domain model**

Define a compact read-only response shape for:
- rollout id
- attempt
- total waves
- wave summary items

- [ ] **Step 2: Reuse the preview-backed target list inside host-core**

Implement:
- preview lookup with `includeTargets = true`
- grouping by `waveId`
- a deterministic fallback wave id for targets without `waveId`
- summary counters derived from `preflightOutcome`

- [ ] **Step 3: Add focused host-core coverage**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml rollout_control_plane_lists_rollout_waves`
Expected: PASS after the shared wave aggregation lands.

- [ ] **Step 4: Expose the new route through the existing catch-all dispatcher**

Expose:
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves`

- [ ] **Step 5: Re-run the focused route test**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_rollout_waves`
Expected: PASS

### Task 3: Refresh publication/docs and verify the slice

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-rollout-api.md`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update manual OpenAPI publication**

Document the rollout wave list route and its response schemas in the native published OpenAPI document.

- [ ] **Step 2: Update runtime and rollout references**

Document that server mode now supports read-only wave inspection under the rollout manage family.

- [ ] **Step 3: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 4: Inspect the diff**

Run: `git status --short -- docs/reference/claw-rollout-api.md docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-rollout-waves-phase20-implementation-plan.md packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: the Phase 20 slice stays constrained to the rollout waves files in `sdkwork-claw-server` and `sdkwork-claw-host-core`.
