# Cron Task Actions Review And Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cron task list item actions instance-safe and OpenClaw-correct across the shared manager experience.

**Architecture:** Keep the shared `CronTasksManager` as the only task-row action surface, but remove hidden dependence on remembered task-instance mappings by passing `instanceId` explicitly from the UI. Align toggle semantics with OpenClaw’s actual cron model where `failed` reflects last execution outcome while the job may still be enabled.

**Tech Stack:** React, TypeScript, shared workspace packages, node-based focused tests

---

### Task 1: Fix shared manager action routing

**Files:**
- Modify: `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

- [ ] Pass `activeInstanceId` to history loading during refresh and explicit history open.
- [ ] Pass `activeInstanceId` to clone, run-now, toggle-status, and delete operations.
- [ ] Derive toggle button label/icon from the computed target status instead of the current status string.

### Task 2: Correct failed-task toggle semantics

**Files:**
- Modify: `packages/sdkwork-claw-ui/src/components/taskCatalogMeta.ts`
- Modify: `packages/sdkwork-claw-ui/src/components/taskCatalogMeta.test.ts`

- [ ] Change `getTaskToggleStatusTarget('failed')` to return `paused`.
- [ ] Update focused tests to reflect failed-task disable support.

### Task 3: Verify behavior

**Files:**
- No source changes required unless verification exposes another issue.

- [ ] Run focused task status helper tests.
- [ ] Run targeted static/type checks for the packages touched.
- [ ] If verification exposes a regression, patch only the minimal affected surface and rerun the failing check.
