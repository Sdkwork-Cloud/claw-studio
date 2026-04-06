# Shadcn Form Unification Design

**Date:** 2026-03-18

**Goal**

Unify all tracked and newly added form-like controls in Claw Studio onto a shared `@sdkwork/claw-ui` primitive layer based on shadcn-style components, so that dialogs, inputs, selects, textareas, toggles, checkboxes, and sliders share consistent spacing, focus behavior, accessibility, and dark-mode treatment.

## Scope

- Add shared shadcn-style primitives to `packages/sdkwork-claw-ui`.
- Reimplement the legacy `Modal` on top of the new dialog primitives without breaking its current API.
- Replace raw `<input>`, `<select>`, `<textarea>`, checkbox toggles, slider-like range controls, and custom modal shells across feature packages with shared UI primitives.
- Sweep both tracked packages and currently untracked feature workspaces that already contain user-facing forms.

## Chosen Approach

### Option A: Patch each page with local Tailwind classes only

Fastest short-term, but keeps the codebase fragmented and guarantees more regressions later.

### Option B: Add shared shadcn-style primitives, then migrate all pages

This is the recommended approach. It centralizes visual language, improves accessibility, lets existing feature packages keep importing from package roots, and makes future work cheaper.

### Option C: Full `react-hook-form` rewrite for every form

This would over-expand scope and add risk without clear product value for many simple forms and filter bars.

## Architecture

- `@sdkwork/claw-ui` will own the reusable primitive layer:
  - `Button`
  - `Input`
  - `Textarea`
  - `Label`
  - `Select`
  - `Dialog`
  - `Checkbox`
  - `Switch`
  - `Slider`
- Existing `Modal` remains part of the public API, but its internals move to the new dialog foundation.
- Feature packages continue consuming UI only from `@sdkwork/claw-ui` package root.

## Migration Rules

- Visible raw text-like controls move to `Input` or `Textarea`.
- Native `<select>` dropdowns move to `Select`.
- Boolean toggles use `Switch` or `Checkbox` depending on the interaction pattern.
- `input[type="range"]` moves to `Slider`.
- Manual overlay shells for create/install/config dialogs move to shared dialog primitives.
- Hidden file inputs may remain native when browser behavior requires it, but any visible trigger or surrounding field chrome should use shared UI components.

## Visual Direction

- Keep the repo's existing zinc plus theme-primary palette.
- Standardize focus rings, borders, radius, disabled states, and panel spacing.
- Preserve feature-specific layouts where they are intentional, but remove ad hoc control styling drift.

## Risk Management

- Preserve current state shape and submission logic to avoid behavior regressions.
- Avoid package-internal imports across workspace boundaries.
- Keep the old `Modal` signature stable so dependent packages do not need invasive call-site changes.

## Verification Plan

- Add/expand a UI contract test that requires the new primitive files and exports.
- Run the UI contract test before implementation to confirm it fails.
- After migration, run the contract test again, then run workspace verification commands and do a final grep sweep for leftover raw controls.
