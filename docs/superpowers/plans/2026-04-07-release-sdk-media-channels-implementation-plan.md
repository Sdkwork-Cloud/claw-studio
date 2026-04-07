# Release SDK And Media Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the shared SDK release path, generate GitHub release notes from repository docs, and add a new media-account channels tab without regressing local relative-path development.

**Architecture:** Keep local development on the existing workspace-relative SDK topology and make CI/release explicitly materialize pinned GitHub SDK refs from repository config. Treat release notes as repository-owned documents under `docs/release`, rendered into workflow assets before publishing. Extend channel catalog regioning with a first-class `media` segment while preserving current domestic/global grouping behavior.

**Tech Stack:** GitHub Actions, Node.js release scripts, pnpm workspace tooling, TypeScript/React UI packages, i18n JSON locale files.

---

### Task 1: Lock Shared SDK Release Configuration

**Files:**
- Create: `config/shared-sdk-release-sources.json`
- Modify: `scripts/prepare-shared-sdk-packages.mjs`
- Modify: `scripts/release-flow-contract.test.mjs`

- [ ] **Step 1: Keep failing tests as the release contract baseline**
- [ ] **Step 2: Add pinned shared SDK release source config**
- [ ] **Step 3: Remove stale vendored fallback wording and align package preparation behavior**
- [ ] **Step 4: Rewrite outdated vendored-source helper assertions to the new config contract**
- [ ] **Step 5: Run targeted shared SDK contract tests**

### Task 2: Wire Release Notes And Workflow Inputs

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release-reusable.yml`
- Modify: `package.json`
- Create: `scripts/release/render-release-notes.mjs`
- Create: `scripts/check-shared-sdk-release-parity.mjs`
- Create: `docs/release/releases.json`
- Create: `docs/release/release-2026-04-07-01.md`
- Create: `docs/release/release-2026-04-07-02.md`
- Create: `docs/release/release-2026-04-07-03.md`

- [ ] **Step 1: Add explicit git release mode to CI and reusable release workflow**
- [ ] **Step 2: Replace generated GitHub release notes with repository-rendered notes**
- [ ] **Step 3: Add parity and release-note scripts to workspace commands**
- [ ] **Step 4: Encode release doc metadata and carry-forward notes for failed tags**
- [ ] **Step 5: Run workflow and release-flow contract tests**

### Task 3: Add Channel Media Region Support

**Files:**
- Modify: `packages/sdkwork-claw-ui/src/components/channelCatalogMeta.ts`
- Modify: `packages/sdkwork-claw-ui/src/components/ChannelRegionTabs.tsx`
- Modify: `packages/sdkwork-claw-ui/src/components/ChannelCatalog.tsx`
- Modify: `packages/sdkwork-claw-ui/src/components/ChannelWorkspace.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en/channels.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh/channels.json`

- [ ] **Step 1: Keep the failing UI/channel contract tests as the behavior spec**
- [ ] **Step 2: Extend channel region metadata with `media` and assign公众号 channels into it**
- [ ] **Step 3: Add the media tab before the all tab in catalog and workspace region tabs**
- [ ] **Step 4: Add locale strings and empty-state copy for the new region**
- [ ] **Step 5: Run targeted UI and channel contract tests**

### Task 4: Verify End-To-End And Document Outcome

**Files:**
- Create: `docs/step/2026-04-07-release-sdk-media-channels-hardening.md`

- [ ] **Step 1: Run the targeted contract suite until green**
- [ ] **Step 2: Run broader install/lint/build gates that are practical in this environment**
- [ ] **Step 3: Record verification results, remaining blockers, and release-readiness evidence**
- [ ] **Step 4: Only if parity, git state, and credentials are ready, proceed to commit/push/release**
