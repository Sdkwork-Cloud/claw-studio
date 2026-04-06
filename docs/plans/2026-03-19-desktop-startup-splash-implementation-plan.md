# Desktop Startup Splash Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a polished desktop launch screen that appears immediately, respects persisted appearance hints, and fades cleanly into the main shell after runtime bootstrap completes.

**Architecture:** Keep all startup logic in the desktop host by replacing the delayed mount flow with a desktop bootstrap component. Drive the user-visible experience from a small tested presentation model and let the shell remain unchanged except for being mounted later in the flow.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Tauri desktop host

---

### Task 1: Define the startup presentation model

**Files:**
- Create: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.ts`
- Test: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

**Step 1: Write the failing test**

Cover:

- persisted startup snapshot parsing,
- theme mode and dark-mode resolution,
- language fallback to English,
- progress stage mapping for booting vs ready states.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: FAIL because the startup presentation module does not exist yet.

**Step 3: Write minimal implementation**

Implement pure helpers for:

- resolving startup language,
- reading persisted appearance state,
- choosing launch screen copy,
- mapping visible startup stages and progress.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: PASS.

### Task 2: Build the desktop bootstrap and launch screen UI

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- Create: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
- Create: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopStartupScreen.tsx`

**Step 1: Write the failing test**

Use the existing Task 1 model test to extend coverage for any new pure-state helpers needed by the bootstrap flow, such as minimum-duration timing or visible stage state.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: FAIL for the newly added expected behavior.

**Step 3: Write minimal implementation**

Implement:

- immediate root render,
- async bootstrap state machine,
- minimum splash visibility,
- shell handoff,
- retryable error state,
- branded startup composition.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: PASS.

### Task 3: Polish the earliest visible frame

**Files:**
- Modify: `packages/sdkwork-claw-desktop/index.html`

**Step 1: Write the failing test**

No extra automated test is required for static HTML polish. Reuse the existing focused startup model tests and rely on build verification here.

**Step 2: Apply minimal implementation**

Add:

- baseline dark background,
- desktop-safe body sizing,
- root overflow handling,
- optional launch-color meta polish.

**Step 3: Verify with build**

Run: `pnpm --filter @sdkwork/claw-desktop build`

Expected: build succeeds.

### Task 4: Verify desktop host integrity

**Files:**
- No additional source files required unless verification reveals issues.

**Step 1: Run focused startup test**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/startupPresentation.test.ts`

Expected: PASS.

**Step 2: Run desktop TypeScript verification**

Run: `pnpm --filter @sdkwork/claw-desktop lint`

Expected: exit 0.

**Step 3: Run desktop build**

Run: `pnpm --filter @sdkwork/claw-desktop build`

Expected: exit 0.

**Step 4: Review final diff**

Check only the targeted desktop startup files to make sure the change stays host-scoped and does not disturb the shell surface.
