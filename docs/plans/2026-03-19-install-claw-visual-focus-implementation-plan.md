# Install Claw Visual Focus Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the `Install Claw` page so install, uninstall, and migrate feel visually distinct and the install mode keeps users focused on starting installation quickly.

**Architecture:** Keep the existing `/install` route and existing runtime/install logic, but refactor the page layout and copy so the shared hero is replaced by a compact task frame, each mode gets its own visual sectioning, and install cards prioritize readiness and primary action over supporting detail.

**Tech Stack:** React, TypeScript, Tailwind utility classes, i18next, existing installer bridge contracts.

---

### Task 1: Lock The Visual Structure Contract

**Files:**
- Modify: `scripts/sdkwork-install-contract.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- compact task-frame primitives in the install page
- mode-specific layout sections for install, uninstall, and migrate
- install hero copy no longer depending on the oversized shared hero structure
- focused install card affordances such as readiness summary and stronger primary CTA structure

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because the new visual structure markers do not exist yet.

**Step 3: Write minimal implementation**

Do not implement here. Move to the page task after confirming the failure.

**Step 4: Run test to verify it still fails for the intended reason**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL on missing visual structure markers, not on unrelated files.

### Task 2: Refactor Install Page Layout Around Task Focus

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Replace the oversized shared hero with a compact header frame.
- Promote the mode switch into the main orientation row.
- Convert runtime detection into compact status pills.
- Split install, uninstall, and migrate into visually distinct mode sections.
- Rework install mode so product selection and install cards dominate the first screen.
- Demote system requirements to a lighter supporting note.
- Adjust the modal idle state so summary and readiness come first.

**Step 4: Run test to verify it passes further**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: remaining failures should move to copy keys or missing text markers, not missing layout structure.

### Task 3: Polish Copy For The New Visual Hierarchy

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Shorten the top-level mode descriptions.
- Add compact header and section copy that fits the new task-focused layout.
- Add install-specific readiness and support-note copy.
- Add uninstall and migrate section copy that matches their new visual tone.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS.

### Task 4: Full Verification

**Files:**
- Review: `git diff --stat`

**Step 1: Run focused verification**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS.

**Step 2: Run workspace verification**

Run: `pnpm lint`
Expected: PASS.

**Step 3: Run production build**

Run: `pnpm build`
Expected: PASS.
