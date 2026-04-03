# OpenClaw Chat Model Runtime And Instance CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claw Studio chat use the real OpenClaw Gateway model/session flow and finish the writable OpenClaw instance detail surface for providers, models, agents, and auth status.

**Architecture:** Keep OpenClaw chat runtime authority in the Gateway WebSocket session store, derive the chat model picker from router catalog plus instance-effective config instead of hardcoded local channels, and keep OpenClaw instance detail writes grounded in managed `openclaw.json` and agent workspace files instead of mock CRUD. Agent auth state should be derived from each agent workspace `auth-profiles.json`.

**Tech Stack:** TypeScript, React, Zustand, TanStack Query, JSON5 config editing, browser WebSocket, Node `--experimental-strip-types` tests, pnpm workspace checks

---

### Task 1: Define the expanded OpenClaw runtime scope

**Files:**
- Modify: `docs/superpowers/specs/2026-03-21-openclaw-gateway-webchat-design.md`
- Modify: `docs/superpowers/plans/2026-03-21-openclaw-gateway-webchat-implementation-plan.md`
- Create: `docs/superpowers/plans/2026-03-22-openclaw-chat-model-runtime-and-instance-crud.md`

- [ ] **Step 1: Document the new scope**

Capture the missing real-logic gaps:
- Gateway `models.list`
- Gateway `sessions.patch` model override
- per-instance effective chat model catalog
- OpenClaw provider/model/agent/auth management from managed config and agent workspaces

- [ ] **Step 2: Lock consistency rules**

Document these invariants:
- chat sessions remain isolated by `instanceId`
- the model picker only shows models valid for the active instance
- Gateway sessions stay authoritative for OpenClaw message and session state
- instance detail writes always round-trip through managed config or agent workspace files

### Task 2: Add failing tests for real Gateway model operations

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/gatewayProtocol.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

- [ ] **Step 1: Write the failing client tests**

Add tests proving:
- `models.list` is requested with the real Gateway method
- `sessions.patch` updates a session model override
- `sessions.patch` can clear the override by sending `model: null`

- [ ] **Step 2: Write the failing session-store tests**

Add tests proving:
- changing the selected model for an OpenClaw session triggers `sessions.patch`
- sending a message uses the updated session model instead of only mutating local state
- selecting the default/empty model clears the override remotely

- [ ] **Step 3: Run targeted tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

Expected: FAIL for missing model list / session patch support.

### Task 3: Implement Gateway model/runtime parity

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/gatewayProtocol.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`

- [ ] **Step 1: Add protocol types**

Define the response and request shapes for:
- `models.list`
- `sessions.patch`

- [ ] **Step 2: Add client helpers**

Implement:
- `listModels()`
- `patchSession({ key, model })`

- [ ] **Step 3: Apply model changes through the Gateway**

Update the session store so model selection:
- writes to Gateway with `sessions.patch`
- updates local projected state only after the remote patch succeeds
- preserves draft/new-session behavior without leaking state across instances

- [ ] **Step 4: Run targeted tests to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

Expected: PASS

### Task 4: Replace hardcoded chat model catalogs with instance-effective catalogs

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.ts`
- Create: `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatInput.tsx`
- Modify: `packages/sdkwork-claw-settings/src/store/useLLMStore.ts`

- [ ] **Step 1: Write the failing catalog tests**

Cover:
- provider catalog loading from the built-in provider center and instance-effective configuration
- OpenClaw provider/model filtering from managed config
- runtime availability filtering from Gateway `models.list`
- selected model persistence per instance

- [ ] **Step 2: Run targeted tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts`

Expected: FAIL because chat still depends on hardcoded `useLLMStore().channels`.

- [ ] **Step 3: Implement the effective catalog**

Produce a chat-ready catalog that:
- uses router channel/model relationships as the global source
- intersects with the active instance’s allowed/effective models
- includes OpenClaw runtime availability when the instance is Gateway-backed
- keeps only UI preference state in `useLLMStore`

- [ ] **Step 4: Refactor chat page integration**

Update the chat page so:
- the picker is driven by the effective catalog
- model changes call the right runtime path for the active instance
- OpenAI-compatible instance sends pass the selected model in the HTTP request body
- OpenClaw instance sends use the session store + Gateway patch flow

- [ ] **Step 5: Run targeted checks to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`

Expected: PASS

### Task 5: Build writable OpenClaw provider/model/agent/auth services

**Files:**
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Create: `packages/sdkwork-claw-instances/src/services/openClawAgentWorkspaceService.ts`
- Create: `packages/sdkwork-claw-instances/src/services/openClawAgentWorkspaceService.test.ts`

- [ ] **Step 1: Write the failing config/workspace tests**

Cover:
- create/update/delete provider entries under `models.providers`
- update allowed/default model refs under `agents.defaults`
- create/update/delete agent entries under `agents.list`
- read auth status from `agentDir/auth-profiles.json`

- [ ] **Step 2: Run targeted tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentWorkspaceService.test.ts`

Expected: FAIL because provider/model/agent workspace CRUD is incomplete.

- [ ] **Step 3: Implement real config/workspace writes**

Add helpers for:
- provider add/update/delete
- model allowlist/default selection updates
- agent add/update/delete/default switching
- auth profile existence/status inspection

- [ ] **Step 4: Rebuild workbench projections from the writable sources**

Ensure reloading workbench after a mutation reflects:
- new providers/models
- new or removed agents
- updated auth status and workspace path

### Task 6: Finish the instance detail product surface

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`

- [ ] **Step 1: Add writable provider/model controls**

Support:
- provider create/delete
- provider endpoint and api key source editing
- model allowlist editing
- default/reasoning/embedding model selection

- [ ] **Step 2: Add writable agent controls**

Support:
- agent create/delete
- default agent toggle
- workspace/system prompt/identity editing
- auth status display with clear remediation text

- [ ] **Step 3: Keep the UX authoritative**

After every save:
- reload workbench
- clear stale local drafts
- keep selection stable when the edited item still exists
- fall back safely when the active provider/agent was deleted

### Task 7: Verify end-to-end behavior

**Files:**
- Modify: `scripts/sdkwork-chat-contract.test.ts`
- Modify: `scripts/sdkwork-instances-contract.test.ts`

- [ ] **Step 1: Run focused tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentWorkspaceService.test.ts`

- [ ] **Step 2: Run package and contract checks**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
- `pnpm lint`
- `pnpm build`

- [ ] **Step 3: Manual parity verification**

Verify:
- built-in OpenClaw instance keeps a live WS connection on startup
- switching instances keeps session lists isolated and synchronized
- model switching on OpenClaw changes the live session model through the Gateway
- new chat creation works on OpenClaw without local phantom sessions
- instance detail mutations survive reload because they round-trip through managed config / agent workspace files
