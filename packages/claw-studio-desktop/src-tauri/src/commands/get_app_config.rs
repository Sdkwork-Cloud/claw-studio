use crate::{framework::config::AppConfig, state::AppState};

pub fn app_config_from_state(state: &AppState) -> AppConfig {
  state.config.clone()
}

#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, AppState>) -> AppConfig {
  app_config_from_state(&state)
}

#[cfg(test)]
mod tests {
  use super::app_config_from_state;
  use crate::{
    framework::{config::AppConfig, context::FrameworkContext, logging::init_logger, paths::resolve_paths_for_root},
    state::AppState,
  };
  use std::sync::Arc;

  #[test]
  fn app_config_reads_state_snapshot() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let logger = init_logger(&paths).expect("logger");
    let config = AppConfig {
      distribution: "cn".to_string(),
      theme: "dark".to_string(),
      telemetry_enabled: true,
      ..AppConfig::default()
    };
    let context = Arc::new(FrameworkContext::from_parts(paths, config.clone(), logger));
    let state = AppState::from_context(context);

    let snapshot = app_config_from_state(&state);

    assert_eq!(snapshot, config);
  }
}
