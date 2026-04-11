# Mobile App Download Guide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-time mobile app download guide plus a persistent shell entry and install-page fallback for desktop and PC web users.

**Architecture:** Keep the shell responsible for global entry and mounting, keep the install package responsible for the guidance content and distribution-aware link resolution, and keep prompt persistence in the core app store. Resolve distribution through `@sdkwork/claw-infrastructure` so the feature stays within architecture rules.

**Tech Stack:** TypeScript, React, Zustand, react-i18next, lucide-react, repository contract tests with `node --experimental-strip-types`

---

### Task 1: Lock the mobile guide contract in tests

**Files:**
- Create: `packages/removed-install-feature/src/services/mobileAppGuideService.test.ts`
- Modify: `scripts/sdkwork-install-contract.test.ts`
- Modify: `scripts/sdkwork-shell-contract.test.ts`

**Step 1: Write the failing test**

Add a new pure service test that asserts:

- `global` distribution resolves English mobile docs URLs
- `cn` distribution resolves Chinese mobile docs URLs
- Android and iOS channels both exist
- iOS remains marked as preview guidance rather than a public-store success state

Expand the install contract to assert that:

- `packages/removed-install-feature/src/components/MobileAppDownloadDialog.tsx` exists
- `packages/removed-install-feature/src/components/MobileAppDownloadSection.tsx` exists
- `packages/removed-install-feature/src/services/mobileAppGuideService.ts` exists
- `packages/removed-install-feature/src/index.ts` exports the mobile guide components

Expand the shell contract to assert that:

- `packages/sdkwork-claw-shell/src/components/AppHeader.tsx` includes the mobile app translation key
- `packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx` includes the mobile dialog mount

**Step 2: Run test to verify it fails**

Run:

- `node --experimental-strip-types packages/removed-install-feature/src/services/mobileAppGuideService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

Expected: the new service test fails because the file does not exist yet, and at least one contract assertion fails.

**Step 3: Write minimal implementation**

Create the service and placeholder components/exports with the smallest surface needed to satisfy the new tests.

**Step 4: Run test to verify it passes**

Re-run the same three commands and confirm they pass.

### Task 2: Implement the install feature mobile guidance surface

**Files:**
- Modify: `packages/removed-install-feature/package.json`
- Modify: `packages/removed-install-feature/src/index.ts`
- Modify: `packages/removed-install-feature/src/components/index.ts`
- Create: `packages/removed-install-feature/src/components/MobileAppDownloadDialog.tsx`
- Create: `packages/removed-install-feature/src/components/MobileAppDownloadSection.tsx`
- Create: `packages/removed-install-feature/src/components/MobileAppDownloadChannelCard.tsx`
- Create: `packages/removed-install-feature/src/services/mobileAppGuideService.ts`
- Modify: `packages/removed-install-feature/src/services/index.ts`
- Modify: `packages/removed-install-feature/src/pages/install/Install.tsx`

**Step 1: Write the failing test**

Use the tests from Task 1 as the red phase.

**Step 2: Run test to verify it fails**

Re-run:

- `node --experimental-strip-types packages/removed-install-feature/src/services/mobileAppGuideService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Expected: at least one assertion fails before the implementation is complete.

**Step 3: Write minimal implementation**

- Add a pure service that resolves the guide model from `APP_ENV.distribution.id`.
- Export a dialog component for shell usage.
- Export an inline section component for the install page.
- Add the inline section to the install page below the hero/system-requirements area so the entry is durable.

**Step 4: Run test to verify it passes**

Run:

- `node --experimental-strip-types packages/removed-install-feature/src/services/mobileAppGuideService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Expected: both pass.

### Task 3: Implement shell mounting and one-time prompt state

**Files:**
- Modify: `packages/sdkwork-claw-core/src/stores/useAppStore.ts`
- Modify: `packages/sdkwork-claw-shell/src/components/AppHeader.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx`

**Step 1: Write the failing test**

Use the shell contract test from Task 1 as the red phase.

**Step 2: Run test to verify it fails**

Run:

- `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

Expected: the shell assertions fail before the header action and dialog mount are added.

**Step 3: Write minimal implementation**

- Extend the app store with persisted prompt-seen state and non-persisted dialog-open state.
- Add a header action that opens the dialog.
- Mount the install-owned dialog in `MainLayout`.
- Auto-open the dialog once on non-auth, non-install routes and mark the prompt as seen immediately.

**Step 4: Run test to verify it passes**

Run:

- `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

Expected: pass.

### Task 4: Add localized copy and do focused regression verification

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Add copy**

Add mobile app copy for:

- header action
- dialog title, description, badges, availability labels, and actions
- install-page inline section
- Android and iOS channel descriptions

**Step 2: Run focused verification**

Run:

- `node --experimental-strip-types packages/removed-install-feature/src/services/mobileAppGuideService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`

Expected: all pass.

**Step 3: Run broader repository verification**

Run:

- `pnpm lint`
- `pnpm build`

Expected: pass if the broader workspace baseline is currently healthy. If the workspace has unrelated pre-existing failures, capture them precisely and separate them from this change.
