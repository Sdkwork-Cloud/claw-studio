# API Router Usage Records Design

**Date:** 2026-03-19

**Status:** Approved for implementation via user-delegated autonomous execution

## Goal

Add a new top-level `Usage Records` tab inside `api-router` that provides an AI API monitoring console with summary cards, filters, sortable detail records, CSV export, and pagination, implemented as an independent page and child-component set within the `@sdkwork/claw-apirouter` feature package.

## Problem Summary

`api-router` currently supports unified key management, route configuration, and model mapping, but it does not provide an operator-facing page for monitoring request-level usage. The existing feature surface shows only coarse usage counters on provider and key tables, which is not enough for:

- request-by-request troubleshooting
- token and cost analysis
- latency tracking
- exporting filtered usage history for offline analysis

The feature also needs to fit the current architecture, which keeps host packages thin and uses service-first feature packages backed by `studioMockService`.

## Product Shape

The new `Usage Records` experience will be exposed as a fourth top tab in `packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx`.

The page itself will be a dedicated page component rather than being embedded directly inside `ApiRouter.tsx`. It will compose focused child components for:

- summary metrics
- filter and action toolbar
- detail table
- pagination footer

This keeps the top-level page small and matches the repository guidance that feature packages should own page and component boundaries.

## Recommended UX Model

### 1. Top Tab Placement

Add `Usage Records` as a peer tab alongside:

- `Unified API Key`
- `Route Config`
- `Model Mapping`

The tab will preserve the current rounded segmented-tab visual style already used by `api-router`.

### 2. Summary Cards

The page header area will show four cards:

- total requests
- total token consumption
- total spend
- average duration

The total token card will include a secondary split for prompt tokens and completion tokens to match the PRD.

### 3. Filter and Action Toolbar

The toolbar will support:

- API key filter
- time range preset filter
- custom start date
- custom end date
- refresh
- reset
- export CSV

The default range will be `7d`, which gives the page useful initial data without overwhelming the table.

### 4. Request Detail Table

The main table will include:

- API key
- model
- reasoning effort
- endpoint
- type
- token detail
- cost
- TTFT
- duration
- time
- user-agent

Sorting will be supported for:

- model
- time

This matches the explicit PRD requirement while keeping the first version focused and readable.

### 5. Pagination

The footer will show:

- total result count
- current visible range
- page size selector
- previous and next buttons
- page number buttons

The initial supported page sizes will be:

- 20
- 50
- 100

## Architecture

### 1. Shared Domain Contracts

`packages/sdkwork-claw-types/src/index.ts`

Add usage-record-specific types for:

- filter input
- time range preset
- summary payload
- detail row
- paginated list result

The list shape should reuse the shared `PaginatedResult<T>` contract already exported from `packages/sdkwork-claw-types/src/service.ts`.

### 2. Mock Data Source

`packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

Add seeded API Router usage records and service methods to:

- list available usage API keys
- return filtered paginated usage records
- return summary statistics for the same filter set

The summary and detail methods should derive their results from the same underlying seeded record list so filtering stays consistent.

### 3. Feature Service Layer

`packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts`

Extend the service surface with methods for:

- usage filter options
- usage summary
- usage records list

The feature UI should continue to depend only on the feature service, not directly on `studioMockService`.

### 4. Page Composition

Create a dedicated page component under the feature package and render it from the new tab in `ApiRouter.tsx`.

Recommended component split:

- `ApiRouterUsageRecordsPage`
- `ApiRouterUsageSummaryCards`
- `ApiRouterUsageFilters`
- `ApiRouterUsageTable`
- `ApiRouterUsagePagination`

This keeps table and filter logic separated from the tab container and makes future backend replacement easier.

## Data and Interaction Model

### Filters

The page state will track:

- selected API key or `all`
- selected preset range
- optional custom start date
- optional custom end date
- page
- page size
- sort field
- sort order

Preset changes should reset pagination to page 1. Reset should restore:

- API key = `all`
- range = `7d`
- custom dates cleared
- page = 1
- page size = 20
- sort = `time desc`

### Derived Requests

The page will issue:

- one query for summary
- one query for paginated records
- one query for API key options

All three queries should share the same normalized filter state so refresh and reset are predictable.

### CSV Export

CSV export will use the currently filtered result set, not only the visible page. The service layer should expose a large-page fetch strategy for export, while the UI creates a Blob and downloads a CSV file locally.

Recommended filename format:

- `api-router-usage-records-YYYY-MM-DD.csv`

## Visual Design

The page should stay aligned with existing `api-router` styling:

- rounded large containers
- soft dark-mode surfaces
- compact uppercase table headers
- high-contrast numeric emphasis

For the PRD's tooltip requirement, the first implementation will use native `title` tooltips on truncated content and icon/metric helpers because the shared UI package does not currently expose a tooltip primitive.

Numeric columns should be visually right-aligned where practical:

- cost
- TTFT
- duration
- time-adjacent metric blocks

This improves scanability for operational use.

## Error and Empty States

- Empty filtered result: show a dedicated empty state card in the table area.
- No data for summary: cards display zero values instead of collapsing.
- Invalid custom range where start is after end: keep the UI resilient by normalizing through the service helper and returning an empty result instead of crashing.

## Testing Strategy

### Service Tests

Add focused tests for:

- default summary calculation
- API key filtering
- time range filtering
- model/time sorting
- pagination

### Contract Coverage

Update the feature contract script so the new page and components are required parts of the `sdkwork-claw-apirouter` feature surface.

### Verification

Run focused package tests first, then workspace checks:

- targeted `node --experimental-strip-types` tests
- `pnpm lint`
- `pnpm build`

## Risks and Mitigations

- Risk: page becomes too large and stateful.
  - Mitigation: page + child-component split with service-backed selectors.
- Risk: CSV export diverges from visible filters.
  - Mitigation: export from the same normalized filter object used by the table query.
- Risk: missing tooltip component leads to inconsistent UX.
  - Mitigation: use `title` attributes now and keep the component boundaries ready for a future shared tooltip primitive.

## Success Criteria

- `api-router` exposes a first-class `Usage Records` top tab.
- The page is implemented as an independent page plus subcomponents, not as one monolithic tab body.
- Operators can review summary metrics, filter by API key and time range, sort usage details, paginate records, and export filtered CSV data.
- The implementation stays inside the feature package boundary and passes focused tests plus workspace verification.
