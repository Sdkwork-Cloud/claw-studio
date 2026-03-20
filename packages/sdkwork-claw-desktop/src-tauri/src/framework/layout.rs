use crate::framework::{paths::AppPaths, Result};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::Path};

const LAYOUT_VERSION: u32 = 1;
const PRODUCT_ID: &str = "sdkwork.crawstudio";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LayoutState {
    pub layout_version: u32,
    pub product_id: String,
    pub install_root: String,
    pub machine_root: String,
    pub user_root: String,
    pub last_migrated_at: Option<String>,
}

impl Default for LayoutState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            product_id: PRODUCT_ID.to_string(),
            install_root: String::new(),
            machine_root: String::new(),
            user_root: String::new(),
            last_migrated_at: None,
        }
    }
}

impl LayoutState {
    pub fn from_paths(paths: &AppPaths) -> Self {
        Self {
            install_root: paths.install_root.to_string_lossy().into_owned(),
            machine_root: paths.machine_root.to_string_lossy().into_owned(),
            user_root: paths.user_root.to_string_lossy().into_owned(),
            ..Self::default()
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct ActiveStateEntry {
    pub active_version: Option<String>,
    pub fallback_version: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ActiveState {
    pub layout_version: u32,
    pub modules: BTreeMap<String, ActiveStateEntry>,
    pub runtimes: BTreeMap<String, ActiveStateEntry>,
}

impl Default for ActiveState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            modules: BTreeMap::new(),
            runtimes: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InventoryState {
    pub layout_version: u32,
    pub module_packages: BTreeMap<String, Vec<String>>,
    pub runtime_packages: BTreeMap<String, Vec<String>>,
}

impl Default for InventoryState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            module_packages: BTreeMap::new(),
            runtime_packages: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PinnedState {
    pub layout_version: u32,
    pub modules: BTreeMap<String, Vec<String>>,
    pub runtimes: BTreeMap<String, Vec<String>>,
}

impl Default for PinnedState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            modules: BTreeMap::new(),
            runtimes: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ChannelState {
    pub layout_version: u32,
    pub modules: BTreeMap<String, String>,
    pub runtimes: BTreeMap<String, String>,
}

impl Default for ChannelState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            modules: BTreeMap::new(),
            runtimes: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PolicyState {
    pub layout_version: u32,
    pub allow_module_hot_update: bool,
    pub allow_runtime_hot_update: bool,
    pub allow_rollback: bool,
    pub require_signed_packages: bool,
}

impl Default for PolicyState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            allow_module_hot_update: true,
            allow_runtime_hot_update: true,
            allow_rollback: true,
            require_signed_packages: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SourceState {
    pub layout_version: u32,
    pub modules: BTreeMap<String, Vec<String>>,
    pub runtimes: BTreeMap<String, Vec<String>>,
}

impl Default for SourceState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            modules: BTreeMap::new(),
            runtimes: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ServiceState {
    pub layout_version: u32,
    pub service_enabled: bool,
    pub maintenance_mode: bool,
    pub last_cleanup_at: Option<String>,
    pub last_health_check_at: Option<String>,
}

impl Default for ServiceState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            service_enabled: true,
            maintenance_mode: false,
            last_cleanup_at: None,
            last_health_check_at: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RetentionBucket {
    pub active_slots: u32,
    pub fallback_slots: u32,
    pub historical_packages: u32,
}

impl Default for RetentionBucket {
    fn default() -> Self {
        Self {
            active_slots: 1,
            fallback_slots: 1,
            historical_packages: 0,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RetentionState {
    pub layout_version: u32,
    pub modules: RetentionBucket,
    pub runtimes: RetentionBucket,
}

impl Default for RetentionState {
    fn default() -> Self {
        Self {
            layout_version: LAYOUT_VERSION,
            modules: RetentionBucket {
                historical_packages: 3,
                ..RetentionBucket::default()
            },
            runtimes: RetentionBucket {
                historical_packages: 2,
                ..RetentionBucket::default()
            },
        }
    }
}

pub fn initialize_machine_state(paths: &AppPaths) -> Result<()> {
    write_json_if_missing(&paths.layout_file, &LayoutState::from_paths(paths))?;
    write_json_if_missing(&paths.active_file, &ActiveState::default())?;
    write_json_if_missing(&paths.inventory_file, &InventoryState::default())?;
    write_json_if_missing(&paths.retention_file, &RetentionState::default())?;
    write_json_if_missing(&paths.pinned_file, &PinnedState::default())?;
    write_json_if_missing(&paths.channels_file, &ChannelState::default())?;
    write_json_if_missing(&paths.policies_file, &PolicyState::default())?;
    write_json_if_missing(&paths.sources_file, &SourceState::default())?;
    write_json_if_missing(&paths.service_file, &ServiceState::default())?;
    Ok(())
}

pub fn set_active_runtime_version(
    paths: &AppPaths,
    runtime_id: &str,
    version: &str,
) -> Result<()> {
    let mut active = read_json_file::<ActiveState>(&paths.active_file)?;
    let entry = active.runtimes.entry(runtime_id.to_string()).or_default();

    if entry.active_version.as_deref() != Some(version) {
        entry.fallback_version = entry.active_version.clone();
        entry.active_version = Some(version.to_string());
    }

    write_json_file(&paths.active_file, &active)
}

fn write_json_if_missing<T>(path: &Path, value: &T) -> Result<()>
where
    T: Serialize + DeserializeOwned,
{
    if path.exists() {
        let parsed = read_json_file::<T>(path)?;
        write_json_file(path, &parsed)?;
        return Ok(());
    }

    write_json_file(path, value)?;
    Ok(())
}

fn read_json_file<T>(path: &Path) -> Result<T>
where
    T: DeserializeOwned,
{
    let content = fs::read_to_string(path)?;
    serde_json::from_str::<T>(&content).map_err(Into::into)
}

fn write_json_file<T>(path: &Path, value: &T) -> Result<()>
where
    T: Serialize,
{
    let content = serde_json::to_string_pretty(value)?;
    fs::write(path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        initialize_machine_state, set_active_runtime_version, ActiveState, InventoryState,
        LayoutState, PinnedState, RetentionState,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use serde_json::Value;

    #[test]
    fn initializes_machine_state_files_with_expected_defaults() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        initialize_machine_state(&paths).expect("initialize machine state");

        let layout = serde_json::from_str::<LayoutState>(
            &std::fs::read_to_string(&paths.layout_file).expect("layout file"),
        )
        .expect("layout json");
        let active = serde_json::from_str::<ActiveState>(
            &std::fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        let inventory = serde_json::from_str::<InventoryState>(
            &std::fs::read_to_string(&paths.inventory_file).expect("inventory file"),
        )
        .expect("inventory json");
        let retention = serde_json::from_str::<RetentionState>(
            &std::fs::read_to_string(&paths.retention_file).expect("retention file"),
        )
        .expect("retention json");
        let pinned = serde_json::from_str::<PinnedState>(
            &std::fs::read_to_string(&paths.pinned_file).expect("pinned file"),
        )
        .expect("pinned json");
        let channels = serde_json::from_str::<Value>(
            &std::fs::read_to_string(&paths.channels_file).expect("channels file"),
        )
        .expect("channels json");
        let policies = serde_json::from_str::<Value>(
            &std::fs::read_to_string(&paths.policies_file).expect("policies file"),
        )
        .expect("policies json");
        let sources = serde_json::from_str::<Value>(
            &std::fs::read_to_string(&paths.sources_file).expect("sources file"),
        )
        .expect("sources json");
        let service = serde_json::from_str::<Value>(
            &std::fs::read_to_string(&paths.service_file).expect("service file"),
        )
        .expect("service json");

        assert_eq!(layout.layout_version, 1);
        assert!(layout.install_root.replace('\\', "/").ends_with("install"));
        assert!(layout.machine_root.replace('\\', "/").ends_with("machine"));
        assert!(layout.user_root.replace('\\', "/").ends_with("user-home"));
        assert!(active.modules.is_empty());
        assert!(active.runtimes.is_empty());
        assert!(inventory.module_packages.is_empty());
        assert!(inventory.runtime_packages.is_empty());
        assert_eq!(retention.modules.historical_packages, 3);
        assert_eq!(retention.runtimes.historical_packages, 2);
        assert!(pinned.modules.is_empty());
        assert!(pinned.runtimes.is_empty());
        assert_eq!(
            channels.get("layoutVersion").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            channels
                .pointer("/modules")
                .and_then(Value::as_object)
                .map(|value| value.len()),
            Some(0)
        );
        assert_eq!(
            channels
                .pointer("/runtimes")
                .and_then(Value::as_object)
                .map(|value| value.len()),
            Some(0)
        );
        assert_eq!(
            policies.get("layoutVersion").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            policies
                .get("allowModuleHotUpdate")
                .and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            policies
                .get("allowRuntimeHotUpdate")
                .and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            sources.get("layoutVersion").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            sources
                .pointer("/modules")
                .and_then(Value::as_object)
                .map(|value| value.len()),
            Some(0)
        );
        assert_eq!(
            sources
                .pointer("/runtimes")
                .and_then(Value::as_object)
                .map(|value| value.len()),
            Some(0)
        );
        assert_eq!(
            service.get("layoutVersion").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            service.get("serviceEnabled").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            service.get("maintenanceMode").and_then(Value::as_bool),
            Some(false)
        );
    }

    #[test]
    fn tracks_active_runtime_versions_with_fallback_history() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        set_active_runtime_version(&paths, "openclaw", "2026.3.13-windows-x64")
            .expect("first runtime activation");
        set_active_runtime_version(&paths, "openclaw", "2026.3.20-windows-x64")
            .expect("second runtime activation");

        let active = serde_json::from_str::<ActiveState>(
            &std::fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        let openclaw = active
            .runtimes
            .get("openclaw")
            .expect("openclaw active runtime");

        assert_eq!(
            openclaw.active_version.as_deref(),
            Some("2026.3.20-windows-x64")
        );
        assert_eq!(
            openclaw.fallback_version.as_deref(),
            Some("2026.3.13-windows-x64")
        );
    }
}
