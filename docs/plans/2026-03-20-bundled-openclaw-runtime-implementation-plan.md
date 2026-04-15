# Bundled OpenClaw Runtime Implementation Plan

> **Supersession Note (2026-04-13):** This plan is preserved as historical context only. It predates the approved multi-kernel platform and the hard cut away from bundled Node.js. Current implementation must follow `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md`; references below to a bundled OpenClaw runtime or bundled language runtime model are no longer valid for new work.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bundle OpenClaw directly inside the desktop application, activate it on startup, stop it on app exit, and expose a stable `openclaw` CLI backed by the bundled runtime.

**Architecture:** The desktop build prepares a target-specific `openclaw-runtime` resource directory that is copied into the user's managed runtime directory on startup. The desktop host activates the copied runtime, installs stable CLI shims, updates PATH idempotently, and supervises `openclaw gateway` as an app-owned child process.

**Tech Stack:** Tauri 2, Rust desktop host, Node.js build scripts, npm-distributed OpenClaw runtime, workspace contract tests.

---

### Task 1: Define bundled runtime metadata and managed runtime layout

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`

**Step 1: Write the failing tests**

- Add tests that expect runtime activation state entries for `openclaw`.
- Add tests that expect dedicated bundled runtime and CLI bin directories to exist under managed paths.

**Step 2: Run test to verify it fails**

Run: `cargo test layout::tests paths::tests`
Expected: FAIL because the new runtime fields and directory expectations do not exist yet.

**Step 3: Write minimal implementation**

- Extend path layout with dedicated OpenClaw runtime and CLI directories.
- Ensure machine/user state initialization still normalizes active runtime metadata.
- Expose these directories through kernel metadata when useful.

**Step 4: Run test to verify it passes**

Run: `cargo test layout::tests paths::tests`
Expected: PASS

### Task 2: Add bundled OpenClaw runtime preparation and activation

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

**Step 1: Write the failing tests**

- Add tests for reading a bundled manifest, copying bundled runtime files into the managed runtime directory, and activating a new version only when metadata changes.

**Step 2: Run test to verify it fails**

Run: `cargo test openclaw_runtime`
Expected: FAIL because the service does not exist yet.

**Step 3: Write minimal implementation**

- Implement bundled manifest parsing.
- Copy `resources/openclaw-runtime/runtime/**` into `paths.runtimes_dir/openclaw/<version-platform>/`.
- Update active runtime state for `openclaw`.
- Return resolved command paths for the bundled Node and `openclaw.mjs`.

**Step 4: Run test to verify it passes**

Run: `cargo test openclaw_runtime`
Expected: PASS

### Task 3: Add CLI shim generation and PATH registration

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/path_registration.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/path_registration.rs`

**Step 1: Write the failing tests**

- Add tests that generate Windows and Unix shims with the expected bundled runtime targets.
- Add tests for idempotent PATH/profile updates.

**Step 2: Run test to verify it fails**

Run: `cargo test path_registration`
Expected: FAIL because shim generation and PATH helpers do not exist yet.

**Step 3: Write minimal implementation**

- Generate `openclaw.cmd`, `openclaw.ps1`, and Unix `openclaw` shims.
- Add user-scoped PATH registration helpers with platform-specific behavior.
- Reuse the resolved active runtime paths from the OpenClaw runtime service.

**Step 4: Run test to verify it passes**

Run: `cargo test path_registration`
Expected: PASS

### Task 4: Start and stop the OpenClaw gateway with app lifecycle

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

**Step 1: Write the failing tests**

- Add tests that expect `openclaw_gateway` to resolve a command definition from the active bundled runtime.
- Add tests that expect startup bootstrap to attempt OpenClaw startup before reporting app readiness.
- Add tests that explicit app shutdown stops managed OpenClaw services.

**Step 2: Run test to verify it fails**

Run: `cargo test supervisor bootstrap`
Expected: FAIL because service startup is still state-only.

**Step 3: Write minimal implementation**

- Extend the supervisor to spawn and monitor `openclaw gateway`.
- Stream child output to logs and record PID/lifecycle state.
- Hook startup into Tauri setup after `FrameworkContext` creation.
- Hook shutdown into the explicit exit path.

**Step 4: Run test to verify it passes**

Run: `cargo test supervisor bootstrap`
Expected: PASS

### Task 5: Prepare bundled OpenClaw resources during desktop builds

**Files:**
- Create: `scripts/prepare-openclaw-runtime.mjs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/.gitkeep`
- Create: `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/manifest.template.json`
- Modify: `packages/sdkwork-claw-desktop/package.json`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json`
- Test: `scripts/prepare-openclaw-runtime.test.mjs`

**Step 1: Write the failing tests**

- Add a script-level test that expects the prep script to create a runtime directory and manifest for the current platform.

**Step 2: Run test to verify it fails**

Run: `node scripts/prepare-openclaw-runtime.test.mjs`
Expected: FAIL because the prep script does not exist yet.

**Step 3: Write minimal implementation**

- Download or stage the pinned Node runtime for the current target.
- Install the pinned `openclaw` npm package into a staging runtime directory.
- Emit the bundled manifest and copy artifacts into `src-tauri/resources/openclaw-runtime`.
- Invoke the prep script from desktop build and dev commands before Tauri starts.

**Step 4: Run test to verify it passes**

Run: `node scripts/prepare-openclaw-runtime.test.mjs`
Expected: PASS

### Task 6: Verify end-to-end integration contracts

**Files:**
- Modify: `scripts/desktop-kernel-template-contract.test.mjs`
- Modify: `scripts/check-desktop-platform-foundation.mjs`
- Modify: `scripts/desktop-process-kernel-contract.test.mjs`

**Step 1: Write the failing tests**

- Add contract checks that bundled OpenClaw resource prep is wired into desktop scripts.
- Add contract checks that desktop kernel metadata still exposes `openclaw_gateway`.

**Step 2: Run test to verify it fails**

Run: `pnpm check:desktop`
Expected: FAIL until the new runtime and supervisor hooks are fully wired.

**Step 3: Write minimal implementation**

- Update contract expectations to match the new bundled runtime files and startup flow.

**Step 4: Run test to verify it passes**

Run: `pnpm check:desktop`
Expected: PASS
