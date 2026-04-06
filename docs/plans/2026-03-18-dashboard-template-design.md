# Claw Studio Dashboard Template Design

## Context

Claw Studio already has strong feature surfaces for chat, instances, tasks, channels, market, and devices, but it lacks a first-class operational control plane. The current entry experience drops users directly into a single feature route instead of giving them a workspace-wide situational overview. That is acceptable for parity migration, but not for a reusable template-grade application shell.

The user explicitly asked for a professional dashboard package that reflects the application's real capability graph, especially instances and agent abilities, and to make autonomous product and architecture decisions without interruption.

## Options Considered

### Option A: Lightweight visual homepage

Add a single `/dashboard` page with static metrics and shortcuts.

Pros:
- Fastest to ship
- Minimal code movement

Cons:
- Does not become a reusable shell pattern
- Risks duplicating data logic later in other features
- Fails the "professional tool" bar

### Option B: Dedicated feature package with aggregated operational view

Create `sdkwork-claw-dashboard` as a new feature package and make it the default landing surface for the shell. Aggregate existing runtime data into a dashboard snapshot and expose structured sections for workspace health, instances, automations, channel readiness, and agent capability coverage.

Pros:
- Matches the repository's package architecture
- Scales as a reusable template foundation
- Supports future evolution into real runtime observability

Cons:
- Requires route, navigation, contracts, and docs changes
- Needs some service-layer cleanup to avoid feature-to-feature coupling

### Option C: Put dashboard directly in shell

Pros:
- Slightly less package wiring

Cons:
- Pollutes shell responsibilities
- Makes future template evolution worse
- Conflicts with current repository guidelines

## Decision

Choose Option B.

`dashboard` becomes a first-class feature package and the default product landing route. The shell remains focused on layout, routing, and runtime composition. The dashboard itself becomes the reusable template "workspace control plane" for this app family.

## Product Design

The dashboard should feel like an operator cockpit, not a marketing landing page.

Primary sections:

1. Workspace Pulse
- Overall workspace health score
- Active instance ratio
- Automation reliability
- Connected channel readiness
- Installed capability depth

2. Instance Operations Grid
- Per-instance health and status
- CPU and memory pressure
- Runtime version and uptime
- Quick navigation into instance detail

3. Agent Capability Matrix
- Shared agent catalog
- Capability tags derived from installed skills, action types, and creators
- Operational readiness scoring so the surface feels purposeful, not decorative

4. Automation And Delivery Surface
- Active, paused, and failed tasks
- Upcoming runs and automation action mix
- Channel connectivity and operator delivery readiness

5. Recommended Actions
- Contextual next steps such as deploying another instance, configuring delivery channels, or increasing capability coverage

## Architecture

### Package Boundary

Create a new feature package:

- `packages/sdkwork-claw-dashboard`

It owns:
- dashboard page
- dashboard-specific presentational components
- dashboard aggregation service
- dashboard types

### Shared Data Boundary

To keep dependency flow clean, the dashboard should not depend on other feature packages for raw data. Instead, it should build on shared infrastructure/runtime services.

This design introduces a shared agent catalog in the infrastructure mock/runtime layer so both dashboard and chat can consume the same source of truth.

### Routing And Shell

- Add `/dashboard`
- Redirect `/` to `/dashboard`
- Add `dashboard` to sidebar workspace group
- Add dashboard to command palette navigation
- Add dashboard to settings sidebar visibility controls
- Add route constants for dashboard

### Contracts And Template Rules

The repo currently enforces a strict V5 route surface. Because `dashboard` is an intentional template enhancement beyond parity, route validation should evolve to "V5 baseline plus approved template extensions" rather than blocking all evolution.

## Algorithms

The dashboard should not just count entities. It should compute useful operational indicators.

### Workspace Health Score

Use a weighted score:

- 40% instance availability
- 25% automation reliability
- 20% channel readiness
- 15% resource pressure efficiency

This yields a single control-plane health score from 0-100.

### Instance Readiness Score

Per instance:

- start from status baseline
- subtract CPU pressure
- subtract memory pressure
- add stability bonus for online uptime

This makes instance cards more actionable than raw metrics alone.

### Capability Coverage Score

Use:

- installed skill breadth
- agent catalog breadth
- connected delivery channels
- active automation ratio

This becomes a professional indicator of "how ready this workspace is to run useful AI operations."

## Testing Strategy

Add dashboard contracts before implementation:

- package exists and is locally implemented
- shell routes include dashboard
- root route redirects to dashboard
- sidebar and command palette expose dashboard
- dashboard page preserves operational sections and scoring helpers

## Result

After this change, Claw Studio will no longer open as a collection of disconnected feature pages. It will open as a professional workspace control plane, with `dashboard` acting as the canonical template entry for future Tauri and browser-hosted operator applications.
