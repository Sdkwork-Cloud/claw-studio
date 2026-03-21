# OpenClaw Cron HTTP Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a shared OpenClaw Gateway HTTP client that validates instance access and provides real cron task reads for both the homepage tasks view and the instance detail workbench.

**Architecture:** Introduce a typed `/tools/invoke` client in `@sdkwork/claw-infrastructure`, resolve endpoint and token data from `studio.getInstanceDetail`, map OpenClaw cron payloads into existing task contracts, and update task consumers to prefer direct OpenClaw reads while keeping the current backend or mock fallback paths.

**Tech Stack:** TypeScript, React, workspace packages under `@sdkwork/claw-*`, Fetch API, existing `studio` platform bridge, targeted Node-based tests.

---

### Task 1: Add failing tests for the shared OpenClaw Gateway client

**Files:**
- Create: `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/index.ts`

**Step 1: Write the failing tests**

Cover:

- access resolution from `StudioInstanceDetailRecord`
- endpoint normalization from `instance.baseUrl`, `config.baseUrl`, and `host + port`
- validation result classification for missing endpoint, missing token, unauthorized, rate limited, unreachable, tool denied, and success
- `/tools/invoke` response parsing for `ok: true` and `ok: false`
- cron job and run mapping into current task-facing contracts

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
Expected: FAIL because the shared client does not exist yet.

### Task 2: Implement the minimal shared OpenClaw Gateway client

**Files:**
- Create: `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/index.ts`

**Step 1: Write minimal implementation**

Add:

- typed access descriptor and validation result models
- instance-detail-driven endpoint and token resolution
- typed `POST /tools/invoke` helper
- validation probe using `cron.status`
- wrappers for `cron.list`, `cron.runs`, `cron.run`, `cron.update`, and `cron.remove`
- mapping helpers for task list and run history consumers

**Step 2: Run tests to verify they pass**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
Expected: PASS

### Task 3: Add failing tests for homepage task service OpenClaw reads

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/services/taskService.ts`
- Create or Modify: `packages/sdkwork-claw-tasks/src/services/taskService.test.ts`

**Step 1: Write the failing tests**

Cover:

- OpenClaw instances use the shared client for task list reads
- OpenClaw instances use the shared client for run-history reads
- non-OpenClaw instances continue using `studioMockService`
- failed OpenClaw validation falls back safely

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskService.test.ts`
Expected: FAIL because the task service does not yet route through the new client.

### Task 4: Implement homepage task-service integration

**Files:**
- Modify: `packages/sdkwork-claw-tasks/src/services/taskService.ts`
- Create or Modify: `packages/sdkwork-claw-tasks/src/services/taskService.test.ts`

**Step 1: Wire the service**

Update the service so that:

- OpenClaw task reads prefer the shared Gateway client
- delivery-channel listing remains compatible with the existing UI
- non-OpenClaw and failed-validation scenarios still work through the current mock path

**Step 2: Run tests to verify they pass**

Run: `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskService.test.ts`
Expected: PASS

### Task 5: Add failing tests for instance workbench OpenClaw task refresh

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Create or Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

**Step 1: Write the failing tests**

Cover:

- OpenClaw workbench reads prefer direct HTTP task list and executions
- existing backend task mutations remain untouched
- direct access failures fall back to backend-projected workbench data

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
Expected: FAIL because the workbench service does not yet refresh through the shared client.

### Task 6: Implement instance workbench OpenClaw read integration

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Create or Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

**Step 1: Update OpenClaw read flow**

Refactor the service so that:

- workbench reads keep the existing non-OpenClaw behavior
- OpenClaw task list and task execution reads use the shared Gateway client when validation succeeds
- direct HTTP reads overlay on top of the current workbench projection instead of breaking other sections
- clone, run-now, status toggle, and delete continue to use the current backend bridge unless direct mutation support is fully validated

**Step 2: Run tests to verify they pass**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
Expected: PASS

### Task 7: Verify exports and consumer boundaries

**Files:**
- Modify only if verification finds missing exports or boundary violations.

**Step 1: Run focused verification**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

Expected: PASS

**Step 2: Run workspace checks**

Run:

- `pnpm lint`
- `pnpm build`

Expected: PASS, or report any unrelated pre-existing failures honestly if they are outside this change set.
