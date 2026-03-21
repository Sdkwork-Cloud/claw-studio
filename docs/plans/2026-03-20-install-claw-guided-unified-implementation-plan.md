# Install Claw Guided Unified Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the install page to a simplified product-and-method workspace while moving real installation into a modal 5-step guided wizard for all products.

**Architecture:** Keep `Install.tsx` focused on sidebar, tabs, assessments, cards, uninstall, and migration. Move the install journey into a shared modal wizard backed by a new install bootstrap service that reads unified catalog data from `studioMockService` and drives real install execution through `installerService`.

**Tech Stack:** TypeScript, React, Zustand, `@sdkwork/claw-*` workspace packages, `hub-installer`, Tauri/web runtime bridge.

---

### Task 1: Correct the design artifacts before code changes

**Files:**
- Modify: `docs/plans/2026-03-20-install-claw-guided-unified-design.md`
- Modify: `docs/plans/2026-03-20-install-claw-guided-unified-implementation-plan.md`

**Step 1: Rewrite the design doc**

Document the approved architecture:

- modal wizard instead of inline stepper
- 5 steps: dependencies, install, configure, initialize, success
- unified bootstrap data through install-local aggregation service
- simple uninstall and migrate views

**Step 2: Save the corrected implementation plan**

Keep the remaining tasks aligned to TDD and the corrected modal architecture.

### Task 2: Write failing tests for the corrected install shell contract

**Files:**
- Modify: `scripts/sdkwork-install-contract.test.ts`

**Step 1: Write the failing test**

Update the contract to expect:

- install page still has product sidebar, segmented tabs, and adaptive method cards
- `立即安装` remains the install CTA
- install mode uses a modal wizard component, not an inline shell
- wizard markers reflect 5 steps
- uninstall and migrate stay compact
- Chinese locale does not contain the broken install-page mojibake strings

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because the current implementation still contains the inline stepper and broken locale content.

### Task 3: Write failing model and service tests for the new guided flow

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/installPageModel.test.ts`
- Create: `packages/sdkwork-claw-install/src/services/installGuidedWizardService.test.ts`
- Create: `packages/sdkwork-claw-install/src/services/installBootstrapService.test.ts`

**Step 1: Write the failing tests**

Cover:

- 5-step guided wizard metadata order
- adaptive grid class decisions
- product runtime mapping for configuration
- unified bootstrap loading for instances, API Router channels/providers, IM channels, packs, and skills
- configuration applying provider + instance + channel changes
- initialization deduping pack-included skills

**Step 2: Run tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-install/src/pages/install/installPageModel.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installGuidedWizardService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installBootstrapService.test.ts`

Expected: FAIL because the new helpers and services do not exist yet.

### Task 4: Implement the minimal shared wizard helpers and bootstrap service

**Files:**
- Create: `packages/sdkwork-claw-install/src/services/installGuidedWizardService.ts`
- Create: `packages/sdkwork-claw-install/src/services/installBootstrapService.ts`
- Modify: `packages/sdkwork-claw-install/src/services/index.ts`
- Modify: `packages/sdkwork-claw-install/src/pages/install/installPageModel.ts`

**Step 1: Write minimal implementation**

Add:

- generic 5-step metadata
- product-to-runtime mapping helpers
- install bootstrap loading
- provider draft derivation from API Router-backed data
- configuration apply logic
- initialization apply logic

**Step 2: Run tests to verify they pass**

Run the Task 3 commands again.
Expected: PASS

### Task 5: Refactor the install page back to card selection plus modal launch

**Files:**
- Modify: `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

**Step 1: Remove the inline guided shell**

Delete the current inline install-stepper state and rendering path.

**Step 2: Restore the page responsibilities**

Keep:

- sidebar product switching
- segmented icon + text tabs
- adaptive install method cards
- simple uninstall modal
- simple migration panel

Add:

- selected method state for opening the modal wizard
- callback hooks to refresh install assessments and install records after success

**Step 3: Run contract test**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: still FAIL because the modal wizard component is not wired yet.

### Task 6: Build the modal 5-step guided installer

**Files:**
- Create: `packages/sdkwork-claw-install/src/components/GuidedInstallWizard.tsx`
- Modify: `packages/sdkwork-claw-install/src/components/index.ts`
- Optionally modify: `packages/sdkwork-claw-install/src/components/OpenClawGuidedInstallWizard.tsx`

**Step 1: Implement the modal shell**

Use the existing wizard as the baseline visual language, but adapt it to:

- all products
- 5 steps with `success` instead of `verify`
- popup-based pack/skill selection
- success confirm navigation to `/chat`

**Step 2: Wire real install actions**

Support:

- dependency inspection
- one-by-one dependency install
- live install progress
- configuration apply
- initialization apply

**Step 3: Re-run focused tests**

Run the Task 3 commands and the contract test.
Expected: PASS

### Task 7: Repair install-area locale corruption and align copy

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Fix the install-area Chinese keys**

Repair only the install-page and common keys used by the new wizard where corruption is user-visible.

**Step 2: Add/align the new copy**

Ensure locale keys cover:

- tabs
- concise method cards
- 5 wizard steps
- config and initialize popup copy
- success state

**Step 3: Re-run contract test**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS

### Task 8: Verify end-to-end

**Files:**
- No additional code changes unless verification finds regressions.

**Step 1: Run focused verification**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-install/src/pages/install/installPageModel.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installGuidedWizardService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/installBootstrapService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Expected: PASS

**Step 2: Run package verification**

Run:

- `pnpm check:sdkwork-install`
- `pnpm build`

Expected: PASS

**Step 3: Run workspace verification**

Run:

- `pnpm lint`

Expected: report PASS or any unrelated pre-existing failure honestly.
