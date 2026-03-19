# Date Input Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shared high-polish date input so every current date field opens quickly, feels easier to click, and stays consistent across forms.

**Architecture:** Add a shared `DateInput` in `@sdkwork/claw-ui` with a tiny interaction helper that safely calls the native `showPicker()` API when the environment supports it. Replace every current `type="date"` usage in feature packages with this shared component so the behavior is centralized and regression-tested.

**Tech Stack:** TypeScript, React 19, shared `@sdkwork/claw-ui` primitives, Node `assert` contract tests.

---

### Task 1: Lock the regression surface with tests

**Files:**
- Modify: `scripts/sdkwork-ui-contract.test.ts`
- Create: `packages/sdkwork-claw-ui/src/components/dateInputInteraction.test.ts`

**Step 1: Write the failing tests**

- Add a contract test that fails while feature packages still pass `type="date"` directly instead of using a shared date control.
- Add a helper test that expects a dedicated date-picker interaction utility to open the native picker only for supported editable date inputs.

**Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts`
Expected: FAIL because current feature packages still contain direct `type="date"` usage.

Run: `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/dateInputInteraction.test.ts`
Expected: FAIL because the interaction helper does not exist yet.

### Task 2: Implement the shared date input

**Files:**
- Create: `packages/sdkwork-claw-ui/src/components/dateInputInteraction.ts`
- Create: `packages/sdkwork-claw-ui/src/components/DateInput.tsx`
- Modify: `packages/sdkwork-claw-ui/src/components/index.ts`

**Step 1: Write minimal implementation**

- Add a focused helper that decides when `showPicker()` is safe and triggers it behind feature detection.
- Add `DateInput` with:
  - full-width clickable surface
  - right-side calendar affordance
  - pointer and keyboard opening behavior
  - safe fallback when `showPicker()` is unsupported
  - passthrough props for labels, ids, value, and change handlers

**Step 2: Run tests to verify they pass**

Run: `node --experimental-strip-types packages/sdkwork-claw-ui/src/components/dateInputInteraction.test.ts`
Expected: PASS

### Task 3: Migrate every current date field

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/components/ModelMappingDialogs.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/ProxyProviderDialogs.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx`
- Modify: `packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx`

**Step 1: Replace local date input wiring**

- Swap existing `Input type="date"` usages to the shared `DateInput`.
- Remove duplicated icon wrappers where the shared component already provides the affordance.
- Keep existing layout, validation, and state flow unchanged.

**Step 2: Run contract verification**

Run: `node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts`
Expected: PASS

### Task 4: Final verification

**Files:**
- Modify: `packages/sdkwork-claw-ui/src/index.ts` only if export parity needs it

**Step 1: Run targeted checks**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS
