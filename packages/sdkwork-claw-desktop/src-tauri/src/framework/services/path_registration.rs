use crate::framework::{
    paths::AppPaths,
    services::openclaw_runtime::ActivatedOpenClawRuntime,
    Result,
};
#[cfg(not(windows))]
use crate::framework::FrameworkError;
use std::{fs, path::Path};

const PATH_BLOCK_START: &str = "# >>> claw-studio-openclaw >>>";
const PATH_BLOCK_END: &str = "# <<< claw-studio-openclaw <<<";
const MANAGED_PROFILE_FILE_NAME: &str = "profile.sh";

#[derive(Clone, Debug, Default)]
pub struct PathRegistrationService;

impl PathRegistrationService {
    pub fn new() -> Self {
        Self
    }

    pub fn install_openclaw_shims(
        &self,
        paths: &AppPaths,
        runtime: &ActivatedOpenClawRuntime,
    ) -> Result<()> {
        fs::create_dir_all(&paths.user_bin_dir)?;

        write_if_changed(
            &paths.user_bin_dir.join("openclaw.cmd"),
            &render_cmd_shim(runtime),
        )?;
        write_if_changed(
            &paths.user_bin_dir.join("openclaw.ps1"),
            &render_powershell_shim(runtime),
        )?;
        let unix_shim = paths.user_bin_dir.join("openclaw");
        write_if_changed(&unix_shim, &render_unix_shim(runtime))?;
        set_executable_if_supported(&unix_shim)?;

        Ok(())
    }

    pub fn ensure_user_bin_on_path(&self, paths: &AppPaths) -> Result<()> {
        let managed_profile = paths.user_root.join(MANAGED_PROFILE_FILE_NAME);
        let current_profile = fs::read_to_string(&managed_profile).unwrap_or_default();
        let next_profile = upsert_path_block(&current_profile, &paths.user_bin_dir);
        write_if_changed(&managed_profile, &next_profile)?;

        if cfg!(test) {
            return Ok(());
        }

        #[cfg(windows)]
        ensure_windows_path_contains(&paths.user_bin_dir)?;

        #[cfg(not(windows))]
        ensure_shell_profiles_source(&managed_profile)?;

        Ok(())
    }
}

fn render_cmd_shim(runtime: &ActivatedOpenClawRuntime) -> String {
    format!(
        "@echo off\r\nsetlocal\r\nset \"OPENCLAW_HOME={}\"\r\nset \"OPENCLAW_STATE_DIR={}\"\r\nset \"OPENCLAW_CONFIG_PATH={}\"\r\n\"{}\" \"{}\" %*\r\n",
        runtime.home_dir.display(),
        runtime.state_dir.display(),
        runtime.config_path.display(),
        runtime.node_path.display(),
        runtime.cli_path.display()
    )
}

fn render_powershell_shim(runtime: &ActivatedOpenClawRuntime) -> String {
    format!(
        "$env:OPENCLAW_HOME = '{}'\r\n$env:OPENCLAW_STATE_DIR = '{}'\r\n$env:OPENCLAW_CONFIG_PATH = '{}'\r\n& '{}' '{}' @Args\r\n",
        escape_powershell_path(&runtime.home_dir),
        escape_powershell_path(&runtime.state_dir),
        escape_powershell_path(&runtime.config_path),
        escape_powershell_path(&runtime.node_path),
        escape_powershell_path(&runtime.cli_path)
    )
}

fn render_unix_shim(runtime: &ActivatedOpenClawRuntime) -> String {
    format!(
        "#!/bin/sh\nexport OPENCLAW_HOME='{}'\nexport OPENCLAW_STATE_DIR='{}'\nexport OPENCLAW_CONFIG_PATH='{}'\nexec '{}' '{}' \"$@\"\n",
        escape_unix_path(&runtime.home_dir),
        escape_unix_path(&runtime.state_dir),
        escape_unix_path(&runtime.config_path),
        escape_unix_path(&runtime.node_path),
        escape_unix_path(&runtime.cli_path)
    )
}

fn upsert_path_block(current: &str, user_bin_dir: &Path) -> String {
    let block = format!(
        "{PATH_BLOCK_START}\nexport PATH=\"{}:$PATH\"\n{PATH_BLOCK_END}\n",
        user_bin_dir.display()
    );

    if let (Some(start), Some(end)) = (current.find(PATH_BLOCK_START), current.find(PATH_BLOCK_END))
    {
        let end_index = end + PATH_BLOCK_END.len();
        let mut updated = String::new();
        updated.push_str(&current[..start]);
        if !updated.is_empty() && !updated.ends_with('\n') {
            updated.push('\n');
        }
        updated.push_str(&block);
        let suffix = current[end_index..].trim_start_matches(['\r', '\n']);
        if !suffix.is_empty() {
            updated.push('\n');
            updated.push_str(suffix);
            if !updated.ends_with('\n') {
                updated.push('\n');
            }
        }
        return updated;
    }

    let mut updated = current.trim_end().to_string();
    if !updated.is_empty() {
        updated.push_str("\n\n");
    }
    updated.push_str(&block);
    updated
}

fn write_if_changed(path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    if fs::read_to_string(path).ok().as_deref() == Some(content) {
        return Ok(());
    }

    fs::write(path, content)?;
    Ok(())
}

#[cfg(unix)]
fn set_executable_if_supported(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn set_executable_if_supported(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(windows)]
fn ensure_windows_path_contains(user_bin_dir: &Path) -> Result<()> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let environment = hkcu
        .open_subkey_with_flags("Environment", winreg::enums::KEY_READ | winreg::enums::KEY_WRITE)
        .or_else(|_| hkcu.create_subkey("Environment").map(|(key, _)| key))?;
    let current = environment.get_value::<String, _>("Path").unwrap_or_default();
    let updated = merge_windows_path(&current, user_bin_dir);

    if updated != current {
        environment.set_value("Path", &updated)?;
    }

    Ok(())
}

#[cfg(not(windows))]
fn ensure_windows_path_contains(_user_bin_dir: &Path) -> Result<()> {
    Ok(())
}

#[cfg(not(windows))]
fn ensure_shell_profiles_source(managed_profile: &Path) -> Result<()> {
    let home_dir = std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .ok_or_else(|| FrameworkError::NotFound("HOME environment variable".to_string()))?;

    for file_name in [".profile", ".bash_profile", ".zprofile"] {
        let profile_path = home_dir.join(file_name);
        let current = fs::read_to_string(&profile_path).unwrap_or_default();
        let next = upsert_source_block(&current, managed_profile);
        write_if_changed(&profile_path, &next)?;
    }

    Ok(())
}

#[cfg(windows)]
#[allow(dead_code)]
fn ensure_shell_profiles_source(_managed_profile: &Path) -> Result<()> {
    Ok(())
}

fn merge_windows_path(current: &str, user_bin_dir: &Path) -> String {
    let needle = user_bin_dir.to_string_lossy().to_string();
    let mut entries = current
        .split(';')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    if entries
        .iter()
        .any(|entry| entry.eq_ignore_ascii_case(needle.as_str()))
    {
        return entries.join(";");
    }

    entries.push(needle);
    entries.join(";")
}

#[cfg_attr(windows, allow(dead_code))]
fn upsert_source_block(current: &str, managed_profile: &Path) -> String {
    let block = format!(
        "{PATH_BLOCK_START}\n. \"{}\"\n{PATH_BLOCK_END}\n",
        managed_profile.display()
    );

    if let (Some(start), Some(end)) = (current.find(PATH_BLOCK_START), current.find(PATH_BLOCK_END))
    {
        let end_index = end + PATH_BLOCK_END.len();
        let mut updated = String::new();
        updated.push_str(&current[..start]);
        if !updated.is_empty() && !updated.ends_with('\n') {
            updated.push('\n');
        }
        updated.push_str(&block);
        let suffix = current[end_index..].trim_start_matches(['\r', '\n']);
        if !suffix.is_empty() {
            updated.push('\n');
            updated.push_str(suffix);
            if !updated.ends_with('\n') {
                updated.push('\n');
            }
        }
        return updated;
    }

    let mut updated = current.trim_end().to_string();
    if !updated.is_empty() {
        updated.push_str("\n\n");
    }
    updated.push_str(&block);
    updated
}

fn escape_powershell_path(path: &Path) -> String {
    path.display().to_string().replace('\'', "''")
}

fn escape_unix_path(path: &Path) -> String {
    path.display().to_string().replace('\'', "'\"'\"'")
}

#[cfg(test)]
mod tests {
    use super::PathRegistrationService;
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::openclaw_runtime::ActivatedOpenClawRuntime,
    };
    use std::fs;

    #[test]
    fn writes_openclaw_cli_shims_for_windows_shells() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let runtime = test_runtime(&paths);
        let service = PathRegistrationService::new();

        service
            .install_openclaw_shims(&paths, &runtime)
            .expect("install shims");

        let cmd = fs::read_to_string(paths.user_bin_dir.join("openclaw.cmd")).expect("cmd shim");
        let ps1 =
            fs::read_to_string(paths.user_bin_dir.join("openclaw.ps1")).expect("ps1 shim");
        let unix = fs::read_to_string(paths.user_bin_dir.join("openclaw")).expect("unix shim");

        assert!(cmd.contains(runtime.node_path.to_string_lossy().as_ref()));
        assert!(cmd.contains(runtime.cli_path.to_string_lossy().as_ref()));
        assert!(ps1.contains(runtime.node_path.to_string_lossy().as_ref()));
        assert!(ps1.contains(runtime.cli_path.to_string_lossy().as_ref()));
        assert!(unix.contains(runtime.node_path.to_string_lossy().as_ref()));
        assert!(unix.contains(runtime.cli_path.to_string_lossy().as_ref()));
    }

    #[test]
    fn updates_shell_profile_exports_idempotently() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let service = PathRegistrationService::new();

        service
            .ensure_user_bin_on_path(&paths)
            .expect("first path registration");
        service
            .ensure_user_bin_on_path(&paths)
            .expect("second path registration");

        let profile = fs::read_to_string(paths.user_root.join("profile.sh")).expect("profile");
        let export_line = format!(
            "export PATH=\"{}:$PATH\"",
            paths.user_bin_dir.to_string_lossy()
        );

        assert_eq!(profile.matches("# >>> claw-studio-openclaw >>>").count(), 1);
        assert_eq!(profile.matches("# <<< claw-studio-openclaw <<<").count(), 1);
        assert_eq!(profile.matches(export_line.as_str()).count(), 1);
    }

    fn test_runtime(paths: &crate::framework::paths::AppPaths) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("2026.3.13-windows-x64");
        let runtime_dir = install_dir.join("runtime");
        let node_path = runtime_dir.join("node").join("node.exe");
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");

        fs::create_dir_all(node_path.parent().expect("node parent")).expect("node dir");
        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&node_path, "node").expect("node file");
        fs::write(&cli_path, "console.log('openclaw');").expect("cli file");

        ActivatedOpenClawRuntime {
            install_key: "2026.3.13-windows-x64".to_string(),
            install_dir,
            runtime_dir,
            node_path,
            cli_path,
            home_dir: paths.openclaw_home_dir.clone(),
            state_dir: paths.openclaw_state_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port: 18_789,
            gateway_auth_token: "test-token".to_string(),
        }
    }
}
