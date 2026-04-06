# Dashboard Template Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first-class `sdkwork-claw-dashboard` feature package and make it the default professional control-plane entry for Claw Studio.

**Architecture:** The shell will expose `dashboard` as a new workspace route and navigation primitive, while a dedicated dashboard feature package aggregates shared runtime data into a control-plane snapshot. Shared mock agent data will be lifted into infrastructure so dashboard and chat can consume the same source of truth without feature-to-feature coupling.

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, motion, Tailwind CSS, Tauri/web dual-host shell.

---

### Task 1: Lock the intended dashboard surface with failing contracts

**Files:**
- Modify: `scripts/sdkwork-shell-contract.test.ts`
- Create: `scripts/sdkwork-dashboard-contract.test.ts`
- Modify: `package.json`

**Steps:**
1. Add a shell contract asserting `/dashboard` exists, `/` redirects to it, and sidebar/command palette expose it.
2. Add a dashboard package contract asserting the new package, exports, service, page, and scoring helpers exist.
3. Add a `check:sdkwork-dashboard` script and wire it into `check:parity`.
4. Run the dashboard and shell contracts and verify they fail for missing implementation.

### Task 2: Update template structure and route validators

**Files:**
- Modify: `scripts/check-sdkwork-claw-structure.mjs`
- Modify: `scripts/check-sdkwork-claw-route-surface.mjs`
- Modify: `docs/features/overview.md`

**Steps:**
1. Add `sdkwork-claw-dashboard` to required workspace packages.
2. Evolve route validation to allow approved template extensions, starting with `/dashboard`.
3. Document dashboard in the feature overview so the template surface is explicit.
4. Run the structure and route checks and verify they fail until package wiring is complete.

### Task 3: Move shared agent catalog into infrastructure

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/agentService.ts`

**Steps:**
1. Add shared agent seed data and `listAgents/getAgent` accessors to `studioMockService`.
2. Refactor chat's `agentService` to consume the shared infrastructure data instead of local in-memory duplication.
3. Preserve current public `agentService` API so chat behavior does not regress.
4. Run focused checks for chat-facing contracts if needed.

### Task 4: Create the dashboard feature package

**Files:**
- Create: `packages/sdkwork-claw-dashboard/package.json`
- Create: `packages/sdkwork-claw-dashboard/src/index.ts`
- Create: `packages/sdkwork-claw-dashboard/src/Dashboard.tsx`
- Create: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- Create: `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`
- Create: `packages/sdkwork-claw-dashboard/src/services/index.ts`
- Create: `packages/sdkwork-claw-dashboard/src/types/index.ts`
- Create: `packages/sdkwork-claw-dashboard/src/components/*`

**Steps:**
1. Create the package manifest with dependencies constrained to shared layers plus UI/runtime libraries.
2. Define dashboard snapshot types and scoring helper types.
3. Implement `dashboardService` to aggregate instances, tasks, channels, skills, and agent catalog from shared infrastructure.
4. Build a professional dashboard page with control-plane sections, quick actions, and operational metrics.
5. Export the feature cleanly from the package root.

### Task 5: Integrate dashboard into shell and product entry points

**Files:**
- Modify: `packages/sdkwork-claw-shell/package.json`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/router/routePaths.ts`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts`
- Modify: `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`

**Steps:**
1. Add the dashboard package as a shell dependency.
2. Import the dashboard route and redirect `/` to `/dashboard`.
3. Add a dashboard navigation item at the top of the workspace group.
4. Add dashboard to command palette navigation and sidebar visibility preferences.
5. Keep layout hierarchy and current header/sidebar polish intact.

### Task 6: Add i18n support for dashboard and new navigation labels

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Steps:**
1. Add `sidebar.dashboard`.
2. Add `commandPalette.commands.dashboard`.
3. Add a full `dashboard` namespace for page copy, metrics, sections, and recommendations.
4. Ensure both English and Chinese remain structurally aligned.

### Task 7: Verify the full template enhancement

**Files:**
- No code changes unless fixes are needed

**Steps:**
1. Run `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
2. Run `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
3. Run `node scripts/check-sdkwork-claw-structure.mjs`
4. Run `node scripts/check-sdkwork-claw-route-surface.mjs`
5. Run `pnpm build`
6. Run `pnpm check:desktop`
7. If outputs are clean enough, report exact verification status and any residual warnings.
