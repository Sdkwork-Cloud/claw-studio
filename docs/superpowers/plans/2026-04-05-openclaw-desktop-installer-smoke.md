# OpenClaw Desktop Installer Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a packaged desktop installer smoke layer that proves the emitted Windows, Linux, and macOS installers are structurally installable and that the bundled OpenClaw payload is already staged correctly before first launch.

**Architecture:** Reuse the existing desktop release asset manifest as the source of truth, add one release smoke script that first runs the OpenClaw asset verifier and then dry-runs `hub-installer` install planning against each installable desktop artifact, and expose the smoke flow through the local release command surface plus root package scripts.

**Tech Stack:** Node.js release scripts, Node test runner, packaged release manifests under `artifacts/release`, vendored `hub-installer` Node library, existing OpenClaw release asset verifier.

---

### Task 1: Lock Smoke Command Routing In Tests

**Files:**
- Modify: `scripts/release/local-release-command.test.mjs`
- Modify: `scripts/release-flow-contract.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that:
- `node scripts/release/local-release-command.mjs smoke desktop` parses to a new `smoke:desktop` mode
- `runLocalReleaseCommand(...)` dispatches to a dedicated desktop smoke function
- root release-flow contracts require the new smoke script entrypoint

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:
- `node scripts/release/local-release-command.test.mjs`
- `node scripts/release-flow-contract.test.mjs`

Expected:
- command helper test fails because `smoke desktop` is unsupported
- release-flow contract fails because the root scripts do not reference the new smoke layer yet

### Task 2: Lock Desktop Installer Smoke Rules In Tests

**Files:**
- Create: `scripts/release/smoke-desktop-installers.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that the smoke helper:
- reads `artifacts/release/desktop/<platform>/<arch>/release-asset-manifest.json`
- invokes the OpenClaw release asset verifier before installer planning
- creates dry-run install plans for installable artifacts using `hub-installer`
- requires Windows installers (`.exe` or `.msi`), Linux installables (`.deb`, `.rpm`, or `.appimage`), and macOS `.dmg`
- requires macOS app archive presence (`.app.zip` or `.app.tar.gz`) even if only the `.dmg` is planned
- reports clear errors when installable artifacts are missing or the manifest is malformed

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
- `node scripts/release/smoke-desktop-installers.test.mjs`

Expected:
- failure because the smoke helper does not exist yet

### Task 3: Implement The Desktop Installer Smoke Helper

**Files:**
- Create: `scripts/release/smoke-desktop-installers.mjs`

- [ ] **Step 1: Add manifest loading and artifact selection helpers**

Implement helpers to:
- resolve desktop manifest paths from `releaseAssetsDir`, `platform`, and `arch`
- read and validate the partial release asset manifest schema
- classify installable desktop artifacts by platform
- enforce the additional macOS app archive requirement

- [ ] **Step 2: Add installer smoke execution**

Implement a `smokeDesktopInstallers(...)` function that:
- calls `verifyDesktopOpenClawReleaseAssets(...)` first
- imports `createInstallPlan` and `detectFormat` from the vendored `hub-installer` build
- builds dry-run install plans for each installable artifact with the correct platform mapping
- returns structured smoke results for downstream command helpers and tests

- [ ] **Step 3: Add CLI entrypoint**

Add a top-level CLI that:
- resolves the local desktop target context
- runs the smoke helper
- prints a compact success line
- exits non-zero with a clear error message on failure

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:
- `node scripts/release/smoke-desktop-installers.test.mjs`

Expected:
- pass with dry-run planner coverage for Windows, Linux, and macOS cases

### Task 4: Wire The Smoke Flow Into Release Commands

**Files:**
- Modify: `scripts/release/local-release-command.mjs`
- Modify: `package.json`

- [ ] **Step 1: Extend local release command parsing and dispatch**

Update the helper so it:
- resolves `smoke desktop` to `smoke:desktop`
- reuses desktop target context resolution
- dispatches into `smokeDesktopInstallers(...)`

- [ ] **Step 2: Expose root script entrypoints**

Update root scripts so:
- `release:smoke:desktop` runs the new smoke helper through `local-release-command.mjs`
- `check:release-flow` includes `node scripts/release/smoke-desktop-installers.test.mjs`

- [ ] **Step 3: Run targeted tests to verify they pass**

Run:
- `node scripts/release/local-release-command.test.mjs`
- `node scripts/release-flow-contract.test.mjs`

Expected:
- both pass with the new smoke command surface

### Task 5: Verify The Release Smoke Slice And Update The Report

**Files:**
- Modify: `docs/reports/2026-04-04-openclaw-installer-and-runtime-report.md`

- [ ] **Step 1: Run focused verification**

Run:
- `node scripts/release/smoke-desktop-installers.test.mjs`
- `node scripts/release/local-release-command.test.mjs`
- `node scripts/release-flow-contract.test.mjs`
- `pnpm.cmd check:release-flow`

Expected:
- all pass

- [ ] **Step 2: Update the report**

Document:
- why this final smoke layer was still missing after installer prewarm and runtime fast-path work
- how packaged desktop artifacts are now validated per platform
- remaining gaps, especially real bundle execution on CI runners and signed-installer smoke coverage
