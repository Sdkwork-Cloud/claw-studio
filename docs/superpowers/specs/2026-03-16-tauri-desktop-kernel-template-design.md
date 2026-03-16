# Tauri Desktop Kernel Template Design

## Goal

Turn `@sdkwork/claw-desktop` into a reusable, high-cohesion, low-coupling Tauri desktop template without changing the current product UI, route surface, or feature behavior.

The template must keep the current dual-host model intact while raising the native runtime to a framework-grade baseline for:

- filesystem and path governance
- security policy and command execution
- notifications and future permissions
- process and job orchestration
- extension and heterogeneous process integration
- pluggable storage backends
- future payment and remote service integration

## Constraints

### Product stability

- No product route changes.
- No feature behavior regressions.
- No visual changes.
- Web and desktop must continue to share the same shell and feature graph.

### Desktop template quality

- Native commands stay thin.
- Native capabilities are grouped into cohesive services.
- New capability domains must be addable without rewriting the command layer.
- Storage must become a plugin-style runtime capability instead of ad hoc file access.

### User workflow constraint

The user explicitly asked for autonomous execution without iterative requirement questioning. This design therefore selects the recommended path directly and treats the current requirements as approved scope.

## Current Gaps

The current desktop runtime is already service-oriented, but the kernel is still missing several template-grade properties:

- `AppConfig` is flat and not future-safe for expanding native capability domains.
- `AppPaths` does not yet reserve first-class runtime directories for storage, plugins, backups, and integrations.
- `FrameworkServices` is useful, but it does not yet expose a stable kernel snapshot describing native capability domains.
- There is no pluggable storage registry or storage profile system.
- Native storage behavior is currently spread across config persistence and managed filesystem helpers instead of a dedicated storage kernel.
- Future domains such as notifications, permissions, payments, and integration bridges do not yet have a stable architectural home.

## Options Considered

### Option A: plugin-first expansion

Adopt several off-the-shelf Tauri plugins immediately and let those plugins define the runtime shape.

Pros:

- fast initial feature count
- less first-party Rust code

Cons:

- weak architectural control
- inconsistent APIs across domains
- harder to preserve a reusable internal kernel contract

### Option B: first-party kernel with capability registry

Keep plugins as implementation details, but define a first-party kernel contract for native capability domains. Use services and profiles for runtime composition, and expose stable DTO snapshots through thin commands.

Pros:

- best long-term cohesion
- clear extension seams
- testable domain boundaries
- strongest fit for a reusable template

Cons:

- more initial framework work
- requires disciplined schema design

### Option C: keep current structure and add features ad hoc

Continue adding command files and helpers only when the product needs them.

Pros:

- low short-term cost

Cons:

- will eventually collapse into tightly coupled desktop code
- no reusable template baseline
- storage and integration sprawl remain unresolved

## Recommendation

Use Option B.

The runtime already has enough foundation to justify a real kernel abstraction layer. The highest-leverage next step is not a UI change or more one-off commands; it is a stronger native protocol:

- versioned desktop config
- expanded runtime path model
- capability-aware kernel snapshot
- pluggable storage registry with provider profiles

## Target Architecture

### Layering

```text
src-tauri/src/
  app/
    bootstrap.rs              # builder composition and state wiring
  commands/
    *.rs                      # thin protocol adapters only
  framework/
    config.rs                 # versioned runtime config schema
    paths.rs                  # managed runtime directories
    policy.rs                 # execution and path policy
    storage.rs                # storage DTOs and provider contracts
    context.rs                # DI assembly
    services/
      system.rs               # OS/device/runtime metadata
      filesystem.rs           # managed FS operations
      process.rs              # controlled child-process execution
      jobs.rs                 # job orchestration
      browser.rs              # external browser bridge
      dialog.rs               # desktop dialogs
      storage.rs              # provider registry and profile resolution
```

### Kernel capability domains

The desktop template should standardize these domains now, even when some of them are only partially implemented in phase 1:

- `filesystem`
- `security`
- `process`
- `jobs`
- `storage`
- `notifications`
- `permissions`
- `integrations`
- `payments`

The key rule is that every domain gets a stable home in config, DTO snapshots, and service composition before feature-specific logic starts depending on it.

## Storage Architecture

### Principles

- Storage is a kernel capability, not a page concern.
- The active storage implementation is selected through named profiles.
- Providers advertise capability metadata even when they are not active.
- The runtime must support local and remote storage strategies behind one contract.

### Provider model

Built-in provider kinds:

- `memory`
- `localFile`
- `sqlite`
- `postgres`
- `remoteApi`

Each provider exposes:

- provider id
- provider kind
- human label
- capability flags
- availability state
- whether configuration is required

### Profile model

A storage profile binds a provider kind to runtime configuration, for example:

- `default-local`
- `default-sqlite`
- `team-postgres`
- `cloud-api`

Profiles are config data, not code. This is what makes the storage layer pluggable.

### Phase 1 implementation choice

In this round, implement a first-party storage kernel with:

- a profile registry
- provider descriptors
- a managed local-file default profile
- platform DTOs to expose capability state

The architecture must be ready for `sqlite`, `postgres`, and `remoteApi` adapters without forcing immediate product use of those backends.

## Config And Path Model

### Config

Replace the flat desktop config shape with a versioned schema that still preserves the existing fields used by the product today.

Top-level sections:

- `version`
- `distribution`
- `logLevel`
- `theme`
- `telemetryEnabled`
- `security`
- `storage`
- `notifications`
- `payments`
- `integrations`
- `process`

Every section must deserialize safely from older configs through defaults.

### Paths

Reserve explicit native directories for:

- `storage`
- `plugins`
- `integrations`
- `backups`

This creates a stable disk layout for future runtime, plugin, and data work while keeping all paths under managed roots.

## Native Snapshot Contract

Add a native kernel snapshot command that lets desktop clients inspect the assembled runtime without coupling to internal Rust modules.

The snapshot should report:

- capability domain readiness
- active storage profile
- configured storage profiles
- available storage providers
- managed runtime directories

This becomes the future anchor for diagnostics, settings, runtime health, installer flows, and extension tooling.

## Delivery Strategy

### Phase 1

- expand config and managed paths
- add storage DTOs and storage service
- wire storage into `FrameworkServices`
- expose kernel snapshot and storage snapshot commands
- add bridge and infrastructure types

### Phase 2

- add secure secret storage and permission policy snapshots
- add notification capability service and frontend bridge
- add process profile registry and integration profiles

### Phase 3

- add concrete sqlite adapter
- add postgres adapter
- add remote API adapter
- add payment/provider integration envelopes

## Verification

Required verification for this phase:

- desktop architecture contract test
- Rust unit tests for config defaults, path creation, and storage registry behavior
- `pnpm check:desktop`
- `pnpm lint`
- `pnpm build`
