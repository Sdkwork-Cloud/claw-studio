# Claw Server OpenAPI Phase 15 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a machine-discoverable `/claw/openapi/*` surface for the currently implemented native server APIs so operators and future SDK/tooling can discover the active contract without adding new product-domain APIs first.

**Architecture:** Keep the server host thin and constrain this slice to HTTP publication only. Add a dedicated `/claw/openapi` route family that exposes a discovery index and one OpenAPI JSON document for the already-shipped `/claw/health/*`, `/claw/internal/v1/*`, and `/claw/manage/v1/*` routes. Do not refactor current handler behavior or force the shared internal error-envelope migration into this slice; the document should truthfully describe current success and error bodies.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add failing tests for OpenAPI discovery and document publication

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-openapi-phase15-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server tests**

Add server integration tests that expect:
- `GET /claw/openapi/discovery` returns JSON discovery metadata with a `v1` native document entry
- `GET /claw/openapi/v1.json` returns an OpenAPI document that includes the currently implemented health, internal, and manage paths

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi`
Expected: FAIL because the `/claw/openapi/*` route family does not exist yet.

### Task 2: Implement the `/claw/openapi/*` route family

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`

- [ ] **Step 1: Add the route family**

Expose:
- `GET /claw/openapi/discovery`
- `GET /claw/openapi/v1.json`

- [ ] **Step 2: Publish truthful discovery and document bodies**

Implement:
- a discovery payload that announces the native `v1` document and the covered route families
- an OpenAPI JSON document that describes current health, internal node-session, and manage rollout endpoints with the real path shapes and current response media types

- [ ] **Step 3: Re-run the focused OpenAPI tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that server mode now publishes native API discovery and an OpenAPI JSON document under `/claw/openapi/*`.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-openapi-phase15-implementation-plan.md packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 15 slice files are touched.
