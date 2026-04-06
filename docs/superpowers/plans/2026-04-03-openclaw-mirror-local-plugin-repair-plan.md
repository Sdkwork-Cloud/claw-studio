# OpenClaw Mirror Local Plugin Repair Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair missing managed local plugin install directories during private mirror import when the mirror already restored a usable managed `sourcePath`.

**Architecture:** Keep the repair native to `openclaw_mirror_import.rs`. After config rebasing, inspect `plugins.installs.*` for managed local installs. When `sourcePath` is a restored managed directory with a valid plugin descriptor and `installPath` is missing, copy the source tree into the managed install root before doctor/verification.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Reproduce missing local install repair with a failing test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add a focused failing test**

Add a Rust test that exports a mirror where:
- `plugins.installs.voice-call.source == "local"`
- managed `sourcePath` exists in workspace payload
- managed `installPath` is referenced in config but absent from the state payload

Import it and assert:
- the managed install root is recreated at target `installPath`
- `plugin.json` exists there after import
- verification reports `managed-plugins` as `passed`

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_repairs_missing_local_managed_plugin_install -- --nocapture`

Expected: FAIL because current import only verifies missing plugin assets; it does not repair them.

### Task 2: Implement local managed plugin repair

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add the repair pass**

After managed config rebasing and before doctor/verification:
- inspect `plugins.installs.*`
- limit to `source == "local"`
- require managed `sourcePath` and managed `installPath`
- require `sourcePath` to exist and still look like a plugin root
- if `installPath` is missing, copy the source tree into `installPath`

Do not touch external or npm-managed installs.

- [ ] **Step 2: Re-run the focused test**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_repairs_missing_local_managed_plugin_install -- --nocapture`

Expected: PASS

### Task 3: Re-run mirror regression and update spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [ ] **Step 1: Re-run mirror import subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`

Expected: PASS

- [ ] **Step 2: Re-run full mirror subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`

Expected: PASS

- [ ] **Step 3: Update the spec**

Document that Phase 1 private import proactively repairs missing managed local plugin install roots when the mirror contains a valid managed local source tree.
