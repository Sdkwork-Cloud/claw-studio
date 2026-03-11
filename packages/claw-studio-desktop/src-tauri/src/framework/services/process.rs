use crate::framework::{events, policy::ExecutionPolicy, runtime, FrameworkError, Result};
use std::{
  collections::HashMap,
  ffi::OsString,
  io::{BufRead, BufReader, Read},
  path::PathBuf,
  process::{Child, Command, ExitStatus, Stdio},
  sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    mpsc, Arc, Mutex, MutexGuard,
  },
  thread,
  time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Runtime};

static NEXT_PROCESS_ID: AtomicU64 = AtomicU64::new(1);

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
  pub process_id: String,
  pub stdout: String,
  pub stderr: String,
  pub exit_code: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProcessOutputStream {
  Stdout,
  Stderr,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessOutputEvent {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub job_id: Option<String>,
  pub process_id: String,
  pub command: String,
  pub stream: ProcessOutputStream,
  pub chunk: String,
}

pub trait ProcessEventSink {
  fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()>;
}

impl<R: Runtime> ProcessEventSink for AppHandle<R> {
  fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()> {
    self.emit(events::PROCESS_OUTPUT, payload).map_err(FrameworkError::from)
  }
}

#[allow(dead_code)]
struct NoopProcessEventSink;

impl ProcessEventSink for NoopProcessEventSink {
  fn emit_process_output(&self, _payload: ProcessOutputEvent) -> Result<()> {
    Ok(())
  }
}

#[derive(Clone, Debug)]
pub struct ProcessService {
  policy: ExecutionPolicy,
  active_processes: Arc<Mutex<HashMap<String, ActiveProcessHandle>>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct ValidatedProcessRequest {
  command: String,
  args: Vec<String>,
  cwd: PathBuf,
  timeout_ms: Option<u64>,
  env: Vec<(OsString, OsString)>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProcessProfile {
  pub id: String,
  pub job_kind: String,
  command: String,
  args: Vec<String>,
  default_timeout_ms: u64,
  allow_cancellation: bool,
}

#[derive(Clone, Debug)]
struct ActiveProcessHandle {
  child: Arc<Mutex<Child>>,
  cancellation_requested: Arc<AtomicBool>,
  allow_cancellation: bool,
}

impl ProcessService {
  pub fn new(policy: ExecutionPolicy) -> Self {
    Self {
      policy,
      active_processes: Arc::new(Mutex::new(HashMap::new())),
    }
  }

  #[allow(dead_code)]
  pub fn run_capture(&self, request: ProcessRequest) -> Result<ProcessResult> {
    self.run_capture_with_sink(request, &NoopProcessEventSink)
  }

  pub fn run_capture_and_emit<S: ProcessEventSink>(&self, request: ProcessRequest, sink: &S) -> Result<ProcessResult> {
    self.run_capture_with_sink(request, sink)
  }

  pub fn resolve_profile(&self, profile_id: &str) -> Result<ProcessProfile> {
    let normalized = profile_id.trim();
    if normalized.is_empty() {
      return Err(FrameworkError::ValidationFailed(
        "process profile id must not be empty".to_string(),
      ));
    }

    let profile = match normalized {
      "diagnostics.echo" => test_echo_profile(),
      "diagnostics.wait" => test_wait_profile(),
      _ => {
        return Err(FrameworkError::NotFound(format!(
          "process profile not found: {normalized}"
        )))
      }
    };

    Ok(profile)
  }

  #[allow(dead_code)]
  pub fn run_profile_and_emit<S: ProcessEventSink>(
    &self,
    profile_id: &str,
    job_id: Option<String>,
    process_id: Option<String>,
    sink: &S,
  ) -> Result<ProcessResult> {
    self.run_profile_and_emit_with_started(profile_id, job_id, process_id, sink, |_| Ok(()))
  }

  pub fn run_profile_and_emit_with_started<S, F>(
    &self,
    profile_id: &str,
    job_id: Option<String>,
    process_id: Option<String>,
    sink: &S,
    on_started: F,
  ) -> Result<ProcessResult>
  where
    S: ProcessEventSink,
    F: FnOnce(&str) -> Result<()>,
  {
    let profile = self.resolve_profile(profile_id)?;
    let request = ProcessRequest {
      command: profile.command,
      args: profile.args,
      cwd: None,
      timeout_ms: Some(profile.default_timeout_ms),
    };
    let validated = self.prepare_request(request)?;
    let process_id = process_id.unwrap_or_else(next_process_id);

    self.run_validated_with_sink(
      validated,
      process_id,
      job_id,
      profile.allow_cancellation,
      sink,
      on_started,
    )
  }

  pub fn cancel(&self, process_id: &str) -> Result<()> {
    let handle = self
      .lock_active_processes()?
      .get(process_id)
      .cloned()
      .ok_or_else(|| FrameworkError::NotFound(format!("process not found: {process_id}")))?;

    if !handle.allow_cancellation {
      return Err(FrameworkError::PolicyDenied {
        resource: process_id.to_string(),
        reason: "process profile does not allow cancellation".to_string(),
      });
    }

    handle.cancellation_requested.store(true, Ordering::Relaxed);
    let mut child = handle
      .child
      .lock()
      .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
    if child.try_wait()?.is_none() {
      child.kill()?;
    }

    Ok(())
  }

  fn run_capture_with_sink<S: ProcessEventSink>(&self, request: ProcessRequest, sink: &S) -> Result<ProcessResult> {
    let validated = self.prepare_request(request)?;
    self.run_validated_with_sink(validated, next_process_id(), None, true, sink, |_| Ok(()))
  }

  fn prepare_request(&self, request: ProcessRequest) -> Result<ValidatedProcessRequest> {
    self.prepare_request_with_env(request, std::env::vars_os())
  }

  fn prepare_request_with_env<I>(&self, request: ProcessRequest, env: I) -> Result<ValidatedProcessRequest>
  where
    I: IntoIterator<Item = (OsString, OsString)>,
  {
    let command = request.command.trim().to_string();
    if command.is_empty() {
      return Err(FrameworkError::ValidationFailed(
        "command must not be empty".to_string(),
      ));
    }

    self.policy.validate_command_spawn(&command, &request.args)?;
    let cwd = self.policy.resolve_working_directory(request.cwd.as_deref())?;
    let env = self.policy.sanitize_environment(env);

    Ok(ValidatedProcessRequest {
      command,
      args: request.args,
      cwd,
      timeout_ms: request.timeout_ms,
      env,
    })
  }

  fn run_validated_with_sink<S, F>(
    &self,
    validated: ValidatedProcessRequest,
    process_id: String,
    job_id: Option<String>,
    allow_cancellation: bool,
    sink: &S,
    on_started: F,
  ) -> Result<ProcessResult>
  where
    S: ProcessEventSink,
    F: FnOnce(&str) -> Result<()>,
  {
    let command_display = format_command(&validated.command, &validated.args);
    let service = self.clone();

    runtime::run_blocking("process.run_capture", move || {
      let mut process = Command::new(&validated.command);
      process.args(&validated.args);
      process.stdout(Stdio::piped());
      process.stderr(Stdio::piped());
      process.current_dir(&validated.cwd);
      process.env_clear();
      process.envs(validated.env.iter().cloned());

      let mut child = process.spawn()?;
      let stdout = child
        .stdout
        .take()
        .map(|stdout| Box::new(stdout) as Box<dyn Read + Send>);
      let stderr = child
        .stderr
        .take()
        .map(|stderr| Box::new(stderr) as Box<dyn Read + Send>);
      let child = Arc::new(Mutex::new(child));
      let cancellation_requested = Arc::new(AtomicBool::new(false));

      service.register_active_process(
        process_id.clone(),
        ActiveProcessHandle {
          child: child.clone(),
          cancellation_requested: cancellation_requested.clone(),
          allow_cancellation,
        },
      )?;

      if let Err(error) = on_started(&process_id) {
        let _ = kill_child(&child);
        let _ = wait_child(&child);
        let _ = service.unregister_active_process(&process_id);
        return Err(error);
      }

      let wait_result = wait_for_completion(
        child,
        stdout,
        stderr,
        &job_id,
        &process_id,
        &command_display,
        validated.timeout_ms,
        sink,
      );

      let cleanup_result = service.unregister_active_process(&process_id);
      let was_cancelled = cancellation_requested.load(Ordering::Relaxed);

      cleanup_result?;

      if was_cancelled {
        return Err(FrameworkError::Cancelled(format!(
          "process cancelled: {command_display}"
        )));
      }

      let (status, stdout, stderr) = wait_result?;
      map_result(status, &process_id, stdout, stderr, &command_display)
    })
  }

  fn register_active_process(&self, process_id: String, handle: ActiveProcessHandle) -> Result<()> {
    self.lock_active_processes()?.insert(process_id, handle);
    Ok(())
  }

  fn unregister_active_process(&self, process_id: &str) -> Result<()> {
    self.lock_active_processes()?.remove(process_id);
    Ok(())
  }

  fn lock_active_processes(&self) -> Result<MutexGuard<'_, HashMap<String, ActiveProcessHandle>>> {
    self
      .active_processes
      .lock()
      .map_err(|_| FrameworkError::Internal("active process registry lock poisoned".to_string()))
  }
}

fn wait_for_completion<S: ProcessEventSink>(
  child: Arc<Mutex<Child>>,
  stdout_pipe: Option<Box<dyn Read + Send>>,
  stderr_pipe: Option<Box<dyn Read + Send>>,
  job_id: &Option<String>,
  process_id: &str,
  command: &str,
  timeout_ms: Option<u64>,
  sink: &S,
) -> Result<(ExitStatus, String, String)> {
  let (sender, receiver) = mpsc::channel();
  let stdout_reader = stdout_pipe.map(|stdout| spawn_output_reader(stdout, ProcessOutputStream::Stdout, sender.clone()));
  let stderr_reader = stderr_pipe.map(|stderr| spawn_output_reader(stderr, ProcessOutputStream::Stderr, sender.clone()));
  drop(sender);

  let timeout = timeout_ms.map(Duration::from_millis);
  let started_at = Instant::now();
  let mut stdout = String::new();
  let mut stderr = String::new();

  loop {
    drain_output_events(&receiver, job_id, process_id, command, sink, &mut stdout, &mut stderr, true)?;

    if let Some(status) = try_wait_child(&child)? {
      let reader_results = finish_output_readers(stdout_reader, stderr_reader)?;
      drain_output_events(&receiver, job_id, process_id, command, sink, &mut stdout, &mut stderr, false)?;
      reader_results?;
      return Ok((status, stdout, stderr));
    }

    if let Some(timeout) = timeout {
      if started_at.elapsed() >= timeout {
        kill_child(&child)?;
        let _ = wait_child(&child);
        let reader_results = finish_output_readers(stdout_reader, stderr_reader)?;
        drain_output_events(&receiver, job_id, process_id, command, sink, &mut stdout, &mut stderr, false)?;
        let _ = reader_results;
        return Err(FrameworkError::Timeout(format!(
          "process timed out after {}ms: {}",
          timeout.as_millis(),
          command
        )));
      }
    }

    thread::sleep(Duration::from_millis(10));
  }
}

fn spawn_output_reader<T: Read + Send + 'static>(
  reader: T,
  stream: ProcessOutputStream,
  sender: mpsc::Sender<OutputMessage>,
) -> thread::JoinHandle<Result<()>> {
  thread::spawn(move || {
    let mut reader = BufReader::new(reader);
    let mut buffer = Vec::new();

    loop {
      buffer.clear();
      let bytes_read = reader.read_until(b'\n', &mut buffer)?;
      if bytes_read == 0 {
        break;
      }

      let chunk = String::from_utf8_lossy(&buffer).into_owned();
      sender
        .send(OutputMessage {
          stream: stream.clone(),
          chunk,
        })
        .map_err(|_| FrameworkError::Internal("process output channel closed".to_string()))?;
    }

    Ok(())
  })
}

fn finish_output_readers(
  stdout_reader: Option<thread::JoinHandle<Result<()>>>,
  stderr_reader: Option<thread::JoinHandle<Result<()>>>,
) -> Result<Result<()>> {
  let stdout_result = join_output_reader(stdout_reader)?;
  let stderr_result = join_output_reader(stderr_reader)?;

  Ok(stdout_result.and(stderr_result))
}

fn join_output_reader(handle: Option<thread::JoinHandle<Result<()>>>) -> Result<Result<()>> {
  let Some(handle) = handle else {
    return Ok(Ok(()));
  };

  handle
    .join()
    .map_err(|_| FrameworkError::Internal("process output reader panicked".to_string()))
}

fn drain_output_events<S: ProcessEventSink>(
  receiver: &mpsc::Receiver<OutputMessage>,
  job_id: &Option<String>,
  process_id: &str,
  command: &str,
  sink: &S,
  stdout: &mut String,
  stderr: &mut String,
  wait_for_one: bool,
) -> Result<()> {
  if wait_for_one {
    match receiver.recv_timeout(Duration::from_millis(10)) {
      Ok(message) => handle_output_message(message, job_id, process_id, command, sink, stdout, stderr)?,
      Err(mpsc::RecvTimeoutError::Timeout) => return Ok(()),
      Err(mpsc::RecvTimeoutError::Disconnected) => return Ok(()),
    }
  }

  while let Ok(message) = receiver.try_recv() {
    handle_output_message(message, job_id, process_id, command, sink, stdout, stderr)?;
  }

  Ok(())
}

fn handle_output_message<S: ProcessEventSink>(
  message: OutputMessage,
  job_id: &Option<String>,
  process_id: &str,
  command: &str,
  sink: &S,
  stdout: &mut String,
  stderr: &mut String,
) -> Result<()> {
  match message.stream {
    ProcessOutputStream::Stdout => stdout.push_str(&message.chunk),
    ProcessOutputStream::Stderr => stderr.push_str(&message.chunk),
  }

  sink.emit_process_output(ProcessOutputEvent {
    job_id: job_id.clone(),
    process_id: process_id.to_string(),
    command: command.to_string(),
    stream: message.stream,
    chunk: message.chunk,
  })
}

fn try_wait_child(child: &Arc<Mutex<Child>>) -> Result<Option<ExitStatus>> {
  let mut child = child
    .lock()
    .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
  child.try_wait().map_err(FrameworkError::from)
}

fn kill_child(child: &Arc<Mutex<Child>>) -> Result<()> {
  let mut child = child
    .lock()
    .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
  if child.try_wait()?.is_none() {
    child.kill()?;
  }

  Ok(())
}

fn wait_child(child: &Arc<Mutex<Child>>) -> Result<ExitStatus> {
  let mut child = child
    .lock()
    .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
  child.wait().map_err(FrameworkError::from)
}

fn map_result(
  status: ExitStatus,
  process_id: &str,
  stdout: String,
  stderr: String,
  command: &str,
) -> Result<ProcessResult> {
  let exit_code = status.code();

  if status.success() {
    return Ok(ProcessResult {
      process_id: process_id.to_string(),
      stdout,
      stderr,
      exit_code,
    });
  }

  Err(FrameworkError::ProcessFailed {
    command: command.to_string(),
    exit_code,
    stderr_tail: trim_stderr(&stderr),
  })
}

#[derive(Debug)]
struct OutputMessage {
  stream: ProcessOutputStream,
  chunk: String,
}

fn next_process_id() -> String {
  format!("process-{}", NEXT_PROCESS_ID.fetch_add(1, Ordering::Relaxed))
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
  use super::{
    ProcessEventSink,
    ProcessOutputEvent,
    ProcessOutputStream,
    ProcessRequest,
    ProcessService,
  };
  use crate::framework::{paths::resolve_paths_for_root, policy::ExecutionPolicy};
  use crate::framework::{FrameworkError, Result};
  use std::sync::{Arc, Mutex};

  #[derive(Clone, Default)]
  struct TestProcessEventSink {
    events: Arc<Mutex<Vec<ProcessOutputEvent>>>,
  }

  impl TestProcessEventSink {
    fn emitted(&self) -> Vec<ProcessOutputEvent> {
      self.events.lock().expect("event lock").clone()
    }
  }

  impl ProcessEventSink for TestProcessEventSink {
    fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()> {
      self.events.lock().expect("event lock").push(payload);
      Ok(())
    }
  }

  #[test]
  fn runs_controlled_process_and_captures_stdout() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));
    let result = service.run_capture(test_echo_request()).expect("process result");

    assert!(result.stdout.contains("desktop-kernel"));
    assert_eq!(result.exit_code, Some(0));
    assert!(result.process_id.starts_with("process-"));
  }

  #[test]
  fn emits_stdout_events_with_matching_process_id() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));
    let sink = TestProcessEventSink::default();

    let result = service
      .run_capture_and_emit(test_echo_request(), &sink)
      .expect("process result");
    let events = sink.emitted();

    assert!(!events.is_empty());
    assert!(events.iter().any(|event| event.stream == ProcessOutputStream::Stdout));
    assert!(events.iter().any(|event| event.chunk.contains("desktop-kernel")));
    assert!(events.iter().all(|event| event.process_id == result.process_id));
    assert!(events.iter().all(|event| event.job_id.is_none()));
  }

  #[test]
  fn times_out_long_running_processes() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));
    let error = service
      .run_capture(test_sleep_request(50))
      .expect_err("process should time out");

    match error {
      FrameworkError::Timeout(message) => {
        assert!(message.contains("timed out"));
      }
      other => panic!("expected timeout error, got {other}"),
    }
  }

  #[test]
  fn defaults_missing_cwd_to_managed_data_dir() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));

    let validated = service
      .prepare_request_with_env(test_echo_request(), Vec::new())
      .expect("validated request");

    assert_eq!(validated.cwd, std::fs::canonicalize(&paths.data_dir).expect("canonical data dir"));
  }

  #[test]
  fn strips_disallowed_environment_variables_before_spawn() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));

    let validated = service
      .prepare_request_with_env(
        test_echo_request(),
        vec![
          (std::ffi::OsString::from("PATH"), std::ffi::OsString::from("path-value")),
          (std::ffi::OsString::from("SECRET_TOKEN"), std::ffi::OsString::from("hidden")),
          #[cfg(windows)]
          (std::ffi::OsString::from("SystemRoot"), std::ffi::OsString::from("C:\\Windows")),
          #[cfg(not(windows))]
          (std::ffi::OsString::from("LANG"), std::ffi::OsString::from("en_US.UTF-8")),
        ],
      )
      .expect("validated request");

    assert!(validated.env.iter().any(|(key, _)| key == "PATH"));
    assert!(!validated.env.iter().any(|(key, _)| key == "SECRET_TOKEN"));
  }

  #[test]
  fn resolves_known_process_profiles() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));

    let profile = service.resolve_profile("diagnostics.echo").expect("profile");

    assert_eq!(profile.id, "diagnostics.echo");
    assert_eq!(profile.job_kind, "process.diagnostics");
  }

  #[test]
  fn rejects_unknown_process_profiles() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));

    let error = service
      .resolve_profile("missing.profile")
      .expect_err("unknown profile should fail");

    assert!(error.to_string().contains("process profile not found"));
  }

  #[test]
  fn emits_process_events_with_job_id_when_supplied() {
    let root = tempfile::tempdir().expect("temp dir");
    let paths = resolve_paths_for_root(root.path()).expect("paths");
    let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));
    let sink = TestProcessEventSink::default();

    let result = service
      .run_profile_and_emit(
        "diagnostics.echo",
        Some("job-123".to_string()),
        Some("process-777".to_string()),
        &sink,
      )
      .expect("process result");
    let events = sink.emitted();

    assert_eq!(result.process_id, "process-777");
    assert!(events.iter().any(|event| event.job_id.as_deref() == Some("job-123")));
    assert!(events.iter().all(|event| event.process_id == "process-777"));
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

  #[cfg(windows)]
  fn test_sleep_request(timeout_ms: u64) -> ProcessRequest {
    ProcessRequest {
      command: "cmd".to_string(),
      args: vec![
        "/C".to_string(),
        "ping -n 3 127.0.0.1 >nul".to_string(),
      ],
      cwd: None,
      timeout_ms: Some(timeout_ms),
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

  #[cfg(not(windows))]
  fn test_sleep_request(timeout_ms: u64) -> ProcessRequest {
    ProcessRequest {
      command: "sh".to_string(),
      args: vec!["-c".to_string(), "sleep 2".to_string()],
      cwd: None,
      timeout_ms: Some(timeout_ms),
    }
  }
}
