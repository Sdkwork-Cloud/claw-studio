# Desktop Startup Splash Revision Design

**Date:** 2026-03-19

**Problem**

The first desktop startup splash solved the blank-window problem, but it introduced two new product issues:

- the launch surface feels too heavy and too full-screen for a desktop bootstrap state,
- the progress and copy density make it feel stalled when startup takes longer than expected.

The user also wants the experience restyled around the lobster theme, using a single-color direction without gradients, and wants the app to stay in a normal window during startup before entering fullscreen after the main shell is ready.

## Goals

- Make the launch experience feel lighter, calmer, and harder to misread as stuck.
- Remove non-essential explanatory text.
- Use a lobster-toned monochrome visual system.
- Keep startup in a normal window.
- Enter fullscreen only after the app is ready.

## Non-Goals

- Adding a native secondary splash window.
- Keeping the previous showcase-style composition.
- Adding more startup steps or more diagnostics to the visible UI.

## Root Cause Assessment

The “easy to get stuck” feeling is primarily a UX/state coupling problem, not a single runtime crash:

- The current splash is visually complex and occupies the whole window like a destination screen.
- It shows too many labels, chips, and stage details for a transient state.
- The transition model is more elaborate than the user needs for launch confidence.

When startup is even slightly slow, the user sees a dense, theatrical screen with lots of persistent content, which reads as “frozen”.

## Options

### Option 1: Minimal full-window monochrome splash

Keep the splash as a full-window surface, but strip it down heavily.

**Pros**

- Smaller code delta.

**Cons**

- Still feels like a separate page rather than a transitional desktop state.
- Keeps the visual center of gravity too large.

### Option 2: Centered startup card in a quiet host surface

Render a restrained startup card centered inside the window, with very limited copy, a simple progress indicator, and lobster monochrome styling.

**Pros**

- Feels like an app boot state instead of a destination screen.
- Reduces perceived stuckness.
- Matches the user’s request closely.

**Cons**

- Requires reworking the startup composition rather than trimming the existing one.

### Option 3: No visible splash, only delay until shell mount

Return to an almost blank host with just a background.

**Pros**

- Minimal implementation.

**Cons**

- Reintroduces the “did it launch?” ambiguity.
- Wastes the branding opportunity entirely.

## Recommendation

Choose **Option 2**.

That gives the cleanest interpretation of the user feedback: reduce noise, reduce surface area, keep confidence, and preserve a polished desktop feel.

## Chosen Design

### Visual direction

- Use the lobster palette as the only accent family.
- No gradients.
- No multicolor glows.
- Quiet dark host backdrop with one tinted accent card.
- Rounded card, icon, product name, one short status line, one progress bar.

### Content

Keep only:

- product name,
- one short status label,
- one progress bar,
- one optional retry action on failure.

Remove:

- distribution chips,
- theme chips,
- extended explanatory paragraphs,
- detailed multi-card staging,
- decorative status notes.

### Window behavior

- App launches in the configured non-fullscreen window.
- Splash shows inside that normal window.
- After `AppRoot` is mounted and the splash begins its exit, request fullscreen on the desktop window.

### Transition behavior

- Retain a minimum visible duration, but shorten the handoff model to reduce perceived waiting.
- Mount shell as soon as bootstrap is ready.
- Fade out the splash quickly.
- Request fullscreen once the shell is mounted and the splash is no longer the user’s focal surface.

### Error behavior

- Keep the splash card visible.
- Show only a short error title, the error message, and retry.

## Testing Strategy

- Update the startup presentation unit test to match the simplified copy and progress expectations.
- Add a focused pure helper test for fullscreen handoff decision logic if needed.
- Run the startup presentation test directly.
- Run desktop package lint.
- Run desktop build.
