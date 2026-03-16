use crate::framework::{FrameworkError, Result};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub state_dir: PathBuf,
    pub storage_dir: PathBuf,
    pub plugins_dir: PathBuf,
    pub integrations_dir: PathBuf,
    pub backups_dir: PathBuf,
    pub config_file: PathBuf,
    pub device_id_file: PathBuf,
    pub main_log_file: PathBuf,
}

impl AppPaths {
    pub fn managed_roots(&self) -> Vec<PathBuf> {
        vec![
            self.config_dir.clone(),
            self.data_dir.clone(),
            self.cache_dir.clone(),
            self.logs_dir.clone(),
            self.state_dir.clone(),
            self.storage_dir.clone(),
            self.plugins_dir.clone(),
            self.integrations_dir.clone(),
            self.backups_dir.clone(),
        ]
    }
}

pub fn resolve_paths<R: Runtime>(app: &AppHandle<R>) -> Result<AppPaths> {
    let resolver = app.path();

    let config_dir = resolver.app_config_dir().map_err(FrameworkError::from)?;
    let data_dir = resolver.app_data_dir().map_err(FrameworkError::from)?;
    let cache_dir = resolver.app_cache_dir().map_err(FrameworkError::from)?;
    let logs_dir = resolver.app_log_dir().map_err(FrameworkError::from)?;
    let state_dir = data_dir.join("state");
    let storage_dir = data_dir.join("storage");
    let plugins_dir = data_dir.join("plugins");
    let integrations_dir = data_dir.join("integrations");
    let backups_dir = data_dir.join("backups");

    let paths = AppPaths {
        config_file: config_dir.join("app.json"),
        device_id_file: state_dir.join("device-id"),
        main_log_file: logs_dir.join("app.log"),
        config_dir,
        data_dir,
        cache_dir,
        logs_dir,
        state_dir,
        storage_dir,
        plugins_dir,
        integrations_dir,
        backups_dir,
    };

    ensure_runtime_directories(&paths)?;
    Ok(paths)
}

#[cfg(test)]
pub fn resolve_paths_for_root(root: &std::path::Path) -> Result<AppPaths> {
    let config_dir = root.join("config");
    let data_dir = root.join("data");
    let cache_dir = root.join("cache");
    let logs_dir = root.join("logs");
    let state_dir = root.join("state");
    let storage_dir = data_dir.join("storage");
    let plugins_dir = data_dir.join("plugins");
    let integrations_dir = data_dir.join("integrations");
    let backups_dir = data_dir.join("backups");

    let paths = AppPaths {
        config_file: config_dir.join("app.json"),
        device_id_file: state_dir.join("device-id"),
        main_log_file: logs_dir.join("app.log"),
        config_dir,
        data_dir,
        cache_dir,
        logs_dir,
        state_dir,
        storage_dir,
        plugins_dir,
        integrations_dir,
        backups_dir,
    };

    ensure_runtime_directories(&paths)?;
    Ok(paths)
}

pub fn ensure_runtime_directories(paths: &AppPaths) -> Result<()> {
    for directory in paths.managed_roots() {
        fs::create_dir_all(directory)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::resolve_paths_for_root;

    #[test]
    fn creates_runtime_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        assert!(paths.config_dir.exists());
        assert!(paths.data_dir.exists());
        assert!(paths.cache_dir.exists());
        assert!(paths.logs_dir.exists());
        assert!(paths.state_dir.exists());
    }

    #[test]
    fn creates_extended_kernel_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let _paths = resolve_paths_for_root(root.path()).expect("paths");

        assert!(root.path().join("data").join("storage").exists());
        assert!(root.path().join("data").join("plugins").exists());
        assert!(root.path().join("data").join("integrations").exists());
        assert!(root.path().join("data").join("backups").exists());
    }
}
