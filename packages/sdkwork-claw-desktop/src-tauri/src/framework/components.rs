use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PackagedComponentKind {
    Binary,
    NodeApp,
    ServiceGroup,
    EmbeddedLibrary,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PackagedComponentStartupMode {
    AutoStart,
    Manual,
    Embedded,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackagedComponentDefinition {
    pub id: String,
    pub display_name: String,
    pub kind: PackagedComponentKind,
    pub bundled_version: String,
    pub startup_mode: PackagedComponentStartupMode,
    pub install_subdir: String,
    pub upgrade_channel: String,
    pub service_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit: Option<String>,
}

pub fn bundled_component_defaults() -> Vec<PackagedComponentDefinition> {
    vec![
        PackagedComponentDefinition {
            id: "openclaw".to_string(),
            display_name: "OpenClaw".to_string(),
            kind: PackagedComponentKind::NodeApp,
            bundled_version: "bundled".to_string(),
            startup_mode: PackagedComponentStartupMode::AutoStart,
            install_subdir: "modules/openclaw/current".to_string(),
            upgrade_channel: "stable".to_string(),
            service_ids: vec!["openclaw".to_string()],
            source_url: None,
            commit: None,
        },
        PackagedComponentDefinition {
            id: "zeroclaw".to_string(),
            display_name: "ZeroClaw".to_string(),
            kind: PackagedComponentKind::Binary,
            bundled_version: "bundled".to_string(),
            startup_mode: PackagedComponentStartupMode::Manual,
            install_subdir: "modules/zeroclaw/current".to_string(),
            upgrade_channel: "stable".to_string(),
            service_ids: vec!["zeroclaw".to_string()],
            source_url: None,
            commit: None,
        },
        PackagedComponentDefinition {
            id: "ironclaw".to_string(),
            display_name: "IronClaw".to_string(),
            kind: PackagedComponentKind::Binary,
            bundled_version: "bundled".to_string(),
            startup_mode: PackagedComponentStartupMode::Manual,
            install_subdir: "modules/ironclaw/current".to_string(),
            upgrade_channel: "stable".to_string(),
            service_ids: vec!["ironclaw".to_string()],
            source_url: None,
            commit: None,
        },
        PackagedComponentDefinition {
            id: "sdkwork-api-router".to_string(),
            display_name: "SdkWork API Router".to_string(),
            kind: PackagedComponentKind::ServiceGroup,
            bundled_version: "bundled".to_string(),
            startup_mode: PackagedComponentStartupMode::AutoStart,
            install_subdir: "modules/sdkwork-api-router/current".to_string(),
            upgrade_channel: "stable".to_string(),
            service_ids: vec![
                "sdkwork_api_router_gateway".to_string(),
                "sdkwork_api_router_admin_api".to_string(),
                "sdkwork_api_router_portal_api".to_string(),
                "sdkwork_api_router_web_server".to_string(),
            ],
            source_url: None,
            commit: None,
        },
        PackagedComponentDefinition {
            id: "hub-installer".to_string(),
            display_name: "Hub Installer".to_string(),
            kind: PackagedComponentKind::EmbeddedLibrary,
            bundled_version: "bundled".to_string(),
            startup_mode: PackagedComponentStartupMode::Embedded,
            install_subdir: "modules/hub-installer/current".to_string(),
            upgrade_channel: "stable".to_string(),
            service_ids: Vec::new(),
            source_url: None,
            commit: None,
        },
    ]
}

pub fn default_startup_component_ids(definitions: &[PackagedComponentDefinition]) -> Vec<String> {
    definitions
        .iter()
        .filter(|definition| definition.startup_mode == PackagedComponentStartupMode::AutoStart)
        .map(|definition| definition.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        bundled_component_defaults, default_startup_component_ids, PackagedComponentKind,
        PackagedComponentStartupMode,
    };

    #[test]
    fn bundled_component_defaults_cover_packaged_platform_contract() {
        let definitions = bundled_component_defaults();
        let ids = definitions
            .iter()
            .map(|definition| definition.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            ids,
            vec![
                "openclaw",
                "zeroclaw",
                "ironclaw",
                "sdkwork-api-router",
                "hub-installer",
            ]
        );
        assert_eq!(
            default_startup_component_ids(&definitions),
            vec!["openclaw".to_string(), "sdkwork-api-router".to_string()]
        );

        let router = definitions
            .iter()
            .find(|definition| definition.id == "sdkwork-api-router")
            .expect("router definition");
        assert_eq!(router.kind, PackagedComponentKind::ServiceGroup);

        let hub_installer = definitions
            .iter()
            .find(|definition| definition.id == "hub-installer")
            .expect("hub installer definition");
        assert_eq!(hub_installer.kind, PackagedComponentKind::EmbeddedLibrary);
        assert_eq!(
            hub_installer.startup_mode,
            PackagedComponentStartupMode::Embedded
        );
    }
}
