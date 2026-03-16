use crate::{
    framework::{services::process::ProcessRequest, FrameworkError, Result as FrameworkResult},
    state::AppState,
};

const INSTALL_SCRIPT_TIMEOUT_MS: u64 = 1_800_000;

#[tauri::command]
pub fn execute_install_script(
    command: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> std::result::Result<String, String> {
    let request = build_install_script_request(&command).map_err(|error| error.to_string())?;
    let result = state
        .context
        .services
        .process
        .run_capture_and_emit(request, &app)
        .map_err(|error| error.to_string())?;

    Ok(format_install_output(result.stdout, result.stderr))
}

fn build_install_script_request(command: &str) -> FrameworkResult<ProcessRequest> {
    let command = command.trim();
    if command.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "install command must not be empty".to_string(),
        ));
    }

    #[cfg(windows)]
    let request = ProcessRequest {
        command: "powershell.exe".to_string(),
        args: vec![
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-Command".to_string(),
            command.to_string(),
        ],
        cwd: None,
        timeout_ms: Some(INSTALL_SCRIPT_TIMEOUT_MS),
    };

    #[cfg(not(windows))]
    let request = ProcessRequest {
        command: "sh".to_string(),
        args: vec!["-lc".to_string(), command.to_string()],
        cwd: None,
        timeout_ms: Some(INSTALL_SCRIPT_TIMEOUT_MS),
    };

    Ok(request)
}

fn format_install_output(stdout: String, stderr: String) -> String {
    match (stdout.is_empty(), stderr.is_empty()) {
        (true, true) => String::new(),
        (false, true) => stdout,
        (true, false) => stderr,
        (false, false) => {
            if stdout.ends_with('\n') {
                format!("{stdout}{stderr}")
            } else {
                format!("{stdout}\n{stderr}")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{build_install_script_request, format_install_output, INSTALL_SCRIPT_TIMEOUT_MS};

    #[test]
    fn rejects_empty_install_command() {
        let error = build_install_script_request("   ").expect_err("empty command should fail");

        assert!(error
            .to_string()
            .contains("install command must not be empty"));
    }

    #[cfg(not(windows))]
    #[test]
    fn wraps_install_command_in_posix_shell() {
        let request = build_install_script_request("echo ready").expect("shell request");

        assert_eq!(request.command, "sh");
        assert_eq!(
            request.args,
            vec!["-lc".to_string(), "echo ready".to_string()]
        );
        assert_eq!(request.cwd, None);
        assert_eq!(request.timeout_ms, Some(INSTALL_SCRIPT_TIMEOUT_MS));
    }

    #[cfg(windows)]
    #[test]
    fn wraps_install_command_in_powershell() {
        let request =
            build_install_script_request("iwr -useb https://openclaw.ai/install.ps1 | iex")
                .expect("powershell request");

        assert_eq!(request.command, "powershell.exe");
        assert_eq!(
            request.args,
            vec![
                "-NoProfile".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-Command".to_string(),
                "iwr -useb https://openclaw.ai/install.ps1 | iex".to_string(),
            ],
        );
        assert_eq!(request.cwd, None);
        assert_eq!(request.timeout_ms, Some(INSTALL_SCRIPT_TIMEOUT_MS));
    }

    #[test]
    fn merges_stdout_and_stderr_for_terminal_display() {
        let output = format_install_output(
            "install started".to_string(),
            "warning: restart required".to_string(),
        );

        assert_eq!(output, "install started\nwarning: restart required");
    }
}
