# Claw Studio OpenClaw Kernel Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Claw Studio into a cross-platform OpenClaw-powered product with a default built-in kernel, native silent service hosting, topology-aware lifecycle management, rollback-safe upgrades, and cluster-ready node governance.

**Architecture:** Introduce a native `Kernel Host` boundary above the current direct Tauri child-process model. Normalize install methods into kernel topologies, move lifecycle and endpoint truth into the host layer, then add slot-based upgrades and node/cluster control on top of the same contract.

**Tech Stack:** Tauri/Rust, TypeScript, React, pnpm workspace packages, Windows Service, launchd, systemd, existing OpenClaw bundled runtime and provider-center integration.

---

## File Structure

Target structure for the new platform work:

- Native kernel platform:
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/types.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/state_machine.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/endpoint_allocator.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/topology.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/provenance.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/upgrade_slots.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_windows.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_macos.rs`
  - Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_linux.rs`
- Native integration points:
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`
  - Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Platform contracts:
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
  - Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
  - Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
  - Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- Core/frontend domain:
  - Create: `packages/sdkwork-claw-core/src/services/kernelPlatformService.ts`
  - Create: `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
  - Create: `packages/sdkwork-claw-core/src/stores/useKernelStore.ts`
  - Create: `packages/sdkwork-claw-core/src/types/kernel.ts`
  - Modify: `packages/sdkwork-claw-core/src/services/index.ts`
- Product surfaces:
  - Create: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
  - Create: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
  - Create: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
  - Create: `packages/sdkwork-claw-instances/src/pages/Nodes.tsx`
  - Create: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts`
  - Create: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
  - Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
  - Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
  - Modify: `packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts`
- Installation and upgrade UX:
  - Modify: `packages/removed-install-feature/src/pages/install/installPageModel.ts`
  - Modify: `packages/removed-install-feature/src/pages/install/Install.tsx`
  - Create: `packages/removed-install-feature/src/services/kernelTopologyCatalogService.ts`
  - Create: `packages/removed-install-feature/src/services/kernelTopologyCatalogService.test.ts`
- Docs and references:
  - Create: `docs/reference/kernel-topology-matrix.md`
  - Create: `docs/reference/kernel-host-api.md`

## Task 1: Lock The Kernel Domain Model

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/types.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/topology.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/provenance.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/types.rs`

- [ ] **Step 1: Write failing Rust unit tests for kernel topology and state enums**

```rust
#[test]
fn kernel_topology_defaults_to_local_managed_native() {
    let topology = KernelTopology::default();
    assert_eq!(topology.kind, KernelTopologyKind::LocalManagedNative);
}

#[test]
fn runtime_state_distinguishes_install_state_from_process_state() {
    assert_ne!(KernelTopologyState::Installed, KernelRuntimeState::Running);
}
```

- [ ] **Step 2: Run the focused test filter to verify missing types fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml kernel_host::types`

Expected: FAIL with unresolved `KernelTopology`, `KernelTopologyKind`, or `KernelRuntimeState`.

- [ ] **Step 3: Implement the kernel host domain types**

```rust
pub enum KernelTopologyKind {
    LocalManagedNative,
    LocalManagedWsl,
    LocalManagedContainer,
    LocalExternal,
    RemoteManagedNode,
    RemoteAttachedNode,
}

pub enum KernelTopologyState {
    Unprovisioned,
    Provisioning,
    Installed,
    Attached,
    Drifted,
    Blocked,
    Upgrading,
    RollbackReady,
}

pub enum KernelRuntimeState {
    Stopped,
    Starting,
    Running,
    Degraded,
    Recovering,
    CrashLoop,
    FailedSafe,
}
```

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml kernel_host::types`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host
git commit -m "feat: add kernel host domain model"
```

## Task 2: Add The Stable Kernel Host Contract

**Files:**

- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- Create: `packages/sdkwork-claw-core/src/types/kernel.ts`
- Create: `packages/sdkwork-claw-core/src/services/kernelPlatformService.ts`
- Create: `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`

- [ ] **Step 1: Write failing TypeScript tests for the new host contract**

```ts
await runTest('kernelPlatformService maps desktop host status into shared kernel records', async () => {
  const snapshot = await kernelPlatformService.getStatus();
  assert.equal(snapshot.topology.kind, 'localManagedNative');
  assert.equal(snapshot.runtime.state, 'running');
});
```

- [ ] **Step 2: Run the focused TypeScript test**

Run: `pnpm --filter @sdkwork/claw-core exec tsx packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`

Expected: FAIL because the service and shared types do not exist.

- [ ] **Step 3: Add the platform contract and bridge methods**

```ts
export interface StudioKernelStatusRecord {
  topology: StudioKernelTopologyRecord;
  runtime: StudioKernelRuntimeRecord;
  endpoint: StudioKernelEndpointRecord | null;
  provenance: StudioKernelProvenanceRecord;
}

export interface StudioPlatformBridge {
  studio: {
    getKernelStatus(): Promise<StudioKernelStatusRecord>;
    ensureKernelRunning(): Promise<StudioKernelStatusRecord>;
    restartKernel(): Promise<StudioKernelStatusRecord>;
  };
}
```

- [ ] **Step 4: Implement the shared core service wrapper**

```ts
export class KernelPlatformService {
  async getStatus() {
    return mapKernelStatus(await platform.studio.getKernelStatus());
  }
}
```

- [ ] **Step 5: Re-run the focused test**

Run: `pnpm --filter @sdkwork/claw-core exec tsx packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-infrastructure packages/sdkwork-claw-desktop/src/desktop packages/sdkwork-claw-core
git commit -m "feat: add kernel host platform contract"
```

## Task 3: Converge Desktop Startup On Attach-First Kernel Ownership

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Add failing tests for startup-mode consistency**

```rust
#[test]
fn openclaw_component_metadata_matches_actual_built_in_autostart_behavior() {
    let definitions = packaged_component_definitions();
    let openclaw = definitions.iter().find(|item| item.id == "openclaw").unwrap();
    assert_eq!(openclaw.startup_mode, PackagedComponentStartupMode::Embedded);
}
```

- [ ] **Step 2: Run the focused bootstrap/component tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation`

Expected: FAIL because metadata still says `Manual`.

- [ ] **Step 3: Refactor bootstrap into attach-first host orchestration**

```rust
fn ensure_kernel_ready(context: &FrameworkContext) -> Result<KernelStatusRecord> {
    context.kernel_host.ensure_running(&context.paths)
}
```

Update component metadata so bundled OpenClaw is modeled as embedded auto-managed infrastructure, not a manual user-started component.

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs
git commit -m "feat: align built-in openclaw startup ownership"
```

## Task 4: Add Endpoint Allocation And Runtime Recovery State Machine

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/state_machine.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/endpoint_allocator.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/state_machine.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write failing tests for port conflict and stale-lock recovery**

```rust
#[test]
fn allocator_uses_new_port_when_preferred_port_is_owned_by_another_process() {
    let decision = allocate_endpoint(preferred, occupied_ports);
    assert_ne!(decision.active_port, preferred);
}

#[test]
fn state_machine_enters_failed_safe_after_restart_budget_exhaustion() {
    let next = machine.on_crash_budget_exhausted();
    assert_eq!(next.runtime_state, KernelRuntimeState::FailedSafe);
}
```

- [ ] **Step 2: Run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml endpoint_allocator`

Expected: FAIL with missing allocator or recovery state machine.

- [ ] **Step 3: Implement endpoint allocation and recovery rules**

```rust
pub struct EndpointDecision {
    pub preferred_port: u16,
    pub active_port: u16,
    pub reused_existing: bool,
}

pub fn allocate_endpoint(preferred: u16, occupied: &BTreeSet<u16>) -> EndpointDecision {
    if !occupied.contains(&preferred) {
        return EndpointDecision { preferred_port: preferred, active_port: preferred, reused_existing: false };
    }

    EndpointDecision { preferred_port: preferred, active_port: find_free_loopback_port(), reused_existing: false }
}
```

- [ ] **Step 4: Integrate the allocator into supervisor startup before spawning OpenClaw**

```rust
let decision = endpoint_allocator::resolve_for_runtime(paths, &runtime)?;
let runtime = runtime.with_gateway_port(decision.active_port);
```

- [ ] **Step 5: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml supervisor`

Expected: PASS for allocator and recovery-specific tests.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs
git commit -m "feat: add kernel endpoint allocator and recovery state machine"
```

## Task 5: Introduce Platform Service Adapters

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_windows.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_macos.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_linux.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_windows.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_macos.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_linux.rs`

- [ ] **Step 1: Write failing adapter tests for native service manager command generation**

```rust
#[test]
fn windows_adapter_builds_service_install_spec() {
    let spec = WindowsKernelHostAdapter::service_spec(&runtime);
    assert!(spec.binary_path.ends_with("claw-studio-kernel-host.exe"));
}

#[test]
fn macos_adapter_builds_launch_agent_plist_path() {
    let spec = MacosKernelHostAdapter::service_spec(&runtime);
    assert!(spec.plist_path.ends_with("ai.sdkwork.clawstudio.openclaw.plist"));
}
```

- [ ] **Step 2: Run the focused native-adapter tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml kernel_host::platform`

Expected: FAIL with missing platform adapter modules.

- [ ] **Step 3: Implement a shared platform adapter trait**

```rust
pub trait KernelPlatformAdapter {
    fn install_service(&self, runtime: &KernelHostRuntimeSpec) -> Result<()>;
    fn repair_service(&self, runtime: &KernelHostRuntimeSpec) -> Result<()>;
    fn start_service(&self) -> Result<()>;
    fn stop_service(&self) -> Result<()>;
    fn status(&self) -> Result<KernelPlatformServiceState>;
}
```

- [ ] **Step 4: Implement Windows, macOS, and Linux adapter scaffolds**

Keep the first pass honest:

- Windows: service binary and recovery metadata
- macOS: LaunchAgent plist generation
- Linux: systemd user/system unit generation

- [ ] **Step 5: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml kernel_host::platform`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host
git commit -m "feat: add kernel platform service adapters"
```

## Task 6: Implement Built-In Native Silent Hosting

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_windows.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_macos.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform_linux.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Add a failing Windows spawn test for hidden-console behavior**

```rust
#[test]
#[cfg(windows)]
fn managed_openclaw_spawn_configures_hidden_process_flags() {
    let flags = build_windows_spawn_flags();
    assert!(flags.create_no_window);
}
```

- [ ] **Step 2: Run the focused test**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml managed_openclaw_spawn`

Expected: FAIL because silent native hosting is not fully modeled.

- [ ] **Step 3: Implement native-hosted startup path**

Minimum implementation:

- desktop app calls host `ensure_running`
- host installs or repairs native service registration
- host starts service or attaches to existing instance
- direct Tauri child-process ownership becomes fallback-only, not default

- [ ] **Step 4: Add equivalent macOS launchd and Linux systemd attach-first flows**

```rust
if adapter.status()?.is_running() {
    return attach_to_live_runtime();
}

adapter.repair_service(&runtime_spec)?;
adapter.start_service()?;
```

- [ ] **Step 5: Re-run targeted tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation`

Expected: PASS with the host-first path.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri
git commit -m "feat: add native silent kernel hosting"
```

## Task 7: Normalize Install Methods Into Kernel Topologies

**Files:**

- Modify: `packages/removed-install-feature/src/pages/install/installPageModel.ts`
- Modify: `packages/removed-install-feature/src/pages/install/Install.tsx`
- Create: `packages/removed-install-feature/src/services/kernelTopologyCatalogService.ts`
- Create: `packages/removed-install-feature/src/services/kernelTopologyCatalogService.test.ts`

- [ ] **Step 1: Write failing tests for topology normalization**

```ts
await runTest('kernelTopologyCatalogService groups npm and pnpm under localExternal or localManagedNative policy', async () => {
  const catalog = await kernelTopologyCatalogService.listTopologies();
  assert.ok(catalog.some((item) => item.kind === 'localManagedNative'));
});
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm --filter removed-install-feature exec tsx packages/removed-install-feature/src/services/kernelTopologyCatalogService.test.ts`

Expected: FAIL because topology grouping does not exist.

- [ ] **Step 3: Add the topology catalog service**

```ts
export interface KernelTopologyCatalogEntry {
  kind: 'localManagedNative' | 'localManagedWsl' | 'localManagedContainer' | 'localExternal' | 'remoteManagedNode' | 'remoteAttachedNode';
  provisioners: string[];
  recommended: boolean;
}
```

- [ ] **Step 4: Refactor install page rendering to show topologies first, provisioners second**

Keep detailed method docs, but move them under the selected topology.

- [ ] **Step 5: Re-run the focused test**

Run: `pnpm --filter removed-install-feature exec tsx packages/removed-install-feature/src/services/kernelTopologyCatalogService.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/removed-install-feature
git commit -m "feat: normalize openclaw install methods into kernel topologies"
```

## Task 8: Add Provenance And Slot-Based Upgrade Control

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/upgrade_slots.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/provenance.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Create: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Create: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`

- [ ] **Step 1: Write failing tests for upgrade slot promotion and rollback**

```rust
#[test]
fn failed_candidate_promotion_reactivates_previous_active_slot() {
    let result = slots.promote_candidate_after_failed_healthcheck();
    assert_eq!(result.active_slot, "rollback");
}
```

- [ ] **Step 2: Run the focused Rust test**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml upgrade_slots`

Expected: FAIL because slot orchestration is missing.

- [ ] **Step 3: Implement provenance and slot records**

```rust
pub struct KernelUpgradeSlots {
    pub active: RuntimeSlotRecord,
    pub candidate: Option<RuntimeSlotRecord>,
    pub rollback: Option<RuntimeSlotRecord>,
}
```

- [ ] **Step 4: Expose upgrade state through desktop commands and the settings service**

```ts
const snapshot = await platform.studio.getKernelUpgradeStatus();
return mapUpgradeSnapshot(snapshot);
```

- [ ] **Step 5: Re-run focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml upgrade_slots`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop packages/sdkwork-claw-settings
git commit -m "feat: add kernel upgrade provenance and slot rollback control"
```

## Task 9: Add Node Inventory And Cluster Control Plane Foundations

**Files:**

- Create: `packages/sdkwork-claw-instances/src/pages/Nodes.tsx`
- Create: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts`
- Create: `packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceService.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts`

- [ ] **Step 1: Write failing tests for node inventory mapping**

```ts
await runTest('nodeInventoryService separates local managed nodes from attached remote nodes', async () => {
  const nodes = await nodeInventoryService.listNodes();
  assert.equal(nodes[0].management, 'managed');
});
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm --filter @sdkwork/claw-instances exec tsx packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`

Expected: FAIL because node inventory service does not exist.

- [ ] **Step 3: Implement the shared node record model**

```ts
export interface NodeInventoryRecord {
  id: string;
  kind: 'localPrimary' | 'managedRemote' | 'attachedRemote' | 'rescue';
  topologyKind: string;
  runtimeState: string;
  health: 'ok' | 'degraded' | 'quarantined';
  management: 'managed' | 'attached';
}
```

- [ ] **Step 4: Add a new `Nodes` route and sidebar entry**

The first pass can be read-only inventory plus basic actions:

- inspect
- restart
- run doctor
- open logs

- [ ] **Step 5: Re-run the focused test**

Run: `pnpm --filter @sdkwork/claw-instances exec tsx packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-instances packages/sdkwork-claw-shell
git commit -m "feat: add node inventory and cluster control foundations"
```

## Task 10: Reorganize Product IA Around Workspace, Kernel, And Nodes

**Files:**

- Create: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- Modify: `packages/sdkwork-claw-settings/src/index.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

- [ ] **Step 1: Write failing route and i18n contract tests**

```ts
assert.ok(sidebarLabels.includes('Kernel Center'));
assert.ok(routePaths.includes('/kernel'));
```

- [ ] **Step 2: Run the route contract test**

Run: `node scripts/sdkwork-shell-contract.test.ts`

Expected: FAIL because the new information architecture is not yet wired.

- [ ] **Step 3: Add the Kernel Center route and sidebar grouping**

Kernel Center should surface:

- topology
- runtime
- endpoint
- logs
- doctor
- upgrade

- [ ] **Step 4: Re-run the route contract test**

Run: `node scripts/sdkwork-shell-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-settings packages/sdkwork-claw-shell packages/sdkwork-claw-i18n
git commit -m "feat: reorganize claw studio around workspace kernel and nodes"
```

## Task 11: Publish Topology Matrix And Kernel Host API References

**Files:**

- Create: `docs/reference/kernel-topology-matrix.md`
- Create: `docs/reference/kernel-host-api.md`
- Modify: `docs/reference/upstream-integration.md`

- [ ] **Step 1: Write the topology support matrix**

Document:

- OS/CPU coverage
- default topology per OS
- supported provisioners per topology
- control level per topology
- rollback support per topology

- [ ] **Step 2: Write the kernel host API reference**

Document:

- command names
- payloads
- response records
- state enums
- error model

- [ ] **Step 3: Link the new references from the upstream integration doc**

- [ ] **Step 4: Verify the docs exist and are linked**

Run: `rg -n "kernel-topology-matrix|kernel-host-api" docs/reference`

Expected: PASS with the new files and references.

- [ ] **Step 5: Commit**

```bash
git add docs/reference
git commit -m "docs: add kernel topology and host api references"
```

## Task 12: Full Verification Sweep

**Files:**

- Test: `packages/sdkwork-claw-desktop/src-tauri`
- Test: `packages/sdkwork-claw-core`
- Test: `packages/removed-install-feature`
- Test: `packages/sdkwork-claw-instances`
- Test: `packages/sdkwork-claw-settings`
- Modify as needed: files touched in Tasks 1-11

- [ ] **Step 1: Run desktop Rust tests for kernel platform changes**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 2: Run focused TypeScript package tests**

Run: `pnpm --filter @sdkwork/claw-core exec tsx packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`

Expected: PASS.

Run: `pnpm --filter removed-install-feature exec tsx packages/removed-install-feature/src/services/kernelTopologyCatalogService.test.ts`

Expected: PASS.

Run: `pnpm --filter @sdkwork/claw-instances exec tsx packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts`

Expected: PASS.

Run: `pnpm --filter @sdkwork/claw-settings exec tsx packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`

Expected: PASS.

- [ ] **Step 3: Run workspace contract checks**

Run: `node scripts/sdkwork-shell-contract.test.ts`

Expected: PASS.

Run: `node --experimental-strip-types scripts/sdkwork-foundation-contract.test.ts`

Expected: PASS.

- [ ] **Step 4: Run workspace validation**

Run: `pnpm lint`

Expected: PASS.

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 5: Manual verification**

Verify:

- app install deploys built-in OpenClaw runtime
- app startup is silent and attaches to or starts the kernel
- port conflicts are auto-resolved
- kernel status is visible in-app
- topology switching is explicit
- upgrade state is visible
- local node appears in node inventory

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete kernel platform foundation"
```
