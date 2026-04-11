# Claw Studio Tauri Desktop Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a desktop-ready Tauri platform foundation with a dedicated desktop package, cross-platform shell package, regional distribution architecture, platform bridge, runtime/installer architecture, and a packaging/update pipeline without changing existing business UI behavior.

**Architecture:** Extract the current application shell out of `@sdkwork/claw-studio-web` into a reusable `@sdkwork/claw-studio-shell` package, add a dedicated `@sdkwork/claw-studio-desktop` package with `src-tauri`, introduce a `@sdkwork/claw-studio-distribution` package for `cn` and `global` assembly, and migrate platform access behind business and infrastructure service boundaries. Start with the minimum vertical slice that preserves current UI, then extend into runtime management, installer orchestration, regional source policies, logging, and update infrastructure.

**Tech Stack:** pnpm workspace, React 19, TypeScript 5, Vite 6, Tauri v2, Rust, existing architecture scripts under `scripts/`

---

## Phases

### Phase 1: Foundation scaffold
- Add architecture checks.
- Extract shell package.
- Add desktop launcher package.

### Phase 2: Bridge and service boundaries
- Add platform contracts.
- Add runtime and installer business services.
- Remove direct page-level Tauri APIs.

### Phase 3: Rust desktop runtime
- Add `src-tauri`.
- Add framework, commands, plugins, capabilities, config, and logging.

### Phase 4: Regional distribution architecture
- Add `@sdkwork/claw-studio-distribution`.
- Add `cn` and `global` manifests, provider assembly, and source policies.
- Wire desktop and web launchers to distribution manifests.

### Phase 5: Release and platform operations
- Add updater integration.
- Add packaging scripts and release docs.
- Add diagnostics and operator guidance.

### Task 1: Add a failing architecture check for shell and desktop packages

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\scripts\check-desktop-platform-foundation.mjs`
- Modify: `D:\sdkwork-opensource\claw-studio\package.json`

**Step 1: Write the failing test**
- Assert that `packages/claw-studio-shell/package.json` exists.
- Assert that `packages/claw-studio-desktop/package.json` exists.
- Assert that `packages/claw-studio-desktop/src-tauri/Cargo.toml` exists.
- Assert that install feature pages do not import `@tauri-apps/api/core`.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the packages and Rust scaffold do not exist yet.

**Step 3: Write minimal implementation**
- Add the new check script.
- Add a root script entry such as `check:desktop`.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS after the shell and desktop scaffold is added in later tasks.

**Step 5: Commit**

```bash
git add scripts/check-desktop-platform-foundation.mjs package.json
git commit -m "test: add desktop foundation architecture checks"
```

### Task 2: Extract the cross-platform application shell

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-shell\package.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-shell\tsconfig.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-shell\src\index.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-shell\src\app\AppRoot.tsx`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-shell\src\application\...`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-web\src\App.tsx`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-web\src\main.tsx`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-web\package.json`

**Step 1: Write the failing test**
- Extend `check-desktop-platform-foundation.mjs` to assert:
  - shell package exports an application root
  - web package depends on `@sdkwork/claw-studio-shell`

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because shell exports and dependency are missing.

**Step 3: Write minimal implementation**
- Move reusable app shell files from web into the shell package.
- Keep web package as a thin launcher that renders the shell package.
- Preserve existing routes, providers, layout composition, and styles.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for shell package and web dependency checks.

**Step 5: Commit**

```bash
git add packages/claw-studio-shell packages/claw-studio-web
git commit -m "refactor: extract cross-platform application shell"
```

### Task 3: Add a dedicated desktop package and frontend desktop bootstrap

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\package.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\tsconfig.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\vite.config.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\index.html`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\main.tsx`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\bootstrap\createDesktopApp.tsx`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\providers\DesktopProviders.tsx`

**Step 1: Write the failing test**
- Extend the architecture check to assert:
  - desktop package exists
  - desktop package depends on `@sdkwork/claw-studio-shell`
  - desktop package includes `src/main.tsx`

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because desktop package files do not exist.

**Step 3: Write minimal implementation**
- Create the desktop package as a launcher package.
- Render the shared shell package inside desktop-specific providers.
- Reuse the same CSS source model as the web package so UI remains identical.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for desktop frontend scaffold checks.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop
git commit -m "feat: add desktop launcher package"
```

### Task 3.5: Add the distribution package and region manifests

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\package.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\tsconfig.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\src\index.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\src\manifests\cn\index.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\src\manifests\global\index.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\src\providers\cn\index.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-distribution\src\providers\global\index.ts`

**Step 1: Write the failing test**
- Extend the architecture check to assert:
  - distribution package exists
  - `cn` and `global` manifests exist
  - shell or launcher packages can import a distribution entry

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the distribution package does not exist.

**Step 3: Write minimal implementation**
- Create distribution package with minimal manifest and provider registry for `cn` and `global`.
- Keep the initial manifests config-only.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for distribution scaffold files.

**Step 5: Commit**

```bash
git add packages/claw-studio-distribution
git commit -m "feat: add distribution manifests for cn and global"
```

### Task 4: Add a failing bridge contract test and remove direct page-level Tauri imports

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\contracts\runtime.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\contracts\installer.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\registry.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\index.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\removed-install-feature\src\pages\install\Install.tsx`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\removed-install-feature\src\pages\install\InstallDetail.tsx`

**Step 1: Write the failing test**
- Extend the architecture check to assert:
  - install pages do not import `@tauri-apps/api/core`
  - infrastructure exports installer and runtime bridge contracts

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because install pages currently import `@tauri-apps/api/core`.

**Step 3: Write minimal implementation**
- Introduce platform bridge contracts for runtime and installer capability.
- Move Tauri access behind desktop bridge code.
- Make install pages call services instead of raw `invoke`.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for no direct Tauri page imports.

**Step 5: Commit**

```bash
git add packages/claw-studio-infrastructure packages/removed-install-feature
git commit -m "refactor: move tauri access behind platform bridge contracts"
```

### Task 5: Add business-level installer and runtime services

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\services\installerService.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\services\runtimeService.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\index.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\package.json`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\removed-install-feature\src\services\index.ts`

**Step 1: Write the failing test**
- Extend the architecture check to assert:
  - business package exports `installerService`
  - business package exports `runtimeService`
  - install package exports its services index with runtime or installer integration

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because those services do not exist yet.

**Step 3: Write minimal implementation**
- Add business services that wrap bridge contracts.
- Keep method names aligned with future runtime and installer commands.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for business service exports.

**Step 5: Commit**

```bash
git add packages/claw-studio-business packages/removed-install-feature
git commit -m "feat: add runtime and installer business services"
```

### Task 6: Add the minimum Tauri Rust scaffold

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\Cargo.toml`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\tauri.conf.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\main.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\lib.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\mod.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\mod.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\capabilities\main.json`

**Step 1: Write the failing test**
- Extend the architecture check to assert:
  - `Cargo.toml`, `tauri.conf.json`, `main.rs`, and `lib.rs` exist
  - capability file exists

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because Rust scaffold files do not exist.

**Step 3: Write minimal implementation**
- Add a compile-ready Tauri shell.
- Register the minimum plugin set and command module wiring.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for Rust scaffold files.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri
git commit -m "feat: add tauri desktop runtime scaffold"
```

### Task 7: Add path, config, logging, and event infrastructure

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\error.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\runtime.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\context.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\paths.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\config.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\logging.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\events.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\policy.rs`

**Step 1: Write the failing test**
- Extend the architecture check to assert those core framework files exist.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the framework layer is incomplete.

**Step 3: Write minimal implementation**
- Add the error model, blocking runtime helper, path resolution, config IO, logging bootstrap, and event constants.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for framework core files.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework
git commit -m "feat: add tauri framework core services"
```

### Task 8: Add runtime and installer command boundaries

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\runtime.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\installer.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\jobs.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\runtime_commands.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\installer_commands.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\job_commands.rs`

**Step 1: Write the failing test**
- Extend the architecture check to assert runtime, installer, and job command files exist.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the command/service files do not exist yet.

**Step 3: Write minimal implementation**
- Add thin commands for runtime probing, installer execution, and job inspection.
- Keep internal implementations minimal but structurally correct.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for command layer files.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/commands packages/claw-studio-desktop/src-tauri/src/framework/services
git commit -m "feat: add runtime and installer command boundaries"
```

### Task 9: Add updater, plugin registration, and capability scaffolding

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\plugins\mod.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\updater.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\updater_commands.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\capabilities\updater.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\capabilities\installer.json`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\capabilities\logs.json`

**Step 1: Write the failing test**
- Extend the architecture check to assert updater files and capability files exist.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because updater and plugin scaffold is missing.

**Step 3: Write minimal implementation**
- Register the minimum plugin set with window-scoped capabilities.
- Add updater command placeholders wired into the builder.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for updater and capability scaffolding.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/plugins packages/claw-studio-desktop/src-tauri/src/app packages/claw-studio-desktop/src-tauri/capabilities
git commit -m "feat: add updater and capability scaffolding"
```

### Task 10: Wire root scripts, build verification, and desktop package commands

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\package.json`
- Modify: `D:\sdkwork-opensource\claw-studio\pnpm-workspace.yaml`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\package.json`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-shell\package.json`

**Step 1: Write the failing test**
- Extend the architecture check to assert:
  - root scripts include desktop-oriented scripts
  - desktop package defines build and dev scripts

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because root and desktop command wiring is incomplete.

**Step 3: Write minimal implementation**
- Add root scripts for `desktop:dev`, `desktop:build`, `check:desktop`, and package-level desktop commands.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for script wiring checks.

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml packages/claw-studio-desktop/package.json packages/claw-studio-shell/package.json
git commit -m "build: add desktop workspace scripts"
```

### Task 11: Run verification for the first completed vertical slice

**Files:**
- Verify only

**Step 1: Run architecture checks**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

**Step 2: Run workspace architecture checks**

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 3: Run TypeScript validation**

Run: `pnpm lint`
Expected: PASS

**Step 4: Run production build**

Run: `pnpm build`
Expected: PASS for the web shell

**Step 5: Run desktop package build smoke check**

Run: `pnpm --filter @sdkwork/claw-studio-desktop build`
Expected: PASS for the desktop frontend scaffold

**Step 6: Commit**

```bash
git add .
git commit -m "chore: verify desktop platform foundation slice"
```

### Task 12: Extend the platform into managed runtimes and installable packages

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\package_manager.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\package_registry.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\launcher.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\health.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\system_commands.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\config_commands.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\log_commands.rs`

**Step 1: Write the failing test**
- Extend the architecture check to assert managed runtime and package service files exist.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the runtime and package platform files are incomplete.

**Step 3: Write minimal implementation**
- Add manifest-driven package registration for `openclaw` and `codex`.
- Add managed runtime file layout and launcher abstractions.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for the platform package model scaffold.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src
git commit -m "feat: scaffold managed runtimes and platform package model"
```

### Task 13: Add release documentation and operator guidance

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\AGENTS.md`
- Create: `D:\sdkwork-opensource\claw-studio\docs\desktop-release.md`
- Create: `D:\sdkwork-opensource\claw-studio\docs\desktop-runtime-model.md`

**Step 1: Write the failing test**
- Extend the architecture check to assert the desktop release and runtime docs exist.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because those docs do not exist yet.

**Step 3: Write minimal implementation**
- Document runtime profiles, update sources, package manifests, and release commands.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for documentation checks.

**Step 5: Commit**

```bash
git add AGENTS.md docs/desktop-release.md docs/desktop-runtime-model.md
git commit -m "docs: add desktop platform operator guidance"
```

### Task 14: Document regional release strategy

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\docs\distribution-cn-vs-global.md`
- Modify: `D:\sdkwork-opensource\claw-studio\docs\desktop-release.md`

**Step 1: Write the failing test**
- Extend the architecture check to assert the regional distribution doc exists.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the distribution release doc does not exist yet.

**Step 3: Write minimal implementation**
- Document manifest differences, mirror policies, update sources, and release channels for `cn` and `global`.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for regional release documentation.

**Step 5: Commit**

```bash
git add docs/distribution-cn-vs-global.md docs/desktop-release.md
git commit -m "docs: add regional distribution release guidance"
```
