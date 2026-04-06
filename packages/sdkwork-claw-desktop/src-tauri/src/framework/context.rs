use crate::framework::{
    bundled::{sync_bundled_installation, BundledInstallSyncReport},
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
        bootstrap_context_for_paths(paths, |paths| sync_bundled_installation(app, paths))
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

fn bootstrap_context_for_paths<F>(
    paths: AppPaths,
    sync_bundled_installation: F,
) -> Result<FrameworkContext>
where
    F: FnOnce(&AppPaths) -> Result<BundledInstallSyncReport>,
{
    let logger = init_logger(&paths)?;
    let report = sync_bundled_installation(&paths).map_err(|error| {
        let _ = log_bundled_install_sync_failure(&logger, &error.to_string());
        error
    })?;
    log_bundled_install_sync_report(&logger, &report)?;
    let config = load_or_create_config(&paths)?;
    logger.info("framework context bootstrapped")?;
    let services = FrameworkServices::new(&paths, &config)?;

    Ok(FrameworkContext {
        paths,
        config,
        logger,
        services,
        desktop_host: None,
    })
}

fn log_bundled_install_sync_report(
    logger: &AppLogger,
    report: &BundledInstallSyncReport,
) -> Result<()> {
    if report.seeded_component_ids.is_empty() && report.seeded_runtime_ids.is_empty() {
        return Ok(());
    }

    let components = if report.seeded_component_ids.is_empty() {
        "none".to_string()
    } else {
        report.seeded_component_ids.join(", ")
    };
    let runtimes = if report.seeded_runtime_ids.is_empty() {
        "none".to_string()
    } else {
        report.seeded_runtime_ids.join(", ")
    };

    logger.info(&format!(
        "synced bundled installation: components=[{components}], runtimes=[{runtimes}]"
    ))
}

fn log_bundled_install_sync_failure(logger: &AppLogger, error: &str) -> Result<()> {
    logger.error(&format!("failed to sync bundled installation: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        bootstrap_context_for_paths, log_bundled_install_sync_failure,
        log_bundled_install_sync_report, FrameworkContext,
    };
    use crate::framework::{
        bundled::BundledInstallSyncReport, config::AppConfig,
        desktop_host_bootstrap::bootstrap_desktop_host_runtime, logging::init_logger,
        paths::resolve_paths_for_root,
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

    #[test]
    fn bundled_install_sync_report_logs_seeded_components_and_runtimes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");

        log_bundled_install_sync_report(
            &logger,
            &BundledInstallSyncReport {
                seeded_component_ids: vec!["codex".to_string()],
                seeded_runtime_ids: vec!["node".to_string()],
            },
        )
        .expect("log bundled install sync report");

        let content = std::fs::read_to_string(&paths.main_log_file).expect("log content");
        assert!(content.contains("synced bundled installation:"));
        assert!(content.contains("components=[codex]"));
        assert!(content.contains("runtimes=[node]"));
    }

    #[test]
    fn bundled_install_sync_failure_logs_error() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");

        log_bundled_install_sync_failure(&logger, "bundled sync exploded")
            .expect("log bundled install sync failure");

        let content = std::fs::read_to_string(&paths.main_log_file).expect("log content");
        assert!(
            content.contains("ERROR failed to sync bundled installation: bundled sync exploded")
        );
    }

    #[test]
    fn bootstrap_fail_fast_does_not_swallow_bundled_install_sync_or_default_service_failures() {
        let source = include_str!("context.rs");
        let production_source = source
            .split("#[cfg(test)]")
            .next()
            .expect("production context source");

        assert!(
            !production_source.contains(
                "Err(error) => log_bundled_install_sync_failure(&logger, &error.to_string())?"
            ),
            "framework bootstrap must fail fast when bundled install synchronization fails"
        );
        assert!(
            !production_source.contains("match services.supervisor.start_default_services()"),
            "framework bootstrap must not swallow default-service startup failures in a warning-only branch"
        );
    }

    #[test]
    fn bootstrap_context_for_paths_aborts_when_bundled_install_sync_fails() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let error = bootstrap_context_for_paths(paths.clone(), |_| {
            Err(crate::framework::FrameworkError::Internal(
                "bundled sync exploded".to_string(),
            ))
        })
        .expect_err("bootstrap should abort when bundled install sync fails");

        assert!(error.to_string().contains("bundled sync exploded"));
    }
}
