# Model Purchase Four-Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fixed free-membership card ahead of the three paid packages so the model purchase page shows four cards while keeping paid billing cycles clear and purchase-focused.

**Architecture:** The selected vendor and billing cycle remain page-level state in the feature page. The package-grid layer becomes responsible for composing one static free-membership card with the three paid cards from the selected cycle, while i18n owns the free-card copy and contract tests protect the layout and package semantics.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, react-i18next, workspace contract tests

---

### Task 1: Lock the four-card experience with failing tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-model-purchase-contract.test.ts`

**Step 1: Write the failing test**

- Require the billing switch to stay vertically aligned with the vendor heading.
- Require the plan-grid source to include free-membership copy and four-card layout cues.
- Require paid CTA ordering to remain directly below pricing.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts`
Expected: FAIL until the free card and layout changes are implemented.

**Step 3: Write minimal implementation**

- Add free-membership copy and four-card composition.
- Update the grid layout and card variants.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts`
Expected: PASS

### Task 2: Add the free-membership card and keep paid cards purchase-focused

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchasePlanGrid.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchaseBillingSwitch.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\pages\ModelPurchase.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchaseSidebar.tsx`

**Step 1: Build the free card**

- Add a free-membership card variant with:
  - title
  - free badge
  - short explanation
  - 3-4 benefits
  - no purchase button

**Step 2: Compose four cards**

- Always place the free card first.
- Append the three paid plans for the active billing cycle.

**Step 3: Preserve paid-card hierarchy**

- Keep paid cards ordered as:
  - title
  - price
  - CTA
  - package facts
  - benefits

**Step 4: Keep cycle controls in the main reading flow**

- Keep the billing switch below the vendor header rather than pushing it to the far right.

**Step 5: Run focused verification**

Run: `node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts`
Expected: PASS

### Task 3: Localize free-membership copy and clean catalog leftovers

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\services\modelPurchaseCatalog.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\services\modelPurchaseCatalog.test.ts`

**Step 1: Add free-card locale strings**

- Add titles, benefits, and helper copy for the free-membership card in English and Chinese.

**Step 2: Keep vendor catalog aligned**

- Preserve the removal of `Baichuan` and `Yi`.
- Preserve the presence of `Zhipu`.

**Step 3: Run focused verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts`
Expected: PASS

Run: `pnpm check:i18n`
Expected: PASS

### Task 4: Run full workspace verification

**Files:**
- No code changes

**Step 1: Build**

Run: `pnpm build`
Expected: PASS

**Step 2: Lint and contract checks**

Run: `pnpm lint`
Expected: PASS
