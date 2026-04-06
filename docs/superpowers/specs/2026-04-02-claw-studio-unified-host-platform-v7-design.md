# Claw Studio Unified Host Platform V7 Design

**Date:** 2026-04-02

## Goal

Define the target architecture for a unified `Claw Studio` platform that:

- keeps `desktop` as a first-class local application experience
- adds a production-grade `server` mode with a built-in Rust web server
- supports `docker`, `kubernetes`, and classic installer deployment models
- serves a browser management application from the server runtime
- exposes complete public APIs and separate management APIs
- standardizes a compatibility gateway for `OpenAI`, `Anthropic Claude`, and `Gemini`
- standardizes storage, cache, and plugin extension points for long-term growth
- preserves one coherent codebase and one shared product surface

## Source Snapshot

This design is based on the local `claw-studio` workspace state on 2026-04-02.

Verified local implementation signals:

- the desktop Rust runtime already uses `axum = "0.8"` and `tokio`
- the desktop local proxy already runs as a managed Rust web service
- the desktop local proxy already reserves protocol-specific base URLs for:
  - `openaiCompatibleBaseUrl`
  - `anthropicBaseUrl`
  - `geminiBaseUrl`
- the desktop runtime contract already models kernel topology, runtime state, and local proxy health
- the desktop local proxy currently defaults to loopback port `18791`

This means the architecture does not need a new technical direction. It needs a formalized, generalized host model that scales from desktop-local runtime management to multi-node server deployment.

## Design Principles

### 1. One product, multiple runtime shells

`Claw Studio` should remain one product with one logical platform model. Different deployment forms are host shells, not separate products.

### 2. Shared host core, separate runtime binaries

The platform should share one Rust `Host Core`, while shipping distinct runtime shells for `desktop`, `server`, and later `node` and `operator`.

### 3. Control plane and node host are separate responsibilities

The system must not collapse management APIs, browser UX, local runtime lifecycle, cluster control, and gateway compatibility into one undifferentiated process model.

### 4. Platform APIs and compatibility APIs are different contracts

Native platform APIs can evolve as product APIs. Compatibility APIs must look like the upstream providers they emulate.

### 5. Plugin extensibility must not destroy safety

Extension is required, but the platform must start from signed, permissioned, well-bounded plugins rather than arbitrary native code loading.

### 6. Storage and cache are providers, not hard-coded dependencies

Desktop can stay opinionated and local. Server must support swappable data infrastructure behind stable service contracts.

## Product Line

The recommended product line is:

- `sdkwork-claw-desktop`
- `sdkwork-claw-server`
- `sdkwork-claw-node`
- later `sdkwork-claw-operator`

These should be separate packages and binaries.

### Why separate packages are required

This should not be one giant multi-mode binary with feature flags only. The permission model, packaging, service ownership, auto-start rules, and deployment expectations differ too much between desktop, server, and remote node environments.

Separate shells give:

- clearer ownership boundaries
- cleaner packaging and installation pipelines
- safer host-specific capability control
- better long-term maintainability

The shared behavior belongs in the host core, not in duplicated application logic.

## Recommended Workspace Package Layout

The architecture should be reflected directly in the workspace layout.

### Workspace naming rule

The existing repository convention should remain authoritative:

- user-facing and shared workspace packages live under `packages/sdkwork-claw-*`
- no ad hoc top-level package tree should be introduced outside the current workspace convention

Rust implementation units may still be modeled as crates, but they should live inside those workspace packages or inside a clearly managed Rust sub-workspace owned by those packages.

### Recommended Rust host crates

- `sdkwork-claw-host-core`
- `sdkwork-claw-host-api`
- `sdkwork-claw-gateway-core`
- `sdkwork-claw-plugin-runtime`
- `sdkwork-claw-storage-core`
- `sdkwork-claw-server`
- `sdkwork-claw-node`
- existing `sdkwork-claw-desktop`

### Responsibility split

`sdkwork-claw-host-core`

- lifecycle orchestration
- config reconciliation
- health, audit, and observability core
- tenant and workspace policy enforcement hooks

`sdkwork-claw-host-api`

- host-neutral contracts
- DTOs and command surfaces shared by desktop, server, and node shells
- serialization-safe runtime models

`sdkwork-claw-gateway-core`

- compatibility routing
- provider protocol translation
- token-bound protocol resolution
- upstream vendor adapter registry

`sdkwork-claw-plugin-runtime`

- plugin registry
- signature verification
- permission evaluation
- WASM and sidecar execution

`sdkwork-claw-storage-core`

- storage and cache service contracts
- DB and Redis provider registration
- migration orchestration hooks

`sdkwork-claw-server`

- built-in Rust web server shell
- browser app hosting
- public edge API composition

`sdkwork-claw-node`

- runtime-only host shell
- node enrollment
- local runtime and gateway execution

### Frontend package rule

The current React package graph should remain the browser surface. Do not create a second admin frontend stack for server mode.

Recommended rule:

- one shared browser app artifact
- desktop hosts it inside the native shell
- server hosts it through the built-in Rust web server

### Contract package rule

Current desktop-biased TypeScript runtime contracts should be generalized into host-neutral contracts instead of cloning a second `server` contract tree.

The target split should be:

- shared host-neutral runtime contract package
- desktop-only native extension contract package when necessary
- browser-safe app contract package for frontend consumption

### Implementation hygiene rule

The package layout should avoid two common failure modes:

- building a second frontend just for server mode
- creating disconnected Rust crates that bypass the workspace package boundaries and drift from the main product model

### Contract source-of-truth rule

The system should not evolve separate hand-maintained contract models for:

- Rust host services
- TypeScript browser clients
- management HTTP APIs
- local IPC surfaces

The architecture should prefer one canonical contract source per boundary, with generated or projected consumer types where practical.

## Runtime Modes

The platform should support these runtime modes.

### Desktop combined mode

`claw-desktop` runs:

- local browser or native shell UI
- local control plane
- local node host
- local compatibility gateway
- local data plane

This is the default consumer installation mode.

### Server combined mode

`claw-server` runs:

- browser management UI
- control plane APIs
- management APIs
- local node host
- compatibility gateway
- local data plane

This is the default single-machine server deployment mode.

### Server control-plane-only mode

`claw-server` runs:

- browser management UI
- platform APIs
- management APIs
- cluster inventory
- deployment orchestration

It does not run a local node workload unless explicitly enabled.

### Node runtime-only mode

`claw-node` runs:

- local node host
- local compatibility gateway when enabled
- runtime lifecycle and health
- logs and upgrade logic

It is remotely managed by a control plane and does not own the full browser admin surface.

## Top-Level Architecture

The target architecture is split into four major layers.

### 1. Shared Frontend Product Surface

The current React package structure remains the application surface:

- `web`
- `shell`
- feature packages
- shared `core`, `infrastructure`, `types`, and `ui`

This frontend should work against a host-neutral platform contract instead of a desktop-only contract.

### 2. Host Core

The shared Rust host core owns:

- config loading and persistence
- process and service lifecycle
- gateway routing and compatibility translation
- plugin registry and capability enforcement
- storage and cache service abstractions
- audit, metrics, tracing, and health
- cluster-facing control abstractions

### 3. Control Plane

The control plane owns:

- browser entry and management UI hosting
- `/claw/manage/*` APIs
- `/claw/api/*` product APIs
- deployment orchestration
- node inventory and policy
- plugin lifecycle governance
- auth, RBAC, audit, and admin workflows

### 4. Node Host

The node host owns:

- OpenClaw runtime lifecycle
- local compatibility gateway
- model route projection
- runtime health and doctor
- active endpoint resolution
- logs, traces, and runtime metrics
- runtime upgrade, rollback, and repair

## Transport Boundary Model

The platform needs explicit transport boundaries so different protocols do not collapse into one accidental interface.

### Transport classes

- public HTTP or HTTPS API surface
- browser asset delivery surface
- local host IPC surface
- control-plane to node-host control channel
- plugin sidecar RPC surface

### Boundary rules

Public HTTP or HTTPS:

- serves `/claw/*`
- serves official compatibility alias paths
- serves browser management assets when hosted by server

Local IPC:

- used for desktop-local privileged host control
- should not be exposed as the general public API surface
- may use named pipes on Windows and Unix domain sockets on macOS or Linux

Control-plane to node-host:

- should be treated as a separate trusted control channel, even when both roles are co-located in one binary in combined mode
- must support later physical separation without changing the logical contract
- should default to HTTPS JSON APIs under `/claw/internal/v1/*` with mTLS or an equivalent node identity layer when crossing machine boundaries
- may collapse to in-memory calls or local IPC only when control plane and node host are co-located

Plugin sidecar RPC:

- should remain distinct from both public APIs and local host IPC
- must be permission-scoped and versioned
- may use gRPC as the preferred internal SPI transport without changing the public API model

### Co-location rule

In `desktop combined` and `server combined` modes, control plane and node host may be co-located in one process for early implementation efficiency.

That does not remove the logical boundary. Their contracts, lifecycle control, and privilege model must remain separable so they can split into independent processes or services later without redesign.

## Core Boundary: Control Plane vs Node Host

The most important architectural correction is the explicit split between control plane and node host.

### Control plane responsibilities

- desired state
- management UX
- browser access
- configuration governance
- API issuance and token policy
- deployment workflows
- node registration
- node grouping and policy assignment
- rollout orchestration

### Node host responsibilities

- observed state
- runtime supervision
- port and listener binding
- compatibility gateway publication
- health probes and doctor
- logs and metrics emission
- runtime repair, upgrade, and rollback
- local projection of managed configuration into runtime artifacts

### Non-goal

The control plane must not reach through the node host and mutate provider-specific runtime internals directly. It should express desired state through stable contracts and let the node host reconcile it.

## API Taxonomy

All platform-native APIs must use the `/claw/` prefix.

The formal API families are:

- `/claw/api/v1/*`
- `/claw/manage/v1/*`
- `/claw/internal/v1/*`
- `/claw/openapi/*`
- `/claw/health/*`
- `/claw/app/*`
- `/claw/admin/*`
- `/claw/plugins/{pluginId}/*`

### API family intent

`/claw/api/v1/*`

- user-facing product capabilities
- chat, channels, tasks, files, agents, workflows, marketplace actions
- safe for external consumer SDKs where product access is intended

`/claw/manage/v1/*`

- configuration, node inventory, rollout operations, storage providers, plugin management, audit views
- intended for operators, admins, automation, and management tooling

`/claw/internal/v1/*`

- internal coordination APIs between host components
- not intended for public clients

`/claw/openapi/*`

- OpenAPI documents, machine-readable schemas, and API discovery
- covers platform-native `/claw/*` APIs, not vendor-impersonating compatibility alias contracts

`/claw/health/*`

- liveness, readiness, metrics, and dependency health

`/claw/app/*`

- browser application entry and static assets

`/claw/admin/*`

- privileged operational entrypoints that may be separated from general product APIs
- reserved for installation-level bootstrap, break-glass recovery, or platform-owner actions
- not the default home for routine operational management APIs, which should remain under `/claw/manage/v1/*`

`/claw/plugins/{pluginId}/*`

- plugin-owned HTTP surfaces that are explicitly registered and permission-scoped

## Compatibility Gateway Rule

There is one formal exception to the `/claw/*` rule.

Compatibility gateway APIs must support both:

- platform-governed endpoints under `/claw/gateway/...`
- official-looking non-`/claw` alias paths for drop-in client compatibility

This exception is mandatory because `OpenClaw` and external clients need to speak the provider-native protocol shapes without Claw-specific path rewriting.

### Required dual-publication model

For each compatibility family, publish both:

- governed path:
  - `/claw/gateway/openai/...`
  - `/claw/gateway/anthropic/...`
  - `/claw/gateway/gemini/...`
- official alias path:
  - OpenAI: `/v1/...`
  - Anthropic: `/v1/...`
  - Gemini: `/v1beta/...` and `/v1/...` where the provider standard uses them

### Important collision rule

The non-`/claw` aliases must not be implemented as one naive flat router. Some protocol paths collide, for example OpenAI and Anthropic both define `/v1/models`.

The correct rule is:

- external publication should use one canonical domain
- internal routing may still use multiple listeners or services
- ambiguous alias paths must be resolved by a protocol-aware router

This keeps the public surface unified while preserving standards fidelity and routing safety.

## Compatibility Gateway Standard

The compatibility gateway is a first-class platform subsystem, not a compatibility afterthought.

### OpenAI-compatible minimum surface

Mandatory endpoints:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`

Mandatory protocol rules:

- auth: `Authorization: Bearer <token>`
- streaming: SSE with OpenAI-style chunk framing
- completion terminator: `[DONE]`
- error shape: OpenAI-style `error` envelope

### Anthropic-compatible minimum surface

Mandatory endpoints:

- `GET /v1/models`
- `POST /v1/messages`

Mandatory protocol rules:

- auth: `x-api-key`
- required versioning support: `anthropic-version`
- optional beta passthrough: `anthropic-beta`
- streaming: Anthropic event stream semantics
- error shape: Anthropic-style error envelope

### Gemini-compatible minimum surface

Mandatory endpoints:

- `GET /v1beta/models`
- `POST /v1beta/models/{model}:generateContent`
- `POST /v1beta/models/{model}:streamGenerateContent`
- `POST /v1beta/models/{model}:embedContent`

Mandatory protocol rules:

- auth: query `key=` and `x-goog-api-key`
- streaming: Gemini stream semantics for content chunks
- error shape: Gemini-style REST error body

### Compatibility quality rule

When a request cannot be fulfilled, the gateway should return the provider-native style of error body whenever possible. Clients should not need Claw-specific error parsing to understand failures.

### Unsupported feature rule

If the incoming request is valid for the upstream protocol but unsupported by the configured route or model, the compatibility gateway should:

- reject the request explicitly
- return a provider-style error envelope
- avoid silently dropping unsupported fields

## Listener Publication Topology

The publication topology should differ slightly by host shell, but follow one unified rule set.

### Unified external domain rule

Server, Docker, and Kubernetes deployments should expose one canonical external domain, for example:

- `https://api.example.com`

All public entrypoints are then published under that single domain:

- platform APIs: `https://api.example.com/claw/*`
- browser management: `https://api.example.com/claw/app/*`
- OpenAI compatibility: `https://api.example.com/v1/*`
- Anthropic compatibility: `https://api.example.com/v1/*`
- Gemini compatibility: `https://api.example.com/v1beta/*` and provider-standard `v1` forms where applicable

Internal implementation may still use multiple listeners or multiple services, but they should be hidden behind one external domain and one ingress surface.

### Desktop defaults

Desktop should default to loopback-only publication.

Recommended model:

- one canonical loopback base URL using `127.0.0.1` by default
- optional friendly `.localhost` alias such as `api.sdkwork.localhost`
- one primary platform listener serving `/claw/*` and `/claw/app/*`
- optional internal compatibility listeners for protocol-specific handling

The current desktop proxy default on `18791` can remain the first compatibility listener internally, but the default public contract should prefer the concrete loopback IP for maximum client compatibility.

### Server defaults

Server should default to one public listener domain and may use additional internal listeners behind it.

Recommended public publication:

- canonical domain: `https://api.example.com`
- public listener: `0.0.0.0:18080`

Recommended internal structure:

- control-plane router for `/claw/*`
- compatibility router for exact provider alias paths
- optional protocol-specialized internal listeners if operationally useful

Compatibility listeners should be independently enableable and may remain internal-only in hardened environments.

### Docker and Kubernetes publication

For container deployment, the external recommendation is also one canonical domain:

- `https://api.example.com`

Ingress or gateway routing should expose:

- `/claw/*` to the control plane
- exact OpenAI-compatible paths such as `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`
- exact Anthropic-compatible paths such as `/v1/messages`
- exact Gemini-compatible paths such as `/v1beta/models/*` and provider-standard `v1` model action paths

The only ambiguous standard path in the initial minimum surface is `/v1/models`. That path should be handled by a protocol-aware compatibility router using:

- request path
- protocol-specific headers
- token binding metadata
- explicit fallback protocol hint for non-standard custom clients only

Internally, Kubernetes may still route to separate services for control plane, OpenAI compatibility, Anthropic compatibility, Gemini compatibility, or a shared compatibility router. That split is an internal deployment choice and should not leak into the external domain model.

## Single-Domain Compatibility Routing Strategy

Under a single external domain, compatibility routing must be deterministic.

### Routing priority order

Gateway request resolution should work like this:

1. exact governed path under `/claw/gateway/{protocol}/*`
2. exact protocol-unique alias path
3. ambiguous alias path resolution through token-bound protocol metadata
4. protocol-specific headers
5. explicit compatibility query hint for non-standard custom clients only
6. fail closed with a neutral compatibility negotiation error when protocol resolution has not completed, or with a provider-style error once a protocol family is known

Governed `/claw/gateway/{protocol}/*` paths are unambiguous and should bypass alias ambiguity logic entirely.

### Exact protocol-unique paths

These paths are unambiguous and should route directly:

- OpenAI:
  - `/v1/chat/completions`
  - `/v1/responses`
  - `/v1/embeddings`
- Anthropic:
  - `/v1/messages`
- Gemini:
  - `/v1beta/models`
  - `/v1beta/models/{model}:generateContent`
  - `/v1beta/models/{model}:streamGenerateContent`
  - `/v1beta/models/{model}:embedContent`
  - provider-standard `v1` model action paths where the Gemini API requires them

### Ambiguous path handling

The initial minimum compatibility matrix has one important ambiguous path:

- `GET /v1/models`

That path is valid for both OpenAI-compatible and Anthropic-compatible clients.

The platform should resolve `GET /v1/models` using this decision order:

1. if the presented compatibility token is bound to exactly one protocol, route to that protocol
2. else if `anthropic-version` is present, route to Anthropic
3. else if `x-api-key` is present and `Authorization: Bearer` is absent, route to Anthropic
4. else if `Authorization: Bearer` is present, route to OpenAI
5. else fail closed with a neutral compatibility negotiation error, or with a provider-style unauthorized or bad-request response only when one protocol family is already implied by the presented auth transport

The platform should not guess based only on user-agent strings.

After protocol resolution, the response schema, headers, and error style for `GET /v1/models` must follow the resolved protocol family rather than a normalized Claw response shape.

### Token binding rule

For official non-`/claw` alias paths, compatibility tokens should be single-protocol by default.

Examples:

- one token bound to OpenAI compatibility
- one token bound to Anthropic compatibility
- one token bound to Gemini compatibility

This removes ambiguity for standard clients and keeps routing predictable.

### Multi-protocol token rule

Multi-protocol tokens may exist for internal use or advanced automation, but they should be constrained:

- allowed on `/claw/gateway/*` governed endpoints
- not recommended for official alias paths
- rejected on ambiguous alias paths unless a deterministic protocol can be derived from headers

### Protocol-specific header rules

The compatibility router should treat these as authoritative protocol signals:

- OpenAI:
  - `Authorization: Bearer <token>`
- Anthropic:
  - `x-api-key`
  - `anthropic-version`
  - `anthropic-beta`
- Gemini:
  - `x-goog-api-key`
  - query `key=...`

If conflicting protocol signals are present in the same request, the platform should fail closed instead of picking one.

### Fail-closed behavior

If protocol resolution remains ambiguous before a protocol family is known, the request should fail with:

- a small neutral compatibility negotiation error

If auth transport or other protocol signals already narrow the family, the request should instead fail with:

- provider-style unauthorized when auth is missing or invalid
- provider-style bad-request when protocol signals are contradictory

The response should not expose internal routing details.

## Gateway Token Model

The single-domain compatibility design requires a stricter token model.

### Token classes

The platform should distinguish:

- platform tokens for `/claw/*`
- compatibility tokens for official alias paths

### Compatibility token claims

A compatibility token record should include:

- token id
- tenant or workspace id
- protocol family
- allowed route ids
- allowed model ids or model policy
- rate-limit profile
- expiration and rotation metadata
- audit labels

### Token material handling rule

- compatibility token plaintext should be shown only at issuance time unless an explicit one-time reveal policy is defined
- the durable store should keep a hashed or otherwise non-plaintext verifier plus metadata, not casually readable raw token material
- lookup and revocation must remain fast enough for high-throughput gateway traffic

### Token presentation rule

Compatibility credentials may use protocol-oriented presentation styles, but they remain Claw-issued credentials internally.

The platform should define:

- a stable token identifier format for audit and revocation
- optional human-recognizable token prefixes by protocol family
- a clear distinction between token identifier, public prefix, and secret body

### Protocol credential separation rule

For official non-`/claw` alias usage, each issued compatibility secret should bind to exactly one protocol family.

That means:

- an OpenAI-compatible secret is not the same issued secret as an Anthropic-compatible secret
- a Gemini-compatible secret is not the same issued secret as an OpenAI-compatible secret
- one principal may own multiple compatibility credentials, but each credential remains single-protocol on alias paths

### Header compatibility rule

Credential transport must follow the selected protocol family:

- OpenAI compatibility via `Authorization: Bearer`
- Anthropic compatibility via `x-api-key`
- Gemini compatibility via `x-goog-api-key` or query `key=`

The internal gateway auth system may share verification infrastructure, but the issued credential material and accepted presentation on official alias paths should remain protocol-specific.

### Issuance rule

The management plane should issue compatibility credentials explicitly by protocol family. It should not silently reuse a broad `/claw/*` management token as a provider-compatible API key.

### Response filtering rule

Compatibility responses must be filtered by the effective token policy.

Examples:

- `GET /v1/models` should list only the models allowed for that compatibility credential
- route- or model-restricted credentials must not reveal inaccessible models in compatibility listings
- error behavior should remain provider-compatible while still enforcing Claw policy

## Single-Domain Ingress and Edge Topology

The public edge should remain simple even when internal deployment becomes more advanced.

### Recommended edge pattern

Use one canonical external domain and one TLS termination surface.

Examples:

- `https://api.example.com`
- `https://claw.example.com`

That edge then forwards:

- `/claw/*` to the control-plane router
- compatibility alias paths to the compatibility router

### Bare-metal or VM server pattern

Recommended layout:

- one public bind port for HTTPS, typically `443`
- optional HTTP redirect port `80`
- one internal platform router
- one internal compatibility router

These internal routers may live:

- inside one `claw-server` process, or
- in separate internal listeners behind the same edge

The external contract remains one domain either way.

### Docker pattern

Recommended layout:

- publish container port `443` or `18080` from one ingress container or one all-in-one server container
- keep internal compatibility services on private container network only
- expose exactly one public hostname

### Kubernetes pattern

Recommended layout:

- one `Ingress` or `Gateway`
- one public TLS certificate
- one external hostname
- one path-routing policy tree

Internal service choices may include:

- one `claw-server` service for all traffic
- one control-plane service plus one compatibility-router service
- further internal splits by protocol if scaling requires it

Those internal service splits are operational details only.

## TLS and Port Policy

Single-domain publication also needs a clear TLS policy.

### Production recommendation

- external HTTPS required
- TLS terminated at the public edge or by `claw-server`
- HSTS enabled when public internet exposure is intended
- HTTP redirected to HTTPS by default

### Internal transport recommendation

Between edge and internal services:

- plaintext HTTP is acceptable only on private loopback or trusted private network
- mTLS is recommended for multi-node or multi-service production topologies

### Port defaults

Recommended defaults:

- HTTPS: `443`
- HTTP redirect: `80`
- self-hosted non-TLS fallback: `18080`

Desktop remains loopback-first and may continue to use developer-friendly local ports.

## Browser Management Surface

`claw-server` must include a built-in Rust web server that:

- serves the browser management UI
- serves the platform APIs
- serves health and OpenAPI endpoints
- optionally serves compatibility gateway listeners when enabled

The browser application should be reachable directly from the same runtime. No external Node.js app server should be required in production.

## Authentication and Authorization

The architecture must separate auth concerns by API family.

### Product API auth

- user sessions
- personal tokens
- service tokens where product automation is intended

### Management API auth

- operator sessions
- admin tokens
- service accounts with management scopes

### Compatibility gateway auth

- gateway tokens that look like provider-native API keys to clients
- mapping from external compatibility token to internal route and policy context

### Minimum authorization model

Tokens should carry scopes aligned to API families:

- `claw:api:*`
- `claw:manage:*`
- `claw:admin:*`
- `claw:gateway:openai`
- `claw:gateway:anthropic`
- `claw:gateway:gemini`

## Tenant and Workspace Isolation Model

The platform needs a formal isolation model before server and multi-node deployment can scale safely.

### Isolation scopes

The system should recognize these scopes:

- `installation`
- `tenant`
- `workspace`
- `user`
- `node`

### Scope intent

`installation`

- one deployed product instance
- owns global configuration, plugins, storage providers, ingress, and node fleet registration

`tenant`

- the primary ownership boundary for data, users, tokens, quotas, and audit
- required in server mode
- optional in desktop mode where a single local user can be treated as one implicit tenant

`workspace`

- a tenant-scoped working boundary for routes, assistants, files, model policies, and automation
- the main collaboration boundary when one tenant contains multiple teams or projects

`user`

- a human principal inside one tenant

`node`

- a managed runtime boundary that executes workloads on behalf of a tenant or workspace policy context

### Deployment posture by mode

Desktop:

- single installation
- single implicit tenant
- one or more local workspaces

Server single-tenant:

- single installation
- one explicit tenant
- one or more workspaces

Server multi-tenant:

- single installation
- multiple tenants
- tenant-scoped workspaces, quotas, tokens, and audit partitions

### Isolation rules

- tenant data must never be co-mingled in logical queries without an explicit cross-tenant admin capability
- workspace resources must be scoped by tenant first, workspace second
- node registration must carry tenant ownership or explicit shared-service designation
- compatibility tokens must be tenant-bound and optionally workspace-bound

## Principal and RBAC Model

The platform should distinguish actor types explicitly.

### Principal types

- `end-user`
- `operator`
- `admin`
- `service-account`
- `node-agent`
- `plugin-runtime`
- `compatibility-client`

### RBAC baseline

The default role model should be:

- `installation-owner`
- `tenant-admin`
- `tenant-operator`
- `workspace-admin`
- `workspace-developer`
- `workspace-viewer`
- `billing-admin`
- `security-auditor`

### Permission evaluation rule

Authorization should combine:

- principal role grants
- token scopes
- tenant ownership
- workspace ownership
- resource policy
- runtime safety policy

The platform should use deny-by-default evaluation.

### Managed node permissions

`node-agent` principals should not receive broad user-style permissions. They should receive narrowly scoped permissions such as:

- heartbeat
- pull desired state
- publish observed state
- upload health and audit events
- perform approved runtime operations

## Session and Token Lifecycle

The platform should standardize session and token classes rather than growing ad hoc credentials over time.

### Session classes

- browser user session
- browser admin session
- API personal access token
- service account token
- compatibility token
- node join token
- node runtime certificate or rotating node credential
- plugin sidecar credential

### Lifecycle rules

- every token must have an issuer, owner scope, creation timestamp, expiration policy, and revocation status
- long-lived credentials must support rotation without downtime
- refreshable browser sessions should be separate from API bearer tokens
- compatibility tokens should be independently revocable without invalidating browser sessions
- node bootstrap credentials should be short-lived and one-time-use whenever possible

### Revocation rules

Revocation should support:

- immediate deny-list or version bump invalidation
- scheduled expiration
- tenant-wide emergency rotation
- workspace-scoped credential invalidation

## Secret Management Model

The platform should treat secrets as first-class managed assets.

### Secret categories

- upstream provider API keys
- compatibility token secrets
- session signing keys
- database credentials
- Redis credentials
- node bootstrap secrets
- plugin-issued credentials
- TLS private keys

### Secret handling rules

- no platform API should echo raw secret values after creation unless an explicit one-time reveal policy is defined
- frontend runtime contracts should expose secret metadata, not secret values
- plugins should receive scoped secret handles or resolved runtime credentials only when explicitly permitted
- logs, audit records, and traces must redact secret-bearing material
- query-string credential forms such as Gemini-style `key=` must be redacted before access logging, tracing, metrics labeling, or audit persistence

### Secret cryptography rule

- server-side secret values must be stored encrypted at rest, not as casually readable plaintext in the main database
- the secret system should use envelope encryption or an equivalent key-hierarchy model
- the root or key-encryption key must be separable from the encrypted secret records
- secret rotation should support both secret-value rotation and key-hierarchy rotation
- backups and export flows must not silently downgrade encrypted secret material into plaintext artifacts

### Secret storage by mode

Desktop:

- local secure OS-backed storage when available
- encrypted local store fallback only when platform-native secret storage is unavailable

Server:

- database metadata plus secure secret backend abstraction
- pluggable secret backends in future, but one built-in secure provider is required from the start

### Built-in server secret provider rule

The built-in server provider should, at minimum, separate:

- secret metadata in the durable application store
- encrypted secret payload storage
- a master key source supplied by environment, OS secret store, or external key manager integration

The built-in provider is acceptable for first release, but the contract must stay compatible with future KMS or vault integrations.

### Secret provider abstraction

The host core should define a `SecretStore` contract rather than letting features or plugins read secret persistence directly.

## Quotas and Rate Limiting

The platform needs quota and rate-limit semantics at the architecture level.

### Enforcement scopes

- installation
- tenant
- workspace
- user
- token
- route
- model

### Required limit classes

- requests per minute
- concurrent streams
- tokens per minute
- tokens per day or billing window
- admin operation burst limits
- node operation concurrency

### Runtime behavior

- Redis-backed distributed rate limiting is recommended in server standard and HA profiles
- in-memory or local SQLite-backed fallback is acceptable for desktop and low-scale server profiles
- compatibility gateway limits should be independently configurable from `/claw/*` API limits

## Audit and Compliance Model

The platform should define audit as an explicit subsystem, not an observability side effect.

### Audited event classes

- auth and session events
- token issuance and revocation
- secret create, rotate, and delete
- plugin install, enable, disable, and failure
- node registration and trust changes
- deployment and rollout operations
- gateway route changes
- model policy changes
- privileged admin actions

### Minimum audit fields

Each audit record should include:

- event id
- timestamp
- actor principal id
- actor type
- tenant id
- workspace id when applicable
- target resource kind
- target resource id
- action
- result
- request correlation id
- source IP or node identity when available
- redacted metadata payload

### Audit durability rule

- desktop stores local audit durably in SQLite
- server stores audit in the primary durable store and may project to external sinks
- audit writes for privileged actions should be fail-safe or explicitly surfaced when persistence is unavailable

## API Versioning and Compatibility Policy

The platform needs a formal versioning rule to avoid accidental contract drift.

### Native API versioning

- `/claw/api/v1/*` and `/claw/manage/v1/*` are the stable major-version roots
- additive fields and additive endpoints are preferred within a major version
- breaking changes require a new major version path

### Compatibility API versioning

- official compatibility aliases follow the upstream provider version surface
- Claw should not invent custom compatibility version prefixes for provider-standard aliases
- provider-specific behavior changes must be tracked against a compatibility matrix, not hidden inside the same path without disclosure

### Deprecation rule

- deprecation should be announced through management API metadata, release notes, and OpenAPI docs
- platform-native APIs should support a defined overlap window between major versions
- compatibility APIs should prefer vendor-aligned behavior updates over Claw-specific divergence

## Node Trust and Enrollment Model

Multi-node deployment requires a formal trust-establishment process.

### Node enrollment flow

Recommended flow:

1. control plane issues short-lived node join credential
2. node boots and presents join credential
3. control plane validates expected tenant or installation binding
4. node receives a rotating node identity credential or certificate
5. all subsequent control traffic uses the node identity, not the bootstrap secret

### Node trust levels

- `managed-trusted`
- `managed-restricted`
- `attached-observed`
- `quarantined`

### Trust policy rule

- attached nodes must not automatically receive the same privileges as managed nodes
- quarantined nodes may continue to publish health and logs but should not accept privileged rollout commands
- node identity rotation should be supported without re-enrolling the whole node whenever possible

## Storage and Cache Architecture

Desktop and server have different requirements and should not be forced into the same persistence posture.

### Desktop storage rule

Desktop uses SQLite as the primary durable local store.

This is mandatory and should remain the default for:

- app state
- provider routes
- runtime health snapshots
- local audit
- local observability indexes

### Server storage rule

Server must support multiple database backends and Redis as provider plugins.

Recommended server database progression:

- V1: `SQLite`, `PostgreSQL`
- V2: `MySQL/MariaDB`

Redis support should be a separate provider capability, not folded into the main relational database provider.

### Redis capability model

Redis should back optional or required services for:

- cache
- session
- distributed lock
- pubsub
- rate limiting

### Storage abstraction rule

Business features and most plugins should not receive raw database connections. The platform should expose higher-level service contracts such as:

- `StateStore`
- `ConfigStore`
- `AuditStore`
- `ArtifactStore`
- `CacheStore`
- `LeaseManager`
- `EventBus`

This keeps storage replaceable and reduces coupling.

## Storage Provider Profiles

The platform should define standard deployment profiles.

### Desktop profile

- primary DB: SQLite
- Redis: disabled
- topology: single machine

### Server single-node profile

- primary DB: SQLite for evaluation or low-concurrency single-node deployments, or PostgreSQL for durable production use
- Redis: optional
- topology: one server, low operational overhead

### Server standard profile

- primary DB: PostgreSQL
- Redis: enabled
- topology: production server with browser access and API traffic

### Server HA profile

- primary DB: PostgreSQL or MySQL/MariaDB
- Redis: required
- topology: horizontally scaled control plane and multi-node runtime fleet

## Plugin Architecture Standard

The plugin system should be formalized now so future extension does not fragment the platform.

### Plugin object model

Core concepts:

- `Plugin`
- `Module`
- `ExtensionPoint`
- `ServiceContract`
- `Capability`
- `Permission`

### Plugin categories

The platform should standardize these plugin kinds:

- `storage-provider`
- `cache-provider`
- `auth-provider`
- `gateway-provider`
- `deploy-provider`
- `observability-provider`
- `feature-plugin`
- `ui-plugin`
- `workflow-plugin`
- `policy-plugin`
- `operator-extension`

### Plugin scope model

Plugins should distinguish package distribution scope from activation scope.

### Package distribution scope

The installed plugin package should declare one of:

- `installation`
- `tenant`
- `workspace`

### Activation scope

The platform should separately track where a plugin is enabled or configured:

- installation-wide
- tenant-wide
- workspace-wide

This distinction matters because a plugin package may be installed once at the installation level but enabled only for one tenant or workspace.

### Default expectations

- infrastructure plugins such as `storage-provider`, `cache-provider`, and `auth-provider` are installation-scoped
- most `feature-plugin`, `workflow-plugin`, and `ui-plugin` implementations should be installation-installed but tenant- or workspace-activated

Installation-scoped plugins must not accidentally read or mutate tenant-local business data unless their granted permissions explicitly allow it.

### Execution targets

Each plugin declares one or more targets:

- `desktop`
- `server`
- `node`
- `browser`
- `operator`
- `shared`

### Execution modes

The platform should support:

- trusted in-process plugin
- sandboxed WASM plugin
- sidecar plugin over gRPC

The platform should not start with arbitrary native dynamic library loading.

### Target safety rules

- `browser` target plugins must never receive direct secret-store or raw storage-provider access
- `storage-provider` and `cache-provider` plugins should not run in the browser target
- `auth-provider` plugins that issue credentials must be installation-scoped unless a stronger tenant-isolation model is explicitly defined

### Trust levels

Plugins must declare one of:

- `core`
- `vendor-signed`
- `org-signed`
- `sandboxed`
- `dev-only`

### Plugin package format

A plugin package should be a signed archive, for example `*.clawplug`, containing:

- `plugin.json` manifest
- checksums
- signatures
- config schema
- UI bundle when applicable
- WASM module or sidecar descriptor
- migration metadata

### Minimum manifest fields

Every plugin manifest should define:

- `id`
- `version`
- `displayName`
- `kind`
- `targets`
- `executionMode`
- `trustLevel`
- `entrypoints`
- `extensionPoints`
- `permissions`
- `capabilities`
- `dependencies`
- `configSchema`
- `activationEvents`
- `signature`
- `checksums`

### Plugin lifecycle states

The platform should model:

- `discovered`
- `verified`
- `installed`
- `resolved`
- `loaded`
- `active`
- `degraded`
- `blocked`
- `stopped`
- `removed`

### Plugin route rule

Core platform routes stay under the platform namespaces. Plugin HTTP surfaces should be mounted only under:

- `/claw/plugins/{pluginId}/*`

No plugin should claim top-level `/claw/api/*` or compatibility alias roots directly.

## Plugin Permission Model

Permissions should be explicit and capability-based.

Suggested examples:

- `storage.read`
- `storage.write`
- `cache.read`
- `cache.write`
- `gateway.route.read`
- `gateway.route.write`
- `node.deploy`
- `node.restart`
- `metrics.read`
- `audit.read`
- `browser.ui.mount`

Desktop should use a stricter default policy than server.

## Runtime and Gateway Plugins

Not every extension should be equal. Some extension points are platform-critical.

### Storage provider plugins

Used for:

- SQLite
- PostgreSQL
- MySQL/MariaDB

### Cache provider plugins

Used for:

- Redis
- future compatible cache backends

### Gateway provider plugins

Used for:

- protocol translators
- upstream vendor adapters
- special request-shaping behavior

These should remain under platform governance and should not bypass the compatibility standards.

## Technology Selection

The runtime stack should align with the current, already-proven workspace direction.

### Required Rust web stack

- `axum 0.8`
- `tokio`
- `tower`
- `tower-http`
- `reqwest` with `rustls`
- `serde`
- `tracing`

### Recommended supporting libraries

- OpenAPI: `utoipa`
- database abstraction: `sqlx`
- desktop SQLite: `rusqlite`
- Redis: `redis-rs`
- sidecar SPI: `tonic`
- WASM sandbox: `wasmtime`
- metrics: `metrics`, `prometheus`
- distributed tracing: `opentelemetry`

### Why this stack is correct

It matches the current desktop runtime direction and avoids introducing a second Rust web stack. The server mode should be an evolution of the current host runtime architecture, not a parallel reinvention.

## Deployment Matrix

### Desktop packaging

- Windows MSI
- macOS DMG
- Linux AppImage
- Linux deb
- Linux rpm

### Server packaging

- Windows zip
- Windows MSI with service mode
- Linux tarball
- Linux deb
- Linux rpm
- systemd service definitions

### Container packaging

At minimum provide:

- `claw-server:all-in-one`
- `claw-server:control-plane`
- `claw-node:runtime`

### Kubernetes packaging

Rollout order:

- Helm charts first
- Operator later

## Browser and API Deployment Rules

Server, Docker, and Kubernetes deployments must all support:

- browser-based management
- product APIs
- management APIs
- optional compatibility gateway exposure

The server product is not just a headless daemon. It must be operable through a browser without requiring the desktop shell.

## Recommended Delivery Phases

### Phase 1: Host core generalization

- make runtime contracts host-neutral
- extract shared host core from current desktop-specific service posture
- define control plane vs node host contracts

### Phase 2: Server runtime shell

- create `claw-server`
- host browser UI with Rust web server
- expose `/claw/*` API families
- support single-node combined mode

### Phase 3: Compatibility gateway standardization

- formalize governed `/claw/gateway/*` routes
- publish official protocol alias routes under the unified external domain
- define standards-compatibility tests

### Phase 4: Storage and plugin provider platform

- add storage SPI
- add Redis SPI
- introduce plugin manifest, verification, and lifecycle

### Phase 5: Deployment and orchestration

- Docker images
- Helm charts
- remote node registration
- server control-plane-only mode

### Phase 6: Operator-grade scale-out

- `claw-operator`
- advanced rollout control
- policy-driven fleet management

## Decision Stability Guide

Not every statement in this spec has the same change cost. The implementation plan should treat some decisions as architectural anchors and others as tunable defaults.

### High-stability decisions

These should be treated as architecture anchors unless a future spec explicitly replaces them:

- platform-native APIs use `/claw/*`
- compatibility APIs support both governed `/claw/gateway/*` endpoints and official alias paths
- external publication uses one canonical domain
- host core is shared while `desktop`, `server`, and `node` remain separate runtime shells
- desktop remains SQLite-first
- server storage and Redis integrations remain provider-driven
- plugin execution is limited to trusted in-process, WASM sandbox, or sidecar models

### Medium-stability decisions

These are recommended defaults but may evolve without replacing the overall architecture:

- exact package and crate names
- default public and loopback ports
- default server database profile
- initial role names
- exact token prefix format

### Low-stability decisions

These are implementation defaults and should remain adjustable through configuration or deployment policy:

- ingress controller choice
- reverse-proxy product choice
- exact internal service splits behind the public edge
- Docker image layering details
- Kubernetes service topology details

### Change control rule

If a future change affects a high-stability decision, it should be recorded through a follow-up architecture spec. Medium- and low-stability decisions may be refined in narrower subsystem specs as long as they do not violate the architectural anchors above.

## Remaining Refinement Backlog

This V7 architecture is now structurally coherent, but several areas still need deeper follow-up specs before large-scale implementation begins.

### 1. Data model specification

Still needed:

- partly refined by `2026-04-02-claw-manage-resource-model-design.md`
- desired-state projection and config-projection semantics are partly refined by `2026-04-03-claw-desired-state-projection-design.md`
- canonical tenant, workspace, node, token, plugin, and route schemas
- migration rules from current desktop-biased runtime contracts
- retention and archival rules for audit and observability data

### 2. Public API contract specification

Still needed:

- management resource boundaries are partly refined by `2026-04-02-claw-manage-resource-model-design.md`
- credential and secret management APIs are partly refined by `2026-04-02-claw-manage-credential-and-secret-api-design.md`
- rollout and desired-state promotion APIs are partly refined by `2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md`
- endpoint-by-endpoint OpenAPI design for `/claw/api/v1/*`
- endpoint-by-endpoint management API design for `/claw/manage/v1/*`
- error envelope catalog for native platform APIs

### 3. Compatibility conformance matrix

Still needed:

- partly refined by `2026-04-02-claw-compatibility-conformance-and-credential-design.md`
- field-level endpoint and feature conformance fixtures for OpenAI, Anthropic, and Gemini
- explicit unsupported-feature catalog with golden error envelopes
- streaming test matrix and drift-detection fixtures for governed and alias paths

### 4. Plugin SPI specification

Still needed:

- exact manifest schema
- signing and verification flow
- WASM capability ABI
- sidecar gRPC contracts
- plugin upgrade and rollback rules

### 5. Secret backend specification

Still needed:

- partly refined by `2026-04-02-claw-compatibility-conformance-and-credential-design.md`
- endpoint-level management API design for secret issuance, reveal, rotate, revoke, and rekey operations
- external KMS or vault provider SPI
- backup, export, restore, and re-encryption rules for encrypted secret material

### 6. Billing, quota, and commercial policy

Still needed:

- quota metering pipeline
- billing event model
- hard-limit vs soft-limit behavior
- tenant plan enforcement

### 7. Edge and ingress reference architectures

Still needed:

- concrete server reverse-proxy examples
- concrete Docker Compose reference topology
- concrete Kubernetes `Ingress` or `Gateway API` reference manifests

### 8. Disaster recovery and backup policy

Still needed:

- backup and restore procedures by storage profile
- encryption-at-rest posture
- cross-region or off-machine backup recommendations for server deployments

### 9. Version skew and capability negotiation

Still needed:

- partly refined by `2026-04-02-claw-host-version-skew-and-capability-negotiation-design.md`
- exact `/claw/internal/v1/*` handshake payload schemas are partly refined by `2026-04-02-claw-internal-node-session-api-design.md`
- desired-state projection schema and rollback-safe apply artifact semantics are partly refined by `2026-04-03-claw-desired-state-projection-design.md`
- internal `/claw/internal/v1/*` error envelope rules are partly refined by `2026-04-03-claw-internal-error-envelope-design.md`
- rollout API fields for required capability predicates and degraded-admission policy are partly refined by `2026-04-03-claw-rollout-and-desired-state-promotion-api-design.md`
- plugin and subsystem-specific ABI version negotiation where capability keys alone are not sufficient

## Non-Goals

This architecture does not:

- replace OpenClaw internals with Claw-specific runtime logic
- flatten control plane and node runtime into one unstructured API surface
- require every deployment to use Redis
- allow plugins to bypass platform permission and signing policy
- treat compatibility gateway aliases as a replacement for platform-native APIs

## Success Criteria

The architecture is successful when:

- desktop and server share one host core but ship as distinct runtime packages
- server mode can start a Rust web server, bind a configured port, and serve browser management
- platform APIs remain consistently namespaced under `/claw/*`
- compatibility APIs support both `/claw/gateway/*` and official non-`/claw` aliases
- desktop stays SQLite-first
- server supports multiple databases and Redis through provider plugins
- plugin extension remains signed, permissioned, and low-coupling
- docker and kubernetes deployments expose both browser management and API surfaces
- OpenClaw and external clients can use OpenAI, Anthropic, and Gemini compatible endpoints without Claw-specific request rewriting
