# OpenClaw Gateway WebChat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claw Studio use the native OpenClaw Gateway WebSocket webchat flow for OpenClaw instances while keeping session, history, and run state synchronized with the Gateway as the only authoritative source.

**Architecture:** Keep OpenClaw-specific Gateway protocol logic inside `@sdkwork/claw-chat`, keep auth-token synchronization in `removed-install-feature`, and preserve local conversation persistence only for non-OpenClaw routes. OpenClaw UI state becomes a projection of `sessions.list`, `chat.history`, and live `chat` events rather than a second durable store.

**Tech Stack:** TypeScript, React, Zustand, browser WebSocket, Node `--experimental-strip-types` tests, pnpm workspace contract checks

---

### Task 1: Preserve OpenClaw auth metadata needed for Gateway WebSocket access

**Files:**
- Modify: `packages/removed-install-feature/src/services/openClawBootstrapService.ts`
- Modify: `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `openClawBootstrapService.test.ts` with a case proving that a synced local-external OpenClaw instance preserves the Gateway auth token instead of writing `authToken: null`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
Expected: FAIL because the sync flow still writes `authToken: null`.

- [ ] **Step 3: Write minimal implementation**

Teach `openClawBootstrapService.ts` to resolve the Gateway auth token from the managed config/runtime snapshot and include it in both `createInstance` and `updateInstance` sync payloads.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
Expected: PASS with the new auth-token preservation assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/removed-install-feature/src/services/openClawBootstrapService.ts packages/removed-install-feature/src/services/openClawBootstrapService.test.ts
git commit -m "feat: preserve openclaw gateway auth token during sync"
```

### Task 2: Reframe OpenClaw route resolution around native Gateway WebSocket mode

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts`
- Modify: `scripts/sdkwork-chat-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Add a dedicated route-service test that proves `openclawGatewayWs` resolves to a native Gateway WebSocket route mode and no longer defaults to HTTP chat completions when both `baseUrl` and `websocketUrl` exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
Expected: FAIL because OpenClaw currently resolves to `instanceOpenAiHttp`.

- [ ] **Step 3: Write minimal implementation**

Update `instanceChatRouteService.ts` to introduce an OpenClaw-native route mode, retain any HTTP URL only as compatibility metadata, and update `scripts/sdkwork-chat-contract.test.ts` to assert the new contract.

- [ ] **Step 4: Run targeted checks**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
Expected: PASS

Run: `pnpm check:sdkwork-chat`
Expected: PASS with the updated route contract.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts scripts/sdkwork-chat-contract.test.ts
git commit -m "feat: route openclaw chat through gateway websocket mode"
```

### Task 3: Add an OpenClaw Gateway protocol client for handshake, commands, and chat events

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/openclaw/gatewayProtocol.ts`
- Create: `packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts`
- Create: `packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
- Create: `packages/sdkwork-claw-chat/src/services/openclaw/index.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/index.ts`

- [ ] **Step 1: Write the failing test**

Add a protocol/client test covering:

- connect challenge + connect handshake
- request/response correlation
- `sessions.list`
- `chat.history`
- `chat.send`
- `chat.abort`
- `sessions.reset`
- `sessions.delete`
- streamed `chat` event delivery

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
Expected: FAIL because the Gateway protocol client does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a browser-side Gateway client that owns WebSocket lifecycle, auth headers/query setup, challenge/connect handshake, command send helpers, event subscriptions, and reconnect callbacks.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-chat/src/services/openclaw/gatewayProtocol.ts packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts packages/sdkwork-claw-chat/src/services/openclaw/index.ts packages/sdkwork-claw-chat/src/services/index.ts
git commit -m "feat: add openclaw gateway websocket client"
```

### Task 4: Replace local-authoritative OpenClaw persistence with Gateway-authoritative session state

**Files:**
- Create: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Create: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/useChatStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/chatSessionMapping.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts`

- [ ] **Step 1: Write the failing test**

Add a store-level test proving that for OpenClaw routes:

- session lists hydrate from Gateway session data
- active history hydrates from `chat.history`
- incoming `chat` events patch the active transcript
- reset/delete require Gateway confirmation
- local `studioConversationGateway` is not used as the durable write path

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
Expected: FAIL because OpenClaw sessions are still persisted locally through `studioConversationGateway`.

- [ ] **Step 3: Write minimal implementation**

Add a Gateway-backed session store or store slice for OpenClaw instances, keep only ephemeral draft UI state locally, and preserve current `studioConversationGateway` behavior for non-OpenClaw flows.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts packages/sdkwork-claw-chat/src/store/useChatStore.ts packages/sdkwork-claw-chat/src/chatSessionMapping.ts packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts
git commit -m "feat: make openclaw chat state gateway authoritative"
```

### Task 5: Refactor the chat page and service layer to drive OpenClaw chat from Gateway commands

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/services/chatService.ts`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatMessage.tsx`
- Modify: `scripts/sdkwork-chat-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Add or extend tests so they prove the OpenClaw chat page:

- does not auto-persist empty local sessions for OpenClaw
- sends new messages through Gateway `chat.send`
- stops generation through `chat.abort`
- loads sidebar sessions from Gateway session state
- deletes and resets sessions through Gateway operations

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm check:sdkwork-chat`
Expected: FAIL because the page and service layer still assume local-authoritative conversation state and HTTP-first OpenClaw sends.

- [ ] **Step 3: Write minimal implementation**

Refactor `chatService.ts` to delegate OpenClaw routes to the Gateway client, update `Chat.tsx` to hydrate and select Gateway sessions, and update `ChatSidebar.tsx` so the session list reflects Gateway-backed state rather than locally persisted conversations.

- [ ] **Step 4: Run targeted checks**

Run: `pnpm check:sdkwork-chat`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-chat/src/services/chatService.ts packages/sdkwork-claw-chat/src/pages/Chat.tsx packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx packages/sdkwork-claw-chat/src/components/ChatMessage.tsx scripts/sdkwork-chat-contract.test.ts
git commit -m "feat: wire openclaw chat ui to gateway sessions"
```

### Task 6: Verify sync consistency, reconnect behavior, and workspace health

**Files:**
- Modify: `docs/superpowers/specs/2026-03-21-openclaw-gateway-webchat-design.md`
- Modify: `docs/superpowers/plans/2026-03-21-openclaw-gateway-webchat-implementation-plan.md`

- [ ] **Step 1: Run focused package tests**

Run: `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
Expected: PASS

- [ ] **Step 2: Run workspace contract checks**

Run: `pnpm check:sdkwork-chat`
Expected: PASS

Run: `pnpm check:sdkwork-install`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 3: Perform manual sync verification**

Verify all of the following against a real OpenClaw instance with valid auth:

- create a new chat in Claw Studio and confirm the session appears in OpenClaw-backed session history
- refresh or reopen Claw Studio and confirm the same session rehydrates from Gateway
- abort a running response and confirm no local-only ghost completion remains
- reset and delete a session from Claw Studio and confirm it disappears after authoritative Gateway refresh
- create or modify a session from OpenClaw control-ui/webchat and confirm Claw Studio picks it up after refresh or reconnect

- [ ] **Step 4: Commit**

```bash
git add packages/removed-install-feature/src/services/openClawBootstrapService.ts packages/removed-install-feature/src/services/openClawBootstrapService.test.ts packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts packages/sdkwork-claw-chat/src/services/openclaw/gatewayProtocol.ts packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts packages/sdkwork-claw-chat/src/services/openclaw/index.ts packages/sdkwork-claw-chat/src/services/index.ts packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts packages/sdkwork-claw-chat/src/store/useChatStore.ts packages/sdkwork-claw-chat/src/chatSessionMapping.ts packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts packages/sdkwork-claw-chat/src/services/chatService.ts packages/sdkwork-claw-chat/src/pages/Chat.tsx packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx packages/sdkwork-claw-chat/src/components/ChatMessage.tsx docs/superpowers/specs/2026-03-21-openclaw-gateway-webchat-design.md docs/superpowers/plans/2026-03-21-openclaw-gateway-webchat-implementation-plan.md scripts/sdkwork-chat-contract.test.ts
git commit -m "feat: adopt openclaw gateway webchat as chat authority"
```
