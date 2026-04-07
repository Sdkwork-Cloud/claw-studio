# Release 09 Desktop Verification Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the remaining desktop release-verification drift from `release-2026-04-07-08`, carry the unpublished release notes forward into `release-2026-04-07-09`, and publish the next release candidate without regressing local relative-path SDK development.

**Architecture:** Keep the desktop embedded host aligned with the live managed OpenClaw authority instead of a stale cloned server control plane. Treat release metadata and step logs as repository-owned state so failed tags remain historical records and only the next candidate is marked pending. Preserve local workspace-relative SDK development while verifying release mode with `SDKWORK_SHARED_SDK_MODE=git`.

**Tech Stack:** Rust desktop runtime services, Tauri test suites, pnpm workspace checks, GitHub Actions release workflows, repository-owned release notes under `docs/release`.

---

### Task 1: Isolate The Real Desktop Repair

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [x] **Step 1: Confirm the failing desktop release-verification tests and their root causes**
- [x] **Step 2: Rebuild embedded-host shared workbench authority from the live desktop manage provider**
- [x] **Step 3: Align mirror-import fixtures and stale offline expectations with current runtime semantics**
- [x] **Step 4: Re-run the targeted desktop Rust regressions**

### Task 2: Carry Release Metadata Forward

**Files:**
- Modify: `docs/release/releases.json`
- Modify: `docs/release/release-2026-04-07-08.md`
- Create: `docs/release/release-2026-04-07-09.md`
- Create: `docs/step/2026-04-07-release-desktop-embedded-host-verification-and-release-09.md`

- [x] **Step 1: Mark `release-2026-04-07-08` as failed**
- [x] **Step 2: Add the next carried-forward candidate `release-2026-04-07-09`**
- [x] **Step 3: Record the repair evidence and execution history under `docs/step`**

### Task 3: Re-Verify Release Mode

**Files:**
- Modify: `docs/superpowers/plans/2026-04-07-release-09-desktop-verification-repair-plan.md`

- [ ] **Step 1: Re-render release notes for `release-2026-04-07-09`**
- [ ] **Step 2: Re-run final git/worktree verification**
- [ ] **Step 3: Commit, push, tag, and verify GitHub publication**
