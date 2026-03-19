# Cron Task Row Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify `Instance Detail` cron tasks and the global `Cron Tasks` page around a shared row-based task component, while preserving the global page as the full management surface.

**Architecture:** Add data-agnostic row primitives to `@sdkwork/claw-ui`, extend pure task presentation mapping for row content, then refactor both pages to consume the shared UI with context-specific actions.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react, pnpm workspace packages, i18next.

---

### Task 1: Add presentation coverage for reusable task-row state

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`
- Modify: `packages/sdkwork-claw-tasks/src/services/taskListPresentation.ts`

**Step 1: Write the failing test**

Add coverage for:
- task row delivery summary
- task row latest execution label fallback
- task row execution badge label by execution content
- prompt fallback behavior when description is missing

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`

Expected: FAIL because the row presentation fields do not exist yet.

**Step 3: Write minimal implementation**

Extend the pure helper to expose the derived row fields needed by the shared UI.

**Step 4: Run test to verify it passes**

Run the same test file again.

Expected: PASS.

### Task 2: Build shared task-row UI primitives

**Files:**
- Create: `packages/sdkwork-claw-ui/src/components/TaskRowList.tsx`
- Modify: `packages/sdkwork-claw-ui/src/components/index.ts`

**Step 1: Write the failing test**

Rely on the task presentation test and workspace contract checks as the safety net for the new shared surface.

**Step 2: Run test to verify safety net is green before wiring**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`

Expected: PASS.

**Step 3: Write minimal implementation**

Create:
- `TaskRowList`
- `TaskRow`
- `TaskRowMeta`
- `TaskRowBadge`
- `TaskRowActionGroup`

Keep them generic and export them from the UI package root.

**Step 4: Run package verification**

Run: `node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts`

Expected: PASS.

### Task 3: Refactor the global Cron Tasks page to shared rows

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

If the shared row needs more pure presentation coverage, add it first in `taskListPresentation.test.ts`.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`

Expected: FAIL before the mapping is finished.

**Step 3: Write minimal implementation**

Replace the large task cards with the shared row list while preserving:
- edit
- clone
- enable or disable
- run now
- history
- delete

Keep the empty states and editor drawer behavior unchanged.

**Step 4: Run verification**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`
- `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`

Expected: PASS.

### Task 4: Refactor Instance Detail cron tasks to reuse the same row surface

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

**Step 1: Write the failing test**

Use the contract and build checks as the guardrail for this page-level refactor.

**Step 2: Run test to verify current safety net**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS before the refactor.

**Step 3: Write minimal implementation**

Replace the local cron-task row markup with the shared task-row primitives and align the metadata order and summary area with the global task page.

**Step 4: Run verification**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS.

### Task 5: Final verification

**Step 1: Run targeted checks**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`
- `node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `cmd /c pnpm.cmd run check:i18n`

**Step 2: Run broader verification**

Run:
- `cmd /c pnpm.cmd run build`

Expected: successful build for the touched surfaces.
