# Step 03 Community Dashboard Node Root And Install Progress Alignment

## Scope

- Target blockers:
  - `packages/sdkwork-claw-community/src/services/communityService.test.ts`
  - `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
  - `packages/sdkwork-claw-install/src/services/hubInstallProgressService.test.ts`

## Root Cause

- `communityService.test.ts` exposed two separate issues:
  - the local captured payload variable was narrowed to `never` because TypeScript could not prove the async SDK stub callback had assigned it before the assertion site
  - more importantly, `sdkwork-claw-community` re-exported `communityService` from `@sdkwork/claw-core`, but the Node root of `@sdkwork/claw-core` did not publish `communityService.ts`, and that module still statically imported the app SDK session client at module evaluation time
- `dashboardService.test.ts` had one test-helper drift and one production root-contract gap:
  - the local `getCommerceSnapshot(query)` stub still treated `query` as always defined even though the service contract allows `undefined`
  - `dashboardService.ts` consumes `createEmptyDashboardCommerceSnapshot` and `dashboardCommerceService` from `@sdkwork/claw-core`, but the Node root did not publish `dashboardCommerceService.ts`, and that module also eagerly imported app SDK session helpers
- `hubInstallProgressService.test.ts` was still building minimalist progress events that no longer satisfied the current `HubInstallProgressEvent` contract, which now requires base `softwareName` and `operationKind` fields

## Changes

- `packages/sdkwork-claw-core/src/services/communityService.ts`
  - replaced the static `getAppSdkClientWithSession` import with a lazy dynamic import inside `defaultClientFactory()`
- `packages/sdkwork-claw-core/src/services/dashboardCommerceService.ts`
  - replaced the static app SDK session imports with lazy dynamic imports for both default client and default session token resolution
  - widened `CreateDashboardCommerceServiceOptions` so injected helpers can remain sync while default helpers resolve lazily through `Promise.resolve(...)`
- `packages/sdkwork-claw-core/src/services/node/index.ts`
  - added Node root exports for:
    - `communityService.ts`
    - `dashboardCommerceService.ts`
- `packages/sdkwork-claw-community/src/services/communityService.test.ts`
  - replaced the single captured variable with an array-backed capture and index access so the test follows current TypeScript control-flow rules without unsafe casts
- `packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
  - typed the commerce snapshot stub query as `DashboardAnalyticsQuery = {}`
- `packages/sdkwork-claw-install/src/services/hubInstallProgressService.test.ts`
  - updated live progress-event fixtures to the current infrastructure contract by including `softwareName` and `operationKind`

## Verification

- `node --experimental-strip-types packages/sdkwork-claw-community/src/services/communityService.test.ts`
  - Passed
- `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/services/dashboardService.test.ts`
  - Passed
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/dashboardCommerceService.test.ts`
  - Passed
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/hubInstallProgressService.test.ts`
  - Passed

## Architecture Writeback

- Added architecture note:
  - `docs/架构/98-2026-04-08-node-root-lazy-app-sdk-services.md`
- Reason:
  - root-exported core services that depend on browser app SDK session helpers must resolve those helpers lazily, otherwise Node-safe package consumers fail during module evaluation before explicit test or feature overrides can apply

## Remaining Frontier

- Workspace lint is now headed by install-package contract drift in:
  - `packages/sdkwork-claw-install/src/services/installBootstrapService.test.ts`
  - `packages/sdkwork-claw-install/src/services/installRecommendationService.test.ts`
