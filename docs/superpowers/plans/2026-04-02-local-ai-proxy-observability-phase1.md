# Local AI Proxy Observability Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first end-to-end route observability slice so `Provider Center` can show route health, usage, RPM, average latency, and a real per-route test action backed by the desktop local AI proxy runtime.

**Architecture:** Extend the existing desktop kernel projection with route-level runtime summaries and latest test results, record lightweight aggregated metrics inside the Rust local AI proxy runtime, and keep the React settings surface thin by merging route config records with runtime summaries inside `providerConfigCenterService`.

**Tech Stack:** TypeScript, React, Node `--experimental-strip-types` tests, Rust, Tauri, Axum, Reqwest, Tokio

---

## File Structure

### Shared contracts

- Modify: `packages/sdkwork-claw-types/src/index.ts`
  Responsibility: route metrics and route test result shared types.
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
  Responsibility: runtime kernel info projection for route metrics and tests.
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
  Responsibility: kernel API method for route test execution.
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webKernel.ts`
  Responsibility: web fallback implementation for the new kernel API.
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
  Responsibility: expose the new kernel bridge method.
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
  Responsibility: register the new desktop command name.
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
  Responsibility: bridge the new desktop command into the platform layer.

### Provider Center control plane

- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
  Responsibility: merge route records with runtime summaries and expose route testing.
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
  Responsibility: prove runtime summary merge and test delegation behavior.
- Modify: `packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx`
  Responsibility: render observability columns and the route test action.

### Desktop runtime observability

- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
  Responsibility: extend kernel info structs with route metrics and route tests.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  Responsibility: add in-memory route metrics aggregation and route probe support.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
  Responsibility: project route metrics and route tests into desktop kernel info.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
  Responsibility: add the route test command.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
  Responsibility: register the new command module symbol if needed.
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
  Responsibility: expose the new command through the Tauri invoke handler.

## Task 1: Lock the route observability contracts

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webKernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Write the failing TypeScript tests**

Add tests proving:
- the kernel bridge exposes `testLocalAiProxyRoute`
- runtime route metrics and route test arrays are visible in the kernel info type path

- [ ] **Step 2: Run the focused tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`

Expected: FAIL because the new bridge contract does not exist yet.

- [ ] **Step 3: Add shared route observability types**

Add:
- route health
- route usage summary
- route runtime summary
- route test result

- [ ] **Step 4: Extend the platform bridge**

Add `testLocalAiProxyRoute` to:
- kernel contract
- web fallback
- registry bridge
- desktop bridge
- desktop command catalog

- [ ] **Step 5: Re-run focused tests to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`

Expected: PASS

## Task 2: Make Provider Center route-aware for runtime summaries and testing

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- Modify: `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

- [ ] **Step 1: Write the failing Provider Center service tests**

Add tests proving:
- route records are merged with runtime summary fields from kernel info
- routes without runtime data receive stable zero-state summaries
- route testing delegates through the kernel platform bridge and returns the latest test result

- [ ] **Step 2: Run the focused tests to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected: FAIL because the service only returns static route records today.

- [ ] **Step 3: Implement runtime summary merge**

Refactor the service so it:
- loads route records from the provider routing catalog
- loads kernel info once
- merges `localAiProxy.routeMetrics` and `localAiProxy.routeTests` by `routeId`

- [ ] **Step 4: Implement route testing**

Add a service method:
- `testProviderConfigRoute(routeId: string)`

This method should:
- ensure the kernel is running
- delegate to the kernel platform test bridge
- return the latest test result payload

- [ ] **Step 5: Re-run focused tests to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected: PASS

## Task 3: Surface observability columns and test action in Provider Center

**Files:**
- Modify: `packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx`

- [ ] **Step 1: Add the failing UI behavior test or contract assertion**

If there is no direct component test harness, add a service-driven contract assertion that requires:
- health
- usage
- average latency
- RPM
- last test
- test action wiring

- [ ] **Step 2: Run the focused check to verify RED**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected: FAIL until the UI-facing service shape exists.

- [ ] **Step 3: Update the Provider Center table**

Add columns:
- health
- usage
- avg latency
- RPM
- last test

Add actions:
- test
- quick apply
- edit
- delete

- [ ] **Step 4: Wire the test action**

The row action must:
- show pending state while testing
- refresh the route list after test completion
- surface success/failure via toast

- [ ] **Step 5: Run the focused check to verify GREEN**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected: PASS

## Task 4: Add route metrics and route probe support in the Rust local proxy runtime

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add tests proving:
- successful proxy traffic increments route request counters
- translated provider responses contribute token counters when usage is present
- route test command performs a provider-aware probe and reports success
- failed probes report error details and are reflected in kernel info

- [ ] **Step 2: Run focused Rust tests to verify RED**

Run:
- `cargo test local_ai_proxy`
- `cargo test desktop_kernel_info`

Expected: FAIL because no route metrics or probe projection exists yet.

- [ ] **Step 3: Add in-memory route metrics aggregation**

Record at minimum:
- request count
- success count
- failure count
- total/input/output/cache tokens
- cumulative latency
- last latency
- last used at
- last error
- rolling request timestamps for RPM

- [ ] **Step 4: Add the provider-aware route probe**

Implement a desktop command that:
- receives a route identifier
- resolves the current route snapshot
- issues a minimal protocol-aware request
- measures latency
- stores the latest test result in runtime memory

- [ ] **Step 5: Project metrics and tests into kernel info**

Extend `DesktopLocalAiProxyInfo` with:
- `routeMetrics`
- `routeTests`

- [ ] **Step 6: Re-run focused Rust tests to verify GREEN**

Run:
- `cargo test local_ai_proxy`
- `cargo test desktop_kernel_info`

Expected: PASS

## Task 5: Verify the first observability slice end to end

**Files:**
- Modify: `packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`

- [ ] **Step 1: Run focused TypeScript tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/kernelCenterView.test.ts`

- [ ] **Step 2: Run focused Rust tests**

Run:
- `cargo test local_ai_proxy`
- `cargo test desktop_kernel_info`

- [ ] **Step 3: Run package-level checks if the focused tests pass**

Run:
- `pnpm check:sdkwork-settings`
- `pnpm check:desktop`

- [ ] **Step 4: Manual verification checklist**

Verify manually:
- Provider Center shows route health, usage, latency, RPM, and latest test
- clicking `Test` updates the row state instead of doing nothing
- proxy traffic changes counters in the table after real usage
- failed route tests surface an actionable error message

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-local-ai-proxy-observability-design.md docs/superpowers/plans/2026-04-02-local-ai-proxy-observability-phase1.md packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts packages/sdkwork-claw-infrastructure/src/platform/webKernel.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-desktop/src/desktop/catalog.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: add local ai proxy route observability"
```
