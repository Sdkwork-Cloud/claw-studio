# Claw Manage Resource Model Design

**Date:** 2026-04-02

## Goal

Define the canonical resource model and management API resource boundaries for `Claw Studio` so that:

- `desktop`, `server`, `node`, `docker`, and `k8s` modes share one authoritative management domain model
- `/claw/manage/v1/*` becomes resource-oriented instead of ad hoc operation-driven
- current desktop-biased runtime contracts can be treated as projections rather than long-term source-of-truth models
- future plugin, storage, quota, auth, and node orchestration work can attach to stable resources

## Relationship To V7

This spec refines the V7 platform baseline in:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)

It narrows two V7 backlog items:

- data model specification
- public management API resource boundary specification

Gateway credential and secret-handling details are further refined by:

- [2026-04-02-claw-compatibility-conformance-and-credential-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-compatibility-conformance-and-credential-design.md)

Node-version compatibility and capability-negotiation details are further refined by:

- [2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md)

Desired-state projection boundaries between canonical resources and runtime artifacts are further refined by:

- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

Rollout lifecycle and desired-state promotion semantics are further refined by:

- [2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md)

It does not yet define endpoint-by-endpoint request and response schemas. It defines the canonical resource catalog and where those resources belong.

## Source Snapshot

This design is based on the current workspace state on 2026-04-02.

Relevant existing implementation signals:

- current TypeScript runtime contracts in `packages/sdkwork-claw-infrastructure/src/platform/contracts/*.ts` are still desktop-biased
- desktop runtime already models kernel topology, runtime state, storage profiles, local AI proxy status, and plugin posture
- `LocalAiProxyRouteRecord` and route snapshot types already exist and provide a good starting point for managed gateway route resources
- current desktop workbench and runtime surfaces mix canonical data with rendered projections

## Current Problem

The platform has useful runtime data, but not yet one formal management resource model.

Today the model is fragmented:

- some fields are runtime projections for desktop UX
- some fields are host implementation details
- some future server concepts exist only in architecture prose
- some domain objects are implied but not explicitly named as resources

This creates four risks:

1. management APIs become one-off RPC methods instead of stable resources
2. server and node shells invent a second model instead of extending the current one
3. frontend contracts start depending on desktop-specific projections as if they were canonical
4. plugin, auth, and quota policies have no stable attachment points

## Design Principles

### 1. Resource-first management model

`/claw/manage/v1/*` should expose resources with stable ownership, lifecycle, and state, not only command-style operations.

### 2. Canonical resource vs rendered projection

Canonical resources are the source of truth for management. Desktop or browser runtime summaries are projections for UI and diagnostics.

### 3. Desired vs observed state

Anything that can drift at runtime should separate desired state from observed state.

### 4. Scope before behavior

Every resource must declare where it lives:

- installation
- tenant
- workspace
- node

### 5. Narrow admin surface

Routine management belongs in `/claw/manage/v1/*`. `/claw/admin/*` remains a narrow installation-level bootstrap or recovery surface.

## Canonical Resource Layers

The management model should be layered in five tiers.

### Tier 1: Installation resources

These are global to one deployed product instance.

Examples:

- installation
- installation settings
- node registry
- plugin package registry
- storage provider registry
- cache provider registry
- auth provider registry
- secret provider configuration

### Tier 2: Tenant resources

These define ownership, identity, quota, and policy domains.

Examples:

- tenant
- tenant membership
- tenant quota policy
- tenant gateway credentials
- tenant plugin activations

### Tier 3: Workspace resources

These define project or team-level operating boundaries within a tenant.

Examples:

- workspace
- workspace gateway routes
- workspace model policy
- workspace workflow policy
- workspace plugin activations

### Tier 4: Node resources

These define runtime execution surfaces and fleet coordination.

Examples:

- node
- node group
- node assignment
- node enrollment
- rollout
- deployment plan

### Tier 5: Read-only operational resources

These exist primarily for inspection, diagnostics, or audit and should not behave like ordinary mutable config objects.

Examples:

- audit event
- health snapshot
- runtime status snapshot
- gateway request log
- plugin failure record

## Canonical Resource Shape

All mutable management resources should follow one common shape.

### Required top-level fields

- `id`
- `kind`
- `apiVersion`
- `scope`
- `metadata`
- `spec`
- `status`

### Metadata

`metadata` should include:

- `name`
- `displayName`
- `labels`
- `annotations`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `etag` or version marker

### Spec

`spec` is the desired state controlled by management APIs.

Examples:

- desired route configuration
- desired plugin activation mode
- desired node assignment policy
- desired quota limit

### Status

`status` is the observed or derived state reported by the runtime or management reconciler.

Examples:

- runtime healthy or degraded
- plugin active or blocked
- node attached or quarantined
- rollout in progress or failed

### Immutable vs mutable rule

- `id`, `kind`, `apiVersion`, and scope anchors are immutable
- `metadata.name` may be mutable only when that does not break external references
- `spec` is the primary mutable region
- `status` is system-owned and not directly set by normal clients

## Resource Identity Rules

### ID format rule

Resource IDs should be opaque and stable. They should not encode path structure or mutable display names.

### Recommended kind prefixes

Recommended prefixes:

- `ins_` for installation resources
- `ten_` for tenant resources
- `wsp_` for workspace resources
- `nod_` for nodes
- `ndg_` for node groups
- `gwr_` for gateway routes
- `gct_` for gateway credentials
- `plp_` for plugin packages
- `pla_` for plugin activations
- `stp_` for storage profiles
- `scp_` for cache profiles
- `mdl_` for model policies
- `rol_` for rollouts
- `evt_` for audit events

These are recommendations, not protocol-visible semantics.

### Name vs ID rule

- IDs are for references and foreign keys
- names are human-facing and may need uniqueness only within the owning scope

## Core Resource Catalog

The following resources should be treated as canonical in the management plane.

### Installation

Scope:

- installation

Purpose:

- authoritative root object for one deployed control plane

Key spec areas:

- edition or distribution
- deployment mode
- public base URL
- feature gates
- signing policy

Key status areas:

- current version
- health summary
- active database profile
- active cache profile

### Tenant

Scope:

- installation

Purpose:

- ownership and policy boundary

Key spec areas:

- display name
- tenant mode
- auth policy
- quota policy reference
- billing policy reference

Key status areas:

- membership counts
- current quota usage summary
- suspension state

### Workspace

Scope:

- tenant

Purpose:

- project or team boundary for routes, files, automation, and model usage

Key spec areas:

- display name
- workspace policy references
- default model policy
- default gateway route policy

Key status areas:

- effective policy summary
- assigned node summary
- current health summary

### Node

Scope:

- installation

Purpose:

- one managed or attached runtime host

Key spec areas:

- ownership mode
- enrollment mode
- assigned tenant or shared-service designation
- desired roles
- desired upgrade channel
- desired runtime topology

Key status areas:

- version
- capabilities
- compatibility posture
- negotiated protocol versions
- trust level
- health
- topology
- observed endpoints
- last heartbeat

### Node Group

Scope:

- installation

Purpose:

- rollout and policy grouping across nodes

Key spec areas:

- selection rules
- rollout policy
- placement labels

Key status areas:

- resolved node membership
- rollout summary

### Rollout

Scope:

- installation

Purpose:

- tracked deployment or upgrade orchestration unit

V1 refinement:

- node-targeted desired-state promotion orchestrator
- further defined by `2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md`

Key spec areas:

- target resource kind
- target selector
- desired version or policy change
- sequencing strategy
- rollback strategy

Key status areas:

- progress
- succeeded count
- failed count
- paused state

### Gateway Route

Scope:

- workspace by default
- tenant when a shared route is intentionally defined

Purpose:

- compatibility and upstream routing definition used by gateway execution

Key spec areas:

- enabled
- default flag within protocol family
- client protocol
- upstream protocol
- upstream base URL
- provider reference
- route auth reference
- allowed models
- runtime shaping config
- exposure policy

Key status areas:

- health
- request counters
- last test result
- effective default state

This resource generalizes the current desktop `LocalAiProxyRouteRecord`.

### Gateway Credential

Scope:

- tenant by default
- workspace when explicitly narrowed

Purpose:

- compatibility credential object for alias and governed gateway access

Key spec areas:

- protocol family
- auth transport
- governed and alias path entitlement
- bound route set
- bound model policy
- expiration policy
- rate-limit profile
- rotation and reveal policy
- secret record reference
- activation state

Key status areas:

- last used timestamp
- revocation state
- rotation state

### Model Policy

Scope:

- tenant or workspace

Purpose:

- allowed models, fallback policy, safety gates, and budget constraints

Key spec areas:

- allowed model set
- denied model set
- default model
- reasoning model
- embedding model
- budget policy
- safety policy

Key status areas:

- effective resolved model set

### Plugin Package

Scope:

- installation

Purpose:

- immutable installed plugin artifact and verification record

Key spec areas:

- manifest summary
- trust level
- package distribution scope
- package origin

Key status areas:

- verification result
- installed version
- compatibility result

### Plugin Activation

Scope:

- installation
- tenant
- workspace

Purpose:

- where and how a plugin package is enabled

Key spec areas:

- package reference
- activation scope
- config payload reference
- enablement mode

Key status areas:

- loaded state
- blocked reason
- health summary

### Storage Profile

Scope:

- installation

Purpose:

- one usable storage binding chosen from registered providers

Key spec areas:

- provider kind
- connection reference
- migration policy
- read or write mode
- durability expectations

Key status areas:

- connectivity
- schema version
- migration state

### Cache Profile

Scope:

- installation

Purpose:

- one cache or Redis binding used for cache, session, lock, or rate limit services

Key spec areas:

- provider kind
- capability flags
- connection reference
- enabled feature set

Key status areas:

- connectivity
- effective capabilities

### Secret Record

Scope:

- installation
- tenant
- workspace

Purpose:

- metadata record for a managed secret handle
- shared metadata envelope for both inbound verifier secrets and recoverable outbound secrets

Key spec areas:

- secret kind
- material class
- owning scope
- reveal policy
- encryption or verifier posture
- rotation policy
- provider reference

Key status areas:

- last rotated at
- compromised or revoked state
- backend health

The secret payload itself should not be returned through the ordinary resource read path.

### Audit Event

Scope:

- installation
- tenant
- workspace

Purpose:

- append-only operational and security event

Key status posture:

- read-only

### Health Snapshot

Scope:

- installation
- node
- workspace

Purpose:

- derived operational visibility object

Key status posture:

- read-only

## Resource Ownership and Projection Rules

### Canonical resource rule

Canonical resources should live in the management model and be retrievable through `/claw/manage/v1/*`.

### Projection rule

The following should be treated as projections, not canonical resources:

- current `RuntimeDesktopKernelHostInfo`
- current `RuntimeDesktopKernelInfo`
- current desktop `RuntimeDesktopLocalAiProxyInfo`
- UI-specific workbench summaries

These projections may aggregate or reshape canonical resources for UX efficiency, but they should not become the main persistent domain model.

Node-targeted desired-state artifacts are a separate internal projection family and are further defined by:

- [2026-04-03-claw-desired-state-projection-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-03-claw-desired-state-projection-design.md)

### Reconciliation rule

Desired state usually comes from:

- installation, tenant, workspace, plugin, storage, route, or node resources

Observed state usually comes from:

- node host reports
- gateway runtime metrics
- plugin runtime status
- storage or cache health checks

## `/claw/manage/v1/*` Resource Boundary

The management API should be organized by canonical resources, not by product page names.

### Installation-level resources

Recommended roots:

- `/claw/manage/v1/installation`
- `/claw/manage/v1/tenants`
- `/claw/manage/v1/nodes`
- `/claw/manage/v1/node-groups`
- `/claw/manage/v1/rollouts`
- `/claw/manage/v1/plugin-packages`
- `/claw/manage/v1/storage-profiles`
- `/claw/manage/v1/cache-profiles`
- `/claw/manage/v1/secret-records`

### Tenant-scoped resources

Recommended roots:

- `/claw/manage/v1/tenants/{tenantId}`
- `/claw/manage/v1/tenants/{tenantId}/workspaces`
- `/claw/manage/v1/tenants/{tenantId}/gateway-credentials`
- `/claw/manage/v1/tenants/{tenantId}/model-policies`
- `/claw/manage/v1/tenants/{tenantId}/plugin-activations`
- `/claw/manage/v1/tenants/{tenantId}/secret-records`

### Workspace-scoped resources

Recommended roots:

- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}`
- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/gateway-credentials`
- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/gateway-routes`
- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/model-policies`
- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/plugin-activations`
- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/secret-records`

### Read-only operational resources

Recommended roots:

- `/claw/manage/v1/audit-events`
- `/claw/manage/v1/health-snapshots`

These may also support filtered subviews under tenant, workspace, or node collections.

## Boundary Rules Between API Families

### `/claw/manage/v1/*`

Used for:

- CRUD of canonical management resources
- state transitions that mutate managed spec
- operational actions that belong to a managed resource lifecycle

Examples:

- create workspace
- rotate gateway credential
- activate plugin
- start rollout
- quarantine node

### `/claw/admin/*`

Used only for:

- installation bootstrap
- break-glass recovery
- installation-owner recovery operations

It should not become a second management API namespace.

### `/claw/internal/v1/*`

Used for:

- control-plane to node-host reconciliation traffic
- system-to-system internal coordination

It is not the public management surface.

### `/claw/api/v1/*`

Used for:

- end-user product behavior
- business-facing product SDK operations

It should not become the place where installation, tenant, node, or plugin lifecycle is managed.

### Compatibility alias paths

Used for:

- provider-compatible inference access only

They must not expose installation or management resources.

## Operation Style Rules

The management API should prefer standard resource verbs first.

Collection and create operations should prefer scope-aware collection paths.

Direct item dereference and action operations may additionally use stable by-id roots such as:

- `/claw/manage/v1/gateway-credentials/{credentialId}`
- `/claw/manage/v1/secret-records/{secretRecordId}`

### Preferred patterns

- `GET` for read
- `POST` for create
- `PATCH` for spec mutation
- `DELETE` for removal where allowed

### Action subresources

Some lifecycle transitions are actions rather than ordinary spec edits.

Recommended action pattern:

- `POST /.../{resourceId}:actionName`

Examples:

- `POST /claw/manage/v1/nodes/{nodeId}:quarantine`
- `POST /claw/manage/v1/gateway-credentials/{credentialId}:rotate`
- `POST /claw/manage/v1/rollouts/{rolloutId}:pause`

This keeps lifecycle actions explicit without collapsing everything into RPC-only endpoints.

## Scope and Visibility Rules

### Installation-scoped visibility

- only installation-owner and installation-level service accounts should see all installation resources by default

### Tenant-scoped visibility

- tenant principals should only see resources within their tenant unless granted explicit cross-tenant rights

### Workspace-scoped visibility

- workspace principals should only see workspace resources or inherited tenant resources relevant to that workspace

### Projection rule for desktop

Desktop may hide tenant complexity in single-user mode, but the underlying model should still map to installation -> implicit tenant -> workspace.

## Migration Strategy From Current Contracts

### Existing desktop runtime contracts

Current contracts such as:

- `RuntimeDesktopKernelHostInfo`
- `RuntimeDesktopKernelInfo`
- `RuntimeStorageInfo`
- `RuntimeDesktopLocalAiProxyInfo`

should be treated as transitional read models.

### Migration direction

The migration should proceed like this:

1. define canonical manage resources
2. project desktop runtime summaries from canonical resources plus observed node status
3. gradually replace desktop-only assumptions in TypeScript contracts with host-neutral resource summaries

### Route model migration

Current `LocalAiProxyRouteRecord` and route snapshot types should evolve into the canonical `GatewayRoute` resource plus a runtime projection layer for health and metrics.

## Non-Goals

This spec does not yet define:

- exact request and response JSON for every management endpoint
- final OpenAPI schemas
- database table schemas
- compatibility provider field mapping details
- endpoint-level credential and secret management APIs, which are further refined by `2026-04-02-claw-manage-credential-and-secret-api-design.md`

## Acceptance Criteria

This spec is successful when:

- every major management concern maps to a named canonical resource
- `/claw/manage/v1/*` can be organized by resources instead of page-specific RPCs
- current desktop runtime contracts can be reinterpreted as projections rather than canonical truth
- future server and node implementations can share one management model without inventing parallel resource trees
