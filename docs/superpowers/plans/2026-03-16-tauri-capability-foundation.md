# Tauri Capability Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize desktop capability provider and adapter catalogs behind one shared foundation so the Tauri template stays high-cohesion, low-coupling, and ready for future native adapters without changing current product behavior or UI.

**Architecture:** Add a dedicated `framework/capabilities.rs` module that owns reusable catalog and status-resolution helpers for capability domains. Refactor notifications, payments, and integrations to build their runtime snapshots from that shared foundation while keeping domain-specific DTOs and command surfaces unchanged.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Capability Foundation Contract

### Task 1: Add a failing contract for the shared capability foundation

**Files:**
- Modify: `scripts/desktop-kernel-template-contract.test.mjs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/{notifications,payments,integrations}.rs`

- [x] **Step 1: Extend the Node contract**

Require:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/capabilities.rs`
- `pub mod capabilities;` in `framework/mod.rs`
- `CapabilityCatalog` usage in notification, payment, and integration services

- [x] **Step 2: Run the contract and verify failure**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: FAIL until the new foundation module exists and all three services consume it.

## Chunk 2: Native Capability Foundation

### Task 2: Add failing Rust unit tests for shared catalog behavior

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/capabilities.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/{notifications,payments,integrations}.rs`

- [x] **Step 1: Write failing unit tests**

Cover:

- selected-provider availability resolves to a stable capability status
- missing providers resolve to `Planned`
- shared catalog can answer ready-item checks for integrations without duplicating iteration logic

- [x] **Step 2: Run the targeted Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::capabilities::tests -- --nocapture`
Expected: In this environment the build may still stop at missing `pkg-config` / GTK system libraries, but the test source should capture the new catalog behavior.

- [x] **Step 3: Implement the shared foundation**

Add:

- a generic `CapabilityCatalog<T>`
- a `CapabilityCatalogEntry` trait exposing id and availability
- shared helpers for selected status resolution and ready-item checks

- [x] **Step 4: Refactor capability-domain services**

Use the shared foundation in:

- `NotificationService`
- `PaymentService`
- `IntegrationService`

Keep the domain DTO payloads and kernel snapshot contract unchanged.

## Chunk 3: Verification

### Task 3: Run verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/**`
- Verify: `scripts/desktop-kernel-template-contract.test.mjs`

- [x] **Step 1: Re-run the desktop kernel contract**

Run: `node scripts/desktop-kernel-template-contract.test.mjs`
Expected: PASS.

- [x] **Step 2: Re-run desktop lint and checks**

Run: `pnpm --filter @sdkwork/claw-desktop lint`
Run: `pnpm check:desktop`
Expected: PASS.

- [x] **Step 3: Re-run workspace verification**

Run: `pnpm lint`
Run: `pnpm build`
Run: `pnpm --filter @sdkwork/claw-desktop build`
Expected: PASS.

- [x] **Step 4: Re-run Rust formatting and note environment blockers**

Run: `cargo fmt --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --all --check`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::capabilities::tests -- --nocapture`
Expected: formatting should pass; tests remain blocked until `pkg-config` and the GTK / GLib desktop libraries are installed in the environment.
