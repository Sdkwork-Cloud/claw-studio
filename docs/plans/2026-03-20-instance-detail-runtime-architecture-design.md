# Instance Detail Runtime Architecture Design

**Date:** 2026-03-20

**Status:** Autonomous approval by requirement owner. The user explicitly required self-directed iteration without waiting for review.

## Goal

Rework instance detail so it is driven by real Tauri runtime data instead of mock-only workbench aggregates, while keeping the UI abstract enough to support:

- built-in local OpenClaw
- local-external runtimes such as ZeroClaw
- remote runtimes such as ZeroClaw or IronClaw
- multiple storage backends including local file, SQLite, PostgreSQL, and future remote API mode

The page must describe the truth of an instance:

- what runtime it is
- how it is deployed
- how the app connects to it
- which capabilities are actually available
- where its state is stored
- what diagnostics the operator can trust

## Current Product Problems

The current `InstanceDetail` UI is visually rich, but the architecture is not yet trustworthy:

- the page shape is strong, but most deep data still comes from `studioMockService`
- Tauri only owns instance registry, config, logs, and conversations, so the page invents health and capability state in the feature layer
- remote and local-external instances are rendered as if they were shallow variants of the built-in OpenClaw runtime
- storage design exists in the desktop kernel, but instance detail does not expose storage binding, readiness, or deployment implications
- the page has no first-class overview of transport, auth, endpoint exposure, or capability degradation

This makes the product look more complete than the runtime actually is, which is risky for operations and future integrations.

## Official Runtime Reality

The detail architecture must reflect upstream behavior instead of assuming one universal Claw runtime.

### OpenClaw

Official docs and source show:

- the Gateway WebSocket is the primary control plane
- WebChat talks directly to the Gateway WebSocket and does not need a separate WebChat server
- the OpenAI-compatible HTTP endpoint is optional, disabled by default, served on the same gateway port, and uses gateway auth
- the CLI surface is gateway-first and includes `gateway`, `agent`, `send`, onboarding, and diagnostics flows

Implication:

- OpenClaw detail must expose both control-plane transport and auxiliary HTTP chat surface
- auth mode and loopback/private exposure matter
- built-in OpenClaw should be described as `local-managed + gateway-ws + optional openai-http`

### ZeroClaw

Official repo/docs show:

- Rust stable toolchain runtime
- single binary, no runtime dependencies
- `zeroclaw gateway` starts a gateway server and dashboard, default loopback port `127.0.0.1:42617`
- `zeroclaw daemon` starts the full autonomous runtime
- CLI has first-class surfaces for service management, channels, cron, memory, auth profiles, and diagnostics
- product direction includes a web dashboard, memory browser, config editor, cron manager, and tool inspector

Implication:

- ZeroClaw detail should be modeled as a runtime that can be `local-external` or `remote`, with meaningful support for tasks, memory, tools, and models
- service lifecycle might be app-managed only if we explicitly add a supervisor adapter later; today it should default to metadata plus connectivity for external installs

### IronClaw

Official repo/docs show:

- Rust implementation inspired by OpenClaw
- PostgreSQL 15+ with `pgvector` is a prerequisite
- web gateway uses real-time SSE/WebSocket streaming
- security model is capability-based with WASM sandboxing and strict boundary controls
- local data is stored in PostgreSQL, with audit and persistent memory emphasized

Implication:

- IronClaw detail needs database-first thinking
- the page must surface storage prerequisites and readiness, not just host/port
- capability availability should emphasize observability, persistent memory, routines, and provider/runtime security metadata

## Design Principles

### 1. Instance Detail Describes a Runtime Contract, Not a Vendor Dashboard

The page should not clone OpenClaw, ZeroClaw, or IronClaw native dashboards.

It should describe a neutral runtime contract:

- identity
- deployment
- transport
- storage
- capability availability
- health and diagnostics
- feature-specific datasets when available

### 2. Tauri Is the Source of Truth on Desktop

For desktop builds:

- Tauri `studio` owns instance detail snapshot assembly
- the feature layer maps and renders that snapshot
- frontend-only mock aggregation may remain only as a web fallback or for not-yet-migrated non-desktop slices

### 3. Capability Sections Must Degrade Gracefully

Every instance does not support every capability in the same way.

The UI must distinguish:

- `ready`
- `degraded`
- `configurationRequired`
- `unsupported`
- `planned`

Unsupported and planned are different:

- unsupported means the runtime model does not claim this capability
- planned means the runtime may support it, but Claw Studio has not integrated it yet

### 4. Storage Is Part of Instance Identity

Storage binding is not a settings footnote. It affects:

- data durability
- sync semantics
- remote connectivity
- migrations and upgrades
- whether the instance can support memory, task history, logs, and cross-device continuity

## Target Product Shape

## Sidebar Model

The workbench should add `overview` as the first section, followed by the current operational sections:

- `overview`
- `channels`
- `cronTasks`
- `llmProviders`
- `agents`
- `skills`
- `files`
- `memory`
- `tools`

`overview` becomes the runtime truth surface. The other sections become capability workspaces.

## Overview Section

`overview` should show:

- runtime kind, deployment mode, transport kind
- lifecycle owner: managed by Claw Studio, external process, or remote service
- endpoint list: base URL, gateway WebSocket URL, OpenAI-compatible endpoint when available
- auth summary: token required, password required, trusted proxy, or unknown
- storage binding summary: provider, profile, namespace, database, remote endpoint hint
- health score and health checks
- observability summary: logs availability, last seen timestamp, runtime status
- capability matrix with per-capability status and explanatory message
- data source labels so operators know what is authoritative versus derived

## Other Capability Sections

For this iteration:

- preserve existing UI where it already works well
- stop inventing top-level runtime truth in the feature layer
- gate each section with backend capability availability
- show a precise explanation when a section is unsupported, not configured, or not yet integrated for this runtime

Examples:

- built-in OpenClaw can expose chat, health, connectivity, config, logs, and storage immediately
- remote ZeroClaw may expose connectivity and storage metadata while deeper sections remain planned
- IronClaw may expose strong storage and security metadata before we integrate its detailed routines/memory APIs

## Tauri Service Boundary

Add a new `studio.getInstanceDetail` command backed by a `StudioInstanceDetailRecord`.

This record should contain:

- `instance`
- `config`
- `logs`
- `health`
- `lifecycle`
- `storage`
- `connectivity`
- `observability`
- `capabilities`
- `officialRuntimeNotes`

### Health

Health must be backend-derived, not page-derived.

It should include:

- score
- severity
- checks
- last evaluated timestamp

Checks can include:

- runtime status
- endpoint presence
- auth posture
- storage readiness
- logs availability

### Connectivity

Connectivity should describe actual reachable surfaces known to Claw Studio:

- primary transport
- auxiliary endpoints
- bind scope
- auth requirement
- whether the endpoint is configured or inferred

For built-in OpenClaw:

- gateway WebSocket endpoint
- gateway base HTTP endpoint
- `/v1/chat/completions` endpoint when enabled

### Storage

Storage should describe:

- provider kind
- bound profile id
- namespace
- database name if any
- connection configured hint
- remote endpoint hint if any
- readiness status
- capabilities such as durable/queryable/transactional/remote

### Observability

Observability should describe:

- log file presence
- log line count preview
- last seen timestamp
- whether runtime metrics are authoritative or placeholder

## Database Design Direction

Current runtime persistence can continue to use repository-style documents for:

- instance registry
- conversations

But the SQL-ready target model for instance detail should be:

- `instances`
- `instance_endpoints`
- `instance_storage_bindings`
- `instance_health_snapshots`
- `instance_capability_snapshots`
- `instance_observability_snapshots`
- `instance_runtime_notes`
- `conversations`
- `conversation_participants`
- `messages`
- `message_sync_state`

Recommended semantics:

- `instances.id` is the stable business id
- `instance_endpoints` stores transport surfaces and auth mode hints
- `instance_storage_bindings` stores backend identity separately from runtime host metadata
- `instance_health_snapshots` is appendable or periodically compacted for trendability
- `instance_capability_snapshots` is normalized so the UI can render section state consistently across runtimes
- `instance_observability_snapshots` stores log/diagnostic summaries without duplicating raw logs

## Local Versus Remote Data Acquisition

### Local-managed

- Tauri may read managed config and log files directly
- Tauri may supervise lifecycle
- detail can combine config, supervisor state, and storage binding into one snapshot

### Local-external

- Tauri should not mutate or assume external process internals
- detail should rely on stored metadata plus safe filesystem/config references only when explicitly configured
- lifecycle should be reported as external

### Remote

- Tauri should treat the runtime as a remote contract
- detail should use stored endpoint/auth/storage metadata and future health probes
- no attempt to read local files or start/stop the process

## Decision

For this iteration, implement a first-class Tauri-backed detail snapshot that powers:

- overview
- health
- connectivity
- storage
- observability
- capability availability

Keep deep workbench sections in place, but stop making them the source of truth for runtime identity.

## Success Criteria

- instance detail has a real backend-authored overview section
- different runtime kinds render different deployment, transport, storage, and capability states correctly
- built-in OpenClaw exposes gateway/auth/openai-http truth instead of feature-layer guesses
- the system is ready to expand ZeroClaw and IronClaw specific detail adapters without rewriting the page
- the database design is explicit and SQL-ready without forcing a full migration in this slice
