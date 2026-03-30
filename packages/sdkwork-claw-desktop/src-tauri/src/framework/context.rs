use crate::framework::{
    bundled::sync_bundled_installation,
    config::{load_or_create_config, AppConfig},
    logging::{init_logger, AppLogger},
    paths::AppPaths,
    services::FrameworkServices,
    Result,
};
use tauri::{AppHandle, Runtime};
use std::time::Instant;

#[derive(Debug)]
pub struct FrameworkContext {
    pub paths: AppPaths,
    pub config: AppConfig,
    pub logger: AppLogger,
    pub services: FrameworkServices,
}

fn trace_context(message: &str) {
    eprintln!("[desktop-tauri][context] {message}");
}

impl FrameworkContext {
    pub fn bootstrap<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
        trace_context("resolving application paths");
        let paths = crate::framework::paths::resolve_paths(app)?;
        trace_context(&format!(
            "resolved paths install_root={} main_log_file={}",
            paths.install_root.display(),
            paths.main_log_file.display()
        ));
        let logger = init_logger(&paths)?;
        logger.info("framework context bootstrapped")?;
        trace_context("logger initialized");
        let sync_started_at = Instant::now();
        match sync_bundled_installation(app, &paths) {
            Ok(report) => {
                trace_context("bundled installation sync completed");
                logger.info(&format!(
                    "bundled installation sync completed in {}ms (components={}, runtimes={})",
                    sync_started_at.elapsed().as_millis(),
                    report.seeded_component_ids.len(),
                    report.seeded_runtime_ids.len(),
                ))?;
            }
            Err(error) => {
                trace_context("bundled installation sync failed");
                logger.warn(&format!("failed to sync bundled installation: {error}"))?;
            }
        }
        trace_context("loading application config");
        let config = load_or_create_config(&paths)?;
        trace_context("creating framework services");
        let services = FrameworkServices::new(&paths, &config)?;
        trace_context("starting default background services");
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

        trace_context("framework context bootstrap completed");
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
