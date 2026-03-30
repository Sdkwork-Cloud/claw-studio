# Cron Task Actions Review And Fix

## Goal

Make every bottom action on the Claw Studio cron task list item execute real, instance-bound logic and match OpenClaw cron behavior.

## Findings

1. `CronTasksManager` invokes several task actions by `task.id` only, without explicitly passing the current `instanceId`.
   - Affected operations: execution history load, clone, run now, toggle status, delete.
   - Current behavior depends on `taskService` remembering the last instance that exposed a task id.
   - This is fragile when multiple OpenClaw instances contain overlapping task ids.

2. Failed OpenClaw cron jobs are treated as if they have no valid status toggle path.
   - OpenClaw maps a job with `enabled=true` and `lastRunStatus=error` to a UI status of `failed`.
   - That job is still enabled in the runtime and can be paused.
   - Current UI disables the enable/disable button because `getTaskToggleStatusTarget('failed')` returns `null`.

3. The toggle button label/icon logic is coupled to the current status string instead of the computed target action.
   - Even after fixing failed-task toggling, the button would still present the wrong label unless the action semantics are derived from the target state.

## OpenClaw Behavior Alignment

- OpenClaw real cron operations are backed by:
  - `cron.add`
  - `cron.update`
  - `cron.run`
  - `cron.remove`
  - `cron.runs`
- A failed cron job is an execution outcome, not a permanently locked lifecycle state.
- Therefore:
  - `Edit`, `Clone`, `Run now`, `History`, and `Delete` remain valid.
  - `Disable` must remain available when the job is currently failed-but-enabled.

## Recommended Fix

1. Make `CronTasksManager` pass the active `instanceId` into every bottom action and history fetch.
2. Redefine the toggle helper so `failed` maps to `paused`.
3. Derive toggle button copy/icon from the computed next status instead of the raw current status.
4. Keep the shared manager as the single source of truth so global task page and embedded instance detail stay consistent.

## Acceptance Criteria

- Every list-item action calls real service logic scoped to the current instance.
- Overlapping task ids across instances do not risk mutating the wrong instance from the shared manager UI.
- Failed OpenClaw tasks still show a valid disable action.
- History, run-now, clone, toggle, and delete continue to refresh the task list correctly after completion.
