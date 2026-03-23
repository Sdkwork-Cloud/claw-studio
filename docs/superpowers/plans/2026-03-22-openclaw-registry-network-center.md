# OpenClaw Registry Network Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `claw-center` with an OpenClaw registry and matchmaking surface that supports search, category browsing, one-click quick networking, and ACP command copy.

**Architecture:** Keep the work inside `packages/sdkwork-claw-center`. Move the package away from the current ecommerce provider/product model and toward a registry-entry model, while reusing `studio.listInstances()` and `studio.getInstanceDetail()` to drive real quick-connect behavior. Keep filtering, quick-connect routing, and command generation in pure helpers with tests first.

**Tech Stack:** React 19, TypeScript, React Router, i18next, Tailwind utility classes, `@sdkwork/claw-infrastructure`, `@sdkwork/claw-core`, node strip-types tests.

---

### Task 1: Add presentation and quick-connect tests

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-center\src\services\clawRegistryPresentation.test.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-center\src\services\clawRegistryPresentation.ts`

- [ ] **Step 1: Write failing tests for registry categories, search, quick connect, and ACP command generation**
- [ ] **Step 2: Run `node --experimental-strip-types packages/sdkwork-claw-center/src/services/clawRegistryPresentation.test.ts` and verify the new tests fail for missing implementation**
- [ ] **Step 3: Implement the minimal pure helpers needed for those tests**
- [ ] **Step 4: Re-run the same test command and verify it passes**

### Task 2: Replace the claw-center domain model

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-center\src\types\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-center\src\services\clawService.ts`

- [ ] **Step 1: Write or extend tests so the service layer can serve registry entries instead of ecommerce providers**
- [ ] **Step 2: Refactor the package types to include registry entry, quick-connect, and detail contracts**
- [ ] **Step 3: Refactor `clawService.ts` to expose registry data plus local quick-connect resolution**
- [ ] **Step 4: Re-run the service and presentation tests**

### Task 3: Rebuild the registry list page

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-center\src\pages\ClawCenter.tsx`

- [ ] **Step 1: Replace the ecommerce hero and cards with registry-focused list UI**
- [ ] **Step 2: Wire top CTA behavior to quick-connect routing and ACP command copy**
- [ ] **Step 3: Keep search and category browsing driven by the tested presentation helpers**
- [ ] **Step 4: Manually verify that clicking a card still opens `/claw-center/:id`**

### Task 4: Rebuild the registry detail page

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-center\src\pages\ClawDetail.tsx`

- [ ] **Step 1: Remove product/service commerce tabs and replace them with registry overview, matching, and connection sections**
- [ ] **Step 2: Add entry-specific ACP copy action and real quick-connect CTA**
- [ ] **Step 3: Preserve graceful not-found and loading states**
- [ ] **Step 4: Re-run the presentation test plus targeted typecheck/build verification**

### Task 5: Update i18n and contract coverage

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Optionally modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-center-contract.test.ts`

- [ ] **Step 1: Replace marketplace wording with registry/network-center wording in Chinese and English**
- [ ] **Step 2: Add or update contract checks only where they meaningfully protect the new product direction**
- [ ] **Step 3: Run the target contract checks**

### Task 6: Verify the whole change

**Files:**
- No new files

- [ ] **Step 1: Run `node --experimental-strip-types packages/sdkwork-claw-center/src/services/clawRegistryPresentation.test.ts`**
- [ ] **Step 2: Run `pnpm check:sdkwork-center`**
- [ ] **Step 3: Run `pnpm build`**
- [ ] **Step 4: Fix any regressions and re-run the affected commands**
