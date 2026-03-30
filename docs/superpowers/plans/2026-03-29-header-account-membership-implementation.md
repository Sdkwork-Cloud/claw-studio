# Header Account And Membership Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a professional top-right account workbench that preserves the VIP upgrade modal, adds a header avatar menu, and routes membership, wallet, account, settings, feedback, docs, and download actions cleanly.

**Architecture:** Keep shell components responsible for header and navigation orchestration, reuse `sdkwork-claw-points` for VIP and wallet surfaces, and keep `sdkwork-claw-settings` as the owner of account and feedback pages. Introduce a small shared action model so header and sidebar account surfaces do not drift.

**Tech Stack:** React, TypeScript, React Router, Zustand, TanStack Query, lucide-react, motion, existing `@sdkwork/claw-*` workspace packages.

---

## File Map

- Modify: `packages/sdkwork-claw-shell/src/components/AppHeader.tsx`
  - Add header avatar trigger/menu and replace the in-app mobile dialog action with an external download action.
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
  - Demote sidebar account control and reuse the shared account action definitions.
- Create: `packages/sdkwork-claw-shell/src/components/accountMenuModel.ts`
  - Define typed account action ids, route builders, and guest/authenticated menu groups.
- Create: `packages/sdkwork-claw-shell/src/components/accountMenuModel.test.ts`
  - Cover menu grouping and navigation intents.
- Modify: `packages/sdkwork-claw-points/src/pages/Points.tsx`
  - Read a `view` query param and bias the initial emphasis toward membership or wallet.
- Modify: `packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts`
  - Ensure any new hidden or demoted account actions do not pollute global search if necessary.

### Task 1: Add a tested account menu action model

**Files:**
- Create: `packages/sdkwork-claw-shell/src/components/accountMenuModel.ts`
- Test: `packages/sdkwork-claw-shell/src/components/accountMenuModel.test.ts`

- [ ] **Step 1: Write the failing test**

Cover:
- authenticated menu returns summary + primary + secondary actions
- guest menu excludes authenticated-only actions
- route builders map `membership` to `/points?view=membership` and `wallet` to `/points?view=wallet`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx packages/sdkwork-claw-shell/src/components/accountMenuModel.test.ts`
Expected: FAIL because the model file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement typed action ids and two menu builders:
- `buildAuthenticatedAccountMenu`
- `buildGuestAccountMenu`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx packages/sdkwork-claw-shell/src/components/accountMenuModel.test.ts`
Expected: PASS

### Task 2: Upgrade the header trailing area

**Files:**
- Modify: `packages/sdkwork-claw-shell/src/components/AppHeader.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/accountMenuModel.ts`

- [ ] **Step 1: Add a failing header-level test or targeted model assertion for the new download/navigation intent if a component test harness is unavailable**

Prefer a pure helper test for:
- external mobile download url constant
- guest/authenticated avatar menu action ordering

- [ ] **Step 2: Run the targeted test to verify it fails**

Run the same command as Task 1 if the helper lives in the menu model.
Expected: FAIL for the new contract.

- [ ] **Step 3: Implement the header changes**

Implement:
- `下载 App` action opens `https://clawstudio.sdkwork.com/download/app/mobile` via `openExternalUrl`
- keep `PointsHeaderEntry`
- add avatar trigger with dropdown
- use auth store session data for summary card
- keep `DesktopWindowControls` intact

- [ ] **Step 4: Run shell/package verification**

Run: `pnpm exec tsc --noEmit -p packages/sdkwork-claw-shell/tsconfig.json`
Expected: PASS

### Task 3: Demote sidebar account control without losing access

**Files:**
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/accountMenuModel.ts`

- [ ] **Step 1: Write the failing test for menu reuse if needed**

Cover that the sidebar uses the same action ids or helper contract instead of duplicating route logic.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx packages/sdkwork-claw-shell/src/components/accountMenuModel.test.ts`
Expected: FAIL until sidebar-related menu roles are represented in the model.

- [ ] **Step 3: Implement the sidebar simplification**

Implement:
- reuse shared menu actions
- keep quick identity access
- reduce duplicated custom menu logic

- [ ] **Step 4: Run shell verification**

Run: `pnpm exec tsc --noEmit -p packages/sdkwork-claw-shell/tsconfig.json`
Expected: PASS

### Task 4: Add view-aware member center behavior to the points page

**Files:**
- Modify: `packages/sdkwork-claw-points/src/pages/Points.tsx`

- [ ] **Step 1: Write the failing test for `view` parsing if a page-level test is practical; otherwise extract a tiny helper and test that helper**

Cover:
- missing query defaults safely
- `membership` maps to membership emphasis
- `wallet` maps to wallet emphasis

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx <points-view-helper-test>`
Expected: FAIL until the helper exists.

- [ ] **Step 3: Implement minimal points page support**

Implement:
- parse `view` from search params
- adjust visible emphasis copy/action focus
- keep current dialogs and data loading behavior unchanged

- [ ] **Step 4: Run points/package verification**

Run: `pnpm exec tsc --noEmit -p packages/sdkwork-claw-points/tsconfig.json`
Expected: PASS

### Task 5: Final verification

**Files:**
- Modify if needed after verification fixes: touched files above

- [ ] **Step 1: Run focused tests**

Run:
- `pnpm exec tsx packages/sdkwork-claw-shell/src/components/accountMenuModel.test.ts`
- any new points helper test command

- [ ] **Step 2: Run typecheck/build verification**

Run:
- `pnpm exec tsc --noEmit -p packages/sdkwork-claw-shell/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/sdkwork-claw-points/tsconfig.json`
- `pnpm lint`

- [ ] **Step 3: Manually verify behavior**

Verify:
- authenticated header shows download app, VIP, points, avatar, window controls
- guest header shows guest-safe avatar menu
- VIP modal still opens from the header
- download app opens the external browser URL
- avatar menu routes to member center, wallet, account, settings, feedback, docs
- sidebar account access still works but no longer behaves as the primary menu

