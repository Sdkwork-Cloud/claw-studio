use crate::framework::{
    bundled::sync_bundled_installation,
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
        let _ = sync_bundled_installation(app, &paths);
        let config = load_or_create_config(&paths)?;
        let logger = init_logger(&paths)?;
        logger.info("framework context bootstrapped")?;
        let services = FrameworkServices::new(&paths, &config)?;
        match services.supervisor.start_default_services() {
            Ok(started_services) if !started_services.is_empty() => {
                logger.info(&format!(
                    "started bundled background services: {}",
                    started_services.join(", ")
                ))?;
            }
            Ok(_) => {}
            Err(error) => {
                logger.warn(&format!(
                    "failed to start bundled background services: {error}"
                ))?;
            }
        }

        Ok(Self {
            paths,
            config,
            logger,
            services,
        })
    }

    #[cfg(test)]
    pub fn from_parts(paths: AppPaths, config: AppConfig, logger: AppLogger) -> Self {
        let services = FrameworkServices::new(&paths, &config).expect("framework services");

        Self {
            paths,
            config,
            logger,
            services,
        }
    }
}
