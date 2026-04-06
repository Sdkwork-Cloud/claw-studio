# OpenClaw Mirror Legacy Archive Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep pre-`runtime.json` private mirror archives restorable by heuristically rebasing well-known managed skill and plugin paths even when source runtime diagnostics are absent.

**Architecture:** Reuse the current managed-path rebasing layer. When `runtime.json` exists, continue using exact source-root mapping. When it is absent, fall back to narrow suffix-based heuristics only for known managed default layouts such as `~/.openclaw/skills`, `~/.openclaw/extensions`, and `<workspace>/.openclaw/extensions`.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Reproduce legacy-archive path leakage with a failing test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Write the failing test**

Add a Rust test that:
- exports a private mirror with stale managed skill and plugin paths
- removes `runtime.json` from the archive to simulate a legacy mirror
- imports into a different target root
- asserts managed `skills.load.extraDirs`, `plugins.load.paths`, and `plugins.installs.*.{sourcePath,installPath}` are still rebased to the target roots

- [ ] **Step 2: Run the test to verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_legacy_archives_without_runtime_diagnostics -- --nocapture`

Expected: FAIL because old archives currently lack exact source-root diagnostics for those path fields.

### Task 2: Add safe heuristic fallback rebasing

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Extend the managed-path rebaser with fallback heuristics**

When exact runtime diagnostics are unavailable, rebase only these well-known managed layouts:
- `~/.openclaw/skills` -> target `state_dir/skills`
- `~/.openclaw/extensions` -> target `state_dir/extensions`
- `<workspace>/.openclaw/extensions` -> target `workspace_dir/.openclaw/extensions`
- `<workspace>/skills` -> target `workspace_dir/skills`

Preserve external paths unchanged.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_legacy_archives_without_runtime_diagnostics -- --nocapture`

Expected: PASS

### Task 3: Re-run mirror regression and update spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [ ] **Step 1: Re-run the import subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`

Expected: PASS

- [ ] **Step 2: Re-run the full mirror subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`

Expected: PASS

- [ ] **Step 3: Update spec**

Document that private mirror import prefers exact `runtime.json` diagnostics, but falls back to legacy managed-layout heuristics for older archives that predate runtime diagnostics.
