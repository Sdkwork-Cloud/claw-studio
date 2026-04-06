# Dashboard Analytics Redesign Design

## Context

The current dashboard made meaningful progress toward a professional operator cockpit, but its information hierarchy is still too repetitive for serious analytics work:

- The large hero card repeats health, capacity, token, and spend information that already appears immediately below.
- Token analytics are present, but not yet interactive enough for true operational analysis.
- The chart layer is too shallow for product-grade observability because it only shows one derived line and lacks model distribution detail.

The new requirement is to evolve the dashboard into a more disciplined analytics workbench:

1. Remove repetitive top-of-page summary treatment.
2. Add time granularity controls for daily and hourly analysis.
3. Add time range controls for 7-day, month-based, and custom-range inspection.
4. Upgrade the line chart into a multi-series token chart.
5. Add model distribution with a pie chart plus a detail table.

The user explicitly asked to continue autonomously, so this design is treated as approved for implementation.

## Options Considered

### Option A: Keep the current dashboard and bolt more controls onto the token card

Pros:
- Smallest visual change
- Lowest implementation effort

Cons:
- Repetition remains
- Analytics still feel secondary
- The dashboard stays split between a landing page and an analysis page

### Option B: Convert the dashboard into an analytics-first workbench

Pros:
- Removes duplicated summary hierarchy
- Makes token observability the center of the page
- Better supports real operator workflows and future extension

Cons:
- Requires broader page restructuring
- Needs richer data modeling and chart components

### Option C: Move analytics into a separate tab or route

Pros:
- Cleanest dedicated analytics surface

Cons:
- Adds navigation overhead
- Makes the default dashboard less useful
- Splits related insights across views

## Decision

Choose Option B.

The dashboard should become a disciplined analysis workbench with a compact page header and a strong token analytics core. Summary metrics still exist, but only where they help explain the active analysis, not as repeated decorative surfaces.

## Product Design

### Layout

1. Compact header bar
- Title
- Short description
- Refresh button
- Time granularity segmented control: day / hour
- Time range segmented control: 7 days / month / custom
- If month is active, show month picker
- If custom is active, show start/end date controls

2. Analytics summary strip
- Total token
- Input token
- Output token
- Actual spend
- Standard spend

This strip should be concise and tied directly to the selected time window.

3. Main analytics grid
- Left: multi-series token line chart
- Right: model distribution pie chart + table

4. Secondary operational sections
- Instances
- Automations
- Channels
- Recommendations

These remain available, but they should no longer visually compete with the analytics center.

### Token Trend Chart

The chart must support five independent lines:

1. Total token
2. Input token
3. Output token
4. Cache creation
5. Cache read

Design rules:
- Distinct colors with clear legend
- Visible hover focus points
- Shared scale and clean grid
- Theme-aligned primary line for total tokens
- Supporting semantic colors for the remaining series

### Model Distribution

The pie chart should show share of selected-window token consumption by model.

The table to the right should include:

1. Model name
2. Request count
3. Token
4. Actual amount
5. Standard amount

The table should be sorted by token descending.

### Time Controls

Granularity:
- Day
- Hour

Range:
- 7 days
- Month
- Custom

Behavior:
- Day + 7 days shows 7 daily buckets
- Hour + 7 days shows recent hourly buckets
- Month shows buckets within the chosen month
- Custom respects selected start/end dates and maps to day/hour buckets

### Data Model

Because runtime data is mock-derived today, the analytics model should stay deterministic and believable.

Expand token analytics to include:
- selected granularity
- selected range mode
- time buckets with five metrics each
- model distribution rows
- actual amount
- standard amount

## Architecture

Files to evolve:
- `packages/sdkwork-claw-dashboard/src/types/index.ts`
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.ts`
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
- `packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx`
- new pie-chart/table helper components as needed
- `packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx`
- locale files for new labels and control copy
- dashboard contract test to lock the redesigned experience

## Testing Strategy

1. Write failing tests for:
- analytics controls and sections in page contract
- daily/hourly analytics shape in service tests
- model distribution rows and monetary fields

2. Implement the smallest service expansion to satisfy data expectations.

3. Implement the UI with the new hierarchy and control states.

4. Re-run focused dashboard checks and production build.

## Success Criteria

This redesign is successful when:

- the top hero card is gone as a redundant summary block
- token analysis supports day/hour inspection
- token analysis supports 7-day, month, and custom time ranges
- the line chart shows five differentiated series
- the pie chart and model table expose distribution by model
- the page feels more disciplined and less repetitive than the current version
