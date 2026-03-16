use crate::framework::{policy::ExecutionPolicy, FrameworkError, Result};
use std::{ffi::OsString, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRequest {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub timeout_ms: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ValidatedProcessRequest {
    pub(crate) command: String,
    pub(crate) args: Vec<String>,
    pub(crate) cwd: PathBuf,
    pub(crate) timeout_ms: Option<u64>,
    pub(crate) env: Vec<(OsString, OsString)>,
}

pub(crate) fn prepare_request(
    policy: &ExecutionPolicy,
    request: ProcessRequest,
) -> Result<ValidatedProcessRequest> {
    prepare_request_with_env(policy, request, std::env::vars_os())
}

pub(crate) fn prepare_request_with_env<I>(
    policy: &ExecutionPolicy,
    request: ProcessRequest,
    env: I,
) -> Result<ValidatedProcessRequest>
where
    I: IntoIterator<Item = (OsString, OsString)>,
{
    let command = request.command.trim().to_string();
    if command.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "command must not be empty".to_string(),
        ));
    }

    policy.validate_command_spawn(&command, &request.args)?;
    let cwd = policy.resolve_working_directory(request.cwd.as_deref())?;
    let env = policy.sanitize_environment(env);

    Ok(ValidatedProcessRequest {
        command,
        args: request.args,
        cwd,
        timeout_ms: request.timeout_ms,
        env,
    })
}

impl ValidatedProcessRequest {
    pub(crate) fn command_display(&self) -> String {
        format_command(&self.command, &self.args)
    }
}

fn format_command(command: &str, args: &[String]) -> String {
    if args.is_empty() {
        return command.to_string();
    }

    format!("{command} {}", args.join(" "))
}

#[cfg(test)]
mod tests {
    use super::{prepare_request_with_env, ProcessRequest};
    use crate::framework::{paths::resolve_paths_for_root, policy::ExecutionPolicy};

    #[test]
    fn defaults_missing_cwd_to_managed_data_dir() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let policy = ExecutionPolicy::for_paths(&paths).expect("policy");

        let validated = prepare_request_with_env(&policy, test_echo_request(), Vec::new())
            .expect("validated request");

        assert_eq!(
            validated.cwd,
            std::fs::canonicalize(&paths.data_dir).expect("canonical data dir")
        );
    }

    #[test]
    fn strips_disallowed_environment_variables_before_spawn() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let policy = ExecutionPolicy::for_paths(&paths).expect("policy");

        let validated = prepare_request_with_env(
            &policy,
            test_echo_request(),
            vec![
                (
                    std::ffi::OsString::from("PATH"),
                    std::ffi::OsString::from("path-value"),
                ),
                (
                    std::ffi::OsString::from("SECRET_TOKEN"),
                    std::ffi::OsString::from("hidden"),
                ),
                #[cfg(windows)]
                (
                    std::ffi::OsString::from("SystemRoot"),
                    std::ffi::OsString::from("C:\\Windows"),
                ),
                #[cfg(not(windows))]
                (
                    std::ffi::OsString::from("LANG"),
                    std::ffi::OsString::from("en_US.UTF-8"),
                ),
            ],
        )
        .expect("validated request");

        assert!(validated.env.iter().any(|(key, _)| key == "PATH"));
        assert!(!validated.env.iter().any(|(key, _)| key == "SECRET_TOKEN"));
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
