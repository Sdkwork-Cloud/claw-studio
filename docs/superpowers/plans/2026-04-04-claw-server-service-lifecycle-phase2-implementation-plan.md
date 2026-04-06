# Claw Server Service Lifecycle Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `sdkwork-claw-server` from service-manifest projection into a real service lifecycle shell with install, start, stop, restart, and status commands.

**Architecture:** Keep the lifecycle work inside `packages/sdkwork-claw-server/src-host/src/service.rs` as a pure planning and execution layer over the already-shipped manifest projection. The CLI owns parsing, `main.rs` owns runtime/config resolution and command dispatch, and the service module owns platform detection, action planning, artifact writing, command execution, and status projection. Tests stay in `main.rs` and prove command parsing plus platform action planning without talking to a real init system.

**Tech Stack:** Rust (`clap`, `serde`, `serde_json`, `tokio` already present), existing `sdkwork-claw-server` crate, existing docs/check scripts, platform shell tools (`systemctl`, `launchctl`, `sc.exe`) projected through Rust command wrappers.

---

## File Structure

### Existing files to modify

- `packages/sdkwork-claw-server/src-host/src/cli.rs`
- `packages/sdkwork-claw-server/src-host/src/config.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `packages/sdkwork-claw-server/src-host/src/service.rs`
- `packages/sdkwork-claw-server/src/index.ts`
- `docs/reference/claw-server-runtime.md`
- `docs/reference/environment.md`
- `docs/zh-CN/reference/claw-server-runtime.md`
- `docs/zh-CN/reference/environment.md`
- `scripts/check-server-platform-foundation.mjs`

### New or expanded tests

- `packages/sdkwork-claw-server/src-host/src/main.rs`

### Task 1: Freeze the lifecycle CLI contract

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/cli.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests for lifecycle subcommands**

Add tests that verify:

- `claw-server service install`
- `claw-server service start`
- `claw-server service stop`
- `claw-server service restart`
- `claw-server service status`

all parse successfully, preserve shared overrides, and default to the current platform when no explicit platform override is provided.

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service_lifecycle_cli
```

Expected: FAIL because the lifecycle CLI surface does not exist yet.

- [ ] **Step 3: Implement the minimal lifecycle CLI parsing**

Add lifecycle subcommands under `service` while preserving the existing `print-manifest` behavior.

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service_lifecycle_cli
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/cli.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: add claw server service lifecycle cli"
```

### Task 2: Add platform action planning and execution

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/service.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/config.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `packages/sdkwork-claw-server/src/index.ts`

- [ ] **Step 1: Write the failing Rust tests for lifecycle action planning**

Add tests that verify:

- Linux install writes the projected systemd unit and plans `systemctl daemon-reload` plus `systemctl enable`
- Linux start/stop/restart/status plan the expected `systemctl` commands
- macOS lifecycle planning uses `launchctl` system-domain semantics
- Windows lifecycle planning uses `sc.exe`-style service control semantics
- lifecycle output includes the service name, manager kind, config path, and command list

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service_lifecycle
```

Expected: FAIL because the lifecycle planner/executor does not exist yet.

- [ ] **Step 3: Implement the minimal service lifecycle layer**

Add:

- platform detection for current OS
- lifecycle action planning (`install`, `start`, `stop`, `restart`, `status`)
- injectable shell-command execution and artifact writing helpers
- JSON status output from `main.rs`

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service_lifecycle
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/service.rs packages/sdkwork-claw-server/src-host/src/config.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-server/src/index.ts
git commit -m "feat: add claw server service lifecycle execution"
```

### Task 3: Publish lifecycle command documentation and checks

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`
- Modify: `docs/zh-CN/reference/claw-server-runtime.md`
- Modify: `docs/zh-CN/reference/environment.md`
- Modify: `scripts/check-server-platform-foundation.mjs`

- [ ] **Step 1: Write the failing contract/doc checks**

Add assertions for:

- `service install`
- `service start`
- `service stop`
- `service restart`
- `service status`

in both docs and the server foundation check.

- [ ] **Step 2: Run the focused contract checks and verify they fail**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
```

Expected: FAIL because lifecycle docs and checks are not documented yet.

- [ ] **Step 3: Implement the minimal doc and contract updates**

Document the command surface, current manager semantics, and the fact that desktop embedding will later reuse the same lifecycle contract.

- [ ] **Step 4: Re-run the contract checks and verify they pass**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/reference/claw-server-runtime.md docs/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md docs/zh-CN/reference/environment.md scripts/check-server-platform-foundation.mjs
git commit -m "docs: publish claw server service lifecycle contract"
```

### Task 4: Verify the lifecycle slice end to end

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/service.rs`

- [ ] **Step 1: Run the full verification set**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
pnpm check:server
pnpm docs:build
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

Expected: Rust tests pass, server foundation check passes, docs build passes, and the status command prints a structured JSON result instead of crashing.

- [ ] **Step 2: Review the touched files**

Re-read:

- `packages/sdkwork-claw-server/src-host/src/cli.rs`
- `packages/sdkwork-claw-server/src-host/src/config.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `packages/sdkwork-claw-server/src-host/src/service.rs`
- `docs/reference/claw-server-runtime.md`

Confirm the lifecycle logic still routes through one canonical runtime-config resolution path.

- [ ] **Step 3: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/cli.rs packages/sdkwork-claw-server/src-host/src/config.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-server/src-host/src/service.rs packages/sdkwork-claw-server/src/index.ts docs/reference/claw-server-runtime.md docs/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md docs/zh-CN/reference/environment.md scripts/check-server-platform-foundation.mjs docs/superpowers/plans/2026-04-04-claw-server-service-lifecycle-phase2-implementation-plan.md
git commit -m "feat: add claw server service lifecycle shell"
```
