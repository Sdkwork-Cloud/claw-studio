# Claw Studio Local AI Proxy Phase 1 Design

**Date:** 2026-04-01

## Goal

Define the first implementation phase for a local AI proxy architecture that:

- starts with the desktop app and remains managed by the desktop runtime
- lets `Provider Center` configure local proxy routes instead of direct upstream providers
- makes bundled `OpenClaw` use the local proxy by default
- defaults upstream traffic to `https://ai.sdkwork.com` when the user does not provide a custom route
- preserves a path to complete both capability tracks:
  - `A`: `OpenClaw` can stay on one stable local compatibility endpoint
  - `B`: local clients can gradually gain native `Anthropic`, `Gemini`, `OpenAI`, `Azure OpenAI`, `OpenRouter`, and compatible upstream entrypoints

## Source Snapshot

This design is based on the local `claw-studio` workspace state on 2026-04-01.

Relevant existing implementation facts:

- `Provider Center` already stores multiple provider records and can apply them to `OpenClaw` instance config.
- `providerRoutingCatalogService` already exposes a channel catalog and dynamic configured-provider view.
- `openClawConfigService` already writes provider config into `openclaw.json` and currently normalizes provider writes toward a single compatibility shape.
- the desktop host already manages bundled `OpenClaw` startup through Tauri bootstrap and the Rust supervisor lifecycle.

## Current Findings

### What already exists

- UI and service scaffolding for multi-provider configuration:
  - `packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx`
  - `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- catalog logic for configured provider channels:
  - `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- `OpenClaw` config read/write services and migration helpers:
  - `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- desktop lifecycle, tray, and managed bundled `OpenClaw` startup:
  - `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

### What is missing

- no dedicated local AI proxy runtime
- no managed proxy service in the desktop supervisor
- no projection layer that turns route-center data into a proxy runtime snapshot
- no projection layer that turns route-center data into a managed `OpenClaw` provider block
- no default `ai.sdkwork.com` route policy
- no first-class distinction between:
  - client-side protocol exposed by the local proxy
  - upstream protocol spoken to the real provider
- no native local protocol entrypoints for `Anthropic`, `Gemini`, or similar clients

## Approved Direction

The local AI proxy becomes a first-class desktop-managed service.

Phase 1 establishes one safe product loop:

1. the desktop app starts a managed local AI proxy
2. `Provider Center` stores proxy route definitions, not direct-consumption provider records
3. a system default route points to `https://ai.sdkwork.com` if the user configures nothing
4. bundled `OpenClaw` is automatically projected to a single managed local provider that talks to the proxy through an `OpenAI-compatible` endpoint

This phase intentionally keeps `OpenClaw` on one stable local compatibility endpoint while the proxy data model already reserves multi-protocol growth for later phases.

## Non-Goals For Phase 1

Phase 1 does not fully implement:

- native local `Anthropic` client endpoints
- native local `Gemini` client endpoints
- `Azure OpenAI`-specific request shaping
- `OpenRouter`-specific routing behaviors
- direct multi-protocol consumption by `OpenClaw`
- per-model multi-route arbitration across multiple active upstreams

Those remain explicit follow-up phases after the local-proxy control plane is stable.

## Core Decisions

### 1. Proxy-first architecture

`Provider Center` stops being a direct upstream provider editor.

It becomes the control plane for local proxy routes. The desktop runtime is responsible for projecting those routes into:

- a runtime snapshot consumed by the proxy
- a managed provider entry consumed by bundled `OpenClaw`

### 2. One managed `OpenClaw` provider

Phase 1 always projects the current default route into one managed provider key in `openclaw.json`:

- suggested key: `sdkwork-local-proxy`
- endpoint: local loopback proxy `OpenAI-compatible` endpoint
- auth: desktop-generated local proxy token

`OpenClaw` does not directly consume the raw route catalog in this phase.

### 3. Default route safety

If no user-defined route exists, the system generates and maintains one default route:

- enabled
- default
- client protocol `openai-compatible`
- upstream protocol `sdkwork`
- upstream base URL `https://ai.sdkwork.com`
- managed by system

This guarantees that the product has a working default path even when the user has never opened `Provider Center`.

### 4. Managed runtime ownership

The desktop app owns:

- proxy startup
- proxy restart
- proxy port selection
- proxy auth token generation
- route snapshot projection
- `OpenClaw` provider projection

The frontend does not own runtime orchestration.

### 5. Idempotent projection rules

The desktop runtime only auto-maintains the managed local proxy provider.

User-created `OpenClaw` providers remain untouched unless they still explicitly point to the managed provider reference path that the system owns.

## Target Architecture For Phase 1

### A. Proxy Route Control Plane

New canonical record shape for `Provider Center`:

- `id`
- `schemaVersion`
- `name`
- `enabled`
- `isDefault`
- `managedBy`
- `clientProtocol`
- `upstreamProtocol`
- `providerId`
- `upstreamBaseUrl`
- `apiKey`
- `defaultModelId`
- `reasoningModelId`
- `embeddingModelId`
- `models`
- `notes`
- `exposeTo`

Definitions:

- `clientProtocol`: the protocol the local proxy exposes to local consumers
- `upstreamProtocol`: the protocol the proxy uses when calling the upstream provider

Reserved protocol enums from day one:

- `openai-compatible`
- `anthropic`
- `gemini`
- `azure-openai`
- `openrouter`
- `sdkwork`

Phase 1 only requires `clientProtocol = openai-compatible` for the `OpenClaw` path, but records must already support the full protocol set.

### B. Desktop Proxy Projection

The desktop runtime writes a proxy route snapshot file derived from the current active route set.

The proxy runtime consumes only this snapshot, not the UI storage schema directly.

Snapshot responsibilities:

- normalize defaults
- enforce one default route per `clientProtocol`
- exclude disabled routes
- resolve empty `upstreamBaseUrl` to `https://ai.sdkwork.com`
- include generated local token material or token reference needed by the proxy runtime

### C. Desktop `OpenClaw` Projection

The desktop runtime projects the default `openai-compatible` route into `openclaw.json`.

Projection responsibilities:

- create or update `sdkwork-local-proxy`
- point it to the local proxy loopback endpoint
- publish the route's effective models as the provider model list
- set default, reasoning, and embedding refs against that managed provider
- preserve user-owned providers and non-managed agents

### D. Desktop Startup Order

Phase 1 target startup order:

1. bootstrap framework context
2. create tray and keep UI reachable
3. initialize or repair proxy route state
4. start local AI proxy service
5. project managed local provider into `OpenClaw` config
6. start bundled `OpenClaw`
7. emit app-ready event

The app must not panic if the proxy fails. Instead:

- tray stays available
- settings and kernel UI stay available
- proxy is marked degraded or failed
- bundled `OpenClaw` is withheld from healthy status until the proxy becomes available

## Migration Strategy

Phase 1 uses compatibility reads and gradual write-back instead of destructive migration.

Rules:

- existing provider-center records remain readable
- first save upgrades them to the route schema
- missing fields are inferred
- missing base URL falls back to `https://ai.sdkwork.com`
- `OpenClaw` user providers are not bulk-migrated
- only the managed local proxy provider is created or refreshed automatically

Suggested legacy inference:

- `openai`, `deepseek`, `qwen`, `xai`, `openrouter` -> upstream protocol `openai-compatible`
- `anthropic` -> upstream protocol `anthropic`
- `google`, `gemini` -> upstream protocol `gemini`
- unknown custom providers default to `openai-compatible` until explicitly edited

## Failure Handling

Phase 1 must degrade instead of crash:

- proxy start failure does not kill the desktop shell
- proxy projection failure marks runtime degraded and surfaces diagnostics
- bundled `OpenClaw` startup must not silently fall back to direct upstream behavior when the managed proxy path is required
- tray and settings surfaces remain usable for recovery

Recovery entrypoints should include:

- restart proxy
- restart background services
- inspect proxy logs
- inspect managed `OpenClaw` config projection

## Verification Targets

### Provider Center and route services

- legacy provider records are upgraded into route records
- empty upstream base URL resolves to `https://ai.sdkwork.com`
- only one default route exists per client protocol
- system default route is auto-generated and not accidentally deleted

### Routing catalog

- catalog output includes `clientProtocol` and `upstreamProtocol`
- dynamic custom providers remain visible in the channel catalog
- disabled routes do not appear as active runtime choices

### Proxy projection

- default route projects into a stable runtime snapshot
- route edits refresh the snapshot idempotently
- no user routes still yields a valid default snapshot

### `OpenClaw` projection

- managed provider `sdkwork-local-proxy` is created when missing
- managed provider refresh is idempotent
- user-defined providers are preserved
- user-overridden agents are not forcibly reset away from non-managed providers

### Desktop lifecycle

- local proxy service is registered with the supervisor
- startup order keeps tray and UI reachable before heavy background activation
- proxy failure does not panic the app
- desktop diagnostics surface the proxy lifecycle state

## Phase Completion Criteria

Phase 1 is complete when all of the following are true:

- the desktop app automatically starts a managed local AI proxy
- `Provider Center` stores proxy route records instead of direct-consumption provider records
- the default route resolves to `https://ai.sdkwork.com` when the user has not configured another upstream
- bundled `OpenClaw` uses only the local proxy by default
- multiple routes can exist, but `OpenClaw` consumes the current default `openai-compatible` route only
- proxy or `OpenClaw` failure remains recoverable from the UI without desktop startup panic

## Follow-Up Phases

### Phase 2: Native Local Endpoints For External Clients

Add native local endpoints for:

- `Anthropic`
- `Gemini`

Primary consumers:

- `Claude Code`
- `Gemini` clients

### Phase 3: Broader Upstream Protocol Coverage

Add local-proxy support for:

- `Azure OpenAI`
- `OpenRouter`
- additional compatible third-party providers
- `Codex` and generic chat clients

### Phase 4: `OpenClaw` B-Capability Expansion

Begin exposing multi-protocol projection paths for `OpenClaw` itself while preserving the stable managed compatibility endpoint introduced in Phase 1.

This preserves both capability tracks:

- `A`: safe and stable single local compatibility endpoint
- `B`: full multi-native local protocol support over time
