# Task List Actions And Create Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add product-grade task actions and execution history, while refining task creation so schedule and prompt live in `基础信息` and execution behavior follows the OpenClaw-style execution model.

**Architecture:** Extend the task domain model and mock service first, add pure helpers and tests for derived task UI state, then rebuild the task list and create/edit/history overlays on top of the richer domain.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion, pnpm workspace packages, i18next.

---

### Task 1: Extend task domain and mock runtime behavior

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/services/taskService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Step 1: Write the failing test**

Add mock-service tests for:
- editing task fields
- cloning a task
- running a task immediately
- reading execution history

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

Expected: FAIL because the new task APIs do not exist yet.

**Step 3: Write minimal implementation**

Add richer task fields, history entries, and task mutation APIs to the mock service and task service.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

Expected: PASS.

### Task 2: Add task UI state helpers

**Files:**
- Create: `packages/sdkwork-claw-tasks/src/services/taskListPresentation.ts`
- Create: `packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`
- Modify: `packages/sdkwork-claw-tasks/src/services/index.ts`
- Modify: `packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.ts`
- Modify: `packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`

**Step 1: Write the failing test**

Cover:
- card-level status tone and summary logic
- create/edit workspace section grouping with schedule + prompt in `基础信息`
- execution section grouping without sidebar live preview

**Step 2: Run test to verify it fails**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`

Expected: at least one FAIL before implementation.

**Step 3: Write minimal implementation**

Implement the helper logic that powers the new list cards and the refined create/edit sections.

**Step 4: Run test to verify it passes**

Run the same two test files again.

Expected: PASS.

### Task 3: Rebuild task creation, edit, clone, and history overlays

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Use the helper tests and task service tests as the safety net for behavior while the page UI is refactored.

**Step 2: Run test to verify coverage is in place**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`

Expected: PASS before wiring.

**Step 3: Write minimal implementation**

Implement:
- create/edit shared workspace dialog
- clone action
- history drawer
- refined execution section
- removed sidebar live preview

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`

Expected: PASS.

### Task 4: Redesign the task list cards and action model

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- Modify: locale files if extra labels are needed

**Step 1: Write the failing test**

If list-card derivation needs new helper coverage, add it in `taskListPresentation.test.ts`.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`

Expected: FAIL when the new card logic is introduced.

**Step 3: Write minimal implementation**

Replace the table rows with rich task cards that expose:
- Edit
- Clone
- Disable / Enable
- Run Now
- View Execution History
- Delete

**Step 4: Run test to verify it passes**

Run the helper test again.

Expected: PASS.

### Task 5: Final verification

**Step 1: Run targeted verification**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskListPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
- `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`
- `cmd /c pnpm.cmd run check:i18n`

**Step 2: Run build**

Run: `cmd /c pnpm.cmd run build`

Expected: successful build.
