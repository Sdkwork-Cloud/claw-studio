# Claw Studio Tauri Framework Foundation Design

## Goal
- Turn the current `src-tauri` scaffold into a reusable desktop runtime foundation.
- Add real `paths`, `config`, `logging`, `events`, and `plugins` capabilities without touching page UI or business package behavior.
- Keep `@sdkwork/claw-studio-desktop` as the only native runtime package and preserve the current workspace dependency direction.

## Current State
- Local desktop packaging is already verified through `pnpm tauri:info` and `pnpm tauri:build`.
- `src-tauri` only exposes a minimal `app_info` command and a small `AppState`.
- There is no runtime context for filesystem paths, config persistence, or log output.
- Plugin registration is not separated from app bootstrap yet.

## Options Considered

### Option A: Build a first-party framework layer and keep plugins thin
- Add a `framework` module for path resolution, config loading, logging, events, policy, and shared startup context.
- Keep `plugins` as a thin registration layer instead of hiding core runtime behavior inside plugin setup.
- Recommended because it keeps later runtime, installer, updater, and diagnostics work on a stable foundation.

### Option B: Use plugin-first integration and keep the framework minimal
- Connect several Tauri plugins immediately and let them drive most foundation behavior.
- Rejected because config, logging, and policy concerns would be scattered across integration points.

### Option C: Add only directory scaffolding and placeholders
- Lowest initial effort.
- Rejected because the next runtime and installer phase would still need a disruptive refactor.

## Final Design

### Module Boundaries
- `app/`
  - Owns startup composition only.
  - Builds the runtime context, manages shared state, registers commands, and wires plugins.
- `framework/`
  - Owns `error`, `context`, `paths`, `config`, `logging`, `events`, and `policy`.
  - Provides the reusable runtime foundation for later platform services.
- `state/`
  - Holds fully initialized application state derived from framework context.
  - Exposes app metadata, path metadata, and loaded configuration snapshots to commands.
- `platform/`
  - Holds OS-specific helpers such as platform name and path-related utilities.
  - Does not own config or logging behavior.
- `commands/`
  - Stays thin and only exposes native entry points.
  - Adds `get_app_paths` and `get_app_config` alongside the existing `app_info` command.
- `plugins/`
  - Centralizes Tauri plugin registration.
  - This round only enables `tauri-plugin-single-instance` and keeps other plugins as future extension points.

### Startup Data Flow
1. Resolve desktop directories in `framework/paths.rs`.
2. Ensure `config`, `data`, `cache`, `logs`, and `state` directories exist.
3. Load or create default config in `framework/config.rs`.
4. Initialize file logging in `framework/logging.rs` and append a startup banner to `logs/app.log`.
5. Assemble `FrameworkContext` in `framework/context.rs`.
6. Build `AppState` from the context and inject it into the Tauri builder.
7. Register commands and plugins.

### Foundation Capabilities
- `paths`
  - Resolves and creates `config`, `data`, `cache`, `logs`, and `state` directories.
  - Returns normalized serializable path data for diagnostics and later settings surfaces.
- `config`
  - Manages a single minimal JSON config file for now.
  - Initial fields: `distribution`, `logLevel`, `theme`, `telemetryEnabled`.
  - Writes a default file on first launch if none exists.
- `logging`
  - Uses a first-party file logger instead of `tauri-plugin-log` for the baseline.
  - Writes append-only records to `logs/app.log` with `INFO`, `WARN`, and `ERROR` levels.
  - Leaves room for later rotation and structured child logs.
- `events`
  - Defines shared event names in one place:
    - `app://ready`
    - `app://config-updated`
    - `app://log-flush`
- `policy`
  - Starts as a small module for runtime path and config safety checks.
  - Prevents command handlers from reimplementing path rules.

### Plugin Strategy
- Enable now:
  - `tauri-plugin-single-instance`
- Prepare but do not enable yet:
  - `store`
  - `dialog`
  - `opener`
- Explicitly out of scope this round:
  - `updater`
  - `shell`

### Command Surface
- `app_info`
  - Continues to expose app name, version, and target from initialized state.
- `get_app_paths`
  - Returns serialized runtime directories from `AppState`.
- `get_app_config`
  - Returns the loaded config snapshot from `AppState`.

## Verification
- `node scripts/check-desktop-platform-foundation.mjs`
- `node scripts/check-arch-boundaries.mjs`
- `pnpm lint`
- `pnpm --filter @sdkwork/claw-studio-desktop lint`
- `pnpm tauri:info`
- `pnpm tauri:build`

Success means:
- The foundation modules compile and are wired into runtime startup.
- The app creates its runtime directories and default config.
- `logs/app.log` is written during startup.
- The new native commands return valid path and config data.
- No page-level business module changes are required.

## Out of Scope
- Runtime and installer commands.
- Job orchestration.
- Auto-updater integration.
- `cn` / `global` runtime policy assembly.
- Page layout or style changes.
- Generic shell execution exposure.
