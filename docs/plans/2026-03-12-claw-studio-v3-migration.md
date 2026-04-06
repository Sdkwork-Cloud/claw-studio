# Claw Studio V3 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the current workspace so it preserves all `upgrade/claw-studio-v3` functionality while landing the code in a cleaner vertical-feature package architecture.

**Architecture:** Use `upgrade/claw-studio-v3` as the authoritative behavior baseline, restore missing shared core pieces first, add missing feature packages for `account` and `extensions`, then migrate shell routing/navigation and service ownership so `web/desktop` stay thin, `shell` only composes the app, and feature-local services live with their feature packages.

**Tech Stack:** TypeScript, React, pnpm workspace, Vite, Zustand, React Router, motion, Tauri bridge, workspace package exports

---

### Task 1: Build A V3 Parity Audit

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\plans\2026-03-12-claw-studio-v3-parity-audit.md`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\plans\2026-03-12-claw-studio-v3-migration-design.md`

**Step 1: Write the failing test**

Write a checklist-driven audit that marks missing or behavior-divergent items for:

- routes
- pages
- stores
- services
- sidebar/navigation
- i18n assets

The failing condition is any unchecked required v3 item.

**Step 2: Run test to verify it fails**

Run: manually compare `upgrade/claw-studio-v3/src` against `packages/*`
Expected: the audit is incomplete and highlights missing `account`, `extensions`, `useInstanceStore`, and shell parity gaps.

**Step 3: Write minimal implementation**

Create the audit document and update the migration design with any newly discovered gaps so implementation starts from a complete baseline.

**Step 4: Run test to verify it passes**

Run: manually re-check the audit against `upgrade/claw-studio-v3/src`
Expected: every v3 area is either mapped to an existing package or flagged as a migration task.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-12-claw-studio-v3-parity-audit.md docs/plans/2026-03-12-claw-studio-v3-migration-design.md
git commit -m "docs: add claw studio v3 migration parity audit"
```

### Task 2: Restore Shared Business Gaps

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-business\src\stores\useInstanceStore.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-business\src\index.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-business\src\stores\useInstanceStore.test.ts`

**Step 1: Write the failing test**

Add tests for:

- default `activeInstanceId`
- selecting an instance
- clearing and reseeding state

Model the expected API after `upgrade/claw-studio-v3/src/store/useInstanceStore.ts`.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/stores/useInstanceStore.test.ts`
Expected: FAIL because the store does not exist.

**Step 3: Write minimal implementation**

Create `useInstanceStore.ts` in `claw-studio-business`, export it from the package barrel, and keep the API compatible with v3 so shell and feature code can consume it unchanged.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-business/src/stores/useInstanceStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-business/src/stores/useInstanceStore.ts packages/claw-studio-business/src/stores/useInstanceStore.test.ts packages/claw-studio-business/src/index.ts
git commit -m "feat: restore shared instance store"
```

### Task 3: Restore I18n Infrastructure

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-infrastructure\src\i18n\index.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-infrastructure\src\i18n\locales\en.json`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-infrastructure\src\i18n\locales\zh.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-infrastructure\src\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-shell\src\application\providers\AppProviders.tsx`

**Step 1: Write the failing test**

Add the smallest feasible test or bootstrap assertion proving the i18n module initializes and exposes both `en` and `zh` resources expected by the sidebar and settings pages.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/i18n/index.test.ts`
Expected: FAIL because the i18n module does not exist.

**Step 3: Write minimal implementation**

Port `upgrade/claw-studio-v3/src/i18n.ts` and locale JSON files into infrastructure, export the i18n bootstrap, and initialize it in shell providers without leaking setup into feature pages.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-infrastructure/src/i18n/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-infrastructure/src/i18n packages/claw-studio-infrastructure/src/index.ts packages/claw-studio-shell/src/application/providers/AppProviders.tsx
git commit -m "feat: restore workspace i18n bootstrap"
```

### Task 4: Create The Account Feature Package

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-account\package.json`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-account\tsconfig.json`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-account\src\index.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-account\src\pages\account\Account.tsx`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-account\src\services\accountService.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-account\src\services\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\pnpm-workspace.yaml`

**Step 1: Write the failing test**

Add a service test or route-level render test proving the account page can render with the v3 data contract and package exports resolve correctly.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-account/src/services/accountService.test.ts`
Expected: FAIL because the package and service do not exist.

**Step 3: Write minimal implementation**

Create the account package, port `Account.tsx` and `accountService.ts` from v3, wire exports, and keep business logic local to the feature unless a real cross-feature dependency forces promotion.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-account/src/services/accountService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-account pnpm-workspace.yaml
git commit -m "feat: add account feature package"
```

### Task 5: Create The Extensions Feature Package

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\package.json`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\tsconfig.json`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\src\index.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\src\pages\extensions\Extensions.tsx`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\src\services\extensionService.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\src\services\mySkillService.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-extensions\src\services\index.ts`

**Step 1: Write the failing test**

Add tests for the package service exports and the basic extensions page data-loading contract defined by v3.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-extensions/src/services/extensionService.test.ts`
Expected: FAIL because the package does not exist.

**Step 3: Write minimal implementation**

Create the extensions package and port `Extensions.tsx`, `extensionService.ts`, and `mySkillService.ts` from v3 into the new feature package.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-extensions/src/services/extensionService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-extensions
git commit -m "feat: add extensions feature package"
```

### Task 6: Restore Settings Parity

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-settings\src\pages\settings\BillingSettings.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-settings\src\pages\settings\Settings.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-settings\src\index.ts`

**Step 1: Write the failing test**

Add a render-level test or targeted assertion proving the billing tab appears and renders the v3 settings section.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-settings/src/pages/settings/Settings.test.tsx`
Expected: FAIL because billing parity is missing.

**Step 3: Write minimal implementation**

Port `BillingSettings.tsx`, restore the tab in `Settings.tsx`, and export it from the settings package.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-settings/src/pages/settings/Settings.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-settings/src/pages/settings/BillingSettings.tsx packages/claw-studio-settings/src/pages/settings/Settings.tsx packages/claw-studio-settings/src/index.ts
git commit -m "feat: restore billing settings page"
```

### Task 7: Realign Existing Feature Service Ownership

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-github\src\services\githubService.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-huggingface\src\services\huggingfaceService.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-chat\src\services\clawChatService.ts`
- Create or Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-chat\src\services\agentService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-github\src\services\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-huggingface\src\services\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-chat\src\services\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-business\src\index.ts`

**Step 1: Write the failing test**

Add targeted service tests proving each feature package owns the v3 service contracts it consumes.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-github/src/services/githubService.test.ts packages/claw-studio-huggingface/src/services/huggingfaceService.test.ts packages/claw-studio-chat/src/services/clawChatService.test.ts`
Expected: FAIL because these services are missing or owned by the wrong package.

**Step 3: Write minimal implementation**

Port the missing services into their owning feature packages, leave only truly shared orchestration in `claw-studio-business`, and update imports/barrel exports accordingly.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-github/src/services/githubService.test.ts packages/claw-studio-huggingface/src/services/huggingfaceService.test.ts packages/claw-studio-chat/src/services/clawChatService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-github/src/services packages/claw-studio-huggingface/src/services packages/claw-studio-chat/src/services packages/claw-studio-business/src/index.ts
git commit -m "refactor: align feature service ownership with v3"
```

### Task 8: Restore Shell Route And Sidebar Parity

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-shell\package.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-shell\src\application\router\routePaths.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-shell\src\application\router\AppRoutes.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-shell\src\components\Sidebar.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\claw-studio-shell\src\index.ts`

**Step 1: Write the failing test**

Add route and shell-level tests verifying:

- `/account` and `/extensions` exist
- root navigation follows v3
- sidebar renders the instance selector and v3 nav entries

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec vitest run packages/claw-studio-shell/src/application/router/AppRoutes.test.tsx packages/claw-studio-shell/src/components/Sidebar.test.tsx`
Expected: FAIL because the current shell does not match v3.

**Step 3: Write minimal implementation**

Add the new package dependencies, restore route paths, restore the sidebar instance selector and missing nav entries, and align route registration to the v3 behavior baseline.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec vitest run packages/claw-studio-shell/src/application/router/AppRoutes.test.tsx packages/claw-studio-shell/src/components/Sidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/claw-studio-shell/package.json packages/claw-studio-shell/src/application/router/routePaths.ts packages/claw-studio-shell/src/application/router/AppRoutes.tsx packages/claw-studio-shell/src/components/Sidebar.tsx packages/claw-studio-shell/src/index.ts
git commit -m "feat: restore shell parity with v3"
```

### Task 9: Verify Architecture Boundaries

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\check-arch-boundaries.mjs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\package.json`

**Step 1: Write the failing test**

Extend the architecture checks so they assert:

- `account` and `extensions` packages exist
- shell depends on feature exports rather than feature internals
- feature-local services are not re-centralized in `claw-studio-business`

**Step 2: Run test to verify it fails**

Run: `node scripts/check-arch-boundaries.mjs`
Expected: FAIL until the new package layout and rules are in place.

**Step 3: Write minimal implementation**

Update the architecture script and root wiring so the checks enforce the new migration target rather than the previous partial split.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/check-arch-boundaries.mjs package.json
git commit -m "chore: enforce v3 migration package boundaries"
```

### Task 10: Full Verification

**Files:**
- No code changes expected

**Step 1: Run targeted tests**

Run:

- `pnpm.cmd exec vitest run packages/claw-studio-business/src/stores/useInstanceStore.test.ts`
- `pnpm.cmd exec vitest run packages/claw-studio-account/src/services/accountService.test.ts`
- `pnpm.cmd exec vitest run packages/claw-studio-extensions/src/services/extensionService.test.ts`
- `pnpm.cmd exec vitest run packages/claw-studio-shell/src/application/router/AppRoutes.test.tsx`

Expected: all PASS

**Step 2: Run architecture verification**

Run:

- `node scripts/check-arch-boundaries.mjs`

Expected: PASS

**Step 3: Run workspace verification**

Run:

- `pnpm.cmd lint`
- `pnpm.cmd build`

Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "feat: complete claw studio v3 migration"
```
