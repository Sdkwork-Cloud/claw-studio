# Built-In Kernel Authority Root And Path Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop host path and authority model so built-in kernels use `authorityRoot` for host-owned state and `userRoot` for canonical config truth.

**Architecture:** First harden the Tauri path and layout model so kernel authority state is explicitly separated from user config truth. Next project canonical kernel config and authority metadata through the desktop studio payloads, then migrate OpenClaw runtime services to stop treating the machine `managed-config` path as the canonical write target while preserving compatibility reads and migration evidence.

**Tech Stack:** Rust, Tauri desktop host, serde/serde_json/json5, existing Cargo unit tests, OpenClaw runtime services, studio projection services

---

## Execution Notes

- Execute Rust work from `packages/sdkwork-claw-desktop/src-tauri`.
- Use the spec baseline in `docs/superpowers/specs/2026-04-17-kernel-standard-model-and-built-in-governance-design.md`.
- Keep implementation scoped to built-in kernel authority/path hardening; do not redesign unrelated desktop UI.
- Legacy `managed-config` locations may be read and migrated, but new writes must target canonical kernel config paths.
- Do not stage unrelated dirty files from the current workspace.

## File Map

**Modify:**

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

**Primary test surfaces:**

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`

### Task 1: Separate Authority Root From Canonical Kernel Config Paths

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`

- [ ] **Step 1: Write failing path-layout tests**

```rust
#[test]
fn openclaw_paths_expose_authority_root_and_user_root_config_separately() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");

    assert!(paths.openclaw_authority_root.ends_with("machine/state/kernels/openclaw"));
    assert!(paths.openclaw_config_file.ends_with(".sdkwork/crawstudio/.openclaw/openclaw.json"));
    assert_ne!(paths.openclaw_authority_root, paths.openclaw_config_file.parent().unwrap());
}
```

- [ ] **Step 2: Run the targeted path tests**

Run: `cargo test openclaw_paths_expose_authority_root_and_user_root_config_separately -- --exact`
Expected: FAIL because `AppPaths` still exposes the older machine-owned managed config layout as the main OpenClaw config target.

- [ ] **Step 3: Add explicit authority-root and canonical config-file fields**

```rust
pub struct AppPaths {
    pub openclaw_authority_root: PathBuf,
    pub openclaw_authority_file: PathBuf,
    pub openclaw_migrations_file: PathBuf,
    pub openclaw_runtime_upgrades_file: PathBuf,
    pub openclaw_config_root: PathBuf,
    pub openclaw_config_file: PathBuf,
}
```

- [ ] **Step 4: Update layout initialization to treat authority files and canonical config paths as separate responsibilities**

```rust
write_json_if_missing(&kernel.authority_file, &KernelAuthorityState::default())?;
ensure_parent_dir(&paths.openclaw_config_file)?;
```

- [ ] **Step 5: Re-run the targeted path tests**

Run: `cargo test openclaw_paths_expose_authority_root_and_user_root_config_separately -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/framework/paths.rs src/framework/layout.rs
git commit -m "feat: separate built-in authority root from canonical config path"
```

### Task 2: Project Kernel Authority And Kernel Config Through Desktop Payloads

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`

- [ ] **Step 1: Write failing projection tests for kernel authority and kernel config payloads**

```rust
#[test]
fn studio_projection_exposes_kernel_config_instead_of_managed_config_path() {
    let payload = build_local_builtin_payload_for_test();
    assert!(payload["activeRuntime"]["kernelConfig"]["configFile"]
        .as_str()
        .unwrap()
        .ends_with(".openclaw/openclaw.json"));
    assert!(payload["activeRuntime"]["authority"]["managedConfigPath"].is_null());
}
```

- [ ] **Step 2: Run the targeted projection tests**

Run: `cargo test studio_projection_exposes_kernel_config_instead_of_managed_config_path -- --exact`
Expected: FAIL because studio payloads and `desktop_kernel` still serialize `managedConfigPath`.

- [ ] **Step 3: Replace payload fields with `kernelConfig` and `kernelAuthority` summaries**

```rust
json!({
  "kernelConfig": {
    "configFile": paths.openclaw_config_file,
    "configRoot": paths.openclaw_config_root,
    "userRoot": paths.user_root,
    "access": "localFs",
    "resolved": true,
    "writable": authority.config_writable,
    "provenance": "standardUserRoot"
  }
})
```

- [ ] **Step 4: Keep raw legacy path evidence only in diagnostics-facing structures, not in the shared runtime projection**

- [ ] **Step 5: Re-run the targeted projection tests**

Run: `cargo test studio_projection_exposes_kernel_config_instead_of_managed_config_path -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/framework/services/kernel_runtime_authority.rs src/framework/services/studio.rs src/commands/desktop_kernel.rs
git commit -m "feat: project kernel config and authority from desktop host"
```

### Task 3: Stop Built-In OpenClaw Writes From Targeting Legacy Managed-Config Paths

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`

- [ ] **Step 1: Write failing runtime write-target tests**

```rust
#[test]
fn built_in_openclaw_runtime_writes_canonical_user_root_config() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let target = resolve_active_openclaw_config_target(&paths).expect("config target");

    assert!(target.ends_with(".sdkwork/crawstudio/.openclaw/openclaw.json"));
    assert!(!target.to_string_lossy().contains("managed-config"));
}
```

- [ ] **Step 2: Run the targeted runtime tests**

Run: `cargo test built_in_openclaw_runtime_writes_canonical_user_root_config -- --exact`
Expected: FAIL because the active write target still resolves through the older managed-config chain.

- [ ] **Step 3: Move active config writes onto the canonical config path while keeping legacy import discovery**

```rust
fn resolve_active_openclaw_config_target(paths: &AppPaths) -> Result<PathBuf> {
    Ok(paths.openclaw_config_file.clone())
}
```

- [ ] **Step 4: Record legacy source usage in migration state instead of preserving dual write targets**

```rust
migrations.last_config_import_source = Some(legacy_path.to_string_lossy().into_owned());
migrations.last_config_import_target = Some(paths.openclaw_config_file.to_string_lossy().into_owned());
```

- [ ] **Step 5: Re-run the targeted runtime tests**

Run: `cargo test built_in_openclaw_runtime_writes_canonical_user_root_config -- --exact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/framework/services/openclaw_runtime.rs src/framework/services/openclaw_runtime_snapshot.rs src/framework/services/kernel_runtime_authority.rs
git commit -m "feat: write built-in openclaw config to canonical user root path"
```

### Task 4: Expose Built-In Governance Evidence Without Reintroducing Shared Managed Vocabulary

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`

- [ ] **Step 1: Write failing evidence tests**

```rust
#[test]
fn built_in_kernel_payload_reports_authority_root_and_not_managed_config_labels() {
    let payload = build_local_builtin_payload_for_test();
    assert!(payload["activeRuntime"]["authority"]["owner"].as_str() == Some("appManaged"));
    assert!(payload["activeRuntime"]["kernelConfig"]["configFile"].is_string());
    assert!(payload["activeRuntime"]["authority"]["managedConfigPath"].is_null());
}
```

- [ ] **Step 2: Run the targeted evidence tests**

Run: `cargo test built_in_kernel_payload_reports_authority_root_and_not_managed_config_labels -- --exact`
Expected: FAIL because the payload still includes old managed-config labels and fields.

- [ ] **Step 3: Replace remaining shared payload names and diagnostics summaries with standard kernel vocabulary**

```rust
authority["owner"] = json!("appManaged");
authority["controlPlane"] = json!("desktopHost");
payload["kernelConfig"]["configFile"] = json!(paths.openclaw_config_file);
```

- [ ] **Step 4: Keep any remaining `managedConfigPath` strings only in raw diagnostics or migration evidence blocks**

- [ ] **Step 5: Re-run the targeted evidence tests**

Run: `cargo test built_in_kernel_payload_reports_authority_root_and_not_managed_config_labels -- --exact`
Expected: PASS

- [ ] **Step 6: Run the broader Cargo verification for touched host services**

Run: `cargo test studio:: kernel_runtime_authority:: openclaw_runtime:: desktop_kernel:: -- --nocapture`
Expected: PASS for the touched unit suites

- [ ] **Step 7: Commit**

```bash
git add src/framework/services/studio.rs src/framework/desktop_host_bootstrap.rs src/commands/desktop_kernel.rs
git commit -m "refactor: align built-in kernel host payload vocabulary"
```
