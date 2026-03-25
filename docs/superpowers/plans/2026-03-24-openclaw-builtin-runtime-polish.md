# OpenClaw Built-In Runtime Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Claw Studio's built-in OpenClaw runtime to the current verified release and harden shell exposure so global `openclaw` commands work cross-platform without persisting gateway secrets in launcher shims.

**Architecture:** Keep the bundled runtime manifest as the single runtime truth source, but change shell shims into thin launchers that re-enter Claw Studio's internal CLI. That internal CLI will resolve the managed runtime at execution time, inject ephemeral runtime environment, and forward arguments. Update PATH/profile registration and tests to match the new contract.

**Tech Stack:** Node.js scripts, Rust, Tauri desktop runtime, serde, targeted Rust and Node contract tests

---

### Task 1: Update bundled OpenClaw version contract

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.mjs`
- Modify: `scripts/prepare-openclaw-runtime.test.mjs`

- [ ] **Step 1: Write the failing test**

Change the runtime preparation test literals to expect the new bundled version.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/prepare-openclaw-runtime.test.mjs`

Expected: FAIL because the script still defaults to the older OpenClaw version.

- [ ] **Step 3: Write minimal implementation**

Update the default bundled OpenClaw version constant and any preparation test fixtures tied to it.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/prepare-openclaw-runtime.test.mjs`

Expected: PASS

### Task 2: Replace secret-bearing shell shims with launcher shims

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/path_registration.rs`

- [ ] **Step 1: Write the failing test**

Update path registration tests so generated shims no longer contain `OPENCLAW_GATEWAY_TOKEN` or the literal gateway token and instead invoke the desktop internal launcher flag.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::path_registration::tests::writes_openclaw_cli_shims_for_windows_shells`

Expected: FAIL because current shims still embed runtime environment directly.

- [ ] **Step 3: Write minimal implementation**

Render cmd, PowerShell, and Unix shims as thin launchers that invoke the installed Claw Studio executable with the internal OpenClaw CLI flag. Expand Unix shell profile sourcing coverage to include common interactive shell files while keeping registration idempotent.

- [ ] **Step 4: Run test to verify it passes**

Run the same `cargo test` command.

Expected: PASS

### Task 3: Add secure internal CLI execution path

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`

- [ ] **Step 1: Write the failing test**

Add a test proving the internal CLI resolves a new `--run-openclaw-cli` action and executes the managed runtime without writing the gateway token into the launcher shim.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml internal_cli`

Expected: FAIL because the action and execution path do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Teach the internal CLI to:

- parse a run-openclaw action
- resolve the active bundled runtime from the current install
- inject managed runtime env for the spawned CLI process
- forward stdin/stdout/stderr and exit status

- [ ] **Step 4: Run test to verify it passes**

Run the same `cargo test` command.

Expected: PASS

### Task 4: Align desktop bootstrap and runtime tests with bundled contract

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Write the failing test**

Update test fixtures and expectations so bundled runtime references match the launcher-based CLI path expectations and the new bundled version baseline.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation framework::services::openclaw_runtime::tests`

Expected: at least one test fails because the fixtures and activation assumptions are still on the old contract.

- [ ] **Step 3: Write minimal implementation**

Align the runtime fixtures and activation helpers with the manifest-driven bundled runtime contract.

- [ ] **Step 4: Run test to verify it passes**

Run the same `cargo test` command.

Expected: PASS

### Task 5: Run focused verification

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.mjs`
- Modify: `scripts/prepare-openclaw-runtime.test.mjs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/path_registration.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
node scripts/prepare-openclaw-runtime.test.mjs
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::path_registration::tests::writes_openclaw_cli_shims_for_windows_shells
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml internal_cli
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation framework::services::openclaw_runtime::tests
node --experimental-strip-types scripts/check-desktop-platform-foundation.mjs
```

Expected: all targeted checks pass.
