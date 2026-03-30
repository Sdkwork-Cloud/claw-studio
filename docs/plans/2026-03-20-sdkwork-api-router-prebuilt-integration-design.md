# SDKWork API Router Hybrid Integration Design

## Goal

Integrate `sdkwork-api-router` into Claw Studio in a way that matches the product constraint exactly:

- `sdkwork-claw-apirouter` remains the operator UI only
- `sdkwork-api-router` remains the backend/runtime authority
- the router must stay separately packaged and versioned
- on Claw startup, the app must first check whether an independently started router is already healthy
- only when no healthy independent router is attached may Claw move into managed startup mode

## Final Decision

The best current architecture is a **hybrid attach-first model**:

1. Treat `sdkwork-api-router` as a separately packaged runtime, not a frontend package concern.
2. Give Claw Desktop a startup arbitration layer that resolves shared config, probes runtime health, and classifies the startup mode.
3. Prefer attaching to an already running external router process.
4. Only when no healthy external router is found and the configured ports are free should Claw select managed startup.
5. Keep the managed startup implementation inside the desktop lifecycle, but do not couple the normal Claw build to compiling the upstream router workspace.

This is the cleanest match for the user requirement and the least risky path in the current codebase.

## Why This Is The Best Choice

### 1. It respects the true responsibility split

- `sdkwork-claw-apirouter` should stay as the management console surface
- `sdkwork-api-router` should stay as the backend control plane and gateway

That avoids leaking backend lifecycle and persistence concerns into the frontend package.

### 2. It matches strong desktop-product patterns

The best desktop tools do not blindly spawn duplicate services. They:

- inspect existing local state first
- attach when the required service is already healthy
- only launch a managed runtime when they are certain they own the lifecycle
- refuse ambiguous port-conflict states instead of silently reconfiguring around them

That is the same model Claw should follow for `sdkwork-api-router`.

### 3. It keeps build and release pressure under control

Even if upstream exposes embedded/runtime-host crates, binding the whole router workspace directly into the everyday Claw desktop build would create too much operational coupling:

- slower desktop builds
- more native build-chain fragility
- harder upgrades and rollback
- higher local and CI instability

So the router should still be packaged separately even if the eventual managed mode is launched by Claw.

## Upstream Reality Check

The upstream `sdkwork-api-router` repository already documents multiple runtime modes and includes a runtime host layer, but the current Claw codebase should not assume that the upstream runtime host is already a drop-in embedded admin-plus-gateway solution for this desktop app.

That leads to an important design rule:

- **do not overclaim full in-process hosting until Claw has its own proven launcher integration**

The correct first step is the runtime decision layer, because that logic is required no matter whether the later managed mode is:

- true in-process hosting, or
- Claw-owned managed child processes

## Required Runtime Model

### Shared config root

Claw and the router must share one router root:

- `~/.sdkwork/router`

Claw must not silently fork the configuration root or auto-rewrite ports.

### Startup arbitration

At desktop startup Claw should:

1. Resolve the shared router root.
2. Load effective binds from `config.yaml`, `config.yml`, or `config.json` when present.
3. Probe the configured admin and gateway health endpoints.
4. Classify the result into one of these modes:

- `attachedExternal`
  - both endpoints are healthy
  - Claw attaches and does not start another router
- `managedActive`
  - both endpoints are healthy
  - Claw owns the lifecycle of the running router process group
- `needsManagedStart`
  - no healthy router is attached
  - configured ports are free
  - Claw may proceed to managed startup
- `conflicted`
  - configured ports are occupied but health probes fail
  - Claw must not start another router
  - Claw must surface diagnostics instead

### Managed mode preference

For the current product direction, the recommended managed mode is:

- `inProcess`

That recommendation is a lifecycle decision, not a statement that the launcher is already fully implemented.

## Current Implementation Status In Claw

### Implemented now

Claw Desktop now includes a real runtime and managed-launch foundation:

- a desktop Rust service that resolves the shared router root
- config parsing for JSON and YAML router config files
- admin and gateway loopback health probing
- startup-mode classification into `attachedExternal`, `managedActive`, `needsManagedStart`, and `conflicted`
- a startup inspection hook in desktop bootstrap so Claw checks router state during launch
- a Tauri command plus TypeScript desktop bridge and runtime contract
- unit coverage for healthy attach, managed-start recommendation, conflict detection, and defaults
- a bundled runtime installer/descriptor for `sdkwork-api-router` artifacts
- supervisor support for owning the router `gateway + admin` process group
- attach-first startup behavior that auto-starts the managed router when no healthy external instance is attached and a bundled runtime is available

### Not implemented yet

The following pieces are still deliberately left as next-phase work:

- shipping real bundled router artifacts inside the Claw desktop distribution
- release/build automation for those bundled router artifacts
- trusted auth exchange between Claw session state and router admin JWT
- replacement of `sdkwork-claw-apirouter` mock data flows with router-native admin clients

That separation is intentional. The current implementation is honest about what is proven today.

## Recommended Packaging Strategy

`sdkwork-api-router` should stay separately packaged and versioned from Claw, even after managed mode is added.

Recommended long-term shape:

- Claw ships or provisions a pinned router runtime artifact
- Claw startup performs attach-first arbitration against the shared config root
- if no healthy external router is detected, Claw launches the managed runtime under its own lifecycle

This yields the best balance of:

- product correctness
- lifecycle control
- operational clarity
- future upgrade safety

## UI Boundary

`sdkwork-claw-apirouter` should consume runtime status from the desktop bridge instead of guessing backend state. The UI should eventually expose:

- attached external vs managed active vs managed-start-needed vs conflicted
- resolved config path
- admin and gateway binds
- health state and diagnostics

It should not keep using Claw-only mock abstractions as if they were the backend source of truth.

## Next Iteration

The next engineering milestone should be:

1. ship real bundled router artifacts inside the desktop package
2. wire router-native auth exchange and admin clients
3. migrate the API Router page from mock data to runtime-backed data

## Reference Sources

- Upstream repo: [Sdkwork-Cloud/sdkwork-api-router](https://github.com/Sdkwork-Cloud/sdkwork-api-router)
- Upstream runtime modes doc: [docs/architecture/runtime-modes.md](https://github.com/Sdkwork-Cloud/sdkwork-api-router/blob/main/docs/architecture/runtime-modes.md)
- Upstream admin API doc: [docs/api-reference/admin-api.md](https://github.com/Sdkwork-Cloud/sdkwork-api-router/blob/main/docs/api-reference/admin-api.md)
