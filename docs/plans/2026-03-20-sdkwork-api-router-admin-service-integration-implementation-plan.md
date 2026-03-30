# SDKWork API Router Admin Service Integration Implementation Plan

## Objective

Execute the next integration batch that turns `sdkwork-claw-apirouter` into a real router-backed feature without breaking unfinished UI slices.

## Batch 1 Scope

Deliver these outcomes in this batch:

1. add a router admin session and runtime-aware admin client in infrastructure
2. define tests for real usage data loading and admin request resolution
3. switch API Router usage reads from mock-first to router-first with safe fallback
4. document the remaining domain mismatches and next-phase upstream changes

## Task 1: Add router admin session and base URL resolution

Files:

- `packages/sdkwork-claw-infrastructure/src/auth/apiRouterAdminSession.ts`
- `packages/sdkwork-claw-infrastructure/src/services/sdkworkApiRouterAdminClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/index.ts`
- `packages/sdkwork-claw-infrastructure/src/index.ts`
- `packages/sdkwork-claw-infrastructure/src/config/env.ts`

Steps:

1. Add a dedicated admin session storage helper for router JWT state.
2. Add a dedicated admin client with:
   - `login`
   - `getMe`
   - `listApiKeys`
   - `listUsageRecords`
   - `getUsageSummary`
3. Resolve the admin base URL from explicit override, env override, runtime bridge status, then same-origin fallback.
4. Keep router auth independent from the main Claw auth session.

Expected outcome:

- frontend code has a standard router-native service entry point
- router admin auth and base URL are no longer inferred ad hoc

## Task 2: Write and run failing tests first

Files:

- `packages/sdkwork-claw-infrastructure/src/services/sdkworkApiRouterAdminClient.test.ts`
- `packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts`

Steps:

1. Add a test that proves the admin client uses runtime-derived admin base URLs and router admin bearer tokens.
2. Add a test that proves usage records from the router are adapted into the current feature model.
3. Add a test that proves usage summary is derived honestly from router usage records.
4. Run the tests and confirm failure before production edits.

Commands:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/sdkworkApiRouterAdminClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
```

Expected outcome:

- production work is pinned to explicit behavior instead of guesswork

## Task 3: Implement router-first usage service integration

Files:

- `packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts`

Steps:

1. Keep unfinished provider CRUD methods on the existing fallback path.
2. Replace:
   - `getUsageRecordApiKeys`
   - `getUsageRecordSummary`
   - `getUsageRecords`
   with router-first implementations.
3. Adapt upstream usage records into the current UI view model.
4. Compute client-side filtering, sorting, and pagination for the current UI contract.
5. Fall back to mock data when router auth or router reachability is unavailable.

Expected outcome:

- usage pages can consume real router data now
- unfinished slices continue working while migration continues

## Task 4: Verify the touched integration batch

Commands:

```bash
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/sdkworkApiRouterAdminClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/apiRouterService.test.ts
pnpm exec tsc --noEmit -p packages/sdkwork-claw-apirouter/tsconfig.json
pnpm exec tsc --noEmit -p packages/sdkwork-claw-infrastructure/tsconfig.json
node scripts/sdkwork-apirouter-contract.test.ts
```

Expected outcome:

- touched packages type-check
- contract checks stay green
- the real usage integration path is validated

## Known Follow-up After Batch 1

### Follow-up A: Access and tenant slice

Implement a router-native `unifiedApiKeyService` replacement around:

- `/admin/tenants`
- `/admin/projects`
- `/admin/api-keys`

Product correction to include:

- one-time plaintext reveal on create
- hashed-key identity in list views
- tenant/project-native grouping

### Follow-up B: Provider and credential slice

Split current provider UI semantics into:

- provider catalog
- credential management
- runtime health

### Follow-up C: Usage parity upstream enhancement

Patch `sdkwork-api-router` to persist richer request facts so the usage UI can show:

- api key identity
- endpoint
- request type
- reasoning effort
- cached tokens
- ttft
- duration
- user agent

## Handoff

After this batch is green, continue with:

1. access and multi-tenant API key migration
2. provider catalog and credential migration
3. upstream usage-schema enhancement for full UI parity
