# Provider Center Drawer Design

**Date:** 2026-04-02

**Scope:** Refine the Provider Center route-config editor so creation and editing use a left-side drawer, simplify the provider chooser into a compact visual list, prioritize mainstream providers in the default ordering, and reorganize the right-side editor into a clearer control-console layout.

## Context

The current route-config editor lives in `packages/sdkwork-claw-settings/src/ProviderConfigEditorSheet.tsx`. Although it is visually styled like a drawer, it is still implemented with `Dialog` semantics and a right-side surface. Its provider chooser also renders large card-like items with vendor, description, and metadata tags, which makes the sidebar visually heavy and reduces scan speed.

## Goals

- Move route-config creation and editing into a true left-side drawer interaction.
- Reduce the provider chooser to a dense `icon + name + selected state` list.
- Keep rich provider metadata available, but move it into the main content header instead of the chooser.
- Sort providers by product relevance rather than alphabetically, with well-known and high-frequency providers first.
- Keep `Custom Route` available without competing with mainstream providers in the first screenful.
- Promote route state controls such as `enabled` and `default route` to the top of the editor instead of burying them below the model section.
- Improve the right-side visual hierarchy so the editor feels like a focused route console rather than a long flat form.

## Non-Goals

- No new backend usage metrics or dynamic popularity tracking.
- No broad redesign of Provider Center tables or the apply dialog.
- No generalized brand asset pipeline for every provider logo.

## Approach

### Overlay behavior

Extend the shared overlay layout helpers so drawers can be anchored to either side. Preserve the existing right-side behavior as the default so current consumers keep working, and add an explicit left-side configuration for the Provider Center editor.

### Provider chooser

Replace the current sidebar cards with compact row items:

- Stable icon badge or letter mark
- Provider display name
- Active visual state with a check icon

The chooser no longer repeats vendor, description, protocol, or model-family tags. Those details remain visible in the main editor header after selection.

### Right-side editor composition

Recompose the editor content into three clearer layers:

- A top hero/control section that shows the selected provider, key metadata, and the two primary status toggles (`enabled` and `default route`).
- A cleaner core form section for connection fields such as route name, provider id, base URL, API key, and protocol controls.
- Supporting side cards for route summary, model selection defaults, and runtime controls.

The primary status toggles move to the top so the user can make the most important operational decisions immediately after choosing a provider.

### Visual treatment

Keep the overall visual language consistent with the existing workspace, but add more hierarchy and polish:

- stronger top-panel treatment
- clearer contrast between primary form content and supporting cards
- denser, calmer field layout
- fewer repetitive white rectangles with identical visual weight

### Sorting

Add a deterministic recommended order in the provider editor policy so the UI receives options in product-priority order. The leading sequence is:

`OpenAI -> Anthropic -> Google/Gemini -> xAI -> Azure OpenAI -> OpenRouter -> DeepSeek -> MiniMax -> Moonshot -> Qwen -> Meta -> Mistral -> Cohere -> ...`

Providers not explicitly ranked fall back to stable alphabetical ordering after the prioritized block. `Custom Route` remains separate and is rendered last in the chooser.

## Testing

- Add a policy test that proves known provider options are returned in the recommended order, including `MiniMax` and `Moonshot` ahead of `Qwen`.
- Add an overlay layout test that proves drawer containers support left anchoring without changing existing right-side behavior.
- Add a settings contract test that proves the route-status section is rendered ahead of the access form section in the Provider Center editor source.

## Risks

- Overlay changes can affect other drawer consumers if defaults shift. Mitigation: keep right-side anchoring as the default and cover both sides with tests.
- Compact rows may hide useful metadata. Mitigation: preserve vendor and description in the selected-provider summary area.
