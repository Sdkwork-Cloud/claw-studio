# Unified Rust Host Kernel Contract Hardening Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shared Rust host-kernel contracts truthful enough that upper layers can safely rely on `capabilityKeys`, `version`, `updatedAt`, and desktop hosted runtime descriptors across `desktop`, `server`, `docker`, and `k8s`.

**Architecture:** Keep the shared kernel types, but stop deriving runtime authority from mode strings and request-time helpers. Provider-aware capabilities, real release versioning, stable state timestamps, and restart-safe desktop host descriptors must become first-class contracts before more UI or deployment logic is layered on top.

**Tech Stack:** Rust host core, Rust server host, Tauri desktop host, TypeScript desktop bridge, Cargo tests, Node `--experimental-strip-types` tests

---

### Task 1: Split static supported capabilities from live available capabilities

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that host platform capability output distinguishes:
- compile-time supported capabilities
- runtime-live capabilities

Specifically, desktop combined must not claim hosted gateway invoke is live if the bound provider cannot currently perform it.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm.cmd check:server`
Expected: FAIL once the new assertions are added because capabilities are currently derived only from `mode`

- [ ] **Step 3: Write minimal implementation**

Project live capabilities from actual provider/runtime state. Preserve a separate static capability surface only if the product needs it for discovery.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:server`
Expected: PASS

### Task 2: Replace pseudo-version labels with real release version metadata

**Files:**
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that host-platform `version` and API discovery `hostVersion` expose a real release version instead of `"desktop@package-name"` or `"server@package-name"`.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_host_platform_route_reports_desktop_identity_in_desktop_combined_mode`
Expected: FAIL after strengthening the assertion from prefix-only to real-version semantics

- [ ] **Step 3: Write minimal implementation**

Add real version metadata to host-core and use it consistently in desktop and server host-platform projections.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:server`
Expected: PASS

### Task 3: Separate state update time from response observation time

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that two reads of unchanged host-platform state keep a stable state timestamp or revision, while any response-time marker is tracked separately.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm.cmd check:server`
Expected: FAIL because `host_platform_updated_at()` currently returns the current clock on every request

- [ ] **Step 3: Write minimal implementation**

Introduce stable state revision or state-updated timestamp fields and keep request observation time separate.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:server`
Expected: PASS

### Task 4: Make desktop hosted runtime descriptors restart-safe

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

- [ ] **Step 1: Write the failing tests**

Add resolver cases covering:
- embedded host restart
- dynamic port rebinding
- browser session token rotation
- transient null/error after a previously ready runtime

The resolver must not silently keep using a stale descriptor when the host has materially changed.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
Expected: FAIL because the current resolver intentionally falls back to the last resolved descriptor

- [ ] **Step 3: Write minimal implementation**

Invalidate stale descriptors when runtime identity changes or readiness is lost. Keep deduplication, but stop hiding restart/rebind transitions behind cache reuse.

- [ ] **Step 4: Re-run verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
Expected: PASS

### Task 5: Move bootstrap/session discovery away from raw HTML meta contract

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that desktop host bootstrap can obtain the browser session/bootstrap contract from a structured source without scraping the root HTML.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm.cmd check:desktop`
Expected: FAIL once the bootstrap tests require a structured descriptor source

- [ ] **Step 3: Write minimal implementation**

Move browser session bootstrap data to a structured command or endpoint. If HTML metadata remains, escape every dynamic value before injection.

- [ ] **Step 4: Re-run verification**

Run: `pnpm.cmd check:desktop`
Expected: PASS
