# Dashboard Analytics Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the dashboard into an analytics-first workbench with non-redundant layout, time controls, multi-series token trends, and model distribution analysis.

**Architecture:** Replace the oversized summary hero with a compact analysis header, expand the dashboard analytics snapshot to support time-window parameters and model breakdown data, and rebuild the dashboard UI around a trend chart plus model distribution panel while preserving lower-priority operational sections.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, i18next, Lucide React, Node assert-based tests.

---

### Task 1: Lock the redesigned analytics expectations with failing tests

**Files:**
- Modify: `scripts/sdkwork-dashboard-contract.test.ts`
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`

**Step 1: Write the failing test**

- Require the page contract to reject the old hero-first pattern and require time controls, multi-line trend signals, and model distribution sections.
- Require the service test to assert day/hour support, range modes, five token metrics, and per-model cost rows.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL because the current page still contains the redundant hero and missing analytics controls.

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because the current snapshot does not support the richer analytics API.

**Step 3: Write minimal implementation**

- None yet.

**Step 4: Commit**

- Skip committing in this session.

### Task 2: Expand the analytics types and service API

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/types/index.ts`
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`

**Step 1: Write the failing test**

- Add exact expectations for:
  - `day` and `hour` granularity
  - `seven_days`, `month`, and `custom` range modes
  - trend points containing total, input, output, cache creation, and cache read
  - model distribution rows with request count, token, actual amount, and standard amount

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Expand snapshot types and analytics input/output types.
- Let `dashboardService.getSnapshot()` accept analytics options.
- Generate deterministic bucketed data and model distribution rows.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 3: Rebuild the analytics UI around compact controls and chart panels

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx`
- Create: `packages/sdkwork-claw-dashboard/src/components/ModelDistributionChart.tsx`
- Create: `packages/sdkwork-claw-dashboard/src/components/AnalyticsControlGroup.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/MetricCard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/SectionHeader.tsx`

**Step 1: Write the failing test**

- Tighten the page contract to assert the compact analytics header, model distribution section, and multi-series trend labels exist.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Remove the redundant hero card.
- Add day/hour and time-range controls.
- Add a five-series line chart.
- Add pie chart plus right-side analytics table.
- Keep the lower operational sections, but reduce hierarchy competition.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 4: Add localized labels for the redesigned analytics workbench

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Use page contract and build checks to expose missing translation keys.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL until the new labels exist.

**Step 3: Write minimal implementation**

- Add labels for:
  - granularity controls
  - range controls
  - month/custom controls
  - five series legend items
  - model distribution chart and table columns

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 5: Verify the redesigned dashboard end to end

**Files:**
- No code changes unless fixes are needed

**Step 1: Run focused checks**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 2: Run integration checks**

Run: `pnpm check:sdkwork-dashboard`
Expected: PASS

Run: `pnpm build`
Expected: PASS unless blocked by unrelated existing workspace issues.

**Step 3: Report status**

- Report exact verification commands and results.
- Note any remaining unrelated workspace warnings separately.
