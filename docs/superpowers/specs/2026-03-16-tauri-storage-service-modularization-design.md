# Tauri Storage Service Modularization Design

## Goal

Refactor the desktop storage kernel into a modular template-grade architecture without changing current product behavior, UI, route surface, or bridge APIs.

The storage domain must stay fully pluggable for local file, memory, sqlite, postgres, and remote API backends, while becoming easier to extend and reason about.

## User Workflow Constraint

The user explicitly requested autonomous execution without iterative approval prompts. This design therefore treats the current direction as approved scope and proceeds with the recommended option directly.

## Current Gap

The storage kernel already supports executable drivers and a registry-based service, but `framework/services/storage.rs` has grown into a monolith that mixes:

- public service orchestration
- profile normalization and active-profile resolution
- provider capability metadata
- driver registry wiring
- local-file and memory driver implementations
- placeholder driver behavior
- domain tests

This weakens the template in three ways:

- storage concerns are harder to extend independently
- the public service contract is harder to review for safety
- future backends such as sqlite, postgres, and remote API will keep increasing coupling

## Options Considered

### Option A: keep the monolith

Pros:

- lowest short-term cost

Cons:

- poor cohesion
- harder to reason about future backend additions
- weaker fit for a reusable desktop template

### Option B: split only driver implementations

Pros:

- reduces some file size
- isolates local-file and memory mechanics

Cons:

- profile resolution and provider metadata still remain tangled in the service file
- only partial improvement

### Option C: split storage into service facade, profile resolver, registry, and drivers

Pros:

- strongest boundary clarity
- clean extension seam for new drivers
- profile resolution becomes testable independently
- best fit for a reusable Tauri kernel template

Cons:

- more refactor work now

## Recommendation

Use Option C.

The public `StorageService` should become a thin facade over three dedicated concerns:

- `profiles`: normalize config, resolve active profiles, produce public storage snapshots, and build `StorageDriverScope`
- `registry`: own `StorageDriver`, `StorageDriverRegistry`, provider capability metadata, and built-in registry composition
- `drivers`: implement `local-file`, `memory`, and placeholder unavailable drivers

## Target Architecture

### Module layout

```text
framework/services/
  storage.rs               # public facade + re-exports only
  storage/
    profiles.rs            # profile normalization and scope resolution
    registry.rs            # trait, provider catalog, registry injection
    drivers.rs             # local-file, memory, unavailable drivers
```

### Boundary rules

- `StorageService` remains the only consumer-facing Rust entry point inside `FrameworkServices`
- commands stay thin and continue calling the service facade only
- TypeScript bridge and runtime contracts stay unchanged
- raw connection and endpoint fields remain internal and never cross the public runtime boundary

## Testing Strategy

- extend the storage contract test to require the new module layout
- keep existing storage behavior tests, but move them closer to the modules they validate
- rerun storage contracts, desktop checks, lint, and both host builds
- keep recording the known Rust GTK / pkg-config environment blocker separately from code regressions
