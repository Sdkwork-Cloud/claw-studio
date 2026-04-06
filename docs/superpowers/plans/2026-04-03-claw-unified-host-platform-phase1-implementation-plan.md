# Claw Unified Host Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first stable implementation slice of the unified Claw host platform: shared Rust host core, server shell, desktop-compatible combined mode, internal node-session endpoints, desired-state projection, and rollout promotion control plane.

**Architecture:** Phase 1 intentionally narrows scope to the parts already stabilized by the spec set. The implementation should create one shared Rust host core used by both `desktop` and `server`, expose `/claw/internal/v1/*` and `/claw/manage/v1/rollouts/*`, and reuse the existing browser product surface instead of creating a second frontend. Plugin artifact transport and final sealed-secret wire format stay out of scope for this phase.

**Tech Stack:** Rust (`axum`, `tokio`, `tower`, `serde`, `reqwest`, `rusqlite`, `sqlx`-ready interfaces), Tauri desktop runtime, TypeScript, React, pnpm workspace packages, existing `@sdkwork/claw-*` package graph.

---

## Scope Check

This plan intentionally covers one stable vertical slice only:

- shared Rust host core
- new `sdkwork-claw-server` host shell
- desktop combined-mode integration on the same host core
- host-neutral contracts and rollout read models
- minimal browser management wiring using existing feature packages

Do not mix in these deferred items:

- plugin artifact or package transport
- exact `sealedEnvelope` wire format
- non-node rollout families
- native `/claw/api/v1/*` public product APIs beyond what is needed to boot the host platform

Those should be separate follow-up plans after Phase 1 lands.

## File Structure

Target structure for the Phase 1 implementation:

- Shared Rust host core package:
  - Create: `packages/sdkwork-claw-host-core/package.json`
  - Create: `packages/sdkwork-claw-host-core/src/index.ts`
  - Create: `packages/sdkwork-claw-host-core/src-host/Cargo.toml`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/domain/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/domain/node.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/domain/rollout.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/internal/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/internal/error.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/projection/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/projection/compiler.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/rollout/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/rollout/engine.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/storage/sqlite.rs`
- Server shell package:
  - Create: `packages/sdkwork-claw-server/package.json`
  - Create: `packages/sdkwork-claw-server/.env.example`
  - Create: `packages/sdkwork-claw-server/src/index.ts`
  - Create: `packages/sdkwork-claw-server/src-host/Cargo.toml`
  - Create: `packages/sdkwork-claw-server/src-host/src/main.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/health.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- Desktop integration:
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`
- Host-neutral TypeScript contracts and runtime bridge:
  - Create: `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
  - Create: `packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
  - Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
  - Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
  - Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- Core services and stores:
  - Create: `packages/sdkwork-claw-core/src/services/hostPlatformService.ts`
  - Create: `packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
  - Create: `packages/sdkwork-claw-core/src/services/rolloutService.ts`
  - Create: `packages/sdkwork-claw-core/src/services/rolloutService.test.ts`
  - Create: `packages/sdkwork-claw-core/src/stores/useRolloutStore.ts`
  - Modify: `packages/sdkwork-claw-core/src/services/index.ts`
- Browser product surface:
  - Modify: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
  - Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
  - Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
  - Modify: `packages/sdkwork-claw-instances/src/pages/Nodes.tsx`
  - Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts`
  - Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
  - Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
  - Modify: `packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts`
  - Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Workspace and verification scripts:
  - Modify: `package.json`
  - Modify: `scripts/check-sdkwork-claw-structure.mjs`
  - Modify: `scripts/check-sdkwork-claw-hosts.mjs`
  - Modify: `scripts/sdkwork-host-runtime-contract.test.ts`
  - Create: `scripts/check-server-platform-foundation.mjs`
- Docs:
  - Create: `docs/reference/claw-server-runtime.md`
  - Create: `docs/reference/claw-rollout-api.md`

### Task 1: Scaffold Shared Host Core And Server Shell Packages

**Files:**

- Create: `packages/sdkwork-claw-host-core/package.json`
- Create: `packages/sdkwork-claw-host-core/src/index.ts`
- Create: `packages/sdkwork-claw-host-core/src-host/Cargo.toml`
- Create: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Create: `packages/sdkwork-claw-server/package.json`
- Create: `packages/sdkwork-claw-server/.env.example`
- Create: `packages/sdkwork-claw-server/src/index.ts`
- Create: `packages/sdkwork-claw-server/src-host/Cargo.toml`
- Create: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `package.json`
- Modify: `scripts/check-sdkwork-claw-structure.mjs`
- Modify: `scripts/check-sdkwork-claw-hosts.mjs`
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write failing host-structure checks for the new packages**

```ts
assert.ok(exists('packages/sdkwork-claw-server/package.json'));
assert.ok(exists('packages/sdkwork-claw-server/src-host/Cargo.toml'));
assert.ok(exists('packages/sdkwork-claw-host-core/src-host/Cargo.toml'));
```

- [ ] **Step 2: Run the focused structure checks**

Run: `node scripts/check-sdkwork-claw-structure.mjs && node scripts/check-sdkwork-claw-hosts.mjs && node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`

Expected: FAIL because `sdkwork-claw-server` and `sdkwork-claw-host-core` do not exist yet.

- [ ] **Step 3: Scaffold the shared host-core and server package surfaces**

```json
{
  "name": "@sdkwork/claw-server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "cargo run --manifest-path src-host/Cargo.toml",
    "build": "cargo build --manifest-path src-host/Cargo.toml --release"
  }
}
```

- [ ] **Step 4: Add root workspace commands for server development**

```json
{
  "scripts": {
    "server:dev": "pnpm --dir packages/sdkwork-claw-server dev",
    "server:build": "pnpm --dir packages/sdkwork-claw-server build"
  }
}
```

- [ ] **Step 5: Re-run the focused structure checks**

Run: `node scripts/check-sdkwork-claw-structure.mjs && node scripts/check-sdkwork-claw-hosts.mjs && node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`

Expected: PASS for the new package-presence assertions and FAIL later on missing host behavior.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts packages/sdkwork-claw-host-core packages/sdkwork-claw-server
git commit -m "feat: scaffold shared host core and server shell"
```

### Task 2: Lock Host-Neutral Manage And Internal Contracts

**Files:**

- Create: `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

- [ ] **Step 1: Write failing TypeScript tests for rollout and internal host bridge contracts**

```ts
await runTest('desktop bridge exposes rollout preview and internal status methods', async () => {
  assert.equal(typeof bridge.studio.previewRollout, 'function');
  assert.equal(typeof bridge.studio.getHostPlatformStatus, 'function');
});
```

- [ ] **Step 2: Run the focused bridge test**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

Expected: FAIL because the new bridge methods and contracts do not exist.

- [ ] **Step 3: Add host-neutral contract families for manage and internal APIs**

```ts
export interface ManageRolloutRecord {
  id: string;
  phase: 'draft' | 'ready' | 'promoting' | 'paused' | 'completed' | 'failed';
  attempt: number;
}

export interface InternalErrorEnvelope {
  error: {
    code: string;
    category: string;
    retryable: boolean;
    resolution: string;
  };
}
```

- [ ] **Step 4: Extend the desktop bridge catalog and platform registry**

```ts
previewRollout(input: PreviewRolloutRequest): Promise<ManageRolloutPreview>;
startRollout(rolloutId: string): Promise<ManageRolloutRecord>;
getHostPlatformStatus(): Promise<HostPlatformStatusRecord>;
```

- [ ] **Step 5: Re-run the focused bridge test**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-infrastructure packages/sdkwork-claw-desktop/src/desktop
git commit -m "feat: add host-neutral manage and internal contracts"
```

### Task 3: Implement The Shared Rust Host-Core Domain

**Files:**

- Create: `packages/sdkwork-claw-host-core/src-host/src/domain/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/domain/node.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/domain/rollout.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/internal/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/internal/error.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/projection/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/projection/compiler.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/rollout/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/rollout/engine.rs`

- [ ] **Step 1: Write failing Rust unit tests for internal errors, projection revisioning, and rollout preflight**

```rust
#[test]
fn rollout_preflight_blocks_node_without_required_capability() {
    let outcome = preflight_target(&target, &policy);
    assert_eq!(outcome, PreflightOutcome::BlockedByCapability);
}
```

- [ ] **Step 2: Run the focused Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Expected: FAIL because the host-core modules and types do not exist.

- [ ] **Step 3: Implement the stable domain primitives**

```rust
pub enum PreflightOutcome {
    Admissible,
    AdmissibleDegraded,
    BlockedByVersion,
    BlockedByCapability,
    BlockedByTrust,
    BlockedByPolicy,
}
```

- [ ] **Step 4: Add the initial projector and rollout-engine skeleton**

```rust
pub struct DesiredStateProjection {
    pub node_id: String,
    pub desired_state_revision: u64,
    pub desired_state_hash: String,
}
```

- [ ] **Step 5: Re-run the host-core Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host
git commit -m "feat: add shared host core domain and rollout engine skeleton"
```

### Task 4: Stand Up The Server Shell And Native Axum Routes

**Files:**

- Create: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/health.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- Create: `scripts/check-server-platform-foundation.mjs`

- [ ] **Step 1: Write a failing server foundation check and one Rust integration test**

```rust
#[tokio::test]
async fn health_route_returns_ok() {
    let app = build_router(test_state());
    let response = app.oneshot(Request::get("/claw/health/live").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
```

- [ ] **Step 2: Run the focused server checks**

Run: `node scripts/check-server-platform-foundation.mjs && cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: FAIL because the server router and package foundation do not exist yet.

- [ ] **Step 3: Implement the server bootstrap and mount the minimal route families**

```rust
Router::new()
    .nest("/claw/health", health_routes())
    .nest("/claw/internal/v1", internal_node_session_routes(state.clone()))
    .nest("/claw/manage/v1", manage_rollout_routes(state.clone()))
```

- [ ] **Step 4: Serve the existing web artifact instead of building a second frontend**

```rust
let assets = StaticAssetMount::from_web_dist("../sdkwork-claw-web/dist");
```

- [ ] **Step 5: Re-run the server checks**

Run: `node scripts/check-server-platform-foundation.mjs && cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-server scripts/check-server-platform-foundation.mjs
git commit -m "feat: add server shell with health internal and rollout routes"
```

### Task 5: Rewire Desktop Combined Mode Onto The Shared Host Core

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`

- [ ] **Step 1: Write a failing desktop-focused contract test for combined-mode host status and rollout preview**

```ts
await runTest('desktop studio bridge returns host platform status and rollout preview from shared host core', async () => {
  const status = await bridge.studio.getHostPlatformStatus();
  assert.equal(status.mode, 'desktopCombined');
});
```

- [ ] **Step 2: Run the focused desktop bridge test**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

Expected: FAIL because the desktop commands are not wired to the shared host core yet.

- [ ] **Step 3: Add the host-core dependency and combined-mode bootstrap**

```toml
[dependencies]
sdkwork-claw-host-core = { path = "../../sdkwork-claw-host-core/src-host" }
```

- [ ] **Step 4: Expose combined-mode host and rollout commands through the existing studio command surface**

```rust
#[tauri::command]
pub async fn preview_rollout(...) -> Result<ManageRolloutPreview> { ... }
```

- [ ] **Step 5: Re-run the focused desktop bridge test**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri packages/sdkwork-claw-desktop/src/desktop
git commit -m "feat: wire desktop combined mode to shared host core"
```

### Task 6: Add Core Services, Stores, And Minimal Browser Management Surfaces

**Files:**

- Create: `packages/sdkwork-claw-core/src/services/hostPlatformService.ts`
- Create: `packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
- Create: `packages/sdkwork-claw-core/src/services/rolloutService.ts`
- Create: `packages/sdkwork-claw-core/src/services/rolloutService.test.ts`
- Create: `packages/sdkwork-claw-core/src/stores/useRolloutStore.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`
- Modify: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/pages/Nodes.tsx`
- Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`

- [ ] **Step 1: Write failing service tests for host status and rollout listing**

```ts
await runTest('rolloutService lists rollout summaries and target failures', async () => {
  const rollouts = await rolloutService.list();
  assert.equal(Array.isArray(rollouts.items), true);
});
```

- [ ] **Step 2: Run the focused core and feature tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/rolloutService.test.ts && node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts && node --experimental-strip-types packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`

Expected: FAIL because the shared rollout and host services do not exist yet.

- [ ] **Step 3: Implement the minimal browser-facing service wrappers and store**

```ts
export class RolloutService {
  list() {
    return platform.manage.listRollouts();
  }
}
```

- [ ] **Step 4: Add minimal UI read-model usage without creating a second admin frontend**

```tsx
<Route path="/instances/nodes" element={<Nodes />} />
<Route path="/settings/kernel" element={<KernelCenter />} />
```

- [ ] **Step 5: Re-run the focused core and feature tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/rolloutService.test.ts && node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts && node --experimental-strip-types packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-core packages/sdkwork-claw-settings packages/sdkwork-claw-instances packages/sdkwork-claw-shell
git commit -m "feat: add rollout and host management browser surfaces"
```

### Task 7: Verification, Documentation, And Freeze The Phase 1 Gate

**Files:**

- Create: `docs/reference/claw-server-runtime.md`
- Create: `docs/reference/claw-rollout-api.md`

- [ ] **Step 1: Document the exact Phase 1 runtime commands, ports, and route families**

```md
- `/claw/health/*`
- `/claw/internal/v1/node-sessions/*`
- `/claw/manage/v1/rollouts/*`
```

- [ ] **Step 2: Run workspace verification**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 3: Run focused Rust verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml && cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 4: Run focused browser and desktop verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/rolloutService.test.ts && node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/reference
git commit -m "docs: add phase1 server runtime and rollout references"
```

## Deferred Follow-Up Plans

These should remain out of this plan and become separate plans after Phase 1 is working:

- plugin artifact and package transport
- exact `sealedEnvelope` wire format and key agreement
- native `/claw/api/v1/*` and `/claw/manage/v1/*` shared public error envelope family
- non-node rollout families
