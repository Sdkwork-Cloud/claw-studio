# Desktop Env And Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a centralized desktop env configuration and backend-driven update flow that checks app updates through the business API and exposes stable update actions to the app.

**Architecture:** Add a typed env module in infrastructure, add update contracts and HTTP client integration there, map desktop runtime metadata into the backend update-check request through business services, then surface startup and user-triggered update flows in the desktop shell without leaking Tauri or env details into page components.

**Tech Stack:** TypeScript, React, Vite, pnpm workspace, Tauri desktop bridge, fetch-based HTTP client

---

### Task 1: Document And Type The Env Surface

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-web\.env.example`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\config\env.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\config\env.test.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\index.ts`

**Step 1: Write the failing test**

Write tests covering:

- default `appEnv`
- normalized `api.baseUrl`
- access token resolution
- `getApiUrl('/app/v3/api/update/check')`
- missing update config detection

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/config/env.test.ts`
Expected: FAIL because the env module does not exist yet.

**Step 3: Write minimal implementation**

Implement a typed env module with:

- typed config object
- string/boolean/number readers
- URL normalization
- helper methods for API URL and token access
- update-config readiness helper

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/config/env.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-web/.env.example packages/claw-studio-infrastructure/src/config/env.ts packages/claw-studio-infrastructure/src/config/env.test.ts packages/claw-studio-infrastructure/src/index.ts
git commit -m "feat: add desktop env configuration"
```

### Task 2: Add Update Contracts And HTTP Client Coverage

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\updates\contracts.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\updates\updateClient.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\updates\updateClient.test.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\http\httpClient.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\index.ts`

**Step 1: Write the failing test**

Add tests asserting:

- update client posts to `/app/v3/api/update/check`
- Authorization header is added when token exists
- request body is serialized correctly
- backend payload maps into a stable local DTO

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/updates/updateClient.test.ts`
Expected: FAIL because update contracts and client do not exist.

**Step 3: Write minimal implementation**

Implement:

- update request/response contracts
- API result unwrap logic
- request helper support for custom headers and optional JSON-less responses if needed
- update client with stable error messages

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/updates/updateClient.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-infrastructure/src/updates/contracts.ts packages/claw-studio-infrastructure/src/updates/updateClient.ts packages/claw-studio-infrastructure/src/updates/updateClient.test.ts packages/claw-studio-infrastructure/src/http/httpClient.ts packages/claw-studio-infrastructure/src/index.ts
git commit -m "feat: add backend app update client"
```

### Task 3: Extend Runtime Contracts For Update Metadata

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\contracts\runtime.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\tauriBridge.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\services\updateService.test.ts`

**Step 1: Write the failing test**

Add a business-layer test that expects update requests to include runtime-derived platform metadata such as app version, os, arch, and device ID.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/services/updateService.test.ts`
Expected: FAIL because the service and metadata mapping do not exist.

**Step 3: Write minimal implementation**

Extend runtime contracts and bridge outputs as needed so business code can obtain:

- version
- target/build info if available
- os/arch/family
- device ID

Prefer additive contract changes that do not break current runtime consumers.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/services/updateService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-infrastructure/src/platform/contracts/runtime.ts packages/claw-studio-desktop/src/desktop/tauriBridge.ts packages/claw-studio-business/src/services/updateService.test.ts
git commit -m "feat: expose desktop runtime metadata for updates"
```

### Task 4: Add Business Update Service And Action Resolution

**Files:**
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\services\updateService.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\index.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\services\updateService.test.ts`

**Step 1: Write the failing test**

Add tests for:

- `checkForAppUpdate()`
- `resolvePreferredUpdateAction()`
- fallback order `resolvedPackage.url -> updateUrl -> storeUrl`
- unavailable behavior when env is missing

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/services/updateService.test.ts`
Expected: FAIL because the service does not exist yet.

**Step 3: Write minimal implementation**

Implement the business service on top of infrastructure env/update/runtime APIs and make action resolution deterministic.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/services/updateService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-business/src/services/updateService.ts packages/claw-studio-business/src/services/updateService.test.ts packages/claw-studio-business/src/index.ts
git commit -m "feat: add app update business service"
```

### Task 5: Integrate Desktop Startup And Manual Update Entry

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\providers\DesktopProviders.tsx`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\stores\useUpdateStore.ts`
- Create: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\stores\useUpdateStore.test.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\index.ts`

**Step 1: Write the failing test**

Add tests that expect:

- startup update check is optional and non-blocking
- store state transitions across idle/checking/ready/error
- manual check action triggers service call

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/stores/useUpdateStore.test.ts`
Expected: FAIL because the store does not exist.

**Step 3: Write minimal implementation**

Implement a lightweight update store and wire desktop provider startup to trigger the optional async check after platform bridge configuration.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/stores/useUpdateStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src/desktop/providers/DesktopProviders.tsx packages/claw-studio-business/src/stores/useUpdateStore.ts packages/claw-studio-business/src/stores/useUpdateStore.test.ts packages/claw-studio-business/src/index.ts
git commit -m "feat: wire desktop startup update state"
```

### Task 6: Add A Visible Update Entry Point

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-settings\src\pages\settings\*.tsx`
- Create or Modify: exact update entry component path discovered during implementation
- Add tests if a page-level test harness exists

**Step 1: Write the failing test**

Add the smallest feasible interaction test or component test that verifies a user-triggered update check and action opening flow.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run <exact-settings-update-test>`
Expected: FAIL because the UI entry does not exist.

**Step 3: Write minimal implementation**

Add a settings-page update section that:

- displays latest status
- allows manual check
- surfaces title/version/summary if an update exists
- triggers the preferred action through the business service

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run <exact-settings-update-test>`
Expected: PASS

**Step 5: Commit**

```bash
git add <exact-settings-files>
git commit -m "feat: add desktop app update entry"
```

### Task 7: Verify Architecture And Build Safety

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\scripts\check-desktop-platform-foundation.mjs`
- Modify: any package export barrel files needed by the new modules

**Step 1: Write the failing test**

Extend the architecture script to assert the new env/update files exist and the desktop provider no longer owns raw update HTTP behavior.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL until the new structure is fully wired.

**Step 3: Write minimal implementation**

Update the script and any barrel exports so the architecture checks reflect the new env/update foundation.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/check-desktop-platform-foundation.mjs
git commit -m "chore: enforce env and update architecture checks"
```

### Task 8: Full Verification

**Files:**
- No code changes expected

**Step 1: Run targeted tests**

Run:

- `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/config/env.test.ts`
- `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/updates/updateClient.test.ts`
- `pnpm.cmd exec vitest run packages/claw-studio-business/src/services/updateService.test.ts`
- `pnpm.cmd exec vitest run packages/claw-studio-business/src/stores/useUpdateStore.test.ts`

Expected: all PASS

**Step 2: Run architecture checks**

Run:

- `node scripts/check-desktop-platform-foundation.mjs`
- `node scripts/check-arch-boundaries.mjs`

Expected: PASS

**Step 3: Run package and workspace verification**

Run:

- `pnpm.cmd --filter @sdkwork/claw-studio-desktop lint`
- `pnpm.cmd lint`
- `pnpm.cmd run build`

Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "feat: complete desktop env and update flow"
```
