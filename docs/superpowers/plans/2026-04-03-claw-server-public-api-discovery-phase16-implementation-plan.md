# Claw Server Public API Discovery Phase 16 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the first native `/claw/api/v1/*` route family by publishing a minimal read-only discovery endpoint that external SDKs, browser bootstrap logic, and future product APIs can build on without prematurely exposing management or compatibility internals.

**Architecture:** Keep the slice narrow and honest. Add one dedicated `/claw/api/v1/discovery` route family in the server shell that reports the active public API base path, current host mode/version, and the native discovery links already available from the server. Do not introduce compatibility gateway aliases, auth, shared error-envelope refactors, or management-resource leakage into this slice. Extend the existing manual OpenAPI document so `/claw/openapi/*` truthfully publishes the new public endpoint.

**Tech Stack:** Rust, axum, serde, serde_json, cargo test

---

### Task 1: Add failing tests for the public API discovery slice

**Files:**
- Create: `docs/superpowers/plans/2026-04-03-claw-server-public-api-discovery-phase16-implementation-plan.md`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing server tests**

Add server integration tests that expect:
- `GET /claw/api/v1/discovery` returns JSON discovery metadata for the public native API family
- `GET /claw/openapi/discovery` lists `api` in the covered route families
- `GET /claw/openapi/v1.json` includes `/claw/api/v1/discovery`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml discovery`
Expected: FAIL because the `/claw/api/v1/*` route family is not mounted yet.

### Task 2: Implement the `/claw/api/v1/discovery` route family

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`

- [ ] **Step 1: Add the route family**

Expose:
- `GET /claw/api/v1/discovery`

- [ ] **Step 2: Return a minimal truthful discovery payload**

Implement a response that includes:
- public API family metadata
- the `/claw/api/v1` base path
- current server host mode and version
- links to native OpenAPI and health surfaces
- only currently implemented public capabilities

- [ ] **Step 3: Extend manual OpenAPI publication**

Update:
- `/claw/openapi/discovery` so the native document advertises the `api` family
- `/claw/openapi/v1.json` so the new public route and schema appear in the published document

- [ ] **Step 4: Re-run the focused discovery tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml discovery`
Expected: PASS

### Task 3: Refresh docs and verify the slice

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Update runtime reference**

Document that server mode now mounts the first native public API route family under `/claw/api/v1/*`, currently limited to discovery/bootstrap metadata.

- [ ] **Step 2: Run package verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Expected: PASS

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff -- docs/reference/claw-server-runtime.md docs/superpowers/plans/2026-04-03-claw-server-public-api-discovery-phase16-implementation-plan.md packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs`
Expected: only the Phase 16 slice files are touched.
