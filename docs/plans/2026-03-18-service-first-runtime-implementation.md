# Service-First Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the web host server runtime and move mock business behavior behind service-layer adapters.

**Architecture:** The browser host becomes Vite-only. Shared mock state lives in infrastructure services, feature services become facades over that state, and shell/core consumers use service abstractions instead of direct HTTP calls.

**Tech Stack:** TypeScript, React, Vite, pnpm workspace, node `--experimental-strip-types`

---

### Task 1: Lock The New Runtime Contract

**Files:**
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`

**Step 1: Write the failing test**

- Change the host runtime contract so it expects:
  - `@sdkwork/claw-web` dev script uses Vite
  - `express` and `sql.js` are absent
  - `packages/sdkwork-claw-web/server.ts` is absent

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: FAIL because the current host still depends on `server.ts`.

**Step 3: Write minimal implementation**

- Update the web host package and remove the old runtime server file later in the plan.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: PASS.

### Task 2: Lock Shared Mock Runtime Behavior

**Files:**
- Create: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/index.ts`

**Step 1: Write the failing test**

- Cover these behaviors:
  - installing a skill makes it visible from installed-skill lookups
  - instance status/config mutations are persisted
  - task creation/status updates round-trip
  - settings preference merge keeps untouched sections

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`
Expected: FAIL because the shared mock runtime does not exist yet.

**Step 3: Write minimal implementation**

- Implement the shared in-memory mock runtime service and export it from the infrastructure package root.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`
Expected: PASS.

### Task 3: Refactor Feature Services To Use The Shared Adapter

**Files:**
- Modify: `packages/sdkwork-claw-apps/src/services/appStoreService.ts`
- Modify: `packages/sdkwork-claw-channels/src/services/channelService.ts`
- Modify: `packages/sdkwork-claw-devices/src/services/deviceService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceService.ts`
- Modify: `packages/sdkwork-claw-market/src/services/marketService.ts`
- Modify: `packages/sdkwork-claw-market/src/services/mySkillService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/settingsService.ts`
- Modify: `packages/sdkwork-claw-tasks/src/services/taskService.ts`
- Modify: relevant package `package.json` files that now depend on `@sdkwork/claw-infrastructure`

**Step 1: Write the failing test**

- Reuse the shared runtime contract from Task 2 and the workspace typecheck as the safety net for service refactors.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sdkwork/claw-web lint`
Expected: FAIL after imports are changed but before all dependencies and types are aligned.

**Step 3: Write minimal implementation**

- Replace direct `/api/...` calls with service-layer adapter calls.
- Preserve existing return shapes expected by UI.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @sdkwork/claw-web lint`
Expected: PASS.

### Task 4: Remove Direct Page/Shell Fetch Calls

**Files:**
- Create: `packages/sdkwork-claw-core/src/services/instanceDirectoryService.ts`
- Modify: `packages/sdkwork-claw-core/src/index.ts`
- Modify: `packages/sdkwork-claw-core/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-core/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-extensions/src/pages/extensions/Extensions.tsx`

**Step 1: Write the failing test**

- Use the workspace typecheck as the guardrail once the direct fetch helpers are removed.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sdkwork/claw-web lint`
Expected: FAIL until all components use the new service abstraction.

**Step 3: Write minimal implementation**

- Introduce the core instance directory service.
- Replace direct `fetch('/api/instances')` usage with service calls.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @sdkwork/claw-web lint`
Expected: PASS.

### Task 5: Clean The Host And Align Documentation

**Files:**
- Modify: `packages/sdkwork-claw-web/package.json`
- Delete: `packages/sdkwork-claw-web/server.ts`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/guide/getting-started.md`
- Modify: `docs/zh-CN/guide/getting-started.md`

**Step 1: Write the failing test**

- Re-run the host runtime contract from Task 1 after the file deletion.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: FAIL until the package metadata and docs are aligned with the new host.

**Step 3: Write minimal implementation**

- Switch the dev script to Vite.
- remove server-only dependencies
- update guidance to say the browser host runs with Vite on port `3001`

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: PASS.

### Task 6: Full Verification

**Files:**
- No source edits expected

**Step 1: Run focused tests**

Run:
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Step 2: Run workspace verification**

Run:
- `pnpm --filter @sdkwork/claw-web lint`
- `pnpm check:arch`

**Step 3: Record residual risks**

- Note any existing unrelated workspace issues if verification fails outside this change surface.
