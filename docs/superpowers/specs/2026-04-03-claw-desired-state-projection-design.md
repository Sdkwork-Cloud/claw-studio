# Claw Desired-State Projection Design

**Date:** 2026-04-03

## Goal

Define the generated desired-state projection model so that:

- control plane compiles canonical `/claw/manage/v1/*` resources into one node-targeted internal artifact
- `/claw/internal/v1/*` exchange of `desiredStateRevision`, `desiredStateHash`, `configProjectionVersion`, and `applyPolicy` has one unambiguous payload model
- `desktop`, `server`, `node`, `docker`, and `k8s` preserve the same logical reconciliation contract even when transport or secret-delivery mechanics differ
- rollouts, repairs, and rollbacks operate on reproducible full-state revisions instead of ad hoc delta patches
- secret-bearing runtime config can be distributed safely without flattening management resources into plaintext runtime snapshots

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-manage-resource-model-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-manage-resource-model-design.md)
- [2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md)
- [2026-04-02-claw-internal-node-session-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-internal-node-session-api-design.md)
- [2026-04-02-claw-manage-credential-and-secret-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-manage-credential-and-secret-api-design.md)

Shared internal failure semantics are further refined by:

- [2026-04-03-claw-internal-error-envelope-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-internal-error-envelope-design.md)

Rollout and desired-state promotion control-plane semantics are further refined by:

- [2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md)

It narrows:

- desired-state projection schema itself
- `configProjectionVersion` semantics
- relationship between canonical manage resources and runtime apply documents
- rollback-safe runtime projection rules

It does not yet define:

- public rollout API schemas that create or approve target revisions
- the shared internal error envelope for `/claw/internal/v1/*`
- wire-level cryptographic format for sealed secret envelopes
- artifact distribution transport for plugin packages or large binaries

## Current Problem

The architecture already knows what resources exist and how a node session works, but it still lacks the compiled runtime artifact that sits between them.

Without a formal desired-state projection model:

- node hosts risk consuming raw management resources that contain irrelevant metadata or unsafe secret shapes
- `configProjectionVersion` negotiation has no concrete schema boundary
- rollbacks devolve into best-effort reconstruction instead of re-applying one known-good artifact
- shared-service or multi-workspace nodes have no consistent way to receive scoped slices of configuration
- capability or trust filtering can become implicit and therefore unsafe

## Approach Options

Three projection shapes were considered.

### Option 1: Node-scoped full declarative projection

- one immutable projection per node and revision
- complete effective state for that node
- internal caching is allowed, but the contract remains one node-targeted artifact

Pros:

- safest rollback model
- easiest hash and audit semantics
- cleanest fit for version skew and capability filtering

Cons:

- repeated data across similar nodes

### Option 2: Shared base plus per-node overlay

Pros:

- less duplicate data in theory

Cons:

- harder to hash and audit
- rollback depends on reconstructing multiple layers correctly
- scope and secret handling become more complex

### Option 3: Incremental patch stream

Pros:

- smallest steady-state payloads

Cons:

- fragile rollback model
- replay ordering and drift handling are harder
- version-skew semantics become riskier

### Recommendation

Use `Option 1` as the formal architecture.

The control plane may internally deduplicate or cache subdocuments, but the contract exposed to node reconciliation must remain a complete node-scoped projection per revision. That is the best foundation for bounded skew, deterministic apply, and reliable rollback.

## Core Model

Three layers must remain distinct:

### 1. Canonical management resources

Mutable source-of-truth objects under `/claw/manage/v1/*`, including:

- `Node`
- `Rollout`
- `GatewayRoute`
- `GatewayCredential`
- `ModelPolicy`
- `PluginActivation`
- `StorageProfile`
- `CacheProfile`
- `SecretRecord`

### 2. Desired-state projection artifact

An immutable internal artifact generated by control plane for one `nodeId`.

Properties:

- node-targeted
- revisioned
- hashed
- declarative
- not directly mutable by ordinary clients

### 3. Observed runtime state

What the node reports back through heartbeat and desired-state acknowledgment.

Properties:

- may drift from desired state
- updates `Node.status` and future `Rollout.status`
- must not be mistaken for desired state

## Scope And Ownership Rules

### Node scope rule

Every desired-state projection is bound to exactly one `nodeId`.

It may still contain:

- one installation slice
- zero or more tenant slices
- zero or more workspace slices

### Generation ownership rule

Only the control plane generates or promotes desired-state revisions.

Nodes may:

- fetch projections
- validate them
- apply them
- acknowledge results

Nodes must not author or mutate the projection they are asked to apply.

### API exposure rule

Desired-state projections are internal runtime artifacts, not ordinary mutable management resources.

They may later be exposed through read-only diagnostics or rollout-debug APIs, but they should not begin as general CRUD objects under `/claw/manage/v1/*`.

## Projection Envelope

A projection should have one stable envelope model.

### Required top-level fields

- `kind`
- `apiVersion`
- `projectionId`
- `nodeId`
- `desiredStateRevision`
- `desiredStateHash`
- `configProjectionVersion`
- `generatedAt`
- `origin`
- `compatibilityContext`
- `scope`
- `applyPolicy`
- `projection`

### Recommended field content

`origin` should include:

- `reason` such as `bootstrap`, `reconcile`, `rollout`, `repair`, `rollback`
- `rolloutId` optional
- `rollbackFromRevision` optional
- `supersedesRevision` optional

`compatibilityContext` should include:

- `compatibilityClass`
- `trustLevel`
- `effectiveCapabilities`
- `negotiatedInternalApiVersion`
- `negotiatedCapabilitySchemaVersion`

`scope` should include:

- `installationId`
- `tenantIds`
- `workspaceIds`

When `compatibilityContext.compatibilityClass` is `compatibleDegraded`, the projection should also carry an `omissions[]` summary with entries such as:

- `objectRef`
- `reason`
- `missingCapability` optional
- `policyDecision`
- `impact`

## Projection Content Model

The inner `projection` payload should be organized into scope-aware slices plus runtime bindings.

### Installation slice

Contains installation-scoped runtime fragments relevant to the node, such as:

- role and topology intents derived from `Node.spec`
- shared observability posture
- installation-scoped `PluginActivation` effective config
- resolved `StorageProfile` and `CacheProfile` fragments
- immutable package or artifact digests required for execution

### Tenant slices

Contain tenant-scoped effective fragments relevant to this node, such as:

- tenant-scoped `GatewayCredential` verifier policy fragments
- tenant-scoped `ModelPolicy` effective values
- tenant-scoped `PluginActivation` effective config
- node-side quota or rate-shaping hints only when enforcement is required

Tenant slices are also the normal place where shared credential policy and tenant-scoped secret-binding references are projected before workspace routes bind to them.

### Workspace slices

Contain workspace-scoped effective fragments relevant to this node, such as:

- projected `GatewayRoute` runtime definitions
- resolved workspace model-policy overrides
- workspace plugin activation config
- workspace-specific exposure or shaping policy

Workspace route fragments should reference the effective `GatewayCredential`, `ModelPolicy`, and `secretBindings` they need rather than forcing the node to rediscover those links from canonical resources.

### Runtime bindings

Translate the scoped slices into a concrete node-local execution plan, including:

- listener or publication bindings
- protocol family enablement
- route-to-credential mappings
- route-to-model-policy mappings
- plugin instance placement
- local storage or cache binding selection
- apply ordering and health gates

### Secret bindings

`secretBindings[]` are runtime-consumable bindings, not canonical `SecretRecord` objects.

Recommended fields:

- `bindingId`
- `purpose`
- `sourceSecretRecordId`
- `sourceOwnership`
- `consumerRefs`
- `deliveryMode`
- `materialVersion`
- `bindingFingerprint`
- `payload` optional

Recommended `deliveryMode` values:

- `localHandle`
- `sealedEnvelope`
- `externalReference`

Each projected runtime object should keep a minimal `sourceRef` with:

- `kind`
- `id`
- `specFingerprint`
- `requiredCapabilities`
- `requiredTrustLevel`

## Compilation Rules

Projection compilation should happen in this order:

1. Collect candidate canonical resources from `Node.spec`, rollout context, assigned installation or tenant or workspace resources, and dependent `SecretRecord` or artifact references.
2. Resolve inheritance and defaults for model policies, route defaults, workspace overrides, plugin activation inheritance, and installation or tenant or workspace policy overlays.
3. Apply trust and safety filters. `quarantined` nodes should not receive privileged runtime changes, and secret-bearing bindings should be withheld when trust posture does not allow delivery.
4. Apply capability and version filters for unsupported `configProjectionVersion`, missing effective capabilities, missing rollback support, unavailable plugin execution modes, or unavailable storage backends.
5. Materialize runtime bindings for listeners, route bindings, plugin placement, secret delivery, and health gates.
6. Compute or reuse the node-scoped `desiredStateRevision` and `desiredStateHash`.
7. Publish the target revision through `:admit`, `:heartbeat`, or `:pull-desired-state`.

## Revision And Hash Rules

### Node-scoped monotonic revision rule

`desiredStateRevision` must be monotonic per `nodeId`.

### Reuse rule

If semantic generation produces exactly the same effective projection for the same node:

- reuse the existing revision and hash
- do not create a fake new revision just because regeneration was retried

### Hash rule

`desiredStateHash` should be computed from a canonical serialization of the semantic projection content, including:

- `configProjectionVersion`
- effective `applyPolicy`
- effective slices and runtime bindings
- secret-binding fingerprints and material versions

It should exclude:

- transport-only wrapper fields
- regeneration timestamps not relevant to apply semantics
- randomized encryption wrappers whose underlying secret version did not change

### Source metadata rule

Changes that affect only canonical resource metadata but not effective runtime behavior should not force a new projection revision.

## Secret Handling And Redaction Rules

Plaintext secret material must not appear in:

- ordinary management resources
- projection hashes
- logs
- audit payloads
- heartbeat or ack summaries

Secret delivery must be explicit per binding:

- `localHandle` for co-located or trusted local secret resolution
- `sealedEnvelope` for remote delivery bound to node identity and preferably to target revision
- `externalReference` when the node must resolve through an approved external secret provider

Verifier and recoverable secrets should remain distinct:

- verifier bindings should project only verifier-usable material
- recoverable bindings may use `sealedEnvelope`, `localHandle`, or `externalReference`

Debug views and logs must redact:

- bearer tokens
- `x-api-key`
- `x-goog-api-key`
- Gemini `key=` query values
- raw secret payloads

## Mandatory, Optional, And Degraded Semantics

### Required segment rule

A segment is required when the node role cannot function without it, policy marks it mandatory, or its absence would violate security or routing correctness.

If a required segment cannot be produced compatibly, the control plane should block promotion of a new revision for that node.

### Optional segment rule

Optional segments may be omitted when the node can remain healthy without them and rollout or policy allows omission.

### Degraded projection rule

When optional features are omitted due to capability, trust, or dependency limits:

- the compatibility class should be `compatibleDegraded`
- the projection should include an explicit omission summary

Silent omission is not allowed.

### Blocked projection rule

If the effective desired state requires something the node cannot safely realize:

- do not publish a normal new target revision
- keep the node on the last-known-good revision where safe
- record the reason in node and rollout status

## Apply Policy And Rollback Rules

`applyPolicy` is part of desired state, not delivery metadata.

Recommended fields:

- `mandatory`
- `activationMode`
- `deadline`
- `rollbackExpectation`
- `allowDegradedApply`
- `supersedesRevision`
- `rollbackBaselineRevision`
- `healthGracePeriodSeconds`

`rollbackExpectation` should define the minimum rollback posture required by the revision, for example:

- `none`
- `lastKnownGood`
- `mustBeRollbackReady`

Every desired-state revision should be re-applicable on its own. The node should not need a base document, a delta chain, or out-of-band imperative commands to reconstruct intended runtime state.

Each node should track at least:

- `lastSeenRevision`
- `lastAppliedRevision`
- `lastKnownGoodRevision`
- `lastKnownGoodHash`

Projected executable or loadable artifacts should be pinned by immutable identity, not floating labels only.

If a rollback target depends on secret material, the secret binding version used by that target revision must remain resolvable for the rollback window.

## Relationship To Node Session APIs

### `:admit`

May return the current `desiredStateRevision`, `desiredStateHash`, and required `configProjectionVersion`.

### `:heartbeat`

Should communicate whether a newer target revision exists and whether degraded or blocked posture has changed.

### `:pull-desired-state`

Should return either:

- `notModified`
- the full desired-state projection defined by this spec

### `:ack-desired-state`

Should report:

- the revision and hash the node acted on
- `accepted`, `applied`, `appliedDegraded`, `rejected`, or `superseded`
- last-known-good markers after the attempt
- compatibility or apply failures tied to projected object refs where possible

## Relationship To Manage Resources And Rollouts

Canonical resources continue to own desired intent. The desired-state projector is the compiler from those resources into node-consumable runtime documents.

A rollout should not directly stream raw resource patches to nodes. It should:

- select target nodes
- decide policy and sequencing
- trigger desired-state projection generation or promotion
- observe node acknowledgments and health
- record blocked or degraded outcomes

Node apply results should update `Node.status`, future rollout status summaries, and audit or diagnostic trails without mutating canonical desired specs implicitly.

## Combined-Mode Interpretation

`desktop` combined and `server` combined modes may short-circuit transport and prefer `localHandle` secret bindings, but they should still preserve the same logical desired-state artifact model.

Remote `node`, `docker`, and `k8s` modes should preserve the same semantics while changing only transport, secret-delivery realization, artifact delivery, and deployment automation around the node.

## Remaining Gaps After This Spec

Still needed:

- exact request and response JSON schemas for rollout action payloads and read-only target or wave views
- exact cryptographic wire format and key-agreement rules for `sealedEnvelope`
- package and artifact delivery contracts for plugin or runtime assets

## Acceptance Criteria

This spec is successful when:

- desired-state projections are defined as immutable node-targeted internal artifacts distinct from canonical manage resources
- `desiredStateRevision`, `desiredStateHash`, and `configProjectionVersion` have clear semantics
- projection generation explicitly filters by scope, trust posture, and effective capabilities
- secret-bearing runtime delivery is modeled without normalizing plaintext secrets
- rollback depends on full snapshot revisions, artifact pinning, and last-known-good markers
- the projection model aligns cleanly with `/claw/internal/v1/node-sessions/*`
