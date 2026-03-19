# Install Page I18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Internationalize every visible string in the install experience (`Install.tsx`/`InstallDetail.tsx`) so the UI relies entirely on `react-i18next` and `scripts/check-i18n-contract.mjs` passes.

**Architecture:** Keep the existing component hierarchy but replace literals with translation lookups, centralize repeated labels (buttons, tab headers, badges) via small helper structures, and feed toast/confirmation text through dedicated helper functions to avoid inline strings.

**Tech Stack:** TypeScript/React, `react-i18next`, `sonner`, `node scripts/check-i18n-contract.mjs`.

---

### Task 1: Install Page Copy

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`
- Modify: `packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx` (shared strings/live mirroring)
- Test: `scripts/check-i18n-contract.mjs`

**Step 1: Write/verbalize failing validation**
```
node scripts/check-i18n-contract.mjs
```
Expected failure listing install page strings.

**Step 2: Wire translations**
- Wrap the hero title, subtitle, status headers, button labels, grid cards, and toast/confirm text in `t('install.page.*')` keys.
- Parameterize dynamic fragments (e.g., `pack.name`, install log lines) via `t('install.page.log', { repoName })`.
- Share repeated options (OS selectors, tabs, download statuses) through helpers that call `t(...)` when rendering.

**Step 3: Run validation**
```
node scripts/check-i18n-contract.mjs
```
Expected: install files no longer flagged.

**Step 4: Manual smoke**
- `pnpm lint` (workspace lint).
- `pnpm build`.

**Step 5: Commit**
```
git add packages/sdkwork-claw-install/src/pages/install/Install.tsx packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx docs/plans/2026-03-17-install-page-i18n-implementation.md
git commit -m "feat: i18n install experience"
```
