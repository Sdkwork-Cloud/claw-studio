# Claw Control Plane Foundation Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current server slice into the first professional control-plane foundation by expanding `/claw/manage/v1/*` from rollout-only behavior to canonical installation, storage-profile, cache-profile, and node resource reads, while keeping the existing shared host-core and browser bridge architecture intact.

**Architecture:** Phase A intentionally does not implement the compatibility gateway, multi-tenant product APIs, or the final token and RBAC model. It professionalizes the current server in the smallest correct way: add canonical management resources, align browser contracts to those resources, expose truthful OpenAPI publication for the new control-plane surfaces, and keep current rollout behavior as one resource family inside a broader management domain.

**Tech Stack:** Rust (`axum`, `tokio`, `serde`, existing `sdkwork-claw-host-core`), TypeScript platform contracts and web bridge, existing React feature packages, existing manual OpenAPI publication.

---

## Scope Check

This plan covers only the first implementation slice of the professionalization baseline:

- canonical installation resource read
- canonical storage-profile resource read
- canonical cache-profile resource read
- canonical node resource read
- browser contract and service alignment for those resources
- server docs and OpenAPI publication for the new route families

This plan explicitly defers:

- management tokens and RBAC enforcement
- Redis runtime integration
- PostgreSQL runtime driver activation
- compatibility gateway routes and official alias publication
- plugin runtime execution
- tenant and workspace resource families

Those should be implemented in separate follow-up plans.

## File Structure

Target files for this slice:

- Shared TypeScript manage contracts:
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- Shared core services and consumers:
  - Create: `packages/sdkwork-claw-core/src/services/manageInstallationService.ts`
  - Create: `packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts`
  - Create: `packages/sdkwork-claw-core/src/services/manageStorageProfileService.ts`
  - Create: `packages/sdkwork-claw-core/src/services/manageStorageProfileService.test.ts`
  - Modify: `packages/sdkwork-claw-core/src/services/hostPlatformService.ts`
  - Modify: `packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
  - Modify: `packages/sdkwork-claw-core/src/services/index.ts`
- Browser feature packages:
  - Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
  - Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
  - Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts`
  - Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
- Rust host-core and server shell:
  - Create: `packages/sdkwork-claw-host-core/src-host/src/manage/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/manage/installation.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/manage/storage_profiles.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/manage/cache_profiles.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/manage/nodes.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_installation.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_storage_profiles.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_cache_profiles.rs`
  - Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_nodes.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Docs:
  - Modify: `docs/reference/claw-server-runtime.md`
  - Modify: `docs/reference/environment.md`
  - Create: `docs/reference/claw-manage-api.md`

### Task 1: Expand TypeScript Manage Contracts Beyond Rollouts

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`

- [ ] **Step 1: Write failing platform contract tests for installation, storage profiles, cache profiles, and nodes**

```ts
await runTest('default manage platform exposes canonical control-plane methods', async () => {
  const { manage } = await import('./index.ts');
  assert.equal(typeof manage.getInstallation, 'function');
  assert.equal(typeof manage.listStorageProfiles, 'function');
  assert.equal(typeof manage.listCacheProfiles, 'function');
  assert.equal(typeof manage.listNodes, 'function');
});
```

- [ ] **Step 2: Run the focused platform registry test**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Expected: FAIL because the new manage contract methods do not exist yet.

- [ ] **Step 3: Extend `ManagePlatformAPI` with canonical control-plane reads**

Add resource types and methods for:

- `getInstallation()`
- `listStorageProfiles()`
- `getStorageProfile(profileId)`
- `listCacheProfiles()`
- `getCacheProfile(profileId)`
- `listNodes()`
- `getNode(nodeId)`

Keep existing rollout methods intact.

- [ ] **Step 4: Update registry defaults so web-preview mode returns truthful empty or preview-safe resource shapes**

The default bridge should not throw for collection reads that the web preview can represent safely.

- [ ] **Step 5: Re-run the focused platform registry test**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts packages/sdkwork-claw-infrastructure/src/platform/index.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
git commit -m "feat: expand manage contracts with canonical control-plane resources"
```

### Task 2: Add Web Manage Bridge Support For Canonical Resources

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`

- [ ] **Step 1: Add failing tests for canonical manage resource fetches**

```ts
await runTest('web manage bridge calls canonical installation and profile endpoints', async () => {
  const calls: string[] = [];
  const platform = new WebManagePlatform('/claw/manage/v1', async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({}));
  });
  await platform.getInstallation();
  assert.ok(calls.some((entry) => entry.endsWith('/installation')));
});
```

- [ ] **Step 2: Run the focused bridge test**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Expected: FAIL because the new HTTP methods are not implemented.

- [ ] **Step 3: Implement canonical manage resource HTTP reads**

Expose:

- `GET /installation`
- `GET /storage-profiles`
- `GET /storage-profiles/{profileId}`
- `GET /cache-profiles`
- `GET /cache-profiles/{profileId}`
- `GET /nodes`
- `GET /nodes/{nodeId}`

- [ ] **Step 4: Keep `serverBrowserBridge` unchanged except for any required type alignment**

Do not introduce new meta tags in this slice. Reuse the existing manage base path.

- [ ] **Step 5: Re-run the focused bridge test**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-infrastructure/src/platform/webManage.ts packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
git commit -m "feat: add canonical manage resource web bridge support"
```

### Task 3: Add Core Services For Installation And Storage Profile Views

**Files:**
- Create: `packages/sdkwork-claw-core/src/services/manageInstallationService.ts`
- Create: `packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts`
- Create: `packages/sdkwork-claw-core/src/services/manageStorageProfileService.ts`
- Create: `packages/sdkwork-claw-core/src/services/manageStorageProfileService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/hostPlatformService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`

- [ ] **Step 1: Write failing service tests**

```ts
await runTest('manageInstallationService returns the control-plane installation snapshot', async () => {
  const service = createManageInstallationService({
    getManagePlatform: () => ({
      async getInstallation() {
        return { id: 'ins_local', kind: 'installation' };
      },
    } as never),
  });
  assert.equal((await service.get()).id, 'ins_local');
});
```

- [ ] **Step 2: Run the focused core service tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts`
Expected: FAIL because the new services do not exist.

- [ ] **Step 3: Implement installation and storage-profile services**

Rules:

- installation service reads canonical installation state
- storage-profile service reads and summarizes profile availability
- host platform service may compose canonical resource reads where useful, but must not duplicate manage transport logic

- [ ] **Step 4: Export the new services from the service index**

Keep package-root consumption intact.

- [ ] **Step 5: Re-run the focused core service tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/manageStorageProfileService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-core/src/services/manageInstallationService.ts packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts packages/sdkwork-claw-core/src/services/manageStorageProfileService.ts packages/sdkwork-claw-core/src/services/manageStorageProfileService.test.ts packages/sdkwork-claw-core/src/services/hostPlatformService.ts packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts packages/sdkwork-claw-core/src/services/index.ts
git commit -m "feat: add control-plane installation and storage profile services"
```

### Task 4: Add Host-Core Manage Resource Read Models

**Files:**
- Create: `packages/sdkwork-claw-host-core/src-host/src/manage/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/manage/installation.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/manage/storage_profiles.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/manage/cache_profiles.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/manage/nodes.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests for canonical manage snapshots**

Add tests that expect:

- installation snapshot exposes deployment mode and active store profile
- storage profile list exposes built-in provider availability
- cache profile list exposes an explicit empty or planned state instead of silent absence
- node list can project from the existing node-session and rollout truth

- [ ] **Step 2: Run the focused host-core tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml manage`
Expected: FAIL because the new manage modules do not exist yet.

- [ ] **Step 3: Implement host-core read-model modules for canonical manage resources**

Rules:

- keep this slice read-only
- derive current values from existing state-store and node-session truth where possible
- do not invent mutation flows in host-core yet

- [ ] **Step 4: Re-run the focused host-core tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml manage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-host-core/src-host/src/manage packages/sdkwork-claw-host-core/src-host/src/lib.rs
git commit -m "feat: add host-core canonical manage resource read models"
```

### Task 5: Mount Canonical Manage Routes In The Server Shell

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_installation.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_storage_profiles.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_cache_profiles.rs`
- Create: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_nodes.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write failing server tests for canonical manage endpoints**

Add tests that expect:

- `GET /claw/manage/v1/installation`
- `GET /claw/manage/v1/storage-profiles`
- `GET /claw/manage/v1/storage-profiles/{profileId}`
- `GET /claw/manage/v1/cache-profiles`
- `GET /claw/manage/v1/nodes`
- `GET /claw/manage/v1/nodes/{nodeId}`

Return JSON and reuse the current manage auth guard.

- [ ] **Step 2: Run the focused server tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_`
Expected: FAIL because only rollout routes are mounted.

- [ ] **Step 3: Extend `ServerState` with the host-core read-model access needed by the new route families**

Keep the state shape minimal and derived from existing host-core truth.

- [ ] **Step 4: Mount the new canonical manage route families**

Rules:

- keep `/rollouts` as one family inside `/claw/manage/v1`
- do not change the existing rollout route shapes
- use dedicated route modules per canonical resource family

- [ ] **Step 5: Re-run the focused server tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_installation.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_storage_profiles.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_cache_profiles.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_nodes.rs packages/sdkwork-claw-server/src-host/src/main.rs
git commit -m "feat: mount canonical control-plane manage routes"
```

### Task 6: Publish Truthful OpenAPI And Docs For The New Control-Plane Surface

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`
- Create: `docs/reference/claw-manage-api.md`

- [ ] **Step 1: Write failing tests for OpenAPI publication**

Add tests that expect:

- `/claw/openapi/v1.json` includes the new manage resource paths
- the manage tag description no longer implies rollout-only behavior

- [ ] **Step 2: Run the focused OpenAPI tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi`
Expected: FAIL because the new path set is not published.

- [ ] **Step 3: Extend manual OpenAPI publication for the canonical manage resource reads**

Document:

- installation
- storage profiles
- cache profiles
- nodes
- existing rollout routes

- [ ] **Step 4: Update server runtime and environment references**

Document:

- current route families
- current data driver posture
- current bootstrap auth limits
- the new canonical manage reads now available in this phase

- [ ] **Step 5: Re-run the focused OpenAPI tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml openapi`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs docs/reference/claw-server-runtime.md docs/reference/environment.md docs/reference/claw-manage-api.md
git commit -m "docs: publish canonical control-plane manage api references"
```

### Task 7: Wire Browser Consumers To Canonical Resources

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`

- [ ] **Step 1: Write failing consumer tests**

Add tests that expect:

- kernel-center presentation can surface canonical installation and storage-profile details without re-deriving them from desktop-only runtime shapes
- node inventory uses canonical control-plane node reads when available and keeps current host-platform fallbacks only where necessary

- [ ] **Step 2: Run the focused consumer tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
Expected: FAIL because the canonical manage resource inputs are not wired yet.

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
Expected: FAIL because the current service only understands the existing projection model.

- [ ] **Step 3: Update the services to prefer canonical control-plane resources**

Rules:

- do not break existing desktop combined mode behavior
- keep fallbacks explicit
- treat the old projection model as compatibility input, not the new source of truth

- [ ] **Step 4: Re-run the focused consumer tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts
git commit -m "feat: wire browser services to canonical control-plane resources"
```

### Task 8: Run End-To-End Verification For Phase A

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-claw-control-plane-foundation-phasea-implementation-plan.md`

- [ ] **Step 1: Run Rust host-core tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Expected: PASS

- [ ] **Step 2: Run server verification**

Run: `pnpm check:server`
Expected: PASS

- [ ] **Step 3: Run focused TypeScript verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
Expected: PASS

- [ ] **Step 4: Run workspace verification**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 5: Inspect the final diff**

Run: `git diff -- docs/reference/claw-manage-api.md docs/reference/claw-server-runtime.md docs/reference/environment.md packages/sdkwork-claw-core/src/services/manageInstallationService.ts packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts packages/sdkwork-claw-core/src/services/manageStorageProfileService.ts packages/sdkwork-claw-core/src/services/manageStorageProfileService.test.ts packages/sdkwork-claw-core/src/services/hostPlatformService.ts packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts packages/sdkwork-claw-core/src/services/index.ts packages/sdkwork-claw-host-core/src-host/src/manage/mod.rs packages/sdkwork-claw-host-core/src-host/src/manage/installation.rs packages/sdkwork-claw-host-core/src-host/src/manage/storage_profiles.rs packages/sdkwork-claw-host-core/src-host/src/manage/cache_profiles.rs packages/sdkwork-claw-host-core/src-host/src/manage/nodes.rs packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts packages/sdkwork-claw-infrastructure/src/platform/index.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts packages/sdkwork-claw-infrastructure/src/platform/webManage.ts packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_installation.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_storage_profiles.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_cache_profiles.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_nodes.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts docs/superpowers/plans/2026-04-03-claw-control-plane-foundation-phasea-implementation-plan.md`
Expected: only the Phase A control-plane foundation files are touched.

- [ ] **Step 6: Commit**

```bash
git add docs/reference/claw-manage-api.md docs/reference/claw-server-runtime.md docs/reference/environment.md packages/sdkwork-claw-core/src/services/manageInstallationService.ts packages/sdkwork-claw-core/src/services/manageInstallationService.test.ts packages/sdkwork-claw-core/src/services/manageStorageProfileService.ts packages/sdkwork-claw-core/src/services/manageStorageProfileService.test.ts packages/sdkwork-claw-core/src/services/hostPlatformService.ts packages/sdkwork-claw-core/src/services/hostPlatformService.test.ts packages/sdkwork-claw-core/src/services/index.ts packages/sdkwork-claw-host-core/src-host/src/manage packages/sdkwork-claw-host-core/src-host/src/lib.rs packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts packages/sdkwork-claw-infrastructure/src/platform/index.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts packages/sdkwork-claw-infrastructure/src/platform/webManage.ts packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts packages/sdkwork-claw-server/src-host/src/bootstrap.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_installation.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_storage_profiles.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_cache_profiles.rs packages/sdkwork-claw-server/src-host/src/http/routes/manage_nodes.rs packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs packages/sdkwork-claw-server/src-host/src/main.rs packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts docs/superpowers/plans/2026-04-03-claw-control-plane-foundation-phasea-implementation-plan.md
git commit -m "feat: build control-plane foundation phase a"
```

