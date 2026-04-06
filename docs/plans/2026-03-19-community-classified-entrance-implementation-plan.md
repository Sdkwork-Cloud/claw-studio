# Community Classified Entrance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `@sdkwork/claw-community` into a recruitment-first classified information entrance that keeps the `news` module, adds `openclaw`-driven publishing flows for personal job seeking and company recruitment, and exposes future revenue surfaces such as featured placements and acceleration services.

**Architecture:** Keep the route surface intact while replacing the old article-community model with a unified classified-entry model. Extend the seeded community service with structured entry metadata, then recompose the landing page, publish page, and detail page around recruitment-first information architecture plus retained `news` content.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, i18next, Lucide React, Tiptap, Node assert-based tests.

---

### Task 1: Lock the new Community direction with failing tests

**Files:**
- Modify: `packages/sdkwork-claw-community/src/services/communityService.test.ts`
- Modify: `scripts/sdkwork-community-contract.test.ts`

**Step 1: Write the failing test**

- Update the service test to require:
  - unified entry types for job seeking, recruitment, service, and news
  - structured metadata such as location and salary/budget
  - `news` filtering that still works independently
- Update the contract test to require:
  - `openclaw` publishing entry points
  - recruitment-first categories
  - retained `news` affordance
  - removal of the old `latestClaw` / `onlineClaw` / `hottestClaw` landing affordances

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: FAIL because the current seed model only exposes article-style data.

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the current page still renders the old content-community surface.

**Step 3: Write minimal implementation**

- None yet. Stop after the intended red state is confirmed.

**Step 4: Commit**

- Skip committing in this session.

### Task 2: Extend the seeded Community service into a classified-entry model

**Files:**
- Modify: `packages/sdkwork-claw-community/src/services/communityService.ts`

**Step 1: Write the failing test**

- Tighten the service test to assert:
  - recruitment items appear in recruitment filtering
  - job-seeking items appear in personal filtering
  - `news` items are official and announcement-like
  - new structured fields are preserved on create

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: FAIL because the fields and filters do not exist yet.

**Step 3: Write minimal implementation**

- Add a richer entry model while keeping current exported service shape usable.
- Seed entries for:
  - personal job seeking
  - company recruitment
  - local service demand
  - partnership opportunity
  - official news
- Keep `news` mapped to official announcements.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 3: Rebuild the Community landing page as a classified entrance

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/Community.tsx`

**Step 1: Write the failing test**

- Use the contract test to require:
  - recruitment-first category cards
  - `openclaw` publish CTAs
  - assistant workbench cards
  - retained `news` mode
  - business/revenue surfaces for featured and acceleration services

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the current page is still an article stream.

**Step 3: Write minimal implementation**

- Replace the old top bar and side widgets.
- Add:
  - hero
  - category navigation
  - assistant workbench
  - main listing/news feed
  - right-side operations rail
- Keep route path `/community` unchanged.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS or leave only publish/detail/i18n gaps.

**Step 5: Commit**

- Skip committing in this session.

### Task 4: Turn the publish page into an OpenClaw-assisted structured composer

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/NewPost.tsx`

**Step 1: Write the failing test**

- Expand the contract test expectations so the page source must include:
  - publish type selection
  - personal vs company publishing
  - structured fields for location and salary/budget
  - `openclaw` AI assistance messaging

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the page is still centered on generic rich-text posting.

**Step 3: Write minimal implementation**

- Keep the editor, but demote it to detailed description.
- Add structured controls for:
  - entry type
  - publisher identity
  - location
  - compensation
  - company or candidate focus
- Preserve AI generation helpers and align them with classified publishing.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS or move closer to green.

**Step 5: Commit**

- Skip committing in this session.

### Task 5: Adapt the detail page for classified entries and retained news

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx`

**Step 1: Write the failing test**

- Add contract expectations for:
  - structured metadata display
  - `openclaw` action CTA
  - different presentation for news versus classified entries

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL until the detail page reflects the new model.

**Step 3: Write minimal implementation**

- Show structured badges and metadata.
- Preserve rich detail content.
- Add assistant CTA surfaces for optimization, reposting, or follow-up.
- Keep official presentation for `news`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 6: Update locale copy for the new product language

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Let contract and build verification catch missing strings.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL or remain incomplete until all copy is added.

**Step 3: Write minimal implementation**

- Replace old article-community copy with classified-entry copy.
- Keep `news` labels and detail strings coherent.
- Update sidebar/community-facing wording only where needed.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 7: Verify the Community refactor end to end

**Files:**
- No code changes unless fixes are needed

**Step 1: Run focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `pnpm build`
Expected: PASS, unless blocked by unrelated pre-existing workspace issues.

**Step 3: Report status**

- Summarize exact evidence and any remaining risks.
