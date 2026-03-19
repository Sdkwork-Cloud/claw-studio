# API Router Model Purchase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated model-purchase feature package under the existing `/api-router` workspace, with a left vendor sidebar and tailored monthly, quarterly, and yearly package plans for a curated US and China top-model lineup.

**Architecture:** Keep the route surface unchanged, introduce a shell-owned API Router workspace wrapper, and implement purchase behavior inside a new `@sdkwork/claw-model-purchase` feature package that derives its vendor catalog from infrastructure channel metadata plus curated package rules.

**Tech Stack:** React 19, TypeScript, TanStack Query, react-i18next, lucide-react, workspace contract scripts.

---

### Task 1: Add failing catalog and workspace contract tests

**Files:**
- Create: `packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts`
- Create: `scripts/sdkwork-model-purchase-contract.test.ts`
- Modify: `scripts/sdkwork-shell-contract.test.ts`
- Modify: `scripts/sdkwork-feature-bridges-contract.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- the new package exists and exports a root page module
- the catalog contains `default`, the US top 10 vendor ids, and the China top 10 vendor ids
- each vendor exposes `monthly`, `quarterly`, and `yearly` groups
- the shell `/api-router` route composes both `@sdkwork/claw-apirouter` and `@sdkwork/claw-model-purchase`

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
```

Expected: FAIL because the package and shell wrapper do not exist yet.

**Step 3: Write minimal implementation**

Do not implement feature behavior yet. Only create the minimal files needed to keep the new tests targeted and meaningful.

**Step 4: Run test to verify it still fails for the intended missing behavior**

Run the same commands and confirm the failures are about missing package implementation, not malformed tests.

### Task 2: Scaffold the new feature package

**Files:**
- Create: `packages/sdkwork-claw-model-purchase/package.json`
- Create: `packages/sdkwork-claw-model-purchase/tsconfig.json`
- Create: `packages/sdkwork-claw-model-purchase/src/index.ts`
- Create: `packages/sdkwork-claw-model-purchase/src/ModelPurchase.tsx`
- Create: `packages/sdkwork-claw-model-purchase/src/pages/ModelPurchase.tsx`
- Create: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseSidebar.tsx`
- Create: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseBillingSwitch.tsx`
- Create: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchasePlanGrid.tsx`
- Create: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseVendorHero.tsx`
- Create: `packages/sdkwork-claw-model-purchase/src/services/index.ts`
- Create: `packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.ts`

**Step 1: Write the failing test**

Use the contract assertions from Task 1 as the red state.

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
```

Expected: FAIL because the required files and exports are still missing.

**Step 3: Write minimal implementation**

Create the package skeleton with root exports, placeholder components, and service entry points.

**Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
```

Expected: PASS for file existence and export shape, while the service test still fails on catalog behavior.

### Task 3: Implement the purchase catalog service

**Files:**
- Modify: `packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.ts`
- Modify: `packages/sdkwork-claw-model-purchase/src/services/index.ts`
- Modify: `packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts`

**Step 1: Write the failing test**

Add assertions for:

- exact required vendor ids
- three billing cycles per vendor
- tailored package counts and labels for `default`, `openai`, and `minimax`
- derived region and channel metadata

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts
```

Expected: FAIL because the placeholder service does not build the catalog yet.

**Step 3: Write minimal implementation**

Implement a catalog builder that merges a curated vendor definition table with infrastructure channel metadata and produces cycle-specific plans.

**Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts
```

Expected: PASS

### Task 4: Build the model purchase UI

**Files:**
- Modify: `packages/sdkwork-claw-model-purchase/src/pages/ModelPurchase.tsx`
- Modify: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseSidebar.tsx`
- Modify: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseBillingSwitch.tsx`
- Modify: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchasePlanGrid.tsx`
- Modify: `packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseVendorHero.tsx`

**Step 1: Write the failing test**

Extend the contract to assert:

- data slots for page, sidebar, billing switch, and plan grid
- a left-sidebar navigation structure
- monthly, quarterly, yearly switch labels
- explicit coverage for `default`, `openai`, and `minimax`

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
```

Expected: FAIL because the placeholder page does not render the expected UI structure.

**Step 3: Write minimal implementation**

Build the responsive page, vendor sidebar, billing-cycle switcher, hero summary, and plan grid using the catalog service.

**Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
```

Expected: PASS

### Task 5: Integrate the new package into the shell API Router workspace

**Files:**
- Create: `packages/sdkwork-claw-shell/src/application/router/ApiRouterWorkspace.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/package.json`

**Step 1: Write the failing test**

Use the shell contract assertions from Task 1 as the red state for the wrapper composition.

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
```

Expected: FAIL because `/api-router` still routes straight to `ApiRouter`.

**Step 3: Write minimal implementation**

Create a shell-owned wrapper with a segmented control for `Router Console` and `Model Purchase`, then route `/api-router` to that wrapper.

**Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
```

Expected: PASS

### Task 6: Update workspace parity and localization

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-sdkwork-claw-structure.mjs`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

Use parity checks to surface:

- missing package registration in workspace structure checks
- missing parity command wiring
- missing locale keys for the new workspace wrapper and purchase page

**Step 2: Run test to verify it fails**

Run:

```bash
node scripts/check-sdkwork-claw-structure.mjs
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
```

Expected: FAIL because the new package is not yet registered in parity scripts or locale files.

**Step 3: Write minimal implementation**

Register the new package in the root parity flow and add the required English and Chinese translation keys.

**Step 4: Run test to verify it passes**

Run:

```bash
node scripts/check-sdkwork-claw-structure.mjs
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
```

Expected: PASS

### Task 7: Run final verification

**Files:**
- Modify: touched files only as needed for cleanup

**Step 1: Write the failing test**

No new tests for this task.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm lint
```

Expected: surface any remaining architecture, typing, or contract mismatches.

**Step 3: Write minimal implementation**

Fix only the remaining issues necessary to make the workspace consistent.

**Step 4: Run test to verify it passes**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.test.ts
node --experimental-strip-types scripts/sdkwork-model-purchase-contract.test.ts
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
node scripts/check-sdkwork-claw-structure.mjs
pnpm lint
```

Expected: all commands exit successfully.
