# Tauri Process Service Modularization Design

## Goal

Refactor the desktop process kernel into a modular, template-grade architecture without changing product UI, route surface, process command contracts, or job behavior.

The process domain must remain capable of controlled child-process execution, event streaming, cancellation, and future heterogeneous runtime integrations while becoming easier to extend and reason about.

## User Workflow Constraint

The user explicitly requested autonomous execution without iterative approval prompts. This design therefore treats the current direction as approved scope and proceeds with the recommended option directly.

## Current Gap

`packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs` currently mixes:

- process request DTOs and validation
- environment sanitization and working-directory resolution
- process profile registry and kernel snapshot projection
- active process registry and cancellation control
- stdout and stderr streaming
- timeout and lifecycle orchestration
- runtime result mapping
- domain tests

This weakens the desktop template in three ways:

- process extension seams are unclear
- security-sensitive request preparation is harder to audit
- future process adapters and profile registries will increase coupling further

## Options Considered

### Option A: keep the monolith

Pros:

- lowest short-term cost

Cons:

- poor cohesion
- weak auditability for process policy boundaries
- poor fit for a reusable Tauri kernel

### Option B: split only request validation

Pros:

- improves one high-risk boundary
- reduces some local complexity

Cons:

- runtime execution and profile registry stay tangled
- only partial template improvement

### Option C: split process into facade, profiles, requests, and runtime

Pros:

- clear extension seams for future profile registries and adapters
- isolates security-sensitive request preparation
- isolates execution lifecycle and active-process registry
- best fit for a reusable Tauri kernel template

Cons:

- more refactor work now

## Recommendation

Use Option C.

The public `ProcessService` should become a thin facade over three dedicated concerns:

- `profiles`: built-in profile registry, profile resolution, and kernel projection
- `requests`: process request DTOs, policy validation, cwd resolution, environment sanitization, and command formatting helpers
- `runtime`: active process registry, event sink types, output collection, timeout/cancellation handling, and result mapping

## Target Architecture

### Module layout

```text
framework/services/
  process.rs                # public facade + re-exports only
  process/
    profiles.rs             # process profiles and kernel projection
    requests.rs             # request validation and policy preparation
    runtime.rs              # active process runtime and output streaming
```

### Boundary rules

- `ProcessService` remains the only consumer-facing Rust entry point used by commands and jobs
- command modules stay thin and continue depending only on `ProcessService` and its public DTOs
- `JobService` keeps calling `resolve_profile`, `run_profile_and_emit_with_started`, and `cancel`
- process output event contracts remain unchanged
- security policy enforcement stays inside request preparation and never leaks into commands

## Testing Strategy

- add a structural contract requiring the new process module layout
- move process tests closer to the modules they validate
- rerun desktop contracts, lint, and both host builds
- keep recording the known Rust GTK / pkg-config environment blocker separately from code regressions
