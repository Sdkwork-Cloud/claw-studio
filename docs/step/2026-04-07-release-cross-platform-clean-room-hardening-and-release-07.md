# Release Cross-Platform Clean-Room Hardening And Release 07

## Objective

- Close the remaining clean-room release blockers that only appeared after the IM SDK release-source fixes from `release-2026-04-07-06`.
- Prove the release flow works on both the native Windows workspace and a Linux/WSL clean-room verification clone.
- Record the final pre-release verification evidence for the next carried-forward release candidate.

## Problems Found

1. `scripts/release/smoke-desktop-installers.mjs` imported the vendored `hub-installer/dist/index.mjs` at module load time, so clean-room verification failed before tests could inject synthetic installer bindings.
2. `packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json` existed only as an ignored local file, which made Windows-local checks pass while Linux clean-room verification lacked the tracked Windows desktop runtime contract.
3. `scripts/package-release-assets.test.mjs` assumed tar archives would never emit PAX or GNU long-path metadata, which was false on Linux for nested release bundle files.
4. `scripts/release/smoke-desktop-packaged-launch.test.mjs` inherited the host platform by default, so the packaged Windows launch smoke scenario failed when the same test was executed on Linux.
5. Multiple release CLI entrypoints treated explicit Windows paths such as `D:/synthetic/release-assets` and `D:/synthetic/desktop-startup-evidence.json` as relative paths on Linux because they called `path.resolve()` directly on a non-Windows host.

## Root Cause Evidence

### Lazy installer binding failure

1. In the WSL verification clone, `node --test scripts/release/smoke-desktop-installers.test.mjs` could fail during module import even when tests injected `createInstallPlanFn` and `detectFormatFn`.
2. The root cause was a top-level import of the vendored hub-installer `dist/index.mjs`, which should only be required in the real release flow after the vendored package has been materialized.

### Missing tracked Windows desktop config

1. The Windows repository contained `packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json`, but `git status` showed it as untracked because `packages/sdkwork-claw-desktop/src-tauri/.gitignore` ignored it.
2. The Linux clean-room workspace therefore could not validate the Windows desktop configuration contract that the release flow depends on.

### Linux tar metadata drift

1. `node --test scripts/package-release-assets.test.mjs` passed on Windows but failed in Linux clean-room verification once `tar` emitted long-path metadata records for nested bundle files.
2. The test helper only understood plain ustar entries and dropped PAX/GNU long-path metadata, which corrupted the expected file list.

### Cross-platform CLI path drift

1. In WSL, `node --test scripts/release/smoke-desktop-startup-evidence.test.mjs` failed because `parseArgs()` rewrote `D:/synthetic/desktop-startup-evidence.json` into `/home/sdkwork/.../D:/synthetic/desktop-startup-evidence.json`.
2. In the same WSL workspace, `node --test scripts/release/local-release-command.test.mjs` failed for both `startupEvidencePath` and `releaseAssetsDir` for the same reason.
3. The root cause was shared across release entrypoints: explicit Windows absolute paths were not recognized as absolute when the host platform was Linux.

## Changes Landed

### Release automation hardening

- Refactored `scripts/release/smoke-desktop-installers.mjs` to resolve the vendored hub-installer lazily through:
  - `resolveHubInstallerDistEntryPath`
  - `resolveHubInstallerVendorDir`
  - `ensureHubInstallerDistReady`
  - `loadHubInstallerModule`
  - `resolveHubInstallerBindings`
- Added regression coverage in `scripts/release/smoke-desktop-installers.test.mjs` so injected installer functions no longer require vendored dist output at import time.
- Added `scripts/release/path-inputs.mjs` and `scripts/release/path-inputs.test.mjs` to preserve explicit Windows drive and UNC paths across non-Windows release hosts.
- Updated these release entrypoints to use the shared path resolver:
  - `scripts/release/local-release-command.mjs`
  - `scripts/release/package-release-assets.mjs`
  - `scripts/release/smoke-desktop-installers.mjs`
  - `scripts/release/smoke-desktop-packaged-launch.mjs`
  - `scripts/release/smoke-desktop-startup-evidence.mjs`
  - `scripts/release/smoke-server-release-assets.mjs`
  - `scripts/release/smoke-deployment-release-assets.mjs`

### Desktop contract fixes

- Removed `packages/sdkwork-claw-desktop/src-tauri/.gitignore` so the Windows-specific Tauri config can be tracked.
- Added `packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json` to the repository.
- Extended `scripts/check-desktop-platform-foundation.mjs` and `scripts/release-flow-contract.test.mjs` so release verification now requires the tracked Windows desktop config.

### Cross-platform test fixture fixes

- Updated `scripts/run-claw-server-build.test.mjs` to resolve the WSL path expectation dynamically instead of hard-coding `/mnt/d/...`.
- Hardened `scripts/package-release-assets.test.mjs` to understand PAX and GNU long-path tar records.
- Fixed `scripts/release/smoke-desktop-packaged-launch.test.mjs` so the packaged launch smoke scenario uses an explicit Windows host target when it is verifying packaged Windows startup evidence.

## Verification

Fresh commands run in this loop:

```bash
node --test scripts/release/path-inputs.test.mjs
node --test scripts/release/smoke-desktop-startup-evidence.test.mjs
node --test scripts/release/local-release-command.test.mjs
pnpm lint
wsl.exe -d Ubuntu-22.04 -- bash -lc "cd /home/sdkwork/spring-ai-plus-business/apps/claw-studio && export CI=1 && export SDKWORK_SHARED_SDK_MODE=git && corepack pnpm lint"
pnpm build
pnpm docs:build
pnpm check:server
pnpm check:desktop
```

Observed result:

1. The targeted startup-evidence and local-release command regressions now pass on both Windows and WSL.
2. Full `pnpm lint` passes on Windows and in the Linux clean-room verification clone.
3. `pnpm build` and `pnpm docs:build` both succeed from the workspace root.
4. `pnpm check:server` passes with the server platform foundation check plus Rust test suites.
5. `pnpm check:desktop` passes with desktop foundation checks, Tauri Rust tests, hosted runtime tests, OpenClaw release-asset verification, and Windows bundle contract checks.

## Status

- `release-2026-04-07-06` is now clearly a failed unpublished attempt and should not remain the active release candidate.
- The next carried-forward candidate is `release-2026-04-07-07`.
- Remaining operational work: commit the workspace changes on `main`, push them, create `release-2026-04-07-07`, publish the GitHub Release, and then mark the release registry entry as published after GitHub confirms success.
