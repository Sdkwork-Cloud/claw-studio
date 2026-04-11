# Repo-Wide I18n Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the workspace on a single internationalization system, remove hardcoded Chinese and other UI copy from package source files, and ensure language selection works reliably from request/runtime defaults through persisted user preferences.

**Architecture:** Keep `@sdkwork/claw-i18n` as the single source of truth for locale resources, runtime language normalization, and i18next bootstrap. Route all package UI through translation keys, move static copy out of components/pages into locale resources or localized content builders, and centralize default/request language resolution so shell, web, and desktop hosts behave consistently.

**Tech Stack:** TypeScript, React, pnpm workspace, i18next, react-i18next, Zustand, React Router, Express, Tauri

---

### Task 1: Freeze The I18n Contract

**Files:**
- Create: `packages/sdkwork-claw-i18n/src/config.ts`
- Create: `packages/sdkwork-claw-i18n/src/detectLanguage.ts`
- Create: `packages/sdkwork-claw-i18n/src/index.test.ts`
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Modify: `packages/sdkwork-claw-core/src/stores/useAppStore.ts`
- Modify: `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`

- [ ] **Step 1: Write the failing i18n contract tests**

Add tests that assert:

- only supported languages are exposed by the shared config
- request/browser/persisted language values normalize to a supported locale
- default language selection falls back deterministically when request/runtime data is missing
- changing the app-store language to an unsupported locale cannot break i18n initialization

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: FAIL because the current bootstrap does not expose a reusable language contract and the store still advertises unsupported `ja`.

- [ ] **Step 3: Implement the shared language contract**

Create reusable helpers for:

- `SUPPORTED_LANGUAGES`
- `DEFAULT_LANGUAGE`
- language normalization and fallback
- request/browser/store language resolution

Update the app store and settings UI to rely on that contract instead of inline string unions and unsupported options.

- [ ] **Step 4: Re-run the tests**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: PASS.

### Task 2: Remove Duplicate I18n Implementations

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/index.ts`
- Remove or replace: `packages/sdkwork-claw-infrastructure/src/i18n/index.ts`
- Remove or replace: `packages/sdkwork-claw-infrastructure/src/i18n/index.test.ts`
- Remove or replace: `packages/sdkwork-claw-infrastructure/src/i18n/locales/en.json`
- Remove or replace: `packages/sdkwork-claw-infrastructure/src/i18n/locales/zh.json`

- [ ] **Step 1: Extend tests for single-source resource ownership**

Add assertions that infrastructure re-exports the shared bootstrap from `@sdkwork/claw-i18n` rather than maintaining its own divergent locale tree.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: FAIL because infrastructure still ships its own copy of the bootstrap and resources.

- [ ] **Step 3: Collapse the duplicate implementation**

Delete or replace the infrastructure-local i18n implementation with a thin re-export, so only `@sdkwork/claw-i18n` owns resources and bootstrap behavior.

- [ ] **Step 4: Re-run the tests**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: PASS.

### Task 3: Support Request-Aware Runtime Language Resolution

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/providers/ThemeManager.tsx`
- Modify: `packages/sdkwork-claw-web/server.ts`
- Modify: `packages/sdkwork-claw-web/src/main.tsx`

- [ ] **Step 1: Write the failing runtime tests**

Add tests for:

- deriving the initial language from persisted preference when available
- falling back to request/browser headers when no preference exists
- updating `<html lang>` and i18next state when the app-store language changes

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: FAIL because request-aware initialization and shared runtime synchronization are not fully wired.

- [ ] **Step 3: Implement request-aware bootstrap**

Make the web host surface request locale information, initialize i18n once with normalized options, and ensure shell providers keep DOM language and the selected language in sync.

- [ ] **Step 4: Re-run the tests**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: PASS.

### Task 4: Convert Shared Shell And Settings Copy To Translation Keys

**Files:**
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts`
- Modify: `packages/sdkwork-claw-shell/src/components/GlobalTaskManager.tsx`
- Modify: `packages/sdkwork-claw-core/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-core/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

- [ ] **Step 1: Write a failing shared-copy regression test**

Add a test that loads shared shell keys and verifies representative command palette, sidebar, route placeholder, settings, and modal strings exist in both locale bundles.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: FAIL because shell/settings keys are incomplete.

- [ ] **Step 3: Move shared copy into locale resources**

Replace hardcoded shell/settings strings, placeholders, modal titles, confirmations, and route placeholder copy with translation keys.

- [ ] **Step 4: Re-run the tests**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: PASS.

### Task 5: Convert Feature Package Components And Pages

**Files:**
- Modify: `packages/sdkwork-claw-apps/src/**/*`
- Modify: `packages/sdkwork-claw-auth/src/**/*`
- Modify: `packages/sdkwork-claw-center/src/**/*`
- Modify: `packages/sdkwork-claw-channels/src/**/*`
- Modify: `packages/sdkwork-claw-chat/src/**/*`
- Modify: `packages/sdkwork-claw-commons/src/**/*`
- Modify: `packages/sdkwork-claw-community/src/**/*`
- Modify: `packages/sdkwork-claw-devices/src/**/*`
- Modify: `packages/sdkwork-claw-docs/src/**/*`
- Modify: `packages/sdkwork-claw-extensions/src/**/*`
- Modify: `packages/sdkwork-claw-github/src/**/*`
- Modify: `packages/sdkwork-claw-huggingface/src/**/*`
- Modify: `packages/removed-install-feature/src/**/*`
- Modify: `packages/sdkwork-claw-instances/src/**/*`
- Modify: `packages/sdkwork-claw-market/src/**/*`
- Modify: `packages/sdkwork-claw-tasks/src/**/*`
- Modify: `packages/sdkwork-claw-ui/src/**/*`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

- [ ] **Step 1: Write or extend coverage for feature-copy parity**

Add tests that verify both locale bundles contain the feature namespaces required by apps, chat, channels, community, docs, install, instances, market, tasks, and reusable UI.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: FAIL because those namespaces and keys do not yet exist comprehensively.

- [ ] **Step 3: Migrate feature copy**

For every package component/page:

- remove inline user-facing literals
- replace hardcoded placeholder, CTA, toast, status, empty-state, and modal copy with translation keys
- move docs page navigation and page content scaffolding behind localized content definitions
- keep non-user-facing identifiers, route paths, and internal enum ids stable

- [ ] **Step 4: Re-run the tests**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: PASS.

### Task 6: Remove Chinese From Source Files Outside Locale Bundles

**Files:**
- Modify: `packages/*/src/**/*`

- [ ] **Step 1: Write the failing repository audit**

Add a script or test that fails when Chinese characters are found in package source files outside approved locale resource files.

- [ ] **Step 2: Run the audit to verify it fails**

Run: `pnpm exec tsx packages/sdkwork-claw-i18n/src/index.test.ts`

Expected: FAIL because source files still contain Chinese literals or corrupted encoding remnants.

- [ ] **Step 3: Clean source comments and literals**

Remove or translate Chinese comments, JSX literals, string constants, and malformed encoded text from package source files. Keep Chinese only inside the approved locale resource bundles.

- [ ] **Step 4: Re-run the audit**

Run: `pnpm exec tsx packages/sdkwork-claw-i18n/src/index.test.ts`

Expected: PASS.

### Task 7: Verify The Whole Workspace

**Files:**
- Modify: any files needed to fix verification failures

- [ ] **Step 1: Run targeted i18n verification**

Run: `pnpm --filter @sdkwork/claw-i18n exec tsx src/index.test.ts`

Expected: PASS.

- [ ] **Step 2: Run workspace architecture and type checks**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 4: Manually sanity-check runtime language behavior**

Run: `pnpm dev`

Expected: the application boots, default language is stable, switching language updates visible copy, and locale-sensitive UI renders without hardcoded fallback leaks.
