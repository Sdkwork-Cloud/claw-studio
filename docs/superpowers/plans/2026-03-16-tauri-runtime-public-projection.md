# Tauri Runtime Public Projection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw native config exposure with a safe public runtime projection so the Tauri template preserves strong security boundaries without changing product behavior or UI.

**Architecture:** Keep `AppConfig` and raw storage profile fields internal to the Rust kernel. Add explicit public projection DTOs for config and storage snapshots, update command return types and TypeScript runtime contracts, and verify that raw `connection` / `endpoint` values no longer cross the desktop boundary.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Public Projection Contract

### Task 1: Add a failing runtime/storage contract

**Files:**
- Modify: `scripts/desktop-kernel-template-contract.test.mjs`
- Modify: `scripts/desktop-storage-driver-contract.test.mjs`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`

- [x] **Step 1: Extend the contract**

Require:

- configured-flag fields on runtime storage profile contracts
- absence of raw `connection?: string` and `endpoint?: string` fields in public storage/runtime profile DTOs
- public config command usage in `get_app_config.rs`

- [x] **Step 2: Run the contracts and verify failure**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Run: `node scripts/desktop-storage-driver-contract.test.mjs`
Expected: FAIL until the secure public projection exists.

## Chunk 2: Native Projection Layer

### Task 2: Add failing native tests for redacted projection

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/storage.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/get_app_config.rs`

- [x] **Step 1: Write failing unit tests**

Cover:

- public config snapshots expose storage configured flags instead of raw values
- public storage info snapshots do not serialize raw `connection`, `database`, or `endpoint`
- raw internal storage resolution remains unchanged for driver execution

- [x] **Step 2: Run the targeted Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml commands::get_app_config::tests framework::services::storage::tests -- --nocapture`
Expected: In this environment the build may still stop at missing `pkg-config` and GTK system libraries, but the test source should capture the new projection behavior.

- [x] **Step 3: Implement the public projection DTOs**

Add:

- a public config snapshot type in the framework config module
- redacted storage profile DTO fields with `connectionConfigured`, `databaseConfigured`, and `endpointConfigured`
- command-layer projection for `get_app_config`

- [x] **Step 4: Keep storage execution logic internal**

Ensure storage drivers still receive raw internal profile data through `StorageDriverScope`, with no behavior regression in local-file, memory, and placeholder drivers.

## Chunk 3: TypeScript Bridge And Verification

### Task 3: Mirror the public projection into the frontend contracts

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/storage.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webStorage.ts`

- [x] **Step 1: Update TypeScript contracts**

Replace raw connection fields with configured flags in the public runtime/storage DTOs.

- [x] **Step 2: Run lint and checks**

Run: `pnpm --filter @sdkwork/claw-web lint`
Run: `pnpm --filter @sdkwork/claw-desktop lint`
Run: `pnpm check:desktop`
Expected: PASS.

- [x] **Step 3: Run workspace verification**

Run: `pnpm lint`
Run: `pnpm build`
Run: `pnpm --filter @sdkwork/claw-desktop build`
Expected: PASS.

- [x] **Step 4: Re-run Rust formatting and record environment blockers**

Run: `cargo fmt --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --all --check`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml commands::get_app_config::tests framework::services::storage::tests -- --nocapture`
Expected: formatting should pass; Rust tests remain blocked until `pkg-config` and the GTK / GLib desktop libraries are installed.
