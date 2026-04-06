# Claw Studio Local AI Proxy Observability Design

**Date:** 2026-04-02

## Goal

Add the first production-grade observability and route testing layer on top of the existing local AI proxy so that:

- `Provider Center` can show route-level health, usage, RPM, and latency
- every saved route can be actively tested from the desktop app
- the local proxy records request traffic locally instead of exposing only static route metadata
- the current architecture remains compatible with a later SQLite-backed long-retention analytics phase

## Source Snapshot

This design is based on the local `claw-studio` workspace state on 2026-04-02.

Relevant existing implementation facts:

- the desktop runtime already starts and supervises a local AI proxy service
- the Rust proxy already supports `OpenAI-compatible`, `Anthropic`, and `Gemini` local entrypoints
- `Provider Center` already persists route records and can apply them to managed `OpenClaw`
- kernel info already exposes local proxy lifecycle, paths, and default-route metadata

## Current Gaps

The current product loop is missing the runtime observability plane:

- no route-level request counters or token counters are exposed to the frontend
- no route-level average latency or RPM is exposed to the frontend
- no per-route active test action exists
- no canonical route-test result shape exists in the platform bridge
- runtime health is visible only at the proxy-service level, not at the individual route level

## Approved Direction

This phase treats observability as a first-class extension of the existing desktop-managed local proxy.

The implementation is split into three layers:

1. `Proxy Runtime Metrics`
   The Rust proxy records route-level request outcomes in memory and exposes a stable summary through kernel info.
2. `Route Probe`
   The desktop runtime adds an explicit command to test an individual route with a minimal provider-aware request.
3. `Provider Center Ops Surface`
   The settings UI merges saved route records with runtime route summaries and renders health, usage, RPM, latency, and test actions directly in the table.

## Scope For This Iteration

This iteration implements the first useful slice, not the final observability system.

### Included now

- route-level runtime summary model
- in-memory request aggregation in the local proxy runtime
- route-level token counters:
  - total tokens
  - input tokens
  - output tokens
  - cache tokens
- route-level request counters:
  - total requests
  - successful requests
  - failed requests
- route-level latency counters:
  - average latency
  - last latency
- route-level RPM over a short rolling window
- per-route active test command
- `Provider Center` table columns:
  - health
  - usage
  - average latency
  - RPM
  - last test
- `Provider Center` row action:
  - test

### Explicitly deferred

- durable SQLite request-event storage
- minute/hour/day rollup tables
- recent request explorer
- error taxonomy dashboard
- p50/p95/p99 trend charts
- budgeting and quota policies
- fallback-chain analytics
- alerting and anomaly detection

Those stay in the next observability phase, but this phase must define data shapes that can expand into them without breaking consumers.

## Product Behavior

### Route table

Each route row should display:

- route identity and protocol metadata
- current route health status
- compact usage summary:
  - total
  - input
  - output
  - cache
- average latency
- RPM
- latest test result

### Test action

`Test` must trigger a real provider-aware route probe from the desktop runtime.

The probe must:

- validate the route has a usable default model
- issue a minimal non-stream request against the upstream provider
- use protocol-specific auth and endpoint rules
- measure elapsed latency
- capture success or failure
- persist the latest test result in runtime memory so the table can reflect it immediately

Probe behavior by upstream protocol:

- `openai-compatible`, `openrouter`, `sdkwork`:
  send a minimal `chat/completions` request
- `azure-openai`:
  send a minimal `chat/completions` request using `x-api-key`
- `anthropic`:
  send a minimal `messages` request
- `gemini`:
  send a minimal `generateContent` request

### Health state

Per-route health should be computed with simple deterministic rules in this phase:

- `healthy`
  latest test succeeded or recent success rate is healthy
- `degraded`
  route has mixed recent outcomes or a stale successful test
- `failed`
  latest test failed or recent traffic is failing
- `disabled`
  route is disabled

## Data Model

### Runtime route metrics summary

Each route summary should contain:

- `routeId`
- `clientProtocol`
- `upstreamProtocol`
- `requestCount`
- `successCount`
- `failureCount`
- `rpm`
- `totalTokens`
- `inputTokens`
- `outputTokens`
- `cacheTokens`
- `averageLatencyMs`
- `lastLatencyMs`
- `lastUsedAt`
- `lastError`
- `health`

### Route test result

Each route test result should contain:

- `routeId`
- `status`
- `testedAt`
- `latencyMs`
- `checkedCapability`
- `modelId`
- `error`

## Architecture

### Rust proxy runtime

The runtime keeps an in-memory route-observability store keyed by `route_id`.

The first version records only aggregated counters and the latest test result. It does not yet persist full request events.

This store is owned by the `LocalAiProxyService` runtime and is exposed through `status()`.

### Desktop kernel projection

`DesktopLocalAiProxyInfo` is extended to include:

- `routeMetrics`
- `routeTests`

The frontend should consume these via the existing `kernel.getInfo()` bridge.

### Provider Center service

`providerConfigCenterService` merges:

- route records from the provider routing catalog
- route metrics and latest test result from kernel info

The service also exposes:

- `testProviderConfigRoute`

This keeps UI code thin and prevents route/runtime joining logic from leaking into components.

## Verification Targets

### TypeScript

- route records merge correctly with runtime summaries
- missing runtime summaries degrade safely to zero-state UI values
- route test action delegates to the shared kernel bridge

### Rust

- route metrics are recorded for successful proxied requests
- route metrics are recorded for failed proxied requests
- token counters are extracted from translated provider responses when available
- route probe uses provider-aware request shaping
- route probe results are reflected in kernel info

## Completion Criteria For This Iteration

This iteration is complete when all of the following are true:

- `Provider Center` renders health, usage, latency, RPM, and latest test columns
- clicking `Test` on a route triggers a real desktop-side route probe
- successful proxy traffic updates route-level runtime counters visible in the table
- failed traffic updates route health and failure metadata
- the frontend receives route metrics and latest test state through the platform bridge without reaching into desktop-only modules directly

## Next Phase

The next phase upgrades this runtime summary layer into a durable observability system:

- request-event persistence
- SQLite-backed rollups
- route detail drawer analytics
- request explorer
- error breakdowns
- p95/p99 and TTFT
- budget, quota, alerting, fallback analytics
