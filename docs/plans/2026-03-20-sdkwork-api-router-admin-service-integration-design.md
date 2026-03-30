# SDKWork API Router Admin Service Integration Design

## Goal

Build the strongest practical integration between `sdkwork-claw-apirouter` and `sdkwork-api-router` so that:

- `sdkwork-api-router` remains the separately packaged backend authority
- Claw Desktop keeps the attach-first runtime lifecycle that is already in place
- `sdkwork-claw-apirouter` becomes a real operator console over router-native HTTP APIs
- the architecture supports both local managed embedding and standalone deployment
- the backend shape can scale toward an OpenRouter-like multi-tenant service with self-service API access

## Current Audit

### What is already strong

- Desktop runtime arbitration is already implemented and tested.
- Claw can now attach to an external router or start a managed bundled router.
- The admin API in `sdkwork-api-router` already owns the correct backend domains:
  - tenancy
  - projects
  - gateway API keys
  - provider catalog
  - routing policies
  - usage
  - billing

### What is still weak

The frontend feature package still uses mock-backed services for the majority of its data.

More importantly, the current frontend domain model is not yet canonically aligned with the upstream router model:

| Current UI concept | Upstream truth today | Status |
|---|---|---|
| unified API key | tenant + project + gateway API key | partial match |
| provider with apiKey | provider catalog + separate credential record | mismatched |
| group | best current mapping is tenant/workspace bucket | partial match |
| model mapping | closest router-native concept is routing policy and project routing preferences | partial match |
| usage record with api key id, ttft, duration, userAgent, reasoning effort | current router usage record stores project, model, provider, units, amount, token counts, timestamp | mismatched |

## Architecture Options

### Option 1: Keep mock feature models and bolt backend calls underneath

Pros:

- fastest short-term patching

Cons:

- preserves a leaky domain model
- forces lossy adapters everywhere
- makes later backend expansion harder

### Option 2: Bind the UI directly to raw router admin DTOs

Pros:

- low adapter cost

Cons:

- pollutes feature code with transport details
- makes web/desktop runtime resolution and auth harder to centralize
- couples the UI too tightly to backend wire format

### Option 3: Add a canonical router admin client and feature adapters, then replace mock slices progressively

Pros:

- preserves clean package boundaries
- centralizes runtime-aware base URL resolution and admin auth
- allows staged migration without breaking unfinished slices
- creates the right foundation for standalone and managed router modes

Cons:

- requires deliberate adapter work

## Decision

Choose **Option 3**.

This is the best match for the current repository architecture and the strongest long-term solution.

## Target Architecture

### 1. Router-native infrastructure client

Add a dedicated `sdkwork-api-router` admin client in `@sdkwork/claw-infrastructure` that owns:

- runtime-aware admin base URL resolution
- admin token/session storage
- admin login and session inspection
- typed methods for router-native route families

The client must prefer these base URL sources in order:

1. explicit override
2. dedicated admin env override
3. runtime bridge resolved admin health URL transformed into `/admin`
4. final same-origin `/admin` fallback for browser-hosted deployments

### 2. Feature service adapters

`@sdkwork/claw-apirouter` should not call `fetch` directly. It should consume the infrastructure client and adapt router-native DTOs into feature-facing view models.

During migration, adapters may use:

- router-first real data when the router is reachable and authenticated
- mock fallback only for unfinished slices

That keeps the product usable while we progressively replace the remaining mock paths.

### 3. Canonical backend domains

The frontend should converge on these backend-owned domains:

- Access and tenancy:
  - tenants
  - projects
  - gateway API keys
  - portal users
- Provider catalog:
  - channels
  - providers
  - credentials
  - models
  - provider health
- Routing:
  - routing policies
  - routing simulations
  - routing decision logs
- Usage and billing:
  - usage records
  - usage summary
  - billing summary
  - quota policies

### 4. Deployment modes

The same client/service design must work for:

- Claw-managed local router
- externally started local router
- remote standalone router deployment
- future multi-tenant SaaS operator deployment

### 5. Local router mapping

Local router mapping should be represented as runtime-derived endpoint selection, not hardcoded frontend configuration. The desktop runtime remains the authoritative resolver for the local admin bind.

## Domain Alignment Strategy

### Access and multi-tenant model

For an OpenRouter-like architecture, the canonical external service model should be:

- tenant = organization
- project = environment/app/workspace boundary
- gateway API key = customer-facing access secret
- routing policy = routing behavior and model/provider selection policy
- quota policy + billing ledger = monetization and guardrails

This is already the right upstream direction. The frontend should adapt to this model instead of inventing a parallel durable data system.

### Usage model gap

The current router `UsageRecord` does not yet store enough facts to fully match the current Claw usage UI.

Missing or insufficient fields for full parity:

- gateway api key identity on each usage record
- reasoning effort
- endpoint path
- request type
- cached token count
- ttft
- duration
- user agent

That means a fully product-aligned usage console requires an upstream router enhancement across:

- domain usage record
- storage schema
- admin API DTOs
- gateway ingestion path

Until that lands, the frontend should use honest derived fields instead of pretending the detail exists.

### Unified API key gap

The upstream API key model is security-correct: list responses expose hashed keys, not the plaintext secret. The current frontend table assumes existing keys can always be copied again, which is not a secure or router-native assumption.

Best product direction:

- show plaintext only once on creation
- list hashed/partially masked identities afterward
- keep copy-secret behavior only for newly created keys or explicitly stored temporary reveal state

### Provider configuration gap

The current provider UI mixes provider catalog metadata with credential material. Upstream treats these separately, which is the better architecture.

Best product direction:

- provider rows manage catalog metadata
- credential management becomes a dedicated operator flow
- tenant-scoped credentials stay distinct from provider records

## First Migration Slice

The best first production slice is:

- router-native admin session + base URL resolution
- real usage summary and usage record reads
- real usage filter option loading from router API key/project data

Why this slice first:

- it is read-heavy and reversible
- it proves the client/runtime/auth foundation
- it does not require rewriting the provider editor immediately

## Planned Follow-on Slices

1. Access slice:
   - tenants
   - projects
   - gateway API keys
   - one-time plaintext reveal on create
2. Provider catalog slice:
   - channels
   - providers
   - models
   - credentials
3. Routing slice:
   - routing policies
   - simulations
   - health snapshots
4. Usage parity slice:
   - upstream schema and API enhancement for richer request facts

## Testing Strategy

- infrastructure tests for admin base URL and auth token resolution
- feature tests for usage DTO adaptation, filtering, sorting, and fallback behavior
- contract checks that ensure Claw keeps a real feature package and router runtime surface
- targeted TypeScript checks for touched packages

## Decision Summary

The best solution is not to force the current mock-first view models to remain the source of truth. The best solution is:

- keep `sdkwork-api-router` separately packaged
- treat it as the canonical backend for provider, routing, access, usage, and billing concerns
- add a runtime-aware infrastructure admin client
- migrate the feature package by vertical slices
- upgrade upstream usage and access contracts where the product requires richer facts
