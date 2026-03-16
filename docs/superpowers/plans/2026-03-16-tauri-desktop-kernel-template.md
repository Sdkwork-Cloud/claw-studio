# Tauri Desktop Kernel Template Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise `@sdkwork/claw-desktop` to a template-grade native runtime baseline by adding versioned kernel config, expanded managed paths, and a pluggable storage capability without changing product UI or feature behavior.

**Architecture:** Keep the existing dual-host and thin-command approach. Extend the Rust framework with stable config, path, and storage contracts, then expose those contracts through typed desktop bridge APIs and desktop architecture checks. The first implementation slice standardizes the kernel and leaves higher-level product features untouched.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Baseline Contracts

### Task 1: Add a failing desktop kernel contract

**Files:**
- Create: `scripts/desktop-kernel-template-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract test**

Assert that the desktop package contains:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/storage.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts` exports for desktop kernel info
- root script `check:desktop-kernel`

- [ ] **Step 2: Run the test and verify it fails**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: FAIL because the storage kernel files and bridge exports do not exist yet.

## Chunk 2: Kernel Config And Paths

### Task 2: Expand desktop config schema

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`

- [ ] **Step 1: Write failing config tests**

Add tests for:

- loading legacy config JSON without new fields
- default config includes `version` and nested `storage` section
- default config includes `notifications`, `payments`, `integrations`, and `process` sections

- [ ] **Step 2: Run targeted Rust tests and verify failure**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::config::tests -- --nocapture`
Expected: FAIL because the new schema is not implemented yet.

- [ ] **Step 3: Implement versioned desktop config**

Add nested defaulted structs and preserve current top-level fields used by the product.

- [ ] **Step 4: Re-run targeted config tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::config::tests -- --nocapture`
Expected: PASS.

### Task 3: Expand managed runtime paths

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`

- [ ] **Step 1: Write failing path tests**

Add tests asserting:

- `storage_dir`
- `plugins_dir`
- `integrations_dir`
- `backups_dir`

are created under the managed runtime root.

- [ ] **Step 2: Run targeted Rust tests and verify failure**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::paths::tests -- --nocapture`
Expected: FAIL because these directories are not yet part of `AppPaths`.

- [ ] **Step 3: Implement expanded path model**

- [ ] **Step 4: Re-run targeted path tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::paths::tests -- --nocapture`
Expected: PASS.

## Chunk 3: Storage Kernel

### Task 4: Add storage DTOs and provider registry

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/storage.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`

- [ ] **Step 1: Write failing storage registry tests**

Add tests for:

- built-in provider kinds are present
- configured storage profiles are normalized
- active profile falls back safely to the local default

- [ ] **Step 2: Run targeted Rust tests and verify failure**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::storage::tests -- --nocapture`
Expected: FAIL because the storage kernel does not exist yet.

- [ ] **Step 3: Implement the storage DTOs and service**

Model provider descriptors, profiles, capabilities, and a runtime snapshot.

- [ ] **Step 4: Re-run targeted storage tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::storage::tests -- --nocapture`
Expected: PASS.

### Task 5: Expose desktop kernel snapshot commands

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Add failing contract expectations**

Extend `scripts/desktop-kernel-template-contract.test.mjs` to expect command registration and bridge wiring for the desktop kernel snapshot.

- [ ] **Step 2: Run contract test and verify failure**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: FAIL because command registration and bridge exports are missing.

- [ ] **Step 3: Implement the command surface**

Expose:

- `desktop_kernel_info`
- `desktop_storage_info`

- [ ] **Step 4: Re-run the contract test**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: PASS.

## Chunk 4: TypeScript Bridge And Verification

### Task 6: Add typed desktop bridge support

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/index.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `scripts/check-desktop-platform-foundation.mjs`

- [ ] **Step 1: Add failing TypeScript expectations**

Extend the desktop architecture check to assert:

- runtime contract types for kernel storage info exist
- `tauriBridge.ts` exports desktop kernel helper functions

- [ ] **Step 2: Run `pnpm check:desktop` and verify failure**

Expected: FAIL until the bridge and check are updated.

- [ ] **Step 3: Implement the bridge and checks**

- [ ] **Step 4: Re-run `pnpm check:desktop`**

Expected: PASS.

### Task 7: Final verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/**`
- Verify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Run desktop kernel contract**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 3: Run desktop architecture verification**

Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 4: Run workspace verification**

Run: `pnpm lint`
Run: `pnpm build`
Expected: PASS.
