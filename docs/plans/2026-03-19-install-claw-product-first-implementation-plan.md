# Install Claw Product-First Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the install page into a product-first lifecycle workspace with a left product sidebar, a minimal header, and per-product install, uninstall, and migrate experiences.

**Architecture:** Keep the existing route, modal execution flow, and hub-installer bridge, but refactor the install page so product configuration becomes the primary source of truth for install, uninstall, and migration sections. The main shell will become `sidebar + compact header + active workspace`, and per-product availability states will determine whether a workspace offers automated actions or guidance-only states.

**Tech Stack:** React, TypeScript, Tailwind utility classes, i18next, existing installer bridge contracts.

---

### Task 1: Lock The Product-First Shell Contract

**Files:**
- Modify: `scripts/sdkwork-install-contract.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- product-first sidebar markers
- minimal header markers
- top mode tab markers
- per-product uninstall and migrate workspace support
- removal of the old mode-first shell markers as the main contract

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because the new shell markers and per-product lifecycle structure do not exist yet.

**Step 3: Write minimal implementation**

Do not implement here. Continue to the page refactor after verifying the red state.

**Step 4: Run test to verify it still fails for the intended reason**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL on missing product-first shell or lifecycle markers, not on unrelated files.

### Task 2: Refactor Lifecycle Data To Be Product-Centric

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Expand product config to include install methods, uninstall methods, and migration definitions.
- Make uninstall action state product-aware.
- Read install records by selected product instead of assuming OpenClaw only.
- Build migration candidates from the selected product configuration and current record.

**Step 4: Run test to verify progress**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: failures should move from missing product lifecycle data to remaining layout or copy gaps.

### Task 3: Replace The Shell With Sidebar + Minimal Header + Workspace

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Add a stable left sidebar for products.
- Replace the large mode header with a compact workspace header.
- Keep mode switching as lightweight top tabs in the main panel.
- Render install, uninstall, and migrate as focused per-product workspaces.
- Preserve the strongest CTA emphasis for install while toning down visual noise elsewhere.

**Step 4: Run test to verify progress**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: remaining failures should be copy-related or due to availability text not yet added.

### Task 4: Polish Copy For Product-Scoped Workspaces

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Covered by Task 1.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

**Step 3: Write minimal implementation**

- Add copy for the product sidebar and minimal workspace header.
- Add product-scoped uninstall and migrate copy.
- Add availability and empty-state wording for products that have limited automation.
- Shorten explanatory text so the workspace remains visually calm.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS.

### Task 5: Full Verification

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
