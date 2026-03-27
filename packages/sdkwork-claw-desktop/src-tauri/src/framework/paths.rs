use crate::framework::{FrameworkError, Result};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Runtime};
#[cfg(not(windows))]
use tauri::Manager;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub install_root: PathBuf,
    pub foundation_dir: PathBuf,
    pub foundation_components_dir: PathBuf,
    pub modules_dir: PathBuf,
    pub runtimes_dir: PathBuf,
    pub tools_dir: PathBuf,
    pub trust_dir: PathBuf,
    pub packs_dir: PathBuf,
    pub extensions_dir: PathBuf,
    pub machine_root: PathBuf,
    pub machine_state_dir: PathBuf,
    pub machine_store_dir: PathBuf,
    pub machine_staging_dir: PathBuf,
    pub machine_receipts_dir: PathBuf,
    pub machine_runtime_dir: PathBuf,
    pub managed_runtimes_dir: PathBuf,
    pub openclaw_runtime_dir: PathBuf,
    pub machine_recovery_dir: PathBuf,
    pub machine_logs_dir: PathBuf,
    pub user_root: PathBuf,
    pub user_bin_dir: PathBuf,
    pub openclaw_home_dir: PathBuf,
    pub openclaw_state_dir: PathBuf,
    pub openclaw_workspace_dir: PathBuf,
    pub openclaw_config_file: PathBuf,
    pub user_dir: PathBuf,
    pub user_auth_dir: PathBuf,
    pub user_storage_dir: PathBuf,
    pub user_integrations_dir: PathBuf,
    pub studio_dir: PathBuf,
    pub workspaces_dir: PathBuf,
    pub studio_backups_dir: PathBuf,
    pub user_logs_dir: PathBuf,
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
    pub layout_file: PathBuf,
    pub active_file: PathBuf,
    pub inventory_file: PathBuf,
    pub retention_file: PathBuf,
    pub pinned_file: PathBuf,
    pub channels_file: PathBuf,
    pub policies_file: PathBuf,
    pub sources_file: PathBuf,
    pub service_file: PathBuf,
    pub components_file: PathBuf,
    pub upgrades_file: PathBuf,
    pub component_registry_file: PathBuf,
    pub service_defaults_file: PathBuf,
    pub upgrade_policy_file: PathBuf,
    pub device_id_file: PathBuf,
    pub main_log_file: PathBuf,
}

impl AppPaths {
    pub fn managed_roots(&self) -> Vec<PathBuf> {
        let mut roots = vec![
            self.install_root.clone(),
            self.foundation_dir.clone(),
            self.foundation_components_dir.clone(),
            self.modules_dir.clone(),
            self.runtimes_dir.clone(),
            self.tools_dir.clone(),
            self.trust_dir.clone(),
            self.packs_dir.clone(),
            self.extensions_dir.clone(),
            self.machine_root.clone(),
            self.machine_state_dir.clone(),
            self.machine_store_dir.clone(),
            self.machine_staging_dir.clone(),
            self.machine_receipts_dir.clone(),
            self.machine_runtime_dir.clone(),
            self.managed_runtimes_dir.clone(),
            self.openclaw_runtime_dir.clone(),
            self.machine_recovery_dir.clone(),
            self.machine_logs_dir.clone(),
            self.user_root.clone(),
            self.user_bin_dir.clone(),
            self.openclaw_home_dir.clone(),
            self.openclaw_state_dir.clone(),
            self.openclaw_workspace_dir.clone(),
            self.user_dir.clone(),
            self.user_auth_dir.clone(),
            self.user_storage_dir.clone(),
            self.user_integrations_dir.clone(),
            self.studio_dir.clone(),
            self.workspaces_dir.clone(),
            self.studio_backups_dir.clone(),
            self.user_logs_dir.clone(),
            self.config_dir.clone(),
            self.data_dir.clone(),
            self.cache_dir.clone(),
            self.logs_dir.clone(),
            self.state_dir.clone(),
            self.storage_dir.clone(),
            self.plugins_dir.clone(),
            self.integrations_dir.clone(),
            self.backups_dir.clone(),
        ];
        roots.sort();
        roots.dedup();
        roots
    }
}

pub fn resolve_paths<R: Runtime>(app: &AppHandle<R>) -> Result<AppPaths> {
    let install_root = resolve_install_root()?;
    let machine_root = resolve_machine_root(app)?;
    let user_root = resolve_user_root(app)?;

    let paths = build_paths(install_root, machine_root, user_root);
    ensure_runtime_directories(&paths)?;
    Ok(paths)
}

pub(crate) fn resolve_paths_from_current_process() -> Result<AppPaths> {
    resolve_paths_from_current_process_with_overrides(None, None)
}

pub(crate) fn resolve_paths_from_current_process_with_overrides(
    machine_root: Option<PathBuf>,
    user_root: Option<PathBuf>,
) -> Result<AppPaths> {
    let paths = build_paths(
        resolve_install_root()?,
        machine_root.unwrap_or(resolve_machine_root_from_current_process()?),
        user_root.unwrap_or(resolve_user_root_from_current_process()?),
    );
    ensure_runtime_directories(&paths)?;
    Ok(paths)
}

#[cfg(test)]
pub fn resolve_paths_for_root(root: &std::path::Path) -> Result<AppPaths> {
    let paths = build_paths(
        root.join("install"),
        root.join("machine"),
        root.join("user-home"),
    );
    ensure_runtime_directories(&paths)?;
    Ok(paths)
}

fn build_paths(install_root: PathBuf, machine_root: PathBuf, user_root: PathBuf) -> AppPaths {
    let foundation_dir = install_root.join("foundation");
    let foundation_components_dir = foundation_dir.join("components");
    let modules_dir = install_root.join("modules");
    let runtimes_dir = install_root.join("runtimes");
    let tools_dir = install_root.join("tools");
    let trust_dir = install_root.join("trust");
    let packs_dir = install_root.join("packs");
    let extensions_dir = install_root.join("extensions");
    let plugins_dir = extensions_dir.join("plugins");

    let machine_state_dir = machine_root.join("state");
    let machine_store_dir = machine_root.join("store");
    let machine_staging_dir = machine_root.join("staging");
    let machine_receipts_dir = machine_root.join("receipts");
    let machine_runtime_dir = machine_root.join("runtime");
    let managed_runtimes_dir = machine_runtime_dir.join("runtimes");
    let openclaw_runtime_dir = managed_runtimes_dir.join("openclaw");
    let machine_recovery_dir = machine_root.join("recovery");
    let machine_logs_dir = machine_root.join("logs");

    let user_bin_dir = user_root.join("bin");
    let openclaw_home_dir = user_root.join("openclaw-home");
    let openclaw_state_dir = openclaw_home_dir.join(".openclaw");
    let openclaw_workspace_dir = openclaw_state_dir.join("workspace");
    let openclaw_config_file = openclaw_state_dir.join("openclaw.json");
    let user_dir = user_root.join("user");
    let user_auth_dir = user_dir.join("auth");
    let user_storage_dir = user_dir.join("storage");
    let user_integrations_dir = user_dir.join("integrations");
    let studio_dir = user_root.join("studio");
    let workspaces_dir = studio_dir.join("workspaces");
    let studio_backups_dir = studio_dir.join("backups");
    let user_logs_dir = user_root.join("logs");

    let config_dir = machine_state_dir.clone();
    let data_dir = studio_dir.clone();
    let cache_dir = machine_staging_dir.clone();
    let logs_dir = machine_logs_dir.join("app");
    let state_dir = machine_runtime_dir.join("state");
    let storage_dir = user_storage_dir.clone();
    let integrations_dir = user_integrations_dir.clone();
    let backups_dir = studio_backups_dir.clone();
    let config_file = config_dir.join("app.json");
    let layout_file = config_dir.join("layout.json");
    let active_file = config_dir.join("active.json");
    let inventory_file = config_dir.join("inventory.json");
    let retention_file = config_dir.join("retention.json");
    let pinned_file = config_dir.join("pinned.json");
    let channels_file = config_dir.join("channels.json");
    let policies_file = config_dir.join("policies.json");
    let sources_file = config_dir.join("sources.json");
    let service_file = config_dir.join("service.json");
    let components_file = config_dir.join("components.json");
    let upgrades_file = config_dir.join("upgrades.json");
    let component_registry_file = foundation_components_dir.join("component-registry.json");
    let service_defaults_file = foundation_components_dir.join("service-defaults.json");
    let upgrade_policy_file = foundation_components_dir.join("upgrade-policy.json");
    let device_id_file = state_dir.join("device-id");
    let main_log_file = logs_dir.join("app.log");

    AppPaths {
        install_root,
        foundation_dir,
        foundation_components_dir,
        modules_dir,
        runtimes_dir,
        tools_dir,
        trust_dir,
        packs_dir,
        extensions_dir,
        machine_root,
        machine_state_dir,
        machine_store_dir,
        machine_staging_dir,
        machine_receipts_dir,
        machine_runtime_dir,
        managed_runtimes_dir,
        openclaw_runtime_dir,
        machine_recovery_dir,
        machine_logs_dir,
        user_root,
        user_bin_dir,
        openclaw_home_dir,
        openclaw_state_dir,
        openclaw_workspace_dir,
        openclaw_config_file,
        user_dir,
        user_auth_dir,
        user_storage_dir,
        user_integrations_dir,
        studio_dir,
        workspaces_dir,
        studio_backups_dir,
        user_logs_dir,
        config_dir,
        data_dir,
        cache_dir,
        logs_dir,
        state_dir,
        storage_dir,
        plugins_dir,
        integrations_dir,
        backups_dir,
        config_file,
        layout_file,
        active_file,
        inventory_file,
        retention_file,
        pinned_file,
        channels_file,
        policies_file,
        sources_file,
        service_file,
        components_file,
        upgrades_file,
        component_registry_file,
        service_defaults_file,
        upgrade_policy_file,
        device_id_file,
        main_log_file,
    }
}

fn resolve_install_root() -> Result<PathBuf> {
    let executable = std::env::current_exe()?;
    executable
        .parent()
        .map(|path| path.to_path_buf())
        .ok_or_else(|| {
            FrameworkError::Internal(
                "failed to resolve install root from current executable".to_string(),
            )
        })
}

#[cfg(windows)]
fn resolve_machine_root<R: Runtime>(_app: &AppHandle<R>) -> Result<PathBuf> {
    resolve_machine_root_from_env()
}

#[cfg(windows)]
fn resolve_machine_root_from_env() -> Result<PathBuf> {
    let base = std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .ok_or_else(|| FrameworkError::NotFound("ProgramData environment variable".to_string()))?;

    Ok(base.join("SdkWork").join("CrawStudio"))
}

#[cfg(windows)]
fn resolve_machine_root_from_current_process() -> Result<PathBuf> {
    resolve_machine_root_from_env()
}

#[cfg(not(windows))]
fn resolve_machine_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let resolver = app.path();
    resolver
        .app_data_dir()
        .map(|path| path.join("machine"))
        .map_err(FrameworkError::from)
}

#[cfg(not(windows))]
fn resolve_machine_root_from_current_process() -> Result<PathBuf> {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    dirs::data_dir()
        .map(|path| {
            path.join(context.config().identifier.as_str())
                .join("machine")
        })
        .ok_or_else(|| FrameworkError::NotFound("platform app data directory".to_string()))
}

#[cfg(windows)]
fn resolve_user_root<R: Runtime>(_app: &AppHandle<R>) -> Result<PathBuf> {
    resolve_user_root_from_env()
}

#[cfg(windows)]
fn resolve_user_root_from_env() -> Result<PathBuf> {
    let base = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .ok_or_else(|| FrameworkError::NotFound("USERPROFILE environment variable".to_string()))?;

    Ok(base.join(".sdkwork").join("crawstudio"))
}

#[cfg(windows)]
fn resolve_user_root_from_current_process() -> Result<PathBuf> {
    resolve_user_root_from_env()
}

#[cfg(not(windows))]
fn resolve_user_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let resolver = app.path();
    resolver
        .home_dir()
        .map(|path| path.join(".sdkwork").join("crawstudio"))
        .map_err(FrameworkError::from)
}

#[cfg(not(windows))]
fn resolve_user_root_from_current_process() -> Result<PathBuf> {
    dirs::home_dir()
        .map(|path| path.join(".sdkwork").join("crawstudio"))
        .ok_or_else(|| FrameworkError::NotFound("user home directory".to_string()))
}

pub fn ensure_runtime_directories(paths: &AppPaths) -> Result<()> {
    for directory in paths.managed_roots() {
        fs::create_dir_all(directory)?;
    }

    crate::framework::layout::initialize_machine_state(paths)?;
    crate::framework::config::load_or_create_config(paths)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::resolve_paths_for_root;

    fn normalize(path: &std::path::Path) -> String {
        path.to_string_lossy().replace('\\', "/")
    }

    #[test]
    fn creates_runtime_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        assert!(normalize(&paths.config_dir).ends_with("machine/state"));
        assert!(normalize(&paths.data_dir).ends_with("user-home/studio"));
        assert!(normalize(&paths.cache_dir).ends_with("machine/staging"));
        assert!(normalize(&paths.logs_dir).ends_with("machine/logs/app"));
        assert!(normalize(&paths.state_dir).ends_with("machine/runtime/state"));
        assert!(paths.config_dir.exists());
        assert!(paths.data_dir.exists());
        assert!(paths.cache_dir.exists());
        assert!(paths.logs_dir.exists());
        assert!(paths.state_dir.exists());
    }

    #[test]
    fn creates_extended_kernel_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        assert!(normalize(&paths.storage_dir).ends_with("user-home/user/storage"));
        assert!(normalize(&paths.plugins_dir).ends_with("install/extensions/plugins"));
        assert!(normalize(&paths.integrations_dir).ends_with("user-home/user/integrations"));
        assert!(normalize(&paths.backups_dir).ends_with("user-home/studio/backups"));
        assert!(root
            .path()
            .join("user-home")
            .join("user")
            .join("storage")
            .exists());
        assert!(root
            .path()
            .join("install")
            .join("extensions")
            .join("plugins")
            .exists());
        assert!(root
            .path()
            .join("user-home")
            .join("user")
            .join("integrations")
            .exists());
        assert!(root
            .path()
            .join("user-home")
            .join("studio")
            .join("backups")
            .exists());
    }

    #[test]
    fn creates_openclaw_runtime_management_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        assert!(normalize(&paths.managed_runtimes_dir).ends_with("machine/runtime/runtimes"));
        assert!(
            normalize(&paths.openclaw_runtime_dir).ends_with("machine/runtime/runtimes/openclaw")
        );
        assert!(normalize(&paths.user_bin_dir).ends_with("user-home/bin"));
        assert!(normalize(&paths.openclaw_home_dir).ends_with("user-home/openclaw-home"));
        assert!(normalize(&paths.openclaw_state_dir).ends_with("user-home/openclaw-home/.openclaw"));
        assert!(normalize(&paths.openclaw_workspace_dir)
            .ends_with("user-home/openclaw-home/.openclaw/workspace"));
        assert!(normalize(&paths.openclaw_config_file)
            .ends_with("user-home/openclaw-home/.openclaw/openclaw.json"));
        assert!(paths.managed_runtimes_dir.exists());
        assert!(paths.openclaw_runtime_dir.exists());
        assert!(paths.user_bin_dir.exists());
        assert!(paths.openclaw_home_dir.exists());
        assert!(paths.openclaw_state_dir.exists());
        assert!(paths.openclaw_workspace_dir.exists());
    }

    #[test]
    fn creates_machine_state_metadata_files() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let machine_state_dir = root.path().join("machine").join("state");

        assert!(paths.config_file.exists());
        assert!(machine_state_dir.join("layout.json").exists());
        assert!(machine_state_dir.join("active.json").exists());
        assert!(machine_state_dir.join("inventory.json").exists());
        assert!(machine_state_dir.join("retention.json").exists());
        assert!(machine_state_dir.join("pinned.json").exists());
        assert!(machine_state_dir.join("channels.json").exists());
        assert!(machine_state_dir.join("policies.json").exists());
        assert!(machine_state_dir.join("sources.json").exists());
        assert!(machine_state_dir.join("service.json").exists());
        assert!(machine_state_dir.join("components.json").exists());
        assert!(machine_state_dir.join("upgrades.json").exists());
    }
}
