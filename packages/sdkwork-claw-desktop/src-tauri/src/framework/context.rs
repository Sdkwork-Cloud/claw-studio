use crate::framework::{
    bundled::sync_bundled_installation,
    config::{load_or_create_config, AppConfig},
    desktop_host_bootstrap::{bootstrap_desktop_host_runtime, DesktopHostRuntime},
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
    desktop_host: Option<DesktopHostRuntime>,
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
            desktop_host: None,
        })
    }

    pub fn bootstrap_desktop_host(&mut self) -> Result<()> {
        if self.desktop_host.is_some() {
            return Ok(());
        }

        self.desktop_host = bootstrap_desktop_host_runtime(
            &self.paths,
            &self.config,
            &self.services.supervisor,
            &self.logger,
        )?;
        Ok(())
    }

    pub fn desktop_host_snapshot(
        &self,
    ) -> Option<crate::framework::embedded_host_server::EmbeddedHostRuntimeSnapshot> {
        self.desktop_host
            .as_ref()
            .map(|runtime| runtime.snapshot().clone())
    }

    pub fn desktop_host_status(
        &self,
    ) -> Option<crate::framework::embedded_host_server::EmbeddedHostRuntimeStatus> {
        self.desktop_host.as_ref().map(|runtime| runtime.status())
    }

    #[cfg(test)]
    pub fn from_parts(paths: AppPaths, config: AppConfig, logger: AppLogger) -> Self {
        let services = FrameworkServices::new(&paths, &config).expect("framework services");

        Self {
            paths,
            config,
            logger,
            services,
            desktop_host: None,
        }
    }

    #[cfg(test)]
    pub fn set_desktop_host_for_test(&mut self, runtime: DesktopHostRuntime) {
        self.desktop_host = Some(runtime);
    }
}

#[cfg(test)]
mod tests {
    use super::FrameworkContext;
    use crate::framework::{
        config::AppConfig, desktop_host_bootstrap::bootstrap_desktop_host_runtime,
        logging::init_logger, paths::resolve_paths_for_root,
    };

    #[test]
    fn framework_context_exposes_live_desktop_host_status() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let mut context = FrameworkContext::from_parts(paths, AppConfig::default(), logger);
        let runtime = bootstrap_desktop_host_runtime(
            &context.paths,
            &context.config,
            &context.services.supervisor,
            &context.logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");

        context.set_desktop_host_for_test(runtime);

        let status = context
            .desktop_host_status()
            .expect("desktop host runtime status");

        assert_eq!(status.lifecycle, "ready");
        assert_eq!(status.last_error, None);
    }
}
