# Repo-Wide I18n Retrofit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the workspace i18n architecture, internationalize all package component/page UI copy, remove Chinese source literals outside locale files, and make runtime language selection request-aware with a stable default locale.

**Architecture:** Consolidate all locale ownership in `@sdkwork/claw-i18n`, remove unsupported language surface area, feed request language from the Express host into the SPA through a normalized cookie/header contract, then migrate package UI copy to translation keys and add automated guardrails.

**Tech Stack:** TypeScript, React, i18next, react-i18next, pnpm workspace, Express, Zustand

---

### Task 1: Freeze The I18n Contract

**Files:**
- Create: `scripts/check-i18n-contract.mjs`
- Modify: `package.json`
- Test: `scripts/check-i18n-contract.mjs`

**Step 1: Write the failing contract check**

Assert that:

- `@sdkwork/claw-i18n` is the only package that owns locale JSON source of truth
- supported locales are exactly `en` and `zh`
- no source file outside locale resources contains Chinese literals
- settings and app-store language types do not expose `ja`

**Step 2: Run test to verify it fails**

Run: `node scripts/check-i18n-contract.mjs`
Expected: FAIL because the current workspace still has duplicate locale bundles and unsupported language surface area.

**Step 3: Write minimal implementation**

Wire the check into root `package.json` so it can be run in local verification.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-i18n-contract.mjs`
Expected: PASS once later tasks complete the contract.

### Task 2: Unify The Shared I18n Runtime

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Modify: `packages/sdkwork-claw-core/src/stores/useAppStore.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/providers/ThemeManager.tsx`
- Modify: `packages/sdkwork-claw-infrastructure/src/i18n/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/i18n/index.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/i18n/index.test.ts`

**Step 1: Write the failing test**

Add assertions for:

- locale normalization
- supported locale list
- default locale behavior
- infrastructure i18n compatibility delegating to `@sdkwork/claw-i18n`

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/i18n/index.test.ts`
Expected: FAIL because the current runtime still duplicates ownership and exposes unsupported language behavior.

**Step 3: Write minimal implementation**

Implement shared helpers in `@sdkwork/claw-i18n`, remove `ja` from the app store language type, and convert infrastructure i18n to a compatibility re-export instead of a second implementation.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/i18n/index.test.ts`
Expected: PASS.

### Task 3: Make The Web Host Request-Aware

**Files:**
- Modify: `packages/sdkwork-claw-web/server.ts`
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Test: `scripts/check-i18n-contract.mjs`

**Step 1: Write the failing test**

Extend the contract check to assert that:

- the web host parses `Accept-Language`
- the host sets a locale cookie
- the host sets `Content-Language`
- the client detector is configured to read the same cookie/query sources

**Step 2: Run test to verify it fails**

Run: `node scripts/check-i18n-contract.mjs`
Expected: FAIL because the current host has no locale middleware.

**Step 3: Write minimal implementation**

Add locale middleware in the Express host and align browser detection order and cookie names in `@sdkwork/claw-i18n`.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-i18n-contract.mjs`
Expected: PASS for request-aware locale behavior.

### Task 4: Internationalize Shared Shell And Settings Surfaces

**Files:**
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts`
- Modify: `packages/sdkwork-claw-core/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-core/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/Settings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/LLMSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/ApiKeysSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/DataPrivacySettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/NotificationSettings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/SecuritySettings.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Extend the contract check to flag known hardcoded shell/settings strings, including command palette labels, route placeholders, settings section labels, and unsupported language options.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-i18n-contract.mjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

Replace hardcoded strings with translation keys and add the required locale entries.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-i18n-contract.mjs`
Expected: PASS for shell/settings surfaces.

### Task 5: Internationalize Feature Packages And Docs UI

**Files:**
- Modify: `packages/sdkwork-claw-apps/src/pages/**/*`
- Modify: `packages/sdkwork-claw-auth/src/pages/**/*`
- Modify: `packages/sdkwork-claw-center/src/components/**/*`
- Modify: `packages/sdkwork-claw-center/src/pages/**/*`
- Modify: `packages/sdkwork-claw-channels/src/pages/**/*`
- Modify: `packages/sdkwork-claw-chat/src/components/**/*`
- Modify: `packages/sdkwork-claw-chat/src/pages/**/*`
- Modify: `packages/sdkwork-claw-community/src/pages/**/*`
- Modify: `packages/sdkwork-claw-devices/src/pages/**/*`
- Modify: `packages/sdkwork-claw-docs/src/pages/**/*`
- Modify: `packages/sdkwork-claw-extensions/src/pages/**/*`
- Modify: `packages/sdkwork-claw-github/src/pages/**/*`
- Modify: `packages/sdkwork-claw-huggingface/src/pages/**/*`
- Modify: `packages/removed-install-feature/src/pages/**/*`
- Modify: `packages/sdkwork-claw-instances/src/pages/**/*`
- Modify: `packages/sdkwork-claw-market/src/pages/**/*`
- Modify: `packages/sdkwork-claw-tasks/src/**/*`
- Modify: `packages/sdkwork-claw-ui/src/components/**/*`
- Modify: `packages/sdkwork-claw-commons/src/components/**/*`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Expand the contract check with a tracked inventory of component/page files that still hardcode user-facing UI strings.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-i18n-contract.mjs`
Expected: FAIL because feature packages still contain hardcoded copy.

**Step 3: Write minimal implementation**

Migrate all component/page UI text to translation keys and remove Chinese comments or literals from source files outside locale resources.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-i18n-contract.mjs`
Expected: PASS.

### Task 6: Verify The Workspace End To End

**Files:**
- Modify: `package.json`
- Test: `node scripts/check-i18n-contract.mjs`
- Test: `pnpm lint`
- Test: `pnpm build`

**Step 1: Run the focused i18n contract**

Run: `node scripts/check-i18n-contract.mjs`
Expected: PASS.

**Step 2: Run workspace lint**

Run: `pnpm lint`
Expected: PASS.

**Step 3: Run production build**

Run: `pnpm build`
Expected: PASS.

**Step 4: Commit**

```bash
git add docs/plans packages scripts package.json
git commit -m "feat: complete repo-wide i18n retrofit"
```
