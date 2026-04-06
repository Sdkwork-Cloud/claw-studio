# Claw One Host Runtime Multi-Shell Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge `desktop`, `server`, `docker`, and `kubernetes` onto one canonical Rust host runtime, one `/claw/*` API model, one endpoint-governance system, and one browser-facing transport model.

**Architecture:** Implement the convergence in phased slices that are independently testable and releasable. First freeze shared contracts and host-runtime semantics, then centralize endpoint and OpenClaw control services in Rust host-core, then embed the canonical host server into desktop and migrate browser flows from bridge-first to HTTP-first. Treat storage, cache, plugin runtime, service lifecycle, and release packaging as productization layers on top of the same host runtime instead of separate architectures.

**Tech Stack:** Rust (`axum`, `tokio`, `serde`, `clap`, existing host-core/server/desktop crates), TypeScript/React, Tauri 2, pnpm workspace packages, existing release scripts and GitHub workflows, existing docs/OpenAPI publication pipeline.

---

## File Structure

### Existing files to modify

- `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- `packages/sdkwork-claw-server/src-host/src/config.rs`
- `packages/sdkwork-claw-server/src-host/src/cli.rs`
- `packages/sdkwork-claw-server/src/index.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-claw-desktop/src/index.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
- `packages/sdkwork-claw-core/src/platform/index.ts`
- `packages/sdkwork-claw-core/src/services/manageInstallationService.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- `.github/workflows/release-reusable.yml`
- `scripts/release/package-release-assets.mjs`
- `scripts/release/release-profiles.mjs`
- `deploy/docker/README.md`
- `deploy/kubernetes/README.md`
- `deploy/kubernetes/values.yaml`
- `deploy/kubernetes/templates/deployment.yaml`
- `docs/guide/application-modes.md`
- `docs/reference/api-reference.md`
- `docs/reference/environment.md`
- `docs/reference/claw-server-runtime.md`
- `docs/zh-CN/guide/application-modes.md`
- `docs/zh-CN/reference/api-reference.md`
- `docs/zh-CN/reference/environment.md`
- `docs/zh-CN/reference/claw-server-runtime.md`

### New files to create

- `packages/sdkwork-claw-host-core/src-host/src/host_endpoints.rs`
- `packages/sdkwork-claw-host-core/src-host/src/port_allocator.rs`
- `packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs`
- `packages/sdkwork-claw-host-core/src-host/src/cache/mod.rs`
- `packages/sdkwork-claw-host-core/src-host/src/plugins/mod.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/manage_host_endpoints.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- `packages/sdkwork-claw-core/src/services/hostEndpointService.ts`
- `packages/sdkwork-claw-core/src/services/hostRuntimeModeService.ts`
- `packages/sdkwork-claw-core/src/services/hostPortSettingsService.ts`
- `packages/sdkwork-claw-settings/src/HostRuntimeSettings.tsx`
- `scripts/check-host-runtime-convergence.mjs`
- `scripts/check-doc-api-drift.mjs`
- `scripts/check-release-closure.mjs`

### New or expanded tests

- `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts`
- `packages/sdkwork-claw-core/src/services/hostEndpointService.test.ts`
- `packages/sdkwork-claw-core/src/services/hostPortSettingsService.test.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/hostRuntimeSettings.test.tsx`
- `scripts/sdkwork-host-runtime-contract.test.ts`
- `scripts/check-server-platform-foundation.mjs`
- `scripts/check-desktop-platform-foundation.mjs`
- `scripts/check-host-runtime-convergence.mjs`
- `scripts/check-doc-api-drift.mjs`
- `scripts/check-release-closure.mjs`

## Phase Structure

This program is intentionally split into independently shippable phases. Do not collapse phases unless all tests and documentation gates for the earlier phase are green.

### Task 1: Freeze the authoritative host-runtime contract

**Files:**

- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts`
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Add assertions for:

- canonical host endpoint records with `requestedPort` and `activePort`
- canonical OpenClaw manage resources
- host-mode metadata support for `server` and `desktopCombined`
- browser bridge behavior that does not reject desktop-hosted browser mode

- [ ] **Step 2: Run the focused contract tests and verify they fail**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
```

Expected: FAIL because the contract and bridge semantics are not fully aligned yet.

- [ ] **Step 3: Add the minimal shared contract fields and mode semantics**

Minimum additions:

- `ManageHostEndpointRecord`
- canonical OpenClaw manage request and response contracts
- runtime-mode metadata that distinguishes shell mode from transport mode

- [ ] **Step 4: Re-run the focused contract tests**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts scripts/sdkwork-host-runtime-contract.test.ts
git commit -m "feat: freeze host runtime convergence contracts"
```

### Task 2: Centralize endpoint registry and port governance in host-core

**Files:**

- Create: `packages/sdkwork-claw-host-core/src-host/src/port_allocator.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/host_endpoints.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests for requested and active port behavior**

Add tests that verify:

- requested port is preserved even when fallback chooses another active port
- loopback and explicit-host allocation policies are deterministic
- endpoint registry can publish canonical records for server and desktop-owned endpoints

- [ ] **Step 2: Run host-core and focused shell tests to verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml port
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml host_endpoint
```

Expected: FAIL because allocator and registry do not exist as shared services yet.

- [ ] **Step 3: Implement the minimal allocator and registry**

Required responsibilities:

- endpoint id registration
- conflict-aware allocation
- loopback-only flag
- requested versus active port projection
- stable endpoint metadata for docs and UI

- [ ] **Step 4: Re-run the focused Rust tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml port
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml host_endpoint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host/src/port_allocator.rs packages/sdkwork-claw-host-core/src-host/src/host_endpoints.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: centralize host endpoint registry and port governance"
```

### Task 3: Make OpenClaw control a canonical host-core capability

**Files:**

- Create: `packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`

- [ ] **Step 1: Write the failing Rust tests for OpenClaw runtime and gateway projection**

Add tests that verify:

- runtime projection is returned from host-core
- gateway projection is returned from host-core
- private gateway invocation stays behind host-owned validation

- [ ] **Step 2: Run the focused OpenClaw control tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml openclaw
```

Expected: FAIL because the canonical control-plane service does not exist in host-core yet.

- [ ] **Step 3: Implement the minimal host-core OpenClaw control-plane service**

Rules:

- host-core owns business projection
- shell-specific runtime resolution stays behind injected adapters
- direct renderer-facing gateway business calls are not allowed to grow further

- [ ] **Step 4: Re-run the focused OpenClaw control tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml openclaw
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs packages/sdkwork-claw-desktop/src/desktop/catalog.ts
git commit -m "feat: add canonical host core openclaw control plane"
```

### Task 4: Publish complete canonical manage routes from the server shell

**Files:**

- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_host_endpoints.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing Rust route tests**

Add tests that verify:

- `/claw/manage/v1/host-endpoints`
- `/claw/manage/v1/openclaw/runtime`
- `/claw/manage/v1/openclaw/gateway`
- `/claw/manage/v1/openclaw/gateway/invoke`

are published, authorized, and included in OpenAPI.

- [ ] **Step 2: Run the server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_openclaw
```

Expected: FAIL because the full route family is not yet canonicalized.

- [ ] **Step 3: Implement the minimal route family and OpenAPI publication**

Requirements:

- route handlers delegate to host-core
- auth uses manage policy
- OpenAPI lists all canonical manage routes
- browser shell metadata continues to publish authoritative base paths

- [ ] **Step 4: Re-run the server tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_openclaw
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_host_endpoints.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/http/static_assets.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: publish canonical host manage routes"
```

### Task 5: Embed the canonical host server into desktop mode

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Write the failing desktop Rust tests**

Add tests that verify:

- desktop boot starts an embedded canonical host server
- boot resolves a loopback endpoint and publishes active host endpoint metadata
- host mode still reports `desktopCombined`

- [ ] **Step 2: Run the focused desktop tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host
```

Expected: FAIL because the embedded canonical host server layer does not exist yet.

- [ ] **Step 3: Implement the minimal embedded host boot sequence**

Requirements:

- desktop boots host runtime before UI consumption
- desktop publishes resolved base URL and ports
- desktop keeps loopback-only default
- shell-only Tauri features remain available

- [ ] **Step 4: Re-run the focused desktop tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs
git commit -m "feat: embed canonical host server into desktop"
```

### Task 6: Switch browser-side host access from bridge-first to HTTP-first

**Files:**

- Modify: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/bootstrap/bootstrapShellRuntime.ts`
- Modify: `packages/sdkwork-claw-core/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/index.ts`

- [ ] **Step 1: Write the failing TypeScript tests for desktop-hosted browser mode**

Add tests that verify:

- browser bridge installs against desktop-hosted metadata
- host-owned manage APIs resolve through HTTP in both desktop and server modes
- legacy desktop bridge methods become shell-only or transitional wrappers

- [ ] **Step 2: Run the focused TypeScript tests and verify they fail**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts
```

Expected: FAIL because desktop browser mode is still not treated as a canonical HTTP host surface.

- [ ] **Step 3: Implement the minimal HTTP-first bridge behavior**

Requirements:

- host-mode-aware browser bridge
- same transport path for authoritative business and manage APIs
- Tauri command reduced to shell-only features or migration stubs

- [ ] **Step 4: Re-run the focused TypeScript tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-infrastructure/src/platform/webManage.ts packages/sdkwork-claw-shell/src/application/bootstrap/bootstrapShellRuntime.ts packages/sdkwork-claw-core/src/platform/index.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts packages/sdkwork-claw-desktop/src/index.ts
git commit -m "feat: move browser host access to http-first runtime bridge"
```

### Task 7: Expose host runtime mode and endpoint governance in settings

**Files:**

- Create: `packages/sdkwork-claw-core/src/services/hostEndpointService.ts`
- Create: `packages/sdkwork-claw-core/src/services/hostRuntimeModeService.ts`
- Create: `packages/sdkwork-claw-core/src/services/hostPortSettingsService.ts`
- Create: `packages/sdkwork-claw-settings/src/HostRuntimeSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/hostRuntimeSettings.test.tsx`

- [ ] **Step 1: Write the failing frontend tests**

Add tests that verify:

- settings show requested and active ports
- desktop can display embedded host runtime status
- port conflict fallback is represented clearly
- settings no longer rely on desktop-only bridge-specific assumptions

- [ ] **Step 2: Run the focused frontend tests and verify they fail**

Run:

```bash
pnpm --filter @sdkwork/claw-settings lint
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts
```

Expected: FAIL because settings do not yet consume the converged host endpoint model.

- [ ] **Step 3: Implement the minimal settings surface**

Requirements:

- runtime-mode display
- host endpoint table
- requested versus active port visibility
- enable or disable desktop browser-management exposure controls when supported

- [ ] **Step 4: Re-run the focused frontend tests**

Run:

```bash
pnpm --filter @sdkwork/claw-settings lint
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-core/src/services/hostEndpointService.ts packages/sdkwork-claw-core/src/services/hostRuntimeModeService.ts packages/sdkwork-claw-core/src/services/hostPortSettingsService.ts packages/sdkwork-claw-settings/src/HostRuntimeSettings.tsx packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/KernelCenter.tsx packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts packages/sdkwork-claw-settings/src/hostRuntimeSettings.test.tsx
git commit -m "feat: expose host runtime governance in settings"
```

### Task 8: Finish standalone server shell productization and service control closure

**Files:**

- Modify: `packages/sdkwork-claw-server/src-host/src/cli.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/config.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `packages/sdkwork-claw-server/src/index.ts`

- [ ] **Step 1: Write failing tests for server service lifecycle and endpoint projection**

Add tests that verify:

- `service install`
- `service start`
- `service stop`
- `service restart`
- `service status`

reuse the same config precedence and resolved endpoint semantics.

- [ ] **Step 2: Run the focused server tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service
```

Expected: FAIL because service and runtime convergence is incomplete.

- [ ] **Step 3: Implement the minimal service and CLI closure**

Requirements:

- consistent config path resolution
- consistent endpoint projection
- system service metadata and command surfaces aligned across platforms

- [ ] **Step 4: Re-run the focused server tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/cli.rs packages/sdkwork-claw-server/src-host/src/config.rs packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-server/src/index.ts
git commit -m "feat: close standalone server lifecycle and service controls"
```

### Task 9: Close release and deployment parity for docker and kubernetes

**Files:**

- Modify: `.github/workflows/release-reusable.yml`
- Modify: `scripts/release/package-release-assets.mjs`
- Modify: `scripts/release/release-profiles.mjs`
- Modify: `deploy/docker/README.md`
- Modify: `deploy/kubernetes/README.md`
- Modify: `deploy/kubernetes/values.yaml`
- Modify: `deploy/kubernetes/templates/deployment.yaml`
- Create: `scripts/check-release-closure.mjs`

- [ ] **Step 1: Write the failing release-closure checks**

Add checks that verify:

- kubernetes bundle references immutable image tags or digests
- release workflow couples chart packaging to the matching built image version
- deployment docs do not describe `latest` as the formal release mechanism

- [ ] **Step 2: Run the focused release checks and verify they fail**

Run:

```bash
node scripts/check-release-closure.mjs
```

Expected: FAIL because current chart defaults and workflow closure are incomplete.

- [ ] **Step 3: Implement the minimal release closure**

Requirements:

- immutable version stamping
- chart and image version closure
- family-specific artifact metadata
- docs that match actual packaged behavior

- [ ] **Step 4: Re-run the focused release checks**

Run:

```bash
node scripts/check-release-closure.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release-reusable.yml scripts/release/package-release-assets.mjs scripts/release/release-profiles.mjs deploy/docker/README.md deploy/kubernetes/README.md deploy/kubernetes/values.yaml deploy/kubernetes/templates/deployment.yaml scripts/check-release-closure.mjs
git commit -m "feat: close docker and kubernetes release parity"
```

### Task 10: Productize storage, cache, and plugin attachment points

**Files:**

- Create: `packages/sdkwork-claw-host-core/src-host/src/cache/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/plugins/mod.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `docs/reference/environment.md`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/zh-CN/reference/environment.md`
- Modify: `docs/zh-CN/reference/claw-server-runtime.md`

- [ ] **Step 1: Write failing tests for provider SPI readiness**

Add tests that verify:

- active storage provider is explicit
- planned providers expose configuration keys and readiness posture
- cache provider wiring can be resolved without leaking direct business dependencies
- plugin registration exposes capability and health metadata

- [ ] **Step 2: Run the focused Rust tests and verify they fail**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml provider
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml state_store
```

Expected: FAIL because cache and plugin attachment layers are not fully shaped.

- [ ] **Step 3: Implement the minimal productization interfaces**

Scope for this phase:

- explicit storage provider metadata
- explicit cache provider metadata
- plugin capability registry contract
- no premature full runtime plugin sandboxing beyond the minimal boundary

- [ ] **Step 4: Re-run the focused Rust tests**

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml provider
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml state_store
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host/src/cache/mod.rs packages/sdkwork-claw-host-core/src-host/src/plugins/mod.rs packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs packages/sdkwork-claw-server/src-host/src/bootstrap.rs docs/reference/environment.md docs/reference/claw-server-runtime.md docs/zh-CN/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md
git commit -m "feat: productize host storage cache and plugin seams"
```

### Task 11: Eliminate documentation and API drift

**Files:**

- Create: `scripts/check-doc-api-drift.mjs`
- Modify: `docs/guide/application-modes.md`
- Modify: `docs/reference/api-reference.md`
- Modify: `docs/reference/environment.md`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/zh-CN/guide/application-modes.md`
- Modify: `docs/zh-CN/reference/api-reference.md`
- Modify: `docs/zh-CN/reference/environment.md`
- Modify: `docs/zh-CN/reference/claw-server-runtime.md`

- [ ] **Step 1: Write the failing documentation drift check**

The check must assert:

- hand-written API docs mention canonical manage routes that actually exist
- host-mode docs match current runtime behavior
- auth docs match actual route protection scopes

- [ ] **Step 2: Run the drift check and verify it fails**

Run:

```bash
node scripts/check-doc-api-drift.mjs
```

Expected: FAIL because documentation currently lags implementation in multiple places.

- [ ] **Step 3: Update the docs and install the drift guard**

Requirements:

- English and Chinese docs both updated
- runtime-mode table reflects desktop embedded-host model
- API reference reflects canonical manage routes
- environment docs reflect actual auth and state-store posture

- [ ] **Step 4: Re-run the drift check**

Run:

```bash
node scripts/check-doc-api-drift.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-doc-api-drift.mjs docs/guide/application-modes.md docs/reference/api-reference.md docs/reference/environment.md docs/reference/claw-server-runtime.md docs/zh-CN/guide/application-modes.md docs/zh-CN/reference/api-reference.md docs/zh-CN/reference/environment.md docs/zh-CN/reference/claw-server-runtime.md
git commit -m "docs: align runtime and api documentation with canonical host model"
```

### Task 12: Run full validation and establish release readiness gates

**Files:**

- Create: `scripts/check-host-runtime-convergence.mjs`
- Modify: `package.json` if a composite verification script is needed

- [ ] **Step 1: Write the failing convergence gate script**

The composite gate must verify:

- contracts
- docs
- release closure
- focused Rust and TypeScript integration checks

- [ ] **Step 2: Run the composite gate and verify it fails before wiring**

Run:

```bash
node scripts/check-host-runtime-convergence.mjs
```

Expected: FAIL until all required checks are wired.

- [ ] **Step 3: Implement the final convergence gate**

Minimum composed checks:

```bash
pnpm lint
pnpm build
cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
node scripts/check-doc-api-drift.mjs
node scripts/check-release-closure.mjs
```

- [ ] **Step 4: Run the composite gate and verify it passes**

Run:

```bash
node scripts/check-host-runtime-convergence.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-host-runtime-convergence.mjs package.json
git commit -m "chore: add host runtime convergence release gate"
```

## Test and Validation Matrix

### Contract tests

- `scripts/sdkwork-host-runtime-contract.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts`

Purpose:

- freeze shape and semantics of mode, endpoint, and manage contracts

### Rust host-core tests

- `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Purpose:

- allocator
- endpoint registry
- OpenClaw control plane
- provider metadata
- SPI seams

### Rust server tests

- `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Purpose:

- manage routes
- OpenAPI
- auth
- service lifecycle
- config and runtime projection

### Rust desktop tests

- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Purpose:

- embedded host boot
- shell bootstrap
- endpoint publication
- migration off business-critical Tauri bridge paths

### Frontend and workspace checks

- `pnpm lint`
- `pnpm build`
- targeted package lint or typecheck where needed

Purpose:

- contract adoption
- settings and service integration
- package-boundary correctness

### Documentation checks

- `node scripts/check-doc-api-drift.mjs`

Purpose:

- prevent docs from lagging implementation again

### Release checks

- `node scripts/check-release-closure.mjs`

Purpose:

- ensure docker and kubernetes artifacts are version-closed

### Composite readiness check

- `node scripts/check-host-runtime-convergence.mjs`

Purpose:

- make the convergence executable as a release gate

## Manual Verification Checklist

- Desktop starts and exposes a loopback canonical host endpoint.
- Desktop WebView and external browser both work against the same `/claw/*` host APIs.
- OpenClaw runtime and gateway status are visible through canonical manage routes.
- Requested and active ports are both visible in settings.
- Port conflicts resolve predictably and the UI reflects the resolved endpoint.
- Standalone server service commands use the same runtime configuration and endpoint projection.
- Docker deployment serves the browser shell and canonical host routes successfully.
- Kubernetes chart deploys the version-matched image and serves the same canonical routes.
- English and Chinese docs match the behavior of the shipped runtime.

## Rollout Strategy

### Safe order

1. Contract freeze
2. Host-core convergence
3. Server route closure
4. Desktop embedded host
5. Browser transport migration
6. Settings and observability
7. Service lifecycle
8. Release closure
9. Provider SPI productization
10. Final documentation and convergence gate

### Guardrails

- Do not delete legacy desktop business commands until equivalent `/claw/*` flows pass integration checks.
- Do not widen desktop default exposure beyond loopback in this plan.
- Do not ship kubernetes assets with `latest` image defaults after release closure work begins.
- Do not add new business features to legacy transport paths during migration.

## Definition of Done

This plan is complete only when:

- desktop and server share one authoritative host-runtime contract
- browser business flows use the same canonical HTTP APIs in both shells
- legacy Tauri bridge usage is reduced to shell-only responsibilities
- endpoint and port governance are centralized and observable
- release artifacts are version-closed
- docs, OpenAPI, and implementation remain aligned
- the composite convergence gate passes
