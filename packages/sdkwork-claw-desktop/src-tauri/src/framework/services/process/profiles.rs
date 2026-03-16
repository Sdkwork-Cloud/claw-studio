use super::requests::ProcessRequest;
use crate::framework::{kernel::DesktopProcessProfileInfo, FrameworkError, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProcessProfile {
    pub id: String,
    pub job_kind: String,
    command: String,
    args: Vec<String>,
    default_timeout_ms: u64,
    allow_cancellation: bool,
}

pub(crate) fn resolve_profile(profile_id: &str) -> Result<ProcessProfile> {
    let normalized = profile_id.trim();
    if normalized.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "process profile id must not be empty".to_string(),
        ));
    }

    available_profiles()
        .into_iter()
        .find(|profile| profile.id == normalized)
        .ok_or_else(|| FrameworkError::NotFound(format!("process profile not found: {normalized}")))
}

pub(crate) fn available_profiles() -> Vec<ProcessProfile> {
    vec![test_echo_profile(), test_wait_profile()]
}

impl ProcessProfile {
    pub(crate) fn to_request(&self) -> ProcessRequest {
        ProcessRequest {
            command: self.command.clone(),
            args: self.args.clone(),
            cwd: None,
            timeout_ms: Some(self.default_timeout_ms),
        }
    }

    pub(crate) fn to_kernel_info(&self) -> DesktopProcessProfileInfo {
        DesktopProcessProfileInfo {
            id: self.id.clone(),
            job_kind: self.job_kind.clone(),
            command: self.command.clone(),
            args: self.args.clone(),
            default_timeout_ms: self.default_timeout_ms,
            allow_cancellation: self.allow_cancellation,
        }
    }

    pub(crate) fn allow_cancellation(&self) -> bool {
        self.allow_cancellation
    }
}

#[cfg(windows)]
fn test_echo_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.echo".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: "cmd".to_string(),
        args: vec!["/C".to_string(), "echo desktop-kernel".to_string()],
        default_timeout_ms: 2_000,
        allow_cancellation: true,
    }
}

#[cfg(windows)]
fn test_wait_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.wait".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: "cmd".to_string(),
        args: vec![
            "/C".to_string(),
            "ping -n 6 127.0.0.1 >nul && echo waited".to_string(),
        ],
        default_timeout_ms: 10_000,
        allow_cancellation: true,
    }
}

#[cfg(not(windows))]
fn test_echo_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.echo".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: "sh".to_string(),
        args: vec!["-c".to_string(), "printf desktop-kernel".to_string()],
        default_timeout_ms: 2_000,
        allow_cancellation: true,
    }
}

#[cfg(not(windows))]
fn test_wait_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.wait".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: "sh".to_string(),
        args: vec!["-c".to_string(), "sleep 2; printf waited".to_string()],
        default_timeout_ms: 10_000,
        allow_cancellation: true,
    }
}

#[cfg(test)]
mod tests {
    use super::{available_profiles, resolve_profile};

    #[test]
    fn resolves_known_process_profiles() {
        let profile = resolve_profile("diagnostics.echo").expect("profile");

        assert_eq!(profile.id, "diagnostics.echo");
        assert_eq!(profile.job_kind, "process.diagnostics");
    }

    #[test]
    fn rejects_unknown_process_profiles() {
        let error = resolve_profile("missing.profile").expect_err("unknown profile should fail");

        assert!(error.to_string().contains("process profile not found"));
    }

    #[test]
    fn available_profiles_include_wait_profile() {
        let profiles = available_profiles();

        assert!(profiles
            .iter()
            .any(|profile| profile.id == "diagnostics.echo"));
        assert!(profiles
            .iter()
            .any(|profile| profile.id == "diagnostics.wait"));
    }
}
