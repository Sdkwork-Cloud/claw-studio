# Bundled OpenClaw Runtime Design

**Status:** Approved for implementation

**Goal:** Ship OpenClaw as a built-in desktop capability so Claw Studio installs with a working OpenClaw runtime, starts and stops it with the desktop app lifecycle, upgrades it through Claw Studio releases, and exposes the bundled `openclaw` CLI through a stable PATH entry.

## Scope

- Bundle a production OpenClaw runtime with the desktop application.
- Avoid `hub-installer`, user-managed `npm install`, and system Node.js dependencies.
- Start the bundled OpenClaw gateway automatically when the desktop runtime starts.
- Stop the bundled OpenClaw gateway when the desktop runtime exits.
- Expose the bundled `openclaw` CLI through stable user shims.
- Upgrade OpenClaw by shipping a newer bundled runtime in a Claw Studio release.

## Non-Goals

- Supporting arbitrary user-installed OpenClaw runtimes.
- Preserving 100% independent lifecycle semantics for background daemon commands.
- Downloading OpenClaw on first run.
- Solving cross-target packaging from a single host build. Each target build produces its own bundled runtime.

## Architecture

Claw Studio will treat OpenClaw as a versioned managed runtime, not as a source dependency in the workspace. The desktop build will prepare a platform-specific `openclaw-runtime` resource directory containing a pinned Node runtime, a pinned `openclaw` npm installation, and metadata. On first launch after install or upgrade, the desktop host will copy that bundled resource into `paths.runtimes_dir/openclaw/<version>-<platform>/`, atomically switch the active runtime entry, create stable CLI shims in a user-managed `bin` directory, and ensure that `bin` directory is available on the user's PATH.

The Rust desktop host will own the OpenClaw gateway lifecycle. During Tauri setup, after `FrameworkContext` is created, the host will prepare the bundled runtime, resolve the active `openclaw` command path, start `openclaw gateway`, stream logs to the desktop log directory, track PID and readiness in the supervisor, and terminate the process tree during explicit app shutdown.

## Runtime Layout

Bundled app resources:

- `src-tauri/resources/openclaw-runtime/manifest.json`
- `src-tauri/resources/openclaw-runtime/runtime/**`

Installed managed runtime:

- `<paths.runtimes_dir>/openclaw/<version>-<platform>/manifest.json`
- `<paths.runtimes_dir>/openclaw/<version>-<platform>/runtime/**`
- `<paths.runtimes_dir>/openclaw/current` or active state entry pointing at the current version

Stable CLI exposure:

- `<paths.user_root>/bin/openclaw.cmd`
- `<paths.user_root>/bin/openclaw.ps1`
- `<paths.user_root>/bin/openclaw`

## Packaging Strategy

Builds will prepare the current target's OpenClaw runtime before `tauri build` or `tauri dev`. The prep step will:

1. Resolve pinned versions for Node and OpenClaw.
2. Download the target's official Node runtime.
3. Install `openclaw` with production dependencies into a staging directory.
4. Write a runtime manifest with version, platform, and integrity metadata.
5. Copy the resulting directory into `src-tauri/resources/openclaw-runtime/runtime`.

This keeps packaging deterministic per target and avoids runtime downloads.

## Lifecycle Strategy

Startup:

1. Bootstrap `FrameworkContext`.
2. Prepare and activate the bundled OpenClaw runtime.
3. Ensure CLI shims and PATH registration are present.
4. Start `openclaw gateway`.
5. Mark supervisor state as running after the process starts and health checks succeed.

Shutdown:

1. Begin supervisor shutdown.
2. Stop OpenClaw gateway gracefully.
3. Kill the process tree if graceful stop times out.
4. Mark supervisor state as stopped.

Window close will continue to hide the main window. OpenClaw shutdown is tied to explicit app exit, not window hide.

## PATH Strategy

The app will own a user-scoped `bin` directory and expose stable shims there. PATH registration will be platform-specific:

- Windows: update the user PATH entry.
- macOS: ensure the `bin` directory is exported from login shell startup files.
- Linux: ensure the `bin` directory is exported from profile files.

Registration must be idempotent and avoid duplicate PATH entries.

## Testing Strategy

- Rust unit tests for runtime manifest resolution, activation state, shim generation, and PATH registration text updates.
- Rust unit tests for supervisor OpenClaw service lifecycle state transitions.
- Script-level contract tests for the OpenClaw resource prep build step.
- Desktop startup tests that verify the OpenClaw gateway service is present in supervisor metadata.

## Risks

- Native npm dependencies can break on specific targets if the build host does not match the target.
- PATH mutation differs across platforms and shells.
- Long-running process shutdown must terminate child processes reliably.
- OpenClaw CLI commands that start background services may diverge from the app-owned lifecycle if the user runs them manually.

## Acceptance Criteria

- A fresh Claw Studio install contains a working bundled OpenClaw runtime.
- No second install step is required after Claw Studio installation.
- Launching the desktop app starts the bundled OpenClaw gateway automatically.
- Explicitly exiting the desktop app stops the OpenClaw gateway.
- Upgrading Claw Studio upgrades OpenClaw by switching to the newer bundled runtime.
- Running `openclaw --version` from a user terminal resolves to the bundled OpenClaw CLI.
