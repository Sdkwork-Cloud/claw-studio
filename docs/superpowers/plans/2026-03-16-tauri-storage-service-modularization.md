# Tauri Storage Service Modularization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the desktop storage kernel into modular resolver, registry, and driver layers while preserving the current Tauri command surface and product behavior.

**Architecture:** Keep `StorageService` as the public facade used by `FrameworkServices` and command adapters, but move profile resolution, provider metadata/registry composition, and concrete driver implementations into dedicated storage submodules. Preserve the pluggable driver architecture and current DTO contracts.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Module Contract

### Task 1: Add a failing structural contract for storage modularization

**Files:**
- Modify: `scripts/desktop-storage-driver-contract.test.mjs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`

- [ ] **Step 1: Extend the contract**

Require:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/drivers.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/profiles.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/registry.rs`
- `mod drivers;`, `mod profiles;`, and `mod registry;` in `services/storage.rs`

- [ ] **Step 2: Run the contract and verify failure**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: FAIL until the storage kernel is split into dedicated modules.

## Chunk 2: Native Storage Refactor

### Task 2: Add failing native tests and split the storage kernel

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/drivers.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/profiles.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/registry.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`

- [ ] **Step 1: Write failing source-level tests**

Cover:

- profile resolver builds redacted public storage snapshots
- registry still exposes all built-in provider kinds
- local-file and memory drivers preserve current behavior

- [ ] **Step 2: Run the storage contract again**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: FAIL until module files and facade wiring exist.

- [ ] **Step 3: Implement module split**

Move responsibilities into:

- `profiles.rs`
- `registry.rs`
- `drivers.rs`

Keep `StorageService::with_registry(...)`, `register_driver(...)`, and the existing request methods intact.

- [ ] **Step 4: Keep public behavior identical**

Do not change:

- storage command names
- bridge APIs
- provider kinds
- active profile selection behavior
- local-file or memory driver semantics

## Chunk 3: Verification

### Task 3: Run verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage*.rs`
- Verify: `scripts/desktop-storage-driver-contract.test.mjs`

- [ ] **Step 1: Re-run storage and desktop contracts**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 2: Re-run TypeScript verification**

Run: `pnpm --filter @sdkwork/claw-web lint`
Run: `pnpm --filter @sdkwork/claw-desktop lint`
Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Re-run host builds**

Run: `pnpm build`
Run: `pnpm --filter @sdkwork/claw-desktop build`
Expected: PASS.

- [ ] **Step 4: Re-run Rust formatting and note blockers**

Run: `cargo fmt --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --all --check`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_file_driver_persists_values_across_service_instances -- --nocapture`
Expected: formatting should pass; Rust tests remain blocked in this environment until `pkg-config` and GTK / GLib system libraries are installed.
