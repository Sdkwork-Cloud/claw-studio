# OpenClaw-Only Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining legacy router runtime/admin dependency chain from Claw Studio, replace required setup flows with OpenClaw-only services, and verify the desktop app starts successfully.

**Architecture:** Delete the stale router runtime/admin bridge instead of preserving compatibility. Rebuild only the user-facing client setup flow as a new OpenClaw-oriented installer contract backed by in-process Tauri commands and existing OpenClaw runtime/config services.

**Tech Stack:** pnpm workspace, TypeScript, React, Tauri, Rust, OpenClaw runtime

---

### Task 1: Remove stale router runtime/admin bridge exports

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/index.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/index.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/components/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/components.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/componentLibrary.ts`
- Delete: `packages/sdkwork-claw-infrastructure/src/auth/apiRouterAdminSession.ts`
- Delete: `packages/sdkwork-claw-infrastructure/src/services/sdkworkApiRouterAccess.ts`
- Delete: `packages/sdkwork-claw-infrastructure/src/services/sdkworkApiRouterAdminClient.ts`
- Delete: `packages/sdkwork-claw-infrastructure/src/services/apiRouterBootstrapWarmup.ts`
- Delete: `packages/sdkwork-claw-apirouter/src/services/apiRouterAdminService.ts`
- Delete: `packages/sdkwork-claw-apirouter/src/services/apiRouterRuntimeService.ts`
- Delete: `packages/sdkwork-claw-apirouter/src/components/ApiRouterAdminStatusCard.tsx`
- Delete: `packages/sdkwork-claw-apirouter/src/components/ApiRouterRuntimeStatusCard.tsx`

- [ ] Remove obsolete exports and component ids
- [ ] Delete dead source files that still reference removed runtime platform contracts
- [ ] Run `pnpm --filter @sdkwork/claw-desktop lint` and capture the next failing layer

### Task 2: Rebuild quick setup on OpenClaw-only contracts

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/installerService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/components/ApiRouterAccessMethodShared.tsx`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/lib.rs`
- Create or modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/*`
- Create or modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/*`

- [ ] Define new OpenClaw-oriented client setup request/result types without `apiRouter` naming
- [ ] Adapt the previous local file/env writer logic into silent in-process Tauri commands
- [ ] Update web/service callers to consume the new installer contract
- [ ] Keep OpenClaw instance updates wired through existing studio mock and studio services

### Task 3: Remove stale scripts, tests, and docs

**Files:**
- Modify: `.env.example`
- Modify: `scripts/check-desktop-platform-foundation.mjs`
- Delete or rewrite: legacy bundled router runtime prepare script
- Delete or rewrite: legacy bundled router runtime prepare test
- Delete or rewrite: legacy bundled router artifacts prepare script
- Delete or rewrite: `scripts/sdkwork-apirouter-contract.test.ts`
- Delete or rewrite stale `*.test.ts` files tied to removed runtime/admin bridge

- [ ] Remove hard-coded legacy router runtime expectations from scripts and docs
- [ ] Keep only OpenClaw-related runtime preparation and release checks
- [ ] Re-run targeted lint/tests after the cleanup

### Task 4: Verify desktop startup and installation experience

**Files:**
- Verify only

- [ ] Run `pnpm --filter @sdkwork/claw-desktop lint`
- [ ] Run `node scripts/release-flow-contract.test.mjs`
- [ ] Run `pnpm tauri:dev`
- [ ] Inspect startup/install flow for silent in-process behavior and note any remaining gaps
