use crate::framework::{
    paths::AppPaths,
    services::{
        openclaw_runtime::{resolve_bundled_resource_root, OpenClawRuntimeService},
        path_registration::PathRegistrationService,
    },
    Result,
};
use std::{
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

const REGISTER_OPENCLAW_CLI_FLAG: &str = "--register-openclaw-cli";
pub(crate) const RUN_OPENCLAW_CLI_FLAG: &str = "--run-openclaw-cli";

#[derive(Clone, Debug, PartialEq, Eq)]
enum InternalCliAction {
    RegisterOpenClawCli,
    RunOpenClawCli(Vec<OsString>),
}

pub fn maybe_handle_internal_cli_action() -> bool {
    match resolve_internal_cli_action(std::env::args_os()) {
        Some(InternalCliAction::RegisterOpenClawCli) => {
            if let Err(error) = register_openclaw_cli_for_current_install() {
                eprintln!("failed to register embedded openclaw cli: {error}");
                std::process::exit(1);
            }
            true
        }
        Some(InternalCliAction::RunOpenClawCli(cli_args)) => {
            let exit_code = match run_openclaw_cli_for_current_install(&cli_args) {
                Ok(code) => code,
                Err(error) => {
                    eprintln!("failed to run embedded openclaw cli: {error}");
                    1
                }
            };
            std::process::exit(exit_code);
        }
        None => false,
    }
}

fn resolve_internal_cli_action<I, S>(args: I) -> Option<InternalCliAction>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut args = args.into_iter();
    while let Some(arg) = args.next() {
        if arg.as_ref() == OsStr::new(REGISTER_OPENCLAW_CLI_FLAG) {
            return Some(InternalCliAction::RegisterOpenClawCli);
        }

        if arg.as_ref() == OsStr::new(RUN_OPENCLAW_CLI_FLAG) {
            return Some(InternalCliAction::RunOpenClawCli(
                args.map(|value| value.as_ref().to_os_string()).collect(),
            ));
        }
    }

    None
}

fn register_openclaw_cli_for_current_install() -> Result<()> {
    let paths = crate::framework::paths::resolve_paths_from_current_process()?;
    let resource_root = resolve_current_bundled_resource_root()?;
    let runtime =
        OpenClawRuntimeService::new().ensure_bundled_runtime_from_root(&paths, &resource_root)?;

    let path_registration = PathRegistrationService::new();
    path_registration.install_openclaw_shims(&paths, &runtime)?;
    path_registration.ensure_user_bin_on_path(&paths)?;

    Ok(())
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn register_openclaw_cli_for_paths_and_install_root(
    paths: &AppPaths,
    install_root: &Path,
) -> Result<()> {
    let runtime = OpenClawRuntimeService::new()
        .ensure_bundled_runtime_from_root(paths, &resolve_bundled_resource_root(install_root)?)?;

    let path_registration = PathRegistrationService::new();
    path_registration.install_openclaw_shims(paths, &runtime)?;
    path_registration.ensure_user_bin_on_path(paths)?;

    Ok(())
}

fn run_openclaw_cli_for_current_install(cli_args: &[OsString]) -> Result<i32> {
    let paths = crate::framework::paths::resolve_paths_from_current_process()?;
    let resource_root = resolve_current_bundled_resource_root()?;
    run_openclaw_cli_for_paths_and_install_root_with_resource_root(&paths, &resource_root, cli_args)
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn run_openclaw_cli_for_paths_and_install_root(
    paths: &AppPaths,
    install_root: &Path,
    cli_args: &[OsString],
) -> Result<i32> {
    let resource_root = resolve_bundled_resource_root(install_root)?;
    run_openclaw_cli_for_paths_and_install_root_with_resource_root(paths, &resource_root, cli_args)
}

fn run_openclaw_cli_for_paths_and_install_root_with_resource_root(
    paths: &AppPaths,
    resource_root: &Path,
    cli_args: &[OsString],
) -> Result<i32> {
    let runtime =
        OpenClawRuntimeService::new().ensure_bundled_runtime_from_root(paths, resource_root)?;
    let mut command = Command::new(&runtime.node_path);
    command.arg(&runtime.cli_path);
    command.args(cli_args);
    command.current_dir(&runtime.runtime_dir);
    command.stdin(Stdio::inherit());
    command.stdout(Stdio::inherit());
    command.stderr(Stdio::inherit());
    command.envs(runtime.managed_env());

    let status = command.status()?;
    Ok(status
        .code()
        .unwrap_or(if status.success() { 0 } else { 1 }))
}

fn resolve_current_bundled_resource_root() -> Result<PathBuf> {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let resource_dir =
        tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default())
            .map_err(|error| {
                crate::framework::FrameworkError::Internal(format!(
                    "failed to resolve current bundled resource directory: {error}"
                ))
            })?;

    resolve_bundled_resource_root(&resource_dir)
}

#[cfg(test)]
mod tests {
    use super::{
        register_openclaw_cli_for_paths_and_install_root, resolve_internal_cli_action,
        run_openclaw_cli_for_paths_and_install_root, InternalCliAction, RUN_OPENCLAW_CLI_FLAG,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use std::{ffi::OsString, fs};

    const TEST_BUNDLED_OPENCLAW_VERSION: &str = "2026.3.24";

    #[test]
    fn detects_internal_register_openclaw_cli_action() {
        let action = resolve_internal_cli_action(["claw-studio.exe", "--register-openclaw-cli"]);

        assert_eq!(action, Some(InternalCliAction::RegisterOpenClawCli));
    }

    #[test]
    fn detects_internal_run_openclaw_cli_action_and_forwards_remaining_args() {
        let action = resolve_internal_cli_action([
            "claw-studio.exe",
            RUN_OPENCLAW_CLI_FLAG,
            "doctor",
            "--json",
        ]);

        assert_eq!(
            action,
            Some(InternalCliAction::RunOpenClawCli(vec![
                OsString::from("doctor"),
                OsString::from("--json"),
            ]))
        );
    }

    #[test]
    fn internal_registration_prepares_runtime_and_user_shell_shims() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        create_bundled_runtime_fixture(&paths.install_root, None);

        register_openclaw_cli_for_paths_and_install_root(&paths, &paths.install_root)
            .expect("register openclaw cli");

        assert!(paths.user_bin_dir.join("openclaw.cmd").exists());
        assert!(paths.user_bin_dir.join("openclaw.ps1").exists());
        assert!(paths.user_bin_dir.join("openclaw").exists());

        let cmd = fs::read_to_string(paths.user_bin_dir.join("openclaw.cmd")).expect("cmd shim");
        assert!(cmd.contains(RUN_OPENCLAW_CLI_FLAG));
        assert!(!cmd.contains("OPENCLAW_GATEWAY_TOKEN"));

        let ps1 = fs::read_to_string(paths.user_bin_dir.join("openclaw.ps1")).expect("ps1 shim");
        assert!(ps1.contains(RUN_OPENCLAW_CLI_FLAG));
        assert!(!ps1.contains("OPENCLAW_GATEWAY_TOKEN"));

        let unix = fs::read_to_string(paths.user_bin_dir.join("openclaw")).expect("unix shim");
        assert!(unix.contains(RUN_OPENCLAW_CLI_FLAG));
        assert!(!unix.contains("OPENCLAW_GATEWAY_TOKEN"));

        let profile =
            fs::read_to_string(paths.user_root.join("profile.sh")).expect("managed profile");
        let export_line = format!(
            "export PATH=\"{}:$PATH\"",
            paths.user_bin_dir.to_string_lossy()
        );
        assert!(profile.contains(export_line.as_str()));
        assert!(paths.openclaw_config_file.exists());
    }

    #[test]
    fn internal_run_openclaw_cli_executes_managed_runtime_with_ephemeral_gateway_env() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let capture_path = paths.user_root.join("openclaw-cli-capture.json");
        create_bundled_runtime_fixture(&paths.install_root, Some(&capture_path));
        fs::write(
            &paths.openclaw_config_file,
            "{\n  \"gateway\": {\n    \"auth\": {\n      \"token\": \"test-token\"\n    }\n  }\n}\n",
        )
        .expect("seed openclaw config");

        let exit_code = run_openclaw_cli_for_paths_and_install_root(
            &paths,
            &paths.install_root,
            &[OsString::from("doctor"), OsString::from("--json")],
        )
        .expect("run embedded openclaw cli");

        assert_eq!(exit_code, 0);
        let capture = fs::read_to_string(&capture_path).expect("capture file");
        assert!(capture.contains("\"doctor\""));
        assert!(capture.contains("\"--json\""));
        assert!(capture.contains("\"test-token\""));
    }

    fn create_bundled_runtime_fixture(
        install_root: &std::path::Path,
        capture_path: Option<&std::path::Path>,
    ) {
        let resource_root = install_root.join("openclaw-runtime");
        let runtime_root = resource_root.join("runtime");
        let node_relative_path = resolve_test_node_executable()
            .to_string_lossy()
            .replace('\\', "/");
        let cli_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        let cli_source = match capture_path {
            Some(capture_path) => format!(
                "import fs from 'node:fs';\nconst payload = {{ args: process.argv.slice(2), token: process.env.OPENCLAW_GATEWAY_TOKEN ?? null }};\nfs.writeFileSync({}, `${{JSON.stringify(payload)}}\\n`);\n",
                serde_json::to_string(&capture_path.to_string_lossy().into_owned()).expect("capture path json"),
            ),
            None => "console.log('openclaw');\n".to_string(),
        };
        fs::write(&cli_path, cli_source).expect("cli file");

        let platform = match crate::platform::current_target() {
            "windows" => "windows",
            "macos" => "macos",
            "linux" => "linux",
            other => other,
        };
        let arch = match crate::platform::current_arch() {
            "x86_64" => "x64",
            "aarch64" => "arm64",
            other => other,
        };

        fs::write(
            resource_root.join("manifest.json"),
            format!(
                concat!(
                    "{{\n",
                    "  \"schemaVersion\": 1,\n",
                    "  \"runtimeId\": \"openclaw\",\n",
                    "  \"openclawVersion\": \"{version}\",\n",
                    "  \"nodeVersion\": \"22.16.0\",\n",
                    "  \"platform\": \"{platform}\",\n",
                    "  \"arch\": \"{arch}\",\n",
                    "  \"nodeRelativePath\": {node_relative_path_json},\n",
                    "  \"cliRelativePath\": \"runtime/package/node_modules/openclaw/openclaw.mjs\"\n",
                    "}}\n"
                ),
                version = TEST_BUNDLED_OPENCLAW_VERSION,
                platform = platform,
                arch = arch,
                node_relative_path_json =
                    serde_json::to_string(&node_relative_path).expect("node path json"),
            ),
        )
        .expect("manifest file");
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for internal cli tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .expect("node should be available on PATH for internal cli tests")
    }
}
