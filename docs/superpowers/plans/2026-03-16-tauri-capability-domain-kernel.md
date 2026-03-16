# Tauri Capability Domain Kernel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the desktop kernel into a dedicated capability-domain assembler that exposes structured snapshots for filesystem, security, process, permissions, notifications, integrations, payments, and storage without changing current product UI or behavior.

**Architecture:** Move `DesktopKernelInfo` out of the storage service path and into a dedicated kernel service that composes focused domain services. Keep native commands thin, add domain DTOs that are future-safe for plugin and remote-provider expansion, and mirror the contract through the TypeScript runtime bridge so web and desktop hosts stay aligned.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Kernel Contract Refactor

### Task 1: Add failing kernel-domain contract coverage

**Files:**
- Modify: `scripts/desktop-kernel-template-contract.test.mjs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`

- [ ] **Step 1: Extend the contract to require dedicated kernel/domain modules**

Require:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/security.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/notifications.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/payments.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/integrations.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/permissions.rs`

- [ ] **Step 2: Add failing command-level expectations**

Extend `desktop_kernel.rs` tests to expect structured domain snapshots on `DesktopKernelInfo`, not just directories and storage.

- [ ] **Step 3: Run the contract and capture the failure**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: FAIL until the dedicated kernel/domain modules and runtime contract fields exist.

## Chunk 2: Native Capability Domain Services

### Task 2: Introduce dedicated kernel/domain DTOs and services

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/storage.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/security.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/notifications.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/payments.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/integrations.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/permissions.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`

- [ ] **Step 1: Write failing native tests**

Add focused tests for:

- dedicated kernel service assembles directories from `AppPaths`
- security snapshot reflects current policy/config settings
- process snapshot exposes available profiles and job budget
- integrations/notifications/payments snapshots reflect config defaults
- permissions snapshot stays stable even before OS-level permission adapters exist

- [ ] **Step 2: Run the targeted Rust test source path**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml commands::desktop_kernel::tests -- --nocapture`
Expected: in this environment the build may still stop at missing `pkg-config`, but test source should now define the new kernel expectations.

- [ ] **Step 3: Move kernel DTOs into a dedicated framework module**

`framework/kernel.rs` should own:

- capability status/info types
- runtime directories snapshot
- structured domain snapshot DTOs
- top-level `DesktopKernelInfo`

Keep storage-specific DTOs in `framework/storage.rs`.

- [ ] **Step 4: Add focused domain services**

Implement:

- `SecurityService`
- `NotificationService`
- `PaymentService`
- `IntegrationService`
- `PermissionService`
- `KernelService`

`KernelService` is the only service that assembles `DesktopKernelInfo`.

### Task 3: Expose stable process and policy metadata

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/policy.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/jobs.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/filesystem.rs`

- [ ] **Step 1: Add process/profile snapshot helpers**

Expose stable read-only helpers for:

- allowed spawn commands
- managed root paths or counts
- available process profiles
- active job counts

- [ ] **Step 2: Keep runtime logic unchanged**

Do not alter current process execution behavior, job lifecycle behavior, or filesystem APIs beyond adding kernel snapshot helpers.

## Chunk 3: Runtime Contract And Bridge

### Task 4: Mirror capability domains into the TypeScript runtime contract

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Add failing TS contract expectations**

Require structured runtime types for:

- filesystem
- security
- process
- permissions
- notifications
- integrations
- payments

- [ ] **Step 2: Run desktop lint to verify type gaps**

Run: `pnpm --filter @sdkwork/claw-desktop lint`
Expected: FAIL until the bridge and runtime contract align.

- [ ] **Step 3: Update desktop bridge typings only**

Keep `getDesktopKernelInfo()` as the same entry point while expanding its payload shape.

- [ ] **Step 4: Re-run lint**

Run: `pnpm --filter @sdkwork/claw-desktop lint`
Expected: PASS.

## Chunk 4: Verification

### Task 5: Run verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/**`
- Verify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Verify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Verify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Run kernel template contract**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run desktop verification**

Run: `pnpm check:desktop`
Expected: PASS.

- [ ] **Step 3: Run workspace verification**

Run: `pnpm lint`
Run: `pnpm build`
Run: `pnpm --filter @sdkwork/claw-desktop build`
Expected: PASS.

- [ ] **Step 4: Run Rust formatting and test verification when environment permits**

Run: `cargo fmt --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --all --check`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml commands::desktop_kernel::tests -- --nocapture`
Expected: formatting should pass; tests remain blocked in this environment until `pkg-config` and GTK/GLib dependencies are installed, and that blocker must be recorded explicitly.
