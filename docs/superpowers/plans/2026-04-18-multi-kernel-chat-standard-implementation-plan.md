# Multi-Kernel Chat Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cut Claw Studio chat onto a kernel-native `agent/session/run/message` standard, with OpenClaw projected through the new model and shared chat state carrying kernel authority metadata.

**Architecture:** Add shared `KernelChat*` contracts in `@sdkwork/claw-types`, add OpenClaw projection helpers and a kernel chat agent catalog path in `@sdkwork/claw-chat`, then thread the new kernel metadata through the existing chat store as a projection layer without keeping Studio-local kernel chat authority.

**Tech Stack:** TypeScript, React, Zustand, Node strip-types test runner, existing OpenClaw gateway integration.

---

### Task 1: Add Shared Kernel Chat Contracts

**Files:**
- Create: `packages/sdkwork-claw-types/src/kernelChatModel.ts`
- Create: `packages/sdkwork-claw-types/src/kernelChatModel.test.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `scripts/run-sdkwork-chat-check.mjs`

- [ ] **Step 1: Write the failing test**

Create `packages/sdkwork-claw-types/src/kernelChatModel.test.ts` to assert:

```ts
assert.deepEqual(KERNEL_CHAT_MESSAGE_ROLES, ['system', 'user', 'assistant', 'tool', 'runtime']);
assert.equal(createKernelChatSessionRef({...}).routingKey, 'agent:research:main');
assert.equal(createKernelChatAuthority({ kind: 'gateway' }).source, 'kernel');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-types/src/kernelChatModel.test.ts`
Expected: FAIL because `kernelChatModel.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add `kernelChatModel.ts` with:

- runtime constants for roles, part kinds, authority kinds, and run statuses
- exported types for `KernelChatAgentProfile`, `KernelChatSessionRef`, `KernelChatAuthority`, `KernelChatSession`, `KernelChatRun`, `KernelChatMessage`, `KernelChatMessagePart`
- normalization helpers `createKernelChatSessionRef()` and `createKernelChatAuthority()`

Export the module from `packages/sdkwork-claw-types/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-types/src/kernelChatModel.test.ts`
Expected: PASS

- [ ] **Step 5: Add the test to the chat check runner**

Update `scripts/run-sdkwork-chat-check.mjs` to include:

```js
'packages/sdkwork-claw-types/src/kernelChatModel.test.ts',
```

### Task 2: Add OpenClaw Kernel Chat Projection Helpers

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.ts`
- Create: `packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/index.ts`
- Modify: `scripts/run-sdkwork-chat-check.mjs`

- [ ] **Step 1: Write the failing test**

Create `openClawKernelChatProjection.test.ts` to lock:

```ts
const session = buildOpenClawKernelChatSession({...});
assert.equal(session.ref.agentId, 'research');
assert.equal(session.ref.routingKey, 'agent:research:thread-1');
assert.equal(session.authority.kind, 'gateway');

const message = buildOpenClawKernelChatMessage({...});
assert.deepEqual(
  message.parts.map((part) => part.kind),
  ['text', 'reasoning', 'attachment', 'toolCall', 'toolResult'],
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.test.ts`
Expected: FAIL because the projection file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:

- `parseOpenClawAgentSessionRoutingKey()`
- `buildOpenClawKernelChatSessionRef()`
- `buildOpenClawKernelChatSession()`
- `buildOpenClawKernelChatMessage()`
- `hydrateOpenClawKernelChatProjection()`

Map:

- OpenClaw reasoning -> `reasoning`
- OpenClaw attachments -> `attachment`
- OpenClaw tool cards -> `toolCall` / `toolResult`
- session key -> `routingKey`
- parsed agent slug -> `agentId`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.test.ts`
Expected: PASS

- [ ] **Step 5: Export and register the test**

Update `packages/sdkwork-claw-chat/src/services/openclaw/index.ts` and `scripts/run-sdkwork-chat-check.mjs`.

### Task 3: Thread Kernel Chat Metadata Through OpenClaw Gateway Snapshots

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/store/chatStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/useChatStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/chatSessionMapping.ts`
- Test: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests to `openClawGatewaySessionStore.test.ts` asserting:

```ts
assert.equal(snapshot.sessions[0]?.kernelSession?.authority.kind, 'gateway');
assert.equal(snapshot.sessions[0]?.kernelSession?.ref.agentId, 'research');
assert.deepEqual(
  snapshot.sessions[0]?.messages[0]?.kernelMessage?.parts.map((part) => part.kind),
  ['text', 'reasoning', 'toolCall'],
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-sdkwork-chat-check.mjs`
Expected: FAIL in the updated gateway session store test.

- [ ] **Step 3: Write minimal implementation**

Update `OpenClawGatewayMessage` and `OpenClawGatewayChatSession` to carry optional:

- `kernelMessage`
- `kernelSession`

Project sessions in `getSnapshot()` and `createDraftSession()` via `hydrateOpenClawKernelChatProjection()`.

Update `ChatSession` and `Message` in `chatStore.ts` so the projection can flow into UI state.

Ensure `chatSessionMapping.ts` strips kernel-native metadata from Studio-local persistence.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/run-sdkwork-chat-check.mjs`
Expected: PASS for the new gateway metadata assertions.

### Task 4: Normalize Agent Catalog Access Through the Kernel Chat Standard

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/kernelChatAgentCatalogService.ts`
- Create: `packages/sdkwork-claw-chat/src/services/kernelChatAgentCatalogService.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/agentService.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/index.ts`
- Modify: `scripts/run-sdkwork-chat-check.mjs`

- [ ] **Step 1: Write the failing test**

Create `kernelChatAgentCatalogService.test.ts` to assert:

```ts
const profiles = await kernelChatAgentCatalogService.listAgentProfiles('openclaw-instance');
assert.equal(profiles[0]?.kernelId, 'openclaw');
assert.equal(profiles[0]?.agentId, 'main');
```

Update `agentService.test.ts` or add a new assertion so `agentService` is backed by the kernel chat catalog service instead of reaching directly into `detail.workbench.agents`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-sdkwork-chat-check.mjs`
Expected: FAIL because the kernel chat agent catalog service does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `kernelChatAgentCatalogService.ts` that:

- returns standardized `KernelChatAgentProfile[]`
- uses OpenClaw catalog resolution for OpenClaw runtimes
- maps profiles back to existing `Agent` DTOs for current UI consumers

Refactor `agentService.ts` to delegate to it.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/run-sdkwork-chat-check.mjs`
Expected: PASS

### Task 5: Verify End-to-End Chat Package Contract

**Files:**
- Modify: `scripts/sdkwork-chat-contract.test.ts`

- [ ] **Step 1: Write the failing contract assertion**

Add assertions that the chat package now includes the kernel chat standard path:

```ts
assert.ok(exists('packages/sdkwork-claw-types/src/kernelChatModel.ts'));
assert.ok(exists('packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.ts'));
assert.match(read('packages/sdkwork-claw-chat/src/store/chatStore.ts'), /kernelSession/);
```

- [ ] **Step 2: Run contract check to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts`
Expected: FAIL until the new files and store fields exist.

- [ ] **Step 3: Update the contract after implementation**

Keep the new assertions and ensure they reflect the final filenames and exports.

- [ ] **Step 4: Run the full contract and package verification**

Run: `node scripts/run-sdkwork-chat-check.mjs`
Expected: PASS
