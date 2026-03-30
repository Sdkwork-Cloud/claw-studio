# Agent Workbench Tabs Redesign

## Goal

Refactor the `Instance Detail -> Agents` right-side workspace into a professional agent workbench that matches OpenClaw’s actual agent capabilities and uses a top-tab information architecture instead of a single long mixed-detail page.

## Context

Current Claw Studio behavior keeps the left-side agent list, but the right-side content stacks model, paths, channels, cron tasks, skills, tools, and files into one long surface. That creates three product problems:

1. The page reads like raw diagnostics instead of an operational agent console.
2. Information hierarchy is poor because strategic info and day-to-day actions compete in the same scroll flow.
3. It does not reflect the panelized structure OpenClaw itself uses for agents (`overview`, `files`, `tools`, `skills`, `channels`, `cron`).

## Approaches Considered

### 1. Keep one long page and improve spacing only

- Lowest implementation cost
- Still leaves poor task-based navigation
- Still feels like an internal admin surface

### 2. Use top tabs that map directly to OpenClaw capability slices

- Best alignment with upstream OpenClaw mental model
- Best commercial desktop UX because the user can enter the exact work mode they need
- Preserves the left agent navigator while making the right side feel like a real workbench

### 3. Convert the whole right side into nested cards with accordion sections

- Better than the current long page
- Worse than tabs for repeat use because sections still compete vertically
- Adds more scanning effort for power users

## Recommendation

Choose approach 2.

This keeps product parity with OpenClaw’s real agent panel model while upgrading the visual and interaction quality to fit Claw Studio as a commercial desktop app.

## Product Design

### Overall Layout

- Keep the left column as the agent navigator.
- Upgrade the left column with search so large agent catalogs remain navigable.
- Keep a strong right-side hero area for identity, default badge, config source, quick actions, and the four most important KPIs.
- Place the workspace tabs immediately below the hero.

### Right-Side Information Architecture

Tabs:

1. `Overview`
   - Identity and role
   - Model selection summary
   - Workspace/config paths
   - Provider readiness snapshot
   - Routing and automation summary cards

2. `Channels`
   - Agent routing state
   - Bound/available accounts
   - Configuration mode and route status

3. `Automation`
   - Agent-scoped cron tasks
   - Status, schedule, and execution target visibility

4. `Skills`
   - Install flow
   - Skill library for this agent
   - Enable/disable/uninstall actions
   - Missing dependency visibility

5. `Tools`
   - Runtime tool catalog available to the agent
   - Tool status and invocation command visibility

6. `Files`
   - Agent workspace bootstrap files
   - Explorer on the left, content preview on the right

### Visual Direction

- The hero remains richer and more editorial than the tab content.
- Tabs should feel like first-class workspace modes, not tiny browser tabs.
- Use short labels, count badges, and one-line descriptions.
- Tab content sits in a unified panel shell to prevent the interface from feeling fragmented.

### Interaction Principles

- Changing agents preserves the current tab when valid, so users can compare the same capability across agents.
- Empty states are tab-specific and instructional.
- The files tab remains read-focused in this surface unless full edit/save semantics are intentionally added later.
- Quick actions stay in the hero, not inside each tab.

## Structural Changes

- Introduce a small presentation layer for agent workbench tabs and counts.
- Split the right-side tab content into focused render helpers instead of continuing to grow `AgentWorkbenchPanel.tsx`.
- Keep the main panel responsible for state and orchestration only.

## Acceptance Criteria

- The right-side agent content uses top tabs instead of a long stacked page.
- Tabs reflect actual OpenClaw agent capability groupings.
- Users can reach overview, channels, automation, skills, tools, and files with one click.
- The page feels like a commercial workstation rather than a raw config dump.
