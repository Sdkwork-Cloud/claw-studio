# Tauri Rust Platform Kernel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current Tauri desktop Rust foundation into a reusable platform kernel with a unified execution model, service assembly, stronger policy enforcement, controlled process execution, and background job support.

**Architecture:** Keep `@sdkwork/claw-studio-desktop` as the only native package and preserve the current `app -> commands -> framework` direction, but move platform behavior behind `framework/runtime.rs` and `framework/services/*`. Refactor `FrameworkContext` into a real service assembly, keep commands thin, and add process/job/event primitives that future runtime, installer, sandbox, and Codex features can reuse.

**Tech Stack:** pnpm workspace, Tauri v2, Rust 2021, serde/serde_json, existing desktop foundation scripts, cargo unit tests

---

### Task 1: Extend the desktop architecture check for the platform kernel files

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\scripts\check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**
- Add assertions for these files:
  - `packages/claw-studio-desktop/src-tauri/src/framework/runtime.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/services/mod.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/services/system.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/services/jobs.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/services/browser.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/services/dialog.rs`
  - `packages/claw-studio-desktop/src-tauri/src/commands/process_commands.rs`
  - `packages/claw-studio-desktop/src-tauri/src/commands/job_commands.rs`
- Add string assertions that:
  - `framework/mod.rs` exports `runtime` and `services`
  - `context.rs` references `services`
  - `events.rs` contains `job://updated` and `process://output`

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the platform kernel files and exports do not exist yet.

**Step 3: Write minimal implementation**

```js
assertPath('packages/claw-studio-desktop/src-tauri/src/framework/runtime.rs', 'desktop runtime module');
assertPath('packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs', 'desktop process service');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/framework/events.rs', 'job://updated', 'job event constant');
```

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS after later tasks add the required files and exports.

**Step 5: Commit**

```bash
git add scripts/check-desktop-platform-foundation.mjs
git commit -m "test: extend desktop checks for platform kernel"
```

### Task 2: Add the runtime executor and service module assembly

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\runtime.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\context.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\state\mod.rs`

**Step 1: Write the failing test**
- Add unit tests for:
  - `runtime.rs`: blocking task wrapper returns a value
  - `state/mod.rs`: `AppState` holds a service-backed context

```rust
#[test]
fn run_blocking_returns_task_result() {
  let value = crate::framework::runtime::run_blocking("echo", || Ok::<_, crate::framework::FrameworkError>(41))
    .expect("blocking result");
  assert_eq!(value, 41);
}
```

```rust
#[test]
fn state_keeps_shared_framework_context() {
  let context = std::sync::Arc::new(test_context());
  let state = AppState::from_context(context.clone());
  assert!(std::sync::Arc::ptr_eq(&state.context, &context));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::runtime`
Expected: FAIL because `runtime.rs` and service-backed state do not exist yet.

**Step 3: Write minimal implementation**

```rust
pub fn run_blocking<T, F>(label: &'static str, task: F) -> crate::framework::Result<T>
where
  F: FnOnce() -> crate::framework::Result<T>,
{
  let _ = label;
  task()
}
```

```rust
pub mod services;
pub mod runtime;
```

```rust
#[derive(Clone)]
pub struct AppState {
  pub app_name: String,
  pub app_version: String,
  pub target: String,
  pub context: std::sync::Arc<FrameworkContext>,
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::runtime state::`
Expected: PASS for the new runtime and shared-context tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework/mod.rs packages/claw-studio-desktop/src-tauri/src/framework/runtime.rs packages/claw-studio-desktop/src-tauri/src/framework/context.rs packages/claw-studio-desktop/src-tauri/src/framework/services/mod.rs packages/claw-studio-desktop/src-tauri/src/state/mod.rs
git commit -m "feat: add platform kernel runtime and service assembly"
```

### Task 3: Upgrade the error and event models for platform work

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\error.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\events.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`

**Step 1: Write the failing test**
- Add unit tests that verify:
  - new error variants format stable messages
  - event constants exist for jobs and process output

```rust
#[test]
fn policy_denied_errors_render_path_reason() {
  let error = FrameworkError::PolicyDenied {
    resource: "command".to_string(),
    reason: "spawn is not allowed".to_string(),
  };
  assert!(error.to_string().contains("spawn is not allowed"));
}
```

```rust
#[test]
fn exposes_job_and_process_event_names() {
  assert_eq!(crate::framework::events::JOB_UPDATED, "job://updated");
  assert_eq!(crate::framework::events::PROCESS_OUTPUT, "process://output");
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::error framework::events`
Expected: FAIL because the new variants and constants do not exist yet.

**Step 3: Write minimal implementation**

```rust
pub enum FrameworkError {
  Io(io::Error),
  Serde(serde_json::Error),
  Tauri(tauri::Error),
  ValidationFailed(String),
  PolicyDenied { resource: String, reason: String },
  NotFound(String),
  Conflict(String),
  Timeout(String),
  Cancelled(String),
  ProcessFailed { command: String, exit_code: Option<i32>, stderr_tail: String },
  Internal(String),
}
```

```rust
pub const JOB_UPDATED: &str = "job://updated";
pub const PROCESS_OUTPUT: &str = "process://output";
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::error framework::events`
Expected: PASS for the new error and event tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework/error.rs packages/claw-studio-desktop/src-tauri/src/framework/events.rs packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: add platform error and event model"
```

### Task 4: Introduce service-backed system, browser, and dialog capabilities

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\system.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\browser.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\dialog.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\platform\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_system_info.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_device_id.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\open_external.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\select_files.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\save_blob_file.rs`

**Step 1: Write the failing test**
- Add service tests:
  - `SystemService` exposes target/arch/family
  - `BrowserService` rejects unsafe URLs
  - `DialogService` keeps the existing filename/default-path normalization behavior

```rust
#[test]
fn system_service_reports_platform_snapshot() {
  let service = SystemService::new();
  let snapshot = service.snapshot();
  assert!(!snapshot.os.is_empty());
  assert!(!snapshot.arch.is_empty());
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::services::system framework::services::browser framework::services::dialog`
Expected: FAIL because the service modules do not exist yet.

**Step 3: Write minimal implementation**

```rust
pub struct SystemService;

impl SystemService {
  pub fn new() -> Self { Self }

  pub fn snapshot(&self) -> SystemSnapshot {
    SystemSnapshot {
      os: crate::platform::current_target().to_string(),
      arch: crate::platform::current_arch().to_string(),
      family: crate::platform::current_family().to_string(),
    }
  }
}
```

```rust
pub struct BrowserService;

impl BrowserService {
  pub fn validate_url(&self, url: &str) -> crate::framework::Result<()> {
    super::super::policy::validate_url_open(url)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::services::system framework::services::browser framework::services::dialog`
Expected: PASS for the new service tests and existing dialog behavior tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework/services/system.rs packages/claw-studio-desktop/src-tauri/src/framework/services/browser.rs packages/claw-studio-desktop/src-tauri/src/framework/services/dialog.rs packages/claw-studio-desktop/src-tauri/src/commands/get_system_info.rs packages/claw-studio-desktop/src-tauri/src/commands/get_device_id.rs packages/claw-studio-desktop/src-tauri/src/commands/open_external.rs packages/claw-studio-desktop/src-tauri/src/commands/select_files.rs packages/claw-studio-desktop/src-tauri/src/commands/save_blob_file.rs packages/claw-studio-desktop/src-tauri/src/platform/mod.rs
git commit -m "feat: serviceize desktop system browser and dialog capabilities"
```

### Task 5: Harden policy and add a controlled process service

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\policy.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\process.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\process_commands.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\Cargo.toml`

**Step 1: Write the failing test**
- Add tests that verify:
  - policy rejects disallowed command spawns
  - process service captures stdout from a safe test command

```rust
#[test]
fn rejects_spawn_for_unknown_command() {
  let error = crate::framework::policy::validate_command_spawn("powershell", &["-Command", "Get-Process"])
    .expect_err("policy should deny unknown command");
  assert!(error.to_string().contains("not allowed"));
}
```

```rust
#[test]
fn runs_controlled_process_and_captures_stdout() {
  let service = ProcessService::new(default_policy());
  let result = service.run_capture(test_echo_request()).expect("process result");
  assert!(result.stdout.contains("desktop-kernel"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::policy framework::services::process`
Expected: FAIL because command-spawn policy and process service do not exist yet.

**Step 3: Write minimal implementation**

```rust
pub struct ProcessRequest {
  pub command: String,
  pub args: Vec<String>,
  pub cwd: Option<std::path::PathBuf>,
  pub timeout_ms: Option<u64>,
}
```

```rust
pub struct ProcessResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: Option<i32>,
}
```

```rust
pub fn validate_command_spawn(command: &str, _args: &[String]) -> crate::framework::Result<()> {
  let allowed = matches!(command, "cmd" | "cmd.exe" | "where" | "where.exe");
  if allowed {
    return Ok(());
  }
  Err(crate::framework::FrameworkError::PolicyDenied {
    resource: command.to_string(),
    reason: "command spawn is not allowed".to_string(),
  })
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::policy framework::services::process`
Expected: PASS for spawn policy and controlled process execution tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework/policy.rs packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs packages/claw-studio-desktop/src-tauri/src/commands/process_commands.rs packages/claw-studio-desktop/src-tauri/src/commands/mod.rs packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs packages/claw-studio-desktop/src-tauri/Cargo.toml
git commit -m "feat: add desktop process service and spawn policy"
```

### Task 6: Add background job orchestration and event-backed job commands

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\jobs.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\job_commands.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\context.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\events.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`

**Step 1: Write the failing test**
- Add tests that verify:
  - a submitted job starts as `queued`
  - the service can transition it to `running`
  - cancellation marks it `cancelled`

```rust
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
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::services::jobs`
Expected: FAIL because the job service does not exist yet.

**Step 3: Write minimal implementation**

```rust
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub enum JobState {
  Queued,
  Running,
  Succeeded,
  Failed,
  Cancelled,
}
```

```rust
#[derive(Clone, Debug, serde::Serialize)]
pub struct JobRecord {
  pub id: String,
  pub kind: String,
  pub state: JobState,
  pub stage: String,
}
```

```rust
pub struct JobService {
  jobs: std::sync::Mutex<std::collections::HashMap<String, JobRecord>>,
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::services::jobs`
Expected: PASS for job lifecycle tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework/services/jobs.rs packages/claw-studio-desktop/src-tauri/src/commands/job_commands.rs packages/claw-studio-desktop/src-tauri/src/framework/context.rs packages/claw-studio-desktop/src-tauri/src/framework/events.rs packages/claw-studio-desktop/src-tauri/src/commands/mod.rs packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: add desktop job service and commands"
```

### Task 7: Refactor existing filesystem and metadata commands onto the service-backed context

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\app_info.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_app_config.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_app_paths.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\list_directory.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\create_directory.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\remove_path.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\copy_path.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\move_path.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\path_exists.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_path_info.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\read_text_file.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\write_text_file.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\read_binary_file.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\write_binary_file.rs`

**Step 1: Write the failing test**
- Add or update command tests so commands read from `state.context` and return stable DTOs without directly reimplementing platform logic.

```rust
#[test]
fn app_info_reads_static_metadata_from_state() {
  let state = test_state();
  let info = app_info_from_state(&state);
  assert_eq!(info.name, "Claw Studio");
}
```

```rust
#[test]
fn filesystem_commands_use_context_backed_paths() {
  let state = test_state();
  write_text_file_at(&state.context.paths, "docs/plan.txt", "kernel").expect("write");
  assert_eq!(read_text_file_at(&state.context.paths, "docs/plan.txt").expect("read"), "kernel");
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml commands::`
Expected: FAIL while commands and tests still depend on the old state shape.

**Step 3: Write minimal implementation**
- Move command logic to service-backed access patterns.
- Keep external command names stable so the existing TypeScript bridge does not need a breaking rename in this phase.

```rust
pub fn app_info_from_state(state: &AppState) -> AppInfo {
  AppInfo {
    name: state.app_name.clone(),
    version: state.app_version.clone(),
    target: state.target.clone(),
  }
}
```

```rust
pub fn read_text_file(path: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
  state.context.filesystem.read_text(&path).map_err(|error| error.to_string())
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml commands::`
Expected: PASS with commands using shared services instead of duplicated logic.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/commands/app_info.rs packages/claw-studio-desktop/src-tauri/src/commands/get_app_config.rs packages/claw-studio-desktop/src-tauri/src/commands/get_app_paths.rs packages/claw-studio-desktop/src-tauri/src/commands/list_directory.rs packages/claw-studio-desktop/src-tauri/src/commands/create_directory.rs packages/claw-studio-desktop/src-tauri/src/commands/remove_path.rs packages/claw-studio-desktop/src-tauri/src/commands/copy_path.rs packages/claw-studio-desktop/src-tauri/src/commands/move_path.rs packages/claw-studio-desktop/src-tauri/src/commands/path_exists.rs packages/claw-studio-desktop/src-tauri/src/commands/get_path_info.rs packages/claw-studio-desktop/src-tauri/src/commands/read_text_file.rs packages/claw-studio-desktop/src-tauri/src/commands/write_text_file.rs packages/claw-studio-desktop/src-tauri/src/commands/read_binary_file.rs packages/claw-studio-desktop/src-tauri/src/commands/write_binary_file.rs
git commit -m "refactor: route desktop commands through platform services"
```

### Task 8: Verify the platform kernel end to end

**Files:**
- Verify only

**Step 1: Run Rust tests**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 2: Run architecture checks**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 3: Run TypeScript validation**

Run: `pnpm --filter @sdkwork/claw-studio-desktop lint`
Expected: PASS

**Step 4: Manual process and job smoke checks**
- Start the desktop shell in dev mode.
- Trigger one controlled process command and confirm:
  - request validation works
  - stdout or stderr is captured
  - exit code is recorded
- Trigger one job command and confirm:
  - `queued -> running -> succeeded` or `cancelled`
  - `job://updated` is emitted

**Step 5: Commit**

```bash
git add .
git commit -m "chore: verify desktop platform kernel"
```
