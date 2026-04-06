# Claw Server State Store Profile Projection Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the server host-platform `stateStore` projection so operators can see planned PostgreSQL configuration shape and redacted configuration readiness without enabling the PostgreSQL runtime driver yet.

**Architecture:** Keep runtime driver activation unchanged: `json-file` and `sqlite` remain the only supported server storage drivers. Extend the bootstrap snapshot with additive provider/profile metadata that exposes required configuration keys and currently configured keys for planned PostgreSQL profiles, then publish the same shape through the internal host-platform API and OpenAPI schema.

**Tech Stack:** Rust, Axum, Serde, existing server bootstrap and OpenAPI route assembly, workspace markdown docs.

---

### Task 1: Add failing tests for richer state-store profile projection

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing tests**

Add focused tests that expect:
- `/claw/internal/v1/host-platform` returns `stateStore.providers[*].configurationKeys`
- the planned PostgreSQL profile returns `configuredKeys`
- explicit PostgreSQL config overrides mark the planned profile as configured without changing the active driver
- `/claw/openapi/v1.json` publishes the new `configurationKeys` and `configuredKeys` schema fields

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml state_store_profile -- --nocapture`
Expected: FAIL because the richer projection fields do not exist yet.

### Task 2: Implement additive bootstrap and schema projection

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`

- [ ] **Step 1: Implement the minimal bootstrap projection changes**

Add:
- optional PostgreSQL configuration overrides for projection-only metadata
- additive `configuration_keys` on provider records
- additive `configured_keys` on profile records
- redacted PostgreSQL config readiness derived from explicit overrides or environment values

- [ ] **Step 2: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml state_store_profile -- --nocapture`
Expected: PASS with the active driver unchanged and the planned PostgreSQL profile exposed as metadata only.

### Task 3: Update docs and examples

**Files:**
- Modify: `packages/sdkwork-claw-server/.env.example`
- Modify: `docs/reference/environment.md`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/claw-rollout-api.md`

- [ ] **Step 1: Document the new projection and planned PostgreSQL config keys**

Document:
- the new `stateStore` metadata shape
- planned PostgreSQL configuration keys and their current non-runtime status
- the fact that `CLAW_SERVER_STATE_STORE_DRIVER` still only accepts `json-file` and `sqlite`

- [ ] **Step 2: Run final verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Run: `pnpm check:server`
Expected: PASS, with no new test warnings introduced by this slice.
