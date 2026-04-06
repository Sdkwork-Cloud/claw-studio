# Install Cross-Platform Auto-Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tested cross-platform install recommendation layer and rebuild the install tab so the best install path is automatically detected and promoted on first screen.

**Architecture:** Keep the existing hub-installer assessment flow, but add a pure recommendation service in `sdkwork-claw-install` that converts runtime and assessment data into ranked install choices and compact platform summaries. Update the install page to consume that service and present a featured recommendation hero, secondary paths, and fix-first paths without changing the shared platform contract.

**Tech Stack:** TypeScript, React, i18next, existing hub-installer assessment models, node-based workspace tests

---

### Task 1: Add the recommendation service tests

**Files:**
- Create: `packages/sdkwork-claw-install/src/services/installRecommendationService.test.ts`
- Modify: `packages/sdkwork-claw-install/src/services/index.ts`

**Step 1: Write the failing test**

Add tests that prove:

- Windows with a ready WSL profile recommends `wsl`
- Windows with blocked WSL but ready Docker recommends `docker`
- macOS with ready npm recommends `npm`
- source-only products still recommend `source`
- blocked profiles sort behind ready profiles

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installRecommendationService.test.ts`

Expected: FAIL because `installRecommendationService.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create a pure service that accepts install choices plus assessment snapshots and returns ranked choice insights and a page-level summary.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installRecommendationService.test.ts`

Expected: PASS

### Task 2: Wire the service into the install page

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

**Step 1: Update derived state**

Replace the current direct `recommendedInstallMethodId` and flat choice rendering assumptions with the recommendation service output.

**Step 2: Rebuild the install tab layout**

Add:

- platform detection summary
- recommended install hero
- secondary choices section
- fix-first section
- lower-priority briefing block

Keep guided install entry points and product switching intact.

**Step 3: Verify behavior locally**

Run the targeted install contract test after the page update.

### Task 3: Add locale copy for auto-detection UI

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Add new install-page copy**

Add keys for:

- auto-detection headings
- platform capability labels
- recommendation reasons
- fix-first section
- secondary methods section
- status summaries

**Step 2: Re-run verification**

Run the install contract test to ensure the new copy keeps the feature contract coherent.

### Task 4: Full verification

**Files:**
- Modify: `scripts/sdkwork-install-contract.test.ts` only if the public contract needs new assertions

**Step 1: Run focused tests**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installRecommendationService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawInstallWizardService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/hubInstallProgressService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 2: Run broader validation if the targeted checks pass**

Run: `pnpm lint`

Expected: exit code `0`
