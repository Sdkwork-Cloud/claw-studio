# Dashboard Business Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `@sdkwork/claw-dashboard` into a business and usage operations cockpit with three business-centric KPI cards, period summaries for week/month/year, revenue and usage analytics, and a bottom tabbed workbench for recent API calls and revenue records.

**Architecture:** Replace the current system-summary-first snapshot with a business-summary-first snapshot, then recompose the dashboard page around three stronger KPI cards, four major analytics surfaces, and a tabbed records workspace. Keep all logic inside `packages/sdkwork-claw-dashboard`, with mock-derived deterministic data that can later be swapped for real backend payloads.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, i18next, Lucide React, Node assert-based tests.

---

### Task 1: Lock the new dashboard direction with failing tests

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
- Modify: `scripts/sdkwork-dashboard-contract.test.ts`

**Step 1: Write the failing test**

- Extend the service test to require:
  - `businessSummary`
  - `tokenSummary`
  - `activityFeed.recentApiCalls`
  - `activityFeed.recentRevenueRecords`
  - `activityFeed.productPerformance`
- Extend the contract test to require:
  - removal of health/capability/capacity/automation cards
  - token card fields for daily requests, daily tokens, daily spend
  - visible period summaries for week/month/year
  - tabs for recent API calls and recent revenue records

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because the new snapshot blocks do not exist yet.

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL because the page still renders the old KPI structure.

**Step 3: Write minimal implementation**

- None yet. Stop after confirming red for the intended reasons.

**Step 4: Commit**

- Skip committing in this session.

### Task 2: Add business summary, token summary, and activity feed data

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/types/index.ts`
- Modify: `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`

**Step 1: Write the failing test**

- Tighten the service test to assert:
  - daily/week/month/year fields exist
  - recent API calls are sorted newest first
  - recent revenue records exist
  - product performance rows exist

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: FAIL because the new structures are incomplete or absent.

**Step 3: Write minimal implementation**

- Add the new summary and activity interfaces.
- Build deterministic mock summaries for:
  - revenue by period
  - requests/tokens/spend by period
  - recent API call records
  - recent revenue records
  - product performance

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 3: Replace the KPI strip with three business-first cards

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/components/MetricCard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`

**Step 1: Write the failing test**

- Use the contract test to require the new card labels and period summaries.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL because the old cards still exist.

**Step 3: Write minimal implementation**

- Remove health/capability/capacity/automation cards.
- Redesign `MetricCard` to support richer content or introduce a dashboard-only KPI card helper.
- Render only:
  - revenue overview
  - token usage overview
  - business conversion

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS or move closer to green with tabs still pending.

**Step 5: Commit**

- Skip committing in this session.

### Task 4: Refine the analytics rows for business and usage storytelling

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/RevenueTrendChart.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/DistributionRingChart.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/ModelDistributionChart.tsx`

**Step 1: Write the failing test**

- Keep the contract test red until the page exposes:
  - revenue trend
  - revenue distribution
  - token trend
  - usage/model distribution

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL while the page structure is still incomplete.

**Step 3: Write minimal implementation**

- Keep four major analytics surfaces.
- Make the narrative feel paired: revenue outcome vs usage input.
- Ensure layout remains strong on large screens and tablets.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS or leave only tabs/i18n work remaining.

**Step 5: Commit**

- Skip committing in this session.

### Task 5: Add the bottom tabbed workbench for recent records

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- Create if needed: `packages/sdkwork-claw-dashboard/src/components/DashboardTabs.tsx`
- Create if needed: `packages/sdkwork-claw-dashboard/src/components/RecordsTable.tsx`

**Step 1: Write the failing test**

- Require tab labels for:
  - recent API calls
  - recent revenue records
  - product performance
  - alerts and watchlist

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL until the tabs exist in the page source.

**Step 3: Write minimal implementation**

- Add a tab bar and state.
- Default to recent API calls.
- Render simple, strong tables for each tab.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 6: Update locale copy for the new dashboard language

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Use the contract test and build verification to catch missing copy.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: FAIL or stay incomplete until the copy exists.

**Step 3: Write minimal implementation**

- Add all new dashboard labels, card text, period summaries, tab labels, and table headings.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 7: Verify the redesigned dashboard end to end

**Files:**
- No code changes unless fixes are needed

**Step 1: Run focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-dashboard-contract.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `pnpm build`
Expected: PASS, unless blocked by unrelated pre-existing workspace issues.

**Step 3: Report status**

- Summarize exact evidence and any remaining risks.
