# API Router Usage Records Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a polished `Usage Records` top tab to API Router with summary cards, filter controls, sortable request records, CSV export, and pagination.

**Architecture:** Extend shared API Router types, add mock-backed usage-record query methods in `studioMockService`, expose them through `apiRouterService`, and compose the UI from a dedicated page plus focused child components rendered by the existing page-level tab container.

**Tech Stack:** React 19, TypeScript, TanStack Query, i18next, Tailwind, Node strip-types tests, workspace mock services

---

### Task 1: Add failing type expectations for usage records

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts`
- Modify: `scripts/sdkwork-apirouter-contract.test.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`

**Step 1: Write the failing expectations**

Add test expectations that the API Router service exposes:

```ts
apiRouterService.getUsageRecordApiKeys
apiRouterService.getUsageRecordSummary
apiRouterService.getUsageRecords
```

Add contract expectations for the new page/component files that will be introduced.

**Step 2: Run the targeted service and contract tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts
```

Expected: FAIL because the service surface and files do not exist yet.

**Step 3: Add the shared type definitions**

Add usage-record-specific types to `packages/sdkwork-claw-types/src/index.ts`, including:

- `ApiRouterUsageRecordMode`
- `ApiRouterUsageTimeRangePreset`
- `ApiRouterUsageRecord`
- `ApiRouterUsageRecordSummary`
- `ApiRouterUsageRecordsQuery`
- `ApiRouterUsageRecordSortField`

Reuse `PaginatedResult<T>` from the shared service contract.

### Task 2: Add failing mock-service tests

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Step 1: Write failing tests for usage records**

Cover:

- listing available API keys for filtering
- summary aggregation
- API key filtering
- model/time sorting
- pagination

**Step 2: Run the targeted infrastructure test**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts
```

Expected: FAIL because the mock service methods do not exist yet.

### Task 3: Implement mock usage-record data and queries

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

**Step 1: Add seeded usage-record data**

Seed a realistic dark-dashboard-friendly record list containing:

- multiple API keys
- multiple models
- mixed streaming and non-streaming requests
- varied token counts
- TTFT and duration values
- recent timestamps spanning the supported presets

**Step 2: Add clone helpers and aggregation helpers**

Implement helpers for:

- summary reduction
- filter normalization
- sorting
- pagination slicing

**Step 3: Add mock service methods**

Implement:

- `listApiRouterUsageRecordApiKeys`
- `getApiRouterUsageRecordSummary`
- `listApiRouterUsageRecords`

**Step 4: Re-run the targeted infrastructure test**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts
```

Expected: PASS

### Task 4: Add failing API Router service tests

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts`

**Step 1: Add failing service tests**

Cover:

- method exposure
- summary retrieval
- filtered usage record retrieval
- paginated result shape

**Step 2: Run the targeted service test**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
```

Expected: FAIL

### Task 5: Implement the feature service layer

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts`

**Step 1: Extend the interface**

Add service methods for usage record filter options, summary, and paginated details.

**Step 2: Wire the mock-backed implementations**

Delegate to the new `studioMockService` methods.

**Step 3: Re-run the targeted service test**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
```

Expected: PASS

### Task 6: Build the Usage Records page and child components

**Files:**
- Add: `packages/sdkwork-claw-apirouter/src/pages/ApiRouterUsageRecordsPage.tsx`
- Add: `packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageSummaryCards.tsx`
- Add: `packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageFilters.tsx`
- Add: `packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageTable.tsx`
- Add: `packages/sdkwork-claw-apirouter/src/components/ApiRouterUsagePagination.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/index.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx`

**Step 1: Add the new top tab**

Render `Usage Records` from `ApiRouter.tsx` as a new page-level panel.

**Step 2: Build the dedicated page**

Own:

- filter state
- query wiring
- refresh
- reset
- CSV export

**Step 3: Build child components**

Split presentational responsibilities into:

- summary cards
- filters toolbar
- detail table
- pagination footer

**Step 4: Keep the page visually aligned with existing API Router surfaces**

Reuse current card, table, spacing, and dark-mode styling patterns.

### Task 7: Localize the new UI

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Add new top-tab copy**

Include `apiRouterPage.pageTabs.usageRecords`.

**Step 2: Add usage-record page copy**

Include:

- summary labels
- filter labels
- time presets
- action labels
- table headers
- empty states
- pagination text

**Step 3: Keep terminology consistent**

Use `Usage Records` / `使用记录` consistently across the page.

### Task 8: Update contract coverage

**Files:**
- Modify: `scripts/sdkwork-apirouter-contract.test.ts`

**Step 1: Require the new page and components**

Assert the new files exist and are referenced from `ApiRouter.tsx`.

**Step 2: Assert the new tab key exists**

Expect `apiRouterPage.pageTabs.usageRecords` usage in the page source.

### Task 9: Verify implementation

**Files:**
- Modify only if verification reveals issues

**Step 1: Run focused tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts
```

Expected: PASS

**Step 2: Run workspace verification**

Run:

```bash
pnpm lint
pnpm build
```

Expected: PASS, or a clearly documented unrelated failure

**Step 3: Manual review checklist**

Verify:

- the top tab switches correctly
- summary cards react to filters
- reset restores defaults
- model/time sorting works
- page size and pagination update correctly
- CSV export downloads filtered records
- long user-agent text exposes full content with hover title

## Execution Note

The user explicitly requested autonomous delivery without further questions, so implementation proceeds directly from this plan with self-selected assumptions and verification.
