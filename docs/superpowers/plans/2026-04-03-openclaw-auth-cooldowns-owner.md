# OpenClaw Auth Cooldowns Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real managed owner surface for OpenClaw `auth.cooldowns` settings so rate-limit and overload backoff controls can be inspected and edited from the instance workbench.

**Architecture:** Extend the existing OpenClaw config snapshot with a normalized auth-cooldowns projection, surface it through the instance workbench alongside the existing managed web-search card, and persist updates through `openClawConfigService`. Keep the scope tight to `auth.cooldowns.*` and do not expand into a larger auth settings editor yet.

**Tech Stack:** TypeScript, React, JSON5-backed OpenClaw config projection, Node `--experimental-strip-types` tests, i18n JSON locale bundles.

---

### Task 1: Add Auth Cooldown Config Projection

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`

- [ ] **Step 1: Write a failing config-service test for reading `auth.cooldowns` fields from OpenClaw config**
- [ ] **Step 2: Run the focused config-service test and verify the new auth-cooldown assertion fails for the expected missing snapshot fields**
- [ ] **Step 3: Add a normalized auth-cooldowns snapshot type and read-path in `openClawConfigService`**
- [ ] **Step 4: Write a failing config-service test for saving `auth.cooldowns` without clobbering sibling auth config**
- [ ] **Step 5: Run the focused config-service test and verify the save-path assertion fails for the expected missing writer**
- [ ] **Step 6: Add the auth-cooldowns save path in `openClawConfigService`**
- [ ] **Step 7: Re-run the focused config-service test and verify all auth-cooldown coverage passes**

### Task 2: Surface Managed Auth Cooldowns Through The Instance Workbench

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\types\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`

- [ ] **Step 1: Write a failing instance-workbench test that expects managed auth cooldown config to be exposed**
- [ ] **Step 2: Run the focused instance-workbench test and verify the new assertion fails because the snapshot is not surfaced yet**
- [ ] **Step 3: Thread the managed auth-cooldowns snapshot through the instance type, instance service, and workbench service**
- [ ] **Step 4: Re-run the focused instance-workbench test and verify the managed auth-cooldowns snapshot is now available**

### Task 3: Add A Focused Workbench Editor Surface

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\pages\InstanceDetail.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en\instances.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh\instances.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

- [ ] **Step 1: Add direct i18n keys and local editor state for a compact auth-cooldowns card in the Tools workbench section**
- [ ] **Step 2: Wire save handling, validation, and toasts through the existing managed-config path**
- [ ] **Step 3: Keep the runtime tool catalog visible below the new card so this remains a config-owner augmentation instead of a tools redesign**

### Task 4: Verify The Auth Cooldown Owner

**Files:**
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-instances-contract.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\scripts\check-locale-structure.mjs`

- [ ] **Step 1: Run focused strip-types tests for config-service and instance-workbench coverage**
- [ ] **Step 2: Run the locale-structure check and the instances contract suite**
- [ ] **Step 3: Run `pnpm.cmd lint` to confirm the broader workspace stays green**
