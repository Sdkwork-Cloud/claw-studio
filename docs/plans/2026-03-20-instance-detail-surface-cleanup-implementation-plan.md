# Instance Detail Surface Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `Instance Detail` cleaner by moving uninstall into the header and removing misplaced controls from the `Files` and `Tools` sections.

**Architecture:** Keep the existing page structure and workbench sections, but tighten the responsibilities of each surface. Enforce the intended information architecture with a source-level contract test before making the UI change.

**Tech Stack:** TypeScript, React, source-level contract tests via `node --experimental-strip-types`

---

### Task 1: Lock the information architecture with a failing contract test

**Files:**
- Modify: `scripts/sdkwork-instances-contract.test.ts`
- Test: `scripts/sdkwork-instances-contract.test.ts`

**Step 1: Write the failing test**

Add a new contract test that:

- extracts the `renderFilesSection` source and asserts it does not contain `instances.detail.fields.apiToken`
- extracts the `renderToolsSection` source and asserts it does not contain `instances.detail.dangerZone`
- asserts the header action cluster contains `instances.detail.actions.uninstallInstance`

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because the current page still renders token/save controls in `Files` and danger controls in `Tools`.

**Step 3: Write minimal implementation**

Do not implement in this task.

**Step 4: Run test to verify it still reflects the current failing behavior**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL for the new information-architecture assertions.

### Task 2: Simplify the Instance Detail surface layout

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Test: `scripts/sdkwork-instances-contract.test.ts`

**Step 1: Write the failing test**

Use the Task 1 contract test as the failing guardrail.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL with the new assertions.

**Step 3: Write minimal implementation**

Update `InstanceDetail.tsx` to:

- add `Uninstall Instance` to the header action group
- remove `API Token` and `Save Configuration` from `renderFilesSection`
- remove the `Danger Zone` block from `renderToolsSection`
- remove now-unused handlers, state, imports, and UI elements introduced only for those removed controls

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS

### Task 3: Run focused verification for the affected package

**Files:**
- Modify: none unless verification reveals breakage
- Test: `scripts/sdkwork-instances-contract.test.ts`

**Step 1: Run the focused contract check**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS

**Step 2: Run the package-level parity check**

Run: `pnpm check:sdkwork-instances`

Expected: PASS

**Step 3: Record any gaps honestly**

If verification fails because of unrelated workspace issues, report the exact command and failure.

**Step 4: Commit**

Skip committing in this session unless explicitly requested because the workspace contains many unrelated changes.
