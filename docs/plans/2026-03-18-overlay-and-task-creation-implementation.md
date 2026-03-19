# Overlay And Task Creation Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shared header-safe overlay system and redesign task creation into a split-layout workspace without losing the new cron scheduling capabilities.

**Architecture:** Add shared overlay primitives in `@sdkwork/claw-ui`, migrate the highest-impact dialogs and drawers to those primitives, then refactor task creation around small helper functions that can be tested independently from the page component.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion, pnpm workspace packages, i18next.

---

### Task 1: Add overlay-safe layout primitives

**Files:**
- Create: `packages/sdkwork-claw-ui/src/components/OverlaySurface.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/overlayLayout.ts`
- Test: `packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`
- Modify: `packages/sdkwork-claw-ui/src/components/Modal.tsx`
- Modify: `packages/sdkwork-claw-ui/src/index.ts`

**Step 1: Write the failing test**

Add tests for header-safe overlay metrics and variant class selection.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`

Expected: failure because helper file does not exist yet.

**Step 3: Write minimal implementation**

Create overlay constants/helpers and a reusable `OverlaySurface` component that supports `modal` and `drawer`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`

Expected: PASS.

### Task 2: Migrate shared and high-impact overlays

**Files:**
- Modify: `packages/sdkwork-claw-commons/src/components/InstallModal.tsx`
- Modify: `packages/sdkwork-claw-channels/src/pages/channels/Channels.tsx`
- Modify: `packages/sdkwork-claw-center/src/pages/ClawDetail.tsx`
- Modify: `packages/sdkwork-claw-center/package.json`
- Modify: `packages/sdkwork-claw-channels/package.json`
- Modify: `packages/sdkwork-claw-tasks/package.json`

**Step 1: Write the failing test**

Reuse Task 1 coverage for safe-area helpers and add any focused helper tests only if a new shared rule is introduced.

**Step 2: Run test to verify it fails when applicable**

Use the existing overlay helper test if helper behavior changes.

**Step 3: Write minimal implementation**

Replace raw `fixed inset-0` overlays and `top-0 h-full` drawers with the shared overlay surface while preserving each flow's close rules, animations, and fixed action areas.

**Step 4: Run test to verify it passes**

Run: `cmd /c pnpm.cmd run build`

Expected: successful build.

### Task 3: Extract task-create workspace helpers

**Files:**
- Create: `packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.ts`
- Create: `packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`
- Modify: `packages/sdkwork-claw-tasks/src/services/index.ts`

**Step 1: Write the failing test**

Cover section completion state, validation summaries, and schedule-mode presentation for the new left-rail workspace.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`

Expected: failure because helper file does not exist yet.

**Step 3: Write minimal implementation**

Implement pure helper functions for section state and summary generation.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`

Expected: PASS.

### Task 4: Redesign the task creation UI

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Rely on the new workspace helper tests for behavior and preserve the existing schedule contract tests as regression coverage.

**Step 2: Run test to verify current behavior is covered**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`

Expected: PASS before wiring the helpers into the page.

**Step 3: Write minimal implementation**

Rebuild the create-task dialog as a split workbench with:
- left rail navigation and readiness
- right pane content
- `Common Config` and `Advanced` grouping
- sticky footer actions

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`

Expected: PASS.

### Task 5: Final verification

**Files:**
- No code changes unless verification exposes regressions

**Step 1: Run targeted tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskCreateWorkspace.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskSchedule.test.ts`
- `node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts`

Expected: PASS.

**Step 2: Run build**

Run: `cmd /c pnpm.cmd run build`

Expected: successful build.

**Step 3: Note residual issues**

If `check:i18n` or other unrelated workspace checks still fail due pre-existing files, document that explicitly.
