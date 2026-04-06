# Claw Studio Local AI Proxy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local AI proxy loop so the desktop app starts a managed proxy, `Provider Center` stores proxy route records, and bundled `OpenClaw` uses the local proxy by default with `https://ai.sdkwork.com` as the fallback upstream.

**Architecture:** Keep proxy route normalization and migration in TypeScript service code, project the active route set into both a desktop proxy runtime snapshot and a managed `OpenClaw` provider, and run the actual loopback proxy as a Rust-managed desktop service built with existing `axum`, `reqwest`, and `tokio` dependencies. Phase 1 only exposes one stable local `OpenAI-compatible` endpoint to `OpenClaw`, while reserving multi-native protocol fields and route semantics for later phases.

**Tech Stack:** TypeScript, React, JSON5 config editing, Zustand-adjacent service state, Node `--experimental-strip-types` tests, Rust, Tauri, Axum, Reqwest, Tokio, cargo unit tests, workspace contract scripts

---

## File Structure

### Shared route schema and policy

- Create: `packages/sdkwork-claw-core/src/services/localAiProxyRouteService.ts`
  Responsibility: canonical route record normalization, legacy migration, system-default route creation, default-route arbitration, fallback `ai.sdkwork.com` resolution.
- Create: `packages/sdkwork-claw-core/src/services/localAiProxyRouteService.test.ts`
  Responsibility: RED/GREEN tests for route migration and policy behavior.
- Modify: `packages/sdkwork-claw-core/src/index.ts`
  Responsibility: export the new route service and types.
- Modify: `packages/sdkwork-claw-types/src/index.ts`
  Responsibility: shared route-facing types and enums used across settings, desktop projections, and diagnostics.

### Provider Center control plane

- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
  Responsibility: persist proxy route records instead of direct-consumption provider records.
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
  Responsibility: route persistence, migration, default-route, and apply-target tests.
- Modify: `packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx`
  Responsibility: render route semantics, new fields, and route-specific actions.
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`
  Responsibility: route/proxy wording and field labels.

### Catalog and OpenClaw projection

- Modify: `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
  Responsibility: catalog projection from route records, including `clientProtocol` and `upstreamProtocol`.
- Modify: `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
  Responsibility: route-aware catalog tests.
- Create: `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.ts`
  Responsibility: convert the effective default route into the managed `OpenClaw` provider projection.
- Create: `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
  Responsibility: managed-provider projection and preservation rules.
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
  Responsibility: write and refresh `sdkwork-local-proxy` idempotently without clobbering user-owned config.

### Desktop proxy runtime and startup

- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  Responsibility: loopback proxy runtime, route snapshot load, request forwarding, lifecycle inspection.
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy_snapshot.rs`
  Responsibility: runtime snapshot file serialization and parsing.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
  Responsibility: register the new desktop service.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
  Responsibility: add local proxy config, token, snapshot, and log paths.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
  Responsibility: add proxy service lifecycle and kernel-info exposure.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
  Responsibility: startup ordering, proxy activation before bundled `OpenClaw`, degraded-not-panic behavior.

### Desktop diagnostics and UI

- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
  Responsibility: surface local proxy lifecycle and endpoint diagnostics.
- Modify: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
  Responsibility: show proxy state, endpoint, and failure details.
- Modify: `scripts/check-desktop-platform-foundation.mjs`
  Responsibility: enforce presence of local proxy service wiring and startup references.
- Create: `scripts/desktop-local-ai-proxy-contract.test.mjs`
  Responsibility: contract assertions for route projection, supervisor registration, and startup ordering.

## Task 1: Define the shared proxy route schema and fallback policy

**Files:**
- Create: `packages/sdkwork-claw-core/src/services/localAiProxyRouteService.ts`
- Create: `packages/sdkwork-claw-core/src/services/localAiProxyRouteService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/index.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`

- [ ] **Step 1: Write the failing route policy tests**

Add tests proving:
- legacy provider-center records migrate into route records
- empty `upstreamBaseUrl` resolves to `https://ai.sdkwork.com`
- only one default route can exist per `clientProtocol`
- a system default route is synthesized when no user routes exist

Suggested route shape to lock in:

```ts
type LocalAiProxyClientProtocol =
  | 'openai-compatible'
  | 'anthropic'
  | 'gemini'
  | 'azure-openai'
  | 'openrouter'
  | 'sdkwork';

interface LocalAiProxyRouteRecord {
  id: string;
  schemaVersion: 1;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  managedBy: 'system-default' | 'user';
  clientProtocol: LocalAiProxyClientProtocol;
  upstreamProtocol: LocalAiProxyClientProtocol;
  providerId: string;
  upstreamBaseUrl: string;
  apiKey: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  models: Array<{ id: string; name: string }>;
  notes?: string;
  exposeTo: string[];
}
```

- [ ] **Step 2: Run targeted tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/localAiProxyRouteService.test.ts`

Expected: FAIL for missing route service and unresolved migration/default logic.

- [ ] **Step 3: Implement the route service**

Implement helpers for:
- legacy record normalization
- default upstream fallback
- system-default route creation
- one-default-per-client-protocol arbitration
- route sorting and active-route filtering

- [ ] **Step 4: Export route-facing shared types**

Add the shared enums and route interfaces to `packages/sdkwork-claw-types/src/index.ts` and export the new service from `packages/sdkwork-claw-core/src/index.ts`.

- [ ] **Step 5: Run targeted tests to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/localAiProxyRouteService.test.ts`

Expected: PASS

### Task 2: Upgrade Provider Center into a local proxy route control plane

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

- [ ] **Step 1: Write the failing service tests**

Add tests proving:
- provider-center persistence writes route records with `schemaVersion`, `clientProtocol`, `upstreamProtocol`, `enabled`, `isDefault`, and `managedBy`
- saving a route with a blank upstream base URL stores the effective `https://ai.sdkwork.com`
- loading an empty store yields a system-default route
- saving a new default route for `openai-compatible` clears the previous default on the same client protocol

- [ ] **Step 2: Run targeted tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected: FAIL because the service still persists direct provider records without route semantics.

- [ ] **Step 3: Implement route-aware persistence and apply behavior**

Refactor `providerConfigCenterService` so it:
- delegates route normalization to `localAiProxyRouteService`
- persists route records instead of direct provider records
- keeps `applyProviderConfig` behavior only as a route-to-OpenClaw apply bridge for the current phase
- continues to support legacy record reads until a record is resaved

- [ ] **Step 4: Refactor the Provider Center UI**

Update the page to speak in route terms:
- "route" instead of "provider config"
- `clientProtocol`, `upstreamProtocol`, `enabled`, `default`, and `upstreamBaseUrl`
- preserve existing model fields while clarifying they describe the default route payload projected to consumers

- [ ] **Step 5: Update i18n and route-specific wording**

Add or replace copy for:
- route config
- local proxy
- upstream protocol
- default route
- system default

- [ ] **Step 6: Run targeted checks to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected: PASS

### Task 3: Make catalog and `OpenClaw` projection route-aware

**Files:**
- Modify: `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- Create: `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.ts`
- Create: `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`

- [ ] **Step 1: Write the failing catalog tests**

Add tests proving:
- catalog output includes effective route metadata for `clientProtocol` and `upstreamProtocol`
- disabled routes are not counted as active runtime providers
- dynamic custom upstream providers still appear in the catalog

- [ ] **Step 2: Write the failing `OpenClaw` projection tests**

Add tests proving:
- the effective default `openai-compatible` route projects into provider key `sdkwork-local-proxy`
- projected endpoint and auth point to the local loopback proxy, not the raw upstream
- user-defined providers are preserved
- defaults are only rewritten when the current default refs still point to the managed provider

Example managed projection target:

```ts
{
  id: 'sdkwork-local-proxy',
  channelId: 'openai-compatible',
  name: 'SDKWork Local Proxy',
  baseUrl: 'http://127.0.0.1:18791/v1',
  apiKey: '${SDKWORK_LOCAL_PROXY_TOKEN}',
  models: [...]
}
```

- [ ] **Step 3: Run targeted tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`

Expected: FAIL because the catalog and config service still assume direct upstream providers.

- [ ] **Step 4: Implement route-aware catalog projection**

Update the catalog service so it:
- reads route records
- distinguishes local client protocol from upstream protocol
- keeps route-count and warning-count semantics consistent with the existing catalog consumers

- [ ] **Step 5: Implement the managed local proxy projection service**

Create a dedicated service that:
- chooses the effective default `openai-compatible` route
- builds the managed local provider payload
- returns the model-selection refs needed by `openClawConfigService`

- [ ] **Step 6: Extend `openClawConfigService` for managed proxy writes**

Add a helper that:
- creates or updates `sdkwork-local-proxy`
- rewrites the managed provider endpoint and auth
- preserves user-owned providers
- preserves user-overridden agents that no longer point at the managed provider

- [ ] **Step 7: Run targeted tests to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`

Expected: PASS

### Task 4: Add the desktop local AI proxy runtime and snapshot projection

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy_snapshot.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Write the failing Rust tests for snapshot and runtime basics**

Add tests proving:
- route snapshot files serialize and deserialize deterministically
- an empty route set yields a system-default `ai.sdkwork.com` route snapshot
- the proxy binds only to loopback
- the `GET /v1/models` surface returns the projected model list from the default route
- the `POST /v1/chat/completions` surface forwards to the selected upstream base URL with bearer-key auth

- [ ] **Step 2: Run targeted Rust tests to verify RED**

Run:
- `cargo test local_ai_proxy`

Expected: FAIL for missing proxy modules and runtime behavior.

- [ ] **Step 3: Implement snapshot types and path ownership**

Add path helpers for:
- proxy snapshot json
- proxy runtime token
- proxy logs

Keep the snapshot format small and explicit so desktop startup and tests can regenerate it idempotently.

- [ ] **Step 4: Implement the local proxy runtime**

Build the Phase 1 runtime in Rust using existing dependencies:
- `axum` for the local HTTP server
- `reqwest` for upstream forwarding
- `tokio` for task lifetime and graceful shutdown

Phase 1 required endpoints:
- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`

Do not implement native Anthropic or Gemini endpoints yet.

- [ ] **Step 5: Register the proxy service with `FrameworkServices`**

Wire the service into `services/mod.rs` so other desktop modules can:
- ensure it is running
- read health and endpoint information
- refresh its snapshot when the default route changes

- [ ] **Step 6: Run targeted Rust tests to verify GREEN**

Run:
- `cargo test local_ai_proxy`

Expected: PASS

### Task 5: Integrate proxy lifecycle into desktop startup and `OpenClaw` activation

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`

- [ ] **Step 1: Write the failing desktop lifecycle tests**

Add tests proving:
- startup order creates tray/UI reachability before background proxy and bundled `OpenClaw` startup
- the supervisor exposes a managed `local_ai_proxy` service entry
- proxy startup failure degrades startup instead of panicking the app
- bundled `OpenClaw` projection is refreshed to the local proxy before the gateway starts

- [ ] **Step 2: Run targeted tests to verify RED**

Run:
- `cargo test setup_creates_tray_before_starting_bundled_background_runtime -- --exact`
- `cargo test local_ai_proxy`
- `cargo test supervisor_`

Expected: FAIL because the proxy service and startup projection do not exist yet.

- [ ] **Step 3: Register proxy lifecycle in the supervisor**

Add:
- service id `local_ai_proxy`
- lifecycle status, pid-like handle state, restart support
- endpoint/log metadata for diagnostics

- [ ] **Step 4: Update bootstrap ordering**

Change startup flow so it:
- repairs or materializes the proxy route snapshot
- starts the local proxy
- projects the managed `sdkwork-local-proxy` provider into `openclaw.json`
- only then activates bundled `OpenClaw`

- [ ] **Step 5: Keep failure behavior non-fatal**

If the proxy cannot start:
- log it
- expose the degraded state through the desktop services layer
- keep tray and UI alive
- avoid `setup` panic

- [ ] **Step 6: Run focused Rust checks to verify GREEN**

Run:
- `cargo test local_ai_proxy`
- `cargo test tray -- --nocapture`
- `cargo test supervisor_`

Expected: PASS

### Task 6: Surface proxy diagnostics in Kernel Center and add contract coverage

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- Modify: `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- Modify: `scripts/check-desktop-platform-foundation.mjs`
- Create: `scripts/desktop-local-ai-proxy-contract.test.mjs`

- [ ] **Step 1: Write the failing dashboard and contract tests**

Add tests proving:
- Kernel Center dashboard includes local proxy lifecycle, endpoint, and failure details
- desktop contract checks require local proxy service registration and bootstrap wiring
- startup contracts require proxy activation before bundled `OpenClaw` activation

- [ ] **Step 2: Run tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `node scripts/desktop-local-ai-proxy-contract.test.mjs`

Expected: FAIL because proxy details are not yet surfaced and no contract exists.

- [ ] **Step 3: Extend Kernel Center service and UI**

Expose:
- proxy status tone
- local loopback endpoint
- upstream default route label
- degraded reason when proxy start or projection fails

- [ ] **Step 4: Add desktop contract coverage**

Enforce:
- `local_ai_proxy` service wiring exists
- proxy snapshot path wiring exists
- bootstrap references proxy activation before bundled `OpenClaw`

- [ ] **Step 5: Run focused verification to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `node scripts/desktop-local-ai-proxy-contract.test.mjs`
- `node scripts/tauri-dev-command-contract.test.mjs`

Expected: PASS

### Task 7: Run end-to-end verification for the Phase 1 loop

**Files:**
- Modify: `scripts/sdkwork-core-contract.test.ts`
- Modify: `scripts/sdkwork-settings-contract.test.ts`
- Modify: `scripts/check-desktop-platform-foundation.mjs`

- [ ] **Step 1: Run focused TypeScript tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/localAiProxyRouteService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`

- [ ] **Step 2: Run focused Rust tests**

Run:
- `cargo test local_ai_proxy`
- `cargo test tray -- --nocapture`
- `cargo test supervisor_`

- [ ] **Step 3: Run contract and workspace checks**

Run:
- `node scripts/desktop-local-ai-proxy-contract.test.mjs`
- `node scripts/tauri-dev-command-contract.test.mjs`
- `pnpm lint`

- [ ] **Step 4: Manual verification checklist**

Verify manually:
- launching the desktop app creates a running local AI proxy before bundled `OpenClaw`
- with no user route configured, the effective upstream is `https://ai.sdkwork.com`
- `Provider Center` shows route semantics instead of direct-provider semantics
- bundled `OpenClaw` config contains managed provider `sdkwork-local-proxy`
- switching the default `openai-compatible` route changes the local proxy model catalog without deleting user-owned providers
- proxy failure leaves the tray and settings UI reachable instead of crashing startup

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-01-claw-studio-local-ai-proxy-phase1-design.md docs/superpowers/plans/2026-04-01-claw-studio-local-ai-proxy-phase1.md packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-core/src/index.ts packages/sdkwork-claw-core/src/services/localAiProxyRouteService.ts packages/sdkwork-claw-core/src/services/localAiProxyRouteService.test.ts packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx packages/sdkwork-claw-i18n/src/locales/en.json packages/sdkwork-claw-i18n/src/locales/zh.json packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.ts packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts packages/sdkwork-claw-core/src/services/openClawConfigService.ts packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy_snapshot.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs packages/sdkwork-claw-settings/src/services/kernelCenterService.ts packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts packages/sdkwork-claw-settings/src/KernelCenter.tsx scripts/desktop-local-ai-proxy-contract.test.mjs scripts/check-desktop-platform-foundation.mjs
git commit -m "feat: add local ai proxy phase 1 control plane"
```

Use this commit step only after isolating unrelated workspace changes or staging exact paths intentionally.
