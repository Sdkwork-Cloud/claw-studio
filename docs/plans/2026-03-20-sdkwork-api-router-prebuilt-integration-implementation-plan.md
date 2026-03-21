# SDKWork API Router Hybrid Integration Implementation Plan

## Objective

Land the best practical integration in phases:

- first, make Claw Desktop capable of deciding whether to attach or manage
- second, add the managed router launcher behind that decision
- third, replace mock UI flows with router-native backend calls

## Phase Status

### Phase 1: Runtime arbitration foundation

Status: **completed**

Delivered:

- desktop runtime inspection service at `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs`
- desktop command at `packages/sdkwork-claw-desktop/src-tauri/src/commands/api_router_runtime.rs`
- desktop bootstrap startup inspection hook
- desktop bridge command catalog entry and bridge export
- TypeScript runtime contracts for router status
- contract and Rust test coverage

Acceptance evidence:

- `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test api_router_runtime --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

### Phase 2: Managed router launcher

Status: **in progress**

Scope:

1. turn `needsManagedStart` into a real launcher path
2. start only when no healthy external router is attached
3. track owned process identity and stop only owned processes
4. keep `conflicted` fail-closed

Implementation targets:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_managed_runtime.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

Verification:

- unit tests for attach, owned start, owned stop, and conflict handling
- startup smoke test through desktop bootstrap

Delivered so far:

- bundled runtime manifest/install service for `sdkwork-api-router`
- supervisor support for owning the router `gateway + admin` process group
- startup auto-activation when no healthy external router is attached and a bundled runtime is available
- `managedActive` runtime status surfaced through the desktop command and frontend runtime contract
- unit coverage for bundled activation, supervisor start/stop, and managed status projection

Remaining to finish the phase:

- ship real bundled router binaries/resources in the desktop package
- finalize release/build automation for those bundled artifacts

### Phase 3: Trusted auth bridge

Status: **next**

Scope:

1. add a Claw-to-router local trust exchange
2. avoid a second login prompt
3. keep the bridge secret inside desktop/runtime boundaries only

Expected outputs:

- router-compatible exchange endpoint support
- Tauri command for session bootstrap
- frontend session handoff for router admin API usage

### Phase 4: Replace mock API Router data paths

Status: **next**

Scope:

1. stop using `studioMockService` as the primary data source in `sdkwork-claw-apirouter`
2. consume runtime status from the new desktop bridge
3. replace mock CRUD flows with real router-native admin clients where upstream semantics exist

Guardrails:

- do not invent a second durable backend for concepts the router does not own
- keep `sdkwork-claw-apirouter` as a UI shell over router-native backend capability

## Current Engineering Rules

### Rule 1

Always check for an independent router first.

### Rule 2

Never launch a second router into occupied but unhealthy configured ports.

### Rule 3

Keep `sdkwork-api-router` separately packaged from the frontend workspace.

### Rule 4

Do not represent unimplemented managed startup as completed.

## Recommended Next Work Order

1. Ship real bundled router binaries/resources in the desktop package.
2. Patch in trusted auth exchange.
3. Migrate API Router feature services off the mock backend.
4. Deepen the API Router page from runtime status into real admin-backed operations.

## Verification Record For Phase 1

Executed successfully during this iteration:

```bash
node scripts/check-desktop-platform-foundation.mjs
cargo test api_router_runtime --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Known unrelated workspace blocker:

```bash
pnpm lint
```

Current failure is unrelated to the router integration foundation and is caused by an existing JSX syntax error in:

- `packages/sdkwork-claw-install/src/pages/install/Install.tsx`

That file should be fixed before claiming repo-wide TypeScript lint is green.
