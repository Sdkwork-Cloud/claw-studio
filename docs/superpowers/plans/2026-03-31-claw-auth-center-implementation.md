# Claw Auth Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-grade Claw Studio auth center with account/password, phone-code, email-code, QR, and configurable OAuth flows, plus improved register and forgot-password flows.

**Architecture:** Close the missing email-code login contract in app-api/business-service first, then extend the generated-sdk-backed auth service/store, then refactor the auth UI into focused components that compose the final page. Keep remote-business logic on the generated SDK path and local page orchestration inside `sdkwork-claw-auth`.

**Tech Stack:** Java Spring app-api + business service, generated app SDK, TypeScript, React, Zustand, i18next, Tauri/web shared frontend

---

### Task 1: Lock failing backend and frontend auth tests

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\test\java\com\sdkwork\ai\gateway\api\app\v3\auth\AuthAppApiControllerTest.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\appAuthService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\stores\useAuthStore.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-auth-contract.test.ts`

- [ ] **Step 1: Write failing controller/service/store/auth-contract tests**
- [ ] **Step 2: Run the targeted backend and frontend tests to verify they fail for missing email-code login and missing page/component structure**
- [ ] **Step 3: Keep the failure output as the implementation target for the next tasks**

### Task 2: Add backend email verification-code login contract

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\main\java\com\sdkwork\ai\gateway\api\app\v3\auth\form\EmailLoginForm.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\main\java\com\sdkwork\ai\gateway\api\app\v3\auth\AuthAppApiController.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-app-api\src\main\java\com\sdkwork\ai\gateway\api\app\v3\auth\converter\AuthConverter.java`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-business-service\src\main\java\com\sdkwork\spring\ai\plus\dto\auth\EmailLoginDTO.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-business-service\src\main\java\com\sdkwork\spring\ai\plus\service\auth\PlusAuthenticationService.java`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\spring-ai-plus-business-service\src\main\java\com\sdkwork\spring\ai\plus\service\auth\impl\PlusAuthenticationServiceImpl.java`

- [ ] **Step 1: Add the minimal DTO/form/converter surface required by the failing tests**
- [ ] **Step 2: Implement `emailLogin` by reusing the existing verification-code validation path**
- [ ] **Step 3: Keep behavior strict: existing email user required, no implicit registration**
- [ ] **Step 4: Run the targeted backend test again and verify it passes**

### Task 3: Refresh app SDK-facing frontend auth service behavior

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\appAuthService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\appAuthService.test.ts`

- [ ] **Step 1: Extend auth service types with phone login, email login, password reset confirm, and provider config support**
- [ ] **Step 2: Implement the minimal generated-client calls needed to satisfy the tests**
- [ ] **Step 3: Verify the targeted auth service tests pass**

### Task 4: Expand auth store actions around session and recovery flows

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\stores\useAuthStore.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\stores\useAuthStore.test.ts`

- [ ] **Step 1: Add store actions for account login, phone-code login, email-code login, request-reset, reset-password confirm, and registration with verification context**
- [ ] **Step 2: Keep session application and sign-out behavior stable**
- [ ] **Step 3: Run store tests and verify they pass**

### Task 5: Refactor auth page into focused components

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-auth\src\components\auth\*.tsx`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-auth\src\components\auth\*.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-auth\src\pages\AuthPage.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-auth\src\pages\AuthOAuthCallbackPage.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-auth\src\index.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-auth-contract.test.ts`

- [ ] **Step 1: Add failing auth contract assertions for componentized files and config-driven OAuth**
- [ ] **Step 2: Extract QR panel and OAuth provider grid**
- [ ] **Step 3: Extract login method tabs and the three login forms**
- [ ] **Step 4: Extract registration and forgot-password flows**
- [ ] **Step 5: Reduce `AuthPage.tsx` to route composition and state wiring**
- [ ] **Step 6: Run the auth contract test and verify it passes**

### Task 6: Add i18n coverage and final verification

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\zh.json`

- [ ] **Step 1: Add the copy required by the new login, registration, recovery, QR, and OAuth states**
- [ ] **Step 2: Run targeted auth tests**
- [ ] **Step 3: Run `pnpm check:sdkwork-auth`**
- [ ] **Step 4: Run `pnpm lint` if auth changes do not reveal unrelated repo failures**
- [ ] **Step 5: Review changed files for boundary compliance and polish**
