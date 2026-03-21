# OpenClaw Built-In Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the built-in OpenClaw runtime start on the user-configured port when available and automatically fall back to a nearby free port when that port is occupied.

**Architecture:** Keep the change inside the desktop Tauri boundary by making `studio.rs` own the saved built-in instance port, `openclaw_runtime.rs` own preferred-port resolution plus conflict fallback, and the bootstrap/supervisor flow refresh the configured runtime from the latest built-in config before start or restart.

**Tech Stack:** Rust, Tauri, serde_json/json5, cargo test

---

### Task 1: Add failing runtime-service tests for preferred port resolution

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Write the failing test**

Add a test proving a configured preferred port is used exactly when it is free.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test uses_configured_gateway_port_when_it_is_available --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because the runtime service does not yet expose a preferred-port-aware activation path.

- [ ] **Step 3: Write minimal implementation**

Add a preferred-port-aware runtime activation entry point and wire the managed config resolution to honor that preferred port.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test uses_configured_gateway_port_when_it_is_available --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs
git commit -m "feat: honor configured openclaw gateway port"
```

### Task 2: Add failing refresh/start-path test for built-in instance config

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write the failing test**

Add a test proving that after saving a built-in instance config port, the refreshed runtime seen by the supervisor uses that configured port.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test built_in_instance_config_port_can_drive_runtime_refresh --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because the start path still relies on the previously cached runtime.

- [ ] **Step 3: Write minimal implementation**

Refresh the configured OpenClaw runtime from the latest built-in config before built-in start and restart.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test built_in_instance_config_port_can_drive_runtime_refresh --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs
git commit -m "feat: refresh built-in openclaw runtime from saved config"
```

### Task 3: Verify regression coverage and desktop build health

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Run targeted Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw`
Expected: PASS with the new port-selection coverage included.

- [ ] **Step 2: Run package lint or compile verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 3: Manually inspect behavior invariants**

Confirm that built-in instance URLs still derive from `openclaw.json`, gateway bridge calls still use `runtime.gateway_port`, and busy-port fallback still rewrites config.

- [ ] **Step 4: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs docs/superpowers/specs/2026-03-21-openclaw-built-in-port-design.md docs/superpowers/plans/2026-03-21-openclaw-built-in-port-implementation-plan.md
git commit -m "feat: support configurable built-in openclaw ports"
```
