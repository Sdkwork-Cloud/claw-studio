pub const APP_READY: &str = "app://ready";
#[allow(dead_code)]
pub const APP_CONFIG_UPDATED: &str = "app://config-updated";
#[allow(dead_code)]
pub const APP_LOG_FLUSH: &str = "app://log-flush";
#[allow(dead_code)]
pub const JOB_UPDATED: &str = "job://updated";
#[allow(dead_code)]
pub const PROCESS_OUTPUT: &str = "process://output";

#[cfg(test)]
mod tests {
  #[test]
  fn exposes_job_and_process_event_names() {
    assert_eq!(super::JOB_UPDATED, "job://updated");
    assert_eq!(super::PROCESS_OUTPUT, "process://output");
  }
}
