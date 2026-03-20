# OpenClaw Guided Install Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the OpenClaw install action into a five-step guided flow that handles dependencies, install execution, runtime configuration, skills initialization, and verification inside one coherent wizard.

**Architecture:** Preserve the current product-first install page shell, but replace the OpenClaw install modal path with a wizard-driven overlay. The wizard will use infrastructure services for install assessment and execution, and install-local orchestration services for default selection, validation, configuration apply, initialization apply, and verification summary generation.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, i18next, existing hub-installer contract, infrastructure mock/runtime services, node strip-types tests.

---

### Task 1: Lock the guided install contract with failing tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-install-contract.test.ts`

**Step 1: Write the failing test**

- Require OpenClaw install to expose guided install markers:
  - `guided-install-shell`
  - `guided-install-step`
  - `guided-install-config`
  - `guided-install-initialize`
  - `guided-install-verify`
- Require copy for the new five-step flow in `en.json` and `zh.json`.
- Keep existing product-first lifecycle assertions intact.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because the guided markers and new copy do not exist yet.

**Step 3: Write minimal implementation**

Do not implement production code here. Move to service and UI tasks after confirming the red state.

**Step 4: Re-run to verify the failure is still for the intended reason**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL on missing guided install markers or copy, not on unrelated contract assertions.

### Task 2: Add pure wizard state logic with TDD

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\openClawInstallWizardService.test.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\openClawInstallWizardService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\index.ts`

**Step 1: Write the failing test**

Cover:

- provider compatibility filtering for OpenClaw
- model role inference for default, reasoning, and embedding selections
- wizard step completion and blocking rules
- final verification grading:
  - ready to use
  - installed with follow-up needed
  - blocked

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawInstallWizardService.test.ts`
Expected: FAIL because the service does not exist yet.

**Step 3: Write minimal implementation**

- Create wizard types and pure helpers
- Implement compatibility filtering
- Implement model inference
- Implement step-state and verification-summary builders

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawInstallWizardService.test.ts`
Expected: PASS

### Task 3: Add OpenClaw bootstrap orchestration with TDD

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\openClawBootstrapService.test.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\openClawBootstrapService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\services\index.ts`

**Step 1: Write the failing test**

Cover:

- listing wizard bootstrap data from infrastructure services
- applying model/provider configuration to an instance
- saving selected channels
- installing selected packs and skills without duplicate skill application
- returning a verification snapshot after apply

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawBootstrapService.test.ts`
Expected: FAIL because the service does not exist yet.

**Step 3: Write minimal implementation**

- Load instances, proxy providers, channels, packs, and skills through infrastructure services
- Apply OpenClaw provider configuration through instance LLM provider upsert logic
- Save channel configs through infrastructure channel save paths
- Install packs and individual skills with deduplication
- Build a verification payload for the wizard

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawBootstrapService.test.ts`
Expected: PASS

### Task 4: Build the guided OpenClaw install wizard UI

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\pages\install\Install.tsx`
- Optionally create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\components\OpenClawGuidedInstallWizard.tsx`
- Optionally create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\components\OpenClawGuidedInstallStep.tsx`
- Optionally create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\components\OpenClawGuidedInstallSummary.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-install\src\components\index.ts`

**Step 1: Use the failing contract as the guide**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: FAIL

**Step 2: Implement the OpenClaw-specific wizard path**

- Keep existing modal behavior for uninstall and non-OpenClaw products
- Route `openclaw` install actions to the guided wizard
- Show the five steps in order with status badges and progress
- Reuse assessment data for step 1
- Reuse live installer execution for step 2
- Use bootstrap services for steps 3 and 4
- Use pure wizard service output for step 5

**Step 3: Preserve current install page shell**

- Keep product-first page layout intact
- Keep method cards and assessment overview intact
- Change the OpenClaw CTA label and interaction to guided install language

**Step 4: Run contract verification**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: remaining failures, if any, should now be copy-related rather than missing structure.

### Task 5: Add guided install copy

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

**Step 1: Add the new copy**

- step names and descriptions
- configuration labels
- initialization labels
- verification outcomes
- OpenClaw guided install CTA and helper text

**Step 2: Run contract verification**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS

### Task 6: Run end-to-end verification

**Files:**
- Review: `git diff --stat`

**Step 1: Run focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawInstallWizardService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawBootstrapService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
Expected: PASS

**Step 2: Run workspace verification**

Run: `pnpm lint`
Expected: PASS

**Step 3: Run build verification**

Run: `pnpm build`
Expected: PASS
