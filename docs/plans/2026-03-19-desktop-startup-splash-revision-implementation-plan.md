# Desktop Startup Splash Revision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the desktop startup splash so it is calmer, lobster-monochrome, less text-heavy, and switches to fullscreen only after the main shell is ready.

**Architecture:** Keep the existing desktop-host bootstrap structure, but simplify the startup presentation model and replace the current full-surface showcase UI with a centered launch card. Trigger fullscreen as an explicit post-bootstrap desktop window action.

**Tech Stack:** React 19, TypeScript, Tauri desktop host, Tailwind CSS 4

---

### Task 1: Update startup presentation expectations

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.ts`

**Step 1: Write the failing test**

Change expectations to reflect:

- shorter startup copy,
- simpler progress states,
- any new fullscreen helper behavior extracted into pure logic.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: FAIL because the current presentation model still represents the old splash.

**Step 3: Write minimal implementation**

Update the presentation model to serve the new compact splash.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: PASS.

### Task 2: Replace the splash UI and simplify boot flow

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopStartupScreen.tsx`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`

**Step 1: Extend the failing test if needed**

Add one small pure-state expectation for the new boot state machine only if a helper is introduced.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: FAIL for the new expectation.

**Step 3: Write minimal implementation**

Implement:

- centered launch card layout,
- lobster monochrome styling,
- reduced text content,
- simpler status/progress display,
- post-ready fullscreen request.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: PASS.

### Task 3: Update static host baseline if needed

**Files:**
- Modify: `packages/sdkwork-claw-desktop/index.html`

**Step 1: Keep host background aligned with the new single-color launch direction**

Remove any leftover gradient-heavy baseline that contradicts the new design.

**Step 2: Verify with build**

Run: `pnpm --filter @sdkwork/claw-desktop build`

Expected: build succeeds.

### Task 4: Verify desktop host behavior

**Files:**
- No additional files unless verification reveals issues.

**Step 1: Run focused startup test**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: PASS.

**Step 2: Run desktop TypeScript verification**

Run: `pnpm --filter @sdkwork/claw-desktop lint`

Expected: exit 0.

**Step 3: Run desktop build**

Run: `pnpm --filter @sdkwork/claw-desktop build`

Expected: exit 0.
