# Claw Internal Node Session API Design

**Date:** 2026-04-02

## Goal

Define the `/claw/internal/v1/*` node-session contract between control plane and node host so that:

- enrollment, admission, heartbeat, desired-state pull, and desired-state acknowledgment have one explicit internal API model
- the protocol works for `server`, `node`, `docker`, and `k8s` deployments without assuming inbound connectivity to every node
- desktop and combined modes can preserve the same logical contract while collapsing transport locally
- node identity, trust posture, compatibility posture, and desired-state reconciliation are all represented in one coherent session lifecycle

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md)

Desired-state projection contents are further refined by:

- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

Shared internal error-envelope rules are further refined by:

- [2026-04-03-claw-internal-error-envelope-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-internal-error-envelope-design.md)

Rollout and desired-state promotion semantics are further refined by:

- [2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md)

It narrows:

- exact `/claw/internal/v1/*` handshake payload schemas

It does not yet define:

- streaming or push-based desired-state delivery
- fleet rollout APIs that select nodes and produce desired-state revisions

## Source Snapshot

This design is grounded in the current workspace state on 2026-04-02.

Relevant existing signals:

- V7 already defines `/claw/internal/v1/*` as the control-plane to node-host coordination channel
- V7 already defines node join credentials, node identity credentials, and mTLS-oriented production guidance
- the host-version spec now defines:
  - version domains
  - compatibility classes
  - capability negotiation phases
- runtime contracts already expose:
  - host provenance versions
  - topology state
  - capability lists
- earlier kernel-platform design already required remote node identity to be pinned and versioned

## Problem Statement

The architecture now knows that control plane and node host must negotiate compatibility, but it still lacks the concrete internal contract shape.

Without a formal node-session API:

- enrollment and steady-state operation remain underspecified
- desired-state reconciliation can drift into ad hoc endpoint design
- node identity issuance and rotation have no explicit transport boundary
- control plane and node host may make incompatible assumptions about leases, revisions, and session recovery

## Approach Options

Three internal transport shapes were considered.

### Option 1: Node-initiated HTTP JSON, poll-first session model

Pattern:

- node always initiates requests to control plane
- control plane responds with posture and desired-state metadata
- node explicitly pulls desired state and acks result

Pros:

- works through NAT and outbound-only networks
- aligns with current `axum` and JSON stack
- simple to host under one canonical domain
- easy to collapse into local in-memory or loopback calls in desktop and combined modes

Cons:

- slightly more request round-trips than a long-lived stream

### Option 2: Bidirectional gRPC streaming

Pros:

- efficient for push-style coordination
- strong typed contract potential

Cons:

- more complex ingress and network posture
- less aligned with the current HTTP-first host direction
- harder to keep one simple mental model across desktop and browser-served deployments

### Option 3: Hybrid HTTP control plus optional streaming upgrade

Pros:

- future flexibility

Cons:

- more moving parts immediately
- risks overdesign before the poll-first model is proven

### Recommendation

Use `Option 1` as the canonical V1 model.

The contract should be:

- node-initiated
- HTTPS JSON
- session-based
- lease-aware
- revision-oriented

Future streaming optimization can be added later without changing the logical state machine.

## Core Session Model

### Session identity

Each active node control connection should be represented by:

- `sessionId`
- `nodeId`
- `bootId`
- `leaseId`
- `state`

### Why both node and session exist

`nodeId`

- stable managed resource identity

`sessionId`

- one live coordination session between a booted node instance and the control plane

`bootId`

- distinguishes process restarts on the same node

`leaseId`

- distinguishes renewed or replaced sessions and prevents stale heartbeat replay

### Session states

Recommended internal states:

- `pending`
- `admitted`
- `compatible`
- `compatibleDegraded`
- `blocked`
- `quarantined`
- `expired`
- `closed`
- `replaced`

## Authentication And Trust Phases

### Phase 1: Bootstrap authentication

Used only for first contact or re-enrollment.

Accepted identity:

- node join credential

Properties:

- short-lived
- scope-bound
- one installation or tenant enrollment boundary

### Phase 2: Admitted node identity

Used after enrollment completes.

Accepted identity:

- node identity certificate or equivalent node identity credential

Recommended production rule:

- remote control traffic should prefer mTLS with node identity bound to the control-plane trust store

### Phase 3: Session lease binding

Used to prevent replay and stale session confusion.

The session should additionally bind:

- `sessionId`
- `leaseId`

This is not a replacement for node identity. It is a freshness and coordination layer on top of node identity.

## Transport Rules

### Canonical base

Internal node-session APIs live under:

- `/claw/internal/v1/node-sessions/*`

### Media type

Recommended V1 media type:

- `application/json`

### Request identity headers

The exact final header names can still be refined, but the contract should reserve stable internal headers such as:

- `x-claw-node-id`
- `x-claw-session-id`
- `x-claw-lease-id`

These should be supplemental metadata. They must not replace authenticated identity.

### Clock and timeout assumptions

The protocol should tolerate moderate clock skew.

Lease validity should rely primarily on server-issued expiry timestamps and server observation, not on clients having perfectly synchronized clocks.

## Common Envelope Conventions

### Version manifest object

Every handshake and heartbeat should be able to carry a structured version manifest including:

- `productVersion`
- `internalApiVersion`
- `capabilitySchemaVersion`
- `configProjectionVersion`
- `buildFingerprint`
- `releaseChannel`
- `platform`
- `arch`
- `runtimeVersionSet`

### Capability descriptor array

Every handshake and heartbeat should be able to carry capability descriptors using the capability model defined in the skew spec.

### Desired-state revision identifiers

Desired-state exchange should use:

- `desiredStateRevision`
- `desiredStateHash`
- `configProjectionVersion`

The hash protects against silent content drift under the same revision number.

## Endpoint Set

The canonical V1 endpoint set should be:

- `POST /claw/internal/v1/node-sessions:hello`
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`
- `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat`
- `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state`
- `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state`
- `POST /claw/internal/v1/node-sessions/{sessionId}:close`

The first five are required for V1.

`close` is recommended so nodes can terminate sessions cleanly during shutdown or replacement.

## 1. `POST /claw/internal/v1/node-sessions:hello`

### Purpose

Create or resume a pending node session and start compatibility evaluation.

### Authentication

Allowed auth:

- bootstrap join credential
- existing node identity when the node is reconnecting after a transient disconnect

### Request shape

The request should include:

- `bootId`
- `nodeClaim`
- `versionManifest`
- `capabilities`
- `endpointCandidates`
- `topologySnapshot`
- `healthSummary`
- `resumeHint`

### `nodeClaim`

Recommended fields:

- `claimedNodeId` optional
- `installKey` optional
- `enrollmentScope`
- `ownershipMode`
- `hostPlatform`
- `hostArch`

Purpose:

- identify whether the node is brand-new, reconnecting, or expected to bind to an existing `Node` resource

### `resumeHint`

Recommended fields:

- `previousSessionId`
- `previousLeaseId`
- `lastKnownDesiredStateRevision`

Purpose:

- allow safe fast-path reconnection without blindly trusting stale sessions

### Response shape

The response should include:

- `sessionId`
- `helloToken` or equivalent one-time continuation proof
- `leaseProposal`
- `admissionMode`
- `controlPlaneVersionManifest`
- `compatibilityPreview`
- `nextAction`

### `admissionMode`

Recommended values:

- `bootstrapRequired`
- `identityRequired`
- `alreadyAdmitted`
- `blocked`

### `nextAction`

Recommended values:

- `callAdmit`
- `callHeartbeat`
- `stopAndWait`

### Notes

- `hello` should not yet imply the node is trusted for privileged reconciliation
- `hello` may create a pending session even when final admission will later be blocked

## 2. `POST /claw/internal/v1/node-sessions/{sessionId}:admit`

### Purpose

Complete admission after the control plane has evaluated trust, version compatibility, and capability posture.

### Authentication

Allowed auth:

- join credential plus `helloToken` for first admission
- existing node identity plus `helloToken` for reconnect or revalidation

### Request shape

The request should include:

- `helloToken`
- `sessionIntent`
- `versionManifest`
- `capabilities`
- `proofs`

### `sessionIntent`

Recommended fields:

- `requestedTrustMode`
- `requestedRoleSet`
- `supportsRollback`
- `supportsDesiredStateApply`

### `proofs`

May include:

- CSR or certificate request if the platform issues X.509 node identities
- signed possession proof for an already-issued node identity

### Response shape

The response should include:

- `sessionId`
- `lease`
- `nodeIdentityMaterial` only when first issuing or rotating identity
- `nodeBinding`
- `compatibilityResult`
- `effectiveCapabilities`
- `heartbeatPolicy`
- `desiredStateCursor`

### `lease`

Recommended fields:

- `leaseId`
- `issuedAt`
- `expiresAt`

### `heartbeatPolicy`

Recommended fields:

- `intervalSeconds`
- `missTolerance`
- `fullReportInterval`

### `desiredStateCursor`

Recommended fields:

- `currentRevision`
- `currentHash`
- `requiredConfigProjectionVersion`

### Admission outcomes

The response should be able to admit the node as:

- `compatible`
- `compatibleDegraded`
- `quarantined`
- `blocked`

`quarantined` and `blocked` should still return enough information for operator diagnosis and controlled retry.

## 3. `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat`

### Purpose

Maintain the session lease and exchange steady-state posture.

### Authentication

Required auth:

- admitted node identity

Supplemental metadata:

- `sessionId`
- `leaseId`

### Request shape

The heartbeat should include:

- `leaseId`
- `observedAt`
- `versionManifest`
- `effectiveCapabilities`
- `healthSnapshot`
- `compatibilityState`
- `desiredStateStatus`
- `observedEndpoints`
- `runtimeSummary`

### `desiredStateStatus`

Recommended fields:

- `lastSeenRevision`
- `lastAppliedRevision`
- `lastAppliedHash`
- `applyState`
- `lastApplyError`

### Response shape

The heartbeat response should include:

- `lease`
- `compatibilityResult`
- `managementPosture`
- `desiredStateHint`
- `commands`

### `managementPosture`

Recommended fields:

- `trustLevel`
- `compatibilityClass`
- `allowedOperations`

### `desiredStateHint`

Recommended fields:

- `hasUpdate`
- `targetRevision`
- `targetHash`
- `mandatory`

### `commands`

V1 should keep this narrow.

Recommended command types:

- `refreshDesiredState`
- `rotateIdentity`
- `enterQuarantine`
- `closeSession`

This avoids turning heartbeat into a generic imperative RPC tunnel.

## 4. `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state`

### Purpose

Fetch the current desired-state projection after the control plane indicates an update or after session admission.

### Authentication

Required auth:

- admitted node identity

### Request shape

The request should include:

- `leaseId`
- `knownRevision`
- `knownHash`
- `supportedConfigProjectionVersions`
- `effectiveCapabilities`

### Response modes

The response should support two modes:

- `notModified`
- `projection`

### `projection` response should include

- `desiredStateRevision`
- `desiredStateHash`
- `configProjectionVersion`
- `requiredCapabilities`
- `projection`
- `applyPolicy`

### `projection`

The projection payload is further defined by:

- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

It should follow these rules:

- contain only constructs supported by the negotiated config-projection version
- be filtered to the node's effective capability set
- remain declarative rather than imperative

### `applyPolicy`

Recommended fields:

- `mandatory`
- `deadline`
- `rollbackExpectation`

## 5. `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state`

### Purpose

Report whether the node accepted, applied, degraded, or rejected a desired-state revision.

### Authentication

Required auth:

- admitted node identity

### Request shape

The request should include:

- `leaseId`
- `desiredStateRevision`
- `desiredStateHash`
- `result`
- `effectiveCapabilities`
- `observedEndpoints`
- `applySummary`

### `result`

Recommended values:

- `accepted`
- `applied`
- `appliedDegraded`
- `rejected`
- `superseded`

### `applySummary`

Recommended fields:

- `appliedAt`
- `lastKnownGoodRevision`
- `compatibilityReasons`
- `errors`
- `warnings`

### Response shape

The response should include:

- `recorded`
- `nextExpectedRevision`
- `managementPosture`

## 6. `POST /claw/internal/v1/node-sessions/{sessionId}:close`

### Purpose

Allow graceful termination of a session during shutdown, replacement, or controlled restart.

### Request shape

- `leaseId`
- `reason`
- `successorHint` optional

### Response shape

- `closed`
- `replacementExpected`

## Session Lease Rules

### Lease issuance

Every admitted session should receive a lease with:

- bounded lifetime
- renewable through heartbeat
- replacement on re-admission when required

### Stale session rule

If a heartbeat arrives with:

- unknown `sessionId`
- wrong `leaseId`
- expired lease

the control plane should reject it and require the node to restart from `:hello`.

### Replaced session rule

If a newer session for the same `nodeId` and newer `bootId` is admitted:

- the old session should transition to `replaced`
- old heartbeats and acks must stop being authoritative

## Desired-State Revision Rules

### Monotonicity

Desired-state revisions should be monotonic within one node scope.

### Hash rule

If the same revision number is observed with a different hash:

- treat it as invalid
- force a fresh pull and control-plane audit

### Last-known-good rule

The node should maintain:

- `lastAppliedRevision`
- `lastKnownGoodRevision`

When application fails:

- the node should preserve the last-known-good state where safe
- the ack should report the failure explicitly

## Admission And Blocking Rules

### Admission may succeed but remain degraded

The session API should allow:

- successful authentication
- successful identity binding
- degraded compatibility posture

This is important because some nodes may remain manageable for diagnostics and limited reconciliation even when they are not fully admissible for all rollouts.

### Blocked sessions

If the node is blocked because of:

- protocol major mismatch
- unsupported required config projection
- incompatible trust posture

the control plane should still return a structured blocked response from `:admit` or `:heartbeat`, not silently drop the node.

### Quarantine sessions

Quarantine should be distinct from block:

- `blocked` is primarily a compatibility or policy fit problem
- `quarantined` is a trust or safety posture problem

## Security Rules

### Bootstrap credential scope

Join credentials must be:

- short-lived
- installation- or tenant-bound
- unusable for ordinary steady-state heartbeat traffic

### Node identity issuance

When node identity material is returned:

- it should be returned only from admission or dedicated rotation flows
- it should be one-time visible where practical
- it should be bound to the expected node resource and trust scope

### mTLS rule

For remote production topologies:

- steady-state traffic should require node identity over mTLS or an equivalent transport with strong mutual authentication

### Session token rule

Any continuation or hello token should be:

- short-lived
- session-bound
- unusable as a general replacement for node identity

## Internal Error Categories

The shared internal error envelope is further defined by:

- [2026-04-03-claw-internal-error-envelope-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-internal-error-envelope-design.md)

These semantic categories should exist:

- `bootstrap_auth_failed`
- `node_identity_invalid`
- `session_unknown`
- `lease_expired`
- `compatibility_blocked`
- `projection_version_unsupported`
- `desired_state_conflict`
- `stale_ack`
- `quarantined`

The shared internal error envelope should carry one of these machine-readable reasons.

## Combined-Mode Interpretation

### Desktop combined mode

Desktop may collapse:

- session creation
- admission
- heartbeat
- desired-state checks

into local in-memory or loopback calls.

But the logical artifacts should still exist:

- `sessionId`
- `leaseId`
- version manifest
- capability set
- desired-state revision

### Server combined mode

Combined server mode may also short-circuit transport, but should preserve the same logical state machine to avoid later split-brain redesign.

## Review Findings Against Earlier Specs

This spec resolves three practical ambiguities left by earlier documents:

1. The host-version spec named the handshake phases but did not define payload responsibilities per endpoint.
2. V7 required `/claw/internal/v1/*` but had not yet chosen a concrete session-based internal API shape.
3. The prior specs established node join and node identity credentials, but not how those credentials participate in one internal coordination lifecycle.

## Remaining Gaps After This Spec

Still needed:

- node identity rotation endpoint if rotation is split from session admission
- exact rollout-aware request and response payload details beyond the current internal session contract

## Acceptance Criteria

This spec is successful when:

- the internal node-session endpoint set is explicit and coherent
- authentication, trust, compatibility, and desired-state flows are separated by phase
- the protocol is node-initiated and safe for outbound-only deployment topologies
- session, lease, and revision semantics prevent stale control traffic from becoming authoritative
- desktop and combined modes can preserve the same logical coordination contract
