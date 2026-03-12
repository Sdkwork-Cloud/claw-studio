# Claw Studio Architecture And V3 Parity Closeout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove the workspace package split is architecturally sound and close any remaining gaps so behavior and UI stay aligned with `upgrade/claw-studio-v3`.

**Architecture:** Audit package ownership against the agreed dependency direction, compare every v3 feature surface to the workspace exports, then make only the minimal package-boundary or parity fixes required. Keep `web` and `desktop` thin, keep `shell` compositional, and keep feature behavior owned by the correct vertical package.

**Tech Stack:** TypeScript, React, pnpm workspace, Vite, React Router, Zustand, workspace package exports, architecture verification scripts

---

### Task 1: Audit Package Ownership And Dependency Direction

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\plans\2026-03-12-claw-studio-v3-parity-audit.md`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\check-arch-boundaries.mjs`

**Step 1: Gather package evidence**

Inspect:

- every `packages/*/package.json`
- every `packages/*/src/index.ts`
- all cross-package imports
- shell route composition and feature dependencies

**Step 2: Define failing conditions**

Treat the audit as failing if any of these are true:

- `web` or `desktop` owns feature business logic
- `shell` owns feature-local services or state
- `business` owns feature-local services without cross-feature justification
- feature packages import each other through deep subpaths

**Step 3: Write minimal implementation**

Tighten architecture checks and document any justified exceptions explicitly.

**Step 4: Verify**

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS with the stricter rules still satisfied.

### Task 2: Audit V3 Page And Service Surface

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\plans\2026-03-12-claw-studio-v3-parity-audit.md`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\v3-parity-ui-contract.test.ts`

**Step 1: Gather feature baseline**

Compare `upgrade/claw-studio-v3/src/pages`, `src/services`, `src/store`, and shared shell components to the workspace package equivalents.

**Step 2: Define failing conditions**

Treat the audit as failing if any v3 page, route, service contract, navigation affordance, or UI-state flow is missing or materially changed.

**Step 3: Write minimal implementation**

Add any missing parity assertions and implement only the concrete gaps they expose.

**Step 4: Verify**

Run: `node --experimental-strip-types scripts/v3-parity-ui-contract.test.ts`
Expected: PASS

### Task 3: Close Ownership Or Parity Gaps

**Files:**
- Modify only the exact package files identified by Task 1 and Task 2

**Step 1: Write or extend focused tests**

Add the smallest regression tests needed to pin the discovered behavior or package-boundary rule.

**Step 2: Run tests to verify failure**

Run the specific test or script for the discovered gap.
Expected: FAIL before the fix.

**Step 3: Write minimal implementation**

Move code only when the current package owner is wrong, and preserve the v3 behavior exactly while updating root exports/imports.

**Step 4: Verify**

Run the focused test again plus:

- `node --experimental-strip-types scripts/root-import-boundaries.test.ts`
- `node --experimental-strip-types scripts/root-package-exports.test.ts`

Expected: PASS

### Task 4: Full Verification

**Files:**
- No code changes expected

**Step 1: Run source verification**

Run:

- `node --experimental-strip-types scripts/root-import-boundaries.test.ts`
- `node --experimental-strip-types scripts/root-package-exports.test.ts`
- `node scripts/check-arch-boundaries.mjs`
- `node --experimental-strip-types scripts/v3-parity-ui-contract.test.ts`

Expected: PASS

**Step 2: Run service verification**

Run:

- `node --experimental-strip-types packages/claw-studio-business/src/services/mySkillService.test.ts`
- `node --experimental-strip-types packages/claw-studio-settings/src/services/settingsService.test.ts`
- `node --experimental-strip-types packages/claw-studio-market/src/services/mySkillService.test.ts`

Expected: PASS

**Step 3: Run workspace verification**

Run:

- `pnpm.cmd lint`
- `pnpm.cmd build`

Expected: PASS in a complete dependency environment.
