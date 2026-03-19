# Desktop Tray IA And Host I18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the desktop tray easier to understand by promoting `Open Window` to the first level and localize tray labels from a real host-level language preference that can follow system language.

**Architecture:** Keep tray creation in the Tauri host, add a normalized `language` field to the desktop config, introduce a Tauri command for updating that preference, and sync it from the shared language manager so web UI and tray stay aligned without depending on page storage.

**Tech Stack:** Tauri 2, Rust, React, Zustand, existing workspace i18n package.

---

### Task 1: Add host language config tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`

**Step 1: Write the failing test**

Add Rust tests for:

- default config language being `system`
- config normalization collapsing `zh-CN` to `zh`
- public projection exposing the normalized language preference

**Step 2: Run test to verify it fails**

Run: `cargo test language --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because the config does not yet model language preference.

**Step 3: Write minimal implementation**

Add the `language` field, normalization helpers, and public projection support.

**Step 4: Run test to verify it passes**

Run: `cargo test language --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

### Task 2: Add tray IA and localization tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

**Step 1: Write the failing test**

Add Rust tests for:

- `Open Window` staying at the first tray level
- tray labels switching between English and Simplified Chinese
- system-locale fallback selecting the correct tray language

**Step 2: Run test to verify it fails**

Run: `cargo test tray --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because the tray is still hard-coded and not modeled for localization.

**Step 3: Write minimal implementation**

Introduce tray label helpers, tray menu specs, and a tray refresh path that rebuilds the menu when the host language changes.

**Step 4: Run test to verify it passes**

Run: `cargo test tray --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

### Task 3: Add host update command and frontend sync

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/set_app_language.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/state/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/get_app_config.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/storage_commands.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/index.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx`
- Modify: `packages/sdkwork-claw-core/src/stores/useAppStore.ts`
- Modify: `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`

**Step 1: Write the failing test**

Add contract checks for:

- `set_app_language` being exposed through the desktop command catalog and bridge
- `LanguageManager` syncing the preference back to the desktop host
- settings supporting a `system` language preference

**Step 2: Run test to verify it fails**

Run: `node scripts/desktop-window-chrome-contract.test.mjs`

Expected: FAIL because the desktop bridge and settings flow do not yet support host language sync.

**Step 3: Write minimal implementation**

Add the command, mutable runtime config access, the new bridge API, and the settings/store sync.

**Step 4: Run test to verify it passes**

Run: `node scripts/desktop-window-chrome-contract.test.mjs`

Expected: PASS

### Task 4: Run package verification

**Files:**
- Modify: touched files only as needed for cleanup

**Step 1: Write the failing test**

No new test for this task.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sdkwork/claw-desktop lint`

Expected: surfacing any typing or API mismatches.

**Step 3: Write minimal implementation**

Fix only the remaining issues required to make the desktop package consistent.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sdkwork/claw-desktop lint
pnpm --filter @sdkwork/claw-desktop build
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
node scripts/desktop-window-chrome-contract.test.mjs
```

Expected: all commands exit successfully.
