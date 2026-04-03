# Claw Studio Auth Center Design

**Context**

Claw Studio currently mixes password login, registration, forgot-password request, QR login, and OAuth launch logic in a single page. The current implementation is missing phone verification-code login, email verification-code login, reset-password confirmation, and a componentized flow model that can scale without turning `AuthPage.tsx` into an orchestration file.

The target is a desktop-grade auth center that keeps QR login and OAuth login, adds three primary credential modes, improves registration and password recovery, and keeps the remote-business path on the generated app SDK contract.

## Goals

- Support three first-class login methods:
  - account/password
  - phone + verification code
  - email + verification code
- Preserve QR login and make it a focused reusable panel inside the app auth package.
- Preserve OAuth login and make provider exposure configuration-driven, with defaults for `wechat`, `douyin`, `github`, and `google`.
- Split register and forgot-password into clearer multi-step flows with verification-code challenge handling.
- Keep auth state concerns in `sdkwork-claw-core` and UI orchestration in `sdkwork-claw-auth`.
- Close any missing backend/app-sdk contract before using it in the app.

## Non-Goals

- No cross-application shared auth package in this round.
- No database schema changes.
- No raw HTTP fallback or app-local API fork for auth.

## Architecture

The auth system will be split into three layers.

1. `spring-ai-plus-app-api` + business service:
Expose the missing email verification-code login contract by mirroring the existing phone-code login flow and reusing the existing verification-code infrastructure. This keeps the auth capability official and generator-backed.

2. `sdkwork-claw-core`:
Expand `appAuthService` and `useAuthStore` so they model auth capabilities rather than page details. This layer owns login, verification-code send/check, password reset challenge/confirm, OAuth session completion, QR session application, and provider config normalization.

3. `sdkwork-claw-auth`:
Refactor the auth page into focused components:
- auth shell layout
- login method switcher
- account/password form
- phone-code form
- email-code form
- registration flow
- forgot-password flow
- QR panel
- OAuth provider grid

`AuthPage.tsx` becomes a route-level composition entry, not the implementation surface for every flow.

## UI / Product Design

The login experience remains a two-column desktop auth center:

- Left column:
  - QR login panel
  - QR status copy
  - refresh affordance
  - app scan guidance
- Right column:
  - headline, supporting text
  - login tabs for account, phone code, email code
  - contextual secondary actions
  - OAuth provider section
  - route transitions for register and forgot-password

Registration becomes a verification-aware flow:
- choose primary account identity
- collect account basics
- send and validate verification code for phone/email when present
- confirm password
- auto-login on success

Forgot-password becomes a two-step recovery flow:
- step 1: request reset challenge by account type
- step 2: submit account + code + new password + confirm password

OAuth remains below the primary login methods. QR and OAuth are additive paths, not replacements for core auth.

## Configuration Design

OAuth providers are exposed through auth-page config rather than hard-coded rendering. Default enabled providers:
- `wechat`
- `douyin`
- `github`
- `google`

The config object also carries labels, badges, and future provider extension hooks. The service layer still validates supported providers against real backend contract mapping.

QR login is extracted into a local reusable component with injected dependencies:
- generate QR payload
- poll QR status
- apply confirmed session
- refresh / auto-reload policy

This makes QR behavior reusable inside the current app without introducing a new workspace package yet.

## Backend Contract Design

Existing contract coverage already supports:
- password login
- phone verification-code login
- verification code send/check
- password reset request
- password reset confirm
- QR login
- OAuth URL / OAuth login

Missing contract:
- email verification-code login

The cleanest addition is an `email/login` endpoint in app-api plus a matching business-service method and DTO. The method mirrors `phoneLogin`, but uses `verifyType=EMAIL`, validates the email code through the existing verification service, and signs in the existing user located by email. Unlike phone login, it should not silently auto-register a new email user because email ownership is stronger and registration should remain explicit.

## Error Handling

- Unsupported or disabled OAuth providers fail early in the frontend config layer.
- Missing or invalid verification code yields form-level error copy.
- Password reset confirm validates password confirmation on the client before request submission.
- QR polling stops on confirmed, expired, or error terminal states.
- Email-code login fails explicitly when the email account does not exist.

## Testing Strategy

- App-api/controller tests for the new email-code login mapping and delegation.
- Business-service tests for the email-code login behavior if coverage exists nearby; otherwise controller-path tests plus app tests.
- `appAuthService.test.ts` for phone login, email login, reset password confirm, and configurable OAuth provider mapping.
- `useAuthStore.test.ts` for account login, phone login, email login, register, forgot-password request, and reset-password confirm.
- `sdkwork-auth-contract.test.ts` updated to enforce the new componentized auth surface instead of a single monolithic page assumption.

## File Boundary Changes

- `packages/sdkwork-claw-core/src/services/appAuthService.ts`
  - add phone login, email login, password reset confirm, provider normalization
- `packages/sdkwork-claw-core/src/stores/useAuthStore.ts`
  - add login methods and password recovery helpers while keeping session responsibilities focused
- `packages/sdkwork-claw-auth/src/components/*`
  - new focused auth components
- `packages/sdkwork-claw-auth/src/pages/AuthPage.tsx`
  - reduced to route composition
- `packages/sdkwork-claw-i18n/src/locales/*.json`
  - new auth labels and error copy
- `spring-ai-plus-app-api/.../auth/*`
  - add email login form and controller method
- `spring-ai-plus-business-service/.../auth/*`
  - add email login DTO + service implementation

## Acceptance Criteria

- Login page offers account/password, phone code, email code, QR, and configurable OAuth.
- Register and forgot-password flows are clearer and complete their full business action.
- Auth service/store no longer force the UI into email-only assumptions.
- No raw HTTP or app-local contract workaround is introduced.
- Tests cover the new auth capabilities and pass.
