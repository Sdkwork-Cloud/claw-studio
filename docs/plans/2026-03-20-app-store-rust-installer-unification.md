# App Store Rust Installer Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `hub-installer` the single installation engine, convert the TypeScript app store into a thin platform-aware bridge, and expose dependency inspection plus dependency-only install before the final app install flow.

**Architecture:** Keep app catalog metadata and platform variant selection in `@sdkwork/claw-apps`, but route every dependency inspection, dependency installation, install, and uninstall action through the shared infrastructure installer bridge backed by Rust. Expand the bundled app catalog toward developer-focused packages and extend the vendor `hub-installer` registry with platform-aware manifests for common base tools such as `npm`, `pnpm`, and `brew`.

**Tech Stack:** React 19, TypeScript, node `--experimental-strip-types` contract tests, Tauri installer bridge, Rust `hub-installer`, YAML manifests.

---

### Task 1: Lock the new app-store installer contract with failing tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-apps-contract.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\services\appStoreService.test.ts`

**Step 1: Write the failing test**

- Require `appStoreService` to use the shared installer bridge rather than timer-based fake install loops.
- Require a local install catalog module for platform-aware app definitions.
- Require built-in installable developer packages including `npm`, `pnpm`, and `brew`.
- Require app install service methods for inspection and dependency-only install.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
Expected: FAIL because the service still uses simulated install timers and has no install catalog.

Run: `node --experimental-strip-types packages/sdkwork-claw-apps/src/services/appStoreService.test.ts`
Expected: FAIL because the new platform-aware install contract does not exist yet.

**Step 3: Write minimal implementation**

Do not implement production code in this task. Move to the catalog and service tasks after the red state is confirmed.

**Step 4: Re-run the failing tests**

Run: `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
Expected: FAIL for the same missing installer integration reasons, not unrelated import errors.

### Task 2: Add a platform-aware app install catalog with TDD

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\services\appInstallCatalog.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\services\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\services\appStoreService.test.ts`

**Step 1: Write the failing test**

Cover:

- host platform resolution for Windows, macOS, and Ubuntu
- host plus runtime variants such as Windows host with WSL runtime
- default software mapping from app IDs to Rust registry entries
- built-in catalog coverage for developer tools and package managers

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-apps/src/services/appStoreService.test.ts`
Expected: FAIL because the catalog and variant helpers do not exist yet.

**Step 3: Write minimal implementation**

- Define install catalog types
- Add developer-focused catalog entries
- Implement host platform normalization and variant selection helpers
- Export catalog helpers from the feature package root

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-apps/src/services/appStoreService.test.ts`
Expected: PASS for the catalog-specific assertions.

### Task 3: Refactor the app store service into a Rust-backed thin bridge

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\services\appStoreService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\studioMockService.ts`

**Step 1: Use the failing tests as the guide**

Run: `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
Expected: FAIL

**Step 2: Replace fake install behavior**

- Preserve `studioMockService` only for catalog content retrieval
- Add service methods for:
  - install inspection
  - dependency-only installation
  - final installation
  - uninstall
- Resolve the platform-aware `HubInstallRequest` from the local catalog
- Call infrastructure `installerService.inspectHubInstall`, `runHubDependencyInstall`, `runHubInstall`, and `runHubUninstall`

**Step 3: Refresh the app-store catalog content**

- Seed developer-oriented built-in apps that map cleanly to registry software names
- Keep category/top-chart surfaces working with the new seeded apps

**Step 4: Run contract verification**

Run: `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
Expected: PASS

### Task 4: Wire app-store UI to the shared install flow

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\pages\apps\AppStore.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\pages\apps\AppDetail.tsx`
- Optionally create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-apps\src\services\appInstallProgress.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

**Step 1: Remove local simulation**

- Delete timer-driven download and install progress simulation
- Load real install readiness from the service
- Show dependency status and installer readiness in the detail page

**Step 2: Add real actions**

- Route store “Get” actions into the selected app detail
- Support dependency-only install from the detail page when auto-remediation is available
- Support final install and uninstall through the shared bridge
- Subscribe to live progress events and render thin progress summaries

**Step 3: Add copy for the new install states**

- loading inspection
- dependency install CTA and status
- install blocked/warning/ready states
- progress labels and success/failure feedback

**Step 4: Re-run the app contract**

Run: `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
Expected: PASS with the UI no longer relying on fake install progress.

### Task 5: Extend the Rust registry for common developer tools

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\registry\software-registry.yaml`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\registry\manifests\npm.hub.yaml`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\registry\manifests\pnpm.hub.yaml`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\registry\manifests\brew.hub.yaml`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\rust\tests\product_descriptor_contract.rs`
- Optionally modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\rust\tests\openclaw_registry_contract.rs`

**Step 1: Write or extend registry tests**

Require the registry to expose `npm`, `pnpm`, and `brew` with platform-aware descriptors and dependency metadata.

**Step 2: Run the Rust tests to verify red**

Run: `cargo test --test product_descriptor_contract`
Workdir: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\rust`
Expected: FAIL because the new registry entries do not exist yet.

**Step 3: Implement the manifests**

- Add registry entries with shared software names
- Add platform-specific dependency checks and auto-remediation commands
- Model host/runtime differences in manifest logic where needed, especially for `brew`

**Step 4: Re-run the focused Rust test**

Run: `cargo test --test product_descriptor_contract`
Workdir: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\rust`
Expected: PASS

### Task 6: Run focused and workspace verification

**Files:**
- Review: `git diff --stat`

**Step 1: Run focused TypeScript checks**

Run: `node --experimental-strip-types packages/sdkwork-claw-apps/src/services/appStoreService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
Expected: PASS

**Step 2: Run focused Rust registry checks**

Run: `cargo test --test product_descriptor_contract`
Workdir: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\vendor\hub-installer\rust`
Expected: PASS

**Step 3: Run workspace verification**

Run: `pnpm lint`
Expected: PASS

**Step 4: Run build verification**

Run: `pnpm build`
Expected: PASS
