# Model Purchase Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the model purchase experience into a tighter decision flow by removing low-value vendors, shrinking the top information chrome, and moving the primary purchase CTA directly under pricing.

**Architecture:** Keep the existing feature-package boundaries intact while tightening the page structure inside `@sdkwork/claw-model-purchase`. Replace the large summary-card area with a compact selection header, simplify plan-card hierarchy so pricing and CTA are adjacent, and update the catalog service plus tests to remove unused vendors and keep the China lineup focused.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind utility classes, workspace contract tests

---

### Task 1: Lock the desired catalog and layout behavior with failing tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\services\modelPurchaseCatalog.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-model-purchase-contract.test.ts`

**Step 1: Write the failing tests**

- Update the expected vendor id list to exclude `baichuan` and `yi`.
- Require the model purchase page to stop rendering the separate summary card block.
- Require the plan card CTA to appear immediately after pricing content in the source structure.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts`
Expected: FAIL because `baichuan` and `yi` are still present.

Run: `node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts`
Expected: FAIL because the page still imports `ModelPurchaseVendorSummary` and the CTA is not directly below pricing.

**Step 3: Write minimal implementation**

- Remove the low-value vendors from the catalog.
- Collapse the top section into a compact header inside the billing switch area.
- Move the purchase button directly below price/savings before the detail grid.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts`
Expected: PASS

### Task 2: Refine the purchase interaction hierarchy

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\pages\ModelPurchase.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchaseBillingSwitch.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchasePlanGrid.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchaseSidebar.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\index.ts`
- Delete: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-model-purchase\src\components\ModelPurchaseVendorSummary.tsx`

**Step 1: Implement the compact top bar**

- Fold vendor name, region cue, and short tagline into the billing switch container.
- Remove the dedicated top summary-card block from the page.

**Step 2: Implement the CTA-first plan card**

- Keep plan name, badge, and pricing at the top.
- Place the purchase button immediately under pricing and savings.
- Move quota/support/seats/concurrency and benefits below the CTA.

**Step 3: Keep the sidebar focused**

- Remove `yi` and `baichuan` from the catalog, leaving China vendors tighter.
- Promote `zhipu` visibility in the sidebar spotlight set.

**Step 4: Run focused verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts`
Expected: PASS

### Task 3: Run full workspace verification

**Files:**
- No code changes

**Step 1: Run build verification**

Run: `pnpm build`
Expected: PASS

**Step 2: Run workspace lint and contract verification**

Run: `pnpm lint`
Expected: PASS
