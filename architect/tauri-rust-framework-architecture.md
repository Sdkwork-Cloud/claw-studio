# Tauri Rust Framework Architecture

## Goals

Build a reusable, framework-level Rust + Tauri foundation in `src-tauri` with:

- High cohesion: business capabilities are organized in services.
- Low coupling: Tauri commands are thin protocol adapters only.
- Replaceable implementations: every major capability is behind a trait.
- Consistent execution model: blocking work goes through `run_blocking`.
- Consistent error model: all services return `FrameworkResult<T>`.

## Layered Structure

```text
src-tauri/src/
  framework/
    context.rs             # AppContext DI container
    error.rs               # FrameworkError / FrameworkResult
    runtime.rs             # run_blocking wrapper
    services/
      system.rs            # OS/shell/runtime/command discovery
      filesystem.rs        # local FS abstraction
      media.rs             # ffmpeg/ffprobe execution
      compression.rs       # zip/unzip abstraction
      database.rs          # sqlite abstraction
      toolkit.rs           # image/video/audio/recording unified toolkit
      jobs.rs              # async local job orchestration
      pty.rs               # terminal capability abstraction
      browser.rs           # in-app browser bridge
  commands/
    *_commands.rs          # thin Tauri command adapters
```

## AppContext Composition

`AppContext::default()` wires all runtime dependencies:

1. `SystemService` + `PolicyService` + `FileSystemService`
2. `MediaService` + `CompressionService` + `DatabaseService` + `MigrationService`
3. `ToolkitService` (composes media/compression/fs/system/policy)
4. `JobService` (depends on toolkit)
5. `PtyService` + `BrowserService`

This enables replacing any implementation without changing command APIs.

## Capability Matrix

Framework capabilities now include:

- System runtime introspection and command availability checks.
- Local file system primitives (ensure/read/write/exists).
- Media processing via ffmpeg/ffprobe.
- Compression and archive handling.
- SQLite data persistence (bundled rusqlite).
- SQLite migration governance (`MigrationService` with idempotent version apply).
- Toolkit operations for image/video/audio/recording flows.
- Long-running job orchestration (submit/get/list/cancel).
- Real-time job state events (`job:updated`) for frontend progress sync.
- Runtime cancellation for ffmpeg-based jobs via process kill.
- Security policy validation for path and command access.

## Command Mapping

### Existing core commands

- `media_ffmpeg_available` -> `MediaService::ffmpeg_available`
- `media_ffmpeg_exec` -> `MediaService::ffmpeg_exec`
- `media_ffprobe_json` -> `MediaService::ffprobe_json`
- `db_execute` -> `DatabaseService::execute`
- `db_query` -> `DatabaseService::query`
- `db_execute_batch` -> `DatabaseService::execute_batch`
- `migration_status` -> `MigrationService::status`
- `migration_apply` -> `MigrationService::apply`
- `native_unzip` -> `CompressionService::unzip`
- `native_zip_bytes` -> `CompressionService::zip_bytes`
- `create_pty` / `start_pty` / `write_pty` / `resize_pty` / `kill_pty` / `sync_pty_sessions`
- `browser_new_tab_request` / `browser_is_supported`

### New framework commands

- `system_runtime_info`
- `system_command_exists`
- `fs_ensure_dir`
- `fs_exists`
- `fs_read_string`
- `fs_read_bytes`
- `fs_write_bytes`
- `toolkit_capabilities`
- `toolkit_execute`
- `job_submit_toolkit`
- `job_get`
- `job_list`
- `job_cancel`
- `migration_status`
- `migration_apply`
- `policy_validate_path`
- `policy_validate_command`
- `policy_snapshot`

## Why This Is Framework-Grade

- Stable external protocol: command signatures are isolated from internals.
- Internal modularity: each capability is testable and replaceable.
- Reusability: same services can be reused by multiple commands and jobs.
- Operational consistency: unified error and background execution semantics.
- Extensibility: new capability domains only require `service + context + command`.

## Job Progress and Cancellation

- `JobService` emits `job:updated` whenever state/progress/stage changes.
- Toolkit execution receives `ToolkitExecutionContext`:
  - cancellation signal (`AtomicBool`)
  - progress callback (`ToolkitProgressUpdate`)
- ffmpeg operations run through controlled execution:
  - stderr progress lines are parsed (`out_time=...`, `progress=end`)
  - progress is mapped into unified job progress.
  - cancellation triggers process kill and job transition to `Cancelled`.

## Suggested Next Iteration

1. Add fine-grained progress models for non-ffmpeg jobs (zip/database/file IO).
2. Add service-level unit tests for URL validation, DB conversion, toolkit ops, policy checks, and job cancellation race cases.
3. Add frontend SDK wrappers for policy validation and unified retry/cancel flows.
4. Add workflow orchestration layer (`WorkflowService`) based on blueprint P0.

## Industry Blueprint

For industry-oriented desktop capability planning and packaging priorities, see:

- `docs/tauri-industry-desktop-capability-blueprint.md`
