# Dashboard Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `sdkwork-claw-dashboard` into a theme-aligned, full-width operational cockpit with token consumption trends, spend analytics, and more professional dashboard hierarchy.

**Architecture:** Expand the dashboard snapshot with deterministic token analytics derived from shared infrastructure data, then rebuild the page around responsive chart-and-KPI sections that fill the available shell width and inherit the active theme via existing primary color tokens.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 utilities, i18next, Lucide React, Node assert-based contract/unit tests.

---

### Task 1: Lock the new dashboard contract with failing tests

**Files:**
- Modify: `scripts/sdkwork-dashboard-contract.test.ts`
- Create: `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`

**Step 1: Write the failing test**

- Require the dashboard contract to assert token analytics sections and adaptive width signals exist.
- Add a service test that expects `getSnapshot()` to expose token trend and spend analytics.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL because the current page does not expose token analytics/full-width behavior.

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because the current snapshot has no token analytics.

**Step 3: Write minimal implementation**

- None yet. This task stops after confirming the current code fails the new tests.

**Step 4: Commit**

- Skip committing in this session.

### Task 2: Expand dashboard snapshot types and analytics helpers

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/types/index.ts`
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`

**Step 1: Write the failing test**

- Extend the service test to assert calculated totals, split ratios, and projected monthly usage.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because the analytics fields are still missing or incorrect.

**Step 3: Write minimal implementation**

- Add dashboard token analytics types.
- Add deterministic helper functions for daily token points, spend, efficiency, and per-instance contribution.
- Return the new analytics block from `getSnapshot()`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 3: Rebuild the dashboard page composition around full-width layout

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/MetricCard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/SectionHeader.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/StatusPill.tsx`

**Step 1: Write the failing test**

- Tighten the dashboard contract to look for token trend, token stats, and a full-width container pattern.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL against the current page source.

**Step 3: Write minimal implementation**

- Replace the `max-w-7xl` shell with a wider adaptive container.
- Add a theme-aligned hero and KPI strip.
- Add token trend and efficiency sections.
- Improve hierarchy, density, and responsive card structure.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 4: Add localized copy for new analytics surfaces

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Rely on the dashboard contract and build-time TS checks to catch missing i18n references.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL or remain red until new translation keys are present in source and locale files.

**Step 3: Write minimal implementation**

- Add matching `dashboard` locale entries for the new token, cost, trend, watchlist, and delta labels.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 5: Verify the polished dashboard end to end

**Files:**
- No code changes unless fixes are needed

**Step 1: Run focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `pnpm check:sdkwork-dashboard`
Expected: PASS

Run: `pnpm build`
Expected: PASS, unless blocked by unrelated existing workspace issues.

**Step 3: Report status**

- Summarize exact verification results.
- Call out any unrelated pre-existing failures if they appear.
