# Claw Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `claw hub` into a discover-first catalog with a cleaner visual system, lighter navigation, and preserved install/uninstall behavior.

**Architecture:** Keep data fetching and modal actions in `Market.tsx`, extract filtering and ranking into a pure presentation helper, and update i18n plus contract tests so the feature remains internally consistent.

**Tech Stack:** TypeScript, React, TanStack Query, Node `--experimental-strip-types` tests, pnpm workspace contract checks

---

### Task 1: Lock the new catalog behavior in pure tests

**Files:**
- Create: `packages/sdkwork-claw-market/src/pages/marketPresentation.test.ts`
- Create: `packages/sdkwork-claw-market/src/pages/marketPresentation.ts`

- [ ] **Step 1: Write the failing test**

Add tests for category ordering, keyword/category filtering, featured pack ranking, and installed-skill filtering.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-market/src/pages/marketPresentation.test.ts`
Expected: FAIL because the presentation module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement the pure helpers needed to pass the catalog behavior tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-market/src/pages/marketPresentation.test.ts`
Expected: PASS

### Task 2: Rebuild the market page around the new two-view model

**Files:**
- Modify: `packages/sdkwork-claw-market/src/pages/Market.tsx`

- [ ] **Step 1: Rewire the page state**

Replace the four-tab homepage model with `discover` and `installed`, while keeping install modals, detail navigation, and instance-selection behavior.

- [ ] **Step 2: Recompose the layout**

Introduce a lighter header, tighter search, category chips, featured pack row, spotlight skills, and a simplified main skill list.

- [ ] **Step 3: Restyle the installed view**

Give installed skills the same calmer card rhythm and preserve uninstall flows plus empty states.

- [ ] **Step 4: Sanity-check the page**

Run the relevant tests and build/contract checks before moving on.

### Task 3: Update copy and feature contracts

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `scripts/sdkwork-market-contract.test.ts`

- [ ] **Step 1: Add the new copy surface**

Introduce strings for the new page title, subtitle, view toggles, helper copy, sections, badges, and empty states.

- [ ] **Step 2: Update the contract**

Replace the old four-tab contract assertions with checks that match the discover-first redesign while still preserving local market implementation and multi-instance installs.

- [ ] **Step 3: Run verification**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-market/src/pages/marketPresentation.test.ts`
- `pnpm check:sdkwork-market`
- `pnpm build`

Expected: all commands pass with the new `claw hub` experience in place.
