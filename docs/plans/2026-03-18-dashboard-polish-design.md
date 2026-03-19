# Dashboard Polish Design

## Context

`sdkwork-claw-dashboard` already exists as the default landing surface, but it still behaves like a high-quality summary page instead of a real operations dashboard. The current page has three main gaps:

1. The layout is constrained to `max-w-7xl`, which makes large desktop workspaces feel underused.
2. The dashboard has no token consumption, cost, or trend intelligence, so operators cannot judge runtime efficiency.
3. The visuals use attractive gradients, but the most important surfaces do not fully inherit the active app theme and do not yet communicate a mature control-plane hierarchy.

The user asked for an autonomous polish pass with no blocking questions, stronger product judgment, better professional utility, and theme consistency with the current application.

## Options Considered

### Option A: Keep the current structure and append one token card

Pros:
- Smallest implementation
- Low risk to existing layout

Cons:
- Does not solve the "dashboard" problem
- Leaves wide screens underutilized
- Still reads as a polished landing page, not an operator cockpit

### Option B: Upgrade the page into a responsive executive operations cockpit

Pros:
- Preserves the current route and package boundary
- Adds real operational signal: token volume, spend trend, efficiency, and risk
- Lets the page use the full available width while staying readable on smaller screens
- Can align every accent surface with the existing `--theme-primary-*` system

Cons:
- Requires data model expansion, new components, and broader i18n changes
- Needs careful hierarchy to avoid becoming visually noisy

### Option C: Split dashboard into multiple tabs

Pros:
- Strong separation between overview, cost, and runtime

Cons:
- Higher navigation overhead
- Too heavy for the current app maturity
- Risks hiding the most important signals behind extra clicks

## Decision

Choose Option B.

The dashboard should remain a single route, but it should behave like a professional control plane with three simultaneous jobs:

1. Explain the current operating state at a glance.
2. Reveal capacity, token, and spend trends without leaving the page.
3. Turn weak signals into prioritized actions.

## Product Design

### Information Hierarchy

The upgraded dashboard is organized into six layers:

1. Executive hero
   - Workspace title, current health posture, refresh action, and direct entry points.
   - A compact status rail for health score, active runtime footprint, token spend, and automation cadence.

2. KPI strip
   - High-signal summary cards for health, capability coverage, today token usage, estimated spend, and active runtime load.
   - Delta indicators so operators can tell direction, not just totals.

3. Token intelligence row
   - A theme-aligned token consumption line chart.
   - A usage mix panel for prompt vs completion tokens.
   - Efficiency stats such as average tokens per run and cost per automation.

4. Runtime operations row
   - Instance readiness and pressure surfaces.
   - Agent/capability coverage with operator-fit scoring.

5. Delivery and automation row
   - Task reliability, next-run schedule confidence, and channel readiness.
   - Compact backlog and failure signals.

6. Recommendations and watchlist
   - Ranked actions with severity.
   - A short list of risk flags and upside opportunities.

### Layout Rules

- Replace the fixed `max-w-7xl` shell with a container that uses the full available width while keeping comfortable internal rhythm.
- Use a denser 12-column composition on large screens and collapse to stacked sections on tablets/mobile.
- Keep card heights consistent within rows so the page feels composed instead of patched together.

### Theme Strategy

- All key accents should derive from `primary-*` utilities or direct CSS variables from the active theme.
- The hero, chart strokes, pills, focus rings, and data highlights should adapt automatically when theme color changes.
- Secondary semantic colors remain purpose-based: success, warning, danger, neutral.

### Token Analytics Model

Because the current runtime is mock-backed, the dashboard should compute believable operational analytics from existing instances, tasks, channels, skills, and agents.

Add a `token` analytics layer with:

- 7-day token trend series
- prompt/completion token split
- estimated spend
- average tokens per automation run
- high-water mark day
- projected monthly usage
- per-instance token contribution

These values should be deterministic so the UI is stable and testable.

## Architecture

### Package Boundary

Keep all product logic in `packages/sdkwork-claw-dashboard`.

The dashboard package should own:
- analytics derivation helpers
- dashboard snapshot expansion
- dashboard-specific visualization components
- dashboard-only types

### Shared Dependencies

Do not import feature-internal services. Continue sourcing raw data from shared infrastructure and shared types.

### i18n

New dashboard copy should stay inside the existing `dashboard` namespace in both `en.json` and `zh.json`. The new keys should cover:
- token analytics
- trend/delta copy
- watchlist labels
- richer section descriptions

## Testing Strategy

Before changing production code:

1. Add or expand service tests for token analytics and snapshot shape.
2. Tighten dashboard contracts so the page is required to expose token sections and adaptive full-width behavior.
3. Run those tests first and confirm they fail for the current implementation.

After implementation:

1. Re-run dashboard-specific tests.
2. Run the existing dashboard contract.
3. Run a build or lint-level check if dependency and time budget allow.

## Success Criteria

This polish pass is successful when:

- the dashboard uses the maximum practical width on large screens
- theme changes visibly restyle the dashboard without bespoke per-theme code
- token usage and estimated spend are first-class dashboard signals
- the page feels like a serious operator product, not a decorative landing page
- the implementation stays inside the repository's package boundaries
