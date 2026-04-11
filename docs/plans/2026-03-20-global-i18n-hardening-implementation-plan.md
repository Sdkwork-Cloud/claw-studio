# Global I18n Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize page/component UI copy into shared locale resources and close the remaining install-flow i18n gaps.

**Architecture:** UI layers will consume `react-i18next` keys from `@sdkwork/claw-i18n`, while structured dataset-style localized content may continue to use localized value objects. Contract checks will enforce that boundary.

**Tech Stack:** TypeScript, React, react-i18next, i18next, pnpm workspace scripts

---

### Task 1: Document The Internationalization Boundary

**Files:**

- Create: `docs/plans/2026-03-20-global-i18n-hardening-design.md`
- Create: `docs/plans/2026-03-20-global-i18n-hardening-implementation-plan.md`

**Step 1: Capture the design constraints**

Write the design doc that defines locale ownership, UI-layer rules, and contract expectations.

**Step 2: Capture the execution plan**

Write this implementation plan with the scope, tasks, and validation commands.

### Task 2: Centralize Settings UI Copy

**Files:**

- Modify: `packages/sdkwork-claw-settings/src/Settings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/NotificationSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/SecuritySettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/LLMSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/AccountSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/ApiKeysSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/BillingSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/DataPrivacySettings.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Replace `useLocalizedText` in settings UI files**

Move page/component text to locale keys and switch those files to `useTranslation()`.

**Step 2: Keep dynamic formatting intact**

Preserve number/date formatting and any language-sensitive presentation helpers.

**Step 3: Verify settings screens no longer own bilingual text**

Run: `pnpm check:i18n`

Expected: settings-related inline bilingual copy is no longer reported.

### Task 3: Repair Install And App Detail Flows

**Files:**

- Modify: `packages/sdkwork-claw-apps/src/pages/apps/AppDetail.tsx`
- Modify: `packages/removed-install-feature/src/pages/install/Install.tsx`
- Modify: `packages/removed-install-feature/src/components/OpenClawGuidedInstallWizard.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Add missing locale keys**

Add keys for helper-returned labels, button text, progress strings, and app-detail summaries.

**Step 2: Replace hardcoded UI copy**

Route all user-facing strings in those files through `t(...)`.

**Step 3: Repair corrupted Chinese locale entries**

Replace mojibake install-state values with valid Simplified Chinese strings.

**Step 4: Re-run the i18n contract**

Run: `pnpm check:i18n`

Expected: install/app-detail issues are cleared.

### Task 4: Harden Automated I18n Checks

**Files:**

- Modify: `scripts/check-i18n-contract.mjs`

**Step 1: Add page/component UI boundary checks**

Fail the contract when page/component `.tsx` files import or use `useLocalizedText`.

**Step 2: Keep the existing JSX/static-text checks**

Ensure the new rules complement, not replace, the current untranslated UI detection.

**Step 3: Re-run the contract**

Run: `pnpm check:i18n`

Expected: exit 0 with the strengthened rules.

### Task 5: Final Verification

**Files:**

- Modify: workspace files touched by Tasks 2-4

**Step 1: Run targeted tests**

Run: `pnpm --filter @sdkwork/claw-i18n exec node --experimental-strip-types src/index.test.ts`

Expected: PASS

**Step 2: Run workspace verification**

Run: `pnpm check:i18n`

Expected: PASS

Run: `pnpm lint`

Expected: PASS

Run: `pnpm build`

Expected: PASS
