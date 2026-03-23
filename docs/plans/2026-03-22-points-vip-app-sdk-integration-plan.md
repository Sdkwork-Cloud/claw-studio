# Points & VIP App SDK Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Claw Studio's local mock points and subscription flows with real app-sdk-backed points reading, points recharge, and VIP plan purchase flows.

**Architecture:** Add a real points recharge contract to `spring-ai-plus-app-api`, regenerate the shared TypeScript app SDK, expose a focused shared wrapper in `@sdkwork/claw-core`, and keep `@sdkwork/claw-points` responsible only for feature presentation and UI mapping. Preserve the existing points route and header entry, but remove fake localStorage wallet state and static subscription plan logic in favor of real account/vip data.

**Tech Stack:** Spring Boot app-api controllers/tests, generated TypeScript app SDK, React 19, TanStack Query, pnpm workspace packages.

---

### Task 1: Lock The Missing Backend Contract

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\main\java\com\sdkwork\ai\gateway\api\app\v3\account\points\form\PointsRechargeForm.java`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\main\java\com\sdkwork\ai\gateway\api\app\v3\account\points\vo\PointsRechargeVO.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\main\java\com\sdkwork\ai\gateway\api\app\v3\account\points\PointsAccountAppApiController.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\test\java\com\sdkwork\ai\gateway\api\app\v3\account\points\PointsAccountAppApiControllerTest.java`

- [ ] **Step 1: Write the failing controller tests**

Add tests covering:
- successful points recharge computes cash amount from configured points-to-cash rate, adds points, and echoes payment metadata
- invalid recharge amount is rejected before account mutation
- invalid recharge request number is rejected before account mutation

- [ ] **Step 2: Run the controller test class to verify it fails**

Run: `mvn -pl spring-ai-plus-app-api -Dtest=PointsAccountAppApiControllerTest test`
Expected: FAIL because recharge form/vo/controller method do not exist yet.

- [ ] **Step 3: Implement the minimal backend contract**

Add `/app/v3/api/account/points/recharge` using:
- `accountExchangeConfigService.getPointsToCashRate()`
- `accountService.createPointsAccountIfNotExist(...)`
- `accountService.addPoints(...)`

Return a response containing request number, transaction id, points, computed amount, payment method, status, remaining points, and processed time.

- [ ] **Step 4: Run the controller test class to verify it passes**

Run: `mvn -pl spring-ai-plus-app-api -Dtest=PointsAccountAppApiControllerTest test`
Expected: PASS

### Task 2: Refresh The Shared SDK Contract

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\sdkwork-sdk-app\app-openapi-8080.json`
- Modify: generated files under `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\sdkwork-sdk-app\sdkwork-app-sdk-typescript\src`

- [ ] **Step 1: Refresh the OpenAPI snapshot from the updated app service**

Run the app-api service, then fetch:
`curl http://localhost:8080/v3/api-docs/app -o spring-ai-plus-app-api/sdkwork-sdk-app/app-openapi-8080.json`

- [ ] **Step 2: Regenerate only the TypeScript SDK**

Run:
`.\spring-ai-plus-app-api\sdkwork-sdk-app\bin\generate-sdk.ps1 -Languages typescript`

Expected: the generated SDK exposes the new `account.rechargePoints` method and types.

- [ ] **Step 3: Verify the generated SDK surface**

Run a targeted grep or read on the generated files and confirm the new recharge method/types are present.

### Task 3: Add The Shared Claw Core Wrapper

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\pointsWalletService.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\pointsWalletService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\index.ts`

- [ ] **Step 1: Write the failing wrapper tests**

Cover:
- reading points overview combines points account, points history, vip info, vip status, and available vip packs
- recharging points calls the generated account recharge method
- purchasing a vip pack calls the generated vip purchase method

- [ ] **Step 2: Run the wrapper test file to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/pointsWalletService.test.ts`
Expected: FAIL because the wrapper does not exist yet.

- [ ] **Step 3: Implement the wrapper**

Map app-sdk payloads into stable shared service types and keep all SDK invocation logic inside `@sdkwork/claw-core`.

- [ ] **Step 4: Run the wrapper test file to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/pointsWalletService.test.ts`
Expected: PASS

### Task 4: Replace The Points Feature Mock Logic

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\package.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\services\pointsService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\services\pointsService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\pages\Points.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\components\PointsHeaderEntry.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\components\PointsQuickPanel.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\components\PointsRechargeDialog.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\components\PointsUpgradeDialog.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\components\pointsCopy.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-points\src\components\PointsTransactionList.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

- [ ] **Step 1: Rewrite the feature service test first**

Change the points feature service tests to expect:
- async real-data loading instead of localStorage seed state
- recharge and vip purchase results flowing from the shared core wrapper
- mapped history records and membership data

- [ ] **Step 2: Run the feature service test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-points/src/services/pointsService.test.ts`
Expected: FAIL because the feature still uses mock local state.

- [ ] **Step 3: Implement the feature service and UI updates**

Key changes:
- depend on `@sdkwork/claw-core` instead of mock business state
- remove fake seeded balances and static plan grants
- render real vip pack names, prices, durations, and point gifts
- compute recharge prices from the backend-configured rate
- invalidate/refetch feature data after recharge or plan purchase
- handle signed-out and loading states safely

- [ ] **Step 4: Run the feature service test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-points/src/services/pointsService.test.ts`
Expected: PASS

### Task 5: Update Contract Checks And Verify End To End

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-points-contract.test.ts`
- Modify any additional contract tests only if the new dependency graph or file contents require it

- [ ] **Step 1: Update the points contract test to assert real app-sdk-backed behavior**

Replace checks that require localStorage simulation and fake pricing with checks that confirm:
- `@sdkwork/claw-core` is consumed
- async query/mutation paths exist
- recharge and vip purchase call the real service

- [ ] **Step 2: Run the targeted workspace verifications**

Run:
- `node --experimental-strip-types scripts/sdkwork-points-contract.test.ts`
- `pnpm check:sdkwork-points`
- `pnpm build`

Expected: PASS

- [ ] **Step 3: Run the backend verification**

Run:
- `mvn -pl spring-ai-plus-app-api -Dtest=PointsAccountAppApiControllerTest test`

Expected: PASS

- [ ] **Step 4: Final self-review sweep**

Read the touched backend controller, generated SDK files, core wrapper, and feature service one more time. Confirm no raw HTTP, no localStorage business state, and no generated-file hand edits outside regeneration output.
