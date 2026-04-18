# Multi-Kernel Chat Standard Design

## Status

Approved design baseline for implementation.

## Goal

Define one kernel-native chat domain standard for Claw Studio so OpenClaw, Hermes, and future kernels share the same `agent`, `session`, `run`, and `message` contracts without collapsing into transport-first or UI-first abstractions.

## Hard Constraints

- This is a hard cut for a new application. No compatibility layer is required.
- The standard must not preserve dual authority between Studio-local conversations and kernel-native sessions.
- Kernel-native session truth must remain inside the owning kernel.
- Shared contracts must be kernel-neutral and extensible.
- OpenClaw-specific session semantics must not leak into the shared model.
- Hermes-specific SQLite/session-history semantics must not be flattened into OpenClaw-style session keys.
- UI state is not domain state.

## External References

- OpenClaw TUI and WebChat documents describe the native `agent + session` model, session keys such as `agent:<agentId>:<sessionKey>`, and gateway-authoritative history and streaming surfaces.
  - `https://docs.openclaw.ai/web/tui`
  - `https://docs.openclaw.ai/web/webchat`
- OpenClaw upstream source snapshot in this repo confirms agent-scoped session roots and session-key normalization.
  - `.cache/bundled-components/upstreams/openclaw/src/routing/session-key.ts`
  - `.cache/bundled-components/upstreams/openclaw/src/config/sessions/paths.ts`
- Hermes official docs describe session-native persistence, architecture, and session storage contracts.
  - `https://hermes-agent.nousresearch.com/docs/developer-guide/architecture`
  - `https://hermes-agent.nousresearch.com/docs/user-guide/sessions`
  - `https://hermes-agent.nousresearch.com/docs/developer-guide/session-storage`

## Current Problem

The current Claw Studio chat stack still mixes two incompatible ideas:

- a Studio-local `conversation` record used as a durable UI-facing source for non-gateway paths
- an OpenClaw-native gateway session model used as the authority for managed OpenClaw chat

This creates structural debt:

- chat behavior is route-first instead of kernel-domain-first
- `agent`, `session`, and `message` semantics are not standardized
- streaming runs, tool traces, and reasoning are forced into UI-friendly strings instead of first-class domain blocks
- OpenClaw authority and Studio-local persistence form a split model
- Hermes cannot be integrated cleanly because the existing model already assumes OpenClaw or generic HTTP chat

## Recommended Approach

Use a kernel-native chat domain with one unified projection layer.

The standard keeps kernel-native truth in the owning kernel and standardizes only the shared domain concepts that the UI, orchestration, and future kernels need:

- `KernelChatAgentProfile`
- `KernelChatSessionRef`
- `KernelChatSession`
- `KernelChatRun`
- `KernelChatMessage`
- `KernelChatMessagePart`
- `KernelChatAuthority`
- `KernelChatAdapter`

This keeps the shared model small, durable, and extensible while still preserving OpenClaw and Hermes semantics.

## Rejected Alternatives

### Flat Conversation Model

Flatten every kernel into one `conversation/session/message` shape and treat `agent` as optional metadata.

Rejected because:

- it destroys OpenClaw's native `agent -> session` structure
- it cannot accurately represent Hermes session storage and lineage
- it guarantees more special cases later

### Event-Sourcing Rewrite

Make the full chat domain event-sourced and treat sessions and messages as pure read models.

Rejected because:

- it is heavier than required for the current product scope
- it would delay delivery of the actual kernel-standard hard cut

## Standard Domain Objects

### KernelChatAgentProfile

Represents a kernel-owned chat persona or executor profile.

Required fields:

- `kernelId`
- `instanceId`
- `agentId`
- `label`
- `description`
- `source`

Rules:

- `agentId` is kernel-owned, not globally normalized by the platform
- kernels without a catalog may still surface zero or more profiles
- the platform must not force every kernel to expose OpenClaw-style agent lists

### KernelChatSessionRef

Represents the stable identity of one kernel-native session.

Required fields:

- `kernelId`
- `instanceId`
- `sessionId`

Optional but important fields:

- `nativeSessionId`
- `routingKey`
- `agentId`

Rules:

- `sessionId` is the platform-level stable session identity for one adapter projection
- `nativeSessionId` is the kernel-owned storage identity when distinct
- `routingKey` is the kernel-owned routing identifier when distinct
- OpenClaw commonly uses a routing key such as `agent:<agentId>:<sessionKey>` and may not always expose a separate native transcript id through the same surface
- Hermes may expose a native SQLite session id without an OpenClaw-style routing key

### KernelChatAuthority

Represents where chat truth lives.

Required fields:

- `kind`
- `source`
- `durable`
- `writable`

Rules:

- the first-party authority kinds are `gateway`, `sqlite`, `http`, and `localProjection`
- only kernel-owned authorities may be durable truth for kernel sessions
- Studio-local projections may cache but must not become authority

### KernelChatSession

Represents one authoritative chat session.

Required fields:

- `ref`
- `authority`
- `lifecycle`
- `title`
- `createdAt`
- `updatedAt`
- `messageCount`

Optional fields:

- `lastMessagePreview`
- `sessionKind`
- `actorBinding`
- `modelBinding`
- `capabilities`
- `activeRunId`

Rules:

- `lifecycle` is one of `draft`, `ready`, `running`, `error`, `archived`
- session metadata must stay independent from any one UI layout
- shared session fields must describe the session, not the transport implementation

### KernelChatRun

Represents one execution cycle inside one session.

Required fields:

- `id`
- `sessionRef`
- `status`
- `createdAt`
- `updatedAt`
- `abortable`

Rules:

- `status` is one of `queued`, `running`, `streaming`, `completed`, `aborted`, `failed`
- a run is not a message
- tool execution and streaming state attach to a run first, then project into messages

### KernelChatMessage

Represents one durable transcript item.

Required fields:

- `id`
- `sessionRef`
- `role`
- `status`
- `createdAt`
- `updatedAt`
- `text`
- `parts`

Optional fields:

- `runId`
- `model`
- `senderLabel`

Rules:

- roles are `system`, `user`, `assistant`, `tool`, `runtime`
- `text` is the user-visible plain-text body
- `parts` carries structured reasoning, tool, attachment, and notice data

### KernelChatMessagePart

Represents structured content inside one message.

Supported kinds:

- `text`
- `reasoning`
- `toolCall`
- `toolResult`
- `attachment`
- `notice`

Rules:

- attachments are first-class parts, not string decorations
- reasoning is first-class and must not be merged into plain user-visible text
- tool output is structured and must not be reduced to markdown-only text

## Adapter SPI

Each kernel chat adapter must implement a focused SPI:

- `listAgentProfiles`
- `listSessions`
- `getSession`
- `createSession`
- `patchSession`
- `deleteSession`
- `startRun`
- `abortRun`
- `loadMessages`
- `subscribe`
- `getCapabilities`

Rules:

- adapters own transport, auth, native ids, and event decoding
- shared stores and pages only consume the standardized chat domain
- adding a new kernel must not require rewriting shared chat state

## OpenClaw Mapping Standard

OpenClaw maps to the shared model like this:

- `KernelChatAgentProfile.agentId` maps to the OpenClaw agent slug
- `KernelChatSessionRef.routingKey` maps to the OpenClaw session key
- `KernelChatSessionRef.agentId` is parsed from the `agent:<agentId>:...` session key when present
- `KernelChatAuthority.kind` is `gateway`
- `KernelChatSession.sessionKind` keeps OpenClaw session kind such as `direct` or `global`
- assistant reasoning maps to `KernelChatMessagePart.kind = reasoning`
- OpenClaw tool cards map to `toolCall` and `toolResult`

OpenClaw-specific rule:

- the gateway remains the single source of truth for session history, live events, and mutations

## Hermes Mapping Standard

Hermes maps to the shared model like this:

- `KernelChatAuthority.kind` is `sqlite` for persisted session truth
- `KernelChatSessionRef.nativeSessionId` maps to Hermes native session storage id
- `KernelChatSessionRef.routingKey` is optional and must not be fabricated to mimic OpenClaw
- `KernelChatAgentProfile` is optional and only materializes when Hermes exposes a real catalog or effective persona binding
- session lineage, search, and message history stay adapter-owned features projected through shared capabilities

Hermes-specific rule:

- the platform must preserve Hermes' session-centered storage model instead of forcing an agent-scoped keyspace

## Persistence Rule

The platform hard-cuts to one authority model:

- kernel-native sessions and messages are authoritative
- Studio may keep ephemeral projection caches only
- Studio-local durable conversation records must not remain a second durable truth for kernel-backed chat

## UI Rule

The chat UI consumes a standardized projection derived from the shared domain.

Rules:

- current UI-facing convenience fields may survive only as a view projection
- UI-facing projection state must not become the source of truth
- kernel-native ids and structured message parts must remain available under the projection

## Migration Strategy

Recommended implementation order:

1. add shared `KernelChat*` types to `@sdkwork/claw-types`
2. add OpenClaw projection helpers that map gateway sessions and messages into the shared model
3. add a kernel chat agent catalog service and adapter SPI in `@sdkwork/claw-chat`
4. project OpenClaw gateway snapshots through the new standard before they reach the UI store
5. phase shared chat state away from route-first assumptions
6. remove Studio-local durable authority from kernel-backed chat paths

## Testing Standard

- type-level tests for the shared `KernelChat*` contract
- OpenClaw projection tests for session ref parsing, authority mapping, and structured message parts
- adapter tests for agent/session/message projection behavior
- store tests proving OpenClaw snapshots surface kernel-native metadata through the shared model

## Non-Goals

- no compatibility shim for historical local conversation authority
- no speculative cross-kernel unified transport enum
- no forced OpenClaw-like agent picker for kernels that do not expose agent catalogs

## Decision Summary

Claw Studio adopts a kernel-native chat standard with:

- shared kernel-neutral `agent`, `session`, `run`, and `message` objects
- adapter-owned transport and native storage details
- structured message parts
- single-authority kernel-owned persistence
- OpenClaw gateway projection and Hermes session-storage projection under one model
