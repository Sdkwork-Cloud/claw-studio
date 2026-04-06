# OpenClaw WhatsApp Managed Channel Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Claw Studio's managed OpenClaw channel catalog with the current official WhatsApp configuration surface and expose it through the existing instance workbench editor.

**Architecture:** Keep the current schema-driven managed channel editor. Extend `openClawConfigService` with a WhatsApp definition that uses text fields for optional access rules, then serialize those fields into the JSON array/object shapes OpenClaw expects. Rely on the existing `InstanceDetail` and `instanceWorkbenchService` channel projection so no new UI architecture is introduced.

**Tech Stack:** TypeScript, React, Node `--experimental-strip-types` tests, JSON5-backed OpenClaw config projection.

---

### Task 1: Add Failing Coverage For WhatsApp Managed Channel Projection

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`

- [ ] **Step 1: Write failing tests for the channel catalog and round-trip save behavior**
- [ ] **Step 2: Write a failing workbench assertion proving the managed channel appears automatically**
- [ ] **Step 3: Run focused tests and verify they fail for the missing WhatsApp catalog entry**

### Task 2: Implement Minimal Config-Service Support

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\superpowers\plans\2026-04-03-openclaw-2026-4-1-phase1-remaining-gaps.md`

- [ ] **Step 1: Add the WhatsApp channel definition aligned to the official docs (`allowFrom`, `groups`)**
- [ ] **Step 2: Add lightweight field serialization so the editor writes array/object config correctly**
- [ ] **Step 3: Update the remaining-gaps note to remove the stale `reactionLevel` assumption**

### Task 3: Verify The Closed Loop

**Files:**
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`

- [ ] **Step 1: Run focused strip-types tests**
- [ ] **Step 2: Confirm the managed channel appears in workbench projections without UI-specific changes**
