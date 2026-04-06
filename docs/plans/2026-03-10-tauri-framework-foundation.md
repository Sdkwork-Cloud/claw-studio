# Tauri Framework Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real desktop runtime foundation under `packages/claw-studio-desktop/src-tauri` with framework modules for paths, config, logging, events, policy, plugin registration, and thin native commands for path and config inspection.

**Architecture:** Keep `@sdkwork/claw-studio-desktop` as the only native runtime package. Build a reusable `framework` layer for startup context and persistence concerns, expand `AppState` to hold initialized runtime metadata, and keep `commands` thin by reading from that state. Use a first-party file logger and only enable the `single-instance` plugin in this phase.

**Tech Stack:** pnpm workspace, Tauri v2, Rust 2021, serde/serde_json, existing architecture checks under `scripts/`

---

### Task 1: Extend the desktop architecture check for framework foundation files

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\scripts\check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**
- Add assertions that require these files to exist:
  - `packages/claw-studio-desktop/src-tauri/src/framework/mod.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/error.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/context.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/paths.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/config.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/logging.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/events.rs`
  - `packages/claw-studio-desktop/src-tauri/src/framework/policy.rs`
  - `packages/claw-studio-desktop/src-tauri/src/plugins/mod.rs`
  - `packages/claw-studio-desktop/src-tauri/src/commands/get_app_paths.rs`
  - `packages/claw-studio-desktop/src-tauri/src/commands/get_app_config.rs`
- Add assertions that:
  - `packages/claw-studio-desktop/src-tauri/Cargo.toml` includes `tauri-plugin-single-instance`
  - `packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs` references `plugins`
  - `packages/claw-studio-desktop/src-tauri/src/desktop` bridge still does not leak native command names into page packages

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the framework files, commands, and plugin registration do not exist yet.

**Step 3: Write minimal implementation**

```js
assertPath('packages/claw-studio-desktop/src-tauri/src/framework/mod.rs', 'framework module');
assertPath('packages/claw-studio-desktop/src-tauri/src/plugins/mod.rs', 'plugin registration module');
assertIncludes('packages/claw-studio-desktop/src-tauri/Cargo.toml', 'tauri-plugin-single-instance', 'single-instance plugin dependency');
```

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS after the later tasks add the files and bootstrap references.

**Step 5: Commit**

```bash
git add scripts/check-desktop-platform-foundation.mjs
git commit -m "test: extend desktop checks for framework foundation"
```

### Task 2: Add the framework core modules for paths, config, logging, events, and policy

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\mod.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\error.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\context.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\paths.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\config.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\logging.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\events.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\policy.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\Cargo.toml`

**Step 1: Write the failing test**
- Add unit tests inside the new framework modules:
  - `paths.rs`: verifies runtime directories are created under a supplied base directory.
  - `config.rs`: verifies a default config file is written when none exists.
  - `logging.rs`: verifies a log line is appended to a provided log file path.

```rust
#[test]
fn creates_runtime_directories() {
  let root = tempfile::tempdir().unwrap();
  let paths = resolve_paths_for_root(root.path()).unwrap();
  assert!(paths.logs_dir.exists());
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::`
Expected: FAIL because the framework modules and tests do not exist yet.

**Step 3: Write minimal implementation**
- Add small reusable structs:

```rust
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
  pub config_dir: PathBuf,
  pub data_dir: PathBuf,
  pub cache_dir: PathBuf,
  pub logs_dir: PathBuf,
  pub state_dir: PathBuf,
}
```

```rust
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
  pub distribution: String,
  pub log_level: String,
  pub theme: String,
  pub telemetry_enabled: bool,
}
```

- Use `tempfile` for unit tests and add only the minimum new dependencies needed by the framework tests and the single-instance plugin.
- Keep log writing append-only and synchronous for this phase.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::`
Expected: PASS for the new framework unit tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/Cargo.toml packages/claw-studio-desktop/src-tauri/src/framework
git commit -m "feat: add tauri framework foundation modules"
```

### Task 3: Build runtime context and expanded application state during startup

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\lib.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\state\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\platform\mod.rs`

**Step 1: Write the failing test**
- Add a unit test in `state/mod.rs` that builds `AppState` from a `FrameworkContext` and asserts config and path data are preserved.

```rust
#[test]
fn state_captures_framework_context() {
  let context = test_context();
  let state = AppState::from_context(context.clone());
  assert_eq!(state.config.theme, context.config.theme);
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml state::`
Expected: FAIL because `FrameworkContext` and the richer `AppState` do not exist yet.

**Step 3: Write minimal implementation**
- Add `FrameworkContext` creation during Tauri startup.
- Create directories, load config, and initialize logging before registering managed state.
- Expand `AppState` to include:

```rust
pub struct AppState {
  pub app_name: String,
  pub app_version: String,
  pub target: String,
  pub paths: AppPaths,
  pub config: AppConfig,
}
```

- Keep the bootstrap sequence in `setup` or an equivalent initialization path so it can use the real Tauri app handle for path resolution.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml state::`
Expected: PASS for state initialization tests.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs packages/claw-studio-desktop/src-tauri/src/lib.rs packages/claw-studio-desktop/src-tauri/src/state/mod.rs packages/claw-studio-desktop/src-tauri/src/platform/mod.rs
git commit -m "feat: initialize desktop framework context at startup"
```

### Task 4: Add thin native commands for app paths and config

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_app_paths.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\get_app_config.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\app_info.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\tauriBridge.ts`

**Step 1: Write the failing test**
- Add a desktop architecture check assertion that the bridge exports `getAppPaths` and `getAppConfig` helpers.
- Add command-level unit tests that verify serialized state snapshots are returned without mutation.

```rust
#[test]
fn returns_app_config_snapshot() {
  let state = test_state();
  let config = get_app_config(tauri::State::from(&state));
  assert_eq!(config.theme, "system");
}
```

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the command files and bridge exports do not exist yet.

**Step 3: Write minimal implementation**
- Keep commands thin:

```rust
#[tauri::command]
pub fn get_app_paths(state: tauri::State<'_, AppState>) -> AppPaths {
  state.paths.clone()
}
```

```rust
#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, AppState>) -> AppConfig {
  state.config.clone()
}
```

- Update `app_info` to read from the richer `AppState`.
- Add guarded desktop bridge helpers that return `null` outside Tauri runtime.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml commands::`
Expected: PASS for command unit tests.

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for bridge and command file assertions.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/commands packages/claw-studio-desktop/src/desktop/tauriBridge.ts scripts/check-desktop-platform-foundation.mjs
git commit -m "feat: expose desktop path and config commands"
```

### Task 5: Add plugin registration and enable single-instance behavior

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\plugins\mod.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\Cargo.toml`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`

**Step 1: Write the failing test**
- Add an architecture check assertion that bootstrap calls a plugin registration function.
- Add a unit-level compile test in `plugins/mod.rs` that builds the plugin registration function for the Tauri builder type.

```rust
pub fn register(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
  builder.plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
}
```

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the plugin module and dependency do not exist yet.

**Step 3: Write minimal implementation**
- Add `tauri-plugin-single-instance = "2"` to `Cargo.toml`.
- Create `plugins::register(builder)` and call it from bootstrap before command wiring is finalized.
- Keep future plugin slots commented only if the code remains clear without noise.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml plugins::`
Expected: PASS or compile cleanly if the plugin module has no dedicated tests.

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for plugin registration assertions.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/Cargo.toml packages/claw-studio-desktop/src-tauri/src/plugins packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: register desktop single-instance plugin"
```

### Task 6: Verify the framework foundation end to end

**Files:**
- Verify only

**Step 1: Run framework unit tests**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 2: Run desktop architecture checks**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

**Step 3: Run workspace boundary checks**

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 4: Run TypeScript validation**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm --filter @sdkwork/claw-studio-desktop lint`
Expected: PASS

**Step 5: Run desktop environment and bundle verification**

Run: `pnpm tauri:info`
Expected: exit 0 with desktop environment details

Run: `pnpm tauri:build`
Expected: exit 0 with updated desktop bundles

**Step 6: Manual runtime verification**
- Start the desktop app and confirm:
  - runtime directories are created
  - the default config file exists
  - `logs/app.log` contains a startup entry
  - `get_app_paths` and `get_app_config` return valid JSON payloads

**Step 7: Commit**

```bash
git add .
git commit -m "chore: verify tauri framework foundation"
```
