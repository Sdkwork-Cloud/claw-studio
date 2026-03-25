# OpenClaw Install Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claw Studio's install flow feel like a polished OpenClaw-first experience driven by the real hub-installer catalog and current upstream OpenClaw install docs.

**Architecture:** Keep `hub-installer` vendor assets as the source of truth for install variants, but tighten Claw Studio's install UI so it only presents OpenClaw in a curated way. Replace stale static install-detail content with a lightweight, docs-aligned OpenClaw detail model that stays closer to upstream behavior.

**Tech Stack:** React, TypeScript, Rust/Tauri, existing node-based contract tests

---

### Task 1: Collapse the install surface to OpenClaw

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/installPageModel.ts`
- Modify: `packages/sdkwork-claw-install/src/pages/install/installPageModel.test.ts`

- [ ] Remove non-OpenClaw product definitions from the install page model.
- [ ] Keep OpenClaw migration and install/uninstall helpers intact.
- [ ] Update the page-model test expectations to assert OpenClaw-only behavior.

### Task 2: Remove Codex from the desktop install catalog surface

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/hub_install_catalog.rs`

- [ ] Remove the `app-codex` seed from the desktop catalog bridge.
- [ ] Keep runtime/package-manager helper entries unchanged.
- [ ] Preserve OpenClaw dynamic variant discovery and ordering.

### Task 3: Make the install page feel like a single-product OpenClaw flow

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

- [ ] Hide the product sidebar when only OpenClaw remains.
- [ ] Simplify the install wizard mount path so OpenClaw always uses the OpenClaw-specific guided wizard.
- [ ] Keep catalog-driven recommendation and assessment logic intact.

### Task 4: Replace stale install-detail content with a docs-aligned OpenClaw detail model

**Files:**
- Create: `packages/sdkwork-claw-install/src/services/openClawInstallDetailService.ts`
- Create: `packages/sdkwork-claw-install/src/services/openClawInstallDetailService.test.ts`
- Modify: `packages/sdkwork-claw-install/src/services/index.ts`
- Modify: `packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx`

- [ ] Add a pure detail-model service that maps route aliases to official OpenClaw install docs and current platform/runtime notes.
- [ ] Add tests for alias resolution and doc-link selection.
- [ ] Rebuild the install detail page around the new detail model so it no longer hardcodes stale install commands.

### Task 5: Verify the focused behavior

**Files:**
- Verify only

- [ ] Run the focused TypeScript tests for the install page model, catalog presentation, recommendation service, and new detail service.
- [ ] Run the install package contract test if the focused tests pass cleanly.
- [ ] Report any verification gaps separately if desktop Rust verification is still too heavy for this pass.
