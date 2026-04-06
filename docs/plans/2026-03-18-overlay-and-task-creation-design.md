# Overlay Safety And Task Creation Redesign

**Date:** 2026-03-18

## Goal

Unify popup behavior across Claw Studio so global dialogs and drawers no longer clash with the new app header, and redesign task creation into a high-confidence desktop workflow that minimizes scrolling while keeping advanced scheduling powerful.

## Context

The shell now has a persistent top header. Several features still render popups as raw `fixed inset-0` surfaces or full-height drawers anchored at `top-0`, which makes overlays feel visually cramped and can cause them to appear hidden behind or too close to the header. At the same time, task creation has grown from a small modal into a complex multi-mode workflow, but the UI is still structured as a single long form.

## Design Principles

1. Preserve orientation. Users should keep the app header visible when a global modal or drawer opens.
2. Make the safe area systemic. Header spacing should be a shared rule, not page-by-page CSS.
3. Prioritize the primary path. Task creation should foreground name, prompt, schedule mode, and execution intent before secondary controls.
4. Keep expert power nearby. Advanced controls stay in the flow, but visually separated from the high-frequency configuration path.
5. Reduce scroll debt. Desktop layouts should prefer split panes, sticky summaries, and fixed action bars over long vertical forms.

## Chosen Approach

Adopt a shared header-safe overlay system and migrate the high-impact global overlays to it:

- Shared centered modal behavior for classic dialogs
- Shared right-side drawer behavior for configuration panels
- Shared safe-area tokens for top offset, height, inset padding, and footer placement

Redesign task creation as a large workspace dialog with a left navigation rail and a right content canvas:

- Left rail for section navigation and live readiness summary
- Right content split into `Basic Info`, `Execution`, `Common Config`, and `Advanced`
- Schedule selection expressed as explicit cards for interval, exact date/time, and cron
- Sticky footer with validation state and primary actions

This keeps the app feeling like a cohesive desktop product instead of a collection of page-specific overlays.

## Overlay Architecture

### Shared Safe Area

Introduce shared overlay layout primitives in `@sdkwork/claw-ui`:

- Header height token: `48px` to match `AppHeader`
- Top inset: header height plus breathing room
- Max height: viewport height minus header-safe inset and outer margins
- Scroll confinement: body content scrolls inside the surface; headers and footers remain fixed inside the surface

### Surface Variants

Two variants are needed:

1. `modal`
- Centered, bounded width
- Used for confirm/config/install flows

2. `drawer`
- Anchored to the right
- Starts below the app header
- Preserves the app shell frame

### Layering Rules

- App header remains visible
- Global overlays render above page content and sidebar
- Command palette remains above standard overlays
- Local dropdowns stay local unless they need viewport-escape behavior

## Task Creation Information Architecture

### Navigation

Desktop:
- Left sidebar with numbered sections:
  - `1. 基础信息`
  - `2. Execution`
- Each section shows completion state

Mobile:
- Sidebar collapses into segmented tabs stacked above content

### Section Breakdown

#### 1. 基础信息

- Task name
- Description
- Enabled toggle
- Quick summary card describing what this task will do

#### 2. Execution

Primary area:
- Action type selector
- Prompt input as the dominant content block
- Schedule mode cards

Common Config:
- Interval value/unit or exact date/time depending on selected mode
- Inline schedule preview and cron preview

Advanced:
- Raw cron expression when cron mode is selected
- Expert-facing explanatory copy

### Validation Experience

- Inline field errors stay close to the field
- Left navigation shows incomplete state
- Footer readiness panel summarizes blocking issues
- Primary button remains visible at all times on desktop

## Interaction Details

### Modal Behavior

- Click backdrop to close when safe
- `Escape` closes standard dialogs
- Installing or in-progress states can disable dismiss-on-backdrop

### Drawer Behavior

- Backdrop dims page content only below the header-safe area
- Drawer header stays pinned
- Footer actions stay pinned

### Task Workflow

- Opening the task creator resets the form and lands on `基础信息`
- Completing key fields updates a live summary immediately
- Switching schedule mode updates the common-config block in place, avoiding route-like context switching
- Expert controls remain visible but visually secondary

## Visual Direction

- Use the existing zinc + primary palette, but with more structure:
  - soft panel backgrounds
  - elevated content cards
  - strong section titles
  - restrained accent usage for status and focus
- Make the task creator feel like a workbench, not a form dump
- Keep rounded surfaces and blurred backdrops consistent with the current shell language

## Error Handling

- Preserve existing create/update/delete error toasts
- Prevent accidental closure while saving/installing
- Keep invalid states actionable by tying summary errors to real fields

## Testing Strategy

1. Add tests for shared overlay safe-area helpers or constants so header-safe math is not implicit.
2. Add tests for task workspace helpers that drive section status and schedule presentation.
3. Run existing task schedule tests and workspace contract tests.
4. Build the shell to catch cross-package API/export regressions.

## Files Expected To Change

- `packages/sdkwork-claw-ui/src/components/Modal.tsx`
- new shared overlay layout helpers/components in `packages/sdkwork-claw-ui/src/components/`
- `packages/sdkwork-claw-ui/src/index.ts`
- package manifests for features that consume new shared overlay primitives
- `packages/sdkwork-claw-commons/src/components/InstallModal.tsx`
- `packages/sdkwork-claw-channels/src/pages/channels/Channels.tsx`
- `packages/sdkwork-claw-center/src/pages/ClawDetail.tsx`
- `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- `packages/sdkwork-claw-tasks/src/services/` helper files for task-create UI state
- locale files in `packages/sdkwork-claw-i18n/src/locales/`

## Risks

- Shared overlay primitives touch multiple packages, so exports and package dependencies must stay aligned.
- Some page-specific overlays may have subtly different dismissal rules; migration needs to preserve those states.
- The task creation page already contains recent schedule work, so the redesign must preserve all newly added functionality.

## Success Criteria

- Standard dialogs and drawers no longer feel covered, cramped, or visually tangled with the header.
- Task creation is readable at a glance, usable with minimal scrolling on desktop, and still complete for expert users.
- Existing schedule modes continue to work: interval, exact date/time, and cron expression.
- Build and targeted tests pass, aside from any pre-existing unrelated failures.
