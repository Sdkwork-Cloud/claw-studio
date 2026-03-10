use crate::framework::{FrameworkError, Result};
use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex, MutexGuard,
  },
};

static NEXT_JOB_ID: AtomicU64 = AtomicU64::new(1);

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobState {
  Queued,
  Running,
  Succeeded,
  Failed,
  Cancelled,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
  pub id: String,
  pub kind: String,
  pub state: JobState,
  pub stage: String,
}

#[derive(Clone, Debug, Default)]
pub struct JobService {
  jobs: Arc<Mutex<HashMap<String, JobRecord>>>,
}

impl JobService {
  pub fn new() -> Self {
    Self {
      jobs: Arc::new(Mutex::new(HashMap::new())),
    }
  }

  pub fn submit(&self, kind: &str) -> Result<String> {
    let normalized_kind = kind.trim();
    if normalized_kind.is_empty() {
      return Err(FrameworkError::ValidationFailed(
        "job kind must not be empty".to_string(),
      ));
    }

    let id = format!("job-{}", NEXT_JOB_ID.fetch_add(1, Ordering::Relaxed));
    let record = JobRecord {
      id: id.clone(),
      kind: normalized_kind.to_string(),
      state: JobState::Queued,
      stage: "queued".to_string(),
    };

    self.lock_jobs()?.insert(id.clone(), record);
    Ok(id)
  }

  pub fn get(&self, id: &str) -> Result<JobRecord> {
    self
      .lock_jobs()?
      .get(id)
      .cloned()
      .ok_or_else(|| FrameworkError::NotFound(format!("job not found: {id}")))
  }

  pub fn list(&self) -> Result<Vec<JobRecord>> {
    let mut jobs = self.lock_jobs()?.values().cloned().collect::<Vec<_>>();
    jobs.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(jobs)
  }

  #[allow(dead_code)]
  pub fn mark_running(&self, id: &str, stage: &str) -> Result<JobRecord> {
    self.transition(id, JobState::Running, stage)
  }

  #[allow(dead_code)]
  pub fn mark_succeeded(&self, id: &str, stage: &str) -> Result<JobRecord> {
    self.transition(id, JobState::Succeeded, stage)
  }

  #[allow(dead_code)]
  pub fn mark_failed(&self, id: &str, stage: &str) -> Result<JobRecord> {
    self.transition(id, JobState::Failed, stage)
  }

  pub fn cancel(&self, id: &str) -> Result<JobRecord> {
    self.transition(id, JobState::Cancelled, "cancelled")
  }

  fn transition(&self, id: &str, state: JobState, stage: &str) -> Result<JobRecord> {
    let mut jobs = self.lock_jobs()?;
    let record = jobs
      .get_mut(id)
      .ok_or_else(|| FrameworkError::NotFound(format!("job not found: {id}")))?;

    if matches!(record.state, JobState::Succeeded | JobState::Failed | JobState::Cancelled) {
      return Err(FrameworkError::Conflict(format!(
        "cannot transition terminal job {} from {:?}",
        record.id, record.state
      )));
    }

    record.state = state;
    record.stage = stage.trim().to_string();
    Ok(record.clone())
  }

  fn lock_jobs(&self) -> Result<MutexGuard<'_, HashMap<String, JobRecord>>> {
    self
      .jobs
      .lock()
      .map_err(|_| FrameworkError::Internal("job store lock poisoned".to_string()))
  }
}

#[cfg(test)]
mod tests {
  use super::{JobService, JobState};

  #[test]
  fn job_service_tracks_lifecycle_transitions() {
    let jobs = JobService::new();
    let id = jobs.submit("process.spawn").expect("job id");

    assert_eq!(jobs.get(&id).expect("queued").state, JobState::Queued);

    jobs.mark_running(&id, "starting").expect("running");
    assert_eq!(jobs.get(&id).expect("running").state, JobState::Running);

    jobs.cancel(&id).expect("cancel");
    assert_eq!(jobs.get(&id).expect("cancelled").state, JobState::Cancelled);
  }

  #[test]
  fn job_service_marks_jobs_succeeded() {
    let jobs = JobService::new();
    let id = jobs.submit("process.spawn").expect("job id");
    jobs.mark_running(&id, "running").expect("running");

    let record = jobs.mark_succeeded(&id, "finished").expect("succeeded");

    assert_eq!(record.state, JobState::Succeeded);
    assert_eq!(record.stage, "finished");
  }

  #[test]
  fn job_service_marks_jobs_failed() {
    let jobs = JobService::new();
    let id = jobs.submit("process.spawn").expect("job id");
    jobs.mark_running(&id, "running").expect("running");

    let record = jobs.mark_failed(&id, "process failed").expect("failed");

    assert_eq!(record.state, JobState::Failed);
    assert_eq!(record.stage, "process failed");
  }
}
