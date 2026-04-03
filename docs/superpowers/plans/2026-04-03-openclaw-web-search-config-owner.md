# OpenClaw Web Search Config Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real owner surface for OpenClaw web-search configuration so SearXNG and other provider-specific search settings can be edited from Claw Studio instead of remaining runtime-only or file-only.

**Architecture:** Keep the current instance workbench tools catalog for runtime visibility, but add a config-backed editor path owned by `openClawConfigService`. Support both the compatibility root (`tools.web.search.*`) and the current upstream provider-specific path (`plugins.entries.<plugin>.config.webSearch.*`). Do not route search providers through Provider Center, because they are tool providers rather than model providers.

**Tech Stack:** TypeScript, React, Node `--experimental-strip-types` tests, JSON5-backed OpenClaw config projection.

---

### Task 1: Map The Real Config Surface

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`

- [ ] **Step 1: Add failing tests for reading web-search config from both compatibility and provider-specific paths**
- [ ] **Step 2: Add a normalized snapshot model for search provider selection, shared limits, and provider-specific credentials**
- [ ] **Step 3: Add write-path coverage proving Claw Studio preserves unknown sibling plugin config while updating web-search fields**

### Task 2: Give The Config A Product Owner

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\pages\InstanceDetail.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`

- [ ] **Step 1: Add a config-backed tools settings projection for web search without redesigning the rest of the tools catalog**
- [ ] **Step 2: Introduce a focused editor surface in the instance tools section for search provider setup and limits**
- [ ] **Step 3: Keep runtime tool catalog rows visible so operators can compare configured state with live capability state**

### Task 3: Verify The Owner Surface

**Files:**
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-instances-contract.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\pnpm-workspace.yaml`

- [ ] **Step 1: Run focused strip-types tests for config-service and instance workbench changes**
- [ ] **Step 2: Run the instance contract suite**
- [ ] **Step 3: Run `pnpm lint` after the editor surface is in place**
