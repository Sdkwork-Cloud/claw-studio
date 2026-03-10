use crate::{
  framework::{config::AppConfig, context::FrameworkContext, paths::AppPaths},
  platform,
};
use std::sync::Arc;

#[derive(Clone, Debug)]
pub struct AppState {
  pub app_name: String,
  pub app_version: String,
  pub target: String,
  pub context: Arc<FrameworkContext>,
  pub paths: AppPaths,
  pub config: AppConfig,
}

impl AppState {
  pub fn from_context(context: Arc<FrameworkContext>) -> Self {
    Self {
      app_name: "Claw Studio".to_string(),
      app_version: env!("CARGO_PKG_VERSION").to_string(),
      target: platform::current_target().to_string(),
      context: context.clone(),
      paths: context.paths.clone(),
      config: context.config.clone(),
    }
  }
}

#[cfg(test)]
mod tests {
  use super::AppState;
  use crate::framework::{
    config::AppConfig,
    context::FrameworkContext,
    logging::init_logger,
    paths::resolve_paths_for_root,
  };
  use std::sync::Arc;

  #[test]
  fn state_captures_framework_context() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let logger = init_logger(&paths).expect("logger");
    let config = AppConfig {
      theme: "dark".to_string(),
      ..AppConfig::default()
    };
    let context = Arc::new(FrameworkContext::from_parts(paths.clone(), config.clone(), logger));

    let state = AppState::from_context(context.clone());

    assert!(Arc::ptr_eq(&state.context, &context));
    assert_eq!(state.context.paths, paths);
    assert_eq!(state.context.config, config);
    assert_eq!(state.target, crate::platform::current_target());
  }
}
