# API Router Model Mapping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a polished `Model Mapping` tab to API Router, support multi-rule model mappings, and allow each unified API key to associate with one model mapping.

**Architecture:** Extend the existing `sdkwork-claw-apirouter` feature package with a new manager/table/dialog flow, add shared domain types in `@sdkwork/claw-types`, and extend `studioMockService` plus API Router services so UI state stays service-first and mock-backed.

**Tech Stack:** React 19, TypeScript, TanStack Query, Sonner, Tailwind, workspace mock services, i18next

---

### Task 1: Add shared model mapping types

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`

**Step 1: Write the failing test expectation**

Use a consumer test that expects:

```ts
import type { ModelMapping, ModelMappingCreate } from '@sdkwork/claw-types';
```

**Step 2: Run a quick verification that the symbols do not exist yet**

Run: `Select-String -Path packages/sdkwork-claw-types/src/index.ts -Pattern 'ModelMapping|modelMappingId'`

Expected: no relevant matches

**Step 3: Add the minimal shared types**

Include:

- `ModelMappingStatus`
- `ModelMappingModelRef`
- `ModelMappingRule`
- `ModelMapping`
- `ModelMappingCreate`
- `ModelMappingUpdate`
- `modelMappingId` on `UnifiedApiKey`

**Step 4: Re-run the verification**

Run: `Select-String -Path packages/sdkwork-claw-types/src/index.ts -Pattern 'ModelMapping|modelMappingId'`

Expected: matches for the new symbols

### Task 2: Add failing mock-backend tests for mapping CRUD and association

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

**Step 1: Write failing tests**

Cover:

```ts
await service.listModelMappings();
await service.createModelMapping(...);
await service.updateModelMapping(...);
await service.updateModelMappingStatus(...);
await service.assignUnifiedApiKeyModelMapping(...);
await service.deleteModelMapping(...);
```

**Step 2: Run the targeted test**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

Expected: FAIL because the methods do not exist yet

### Task 3: Implement mock backend support

**Files:**
- Modify: `packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts`

**Step 1: Add seed data and clone helpers**

Create seeded mappings and rule snapshots.

**Step 2: Add CRUD and association methods**

Implement:

- list
- create
- update
- status update
- delete
- unified key association update

**Step 3: Add model catalog derivation**

Expose model selection data derived from proxy providers.

**Step 4: Re-run the infrastructure tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts`

Expected: PASS

### Task 4: Add failing API Router service tests

**Files:**
- Add: `packages/sdkwork-claw-apirouter/src/services/modelMappingService.test.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts`

**Step 1: Write failing tests for model mapping service**

Cover:

- listing and keyword filtering
- creating a mapping
- updating a mapping
- toggling status
- deleting a mapping
- deriving channel/model options

**Step 2: Extend unified key service tests**

Add an expectation for:

```ts
await unifiedApiKeyService.assignModelMapping(keyId, mappingId);
```

**Step 3: Run targeted service tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/modelMappingService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts
```

Expected: FAIL

### Task 5: Implement service and form helpers

**Files:**
- Add: `packages/sdkwork-claw-apirouter/src/services/modelMappingService.ts`
- Add: `packages/sdkwork-claw-apirouter/src/services/modelMappingFormService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/index.ts`

**Step 1: Implement service methods**

Add model mapping list and mutation methods.

**Step 2: Implement form normalization**

Handle:

- required fields
- date-range validation
- duplicate-source detection
- incomplete-rule filtering

**Step 3: Extend unified key service**

Add the single-association mutation method.

**Step 4: Re-run targeted service tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/modelMappingService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts
```

Expected: PASS

### Task 6: Build the Model Mapping UI

**Files:**
- Add: `packages/sdkwork-claw-apirouter/src/components/ModelMappingManager.tsx`
- Add: `packages/sdkwork-claw-apirouter/src/components/ModelMappingTable.tsx`
- Add: `packages/sdkwork-claw-apirouter/src/components/ModelMappingDialogs.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/index.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx`

**Step 1: Add the new tab**

Render `ModelMappingManager` as the third panel.

**Step 2: Build the manager toolbar and query flow**

Include:

- new action
- refresh action
- search

**Step 3: Build table and dialogs**

Support:

- list view
- detail view
- create/edit form
- source/target selection dialog
- status toggle
- delete

**Step 4: Keep the UI visually aligned with the current API Router feature**

Reuse existing card, spacing, and table patterns.

### Task 7: Extend Unified API Key association UX

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyManager.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyTable.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx`

**Step 1: Surface current associated mapping**

Show a compact mapping hint in the unified key row.

**Step 2: Add association action**

Add `Associate Mapping` to the row action group.

**Step 3: Implement association dialog**

Support:

- search
- current selection
- clear association
- confirm save

### Task 8: Localize new UI copy

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Add model mapping copy**

Include:

- page tab
- table labels
- dialogs
- field labels
- toasts
- association labels

**Step 2: Keep naming consistent with existing API Router terminology**

### Task 9: Verify implementation

**Files:**
- Modify only if verification reveals issues

**Step 1: Run focused service tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/modelMappingService.test.ts
```

Expected: PASS

**Step 2: Run package and workspace checks**

Run:

```bash
pnpm --filter @sdkwork/claw-web lint
pnpm build
```

Expected: PASS, or a clearly documented unrelated failure

**Step 3: Manual review checklist**

Verify:

- the new tab renders
- model mapping CRUD works
- source/target selector works by channel
- mapping rule replacement and deletion work
- unified key association works as single-select
- empty states and disabled states read well

## Execution Note

The user explicitly asked for autonomous execution without further questions, so implementation proceeds directly after the plan is written.
