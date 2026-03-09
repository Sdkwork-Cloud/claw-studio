# Claw Studio Local Tauri Packaging Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize the workspace around a real local Tauri packaging workflow with root `tauri:*` commands, a package-scoped desktop CLI entry, a minimal Rust command boundary, and repo hygiene that supports future Node/Python runtime integration.

**Architecture:** Keep `@sdkwork/claw-studio-desktop` as the only Tauri runtime package. The workspace root exposes proxy scripts, the desktop package owns Tauri CLI integration, and `src-tauri` gains only the minimum `app -> commands/state/platform` layering required to support `tauri:dev`, `tauri:build`, `tauri:icon`, and `tauri:info`. Frontend pages remain decoupled from native command names through the existing desktop bridge.

**Tech Stack:** pnpm workspace, React 19, TypeScript 5, Vite 6, Tauri v2, Rust, architecture checks under `scripts/`

---

### Task 1: Extend the desktop architecture check for the local Tauri workflow

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\scripts\check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**
- Add assertions that verify:
  - root `package.json` contains `tauri:dev`, `tauri:build`, `tauri:icon`, and `tauri:info`
  - `packages/claw-studio-desktop/package.json` contains matching package-level scripts
  - the desktop package depends on `@tauri-apps/cli`
  - `src-tauri/src/commands/app_info.rs`, `src-tauri/src/state/mod.rs`, and `src-tauri/src/platform/mod.rs` exist

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the script entries, CLI dependency, and Rust module files do not exist yet.

**Step 3: Write minimal implementation**

```js
assertScript(rootPackage, 'tauri:dev');
assertScript(rootPackage, 'tauri:build');
assertScript(rootPackage, 'tauri:icon');
assertScript(rootPackage, 'tauri:info');
```

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS after later tasks add the required files and scripts.

**Step 5: Commit**

```bash
git add scripts/check-desktop-platform-foundation.mjs
git commit -m "test: extend desktop workflow architecture checks"
```

### Task 2: Add root workspace Tauri workflow scripts

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\package.json`

**Step 1: Write the failing test**
- Use the updated architecture check from Task 1.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because root Tauri workflow scripts are still missing.

**Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "tauri:dev": "pnpm --filter @sdkwork/claw-studio-desktop run tauri:dev",
    "tauri:build": "pnpm --filter @sdkwork/claw-studio-desktop run tauri:build",
    "tauri:icon": "pnpm --filter @sdkwork/claw-studio-desktop run tauri:icon",
    "tauri:info": "pnpm --filter @sdkwork/claw-studio-desktop run tauri:info"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for root script assertions and continue failing on desktop package gaps.

**Step 5: Commit**

```bash
git add package.json
git commit -m "build: add root tauri workflow scripts"
```

### Task 3: Add package-scoped Tauri CLI scripts to the desktop package

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\package.json`

**Step 1: Write the failing test**
- Re-run the architecture check and confirm it still fails on desktop package script and dependency assertions.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because `@tauri-apps/cli` and package-level Tauri scripts are missing.

**Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:icon": "tauri icon src-tauri/icons/app-icon.png",
    "tauri:info": "tauri info"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

- Keep existing `dev`, `build`, `preview`, and `lint` scripts intact.
- If no source icon exists yet, replace the icon command with the project-approved source asset path during implementation instead of inventing a new location.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for desktop package script and dependency assertions.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/package.json
git commit -m "build: add desktop tauri cli workflow scripts"
```

### Task 4: Add the minimum Rust desktop module layout and native app info command

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\lib.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\app\bootstrap.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\app_info.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\commands\mod.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\state\mod.rs`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\platform\mod.rs`

**Step 1: Write the failing test**
- Re-run the architecture check and confirm it fails because the new Rust module files do not exist.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the Rust command and module layout has not been added yet.

**Step 3: Write minimal implementation**

```rust
#[derive(serde::Serialize)]
pub struct AppInfo {
  pub name: String,
  pub version: String,
  pub target: String,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
  AppInfo {
    name: "Claw Studio".into(),
    version: env!("CARGO_PKG_VERSION").into(),
    target: std::env::consts::OS.into(),
  }
}
```

```rust
pub fn build() -> tauri::Builder<tauri::Wry> {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![commands::app_info::app_info])
}
```

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for the required Rust module and command files.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src
git commit -m "feat: add minimal tauri app info command surface"
```

### Task 5: Extend the desktop frontend bridge to consume native app info without page coupling

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\tauriBridge.ts`

**Step 1: Write the failing test**
- Add an assertion in the architecture check that the bridge exports a desktop-native app info accessor.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the bridge does not yet expose the native metadata command.

**Step 3: Write minimal implementation**

```ts
export async function getAppInfo() {
  return invoke<AppInfo>('app_info');
}
```

- Guard the call with the existing Tauri runtime detection so the bridge remains safe in non-Tauri contexts.
- Do not wire this directly into page components in this task; the goal is command boundary stability, not UI behavior changes.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for the bridge export assertion.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src/desktop/tauriBridge.ts scripts/check-desktop-platform-foundation.mjs
git commit -m "refactor: expose app info through desktop bridge"
```

### Task 6: Harden ignore rules for desktop and future runtime tooling

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\.gitignore`

**Step 1: Write the failing test**
- Add assertions in the architecture check for `.venv/`, `__pycache__/`, `.pytest_cache/`, `.cache/`, and `*.pyc`.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the ignore patterns are missing.

**Step 3: Write minimal implementation**

```gitignore
.venv/
venv/
env/
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
.ruff_cache/
.cache/
*.pid
*.seed
```

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for the ignore-rule assertions.

**Step 5: Commit**

```bash
git add .gitignore scripts/check-desktop-platform-foundation.mjs
git commit -m "chore: extend ignore rules for runtime tooling"
```

### Task 7: Verify the local Tauri packaging workflow end to end

**Files:**
- Verify only

**Step 1: Run architecture checks**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

**Step 2: Run workspace boundary checks**

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 3: Run TypeScript validation**

Run: `pnpm lint`
Expected: PASS

**Step 4: Run desktop environment inspection**

Run: `pnpm tauri:info`
Expected: exit 0 and environment details from the Tauri CLI

**Step 5: Run desktop bundle build**

Run: `pnpm tauri:build`
Expected: exit 0 and generated platform bundle or installer artifacts

**Step 6: Commit**

```bash
git add .
git commit -m "chore: verify local tauri packaging workflow"
```
