# OpenClaw Async Desktop Startup Design

## Goal

Make the Tauri desktop host enter reliably even when bundled OpenClaw needs extra time to start, fails transiently, or never becomes ready, while still exposing truthful OpenClaw state and recovery actions inside the app.

## Current Problem

The desktop host currently treats bundled OpenClaw activation as a hard prerequisite for `APP_READY`.

1. `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs` runs `activate_bundled_openclaw(...)` inside `setup()` and returns the activation error before emitting `app://ready`.
2. `activate_bundled_openclaw(...)` performs runtime installation, local AI proxy preparation, gateway start, readiness waiting, and built-in instance projection in one synchronous path.
3. When runtime finalization hits transient Windows file locks or the bundled gateway hangs before listening on `127.0.0.1:18871`, the whole desktop process exits instead of entering a degraded but usable shell.
4. The built-in instance status becomes an implementation detail of startup success rather than an observable service state the UI can present and recover from.

## Desired Behavior

1. The desktop window and tray initialize independently of bundled OpenClaw readiness.
2. `APP_READY` emits after deterministic desktop bootstrap work completes, not after gateway readiness.
3. Bundled OpenClaw activation runs in the background and drives the built-in instance through truthful states such as `Starting`, `Online`, and `Error`.
4. Transient bundled startup failures are retried automatically with bounded policy.
5. Persistent failures surface as degraded built-in service state with actionable diagnostics rather than blocking desktop entry.
6. Manual built-in instance start and restart commands remain synchronous and continue to report explicit failures.

## Architecture

This change keeps the existing bundled OpenClaw runtime pipeline but decouples it from the desktop entry path.

- `bootstrap.rs` remains responsible for deterministic host bootstrap: framework context creation, desktop kernel bootstrap, state registration, tray setup, and `APP_READY`.
- Bundled OpenClaw activation becomes a supervised background task scheduled from `setup()` after the shell is ready.
- `studio.rs` remains the source of truth for built-in instance projection and reuses its existing `Starting`, `Online`, and `Error` instance statuses to expose background activation progress.
- `supervisor.rs` continues to own gateway start, readiness waiting, and process lifecycle, including the existing transient retry around Windows cold-start spawn failures.

No new transport or package boundary is required. The change is behavioral and local to the desktop Tauri host.

## Design Decisions

### Desktop-First Startup Contract

`setup()` must only do work that is deterministic, local, and required to enter the shell.

That means:

- keep context bootstrap
- keep tray creation
- keep app state registration
- emit `app://ready`
- schedule bundled OpenClaw activation asynchronously

That means `activate_bundled_openclaw(...)` no longer decides whether the desktop process enters.

### Built-In OpenClaw As A Managed Capability

The bundled instance should behave like a managed capability whose availability can lag behind shell availability.

Recommended projection:

- bootstrap marks the built-in instance as `Starting` before background activation begins
- background activation promotes it to `Online` only after runtime, proxy, and gateway readiness succeed
- background activation records `Error` when startup fails after bounded retries

This preserves truthful state without inventing a second startup model just for the desktop bootstrap path.

### Layered Recovery Instead Of A Single Blocking Wait

The current synchronous design combines three very different failure classes:

- runtime install finalize lock contention
- process spawn or cold-start failures
- gateway readiness hangs

These need different handling:

1. Runtime install finalize continues to use retry-based hardening for transient Windows access-denied cases.
2. Gateway spawn keeps a short retry loop for cold-start process failures that often succeed on a second attempt.
3. Background activation owns the higher-level policy for non-ready timeouts and converts them into observable built-in instance failure rather than fatal desktop bootstrap failure.

This keeps startup honest without teaching the shell to wait forever.

### Non-Blocking UX Contract

The user experience must change from "desktop cannot start until OpenClaw is healthy" to "desktop starts, and built-in OpenClaw converges in the background."

Implications:

- shell routes and tray entry remain available immediately
- built-in instance detail shows `Starting` while background activation is running
- if startup fails, the built-in instance shows `Error` with the last activation failure detail
- manual start or restart remains available as the explicit recovery path

No fake success state is allowed. The shell enters immediately, but OpenClaw status must remain truthful.

## Data Flow

1. `setup()` bootstraps framework services and tray.
2. `setup()` ensures the built-in instance is projected as `Starting`.
3. `setup()` emits `app://ready`.
4. `setup()` spawns a background activation task.
5. The background task runs the existing activation pipeline.
6. On success, the task marks the built-in instance `Online`.
7. On failure, the task marks the built-in instance `Error` and persists the last failure summary for diagnostics.

## Error Handling

1. Background activation must catch and log all activation errors so the desktop process never exits because bundled OpenClaw failed to converge.
2. Failures still need strong structured logs at the activation stage boundary so the startup trail remains debuggable.
3. If the built-in instance cannot be projected or updated, the activation path should log the secondary failure and preserve the primary startup error in logs.
4. Manual instance start and restart commands must keep their current synchronous behavior and propagate failures to the caller.

## Testing

The implementation should use regression tests around the existing desktop bootstrap and built-in instance service boundaries.

Required coverage:

1. `bootstrap.rs` proves `app://ready` still emits when bundled OpenClaw activation fails.
2. `bootstrap.rs` proves setup schedules asynchronous bundled activation instead of returning the startup error.
3. `studio.rs` proves background bundled activation failure marks the built-in instance `Error`.
4. `studio.rs` proves successful background activation promotes the built-in instance from `Starting` to `Online`.
5. Existing manual built-in instance start and restart tests continue to pass unchanged.

## Acceptance Criteria

1. `pnpm tauri:dev` no longer exits during startup solely because bundled OpenClaw activation times out or the gateway never becomes ready.
2. The desktop shell enters and emits `app://ready` before bundled OpenClaw reaches readiness.
3. The built-in instance exposes truthful `Starting`, `Online`, or `Error` state after startup instead of leaving desktop bootstrap responsible for that truth.
4. Activation failures remain visible in logs and in built-in instance status.
5. Existing manual lifecycle controls for the built-in instance still work and still fail loudly when OpenClaw cannot start.

## Risks

1. If background activation updates the built-in instance without proper service access, startup state could diverge between logs and instance projection.
2. If the async task outlives required runtime state incorrectly, it could panic or silently skip state updates.
3. If manual start and background start race, the built-in instance could oscillate between `Starting` and `Error` without clear ownership.

The implementation should keep the background activation entry narrow and reuse existing service APIs rather than adding parallel control paths.
