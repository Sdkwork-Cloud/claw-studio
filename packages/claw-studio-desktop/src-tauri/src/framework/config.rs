use crate::framework::{paths::AppPaths, Result};
use std::fs;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
  pub distribution: String,
  pub log_level: String,
  pub theme: String,
  pub telemetry_enabled: bool,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      distribution: "global".to_string(),
      log_level: "info".to_string(),
      theme: "system".to_string(),
      telemetry_enabled: false,
    }
  }
}

pub fn load_or_create_config(paths: &AppPaths) -> Result<AppConfig> {
  if paths.config_file.exists() {
    let content = fs::read_to_string(&paths.config_file)?;
    let config = serde_json::from_str::<AppConfig>(&content)?;
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

#[cfg(test)]
mod tests {
  use super::load_or_create_config;
  use crate::framework::paths::resolve_paths_for_root;

  #[test]
  fn writes_default_config_when_missing() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");

    let config = load_or_create_config(&paths).expect("config");
    let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");

    assert_eq!(config.theme, "system");
    assert!(saved.contains("telemetryEnabled"));
  }
}