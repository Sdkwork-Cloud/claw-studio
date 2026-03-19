# Desktop Background Lifecycle Design

## Goal

Refactor the Tauri desktop host so the main window can be closed without terminating the app process, the app remains available through a tray icon, and the desktop runtime gains a real background-service supervision model that can safely own long-lived child processes such as Codex, OpenClaw, and the built-in web server.

## Context

The current desktop runtime already has:

- a Tauri 2 desktop shell with a single `main` window
- job and process services for short-lived command execution
- a bootstrap path that manages shared desktop state

It does not yet have:

- window-close interception
- a tray icon or tray menu
- an application-level quit contract
- a long-lived supervisor for background services

That gap matters because this app is expected to behave like an operator process: it hosts UI, launches worker processes, and starts a local server. In that model, closing the window must not be treated as terminating the runtime.

## External Guidance

This design follows current Tauri 2 system tray and window-event behavior, plus platform conventions:

- Tauri 2 officially supports building tray menus and handling tray events in the Rust host.
- Tauri warns that Linux tray click events are not guaranteed, so the tray menu must remain the primary recovery path.
- Windows notification-area guidance favors explicit user-controlled background presence and a clear exit path rather than silently disappearing with no way to quit.
- On macOS, keeping the app process alive after the last window closes fits normal desktop conventions better than forcing a full quit.

Sources used while shaping the design:

- https://v2.tauri.app/learn/system-tray/
- https://learn.microsoft.com/en-us/windows/win32/shell/notification-area
- https://developer.apple.com/library/archive/documentation/General/Conceptual/MOSXAppProgrammingGuide/AppRuntime/AppRuntime.html
- https://specifications.freedesktop.org/status-notifier-item-spec/latest-single/

## Recommended Approach

### Option A: Tauri process as the only supervisor

The Tauri Rust process owns:

- the window lifecycle
- the tray lifecycle
- the long-lived child processes
- graceful shutdown orchestration

Pros:

- simplest mental model
- one place for state, shutdown ordering, and logging
- easiest to keep UI, tray, and process state consistent
- works cross-platform without introducing a second background daemon

Cons:

- if the Tauri process crashes, children must still be cleaned up or discovered on next boot

### Option B: Separate helper daemon supervises services

The Tauri app becomes a controller UI and delegates long-lived processes to a second always-on helper daemon.

Pros:

- strongest isolation between UI and service lifecycle
- can keep services alive even if the UI host crashes

Cons:

- much more complex install, upgrade, IPC, and recovery story
- platform-specific service registration becomes a major project
- overkill for the current repo state

### Option C: Keep current process runner and add tray only

Add close-to-tray without introducing a persistent supervisor layer.

Pros:

- fastest change

Cons:

- leaves no durable place to manage Codex/OpenClaw/web server lifecycle
- shutdown behavior remains fragile
- does not match the app’s role as the parent process

### Recommendation

Use Option A now.

It gives the best reliability-to-complexity ratio for the current architecture. The Tauri host already owns app bootstrap and process services, so the cleanest evolution is to add one explicit `SupervisorService` inside the Rust runtime and make it responsible for long-lived background services.

## Architecture

### Window lifecycle

- Keep the existing `main` window.
- Intercept `WindowEvent::CloseRequested`.
- Unless the app is already in an intentional shutdown flow, call `api.prevent_close()` and hide the window instead.
- Re-show the window from tray actions, single-instance activation, and any future “open app” command path.

This makes the close button mean “dismiss UI” instead of “destroy parent process.”

### Tray lifecycle

Create a tray icon at startup with menu items:

- `show_window`
- grouped navigation entries for `dashboard`, `install`, `apps`, `instances`, `tasks`, `api-router`, and `settings`
- grouped service restart entries for `openclaw_gateway`, `web_server`, and `api_router`
- grouped diagnostics entries for logs, main log reveal, integrations, and plugins
- `quit_app`

Behavior:

- `show_window` reveals, unminimizes, and focuses the main window.
- `restart_background_services` asks the supervisor to restart managed services in dependency order.
- `quit_app` enters intentional shutdown, stops managed services gracefully, then exits the Tauri app.

Linux note:

- tray left-click is optional enhancement only
- tray right-click menu is the guaranteed recovery path

### Supervisor lifecycle

Add a new long-lived `SupervisorService` that tracks managed services rather than one-off commands.

Each managed service definition should include:

- `id`
- `display_name`
- `command`
- `args`
- `cwd`
- `env`
- `startup_order`
- `shutdown_order`
- `graceful_shutdown_timeout_ms`
- `restart_policy`
- `health_check`

Initial services should be modeled as:

- `openclaw_gateway`
- `web_server`
- `api_router`

Even if some of those are not fully launched in this patch, the runtime contract should be built around them now.

### State model

Supervisor runtime state should track:

- `Starting`
- `Running`
- `Stopping`
- `Stopped`
- `Failed`

Per-service state should track:

- pid if known
- last start time
- last exit code
- restart count
- current health
- last error

The state lives in memory during runtime and can be projected into `service.json` for inspection and future crash recovery.

### Shutdown contract

There are now two different exit paths:

1. Window close:
   - prevent close
   - hide window
   - keep supervisor and services running

2. Explicit app quit:
   - mark shutdown intent
   - stop accepting restarts
   - gracefully stop services in reverse dependency order
   - kill remaining children after timeout
   - exit the Tauri process

This explicit split is the main behavioral correction.

## Cross-Platform Behavior

### Windows

- Closing the title-bar window hides to tray.
- Tray menu remains the explicit way to restore or quit.
- Supervisor stops services on explicit quit only.

### macOS

- Closing the window leaves the app process alive, matching common app behavior.
- Tray icon support remains useful, but window restoration logic must also work through normal activation paths.

### Linux

- The tray menu is the primary supported control surface.
- Left-click restore should be best-effort only because tray click behavior varies across desktop environments.
- The app must remain functional if only the tray menu is reliable.

## Error Handling

### Tray setup failures

- Fail startup loudly if tray creation fails on supported platforms, because closing to background without recovery would be unsafe.

### Window recovery failures

- If reveal/focus fails, log the error and retry the safest subset: show, unminimize, focus.

### Service start failures

- Mark the service failed.
- Apply restart policy with backoff.
- Avoid restart storms by limiting retries inside a moving time window.

### Quit-time failures

- Try graceful stop first.
- Force kill after timeout.
- Always continue the shutdown sequence so explicit quit cannot hang forever.

## Testing Strategy

### Rust unit tests

- close-request helper respects shutdown intent
- tray menu event routing maps to the correct action
- supervisor shutdown order is reverse dependency order
- restart throttling prevents infinite crash loops
- explicit quit flips the application into a real shutdown path

### Manual verification

- Launch desktop app.
- Close the main window and confirm the process still runs.
- Restore from tray `显示窗口`.
- Trigger `退出应用` from tray and confirm the process exits.
- Confirm child-process cleanup on quit.

## Implementation Scope

This iteration should deliver:

- close-to-background window behavior
- tray icon and tray menu
- explicit quit path
- service supervision foundation for long-lived processes
- tests around lifecycle decisions

It should not yet add:

- OS-level registered daemons or launch agents
- crash-recovery daemonization outside Tauri
- heavy new UI for service monitoring

## Success Criteria

- Clicking the window close button no longer terminates the desktop parent process.
- The app can always be recovered from the tray menu.
- The tray menu exposes a real exit path.
- Explicit tray exit shuts down managed background services in a controlled order.
- The runtime now has a clear Supervisor foundation suitable for Codex, OpenClaw, and the built-in web server.
