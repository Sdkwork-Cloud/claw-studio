# Chat User Message Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten main chat page user message spacing so outgoing bubbles use smaller padding and sit closer to the right edge.

**Architecture:** Keep the change entirely inside `@sdkwork/claw-chat`. Update the layout regression test first, then implement user-only spacing changes in `ChatMessage.tsx` and the matching user footer rail in `Chat.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Node test runner with `--experimental-strip-types`.

---

### Task 1: Lock In The New User Message Layout Contract

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/components/chatMessageLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Update the layout assertions so they expect:

- a user-only message rail class with a tighter right inset
- a tighter user bubble padding class
- a user footer rail class in `Chat.tsx` that matches the tighter right inset

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/components/chatMessageLayout.test.ts`

Expected: FAIL because `ChatMessage.tsx` and `Chat.tsx` still use the older wider user spacing.

### Task 2: Implement User-Only Rail And Bubble Tightening

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/components/ChatMessage.tsx`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`

- [ ] **Step 1: Add user-only outer rail spacing in `ChatMessage.tsx`**

Split the outer rail class so assistant messages keep the current shared `px-4 sm:px-6 lg:px-8` padding while user messages use a tighter right inset.

- [ ] **Step 2: Tighten the user bubble padding**

Adjust the user bubble class from the current looser padding to the approved denser padding values.

- [ ] **Step 3: Align grouped user footer spacing in `Chat.tsx`**

Apply the same tighter right inset to the grouped footer row when `group.role === 'user'`.

- [ ] **Step 4: Re-run the targeted layout regression test**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/components/chatMessageLayout.test.ts`

Expected: PASS with the new user message density contract.

### Task 3: Smoke Check The Package Type/Lint Surface

**Files:**
- No additional code files expected

- [ ] **Step 1: Run the package lint/build verification needed for completion confidence**

Run:

- `pnpm lint`
- `pnpm build`

- [ ] **Step 2: Review output and report actual verification status**

If either command fails for unrelated pre-existing reasons, report that precisely instead of overstating completion.
