# Unified Rust Host Deployment Bootstrap Hardening Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make docker, kubernetes, and desktop hosted bootstrap flows express the same shared Rust host runtime contract with explicit, runnable, and testable startup behavior.

**Architecture:** Stop relying on implicit bundle transforms and HTML-scraped bootstrap metadata for critical runtime paths. Deployment assets must either be runnable from source or explicitly rendered for bundle validation, and both container and desktop bootstrap paths must consume a structured runtime bootstrap contract.

**Tech Stack:** Rust server host, Tauri desktop host, container packaging scripts, Helm templates, Cargo tests, Node deployment contract tests

---

### Task 1: Make deployment template intent explicit between source and packaged bundle layouts

**Files:**
- Modify: `deploy/docker/README.md`
- Modify: `scripts/release-deployment-contract.test.mjs`
- Modify: `scripts/package-release-assets.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add assertions that the docs explicitly distinguish:
- source-tree template paths
- packaged bundle paths

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node scripts/release-deployment-contract.test.mjs`
Expected: FAIL until the docs and assertions distinguish source vs bundle semantics clearly

- [ ] **Step 3: Write minimal implementation**

Clarify the contract so reviewers and operators know exactly which paths are valid in source and which are only valid after container bundle packaging.

- [ ] **Step 4: Re-run verification**

Run: `node scripts/release-deployment-contract.test.mjs`
Expected: PASS

### Task 2: Add runtime-backed docker and singleton-k8s smoke validation

**Files:**
- Modify: `scripts/release-deployment-contract.test.mjs`
- Create: `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md`

- [ ] **Step 1: Write the failing contract additions**

Add smoke-level expectations for:
- packaged container image startup
- docker compose startup
- singleton-k8s readiness

- [ ] **Step 2: Run the checks to verify the gap**

Run: `node scripts/release-deployment-contract.test.mjs`
Expected: FAIL until the new runtime-backed smoke contract exists

- [ ] **Step 3: Write minimal implementation**

Add the smallest verification harness that proves runtime startup, readiness, and shared-host projection truth instead of only template shape.

- [ ] **Step 4: Re-run verification**

Run: `node scripts/release-deployment-contract.test.mjs`
Expected: PASS

### Task 3: Align docker image and kubernetes chart on truthful readiness

**Files:**
- Modify: `deploy/docker/Dockerfile`
- Modify: `deploy/kubernetes/templates/deployment.yaml`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/health.rs`

- [ ] **Step 1: Write the failing tests**

Add checks proving that:
- the image has a container-native health contract
- the chart uses `/claw/health/ready`
- `/ready` is runtime-aware

- [ ] **Step 2: Run the focused verification**

Run: `pnpm.cmd check:server`
Run: `node scripts/release-deployment-contract.test.mjs`
Expected: FAIL until the runtime and templates are aligned

- [ ] **Step 3: Write minimal implementation**

Make the image and chart consume the same truthful readiness contract.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:server`
Run: `node scripts/release-deployment-contract.test.mjs`
Expected: PASS

### Task 4: Replace desktop HTML-scraped browser-session bootstrap with a structured contract

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving desktop bootstrap can obtain the browser session/bootstrap contract from a structured source instead of scraping the root HTML.

- [ ] **Step 2: Run the focused verification**

Run: `pnpm.cmd check:desktop`
Expected: FAIL until bootstrap no longer depends on the HTML meta path

- [ ] **Step 3: Write minimal implementation**

Introduce a structured bootstrap descriptor or endpoint for desktop hosted startup and keep HTML metadata optional.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:desktop`
Expected: PASS

### Task 5: Codify the desktop hosted auth/bootstrap contract end to end

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/auth.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Write the failing tests**

Add explicit contract coverage for:
- shell delivery
- session acquisition
- authorized hosted API access
- restart/rebind safety

- [ ] **Step 2: Run the focused verification**

Run: `pnpm.cmd check:desktop`
Expected: FAIL until the contract is explicit and fully covered

- [ ] **Step 3: Write minimal implementation**

Express one clear desktop hosted bootstrap/auth contract and align all bridge helpers with it.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:desktop`
Expected: PASS
