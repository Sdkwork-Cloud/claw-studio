# OpenClaw Cron Tool Allowlist UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real config-owner surface for per-cron-job tool allowlists so isolated OpenClaw scheduled tasks can inspect, edit, and persist their `--tools` restrictions from the existing task studio.

**Architecture:** Keep ownership inside the existing cron task editor instead of the read-only tools catalog, because OpenClaw documents per-job tool restriction as an isolated `agentTurn` payload option. Thread the allowlist through the existing task form model, preserve raw cron payload fields end to end, and only expose the editor when the task runs as an isolated/custom agent turn where tool restriction is meaningful.

**Tech Stack:** TypeScript, React, existing `CronTasksManager` workspace UI, OpenClaw cron payload mapping, Node `--experimental-strip-types` tests, split locale JSON bundles.

---

### Task 1: Preserve Raw Cron Payloads Across Gateway-Backed Tasks

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\openClawGatewayClient.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\openClawGatewayClient.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-types\src\index.ts`

- [ ] **Step 1: Write a failing gateway-client test that expects cron jobs to keep the raw job definition when mapped into workbench tasks**
- [ ] **Step 2: Run the focused gateway-client test and verify it fails because `rawDefinition` is currently dropped for OpenClaw gateway cron jobs**
- [ ] **Step 3: Extend the normalized gateway cron job shape to retain the raw record and expose it through `mapOpenClawJobToWorkbenchTask`**
- [ ] **Step 4: Re-run the focused gateway-client test and verify `rawDefinition` now survives the gateway-backed task path**

### Task 2: Thread Tool Allowlists Through The Shared Task Form Model

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\taskSchedule.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\taskFormMapping.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\cronTaskPayload.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\cronTaskPayload.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\taskSchedule.test.ts`

- [ ] **Step 1: Write a failing cron-payload test for an isolated task that persists a tool allowlist under the native OpenClaw cron payload**
- [ ] **Step 2: Write a failing task-form mapping test that reads an existing payload tool allowlist from `rawDefinition` into editable form state**
- [ ] **Step 3: Run the focused core tests and verify both fail for the expected missing allowlist projection**
- [ ] **Step 4: Add a focused task-form field for tool allowlists and keep it optional so blank values remove the payload restriction**
- [ ] **Step 5: Update task form mapping to read the raw payload allowlist from existing task definitions**
- [ ] **Step 6: Update cron payload serialization so isolated/custom agent-turn jobs write the allowlist back to the native payload while preserving unrelated raw keys**
- [ ] **Step 7: Re-run the focused core tests and verify the new allowlist read/write coverage passes**

### Task 3: Add A Focused Task-Studio Editor Surface

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-commons\src\components\CronTasksManager.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\taskCreateWorkspace.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en\tasks.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh\tasks.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

- [ ] **Step 1: Add focused locale keys for a per-task tool allowlist field, placeholder, and helper text**
- [ ] **Step 2: Add an execution-advanced editor control that accepts one tool or group token per line and normalizes it on save**
- [ ] **Step 3: Keep the field hidden for main-session and system-event jobs, because the documented job-level tool restriction only applies to isolated `agentTurn` payloads**
- [ ] **Step 4: Surface lightweight guidance that the field accepts tool ids and `group:*` shorthands, matching the upstream OpenClaw tool policy vocabulary**
- [ ] **Step 5: Sync compatibility locale bundles after editing the split locale files**

### Task 4: Verify The Allowlist Owner End To End

**Files:**
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\openClawGatewayClient.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\cronTaskPayload.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\taskSchedule.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\scripts\check-locale-structure.mjs`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-tasks-contract.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-instances-contract.test.ts`

- [ ] **Step 1: Run the focused infrastructure/core tests for raw-definition preservation and allowlist payload serialization**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-core/src/services/cronTaskPayload.test.ts
node --experimental-strip-types packages/sdkwork-claw-core/src/services/taskSchedule.test.ts
```

- [ ] **Step 2: Run the locale structure check and the task/instance contract suites**

Run:

```powershell
node packages/sdkwork-claw-i18n/scripts/check-locale-structure.mjs
node --experimental-strip-types scripts/sdkwork-tasks-contract.test.ts
node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts
```

- [ ] **Step 3: Run `pnpm.cmd lint` to confirm the wider workspace still stays green after the allowlist owner lands**
