# OpenClaw Mirror Doctor Automation Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure private mirror import runs `openclaw doctor` in a non-interactive automation-safe mode so restore workflows do not hang or wait for prompts.

**Architecture:** Keep the hardening in the native Rust mirror import service. Reuse the existing managed runtime doctor runner, extend it to pass automation flags supported by newer OpenClaw builds, and assert the exact command shape through the managed CLI fixture used in mirror import tests.

**Tech Stack:** Rust, Tauri native services, focused cargo tests

---

### Task 1: Reproduce the missing automation flags with a failing test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add a focused failing test**

Add a Rust test that imports a private mirror into the managed runtime fixture and asserts the recorded doctor invocation includes:
- `doctor`
- `--fix`
- `--non-interactive`
- `--yes`

- [ ] **Step 2: Run the focused test and verify it fails for the right reason**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_runs_doctor_in_non_interactive_mode -- --nocapture`

Expected: FAIL because the current native import only invokes `openclaw doctor --fix`.

### Task 2: Harden the native doctor runner

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Update the managed doctor invocation**

Extend the post-import doctor runner to pass:
- `--fix`
- `--non-interactive`
- `--yes`

Keep the behavior inside the Rust mirror import service and preserve existing error reporting.

- [ ] **Step 2: Re-run the focused test**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_runs_doctor_in_non_interactive_mode -- --nocapture`

Expected: PASS

### Task 3: Re-run mirror regression and document the boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [ ] **Step 1: Re-run mirror import subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`

Expected: PASS

- [ ] **Step 2: Re-run full mirror subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`

Expected: PASS

- [ ] **Step 3: Update the spec**

Document that private mirror import runs `openclaw doctor --fix --non-interactive --yes` as part of the managed post-restore repair flow.
