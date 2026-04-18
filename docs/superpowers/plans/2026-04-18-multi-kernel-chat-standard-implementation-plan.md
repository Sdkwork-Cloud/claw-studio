# Multi-Kernel Chat Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cut Claw Studio chat onto an adapter-first multi-kernel standard so instance-scoped chat always flows through one `KernelChatAdapter` registry and never falls back to Studio-local durable conversation truth.

**Architecture:** Keep the existing shared `KernelChat*` model, then add one adapter SPI and registry in `@sdkwork/claw-chat` as the only runtime-to-chat authority. OpenClaw gateway chat, transport-backed HTTP chat, and Hermes capability shells all enter through the same registry. The chat store then becomes kernel-first: instance-scoped sessions come from adapters, while Studio-local durable conversation persistence is removed from kernel-backed instance chat.

**Tech Stack:** TypeScript, React, Zustand, existing OpenClaw gateway client/store, Node strip-types test runner.

**Current Workspace Status (2026-04-18):** The adapter-first multi-kernel chat cut is implemented in the current `sdkwork-claw-chat` worktree. Fresh verification in this session:

- `node scripts/run-sdkwork-chat-check.mjs` PASS
- `pnpm lint` PASS
- `pnpm build` PASS

---

### Task 1: Add The Adapter SPI And Registry

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/kernelChatAdapter.ts`
- Create: `packages/sdkwork-claw-chat/src/services/kernelChatAdapter.test.ts`
- Create: `packages/sdkwork-claw-chat/src/services/kernelChatAdapterRegistry.ts`
- Create: `packages/sdkwork-claw-chat/src/services/kernelChatAdapterRegistry.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/index.ts`
- Modify: `scripts/run-sdkwork-chat-check.mjs`

- [ ] **Step 1: Write the failing tests**

Create tests that lock:

```ts
const registry = createKernelChatAdapterRegistry({
  resolveInstance: async () => ({
    id: 'instance-openclaw',
    runtimeKind: 'openclaw',
    transportKind: 'openclawGatewayWs',
    deploymentMode: 'local-managed',
    status: 'online',
  }),
});

const resolution = await registry.resolveForInstance('instance-openclaw');
assert.equal(resolution.adapterId, 'openclawGateway');
assert.equal(resolution.capabilities.authorityKind, 'gateway');
```

Add a second test that proves a non-OpenClaw HTTP runtime resolves to the transport-backed adapter and a Hermes runtime resolves to the Hermes adapter shell.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/kernelChatAdapter.test.ts`

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/kernelChatAdapterRegistry.test.ts`

Expected: FAIL because the SPI/registry files do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add:

- `KernelChatAdapterCapabilities`
- `KernelChatAdapter`
- `KernelChatAdapterResolution`
- `KernelChatAdapterRegistry`

Keep the SPI focused:

- session list/create/delete/update hooks
- message/run hooks
- subscription hook
- capability reporting

The registry must:

- own runtime-kind and transport-kind branching
- return `openclawGateway`, `transportBacked`, `hermes`, or `unsupported`
- avoid leaking route-first decisions into stores

- [ ] **Step 4: Run tests to verify they pass**

Run the two test files from Step 2 again.

Expected: PASS

- [ ] **Step 5: Export and register the new tests**

Update `packages/sdkwork-claw-chat/src/services/index.ts` and `scripts/run-sdkwork-chat-check.mjs`.

### Task 2: Add OpenClaw And Transport-Backed Adapters

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/adapters/openClawGatewayKernelChatAdapter.ts`
- Create: `packages/sdkwork-claw-chat/src/services/adapters/openClawGatewayKernelChatAdapter.test.ts`
- Create: `packages/sdkwork-claw-chat/src/services/adapters/transportBackedKernelChatAdapter.ts`
- Create: `packages/sdkwork-claw-chat/src/services/adapters/transportBackedKernelChatAdapter.test.ts`
- Create: `packages/sdkwork-claw-chat/src/services/adapters/hermesKernelChatAdapter.ts`
- Create: `packages/sdkwork-claw-chat/src/services/adapters/hermesKernelChatAdapter.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/index.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/index.ts`
- Modify: `scripts/run-sdkwork-chat-check.mjs`

- [ ] **Step 1: Write the failing tests**

Lock:

```ts
const openclaw = createOpenClawGatewayKernelChatAdapter(...);
const openclawCaps = openclaw.getCapabilities();
assert.equal(openclawCaps.authorityKind, 'gateway');
assert.equal(openclawCaps.durable, true);

const transport = createTransportBackedKernelChatAdapter(...);
const draft = await transport.createSession({ instanceId: 'instance-http' });
assert.equal(draft.kernelSession.authority.kind, 'http');
assert.equal(draft.kernelSession.authority.durable, false);

const hermes = createHermesKernelChatAdapter();
assert.equal(hermes.getCapabilities().authorityKind, 'sqlite');
assert.equal(hermes.getCapabilities().supported, false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run each new test file with `node --experimental-strip-types`.

Expected: FAIL because the adapter files do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement:

- OpenClaw adapter as a thin owner around the existing gateway session store/projection
- transport-backed adapter as in-memory non-durable session authority for HTTP/SSE/WebSocket-compatible runtimes
- Hermes adapter shell that reports authoritative `sqlite` semantics and explicit unsupported capabilities until a real Hermes chat transport is wired

Rules:

- OpenClaw remains gateway-authoritative
- transport-backed chat must never persist through `StudioConversationRecord`
- Hermes must not be routed through OpenClaw or generic local persistence

- [ ] **Step 4: Run tests to verify they pass**

Run the adapter test files again.

Expected: PASS

- [ ] **Step 5: Export and register**

Update barrel exports and chat-check runner.

### Task 3: Refactor Chat Store To Adapter-First Instance Chat

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/store/chatStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/connectGatewayInstances.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/useChatStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/chatSessionBootstrap.ts`
- Test: `packages/sdkwork-claw-chat/src/store/chatStoreAuthority.test.ts`
- Test: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests proving:

```ts
assert.equal(createdSession?.kernelSession?.authority.kind, 'http');
assert.equal(createdSession?.kernelSession?.authority.durable, false);
assert.equal(createdSession?.transport, 'kernelAdapter');
assert.equal(studioPutConversationCalls.length, 0);
```

Add another test proving OpenClaw session hydration still exposes `gateway` authority through the adapter path rather than route-first branching inside the store.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/chatStoreAuthority.test.ts`

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

Expected: FAIL on the new adapter-first assertions.

- [ ] **Step 3: Write the minimal implementation**

Refactor the store so that:

- instance-scoped hydrate/create/select/delete/clear/send paths resolve the adapter first
- adapter resolution owns capability/unsupported branching
- non-instance drafts may stay UI-local, but instance-scoped sessions no longer use Studio-local durable conversation truth
- `transport` becomes adapter-oriented for kernel-backed sessions instead of `'local'`

Keep OpenClaw warm-connection behavior intact, but make it a capability owned by the OpenClaw adapter path.

- [ ] **Step 4: Run tests to verify they pass**

Re-run the two updated store tests.

Expected: PASS

### Task 4: Remove Instance-Scoped Studio Conversation Persistence From Chat

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/chatSessionMapping.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/chatAttachmentPayload.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/store/localChatKernelProjection.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/store/localChatKernelProjection.test.ts`
- Modify: `scripts/sdkwork-chat-contract.test.ts`

- [ ] **Step 1: Write the failing tests**

Change tests so they now require:

```ts
assert.equal(roundTrip.kernelSession, undefined);
assert.equal(roundTrip.messages[0]?.kernelMessage, undefined);
assert.equal(localProjectionAuthority?.durable, false);
```

Add a contract assertion that instance-scoped chat no longer writes through `studio.putConversation(...)`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatAttachmentPayload.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/store/localChatKernelProjection.test.ts`
- `node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts`

Expected: FAIL because the old local-projection behavior is still present.

- [ ] **Step 3: Write the minimal implementation**

Make these changes:

- `mapStudioConversation()` no longer hydrates fake kernel authority
- `studioConversationGateway` becomes unavailable for instance-scoped kernel chat persistence
- `localChatKernelProjection` becomes explicitly non-durable draft/cache-only support or is narrowed to UI-only callers
- the contract test locks the hard cut so future edits cannot reintroduce durable Studio-local truth

- [ ] **Step 4: Run tests to verify they pass**

Run the three commands from Step 2 again.

Expected: PASS

### Task 5: Align Page, Services, And Kernel State Helpers With The Registry

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx`
- Modify: `packages/sdkwork-claw-chat/src/services/chatService.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAgentCatalogService.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatSessionState.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatMessageState.ts`
- Test: `packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
- Test: `packages/sdkwork-claw-chat/src/services/chatService.test.ts`

- [ ] **Step 1: Write the failing tests**

Add assertions that:

- page behavior derives support/readiness from adapter capabilities instead of route-first local/gateway assumptions
- the agent catalog still resolves through the standardized kernel catalog path
- transport-backed kernel sessions surface `http` authority metadata in header/state helpers

- [ ] **Step 2: Run tests to verify they fail**

Run the updated page and service tests with `node --experimental-strip-types`.

Expected: FAIL because the page and service logic still switch on route-first assumptions.

- [ ] **Step 3: Write the minimal implementation**

Update the page and supporting services so:

- unsupported state comes from adapter capabilities
- OpenClaw-only controls stay gated to the OpenClaw adapter
- generic transport-backed kernels still use kernel-standard session/message state
- no page path assumes local durable chat authority for an instance

- [ ] **Step 4: Run tests to verify they pass**

Re-run the updated page and service tests.

Expected: PASS

### Task 6: Run Full Verification

**Files:**
- No source changes expected unless a failing verification exposes a real regression

- [x] **Step 1: Run the focused chat verification**

Run: `node scripts/run-sdkwork-chat-check.mjs`

Expected: PASS

- [x] **Step 2: Run workspace lint**

Run: `cmd /c "set \"PATH=C:\\Windows\\System32;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;C:\\Program Files\\Git\\cmd;C:\\nvm4w\\nodejs;%PATH%\" && pnpm lint"`

Expected: PASS

- [x] **Step 3: Run workspace build**

Run: `cmd /c "set \"PATH=C:\\Windows\\System32;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;C:\\Program Files\\Git\\cmd;C:\\nvm4w\\nodejs;%PATH%\" && pnpm build"`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-18-multi-kernel-chat-standard-design.md docs/superpowers/plans/2026-04-18-multi-kernel-chat-standard-implementation-plan.md packages/sdkwork-claw-chat packages/sdkwork-claw-types scripts
git commit -m "feat: hard cut chat onto adapter-first kernel authority"
```
