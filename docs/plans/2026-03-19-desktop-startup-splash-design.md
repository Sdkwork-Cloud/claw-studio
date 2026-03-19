# Desktop Startup Splash Design

**Date:** 2026-03-19

**Problem**

The desktop app currently waits for runtime bootstrapping before rendering the main React tree. During that gap, the user experience is effectively a blank handoff into the full shell, which feels abrupt for a desktop product and exposes theme or language mismatch during first paint.

**Goals**

- Add a polished desktop startup experience that appears immediately when the desktop host launches.
- Eliminate the abrupt jump from blank window to full shell.
- Make the first frame feel branded, intentional, and consistent with the app's desktop identity.
- Respect the user's last-known theme and language as early as possible.
- Keep the solution inside the desktop host so routing and feature packages remain untouched.

**Non-Goals**

- Building a separate native Tauri splash window.
- Adding startup telemetry or analytics.
- Turning the launch screen into a long-running loading dashboard.

## Current Context

- Desktop bootstrap lives in `packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx`.
- The shell runtime only needs `bootstrapShellRuntime()` before `AppRoot` can render.
- Shell styling is already loaded through `@sdkwork/claw-shell`, so the desktop host can safely use Tailwind classes for a pre-shell launch screen.
- The current app window is undecorated, so the startup screen must feel complete as a full-surface first impression.

## Approaches

### Option 1: Native Tauri splash window

Use a dedicated splash window in Tauri, hide the main window until the frontend is ready, then close the splash and reveal the main shell.

**Pros**

- Best possible protection against white flashes before the webview paints.
- Feels the most native.

**Cons**

- Requires Tauri config and runtime coordination across Rust and frontend.
- Higher risk in an already active desktop codepath.
- More moving parts for a visual enhancement.

### Option 2: React-managed startup shell in the desktop host

Render a startup container immediately in the existing desktop root, bootstrap the shell runtime in the background, then crossfade into `AppRoot` once the runtime is ready and a minimum visible duration has passed.

**Pros**

- Solves the user-facing problem without invasive Tauri changes.
- Easy to style richly and keep aligned with the brand.
- Lets us add theme, language, and error handling polish in one place.

**Cons**

- Still depends on the existing main window loading the web app.
- Cannot fully prevent the earliest possible browser-level blank before HTML/CSS arrive.

### Option 3: Static HTML fallback only

Add a styled placeholder directly in `index.html`, then let the app replace it once React starts.

**Pros**

- Very simple and very fast to show.

**Cons**

- Hard to keep synchronized with runtime state.
- Limited animation and transition control.
- No graceful error or handoff behavior.

## Recommendation

Choose **Option 2**, with a small amount of `index.html` background polish.

This gives the best balance of impact, maintainability, and delivery confidence. It produces a launch experience that feels purpose-built for the desktop product while keeping all logic in the desktop host, which matches the repository boundary rules.

## Chosen Design

### 1. Desktop bootstrap becomes a two-phase experience

`createDesktopApp()` will render a dedicated desktop bootstrap component immediately instead of waiting to mount until after `bootstrapShellRuntime()` finishes.

That component will:

- configure the desktop platform bridge before any runtime work,
- apply startup appearance hints from persisted local state,
- show the launch screen while bootstrapping,
- render `AppRoot` only after the runtime is ready,
- keep the launch screen visible long enough to feel intentional,
- fade the launch screen away once the app is ready to be seen.

### 2. Startup appearance is resolved before the shell managers run

The desktop host will parse the persisted Zustand snapshot in local storage to recover:

- theme mode,
- theme accent,
- preferred language.

Those values will be used only for startup presentation. The source of truth remains the normal stores and managers inside the shell. This avoids first-paint mismatch while preserving current architecture.

### 3. Launch screen content

The screen will be a full-surface branded composition with:

- the app icon rendered as a hero badge,
- the product name and a short positioning line,
- a compact multi-step startup rail,
- subtle animated gradients and pulse effects,
- distribution and runtime chips for desktop context,
- a footer hint that communicates readiness without overwhelming the user.

The tone will be brand-first, but it will still expose short status text so the screen feels alive rather than decorative only.

### 4. Error state

If desktop bootstrap fails, the startup shell will remain visible and switch into a recoverable error state with:

- a concise failure title,
- the captured error message,
- a retry action.

This is a direct improvement over a silent failed launch.

### 5. Minimal static entry polish

`packages/sdkwork-claw-desktop/index.html` will receive a dark inline background baseline so the window never opens onto a plain white surface before React takes over.

## Data Flow

1. Browser loads desktop HTML with a branded background baseline.
2. `createDesktopApp()` mounts the desktop bootstrap component immediately.
3. The bootstrap component applies startup theme and language hints from local storage.
4. The launch screen appears with animated status stages.
5. `bootstrapShellRuntime()` runs in the background.
6. After runtime readiness and minimum display timing are satisfied, `AppRoot` mounts.
7. The launch screen fades out, revealing the main shell.

## Testing Strategy

- Add a focused pure-function test for startup presentation logic:
  - persisted snapshot parsing,
  - language fallback,
  - theme resolution,
  - progress/stage mapping.
- Run the new focused test directly.
- Run desktop package TypeScript lint.
- Run the desktop build to confirm startup assets and component wiring compile cleanly.

## Risks And Mitigations

- **Risk:** startup screen theme diverges from final shell theme.
  - **Mitigation:** reuse the same persisted state fields and DOM attributes used by the shell.
- **Risk:** launch screen disappears too quickly on fast machines.
  - **Mitigation:** enforce a minimum visible duration.
- **Risk:** launch screen lingers too long after readiness.
  - **Mitigation:** use a short controlled exit transition and mount the shell before fade-out completes.
- **Risk:** bootstrap failure leaves the app blank.
  - **Mitigation:** keep the startup shell mounted and show a retryable error state.

## Approval Note

The user explicitly asked for autonomous decision-making and instructed me not to pause for questions, so this design is treated as approved for implementation.
