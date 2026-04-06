# Claw Host Platform State Store Contract Alignment Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the shared host-platform contract with the `stateStore` projection that the server already publishes, while keeping desktop and web preview compatible and truthful.

**Architecture:** Treat `stateStore` as a host-platform projection, not a new canonical manage resource. Extend the shared TypeScript internal contract and default browser bridge first, then teach the desktop host-platform status projection to return the same nested shape from its existing storage service. Keep `stateStoreDriver` additive and optional at the contract layer so server-specific driver labels do not over-constrain other host modes.

**Tech Stack:** TypeScript platform contracts and services, Rust desktop studio service, Serde, existing platform bridge tests, existing desktop Rust tests.

---

### Task 1: Add failing tests for contract alignment

**Files:**
- Modify: `packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Write the failing TypeScript tests**

Add tests that expect:
- `hostPlatformService` preserves the nested `stateStore` projection from the internal bridge
- the browser platform registry default internal bridge exposes a stable empty `stateStore` projection
- the server browser bridge preserves `stateStore` metadata from `/claw/internal/v1/host-platform`

- [ ] **Step 2: Write the failing desktop Rust test**

Add a desktop studio-service test that expects `get_host_platform_status(...)` to expose a `state_store` snapshot derived from the desktop storage service.

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml get_host_platform_status -- --nocapture`
Expected: FAIL because the shared internal contract and desktop host-platform status do not expose the new projection yet.

### Task 2: Implement shared internal contract alignment

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-core/src/services/hostPlatformService.ts`

- [ ] **Step 1: Add the minimal shared contract types**

Add:
- `HostPlatformStateStoreRecord`
- `HostPlatformStateStoreProviderRecord`
- `HostPlatformStateStoreProfileRecord`
- additive `stateStore` on `HostPlatformStatusRecord`
- additive optional `stateStoreDriver` on `HostPlatformStatusRecord`

- [ ] **Step 2: Update mock/default projection handling**

Ensure:
- the default browser bridge returns a stable empty `stateStore`
- host-platform service passes the nested projection through unchanged

- [ ] **Step 3: Re-run the focused TypeScript tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Expected: PASS for the shared contract and default bridge.

### Task 3: Implement desktop host-platform projection parity

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Add the minimal Rust projection types and mapping**

Add:
- desktop-side `HostPlatformStateStore*` DTOs
- a mapping from `StorageService::storage_info(...)` into the host-platform `state_store` snapshot
- optional `state_store_driver` derived from the active storage profile provider

- [ ] **Step 2: Re-run the focused desktop Rust test**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml get_host_platform_status -- --nocapture`
Expected: PASS with desktop host-platform status exposing the same nested `stateStore` projection shape.

### Task 4: Run verification and update docs if needed

**Files:**
- Modify: `docs/reference/claw-rollout-api.md`

- [ ] **Step 1: Update the host-platform contract reference if the shared shape changed materially**

Document:
- `stateStore` is now part of the shared host-platform projection contract
- `stateStoreDriver` remains additive and host-specific

- [ ] **Step 2: Run final verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml get_host_platform_status -- --nocapture`
Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_host_platform -- --nocapture`
Expected: PASS with shared host-platform state-store projection behavior aligned across server, desktop, and browser preview.
