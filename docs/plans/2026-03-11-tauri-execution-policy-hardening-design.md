# Claw Studio Tauri Execution Policy Hardening Design

## Goal
- Harden the desktop native execution boundary before expanding more runtime orchestration features.
- Make process execution depend on an explicit policy model bound to `FrameworkContext` instead of loose static validation helpers.
- Preserve the current Tauri command surface while tightening the Rust platform kernel beneath it.

## Current Gaps
- `validate_working_directory(...)` only checks existence and directory type.
- `ProcessService` validates command name and `cwd`, but does not sanitize environment inheritance.
- `FrameworkContext` assembles services, yet execution policy is not part of the shared runtime context.
- Current command allow-list still exposes shell entry points used for tests, which is acceptable only as a temporary bridge if the rest of the boundary is tightened.

## Design Direction

### Execution Policy Becomes Context-Bound
- Add a dedicated execution policy model under `framework/policy.rs`.
- `FrameworkContext` owns the policy inputs through app paths and service assembly.
- `ProcessService` stops treating policy as a collection of unrelated free functions and instead validates requests against an explicit policy snapshot derived from `AppPaths`.

### Working Directory Rules
- If `ProcessRequest.cwd` is `None`, execution falls back to `paths.data_dir`.
- If `cwd` is provided:
  - it must exist
  - it must be a directory
  - its canonicalized path must remain inside one of `AppPaths.managed_roots()`
- Validation must compare canonical paths rather than lexical path strings so symlink or junction escapes are less likely.

### Environment Rules
- Child processes no longer inherit the full host environment.
- Process spawning uses `env_clear()` and injects only a platform allow-list.
- First-pass allow-list:
  - Windows: `PATH`, `SystemRoot`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP`
  - Unix: `PATH`, `HOME`, `TMPDIR`, `LANG`
- Frontend-provided custom environment variables remain out of scope in this round.

### Process Request Normalization
- Preserve the bridge-facing `ProcessRequest` shape for compatibility.
- Introduce an internal validated request that contains:
  - normalized command string
  - resolved working directory
  - sanitized environment pairs
  - bounded timeout
- `ProcessService` only spawns from the validated internal request.

## Testing Strategy
- Add unit tests that prove:
  - valid managed working directories are resolved and canonicalized
  - unmanaged working directories are rejected
  - missing `cwd` falls back to `paths.data_dir`
  - sanitized process environments only include allowed keys
- Keep tests independent from the Tauri bridge. All coverage stays in Rust unit tests under `policy.rs` and `services/process.rs`.

## Out of Scope
- User-authorized external working roots
- Rich command profiles and argument schema validation
- Frontend runtime event store wiring
- Full job-to-process orchestration
