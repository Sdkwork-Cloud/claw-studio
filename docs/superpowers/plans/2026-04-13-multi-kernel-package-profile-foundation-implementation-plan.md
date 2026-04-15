# Multi-Kernel Package Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make desktop build and packaging flows resolve an explicit `packageProfileId` and emit kernel-package manifest metadata for `openclaw-only`, `hermes-only`, and `dual-kernel`.

**Architecture:** Add one release-layer source of truth for package profiles, thread `packageProfileId` through build and packaging scripts, and upgrade bundled/release manifests to carry included kernels, default-enabled kernels, external runtime requirements, and launcher kinds. Keep the scope limited to release automation and manifest contracts so OpenClaw detail UI and Rust host behavior are not destabilized in the same slice.

**Tech Stack:** Node.js ESM scripts, `node:test`, existing release/build helpers, JSON manifest generation

---

### Task 1: Define Release-Layer Package Profile Catalog

**Files:**
- Create: `scripts/release/kernel-package-profiles.mjs`
- Test: `scripts/release/kernel-package-profiles.test.mjs`

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Write minimal implementation**
- [x] **Step 4: Run test to verify it passes**

### Task 2: Thread packageProfileId Through Desktop Build Entry

**Files:**
- Modify: `scripts/run-desktop-release-build.mjs`
- Modify: `scripts/run-desktop-release-build.test.mjs`
- Modify: `scripts/release-flow-contract.test.mjs`

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Write minimal implementation**
- [x] **Step 4: Run test to verify it passes**

### Task 3: Emit Package Profile Metadata In Bundled And Release Manifests

**Files:**
- Modify: `scripts/sync-bundled-components.mjs`
- Modify: `scripts/sync-bundled-components.test.mjs`
- Modify: `scripts/release/package-release-assets.mjs`
- Modify: `scripts/package-release-assets.test.mjs`

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Write minimal implementation**
- [x] **Step 4: Run test to verify it passes**

### Task 4: Verify Release Flow Wiring

**Files:**
- Modify: `packages/sdkwork-claw-desktop/package.json`
- Modify: `package.json` only if root scripts must forward `packageProfileId`
- Test: `scripts/release-flow-contract.test.mjs`

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Write minimal implementation**
- [x] **Step 4: Run test to verify it passes**
