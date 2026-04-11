# Shadcn Form Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shared shadcn-style form primitive layer in `@sdkwork/claw-ui` and migrate all current form controls and dropdowns onto it.

**Architecture:** Extend `sdkwork-claw-ui` with reusable primitives, preserve the existing `Modal` API by reimplementing it on top of shared dialog primitives, then migrate feature packages in batches: shared overlays, settings/forms, search bars, and untracked feature workspaces.

**Tech Stack:** React 19, Tailwind CSS, Radix UI primitives, Lucide icons, workspace package exports.

---

### Task 1: Lock the UI package contract first

**Files:**
- Modify: `scripts/sdkwork-ui-contract.test.ts`

**Step 1: Write the failing test**

Require the `sdkwork-claw-ui` package to expose shadcn-style primitive files and exports for dialog and form controls.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts`

Expected: FAIL because the new primitive files and exports do not exist yet.

### Task 2: Add the shared primitive foundation

**Files:**
- Modify: `packages/sdkwork-claw-ui/package.json`
- Modify: `packages/sdkwork-claw-ui/src/components/index.ts`
- Modify: `packages/sdkwork-claw-ui/src/index.ts`
- Modify: `packages/sdkwork-claw-ui/src/components/Modal.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Button.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Input.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Textarea.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Label.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Select.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Dialog.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Checkbox.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Switch.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/Slider.tsx`

**Step 1: Install the minimal dependencies needed for shared primitives**

Add Radix packages and `class-variance-authority` to `@sdkwork/claw-ui`.

**Step 2: Implement the primitive components**

Use the repo's existing `cn` helper and current theme tokens so the components feel native to the codebase.

**Step 3: Rebuild `Modal` on the new dialog layer**

Keep the current `isOpen`, `onClose`, `title`, `children`, and `className` API stable.

### Task 3: Migrate modal-heavy flows and explicit forms

**Files:**
- Modify: `packages/sdkwork-claw-account/src/Account.tsx`
- Modify: `packages/sdkwork-claw-commons/src/components/InstallModal.tsx`
- Modify: `packages/sdkwork-claw-devices/src/pages/devices/Devices.tsx`
- Modify: `packages/sdkwork-claw-settings/src/ApiKeysSettings.tsx`
- Modify: `packages/sdkwork-claw-tasks/src/pages/Tasks.tsx`
- Modify: `packages/removed-install-feature/src/pages/install/Install.tsx`

**Step 1: Replace form controls with shared primitives**

Inputs, selects, dialog actions, and any selection cards should be migrated first.

**Step 2: Replace bespoke overlay markup where practical**

Use shared dialog content instead of page-local overlay shells.

### Task 4: Migrate settings and configuration panels

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/Shared.tsx`
- Modify: `packages/sdkwork-claw-settings/src/AccountSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/LLMSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/SecuritySettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/Settings.tsx`
- Modify: `packages/sdkwork-claw-channels/src/pages/channels/Channels.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx`

**Step 1: Move selects, checkboxes, switches, sliders, and text fields to shared UI**

**Step 2: Preserve existing state and submission behavior**

Do not rewrite business logic unless the new component API requires it.

### Task 5: Migrate search bars and text composition surfaces

**Files:**
- Modify: `packages/sdkwork-claw-apps/src/pages/apps/AppStore.tsx`
- Modify: `packages/sdkwork-claw-center/src/pages/ClawCenter.tsx`
- Modify: `packages/sdkwork-claw-center/src/pages/ClawDetail.tsx`
- Modify: `packages/sdkwork-claw-community/src/pages/community/Community.tsx`
- Modify: `packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx`
- Modify: `packages/sdkwork-claw-community/src/pages/community/NewPost.tsx`
- Modify: `packages/sdkwork-claw-core/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatInput.tsx`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-github/src/pages/github/GitHubRepos.tsx`
- Modify: `packages/sdkwork-claw-huggingface/src/pages/huggingface/HuggingFaceModels.tsx`
- Modify: `packages/sdkwork-claw-market/src/pages/Market.tsx`
- Modify: `packages/sdkwork-claw-extensions/src/pages/extensions/Extensions.tsx`

**Step 1: Replace visible raw inputs/textareas with `Input` or `Textarea`**

**Step 2: Keep feature-specific chrome where needed via `className` overrides**

### Task 6: Migrate untracked current feature workspaces

**Files:**
- Modify: `packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx`

**Step 1: Replace dropdowns and date inputs with shared controls**

**Step 2: Replace the range-like parameter controls with `Slider` or shared numeric inputs where appropriate**

### Task 7: Verify and sweep

**Files:**
- Modify if needed after sweep: any remaining files returned by grep

**Step 1: Run the UI contract test**

Run: `node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts`

Expected: PASS

**Step 2: Run workspace verification**

Run: `pnpm lint`

Expected: PASS

Run: `pnpm build`

Expected: PASS

**Step 3: Run a final raw-control sweep**

Search for visible raw `<input>`, `<select>`, `<textarea>`, checkbox, date, and range controls in package source files. Only hidden file inputs and browser-required escape hatches may remain.
