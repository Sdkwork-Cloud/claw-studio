# Claw Server Productization Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `sdkwork-claw-server` from an env-only Rust process into a productized server shell with a real CLI, file-backed configuration, and deterministic port governance.

**Architecture:** Keep the first slice narrow and honest. Do not attempt full desktop/server control-plane unification in this phase. Instead, establish the standalone server shell baseline that later phases can embed into desktop: canonical config loading, CLI subcommands, runtime-resolved listen endpoint metadata, and portable service-manifest projection hooks. The server binary remains the execution entry, while host-core continues to own reusable runtime primitives.

**Tech Stack:** Rust (`axum`, `tokio`, `serde`, `serde_json`, `clap`), existing `sdkwork-claw-server` and `sdkwork-claw-host-core` crates, workspace scripts, existing Rust integration tests in `main.rs`.

---

## File Structure

### Existing files to modify

- `packages/sdkwork-claw-server/src-host/Cargo.toml`
- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-claw-server/.env.example`
- `packages/sdkwork-claw-server/src/index.ts`
- `docs/reference/claw-server-runtime.md`
- `docs/reference/environment.md`
- `docs/zh-CN/reference/claw-server-runtime.md`
- `docs/zh-CN/reference/environment.md`

### New files to create

- `packages/sdkwork-claw-server/src-host/src/cli.rs`
- `packages/sdkwork-claw-server/src-host/src/config.rs`
- `packages/sdkwork-claw-server/src-host/src/port_governance.rs`
- `packages/sdkwork-claw-server/src-host/src/service.rs`

### New or expanded tests

- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `scripts/check-server-platform-foundation.mjs`

### Task 1: Freeze the server CLI and config contract

**Files:**

- Create: `packages/sdkwork-claw-server/src-host/src/cli.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/config.rs`
- Modify: `packages/sdkwork-claw-server/src-host/Cargo.toml`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests for CLI parsing and config precedence**

Add tests that verify:

- `run` is the default command when no subcommand is provided
- `print-config` resolves the effective host/port/state-store values
- CLI flags override config-file values
- config-file values override environment defaults

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml cli
```

Expected: FAIL because the CLI/config modules do not exist yet.

- [ ] **Step 3: Implement the minimal CLI and config loader**

Minimum command surface:

```text
claw-server run
claw-server print-config
```

Minimum config shape:

```json
{
  "host": "127.0.0.1",
  "port": 18797,
  "dataDir": ".claw-server",
  "webDistDir": "../sdkwork-claw-web/dist",
  "stateStore": {
    "driver": "json-file",
    "sqlitePath": null,
    "postgresUrl": null,
    "postgresSchema": null
  },
  "auth": {
    "manageUsername": null,
    "managePassword": null,
    "internalUsername": null,
    "internalPassword": null
  }
}
```

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml cli
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/Cargo.toml packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-server/src-host/src/cli.rs packages/sdkwork-claw-server/src-host/src/config.rs
git commit -m "feat: add claw server cli and config loader"
```

### Task 2: Add canonical port governance for the server shell

**Files:**

- Create: `packages/sdkwork-claw-server/src-host/src/port_governance.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write failing tests for requested-port versus active-port behavior**

Add tests that verify:

- when the requested port is available, active port matches requested port
- when the requested port is busy and dynamic allocation is allowed, the server chooses an available port
- the effective runtime projection preserves both requested and active port values

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml port_governance
```

Expected: FAIL because runtime-resolved port governance does not exist yet.

- [ ] **Step 3: Implement the minimal port governance service**

Minimum fields:

```rust
pub struct ResolvedListenEndpoint {
    pub host: String,
    pub requested_port: u16,
    pub active_port: u16,
    pub base_url: String,
    pub dynamic_port: bool,
}
```

Rules:

- default server mode stays loopback-first
- an explicit requested port is preserved for operator visibility
- runtime binding may switch to an available port when configured to do so
- the effective endpoint is published to runtime status and CLI output

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml port_governance
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-server/src-host/src/port_governance.rs
git commit -m "feat: add claw server port governance"
```

### Task 3: Project portable service-manifest metadata

**Files:**

- Create: `packages/sdkwork-claw-server/src-host/src/service.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/cli.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/config.rs`
- Modify: `packages/sdkwork-claw-server/src/index.ts`

- [ ] **Step 1: Write failing tests for service metadata projection**

Add tests that verify:

- Linux system service metadata is generated with `systemd` semantics
- macOS service metadata is generated with `launchd` semantics
- Windows service metadata is generated with `windowsService` semantics
- the metadata uses the same effective executable path, config path, and runtime args as the CLI

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service
```

Expected: FAIL because service metadata projection does not exist yet.

- [ ] **Step 3: Implement the minimal service projection layer**

Initial scope:

- `service print-manifest --platform linux`
- `service print-manifest --platform macos`
- `service print-manifest --platform windows`

This slice only prints canonical service metadata and unit content. It does not yet install or control the service.

- [ ] **Step 4: Re-run the focused server tests and verify they pass**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/service.rs packages/sdkwork-claw-server/src-host/src/cli.rs packages/sdkwork-claw-server/src-host/src/config.rs packages/sdkwork-claw-server/src/index.ts
git commit -m "feat: add claw server service manifest projection"
```

### Task 4: Publish the new server-shell runtime contract

**Files:**

- Modify: `packages/sdkwork-claw-server/.env.example`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`
- Modify: `docs/zh-CN/reference/claw-server-runtime.md`
- Modify: `docs/zh-CN/reference/environment.md`
- Modify: `scripts/check-server-platform-foundation.mjs`

- [ ] **Step 1: Write the failing contract/doc checks**

Add assertions for:

- documented CLI commands
- documented config-file path support
- documented requested versus active port semantics
- documented service-manifest projection support

- [ ] **Step 2: Run the focused contract checks and verify they fail**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
```

Expected: FAIL because the documentation and contract checks do not include the new server-shell baseline yet.

- [ ] **Step 3: Update docs and checks**

Document:

- `claw-server run`
- `claw-server print-config`
- `claw-server service print-manifest --platform <platform>`
- config file layout and precedence order
- requested vs active port behavior and fallback rules

- [ ] **Step 4: Re-run the focused contract checks and verify they pass**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/.env.example docs/reference/claw-server-runtime.md docs/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md docs/zh-CN/reference/environment.md scripts/check-server-platform-foundation.mjs
git commit -m "docs: publish claw server productization phase 1 runtime contract"
```
