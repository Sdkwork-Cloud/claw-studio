# Wrapper Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove remaining internal wrapper imports in feature pages while preserving package boundaries, UI behavior, and compatibility exports.

**Architecture:** Feature pages should consume real shared sources directly when a local wrapper only re-exports another package. Feature `services` remain package-local wrappers to preserve the business-module boundary defined by the workspace architecture.

**Tech Stack:** pnpm workspace, React 19, TypeScript 5, Vite 6

---

### Task 1: Document the cleanup scope

**Files:**
- Create: `docs/plans/2026-03-09-wrapper-cleanup-design.md`
- Create: `docs/plans/2026-03-09-wrapper-cleanup-implementation.md`

**Step 1: Record the selected wrapper-cleanup approach**
- Capture the goal, scope, alternatives, and selected approach.

**Step 2: Keep the implementation plan incremental**
- Limit the scope to import rewrites only.

### Task 2: Point feature pages at shared UI directly

**Files:**
- Modify: `packages/claw-studio-devices/src/pages/devices/Devices.tsx`
- Modify: `packages/claw-studio-settings/src/pages/settings/ApiKeysSettings.tsx`
- Modify: `packages/claw-studio-market/src/pages/market/Market.tsx`
- Modify: `packages/claw-studio-market/src/pages/market/SkillDetail.tsx`
- Modify: `packages/claw-studio-github/src/pages/github/GitHubRepos.tsx`
- Modify: `packages/claw-studio-huggingface/src/pages/huggingface/HuggingFaceModels.tsx`

**Step 1: Replace local wrapper imports**
- Change `../../components/Modal` to `@sdkwork/claw-studio-shared-ui`.
- Change `../../components/RepositoryCard` to `@sdkwork/claw-studio-shared-ui`.

**Step 2: Preserve all existing JSX**
- Do not change component props, layout, or style classes.

### Task 3: Point feature pages at domain types directly

**Files:**
- Modify: `packages/claw-studio-devices/src/pages/devices/Devices.tsx`
- Modify: `packages/claw-studio-market/src/pages/market/Market.tsx`
- Modify: `packages/claw-studio-market/src/pages/market/SkillDetail.tsx`
- Modify: `packages/claw-studio-market/src/pages/market/SkillPackDetail.tsx`

**Step 1: Replace type-only wrapper imports**
- Change `../../types` imports to `@sdkwork/claw-studio-domain`.

**Step 2: Keep business service imports unchanged**
- Continue using feature-local `services` wrappers.

### Task 4: Verify the impact

**Files:**
- Inspect: `packages/*/src/pages/**/*.tsx`
- Run: `pnpm check:arch`
- Run: `pnpm lint`

**Step 1: Verify wrapper imports are gone from updated pages**
- Use `rg` on the modified files.

**Step 2: Run available verification commands**
- Report actual command results and any environment blockers.

**Step 3: Defer directory cleanup if needed**
- Empty `src/store` directory deletion can be a later step when write permissions allow safe shell cleanup.

### Task 5: Remove file-level wrapper shells

**Files:**
- Modify: `packages/claw-studio-market/src/components/index.ts`
- Modify: `packages/claw-studio-settings/src/components/index.ts`
- Modify: `packages/claw-studio-devices/src/components/index.ts`
- Modify: `packages/claw-studio-github/src/components/index.ts`
- Modify: `packages/claw-studio-huggingface/src/components/index.ts`
- Delete: `packages/claw-studio-market/src/components/Modal.tsx`
- Delete: `packages/claw-studio-settings/src/components/Modal.tsx`
- Delete: `packages/claw-studio-devices/src/components/Modal.tsx`
- Delete: `packages/claw-studio-github/src/components/RepositoryCard.tsx`
- Delete: `packages/claw-studio-huggingface/src/components/RepositoryCard.tsx`
- Delete: `packages/claw-studio-market/src/types.ts`
- Delete: `packages/claw-studio-devices/src/types.ts`

**Step 1: Preserve component-boundary directories**
- Keep `src/components` directories and route any remaining package-level component exports through `components/index.ts`.

**Step 2: Delete only redundant file-level pass-through shells**
- Remove files that only re-export another workspace package and are no longer referenced internally.

**Step 3: Re-run architecture and build verification**
- Confirm the cleanup changes do not affect imports, type-checking, or build output.
