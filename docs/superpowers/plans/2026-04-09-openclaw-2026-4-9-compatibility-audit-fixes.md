# OpenClaw 2026.4.9 Compatibility Audit And Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Supersession Note (2026-04-13):** This plan is preserved for historical compatibility-audit context. Current implementation should follow `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md` and the external-runtime hard-cut plan. References below to a bundled desktop/runtime pipeline are historical and must not be treated as the current platform standard.

**Goal:** Audit the Claw Studio workspace against OpenClaw `2026.4.9`, identify upgrade regressions in the highest-risk integration surfaces, and land the smallest fixes plus regression coverage needed to keep the bundled desktop/runtime experience stable.

**Architecture:** Keep the current shared OpenClaw release metadata and desktop bundled-runtime pipeline intact. Focus only on compatibility seams that can regress when upstream runtime behavior shifts: bundled runtime preparation, gateway chat/session/control routing, and provider/browser-control auth projection. Fix each confirmed regression with a failing test first, then the minimal implementation, then focused verification.

**Tech Stack:** TypeScript, React, Node.js scripts, Tauri Rust host services, custom node:test and workspace verification scripts.

---

### Task 1: Confirm The 2026.4.9 Risk Surface

**Files:**
- Modify: `docs/superpowers/plans/2026-04-09-openclaw-2026-4-9-compatibility-audit-fixes.md`
- Inspect: `config/openclaw-release.json`
- Inspect: `scripts/prepare-openclaw-runtime.mjs`
- Inspect: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Inspect: `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- Inspect: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Re-read the upstream `v2026.4.9` release notes and changelog**
- [ ] **Step 2: Map the upstream changes to local compatibility seams**
- [ ] **Step 3: Write down the 2-3 highest-risk local areas before touching code**

### Task 2: Audit Bundled Runtime And Packaging Regressions

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.test.mjs`
- Modify: `scripts/prepare-openclaw-runtime.mjs`
- Modify: `scripts/verify-desktop-openclaw-release-assets.test.mjs`
- Inspect: `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/runtime/package/package.json`

- [ ] **Step 1: Add or extend a failing regression test for any newly observed `2026.4.9` packaging/runtime gap**
- [ ] **Step 2: Run the targeted runtime preparation test to verify the failure**
- [ ] **Step 3: Implement the smallest runtime preparation or verification fix**
- [ ] **Step 4: Re-run the targeted runtime preparation and release-asset verification tests**

### Task 3: Audit Gateway Chat, Session History, And Control-Surface Regressions

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts`
- Inspect: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_workbench.rs`

- [ ] **Step 1: Add a failing regression test for the highest-confidence session/chat/control mismatch**
- [ ] **Step 2: Run the narrowest relevant test command and verify a clean RED failure**
- [ ] **Step 3: Implement the minimal compatibility fix**
- [ ] **Step 4: Re-run the targeted tests and adjacent regression coverage**

### Task 4: Audit Provider Auth, Browser-Control, And Env Projection Regressions

**Files:**
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- Modify: `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
- Modify: `packages/removed-install-feature/src/services/openClawBootstrapService.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Inspect: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`

- [ ] **Step 1: Add a failing regression test for any confirmed auth/env/browser-control drift**
- [ ] **Step 2: Run the focused test and verify it fails for the expected reason**
- [ ] **Step 3: Implement the smallest projection or parsing fix**
- [ ] **Step 4: Re-run the focused tests and nearby compatibility checks**

### Task 5: Final OpenClaw Upgrade Verification

**Files:**
- Inspect: `scripts/openclaw-upgrade-readiness.mjs`
- Inspect: `scripts/openclaw-release-contract.test.mjs`
- Inspect: `scripts/verify-desktop-openclaw-release-assets.test.mjs`

- [ ] **Step 1: Run the targeted OpenClaw verification commands**
- [ ] **Step 2: Confirm that the high-risk regressions are covered by fresh tests**
- [ ] **Step 3: Summarize impacted user-facing surfaces, fixed bugs, and any residual risks**
