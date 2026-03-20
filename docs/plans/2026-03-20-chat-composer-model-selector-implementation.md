# Chat Composer Model Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move chat model selection from the page header into the composer bottom rail and polish the chat input so model switching during drafting or generation feels stable and intentional.

**Architecture:** Keep page orchestration in `packages/sdkwork-claw-chat/src/pages/Chat.tsx`, move reusable composer semantics into a pure helper under `packages/sdkwork-claw-chat/src/services`, and let `ChatInput.tsx` own the bottom-rail dropdown and status presentation. Preserve feature-package boundaries and the existing provider/channel model hierarchy.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Motion, Node `assert` contract tests

---

### Task 1: Lock the model-selector migration and semantics with failing tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-chat-contract.test.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\chatComposerState.test.ts`

**Step 1: Write the failing tests**

- Require a dedicated `chatComposerState.ts` helper to exist.
- Require `Chat.tsx` to stop managing a top-header model dropdown.
- Require `Chat.tsx` to pass active model-selection props into `ChatInput`.
- Add helper tests that prove:
  - idle composer reflects the selected model directly
  - generating composer keeps the current response model stable
  - switching model during generation marks the new model as applying to the next message

**Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts`
Expected: FAIL because the header still owns the model dropdown and no helper exists.

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatComposerState.test.ts`
Expected: FAIL because the helper does not exist yet.

### Task 2: Implement composer model-state helpers

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\chatComposerState.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\index.ts` only if export parity is needed

**Step 1: Write minimal implementation**

- Add a small pure helper that derives the composer status from:
  - selected model
  - in-flight response model
  - generation state
- Return a stable status shape that the composer can render as labels/hints without duplicating logic in React components.

**Step 2: Run helper tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatComposerState.test.ts`
Expected: PASS

### Task 3: Refactor the chat page and composer UI

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\pages\Chat.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\components\ChatInput.tsx`

**Step 1: Slim the page header**

- Remove the top model selector and its local dropdown state.
- Keep skill and agent selectors intact.
- Track the model currently used by the active in-flight response so the composer can explain current-vs-next behavior.

**Step 2: Rebuild the composer bottom rail**

- Pass active channel/model data and change handlers into `ChatInput`.
- Render the model selector inside the composer bottom rail.
- Open the dropdown upward and preserve the existing channel/model two-column selection structure.
- Restore textarea focus after model changes.

**Step 3: Polish generation behavior**

- Keep current send/stop behavior.
- Allow model switching while generating.
- Show a subtle status line when the selected model differs from the in-flight response model, clarifying that the new choice applies to the next message.

**Step 4: Run contract verification**

Run: `node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts`
Expected: PASS

### Task 4: Update copy and final verification

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

**Step 1: Add minimal new chat copy**

- Add composer-specific labels and hints for the bottom model selector.
- Keep wording short and action-oriented.

**Step 2: Run workspace verification**

Run: `pnpm build`
Expected: PASS
