# Sidebar Menu Pruning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `codebox` and `api-router` from the settings center sidebar, and remove `codebox` from the global sidebar while keeping routes intact.

**Architecture:** Keep the change in the navigation configuration layer. Update only the tab/menu definitions used by the settings package and sidebar components, plus the repository contract tests that guard those source surfaces. Avoid route or command palette changes.

**Tech Stack:** TypeScript, React, package-level source contract tests run with `node --experimental-strip-types`

---

### Task 1: Lock the new menu expectations in contract tests

**Files:**
- Modify: `scripts/sdkwork-settings-contract.test.ts`
- Modify: `scripts/sdkwork-shell-contract.test.ts`
- Modify: `scripts/sdkwork-core-contract.test.ts`

**Step 1: Write the failing test**

Change the settings contract to assert that `packages/sdkwork-claw-settings/src/Settings.tsx` no longer contains `id: 'codebox'` or `id: 'api-router'`.

Change the shell contract to assert that `packages/sdkwork-claw-shell/src/components/Sidebar.tsx` no longer contains `id: 'codebox'` and still contains `id: 'api-router'`.

Change the core contract to assert that `packages/sdkwork-claw-core/src/components/Sidebar.tsx` no longer contains `id: 'codebox'` and still contains `id: 'api-router'`.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

Run: `node --experimental-strip-types scripts/sdkwork-core-contract.test.ts`

Expected: at least the new sidebar assertions fail against the current source.

**Step 3: Write minimal implementation**

Update the settings tab list and sidebar item arrays to remove only the requested entries.

**Step 4: Run test to verify it passes**

Re-run the same three contract test commands and confirm they pass.

### Task 2: Remove the requested navigation entries from implementation

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/Settings.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-core/src/components/Sidebar.tsx`

**Step 1: Write the failing test**

Use the contract tests from Task 1 as the red phase.

**Step 2: Run test to verify it fails**

Use the same three targeted contract test commands and confirm the new assertions fail before implementation.

**Step 3: Write minimal implementation**

- In `Settings.tsx`, remove the `codebox` and `api-router` tabs and their placeholder panels, plus any now-unused icon imports/helper code.
- In the shell sidebar, remove the `codebox` item from the setup group and keep `api-router`.
- In the core sidebar, remove the `codebox` item from the setup group and keep `api-router`.

**Step 4: Run test to verify it passes**

Run:

- `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-core-contract.test.ts`

Expected: all assertions pass.

### Task 3: Do a focused regression verification

**Files:**
- No additional source changes expected

**Step 1: Run targeted verification**

Run: `git diff -- packages/sdkwork-claw-settings/src/Settings.tsx packages/sdkwork-claw-shell/src/components/Sidebar.tsx packages/sdkwork-claw-core/src/components/Sidebar.tsx scripts/sdkwork-settings-contract.test.ts scripts/sdkwork-shell-contract.test.ts scripts/sdkwork-core-contract.test.ts docs/plans/2026-03-19-sidebar-menu-pruning-design.md docs/plans/2026-03-19-sidebar-menu-pruning-implementation-plan.md`

Expected: only the requested sidebar/menu adjustments and plan docs appear.

**Step 2: Summarize manual behavior**

Confirm that `/settings?tab=codebox` and `/settings?tab=api-router` now resolve to the default settings content because those tabs are no longer present, while `/codebox` and `/api-router` routes remain unchanged.
