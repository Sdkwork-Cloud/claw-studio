# Community Online Services Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the recruitment-first classifieds experience so the `services` lane includes legal services and a broader catalog of services that can be delivered fully online.

**Architecture:** Keep the current top-level community information architecture intact. Expand the shared community post model with service-specific metadata, seed a broader online-service inventory, then update the landing page, publish page, detail page, and locale resources to render the new service structure.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, i18next, Lucide React, Tiptap, Node assert-based tests.

---

### Task 1: Lock the online-service expansion in tests

**Files:**
- Modify: `packages/sdkwork-claw-community/src/services/communityService.test.ts`
- Modify: `scripts/sdkwork-community-contract.test.ts`

**Step 1: Write the failing test**

- Extend the service test to require:
  - at least one seeded legal-service entry
  - service metadata for `serviceLine`, `deliveryMode`, and `turnaround`
  - search discovery for an online legal service
  - preservation of the new fields on create
- Extend the contract test to require:
  - a service-matrix surface on the landing page
  - service-specific composer fields in `NewPost`
  - service metadata rendering on the detail page

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: FAIL because the service model does not yet guarantee legal or online-service metadata.

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the current pages do not yet expose service-matrix and service-field affordances.

**Step 3: Write minimal implementation**

- None yet. Stop after the intended red state is confirmed.

### Task 2: Extend the community service model for online-deliverable services

**Files:**
- Modify: `packages/sdkwork-claw-community/src/services/communityService.ts`

**Step 1: Write the failing test**

- Tighten service tests around:
  - `serviceLine`
  - `deliveryMode`
  - `turnaround`
  - legal-service seed data
  - online-service keyword search

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: FAIL for missing fields and missing legal-service inventory.

**Step 3: Write minimal implementation**

- Add service metadata types and optional fields to the community post model.
- Seed a broader services inventory including:
  - legal
  - tax
  - design
  - development
  - marketing
  - translation
  - operations
  - training
- Ensure at least the core seeded services are online-deliverable.
- Include the new fields in search matching and create/update behavior.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: PASS

### Task 3: Add a service-matrix surface to the landing page

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/Community.tsx`

**Step 1: Write the failing test**

- Extend the contract test so it requires:
  - a service catalog/service matrix block
  - legal service copy on the page
  - right-rail visibility for online services

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the current landing page does not yet expose those surfaces.

**Step 3: Write minimal implementation**

- Add a service-catalog configuration to the page.
- Render the service matrix when `services` is active.
- Add an online-services rail block sourced from service entries.
- Show service metadata on service cards where it improves scannability.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS or move closer to green.

### Task 4: Upgrade the publish flow for service-specific fields

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/NewPost.tsx`

**Step 1: Write the failing test**

- Require explicit service publishing fields in the contract test:
  - service line
  - delivery mode
  - turnaround

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the composer is still generic for services.

**Step 3: Write minimal implementation**

- Add service-line and delivery-mode option sets.
- Conditionally render service-specific fields when `category === 'services'`.
- Include the new fields in the submitted post payload.
- Update assistant guidance so online services and legal services feel intentional.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS or move closer to green.

### Task 5: Render service metadata on detail pages

**Files:**
- Modify: `packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx`

**Step 1: Write the failing test**

- Require detail-page support for:
  - service line
  - delivery mode
  - turnaround

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL because the detail page does not yet cover those service fields.

**Step 3: Write minimal implementation**

- Extend the detail metadata panel for service posts.
- Map service lines and delivery modes to translated labels.
- Keep the current recruitment/news behavior intact.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS

### Task 6: Add locale coverage for the online-service extension

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Let the community contract test fail on the new page keys.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: FAIL until the new translation keys exist in both locales.

**Step 3: Write minimal implementation**

- Add service-catalog labels and descriptions.
- Add service-line and delivery-mode labels for the composer and detail page.
- Refresh service-facing copy in both locales to mention online delivery and legal services.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS

### Task 7: Verify the online-services extension end to end

**Files:**
- No code changes unless fixes are needed

**Step 1: Run focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-community-contract.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `pnpm build`
Expected: PASS

Run: `pnpm lint`
Expected: PASS unless blocked by unrelated workspace issues.

**Step 3: Report status**

- Summarize the new online-service coverage, exact verification evidence, and any remaining risks.
