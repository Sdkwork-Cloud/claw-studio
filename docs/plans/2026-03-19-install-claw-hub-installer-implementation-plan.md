# Install Claw Hub Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the script-based install flow with a hub-installer-backed Install Claw experience on `main`, while updating the UI to install OpenClaw, ZeroClaw, and IronClaw from one tabbed page.

**Architecture:** The frontend stops sending raw shell commands and instead sends structured install requests through the shared installer platform contract. The Tauri backend owns hub-installer-rs integration, emits structured progress events, and returns structured results. The install feature then renders product tabs, method cards, and live progress from that new contract.

**Tech Stack:** React, TypeScript, i18next, Tauri 2, Rust, hub-installer-rs, workspace contract scripts, cargo tests

---

### Task 1: Lock the new install requirements with failing tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts/sdkwork-install-contract.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts/sdkwork-shell-contract.test.ts`

**Step 1: Write the failing test**

- Assert the install page source no longer references `MobileAppDownloadSection`.
- Assert the install page source contains product tabs for `openclaw`, `zeroclaw`, and `ironclaw`.
- Assert the install feature uses a hub-installer request instead of `executeInstallScript`.
- Assert sidebar install copy uses `Install Claw`.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

**Step 3: Write minimal implementation**

- Update tests only in this task.

**Step 4: Run test to verify it passes**

- Keep both scripts green before moving on.

### Task 2: Replace installer platform contracts with hub-installer requests and results

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\platform\contracts\installer.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\installerService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\platform\webInstaller.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src\desktop\catalog.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src\desktop\tauriBridge.ts`

**Step 1: Write the failing test**

- Extend the contract tests to require `runHubInstall`, structured progress subscription, and structured install result usage.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Introduce typed hub-installer request/result/progress models.
- Replace raw string command methods in the shared installer service and desktop bridge.
- Keep the web fallback explicit and non-functional.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

### Task 3: Vendor hub-installer-rs and registry assets into Tauri

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\...`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\Cargo.toml`

**Step 1: Write the failing test**

- Add a Rust command test that expects a structured hub-installer request to resolve a local registry source and reject invalid empty software names.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml hub_install`

**Step 3: Write minimal implementation**

- Vendor the upstream Rust crate and registry assets locally.
- Add a path dependency from the desktop Tauri crate.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml hub_install`

### Task 4: Replace the Tauri install command with hub-installer execution and progress events

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\commands\run_hub_install.rs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\commands\mod.rs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\app\bootstrap.rs`

**Step 1: Write the failing test**

- Add unit tests for request validation and registry path resolution in the new command module.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml run_hub_install`

**Step 3: Write minimal implementation**

- Emit hub-installer progress to a dedicated Tauri event.
- Return structured install results from `InstallEngine::install_from_registry_with_observer`.
- Remove the old `execute_install_script` command from the active install flow.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml run_hub_install`

### Task 5: Refactor the Install page into tabbed product installs

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\pages\install\Install.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\pages\install\InstallDetail.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

**Step 1: Write the failing test**

- Require the install page to render `openclaw`, `zeroclaw`, and `ironclaw` tabs.
- Require the install page to use hub-installer data instead of embedded shell commands.
- Require the old mobile continuation section to be absent.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Remove `MobileAppDownloadSection` from the install page.
- Add product tabs with `openclaw` as the default.
- Convert the install cards to product-aware hub-installer software mappings.
- Render structured progress and final results instead of raw shell output.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

### Task 6: Update shell copy and verify the integrated result

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

**Step 1: Write the failing test**

- Require sidebar install label text to be `Install Claw` in the shell contract script.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

**Step 3: Write minimal implementation**

- Update sidebar copy and any install hero copy that still says `Install Claw Studio`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

### Task 7: Full verification

**Files:**
- Verify only

**Step 1: Run focused verification**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml run_hub_install`

**Step 2: Run workspace verification**

Run: `pnpm lint`

Run: `pnpm build`

**Step 3: Commit**

```bash
git add packages/sdkwork-claw-install packages/sdkwork-claw-i18n packages/sdkwork-claw-shell packages/sdkwork-claw-infrastructure packages/sdkwork-claw-desktop docs/plans/2026-03-19-install-claw-hub-installer-implementation-plan.md scripts/sdkwork-install-contract.test.ts scripts/sdkwork-shell-contract.test.ts
git commit -m "feat: integrate install claw with hub-installer"
```
