use crate::framework::{
    layout::{ActiveState, ComponentsState, InventoryState, UpgradesState},
    paths::AppPaths,
    FrameworkError, Result,
};
use serde::{de::DeserializeOwned, Serialize};
use std::{collections::BTreeSet, fs, path::Path};

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

        let current_dir = runtime_dir.join("current");
        replace_directory_from_version(&version_dir, &current_dir)?;

        let mut active = read_json_file::<ActiveState>(&paths.active_file)?;
        let mut inventory = read_json_file::<InventoryState>(&paths.inventory_file)?;

        let previous_active = active
            .runtimes
            .get(runtime_id)
            .and_then(|entry| entry.active_version.clone())
            .filter(|current| current != version);

        {
            let active_entry = active.runtimes.entry(runtime_id.to_string()).or_default();
            active_entry.active_version = Some(version.to_string());
            active_entry.fallback_version = previous_active.clone();
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

        write_json_file(&paths.active_file, &active)?;
        write_json_file(&paths.inventory_file, &inventory)?;

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
        layout::{ActiveState, ComponentsState, InventoryState, UpgradesState},
        paths::resolve_paths_for_root,
    };
    use std::path::Path;

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
}
