# Claw Studio Tauri Job Process Orchestration Design

## Goal
- Turn the current desktop `job` and `process` primitives into a real orchestration flow that future runtime detection, installer work, sandbox execution, and Codex integration can reuse.
- Keep the current Tauri command names stable while introducing a preferred orchestrated entrypoint for native execution work.
- Replace free-form process submission with static command profiles and real cancellation semantics.

## Current Gaps
- `JobService` is an in-memory lifecycle tracker with no relationship to running processes.
- `ProcessService` can capture output, but it cannot register active child handles or support external cancellation.
- `job_cancel` only updates state; it does not attempt to stop a running native process.
- The TypeScript runtime bridge exposes event subscriptions only and does not surface orchestration commands.

## Recommended Direction

### Add a Preferred Orchestration Command
- Preserve:
  - `job_submit`
  - `job_get`
  - `job_list`
  - `job_cancel`
  - `process_run_capture`
- Add a new preferred command: `job_submit_process`.
- `job_submit_process` becomes the standard native entrypoint for execution work that needs:
  - a stable job id
  - lifecycle state
  - output streaming
  - cancellation

### Replace Free-Form Native Execution with Static Profiles
- Do not expose arbitrary command strings through `job_submit_process`.
- Add static process profiles in Rust, each with:
  - `id`
  - `job_kind`
  - `command`
  - `args`
  - `default_timeout_ms`
  - `allow_cancellation`
- First-pass profiles remain intentionally small and controlled.
- The process policy layer still validates the resolved executable plan before execution.

### Bind Jobs to Processes
- Extend `JobRecord` with:
  - `profile_id: Option<String>`
  - `process_id: Option<String>`
- Extend `ProcessOutputEvent` with:
  - `job_id: Option<String>`
- This keeps event names stable while allowing the frontend to correlate output with job lifecycle updates.

### Add a Process Registry
- `ProcessService` owns a lightweight active-process registry.
- Registry responsibilities:
  - map `process_id -> running child handle`
  - support cancellation by process id
  - remove entries once execution finishes
- `JobService` remains the lifecycle authority, but it can now be driven by real process execution instead of independent state changes.

### Cancellation Semantics
- `job_submit_process`:
  - creates a `queued` job
  - launches background execution
  - transitions to `running`
  - ends in `succeeded`, `failed`, or `cancelled`
- `job_cancel`:
  - if the job has no process id yet, mark it `cancelled`
  - if the job has an active process id, ask `ProcessService` to kill the child process
  - preserve state consistency even if process termination is best-effort

## Bridge Impact
- Extend runtime contracts and the desktop Tauri bridge with:
  - `submitProcessJob(profileId)`
  - `getJob(id)`
  - `listJobs()`
  - `cancelJob(id)`
- Web runtime keeps noop or error-safe fallbacks so cross-platform code stays stable.

## Testing Strategy
- Rust tests:
  - submitting a process job creates lifecycle transitions driven by real execution
  - cancelling a running process job moves it to `cancelled`
  - job records retain `profile_id` and `process_id`
  - process output events retain `job_id`
  - unknown profiles are rejected
- TypeScript checks:
  - updated runtime contracts compile
  - desktop bridge exposes the new runtime methods

## Out of Scope
- Dynamic user-defined command profiles
- Arbitrary command payload builders
- Full installer/runtime manager feature set
- UI wiring of the new runtime APIs into pages or stores
