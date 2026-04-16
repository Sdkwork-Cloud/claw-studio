# Chat Instance Kernel Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four confirmed defects across chat readiness, instance lifecycle actions, instance detail hooks safety, and kernel/runtime cache coherency.

**Architecture:** Fix behavior at shared abstractions first, then seal regressions with focused tests. Keep edits confined to retained product surfaces and avoid refactoring unrelated packages while the workspace contains intentional deletion work.

**Tech Stack:** TypeScript, React, Zustand-style store utilities, package-local node-based test runners.

---

### Task 1: Lock the Defects with Failing Tests

**Files:**
- Modify: `docs/superpowers/specs/2026-04-15-chat-instance-kernel-stability-design.md`
- Modify: `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/chatSessionBootstrap.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceBaseDetail.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetailSource.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`

- [ ] **Step 1: Add a failing chat catalog test for unsupported routes**
- [ ] **Step 2: Add a failing chat bootstrap test for unsupported routes**
- [ ] **Step 3: Add a failing lifecycle capability test for `starting` state**
- [ ] **Step 4: Add a failing base-detail management action test for `starting` state**
- [ ] **Step 5: Add a failing source contract test enforcing `InstanceDetail` hook ordering**
- [ ] **Step 6: Add a failing registry cache test proving kernel actions must invalidate runtime-info cache**
- [ ] **Step 7: Run the targeted failing tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts
node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatSessionBootstrap.test.ts
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceBaseDetail.test.ts
node --experimental-strip-types packages/sdkwork-claw-instances/src/pages/InstanceDetailSource.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts
```

Expected: the newly added assertions fail before production code changes.

### Task 2: Repair Chat Readiness and Session Gating

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogCore.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/chatSessionBootstrap.ts`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx`

- [ ] **Step 1: Return an empty catalog for unsupported instance routes**
- [ ] **Step 2: Prevent bootstrap auto-create/select on unsupported routes**
- [ ] **Step 3: Block send attempts on unsupported routes in the page**
- [ ] **Step 4: Block manual new-session creation from the sidebar when unsupported**
- [ ] **Step 5: Re-run the focused chat tests**

### Task 3: Repair Instance Lifecycle and Detail Hooks

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts`
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

- [ ] **Step 1: Unify lifecycle capability handling for `starting`**
- [ ] **Step 2: Move `InstanceDetail` hooks ahead of early returns using safe fallback values**
- [ ] **Step 3: Re-run the focused instance tests**

### Task 4: Repair Kernel Runtime Cache Coherency

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`

- [ ] **Step 1: Invalidate runtime-info cache after kernel actions**
- [ ] **Step 2: Re-run the focused registry test**

### Task 5: Full Verification

**Files:**
- Modify only if verification exposes new defects inside the same scope

- [ ] **Step 1: Run package-level chat verification**
- [ ] **Step 2: Run package-level instances verification**
- [ ] **Step 3: Run package-level settings verification**
- [ ] **Step 4: Run package-level foundation verification**
- [ ] **Step 5: Review `git diff` and confirm no unrelated rollback happened**

Run:

```bash
pnpm check:sdkwork-chat
pnpm check:sdkwork-instances
pnpm check:sdkwork-settings
pnpm check:sdkwork-foundation
git diff -- packages/sdkwork-claw-chat packages/sdkwork-claw-instances packages/sdkwork-claw-infrastructure docs/superpowers
```

Expected: checks pass and diffs stay within the intended scope.
