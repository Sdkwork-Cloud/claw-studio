# 2026-04-06 Runtime Provenance And Host Drift Hardening

## Scope

This iteration focused on the desktop embedded host startup path, specifically the class of runtime failures that had been reported as:

- desktop startup CORS failures against `http://127.0.0.1:<port>/claw/*`
- `resolveHostedBasePath` and `browserBaseUrl unavailable` bootstrap failures
- OpenClaw `503 Service Unavailable`
- built-in OpenClaw websocket connection refused symptoms

The working assumption for this iteration was that the current source tree already contains the core browser-session CORS behavior, and that a large portion of the remaining production symptoms are caused by runtime drift, install artifact drift, or stale embedded-host state that was not sufficiently observable at startup.

## Root Cause Summary

The previous implementation had a real observability gap:

1. The desktop hosted runtime descriptor exposed to the renderer only contained base paths and the browser session token.
2. The startup readiness probe only validated that a manage host endpoint existed, but it did not verify that the published manage `baseUrl` still matched the canonical desktop runtime descriptor `browserBaseUrl`.
3. Startup logs did not include the host endpoint identity, host ports, runtime data directory, or the resolved web asset directory.
4. Shared runtime info did not expose enough embedded-host provenance to make cross-layer diagnostics possible from the desktop shell.

That meant a stale install, wrong port projection, wrong embedded host asset root, or mismatched runtime snapshot could surface as opaque CORS/503/websocket failures instead of failing early with a precise root-cause message.

## Changes Landed

### 1. Hardened desktop hosted readiness validation

`packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts`

- `probeDesktopHostedRuntimeReadiness()` now returns the normalized desktop runtime descriptor together with the readiness data.
- The readiness assertion now rejects when the published manage host endpoint `baseUrl` drifts from the runtime descriptor `browserBaseUrl`.
- Additional drift guards now reject endpoint id and active port mismatches when the descriptor includes those values.

This turns a late opaque failure into an early explicit startup failure with a targeted error message.

### 2. Extended desktop runtime provenance

Renderer-side runtime descriptor now carries additional embedded-host provenance:

- `endpointId`
- `requestedPort`
- `activePort`
- `loopbackOnly`
- `dynamicPort`
- `stateStoreDriver`
- `stateStoreProfileId`
- `runtimeDataDir`
- `webDistDir`

Files:

- `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts`
- `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

### 3. Extended Tauri/Rust embedded-host snapshot wiring

`packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`

- Embedded host snapshot now persists:
  - `runtime_data_dir`
  - `web_dist_dir`

`packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`

- `get_desktop_host_runtime` now forwards:
  - endpoint id
  - requested/active port
  - loopback/dynamic-port flags
  - state store driver/profile id
  - runtime data dir
  - resolved web dist dir

This closes the renderer-to-host provenance gap.

### 4. Improved startup diagnostics

`packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`

The startup readiness log now records:

- descriptor browser base URL
- descriptor endpoint id / active port
- state store driver / active profile id
- runtime data directory
- resolved web dist directory
- host endpoint id / requested port / active port / base URL

This makes it much easier to confirm whether a failing desktop build is using the intended installed assets and intended loopback port projection.

## Tests Added Or Strengthened

### TypeScript / renderer

- `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts`
  - verifies readiness result includes descriptor provenance
  - verifies readiness rejects when manage host endpoint `baseUrl` drifts from runtime descriptor `browserBaseUrl`

- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
  - verifies startup log includes host endpoint id/ports and runtime/web asset paths

- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
  - verifies runtime startup contract includes the new provenance fields
  - verifies desktop runtime info maps those fields from the canonical host runtime descriptor

### Rust / Tauri / server

- Existing desktop embedded-host Rust unit tests still compile and pass after snapshot expansion.
- Existing server-side CORS regression still passes, confirming this iteration did not regress the working source-level host CORS behavior.

## Verification Evidence

The following commands were run successfully in this iteration:

- `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- `pnpm.cmd check:desktop`
- `cargo test embedded_host_server_state_defaults_to_sqlite_state_store_driver --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- `cargo test host_platform_status_projects_embedded_host_state_store_metadata --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- `cargo test desktop_combined_hosted_startup_requests_include_cors_headers_on_successful_responses --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

## Remaining Gaps

This iteration improved root-cause visibility and startup validation, but it did not yet close every reported production issue.

The main remaining gaps are:

1. There is still no first-class diagnostics UI that surfaces the new runtime provenance fields to operators without reading console logs.
2. Real packaged first-launch smoke still needs to be enforced across Windows, Linux, and macOS bundle/install layouts.
3. The `openClawConfigService.readConfigDocument` dependency failure reported by the user still needs a separate dependency-chain review through built-in instance detail, config loading, and gateway invoke flows.
4. The local AI proxy token-count issue still needs an end-to-end payload sampling pass at the request-log persistence layer, even though the current source-level extraction tests had already been passing before this iteration.

## Next Iteration Plan

1. Surface the new desktop hosted runtime provenance in a shared diagnostics/settings view so operators can inspect it without console access.
2. Trace the built-in OpenClaw `503` path end to end:
   - instance detail
   - config read path
   - gateway invoke path
   - dependency injection of `openClawConfigService`
3. Add or strengthen packaged first-launch smoke coverage for:
   - Windows install/bundle layout
   - Linux package/postinstall layout
   - macOS staged `.app` / resource layout
4. Continue the review loop in `/docs/review/` after each iteration so the defect list, design decisions, and verification evidence stay synchronized.
