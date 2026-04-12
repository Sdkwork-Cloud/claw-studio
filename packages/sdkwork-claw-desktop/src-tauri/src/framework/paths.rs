use crate::framework::{FrameworkError, Result};
use std::{fs, path::PathBuf};
#[cfg(not(windows))]
use tauri::Manager;
use tauri::{AppHandle, Runtime};

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
    pub local_ai_proxy_config_file: PathBuf,
    pub local_ai_proxy_snapshot_file: PathBuf,
    pub local_ai_proxy_token_file: PathBuf,
    pub local_ai_proxy_observability_db_file: PathBuf,
    pub local_ai_proxy_log_file: PathBuf,
    pub user_dir: PathBuf,
    pub user_auth_dir: PathBuf,
    pub user_storage_dir: PathBuf,
    pub user_integrations_dir: PathBuf,
    pub studio_dir: PathBuf,
    pub workspaces_dir: PathBuf,
    pub studio_backups_dir: PathBuf,
    pub user_logs_dir: PathBuf,
    pub config_dir: PathBuf,
    pub kernels_state_dir: PathBuf,
    pub openclaw_kernel_dir: PathBuf,
    pub openclaw_authority_file: PathBuf,
    pub openclaw_migrations_file: PathBuf,
    pub openclaw_runtime_upgrades_file: PathBuf,
    pub openclaw_managed_config_dir: PathBuf,
    pub openclaw_managed_config_file: PathBuf,
    pub openclaw_quarantine_dir: PathBuf,
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
            self.kernels_state_dir.clone(),
            self.openclaw_kernel_dir.clone(),
            self.openclaw_managed_config_dir.clone(),
            self.openclaw_quarantine_dir.clone(),
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
    resolve_paths_from_current_process_with_overrides(None, None, None)
}

pub(crate) fn resolve_paths_from_current_process_with_overrides(
    install_root: Option<PathBuf>,
    machine_root: Option<PathBuf>,
    user_root: Option<PathBuf>,
) -> Result<AppPaths> {
    let paths = build_paths(
        install_root.unwrap_or(resolve_install_root()?),
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
    let managed_runtimes_dir = install_root.join("runtimes");
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
    let kernels_state_dir = config_dir.join("kernels");
    let openclaw_kernel_dir = kernels_state_dir.join("openclaw");
    let openclaw_authority_file = openclaw_kernel_dir.join("authority.json");
    let openclaw_migrations_file = openclaw_kernel_dir.join("migrations.json");
    let openclaw_runtime_upgrades_file = openclaw_kernel_dir.join("runtime-upgrades.json");
    let openclaw_managed_config_dir = openclaw_kernel_dir.join("managed-config");
    let openclaw_managed_config_file = openclaw_managed_config_dir.join("openclaw.json");
    let openclaw_quarantine_dir = openclaw_kernel_dir.join("quarantine");
    let data_dir = studio_dir.clone();
    let cache_dir = machine_staging_dir.clone();
    let logs_dir = machine_logs_dir.join("app");
    let state_dir = machine_runtime_dir.join("state");
    let local_ai_proxy_config_file = machine_state_dir.join("local-ai-proxy.json");
    let local_ai_proxy_snapshot_file = state_dir.join("local-ai-proxy.snapshot.json");
    let local_ai_proxy_token_file = state_dir.join("local-ai-proxy.token");
    let local_ai_proxy_observability_db_file =
        machine_store_dir.join("local-ai-proxy-observability.sqlite3");
    let local_ai_proxy_log_file = logs_dir.join("local-ai-proxy.log");
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
        local_ai_proxy_config_file,
        local_ai_proxy_snapshot_file,
        local_ai_proxy_token_file,
        local_ai_proxy_observability_db_file,
        local_ai_proxy_log_file,
        user_dir,
        user_auth_dir,
        user_storage_dir,
        user_integrations_dir,
        studio_dir,
        workspaces_dir,
        studio_backups_dir,
        user_logs_dir,
        config_dir,
        kernels_state_dir,
        openclaw_kernel_dir,
        openclaw_authority_file,
        openclaw_migrations_file,
        openclaw_runtime_upgrades_file,
        openclaw_managed_config_dir,
        openclaw_managed_config_file,
        openclaw_quarantine_dir,
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

    migrate_legacy_openclaw_runtime_layout(paths)?;
    crate::framework::layout::initialize_machine_state(paths)?;
    crate::framework::config::load_or_create_config(paths)?;

    Ok(())
}

fn migrate_legacy_openclaw_runtime_layout(paths: &AppPaths) -> Result<()> {
    let legacy_runtime_dir = paths.machine_runtime_dir.join("runtimes").join("openclaw");
    migrate_directory_entries(&legacy_runtime_dir, &paths.openclaw_runtime_dir)
}

fn migrate_directory_entries(
    source_dir: &std::path::Path,
    target_dir: &std::path::Path,
) -> Result<()> {
    if !source_dir.exists() {
        return Ok(());
    }

    fs::create_dir_all(target_dir)?;

    for entry in fs::read_dir(source_dir)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target_dir.join(entry.file_name());

        if target_path.exists() {
            continue;
        }

        if fs::rename(&source_path, &target_path).is_ok() {
            continue;
        }

        copy_path_recursively(&source_path, &target_path)?;
        remove_path_recursively(&source_path)?;
    }

    prune_empty_directory_tree(source_dir)?;

    Ok(())
}

fn copy_path_recursively(
    source_path: &std::path::Path,
    target_path: &std::path::Path,
) -> Result<()> {
    let metadata = fs::symlink_metadata(source_path)?;
    if metadata.is_dir() {
        fs::create_dir_all(target_path)?;
        for entry in fs::read_dir(source_path)? {
            let entry = entry?;
            copy_path_recursively(&entry.path(), &target_path.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source_path, target_path)?;
    Ok(())
}

fn remove_path_recursively(path: &std::path::Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }

    let metadata = fs::symlink_metadata(path)?;
    if metadata.is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }

    Ok(())
}

fn prune_empty_directory_tree(path: &std::path::Path) -> Result<()> {
    let mut current = path.to_path_buf();

    loop {
        if !current.exists() {
            break;
        }

        let is_empty = fs::read_dir(&current)?.next().is_none();
        if !is_empty {
            break;
        }

        fs::remove_dir(&current)?;
        let Some(parent) = current.parent() else {
            break;
        };
        current = parent.to_path_buf();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{build_paths, ensure_runtime_directories, resolve_paths_for_root};
    use std::fs;

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

        assert!(normalize(&paths.managed_runtimes_dir).ends_with("install/runtimes"));
        assert!(normalize(&paths.openclaw_runtime_dir).ends_with("install/runtimes/openclaw"));
        assert!(normalize(&paths.user_bin_dir).ends_with("user-home/bin"));
        assert!(normalize(&paths.openclaw_home_dir).ends_with("user-home/openclaw-home"));
        assert!(normalize(&paths.openclaw_state_dir).ends_with("user-home/openclaw-home/.openclaw"));
        assert!(normalize(&paths.openclaw_workspace_dir)
            .ends_with("user-home/openclaw-home/.openclaw/workspace"));
        assert!(normalize(&paths.openclaw_config_file)
            .ends_with("user-home/openclaw-home/.openclaw/openclaw.json"));
        assert!(normalize(&paths.local_ai_proxy_config_file)
            .ends_with("machine/state/local-ai-proxy.json"));
        assert!(normalize(&paths.local_ai_proxy_snapshot_file)
            .ends_with("machine/runtime/state/local-ai-proxy.snapshot.json"));
        assert!(normalize(&paths.local_ai_proxy_token_file)
            .ends_with("machine/runtime/state/local-ai-proxy.token"));
        assert!(normalize(&paths.local_ai_proxy_log_file)
            .ends_with("machine/logs/app/local-ai-proxy.log"));
        assert!(paths.managed_runtimes_dir.exists());
        assert!(paths.openclaw_runtime_dir.exists());
        assert!(paths.user_bin_dir.exists());
        assert!(paths.openclaw_home_dir.exists());
        assert!(paths.openclaw_state_dir.exists());
        assert!(paths.openclaw_workspace_dir.exists());
    }

    #[test]
    fn creates_openclaw_authority_management_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        assert!(normalize(&paths.kernels_state_dir).ends_with("machine/state/kernels"));
        assert!(normalize(&paths.openclaw_kernel_dir).ends_with("machine/state/kernels/openclaw"));
        assert!(normalize(&paths.openclaw_authority_file)
            .ends_with("machine/state/kernels/openclaw/authority.json"));
        assert!(normalize(&paths.openclaw_migrations_file)
            .ends_with("machine/state/kernels/openclaw/migrations.json"));
        assert!(normalize(&paths.openclaw_runtime_upgrades_file)
            .ends_with("machine/state/kernels/openclaw/runtime-upgrades.json"));
        assert!(normalize(&paths.openclaw_managed_config_dir)
            .ends_with("machine/state/kernels/openclaw/managed-config"));
        assert!(normalize(&paths.openclaw_managed_config_file)
            .ends_with("machine/state/kernels/openclaw/managed-config/openclaw.json"));
        assert!(normalize(&paths.openclaw_quarantine_dir)
            .ends_with("machine/state/kernels/openclaw/quarantine"));
        assert!(paths.kernels_state_dir.exists());
        assert!(paths.openclaw_kernel_dir.exists());
        assert!(paths.openclaw_managed_config_dir.exists());
        assert!(paths.openclaw_quarantine_dir.exists());
        assert!(paths.openclaw_authority_file.exists());
        assert!(paths.openclaw_migrations_file.exists());
        assert!(paths.openclaw_runtime_upgrades_file.exists());
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

    #[test]
    fn migrates_legacy_openclaw_runtime_entries_into_install_root() {
        let root = tempfile::tempdir().expect("temp dir");
        let install_root = root.path().join("install");
        let machine_root = root.path().join("machine");
        let user_root = root.path().join("user-home");
        let legacy_install_dir = machine_root
            .join("runtime")
            .join("runtimes")
            .join("openclaw")
            .join("2026.4.1-windows-x64");
        let legacy_marker = legacy_install_dir.join("manifest.json");

        fs::create_dir_all(&legacy_install_dir).expect("legacy dir");
        fs::write(&legacy_marker, "{\"version\":\"2026.4.1\"}\n").expect("legacy marker");

        let paths = build_paths(install_root, machine_root.clone(), user_root);
        ensure_runtime_directories(&paths).expect("paths");

        let migrated_marker = paths
            .openclaw_runtime_dir
            .join("2026.4.1-windows-x64")
            .join("manifest.json");
        assert!(migrated_marker.exists());
        assert_eq!(
            fs::read_to_string(&migrated_marker).expect("migrated marker"),
            "{\"version\":\"2026.4.1\"}\n"
        );
        assert!(!legacy_marker.exists());
        assert!(!machine_root
            .join("runtime")
            .join("runtimes")
            .join("openclaw")
            .exists());
    }

    #[test]
    fn preserves_current_runtime_entries_while_merging_legacy_versions() {
        let root = tempfile::tempdir().expect("temp dir");
        let install_root = root.path().join("install");
        let machine_root = root.path().join("machine");
        let user_root = root.path().join("user-home");
        let current_install_dir = install_root
            .join("runtimes")
            .join("openclaw")
            .join("2026.4.2-windows-x64");
        let current_marker = current_install_dir.join("manifest.json");
        let legacy_install_dir = machine_root
            .join("runtime")
            .join("runtimes")
            .join("openclaw")
            .join("2026.4.1-windows-x64");
        let legacy_marker = legacy_install_dir.join("manifest.json");

        fs::create_dir_all(&current_install_dir).expect("current dir");
        fs::write(&current_marker, "{\"version\":\"2026.4.2\"}\n").expect("current marker");
        fs::create_dir_all(&legacy_install_dir).expect("legacy dir");
        fs::write(&legacy_marker, "{\"version\":\"2026.4.1\"}\n").expect("legacy marker");

        let paths = build_paths(install_root, machine_root.clone(), user_root);
        ensure_runtime_directories(&paths).expect("paths");

        assert_eq!(
            fs::read_to_string(
                paths
                    .openclaw_runtime_dir
                    .join("2026.4.2-windows-x64")
                    .join("manifest.json")
            )
            .expect("current marker"),
            "{\"version\":\"2026.4.2\"}\n"
        );
        assert_eq!(
            fs::read_to_string(
                paths
                    .openclaw_runtime_dir
                    .join("2026.4.1-windows-x64")
                    .join("manifest.json")
            )
            .expect("legacy migrated marker"),
            "{\"version\":\"2026.4.1\"}\n"
        );
        assert!(!legacy_marker.exists());
    }
}
