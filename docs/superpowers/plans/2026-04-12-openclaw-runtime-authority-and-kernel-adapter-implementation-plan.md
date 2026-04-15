# OpenClaw Runtime Authority And Kernel Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Supersession Note (2026-04-13):** This plan is preserved for historical implementation context. Current implementation work should follow `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md` and `docs/superpowers/plans/2026-04-13-openclaw-external-node-hard-cut-implementation-plan.md`. Any references below to bundled OpenClaw runtime semantics are historical unless they have already been converged to the current built-in packaged OpenClaw plus external runtime model.

**Goal:** Stabilize bundled OpenClaw startup by introducing a single runtime authority that owns legacy cleanup, config/data migration, runtime upgrade bookkeeping, and a reusable kernel adapter contract for future kernels.

**Architecture:** First, add authority-owned paths and state so bundled OpenClaw no longer relies on the legacy shared config/runtime layout. Next, route supervisor startup, migration, and studio projections through the authority. Finally, extract the authority-facing OpenClaw logic behind a generic kernel adapter boundary that preserves Windows, macOS, and Linux behavior through platform-specific primitives.

**Tech Stack:** Rust, Tauri desktop host, serde/serde_json/json5, sysinfo, existing kernel-host platform adapters, Cargo unit tests

---

## Execution Notes

- Current workspace has an unrelated modification in `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`. Do not stage or revert it unless a task explicitly requires editing that file.
- Execute Rust work from `packages/sdkwork-claw-desktop/src-tauri`.
- Prefer targeted `cargo test <name> -- --exact` loops before broader verification.
- Keep commits scoped to one task outcome.

## File Map

**Create:**

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/mod.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/types.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/adapter.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`

**Modify:**

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- `docs/superpowers/specs/2026-04-12-openclaw-runtime-authority-and-kernel-adapter-design.md` only if implementation reveals a real spec correction

**Primary test surfaces:**

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`

### Task 1: Add Authority Paths And State

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`

- [ ] **Step 1: Write the failing path-state tests**

```rust
#[test]
fn creates_openclaw_authority_state_paths() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");

    assert!(paths.openclaw_kernel_state_dir.exists());
    assert!(paths.openclaw_authority_file.exists());
    assert!(paths.openclaw_migrations_file.exists());
    assert!(paths.openclaw_runtime_upgrades_file.exists());
}

#[test]
fn initializes_runtime_upgrade_state_for_openclaw() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let runtime_upgrades = read_json_file::<RuntimeUpgradesState>(&paths.openclaw_runtime_upgrades_file)
        .expect("runtime upgrades");

    assert!(runtime_upgrades.runtimes.contains_key("openclaw"));
}
```

- [ ] **Step 2: Run the targeted tests to confirm the new authority fields are missing**

Run: `cargo test creates_openclaw_authority_state_paths -- --exact`
Expected: FAIL because `AppPaths` and layout state do not yet expose the authority files

- [ ] **Step 3: Add authority path fields and create the directories/files**

```rust
pub struct AppPaths {
    pub openclaw_kernel_state_dir: PathBuf,
    pub openclaw_authority_file: PathBuf,
    pub openclaw_migrations_file: PathBuf,
    pub openclaw_runtime_upgrades_file: PathBuf,
    pub openclaw_quarantine_dir: PathBuf,
}
```

- [ ] **Step 4: Add runtime-authority layout models**

```rust
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct RuntimeUpgradeStateEntry {
    pub active_install_key: Option<String>,
    pub fallback_install_key: Option<String>,
    pub last_attempted_version: Option<String>,
    pub last_applied_version: Option<String>,
    pub last_attempted_at: Option<String>,
    pub last_error: Option<String>,
}
```

- [ ] **Step 5: Register the new authority service in `FrameworkServices`**

```rust
pub struct FrameworkServices {
    pub kernel_runtime_authority: KernelRuntimeAuthorityService,
}
```

- [ ] **Step 6: Run the targeted tests to verify the new state roots exist**

Run: `cargo test creates_openclaw_authority_state_paths -- --exact`
Expected: PASS

- [ ] **Step 7: Run the runtime-upgrade state test**

Run: `cargo test initializes_runtime_upgrade_state_for_openclaw -- --exact`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs
git commit -m "feat: add openclaw runtime authority state"
```

### Task 2: Introduce The Kernel Runtime Contract

**Files:**

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/mod.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/types.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/adapter.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`

- [ ] **Step 1: Write the failing contract test**

```rust
#[test]
fn openclaw_adapter_exposes_owned_runtime_roots_and_authority_config_path() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let authority = KernelRuntimeAuthorityService::new();

    let contract = authority
        .openclaw_contract(&paths)
        .expect("authority contract");

    assert_eq!(contract.runtime_id, "openclaw");
    assert!(!contract.owned_runtime_roots.is_empty());
    assert!(contract.managed_config_path.ends_with("openclaw.json"));
}
```

- [ ] **Step 2: Run the contract test to verify the adapter boundary does not exist yet**

Run: `cargo test openclaw_adapter_exposes_owned_runtime_roots_and_authority_config_path -- --exact`
Expected: FAIL because the kernel runtime contract module does not exist

- [ ] **Step 3: Create the generic runtime types**

```rust
pub struct KernelRuntimeContract {
    pub runtime_id: String,
    pub managed_config_path: PathBuf,
    pub owned_runtime_roots: Vec<PathBuf>,
}

pub trait KernelRuntimeAdapter {
    fn runtime_id(&self) -> &'static str;
    fn contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract>;
}
```

- [ ] **Step 4: Add an OpenClaw-backed authority implementation**

```rust
pub fn openclaw_contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract> {
    OpenClawKernelAdapter::new().contract(paths)
}
```

- [ ] **Step 5: Run the contract test again**

Run: `cargo test openclaw_adapter_exposes_owned_runtime_roots_and_authority_config_path -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs
git commit -m "feat: add kernel runtime contract"
```

### Task 3: Reap Legacy Managed OpenClaw Processes Across Owned Roots

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write the failing stale-process regression test**

```rust
#[test]
fn reaps_legacy_managed_openclaw_gateway_processes_before_activation() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let legacy_root = paths.machine_runtime_dir.join("runtimes").join("openclaw").join("2026.3.28-windows-x64");
    std::fs::create_dir_all(&legacy_root).expect("legacy root");

    let process_roots = KernelRuntimeAuthorityService::new()
        .openclaw_contract(&paths)
        .expect("contract")
        .owned_runtime_roots;

    assert!(process_roots.iter().any(|root| root == &legacy_root.parent().expect("parent")));
}
```

- [ ] **Step 2: Run the regression test to verify legacy roots are not yet surfaced**

Run: `cargo test reaps_legacy_managed_openclaw_gateway_processes_before_activation -- --exact`
Expected: FAIL because the authority or supervisor only matches the current runtime root

- [ ] **Step 3: Make the authority discover current plus legacy owned runtime roots**

```rust
fn owned_openclaw_runtime_roots(paths: &AppPaths) -> Vec<PathBuf> {
    vec![
        paths.openclaw_runtime_dir.clone(),
        paths.machine_runtime_dir.join("runtimes").join("openclaw"),
    ]
}
```

- [ ] **Step 4: Change stale-process matching to consume authority-owned roots instead of one hard-coded root**

```rust
fn find_stale_openclaw_gateway_process_ids(paths: &AppPaths, owned_roots: &[PathBuf]) -> Result<Vec<u32>> {
    // match any managed root returned by the authority
}
```

- [ ] **Step 5: Add a Windows and Unix path-normalization assertion**

```rust
assert_eq!(normalize_process_match_path(Path::new("C:/Runtime/OpenClaw")), "c:\\runtime\\openclaw");
assert_eq!(normalize_process_match_path(Path::new("/opt/openclaw")), "\\opt\\openclaw");
```

- [ ] **Step 6: Run the targeted supervisor tests**

Run: `cargo test reaps_legacy_managed_openclaw_gateway_processes_before_activation -- --exact`
Expected: PASS

- [ ] **Step 7: Re-run the existing startup retry tests to prevent regression**

Run: `cargo test supervisor_retries_gateway_start_when_the_first_cold_start_exits_immediately -- --exact`
Expected: PASS

Run: `cargo test supervisor_allows_slow_openclaw_gateway_startup_within_the_readiness_window -- --exact`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs
git commit -m "fix: reap legacy managed openclaw gateway processes"
```

### Task 4: Migrate Managed Config Ownership Into The Authority

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Write the failing config-migration test**

```rust
#[test]
fn managed_openclaw_config_migration_strips_host_version_metadata() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    std::fs::write(
        &paths.openclaw_config_file,
        "{ meta: { lastTouchedVersion: '2026.4.9' }, gateway: { port: 18878 } }",
    )
    .expect("legacy config");

    let runtime = OpenClawRuntimeService::new()
        .ensure_bundled_runtime_from_root(&paths, root.path())
        .expect_err("manifest missing for now");

    let migrated = std::fs::read_to_string(&paths.openclaw_authority_config_file()).expect("migrated config");
    assert!(!migrated.contains("lastTouchedVersion"));
}
```

- [ ] **Step 2: Run the targeted test to verify the authority config path is not used**

Run: `cargo test managed_openclaw_config_migration_strips_host_version_metadata -- --exact`
Expected: FAIL because `ensure_managed_openclaw_state` still writes the legacy config path and still emits `meta.lastTouchedVersion`

- [ ] **Step 3: Replace legacy config ownership with an authority-resolved config target**

```rust
let managed_config_path = authority.resolve_openclaw_config_path(paths, &install_key)?;
let mut config = authority.import_or_default_openclaw_config(paths, &managed_config_path)?;
config.pointer_mut("/meta");
```

- [ ] **Step 4: Remove host-owned version metadata from live runtime config**

```rust
remove_nested_key(&mut config, &["meta", "lastTouchedVersion"]);
remove_nested_key(&mut config, &["meta", "lastTouchedAt"]);
```

- [ ] **Step 5: Record config migration details in the authority ledger**

```rust
authority.record_openclaw_config_migration(
    paths,
    source_path.as_deref(),
    &managed_config_path,
    bundled_openclaw_version,
)?;
```

- [ ] **Step 6: Convert managed `studio.rs` reads and writes to use the authority-resolved config path**

```rust
let managed_config_path = authority.active_openclaw_config_path(paths)?;
let root = read_json5_object(&managed_config_path)?;
```

- [ ] **Step 7: Run the new migration test**

Run: `cargo test managed_openclaw_config_migration_strips_host_version_metadata -- --exact`
Expected: PASS

- [ ] **Step 8: Run one managed detail projection test**

Run: `cargo test built_in_instance_detail_exposes_managed_workspace_and_config_routes -- --exact`
Expected: PASS with the authoritative config route now pointing at the authority-managed config file

- [ ] **Step 9: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs
git commit -m "feat: move managed openclaw config into runtime authority"
```

### Task 5: Complete Runtime Upgrade And Migration Bookkeeping

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`

- [ ] **Step 1: Write the failing runtime-upgrade bookkeeping test**

```rust
#[test]
fn runtime_upgrade_activation_updates_runtime_upgrade_state_and_receipt() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    seed_runtime_layout(root.path());

    let receipt = ComponentUpgradeService::new()
        .activate_runtime_version(&paths, "openclaw", "2026.4.9-windows-x64")
        .expect("runtime activation");

    let runtime_upgrades = read_json_file::<RuntimeUpgradesState>(&paths.openclaw_runtime_upgrades_file)
        .expect("runtime upgrades");
    assert_eq!(
        runtime_upgrades
            .runtimes
            .get("openclaw")
            .and_then(|entry| entry.last_applied_version.as_deref()),
        Some("2026.4.9-windows-x64")
    );
    assert!(receipt.receipt_file.contains("runtime-openclaw-2026.4.9-windows-x64.json"));
}
```

- [ ] **Step 2: Run the runtime-upgrade test to verify runtime state is incomplete**

Run: `cargo test runtime_upgrade_activation_updates_runtime_upgrade_state_and_receipt -- --exact`
Expected: FAIL because `activate_runtime_version` currently updates active/inventory state but not the authority runtime-upgrade ledger

- [ ] **Step 3: Update runtime activation bookkeeping**

```rust
if let Some(entry) = runtime_upgrades.runtimes.get_mut(runtime_id) {
    entry.last_attempted_version = Some(version.to_string());
    entry.last_applied_version = Some(version.to_string());
    entry.active_install_key = Some(version.to_string());
    entry.fallback_install_key = previous_active.clone();
    entry.last_error = None;
}
```

- [ ] **Step 4: Record migration success and failure to the authority state**

```rust
authority.record_openclaw_activation_result(paths, ActivationRecord {
    install_key: version.to_string(),
    success: true,
    error: None,
})?;
```

- [ ] **Step 5: Run the targeted runtime-upgrade test**

Run: `cargo test runtime_upgrade_activation_updates_runtime_upgrade_state_and_receipt -- --exact`
Expected: PASS

- [ ] **Step 6: Re-run the existing runtime activation test**

Run: `cargo test upgrade_activation_promotes_runtime_version_into_current_and_updates_state -- --exact`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs
git commit -m "feat: record runtime upgrade authority state"
```

### Task 6: Route Managed Runtime Projections Through The Authority

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`

- [ ] **Step 1: Write the failing projection test**

```rust
#[test]
fn built_in_instance_detail_reads_authority_managed_config_target() {
    let (_root, paths, config, storage, service) = studio_context();
    let authority = KernelRuntimeAuthorityService::new();
    let managed_config_path = authority.active_openclaw_config_path(&paths).expect("config path");

    let detail = service
        .get_instance_detail(&paths, &config, &storage, DEFAULT_INSTANCE_ID)
        .expect("detail")
        .expect("built-in detail");

    assert!(detail.data_access.routes.iter().any(|route| {
        route.target.as_deref() == Some(managed_config_path.to_string_lossy().as_ref())
    }));
}
```

- [ ] **Step 2: Run the projection test to verify studio still points at the legacy path**

Run: `cargo test built_in_instance_detail_reads_authority_managed_config_target -- --exact`
Expected: FAIL because `studio.rs` still projects `paths.openclaw_config_file`

- [ ] **Step 3: Route built-in runtime projection and kernel host ownership through the authority**

```rust
let managed_config_path = authority.active_openclaw_config_path(paths)?;
let managed_contract = authority.openclaw_contract(paths)?;
```

- [ ] **Step 4: Update `internal_cli.rs` and snapshot services to read the active authority contract**

```rust
let runtime_contract = authority.openclaw_contract(&paths)?;
supervisor.configure_openclaw_gateway(&runtime_with_contract)?;
```

- [ ] **Step 5: Run the projection test**

Run: `cargo test built_in_instance_detail_reads_authority_managed_config_target -- --exact`
Expected: PASS

- [ ] **Step 6: Re-run the existing kernel host service spec test**

Run: `cargo test platform_service_specs_cover_windows_macos_and_linux_hosts -- --exact`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs
git commit -m "feat: route managed openclaw projections through authority"
```

### Task 7: Finalize The Generic Kernel Adapter Boundary And Cross-Platform Tests

**Files:**

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/adapter.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write the failing cross-platform contract test**

```rust
#[test]
fn openclaw_adapter_contract_is_platform_neutral() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let authority = KernelRuntimeAuthorityService::new();
    let contract = authority.openclaw_contract(&paths).expect("contract");

    assert_eq!(contract.runtime_id, "openclaw");
    assert!(!contract.owned_runtime_roots.is_empty());
    assert!(contract.readiness_probe.supports_loopback_health_probe);
}
```

- [ ] **Step 2: Run the contract test to confirm the shared contract still leaks OpenClaw-specific assumptions**

Run: `cargo test openclaw_adapter_contract_is_platform_neutral -- --exact`
Expected: FAIL because readiness or owned-root behavior is still spread across service-specific code

- [ ] **Step 3: Move shared launch/readiness/process-match fields into the generic adapter contract**

```rust
pub struct KernelRuntimeReadinessProbe {
    pub supports_loopback_health_probe: bool,
    pub health_probe_timeout_ms: u64,
}
```

- [ ] **Step 4: Make supervisor startup consume the generic contract instead of direct OpenClaw assumptions where possible**

```rust
let contract = authority.openclaw_contract(paths)?;
let readiness = contract.readiness_probe.clone();
```

- [ ] **Step 5: Add platform regression tests that preserve Windows, macOS, and Linux host behavior**

```rust
assert_eq!(resolve_platform_service_spec(KernelHostPlatform::Windows, &paths).service_name, "ClawStudioOpenClawKernel");
assert_eq!(resolve_platform_service_spec(KernelHostPlatform::Macos, &paths).service_manager, KernelServiceManagerKind::LaunchdLaunchAgent);
assert_eq!(resolve_platform_service_spec(KernelHostPlatform::Linux, &paths).service_manager, KernelServiceManagerKind::SystemdUser);
```

- [ ] **Step 6: Run the targeted platform tests**

Run: `cargo test platform_service_specs_cover_windows_macos_and_linux_hosts -- --exact`
Expected: PASS

Run: `cargo test openclaw_adapter_contract_is_platform_neutral -- --exact`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/platform.rs
git commit -m "refactor: extract kernel runtime adapter boundary"
```

### Task 8: Verification Sweep

**Files:**

- Modify: none unless a failing verification reveals a real defect
- Test: all previously touched Rust modules

- [ ] **Step 1: Run focused Rust tests for the touched modules**

Run: `cargo test creates_openclaw_authority_state_paths -- --exact`
Expected: PASS

Run: `cargo test initializes_runtime_upgrade_state_for_openclaw -- --exact`
Expected: PASS

Run: `cargo test reaps_legacy_managed_openclaw_gateway_processes_before_activation -- --exact`
Expected: PASS

Run: `cargo test managed_openclaw_config_migration_strips_host_version_metadata -- --exact`
Expected: PASS

Run: `cargo test runtime_upgrade_activation_updates_runtime_upgrade_state_and_receipt -- --exact`
Expected: PASS

Run: `cargo test built_in_instance_detail_reads_authority_managed_config_target -- --exact`
Expected: PASS

Run: `cargo test openclaw_adapter_contract_is_platform_neutral -- --exact`
Expected: PASS

- [ ] **Step 2: Run the broader desktop Rust test suite**

Run: `cargo test`
Expected: PASS

- [ ] **Step 3: Run workspace lint from repo root**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Run workspace build from repo root**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: Commit the verified implementation**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src docs/superpowers/plans/2026-04-12-openclaw-runtime-authority-and-kernel-adapter-implementation-plan.md
git commit -m "feat: harden openclaw runtime authority and kernel adapter"
```
