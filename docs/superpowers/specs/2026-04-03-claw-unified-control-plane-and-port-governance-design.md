# Claw Unified Control Plane and Port Governance Design

**Date:** 2026-04-03

## Goal

Define the next architecture baseline that makes `desktop`, `server`, `container`, and `kubernetes` behave as different host shells over one canonical Rust control plane.

This baseline must guarantee:

- all OpenClaw management operations are processed through Rust host services
- `desktop` and `server` expose the same host-management model
- `desktop` can serve a browser-accessible local management surface by default
- port selection, collision handling, and endpoint publication are deterministic and observable
- settings can manage host ports instead of only displaying runtime values
- runtime and browser code can always identify the current startup shell and active endpoint state

## Why This Spec Exists

The current implementation already proves important parts of the platform direction:

- `sdkwork-claw-server` runs a real Rust web server and serves the browser app
- `sdkwork-claw-host-core` already owns canonical manage resources for installation, storage, cache, nodes, rollout, and host status
- `desktop` already owns the local OpenClaw lifecycle and a Rust local AI proxy
- packaging already distinguishes `server`, `container`, and `kubernetes` families through explicit startup metadata

But the product is still split across two host models:

- `server` is becoming a canonical HTTP control plane
- `desktop` is still primarily a native invoke bridge with selected host projections

That split is now the largest structural risk in the platform. It creates inconsistent control surfaces, uneven browser access, and duplicate port logic.

## Current Verified Reality

The current workspace proves the following:

- `server` already publishes:
  - `/claw/manage/v1/installation`
  - `/claw/manage/v1/storage-profiles`
  - `/claw/manage/v1/cache-profiles`
  - `/claw/manage/v1/nodes`
  - `/claw/manage/v1/rollouts*`
  - `/claw/internal/v1/host-platform/status`
- browser startup metadata already distinguishes `web`, `desktopCombined`, and `server` startup contexts
- `desktop` already exposes host status and rollout APIs through the Tauri bridge
- `desktop` already manages:
  - bundled OpenClaw runtime
  - bundled OpenClaw gateway lifecycle
  - local AI proxy lifecycle
  - dynamic local-AI-proxy port fallback when the requested port is busy

The current gaps are equally clear:

- `desktop` does not yet expose the full canonical manage surface through one HTTP control plane
- OpenClaw management still uses desktop-local Rust adapters that talk directly to the bundled gateway instead of going through one host API family
- port selection logic exists in multiple places instead of one allocator
- settings mainly display endpoint information and cannot manage host ports as first-class operator settings
- the browser bridge is still server-specific instead of host-shell-generic

## Option Analysis

### Option A: Keep the current split model

`server` remains the canonical HTTP host.

`desktop` remains a Tauri-first business host with selected host projections.

Pros:

- lowest immediate implementation cost
- preserves current desktop control paths

Cons:

- permanently duplicates host logic
- makes browser access on desktop a sidecar feature instead of a product contract
- keeps OpenClaw operations on a separate path from server mode
- makes settings and endpoint governance drift across host shells

Decision: reject.

### Option B: Make one canonical Rust host control plane and embed it into desktop

`server` and `desktop` both run the same host-control-plane stack.

`desktop` additionally exposes native-only adapters through Tauri.

Pros:

- one management contract
- one OpenClaw control path
- one browser-access model
- one port-governance model
- the cleanest long-term multi-shell architecture

Cons:

- requires desktop refactoring away from direct invoke-based business paths
- requires a shared endpoint-governance layer

Decision: recommended.

### Option C: Spawn `sdkwork-claw-server` as a sidecar from desktop

`desktop` becomes a thin shell that launches a standalone server binary locally and uses it over HTTP.

Pros:

- strong process isolation
- maximal shell parity

Cons:

- more packaging and lifecycle complexity
- harder desktop upgrades and crash recovery
- higher Windows and macOS operational cost

Decision: defer. This can become a future hardened deployment option, not the baseline.

## Final Decision

Adopt **Option B**.

The platform baseline becomes:

- one canonical Rust host control plane
- one canonical host-management API family
- `desktop` embeds that control plane by default
- `server` exposes the same control plane as a standalone deployment shell
- all OpenClaw management flows route through host services, not direct renderer-to-gateway logic

## Non-Negotiable Architecture Rules

### 1. One host control plane

All host-owned management operations must be implemented in Rust host services and exposed through canonical host APIs.

That includes:

- installation status
- storage and cache profile management
- node inventory
- rollout management
- OpenClaw runtime and gateway management
- host endpoint and port status

### 2. Desktop is a host shell, not a parallel product API

`desktop` is a deployment shell for the same platform model as `server`.

It may expose native-only adapters through Tauri for:

- windows and tray lifecycle
- native dialogs
- filesystem access
- screenshots
- installer execution

But it must not own a separate business-management API model.

### 3. All OpenClaw operations go through Rust host services

No browser code or Tauri renderer bridge should directly own OpenClaw gateway business logic.

Allowed model:

- host service receives a canonical management request
- host service validates and authorizes it
- host service resolves the active OpenClaw runtime
- host service talks to the local gateway privately if required

Forbidden model:

- renderer or browser code directly constructs gateway admin calls
- desktop-only Tauri commands become the primary API for OpenClaw business operations

### 4. Port logic must be centralized

Requested ports, active ports, collision handling, and endpoint publication must come from one shared host service, not from ad hoc allocation in multiple modules.

### 5. Browser access must be host-shell-generic

The browser bridge must no longer be modeled as only `server` browser mode.

It must support:

- `server` hosted browser access
- `desktop` hosted browser access

while preserving the correct startup context for each shell.

### 6. Desktop local control plane is loopback-first

The embedded desktop control plane must default to `127.0.0.1` only.

Remote or LAN exposure may exist later, but it must be explicit, opt-in, and guarded by configuration and security review.

## Target Runtime Model

### Desktop Combined

`desktop` owns:

- native shell UI
- embedded Rust host control plane
- bundled OpenClaw runtime lifecycle
- bundled OpenClaw gateway lifecycle
- local AI proxy lifecycle
- local browser access over loopback
- native platform adapters through Tauri

Default behavior:

- start the embedded host control plane on app boot
- keep it loopback-only
- publish active browser base URL into runtime status
- let both the Tauri app and the local browser use the same host APIs

### Server Combined

`server` owns:

- standalone Rust host control plane
- browser app hosting
- local OpenClaw and compatibility runtime when enabled
- server-side storage and cache profiles

### Container and Kubernetes

`container` and `kubernetes` are delivery families of the same standalone server shell.

They differ only in:

- packaging
- environment stamping
- operational topology

They do not get a separate host API model.

## Canonical API Shape

The canonical platform API families remain:

- `/claw/api/v1/*`
- `/claw/manage/v1/*`
- `/claw/internal/v1/*`

This spec adds one important rule:

### OpenClaw host operations belong to `/claw/manage/v1/*`

OpenClaw management is part of host governance, not a desktop-only side channel.

The baseline resource family should be:

- `/claw/manage/v1/openclaw/runtime`
- `/claw/manage/v1/openclaw/gateway`
- `/claw/manage/v1/openclaw/tasks`
- `/claw/manage/v1/openclaw/tasks/{taskId}`
- `/claw/manage/v1/openclaw/gateway/invoke`

`/claw/manage/v1/openclaw/gateway/invoke` may stay action-oriented because it is a controlled administrative bridge to the underlying runtime.

The important rule is not whether a route is fully REST-pure. The important rule is that:

- the route is canonical
- the route is Rust-host-owned
- the route works in both `desktop` and `server`

## Shared Module Boundaries

### `sdkwork-claw-host-core`

Owns:

- canonical host resource models
- OpenClaw host-service adapters
- host endpoint registry
- port allocator
- endpoint publication snapshots
- host capability negotiation

Recommended additions:

- `host_endpoints` module
- `port_allocator` module
- `openclaw_control_plane` module

### `sdkwork-claw-server`

Owns:

- standalone shell boot
- HTTP listener creation
- browser asset serving
- environment-driven startup defaults
- native service integration

It must not become the only place where host business logic exists.

### `sdkwork-claw-desktop`

Owns:

- embedded host shell boot
- Tauri capability exposure
- native adapter calls
- desktop-specific service startup and shutdown wiring

It should stop owning host-management business logic directly whenever that logic can live in host-core.

### `sdkwork-claw-infrastructure`

Owns:

- host-shell-generic browser bridge
- runtime startup projection
- HTTP client wrappers for manage and internal APIs

It should not need separate desktop-vs-server management concepts after this baseline.

### `sdkwork-claw-core` and `sdkwork-claw-settings`

Own:

- host settings services
- endpoint status aggregation
- settings UI for host endpoints
- runtime refresh and event consumption

They must consume canonical host APIs rather than infer runtime state heuristically.

## Desktop Embedded Control Plane

### Startup behavior

Desktop startup should:

1. load desktop config
2. resolve desired endpoint settings
3. allocate effective ports
4. start embedded host control plane
5. start or reconnect bundled OpenClaw gateway through host services
6. start or reconnect local AI proxy through host services
7. publish active endpoint state

### Browser access behavior

Desktop should expose a loopback browser entry point by default.

The browser page served by the embedded control plane must carry startup metadata that identifies:

- `hostMode = desktopCombined`
- `packageFamily = desktop`
- `startupTarget = desktop`

This is required so browser code running against the local desktop shell does not misclassify itself as standalone server mode.

### Tauri role after this change

Tauri remains important, but its role narrows to native capabilities and bootstrapping.

It should no longer be the primary management transport for OpenClaw business operations.

## OpenClaw Processing Model

All OpenClaw management flows must use the same server-owned sequence:

1. client calls canonical host API
2. host service resolves installation and runtime state
3. host service validates gateway availability
4. host service applies authorization and policy checks
5. host service performs the underlying runtime call
6. host service returns canonical response DTOs

This rule applies equally in:

- desktop native shell
- desktop browser access
- standalone server mode
- future remote node topologies

Desktop may still use private local adapters internally, but only behind the same host service contract.

## Port Governance Model

Port governance must become a first-class host concern.

### Managed endpoints

The baseline managed endpoints are:

- embedded control-plane HTTP server
- OpenClaw gateway
- local AI proxy

### Canonical endpoint record

Each endpoint should publish:

- `endpointId`
- `bindHost`
- `requestedPort`
- `activePort`
- `scheme`
- `baseUrl`
- `websocketUrl`
- `loopbackOnly`
- `dynamicPort`
- `lastConflictAt`
- `lastConflictReason`

### Requested versus active

The system must distinguish:

- `requestedPort`: persisted operator preference
- `activePort`: currently bound runtime port

The system must not silently overwrite `requestedPort` when a conflict causes dynamic fallback.

### Allocation algorithm

The shared allocator should:

1. attempt the requested port
2. if unavailable and automatic fallback is enabled, search the reserved range for the endpoint kind
3. if no preferred slot is available, bind port `0`
4. persist the runtime result as `activePort`
5. publish an endpoint-change event

### Reserved ranges

The exact numeric defaults may evolve, but the model should define distinct default ports and fallback ranges for:

- control plane
- OpenClaw gateway
- local AI proxy

## Settings Requirements

Settings must gain a dedicated host-endpoint configuration surface.

It must allow operators to view and modify:

- control-plane enablement in desktop mode
- bind host
- requested port
- automatic fallback on conflict
- current active port
- current browser base URL
- current websocket URL where relevant

### Desktop defaults

Desktop should default to:

- embedded control plane enabled
- loopback-only control plane
- automatic fallback enabled

### UI behavior

The UI must:

- validate ports before submit
- show requested and active ports separately
- show conflict status when fallback happened
- refresh automatically when active ports change
- avoid requiring a full page reload

### Kernel Center behavior

Kernel Center should stop being only a read-only endpoint summary and become the operator dashboard for host endpoint state.

It may keep a read-optimized overview, but editing should live in a dedicated settings/editor surface backed by canonical manage APIs.

## Runtime and Event Propagation

The platform needs one event model for endpoint changes.

When any host-managed endpoint changes active port or bind state, the system should:

- update the persisted runtime snapshot
- update host status projections
- invalidate relevant platform caches
- notify browser and native UI consumers

The browser app should read endpoint changes from canonical status sources, not from isolated feature-local logic.

## Browser Bridge Changes

The current browser bridge should evolve from a server-only bridge into a host browser bridge.

Required behavior:

- detect `server` hosted browser mode
- detect `desktopCombined` hosted browser mode
- configure runtime, manage, and internal clients consistently
- preserve startup metadata across both shells

This is required so the same browser app can run in:

- standalone server
- desktop loopback browser
- future operator-hosted browser surfaces

## Packaging and Installation Impact

### Desktop

Desktop packaging must continue to ship bundled OpenClaw resources and native shell assets, and now also guarantee the embedded control-plane server is part of the standard startup profile.

### Server

Server packaging remains the authoritative standalone host shell and continues to stamp:

- package family
- startup target
- runtime paths

### Container and Kubernetes

No new packaging family is required. They continue to wrap the same server shell.

The important change is behavior parity, not packaging divergence.

## Security Rules

### Desktop loopback boundary

Desktop local browser access must remain loopback-only by default.

### Host-auth boundary

The same host-auth model should apply to browser access regardless of whether the host shell is `desktop` or `server`.

### Gateway privacy

OpenClaw gateway admin calls remain private host implementation details. They are not direct public browser APIs.

## Testing Requirements

The implementation must prove:

- desktop boot starts the embedded host control plane by default
- desktop browser mode reports `desktopCombined` startup context
- server browser mode reports `server` startup context
- OpenClaw management flows succeed through canonical host APIs in both shells
- direct desktop-only OpenClaw business paths are removed or downgraded to internal adapters
- port conflicts resolve deterministically
- requested and active ports are both surfaced correctly
- settings edits propagate active endpoint changes into the UI without reload
- packaging and deployment templates still stamp the correct startup families

## Explicit Non-Goals

This slice does not require:

- remote LAN exposure by default for desktop
- introducing a second browser app
- introducing a second standalone manager binary for desktop
- full RBAC completion
- a new operator shell package

## Implementation Sequence

Recommended implementation order:

1. expand canonical host resource ownership for OpenClaw and endpoint governance
2. add shared port allocator and endpoint registry
3. embed the canonical host server into desktop
4. switch desktop OpenClaw management to host APIs
5. generalize the browser bridge for desktop and server hosted browser access
6. add settings editing for host ports and endpoint behavior
7. harden packaging, tests, and runtime event propagation

This is the shortest path to one coherent multi-shell platform.
