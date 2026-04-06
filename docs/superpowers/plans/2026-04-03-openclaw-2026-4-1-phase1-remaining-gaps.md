# OpenClaw 2026.4.1 Phase 1 Remaining Gaps

Date: 2026-04-03

## Checkpoint

The stable `2026.4.1` phase 1 alignment checkpoint is verified green.

Completed verification gates:

- focused strip-types package tests
- OpenClaw-adjacent contract suites
- `pnpm check:desktop`
- `pnpm lint`

## Closed After Checkpoint

### WhatsApp managed channel support

Status:

- resolved after the stable phase 1 checkpoint through the existing managed channel workspace

Notes:

- the earlier `reactionLevel` assumption was stale
- current official OpenClaw WhatsApp docs expose optional access-rule config through `allowFrom` and `groups`
- Claw Studio now models that official surface instead of inventing an unsupported field

## Remaining Items Deferred Beyond Phase 1

These items were intentionally not folded into the stable phase 1 checkpoint because they do not fit the current editor and runtime seams without introducing new architecture.

### 1. Web search provider editing, including SearXNG

Why deferred:

- upstream now uses `plugins.entries.<plugin>.config.webSearch.*` for provider-specific search credentials and tuning
- `tools.web.search.*` still carries provider selection and compatibility fields, but it is no longer the only config owner
- the current `tools` workbench surface is a read-only capability catalog
- there is no existing config writer or editor surface for `plugins.entries.*` or `tools.web.*` settings

What is needed next:

- config projection for `tools.web.search` plus `plugins.entries.<plugin>.config.webSearch`
- an editable tool-settings owner UI instead of the current read-only tool catalog rows
- write path in `openClawConfigService`

### 2. `auth.cooldowns.rateLimitedProfileRotations`

Why deferred:

- the current product does not expose an auth cooldown editor surface
- `openClawConfigService` currently has no focused auth-settings projection API

What is needed next:

- auth config projection and normalization helpers
- a dedicated auth settings owner in the instance workbench or settings center

### 3. Cron and tool allowlist editing

Why deferred:

- the current cron manager owns the simplified task form only
- raw nested payload fields are preserved, but there is no product surface for tool allowlists
- the current tools page shows runtime catalog data, not config-backed permissions

What is needed next:

- define which surface owns tool allowlists
- extend the task/tool editor contract without regressing current simplified task flows

### 4. Bedrock-specific guardrails

Why deferred:

- the local proxy route schema currently supports `openai-compatible`, `anthropic`, `gemini`, `azure-openai`, `openrouter`, and `sdkwork`
- Bedrock guardrail fields do not fit the current provider runtime config without introducing protocol-specific schema

What is needed next:

- decide whether Bedrock enters as a new upstream protocol or a separate managed adapter layer
- add protocol-aware runtime config and validation end to end

## Recommendation For The Next Plan

Open a follow-up phase focused on new config-owner surfaces rather than extending phase 1 further.

Recommended order:

1. web search config projection and editor across `tools.web.search` and `plugins.entries.*.config.webSearch`
2. auth cooldown settings
3. task and tool allowlist UX
4. Bedrock protocol and guardrail design
