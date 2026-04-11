# OpenClaw Gateway WebChat Design

## Goal

Make Claw Studio use the real OpenClaw Gateway WebSocket chat flow for OpenClaw instances, so chat behavior matches upstream control-ui/webchat and session, message, and run state stay synchronized with the Gateway as the only authoritative source.

## Current Problem

The current OpenClaw chat integration is only transport-compatible with OpenAI-style HTTP and does not follow the native OpenClaw webchat model.

1. `packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts` resolves `openclawGatewayWs` instances to HTTP chat completions whenever `baseUrl` exists, even though upstream control-ui/webchat uses Gateway WebSocket commands.
2. `packages/sdkwork-claw-chat/src/services/chatService.ts` sends single request/response style `POST /v1/chat/completions` traffic and does not use `chat.history`, `chat.send`, `chat.abort`, or streamed `chat` events.
3. `packages/sdkwork-claw-chat/src/store/useChatStore.ts` persists OpenClaw conversations through `studioConversationGateway.ts`, making local Claw Studio storage the effective source of truth instead of the Gateway session store.
4. `packages/removed-install-feature/src/services/openClawBootstrapService.ts` currently syncs local-external OpenClaw instances with `authToken: null`, which is a likely blocker for authenticated WebSocket parity.

This creates split-brain state:

- OpenClaw Gateway owns real chat sessions and history.
- Claw Studio stores a second local conversation history.
- The two stores can diverge on message order, abort state, deletion, reset, and externally-created sessions.

## Desired Behavior

1. Every `openclawGatewayWs` instance uses Gateway WebSocket as the primary interactive chat transport.
2. Gateway sessions are authoritative for OpenClaw chat list, active session selection, message history, streaming state, reset, deletion, and abort.
3. Claw Studio creates or selects OpenClaw sessions by `sessionKey`, loads history with `chat.history`, sends messages with `chat.send`, aborts with `chat.abort`, resets with `sessions.reset`, and deletes with `sessions.delete`.
4. Claw Studio listens to Gateway `chat` events and updates the rendered transcript from those events instead of treating local optimistic state as durable truth.
5. Local Claw Studio persistence remains valid for non-OpenClaw chat flows, but OpenClaw chat stops writing authoritative history through `studio.putConversation`.
6. OpenClaw instance metadata includes the correct auth token and connection details needed for WebSocket handshake parity.

## Architecture

The change stays inside feature and install boundaries rather than expanding the general `studio` CRUD contract.

- `packages/removed-install-feature` owns keeping synced OpenClaw instance metadata complete enough for runtime access, including auth token propagation.
- `packages/sdkwork-claw-chat` owns the OpenClaw-specific Gateway WebSocket client, protocol adapter, session projection, and page integration.
- Existing local conversation persistence remains available only for non-OpenClaw routes.

This keeps the dependency flow aligned with the repo rules:

- install updates OpenClaw instance metadata
- chat consumes instance metadata and speaks Gateway directly
- web and desktop hosts remain thin

## Design Decisions

### Authoritative Data Model

For OpenClaw chat, the Gateway is the single source of truth.

- Durable authority: Gateway session list, Gateway history, Gateway run state
- Presentation cache only: in-memory UI projection inside Claw Studio
- Never authoritative again for OpenClaw: `studioConversationGateway.ts` persistence

If local cache and Gateway disagree, Gateway wins and the UI rehydrates from Gateway data.

### Transport Selection

`openclawGatewayWs` must resolve to a dedicated OpenClaw Gateway route mode instead of the generic HTTP-first path.

- Primary: Gateway WebSocket
- Secondary: OpenAI-compatible HTTP remains available only for explicit compatibility work outside the native OpenClaw chat page
- Unsupported generic custom WebSocket behavior must stay separate from the OpenClaw protocol

This avoids conflating "a websocket exists" with "this websocket speaks the OpenClaw Gateway chat protocol".

### Gateway Client Scope

The OpenClaw Gateway client should live under `packages/sdkwork-claw-chat/src/services/openclaw/`.

It should own:

- WebSocket lifecycle
- challenge/connect handshake
- request id generation
- command send/response correlation
- `chat` event fan-out
- reconnect and post-reconnect rehydration hooks

It should not own page-specific React state.

### Session Key Strategy

Claw Studio must generate explicit session keys for new OpenClaw conversations using a dedicated prefix that cannot collide with upstream reserved or conventional keys.

Recommended format:

- `claw-studio:<instanceId>:<uuid>`

Rules:

- never reuse `main`
- never reuse scheduler/system-like keys such as `cron` or `subagent`
- once a session key is created for a conversation, all subsequent operations use that exact key

### Empty Draft Handling

Today the page auto-creates an empty local session. That behavior is inconsistent for a Gateway-authoritative model.

For OpenClaw:

- unsent drafts may exist only as ephemeral UI state
- durable session list comes only from Gateway-backed sessions
- the first successful `chat.send` promotes the draft into a durable Gateway session

This removes phantom local sessions that do not exist upstream.

### History and Event Reconciliation

The chat page must combine two mechanisms:

1. `chat.history` for authoritative hydration when opening a session or reconnecting
2. live `chat` events for streaming updates while the session is active

Reconciliation rules:

- initial load uses `sessions.list` plus `chat.history`
- live stream appends or patches the active assistant message as `chat` events arrive
- reconnect triggers fresh `chat.history` for the active session
- reset, delete, and externally-created sessions are confirmed by a new authoritative session list refresh

### Abort, Reset, and Delete Semantics

OpenClaw control-ui parity requires:

- stop generating -> `chat.abort`
- clear current session history -> `sessions.reset`
- delete conversation -> `sessions.delete`

The current local-only mutations must not remain the final authority for OpenClaw sessions.

### Auth Synchronization

Gateway WebSocket parity depends on the instance record carrying the same auth token the runtime expects.

The local-external OpenClaw sync flow must stop forcing `authToken: null`. Instead it should preserve or resolve the token from the managed config/runtime snapshot and write it into the synced instance metadata used by Claw Studio.

### Failure and Reconnect Behavior

Claw Studio should treat transient disconnects as recoverable.

- mark the session state as reconnecting
- reconnect the Gateway client
- refresh `sessions.list`
- refresh active `chat.history`
- resume from authoritative state instead of replaying unsent optimistic history

If reconnect fails, the page should surface a sync error without inventing local history.

## Data Consistency Rules

To guarantee synchronization consistency, the implementation must follow these invariants:

1. OpenClaw chat messages shown in the UI must always be derivable from Gateway history plus Gateway `chat` events.
2. OpenClaw chat session existence must always be derivable from Gateway session APIs, not local storage.
3. OpenClaw delete and reset actions must not mutate only local state; they must succeed remotely first or remain visibly failed.
4. Reconnect must prefer authoritative rehydration over optimistic local replay.
5. Local Claw Studio storage for OpenClaw chat must not become a second durable write path.

## Testing Strategy

Add focused coverage for:

1. OpenClaw bootstrap sync keeps the auth token needed for WebSocket access.
2. Route resolution sends `openclawGatewayWs` to the native Gateway WebSocket mode instead of HTTP-first chat completions.
3. Gateway client handshake, command correlation, and `chat` event parsing.
4. Store reconciliation between `sessions.list`, `chat.history`, and live `chat` events.
5. UI actions map correctly to `chat.send`, `chat.abort`, `sessions.reset`, and `sessions.delete`.
6. Reconnect rehydrates authoritative state and does not duplicate or orphan messages.

## Migration Notes

Existing local Claw Studio conversations for OpenClaw should not be merged back into Gateway in the first pass.

First-pass behavior:

- old local OpenClaw history is ignored as authority
- newly opened OpenClaw chat uses Gateway-backed sessions only
- non-OpenClaw chat keeps current local behavior

This avoids trying to reconcile two incompatible histories during the same change.

## Non-Goals

- No rewrite of direct LLM chat for non-instance usage
- No generic custom WebSocket protocol abstraction for arbitrary vendors
- No bidirectional merge of historical local OpenClaw chat records into Gateway
- No change to OpenClaw control-ui itself

