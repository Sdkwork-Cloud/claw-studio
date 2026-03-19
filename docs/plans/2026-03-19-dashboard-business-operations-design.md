# Dashboard Business Operations Design

## Context

`@sdkwork/claw-dashboard` has already moved beyond a placeholder page and now includes token analytics plus revenue analytics. That progress was useful, but the dashboard still carries too much control-plane framing for the user's current goal.

The new direction is more opinionated:

- remove generic system cards such as health, capability, capacity, and automation
- elevate revenue and model/API usage as the actual center of the dashboard
- show daily business and calling metrics first, then make week/month/year rollups easy to scan
- add a bottom workbench with tabs for recent model/API calls, recent revenue records, and supporting business views

The user explicitly asked for autonomous iteration and final delivery without further questions, so this design is treated as approved for execution.

## Product Goal

Turn the dashboard into a polished business and usage operations surface that answers four questions immediately:

1. How much money are we making today, and how is that trending across week, month, and year?
2. How much are models and APIs being called today, in requests, tokens, and spend?
3. Which products and models are driving the current mix?
4. What exactly happened most recently at the record level for calls and revenue?

## Options Considered

### Option A: Keep adding more cards to the existing dashboard

Pros:
- smallest code change
- minimal restructuring

Cons:
- weak information hierarchy
- dashboard becomes a crowded patchwork
- records and analytics compete for attention

### Option B: Reframe the dashboard as a business and usage operations cockpit

Pros:
- strong top-level hierarchy
- clearer narrative from KPI to trend to record-level evidence
- supports future real backend integration cleanly
- aligns with the user's focus on revenue and API/model usage

Cons:
- requires removing existing summary cards
- needs richer mock data and a more disciplined page composition

### Option C: Split the dashboard into multiple routes or tabs at the page level

Pros:
- very strong separation of concerns

Cons:
- adds navigation overhead
- weakens the default landing experience
- too heavy for the current product maturity

## Decision

Choose Option B.

The dashboard should become a single-page business and usage cockpit with:

- a compact high-signal KPI row
- strong visual trend and distribution analysis
- a bottom tabbed workbench for recent records

## Information Architecture

### Top KPI Row

Remove these cards entirely:

- health
- capability coverage
- instance availability
- active automations

Replace them with three stronger business cards:

1. Revenue Overview
2. Token Usage Overview
3. Business Conversion

#### Revenue Overview card

Primary focus:
- today revenue

Embedded secondary stats:
- week revenue
- month revenue
- year revenue
- delta vs previous comparable window

#### Token Usage Overview card

Primary focus:
- daily request count
- daily token count
- daily spend

Embedded secondary stats:
- week requests / tokens / spend
- month requests / tokens / spend
- year requests / tokens / spend

This is the key card the user explicitly requested.

#### Business Conversion card

Primary focus:
- daily orders
- average order value
- successful call ratio or paid conversion ratio

Embedded secondary stats:
- week orders
- month orders
- year orders

This card links call activity to business outcome and prevents the dashboard from being split into unrelated revenue and token blocks.

### Mid-page Analytics

Use two rows of major surfaces.

#### Row 1

- left: recent revenue trend
- right: revenue distribution by product

#### Row 2

- left: recent token/API usage trend
- right: model/API distribution

These should feel like paired business and usage mirrors:

- revenue answers outcome
- token/API answers operating input and cost

### Bottom Workbench Tabs

The bottom section should become a serious records workspace with tabs.

Tabs:

1. Recent API Calls
2. Recent Revenue Records
3. Product Performance
4. Alerts and Watchlist

The default selected tab should be Recent API Calls because it is the most operationally useful and most directly tied to the user's request.

## Data Model

Reshape the dashboard snapshot around business analytics instead of system posture.

### New summary blocks

- `businessSummary`
- `tokenSummary`
- `trendAnalytics`
- `distributionAnalytics`
- `activityFeed`

### `businessSummary`

Should include:

- `todayRevenue`
- `weekRevenue`
- `monthRevenue`
- `yearRevenue`
- `todayOrders`
- `weekOrders`
- `monthOrders`
- `yearOrders`
- `averageOrderValue`
- `conversionRate`
- `revenueDelta`

### `tokenSummary`

Should include:

- `dailyRequestCount`
- `dailyTokenCount`
- `dailySpend`
- `weeklyRequestCount`
- `weeklyTokenCount`
- `weeklySpend`
- `monthlyRequestCount`
- `monthlyTokenCount`
- `monthlySpend`
- `yearlyRequestCount`
- `yearlyTokenCount`
- `yearlySpend`
- `usageDelta`

### `trendAnalytics`

Should include:

- `revenueTrend`
- `tokenTrend`

Each trend should support multiple windows for display:

- recent 7 days
- recent 30 days
- recent 12 months

The existing `day/hour/month/custom` machinery can be retained internally if useful, but the visible product language should shift toward business-friendly windows.

### `distributionAnalytics`

Should include:

- `revenueByProduct`
- `usageByModel`

### `activityFeed`

Should include:

- `recentApiCalls`
- `recentRevenueRecords`
- `productPerformance`
- `alerts`

## Recent API Calls Design

This is a record-level operational table for model/API activity.

Columns:

- time
- model name
- provider
- endpoint
- request count
- token count
- cost amount
- latency
- status

Behavior:

- sorted newest first
- light status filtering: all / success / failed
- rows emphasize model and cost, not decorative metadata

## Recent Revenue Records Design

Columns:

- time
- product
- order number
- revenue amount
- channel
- status

This should feel like a clean business ledger, not a full accounting system.

## Product Performance Design

Columns:

- product
- revenue
- orders
- share
- trend delta

This tab complements the revenue distribution chart with a ranked summary view.

## Alerts and Watchlist Design

This tab should be more selective than the old generic watchlist.

Focus on business and usage signals such as:

- sharp model cost increase
- rising API failure rate
- excessive concentration in one product
- revenue slowdown against recent baseline

## Visual Design

### Tone

This should feel like a premium operations product:

- fewer cards, more meaning per card
- stronger typography hierarchy
- tighter spacing discipline
- less decorative glow, more structured emphasis

### KPI cards

Each top card should feel like a mini dashboard, not just one number and a description.

Recommended structure:

- eyebrow
- primary metric row
- concise delta badge
- a three-cell period strip for week/month/year

### Tabs workbench

The tab list should look intentional and product-grade:

- large enough to read comfortably
- selected tab clearly elevated
- table surfaces aligned with chart card styling

## Architecture

Keep implementation inside `packages/sdkwork-claw-dashboard`.

Expected files to evolve:

- `packages/sdkwork-claw-dashboard/src/types/index.ts`
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
- `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- `packages/sdkwork-claw-dashboard/src/components/MetricCard.tsx`
- new dashboard-only tab and record-table helpers as needed
- locale files in `packages/sdkwork-claw-i18n/src/locales`
- `scripts/sdkwork-dashboard-contract.test.ts`

Do not move this logic into the web or shell host packages.

## Testing Strategy

Before implementation:

1. Write failing service tests that require the new summary blocks and activity feeds.
2. Write failing contract tests that require:
   - old four cards removed
   - token card with daily requests, daily tokens, daily spend
   - week/month/year period summaries
   - recent API call and revenue tabs

After implementation:

1. Re-run dashboard service tests
2. Re-run dashboard contract tests
3. Run build verification

## Success Criteria

This redesign is successful when:

- the four old system cards are gone
- the top row clearly centers revenue, token usage, and business conversion
- token usage visibly includes daily requests, daily tokens, and daily spend
- week/month/year summaries are visible within the KPI experience
- the dashboard includes tabs for recent API calls and recent revenue records
- the page feels like a focused business operations cockpit rather than a mixed system overview
