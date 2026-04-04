# OpenClaw Mirror Rebase Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure `full-private` OpenClaw mirror import rewrites managed runtime paths and gateway config to the target instance instead of preserving stale source-machine values.

**Architecture:** Keep the fix in the native Rust mirror-import layer so restore semantics stay deterministic and platform-native. Restore the archive payloads first, then run a focused managed-config rebasing pass before local-proxy reprojection, doctor, and verification.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Capture the restore-path regression with a failing import test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [x] **Step 1: Write the failing test**

Add a Rust unit test that exports a source mirror whose `openclaw.json` contains:
- `gateway.port`
- `gateway.auth.token`
- `agents.defaults.workspace`
- at least one agent entry with explicit `workspace` and `agentDir`

Import it into a different target root and assert the restored config points at:
- target `paths.openclaw_workspace_dir`
- target `paths.openclaw_state_dir/agents/<id>/agent`
- target runtime gateway port/token

- [x] **Step 2: Run test to verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_managed_paths_after_restore -- --nocapture`

Expected: FAIL because import currently copies source config verbatim.

### Task 2: Rebase managed config after archive restore

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Reference: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [x] **Step 1: Implement minimal rebasing helper**

Add a Rust helper that reads restored `openclaw.json` and rewrites only managed fields:
- `gateway.port`
- `gateway.auth.mode`
- `gateway.auth.token`
- `agents.defaults.workspace`
- `agents.list[*].workspace`
- `agents.list[*].agentDir`

Rules:
- default agent workspace -> target `paths.openclaw_workspace_dir`
- other agent workspaces -> target `paths.openclaw_home_dir/workspace-<agentId>`
- agent dir -> target `paths.openclaw_state_dir/agents/<agentId>/agent`
- preserve unrelated config

- [x] **Step 2: Call rebasing helper in import flow**

Invoke the helper immediately after payload restore and before local proxy reprojection.

- [x] **Step 3: Run focused test to verify it passes**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rebases_managed_paths_after_restore -- --nocapture`

Expected: PASS

### Task 3: Guard the broader mirror import contract

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [x] **Step 1: Extend existing import verification assertions**

Update the existing full-private import test to assert the rebased managed config now points to the target workspace and agent directory roots.

- [x] **Step 2: Re-run mirror import test subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`

Expected: PASS

- [x] **Step 3: Re-run full mirror subset**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`

Expected: PASS

- [x] **Step 4: Update spec status**

Document that Phase 1 full-private import now rebases managed runtime config paths instead of trusting archived source-machine paths.
