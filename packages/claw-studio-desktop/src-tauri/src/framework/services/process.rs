use crate::framework::{events, policy, runtime, FrameworkError, Result};
use std::{
  io::{BufRead, BufReader, Read},
  path::PathBuf,
  process::{Child, Command, ExitStatus, Stdio},
  sync::{
    atomic::{AtomicU64, Ordering},
    mpsc,
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

#[derive(Clone, Debug, Default)]
pub struct ProcessService;

impl ProcessService {
  pub fn new() -> Self {
    Self
  }

  #[allow(dead_code)]
  pub fn run_capture(&self, request: ProcessRequest) -> Result<ProcessResult> {
    self.run_capture_with_sink(request, &NoopProcessEventSink)
  }

  pub fn run_capture_and_emit<S: ProcessEventSink>(&self, request: ProcessRequest, sink: &S) -> Result<ProcessResult> {
    self.run_capture_with_sink(request, sink)
  }

  fn run_capture_with_sink<S: ProcessEventSink>(&self, request: ProcessRequest, sink: &S) -> Result<ProcessResult> {
    let command = request.command.trim().to_string();
    if command.is_empty() {
      return Err(FrameworkError::ValidationFailed(
        "command must not be empty".to_string(),
      ));
    }

    policy::validate_command_spawn(&command, &request.args)?;
    policy::validate_working_directory(request.cwd.as_deref())?;
    let command_display = format_command(&command, &request.args);
    let process_id = next_process_id();

    runtime::run_blocking("process.run_capture", || {
      let mut process = Command::new(&command);
      process.args(&request.args);
      process.stdout(Stdio::piped());
      process.stderr(Stdio::piped());

      if let Some(cwd) = request.cwd.as_ref() {
        process.current_dir(cwd);
      }

      let child = process.spawn()?;
      let (status, stdout, stderr) =
        wait_for_completion(child, &process_id, &command_display, request.timeout_ms, sink)?;

      map_result(status, &process_id, stdout, stderr, &command_display)
    })
  }
}

fn wait_for_completion<S: ProcessEventSink>(
  mut child: Child,
  process_id: &str,
  command: &str,
  timeout_ms: Option<u64>,
  sink: &S,
) -> Result<(ExitStatus, String, String)> {
  let (sender, receiver) = mpsc::channel();
  let stdout_reader = child
    .stdout
    .take()
    .map(|stdout| spawn_output_reader(stdout, ProcessOutputStream::Stdout, sender.clone()));
  let stderr_reader = child
    .stderr
    .take()
    .map(|stderr| spawn_output_reader(stderr, ProcessOutputStream::Stderr, sender.clone()));
  drop(sender);

  let timeout = timeout_ms.map(Duration::from_millis);
  let started_at = Instant::now();
  let mut stdout = String::new();
  let mut stderr = String::new();

  loop {
    drain_output_events(&receiver, process_id, command, sink, &mut stdout, &mut stderr, true)?;

    if let Some(status) = child.try_wait()? {
      let reader_results = finish_output_readers(stdout_reader, stderr_reader)?;
      drain_output_events(&receiver, process_id, command, sink, &mut stdout, &mut stderr, false)?;
      reader_results?;
      return Ok((status, stdout, stderr));
    }

    if let Some(timeout) = timeout {
      if started_at.elapsed() >= timeout {
        let _ = child.kill();
        let _ = child.wait();
        let reader_results = finish_output_readers(stdout_reader, stderr_reader)?;
        drain_output_events(&receiver, process_id, command, sink, &mut stdout, &mut stderr, false)?;
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
  process_id: &str,
  command: &str,
  sink: &S,
  stdout: &mut String,
  stderr: &mut String,
  wait_for_one: bool,
) -> Result<()> {
  if wait_for_one {
    match receiver.recv_timeout(Duration::from_millis(10)) {
      Ok(message) => handle_output_message(message, process_id, command, sink, stdout, stderr)?,
      Err(mpsc::RecvTimeoutError::Timeout) => return Ok(()),
      Err(mpsc::RecvTimeoutError::Disconnected) => return Ok(()),
    }
  }

  while let Ok(message) = receiver.try_recv() {
    handle_output_message(message, process_id, command, sink, stdout, stderr)?;
  }

  Ok(())
}

fn handle_output_message<S: ProcessEventSink>(
  message: OutputMessage,
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
    process_id: process_id.to_string(),
    command: command.to_string(),
    stream: message.stream,
    chunk: message.chunk,
  })
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

#[cfg(test)]
mod tests {
  use super::{
    ProcessEventSink,
    ProcessOutputEvent,
    ProcessOutputStream,
    ProcessRequest,
    ProcessService,
  };
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
    let service = ProcessService::new();
    let result = service.run_capture(test_echo_request()).expect("process result");

    assert!(result.stdout.contains("desktop-kernel"));
    assert_eq!(result.exit_code, Some(0));
    assert!(result.process_id.starts_with("process-"));
  }

  #[test]
  fn emits_stdout_events_with_matching_process_id() {
    let service = ProcessService::new();
    let sink = TestProcessEventSink::default();

    let result = service
      .run_capture_and_emit(test_echo_request(), &sink)
      .expect("process result");
    let events = sink.emitted();

    assert!(!events.is_empty());
    assert!(events.iter().any(|event| event.stream == ProcessOutputStream::Stdout));
    assert!(events.iter().any(|event| event.chunk.contains("desktop-kernel")));
    assert!(events.iter().all(|event| event.process_id == result.process_id));
  }

  #[test]
  fn times_out_long_running_processes() {
    let service = ProcessService::new();
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
