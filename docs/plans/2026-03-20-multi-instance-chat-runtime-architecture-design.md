# Multi-Instance Chat Runtime Architecture Design

**Date:** 2026-03-20

**Status:** Autonomous approval by requirement owner. The user explicitly requested self-directed design and implementation without waiting for additional review.

## Goal

Rebuild `claw-studio` chat and instance architecture so the desktop app can:

- seed a built-in default local instance on first launch
- manage multiple Claw instances instead of a single mock-backed active id
- support local-managed, local-external, and remote deployment modes
- persist instance and conversation data through the runtime storage profile instead of browser-only local state
- support multiple storage backends over time, including `sqlite`, `postgres`, and remote API mode
- provide a runtime abstraction that can host `openclaw`, `zeroclaw`, `ironclaw`, and future Claw runtimes without coupling the UI to one upstream protocol
- keep the web and desktop hosts thin while moving stateful behavior into shared services and the Tauri backend

## Current Problems

The current implementation cannot satisfy the product requirement set:

- chat sessions are stored in frontend Zustand persistence only
- `activeInstanceId` is only a frontend selection flag, not a real runtime routing boundary
- instance CRUD is not implemented and still depends on `studioMockService`
- Tauri already has storage and supervision primitives, but chat and instance state do not use them
- there is no durable domain model for runtime kind, transport kind, deployment mode, or storage binding

## Upstream Reality

The runtime abstraction must reflect how the upstreams actually differ.

- [OpenClaw repo](https://github.com/openclaw/openclaw) and [OpenClaw web docs](https://docs.openclaw.ai/web/webchat): Node and CLI first, with a Gateway WebSocket control plane and packaged CLI lifecycle.
- [ZeroClaw repo](https://github.com/zeroclaw-labs/zeroclaw): Rust-first, optimized for small deployments, with REST, WebSocket, and SSE oriented local-server capabilities.
- [IronClaw repo](https://github.com/nearai/ironclaw): Rust-first, heavier runtime, onboarding-oriented workflow, and PostgreSQL plus `pgvector` assumptions in its current architecture.

This means one hard rule for `claw-studio`:

- do not model “a Claw instance” as “an OpenClaw process”
- instead model it as `runtime kind + deployment mode + transport + capability set + storage binding`

## Approaches Considered

### Approach 1: Keep frontend-local chat and patch instance CRUD around it

Pros:

- fastest change
- minimal backend work

Cons:

- does not solve persistence, sync, or multi-instance chat ownership
- keeps chat and instance truth split across browser state and desktop state
- makes later `sqlite/postgres/remote-api` support harder

Rejected.

### Approach 2: Build a fully SQL-first backend immediately

Pros:

- ideal end state for `sqlite/postgres`
- strong schema discipline

Cons:

- too large for one safe vertical slice
- current storage layer already exists and would be bypassed instead of leveraged
- higher risk while the workspace is already very dirty

Rejected as the first delivery shape, but retained as the target persistence direction.

### Approach 3: Add a Tauri domain service layer with repository boundaries, start with document-backed persistence over the active storage profile, and keep SQL-ready schema contracts

Pros:

- gives a real backend now
- reuses existing `StorageConfig`, `StorageProfileConfig`, and `StorageDriverRegistry`
- keeps the architecture ready for `sqlite/postgres/remote-api` drivers later
- allows a stable vertical slice for instance CRUD and backend-persisted conversations

Cons:

- phase 1 persistence is document-oriented rather than fully relational
- needs careful repository boundaries to avoid painting the system into a corner

Chosen.

## Target Architecture

### 1. Domain Model

Add shared domain types for:

- `ClawRuntimeKind`: `openclaw | zeroclaw | ironclaw | custom`
- `ClawInstanceDeploymentMode`: `local-managed | local-external | remote`
- `ClawInstanceTransportKind`: `openclaw-gateway-ws | zeroclaw-http | ironclaw-web | openai-http | custom-http | custom-ws`
- `ClawInstanceStatus`: `online | offline | starting | error | syncing`
- `ClawStorageBinding`: active profile identity plus backend kind and namespace ownership
- `ClawInstanceRecord`: instance identity, runtime binding, deployment, transport, storage, capability metadata, config, and health-facing summary
- `ClawConversationRecord`: conversation metadata, participant instance ids, and messages
- `ClawChatMessageRecord`: durable message identity, role, sender instance, streaming status, and timestamps

### 2. Tauri Service Boundaries

Add backend domain services under the Tauri framework service container:

- `studio`: owns instance catalog and conversation persistence
- `storage`: remains the low-level provider abstraction
- `supervisor`: remains process lifecycle owner for local-managed runtimes
- `openclaw_runtime`: remains bundled runtime installer and config activator

Responsibilities:

- `studio` persists instance and conversation documents through the active storage profile
- `studio` seeds and refreshes the built-in `local-built-in` instance from the bundled OpenClaw runtime state
- `supervisor` starts and stops local-managed runtimes with app lifecycle
- the frontend only calls commands and renders state

### 3. Frontend Package Responsibilities

Keep package layering strict:

- `sdkwork-claw-types`: shared runtime and conversation contracts
- `sdkwork-claw-infrastructure`: platform contracts plus web fallback implementation
- `sdkwork-claw-desktop`: Tauri bridge and commands
- `sdkwork-claw-core`: instance directory consumers and active instance selection
- `sdkwork-claw-instances`: instance feature services and views
- `sdkwork-claw-chat`: chat state synchronization, UI, and send-flow orchestration

The web and desktop hosts stay thin.

## Persistence Strategy

### Phase 1 Repository Model

Persist via the active storage profile with document repositories:

- namespace `studio.instances`
  - key `registry`
- namespace `studio.chat`
  - key `conversation:<id>`
  - key `index`

This is intentionally a repository boundary, not the final storage format contract.

Why this is acceptable now:

- it immediately moves state ownership into Tauri
- it works with the existing local-file profile
- it can work unchanged with future `sqlite`, `postgres`, or `remote-api` drivers once those drivers are real

### Phase 2 SQL Repository Model

When SQL drivers are implemented, the repository interface should map to these tables:

- `instances`
- `instance_endpoints`
- `instance_storage_bindings`
- `instance_health_snapshots`
- `conversations`
- `conversation_participants`
- `messages`
- `message_sync_state`
- `sync_cursors`

Recommended relational design:

- `instances.id` is the stable user-facing instance id
- `conversations.primary_instance_id` points to the selected chat instance
- `conversation_participants` supports future multi-instance conversations
- `messages.sender_instance_id` tracks which runtime emitted the message
- `instance_storage_bindings` decouples runtime deployment from persistence backend

## Built-In Default Instance Model

The default instance must always exist on desktop:

- id: `local-built-in`
- runtime kind: `openclaw`
- deployment mode: `local-managed`
- transport kind: `openclaw-gateway-ws`
- storage binding: active local profile
- process owner: Tauri supervisor

Startup flow:

1. bootstrap framework context
2. activate bundled OpenClaw runtime
3. register PATH shims
4. start the managed OpenClaw gateway
5. upsert `local-built-in` into the studio instance catalog

Shutdown flow:

1. begin supervisor shutdown
2. stop managed runtime processes
3. finalize shutdown state

## Local vs Remote Deployment Modes

### Local-managed

- process lifecycle owned by Tauri
- config and logs owned by app-managed directories
- best fit for bundled OpenClaw

### Local-external

- app stores metadata, endpoint, and health
- process lifecycle stays outside the app
- useful for developer-installed ZeroClaw or IronClaw

### Remote

- app stores endpoint, auth reference, storage binding, and sync metadata
- no attempt to start or stop the remote process
- health checks and chat transport are remote-only

## Chat Model

Every conversation must belong to a primary instance, but the data model must support more than one participant.

Required fields:

- `primaryInstanceId`
- `participantInstanceIds`
- `messages`
- `title`
- `createdAt`
- `updatedAt`
- `messageCount`

This supports:

- normal single-instance chat today
- future instance-to-instance relay or comparison workflows

## Runtime Adapter Direction

The runtime adapter layer should normalize different upstreams into a shared capability surface:

- `chat`
- `health`
- `files`
- `memory`
- `tasks`
- `tools`
- `models`

Transport is runtime-specific:

- OpenClaw: gateway WebSocket
- ZeroClaw: local or remote HTTP and stream endpoints
- IronClaw: web gateway and SSE or WebSocket style interaction

The UI should ask for capability support, not hardcode runtime names.

## Sync and Consistency Rules

- the Tauri backend is the source of truth for desktop instances and conversations
- frontend stores are cache and interaction state only
- every optimistic chat update must flush back to Tauri
- switching active instance must hydrate the correct conversation set from backend state
- deleting an instance must also reconcile active selection and conversation ownership rules

## Security Rules

- built-in OpenClaw runtime management stays separate from `hub-installer`
- runtime auth references must not be hardcoded into frontend state
- local-managed transports should prefer loopback-only exposure
- storage profile public projections must continue to redact raw connection strings

## Performance Notes

- chat persistence should store per-conversation documents, not one giant global chat blob
- instance registry stays small and can be rewritten atomically
- optimistic message updates are acceptable because conversations are small append-oriented aggregates
- SQL repositories should be introduced only after the repository seam is stable

## Delivery Order

### Phase 1

- shared runtime and conversation domain types
- platform contracts and desktop bridge
- Tauri `studio` service with seeded built-in instance
- backend-persisted conversation store
- chat module hydration and instance switching

### Phase 2

- runtime adapter registry
- capability-driven chat send routing
- real health probing for remote and local-external instances

### Phase 3

- SQL drivers for `sqlite` and `postgres`
- remote API driver
- structured repository migration from document store to SQL

## Success Criteria

- the desktop app always has a real built-in default instance
- instance list and active instance selection no longer depend on mocks
- chat sessions survive app restart through backend persistence
- chat data is partitioned by instance
- the architecture no longer assumes every Claw runtime behaves like OpenClaw
