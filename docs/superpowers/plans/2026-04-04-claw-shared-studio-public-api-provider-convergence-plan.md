# Claw Shared Studio Public API Provider Convergence Plan

**Date:** 2026-04-04

## Context

After closing the release and deployment packaging slice, the next architectural blocker is no longer packaging or browser bridge parity. It is the missing convergence of the canonical studio public API between `desktopCombined` and pure `server` mode.

The codebase already proves that the target model is viable:

- desktop embedded host publishes working canonical `/claw/api/v1/studio/*` routes
- browser-side desktop bridge already treats canonical studio and manage APIs as HTTP-first
- server already owns the canonical `/claw/*` router, OpenAPI publication, health, manage, and internal surfaces

But the pure `server` shell still does not provide the same studio business surface that desktop embedded host already exposes.

## Review Findings

### Finding 1: Pure server mode still ships canonical studio routes that are structurally unavailable

Evidence:

- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`

The server router publishes `/claw/api/v1/studio/*`, but `ServerState.studio_public_api` is still initialized as `None` in the current server bootstrap paths. The current server tests in `main.rs` explicitly lock that behavior in by expecting `studio_public_api_unavailable`.

Consequence:

- standalone `server`
- `docker`
- `kubernetes`

all expose the canonical route family without exposing the canonical business behavior behind it.

This is the largest remaining violation of the one-host-runtime design.

### Finding 2: Desktop already contains the missing provider, but only as a desktop-coupled implementation

Evidence:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

`DesktopStudioPublicApiProvider` already implements the complete `StudioPublicApiProvider` trait and backs the embedded host with real behavior. However, it is tightly coupled to desktop-only framework types:

- `AppPaths`
- `AppConfig`
- `StorageService`
- `SupervisorService`
- `StudioService`

Consequence:

- the implementation cannot be reused by pure `server`
- the only working canonical studio public API currently lives inside the desktop shell
- the codebase is still carrying business logic at the wrong shell layer

### Finding 3: Desktop browser transport is converged earlier than the host business layer

Evidence:

- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

Desktop browser code already routes canonical studio, manage, and internal APIs through the embedded host over HTTP-first transport. This is correct.

However, Tauri still exposes a broad `studio_*` business command surface, and the workspace still has raw command-level expectations for those bridge commands.

Consequence:

- transport convergence is ahead of host convergence
- shrinking Tauri business commands now would be premature
- the next step must be server-side business convergence first, not command deletion first

### Finding 4: The main convergence plan needs an explicit shared provider extraction slice

Evidence:

- `docs/superpowers/plans/2026-04-04-claw-one-host-runtime-multi-shell-convergence-implementation-plan.md`

The main plan covers:

- embedded host boot
- HTTP-first browser bridge
- endpoint governance
- release closure

But it does not explicitly isolate the missing shared `StudioPublicApiProvider` extraction as its own task.

Consequence:

- implementation work can drift into shell-specific patching
- server may be tempted to copy desktop business logic
- desktop may retain business Tauri commands longer than necessary because the server parity task is underspecified

## Architecture Decision

Introduce a new shared Rust host-side module or crate that owns the canonical studio public API business behavior independently of both shells.

### Recommended form

Create a new shared Rust crate:

- `packages/sdkwork-claw-host-studio/src-host`

Recommended crate name:

- `sdkwork-claw-host-studio`

### Why a separate Rust crate is the best next move

Do this because:

- `desktop` already depends on `sdkwork-claw-server`
- `server` cannot depend on `desktop`
- shared host business logic cannot live in either shell without recreating the same layering problem

Do not do this as a TypeScript package.
Do not do this by copying the desktop provider into server.
Do not do this by adding a `server -> desktop` Rust dependency.

## Target Responsibility Split

### `sdkwork-claw-host-studio`

Own:

- canonical `StudioPublicApiService`
- authoritative request and projection models for `/claw/api/v1/studio/*`
- serialization and deserialization boundaries
- shell-neutral business orchestration
- shell-neutral provider traits for:
  - state persistence
  - runtime process control
  - log access
  - OpenClaw gateway delegation

Do not own:

- Axum route wiring
- Tauri command wiring
- tray or window behavior
- desktop-only config loading
- server CLI parsing

### `sdkwork-claw-server`

Own:

- Axum route exposure
- auth and HTTP envelopes
- server runtime config and persistence adapters
- service lifecycle and server-side runtime adapters

Use `sdkwork-claw-host-studio` to satisfy `StudioPublicApiProvider`.

### `sdkwork-claw-desktop`

Own:

- shell-only adapters
- Tauri command compatibility layer during migration
- desktop-specific supervisor and storage adapters
- embedded host bootstrap

Use the same `sdkwork-claw-host-studio` service for canonical public studio routes.

## Implementation Order

### Phase 1: Freeze the missing convergence contract

Add or update tests that verify:

- pure server default runtime can return canonical studio instance projections instead of `studio_public_api_unavailable`
- desktop embedded host still returns the same canonical public studio responses
- browser bridge remains HTTP-first for canonical studio APIs
- Tauri `studio_*` commands are explicitly transitional and not the authoritative browser path

### Phase 2: Extract shared host-studio service crate

Create:

- shell-neutral DTOs and serde models
- traits for storage, supervisor, and logs access
- canonical `StudioPublicApiService`

### Phase 3: Adapt desktop to the shared service

Replace desktop-local provider internals so that:

- `DesktopStudioPublicApiProvider` becomes a thin adapter
- existing desktop behavior remains unchanged
- embedded host tests remain green

### Phase 4: Add server adapter and enable the pure server provider

Implement server-side adapters for:

- state storage
- runtime process and status projection
- config projection
- log access

Wire `ServerState.studio_public_api` to `Some(...)` in the standard server bootstrap path.

### Phase 5: Reduce direct Tauri studio business commands

Only after server and desktop both use the shared host-studio crate:

- demote `studio_*` Tauri business commands to migration wrappers
- remove remaining browser-path dependencies on those commands
- keep only shell-only commands and transitional compatibility entrypoints

## Required Guardrails

### Guardrail 1

Do not change the canonical route shape.

The route family must remain:

- `/claw/api/v1/studio/*`

### Guardrail 2

Do not use `/claw/manage/v1/*` as a substitute for missing public studio behavior.

`manage` and `api` are different surfaces and must stay separate.

### Guardrail 3

Do not delete Tauri `studio_*` commands before pure `server` parity exists.

That would improve surface appearance while leaving the core convergence gap unresolved.

### Guardrail 4

Do not make `sdkwork-claw-server` depend on `sdkwork-claw-desktop`.

That would formalize the wrong layering and make future server productization harder.

## Verification Matrix

### Rust

Run:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml studio_public_api
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host
```

### TypeScript

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts
node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts
```

### Final integrated checks

Run:

```bash
pnpm check:server
pnpm check:desktop
pnpm check:parity
```

## Immediate Next Task

The next implementation slice should be:

**Extract the shared host-studio provider boundary and convert the current desktop embedded-host provider into a thin adapter.**

That is the shortest path to:

- real server parity
- a truly shared Rust host kernel
- safe later reduction of business Tauri commands
