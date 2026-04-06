# OpenClaw Mirror Phase 2 Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working managed OpenClaw mirror import flow that can inspect a `.ocmirror`, create a safety snapshot, restore the managed runtime files, and optionally restart the gateway.

**Architecture:** Extend the existing mirror export contract with import preview and import execution types. Reuse the desktop kernel bridge and the native Tauri/Rust mirror service layer. The native implementation should stage-extract the archive, validate `manifest.json`, create a safety snapshot through the existing private export path, restore managed OpenClaw config/state/workspace into the current managed runtime, and bring the gateway back up when requested.

**Tech Stack:** TypeScript, shared platform bridge contracts, Tauri commands, Rust, `serde`, existing OpenClaw mirror export builder, existing supervisor lifecycle controls, system zip/extract tooling.

---

### Task 1: Add failing shared contract and bridge tests for mirror import

**Files:**
- Modify: `packages/sdkwork-claw-types/src/openclawMirror.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webKernel.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawMirrorService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

- [ ] **Step 1: Write the failing TypeScript tests**

Add tests that expect:
- the kernel contract exposes mirror import preview and import execution methods
- the desktop command catalog contains stable import command ids
- the desktop bridge forwards import preview and execution through Tauri commands
- the core mirror service delegates import preview and import execution through the kernel bridge

- [ ] **Step 2: Run the focused TypeScript tests to verify they fail**

Run: `node packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
Run: `node packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
Expected: FAIL because the import bridge surface does not exist yet.

- [ ] **Step 3: Add the minimal import contracts**

Define:
- import preview request and preview records
- import execution request and result records
- safety snapshot metadata

- [ ] **Step 4: Re-run the focused TypeScript tests**

Run: `node packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
Run: `node packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
Expected: PASS with the import bridge surface wired end to end in TypeScript.

### Task 2: Add failing native tests for import preview and restore

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add tests that expect:
- import preview can read a `.ocmirror` manifest and component list from an exported archive
- import execution creates a safety snapshot archive before mutating the managed runtime
- import execution restores config, state, and workspace into the managed runtime tree
- import execution can leave the gateway stopped or restart it based on request flags

- [ ] **Step 2: Run the focused Rust tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`
Expected: FAIL because import preview and restore logic do not exist yet.

### Task 3: Implement the minimal native import engine

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Implement staging extract and manifest validation**

Add:
- archive extraction into a temporary staging directory
- `manifest.json` loading and structural validation
- required payload existence checks for declared components

- [ ] **Step 2: Implement safety snapshot and restore**

Add:
- optional safety snapshot using the existing private export path
- managed gateway stop/restart orchestration
- restore logic for:
  - `components/state/**`
  - `components/workspace/**`
  - `components/config/openclaw.json`

- [ ] **Step 3: Re-run the focused Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`
Expected: PASS with import preview, safety snapshot, and restore behavior working.

### Task 4: Expose import commands through Tauri and the shared kernel platform

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/openclaw_mirror.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawMirrorService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`

- [ ] **Step 1: Extend command and bridge tests**

Add assertions that expect:
- the Tauri invoke handler exposes import preview and import commands
- the desktop bridge routes import preview and import through the shared kernel bridge

- [ ] **Step 2: Run the focused TypeScript tests to verify they fail**

Run: `node packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
Run: `node packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
Expected: FAIL until command wiring is complete.

- [ ] **Step 3: Implement the minimal command wiring**

Expose:
- `kernel.inspectOpenClawMirrorImport(request)`
- `kernel.importOpenClawMirror(request)`

- [ ] **Step 4: Re-run the focused TypeScript tests**

Run: `node packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
Run: `node packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
Expected: PASS with import preview and import execution reachable from the shared bridge.

### Task 5: Run mirror import verification and record the delivery boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [ ] **Step 1: Update spec status**

Record that the mirror system now ships:
- private export
- private import
- safety snapshot before restore
- managed runtime restore for config/state/workspace

- [ ] **Step 2: Run final verification**

Run: `node packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
Run: `node packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`
Expected: PASS. Any unrelated workspace failures should be reported separately.
