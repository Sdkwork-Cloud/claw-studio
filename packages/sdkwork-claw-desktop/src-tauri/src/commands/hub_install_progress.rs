use hub_installer_rs::{ProgressEvent, ProgressStream};
use tauri::{AppHandle, Emitter, Runtime};

pub(crate) const HUB_INSTALLER_PROGRESS_EVENT: &str = "hub-installer:progress";

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HubInstallProgressOperationKind {
    Install,
    DependencyInstall,
    Uninstall,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HubInstallProgressEventPayload {
    StageStarted {
        stage: String,
        #[serde(rename = "totalSteps")]
        total_steps: usize,
    },
    StageCompleted {
        stage: String,
        success: bool,
        #[serde(rename = "totalSteps")]
        total_steps: usize,
        #[serde(rename = "failedSteps")]
        failed_steps: usize,
    },
    ArtifactStarted {
        #[serde(rename = "artifactId")]
        artifact_id: String,
        #[serde(rename = "artifactType")]
        artifact_type: String,
    },
    ArtifactCompleted {
        #[serde(rename = "artifactId")]
        artifact_id: String,
        #[serde(rename = "artifactType")]
        artifact_type: String,
        success: bool,
    },
    DependencyStarted {
        #[serde(rename = "dependencyId")]
        dependency_id: String,
        target: String,
        description: Option<String>,
    },
    DependencyCompleted {
        #[serde(rename = "dependencyId")]
        dependency_id: String,
        target: String,
        success: bool,
        skipped: bool,
        #[serde(rename = "statusAfter")]
        status_after: String,
    },
    StepStarted {
        #[serde(rename = "stepId")]
        step_id: String,
        description: String,
    },
    StepCommandStarted {
        #[serde(rename = "stepId")]
        step_id: String,
        #[serde(rename = "commandLine")]
        command_line: String,
        #[serde(rename = "workingDirectory")]
        working_directory: Option<String>,
    },
    StepLogChunk {
        #[serde(rename = "stepId")]
        step_id: String,
        stream: ProgressStream,
        chunk: String,
    },
    StepCompleted {
        #[serde(rename = "stepId")]
        step_id: String,
        success: bool,
        skipped: bool,
        #[serde(rename = "durationMs")]
        duration_ms: u128,
        #[serde(rename = "exitCode")]
        exit_code: Option<i32>,
    },
}

impl From<ProgressEvent> for HubInstallProgressEventPayload {
    fn from(event: ProgressEvent) -> Self {
        match event {
            ProgressEvent::StageStarted { stage, total_steps } => {
                Self::StageStarted { stage, total_steps }
            }
            ProgressEvent::StageCompleted {
                stage,
                success,
                total_steps,
                failed_steps,
            } => Self::StageCompleted {
                stage,
                success,
                total_steps,
                failed_steps,
            },
            ProgressEvent::ArtifactStarted {
                artifact_id,
                artifact_type,
            } => Self::ArtifactStarted {
                artifact_id,
                artifact_type,
            },
            ProgressEvent::ArtifactCompleted {
                artifact_id,
                artifact_type,
                success,
            } => Self::ArtifactCompleted {
                artifact_id,
                artifact_type,
                success,
            },
            ProgressEvent::DependencyStarted {
                dependency_id,
                target,
                description,
            } => Self::DependencyStarted {
                dependency_id,
                target,
                description,
            },
            ProgressEvent::DependencyCompleted {
                dependency_id,
                target,
                success,
                skipped,
                status_after,
            } => Self::DependencyCompleted {
                dependency_id,
                target,
                success,
                skipped,
                status_after,
            },
            ProgressEvent::StepStarted {
                step_id,
                description,
            } => Self::StepStarted {
                step_id,
                description,
            },
            ProgressEvent::StepCommandStarted {
                step_id,
                command_line,
                working_directory,
            } => Self::StepCommandStarted {
                step_id,
                command_line,
                working_directory,
            },
            ProgressEvent::StepLogChunk {
                step_id,
                stream,
                chunk,
            } => Self::StepLogChunk {
                step_id,
                stream,
                chunk,
            },
            ProgressEvent::StepCompleted {
                step_id,
                success,
                skipped,
                duration_ms,
                exit_code,
            } => Self::StepCompleted {
                step_id,
                success,
                skipped,
                duration_ms,
                exit_code,
            },
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallProgressPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub software_name: String,
    pub operation_kind: HubInstallProgressOperationKind,
    #[serde(flatten)]
    pub event: HubInstallProgressEventPayload,
}

impl HubInstallProgressPayload {
    pub fn new(
        request_id: Option<String>,
        software_name: String,
        operation_kind: HubInstallProgressOperationKind,
        event: ProgressEvent,
    ) -> Self {
        Self {
            request_id,
            software_name,
            operation_kind,
            event: event.into(),
        }
    }
}

pub(crate) fn emit_hub_install_progress<R: Runtime>(
    app: &AppHandle<R>,
    request_id: Option<&str>,
    software_name: &str,
    operation_kind: HubInstallProgressOperationKind,
    event: &ProgressEvent,
) {
    let _ = app.emit(
        HUB_INSTALLER_PROGRESS_EVENT,
        HubInstallProgressPayload::new(
            request_id.map(str::to_owned),
            software_name.to_owned(),
            operation_kind,
            event.clone(),
        ),
    );
}
