# Global I18n Hardening Design

**Date:** 2026-03-20

## Goal

Unify the application's internationalization so every user-facing page/component string is resolved from the shared locale resources, host startup respects the chosen/default language consistently, and automated checks prevent Chinese or ad-hoc bilingual UI copy from leaking back into source files.

## Current Problems

- Some UI layers still render hardcoded strings directly in components and pages.
- Several settings screens keep bilingual copy inline via `useLocalizedText(...)`, which spreads translation ownership across packages instead of keeping it in `@sdkwork/claw-i18n`.
- The install flow and app-detail flow still contain untranslated labels, helper-returned UI strings, and corrupted Chinese locale values.
- The existing `check:i18n` contract catches static JSX text, but it does not guard against page/component-level inline bilingual copy patterns.

## Design Decisions

### 1. Single Translation Owner For UI Copy

All page/component UI copy should live in `packages/sdkwork-claw-i18n/src/locales/en.json` and `packages/sdkwork-claw-i18n/src/locales/zh.json`.

Allowed exceptions:

- Structured marketplace/catalog/service data that is intentionally modeled as localized content objects.
- Tests.

Disallowed for pages/components:

- Chinese source text in `.tsx` files.
- English/Chinese inline bilingual text via `useLocalizedText().text(...)`.
- Static JSX copy that bypasses `t(...)`.

### 2. Prefer `useTranslation()` In UI Layers

Pages and components should use `useTranslation()` and `t(...)` for display text. This keeps UI copy searchable, reviewable, and contract-checkable.

### 3. Keep Runtime Language Bootstrap Stable

The shell/runtime bootstrap remains responsible for initializing i18n before the main UI renders. Cleanup work focuses on making sure the chosen language is reflected by locale keys everywhere, rather than duplicating per-screen language logic.

### 4. Strengthen Contract Checks

The i18n contract should continue blocking:

- Chinese source text outside locale files.
- Static JSX text.
- Corrupted locale values.

It should also block:

- `useLocalizedText` imports/usages inside page/component `.tsx` files.

## Scope

### In Scope

- Settings pages/components under `packages/sdkwork-claw-settings/src`.
- Install pages/components under `packages/sdkwork-claw-install/src`.
- App detail page under `packages/sdkwork-claw-apps/src/pages/apps/AppDetail.tsx`.
- Shared contract checks under `scripts/check-i18n-contract.mjs`.
- Locale resources and related tests.

### Out Of Scope

- Re-modeling catalog/service datasets that intentionally use localized content objects.
- Adding new languages beyond English and Simplified Chinese.

## Validation Strategy

- `pnpm check:i18n`
- Targeted package tests affected by the changes
- `pnpm lint`
- `pnpm build`

## Expected Outcome

- No Chinese source text remains in page/component code.
- Settings/install/app-detail UI copy resolves through centralized locale keys.
- Contract checks fail fast if future pages/components reintroduce inline bilingual text or untranslated UI copy.
