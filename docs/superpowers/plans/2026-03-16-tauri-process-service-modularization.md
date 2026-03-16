# Tauri Process Service Modularization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the desktop process kernel into modular profile, request, and runtime layers while preserving the current Tauri command surface and job behavior.

**Architecture:** Keep `ProcessService` as the public facade used by commands and `JobService`, but move profile resolution, request preparation, and concrete runtime execution into dedicated process submodules. Preserve the current process DTO contracts, event payloads, profile ids, and cancellation semantics.

**Tech Stack:** Tauri v2, Rust, TypeScript, pnpm workspace, Node contract tests

---

## Chunk 1: Module Contract

### Task 1: Add a failing structural contract for process modularization

**Files:**
- Create: `scripts/desktop-process-kernel-contract.test.mjs`
- Modify: `package.json`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs`

- [ ] **Step 1: Extend the contract**

Require:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/profiles.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/requests.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/runtime.rs`
- `mod profiles;`, `mod requests;`, and `mod runtime;` in `services/process.rs`

- [ ] **Step 2: Run the contract and verify failure**

Run: `node scripts/desktop-process-kernel-contract.test.mjs`
Expected: FAIL until the process kernel is split into dedicated modules.

## Chunk 2: Native Process Refactor

### Task 2: Split the process kernel behind the existing facade

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/profiles.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/requests.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs`

- [ ] **Step 1: Add failing source-level tests**

Cover:

- process profile resolution still returns the built-in diagnostics profiles
- request preparation still sanitizes env and resolves the managed cwd
- runtime execution still captures stdout and emits output events

- [ ] **Step 2: Run the process contract again**

Run: `node scripts/desktop-process-kernel-contract.test.mjs`
Expected: FAIL until module files and facade wiring exist.

- [ ] **Step 3: Implement the module split**

Move responsibilities into:

- `profiles.rs`
- `requests.rs`
- `runtime.rs`

Keep `ProcessService::run_capture_and_emit(...)`, `run_profile_and_emit_with_started(...)`, `resolve_profile(...)`, `cancel(...)`, and `kernel_info(...)` intact.

- [ ] **Step 4: Keep public behavior identical**

Do not change:

- process command names
- process/job event payloads
- profile ids
- cancellation behavior
- timeout semantics
- security policy enforcement semantics

## Chunk 3: Verification

### Task 3: Run verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process*.rs`
- Verify: `scripts/desktop-process-kernel-contract.test.mjs`

- [ ] **Step 1: Re-run process and desktop contracts**

Run: `node scripts/desktop-process-kernel-contract.test.mjs`
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
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml runs_controlled_process_and_captures_stdout -- --nocapture`
Expected: formatting should pass; Rust tests remain blocked in this environment until `pkg-config` and GTK / GLib system libraries are installed.
