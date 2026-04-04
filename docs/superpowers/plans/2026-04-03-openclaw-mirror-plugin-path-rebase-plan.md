# OpenClaw Mirror Plugin Path Rebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase private-mirror plugin path fields that still preserve source-machine managed paths after restore.

**Architecture:** Reuse the new private runtime-path diagnostics and managed-root prefix mapper added for shared skills. Apply the same mapper to plugin config fields that are documented as filesystem-backed: `plugins.load.paths[*]` and `plugins.installs.*.{sourcePath,installPath}` when they point back into mirrored managed roots.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Capture plugin path leakage with a failing import test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [x] **Step 1: Write the failing test**

Add a Rust test that exports a source mirror whose `openclaw.json` contains:
- `plugins.load.paths` entries for a source managed extension path and a source workspace extension path
- `plugins.installs.<id>.installPath` under the source managed state root
- `plugins.installs.<id>.sourcePath` under the source managed workspace root
- one external absolute path that must remain unchanged

Import into a different target root and assert the managed entries are rebased to the target roots while the external path is preserved.

- [x] **Step 2: Run the test to verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_managed_plugin_paths_after_restore -- --nocapture`

Expected: FAIL because plugin path fields are still restored verbatim today.

### Task 2: Reuse managed-root mapping for plugin path fields

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [x] **Step 1: Rebase `plugins.load.paths`**

Apply the existing managed-root prefix mapper to every string entry under `plugins.load.paths`.

- [x] **Step 2: Rebase `plugins.installs.*` managed paths**

For each install record object:
- rebase `installPath` when it points into mirrored managed roots
- rebase `sourcePath` when it points into mirrored managed roots

Preserve external and relative paths unchanged.

- [x] **Step 3: Run the focused test to verify it passes**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_managed_plugin_paths_after_restore -- --nocapture`

Expected: PASS

### Task 3: Re-run mirror regression and update spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [x] **Step 1: Re-run the import subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`

Expected: PASS

- [x] **Step 2: Re-run the full mirror subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`

Expected: PASS

- [x] **Step 3: Update spec status**

Document that Phase 1 import now rebases plugin filesystem path fields that point into the mirrored managed roots, using the same runtime-path diagnostics used for shared skills.
