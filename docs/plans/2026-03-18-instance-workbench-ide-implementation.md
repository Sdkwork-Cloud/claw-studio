# Instance Workbench IDE Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the instance workbench into a full-width runtime canvas with row-based operational sections and a Monaco-powered files explorer/editor workspace.

**Architecture:** Extend runtime files in infrastructure so they can be previewed and edited, then reshape `InstanceDetail` into a denser IDE-like workbench. Keep all behavior inside `sdkwork-claw-instances` and shared infrastructure while preserving the single `/instances/:id` route.

**Tech Stack:** React 19, TypeScript, Monaco editor, i18next, lucide-react, shared studio mock service.

---

### Task 1: Lock the IDE workbench contract

**Files:**
- Modify: `scripts/sdkwork-instances-contract.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Steps:**
1. Add a failing contract that rejects the old fixed-width detail shell.
2. Add a failing contract requiring explorer/editor file workspace markers.
3. Add a failing infrastructure test proving file edits persist after save.

### Task 2: Extend runtime files into editable assets

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

**Steps:**
1. Add `content`, `language`, and `isReadonly` to mock instance files.
2. Add a file update method that persists edits.
3. Re-run the infrastructure file test and confirm it turns green.

### Task 3: Add editor dependencies

**Files:**
- Modify: `packages/sdkwork-claw-instances/package.json`
- Update lockfile as needed

**Steps:**
1. Add Monaco editor dependencies to the instances package.
2. Keep the dependency local to the feature package.

### Task 4: Rebuild the files surface into an IDE workspace

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

**Steps:**
1. Carry editor-ready file fields through the workbench snapshot.
2. Add selected file, draft content, dirty tracking, and save flow to the page.
3. Render a left file explorer and right Monaco editor workspace.

### Task 5: Convert operational sections to row layouts and widen the page

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

**Steps:**
1. Remove the old `max-w-[96rem]` style constraint.
2. Replace grid-card sections with row lists for channels, cron tasks, agents, skills, memory, and tools.
3. Keep the summary and action hierarchy intact while making the workbench feel denser and more premium.

### Task 6: Add localization and verification

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Steps:**
1. Add strings for file explorer, editor, preview, save state, and row metadata.
2. Run:
   - `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`
   - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
   - `pnpm lint`
   - `pnpm build`
   - `pnpm check:desktop`
