# Claw Rollout And Desired-State Promotion API Design

**Date:** 2026-04-03

## Goal

Define the V1 rollout and desired-state promotion architecture so that:

- `/claw/manage/v1/rollouts/*` becomes the authoritative management surface for node-targeted desired-state promotions
- target selection, preflight admission, candidate projection generation, approval, wave progression, pause, cancel, retry, and rollback all follow one coherent lifecycle
- blocked, degraded, retryable, and successful outcomes flow cleanly from node-session APIs back into rollout status
- `desktop`, `server`, `node`, `docker`, and `k8s` preserve the same logical promotion model even when transport is collapsed locally
- the platform can freeze architecture and begin stable implementation of the control-plane rollout engine

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-manage-resource-model-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-manage-resource-model-design.md)
- [2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md)
- [2026-04-02-claw-internal-node-session-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-internal-node-session-api-design.md)
- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)
- [2026-04-03-claw-internal-error-envelope-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-internal-error-envelope-design.md)

It narrows:

- the `Rollout` resource semantics for desired-state promotion
- management API actions for promotion lifecycle
- target preflight and blocked or degraded classification
- relationship between rollout orchestration and node-scoped desired-state revisions

It does not yet define:

- non-node rollout families for arbitrary resource mutation
- final OpenAPI component schemas
- plugin artifact download protocol
- final cryptographic wire format for `sealedEnvelope`

## Current Problem

The architecture already has:

- a canonical `Rollout` resource
- node compatibility and capability negotiation rules
- node-scoped desired-state projections
- node-session pull and ack semantics
- a shared internal error envelope

What is still missing is the control-plane object that ties those pieces together.

Without an explicit rollout and promotion model:

- operators cannot know when a desired-state revision is merely generated versus actively promoted
- blocked and degraded target outcomes have no stable management-plane status model
- pause, resume, cancel, and rollback semantics risk becoming ad hoc control-plane logic
- node-scoped revision generation can drift away from rollout intent and audit history

## Design Principles

### 1. V1 rollout is for node desired-state promotion

The existing `Rollout` resource may eventually support other rollout families, but V1 should be narrowed to node-targeted desired-state promotion. That is the critical path for stable implementation.

### 2. Rollout intent and node revision remain different objects

`Rollout` is the managed orchestration resource. `DesiredStateProjection` remains the immutable node-targeted artifact. One rollout may generate many node-specific revisions.

### 3. Target set must freeze before promotion

Once a rollout begins promotion, the concrete target set should be frozen into a snapshot. Dynamic selector drift during execution would destroy auditability and rollback clarity.

### 4. Preflight first, publish second

Capability, trust, dependency, and policy gating must happen before a new node revision is published as a target.

### 5. Rollback is a new managed action, not a hidden side effect

Rollback should produce explicit management records and explicit node-targeted promotions. It must not silently mutate the old rollout state in place.

### 6. Blocked and rejected are different

Blocked means the control plane should not publish a target revision. Rejected means the control plane did publish a target revision, but the node could not or would not apply it.

## Approach Options

Three rollout-control models were considered.

### Option 1: Rollout directly streams raw resource patches

Pros:

- simple to describe initially

Cons:

- conflicts with the desired-state projection design
- weak rollback semantics
- poor compatibility and capability filtering

### Option 2: Rollout orchestrates node-scoped desired-state promotion

Pros:

- aligns with the desired-state projection artifact model
- clean separation between source-of-truth resources and applied runtime state
- strong audit and rollback behavior

Cons:

- requires explicit target and wave bookkeeping

### Option 3: Rollout delegates entirely to node-local upgrade logic

Pros:

- minimal control-plane logic

Cons:

- weak centralized governance
- inconsistent policy enforcement
- poor browser and API observability

### Recommendation

Use `Option 2`.

The control plane should own target resolution, candidate projection generation, publication timing, and status aggregation. Nodes remain responsible for apply and health reporting, not for deciding orchestration policy.

## Scope Of V1

V1 rollout should cover:

- selecting target nodes
- running preflight admission and blocking analysis
- generating candidate node-scoped desired-state projections
- publishing those projections wave by wave
- observing node ack and post-apply health
- pausing, resuming, canceling, retrying failed targets, and initiating rollback

V1 rollout should not yet attempt to standardize:

- blue or green service routing beyond node target waves
- artifact CDN or package mirror transport
- arbitrary business-resource rollouts outside node desired-state promotion

## Core Model

The rollout system should be modeled with four distinct concepts.

### 1. `Rollout`

Canonical management resource under `/claw/manage/v1/rollouts/{rolloutId}`.

Purpose:

- operator intent
- lifecycle state
- strategy and policy
- aggregated results

### 2. Target Snapshot

Immutable resolved list of concrete nodes captured for one rollout attempt.

Properties:

- derived from selector rules at preview or start time
- frozen for the active attempt
- may be regenerated only by explicit retry or rollback workflows

### 3. Target Promotion Record

Read-only per-target record produced by the rollout engine.

Properties:

- bound to one `rolloutId`, one attempt, and one `nodeId`
- records preflight classification
- records candidate `desiredStateRevision` and `desiredStateHash` when generated
- records publication, ack, health verification, and final outcome

### 4. Wave

Read-only execution grouping over a subset of targets.

Properties:

- determined by rollout strategy
- progression controlled by approval and health gates
- own status separate from the overall rollout status

## Rollout Spec Model

The `Rollout.spec` for V1 should include these areas.

### Targeting

Recommended fields:

- `family = nodeDesiredState`
- `selector`
- `nodeGroupRefs` optional
- `exclusions` optional

`selector` may use:

- labels
- explicit node ids
- ownership scope
- capability predicates
- topology predicates

### Source Intent

Recommended fields:

- `changeSet`
- `reason`
- `requestedBy`

`changeSet` should identify what desired intent is being promoted, for example:

- resource refs whose effective runtime outcome changed
- policy bundle or configuration change id
- package or artifact change refs

The rollout should reference source changes, not embed the entire desired-state projection payload.

### Preflight Policy

Recommended fields:

- `allowDegradedTargets`
- `requireRollbackReady`
- `requiredCapabilities`
- `requiredProtocolRange`
- `dependencyChecks`

### Strategy

Recommended strategy kinds:

- `allAtOnce`
- `canary`
- `progressive`
- `manualWaves`

Supporting fields:

- `initialBatchSize`
- `batchSize`
- `maxParallelTargets`
- `interWaveDelaySeconds`
- `successThreshold`

### Approval Policy

Recommended fields:

- `mode` with values `automatic` or `manual`
- `approverRoles`
- `requiredApprovals`

### Health Gates

Recommended fields:

- `postApplyHealthCheck`
- `healthGracePeriodSeconds`
- `requiredHealthyDurationSeconds`

### Failure Policy

Recommended fields:

- `maxFailedTargets`
- `maxDegradedTargets`
- `onRejectedTarget`
- `onDependencyFailure`
- `autoPauseOnFailure`

### Rollback Policy

Recommended fields:

- `enabled`
- `baselineMode`
- `triggerThreshold`
- `preserveFailedAttemptArtifacts`

`baselineMode` examples:

- `lastKnownGood`
- `explicitRevisionSet`

## Rollout Status Model

The `Rollout.status` should aggregate operator-facing progress.

### Recommended top-level status fields

- `phase`
- `attempt`
- `targetSnapshotSummary`
- `waveSummary`
- `progressSummary`
- `outcomeSummary`
- `blockedSummary`
- `degradedSummary`
- `currentPromotionWindow`
- `lastTransitionAt`

### Recommended phases

- `draft`
- `previewing`
- `awaitingApproval`
- `ready`
- `promoting`
- `paused`
- `completed`
- `failed`
- `canceled`
- `rollbackInProgress`
- `rolledBack`

### Progress summary

Recommended counts:

- `totalTargets`
- `eligibleTargets`
- `blockedTargets`
- `publishedTargets`
- `acceptedTargets`
- `appliedTargets`
- `appliedDegradedTargets`
- `rejectedTargets`
- `failedTargets`
- `succeededTargets`

## Preflight Classification

Every resolved target should receive one preflight outcome before promotion.

### Required outcomes

- `admissible`
- `admissibleDegraded`
- `blockedByVersion`
- `blockedByCapability`
- `blockedByTrust`
- `blockedByPolicy`

`blockedByPolicy` covers explicit rollout policy failures such as:

- rollback-ready required but missing
- manual approval not yet granted
- tenant or workspace governance forbids this target

### Preflight rule

Targets that are blocked in preflight must not receive candidate publication during the active attempt.

### Degraded admission rule

`admissibleDegraded` targets may proceed only when:

- rollout policy explicitly allows degraded targets
- the degraded impact is surfaced in rollout status

## Candidate Generation And Promotion Lifecycle

The rollout engine should follow this sequence.

### 1. Preview

The control plane:

- resolves the concrete target snapshot
- runs preflight checks
- computes projected blocked and degraded outcomes
- may reserve candidate per-node `desiredStateRevision` and `desiredStateHash`

Preview must not publish new desired-state targets to nodes.

### 2. Start

Starting a rollout:

- freezes the target snapshot for the active attempt
- materializes candidate promotion records for eligible targets
- moves the rollout to `ready` or `awaitingApproval`

### 3. Approve

When manual approval is required:

- approval should be explicit
- approval may be global or wave-based in future, but V1 should require only rollout-level approval

### 4. Publish

Publishing a wave means:

- the control plane marks candidate revisions as target revisions for the selected wave
- nodes learn of the new target via `:heartbeat` or `:admit`
- nodes fetch the full projection through `:pull-desired-state`

### 5. Observe apply

The rollout engine observes:

- `accepted`
- `applied`
- `appliedDegraded`
- `rejected`
- transport or dependency failures

through node-session acks and health reports.

### 6. Verify

The wave completes only after health gates pass for the targets in that wave.

### 7. Advance, pause, fail, or complete

Based on policy and observed results, the control plane:

- advances to the next wave
- pauses
- fails the rollout
- completes the rollout

## Node Revision Allocation Rules

### Node-scoped revision rule

Each target node still receives its own monotonic `desiredStateRevision`.

One rollout therefore normally maps to many node-specific revisions.

### Attempt rule

Every execution pass of a rollout should carry an `attempt` number.

Retrying or recalculating the target set should create a new attempt with a new frozen snapshot.

### Gaps rule

Node-scoped desired-state revision numbers do not need to be gapless. Canceled or superseded attempts may leave reserved but unpublished candidate revisions behind.

### Origin rule

Every generated projection for rollout use should set:

- `origin.reason = rollout`
- `origin.rolloutId = <rolloutId>`

If produced for rollback:

- `origin.reason = rollback`
- `origin.rollbackFromRevision` when applicable

## Wave Model

Waves are read-only orchestration records under a rollout.

### Recommended wave fields

- `waveId`
- `index`
- `phase`
- `targetCount`
- `publishedCount`
- `succeededCount`
- `failedCount`
- `degradedCount`
- `startedAt`
- `completedAt`

### Recommended wave phases

- `pending`
- `ready`
- `promoting`
- `verifying`
- `completed`
- `paused`
- `failed`
- `canceled`

### Strategy rules

`allAtOnce`

- one wave containing all eligible targets

`canary`

- one small first wave, then remaining waves after verification

`progressive`

- fixed or growing batch sizes

`manualWaves`

- control plane computes waves, but operator explicitly resumes between them

## Read-Only Rollout Views

The management API should expose read-only operational views to avoid overloading `Rollout.status`.

### Target records

Recommended routes:

- `GET /claw/manage/v1/rollouts/{rolloutId}/targets`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}`

Each target record should include:

- `nodeId`
- `attempt`
- `preflightOutcome`
- `blockedReason` optional
- `desiredStateRevision` optional
- `desiredStateHash` optional
- `waveId` optional
- `publishState`
- `ackState`
- `healthState`
- `finalOutcome`
- `lastError` optional

### Wave records

Recommended route:

- `GET /claw/manage/v1/rollouts/{rolloutId}/waves`

## Management API Topology

The canonical item root remains:

- `/claw/manage/v1/rollouts/{rolloutId}`

### Collection and item

- `POST /claw/manage/v1/rollouts`
- `GET /claw/manage/v1/rollouts`
- `GET /claw/manage/v1/rollouts/{rolloutId}`
- `PATCH /claw/manage/v1/rollouts/{rolloutId}`

### Action routes

- `POST /claw/manage/v1/rollouts/{rolloutId}:preview`
- `POST /claw/manage/v1/rollouts/{rolloutId}:start`
- `POST /claw/manage/v1/rollouts/{rolloutId}:approve`
- `POST /claw/manage/v1/rollouts/{rolloutId}:pause`
- `POST /claw/manage/v1/rollouts/{rolloutId}:resume`
- `POST /claw/manage/v1/rollouts/{rolloutId}:cancel`
- `POST /claw/manage/v1/rollouts/{rolloutId}:retry`
- `POST /claw/manage/v1/rollouts/{rolloutId}:rollback`

### Concurrency and idempotency

These actions should support:

- `ETag` plus `If-Match`
- `Idempotency-Key`

Especially for:

- `:start`
- `:approve`
- `:pause`
- `:resume`
- `:cancel`
- `:retry`
- `:rollback`

## Action Semantics

### `:preview`

Purpose:

- compute the target snapshot and preflight results without publishing

Output should include:

- blocked summary
- degraded summary
- predicted wave shape
- candidate revision summary when already materialized

### `:start`

Purpose:

- freeze the active attempt and prepare it for promotion

Rules:

- must fail if required preflight has not run
- must fail if policy blocks the rollout from starting
- should move to `awaitingApproval` or `ready`

### `:approve`

Purpose:

- satisfy manual approval policy for the active attempt

Rules:

- should be a no-op or reject when rollout policy is `automatic`

### `:pause`

Purpose:

- stop advancing waves while preserving current attempt state

Rules:

- already-published node revisions remain authoritative
- pause does not automatically roll back published targets

### `:resume`

Purpose:

- continue promotion from the paused attempt

### `:cancel`

Purpose:

- stop the active attempt without automatically reverting already-published targets

Rules:

- unpublished target records become `canceled`
- published targets remain at their current revision unless a later rollback is initiated

### `:retry`

Purpose:

- create a new attempt against a refreshed snapshot or a failed-target subset

Recommended request controls:

- `mode = failedOnly | blockedOnly | allEligible`

### `:rollback`

Purpose:

- initiate explicit rollback using rollout policy and available baseline information

Recommended behavior:

- do not mutate the active rollout into a hidden rollback state machine
- create a new rollout attempt or child rollout referencing the rollback baseline

This produces a clear audit trail and keeps rollback as a first-class management action.

## Outcome Mapping From Node Session APIs

Node-session behavior must map into rollout status explicitly.

### Successful control-plane processing

These node responses should normally update rollout target state under `2xx` internal calls:

- `accepted`
- `applied`
- `appliedDegraded`
- `rejected`

### Target outcome mapping

Recommended mapping:

- `accepted` -> target `ackState = accepted`
- `applied` -> target `ackState = applied`, then `healthState = verifying`
- `appliedDegraded` -> target `ackState = appliedDegraded`
- `rejected` -> target `finalOutcome = failed`

### Internal error mapping

Internal `/claw/internal/v1/*` errors should map like this:

- `session_unknown` or `lease_expired` -> retryable communication failure for the target
- `projection_version_unsupported` -> failed target with compatibility reason
- `stale_ack` -> non-terminal target conflict unless policy declares otherwise
- `dependency_unavailable` -> retryable dependency failure

The exact transport semantics remain governed by:

- [2026-04-03-claw-internal-error-envelope-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-internal-error-envelope-design.md)

## Failure And Completion Rules

### Completion rule

A rollout completes only when:

- all required waves are done
- success thresholds are met
- health gates have passed
- failure policy has not forced pause or failure

### Failure rule

A rollout should move to `failed` when:

- failed targets exceed policy
- degraded targets exceed policy
- required wave verification does not pass
- rollback policy requires stopping instead of continuing

### Partial-success rule

If policy allows degraded or partial outcomes, the rollout may still complete with a non-empty degraded summary. That degraded posture must remain visible in status and target views.

## Relationship To Existing Resources

### `Node`

`Node.status` should continue to expose:

- compatibility posture
- last desired-state revision applied
- last heartbeat
- last known good markers

Rollout reads those signals but should not replace them.

### `NodeGroup`

`NodeGroup` remains a placement and selection helper. The concrete rollout target set is still frozen per attempt.

### `DesiredStateProjection`

The rollout engine is the primary orchestrator that turns source changes into node-targeted projection publication under managed policy.

### `Rollout`

`Rollout` remains the canonical orchestration resource. Per-target and per-wave records are operational read models attached to it, not independent mutable top-level resources.

## Combined-Mode Interpretation

`desktop` combined and `server` combined modes may short-circuit transport and observe node apply locally, but they should still preserve:

- frozen target snapshots
- per-node desired-state promotion records
- rollout phases
- wave progression
- explicit rollback actions

This avoids building a second, less rigorous rollout engine just because the node host is co-located.

## Review Findings Closed By This Spec

This design resolves five important gaps:

1. `Rollout` now has V1 semantics tied specifically to node desired-state promotion instead of remaining an abstract placeholder.
2. The boundary between previewed candidate revisions and actually published target revisions is now explicit.
3. Blocked, degraded, rejected, retryable, and successful outcomes now have one management-plane mapping.
4. Pause, cancel, retry, and rollback now have explicit lifecycle meaning rather than being left to implementation intuition.
5. The architecture now has a credible implementation gate for a stable control-plane rollout engine.

## Remaining Gaps After This Spec

Still needed:

- plugin artifact delivery and package transport contracts
- exact `sealedEnvelope` wire format and key-agreement rules
- native platform error envelope design for `/claw/api/v1/*` and `/claw/manage/v1/*`

## Acceptance Criteria

This spec is successful when:

- `/claw/manage/v1/rollouts/*` is defined as the control-plane API for node desired-state promotion
- rollout preview, start, approve, pause, resume, cancel, retry, and rollback have explicit semantics
- target preflight outcomes, node-scoped desired-state revisions, and wave progression fit together coherently
- node-session results and internal errors map cleanly into rollout status
- the architecture is stable enough to begin control-plane rollout implementation
