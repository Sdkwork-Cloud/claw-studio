# API Router Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first-class `sdkwork-claw-apirouter` feature package, wire `/api-router` to a real page, and deliver a channel sidebar plus proxy provider operations table.

**Architecture:** Add a dedicated feature package that owns the page, components, and service layer. Promote API Router entities to `@sdkwork/claw-types`, extend `studioMockService` as the shared mock backend, and keep shell limited to navigation and routing.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Zustand, Sonner, Radix Select/Dialog, Tailwind, workspace contract scripts

---

### Task 1: Add shared API Router domain types

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`

**Step 1: Write the failing type consumer expectation**

Define the target public shapes:

```ts
export interface ApiRouterChannel { /* ... */ }
export interface ProxyProvider { /* ... */ }
export interface ProxyProviderGroup { /* ... */ }
```

**Step 2: Verify the current types package lacks the API Router entities**

Run: `Select-String -Path packages/sdkwork-claw-types/src/index.ts -Pattern 'ProxyProvider|ApiRouterChannel'`

Expected: no matches

**Step 3: Add the minimal shared domain types**

Include:

```ts
export type ProxyProviderStatus = 'active' | 'warning' | 'disabled' | 'expired';
```

and the related interfaces needed by infrastructure and the feature service.

**Step 4: Re-run the verification**

Run: `Select-String -Path packages/sdkwork-claw-types/src/index.ts -Pattern 'ProxyProvider|ApiRouterChannel'`

Expected: matches for the new exports

### Task 2: Extend studio mock infrastructure for API Router state

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Step 1: Write the failing mock service behavior tests**

Add tests for:

```ts
await service.listApiRouterChannels();
await service.listProxyProviders('openai');
await service.updateProxyProviderGroup('provider-id', 'team-shared');
await service.updateProxyProviderStatus('provider-id', 'disabled');
await service.deleteProxyProvider('provider-id');
```

**Step 2: Run the targeted infrastructure test file**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

Expected: FAIL because API Router methods do not exist yet

**Step 3: Add seeded channels, groups, providers, clone helpers, and CRUD-style mutations**

Implement:

- channel listing
- group listing
- provider listing by channel
- provider update
- group change
- status toggle
- delete

**Step 4: Re-run the infrastructure tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

Expected: PASS

### Task 3: Create the `sdkwork-claw-apirouter` feature package

**Files:**
- Create: `packages/sdkwork-claw-apirouter/package.json`
- Create: `packages/sdkwork-claw-apirouter/tsconfig.json`
- Create: `packages/sdkwork-claw-apirouter/src/index.ts`
- Create: `packages/sdkwork-claw-apirouter/src/ApiRouter.tsx`
- Create: `packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx`
- Create: `packages/sdkwork-claw-apirouter/src/components/ApiRouterChannelSidebar.tsx`
- Create: `packages/sdkwork-claw-apirouter/src/components/ProxyProviderTable.tsx`
- Create: `packages/sdkwork-claw-apirouter/src/components/ProxyProviderDialogs.tsx`
- Create: `packages/sdkwork-claw-apirouter/src/components/ProxyProviderStatusBadge.tsx`
- Create: `packages/sdkwork-claw-apirouter/src/components/index.ts`
- Create: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts`
- Create: `packages/sdkwork-claw-apirouter/src/services/index.ts`
- Create: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts`

**Step 1: Write the failing service test**

Add expectations for:

```ts
const channels = await apiRouterService.getChannels();
const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });
```

plus group/status/delete mutations.

**Step 2: Run the service test**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts`

Expected: FAIL because the package and service do not exist yet

**Step 3: Implement the service-first package skeleton**

Keep boundaries:

- page owns composition
- components own rendering
- service owns mock backend integration

**Step 4: Implement the page UX**

Include:

- left channel sidebar
- right operations header
- provider table
- copy API key action
- inline group select
- usage method modal
- edit modal
- disable/enable action
- delete action

**Step 5: Re-run the feature service test**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts`

Expected: PASS

### Task 4: Wire shell routing, package dependencies, and navigation text

**Files:**
- Modify: `packages/sdkwork-claw-shell/package.json`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Update the shell route import**

Replace the `/api-router` placeholder route with the real feature component.

**Step 2: Update navigation copy**

Replace staged wording with live product wording in command palette and page text.

**Step 3: Run a focused route sanity check**

Run: `Select-String -Path packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx -Pattern '@sdkwork/claw-apirouter|path=\"/api-router\"'`

Expected: route imports and renders the real component

### Task 5: Register the new package in repository governance

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-sdkwork-claw-structure.mjs`
- Modify: `scripts/sdkwork-feature-bridges-contract.test.ts`
- Create: `scripts/sdkwork-apirouter-contract.test.ts`
- Modify: `scripts/sdkwork-shell-contract.test.ts`

**Step 1: Add the package to parity scripts**

Include `check:sdkwork-apirouter` in root scripts and `check:parity`.

**Step 2: Add structure and bridge awareness**

Register `packages/sdkwork-claw-apirouter` and `@sdkwork/claw-apirouter`.

**Step 3: Add feature contract coverage**

Assert:

- local implementation exists
- shell imports the real feature
- provider table contains required columns
- actions include usage, disable, edit, delete

**Step 4: Run the targeted contract scripts**

Run:

```bash
node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
```

Expected: PASS

### Task 6: Verify end-to-end integration

**Files:**
- Modify only if verification reveals issues

**Step 1: Run the focused package and contract checks**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts
node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts
pnpm --filter @sdkwork/claw-web lint
```

Expected: PASS

**Step 2: If the workspace state allows it, run the broader parity entrypoint**

Run: `pnpm check:parity`

Expected: PASS, or a documented pre-existing failure unrelated to this feature

**Step 3: Manual UX checklist**

Verify:

- sidebar click enters the API Router page
- left channel selection updates the right table
- copy API key works
- group select persists
- usage method modal opens
- disable/edit/delete mutate the row and sidebar counts
- empty state is readable

## Execution note

The user explicitly delegated design and implementation decisions and asked not to be interrupted, so execution proceeds locally in this session without pausing for plan approval.
