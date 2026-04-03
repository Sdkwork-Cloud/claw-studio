# Provider Center Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Provider Center route-config editing into a left-side drawer, simplify provider selection with priority-based ordering, and reorganize the editor body into a clearer top-first route console.

**Architecture:** Keep provider ordering in `providerConfigEditorPolicy.ts` so UI state stays deterministic and testable. Extend the shared overlay layout with left/right drawer anchoring, then wire the editor UI onto the shared overlay surface, compact chooser rows, and a top-priority editor header that surfaces route status controls before the core form.

**Tech Stack:** TypeScript, React, shared overlay utilities in `@sdkwork/claw-ui`, node `assert`-style strip-types tests.

---

### Task 1: Lock ordering rules in policy tests

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.ts`

- [ ] **Step 1: Write the failing test**

Add a test that asserts the leading provider ids returned by `listProviderConfigKnownProviderOptions` are ordered with `minimax` and `moonshot` ahead of `qwen`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`

Expected: FAIL because the current implementation preserves preset order instead of the recommended ranking.

- [ ] **Step 3: Write minimal implementation**

Add a stable provider-priority map and sort known provider options by that rank, then by label for unranked providers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`

Expected: PASS.

### Task 2: Add left-side drawer support in shared overlay layout

**Files:**
- Modify: `packages/sdkwork-claw-ui/src/components/overlayLayout.ts`
- Modify: `packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`
- Modify: `packages/sdkwork-claw-ui/src/components/OverlaySurface.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that the overlay layout returns left-side drawer anchoring without changing the existing default right-side drawer behavior.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`

Expected: FAIL because the layout helpers only support right-side drawers today.

- [ ] **Step 3: Write minimal implementation**

Introduce an explicit drawer-side option and thread it through `overlayLayout.ts` and `OverlaySurface.tsx`, keeping right as the default.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`

Expected: PASS.

### Task 3: Move Provider Center editor to the shared left drawer and compact chooser rows

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/ProviderConfigEditorSheet.tsx`

- [ ] **Step 1: Write the failing test surrogate**

Use the new passing policy and overlay tests as guardrails, then inspect the component to ensure it still depends on `Dialog` and oversized chooser cards before editing.

- [ ] **Step 2: Write minimal implementation**

Swap the editor shell from `Dialog/DialogContent` to `OverlaySurface` with `variant="drawer"` and `drawerSide="left"`. Replace large chooser cards with compact row items that show only icon badge, name, and selected state. Keep selected-provider metadata in the main panel header. Render `Custom Route` as the last chooser item.

- [ ] **Step 3: Run focused verification**

Run:

`node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`

`node --experimental-strip-types packages/sdkwork-claw-ui/src/components/overlayLayout.test.ts`

Expected: PASS for both focused tests.

### Task 4: Recompose the right-side editor layout around top-priority route controls

**Files:**
- Modify: `scripts/sdkwork-settings-contract.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/ProviderConfigEditorSheet.tsx`

- [ ] **Step 1: Write the failing test**

Add a contract assertion that the Provider Center editor source contains a dedicated route-status section before the access form section.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`

Expected: FAIL because the current editor keeps the status toggles lower in the sheet.

- [ ] **Step 3: Write minimal implementation**

Reorganize the right-side editor so the top section includes provider summary plus `enabled` and `default route` controls, then refactor the remaining form into clearer primary and supporting cards with stronger visual hierarchy.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`

Expected: PASS.

### Task 5: Run workspace verification for touched surfaces

**Files:**
- Modify: none expected

- [ ] **Step 1: Run package-level checks**

Run: `pnpm check:sdkwork-settings`

Expected: PASS.

- [ ] **Step 2: Run shared UI checks**

Run: `pnpm check:sdkwork-ui`

Expected: PASS.
