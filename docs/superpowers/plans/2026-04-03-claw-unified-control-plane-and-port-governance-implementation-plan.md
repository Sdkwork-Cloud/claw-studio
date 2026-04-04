# Claw Unified Control Plane and Port Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `desktop`, `server`, `container`, and `kubernetes` behave as shells over one canonical Rust control plane, route all OpenClaw management through Rust host services, and add first-class port governance with settings-based configuration.

**Architecture:** Extend the shared Rust host core so endpoint governance and OpenClaw control are canonical host services, then embed the same host HTTP surface into desktop and consume it through host-shell-generic browser and app bridges. Treat requested versus active port state as a host resource and wire settings, runtime projections, and packaging around that single source of truth.

**Tech Stack:** Rust (`axum`, `tokio`, existing host-core/server/desktop crates), TypeScript/React, existing `@sdkwork/claw-*` platform contracts, Tauri desktop runtime, existing workspace contract tests.

---

## File Structure

### Existing files to modify

- `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/startupContext.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- `packages/sdkwork-claw-core/src/services/manageInstallationService.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- `docs/reference/claw-server-runtime.md`
- `docs/reference/environment.md`
- `docs/core/release-and-deployment.md`

### New files to create

- `packages/sdkwork-claw-host-core/src-host/src/host_endpoints.rs`
- `packages/sdkwork-claw-host-core/src-host/src/port_allocator.rs`
- `packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- `packages/sdkwork-claw-core/src/services/hostEndpointService.ts`
- `packages/sdkwork-claw-core/src/services/hostPortSettingsService.ts`
- `packages/sdkwork-claw-settings/src/HostEndpointSettings.tsx`
- `scripts/check-host-endpoint-governance.mjs`

### New or expanded tests

- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- `packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts`
- `packages/sdkwork-claw-core/src/services/hostEndpointService.test.ts`
- `packages/sdkwork-claw-core/src/services/hostPortSettingsService.test.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/hostEndpointSettings.test.tsx`
- `scripts/sdkwork-host-runtime-contract.test.ts`
- `scripts/check-server-platform-foundation.mjs`
- `scripts/check-desktop-platform-foundation.mjs`

### Task 1: Freeze the canonical host endpoint contract

**Files:**

- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write the failing TypeScript contract assertions**

Add assertions for:

- host-managed endpoint records
- requested versus active port fields
- canonical OpenClaw manage resources
- desktop browser startup metadata support

Suggested assertions:

```ts
assert.match(source, /requestedPort/);
assert.match(source, /activePort/);
assert.match(source, /getOpenClawRuntime/);
assert.match(source, /invokeOpenClawGateway/);
```

- [ ] **Step 2: Run the focused contract tests and verify they fail**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
```

Expected: FAIL because the endpoint and OpenClaw contract fields are not defined yet.

- [ ] **Step 3: Add the minimal shared contract types**

Suggested shape:

```ts
export interface ManageHostEndpointRecord {
  endpointId: string;
  bindHost: string;
  requestedPort: number;
  activePort: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  loopbackOnly: boolean;
  dynamicPort: boolean;
}
```

- [ ] **Step 4: Re-run the focused contract tests and verify they pass**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts scripts/sdkwork-host-runtime-contract.test.ts
git commit -m "feat: define host endpoint governance contracts"
```

### Task 2: Add shared Rust port allocation and endpoint registry services

**Files:**

- Create: `packages/sdkwork-claw-host-core/src-host/src/port_allocator.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/host_endpoints.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests for requested-versus-active port behavior**

Suggested test sketch:

```rust
#[test]
fn endpoint_registry_preserves_requested_port_when_conflict_forces_dynamic_port() {
    let record = allocate_endpoint(/* busy port */);
    assert_eq!(record.requested_port, busy_port);
    assert_ne!(record.active_port, Some(busy_port));
    assert!(record.dynamic_port);
}
```

- [ ] **Step 2: Run host-core tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml
```

Expected: FAIL because allocator and endpoint registry do not exist yet.

- [ ] **Step 3: Implement the minimal allocator and registry**

Provide:

- one allocator service for loopback and explicit host binding
- one endpoint registry that stores requested and active values
- projection helpers for runtime and manage APIs

- [ ] **Step 4: Re-run host-core tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host/src/port_allocator.rs packages/sdkwork-claw-host-core/src-host/src/host_endpoints.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs
git commit -m "feat: add host endpoint registry and port allocator"
```

### Task 3: Expose canonical OpenClaw host APIs from Rust server

**Files:**

- Create: `packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write failing Rust route tests for canonical OpenClaw management endpoints**

Suggested test sketch:

```rust
assert_eq!(response.status(), StatusCode::OK);
assert_eq!(body["runtimeKind"], "openclaw");
```

- [ ] **Step 2: Run server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
```

Expected: FAIL because the routes and host service are missing.

- [ ] **Step 3: Implement the minimal host-owned OpenClaw control service**

Rules:

- server route delegates to host-core service
- host-core service owns validation and response mapping
- any gateway `/tools/invoke` usage stays private inside Rust services

- [ ] **Step 4: Re-run server tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: expose canonical openclaw host apis"
```

### Task 4: Embed the canonical host HTTP server into desktop

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `scripts/check-desktop-platform-foundation.mjs`

- [ ] **Step 1: Write failing desktop tests for embedded control-plane startup**

Add tests that verify:

- desktop starts the embedded host server by default
- desktop publishes a loopback browser base URL
- desktop reports `desktopCombined` browser startup metadata

- [ ] **Step 2: Run the focused desktop checks and verify failure**

Run:

```bash
node scripts/check-desktop-platform-foundation.mjs
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: FAIL because desktop does not yet boot the embedded host server.

- [ ] **Step 3: Add desktop host-server config and startup wiring**

Suggested config shape:

```rust
pub struct EmbeddedHostServerConfig {
    pub enabled: bool,
    pub bind_host: String,
    pub port: u16,
    pub auto_fallback_on_conflict: bool,
}
```

- [ ] **Step 4: Re-run desktop checks**

Run:

```bash
node scripts/check-desktop-platform-foundation.mjs
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs scripts/check-desktop-platform-foundation.mjs
git commit -m "feat: embed host control plane into desktop"
```

### Task 5: Replace desktop-only OpenClaw management transport and generalize the browser bridge

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_control.rs`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/startupContext.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`

- [ ] **Step 1: Write failing bridge tests**

Prove that:

- desktop bridge exposes canonical OpenClaw management APIs
- desktop loopback browser reads `desktopCombined` startup metadata
- browser manage/internal clients configure consistently across desktop and server shells

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
```

Expected: FAIL because the old transport and server-only browser bridge still exist.

- [ ] **Step 3: Implement the bridge swap**

Rules:

- browser and desktop clients call canonical host APIs
- any remaining direct gateway invoke stays private and adapter-only in Rust
- browser bridge supports both `server` and `desktopCombined`

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src/desktop/catalog.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_control.rs packages/sdkwork-claw-infrastructure/src/platform/startupContext.ts packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts packages/sdkwork-claw-infrastructure/src/platform/webManage.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts scripts/sdkwork-host-runtime-contract.test.ts
git commit -m "refactor: route host browser and openclaw management through canonical apis"
```

### Task 6: Add settings-backed host endpoint and port management

**Files:**

- Create: `packages/sdkwork-claw-core/src/services/hostEndpointService.ts`
- Create: `packages/sdkwork-claw-core/src/services/hostPortSettingsService.ts`
- Create: `packages/sdkwork-claw-core/src/services/hostEndpointService.test.ts`
- Create: `packages/sdkwork-claw-core/src/services/hostPortSettingsService.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Create: `packages/sdkwork-claw-settings/src/HostEndpointSettings.tsx`
- Create: `packages/sdkwork-claw-settings/src/hostEndpointSettings.test.tsx`
- Modify: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`

- [ ] **Step 1: Write failing service and UI tests**

Prove:

- requested versus active port display
- conflict indicators
- apply-and-refresh behavior
- endpoint change propagation without full reload

Suggested UI assertion:

```tsx
expect(screen.getByText('Requested Port')).toBeInTheDocument();
expect(screen.getByText('Active Port')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostEndpointService.test.ts
node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostPortSettingsService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts
```

Expected: FAIL because there is no editable host-endpoint settings surface yet.

- [ ] **Step 3: Implement the minimal host settings services and UI**

Requirements:

- show requested and active values separately
- allow editing control-plane, gateway, and local-ai-proxy endpoint settings
- refresh Kernel Center from canonical host APIs after apply

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostEndpointService.test.ts
node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostPortSettingsService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-core/src/services/hostEndpointService.ts packages/sdkwork-claw-core/src/services/hostPortSettingsService.ts packages/sdkwork-claw-core/src/services/hostEndpointService.test.ts packages/sdkwork-claw-core/src/services/hostPortSettingsService.test.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/HostEndpointSettings.tsx packages/sdkwork-claw-settings/src/hostEndpointSettings.test.tsx packages/sdkwork-claw-settings/src/KernelCenter.tsx
git commit -m "feat: add host endpoint settings and port governance ui"
```

### Task 7: Harden packaging, docs, and verification

**Files:**

- Create: `scripts/check-host-endpoint-governance.mjs`
- Modify: `scripts/check-server-platform-foundation.mjs`
- Modify: `scripts/check-desktop-platform-foundation.mjs`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`
- Modify: `docs/core/release-and-deployment.md`

- [ ] **Step 1: Write failing verification coverage for host endpoint governance**

Add checks that assert:

- desktop defaults embedded host server on
- startup metadata for desktop-hosted browser mode exists
- packaging docs describe requested versus active port behavior

- [ ] **Step 2: Run verification scripts and confirm failure**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
node scripts/check-desktop-platform-foundation.mjs
node scripts/check-host-endpoint-governance.mjs
```

Expected: FAIL until the new governance assertions and docs are present.

- [ ] **Step 3: Implement docs and verification updates**

Document:

- desktop embedded host server behavior
- loopback-only defaults
- requested versus active port semantics
- conflict fallback behavior

- [ ] **Step 4: Re-run the verification scripts**

Run:

```bash
node scripts/check-server-platform-foundation.mjs
node scripts/check-desktop-platform-foundation.mjs
node scripts/check-host-endpoint-governance.mjs
pnpm check:server
pnpm check:sdkwork-host-runtime
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-host-endpoint-governance.mjs scripts/check-server-platform-foundation.mjs scripts/check-desktop-platform-foundation.mjs docs/reference/claw-server-runtime.md docs/reference/environment.md docs/core/release-and-deployment.md
git commit -m "docs: describe unified control plane and port governance"
```
