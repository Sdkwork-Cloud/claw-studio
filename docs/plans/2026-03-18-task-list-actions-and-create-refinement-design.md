# Task List Actions And Create Refinement Design

**Date:** 2026-03-18

## Goal

Elevate scheduled tasks from a basic CRUD table into a product-grade operations surface with richer task actions, clearer status communication, execution history, and a more coherent create/edit workflow.

## Product Direction

### Task Creation

The task creator should follow this information architecture:

1. `基础信息`
- Task name
- Description
- Schedule mode and schedule details
- Core prompt

2. `Execution`
- Session mode
- Wake-up mode
- Execution content type
- Timeout
- Delivery mode
- Delivery channel
- Recipient
- Advanced settings

The previous live preview card in the sidebar should be removed. It adds visual noise and steals space from the actual form. The sidebar should stay focused on step navigation and completion state only.

### Task List

The task list should move away from a dense table toward high-information task cards:

- Primary identity: name, description, prompt excerpt
- Operational metadata: schedule mode, schedule summary, next run, last run
- Runtime health: current status, last execution result, execution trend hint
- Actions:
  - Edit
  - Clone
  - Disable / Enable
  - Run Now
  - View Execution History
  - Delete

High-frequency actions should be directly visible. Lower-frequency destructive or secondary actions can live in a more-actions menu.

## Interaction Model

### Create / Edit

- Use the same workspace dialog for create and edit
- Clone opens the same dialog prefilled from the source task, with a copied name
- Schedule and prompt belong to `基础信息`, not `Execution`

### Run Now

- Creates an immediate execution entry
- Updates `lastRun`
- Leaves `nextRun` based on the scheduled cadence
- Surfaces success or failure in the card state

### Execution History

- Opens in a right-side drawer
- Shows recent runs with:
  - timestamp
  - status
  - trigger source
  - short result summary
  - optional log snippet

## Data Model Additions

Tasks need richer execution metadata:

- `sessionMode`
- `wakeUpMode`
- `executionContent`
- `timeoutSeconds`
- `deliveryMode`
- `deliveryChannel`
- `recipient`

Execution history entries need:

- `id`
- `taskId`
- `status`
- `trigger`
- `startedAt`
- `finishedAt`
- `summary`
- `details`

## Visual Direction

- Cards should feel operational and scan-friendly, not decorative
- Status needs strong at-a-glance color coding
- Prompt excerpts should stay readable but bounded
- Action affordances should be obvious without turning the card into a toolbar wall
- The create/edit dialog should feel calmer: fewer side widgets, stronger grouping, less competition for attention

## Success Criteria

- Users can manage a task without leaving the list
- Create/edit flow matches the mental model of “what the task is” versus “how it runs”
- Execution history is accessible and useful
- The UI remains compact, desktop-first, and low-scroll
