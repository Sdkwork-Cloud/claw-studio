# P0 Commercial Baseline Design

**Date:** 2026-04-15

## Goal

Establish a real commercial-delivery baseline for `claw-studio` by restoring executable quality gates, removing browser-side secret injection, separating demo-only browser state from trusted runtime state, tightening control-plane exposure rules, and freezing those rules into repeatable verification.

This design does not attempt to finish every product feature in one pass. It establishes the minimum trustworthy platform baseline required before further feature expansion can be treated as commercially deliverable.

## Problem Statement

The current repository contains strong architecture intent, many contract tests, and extensive release automation, but the current baseline is not yet commercially trustworthy as a whole.

Confirmed issues:

1. top-level delivery gates are not currently green
2. browser builds still preserve a root-style access-token injection path
3. browser-side mock/runtime layers still mix demo persistence with trusted runtime concerns
4. control-plane CORS and exposure policy remain too broad for a production management surface
5. critical runtime/integration files are large enough to create long-term maintenance and regression risk

This means the system has architecture documents describing a commercial target, but it has not yet converted that target into a stable machine-verifiable baseline.

## Evidence Snapshot

### Delivery Gate Failure

- `pnpm.cmd lint` currently fails because `tsconfig.base.json` sets `ignoreDeprecations: "6.0"` while the active toolchain rejects that value
- the repository already records this class of failure in `docs/release/release-2026-04-12-172.md`

### Browser-Side Secret Boundary Drift

- `packages/sdkwork-claw-web/vite.config.ts` still defines `import.meta.env.VITE_ACCESS_TOKEN`
- `packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts` still reads a browser-runtime access token and passes it into the generated SDK client as an API key

### Browser Demo / Trusted Runtime Boundary Drift

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts` persists instance, conversation, workbench, task, and channel data into browser storage
- the same file still carries fields and behaviors associated with trusted runtime state, including endpoint, token, workspace, and configuration concerns

### Control-Plane Exposure Risk

- `packages/sdkwork-claw-server/src-host/src/http/router.rs` mirrors request origin for `/claw/*` routes and currently applies one broad CORS middleware to public and control-plane surfaces
- `packages/sdkwork-claw-server/src-host/src/http/auth.rs` already contains meaningful auth structure, but the exposure policy still needs stricter route-by-route surface separation

### Long-Term Maintainability Risk

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts` is over 2400 lines
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts` is over 2700 lines

These file sizes are not the root problem by themselves, but they are reliable signals that current responsibilities are too concentrated.

## Scope Decision

This work is intentionally limited to one sub-project:

- `P0 Commercial Baseline Closure`

This sub-project exists to create a trustworthy platform baseline. It is the prerequisite for later work on feature completeness, polish, and performance optimization.

## Approaches Considered

### Approach A: Feature-First Parallel Repair

Continue shipping feature work while opportunistically fixing lint, release, and security issues.

Pros:

- preserves visible feature momentum
- minimal up-front disruption

Cons:

- keeps product work anchored to an untrusted baseline
- multiplies regression surface while gates are already broken
- increases the chance of security and delivery drift returning after each feature change

### Approach B: P0 Baseline First

Freeze feature expansion and first restore delivery gates, security boundaries, control-plane exposure rules, and runtime truth separation.

Pros:

- converts architecture intent into executable fact
- reduces future feature cost by stabilizing the platform first
- produces the strongest commercial delivery evidence in the shortest path

Cons:

- some visible feature work is deferred
- requires focused cross-cutting changes across web, infrastructure, desktop, server, and release tooling

### Approach C: Large-Scale Refactor First

Perform deep structural refactors across major files and modules before restoring all release gates.

Pros:

- can produce a cleaner architecture surface in the long term

Cons:

- highest regression risk
- longest path to restoring a trustworthy release baseline
- mixes urgent baseline failures with broad cleanup

## Decision

Adopt **Approach B: P0 Baseline First**.

Reasoning:

1. the main problem is not missing features; it is that commercial delivery cannot yet be proven
2. until gates, secrets, and control-plane boundaries are trustworthy, more feature work increases risk faster than value
3. the repository already has enough architecture and verification scaffolding that the best path is to restore truth, not to rewrite everything

## Target Architecture

The target architecture for this sub-project is not a full product rewrite. It is a boundary correction.

### 1. Host Responsibilities

Trusted runtime and control-plane truth must live only in trusted hosts:

- `@sdkwork/claw-server`
- `@sdkwork/claw-desktop`

Those hosts become the only legal owners of:

- root credentials and control-plane credentials
- update-check credentials
- real runtime authority and kernel status
- gateway tokens and runtime transport secrets
- authoritative provider/channel/instance configuration

### 2. Browser Responsibilities

The browser must be reduced to:

- view rendering
- route and provider bootstrap
- non-sensitive client cache
- hosted projection consumption

The browser must not remain a pseudo control plane, pseudo state store, or pseudo configuration authority.

### 3. Browser Mode Separation

The current browser behavior must be split into two explicit modes:

- `browser-demo`
- `hosted-runtime`

`browser-demo`:

- supports only disposable, non-sensitive demo data
- may persist UI preferences and sample records
- must not persist real runtime credentials, provider keys, channel tokens, workspace paths, or trusted endpoint metadata

`hosted-runtime`:

- reads only trusted projections from server/desktop bridges
- does not invent trusted runtime state locally
- does not carry or persist host-owned secrets

### 4. Control-Plane Surface Separation

Control-plane surfaces must be split and frozen into three distinct classes:

- `public api`
- `manage api`
- `internal api`

Each surface must have distinct rules for:

- authentication
- CORS
- allowed origins
- exposed headers
- returned data classes

No broad catch-all route policy should continue to cover all three surfaces identically.

## Module Boundary Design

### `@sdkwork/claw-web`

Keep responsibilities minimal:

- runtime bootstrap
- app routing
- React tree mount
- high-level providers

Do not place business service orchestration, secret resolution, or control-plane policy here.

### `@sdkwork/claw-infrastructure`

This layer should own platform and transport adapters, but it must stop collapsing demo persistence, trusted runtime projection, and fake control-plane state into one implementation.

Recommended split:

- `platform/browserDemo/*`
- `platform/hostedRuntime/*`
- `platform/persistencePolicy/*`
- `services/openClawGatewayClient/*`

### `@sdkwork/claw-core`

This layer should keep:

- application state orchestration
- business service composition
- user-session-facing abstractions

It should stop reading browser-root credentials from Vite environment variables for production runtime behavior.

### `@sdkwork/claw-server` and `@sdkwork/claw-desktop`

These layers become the trusted runtime boundary and must own:

- control-plane exposure rules
- runtime credential custody
- authoritative runtime snapshots
- update-check authorization
- control-plane and gateway invocation mediation

## Data Boundary Rules

### Browser Persistence Policy

Introduce a strict whitelist policy for browser persistence.

Allowed examples:

- UI preferences
- recent navigation state
- demo-only sample data
- local non-sensitive filters

Disallowed examples:

- auth tokens
- provider API keys
- channel bot tokens
- signing secrets
- workspace paths
- real instance endpoints when sourced from trusted hosts
- raw task definitions containing trusted runtime delivery instructions

The browser persistence rule must be implemented as code, not as convention only.

### Runtime Truth Rules

The browser may display:

- trusted runtime projections returned by server/desktop
- derived display-only summaries based on trusted projections

The browser may not:

- infer trusted lifecycle state from stale local storage
- synthesize connected/healthy/ready states without host evidence
- treat browser-local records as authoritative production configuration

## Data Flow Design

### Web Hosted Mode

The trusted flow is:

`Browser UI -> hosted bridge -> server or desktop host -> runtime/control plane -> typed projection -> Browser UI`

The browser consumes projections only.

### Desktop Mode

The trusted flow is:

`React shell -> tauri bridge -> desktop runtime authority -> local services/openclaw/kernel -> structured runtime snapshot`

The desktop React layer consumes structured host output and does not own control-plane secrets.

### Browser Demo Mode

The demo flow is:

`Browser UI -> demo adapter -> non-sensitive browser store`

This mode must never masquerade as a trusted production runtime.

## Security Design

### Secret Elimination From Browser Bundles

Remove the browser-side root access token injection path:

- stop defining `VITE_ACCESS_TOKEN` into web builds as a runtime secret channel
- stop using browser runtime environment as the source of update-check authorization
- move credential resolution to trusted host boundaries

### Control-Plane Exposure Tightening

Replace broad route-level CORS with surface-aware policy:

- `public api` allows only the origins and methods required for end-user traffic
- `manage api` restricts to explicitly trusted management origins or desktop-hosted browser contexts
- `internal api` remains host-owned and unavailable to ordinary browser origins

### Credential Flow

All sensitive authorization paths should follow one of these patterns only:

1. server-held credential used server-side
2. desktop-held credential used desktop-side
3. ephemeral delegated session credential issued by a trusted host

The browser must not hold reusable root credentials.

## Error Handling Design

Error handling should be normalized into three layers:

### User Layer

Messages must be:

- actionable
- localized
- safe to display

Examples:

- configuration required
- permission denied
- runtime unavailable
- host not ready

### Diagnostic Layer

Diagnostics should preserve fields such as:

- correlation id
- route id
- runtime id
- host mode
- active port
- deployment family

### Control Layer

Errors should be normalized into a bounded set such as:

- `validation`
- `auth`
- `permission`
- `availability`
- `timeout`
- `contract-drift`
- `internal`

This reduces drift in error semantics across packages.

## Performance and Maintainability Design

### Performance Baseline

The P0 phase does not target a full performance rewrite, but it must preserve current lazy-loading intent and avoid obvious regressions.

Required rules:

- keep `InstanceDetail` lazy-loaded by module slice
- do not collapse split route chunks back into one eager bundle
- preserve existing runtime observability fact sources for startup and proxy evidence

### Maintainability Baseline

Large files must be split only where the split enforces real responsibility boundaries.

Priority targets:

- `webStudio.ts`
- `openClawGatewayClient.ts`

Recommended decomposition for `webStudio.ts`:

- browser demo instance store
- browser demo conversation store
- browser demo workbench store
- browser demo task store
- browser persistence policy
- browser demo platform adapter

Recommended decomposition for `openClawGatewayClient.ts`:

- auth/header policy
- endpoint resolution
- request transport
- response/error normalization
- device/token operations
- gateway transport helpers

### Identifier Generation

Standardize runtime-safe ID generation:

- prefer `crypto.randomUUID()`
- keep one central fallback helper for unsupported environments
- eliminate scattered `Math.random()` usage for business identifiers where possible

## Verification Strategy

P0 must be frozen behind executable checks, not human judgment.

### Gate Classes

1. `unit and contract`
2. `integration`
3. `release smoke`
4. `security regression`

### Minimum Required Command Set

P0 is not complete until all of the following are green on the active baseline:

- `pnpm.cmd lint`
- `pnpm.cmd build`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd check:release-flow`

### New Required Regression Coverage

Add explicit coverage for:

- browser bundle secret boundary
- browser persistence whitelist policy
- control-plane CORS/auth surface separation
- update-check credential flow through trusted hosts only
- hosted browser runtime projection truth path

## Acceptance Criteria

P0 is complete only when all of the following are true:

1. delivery gates are green on the current toolchain
2. browser bundles no longer carry reusable root access tokens
3. browser persistence excludes sensitive configuration and credentials
4. hosted browser mode consumes trusted runtime projections rather than inventing trusted state locally
5. control-plane surfaces expose distinct CORS and authentication rules for `public`, `manage`, and `internal`
6. the first-pass boundary rules are locked behind automated regression tests

## Phased Execution

### Phase A: Delivery Gate Recovery

- fix TypeScript compatibility and top-level lint/build failures
- restore release-flow consistency where prior release notes already record unresolved issues

### Phase B: Browser Secret and Persistence Closure

- remove browser root-token injection
- introduce browser persistence whitelist policy
- eliminate sensitive field persistence from browser-backed runtime paths

### Phase C: Control-Plane Surface Closure

- split route exposure policy by surface
- tighten CORS and auth behavior
- align browser hosted/runtime flows to trusted projection-only semantics

### Phase D: Concentration Risk Reduction

- split oversized files at real responsibility seams
- standardize shared helpers for id generation, error mapping, and persistence policy

## First Execution Slice

The recommended first implementation slice is:

- Phase A
- Phase B
- the minimum viable subset of Phase C

This is the shortest path to turning the commercial baseline into machine-verifiable fact.

## Non-Goals

This design does not attempt to:

- rebuild all feature packages
- redesign all UI surfaces
- finish every historical architecture debt item
- solve every long-term performance concern in one pass

## Risks

### Risk 1: Scope Expansion

Mitigation:

- keep the first execution slice limited to gate recovery, browser secret closure, and surface closure

### Risk 2: Demo Mode Breakage

Mitigation:

- preserve a dedicated `browser-demo` path for non-sensitive usage instead of trying to remove browser mode entirely

### Risk 3: Hidden Coupling

Mitigation:

- add regression tests before and during boundary movement
- prefer extraction of narrow seams over broad refactors

### Risk 4: Release Drift Returning Later

Mitigation:

- convert policy into contract tests and release blockers
- avoid leaving any critical baseline rule as documentation-only guidance

## Final Recommendation

Treat `P0 Commercial Baseline Closure` as the only valid first implementation target.

Do not continue broad feature expansion until:

- delivery gates are green
- browser secret custody is eliminated
- browser persistence is policy-restricted
- control-plane exposure rules are narrowed and tested

Only after that baseline is established should the product move into feature completeness and deeper performance work.
