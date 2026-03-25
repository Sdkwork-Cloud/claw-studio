# OpenClaw Activation Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple built-in OpenClaw runtime activation from optional shell CLI exposure so Claw Studio can start the embedded runtime without mutating user shell state by default.

**Architecture:** Add an explicit embedded OpenClaw config section that controls whether the bundled `openclaw` CLI is exposed to the host shell. Keep runtime provisioning and gateway startup unchanged, but gate shim installation and PATH mutation behind the new config. Update desktop bootstrap tests to prove default decoupling and opt-in shell exposure behavior.

**Tech Stack:** Rust, Tauri desktop runtime, serde config model, existing desktop bootstrap tests

---

### Task 1: Add embedded OpenClaw config boundary

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`

- [ ] **Step 1: Write the failing tests**

Add assertions that the serialized app config includes a dedicated `embeddedOpenclaw` section and that the default config disables shell CLI exposure.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test framework::config::tests::default_config_serializes_kernel_sections framework::config::tests::default_embedded_openclaw_config_disables_shell_cli_exposure --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: at least one test fails because `embeddedOpenclaw` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a dedicated embedded OpenClaw config struct and expose it through `AppConfig` and `PublicAppConfig`.

- [ ] **Step 4: Run test to verify it passes**

Run the same `cargo test` command and confirm both tests pass.

### Task 2: Decouple shell exposure from runtime activation

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Write the failing tests**

Change bootstrap tests so default built-in activation no longer expects shims, and add a second test showing shims are created only when the config enables shell exposure.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test bundled_openclaw_activation --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: the default activation test fails because the current bootstrap always installs shims.

- [ ] **Step 3: Write minimal implementation**

Gate path registration calls behind the new config, while keeping managed runtime provisioning and gateway startup intact.

- [ ] **Step 4: Run test to verify it passes**

Run the same `cargo test` command and confirm the decoupled default behavior plus opt-in shell exposure behavior both pass.

### Task 3: Verify the desktop regression surface

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`

- [ ] **Step 1: Run targeted verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation default_config_serializes_kernel_sections default_embedded_openclaw_config_disables_shell_cli_exposure`

Expected: all targeted tests pass.

- [ ] **Step 2: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs docs/plans/2026-03-23-openclaw-activation-decoupling.md
git commit -m "refactor: decouple embedded openclaw shell exposure"
```
