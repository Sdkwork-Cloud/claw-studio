# Dashboard Revenue Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mock revenue analytics to `@sdkwork/claw-dashboard`, including revenue KPI cards, daily revenue, a recent revenue trend chart, and a revenue distribution ring plus product table.

**Architecture:** Keep the existing token analytics intact, introduce a parallel `revenueAnalytics` domain in the dashboard snapshot, and lightly generalize the current chart components so token and revenue surfaces share layout behavior without coupling their data semantics.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, i18next, Lucide React, Node assert-based tests.

---

### Task 1: Lock the new revenue analytics contract with failing tests

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
- Modify: `scripts/sdkwork-dashboard-contract.test.ts`

**Step 1: Write the failing test**

- Extend the service test to expect `snapshot.revenueAnalytics`.
- Assert revenue totals, daily revenue, trend points, and product breakdown rows exist.
- Extend the dashboard contract test to expect revenue KPI usage, revenue trend section keys, and revenue distribution keys.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because `revenueAnalytics` does not exist yet.

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL because the page does not reference revenue sections yet.

**Step 3: Write minimal implementation**

- None yet. Stop after proving the tests fail for the right reason.

**Step 4: Commit**

- Skip committing in this session.

### Task 2: Add revenue analytics types and deterministic mock generation

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/types/index.ts`
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`

**Step 1: Write the failing test**

- Tighten the service test to assert exact structural relationships:
  - `dailyRevenue > 0`
  - `productBreakdown.length > 0`
  - product revenue sums to total revenue
  - trend length matches the selected range

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because the new fields and calculations are missing.

**Step 3: Write minimal implementation**

- Add revenue analytics interfaces and product breakdown types.
- Add deterministic helpers to build revenue trend points and product distribution.
- Add `revenueAnalytics` to the returned dashboard snapshot.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 3: Reuse chart primitives for revenue trend and revenue distribution

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/ModelDistributionChart.tsx`
- Create if needed: `packages/sdkwork-claw-dashboard/src/components/RevenueTrendChart.tsx`
- Create if needed: `packages/sdkwork-claw-dashboard/src/components/RevenueDistributionTable.tsx`

**Step 1: Write the failing test**

- Use the dashboard contract test to demand revenue trend and distribution sections in the page source.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL because the revenue UI is still absent.

**Step 3: Write minimal implementation**

- Generalize the trend chart only where reuse pays off cleanly.
- Keep the popup-based range controls unchanged.
- Reuse the distribution ring for product revenue with a revenue-specific center label/value.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS or move closer to green with only i18n remaining.

**Step 5: Commit**

- Skip committing in this session.

### Task 4: Expand the dashboard page with revenue KPIs and sections

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/MetricCard.tsx`

**Step 1: Write the failing test**

- Keep the contract test red until the page references:
  - `dashboard.metrics.revenue`
  - `dashboard.metrics.dailyRevenue`
  - `dashboard.sections.revenueTrend`
  - `dashboard.sections.revenueDistribution`
  - product revenue table labels

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL while the page still lacks the revenue surfaces.

**Step 3: Write minimal implementation**

- Add revenue and daily revenue cards to the KPI strip.
- Add a revenue trend section beneath the token analytics row.
- Add a revenue distribution ring and product breakdown table.
- Keep responsive layout and visual hierarchy aligned with the existing dashboard polish.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 5: Add localized revenue copy

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Use the contract test plus build verification to catch missing revenue copy.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL or remain incomplete until the locale keys exist.

**Step 3: Write minimal implementation**

- Add all new revenue labels, descriptions, chart titles, and table headings to both locales.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 6: Verify the feature end to end

**Files:**
- No code changes unless fixes are needed

**Step 1: Run focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `pnpm build`
Expected: PASS, unless blocked by unrelated existing workspace issues.

**Step 3: Report status**

- Summarize exact verification evidence.
- Call out unrelated pre-existing workspace failures if they appear.
