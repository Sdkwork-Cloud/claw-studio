# Install Claw Platform-Aware Install, Uninstall, And Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OS-aware install options, a first-class OpenClaw uninstall flow, and an interactive OpenClaw migration flow to the Install Claw page.

**Architecture:** Keep the existing `/install` route and page, but add a top-level mode switch for install, uninstall, and migrate. Use the runtime platform API for client-side method filtering, add a new desktop uninstall bridge backed by the vendored hub-installer runtime and registry manifests, and implement migration with existing runtime/filesystem APIs.

**Tech Stack:** React, TypeScript, Tauri, Rust, hub-installer registry manifests, i18next.

---

### Task 1: Lock The New Product Contract In Tests

**Files:**
- Modify: `scripts/sdkwork-install-contract.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- runtime platform detection in the install page
- `Install` / `Uninstall` / `Migrate` tabs
- OpenClaw `WSL` install and uninstall support
- migration interaction hooks such as source selection and filesystem copy
- uninstall contract exposure in infrastructure and desktop bridge
- WSL registry manifest and OpenClaw uninstall lifecycle manifests

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because the current install page and bridge do not expose the new behavior yet.

**Step 3: Write minimal implementation**

Do not implement here. Move to the next tasks after confirming the failure.

**Step 4: Run test to verify it still fails for the intended reason**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL with missing install/uninstall/migrate behavior.

### Task 2: Add Desktop Uninstall Bridge Support

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/installerService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webInstaller.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_uninstall.rs`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Add uninstall request/result types and `runHubUninstall` to the shared installer contract.
- Expose uninstall in the infrastructure service.
- Add desktop command and bridge wiring.
- Back the Tauri command with `InstallEngine::uninstall_from_registry_with_observer`.

**Step 4: Run test to verify it passes further**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: it should fail later on missing UI or manifest changes, not on missing uninstall contract wiring.

### Task 3: Add WSL And OpenClaw Uninstall Registry Support

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw.hub.yaml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-npm.hub.yaml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-pnpm.hub.yaml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml`
- Create: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-wsl.hub.yaml`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Add a Windows-only WSL OpenClaw registry entry and manifest.
- Add uninstall lifecycle sections for OpenClaw manifests that need them.

**Step 4: Run test to verify it passes further**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: remaining failures should be install page UI behavior only.

### Task 4: Rebuild The Install Page As Platform-Aware Install, Uninstall, And Migration UX

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Add `Install` / `Uninstall` / `Migrate` top tabs.
- Detect runtime OS and filter method cards accordingly.
- Remove the old recommended/local OpenClaw card.
- Add OpenClaw WSL, Docker, npm, pnpm, Source, and disabled Cloud cards.
- Keep a focused OpenClaw uninstall view with detected installation summary and uninstall actions.
- Add a migration flow that scans known OpenClaw paths, accepts a custom source directory, lets the user choose import sections, and copies the selected data into Claw Studio-managed destinations.
- Reuse the shared progress modal for install and uninstall.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS.

### Task 5: Full Verification And Delivery

**Files:**
- Review: `git diff --stat`

**Step 1: Run focused verification**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS.

**Step 2: Run workspace verification**

Run: `pnpm lint`
Expected: PASS.

**Step 3: Run production build**

Run: `pnpm build`
Expected: PASS.

**Step 4: Commit**

```bash
git add scripts/sdkwork-install-contract.test.ts \
  packages/sdkwork-claw-install/src/pages/install/Install.tsx \
  packages/sdkwork-claw-i18n/src/locales/en.json \
  packages/sdkwork-claw-i18n/src/locales/zh.json \
  packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts \
  packages/sdkwork-claw-infrastructure/src/services/installerService.ts \
  packages/sdkwork-claw-infrastructure/src/platform/webInstaller.ts \
  packages/sdkwork-claw-desktop/src/desktop/catalog.ts \
  packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts \
  packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs \
  packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs \
  packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_uninstall.rs \
  packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml \
  packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw.hub.yaml \
  packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-npm.hub.yaml \
  packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-pnpm.hub.yaml \
  packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml \
  packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-wsl.hub.yaml \
  docs/plans/2026-03-19-install-claw-platform-uninstall-design.md \
  docs/plans/2026-03-19-install-claw-platform-uninstall-implementation-plan.md
git commit -m "feat: add install claw management workflows"
```
