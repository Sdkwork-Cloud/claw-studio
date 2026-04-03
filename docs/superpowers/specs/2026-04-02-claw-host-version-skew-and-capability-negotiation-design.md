# Claw Host Version Skew And Capability Negotiation Design

**Date:** 2026-04-02

## Goal

Define the version-skew and capability-negotiation architecture between control plane and node host so that:

- `server`, `node`, `desktop`, `docker`, and `k8s` modes can evolve without forcing unsafe lockstep deployment
- control plane and node host can negotiate compatible internal contracts under `/claw/internal/v1/*`
- rollout orchestration can block or degrade safely when required capabilities are missing
- downgrade and rollback behavior is explicit instead of being an operational afterthought
- the existing runtime signals around host provenance, topology, and capabilities can evolve into one formal host compatibility model

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-manage-resource-model-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-manage-resource-model-design.md)

Desired-state projection compilation is further refined by:

- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

Rollout and desired-state promotion policy are further refined by:

- [2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md)

It narrows the V7 backlog item:

- version skew and capability negotiation

It does not yet define:

- final wire JSON for `/claw/internal/v1/*` handshake endpoints, which are partly refined by `2026-04-02-claw-internal-node-session-api-design.md`
- final rollout API schemas
- plugin-specific capability ABI versions

## Source Snapshot

This design is grounded in the current workspace state on 2026-04-02.

Relevant current implementation signals:

- runtime contracts already expose host provenance including:
  - `openclawVersion`
  - `nodeVersion`
  - `platform`
  - `arch`
  - `installSource`
- runtime contracts already expose host topology states including:
  - `attached`
  - `drifted`
  - `blocked`
  - `upgrading`
  - `rollbackReady`
- runtime contracts already expose kernel capabilities as keyed entries with status and detail
- management resource design already models:
  - `Node`
  - `NodeGroup`
  - `Rollout`
- the V7 baseline already defines:
  - node enrollment
  - node trust levels
  - `/claw/internal/v1/*` as the control-plane to node-host channel

This means the codebase already has useful compatibility signals. The missing piece is a formal protocol and lifecycle model around them.

## Current Problem

Without an explicit skew and negotiation design, the platform will eventually hit predictable failures:

- a newer control plane pushes desired state fields an older node host cannot interpret
- a newer node host exposes capabilities an older control plane cannot reason about
- rollouts assume homogeneous node features when the fleet is actually mixed
- downgrade or rollback becomes dangerous because compatibility assumptions are implicit
- desktop combined mode hides problems that only surface in remote server or multi-node deployment

These are architecture problems, not only implementation details. They need formal rules before large-scale server rollout begins.

## Design Principles

### 1. Separate product version from protocol version

Human release version and machine-compatibility version should not be the same concept.

### 2. Version says envelope, capability says behavior

Version ranges establish the outer compatibility boundary. Capability negotiation decides what behavior is actually allowed inside that boundary.

### 3. Unknown must fail safe

When either side encounters an unknown major protocol, unsupported required capability, or contradictory compatibility signal, it must degrade or block rather than guess.

### 4. Control plane should lead upgrades

The recommended upgrade posture is:

1. upgrade control plane to a version that still supports the existing node fleet
2. roll nodes forward progressively

### 5. Last-known-good state matters

Node hosts should preserve last-known-good desired state and continue serving safe workloads when negotiation downgrades or temporary incompatibility appears.

### 6. Desktop still follows the same logical contract

Even when control plane and node host are co-located in one desktop or combined server process, the compatibility model should remain logically intact.

## Approach Options

Three architectural approaches were considered.

### Option 1: Strict lockstep versions everywhere

Rule:

- control plane and every node host must run exactly the same release version

Pros:

- simplest mental model
- minimal negotiation logic

Cons:

- poor operational flexibility
- difficult rolling upgrades
- fragile rollback behavior
- unrealistic for multi-node and remote deployment

### Option 2: Bounded protocol skew plus explicit capability negotiation

Rule:

- product versions may differ
- internal protocol versions must stay within a bounded skew window
- actual feature use is gated by negotiated capabilities

Pros:

- operationally practical
- supports rolling upgrades and bounded rollback
- keeps safety explicit

Cons:

- requires a formal compatibility model and richer node status

### Option 3: Capability-only compatibility without version windows

Rule:

- any version can interoperate if the advertised capabilities happen to line up

Pros:

- maximally flexible in theory

Cons:

- weak safety guarantees
- hard to reason about unknown semantics
- too dependent on perfect capability modeling

### Recommendation

Use `Option 2`.

This is the best trade-off for a long-lived control plane. Version windows prevent reckless drift, while capabilities prevent version alone from overclaiming behavioral compatibility.

## Version Domain Model

The host compatibility model should use multiple version domains.

### 1. Product version

Examples:

- control plane product build version
- node host product build version

Purpose:

- release management
- support diagnostics
- operator visibility

This is not by itself the wire-compatibility contract.

### 2. Internal API protocol version

This is the compatibility version for `/claw/internal/v1/*` control traffic.

Recommended representation:

- `major`
- `minor`

Rules:

- major mismatch is incompatible
- minor skew is bounded by policy
- patch differences are not separate wire-compatibility boundaries

### 3. Capability schema version

This defines the shape and semantics of the capability descriptor itself.

Purpose:

- allows the capability negotiation model to evolve safely

### 4. Config projection version

This version identifies the desired-state projection schema that the node host can accept.

Purpose:

- prevents newer control planes from sending projections older nodes do not understand

### 5. Optional subsystem versions

The node may additionally report subsystem versions such as:

- gateway conformance set version
- plugin runtime version
- storage provider ABI version
- secret-provider feature version

These are advisory until a later subsystem spec makes them required.

## Required Version Manifest

Both control plane and node host should be able to describe a compatibility manifest with fields like:

- `productVersion`
- `internalApiVersion`
- `capabilitySchemaVersion`
- `configProjectionVersion`
- `buildFingerprint`
- `releaseChannel`
- `platform`
- `arch`

Node host should additionally report:

- `runtimeVersionSet`
- `minSupportedControlPlaneInternalApiVersion`
- `maxTestedControlPlaneInternalApiVersion`

Control plane should additionally report:

- `minSupportedNodeInternalApiVersion`
- `maxSupportedNodeInternalApiVersion`

## Compatibility Classes

Compatibility should not be binary only.

The control plane should compute one of these classes per node:

- `compatible`
- `compatibleDegraded`
- `upgradeRequired`
- `downgradeRequired`
- `blocked`
- `quarantined`

### Meaning

`compatible`

- the node can accept desired state normally

`compatibleDegraded`

- core management works, but some desired features or rollouts must be gated off

`upgradeRequired`

- the node is too old for required policy or target rollout

`downgradeRequired`

- the node is newer in a way the current control plane cannot safely manage

`blocked`

- version or capability conditions prevent normal reconciliation

`quarantined`

- trust or safety policy forbids privileged commands even if versions appear compatible

## Default Skew Policy

### Major rule

Control plane and node host must share the same `internalApiVersion.major`.

If majors differ:

- the node must not be admitted to normal managed operation
- the node may remain observable in a restricted or quarantined posture if trust policy allows it

### Minor rule

Recommended default window:

- control plane may manage nodes up to `2` internal-api minor versions older
- control plane may manage nodes up to `1` internal-api minor version newer, if the node's declared minimum supported control-plane version includes the current control plane

This yields a practical default:

- older node skew is tolerated for rolling upgrades
- slightly newer nodes can still reconnect after partial rollback or staggered deployment
- excessive skew is blocked explicitly

### Policy override rule

Installations may choose a stricter skew window.

They should not choose a looser default without an explicit architecture decision, because safety depends on the control plane understanding the older or newer node semantics.

## Capability Descriptor Standard

### Core Descriptor Shape

Each node capability should be modeled with fields like:

- `key`
- `version`
- `state`
- `stability`
- `source`
- `requires`
- `details`

### Field intent

`key`

- stable machine-readable capability id

`version`

- capability-specific semantic version or monotonic revision

`state`

- `ready`
- `degraded`
- `disabled`
- `planned`

`stability`

- `ga`
- `beta`
- `experimental`

`source`

- `core`
- `plugin:{pluginId}`
- `provider:{providerId}`

`requires`

- prerequisite capabilities or feature flags

### Capability Naming Rule

Capability keys should be namespaced and stable.

Examples:

- `host.lifecycle.reconcile`
- `host.lifecycle.rollback`
- `gateway.alias.openai`
- `gateway.alias.anthropic`
- `gateway.alias.gemini`
- `gateway.streaming.openai`
- `gateway.streaming.anthropic`
- `gateway.streaming.gemini`
- `secret.material.verifier`
- `secret.material.recoverable`
- `secret.operation.rekey`
- `plugin.execution.wasm`
- `plugin.execution.sidecarGrpc`
- `storage.sqlite`
- `storage.postgres`
- `cache.redis`

### Required Capability Families

At minimum, negotiation should consider:

- lifecycle and reconciliation
- compatibility gateway protocol families
- plugin execution modes
- storage and cache backends
- secret operation support
- rollout and rollback support
- observability and audit reporting support

## Negotiation Lifecycle

The capability model should be evaluated in three phases.

### Phase 1: Enrollment handshake

Recommended flow:

1. node host presents join credential and initial version manifest
2. control plane validates trust boundary and expected scope
3. node host submits capability manifest and compatibility ranges
4. control plane computes admission result
5. control plane issues or confirms node identity and negotiated protocol parameters

Recommended internal endpoints:

- `POST /claw/internal/v1/node-sessions:hello`
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`

The exact wire schema can evolve later, but the logical split should remain.

### Phase 2: Steady-state heartbeat

After enrollment:

- the node periodically reports heartbeat, observed health, current version manifest, and effective capabilities
- the control plane responds with management posture and desired-state revision hints

Recommended internal endpoint:

- `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat`

### Phase 3: Desired-state apply and acknowledgment

When the control plane wants the node to apply new desired state:

- the projection should carry a required minimum config-projection version
- the projection may carry required capability predicates
- the node must acknowledge accepted, degraded, or rejected application

Recommended internal endpoints:

- `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state`
- `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state`

## Negotiation Rules

### Admission rule

A node can enter `managed-trusted` or `managed-restricted` only if:

- trust checks pass
- internal API major is compatible
- skew window is acceptable
- required core capabilities are present in `ready` or allowed `degraded` state

Otherwise:

- keep the node in `quarantined`, `blocked`, or `attached-observed`

### Effective capability rule

The control plane should compute the node's effective capability set as the intersection of:

- node-advertised capabilities
- control-plane-supported capabilities
- tenant or installation policy
- trust posture

Capabilities that exist on the node but are unknown or unsupported by the control plane must not automatically become usable.

### Desired-state projection rule

The control plane must not send desired-state constructs that require capabilities outside the node's effective capability set.

The node-targeted projection model for doing that filtering is further defined by:

- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

If a new feature depends on a new capability:

- the desired-state projector should gate it explicitly
- rollout preflight should surface the mismatch before application

### Node self-protection rule

If the node receives desired state that violates negotiated compatibility:

- it must reject the apply request
- it must preserve last-known-good state
- it must publish an explicit compatibility failure reason

## Rollout Blocking And Placement Rules

### Preflight capability gates

Before starting a rollout, the control plane should evaluate for each target node:

- protocol compatibility class
- required capability predicates
- trust posture
- storage or secret backend prerequisites
- rollback support availability when mandated by rollout policy

### Rollout outcomes

A rollout should classify target nodes as:

- `admissible`
- `admissibleDegraded`
- `blockedByVersion`
- `blockedByCapability`
- `blockedByTrust`

### Default blocking policy

Recommended default:

- if the rollout requires a capability not present on a target node, block that node
- if the rollout targets a mandatory node set and any mandatory node is blocked, block the rollout
- if the rollout is canary or progressive, allow admissible nodes first and keep blocked nodes out of scope until remediated

### Placement rule

Future placement and scheduling should treat capability predicates as first-class selectors, not informal labels only.

## Downgrade, Rollback, And Drift Rules

### Control-plane upgrade rule

Recommended order:

1. upgrade control plane first
2. keep old nodes within supported skew
3. roll node hosts progressively

### Control-plane rollback rule

If the control plane is rolled back:

- nodes within the supported newer-node window may remain `compatibleDegraded`
- nodes beyond that window should move to `downgradeRequired` or `blocked`
- advanced desired-state features unsupported by the rolled-back control plane must be frozen

### Node downgrade rule

If a node rejoins with reduced protocol or capability support:

- the control plane must recompute compatibility immediately
- desired-state features requiring lost capabilities must be withdrawn or blocked
- the node should remain on last-known-good state where safe

### Drift rule

If a node's observed version or capabilities drift from the last negotiated state:

- the control plane should mark compatibility as stale
- the node should be forced through a fresh negotiation cycle on the next heartbeat or reconnect

### Rollback-ready capability rule

Rollout policies that require rollback guarantees should explicitly require a capability such as:

- `host.lifecycle.rollback`

Nodes lacking that capability must not be placed into rollback-dependent rollout stages.

## Desktop And Combined-Mode Interpretation

### Desktop combined mode

Desktop normally ships control plane and node host together, so skew should usually be zero.

Even so:

- the logical compatibility model still applies
- the handshake may collapse to in-memory evaluation
- runtime projections can still surface compatibility fields for debugging and future remote attach scenarios

### Server combined mode

Server combined mode may also co-locate control plane and node host.

That should not justify deleting the compatibility model because:

- future split deployment still depends on it
- rollout and rollback orchestration still benefits from explicit compatibility reasoning

## Management Resource Impact

The `Node` resource should expose compatibility posture clearly.

Recommended additions or clarifications to node status:

- `reportedVersionManifest`
- `negotiatedInternalApiVersion`
- `negotiatedCapabilitySchemaVersion`
- `compatibilityClass`
- `compatibilityReasons`
- `effectiveCapabilities`
- `lastHeartbeatAt`
- `lastDesiredStateVersionApplied`

The `Rollout` resource should eventually expose:

- required protocol range
- required capabilities
- blocked-node summary by reason

These rollout-facing semantics are further refined by:

- [2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md)

## Operational Guidance

### Logging and audit

Compatibility negotiation should audit:

- enrollment admit or reject
- compatibility-class transitions
- blocked rollout decisions caused by version or capability mismatch
- downgrade-required and upgrade-required transitions

### Metrics

Recommended compatibility metrics:

- nodes by compatibility class
- nodes by internal API minor skew
- blocked rollouts by capability key
- negotiation failures by reason

### Operator visibility

Browser and management views should eventually be able to answer:

- which nodes are safe to target for a given rollout
- which nodes are outside supported skew
- which capabilities are missing on blocked nodes

## Cross-Spec Corrections Introduced By This Design

This spec closes an important ambiguity in the prior architecture:

- V7 previously declared the need for version-skew handling but did not distinguish product version from internal protocol version
- current runtime contracts already expose version and capability signals, and this spec now gives them formal semantics

## Remaining Gaps After This Spec

Still needed:

- exact `/claw/internal/v1/*` handshake payload schemas
- rollout API fields for required capability predicates
- plugin ABI version negotiation rules
- provider-specific gateway conformance versioning

## Acceptance Criteria

This spec is successful when:

- control plane and node host compatibility is defined as bounded protocol skew plus explicit capability negotiation
- product version, internal API version, and capability schema version are treated as distinct concepts
- rollout blocking and degraded admission are rule-based rather than ad hoc
- downgrade and rollback behavior is explicit
- desktop combined mode remains logically compatible with the same host model
- the existing runtime version and capability signals can map directly into the future server-grade architecture
