# Claw Studio Embedded OpenClaw Integration Audit

## Goal

This audit reviews the current "OpenClaw ships inside Claw Studio" path and defines the target integration architecture for a product-grade embedded runtime.

The target is not "one more OpenClaw install method." The target is:

- Claw Studio installs with a working built-in OpenClaw runtime
- OpenClaw lifecycle is explicitly owned by Claw Studio
- chat, workbench, files, agents, channels, skills, and cron flow through stable contracts
- built-in, external-local, and remote OpenClaw modes are cleanly separated
- multiple instances, multiple versions, and multiple installation sources can coexist on one machine

## Scope

Reviewed areas:

- packaging and runtime preparation
  - `scripts/prepare-openclaw-runtime.mjs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- bootstrap and lifecycle
  - `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- paths, state, and shell exposure
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/path_registration.rs`
- Studio control plane and workbench projection
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_control.rs`
  - `packages/sdkwork-claw-instances/src/services/instanceService.ts`
  - `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
  - `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- install product surface
  - `packages/sdkwork-claw-install/src/pages/install/installPageModel.ts`
  - `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw*.hub.yaml`

Official upstream references used:

- bundled gateway
  - <https://docs.openclaw.ai/platforms/mac/bundled-gateway>
- child-process behavior
  - <https://docs.openclaw.ai/mac/child-process>
- multiple gateways
  - <https://docs.openclaw.ai/zh-CN/gateway/multiple-gateways>
- official upstream repository
  - <https://github.com/clawdbot/clawdbot>

## Current State

The current implementation already proves that Claw Studio can host an embedded OpenClaw runtime:

- packaging bundles Node and the `openclaw` package
- desktop bootstrap installs a managed runtime under app-owned directories
- the supervisor launches the gateway as a managed child process
- Studio can project instance detail, workbench data, and chat routes
- the frontend gateway WebSocket client is already reasonably mature

The main problem is no longer "does it work." The main problem is "are responsibilities separated correctly." Today they are not.

## Findings

### P0. Activation is too tightly coupled

The startup path combines too many responsibilities in one chain.

- `bootstrap.rs:658-684`
  - installs shell shims
  - mutates PATH / profile state
  - configures the supervisor
  - starts the gateway
  - marks the built-in instance online
- `openclaw_runtime.rs:263-310`
  - creates managed home/state/workspace directories
  - reads and writes config
  - chooses a port
  - generates a gateway auth token
  - forces gateway and workspace defaults

This means runtime provisioning, state policy, shell exposure, process launch, and instance registration are all coupled together. Any change in one area risks the entire startup chain.

### P0. The internal control plane still shells out through the CLI

`openclaw_control.rs:224-264` manages cron and related runtime actions by spawning:

- `node openclaw.mjs gateway call ...`

This is the wrong boundary for an embedded subsystem. The application already owns the managed gateway process, but it still uses a second CLI subprocess to perform admin RPC calls.

That creates avoidable problems:

- control plane behavior is wrapped in CLI process semantics
- failures become process failures instead of typed admin errors
- performance and observability are worse
- auth, timeout, retries, and diagnostics cannot be unified cleanly

This is the biggest high-coupling issue in the current integration.

### P1. Built-in mode and external install mode are not separated at the product level

`installPageModel.ts:208-345` still treats WSL, installer scripts, npm, pnpm, source, docker, podman, bun, ansible, and nix as first-class install choices.

At the same time, the desktop app already bundles OpenClaw:

- `prepare-openclaw-runtime.mjs:33-34` pins the bundled OpenClaw and Node versions

That creates a product conflict:

- from the runtime perspective, Claw Studio can already ship with built-in OpenClaw
- from the install surface, the product still leads users toward external OpenClaw installation flows

These must become separate product modes:

- `Built-in Managed Runtime`
- `Connect Existing Local Runtime`
- `Connect Remote Runtime`

Advanced external install methods should move to migration and operations tooling, not stay on the main path.

### P1. Lifecycle is gateway-centric, not runtime-centric

`supervisor.rs:298-388` models the managed object mainly as `openclaw_gateway`:

- configure a runtime snapshot
- spawn `node openclaw.mjs gateway`
- wait for readiness
- record running state

That is enough for "a process started," but not enough for "the embedded OpenClaw subsystem is ready."

The integration needs a richer lifecycle state machine:

- `unprovisioned`
- `provisioning`
- `provisioned`
- `configuring`
- `starting`
- `ready`
- `degraded`
- `stopping`
- `stopped`
- `upgrading`
- `failed`

Without that model, the product cannot handle first boot, upgrade, crash recovery, port conflicts, or UI readiness correctly.

### P1. The built-in instance identity is hard-coded as a single default instance

`studio.rs:36` hard-codes the default built-in instance as `local-built-in`, and `studio.rs:1220-1279` binds start, stop, and restart behavior directly to that instance id.

That makes the architecture naturally drift toward one special built-in instance instead of a real runtime registry.

The correct model is:

- an `OpenClawProfile` represents a managed or connected runtime identity
- a `StudioInstance` is a projection of that profile into the UI and API surface
- lifecycle ownership belongs to the profile, not to a hard-coded instance id

### P1. Config mutation paths are fragmented across layers

There are multiple competing config mutation paths today:

- desktop mutates the managed config file directly
  - `studio.rs:3029-3056`
- frontend service paths go through Studio API for some cases
  - `instanceService.ts:451-456`
  - `instanceService.ts:486-495`
- frontend service paths edit local config snapshots for some cases
  - `instanceService.ts:498-529`
- frontend service paths patch the gateway directly for other cases
  - `instanceService.ts:532-567`

That means the authoritative configuration path is not stable.

The consequences are predictable:

- the frontend needs to understand too much integration policy
- config strategy is duplicated between frontend and desktop layers
- consistency, rollback, migration, and auditability become difficult

For built-in managed OpenClaw there must be one authority for writes, and all other mutations should route through that contract.

### P1. The workbench projection mixes too many data planes

`instanceWorkbenchService.ts` merges:

- backend detail / backend workbench
- gateway live data
- config-file snapshots
- mock fallback services

The key convergence points are:

- `instanceWorkbenchService.ts:1410-1445`
- `instanceWorkbenchService.ts:1473-1515`
- `instanceWorkbenchService.ts:1518-1556`

The current service is effectively "collect whatever data is available and merge it." That is useful for feature delivery, but it is not a clean runtime adapter.

The workbench needs a stable authority model:

- lifecycle and identity from the lifecycle manager / profile registry
- config from managed state
- real-time status from gateway admin access
- mock fallback only on mock platforms, not in the desktop built-in control path

### P1. Shell exposure is incorrectly treated as part of runtime activation

`path_registration.rs:24-58` does all of the following during built-in activation:

- writes `openclaw` shims
- mutates managed profile files
- mutates PATH / shell profile state

This capability is useful, but it is optional developer convenience. It is not required for the embedded runtime to function.

Keeping it in the activation chain adds:

- unnecessary first-run side effects
- unnecessary host-environment risk
- tighter coupling between embedded runtime and external CLI exposure

It should become a separate, opt-in capability:

- `Expose built-in OpenClaw CLI to shell`

### P1. The current path layout does not scale cleanly to multiple managed profiles

`paths.rs:158-166` currently defines a single managed layout:

- runtime under `machine/runtime/runtimes/openclaw`
- user area under `user_root/openclaw-home/.openclaw`
- workspace under `.openclaw/workspace`

That works for one built-in instance, but it is not ideal for:

- multiple built-in profiles
- side-by-side runtime slots
- rollback during runtime upgrades
- per-profile isolation of workspace, cron, skills, auth, and logs

The path model should become profile-based, for example:

- `managed-openclaw/profiles/<profileId>/runtime`
- `managed-openclaw/profiles/<profileId>/state`
- `managed-openclaw/profiles/<profileId>/workspace`
- `managed-openclaw/profiles/<profileId>/logs`
- `managed-openclaw/profiles/<profileId>/config/openclaw.json`

### P2. Version and capability contracts are under-defined

`prepare-openclaw-runtime.mjs:33-34` pins bundled versions, but the integration does not yet expose a strong runtime capability contract.

The system still needs an explicit handshake for:

- gateway protocol version
- admin API capabilities
- workbench projection capabilities
- supported config mutation capabilities

Without that contract:

- upgrading bundled runtime becomes risky
- UI may assume write support that runtime versions do not provide
- chat, tasks, files, agents, and skills may regress across versions without a clear compatibility signal

### P2. Chat routing assumes endpoint availability, but lifecycle readiness is not rich enough

`instanceChatRouteService.ts:114-160` largely assumes that if `baseUrl` or `websocketUrl` exists, chat can route.

For an embedded runtime that is incomplete. Built-in readiness should include:

- gateway handshake readiness
- auth-token readiness
- provider/model readiness
- default agent or default chat profile readiness

Otherwise the chat UI is forced to learn about failures only after routing has already been attempted.

## Upstream Alignment

The official OpenClaw references point in a clear direction:

- the bundled gateway pattern expects the host app to own packaging and supervision, but still treat gateway process management as an explicit subsystem concern
- the child-process guidance shows the official Mac app does not simply treat gateway as a throwaway child process tied blindly to the app lifecycle
- the multi-gateway guidance reinforces that separate runtimes need explicit boundaries around ports, locks, config, and state

Claw Studio can absolutely ship a built-in OpenClaw, but it needs to follow those same principles:

- runtime managed as a first-class subsystem
- per-profile isolation for multiple runtimes
- a direct, typed control plane
- clear separation between lifecycle, config, and UI projection

## Target Architecture

### 1. `EmbeddedOpenClawProvisioner`

Responsibilities:

- validate bundled runtime manifest
- install or upgrade runtime slots
- verify runtime compatibility
- run profile-level migrations

It should only make runtime bits available. It should not start the gateway, mutate PATH, or register instance state.

### 2. `OpenClawProfileRegistry`

Responsibilities:

- track `built-in`, `local-external`, and `remote` runtime profiles
- allocate stable profile ids
- map profiles into Studio instance records

Suggested profile kinds:

- `ManagedEmbeddedProfile`
- `ConnectedLocalProfile`
- `ConnectedRemoteProfile`

Studio instances should be projections of profile state, not the source of lifecycle truth.

### 3. `OpenClawManagedStateService`

Responsibilities:

- own profile-scoped directory layout
- own token, port, lock, workspace, logs, and config persistence policy
- compose baseline config and user-editable overlay config

Recommended config model:

- `baseline.json`
  - generated and enforced by Claw Studio
- `openclaw.json`
  - user-editable and advanced-feature editable

The runtime consumes an effective merged config, not a single file with mixed ownership.

### 4. `OpenClawLifecycleManager`

Responsibilities:

- own the runtime profile state machine
- drive start, stop, restart, upgrade, and recovery
- expose readiness, degraded, and failed semantics to the rest of the app

The supervisor becomes an execution mechanism under this manager, not the lifecycle owner.

### 5. `OpenClawGatewayAdminClient`

Responsibilities:

- call gateway admin endpoints through a typed protocol
- unify auth, timeout, retry, and diagnostics behavior
- replace CLI subprocess-based `gateway call` flows

The desktop control plane should stop shelling out through the OpenClaw CLI for managed runtime administration.

### 6. `OpenClawRuntimeAdapter`

Responsibilities:

- produce normalized `InstanceDetail` and `WorkbenchSnapshot`
- merge sources according to explicit authority rules

Recommended authority order:

- identity and lifecycle: lifecycle manager / profile registry
- config: managed state service
- real-time runtime status: gateway admin client
- mock fallback: web/mock platform only, never the desktop managed path

### 7. `OpenClawShellExposureService`

Responsibilities:

- optionally expose `openclaw` CLI to the user shell
- manage shims, PATH, and shell profile sourcing

This must be optional and independent from runtime activation.

## Product Model

### Primary path

After installing Claw Studio, the default story should be:

1. first launch provisions the built-in OpenClaw runtime
2. Claw Studio creates a default managed profile
3. gateway reaches ready state
4. the app exposes it as `Built-in OpenClaw`

### Secondary paths

Users can additionally choose:

- `Connect Existing OpenClaw`
- `Connect Remote OpenClaw`

### Tertiary paths

The current hub-installer external methods should move to:

- advanced tools
- migration flows
- operations flows

They should not remain on the primary embedded-runtime experience path.

## Lifecycle Design

Each runtime profile should use an explicit state model:

- `unprovisioned`
- `provisioning`
- `provisioned`
- `configuring`
- `starting`
- `ready`
- `degraded`
- `stopping`
- `stopped`
- `upgrading`
- `failed`

Key rules:

- `ready` must require gateway handshake plus critical capability checks
- `degraded` must exist for partial readiness and recovery scenarios
- the UI must not equate "process is alive" with "runtime is usable"

## Multiple Instances and Multiple Install Sources

One machine may contain all of the following at once:

- the Claw Studio built-in managed runtime
- a user-installed npm, pnpm, or source OpenClaw
- Docker, WSL, or remote OpenClaw deployments

The right abstraction is a unified profile registry, not a single blended install state.

Each profile should track:

- profile type
- lifecycle owner
- runtime location
- config location
- workspace location
- gateway endpoint
- auth strategy
- lifecycle capabilities

Ownership rules:

- `ManagedEmbeddedProfile`
  - full lifecycle owned by Claw Studio
- `ConnectedLocalProfile`
  - Claw Studio owns discovery and connection state only
- `ConnectedRemoteProfile`
  - Claw Studio owns remote connection state only

That separation is what makes built-in mode and external mode low-coupling.

## Recommended Rollout

### Phase 1. Split the activation chain

- move runtime lifecycle ownership out of `bootstrap`
- remove shell exposure from required activation
- project instance status from lifecycle state instead of directly mutating it during activation

### Phase 2. Replace CLI subprocess control with a typed admin client

- add `OpenClawGatewayAdminClient` on the desktop side
- replace `openclaw gateway call`
- route cron, channels, skills, agents, and config admin through one control plane

### Phase 3. Introduce profile registry and profile-scoped paths

- replace the `local-built-in` hard-coded model
- introduce built-in, external-local, and remote profiles
- move managed paths to profile-based layout

### Phase 4. Collapse config writes behind one authority

- built-in managed config writes go through one desktop contract
- frontend stops deciding whether to edit files or patch gateway directly
- split `openClawConfigService` into narrower services over time

### Phase 5. Rebuild the install and connection product flow

- make built-in runtime the default install experience
- move hub-installer external methods behind advanced entry points
- promote `Connect Existing` and `Connect Remote` as explicit secondary flows

### Phase 6. Add capability contracts and regression gates

- extend bundled runtime metadata with capability contract information
- perform startup capability handshake
- gate workbench and chat features based on runtime capabilities

## Verification Matrix

At minimum, the optimized integration should be verified for:

- fresh install, first launch, built-in runtime reaches ready automatically
- app restart restores the managed profile correctly
- gateway crash triggers recovery and reports correct lifecycle state
- shell exposure can be disabled without affecting embedded runtime function
- one built-in profile plus multiple external profiles can coexist cleanly
- port conflicts result in controlled recovery or a clear degraded state
- bundled runtime upgrades can roll forward and roll back safely
- chat only unlocks after runtime readiness is real
- agents, skills, channels, cron, files, and provider changes all flow through one admin contract

## Conclusion

The current Claw Studio embedded OpenClaw path is already functional, but it is not yet a clean embedded subsystem.

The core issue is not missing features. The core issue is boundary design:

- lifecycle, config, shell exposure, install product, instance registration, and workbench aggregation are still mixed together
- built-in runtime and external install flows are not cleanly separated
- the internal control plane still routes through CLI subprocesses

The correct next step is a structural convergence around a dedicated embedded runtime architecture:

- `EmbeddedOpenClawProvisioner`
- `OpenClawProfileRegistry`
- `OpenClawManagedStateService`
- `OpenClawLifecycleManager`
- `OpenClawGatewayAdminClient`
- `OpenClawRuntimeAdapter`
- `OpenClawShellExposureService`

That is the path to a Claw Studio experience that is:

- install-time built-in
- startup-ready
- lifecycle-safe
- multi-instance-manageable
- chat-stable
- high-cohesion and low-coupling
