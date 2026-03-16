use crate::framework::{
    paths::AppPaths,
    storage::{StorageConfig, StorageProfileConfiguredFlags, StorageProviderKind},
    Result,
};
use std::fs;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SecurityConfig {
    pub strict_path_policy: bool,
    pub allow_external_http: bool,
    pub allow_custom_process_cwd: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            strict_path_policy: true,
            allow_external_http: true,
            allow_custom_process_cwd: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NotificationConfig {
    pub enabled: bool,
    pub provider: String,
    pub require_user_consent: bool,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            provider: "native".to_string(),
            require_user_consent: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PaymentConfig {
    pub provider: String,
    pub sandbox: bool,
}

impl Default for PaymentConfig {
    fn default() -> Self {
        Self {
            provider: "none".to_string(),
            sandbox: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct IntegrationConfig {
    pub plugins_enabled: bool,
    pub remote_api_enabled: bool,
    pub allow_unsigned_plugins: bool,
}

impl Default for IntegrationConfig {
    fn default() -> Self {
        Self {
            plugins_enabled: true,
            remote_api_enabled: false,
            allow_unsigned_plugins: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProcessConfig {
    pub default_timeout_ms: u64,
    pub max_concurrent_jobs: u32,
}

impl Default for ProcessConfig {
    fn default() -> Self {
        Self {
            default_timeout_ms: 120_000,
            max_concurrent_jobs: 4,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub distribution: String,
    pub log_level: String,
    pub theme: String,
    pub telemetry_enabled: bool,
    pub security: SecurityConfig,
    pub storage: StorageConfig,
    pub notifications: NotificationConfig,
    pub payments: PaymentConfig,
    pub integrations: IntegrationConfig,
    pub process: ProcessConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: 1,
            distribution: "global".to_string(),
            log_level: "info".to_string(),
            theme: "system".to_string(),
            telemetry_enabled: false,
            security: SecurityConfig::default(),
            storage: StorageConfig::default(),
            notifications: NotificationConfig::default(),
            payments: PaymentConfig::default(),
            integrations: IntegrationConfig::default(),
            process: ProcessConfig::default(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicStorageProfileConfig {
    pub id: String,
    pub label: String,
    pub provider: StorageProviderKind,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub connection_configured: bool,
    pub database_configured: bool,
    pub endpoint_configured: bool,
    pub read_only: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicStorageConfig {
    pub active_profile_id: String,
    pub profiles: Vec<PublicStorageProfileConfig>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicAppConfig {
    pub version: u32,
    pub distribution: String,
    pub log_level: String,
    pub theme: String,
    pub telemetry_enabled: bool,
    pub security: SecurityConfig,
    pub storage: PublicStorageConfig,
    pub notifications: NotificationConfig,
    pub payments: PaymentConfig,
    pub integrations: IntegrationConfig,
    pub process: ProcessConfig,
}

pub fn load_or_create_config(paths: &AppPaths) -> Result<AppConfig> {
    if paths.config_file.exists() {
        let content = fs::read_to_string(&paths.config_file)?;
        let config = serde_json::from_str::<AppConfig>(&content)?.normalized();
        write_config(paths, &config)?;
        return Ok(config);
    }

    let config = AppConfig::default();
    write_config(paths, &config)?;
    Ok(config)
}

pub fn write_config(paths: &AppPaths, config: &AppConfig) -> Result<()> {
    let content = serde_json::to_string_pretty(config)?;
    fs::write(&paths.config_file, content)?;
    Ok(())
}

impl AppConfig {
    pub fn normalized(&self) -> Self {
        let mut next = self.clone();
        if next.version == 0 {
            next.version = 1;
        }
        next.storage = next.storage.normalized();
        next
    }

    pub fn public_projection(&self) -> PublicAppConfig {
        let normalized = self.normalized();

        PublicAppConfig {
            version: normalized.version,
            distribution: normalized.distribution,
            log_level: normalized.log_level,
            theme: normalized.theme,
            telemetry_enabled: normalized.telemetry_enabled,
            security: normalized.security,
            storage: project_storage_config(&normalized.storage),
            notifications: normalized.notifications,
            payments: normalized.payments,
            integrations: normalized.integrations,
            process: normalized.process,
        }
    }
}

fn project_storage_config(config: &StorageConfig) -> PublicStorageConfig {
    let normalized = config.normalized();

    PublicStorageConfig {
        active_profile_id: normalized.active_profile_id,
        profiles: normalized
            .profiles
            .iter()
            .map(project_storage_profile)
            .collect(),
    }
}

fn project_storage_profile(
    profile: &crate::framework::storage::StorageProfileConfig,
) -> PublicStorageProfileConfig {
    let flags = StorageProfileConfiguredFlags::from_options(
        profile.connection.as_deref(),
        profile.database.as_deref(),
        profile.endpoint.as_deref(),
    );

    PublicStorageProfileConfig {
        id: profile.id.clone(),
        label: profile.label.clone(),
        provider: profile.provider.clone(),
        namespace: profile.namespace.clone(),
        path: profile.path.clone(),
        connection_configured: flags.connection_configured,
        database_configured: flags.database_configured,
        endpoint_configured: flags.endpoint_configured,
        read_only: profile.read_only,
    }
}

#[cfg(test)]
mod tests {
    use super::{load_or_create_config, write_config, AppConfig};
    use crate::framework::paths::resolve_paths_for_root;
    use serde_json::Value;

    #[test]
    fn writes_default_config_when_missing() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let config = load_or_create_config(&paths).expect("config");
        let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");

        assert_eq!(config.theme, "system");
        assert!(saved.contains("telemetryEnabled"));
    }

    #[test]
    fn default_config_serializes_kernel_sections() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        write_config(&paths, &AppConfig::default()).expect("write config");
        let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");
        let value = serde_json::from_str::<Value>(&saved).expect("json value");

        assert!(value.get("version").is_some(), "missing version");
        assert!(value.get("storage").is_some(), "missing storage");
        assert!(
            value.get("notifications").is_some(),
            "missing notifications"
        );
        assert!(value.get("payments").is_some(), "missing payments");
        assert!(value.get("integrations").is_some(), "missing integrations");
        assert!(value.get("process").is_some(), "missing process");
    }

    #[test]
    fn loads_legacy_config_without_kernel_sections() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        std::fs::write(
            &paths.config_file,
            r#"{
        "distribution": "cn",
        "theme": "dark"
      }"#,
        )
        .expect("legacy config");

        let config = load_or_create_config(&paths).expect("legacy config should load");

        assert_eq!(config.distribution, "cn");
        assert_eq!(config.theme, "dark");
    }

    #[test]
    fn public_projection_redacts_storage_connection_values() {
        let config = AppConfig {
            storage: crate::framework::storage::StorageConfig {
                active_profile_id: "team-postgres".to_string(),
                profiles: vec![crate::framework::storage::StorageProfileConfig {
                    id: "team-postgres".to_string(),
                    label: "Team DB".to_string(),
                    provider: crate::framework::storage::StorageProviderKind::Postgres,
                    namespace: "team".to_string(),
                    path: None,
                    connection: Some("postgres://user:secret@db.internal/claw".to_string()),
                    database: Some("claw".to_string()),
                    endpoint: Some("https://api.sdk.work/storage".to_string()),
                    read_only: true,
                }],
            },
            ..AppConfig::default()
        };

        let projection = config.public_projection();
        let profile = projection
            .storage
            .profiles
            .first()
            .expect("storage profile");
        let value = serde_json::to_value(&projection).expect("public config json");

        assert!(profile.connection_configured);
        assert!(profile.database_configured);
        assert!(profile.endpoint_configured);
        assert_eq!(
            value.pointer("/storage/profiles/0/connection"),
            None,
            "public config must not expose raw storage connection values"
        );
        assert_eq!(
            value.pointer("/storage/profiles/0/endpoint"),
            None,
            "public config must not expose raw storage endpoint values"
        );
    }
}
