# Service-First Runtime Design

**Date:** 2026-03-18

## Context

The current browser host starts `packages/sdkwork-claw-web/server.ts`, which mixes four concerns in a single file:

- Vite development hosting
- Express request routing
- in-memory SQLite mock persistence
- product-domain mock business logic

This directly conflicts with the repository architecture rules that say web/desktop hosts must stay limited to bootstrap and runtime entry code. The current design also leaks transport concerns into UI code because multiple pages and shell components still call `fetch('/api/...')` directly.

## Problems To Solve

1. The web host owns business logic and mock data.
2. Feature pages and shell/core components bypass service boundaries.
3. Mock state for instances, devices, skills, tasks, channels, settings, and app store is not reusable outside the Express runtime.
4. Replacing mocks with real APIs later would require another full sweep across pages and services.
5. Repository docs and contract tests currently enshrine the wrong architecture.

## Decision

Adopt a service-first runtime:

- `@sdkwork/claw-web` becomes a Vite-only browser host.
- Mock business state moves behind service-layer adapters.
- Feature services call a shared mock runtime adapter instead of HTTP endpoints.
- Shell/core consumers that need instance summaries use a core service instead of direct `fetch`.
- Future real backend integration swaps adapter implementations, not page code.

## Architecture

### Host Layer

`@sdkwork/claw-web` only starts Vite and mounts the shared shell. No Express server, no SQL.js, no API route ownership.

### Shared Mock Runtime

`@sdkwork/claw-infrastructure` exposes a temporary mock runtime service that owns mutable in-memory state for:

- instances, configs, tokens, and logs
- tasks and channels per instance
- skills, reviews, packs, and installations
- devices and installed skills
- settings profile and preferences
- app store featured/top-chart/category/detail data

This keeps state consistent across feature services without reintroducing a fake transport layer.

### Feature Service Facades

Feature packages continue to expose feature-local services:

- instances
- devices
- market
- my skills
- tasks
- channels
- settings
- app store

These services translate feature intent into adapter calls. UI code stays unchanged at the call-site level, but HTTP assumptions disappear.

### Cross-Feature Consumers

`@sdkwork/claw-core` adds an instance directory service for shell/core consumers that only need instance summaries. This prevents shell/components from reaching into transport details or sibling feature internals.

## Data Flow

1. A page or shell component calls a service method.
2. The service delegates to the shared mock runtime adapter.
3. The adapter mutates or reads shared in-memory domain state.
4. The service returns domain-shaped data to UI consumers.

When real backend logic arrives, step 2 changes from mock adapter calls to HTTP/client adapter calls.

## Error Handling

- Services keep their current promise-based interfaces.
- Missing entities return `null` or `undefined` where existing consumers already expect that behavior.
- Mutation methods throw stable errors for invalid operations such as deleting protected built-in instances.

## Testing Strategy

- Replace the host runtime contract test so it asserts a Vite-only host and the absence of the Express/SQL.js server contract.
- Add focused unit coverage for the shared mock runtime:
  - instance lifecycle/config behavior
  - installation state shared across market/device views
  - task and settings mutations

## Alternatives Considered

### Keep Express And “Clean It Up”

Rejected. It preserves the core architectural violation: the web host would still own business runtime logic.

### Replace Fetch With A Global Mock Interceptor

Rejected. It hides the transport smell instead of removing it, and it still allows pages/components to bypass services.

### Put All Mock State Inside Each Feature Service

Rejected. Installation state, instance selection, and other cross-feature concerns would drift and duplicate.

## Product Review Notes

The current product surface is broad, but the runtime foundation is still prototype-shaped. The most important correction is to make business features portable across host environments. Once data access is service-first, the next highest-leverage improvements are:

- unify list/query primitives across features
- add React Query or equivalent cache orchestration consistently
- formalize domain contracts for instance, device, and marketplace state
- replace ad-hoc local mutations with command/query style service APIs

The user explicitly delegated architecture decisions for this refactor, so this document records the recommended design and serves as approval for execution in this session.
