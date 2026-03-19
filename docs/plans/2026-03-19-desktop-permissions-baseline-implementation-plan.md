# Desktop Permissions Baseline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Tauri desktop permission regression around custom window controls and standardize a safe desktop permissions baseline for window, dialog, browser, media, and notification access surfaces.

**Architecture:** Keep Tauri capability grants limited to the commands the desktop bridge actually invokes, and express the wider desktop permission story through kernel metadata so the app can distinguish between granted, managed, and still-planned access surfaces. Avoid blanket permission expansion for camera, microphone, or native notifications until dedicated adapters exist.

**Tech Stack:** Tauri v2 capability files, Rust desktop services, TypeScript contract tests, Node-based repository checks

---

### Task 1: Lock the missing permission regression with failing tests

**Files:**
- Modify: `scripts/desktop-window-chrome-contract.test.mjs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/permissions.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/notifications.rs`

**Step 1: Write the failing test**

Expand the window capability contract to require:

- `core:window:allow-is-fullscreen`
- `core:window:allow-is-maximized`
- `core:window:allow-maximize`
- `core:window:allow-unmaximize`

Add Rust unit tests that require:

- explicit granted entries for window chrome controls and state inspection
- explicit granted entries for open/save file dialogs
- explicit granted and planned media permission entries
- notification metadata to report native desktop delivery as planned until a real adapter exists

**Step 2: Run test to verify it fails**

Run:

- `node scripts/desktop-window-chrome-contract.test.mjs`
- `cargo test permission_service`
- `cargo test native_`

Expected: at least the window capability contract fails before the capability file is updated.

**Step 3: Write minimal implementation**

Patch the capability file and Rust services only where the tests prove the baseline is missing or inconsistent.

**Step 4: Run test to verify it passes**

Re-run the same commands and confirm they pass.

### Task 2: Grant the exact Tauri window permissions used by the desktop bridge

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/capabilities/default.json`
- Verify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

**Step 1: Confirm bridge usage**

Map the bridge calls to required permissions:

- `currentWindow.maximize()`
- `currentWindow.unmaximize()`
- `currentWindow.isMaximized()`
- `currentWindow.isFullscreen()`
- `currentWindow.setFullscreen(false)`

**Step 2: Add only the required grants**

Keep the capability scoped to the `main` window and add only the missing permissions needed by the custom desktop title bar.

**Step 3: Re-run the contract**

Run:

- `node scripts/desktop-window-chrome-contract.test.mjs`

Expected: pass.

### Task 3: Standardize the desktop permission baseline metadata

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/permissions.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/notifications.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`

**Step 1: Add explicit baseline entries**

Expose permission entries for:

- `window.chromeControls`
- `window.stateInspection`
- `dialog.fileOpen`
- `dialog.fileSave`
- `browser.externalHttp`
- `filesystem.managedRoots`
- `process.restrictedSpawn`
- `media.audioPlayback`
- `media.videoPlayback`
- `media.cameraCapture`
- `media.microphoneCapture`
- `notifications.userConsent`

**Step 2: Keep risky/native adapters in planned state**

Do not mark camera, microphone, or native notifications as ready until there is a dedicated runtime adapter and product flow.

**Step 3: Align kernel capability reporting**

Update the kernel permissions domain so it reports the permission baseline as a ready part of the desktop foundation instead of a future-only placeholder.

### Task 4: Run repository verification and capture any unrelated warnings separately

**Files:**
- No additional files unless verification exposes a real regression in this scope

**Step 1: Run desktop verification**

Run:

- `pnpm check:desktop`

Expected: pass.

**Step 2: Run broader workspace verification**

Run:

- `pnpm lint`
- `pnpm build`

Expected: pass if the broader repository baseline is healthy. If unrelated warnings or failures exist, report them separately from this permissions change.
