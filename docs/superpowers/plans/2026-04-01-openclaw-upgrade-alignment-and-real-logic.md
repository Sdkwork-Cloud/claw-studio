# OpenClaw Upgrade Alignment And Real Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Claw Studio to the latest bundled OpenClaw runtime, remove stale mock-driven behavior from built-in instance flows, and verify the built-in/browser/native surfaces all resolve against real runtime or workbench state.

**Architecture:** Keep `scripts/prepare-openclaw-runtime.mjs` as the OpenClaw version source of truth, then make every feature read/write through one of three real surfaces only: managed OpenClaw config files, backend-authored workbench snapshots, or platform-native/browser workbench persistence. Contract tests should assert those real seams explicitly and reject legacy mock fallbacks for runtime-facing features.

**Tech Stack:** pnpm workspace, TypeScript, React, Tauri, Node contract tests, workspace service packages.

---

### Task 1: Repair verification blockers first

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-channels-contract.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\agentService.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\agentService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-channels\src\services\channelService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-channels-contract.test.ts`

- [ ] **Step 1: Run focused tests to capture real failures**
- [ ] **Step 2: Update stale channel contract assertions to the real getPlatformBridge/workbench/openClawConfigService design**
- [ ] **Step 3: Fix any remaining type friction in `agentService.ts` only if current verification exposes it**
- [ ] **Step 4: Re-run the focused tests until green**

### Task 2: Verify latest OpenClaw version truth across runtime surfaces

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\prepare-openclaw-runtime.mjs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sync-bundled-components.mjs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\openclaw_runtime.rs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\platform\registry.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sync-bundled-components.test.mjs`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\tauri-dev-command-contract.test.mjs`

- [ ] **Step 1: Trace where built-in version labels are derived in web, desktop, and runtime metadata**
- [ ] **Step 2: Eliminate any stale version fallback that can still surface pre-2026.3.28 data**
- [ ] **Step 3: Re-run focused runtime/version checks**

### Task 3: Remove remaining runtime-facing mock fallbacks from high-value features

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\instanceEffectiveModelCatalogService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-devices\src\services\deviceService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\installBootstrapService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-dashboard\src\services\dashboardService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\services\modelPurchaseCatalog.ts`

- [ ] **Step 1: Inspect each service for runtime-facing mock fallback**
- [ ] **Step 2: Replace it with real backend SDK, native bridge, config, or truthful unsupported behavior**
- [ ] **Step 3: Add or update focused tests before each behavior change when coverage is missing**

### Task 4: Run workspace verification before claiming completion

**Files:**
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\taskService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\platform\webStudio.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-channels\src\services\channelService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\agentService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-tasks-contract.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-channels-contract.test.ts`

- [ ] **Step 1: Run focused package tests and contract tests**
- [ ] **Step 2: Run `pnpm check:sdkwork-instances`**
- [ ] **Step 3: Run `pnpm --filter @sdkwork/claw-web lint`**
- [ ] **Step 4: Only then summarize remaining risk or next hotspots**
