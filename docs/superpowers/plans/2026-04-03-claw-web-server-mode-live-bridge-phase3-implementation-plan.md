# Claw Web Server-Mode Live Bridge Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the browser app to a real same-origin server bridge when it is hosted by `sdkwork-claw-server`, so rollout and host-platform views use live `/claw/manage/v1/*` and `/claw/internal/v1/*` data instead of the default web mock bridge.

**Architecture:** Keep this slice narrow and production-useful. Teach the Rust server shell to expose a minimal host-platform status route and to stamp server-host metadata into the served web shell, then add small browser HTTP bridge classes in `sdkwork-claw-infrastructure` plus a web bootstrap hook that installs them only when the browser is running under the server shell. Plain web preview and existing desktop behavior must remain unchanged.

**Tech Stack:** TypeScript, React, browser `fetch`, existing platform bridge registry, Rust `axum`, existing server shell route modules, metadata injection into the served `index.html`.

---

## Scope Check

This plan intentionally covers one vertical slice only:

- browser live `manage` bridge for rollout list, preview, and start
- browser live `internal` bridge for host-platform status and node-session list
- server host metadata publication for browser bootstrap detection
- web bootstrap wiring that safely falls back to the current mock bridge outside server mode

Explicitly deferred:

- new `/claw/api/v1/*` product APIs
- real internal node-session admission, heartbeat, pull, or ack flows
- rollout item, targets, or wave detail APIs
- plugin runtime, Redis, multi-database, or public compatibility gateway work
- auth, RBAC, or cross-origin remote browser transport concerns

## File Structure

Target structure for the Phase 3 implementation:

- Planning:
  - Create: `docs/superpowers/plans/2026-04-03-claw-web-server-mode-live-bridge-phase3-implementation-plan.md`
- Browser infrastructure bridge:
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
  - Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
  - Create: `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
  - Create: `packages/sdkwork-claw-infrastructure/src/platform/webInternal.ts`
  - Create: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- Web host bootstrap:
  - Modify: `packages/sdkwork-claw-web/src/main.tsx`
  - Modify: `packages/sdkwork-claw-web/package.json`
- Server shell support:
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Documentation:
  - Modify: `docs/reference/claw-server-runtime.md`
  - Modify: `docs/reference/claw-rollout-api.md`

### Task 1: Add Failing Browser Bridge Tests

**Files:**

- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/webManage.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/webInternal.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`

- [ ] **Step 1: Write failing tests for server metadata detection and same-origin manage/internal fetches**

```ts
await runTest('server browser bridge installs live manage and internal clients when server metadata is present', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{ input: string; method: string }> = [];

  configureServerBrowserPlatformBridge({
    document: createMetaDocument({
      'sdkwork-claw-host-mode': 'server',
      'sdkwork-claw-manage-base-path': '/claw/manage/v1',
      'sdkwork-claw-internal-base-path': '/claw/internal/v1',
    }),
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), method: init?.method ?? 'GET' });
      return createJsonResponse(resolveFixture(input, init));
    },
  });

  const status = await internal.getHostPlatformStatus();
  const rollouts = await manage.listRollouts();

  assert.equal(status.mode, 'server');
  assert.equal(rollouts.total, 1);
  assert.deepEqual(requests.map((item) => item.input), [
    '/claw/internal/v1/host-platform',
    '/claw/manage/v1/rollouts',
  ]);

  configurePlatformBridge(originalBridge);
});
```

- [ ] **Step 2: Run the focused infrastructure tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`

Expected: FAIL because the server browser bridge and live HTTP platform classes do not exist yet.

- [ ] **Step 3: Implement the minimal browser HTTP bridge and metadata-driven bootstrap helper**

```ts
export function configureServerBrowserPlatformBridge(...) {
  const config = readServerBrowserPlatformBridgeConfig(...);
  if (!config) return false;
  configurePlatformBridge({
    manage: new WebManagePlatform(config.manageBasePath, fetchImpl),
    internal: new WebInternalPlatform(config.internalBasePath, fetchImpl),
  });
  return true;
}
```

- [ ] **Step 4: Re-run the focused infrastructure tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`

Expected: PASS.

### Task 2: Add Failing Server Metadata And Internal Route Tests

**Files:**

- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write failing server tests for host-platform status and injected browser metadata**

```rust
#[tokio::test]
async fn internal_host_platform_route_returns_server_status() {
    let app = build_router(build_server_state());
    let response = app
        .oneshot(Request::get("/claw/internal/v1/host-platform").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[test]
fn static_asset_injection_marks_server_host_mode() {
    let html = inject_server_host_metadata("<html><head></head><body></body></html>");
    assert!(html.contains("sdkwork-claw-host-mode"));
}
```

- [ ] **Step 2: Run the focused server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: FAIL because the host-platform route and metadata injection do not exist yet.

- [ ] **Step 3: Implement the minimal server route and HTML metadata injection**

```rust
Router::new()
    .route("/host-platform", get(get_host_platform_status))
    .route("/node-sessions", get(list_node_sessions))
```

- [ ] **Step 4: Re-run the focused server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

### Task 3: Wire Web Bootstrap And Refresh Docs

**Files:**

- Modify: `packages/sdkwork-claw-web/src/main.tsx`
- Modify: `packages/sdkwork-claw-web/package.json`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/claw-rollout-api.md`

- [ ] **Step 1: Update the web host bootstrap to install the live server bridge before shell runtime initialization**

```ts
configureServerBrowserPlatformBridge();
await bootstrapShellRuntime();
```

- [ ] **Step 2: Update docs to describe the new browser/server-mode behavior**

```md
- server-served browser HTML includes `sdkwork-claw-host-*` metadata
- browser bootstrap installs same-origin live `manage` and `internal` HTTP clients only in server mode
- plain web preview still uses the default mock bridge
```

- [ ] **Step 3: Run focused verification**

Run: `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts && cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 4: Run workspace lint**

Run: `pnpm.cmd lint`

Expected: PASS.

## Deferred Follow-Up Plans

These remain out of scope for this plan and should become later implementation slices:

- real server-side node-session lifecycle and rollout status aggregation
- `/claw/manage/v1/rollouts/{rolloutId}` detail and operational read models
- richer server browser bootstrap metadata such as auth posture or public API discovery
- public `/claw/api/v1/*` and compatibility gateway browser tooling
