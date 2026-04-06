# Auth Sidebar User Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split auth into distinct login/register/forgot-password routes, replace the sidebar footer settings entry with a user-centric icon control, and wire sign-out/login behavior through a shared auth state.

**Architecture:** Add a persisted auth store in `sdkwork-claw-core`, route auth modes through shell paths instead of page-local mode state, and replace the shell footer settings nav item with a user control that opens settings or signs out based on shared auth state.

**Tech Stack:** React 19, TypeScript, Zustand persist, React Router 7, i18next, Lucide React, Node assert-based contract tests.

---

### Task 1: Lock the new route and sidebar expectations with failing tests

**Files:**
- Modify: `scripts/sdkwork-shell-contract.test.ts`
- Modify: `scripts/v5-product-contract.test.ts`
- Create: `packages/sdkwork-claw-core/src/stores/useAuthStore.test.ts`

**Step 1: Write the failing test**

- Require the shell contract to look for `/login`, `/register`, `/forgot-password`, and a user control marker in the sidebar source.
- Require the V5 route contract to look for the distinct auth routes instead of a single `/auth` route.
- Add a core auth-store test that expects persisted sign-in/sign-out behavior.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
Expected: FAIL because the shell still only exposes `/auth` and has no user control.

Run: `node --experimental-strip-types scripts/v5-product-contract.test.ts`
Expected: FAIL because the V5 reference still expects `/auth`.

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/stores/useAuthStore.test.ts`
Expected: FAIL because the store does not exist yet.

**Step 3: Write minimal implementation**

- None yet. This task stops after confirming the current code fails the new tests.

**Step 4: Commit**

- Skip committing in this session.

### Task 2: Add the shared auth store

**Files:**
- Create: `packages/sdkwork-claw-core/src/stores/useAuthStore.ts`
- Modify: `packages/sdkwork-claw-core/src/store/index.ts`
- Modify: `packages/sdkwork-claw-core/src/index.ts`
- Modify: `packages/sdkwork-claw-core/src/stores/useAuthStore.test.ts`

**Step 1: Write the failing test**

- Extend the store test to assert `signIn`, `register`, `signOut`, and derived display fields.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/stores/useAuthStore.test.ts`
Expected: FAIL because the store API is missing.

**Step 3: Write minimal implementation**

- Create a persisted auth store backed by the mock profile service.
- Export the store from the core package root.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/stores/useAuthStore.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 3: Move auth modes from local state to router paths

**Files:**
- Modify: `packages/sdkwork-claw-auth/package.json`
- Modify: `packages/sdkwork-claw-auth/src/pages/AuthPage.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/router/routePaths.ts`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx`
- Modify: `upgrade/claw-studio-v5/src/App.tsx`

**Step 1: Write the failing test**

- Use the shell and V5 route contracts as the red step.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
Expected: FAIL because auth routes are not split yet.

Run: `node --experimental-strip-types scripts/v5-product-contract.test.ts`
Expected: FAIL because the V5 route reference is stale.

**Step 3: Write minimal implementation**

- Add `/login`, `/register`, `/forgot-password`, and `/auth -> /login`.
- Make `AuthPage` derive mode from the current route and redirect authenticated users away from auth screens.
- Preserve redirect-query behavior for login-origin flows.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
Expected: PASS

Run: `node --experimental-strip-types scripts/v5-product-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 4: Replace the footer settings link with a user control

**Files:**
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-settings/src/Settings.tsx`
- Modify: `packages/sdkwork-claw-settings/src/AccountSettings.tsx`

**Step 1: Write the failing test**

- Tighten the shell contract to look for user-control data markers and distinct auth routes.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
Expected: FAIL against the current sidebar footer.

**Step 3: Write minimal implementation**

- Replace the settings footer nav item with an avatar/user button and popover.
- Show user summary when authenticated.
- Send unauthenticated user clicks to `/login`.
- Route settings access to `/settings?tab=account`.
- Make account settings sign-out use the same auth behavior.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-shell-contract.test.ts`
Expected: PASS

**Step 5: Commit**

- Skip committing in this session.

### Task 5: Add the localized copy and run full verification

**Files:**
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Rely on TypeScript/build verification and the auth contract to expose missing keys.

**Step 2: Run test to verify it fails**

Run: `pnpm check:sdkwork-auth`
Expected: FAIL or remain red until the new copy is wired correctly.

**Step 3: Write minimal implementation**

- Add labels for user menu actions, auth-route-specific hints, signed-in state, and login CTA copy.

**Step 4: Run test to verify it passes**

Run: `pnpm check:sdkwork-auth`
Expected: PASS

**Step 5: Run broader verification**

Run: `pnpm check:sdkwork-shell`
Expected: PASS

Run: `pnpm check:v5`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS, unless blocked by unrelated pre-existing workspace issues.

**Step 6: Report status**

- Summarize exact verification results.
- Call out unrelated failures separately if they appear.
