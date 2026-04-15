# OpenClaw External Node Hard-Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cut OpenClaw desktop runtime packaging and activation away from bundled Node.js so packaged assets ship only OpenClaw code/runtime payloads and runtime launch resolves external Node.js.

**Architecture:** Keep the approved multi-kernel platform and package-profile foundation intact, but replace the OpenClaw bundled-Node contract with one external-runtime contract shared by runtime manifests, Rust activation logic, and desktop release verification. Preserve the current OpenClaw detail UX and keep scope limited to OpenClaw runtime packaging, launch, and installer verification so Hermes and detail-module registration are not destabilized in the same slice.

**Tech Stack:** Node.js ESM scripts, `node:test`, Rust/Tauri desktop host, existing OpenClaw runtime preparation and release verification helpers

---

### Task 1: Define The OpenClaw External Runtime Manifest Contract

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.mjs`
- Modify: `scripts/verify-desktop-openclaw-release-assets.mjs`
- Modify: `scripts/prepare-openclaw-runtime.test.mjs`
- Modify: `scripts/verify-desktop-openclaw-release-assets.test.mjs`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the script tests to verify the old bundled-Node contract fails**
- [ ] **Step 3: Replace `nodeVersion` / `nodeRelativePath` manifest assumptions with an external Node runtime requirement contract while preserving `cliRelativePath`**
- [ ] **Step 4: Update runtime sidecar integrity and release verifiers to require no packaged Node binary**
- [ ] **Step 5: Re-run the focused script tests until green**

### Task 2: Hard-Cut Rust OpenClaw Activation To External Node Resolution

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write failing Rust tests for runtime activation when only external Node is present and bundled Node is absent**
- [ ] **Step 2: Run the targeted Rust tests to verify the current implementation fails for the right reason**
- [ ] **Step 3: Add one runtime-resolution path that resolves external Node from explicit override and `PATH`, validates the requirement, and keeps OpenClaw code asset activation unchanged**
- [ ] **Step 4: Switch CLI launch and gateway launch paths to use the resolved external Node contract**
- [ ] **Step 5: Re-run the targeted Rust tests until green**

### Task 3: Align Desktop Installer And Packaged-Asset Contracts

**Files:**
- Modify: `scripts/release/desktop-openclaw-installer-contract.mjs`
- Modify: `scripts/release/smoke-desktop-installers.test.mjs`
- Modify: `scripts/release/finalize-release-assets.test.mjs`
- Modify: `scripts/verify-desktop-openclaw-release-assets.test.mjs`

- [ ] **Step 1: Write failing contract tests that reject packaged Node binaries and postinstall bundled-Node prewarm flows**
- [ ] **Step 2: Run the focused contract tests to verify the old installer contract fails**
- [ ] **Step 3: Update installer/release contract expectations to external Node prerequisites and OpenClaw code-asset preparation only**
- [ ] **Step 4: Re-run the focused contract tests until green**

### Task 4: Verify The Incremental Hard-Cut Slice

**Files:**
- Test: `scripts/prepare-openclaw-runtime.test.mjs`
- Test: `scripts/verify-desktop-openclaw-release-assets.test.mjs`
- Test: `scripts/release/smoke-desktop-installers.test.mjs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`

- [ ] **Step 1: Run the focused Node.js contract tests**
- [ ] **Step 2: Run the focused Rust tests**
- [ ] **Step 3: Record remaining gaps that still block full external-runtime convergence**
