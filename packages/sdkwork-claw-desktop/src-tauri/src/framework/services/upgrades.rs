use crate::framework::{
    layout::{ActiveState, ComponentsState, InventoryState, UpgradesState},
    paths::AppPaths,
    services::{
        kernel_runtime_authority::KernelRuntimeAuthorityService,
        openclaw_runtime::{validate_installed_openclaw_runtime, OPENCLAW_RUNTIME_ID},
    },
    FrameworkError, Result,
};
use serde::{de::DeserializeOwned, Serialize};
use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentUpgradeReceipt {
    pub component_id: String,
    pub activated_version: String,
    pub fallback_version: Option<String>,
    pub receipt_file: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeUpgradeReceipt {
    pub runtime_id: String,
    pub activated_version: String,
    pub fallback_version: Option<String>,
    pub receipt_file: String,
}

#[derive(Clone, Debug, Default)]
pub struct ComponentUpgradeService;

impl ComponentUpgradeService {
    pub fn new() -> Self {
        Self
    }

    pub fn activate_component_version(
        &self,
        paths: &AppPaths,
        component_id: &str,
        version: &str,
    ) -> Result<ComponentUpgradeReceipt> {
        let component_dir = paths.modules_dir.join(component_id);
        let version_dir = component_dir.join(version);
        if !version_dir.exists() {
            return Err(FrameworkError::NotFound(format!(
                "staged component version not found: {}",
                version_dir.display()
            )));
        }

        let current_dir = component_dir.join("current");
        replace_directory_from_version(&version_dir, &current_dir)?;

        let mut components = read_json_file::<ComponentsState>(&paths.components_file)?;
        let mut upgrades = read_json_file::<UpgradesState>(&paths.upgrades_file)?;
        let mut active = read_json_file::<ActiveState>(&paths.active_file)?;
        let mut inventory = read_json_file::<InventoryState>(&paths.inventory_file)?;

        let previous_active = components
            .entries
            .get(component_id)
            .and_then(|entry| entry.active_version.clone())
            .filter(|current| current != version);

        if let Some(entry) = components.entries.get_mut(component_id) {
            entry.bundled_version = version.to_string();
            entry.active_version = Some(version.to_string());
            entry.fallback_version = previous_active.clone();
        }

        if let Some(entry) = upgrades.components.get_mut(component_id) {
            entry.last_attempted_version = Some(version.to_string());
            entry.last_applied_version = Some(version.to_string());
            entry.last_error = None;
        }

        {
            let active_entry = active.modules.entry(component_id.to_string()).or_default();
            active_entry.active_version = Some(version.to_string());
            active_entry.fallback_version = previous_active.clone();
        }

        {
            let packages = inventory
                .module_packages
                .entry(component_id.to_string())
                .or_default();
            let mut unique = packages.iter().cloned().collect::<BTreeSet<_>>();
            unique.insert(version.to_string());
            *packages = unique.into_iter().collect();
        }

        write_json_file(&paths.components_file, &components)?;
        write_json_file(&paths.upgrades_file, &upgrades)?;
        write_json_file(&paths.active_file, &active)?;
        write_json_file(&paths.inventory_file, &inventory)?;

        let receipt_dir = paths.machine_receipts_dir.join("updates");
        fs::create_dir_all(&receipt_dir)?;
        let receipt_path = receipt_dir.join(format!("{component_id}-{version}.json"));
        let receipt = ComponentUpgradeReceipt {
            component_id: component_id.to_string(),
            activated_version: version.to_string(),
            fallback_version: previous_active,
            receipt_file: receipt_path.to_string_lossy().into_owned(),
        };
        write_json_file(&receipt_path, &receipt)?;

        Ok(receipt)
    }

    pub fn activate_runtime_version(
        &self,
        paths: &AppPaths,
        runtime_id: &str,
        version: &str,
    ) -> Result<RuntimeUpgradeReceipt> {
        let runtime_dir = paths.runtimes_dir.join(runtime_id);
        let version_dir = runtime_dir.join(version);
        if !version_dir.exists() {
            return Err(FrameworkError::NotFound(format!(
                "staged runtime version not found: {}",
                version_dir.display()
            )));
        }
        let is_openclaw_runtime = runtime_id == OPENCLAW_RUNTIME_ID;
        if is_openclaw_runtime {
            validate_installed_openclaw_runtime(paths, version)?;
        }

        let current_dir = runtime_dir.join("current");

        let mut active = read_json_file::<ActiveState>(&paths.active_file)?;
        let mut inventory = read_json_file::<InventoryState>(&paths.inventory_file)?;

        let previous_active = active
            .runtimes
            .get(runtime_id)
            .and_then(|entry| entry.active_runtime_install_key().map(str::to_string))
            .filter(|current| current != version);

        if !is_openclaw_runtime {
            let active_entry = active.runtimes.entry(runtime_id.to_string()).or_default();
            active_entry.set_runtime_state(
                Some(version.to_string()),
                previous_active.clone(),
                Some(version.to_string()),
                previous_active.clone(),
            );
        }

        {
            let packages = inventory
                .runtime_packages
                .entry(runtime_id.to_string())
                .or_default();
            let mut unique = packages.iter().cloned().collect::<BTreeSet<_>>();
            unique.insert(version.to_string());
            *packages = unique.into_iter().collect();
        }

        let inventory_backup = if is_openclaw_runtime {
            Some(capture_file_backup(&paths.inventory_file)?)
        } else {
            None
        };
        let current_dir_backup = move_directory_to_backup(&current_dir)?;
        let replace_result = replace_directory_from_version(&version_dir, &current_dir);
        if let Err(error) = replace_result {
            let _ = restore_directory_from_backup(&current_dir, current_dir_backup.as_deref());
            return Err(error);
        }

        let write_result = if is_openclaw_runtime {
            let result = (|| -> Result<()> {
                write_json_file(&paths.inventory_file, &inventory)?;
                KernelRuntimeAuthorityService::new()
                    .record_activation_result(runtime_id, paths, version, None)?;
                Ok(())
            })();
            if result.is_err() {
                if let Some(inventory_backup) = &inventory_backup {
                    let _ = restore_file_backup(inventory_backup);
                }
            }
            result
        } else {
            (|| -> Result<()> {
                write_json_file(&paths.active_file, &active)?;
                write_json_file(&paths.inventory_file, &inventory)?;
                Ok(())
            })()
        };

        if let Err(error) = write_result {
            let _ = restore_directory_from_backup(&current_dir, current_dir_backup.as_deref());
            return Err(error);
        }
        cleanup_directory_backup(current_dir_backup)?;

        let receipt_dir = paths.machine_receipts_dir.join("updates");
        fs::create_dir_all(&receipt_dir)?;
        let receipt_path = receipt_dir.join(format!("runtime-{runtime_id}-{version}.json"));
        let receipt = RuntimeUpgradeReceipt {
            runtime_id: runtime_id.to_string(),
            activated_version: version.to_string(),
            fallback_version: previous_active,
            receipt_file: receipt_path.to_string_lossy().into_owned(),
        };
        write_json_file(&receipt_path, &receipt)?;

        Ok(receipt)
    }
}

fn read_json_file<T>(path: &Path) -> Result<T>
where
    T: DeserializeOwned,
{
    let content = fs::read_to_string(path).map_err(|error| {
        FrameworkError::Io(std::io::Error::new(
            error.kind(),
            format!("failed to read {}: {error}", path.display()),
        ))
    })?;
    Ok(serde_json::from_str(&content)?)
}

fn write_json_file<T>(path: &Path, value: &T) -> Result<()>
where
    T: Serialize,
{
    let content = serde_json::to_string_pretty(value)?;
    fs::write(path, content)?;
    Ok(())
}

fn replace_directory_from_version(source_dir: &Path, target_dir: &Path) -> Result<()> {
    if target_dir.exists() {
        fs::remove_dir_all(target_dir)?;
    }
    copy_directory_contents(source_dir, target_dir)?;
    Ok(())
}

#[derive(Clone, Debug)]
struct FileBackup {
    path: PathBuf,
    content: Option<Vec<u8>>,
}

fn capture_file_backup(path: &Path) -> Result<FileBackup> {
    let content = if path.exists() {
        Some(fs::read(path)?)
    } else {
        None
    };
    Ok(FileBackup {
        path: path.to_path_buf(),
        content,
    })
}

fn restore_file_backup(backup: &FileBackup) -> Result<()> {
    if let Some(content) = &backup.content {
        fs::write(&backup.path, content)?;
    } else if backup.path.exists() {
        fs::remove_file(&backup.path)?;
    }
    Ok(())
}

fn move_directory_to_backup(target_dir: &Path) -> Result<Option<PathBuf>> {
    if !target_dir.exists() {
        return Ok(None);
    }
    let backup_dir = unique_directory_backup_path(target_dir)?;
    fs::rename(target_dir, &backup_dir)?;
    Ok(Some(backup_dir))
}

fn restore_directory_from_backup(target_dir: &Path, backup_dir: Option<&Path>) -> Result<()> {
    if target_dir.exists() {
        fs::remove_dir_all(target_dir)?;
    }
    if let Some(backup_dir) = backup_dir {
        fs::rename(backup_dir, target_dir)?;
    }
    Ok(())
}

fn cleanup_directory_backup(backup_dir: Option<PathBuf>) -> Result<()> {
    if let Some(backup_dir) = backup_dir.filter(|path| path.exists()) {
        fs::remove_dir_all(backup_dir)?;
    }
    Ok(())
}

fn unique_directory_backup_path(target_dir: &Path) -> Result<PathBuf> {
    let file_name = target_dir
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "current".to_string());
    let parent = target_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let stamp = unix_timestamp_ms()?;
    let candidate = parent.join(format!("{file_name}.rollback-{stamp}"));
    if !candidate.exists() {
        return Ok(candidate);
    }
    for suffix in 1..=32 {
        let candidate = parent.join(format!("{file_name}.rollback-{stamp}-{suffix}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(FrameworkError::Conflict(format!(
        "failed to allocate a rollback directory for {}",
        target_dir.display()
    )))
}

fn unix_timestamp_ms() -> Result<u128> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to resolve runtime upgrade rollback timestamp: {error}"
            ))
        })
}

fn copy_directory_contents(source_dir: &Path, target_dir: &Path) -> Result<()> {
    fs::create_dir_all(target_dir)?;

    for entry in fs::read_dir(source_dir)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target_dir.join(entry.file_name());

        if entry.file_type()?.is_dir() {
            copy_directory_contents(&source_path, &target_path)?;
            continue;
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&source_path, &target_path)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ComponentUpgradeService;
    use crate::framework::{
        layout::{
            initialize_machine_state, ActiveState, ComponentsState, InventoryState,
            RuntimeUpgradesState, UpgradesState,
        },
        paths::resolve_paths_for_root,
        services::openclaw_runtime::BundledOpenClawManifest,
    };
    use sha2::{Digest, Sha256};
    use std::{fs, path::Path};

    #[test]
    fn upgrade_activation_promotes_staged_version_into_current_and_records_fallback() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_component_layout(root.path());

        let service = ComponentUpgradeService::new();
        let receipt = service
            .activate_component_version(&paths, "codex", "2.0.0")
            .expect("upgrade activation");

        assert_eq!(receipt.component_id, "codex");
        assert_eq!(receipt.activated_version, "2.0.0");
        assert_eq!(receipt.fallback_version.as_deref(), Some("1.0.0"));
        assert_eq!(
            std::fs::read_to_string(
                paths
                    .modules_dir
                    .join("codex")
                    .join("current")
                    .join("bin")
                    .join("codex.exe")
            )
            .expect("current codex"),
            "version-2"
        );
    }

    #[test]
    fn upgrade_activation_updates_machine_state_and_writes_receipt() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_component_layout(root.path());

        ComponentUpgradeService::new()
            .activate_component_version(&paths, "codex", "2.0.0")
            .expect("upgrade activation");

        let components = serde_json::from_str::<ComponentsState>(
            &std::fs::read_to_string(&paths.components_file).expect("components file"),
        )
        .expect("components json");
        let upgrades = serde_json::from_str::<UpgradesState>(
            &std::fs::read_to_string(&paths.upgrades_file).expect("upgrades file"),
        )
        .expect("upgrades json");
        let active = serde_json::from_str::<ActiveState>(
            &std::fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        let inventory = serde_json::from_str::<InventoryState>(
            &std::fs::read_to_string(&paths.inventory_file).expect("inventory file"),
        )
        .expect("inventory json");
        let receipts_dir = paths.machine_receipts_dir.join("updates");

        assert_eq!(
            components
                .entries
                .get("codex")
                .and_then(|entry| entry.active_version.as_deref()),
            Some("2.0.0")
        );
        assert_eq!(
            components
                .entries
                .get("codex")
                .and_then(|entry| entry.fallback_version.as_deref()),
            Some("1.0.0")
        );
        assert_eq!(
            upgrades
                .components
                .get("codex")
                .and_then(|entry| entry.last_applied_version.as_deref()),
            Some("2.0.0")
        );
        assert_eq!(
            active
                .modules
                .get("codex")
                .and_then(|entry| entry.active_version.as_deref()),
            Some("2.0.0")
        );
        assert_eq!(
            active
                .modules
                .get("codex")
                .and_then(|entry| entry.fallback_version.as_deref()),
            Some("1.0.0")
        );
        assert_eq!(
            inventory.module_packages.get("codex"),
            Some(&vec!["1.0.0".to_string(), "2.0.0".to_string()])
        );
        assert!(receipts_dir.exists());
        assert_eq!(
            receipts_dir
                .read_dir()
                .expect("receipts")
                .filter_map(|entry| entry.ok())
                .count(),
            1
        );
    }

    #[test]
    fn upgrade_activation_promotes_runtime_version_into_current_and_updates_state() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_runtime_layout(root.path());

        let receipt = ComponentUpgradeService::new()
            .activate_runtime_version(&paths, "node", "22.16.0")
            .expect("runtime activation");

        let active = serde_json::from_str::<ActiveState>(
            &std::fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        let inventory = serde_json::from_str::<InventoryState>(
            &std::fs::read_to_string(&paths.inventory_file).expect("inventory file"),
        )
        .expect("inventory json");

        assert_eq!(receipt.runtime_id, "node");
        assert_eq!(receipt.activated_version, "22.16.0");
        assert_eq!(receipt.fallback_version.as_deref(), Some("20.10.0"));
        assert_eq!(
            std::fs::read_to_string(
                paths
                    .runtimes_dir
                    .join("node")
                    .join("current")
                    .join("node.exe")
            )
            .expect("current node runtime"),
            "runtime-22"
        );
        assert_eq!(
            active
                .runtimes
                .get("node")
                .and_then(|entry| entry.active_version.as_deref()),
            Some("22.16.0")
        );
        assert_eq!(
            active
                .runtimes
                .get("node")
                .and_then(|entry| entry.fallback_version.as_deref()),
            Some("20.10.0")
        );
        assert_eq!(
            inventory.runtime_packages.get("node"),
            Some(&vec!["20.10.0".to_string(), "22.16.0".to_string()])
        );
    }

    #[test]
    fn runtime_upgrade_activation_updates_runtime_upgrade_state_and_receipt() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let previous_install_key = openclaw_install_key("2026.3.28");
        let next_install_key = openclaw_install_key("2026.4.9");
        seed_openclaw_runtime_layout(root.path());

        let receipt = ComponentUpgradeService::new()
            .activate_runtime_version(&paths, "openclaw", &next_install_key)
            .expect("runtime activation");

        let runtime_upgrades = serde_json::from_str::<RuntimeUpgradesState>(
            &std::fs::read_to_string(&paths.openclaw_runtime_upgrades_file)
                .expect("runtime upgrades file"),
        )
        .expect("runtime upgrades json");

        assert_eq!(receipt.runtime_id, "openclaw");
        assert_eq!(receipt.activated_version, next_install_key);
        assert_eq!(
            runtime_upgrades
                .runtimes
                .get("openclaw")
                .and_then(|entry| entry.last_applied_version.as_deref()),
            Some("2026.4.9")
        );
        assert_eq!(
            runtime_upgrades
                .runtimes
                .get("openclaw")
                .and_then(|entry| entry.active_install_key.as_deref()),
            Some(next_install_key.as_str())
        );
        assert_eq!(
            runtime_upgrades
                .runtimes
                .get("openclaw")
                .and_then(|entry| entry.fallback_install_key.as_deref()),
            Some(previous_install_key.as_str())
        );
        let runtime_upgrades_value =
            serde_json::to_value(&runtime_upgrades).expect("serialize runtime upgrades");
        assert_eq!(
            runtime_upgrades_value
                .pointer("/runtimes/openclaw/activeVersionLabel")
                .and_then(serde_json::Value::as_str),
            Some("2026.4.9")
        );
        assert_eq!(
            runtime_upgrades_value
                .pointer("/runtimes/openclaw/fallbackVersionLabel")
                .and_then(serde_json::Value::as_str),
            Some("2026.3.28")
        );
        assert!(
            receipt
                .receipt_file
                .contains(&format!("runtime-openclaw-{next_install_key}.json"))
        );
    }

    #[test]
    fn openclaw_runtime_upgrade_rejects_incomplete_runtime_before_switching_current() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let next_install_key = openclaw_install_key("2026.4.9");
        seed_openclaw_runtime_layout(root.path());
        fs::remove_file(paths.openclaw_runtime_dir.join(&next_install_key).join("manifest.json"))
            .expect("remove target manifest");

        let error = ComponentUpgradeService::new()
            .activate_runtime_version(&paths, "openclaw", &next_install_key)
            .expect_err("incomplete openclaw runtime should be rejected");

        assert!(!error.to_string().trim().is_empty());
        assert_eq!(
            std::fs::read_to_string(
                paths.runtimes_dir
                    .join("openclaw")
                    .join("current")
                    .join("runtime.txt")
            )
            .expect("current openclaw runtime"),
            "runtime-2026.3.28"
        );
    }

    #[test]
    fn openclaw_runtime_upgrade_rolls_back_current_runtime_when_authority_write_fails() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let next_install_key = openclaw_install_key("2026.4.9");
        seed_openclaw_runtime_layout(root.path());
        fs::remove_file(&paths.openclaw_authority_file).expect("remove authority file");
        fs::create_dir(&paths.openclaw_authority_file).expect("block authority file path");

        let error = ComponentUpgradeService::new()
            .activate_runtime_version(&paths, "openclaw", &next_install_key)
            .expect_err("authority write failure should roll back openclaw current runtime");

        assert!(!error.to_string().trim().is_empty());
        assert_eq!(
            std::fs::read_to_string(
                paths.runtimes_dir
                    .join("openclaw")
                    .join("current")
                    .join("runtime.txt")
            )
            .expect("restored current openclaw runtime"),
            "runtime-2026.3.28"
        );
    }

    fn seed_component_layout(root: &Path) {
        let install_root = root.join("install");
        let machine_state = root.join("machine").join("state");
        let current_dir = install_root
            .join("modules")
            .join("codex")
            .join("current")
            .join("bin");
        let version_1_dir = install_root
            .join("modules")
            .join("codex")
            .join("1.0.0")
            .join("bin");
        let version_2_dir = install_root
            .join("modules")
            .join("codex")
            .join("2.0.0")
            .join("bin");

        std::fs::create_dir_all(&current_dir).expect("current dir");
        std::fs::create_dir_all(&version_1_dir).expect("v1 dir");
        std::fs::create_dir_all(&version_2_dir).expect("v2 dir");
        std::fs::create_dir_all(&machine_state).expect("machine state");

        std::fs::write(current_dir.join("codex.exe"), "version-1").expect("current exe");
        std::fs::write(version_1_dir.join("codex.exe"), "version-1").expect("v1 exe");
        std::fs::write(version_2_dir.join("codex.exe"), "version-2").expect("v2 exe");
        std::fs::write(
            machine_state.join("components.json"),
            r#"{
  "layoutVersion": 1,
  "entries": {
    "codex": {
      "displayName": "Codex",
      "kind": "binary",
      "bundledVersion": "1.0.0",
      "activeVersion": "1.0.0",
      "fallbackVersion": null,
      "startupMode": "autoStart",
      "enabledByDefault": true
    }
  }
}"#,
        )
        .expect("components state");
        std::fs::write(
            machine_state.join("upgrades.json"),
            r#"{
  "layoutVersion": 1,
  "components": {
    "codex": {
      "channel": "stable",
      "autoUpgradeEnabled": false,
      "lastAttemptedVersion": "1.0.0",
      "lastAppliedVersion": "1.0.0",
      "lastAttemptedAt": null,
      "lastError": null
    }
  }
}"#,
        )
        .expect("upgrades state");
        std::fs::write(
            machine_state.join("active.json"),
            r#"{
  "layoutVersion": 1,
  "modules": {
    "codex": {
      "activeVersion": "1.0.0",
      "fallbackVersion": null
    }
  },
  "runtimes": {}
}"#,
        )
        .expect("active state");
        std::fs::write(
            machine_state.join("inventory.json"),
            r#"{
  "layoutVersion": 1,
  "modulePackages": {
    "codex": ["1.0.0", "2.0.0"]
  },
  "runtimePackages": {}
}"#,
        )
        .expect("inventory state");
    }

    fn seed_runtime_layout(root: &Path) {
        let install_root = root.join("install");
        let machine_state = root.join("machine").join("state");
        let current_dir = install_root.join("runtimes").join("node").join("current");
        let version_1_dir = install_root.join("runtimes").join("node").join("20.10.0");
        let version_2_dir = install_root.join("runtimes").join("node").join("22.16.0");

        std::fs::create_dir_all(&current_dir).expect("current dir");
        std::fs::create_dir_all(&version_1_dir).expect("v1 dir");
        std::fs::create_dir_all(&version_2_dir).expect("v2 dir");
        std::fs::create_dir_all(&machine_state).expect("machine state");

        std::fs::write(current_dir.join("node.exe"), "runtime-20").expect("current runtime");
        std::fs::write(version_1_dir.join("node.exe"), "runtime-20").expect("v1 runtime");
        std::fs::write(version_2_dir.join("node.exe"), "runtime-22").expect("v2 runtime");
        std::fs::write(
            machine_state.join("active.json"),
            r#"{
  "layoutVersion": 1,
  "modules": {},
  "runtimes": {
    "node": {
      "activeVersion": "20.10.0",
      "fallbackVersion": null
    }
  }
}"#,
        )
        .expect("active state");
        std::fs::write(
            machine_state.join("inventory.json"),
            r#"{
  "layoutVersion": 1,
  "modulePackages": {},
  "runtimePackages": {
    "node": ["20.10.0", "22.16.0"]
  }
}"#,
        )
        .expect("inventory state");
    }

    fn seed_openclaw_runtime_layout(root: &Path) {
        let install_root = root.join("install");
        let machine_state = root.join("machine").join("state");
        let paths = resolve_paths_for_root(root).expect("paths");
        let previous_install_key = openclaw_install_key("2026.3.28");
        let next_install_key = openclaw_install_key("2026.4.9");
        let current_dir = install_root
            .join("runtimes")
            .join("openclaw")
            .join("current");
        let version_1_dir = install_root
            .join("runtimes")
            .join("openclaw")
            .join(&previous_install_key);
        let version_2_dir = install_root
            .join("runtimes")
            .join("openclaw")
            .join(&next_install_key);

        fs::create_dir_all(&current_dir).expect("current dir");
        fs::create_dir_all(&machine_state).expect("machine state");
        initialize_machine_state(&paths).expect("initialize machine state");

        fs::write(current_dir.join("runtime.txt"), "runtime-2026.3.28").expect("current runtime");
        seed_complete_openclaw_runtime_install(&version_1_dir, "2026.3.28");
        seed_complete_openclaw_runtime_install(&version_2_dir, "2026.4.9");
        fs::write(
            machine_state.join("active.json"),
            serde_json::to_string_pretty(&serde_json::json!({
                "layoutVersion": 1,
                "modules": {},
                "runtimes": {
                    "openclaw": {
                        "activeVersion": previous_install_key.clone(),
                        "activeInstallKey": previous_install_key.clone(),
                        "activeVersionLabel": "2026.3.28",
                        "fallbackVersion": serde_json::Value::Null,
                    }
                }
            }))
            .expect("active state json"),
        )
        .expect("active state");
        fs::write(
            machine_state.join("inventory.json"),
            serde_json::to_string_pretty(&serde_json::json!({
                "layoutVersion": 1,
                "modulePackages": {},
                "runtimePackages": {
                    "openclaw": [previous_install_key.clone(), next_install_key.clone()]
                }
            }))
            .expect("inventory state json"),
        )
        .expect("inventory state");
    }

    fn seed_complete_openclaw_runtime_install(install_dir: &Path, version: &str) {
        const CLI_RELATIVE_PATH: &str = "runtime/package/node_modules/openclaw/openclaw.mjs";
        let runtime_dir = install_dir.join("runtime");
        let cli_path = install_dir.join(CLI_RELATIVE_PATH);
        let openclaw_package_json_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("package.json");
        let carbon_package_json_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("@buape")
            .join("carbon")
            .join("package.json");
        let client_bedrock_package_json_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("@aws-sdk")
            .join("client-bedrock")
            .join("package.json");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::create_dir_all(
            openclaw_package_json_path
                .parent()
                .expect("openclaw package parent"),
        )
        .expect("openclaw package dir");
        fs::create_dir_all(
            carbon_package_json_path
                .parent()
                .expect("carbon package parent"),
        )
        .expect("carbon package dir");
        fs::create_dir_all(
            client_bedrock_package_json_path
                .parent()
                .expect("client bedrock package parent"),
        )
        .expect("client bedrock package dir");

        fs::write(install_dir.join("runtime.txt"), format!("runtime-{version}"))
            .expect("runtime marker");
        fs::write(&cli_path, "console.log('openclaw');").expect("cli file");
        fs::write(
            &openclaw_package_json_path,
            format!(
                r#"{{
  "name": "openclaw",
  "version": "{version}",
  "dependencies": {{
    "@buape/carbon": "0.14.0"
  }}
}}
"#
            ),
        )
        .expect("openclaw package json");
        fs::write(
            &carbon_package_json_path,
            r#"{
  "name": "@buape/carbon",
  "version": "0.14.0"
}
"#,
        )
        .expect("carbon package json");
        fs::write(
            &client_bedrock_package_json_path,
            r#"{
  "name": "@aws-sdk/client-bedrock",
  "version": "3.1020.0"
}
"#,
        )
        .expect("client bedrock package json");

        let manifest = BundledOpenClawManifest {
            schema_version: 2,
            runtime_id: "openclaw".to_string(),
            openclaw_version: version.to_string(),
            required_external_runtimes: vec!["nodejs".to_string()],
            required_external_runtime_versions: std::collections::BTreeMap::from([(
                "nodejs".to_string(),
                "22.16.0".to_string(),
            )]),
            platform: current_openclaw_test_platform().to_string(),
            arch: current_openclaw_test_arch().to_string(),
            cli_relative_path: CLI_RELATIVE_PATH.to_string(),
        };
        fs::write(
            install_dir.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");
        write_openclaw_runtime_sidecar_manifest(&runtime_dir, &manifest);
    }

    fn write_openclaw_runtime_sidecar_manifest(
        runtime_dir: &Path,
        manifest: &BundledOpenClawManifest,
    ) {
        let integrity_files = [
            manifest
                .cli_relative_path
                .trim_start_matches("runtime/")
                .to_string(),
            "package/node_modules/openclaw/package.json".to_string(),
            "package/node_modules/@buape/carbon/package.json".to_string(),
            "package/node_modules/@aws-sdk/client-bedrock/package.json".to_string(),
        ]
        .into_iter()
        .map(|relative_path| {
            let absolute_path = runtime_dir.join(&relative_path);
            let metadata = fs::metadata(&absolute_path).expect("runtime integrity file metadata");
            serde_json::json!({
                "relativePath": relative_path,
                "size": metadata.len(),
                "sha256": sha256_file_hex(&absolute_path),
            })
        })
        .collect::<Vec<_>>();
        let sidecar = serde_json::json!({
            "schemaVersion": manifest.schema_version,
            "runtimeId": manifest.runtime_id.clone(),
            "openclawVersion": manifest.openclaw_version.clone(),
            "requiredExternalRuntimes": manifest.required_external_runtimes.clone(),
            "requiredExternalRuntimeVersions": manifest.required_external_runtime_versions.clone(),
            "platform": manifest.platform.clone(),
            "arch": manifest.arch.clone(),
            "cliRelativePath": manifest.cli_relative_path.clone(),
            "runtimeIntegrity": {
                "schemaVersion": 1,
                "files": integrity_files,
            }
        });
        fs::write(
            runtime_dir.join(".sdkwork-openclaw-runtime.json"),
            format!(
                "{}\n",
                serde_json::to_string_pretty(&sidecar).expect("runtime sidecar json")
            ),
        )
        .expect("runtime sidecar manifest");
    }

    fn sha256_file_hex(path: &Path) -> String {
        let digest = Sha256::digest(fs::read(path).expect("read runtime integrity file"));
        digest
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    }

    fn openclaw_install_key(version: &str) -> String {
        format!(
            "{version}-{}-{}",
            current_openclaw_test_platform(),
            current_openclaw_test_arch()
        )
    }

    fn current_openclaw_test_platform() -> &'static str {
        if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            std::env::consts::OS
        }
    }

    fn current_openclaw_test_arch() -> &'static str {
        if cfg!(target_arch = "x86_64") {
            "x64"
        } else if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            std::env::consts::ARCH
        }
    }
}
