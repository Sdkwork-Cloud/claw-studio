# OpenClaw Mirror Managed Asset Inventory Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private mirror managed-asset inventory so import verification can detect when specific managed skill or plugin assets are missing even though their parent root directories still exist.

**Architecture:** Extend the native Rust private mirror export/import pipeline. Export a root-level managed asset snapshot that inventories concrete managed skill/plugin assets restored by the mirror. During import, load that snapshot and prefer it for managed asset verification. Fall back to the existing root-level heuristics when older archives do not carry the inventory.

**Tech Stack:** Rust, serde_json, Tauri native services, focused cargo tests

---

### Task 1: Reproduce missing per-asset verification with a failing test

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add a failing import test**

Add a Rust test that:
- exports a private mirror containing a managed skill asset and a managed plugin asset
- rewrites the archive to delete those specific asset payload directories while keeping the parent managed roots in place
- imports the corrupted archive
- asserts verification degrades with failed `managed-skills` and `managed-plugins`

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_verification_detects_missing_managed_asset_entries -- --nocapture`

Expected: FAIL because current verification only checks managed root directories and install metadata, not concrete restored assets.

### Task 2: Export and consume managed asset inventory

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add managed asset snapshot contracts**

Define native snapshot structs for concrete managed assets restored by the mirror, covering at minimum:
- managed skill directories containing `SKILL.md`
- managed plugin assets inside managed plugin roots

- [ ] **Step 2: Export the inventory into the private archive**

Write a root-level snapshot file alongside `manifest.json` and `runtime.json`.

- [ ] **Step 3: Use the inventory during import verification**

When the inventory is present:
- verify each recorded managed skill asset exists after restore
- verify each recorded managed plugin asset exists after restore

When absent:
- preserve the current heuristic fallback behavior for older archives

- [ ] **Step 4: Re-run the focused test**

Run: `CARGO_TARGET_DIR=C:/Users/admin/.codex/memories/ct cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_verification_detects_missing_managed_asset_entries -- --nocapture`

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

Document that private mirrors now carry managed skill/plugin asset inventory for deterministic restore verification, while older archives still fall back to managed-root heuristics.
