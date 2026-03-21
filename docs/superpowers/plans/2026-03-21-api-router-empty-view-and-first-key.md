# API Router Empty View And First Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the API Router default page visible when router data is empty and allow creating the first unified API key from that empty state.

**Architecture:** Remove the page-level short circuit from the API Router host page so each tab owns its own empty-state behavior. Extend the unified API key create form to support a freeform first tenant/group name when the router admin dataset has no groups yet, while preserving the real router-backed create flow in `unifiedApiKeyService`.

**Tech Stack:** React 19, TypeScript, TanStack Query, i18next JSON locales, node `assert` tests run via `node --experimental-strip-types`

---

### Task 1: Lock the intended behavior with failing tests

**Files:**
- Create: `packages/sdkwork-claw-apirouter/src/services/apiRouterPageViewService.test.ts`
- Create: `packages/sdkwork-claw-apirouter/src/services/apiRouterPageViewService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.ts`
- Create: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.test.ts`

- [ ] **Step 1: Write the failing page-view test**

```ts
assert.equal(resolveApiRouterPageState({ channelCount: 0 }).showPageTabs, true);
assert.equal(resolveApiRouterPageState({ channelCount: 0 }).showRouteConfigEmptyState, true);
```

- [ ] **Step 2: Run the page-view test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterPageViewService.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write the failing first-key form test**

```ts
assert.deepEqual(
  normalizeUnifiedApiKeyFormState({
    name: 'First Key',
    keyMode: 'system-generated',
    apiKey: '',
    groupId: '',
    groupName: 'Acme Workspace',
    expiresAt: '',
    notes: '',
  }),
  { name: 'First Key', source: 'system-generated', groupId: 'Acme Workspace', groupName: 'Acme Workspace', expiresAt: null, notes: '' },
);
```

- [ ] **Step 4: Run the form test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.test.ts`
Expected: FAIL because `groupName` is not supported yet.

- [ ] **Step 5: Implement the minimal helpers**

Add focused helpers for page empty-state decisions and first-group normalization.

- [ ] **Step 6: Re-run both tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterPageViewService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.test.ts`

Expected: PASS

### Task 2: Keep the API Router shell visible when channels are empty

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/ApiRouterRouteConfigView.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/ApiRouterChannelSidebar.tsx`

- [ ] **Step 1: Remove the page-level early return in `ApiRouter.tsx`**
- [ ] **Step 2: Use the page-view helper to keep tabs and the unified-key tab mounted**
- [ ] **Step 3: Add a route-config scoped empty state instead of rendering empty channel/provider panes**
- [ ] **Step 4: Re-run the new page-view test**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterPageViewService.test.ts`
Expected: PASS

### Task 3: Support first unified API key creation from an empty router dataset

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyManager.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts`

- [ ] **Step 1: Extend the create payload and form state with optional `groupName`**
- [ ] **Step 2: Show a text input when no real groups exist, otherwise keep the current select**
- [ ] **Step 3: Allow the create button and dialog to open even when the tenant list is empty**
- [ ] **Step 4: Teach `unifiedApiKeyService.createUnifiedApiKey` to create the first tenant using the provided name**
- [ ] **Step 5: Add or extend service tests for first-tenant creation**
- [ ] **Step 6: Run the unified API key tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts`

Expected: PASS

### Task 4: Finish copy and verification

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

- [ ] **Step 1: Add route-config empty-state and first-group field copy**
- [ ] **Step 2: Run focused package checks**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterPageViewService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyFormService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts`
- `pnpm check:i18n`
- `pnpm --filter @sdkwork/claw-web lint`

Expected: PASS
