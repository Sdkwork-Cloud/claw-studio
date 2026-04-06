# Claw Manage Credential And Secret API Design

**Date:** 2026-04-02

## Goal

Define the endpoint-level management API design for `GatewayCredential` and `SecretRecord` so that:

- `/claw/manage/v1/*` has one consistent resource and action model for compatibility credentials and managed secrets
- tenant-scoped and workspace-scoped credential lifecycle can be operated without inventing ad hoc RPC APIs
- secret-bearing values are only returned through tightly controlled issuance or reveal flows
- dependent secrets created by higher-level resources are governed differently from directly managed secrets
- the current desktop-local proxy auth model can evolve toward the server-grade architecture without losing compatibility with the existing route and observability model

## Relationship To Prior Specs

This spec refines:

- [2026-04-02-claw-studio-unified-host-platform-v7-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md)
- [2026-04-02-claw-manage-resource-model-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-manage-resource-model-design.md)
- [2026-04-02-claw-compatibility-conformance-and-credential-design.md](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/docs/superpowers/specs/2026-04-02-claw-compatibility-conformance-and-credential-design.md)

It narrows:

- endpoint-level management API design for gateway credentials
- endpoint-level management API design for secret issuance, reveal, rotate, revoke, and rekey operations

It does not yet define:

- final OpenAPI schemas
- final database tables
- billing or quota enforcement APIs
- external KMS plugin SPI details

## Source Snapshot

This design is grounded in the current workspace state on 2026-04-02.

Relevant current implementation signals:

- the current desktop local proxy snapshot stores one top-level `auth_token` plus per-route upstream `api_key`
- the current local proxy route model is still represented as `LocalAiProxyRouteRecord`
- current local proxy request handling accepts the same local token through:
  - `Authorization: Bearer`
  - `x-api-key`
  - `x-goog-api-key`
- the current runtime contracts already project route metrics, route tests, request logs, message logs, and message capture settings
- the current route and secret posture is useful as a local bootstrap model, but not yet sufficient for scoped server-grade credential governance

## Review Findings Before This Spec

This design round identifies four concrete gaps in the current spec set:

1. `GatewayCredential` can be workspace-scoped, but the prior management resource spec only declared tenant-scoped collection roots.
2. `SecretRecord` can be installation-, tenant-, or workspace-scoped, but the prior management resource spec only declared one installation-level collection root.
3. The prior management resource spec showed an action example using `/claw/manage/v1/gateway-credentials/{credentialId}:rotate` without first declaring how direct by-id item routing works.
4. The current implementation stores inbound client auth and upstream provider secrets in a flattened route snapshot shape, so the next API spec must explicitly separate ownership and lifecycle rather than assuming it is already solved in code.

## Design Principles

### 1. Scoped collections, stable by-id items

Collection and create operations should use scope-aware paths because ownership and RBAC depend on scope.

Direct item read, patch, and action operations should use stable by-id paths because automation and audit workflows often start with resource IDs, not with a full scope path.

### 2. Secret-bearing material is never part of ordinary resource reads

`GET`, `LIST`, and ordinary `PATCH` responses must only expose metadata, policy, status, and public prefixes.

Plaintext secret material may appear only in:

- initial create or issue response
- explicit reveal action when policy allows it

### 3. Dependent secrets are not ordinary user-owned secrets

Some `SecretRecord` instances are created because another resource needs them.

Examples:

- a `GatewayCredential` verifier secret
- a gateway route upstream provider API key
- a storage profile password

These dependent secrets should remain linked to an owning resource and should not be freely reassigned or deleted through generic secret APIs.

### 4. Irreversible security transitions should be actions, not patches

Operations such as `revoke`, `rotate`, `reveal`, and `rekey` should be explicit actions so audit, concurrency control, and idempotency stay clear.

### 5. Concurrency and idempotency are mandatory for secret-bearing actions

Create, rotate, reveal, revoke, and rekey operations should support:

- optimistic concurrency on the target resource
- idempotent retries for clients and automation

## API Topology Recommendation

Three route topology patterns were considered.

### Option 1: Fully nested scoped collections and scoped items only

Examples:

- `/claw/manage/v1/tenants/{tenantId}/gateway-credentials/{credentialId}`
- `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/gateway-credentials/{credentialId}`

Pros:

- scope is explicit everywhere

Cons:

- direct by-id automation is awkward
- action examples become repetitive
- moving or re-scoping resources is harder to model cleanly

### Option 2: Global collections only with scope filters

Examples:

- `/claw/manage/v1/gateway-credentials?tenantId=...`
- `/claw/manage/v1/secret-records?workspaceId=...`

Pros:

- simple routing surface

Cons:

- weak ownership expression
- less clear RBAC boundaries
- easier to misuse across tenants

### Option 3: Scoped collections plus stable global by-id item routes

Examples:

- create/list through scoped collections
- read/update/action through `/claw/manage/v1/gateway-credentials/{credentialId}`

Pros:

- strong ownership semantics for collection operations
- stable by-id dereference for automation, audit, and UI links
- resolves the inconsistency already visible in the prior spec set

Cons:

- two path shapes must be documented clearly

### Recommendation

Use `Option 3`.

This gives clear scope-aware collection roots without forcing every operational action to rediscover the full parent path.

## Common Management API Conventions

### Resource Envelope

Ordinary management reads should return the canonical resource shape already defined by the management resource model:

- `id`
- `kind`
- `apiVersion`
- `scope`
- `metadata`
- `spec`
- `status`

### Canonical Item Paths

For these resource families, canonical by-id item paths should be:

- `/claw/manage/v1/gateway-credentials/{credentialId}`
- `/claw/manage/v1/secret-records/{secretRecordId}`

### Collection Views

Create and list operations should use scope-aware collection views.

These views may return item `self` links pointing to canonical by-id item paths.

### Optimistic Concurrency

Mutable operations should support:

- `ETag` in ordinary reads
- `If-Match` on `PATCH` and security-sensitive `POST :action` operations

If the client acts on a stale resource version, the API should fail rather than applying a security-sensitive change against an unexpected state.

### Idempotency

The following operations should accept `Idempotency-Key`:

- create or issue
- rotate
- reveal
- revoke
- rekey

Idempotency records should be scoped tightly enough that accidental replay across different resources is impossible.

### Action Result Envelope

Security-sensitive actions should return a consistent action result shape:

```json
{
  "action": "rotate",
  "resource": {},
  "result": {
    "completed": true,
    "queued": false
  },
  "issuedMaterial": null,
  "warnings": []
}
```

Rules:

- `resource` returns the updated canonical resource
- `issuedMaterial` is present only when plaintext secret material is intentionally returned
- asynchronous execution may return `queued: true` plus an operation or job reference in a later OpenAPI refinement

## GatewayCredential API Design

### Scope Model

`GatewayCredential` collection views should exist at:

- tenant scope:
  - `/claw/manage/v1/tenants/{tenantId}/gateway-credentials`
- workspace scope:
  - `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/gateway-credentials`

The canonical item path should be:

- `/claw/manage/v1/gateway-credentials/{credentialId}`

### Collection Operations

#### List tenant credentials

- `GET /claw/manage/v1/tenants/{tenantId}/gateway-credentials`

Purpose:

- list all tenant-scoped credentials
- optionally include workspace-narrowed credentials through an explicit query flag in a later refinement, but not by default

Suggested filters:

- `protocolFamily`
- `activationState`
- `revocationState`
- `routeId`
- `modelPolicyId`
- `subject`
- `search`

#### List workspace credentials

- `GET /claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/gateway-credentials`

Purpose:

- list only workspace-scoped credentials for that workspace

#### Create tenant credential

- `POST /claw/manage/v1/tenants/{tenantId}/gateway-credentials`

#### Create workspace credential

- `POST /claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/gateway-credentials`

Create requests should include:

- `metadata`
- `spec.protocolFamily`
- `spec.authTransport`
- `spec.allowedPathFamilies`
- `spec.routeBindings`
- `spec.modelPolicyRef`
- `spec.subject`
- `spec.expiresAt`
- `spec.rateLimitProfileRef`
- `spec.rotationPolicy`
- `spec.revealPolicy`
- `spec.activationState`

Create validation rules:

- `protocolFamily` and `authTransport` must be compatible
- the collection path determines the canonical resource `scope`
- `spec.scopeBinding` may further narrow where the credential is effective inside that resource scope, but it must never broaden beyond the collection path scope
- path entitlement may include `governed`, `alias`, or both, but only for the same protocol family
- route bindings must resolve within the same tenant or workspace boundary
- model policy references must resolve within the same visibility boundary

### Item Operations

#### Read credential

- `GET /claw/manage/v1/gateway-credentials/{credentialId}`

This should return:

- canonical resource metadata
- scope
- policy and binding details
- status and usage summary
- secret public prefix and secret record reference only

This must not return:

- plaintext secret
- verifier material

#### Patch credential

- `PATCH /claw/manage/v1/gateway-credentials/{credentialId}`

Allowed mutable regions:

- `metadata.displayName`
- `metadata.labels`
- `metadata.annotations`
- `spec.allowedPathFamilies`
- `spec.routeBindings`
- `spec.modelPolicyRef`
- `spec.expiresAt`
- `spec.rateLimitProfileRef`
- `spec.rotationPolicy`
- `spec.revealPolicy`
- `spec.activationState`

Forbidden patch regions:

- protocol family
- auth transport when it would break client compatibility
- secret material
- status
- owning scope

#### Delete credential

- `DELETE /claw/manage/v1/gateway-credentials/{credentialId}`

Deletion should be narrowly allowed.

Recommended rule:

- active or still-referenced credentials must not be hard-deleted
- deletion is allowed only after terminal revocation and when retention policy permits tombstoning or archival

Routine client offboarding should prefer `:revoke`, not `DELETE`.

### Item Actions

#### Rotate credential

- `POST /claw/manage/v1/gateway-credentials/{credentialId}:rotate`

Purpose:

- create a new credential version
- optionally keep bounded overlap with the previous version

Request should allow:

- `overlapWindowSeconds`
- `expiresAt`
- `reason`

Response should include:

- updated `GatewayCredential`
- newly issued plaintext compatibility secret in `issuedMaterial`
- new version id
- safe public prefix

#### Revoke credential

- `POST /claw/manage/v1/gateway-credentials/{credentialId}:revoke`

Purpose:

- stop accepting the active credential version or all remaining active versions

Request should allow:

- `mode`: `activeVersion` or `allVersions`
- `reason`

Response should not include plaintext secret material.

#### Reveal credential

- `POST /claw/manage/v1/gateway-credentials/{credentialId}:reveal`

Purpose:

- return plaintext credential material only when the reveal policy explicitly permits it

Rules:

- verifier-based credentials that are intentionally non-recoverable must reject this action
- if policy is `oneTimeAtCreation`, this action must reject
- if policy is `breakGlassRoleBound`, only a narrowly privileged actor may call it

#### Suspend or reactivate

`activationState` should normally be handled through `PATCH`, not separate `:suspend` or `:activate` actions.

The exception is if later operational policy requires explicit activation workflows with audit semantics stronger than ordinary spec mutation.

### Read-Only Version Views

The API should expose read-only version history views:

- `GET /claw/manage/v1/gateway-credentials/{credentialId}/versions`
- `GET /claw/manage/v1/gateway-credentials/{credentialId}/versions/{versionId}`

Version view fields should include:

- `versionId`
- `publicPrefix`
- `state`
- `createdAt`
- `expiresAt`
- `lastUsedAt`
- `revokedAt`

These are read models, not primary mutable resources.

## SecretRecord API Design

### Secret Ownership Classes

`SecretRecord` should distinguish:

- `direct`
- `dependent`

`direct` means:

- the secret is explicitly managed through the generic secret APIs

`dependent` means:

- the secret exists because another resource owns its lifecycle

Examples of `dependent`:

- gateway credential verifier secret
- gateway route upstream provider secret
- storage profile password secret

### Scope Views

Secret record collection views should exist at:

- installation:
  - `/claw/manage/v1/secret-records`
- tenant:
  - `/claw/manage/v1/tenants/{tenantId}/secret-records`
- workspace:
  - `/claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/secret-records`

The canonical item path should be:

- `/claw/manage/v1/secret-records/{secretRecordId}`

### Collection Operations

#### List secret records

The installation-level collection should support broad administrative listing.

Scoped views should automatically filter to the relevant tenant or workspace boundary.

Suggested filters:

- `secretKind`
- `materialClass`
- `ownershipClass`
- `providerRef`
- `ownerKind`
- `ownerId`
- `status`
- `search`

#### Create direct secret record

- `POST /claw/manage/v1/secret-records`
- `POST /claw/manage/v1/tenants/{tenantId}/secret-records`
- `POST /claw/manage/v1/tenants/{tenantId}/workspaces/{workspaceId}/secret-records`

Allowed direct-create use cases:

- upstream provider API key
- integration webhook secret
- external reference handle
- database or cache credential

Create requests should include:

- `metadata`
- `spec.secretKind`
- `spec.materialClass`
- `spec.providerRef`
- `spec.rotationPolicy`
- `spec.revealPolicy`

Create validation rules:

- `materialClass=verifier` should generally be reserved for system-owned flows such as compatibility credential issuance
- `externalReference` secrets must not contain inline plaintext payload
- `recoverable` secrets require encryption-capable backend posture
- `ownerRef` should not be accepted on direct-create flows because dependent ownership must be created by the owning resource workflow, not by ad hoc generic secret creation

Create responses may include:

- canonical `SecretRecord`
- plaintext material in `issuedMaterial` only when the workflow genuinely created client-visible secret text

### Item Operations

#### Read secret record

- `GET /claw/manage/v1/secret-records/{secretRecordId}`

This should return:

- metadata
- scope
- material class
- secret kind
- provider reference
- owner reference
- reveal policy
- rotation posture
- health
- public prefix or display hint where relevant

This must not return:

- plaintext secret
- verifier hash
- encrypted payload blob

#### Patch secret record

- `PATCH /claw/manage/v1/secret-records/{secretRecordId}`

Allowed mutable regions:

- `metadata`
- `spec.rotationPolicy`
- `spec.revealPolicy`
- provider and ownership annotations where safe

Forbidden patch regions:

- raw secret material
- material class transitions that would violate storage guarantees
- dependent owner changes that would break referential integrity

#### Delete secret record

- `DELETE /claw/manage/v1/secret-records/{secretRecordId}`

Recommended rule:

- direct secrets may be deleted only when unreferenced and policy allows it
- dependent secrets should generally not be deleted directly through generic secret APIs
- dependent secret deletion should be mediated by the owning resource lifecycle

### Item Actions

#### Rotate secret

- `POST /claw/manage/v1/secret-records/{secretRecordId}:rotate`

Purpose:

- replace recoverable secret material or regenerate a dependent verifier version

Rules:

- verifier-class dependent secrets may allow rotation only through the owning resource unless explicitly exposed
- direct recoverable secrets may rotate through generic secret APIs

#### Reveal secret

- `POST /claw/manage/v1/secret-records/{secretRecordId}:reveal`

Rules:

- only `recoverable` or specifically policy-approved `externalReference` display cases may reveal usable material
- `verifier` secrets must reject reveal
- the action must respect reveal policy and actor privilege

#### Rekey secret

- `POST /claw/manage/v1/secret-records/{secretRecordId}:rekey`

Purpose:

- re-encrypt the stored payload under a different effective master-key lineage without changing the logical secret value

Rules:

- `rekey` is about encryption posture, not client-visible secret replacement
- `rekey` should not return plaintext material

#### Revoke secret

- `POST /claw/manage/v1/secret-records/{secretRecordId}:revoke`

Purpose:

- mark secret material unusable for future resolution or verification

Use cases:

- compromised secret
- emergency disable
- dependent owner teardown

### Read-Only Version Views

The API should expose read-only version history views:

- `GET /claw/manage/v1/secret-records/{secretRecordId}/versions`
- `GET /claw/manage/v1/secret-records/{secretRecordId}/versions/{versionId}`

Version view fields should include:

- `versionId`
- `materialClass`
- `state`
- `createdAt`
- `rotatedAt`
- `revokedAt`
- `rekeyedAt`
- `publicHint`

## Resource Linking Rules

### GatewayCredential To SecretRecord

Every `GatewayCredential` should reference exactly one owning `SecretRecord` family for its credential material.

Rules:

- that secret record should usually be `ownershipClass=dependent`
- it should be linked through `spec.secretRecordRef`
- its owner reference should point back to the credential resource

### SecretRecord Owner References

`SecretRecord` should support:

- `ownerKind`
- `ownerId`
- `ownershipClass`

The API should reject cross-scope owner references that would escape tenant or workspace isolation.

For `direct` secrets:

- these owner fields should usually be absent

For `dependent` secrets:

- these owner fields should be system-managed and derived from the owning resource workflow

### Referential Integrity Rule

The platform should not allow:

- deleting a secret record still required by an active owner
- reassigning a dependent secret from one owner to another through a generic patch
- rotating a dependent secret through generic APIs when the owning resource defines a stricter lifecycle contract

## RBAC And Audit Expectations

### RBAC

Recommended baseline:

- tenant admin can manage tenant-scoped gateway credentials and tenant-scoped secrets
- workspace admin can manage workspace-scoped gateway credentials and workspace-scoped secrets
- security auditor can read metadata and audit trails but should not automatically gain reveal rights
- reveal and break-glass actions should require stronger privileges than ordinary read or patch

### Audit

The management plane should audit at least:

- create
- patch
- rotate
- reveal attempt
- reveal success
- revoke
- rekey
- delete attempt
- delete success

Audit should record:

- actor
- target resource id
- scope
- action
- outcome
- correlation id
- safe public prefix or version id where relevant

Audit must not store plaintext secret material.

## Error Behavior

### Ordinary Resource Errors

Management API errors for these resources should use the native `/claw/manage/v1/*` error family rather than compatibility-provider error envelopes.

### Sensitive Operation Failures

Sensitive actions should fail explicitly when:

- `If-Match` is stale
- `Idempotency-Key` collides with a different semantic request
- reveal policy forbids plaintext return
- resource ownership rules forbid generic direct mutation
- scope path and resource scope do not align

### Asynchronous Execution

If rotation or rekey becomes asynchronous because of backend or scale posture:

- the action should return a queued result
- the updated resource should expose transitional status
- later OpenAPI refinement may attach a job or operation reference

## Migration Guidance From Current Desktop Model

The current desktop model effectively mixes:

- one local inbound client token
- route configuration
- per-route upstream provider secrets

The future migration path should separate these concerns:

1. route configuration evolves toward `GatewayRoute`
2. inbound compatibility auth evolves toward `GatewayCredential`
3. upstream provider API keys evolve toward `SecretRecord`
4. desktop projections may still flatten selected values for local UX, but the canonical management model stays separated

This separation is required before server, Docker, and Kubernetes modes can provide safe multi-tenant management.

## Cross-Spec Corrections Introduced By This Design

This spec intentionally resolves three earlier inconsistencies:

1. workspace-scoped gateway credential collection views are now explicit
2. tenant- and workspace-scoped secret record collection views are now explicit
3. by-id item routes are now formalized, which makes prior action examples such as `:rotate` coherent

## Remaining Gaps After This Spec

Still needed:

- exact native `/claw/manage/v1/*` error schema
- OpenAPI request and response schemas
- version-skew behavior for secret and credential capabilities between control plane and node host
- external KMS plugin interaction model
- quota and billing coupling for gateway credentials

## Acceptance Criteria

This spec is successful when:

- gateway credential collection, item, and action routes are clearly separated and scope-correct
- secret record collection, item, and action routes cover installation, tenant, and workspace views
- secret-bearing plaintext is restricted to issue or reveal workflows only
- dependent secret ownership is formalized so higher-level resources can govern their secrets safely
- optimistic concurrency and idempotency are part of the management API contract for sensitive operations
- the earlier path inconsistencies in the resource model are resolved rather than carried forward
