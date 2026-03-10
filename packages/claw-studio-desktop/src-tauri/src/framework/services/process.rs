use crate::framework::{policy, runtime, FrameworkError, Result};
use std::{path::PathBuf, process::Command};

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRequest {
  pub command: String,
  #[serde(default)]
  pub args: Vec<String>,
  pub cwd: Option<PathBuf>,
  pub timeout_ms: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: Option<i32>,
}

#[derive(Clone, Debug, Default)]
pub struct ProcessService;

impl ProcessService {
  pub fn new() -> Self {
    Self
  }

  pub fn run_capture(&self, request: ProcessRequest) -> Result<ProcessResult> {
    let command = request.command.trim().to_string();
    if command.is_empty() {
      return Err(FrameworkError::ValidationFailed(
        "command must not be empty".to_string(),
      ));
    }

    policy::validate_command_spawn(&command, &request.args)?;
    policy::validate_working_directory(request.cwd.as_deref())?;

    runtime::run_blocking("process.run_capture", || {
      let mut process = Command::new(&command);
      process.args(&request.args);

      if let Some(cwd) = request.cwd.as_ref() {
        process.current_dir(cwd);
      }

      let output = process.output()?;
      let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
      let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
      let exit_code = output.status.code();

      if output.status.success() {
        return Ok(ProcessResult {
          stdout,
          stderr,
          exit_code,
        });
      }

      Err(FrameworkError::ProcessFailed {
        command: format_command(&command, &request.args),
        exit_code,
        stderr_tail: trim_stderr(&stderr),
      })
    })
  }
}

fn format_command(command: &str, args: &[String]) -> String {
  if args.is_empty() {
    return command.to_string();
  }

  format!("{command} {}", args.join(" "))
}

fn trim_stderr(stderr: &str) -> String {
  const MAX_LEN: usize = 512;
  if stderr.len() <= MAX_LEN {
    return stderr.to_string();
  }

  stderr[stderr.len() - MAX_LEN..].to_string()
}

#[cfg(test)]
mod tests {
  use super::{ProcessRequest, ProcessService};

  #[test]
  fn runs_controlled_process_and_captures_stdout() {
    let service = ProcessService::new();
    let result = service.run_capture(test_echo_request()).expect("process result");

    assert!(result.stdout.contains("desktop-kernel"));
    assert_eq!(result.exit_code, Some(0));
  }

  #[cfg(windows)]
  fn test_echo_request() -> ProcessRequest {
    ProcessRequest {
      command: "cmd".to_string(),
      args: vec!["/C".to_string(), "echo desktop-kernel".to_string()],
      cwd: None,
      timeout_ms: None,
    }
  }

  #[cfg(not(windows))]
  fn test_echo_request() -> ProcessRequest {
    ProcessRequest {
      command: "sh".to_string(),
      args: vec!["-c".to_string(), "printf desktop-kernel".to_string()],
      cwd: None,
      timeout_ms: None,
    }
  }
}
