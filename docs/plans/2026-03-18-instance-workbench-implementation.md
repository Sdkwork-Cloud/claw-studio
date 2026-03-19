# Instance Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `/instances/:id` as an OpenClaw-style instance workbench with a sidebar for channels, cron tasks, agents, skills, files, memory, and tools.

**Architecture:** Keep the route surface unchanged while introducing a dedicated `instanceWorkbenchService` that aggregates instance runtime data from shared infrastructure. Extend the infrastructure mock with first-class instance files, memory, and tool data so the page is capability-driven rather than a static form.

**Tech Stack:** React 19, TypeScript, lucide-react, react-router-dom, i18next, shared studio mock runtime.

---

### Task 1: Lock the new workbench contract

**Files:**
- Modify: `scripts/sdkwork-instances-contract.test.ts`

**Steps:**
1. Add a failing contract requiring `instanceWorkbenchService`.
2. Add a failing contract requiring the seven sidebar capability sections in `InstanceDetail`.
3. Run the instance contract and confirm it fails for the missing workbench structure.

### Task 2: Extend mock runtime data for instance-native capabilities

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

**Steps:**
1. Add typed mock data for instance files.
2. Add typed mock data for instance memory entries.
3. Add typed mock data for instance tools.
4. Expose list helpers from `studioMockService`.

### Task 3: Build the instance workbench aggregation layer

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Create: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/index.ts`

**Steps:**
1. Add workbench section and snapshot types.
2. Implement `instanceWorkbenchService` using infrastructure only.
3. Export the new service from local barrels.
4. Re-run the instance contract and confirm the service-level failure is gone while UI expectations still fail.

### Task 4: Rebuild `InstanceDetail` into a sidebar workbench

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

**Steps:**
1. Replace the old top-tab layout with a left capability sidebar.
2. Keep the summary header with instance actions.
3. Implement content panels for channels, cron tasks, agents, skills, files, memory, and tools.
4. Preserve token copy, runtime actions, and instance activation behavior.

### Task 5: Add localization for the workbench copy

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Steps:**
1. Add section labels, descriptions, metric labels, and empty states.
2. Add file, memory, and tool terminology aligned with OpenClaw product language.

### Task 6: Verify the finished workbench

**Files:**
- No code changes unless fixes are needed

**Steps:**
1. Run `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
2. Run `pnpm lint`
3. Run `pnpm build`
4. Run `pnpm check:desktop`
