# OpenClaw Desktop Package Auto Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make desktop release packaging automatically run installer smoke and persist a machine-readable smoke report so release finalization can refuse desktop artifacts that were never smoked.

**Architecture:** Keep `smoke-desktop-installers.mjs` as the canonical smoke engine, add report serialization beside each desktop partial manifest, invoke smoke automatically after `package desktop`, and make `finalize-release-assets.mjs` require a matching smoke report for desktop families before emitting the final release manifest.

**Tech Stack:** Node.js release scripts, Node test runner, desktop release asset manifests under `artifacts/release`, existing OpenClaw release-asset verifier, existing `hub-installer` dry-run planner.

---

### Task 1: Lock Auto Smoke Packaging Behavior In Tests

**Files:**
- Modify: `scripts/release/local-release-command.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that:
- `package:desktop` dispatches desktop asset packaging first
- the same command then runs installer smoke for the packaged target
- the smoke step receives the same `releaseAssetsDir`, `platform`, `arch`, and `target`

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
- `node scripts/release/local-release-command.test.mjs`

Expected:
- failure because desktop packaging does not automatically run installer smoke yet

### Task 2: Lock Smoke Report Persistence In Tests

**Files:**
- Modify: `scripts/release/smoke-desktop-installers.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that the smoke helper:
- writes `installer-smoke-report.json` beside the desktop partial manifest
- records the target platform, architecture, manifest path, and installable artifact relative paths
- can be re-read later to prove which artifact set was smoked

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
- `node scripts/release/smoke-desktop-installers.test.mjs`

Expected:
- failure because the helper does not persist a smoke report yet

### Task 3: Lock Finalize Gating In Tests

**Files:**
- Modify: `scripts/release/finalize-release-assets.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that:
- finalizing release assets with desktop partial manifests fails when the matching smoke report is missing
- finalization succeeds when the smoke report exists and matches the installable artifact set

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
- `node scripts/release/finalize-release-assets.test.mjs`

Expected:
- failure because finalization currently does not gate on desktop smoke evidence

### Task 4: Implement The Auto Smoke Report Loop

**Files:**
- Modify: `scripts/release/smoke-desktop-installers.mjs`
- Modify: `scripts/release/local-release-command.mjs`
- Modify: `scripts/release/finalize-release-assets.mjs`

- [ ] **Step 1: Add smoke report helpers**

Implement helpers to:
- derive the smoke report path from `releaseAssetsDir`, `platform`, and `arch`
- serialize a stable report payload with installable artifact relative paths
- write the report after smoke passes

- [ ] **Step 2: Auto-run smoke after desktop packaging**

Update `local-release-command.mjs` so `package:desktop`:
- packages the desktop assets
- immediately runs `smokeDesktopInstallers(...)`
- leaves the smoke report in the packaged desktop output directory

- [ ] **Step 3: Gate release finalization on smoke evidence**

Update `finalize-release-assets.mjs` so it:
- requires `installer-smoke-report.json` for every desktop partial manifest
- verifies the report platform/arch matches
- verifies the smoked artifact set still matches the current desktop installable artifact set

- [ ] **Step 4: Run targeted tests to verify they pass**

Run:
- `node scripts/release/local-release-command.test.mjs`
- `node scripts/release/smoke-desktop-installers.test.mjs`
- `node scripts/release/finalize-release-assets.test.mjs`

Expected:
- all pass

### Task 5: Verify The Release Closure And Update The Audit

**Files:**
- Modify: `docs/reports/2026-04-04-openclaw-installer-and-runtime-report.md`

- [ ] **Step 1: Run focused verification**

Run:
- `node scripts/release/local-release-command.test.mjs`
- `node scripts/release/smoke-desktop-installers.test.mjs`
- `node scripts/release/finalize-release-assets.test.mjs`
- `pnpm.cmd check:release-flow`

Expected:
- all pass

- [ ] **Step 2: Update the report**

Document:
- that desktop packaging now emits persistent smoke evidence
- that release finalization now refuses unsmoked desktop artifacts
- the remaining gap after this round, which is real installer execution rather than optional smoke invocation
