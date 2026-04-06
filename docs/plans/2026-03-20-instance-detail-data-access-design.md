# Instance Detail Data Access Design

**Date:** 2026-03-20

**Status:** Autonomous approval by requirement owner. The user explicitly required self-directed iteration without waiting for another review round.

## Goal

Deepen the existing instance detail architecture so `claw-studio` can explain, for every instance:

- how Claw Studio connects to the runtime
- which data surfaces are read from managed local files, remote endpoints, storage bindings, or metadata only
- which local and remote artifacts are authoritative for operations
- how the product should present those differences across OpenClaw, ZeroClaw, IronClaw, and future runtimes

This slice must improve truthfulness without coupling the UI to one upstream runtime.

## Problem

The current overview already exposes runtime identity, storage, connectivity, health, and official notes, but it still leaves one major operator question under-modeled:

- where exactly does each detail surface come from?

Today the page can show:

- runtime kind
- deployment mode
- transport
- connectivity endpoints
- storage binding
- health and observability

But it cannot yet clearly answer:

- can Claw Studio read config directly from a managed file?
- are logs local, remote, or unavailable?
- is the file workspace real or only planned?
- does memory come from SQLite/PostgreSQL/remote API metadata?
- for remote ZeroClaw or IronClaw, which surfaces are metadata-only versus truly integrated?

Without this layer, the page still risks looking more integrated than it really is.

## Upstream Reality

### OpenClaw

Official docs show:

- the Gateway WebSocket is the primary control plane
- WebChat talks to the Gateway directly
- the OpenAI-compatible `/v1/chat/completions` endpoint is optional and served on the same gateway

Implication:

- built-in OpenClaw detail should describe managed local config/log/workspace artifacts plus loopback gateway endpoints
- local-managed OpenClaw can expose direct-file access routes that are authoritative

### ZeroClaw

Official repo/docs show:

- a single Rust binary
- `zeroclaw gateway` exposes a gateway plus dashboard
- `zeroclaw daemon` exposes a fuller runtime
- there are first-class operational surfaces around memory, tasks, auth profiles, and diagnostics

Implication:

- remote or local-external ZeroClaw should expose endpoint-backed and metadata-backed access routes, but not pretend Claw Studio owns local files unless explicitly configured
- dashboard and gateway are first-class artifacts

### IronClaw

Official repo/docs show:

- PostgreSQL plus `pgvector` is foundational
- the gateway is realtime-oriented
- persistent memory and secure execution boundaries matter

Implication:

- IronClaw detail must highlight database and remote gateway artifacts as first-class operator surfaces
- data access should emphasize storage binding, remote observability posture, and metadata/trust boundaries

## Approaches Considered

### Approach 1: Keep everything inside capability/status text only

Pros:

- smallest code delta

Cons:

- still too implicit
- operators cannot tell where data comes from
- hard to evolve into a real SQL-backed detail model

Rejected.

### Approach 2: Fully migrate every deep section to backend truth in one pass

Pros:

- ideal end state

Cons:

- too large and risky for the current workspace state
- would mix multiple migrations together and reduce reviewability

Rejected for this slice.

### Approach 3: Add explicit `dataAccess` and `artifacts` snapshots to the existing instance detail contract

Pros:

- gives a truthful operator view now
- keeps the page runtime-neutral
- improves section degradation messages without blocking future deep adapters
- maps cleanly to SQL-ready relational tables later

Cons:

- does not fully replace mock-backed deep sections yet
- requires careful wording so “available route” is not confused with “fully integrated section”

Chosen.

## Design

### 1. Add `dataAccess` to `StudioInstanceDetailRecord`

`dataAccess` should model how Claw Studio can obtain a given surface.

Each access route should describe:

- `id`
- `label`
- `scope`: `config | logs | files | memory | tasks | tools | models | connectivity | storage`
- `mode`: `managedFile | managedDirectory | storageBinding | remoteEndpoint | metadataOnly`
- `status`: `ready | limited | configurationRequired | planned | unavailable`
- `target`: local path, URL, namespace, or database hint
- `readonly`
- `authoritative`
- `detail`
- `source`

This allows the page to distinguish:

- direct and trustworthy
- indirect but usable
- merely configured
- planned but not yet integrated

### 2. Add `artifacts` to `StudioInstanceDetailRecord`

`artifacts` should model concrete operator-visible resources.

Each artifact should describe:

- `id`
- `label`
- `kind`: `configFile | logFile | workspaceDirectory | runtimeDirectory | endpoint | storageBinding | dashboard`
- `status`: `available | configured | missing | remote | planned`
- `location`
- `readonly`
- `detail`
- `source`

Examples:

- built-in OpenClaw config file
- built-in OpenClaw workspace directory
- built-in OpenClaw gateway log file
- ZeroClaw dashboard endpoint
- IronClaw PostgreSQL binding

### 3. Keep capabilities and deep sections separate

Capabilities answer:

- does the runtime conceptually support this surface?

Data access answers:

- how can Claw Studio obtain it today?

Artifacts answer:

- what exact local or remote thing does the operator inspect?

This separation is important because:

- a runtime may support memory, but Claw Studio may currently expose only the storage binding and metadata
- a managed OpenClaw runtime may have a real workspace directory even before the full file adapter is implemented

### 4. Instance Detail UX Changes

The `overview` section should add two new blocks:

- `Data Access`
- `Artifacts`

`Data Access` should help the operator understand the data plane:

- scope
- route mode
- readiness
- authoritative vs derived
- writable vs read-only

`Artifacts` should help the operator inspect concrete resources:

- file paths
- directories
- URLs
- storage/database locations

### 5. Section Degradation Logic

Deep workbench sections should remain in place, but the explanatory fallback should become smarter.

Examples:

- built-in OpenClaw files section may explain that the runtime workspace exists locally and is authoritative, while the richer runtime file adapter is still evolving
- remote ZeroClaw files/tools should explain that Claw Studio currently has endpoint and metadata visibility, not direct file ownership
- IronClaw memory/tasks should highlight that storage is authoritative while runtime-specific APIs remain integration work

## Runtime Mapping Rules

### Built-in OpenClaw

- `config`: managed local file, authoritative
- `logs`: managed local file, authoritative
- `files`: managed local directory, authoritative path exposure
- `memory/tasks`: storage binding, durable local profile
- `connectivity`: loopback gateway WS plus HTTP/OpenAI endpoint

### Local-external ZeroClaw

- `config/logs/files`: metadata only unless explicit paths are configured
- `connectivity`: configured HTTP/WS endpoints
- `tasks/memory/tools`: remote endpoint or metadata-only depending on available URLs and storage binding

### Remote ZeroClaw

- `connectivity`: remote gateway plus dashboard
- `storage`: storage binding metadata
- `tasks/memory/tools`: metadata-only or remote endpoint-backed, not local file-backed

### Remote IronClaw

- `storage`: PostgreSQL binding is first-class and authoritative
- `connectivity`: remote gateway and realtime surface
- `logs`: metadata-only unless remote observability integration exists
- `memory/tasks`: storage-backed, but integration detail may still be planned

## Database Design Direction

The SQL-ready target model for this slice should add:

- `instance_data_access_routes`
- `instance_artifacts`

Recommended semantics:

- `instance_data_access_routes`
  - normalized by `instance_id + scope + route_id`
  - records mode, status, target, authority, mutability, and source
- `instance_artifacts`
  - normalized by `instance_id + artifact_id`
  - records kind, status, location, and whether the resource is local or remote

This layers cleanly on top of the previously defined:

- `instances`
- `instance_endpoints`
- `instance_storage_bindings`
- `instance_health_snapshots`
- `instance_capability_snapshots`
- `instance_observability_snapshots`

## Success Criteria

- instance detail can explicitly explain how each runtime surface is linked and read
- built-in OpenClaw exposes authoritative managed file and directory artifacts
- ZeroClaw and IronClaw no longer look like shallow OpenClaw variants
- the product copy distinguishes “supported by runtime” from “integrated by Claw Studio”
- the data model remains SQL-ready and runtime-neutral
