# Claw Studio Tauri Rust Platform Kernel Design

## Goal
- Upgrade the current desktop Tauri Rust foundation from a working command set into a reusable platform kernel.
- Keep `@sdkwork/claw-studio-desktop` as the only native runtime package while making future runtime, installer, sandbox, updater, and Codex work depend on stable Rust service boundaries.
- Solve the current architectural gap where the app has basic filesystem, config, dialog, and opener capabilities but no unified execution model, no background jobs, no process control layer, and no platform-grade policy enforcement.

## Current State

### What already exists
- `src-tauri` has a usable startup skeleton in `app/bootstrap.rs`.
- `framework` already provides `paths`, `config`, `logging`, `events`, `policy`, `dialog`, and `filesystem`.
- `commands` already expose:
  - app/runtime metadata
  - file dialogs
  - external URL opening
  - managed filesystem operations
- The current desktop foundation passes:
  - `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
  - `node scripts/check-desktop-platform-foundation.mjs`
  - `node scripts/check-arch-boundaries.mjs`

### What is missing
- No `framework/runtime.rs` or unified `run_blocking` execution model.
- No `framework/services/*` layer that turns reusable functions into platform services.
- No `ProcessService` for controlled child process execution.
- No `JobService` for background tasks, cancellation, or progress reporting.
- No stable event model for long-running work.
- `policy.rs` only enforces path-level checks and is still based on lexical normalization rather than platform-grade capability policy.
- `state/mod.rs` stores startup snapshots only and does not expose an assembled service context.
- `commands/mod.rs` is already growing into a flat list of command files and will become brittle as more desktop capabilities land.

## Problems To Solve
- Commands are still one step away from becoming business logic containers.
- There is no safe, reusable foundation for future runtime, installer, sandbox, or agent execution features.
- Long-running or cancellable work cannot be expressed cleanly with the current synchronous invoke flow.
- Current path policy is too weak for a desktop app that will eventually spawn processes and manage runtimes.
- Error reporting is too coarse for platform operations such as timeouts, cancellations, process failures, or policy denials.

## Options Considered

### Option A: Keep extending the current command-by-command structure
- Continue adding new command files and helper functions as capabilities are needed.
- Lowest short-term cost.
- Rejected because it will keep logic fragmented across commands and block later platform work.

### Option B: Add a platform kernel under `framework/services` and keep commands thin
- Introduce a service layer, a unified runtime execution model, structured jobs, controlled process execution, stronger policy enforcement, and stable events.
- Keep the existing package structure and bridge contracts.
- Recommended because it strengthens the desktop kernel without forcing a full rewrite of the current foundation.

### Option C: Perform a full desktop Rust rewrite now
- Replace most current modules with the full target architecture from the earlier desktop platform design.
- Rejected because it adds too much risk while the current foundation is still stabilizing and the workspace already contains ongoing desktop changes.

## Recommended Design

### Architecture Direction
- Keep the existing high-level package layout:
  - `app`
  - `commands`
  - `framework`
  - `plugins`
  - `state`
- Turn `framework` into the actual platform kernel by adding:
  - `runtime.rs`
  - `services/mod.rs`
  - `services/system.rs`
  - `services/process.rs`
  - `services/jobs.rs`
  - `services/browser.rs`
  - `services/dialog.rs`
- Keep `commands` as protocol adapters only.
- Upgrade `FrameworkContext` into `AppContext`-style service assembly held by managed app state.

### Final Module Layout

```text
packages/claw-studio-desktop/src-tauri/src/
  app/
    bootstrap.rs
  commands/
    app_info.rs
    get_app_config.rs
    get_app_paths.rs
    process_commands.rs
    job_commands.rs
    ...
  framework/
    config.rs
    context.rs
    dialog.rs
    error.rs
    events.rs
    filesystem.rs
    logging.rs
    mod.rs
    paths.rs
    policy.rs
    runtime.rs
    services/
      mod.rs
      browser.rs
      dialog.rs
      jobs.rs
      process.rs
      system.rs
  plugins/
    mod.rs
  state/
    mod.rs
```

### Service Boundaries
- `SystemService`
  - OS, arch, family, target
  - command discovery
  - executable version probing
  - device identifier persistence
- `ProcessService`
  - validated process spawn requests
  - captured or streamed output
  - timeout handling
  - cancellation support
  - working-directory and environment allow-list enforcement
- `JobService`
  - background task registration
  - state transitions
  - cancellation
  - progress/event emission
- `BrowserService`
  - URL validation and opener integration
- `DialogService`
  - select/save dialog behavior backed by the current dialog helpers
- `FileSystemService`
  - preserve existing managed path operations, but expose them as reusable service methods rather than command-level helpers

### State Model
- Keep app metadata snapshots:
  - `app_name`
  - `app_version`
  - `target`
- Add `context: Arc<FrameworkContext>` to `AppState`.
- Commands pull services from `AppState.context` instead of reaching into scattered free functions.
- Serializable snapshots such as app info, system info, config, and paths remain lightweight DTOs returned by services.

## Data Flow

### Synchronous query flow
- Use for:
  - app metadata
  - config/path snapshots
  - system info
  - path existence and path metadata
- Flow:
  - frontend invoke
  - command adapter
  - service method
  - DTO response

### Asynchronous task flow
- Use for:
  - process execution
  - runtime probing
  - downloads
  - archives
  - installer work
  - diagnostics export
- Flow:
  1. frontend submits work through a command
  2. `JobService` creates a job record
  3. `runtime.rs` executes the job in a blocking task or controlled child process
  4. services emit structured events
  5. frontend queries or subscribes for updates

## Execution Model
- Add `framework/runtime.rs` as the single entry point for blocking or cancellable work.
- Required primitives:
  - `run_blocking`
  - `spawn_cancellable`
  - timeout wrapper
  - cancellation token/handle
- All platform-heavy services must route file IO, process execution, and future download/archive work through this runtime layer.
- Commands must not directly own blocking logic beyond trivial request mapping.

## Security Model

### Policy scope
- Upgrade `policy.rs` from path helpers into platform capability policy.
- Required validation areas:
  - path read/write
  - working directory selection
  - command spawn allow-list
  - environment variable allow-list
  - URL open allow-list

### Path enforcement
- Keep managed roots but harden checks against:
  - path escape via `..`
  - absolute path abuse
  - direct mutation of managed roots
  - symlink/junction escape cases where feasible

### Process enforcement
- No generic shell exposure to the frontend.
- Process execution must require:
  - explicit executable path or approved command id
  - validated working directory
  - validated environment variables
  - timeout and cancellation semantics

## Error Model
- Replace the current coarse error model with platform-level domains:
  - `PolicyDenied`
  - `ValidationFailed`
  - `NotFound`
  - `Conflict`
  - `ProcessFailed`
  - `Timeout`
  - `Cancelled`
  - `Internal`
- Keep strong Rust-side types and map them at the command boundary to stable frontend payloads.
- `ProcessFailed` should include structured diagnostics such as command, exit code, and stderr tail.

## Event Model
- Keep `app://ready`.
- Add:
  - `config://updated`
  - `job://updated`
  - `process://output`
  - `runtime://detected`
  - `runtime://changed`
- Event payloads must be typed and stable so frontend bridge code does not depend on internal implementation details.

## Testing Strategy

### Unit tests
- Policy path/command/url validation
- Process request normalization
- Job state transitions
- Error mapping
- Event payload construction

### Service tests
- `ProcessService` output capture
- process timeout and cancellation
- policy rejection for invalid working directories or commands
- `JobService` lifecycle transitions and event emission

### Architecture checks
- Extend `scripts/check-desktop-platform-foundation.mjs` to assert:
  - `framework/runtime.rs`
  - `framework/services/*`
  - process/job command files
  - continued bridge isolation from page-level Tauri imports

## Verification Standard
- `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
- `node scripts/check-desktop-platform-foundation.mjs`
- `node scripts/check-arch-boundaries.mjs`
- `pnpm --filter @sdkwork/claw-studio-desktop lint`
- At least one real process execution path:
  - submit
  - emit output/event
  - finish or cancel
- At least one real job path:
  - create
  - update
  - query
  - cancel or succeed

## Delivery Phases

### Phase 1: Execution kernel
- Add `framework/runtime.rs`
- Add `framework/services/mod.rs`
- Add `SystemService`
- Add `ProcessService`
- Add `JobService`
- Expand `events.rs`
- Expand `error.rs`
- Refactor `context.rs` into service assembly
- Add minimal process and job commands

### Phase 2: Capability consolidation
- Upgrade `policy.rs`
- Move browser and dialog logic behind service boundaries
- Refactor filesystem helpers into service-backed flows
- Update `state/mod.rs` to carry service context
- Reduce `commands` to thin adapters grouped by domain

### Phase 3: Platform expansion
- Add downloads, archives, database, installer, runtime, and sandbox capabilities on top of the kernel

## Out of Scope For This Round
- Bundled runtime installation
- Full installer implementation
- Updater implementation
- SQLite persistence
- Download manager
- Sandboxing beyond policy and process boundaries
- Codex integration
