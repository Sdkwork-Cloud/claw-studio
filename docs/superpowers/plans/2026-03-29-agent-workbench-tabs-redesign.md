# Agent Workbench Tabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the instance agent detail surface into a tabbed professional workbench aligned with OpenClaw’s real agent capabilities.

**Architecture:** Keep the existing left-side agent navigator and snapshot/service layer, but introduce a presentation model for tab metadata plus focused tab-content renderers. The main panel becomes a composition shell with hero, tab navigation, and per-tab work area.

**Tech Stack:** React, TypeScript, feature package components, i18n locale bundles, focused node tests

---

### Task 1: Add agent workbench presentation model

**Files:**
- Create: `packages/sdkwork-claw-instances/src/components/agentWorkbenchPresentation.ts`
- Create: `packages/sdkwork-claw-instances/src/components/agentWorkbenchPresentation.test.ts`

- [ ] Define tab ids, labels, descriptions, and count derivation for the agent workbench.
- [ ] Add focused tests for tab count logic and default tab metadata.

### Task 2: Split the right-side panel into tab sections

**Files:**
- Create: `packages/sdkwork-claw-instances/src/components/AgentWorkbenchDetailSections.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx`

- [ ] Extract reusable render sections for overview, channels, automation, skills, tools, and files.
- [ ] Keep `AgentWorkbenchPanel.tsx` as the orchestration shell with search, hero, tabs, and active tab state.
- [ ] Preserve existing real actions and readonly behavior.

### Task 3: Add localized copy for tabs and upgraded empty states

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`

- [ ] Add tab labels, tab descriptions, and any new helper copy used by the redesigned surface.
- [ ] Keep wording commercial and concise.

### Task 4: Verify the redesigned agent workbench

**Files:**
- No source changes required unless verification exposes a regression.

- [ ] Run the new presentation test.
- [ ] Run package-level instance contracts.
- [ ] Run any focused locale/parse check if locale files changed materially.
