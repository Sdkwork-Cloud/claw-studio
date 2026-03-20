use crate::{
    framework::{kernel::DesktopKernelInfo, storage::StorageInfo, Result as FrameworkResult},
    state::AppState,
};

pub fn desktop_kernel_info_from_state(state: &AppState) -> FrameworkResult<DesktopKernelInfo> {
    let config = state.config_snapshot();

    state
        .context
        .services
        .desktop_kernel_info(&state.paths, &config)
}

pub fn desktop_storage_info_from_state(state: &AppState) -> StorageInfo {
    let config = state.config_snapshot();

    state
        .context
        .services
        .desktop_storage_info(&state.paths, &config)
}

#[tauri::command]
pub fn desktop_kernel_info(state: tauri::State<'_, AppState>) -> Result<DesktopKernelInfo, String> {
    desktop_kernel_info_from_state(&state).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_storage_info(state: tauri::State<'_, AppState>) -> StorageInfo {
    desktop_storage_info_from_state(&state)
}

#[cfg(test)]
mod tests {
    use super::{desktop_kernel_info_from_state, desktop_storage_info_from_state};
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
        state::AppState,
    };
    use std::sync::Arc;

    fn normalize_path_suffix(path: &str) -> String {
        path.replace('\\', "/")
    }

    #[test]
    fn desktop_kernel_info_exposes_extended_runtime_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let info = desktop_kernel_info_from_state(&state).expect("kernel info");

        assert!(normalize_path_suffix(&info.directories.install_root).ends_with("install"));
        assert!(normalize_path_suffix(&info.directories.modules_dir).ends_with("install/modules"));
        assert!(normalize_path_suffix(&info.directories.runtimes_dir).ends_with("install/runtimes"));
        assert!(normalize_path_suffix(&info.directories.machine_root).ends_with("machine"));
        assert!(
            normalize_path_suffix(&info.directories.machine_state_dir).ends_with("machine/state")
        );
        assert!(
            normalize_path_suffix(&info.directories.machine_store_dir).ends_with("machine/store")
        );
        assert!(normalize_path_suffix(&info.directories.machine_staging_dir)
            .ends_with("machine/staging"));
        assert!(normalize_path_suffix(&info.directories.user_root).ends_with("user-home"));
        assert!(normalize_path_suffix(&info.directories.studio_dir).ends_with("user-home/studio"));
        assert!(normalize_path_suffix(&info.directories.storage_dir)
            .ends_with("user-home/user/storage"));
        assert!(normalize_path_suffix(&info.directories.plugins_dir)
            .ends_with("install/extensions/plugins"));
        assert!(info
            .directories
            .integrations_dir
            .replace('\\', "/")
            .ends_with("user-home/user/integrations"));
        assert!(normalize_path_suffix(&info.directories.backups_dir)
            .ends_with("user-home/studio/backups"));
        assert!(info.filesystem.supports_binary_io);
        assert!(info
            .process
            .available_profiles
            .iter()
            .any(|profile| profile.id == "diagnostics.echo"));
        assert_eq!(info.process.active_job_count, 0);
        assert_eq!(info.process.active_process_job_count, 0);
        assert!(info
            .permissions
            .entries
            .iter()
            .any(|entry| entry.key == "filesystem.managedRoots"));
        assert!(info
            .permissions
            .entries
            .iter()
            .any(|entry| entry.key == "browser.externalHttp"));
        assert_eq!(info.notifications.provider, "native");
        assert!(info
            .notifications
            .available_providers
            .iter()
            .any(|provider| provider.id == "native"));
        assert_eq!(info.payments.provider, "none");
        assert!(info
            .payments
            .available_providers
            .iter()
            .any(|provider| provider.id == "stripe"));
        assert!(info
            .integrations
            .available_adapters
            .iter()
            .any(|adapter| adapter.id == "plugin-host"));
        assert_eq!(info.supervisor.service_count, 3);
        assert_eq!(
            info.supervisor.managed_service_ids,
            vec![
                "openclaw_gateway".to_string(),
                "web_server".to_string(),
                "api_router".to_string(),
            ]
        );
        assert_eq!(info.supervisor.lifecycle, "running");
    }

    #[test]
    fn desktop_storage_info_exposes_default_local_profile() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let info = desktop_storage_info_from_state(&state);

        assert_eq!(info.active_profile_id, "default-local");
        assert!(info.profiles.iter().any(|profile| profile.active));
    }
}
