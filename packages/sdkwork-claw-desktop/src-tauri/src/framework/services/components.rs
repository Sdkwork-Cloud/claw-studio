use crate::framework::{
    components::{
        bundled_component_defaults, default_startup_component_ids, PackagedComponentDefinition,
        PackagedComponentStartupMode,
    },
    kernel::{DesktopBundledComponentInfo, DesktopBundledComponentsInfo},
    paths::AppPaths,
    FrameworkError, Result,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

const COMPONENT_REGISTRY_FILE_NAME: &str = "component-registry.json";
const SERVICE_DEFAULTS_FILE_NAME: &str = "service-defaults.json";
const UPGRADE_POLICY_FILE_NAME: &str = "upgrade-policy.json";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct PackagedComponentRegistry {
    pub version: u32,
    pub components: Vec<PackagedComponentDefinition>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledServiceDefaults {
    pub version: u32,
    pub auto_start_component_ids: Vec<String>,
    pub manual_component_ids: Vec<String>,
    pub embedded_component_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledUpgradePolicy {
    pub version: u32,
    pub auto_upgrade_enabled: bool,
    pub approval_mode: String,
    pub default_channel: String,
    pub max_retained_historical_packages: u32,
}

impl Default for BundledUpgradePolicy {
    fn default() -> Self {
        Self {
            version: 1,
            auto_upgrade_enabled: false,
            approval_mode: "manual".to_string(),
            default_channel: "stable".to_string(),
            max_retained_historical_packages: 3,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledComponentResources {
    pub registry: PackagedComponentRegistry,
    pub service_defaults: BundledServiceDefaults,
    pub upgrade_policy: BundledUpgradePolicy,
}

#[derive(Clone, Debug, Default)]
pub struct ComponentRegistryService;

impl ComponentRegistryService {
    pub fn new() -> Self {
        Self
    }

    pub fn load_resources(&self, paths: &AppPaths) -> Result<BundledComponentResources> {
        self.load_resources_from_dir(&paths.foundation_components_dir)
    }

    pub fn load_resources_from_dir(&self, directory: &Path) -> Result<BundledComponentResources> {
        let active_directory = if directory.join(COMPONENT_REGISTRY_FILE_NAME).exists() {
            directory.to_path_buf()
        } else {
            source_component_resource_dir()
        };

        if !active_directory.join(COMPONENT_REGISTRY_FILE_NAME).exists() {
            return Ok(BundledComponentResources::from_defaults());
        }

        Ok(BundledComponentResources {
            registry: read_json_file(&active_directory.join(COMPONENT_REGISTRY_FILE_NAME))?,
            service_defaults: read_json_file(&active_directory.join(SERVICE_DEFAULTS_FILE_NAME))?,
            upgrade_policy: read_json_file(&active_directory.join(UPGRADE_POLICY_FILE_NAME))?,
        })
    }

    pub fn kernel_info(&self, paths: &AppPaths) -> Result<DesktopBundledComponentsInfo> {
        let resources = self.load_resources(paths)?;

        Ok(DesktopBundledComponentsInfo {
            component_count: resources.registry.components.len(),
            default_startup_component_ids: resources
                .service_defaults
                .auto_start_component_ids
                .clone(),
            auto_upgrade_enabled: resources.upgrade_policy.auto_upgrade_enabled,
            approval_mode: resources.upgrade_policy.approval_mode.clone(),
            components: resources
                .registry
                .components
                .into_iter()
                .map(|component| DesktopBundledComponentInfo {
                    id: component.id,
                    display_name: component.display_name,
                    kind: component_kind_label(&component.kind),
                    bundled_version: component.bundled_version,
                    startup_mode: startup_mode_label(&component.startup_mode),
                    install_subdir: component.install_subdir,
                })
                .collect(),
        })
    }
}

impl BundledComponentResources {
    pub fn from_defaults() -> Self {
        let definitions = bundled_component_defaults();
        let auto_start_component_ids = default_startup_component_ids(&definitions);
        let manual_component_ids = definitions
            .iter()
            .filter(|definition| definition.startup_mode == PackagedComponentStartupMode::Manual)
            .map(|definition| definition.id.clone())
            .collect::<Vec<_>>();
        let embedded_component_ids = definitions
            .iter()
            .filter(|definition| definition.startup_mode == PackagedComponentStartupMode::Embedded)
            .map(|definition| definition.id.clone())
            .collect::<Vec<_>>();

        Self {
            registry: PackagedComponentRegistry {
                version: 1,
                components: definitions,
            },
            service_defaults: BundledServiceDefaults {
                version: 1,
                auto_start_component_ids,
                manual_component_ids,
                embedded_component_ids,
            },
            upgrade_policy: BundledUpgradePolicy::default(),
        }
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
    Ok(serde_json::from_str::<T>(&content)?)
}

fn source_component_resource_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("foundation")
        .join("components")
}

fn component_kind_label(kind: &crate::framework::components::PackagedComponentKind) -> String {
    match kind {
        crate::framework::components::PackagedComponentKind::Binary => "binary".to_string(),
        crate::framework::components::PackagedComponentKind::NodeApp => "nodeApp".to_string(),
        crate::framework::components::PackagedComponentKind::ServiceGroup => {
            "serviceGroup".to_string()
        }
        crate::framework::components::PackagedComponentKind::EmbeddedLibrary => {
            "embeddedLibrary".to_string()
        }
    }
}

fn startup_mode_label(mode: &crate::framework::components::PackagedComponentStartupMode) -> String {
    match mode {
        crate::framework::components::PackagedComponentStartupMode::AutoStart => {
            "autoStart".to_string()
        }
        crate::framework::components::PackagedComponentStartupMode::Manual => "manual".to_string(),
        crate::framework::components::PackagedComponentStartupMode::Embedded => {
            "embedded".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ComponentRegistryService;
    use crate::framework::paths::resolve_paths_for_root;

    #[test]
    fn component_registry_resources_define_default_bundled_startup_contract() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ComponentRegistryService::new();

        let resources = service
            .load_resources(&paths)
            .expect("bundled component resources");

        assert_eq!(
            resources.service_defaults.auto_start_component_ids,
            vec!["openclaw".to_string()]
        );
        assert_eq!(
            resources.service_defaults.manual_component_ids,
            vec!["zeroclaw".to_string(), "ironclaw".to_string()]
        );
        assert_eq!(
            resources.service_defaults.embedded_component_ids,
            vec!["hub-installer".to_string()]
        );
        assert_eq!(resources.upgrade_policy.default_channel, "stable");
        assert_eq!(resources.upgrade_policy.approval_mode, "manual");
    }
}
