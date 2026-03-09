# Claw Studio Tauri Desktop Platform Design

## Goal
- Build a reusable desktop foundation on top of the current `pnpm workspace`.
- Keep business packages stable and move desktop-only concerns into a dedicated package.
- Support a dual update channel model: `GitHub Releases` and `self-hosted`.
- Turn runtime management, package installation, logging, updates, and diagnostics into platform capabilities instead of page-level logic.

## Recommended Approach

### Option A: Dedicated desktop shell package
- Add `@sdkwork/claw-studio-desktop` with its own frontend entry and `src-tauri/`.
- Add `@sdkwork/claw-studio-shell` as a cross-platform application shell.
- Keep `@sdkwork/claw-studio-web` as a pure web launcher.
- This preserves strict dependency direction and keeps desktop concerns isolated.

### Option B: Embed Tauri into `@sdkwork/claw-studio-web`
- Lowest initial migration cost.
- Rejected because web runtime and desktop runtime concerns would be mixed together.

### Option C: Add top-level `apps/desktop`
- Strong isolation.
- Rejected because it breaks the current `packages/*` strategy and adds a second app layout model.

## Final Package Layout

```text
packages/
  claw-studio-distribution/
    src/
      manifests/
        cn/
        global/
      policies/
        cn/
        global/
      providers/
        cn/
        global/
      index.ts
  claw-studio-shell/
    src/
      app/
      application/
      index.ts
  claw-studio-web/
    src/
      main.tsx
      web/
  claw-studio-desktop/
    src/
      main.tsx
      desktop/
        bootstrap/
        bridge/
        providers/
    src-tauri/
      Cargo.toml
      tauri.conf.json
      capabilities/
      icons/
      src/
        main.rs
        lib.rs
        app/
        framework/
        commands/
        plugins/
```

## Dependency Direction
- `distribution -> shell -> feature/business/shared-ui -> domain/infrastructure`
- `desktop -> shell -> feature/business/shared-ui -> domain/infrastructure`
- `web -> shell -> feature/business/shared-ui -> domain/infrastructure`
- `commands -> framework`
- `app -> framework`
- `framework` does not depend on `app` or `commands`

## Distribution Model

### Strategy
- Keep one workspace and one platform foundation.
- Support multiple distribution targets with different manifests and providers.
- Current targets:
  - `cn`
  - `global`

### Distribution manifest
- `id`
- `appId`
- `appName`
- `bundleIdentifier`
- `update`
- `api`
- `auth`
- `ai`
- `storage`
- `payments`
- `community`
- `compliance`
- `mirrors`
- `enabledFeatures`
- `disabledFeatures`
- `packageSources`
- `runtimePolicies`

### Boundary rules
- Domain and shared business logic stay distribution-agnostic.
- Distribution-specific behavior is assembled through manifests, providers, policies, and adapter implementations.
- Do not scatter `cn` or `global` branches across feature pages.

## Frontend Boundary Rules
- Business pages do not call `@tauri-apps/api/*` directly.
- Platform access goes through infrastructure contracts and business services.
- Existing Tauri calls in install pages are migrated into `installerService`.

## Rust Layering

```text
src-tauri/src/
  app/
    bootstrap.rs
    state.rs
    window.rs
    tray.rs
    menu.rs
    lifecycle.rs
    updater.rs
  framework/
    error.rs
    runtime.rs
    context.rs
    paths.rs
    config.rs
    logging.rs
    events.rs
    policy.rs
    services/
      system.rs
      filesystem.rs
      process.rs
      runtime.rs
      package_manager.rs
      downloads.rs
      archives.rs
      installer.rs
      package_registry.rs
      launcher.rs
      health.rs
      updater.rs
      database.rs
      jobs.rs
  commands/
    app_commands.rs
    system_commands.rs
    runtime_commands.rs
    installer_commands.rs
    updater_commands.rs
    config_commands.rs
    log_commands.rs
    job_commands.rs
  plugins/
    mod.rs
```

## Platform Capability Model

### Runtime
- Detect and manage `node`, `python`.
- Support install profiles: `system`, `managed`, `bundled`, `offline`.

### Package managers
- Support `npm`, `pnpm`, `pip`.
- Prefer managed runtime scoped under the app data directory.

### Installable packages
- `openclaw`
- `codex`
- future internal or external platform packages

## Regional Source Policies
- Runtime sources are distribution-aware:
  - `node` source and fallback
  - `python` source and fallback
  - `pnpm` registry
  - `pip` index URL
- Platform package sources are distribution-aware:
  - `openclaw`
  - `codex`
- `cn` defaults to regional mirrors and self-hosted update sources.
- `global` defaults to public or global sources with self-hosted fallback.

### Installable package manifest
- `id`
- `kind`
- `channel`
- `runtimeRequirements`
- `installStrategy`
- `launchStrategy`
- `healthChecks`
- `updateSource`

## Directories

```text
config/
  app.json
  sources.json
  channels.json
  policies.json
  runtimes.json
  packages.json
  windows.json
data/
  runtimes/
    node/
    python/
  apps/
    openclaw/
    codex/
  bin/
  db/
cache/
  downloads/
  extracted/
  temp/
logs/
  app.log
  runtime.log
  installer.log
  updater.log
  audit.log
state/
  jobs.json
  installs.json
```

## Plugin Set
- `single-instance`
- `log`
- `updater`
- `dialog`
- `opener`
- `store`
- `fs`
- avoid exposing `shell` directly to frontend pages

## Security Model
- Use Tauri v2 capabilities with minimum window-scoped permissions.
- All path access is validated through policy services.
- Process execution is only available via custom commands, not generic shell access.

## Update Model
- Support both `GitHub Releases` and `self-hosted` update sources.
- Desktop app updates and package updates are separate flows.
- Runtime configuration selects the active channel and fallback source.
- Signature verification is mandatory.
- Each distribution resolves update source priority independently.

## Packaging Model
- `Windows`: `nsis` primary, `msi` secondary
- `macOS`: `app` and `dmg`
- `Linux`: `AppImage` and `deb`
- Package artifacts are shared by both public and self-hosted release pipelines.

## Diagnostics and Quality Gates
- Unified job system for download, install, update, repair, and uninstall flows.
- Task center with progress, cancellation, and structured log references.
- Exportable diagnostics bundle with config, logs, runtime state, and recent job metadata.
- Verification gates: architecture checks, type checks, build, desktop shell smoke checks, and installer contract checks.

## Delivery Phases

### Phase 1
- Extract shell package.
- Add desktop package.
- Add desktop architecture checks.

### Phase 2
- Add platform bridge contracts.
- Add runtime and installer business services.
- Remove page-level raw Tauri calls.

### Phase 3
- Add Tauri Rust scaffold.
- Add framework, commands, plugin registration, and capability files.

### Phase 4
- Add distribution manifests and provider assembly for `cn` and `global`.
- Add source policy and regional runtime configuration.

### Phase 5
- Add release pipeline, update publishing, diagnostics, and operator documentation.
