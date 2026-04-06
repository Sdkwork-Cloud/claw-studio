# Instance Workbench Provider And File Explorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade instance detail with a true hierarchical file explorer and a first-class LLM provider configuration workspace.

**Architecture:** Extend the mock runtime with instance-level LLM provider state, then map that state through the existing workbench service into new UI surfaces. Keep tree-building logic in `sdkwork-claw-instances`, and keep persistence in `sdkwork-claw-infrastructure`.

**Tech Stack:** React 19, TypeScript, Monaco editor, i18next, Zustand-aligned provider semantics, Tauri/web shared shell.

---

### Task 1: Lock the contract

**Files:**
- Modify: `scripts/sdkwork-instances-contract.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Steps:**
1. Add a failing contract for the `llmProviders` workbench section.
2. Add a failing contract for hierarchical file explorer markers and removal of the extra workbench intro copy.
3. Add a failing persistence test for LLM provider config updates.

### Task 2: Extend runtime provider state

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

**Steps:**
1. Add mock provider and model entities for each instance.
2. Add list and update methods for instance LLM providers.
3. Re-run the provider persistence test and confirm it turns green.

### Task 3: Carry provider data through the instance feature

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceService.ts`

**Steps:**
1. Add workbench provider types and section ids.
2. Map provider data into the workbench snapshot.
3. Expose provider config update mutations through the feature service.

### Task 4: Build reusable workbench components

**Files:**
- Create: `packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx`
- Create: `packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx`

**Steps:**
1. Build a nested file explorer component from flat runtime file paths.
2. Build a right-side LLM configuration panel component for editing provider settings.

### Task 5: Rebuild the detail page

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

**Steps:**
1. Remove the extra sidebar intro card.
2. Add the `LLM Providers` section to the left rail and main switch logic.
3. Replace grouped file rendering with the new explorer component.
4. Render provider list + configuration editor for selected provider.

### Task 6: Localization and verification

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Steps:**
1. Add strings for provider labels, statuses, parameters, and file explorer labels.
2. Run:
   - `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`
   - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
   - `pnpm lint`
   - `pnpm build`
   - `pnpm check:desktop`
