# Tauri Storage Driver Kernel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the desktop storage kernel from provider/profile metadata into executable pluggable storage drivers with stable bridge APIs, while preserving current product behavior and UI.

**Architecture:** Keep storage as a first-class desktop kernel domain. Add a native driver trait plus a registry-based storage service, ship working `local-file` and `memory` drivers, keep `sqlite / postgres / remote-api` as planned adapters behind the same contract, and expose the capability through a dedicated infrastructure bridge instead of coupling it to the existing runtime snapshot API.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Storage Bridge Contract

### Task 1: Add a failing storage bridge contract

**Files:**
- Create: `scripts/desktop-storage-driver-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract**

Assert that the workspace contains:

- `packages/sdkwork-claw-infrastructure/src/platform/contracts/storage.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStorage.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/commands/storage_commands.rs`
- storage bridge registration in `platform/registry.ts`
- storage helper exports in `tauriBridge.ts`

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: FAIL because the storage bridge domain does not exist yet.

## Chunk 2: Native Driver Kernel

### Task 2: Add failing native storage service tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/storage.rs`

- [ ] **Step 1: Write failing tests**

Add tests for:

- local-file driver persists values across service calls
- memory driver stores values in-process
- active profile selection chooses the requested driver
- unsupported drivers return a stable error when invoked

- [ ] **Step 2: Run the targeted Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::storage::tests -- --nocapture`
Expected: in this environment the Rust build may still be blocked by missing native Linux dependencies, but the test target itself should reflect the new driver expectations in source.

- [ ] **Step 3: Implement the driver trait and registry**

Add:

- a `StorageDriver` trait
- `LocalFileStorageDriver`
- `MemoryStorageDriver`
- planned-driver placeholder handling for `sqlite`, `postgres`, and `remoteApi`

- [ ] **Step 4: Re-run the targeted tests when environment permits**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::storage::tests -- --nocapture`
Expected: PASS when native build dependencies are available.

### Task 3: Expose storage command surface

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/storage_commands.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Extend the failing storage bridge contract**

Require command registration for:

- `storage_get_text`
- `storage_put_text`
- `storage_delete`
- `storage_list_keys`

- [ ] **Step 2: Run the contract and verify failure**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: FAIL until command registration exists.

- [ ] **Step 3: Implement thin command adapters**

Map command requests into the storage service only. Do not embed persistence logic in command files.

- [ ] **Step 4: Re-run the contract**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: PASS.

## Chunk 3: Infrastructure Storage Bridge

### Task 4: Add dedicated storage platform contracts

**Files:**
- Create: `packages/sdkwork-claw-infrastructure/src/platform/contracts/storage.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/webStorage.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`

- [ ] **Step 1: Write the failing TypeScript contract**

Require:

- `StoragePlatformAPI`
- DTOs for storage read/write/list operations
- registry helpers like `getStoragePlatform()`

- [ ] **Step 2: Run desktop/storage contract verification**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: FAIL until the infrastructure bridge exists.

- [ ] **Step 3: Implement the dedicated storage bridge**

Provide a web fallback implementation using namespaced local storage so the abstraction works in both hosts without introducing product regressions.

- [ ] **Step 4: Re-run the contract**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: PASS.

### Task 5: Wire Tauri desktop storage bridge

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Add failing bridge expectations**

Require typed exports for:

- `storageGetText`
- `storagePutText`
- `storageDelete`
- `storageListKeys`

- [ ] **Step 2: Run `pnpm --filter @sdkwork/claw-desktop lint` and verify failure if bridge types are incomplete**

- [ ] **Step 3: Implement desktop invoke wiring and registry integration**

- [ ] **Step 4: Re-run `pnpm --filter @sdkwork/claw-desktop lint`**

Expected: PASS.

## Chunk 4: Verification

### Task 6: Run verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/**`
- Verify: `packages/sdkwork-claw-infrastructure/src/platform/**`
- Verify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Run storage bridge contract**

Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run desktop verification**

Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 3: Run workspace verification**

Run: `pnpm lint`
Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Run Rust verification when environment permits**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: currently blocked on missing system-level `pkg-config` / GTK dependencies in this environment; record exact blocker rather than claiming success without evidence.
