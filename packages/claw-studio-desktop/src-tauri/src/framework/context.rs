use crate::framework::{
  config::{load_or_create_config, AppConfig},
  logging::{init_logger, AppLogger},
  paths::AppPaths,
  services::FrameworkServices,
  Result,
};
use tauri::{AppHandle, Runtime};

#[derive(Debug)]
pub struct FrameworkContext {
  pub paths: AppPaths,
  pub config: AppConfig,
  pub logger: AppLogger,
  pub services: FrameworkServices,
}

impl FrameworkContext {
  pub fn bootstrap<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
    let paths = crate::framework::paths::resolve_paths(app)?;
    let config = load_or_create_config(&paths)?;
    let logger = init_logger(&paths)?;
    logger.info("framework context bootstrapped")?;
    let services = FrameworkServices::new();

    Ok(Self {
      paths,
      config,
      logger,
      services,
    })
  }

  #[cfg(test)]
  pub fn from_parts(paths: AppPaths, config: AppConfig, logger: AppLogger) -> Self {
    Self {
      paths,
      config,
      logger,
      services: FrameworkServices::new(),
    }
  }
}
