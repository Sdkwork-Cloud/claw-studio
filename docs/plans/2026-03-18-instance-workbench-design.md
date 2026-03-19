# Instance Workbench Design

## Context

The current `InstanceDetail` page is still a legacy two-tab screen for configuration and daemon logs. That is too shallow for a template-grade runtime product and does not reflect the actual OpenClaw capability model around channels, scheduled jobs, operators, installed skills, runtime files, memory context, and tools.

The user asked for the instance detail page to be reworked into a sidebar-driven experience covering:

1. Channels
2. Cron Tasks
3. Agents
4. Skills
5. Files
6. Memory
7. Tools

## Options Considered

### Option A: Keep the page and replace the top tabs with more tabs

Pros:
- Lowest code churn
- Minimal service changes

Cons:
- Still feels like a form page, not an instance workspace
- Hard to scale as more per-instance capabilities are added
- Weak visual hierarchy

### Option B: Build an instance workbench with an internal capability sidebar

Pros:
- Matches the user request exactly
- Feels like a professional control surface
- Scales to more instance-native capabilities later
- Lets us separate runtime aggregation from UI concerns

Cons:
- Requires new aggregation service and richer mock runtime data

### Option C: Split each capability into its own route

Pros:
- Deep-linkable
- Good long-term if instance workbench becomes very large

Cons:
- More routing complexity than needed right now
- More shell and navigation coordination
- Slower to evolve in one pass

## Decision

Choose Option B.

We will keep `/instances/:id` as the single route and transform it into an instance-native workbench with:

- a persistent left capability sidebar
- a top summary header for status and instance actions
- a right content canvas that swaps between capability panels

## Architecture

### UI Architecture

`InstanceDetail` becomes a two-level experience:

1. Header summary
- instance identity
- status
- uptime
- active badge
- start/stop/restart/set active actions

2. Workbench body
- left sidebar for capability switching
- right panel for the selected capability

### Data Architecture

Add a dedicated local service:

- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`

It aggregates runtime data from shared infrastructure only:

- `getInstance`
- `getInstanceConfig`
- `getInstanceToken`
- `getInstanceLogs`
- `listChannels`
- `listTasks`
- `listInstalledSkills`
- `listAgents`
- new runtime helpers for files, memory, and tools

This preserves the dependency rule:

`instances -> infrastructure + types + core`

### Runtime Mock Model

To support a serious instance workbench, the infrastructure mock should gain three more per-instance runtime surfaces:

- instance files
- instance memory entries
- instance tools

These are template-level runtime primitives and belong in `studioMockService`, not in UI code.

## Product Design

The page should feel like an OpenClaw runtime cockpit.

### Sidebar Information Architecture

The sidebar sections are:

- `channels`
- `cronTasks`
- `agents`
- `skills`
- `files`
- `memory`
- `tools`

Each item shows a count or status summary so the left rail is informative instead of decorative.

### Panel Design

- `channels`: delivery readiness, connection state, setup completeness
- `cronTasks`: schedules, last run, next run, failure state
- `agents`: available operator catalog and capability focus
- `skills`: installed skills and categories bound to this instance
- `files`: runtime file map such as configs, logs, prompts, and datasets
- `memory`: memory banks, recency, source, and retention value
- `tools`: callable runtime tools, trust level, and operational category

### What Happens To Config And Logs

They do not remain top-level tabs.

- configuration is folded into `files`, `tools`, and the page header summary
- daemon logs are folded into `files` as a runtime artifact plus a live log viewer card

That keeps the page aligned with capability-oriented product language rather than legacy admin terminology.

## Testing Strategy

Before implementation:

- update instance contracts to require the new workbench service
- require the seven sidebar capabilities in `InstanceDetail`
- require the workbench service to aggregate runtime data beyond config/logs

After implementation:

- run instance contract
- run TypeScript/lint
- run build
- run parity and desktop checks as needed
