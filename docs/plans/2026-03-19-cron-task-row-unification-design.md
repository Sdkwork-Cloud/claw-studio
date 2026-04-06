# Cron Task Row Unification Design

**Date:** 2026-03-19

## Goal

Make `Instance Detail` and the global `Cron Tasks` experience feel like the same product surface by using the same row-based list model, the same information hierarchy, and a shared reusable component.

## Context

The repo currently has two different presentations for scheduled tasks:

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` renders a lightweight workbench row for per-instance cron tasks
- `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx` renders large standalone cards with richer actions and execution context

This creates two problems:

- the same object type looks visually inconsistent across entry points
- UI logic for task identity, schedule, status, delivery, execution summary, and action placement is duplicated in page code

## Options Considered

### Option A: Make `Instance Detail` copy the global task card

Pros:
- fastest path to visual parity
- no shared UI work

Cons:
- duplicates task UI rules again
- keeps the task page locked into an oversized card layout
- harder to tune both surfaces together later

### Option B: Extract a shared row-based task list system and use variants

Pros:
- best long-term reuse
- makes both pages consistent without forcing them to be identical
- keeps page-specific behavior in the page and visual grammar in shared UI
- aligns with the user request for both product design polish and reusable components

Cons:
- requires modest refactor in both packages
- needs careful separation between UI-only shared props and task-domain mapping

### Option C: Keep two separate UIs and only align colors/spacing

Pros:
- least code movement

Cons:
- solves styling only
- leaves behavior and information architecture inconsistent
- not a real reusable solution

## Decision

Choose Option B.

We will define a shared row-based task UI in `@sdkwork/claw-ui`, then adapt both pages to that component with page-level variants:

- global `Cron Tasks`: full operational row with actions
- `Instance Detail`: compact read-only row that reuses the same status, metadata, and summary language

## Product Direction

### Shared Row Anatomy

Each task row should expose the same core layers in the same order:

1. Identity
- task name
- status badge
- execution type badge
- short description or prompt fallback

2. Operational metadata
- schedule
- next run
- last run
- action type or delivery target depending on context

3. Runtime summary
- latest execution status and trigger when available
- concise execution summary or no-history placeholder

4. Actions
- optional
- shown only in contexts that support mutation

### Behavior By Surface

#### Global `Cron Tasks`

This remains the operational control center for tasks. It keeps:

- edit
- clone
- enable or disable
- run now
- history
- delete

The page should move from large cards to a cleaner vertical row list so it visually matches the instance workbench and becomes easier to scan.

#### `Instance Detail`

This page should reuse the same row design but stay focused on inspection. It will:

- show the same task identity and health cues
- show the same metadata order
- show the same execution summary language
- avoid duplicating the full action toolbar inside the instance workbench

If lightweight actions fit naturally they should be restrained, not a full management surface.

## Architecture

### Shared UI Layer

Add reusable UI primitives in `packages/sdkwork-claw-ui`:

- task row list container
- task row shell
- metadata item
- status and secondary badge helpers
- optional action slot
- optional execution summary slot

These components must stay data-agnostic. They accept already-derived strings, badges, and action nodes.

### Task Presentation Layer

Add or extend pure presentation mapping in `packages/sdkwork-claw-tasks/src/services` so the task page can derive:

- row tone
- latest execution summary
- delivery summary
- schedule summary
- execution badge label

`Instance Detail` can either consume the same pure helper or use a local adapter for the simpler workbench task type.

## Visual Direction

- list rows should feel editorial and operational, not like dashboard tiles
- spacing should emphasize horizontal scanning on desktop and stack cleanly on smaller screens
- status should remain high-contrast and immediately readable
- action buttons should sit in a predictable right-side area on large screens and wrap cleanly below on narrow screens
- both pages should share the same border radius, surface treatment, badge sizing, and row dividers

## Testing Strategy

- add a failing pure test for any new row presentation derivation
- keep component structure simple enough that existing contract and build checks remain the main safety net
- run targeted task tests plus workspace checks for `ui`, `tasks`, and `instances`

## Success Criteria

- `Instance Detail` and global `Cron Tasks` look like the same product family
- global tasks remain fully manageable from the list
- row-based UI is defined once and reused across packages
- page code becomes smaller and more focused on data wiring rather than repeated layout markup
