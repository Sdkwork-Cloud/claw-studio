# OpenClaw Mirror Managed Assets Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden private mirror import verification so it can detect when restored managed skill folders or plugin install/load paths point to missing on-disk assets after import.

**Architecture:** Extend the existing native verification stage in `openclaw_mirror_import.rs`. Inspect the restored `openclaw.json`, collect only managed skill/plugin paths that the mirror owns, and report deterministic verification checks without attempting network installs or desktop-side heuristics.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Reproduce missing managed-asset verification with a failing test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add a failing import verification test**

Add a Rust test that exports a private mirror whose restored config references managed skill and plugin paths, but whose state/workspace payloads do not actually include those assets. Import it and assert:
- `result.verification.status == "degraded"`
- verification contains failed `managed-skills`
- verification contains failed `managed-plugins`

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_verification_detects_missing_managed_assets -- --nocapture`

Expected: FAIL because current verification does not inspect managed skills/plugins.

### Task 2: Add managed skill/plugin verification checks

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Implement managed skill verification**

Verify managed `skills.load.extraDirs[*]` entries only when they point inside the managed OpenClaw roots restored by the mirror. Mark the check:
- `skipped` if there are no managed skill dirs to verify
- `passed` if every managed dir exists after restore
- `failed` if any managed dir is missing

- [ ] **Step 2: Implement managed plugin verification**

Verify managed plugin filesystem references from:
- `plugins.load.paths[*]`
- `plugins.installs.*.sourcePath`
- `plugins.installs.*.installPath`

Only enforce entries under the managed roots. Mark the check:
- `skipped` if there are no managed plugin paths to verify
- `passed` if every managed path exists and install roots still look like plugin directories
- `failed` if any managed path is missing or invalid

- [ ] **Step 3: Re-run the focused test**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_verification_detects_missing_managed_assets -- --nocapture`

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

Document that Phase 1 verification now explicitly checks restored managed skill and plugin filesystem assets, while external custom paths remain outside mirror enforcement.
