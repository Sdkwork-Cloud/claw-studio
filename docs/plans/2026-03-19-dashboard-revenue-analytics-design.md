# Dashboard Revenue Analytics Design

## Context

`@sdkwork/claw-dashboard` already has a solid token analytics foundation:

- a compact KPI strip
- token trend analytics with shared time controls
- a distribution ring plus detail table
- deterministic mock-backed analytics in `dashboardService`

The next requirement is to evolve the dashboard from "cost and token observability" into a more complete business operations surface by adding mock revenue analytics. The user explicitly asked for autonomous execution, mock data first, and no blocking questions.

## Goals

1. Add top-level revenue visibility without weakening the current token analytics.
2. Add daily revenue as a first-class KPI so operators can judge monetization pace, not just totals.
3. Add a recent revenue trend line chart that feels consistent with the existing token trend surface.
4. Add a revenue distribution pie/ring chart that shows contribution by product category.
5. Keep the implementation mock-backed but structured so real API adoption later is a data-source swap, not a UI rewrite.

## Options Considered

### Option A: Mix revenue fields into `tokenAnalytics`

Pros:
- Smallest short-term change
- Fastest to wire into the current page

Cons:
- Blurs cost and revenue semantics
- Makes future API contracts harder to understand
- Encourages tightly coupled analytics behavior

### Option B: Add a parallel `revenueAnalytics` domain beside `tokenAnalytics`

Pros:
- Clean mental model
- Easiest path to future backend integration
- Allows chart and table reuse without data coupling
- Preserves current token surfaces while extending the page naturally

Cons:
- Requires new types, service logic, and i18n keys

### Option C: Only add revenue KPI cards and skip detailed charts

Pros:
- Lowest implementation scope
- Very low risk

Cons:
- Misses the user's explicit chart requirements
- Leaves revenue insight shallow and incomplete

## Decision

Choose Option B.

The dashboard should expose two parallel analytics domains:

- `tokenAnalytics` for usage and spend observability
- `revenueAnalytics` for monetization and product-mix observability

This keeps the architecture readable, future-proof, and easier to replace with real backend data later.

## Product Design

### KPI Layer

Keep the existing operator metrics and expand the top card row to include revenue signals:

1. Workspace health
2. Capability coverage
3. Instance availability
4. Active automations
5. Revenue
6. Daily revenue
7. Token usage
8. Actual spend

Definitions:

- Revenue: total revenue for the selected time window
- Daily revenue: total revenue divided by covered days in the selected window
- Token usage: total tokens for the same time window
- Actual spend: calculated cost for the same time window

Daily revenue should remain day-normalized even when the chart granularity is hourly so that the KPI meaning stays stable.

### Analytics Layout

Keep the existing token analytics row and add a parallel revenue analytics row beneath it.

Row 1:
- Left: token trend chart
- Right: model distribution ring + model table

Row 2:
- Left: revenue trend chart
- Right: revenue distribution ring + product table

This keeps the dashboard easy to scan:

- token = operational consumption
- revenue = business outcome

### Shared Time Controls

Revenue analytics should use the same time controls already used by token analytics:

- granularity: `day | hour`
- range: `seven_days | month | custom`

This keeps token and revenue analysis aligned to the same time window and avoids conflicting operator interpretations.

### Revenue Trend

The revenue trend should visually mirror the token trend component:

- same card style
- same popup-based range configuration
- simpler series set focused on revenue

For the mock phase, the chart can show:

- total revenue
- order count

But the primary visual emphasis should remain on total revenue. The page should still feel like "recent revenue trend", not a generic commerce chart overload.

### Revenue Distribution

Revenue distribution should be grouped by product category rather than individual SKU to keep the chart readable.

Initial mock categories:

1. Membership
2. API Packages
3. Extension Market
4. Enterprise Services
5. Digital Goods

The table beside the chart should show:

1. Product category
2. Orders
3. Revenue
4. Share
5. Daily revenue

## Data Design

Add `revenueAnalytics` to the dashboard snapshot with:

- `totalRevenue`
- `dailyRevenue`
- `projectedMonthlyRevenue`
- `totalOrders`
- `averageOrderValue`
- `deltaPercentage`
- `peakRevenueLabel`
- `peakRevenueValue`
- `revenueTrend`
- `productBreakdown`

Mock generation should be:

- deterministic
- believable relative to the active workspace state
- correlated with time-window size and channel/automation/runtime scale

Revenue should not be derived as a trivial alias of spend. It should have its own generation rules and product-mix distribution so the dashboard reads like a business surface instead of a cost mirror.

## Architecture

Files expected to change:

- `packages/sdkwork-claw-dashboard/src/types/index.ts`
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
- `packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx`
- `packages/sdkwork-claw-dashboard/src/components/ModelDistributionChart.tsx`
- new reusable revenue-focused chart helpers if needed
- `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-dashboard-contract.test.ts`

The implementation should favor small reusable abstractions:

- a generic trend chart base with token-specific typing layered on top
- a generic distribution ring/table pattern reusable for model mix and product mix

## Error Handling and Empty States

The current loading and failure behavior should remain unchanged.

If analytics data is absent:

- KPI cards show `--`
- charts render a stable empty placeholder
- the page layout should not collapse

## Testing Strategy

1. Expand service tests first so the revenue analytics contract fails before implementation.
2. Expand the dashboard contract test to lock in:
   - revenue KPI copy usage
   - revenue trend section
   - revenue distribution section
   - product table rendering expectations
3. Implement the data model and UI in the smallest steps possible.
4. Run focused service and contract tests.
5. Run a build verification pass if the wider workspace state allows it.

## Success Criteria

This work is successful when:

- the dashboard has explicit revenue and daily revenue KPI cards
- recent revenue trend is visible and aligned with current time controls
- revenue distribution by product category is visible as a ring/pie chart plus a detail table
- token and revenue analytics feel like two coordinated parts of one dashboard
- the mock data model is clean enough to replace with real APIs later
