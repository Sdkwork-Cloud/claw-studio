# OpenClaw Async Desktop Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple bundled OpenClaw startup from Tauri desktop entry so the shell becomes available immediately and the built-in instance converges asynchronously with truthful status.

**Architecture:** Keep the bundled runtime and supervisor activation pipeline intact, move its first boot invocation out of blocking `setup()` into a background task, and update built-in instance projection in `studio.rs` so async activation can mark `Starting`, `Online`, and `Error` without changing manual lifecycle semantics.

**Tech Stack:** Rust Tauri host, existing `FrameworkContext` services, desktop bootstrap tests, studio service regression tests, supervisor service retries already in place.

---

### Task 1: Lock The Non-Blocking Startup Contract In Tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Write the failing test**

Add bootstrap coverage that proves:
- `setup()` emits `app://ready` even when bundled activation returns an error
- bundled activation errors are logged instead of being returned from setup

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop app_setup_emits_app_ready_even_when_bundled_openclaw_activation_fails -- --test-threads=1`

Expected:
- failure because setup still returns the activation error before `APP_READY`

### Task 2: Lock Built-In Async Activation Projection In Tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage that proves:
- background bundled activation marks the built-in instance `Error` when activation fails
- background bundled activation marks the built-in instance `Online` when activation succeeds
- the built-in instance is projected as `Starting` before the background activation finishes

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop bundled_openclaw_background_activation_marks_built_in_instance_error_when_activation_fails -- --test-threads=1`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop bundled_openclaw_background_activation_promotes_built_in_instance_online_when_activation_succeeds -- --test-threads=1`

Expected:
- failure because there is no async activation entrypoint that owns built-in instance transitions yet

### Task 3: Implement Desktop-First Bootstrap

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Add a narrow background activation entrypoint**

Refactor bootstrap so:
- setup can mark the built-in instance `Starting`
- setup can emit `app://ready`
- setup can spawn a background bundled activation task without returning its error

- [ ] **Step 2: Preserve observable logging**

Ensure the new background path:
- logs activation stage failures
- keeps the activation pipeline error visible in logs
- never crashes desktop bootstrap on bundled activation failure

- [ ] **Step 3: Run targeted bootstrap tests**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop app_setup_emits_app_ready_even_when_bundled_openclaw_activation_fails -- --test-threads=1`

Expected:
- pass

### Task 4: Implement Built-In Instance Async State Updates

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Add built-in projection helpers for async activation**

Extend the built-in instance service surface so background activation can:
- set built-in status to `Starting`
- promote to `Online` on success
- demote to `Error` on failure

- [ ] **Step 2: Wire bootstrap background activation to studio state**

Ensure the async activation task:
- uses the same built-in instance identity as manual lifecycle flows
- updates storage-backed built-in projection consistently
- leaves manual start and restart semantics unchanged

- [ ] **Step 3: Run targeted built-in state tests**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop bundled_openclaw_background_activation_marks_built_in_instance_error_when_activation_fails -- --test-threads=1`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop bundled_openclaw_background_activation_promotes_built_in_instance_online_when_activation_succeeds -- --test-threads=1`

Expected:
- both pass

### Task 5: Verify No Regression In Existing Lifecycle Paths

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Run focused regression coverage**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop bundled_openclaw_activation_marks_built_in_instance_error_when_gateway_start_fails -- --test-threads=1`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop supervisor_retries_gateway_start_when_the_first_cold_start_exits_immediately -- --test-threads=1`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop supervisor_allows_slow_openclaw_gateway_startup_within_the_readiness_window -- --test-threads=1`

Expected:
- all pass

- [ ] **Step 2: Run broader desktop-target verification**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop bootstrap -- --test-threads=1`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/check-desktop studio -- --test-threads=1`

Expected:
- relevant desktop bootstrap and studio suites pass without the old blocking startup assumption
