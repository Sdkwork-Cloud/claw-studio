# Auth Sidebar User Design

## Context

The current shell exposes a single `/auth` route and uses local component state inside `sdkwork-claw-auth` to switch between login, register, and forgot-password flows. That creates three problems:

1. URLs do not describe the current auth state, so redirects and deep links are weak.
2. The sidebar footer still uses a direct text-based settings entry instead of a user-centric control.
3. The application has no shared auth state, so "sign out" actions cannot consistently decide whether to log out or redirect to login.

The user asked for the lower sidebar settings entry to become an icon-style user entry, to add user information behavior, and to make sign-out redirect to login when the user is already signed out. They also explicitly clarified that auth paths must be split into distinct login, register, and forgot-password routes.

## Options Considered

### Option A: Keep `/auth` and continue switching modes in component state

Pros:
- Smallest code change
- Keeps route surface almost unchanged

Cons:
- Fails the user's requirement for distinct paths
- Makes redirect and restore behavior awkward
- Still couples auth UX to local page state

### Option B: Add `/login`, `/register`, and `/forgot-password` while keeping `/auth` as a compatibility redirect

Pros:
- Meets the user's route requirement
- Preserves backward compatibility for any stale `/auth` links
- Lets one auth page implementation handle all modes through the router
- Makes unauthenticated redirects and post-login restore straightforward

Cons:
- Requires route contract updates
- Touches shell, auth, core store, and i18n together

### Option C: Add nested `/auth/login`, `/auth/register`, and `/auth/forgot-password`

Pros:
- Namespaces auth routes cleanly
- Still supports route-based mode selection

Cons:
- More verbose URLs with no clear product benefit here
- Adds extra path depth to every redirect target

## Decision

Choose Option B.

The shell should own distinct `/login`, `/register`, and `/forgot-password` routes, while `/auth` should remain as a redirect to `/login` so the current route surface evolves safely. The auth page should derive mode from the route, not from mutable local page state.

## Product Design

### Auth Routing

- `/login` renders the sign-in form
- `/register` renders the registration form
- `/forgot-password` renders the password-reset form
- `/auth` redirects to `/login`

The auth page should support a `redirect` query parameter so user-triggered login flows can return to the page the user originally wanted.

### Sidebar Footer

Replace the current lower `Settings` text nav item with a user control:

- Collapsed sidebar: a circular avatar-style icon button
- Expanded sidebar: a compact user card with avatar, display name, and secondary text

Click behavior:

- Authenticated user: opens a popover with profile summary, settings entry, and sign-out action
- Unauthenticated user: navigates directly to `/login`

### User Information Behavior

Introduce a shared persisted auth store in `sdkwork-claw-core`.

State should include:

- `isAuthenticated`
- `user`
- async `signIn`
- async `register`
- async `signOut`

The mock implementation can hydrate from the existing mock profile service so the UI has consistent display data without inventing a second fake backend.

### Sign-Out Rules

- If authenticated: clear auth state and navigate to `/login`
- If unauthenticated: do not fail silently; navigate to `/login`

This rule should apply both from the sidebar user menu and from account settings.

### Settings Access

The new user menu should still expose settings access, but through a user-centric action. Instead of adding a new route, navigate to `/settings?tab=account` so the current route surface stays stable and the settings page can open the profile tab directly.

## Architecture

### Package Boundaries

Keep dependency flow aligned with the repository guide:

- `sdkwork-claw-core` owns auth state and mock-backed auth actions
- `sdkwork-claw-auth` owns auth page rendering and route-derived form mode
- `sdkwork-claw-shell` owns route wiring, sidebar chrome, and redirects
- `sdkwork-claw-settings` adapts account settings to the shared auth state

### Shared State

The auth store should live in `sdkwork-claw-core/src/stores`, be exported from the package root, and be consumed from package roots only.

### Route Contracts

Because the repository validates shell routes against `upgrade/claw-studio-v5`, the V5 reference route file and contract assertions must be updated together with the shell route changes.

## Testing Strategy

Before implementation:

1. Tighten route and shell contracts to require distinct auth paths and the sidebar user control.
2. Add a focused core-store test for sign-in/sign-out behavior.
3. Run those tests and confirm they fail first.

After implementation:

1. Re-run the focused auth store test.
2. Re-run `sdkwork-shell`, `sdkwork-auth`, and `v5` contract tests.
3. Run `pnpm lint` and `pnpm build`.

## Success Criteria

This work is successful when:

- the app exposes `/login`, `/register`, and `/forgot-password`
- `/auth` safely redirects to `/login`
- the sidebar footer uses an icon-style user entry instead of a plain settings link
- authenticated users can see profile details and sign out from the sidebar
- unauthenticated sign-out attempts route cleanly to the login page
- account settings and auth state stay consistent enough for a coherent mock experience
