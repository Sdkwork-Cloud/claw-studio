# Kernel Governance Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic kernel governance plane that unifies release metadata, runtime paths, authority state, activation bookkeeping, and version projection for OpenClaw, Hermes, and future kernels.

**Architecture:** Hard-cut the governance plane from OpenClaw-specific paths and state into a kernel-scoped registry plus adapter model. First unify release sources and path ownership, then normalize authority and upgrade state, then migrate OpenClaw onto the new contracts before attaching Hermes to the same platform boundary.

**Tech Stack:** Rust/Tauri desktop host, serde/serde_json/json5, existing Cargo tests, TypeScript shared contracts, Node.js ESM scripts and `node:test`

---

## Execution Notes

- Work from the repo root unless a task explicitly says to run inside `packages/sdkwork-claw-desktop/src-tauri`.
- Do not redesign the OpenClaw detail UI during this plan.
- Do not bundle Node.js, Python, or `uv`.
- Preserve current OpenClaw functionality while changing the governance plane underneath it.
- Treat `config/openclaw-release.json` as migration-only after Task 1 starts. New work must target `config/kernel-releases/*.json`.

## File Map

**Create:**

- `config/kernel-releases/openclaw.json`
- `config/kernel-releases/hermes.json`
- `packages/sdkwork-claw-types/src/kernelReleaseCatalog.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/registry.rs`
- `docs/superpowers/specs/2026-04-16-kernel-governance-plane-design.md`
- `docs/superpowers/plans/2026-04-16-kernel-governance-plane-implementation-plan.md`

**Modify:**

- `packages/sdkwork-claw-types/src/index.ts`
- `packages/sdkwork-claw-types/src/openclawRelease.ts`
- `scripts/openclaw-release.mjs`
- `scripts/openclaw-release-contract.test.mjs`
- `scripts/apply-openclaw-upgrade.mjs`
- `scripts/apply-openclaw-upgrade.test.mjs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/openclaw_release.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- `packages/sdkwork-claw-core/src/services/kernelPlatformService.ts`
- `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `docs/架构/18-多内核治理与升级维护设计.md` only if implementation reveals a real design correction

**Primary test surfaces:**

- `scripts/openclaw-release-contract.test.mjs`
- `scripts/apply-openclaw-upgrade.test.mjs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`

### Task 1: Unify Release Metadata Under Kernel Release Registry

**Files:**
- Create: `config/kernel-releases/openclaw.json`
- Create: `config/kernel-releases/hermes.json`
- Create: `packages/sdkwork-claw-types/src/kernelReleaseCatalog.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-types/src/openclawRelease.ts`
- Modify: `scripts/openclaw-release.mjs`
- Modify: `scripts/openclaw-release-contract.test.mjs`
- Modify: `scripts/apply-openclaw-upgrade.mjs`
- Modify: `scripts/apply-openclaw-upgrade.test.mjs`
- Test: `scripts/openclaw-release-contract.test.mjs`
- Test: `scripts/apply-openclaw-upgrade.test.mjs`

- [ ] **Step 1: Write the failing release-registry tests**

```js
test('openclaw release loader reads config/kernel-releases/openclaw.json as primary source', async () => {
  const config = await loadKernelReleaseConfig('openclaw');
  assert.equal(config.kernelId, 'openclaw');
  assert.equal(config.stableVersion, '2026.4.9');
});

test('apply-openclaw-upgrade restores kernel release registry config on failure', async () => {
  // existing rollback test should target config/kernel-releases/openclaw.json
});
```

- [ ] **Step 2: Run the targeted Node tests to confirm the old `config/openclaw-release.json` assumption still exists**

Run: `node --test scripts/openclaw-release-contract.test.mjs scripts/apply-openclaw-upgrade.test.mjs`
Expected: FAIL because the loaders and rollback flow still hardcode `config/openclaw-release.json`.

- [ ] **Step 3: Add a generic kernel release catalog loader**

```ts
export interface KernelReleaseConfig {
  kernelId: string;
  stableVersion: string;
  defaultChannel: string;
  supportedChannels: string[];
}

export function loadKernelReleaseConfig(kernelId: string): KernelReleaseConfig
```

- [ ] **Step 4: Move OpenClaw script consumers onto the generic loader while keeping a short-lived compatibility read for legacy config**

```js
const releaseConfig = loadKernelReleaseConfig('openclaw');
```

- [ ] **Step 5: Add `config/kernel-releases/hermes.json` with the same schema so Hermes enters the same release-registry model immediately**

- [ ] **Step 6: Re-run the targeted Node tests**

Run: `node --test scripts/openclaw-release-contract.test.mjs scripts/apply-openclaw-upgrade.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add config/kernel-releases packages/sdkwork-claw-types/src/kernelReleaseCatalog.ts packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-types/src/openclawRelease.ts scripts/openclaw-release.mjs scripts/openclaw-release-contract.test.mjs scripts/apply-openclaw-upgrade.mjs scripts/apply-openclaw-upgrade.test.mjs
git commit -m "feat: add kernel release registry"
```

### Task 2: Replace OpenClaw-Specific Runtime Paths With Kernel-Scoped Path Resolution

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/registry.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`

- [ ] **Step 1: Write failing Rust tests for kernel-scoped roots**

```rust
#[test]
fn resolves_kernel_scoped_machine_state_paths() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");

    let openclaw = paths.kernel_paths("openclaw");
    assert!(openclaw.machine_state_dir.ends_with("machine/state/kernels/openclaw"));
    assert!(openclaw.authority_file.ends_with("authority.json"));
}

#[test]
fn runtime_upgrade_state_is_not_seeded_by_openclaw_default_only() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let runtime_upgrades = read_json_file::<RuntimeUpgradesState>(&paths.upgrades_file).expect("upgrades");

    assert!(runtime_upgrades.runtimes.is_empty());
}
```

- [ ] **Step 2: Run the targeted Cargo tests**

Run: `cargo test resolves_kernel_scoped_machine_state_paths runtime_upgrade_state_is_not_seeded_by_openclaw_default_only -- --exact`
Expected: FAIL because `AppPaths` still exposes `openclaw_*` fields and `RuntimeUpgradesState` still seeds `openclaw`.

- [ ] **Step 3: Introduce a kernel runtime registry plus kernel-scoped path resolver**

```rust
pub struct KernelPaths {
    pub runtime_root: PathBuf,
    pub machine_state_dir: PathBuf,
    pub authority_file: PathBuf,
    pub upgrades_file: PathBuf,
    pub managed_config_dir: PathBuf,
}
```

- [ ] **Step 4: Keep temporary compatibility accessors for OpenClaw callers while new generic call sites are migrated**

- [ ] **Step 5: Normalize layout initialization so per-kernel files live under `machine/state/kernels/<kernelId>/`**

- [ ] **Step 6: Re-run the targeted Cargo tests**

Run: `cargo test resolves_kernel_scoped_machine_state_paths runtime_upgrade_state_is_not_seeded_by_openclaw_default_only -- --exact`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/registry.rs
git commit -m "feat: add kernel scoped runtime paths"
```

### Task 3: Generalize Kernel Runtime Authority And State

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/adapter.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/types.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`

- [ ] **Step 1: Write failing tests for generic authority methods**

```rust
#[test]
fn kernel_authority_service_resolves_contract_by_runtime_id() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let authority = KernelRuntimeAuthorityService::new();

    let contract = authority.contract("openclaw", &paths).expect("contract");
    assert_eq!(contract.runtime_id, "openclaw");
}

#[test]
fn kernel_authority_state_defaults_are_kernel_neutral() {
    let state = KernelAuthorityState::default();
    assert!(state.runtime_id.is_empty());
}
```

- [ ] **Step 2: Run the targeted Cargo tests**

Run: `cargo test kernel_authority_service_resolves_contract_by_runtime_id kernel_authority_state_defaults_are_kernel_neutral -- --exact`
Expected: FAIL because authority is OpenClaw-named and layout defaults still embed `openclaw`.

- [ ] **Step 3: Convert `KernelRuntimeAuthorityService` to runtime-id-driven APIs**

```rust
pub fn contract(&self, runtime_id: &str, paths: &AppPaths) -> Result<KernelRuntimeContract>
pub fn active_managed_config_path(&self, runtime_id: &str, paths: &AppPaths) -> Result<PathBuf>
pub fn record_activation_result(&self, runtime_id: &str, paths: &AppPaths, install_key: &str, last_error: Option<&str>) -> Result<()>
```

- [ ] **Step 4: Add adapter registration so OpenClaw and Hermes can be looked up through one registry**

- [ ] **Step 5: Re-run the targeted Cargo tests**

Run: `cargo test kernel_authority_service_resolves_contract_by_runtime_id kernel_authority_state_defaults_are_kernel_neutral -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/adapter.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/types.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs
git commit -m "feat: generalize kernel runtime authority"
```

### Task 4: Refactor Runtime Activation And Rollback Around Adapter Hooks

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/install_records.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Write failing activation tests that assert the upgrade service does not branch on `OPENCLAW_RUNTIME_ID`**

```rust
#[test]
fn activate_runtime_version_routes_activation_through_adapter() {
    // source-level or behavior-level test should assert adapter-driven validation and authority write
}
```

- [ ] **Step 2: Run the targeted Cargo tests**

Run: `cargo test activate_runtime_version_routes_activation_through_adapter -- --exact`
Expected: FAIL because `activate_runtime_version()` still special-cases OpenClaw.

- [ ] **Step 3: Introduce adapter-driven verification and activation hooks**

```rust
if let Some(adapter) = registry.adapter(runtime_id) {
    adapter.verify_install(paths, version)?;
    adapter.activate_install(paths, version)?;
}
```

- [ ] **Step 4: Ensure rollback restores the previous active install and authority state through the same generic service**

- [ ] **Step 5: Re-run the targeted Cargo tests**

Run: `cargo test activate_runtime_version_routes_activation_through_adapter -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/install_records.rs
git commit -m "feat: route runtime activation through kernel adapters"
```

### Task 5: Migrate OpenClaw Version And Projection Truth To The Governance Plane

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/openclaw_release.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write failing tests for shared version-resolution precedence**

```rust
#[test]
fn built_in_display_version_prefers_authority_install_manifest_before_release_registry() {
    // active install version should win over staged and bundled versions
}
```

- [ ] **Step 2: Run the targeted Cargo tests**

Run: `cargo test built_in_display_version_prefers_authority_install_manifest_before_release_registry -- --exact`
Expected: FAIL because OpenClaw display version still uses OpenClaw-specific fallback logic.

- [ ] **Step 3: Extract one shared version resolver backed by authority plus install manifest plus release registry**

- [ ] **Step 4: Move managed-config lookup and console-entry resolution onto generic authority APIs**

- [ ] **Step 5: Re-run the targeted Cargo tests**

Run: `cargo test built_in_display_version_prefers_authority_install_manifest_before_release_registry -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/openclaw_release.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs
git commit -m "feat: align openclaw projections with kernel governance"
```

### Task 6: Attach Hermes To The Same Governance Plane

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/registry.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Modify: `packages/sdkwork-claw-core/src/services/kernelPlatformService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- Test: `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- Test: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`

- [ ] **Step 1: Write failing tests that Hermes kernel metadata and doctor state surface through the same shared contracts**

```ts
it('kernelPlatformService exposes Hermes through the shared kernel projection contract', async () => {
  const info = await service.getInfo();
  expect(info?.bundledComponents?.includedKernelIds).toContain('hermes');
});
```

- [ ] **Step 2: Run the targeted TypeScript tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts && node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
Expected: FAIL because Hermes does not yet participate in the same governance-plane projection path.

- [ ] **Step 3: Add a Hermes adapter entry with documented external-runtime constraints and shared release-registry participation**

- [ ] **Step 4: Project Hermes doctor, version, and console-entry metadata through `DesktopKernelInfo` and Kernel Center without introducing new OpenClaw-specific fields**

- [ ] **Step 5: Re-run the targeted TypeScript tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts && node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/registry.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs packages/sdkwork-claw-core/src/services/kernelPlatformService.ts packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts
git commit -m "feat: attach hermes to kernel governance plane"
```

### Task 7: Run Cross-Layer Verification And Remove Migration-Only Drift

**Files:**
- Modify: files touched in Tasks 1-6 only if verification exposes contract drift
- Modify: `docs/架构/18-多内核治理与升级维护设计.md` only for real design corrections

- [ ] **Step 1: Run the Node release-registry and upgrade tests**

Run: `node --test scripts/openclaw-release-contract.test.mjs scripts/apply-openclaw-upgrade.test.mjs`
Expected: PASS

- [ ] **Step 2: Run the targeted Rust governance tests**

Run: `cargo test kernel_authority_service_resolves_contract_by_runtime_id built_in_display_version_prefers_authority_install_manifest_before_release_registry activate_runtime_version_routes_activation_through_adapter -- --exact`
Expected: PASS

- [ ] **Step 3: Run the shared frontend/service contract tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts && node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
Expected: PASS

- [ ] **Step 4: Run the repo gates required by this slice**

Run: `pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 5: Remove migration-only compatibility reads only after all tests pass**

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "refactor: complete kernel governance plane migration"
```
