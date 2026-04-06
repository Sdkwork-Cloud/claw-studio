I'm using the writing-plans skill to create the implementation plan.

# Community & Devices I18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. (Afterwards we will continue with superpowers:subagent-driven-development.)

**Goal:** Replace every remaining literal UI string in the community and devices pages with `react-i18next` keys/`defaultValue`s so the contract check passes while leaving the locale JSONs untouched.

**Architecture:** Each page imports `useTranslation`, routes every user-visible string through `t(...)`, and keeps the text grouped by namespace (`community.postDetail`, `devices.page`) with sensible defaults until the central locale tables are updated.

**Tech Stack:** React (TSX), `react-i18next`, `sonner` toasts, `motion/react` for animation, and `node scripts/check-i18n-contract.mjs` for validation.

---

### Task 1: Localize `CommunityPostDetail.tsx`

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx`

**Step 1:** Add `useTranslation` above the component (it is already imported) and ensure the component body starts with `const { t } = useTranslation();`.

**Step 2:** Replace each direct JSX string (headers, badges, button labels, placeholders, `span` text like `"views"`, `"Power"`-like labels) with `t('community.postDetail.<key>', { defaultValue: '...' })`. Keep re-used values in a small `const textual = { ... }` object if it makes the markup clearer.

**Step 3:** Turn the `textarea` placeholder, “Post not found” card, and “Back to Community” header into translated values. Also handle the “ME” badge, “Comments”, “Add to the discussion…”, and “Reply” buttons via translations (with defaultValue strings matching the current copy).

**Step 4:** Double-check there are no dangling literal strings by scanning the JSX; `node scripts/check-i18n-contract.mjs` should then pass for this file (run globally after finishing both tasks).

**Step 5:** Save the file and run `git status` to confirm only the intended file changed.

### Task 2: Localize `Devices.tsx`

**Files**
- Modify: `packages/sdkwork-claw-devices/src/pages/devices/Devices.tsx`

**Step 1:** Confirm `const { t } = useTranslation();` is available (it already is) and identify the remaining literal strings: the “Power” label and the literal `v` version prefix.

**Step 2:** Replace those fragments with `t('devices.page.labels.power', { defaultValue: 'Power' })` and `t('devices.page.labels.versionPrefix', { defaultValue: 'v' })` (or equivalent names) while keeping the rest of the already translated copy untouched.

**Step 3:** Run `node scripts/check-i18n-contract.mjs` to ensure no new issues appear and the file is clean.

**Step 4:** Verify the device list still renders properly (manual check: `pnpm dev` not required for this plan but mention could be used).

**Step 5:** Save and ensure only this file (plus the community file) shows as staged for the change.

### Task 3: Validation

**Files:**
- Validate: `node scripts/check-i18n-contract.mjs`

**Step 1:** Run `node scripts/check-i18n-contract.mjs` from the repo root.
**Expected:** No failures; any remaining literal text should be replaced by `t(...)`.

**Step 2:** If the script still prints failures, inspect the listed files and repeat the relevant step from Task 1 or 2 to reroute the leftover string through `t`.
**Step 3:** Once the script exits cleanly, optionally rerun `git status` to confirm only the intended files changed.

