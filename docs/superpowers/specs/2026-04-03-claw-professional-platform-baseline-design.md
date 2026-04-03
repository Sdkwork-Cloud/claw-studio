# Claw Professional Platform Baseline Design

**Date:** 2026-04-03

## Goal

Freeze the next stable architecture baseline for `Claw Studio` so the codebase can move from broad platform exploration into disciplined implementation.

This baseline must:

- preserve one product with multiple runtime shells
- keep one shared browser app instead of splitting a second admin frontend
- professionalize `server` mode into a real control plane
- preserve `desktop` as a first-class local runtime
- support `server`, `desktop`, `container`, and `kubernetes` delivery without fragmenting the model
- define the shortest safe path from the current implementation to a production-grade platform

## Why This Spec Exists

The current spec set already contains the right long-term direction:

- unified multi-shell platform
- canonical management resource model
- compatibility gateway with `/claw/*` plus official alias paths
- plugin, storage, cache, security, and observability extension points

The current implementation is also no longer at zero:

- shared host core exists
- `sdkwork-claw-server` exists and serves the browser app
- `/claw/internal/v1/*`, `/claw/manage/v1/rollouts*`, `/claw/api/v1/discovery`, and `/claw/openapi/*` exist
- packaging and release automation already cover `desktop`, `server`, `container`, and `kubernetes`

What is still missing is a professional execution baseline that narrows the architecture into the next correct implementation path. Without that narrowing, the codebase risks drifting in three bad ways:

1. continuing to grow the server as a rollout-only slice
2. expanding contracts and projections without locking canonical resources first
3. creating too many premature packages and crates before the next durable boundaries are proven

This spec resolves that.

## Current Reality Snapshot

The current codebase should be treated as:

- a valid Phase 1 host-platform slice
- a valid release packaging foundation
- an incomplete control plane

The server is not yet a full management platform. It is a partial shell that already proves:

- shared host-core bootstrapping
- browser asset serving
- internal node-session coordination
- rollout control-plane read and action flows
- basic OpenAPI publication

But it does not yet prove:

- canonical management resources beyond rollout
- platform-grade auth and RBAC
- production data infrastructure
- compatibility gateway publication
- plugin runtime isolation and governance
- production observability

## Option Analysis

### Option A: Keep extending the current server slice incrementally

This would continue adding routes under the existing server shell one feature at a time.

Pros:

- lowest short-term cost
- minimal immediate refactoring

Cons:

- keeps the current rollout-first distortion in place
- makes `manage.ts` and the browser bridge drift from the target resource model
- encourages more DTO duplication and route-shape debt
- increases the chance that security, storage, and gateway work attach to unstable surfaces

Decision: reject.

### Option B: Professionalize the control plane first on top of the current host core

This keeps the current architecture direction, but freezes the next implementation sequence:

1. canonical management resources
2. security plane
3. data plane
4. observability plane
5. compatibility gateway
6. plugin runtime
7. `node` and later `operator`

Pros:

- shortest path from current implementation to a professional platform
- reuses the current host-core and server investment
- creates stable attachment points for later work
- reduces the risk of frontend and server contract drift

Cons:

- requires saying no to several parallel feature ideas for a while
- delays some visually obvious features in favor of platform correctness

Decision: recommended.

### Option C: Start a parallel platform rewrite

This would create a new set of crates and contracts immediately and migrate later.

Pros:

- theoretical long-term cleanliness

Cons:

- duplicates platform effort while the current stack is already viable
- delays delivery
- creates a high risk of abandoned intermediate architecture

Decision: reject.

## Final Decision

`Claw Studio` should now follow **Option B: control-plane-first professionalization on the existing shared host core**.

This means:

- keep the current multi-shell direction
- stop broad architecture churn
- stop adding ad hoc server routes without canonical resource ownership
- stop expanding compatibility and plugin work before security and data foundations exist
- use the next implementation phase to turn the server into a real control plane

## Non-Negotiable Architecture Rules

### 1. One product, multiple runtime shells

`desktop`, `server`, future `node`, and future `operator` are deployment shells for one logical platform, not separate products.

### 2. One browser app artifact

The React workspace remains the only browser product surface.

Rules:

- `desktop` hosts it inside the native shell
- `server` hosts it with the built-in Rust web server
- no second admin frontend stack is introduced

### 3. Canonical management resources come before more server features

`/claw/manage/v1/*` must become resource-oriented before the server grows more isolated special-purpose APIs.

### 4. Platform-native APIs and compatibility APIs are separate contracts

Rules:

- `/claw/api/v1/*` is the native product API family
- `/claw/manage/v1/*` is the canonical management family
- `/claw/internal/v1/*` is for system coordination only
- `/claw/gateway/*` is the governed compatibility family
- `/v1/*` and `/v1beta/*` are official compatibility alias paths and must be contract-isomorphic to the governed gateway roots

### 5. `/claw/` stays authoritative for platform APIs

All platform-owned APIs must remain rooted under `/claw/`.

Compatibility aliases without `/claw/` are an exception only for upstream-client compatibility.

### 6. Do not explode the package graph prematurely

The architecture should not create a dozen new workspace packages or Rust crates in one step.

Immediate package policy:

- keep `sdkwork-claw-host-core`, `sdkwork-claw-server`, and `sdkwork-claw-desktop` as the main implementation anchors
- add `sdkwork-claw-node` only when remote node runtime work begins
- defer `sdkwork-claw-operator` until the control plane and node shell stabilize
- keep additional Rust crate extraction inside `host-core` and `server` deferred until a boundary has multiple consumers or independent release pressure

This is a deliberate correction to over-eager crate decomposition.

## Target Runtime Modes

The baseline runtime modes are:

### Desktop combined mode

Owns:

- local browser or native shell UI
- local control plane
- local node host
- local storage
- local compatibility gateway

This remains the best default for local users.

### Server combined mode

Owns:

- browser management UI
- control-plane APIs
- management APIs
- local node workload when enabled
- local compatibility gateway
- server-side data plane

This is the best default for single-machine deployments.

### Server control-plane-only mode

Owns:

- browser management UI
- control-plane and management APIs
- cluster inventory
- policy reconciliation

It does not need to run a local node workload.

### Node runtime-only mode

Owns:

- local runtime workload
- local compatibility gateway when enabled
- health, lifecycle, logs, and upgrades

It is controlled remotely by the control plane.

## API Plane Baseline

The authoritative route families are:

- `/claw/health/live`
- `/claw/health/ready`
- `/claw/health/metrics`
- `/claw/health/deps`
- `/claw/openapi/discovery`
- `/claw/openapi/v1.json`
- `/claw/api/v1/*`
- `/claw/manage/v1/*`
- `/claw/internal/v1/*`
- `/claw/admin/v1/*`
- `/claw/gateway/openai/v1/*`
- `/claw/gateway/anthropic/v1/*`
- `/claw/gateway/gemini/v1beta/*`
- `/claw/gateway/gemini/v1/*`
- official alias roots `/v1/*` and `/v1beta/*`

### Immediate route-family priority

Only these families should expand in the next implementation phase:

- `/claw/manage/v1/*`
- `/claw/internal/v1/*`
- `/claw/openapi/*`
- `/claw/health/*`

The compatibility gateway and broader `/claw/api/v1/*` product APIs must wait until the control-plane baseline is stable.

## Management Resource Baseline

The next implementation phase should lock these resources first:

- `installation`
- `storage-profiles`
- `cache-profiles`
- `nodes`
- `rollouts`
- `secret-records`

These are the correct first-class resources because they establish:

- installation identity
- active data infrastructure
- node inventory
- deployment orchestration
- secure config binding

The following resources are phase-next, not phase-now:

- `tenants`
- `workspaces`
- `gateway-credentials`
- `gateway-routes`
- `model-policies`
- `plugin-activations`
- `plugin-packages`

They remain part of the target model, but they should not block the next server professionalization slice.

## Security Plane Baseline

The platform must stop treating Basic Auth as the long-term control-plane model.

### Immediate rules

- Basic Auth remains allowed only for bootstrap, local development, and break-glass recovery
- management tokens become the long-term human and automation auth mechanism
- internal node coordination gets a dedicated service identity model
- compatibility credentials remain distinct from management credentials
- plugin sidecars must never inherit platform-owner credentials implicitly

### Required authorization model

Authorization must combine:

- principal roles
- token scopes
- scope ownership
- resource policy
- runtime safety policy

### Initial role baseline

- `installation-owner`
- `tenant-admin`
- `tenant-operator`
- `workspace-admin`
- `workspace-developer`
- `workspace-viewer`
- `security-auditor`

## Data Plane Baseline

The data architecture should become opinionated instead of abstractly “supporting many databases”.

### Desktop

Desktop remains SQLite-first.

Rules:

- SQLite is the only required desktop durable store
- Redis is not required for desktop combined mode

### Server single-node

Single-node server may run on:

- SQLite for small/local deployments
- PostgreSQL for production-ready deployments

### Server production and multi-node

Production server should standardize on:

- PostgreSQL as the primary durable store
- Redis as the cache, session, lock, and rate-limit provider

### Provider strategy

Built-in first-class providers should be:

- durable state: `sqlite`, `postgres`
- cache and coordination: `redis`
- bootstrap or fallback only: `json-file`

`json-file` should be treated as a transitional or developer mode only, not a professional deployment target.

## Observability Baseline

Observability must become a first-class subsystem, not a later add-on.

The minimum production baseline is:

- structured logs
- correlation IDs
- audit records for privileged actions
- request and route metrics
- node and dependency health
- distributed tracing hooks

The platform should expose:

- `/claw/health/live`
- `/claw/health/ready`
- `/claw/health/metrics`
- `/claw/health/deps`

Audit must be modeled separately from metrics and tracing.

## Plugin Baseline

Plugins remain part of the target architecture, but they should not be the next implementation slice.

The baseline plugin model is:

- builtin plugin
- WASM plugin
- sidecar plugin

Rules:

- every plugin is registered through a manifest
- permissions are explicit
- signature and trust policy are explicit
- plugin HTTP surfaces live under platform-governed roots only
- no plugin may claim top-level `/claw/api/*`, `/claw/manage/*`, or compatibility alias roots directly

## Packaging And Deployment Baseline

The current release matrix is directionally correct and should be preserved.

Authoritative product outputs:

- desktop bundles for Windows, Linux, and macOS
- server archives for Windows, Linux, and macOS
- container bundles for Linux CPU and GPU variants
- Kubernetes bundles for Linux CPU and GPU variants

### Packaging rule

Future work should extend the existing release-profile abstraction rather than inventing a second release system for `node` or later `operator`.

## Contract Governance Baseline

The codebase should stop allowing three parallel source-of-truth layers.

Preferred contract chain:

1. canonical management and platform schemas
2. Rust DTOs and route handlers
3. OpenAPI publication
4. TypeScript consumer contracts and SDK bridge projections

Until automated generation is introduced, manual OpenAPI publication remains acceptable, but it must be treated as a transition step only.

## What Not To Do Next

The next phase should explicitly avoid:

- introducing a second frontend stack
- implementing broad `/claw/api/v1/*` product resources before the control plane is stable
- implementing the compatibility gateway before security and data foundations exist
- shipping a plugin runtime before trust and permissions are defined in code
- introducing many new crates purely for conceptual neatness
- treating `json-file` as a production data strategy

## Implementation Sequence

The required sequence is:

1. canonical management resource foundation
2. security plane foundation
3. production data plane foundation
4. observability plane foundation
5. compatibility gateway publication
6. plugin runtime
7. `node` shell
8. later `operator`

## Exit Criteria For Stable Coding

The architecture is considered stable enough for full implementation when these conditions are accepted as fixed:

- one browser app artifact
- shared host core remains the implementation spine
- `server` professionalization starts with canonical management resources
- security is elevated before compatibility and plugin work
- SQLite, PostgreSQL, and Redis are the primary built-in data choices
- compatibility aliases remain same-domain and isomorphic to governed gateway paths
- `node` and `operator` are deferred until after the control plane is professionalized

This spec declares those conditions fixed.

