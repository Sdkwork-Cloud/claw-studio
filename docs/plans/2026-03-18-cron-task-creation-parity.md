# Cron Task Creation Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand Claw Studio task creation so users can create cron tasks with interval, fixed time, or raw cron expression scheduling plus a required execution prompt.

**Architecture:** Keep the task feature self-contained inside `@sdkwork/claw-tasks` by introducing a richer task form model and schedule serialization helpers, then persist the extra fields through the existing mock service. The Tasks page will render a multi-mode scheduler form that always stores a canonical cron expression plus enough metadata to re-render the chosen mode cleanly.

**Tech Stack:** React 19, TypeScript, react-i18next, existing studio mock service, Node built-in test runner with `--experimental-strip-types`

---

### Task 1: Define schedule form behavior and test it

**Files:**
- Create: `packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
- Create: `packages/sdkwork-claw-tasks/src/services/taskSchedule.ts`

**Step 1: Write the failing test**

Add tests that cover:
- interval mode serializes minutes, hours, and days into canonical cron expressions
- fixed-time mode serializes a selected date/time into a cron expression
- cron mode preserves the raw cron expression
- validation rejects missing prompt and incomplete schedule fields

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
Expected: FAIL because the helper module does not exist yet.

**Step 3: Write minimal implementation**

Implement schedule constants, task form types, serialization helpers, human-readable summaries, and validation helpers in `taskSchedule.ts`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
Expected: PASS.

### Task 2: Extend task service and mock persistence

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/services/taskService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

**Step 1: Write the failing test**

Extend the schedule helper tests first so the required task payload shape is explicit, then update contract expectations if needed.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
Expected: FAIL if the payload shape is not yet represented.

**Step 3: Write minimal implementation**

Add `prompt` plus schedule metadata fields to the task DTO/model and make the mock layer return/stash those values without breaking existing list behavior.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
Expected: PASS.

### Task 3: Rebuild the task creation form

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`

**Step 1: Write the failing test**

Use the helper tests as the red bar for creation behavior, then wire the page against the validated helper contract.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
Expected: FAIL if the page still cannot supply the required form data shape.

**Step 3: Write minimal implementation**

Update the modal so it includes:
- basic info fields
- schedule mode switcher for interval, fixed time, and cron expression
- prompt textarea
- inline validation and disabled submit state
- richer schedule display in the table

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
Expected: PASS.

### Task 4: Verify integration

**Files:**
- Modify only if verification reveals gaps

**Step 1: Run targeted task feature checks**

Run:
- `node --experimental-strip-types --test packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
- `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`

Expected: PASS.

**Step 2: Run broader safety checks**

Run:
- `pnpm check:i18n`
- `pnpm build`

Expected: PASS, or document any unrelated failures already present in the workspace.
