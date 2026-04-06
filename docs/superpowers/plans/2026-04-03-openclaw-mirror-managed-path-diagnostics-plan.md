# OpenClaw Mirror Managed Path Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure private mirror import can rebase non-agent managed paths, starting with `skills.load.extraDirs`, by carrying source managed-root diagnostics inside the archive.

**Architecture:** Keep the repair native to the Rust mirror export/import pipeline. Export a private runtime-path snapshot into the archive, load it during import, and use a single managed-root prefix mapper so future plugin or extension path repair can reuse the same mechanism.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Reproduce shared-skill path leakage with a failing import test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [x] **Step 1: Write the failing test**

Add a Rust test that exports a source mirror whose `openclaw.json` contains `skills.load.extraDirs` entries for:
- a source managed shared-skills path under `state_dir/skills`
- a source managed workspace-skills path under `workspace_dir/skills`
- one unrelated external absolute path that must remain unchanged

Import into a different target root and assert the restored config points the managed entries at the target managed roots while preserving the external path.

- [x] **Step 2: Run the test to verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_managed_skill_extra_dirs_after_restore -- --nocapture`

Expected: FAIL because import currently preserves archived `skills.load.extraDirs` values verbatim.

### Task 2: Carry source managed-root diagnostics in the private mirror

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Reference: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs`

- [x] **Step 1: Export a private runtime-path snapshot**

Write `runtime.json` at the archive root using the existing `OpenClawMirrorRuntimeSnapshot` preview payload so import can recover:
- `home_dir`
- `state_dir`
- `workspace_dir`
- `config_path`

- [x] **Step 2: Load the runtime-path snapshot during import**

Extend prepared archive loading to read `runtime.json` when present and make it available to the import rebasing helper.

### Task 3: Rebase managed shared-skill paths using source-root diagnostics

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [x] **Step 1: Implement managed-root path mapping**

Add a helper that maps archived absolute paths under the source managed roots to the target managed roots:
- `source.home_dir` -> `target.home_dir`
- `source.state_dir` -> `target.state_dir`
- `source.workspace_dir` -> `target.workspace_dir`

Only rewrite absolute paths that are confirmed descendants of those roots. Preserve external paths and relative paths unchanged.

- [x] **Step 2: Apply the mapper to `skills.load.extraDirs`**

Rebase `skills.load.extraDirs[*]` immediately after the existing gateway and agent-path rebasing logic.

- [x] **Step 3: Run the focused test to verify it passes**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_managed_skill_extra_dirs_after_restore -- --nocapture`

Expected: PASS

### Task 4: Guard the broader private-mirror contract

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs`
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [x] **Step 1: Re-run the import subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`

Expected: PASS

- [x] **Step 2: Re-run the full mirror subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`

Expected: PASS

- [x] **Step 3: Update spec status**

Document that private mirror archives now carry managed-root diagnostics and Phase 1 import rebases `skills.load.extraDirs` entries that point back into the mirrored managed roots.
