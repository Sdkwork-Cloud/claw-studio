# Claw Server Runtime Reference

This document captures the current Phase 21 server runtime slice that ships from `packages/sdkwork-claw-server`.

## Purpose

The server package provides the first native Rust host shell for Claw Studio server mode. In the current slice it does eighteen things:

1. Boots a native Axum web server.
2. Mounts the control-plane route families under `/claw/*`.
3. Serves the existing web application bundle instead of creating a second frontend.
4. Persists a minimal rollout control-plane catalog for the management API.
5. Stamps server-host metadata into the served browser shell so the web app can install the live same-origin platform bridge.
6. Projects a live combined-host node-session read model from rollout preview data for internal operational views.
7. Supports a live internal node-session runtime flow for `hello`, `admit`, `heartbeat`, `pull-desired-state`, and `ack-desired-state`.
8. Persists last-applied and last-known-good desired-state markers for live node sessions.
9. Distinguishes stale desired-state acknowledgements from generic target conflicts.
10. Preserves successor hints on graceful close and keeps replacement sessions authoritative in merged operational lists.
11. Automatically replaces older same-node sessions when a newer runtime is admitted and rejects further lease-bound actions from the replaced session.
12. Publishes the first native public API route under `/claw/api/v1/*` for same-origin and SDK bootstrap discovery.
13. Returns machine-readable JSON error envelopes for migrated `/claw/internal/v1/node-sessions*` non-`2xx` outcomes.
14. Exposes read-only rollout item and per-target inspection views under `/claw/manage/v1/rollouts/*`.
15. Exposes direct item reads for rollout target records under `/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}`.
16. Exposes preview-derived rollout wave inspection views under `/claw/manage/v1/rollouts/{rolloutId}/waves`.
17. Returns machine-readable JSON error envelopes for migrated `/claw/manage/v1/rollouts*` non-`2xx` outcomes.
18. Publishes native API discovery and an OpenAPI JSON document under `/claw/openapi/*` for the currently implemented server route families.

## Workspace Commands

From the workspace root:

```bash
pnpm server:dev
pnpm server:build
pnpm server:build -- --target x86_64-unknown-linux-gnu
```

From `packages/sdkwork-claw-server`:

```bash
pnpm dev
pnpm build
pnpm build -- --target aarch64-unknown-linux-gnu
```

## Environment Variables

The current server shell reads:

```bash
CLAW_SERVER_HOST=0.0.0.0
CLAW_SERVER_PORT=18797
CLAW_SERVER_DATA_DIR=.claw-server
CLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist
```

Current behavior notes:

- `CLAW_SERVER_HOST` defaults to `0.0.0.0`.
- `CLAW_SERVER_PORT` defaults to `18797`.
- `CLAW_SERVER_DATA_DIR` defaults to `.claw-server` and currently stores `rollouts.json` and `node-sessions.json`.
- `CLAW_SERVER_WEB_DIST` defaults to `../sdkwork-claw-web/dist` when the server runs from the source tree or a workspace-style layout.
- packaged server archives and deployment bundles set `CLAW_SERVER_WEB_DIST` through their bundled launcher or container environment so the extracted runtime serves the embedded `web/dist` assets instead of looking back into the repository tree.

## Startup Behavior

The entrypoint is `packages/sdkwork-claw-server/src-host/src/main.rs`.

At startup the server:

1. loads shared host-core metadata
2. builds `ServerState` from environment
3. binds a Tokio `TcpListener`
4. mounts the Axum router
5. logs `sdkwork-claw-host-core [server] listening on http://<host>:<port>`

## Route Families

The server mounts these route families from `packages/sdkwork-claw-server/src-host/src/http/router.rs`:

- `/claw/health/*`
- `/claw/api/v1/*`
- `/claw/openapi/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`
- fallback browser app routes from the web `dist` bundle

### Health

Implemented in `packages/sdkwork-claw-server/src-host/src/http/routes/health.rs`:

- `GET /claw/health/live` -> `200 OK`
- `GET /claw/health/ready` -> `200 OK`

### Public API

Implemented in `packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs`:

- `GET /claw/api/v1/discovery` -> public native API discovery metadata for browser/bootstrap and future external SDK clients

Current public API notes:

- this is intentionally the first and only shipped native `/claw/api/v1/*` route in Phase 16
- it exposes the active public base path, host mode and version, currently shipped public capability keys, and links to the native OpenAPI and health surfaces
- it does not yet expose product-domain resources such as chat, files, agents, or marketplace operations
- it does not claim compatibility gateway aliases or future product APIs that are not implemented yet

### Internal

Implemented in `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`:

- `GET /claw/internal/v1/host-platform` -> live server host-platform status
- `GET /claw/internal/v1/node-sessions` -> live session list merged over the rollout-derived combined-host projection
- `POST /claw/internal/v1/node-sessions:hello` -> creates a minimal persisted node session and returns a lease proposal plus compatibility preview
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit` -> transitions a hello-created session into `admitted`, `degraded`, or `blocked`
- `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat` -> refreshes the session lease and returns steady-state compatibility plus desired-state hints
- `POST /claw/internal/v1/node-sessions/{sessionId}:pull-desired-state` -> returns either `mode = projection` with the current node-targeted desired-state artifact or `mode = notModified` when the caller is already current
- `POST /claw/internal/v1/node-sessions/{sessionId}:ack-desired-state` -> records the node apply result for the current desired-state revision and returns the next expected revision plus management posture
- `POST /claw/internal/v1/node-sessions/{sessionId}:close` -> gracefully closes the live session and preserves the closed record for diagnostics

Current node-session behavior notes:

- the route keeps the rollout-derived combined-host projection as fallback so browser management views remain populated before live sessions exist
- successful `:hello` requests create a persisted session record in `node-sessions.json`
- successful `:admit` requests update the persisted session state, refresh the lease window, and mark older same-node runtime sessions as `replaced` with successor metadata
- successful `:heartbeat` requests refresh `lastSeenAt` and extend the current lease window
- successful `:pull-desired-state` requests validate the live lease, reuse the rollout compiler projection for the session `nodeId`, and persist the latest desired-state revision/hash on the live session row
- successful `:ack-desired-state` requests validate the live lease, reject stale acknowledgements separately from generic revision/hash conflicts, and persist `lastApplied*`, `lastKnownGood*`, and `lastApplyResult` markers on the live session row
- successful `:close` requests validate the live lease, persist `state = closed`, preserve optional `successorSessionId` metadata, and keep the live row visible for operational inspection
- expired sessions are rejected across lease-bound runtime actions, replaced sessions are rejected for authoritative runtime actions such as `heartbeat`, `pull-desired-state`, and `ack-desired-state`, and the node must restart from `:hello`
- live sessions override projection rows for the same `nodeId`, and explicit successor links keep the replacement session authoritative when multiple live rows exist for one node
- projected records expose `sessionId`, `nodeId`, `state`, `compatibilityState`, optional `successorSessionId`, desired-state revision/hash, optional apply markers, and `lastSeenAt`
- hello responses expose `sessionId`, `helloToken`, `leaseProposal`, `admissionMode`, `compatibilityPreview`, and `nextAction`
- admit responses expose `sessionId`, `lease`, `compatibilityResult`, `effectiveCapabilities`, `heartbeatPolicy`, and `desiredStateCursor`
- heartbeat responses expose `lease`, `compatibilityResult`, `managementPosture`, and `desiredStateHint`
- pull-desired-state responses expose `mode`, top-level desired-state revision/hash metadata, the required capability list, and the current compiled node-targeted projection when the caller is stale
- ack-desired-state responses expose `recorded`, `nextExpectedRevision`, and `managementPosture`
- session `state` currently reflects either the live hello-created runtime state or the projection fallback state, including automatic `replaced` transitions for superseded same-node runtimes, while `compatibilityState` reflects rollout preflight admissibility
- non-`2xx` node-session route outcomes now return a JSON internal error envelope with `error.code`, `error.category`, `error.httpStatus`, `error.retryable`, `error.resolution`, `error.correlationId`, and the matching `x-claw-correlation-id` response header instead of plain-text bodies for the migrated route family

### OpenAPI

Implemented in `packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs`:

- `GET /claw/openapi/discovery` -> machine-readable discovery record for native published documents
- `GET /claw/openapi/v1.json` -> OpenAPI 3.1 JSON for the currently implemented `health`, `api`, `internal`, and `manage` route families

Current publication notes:

- the published document is intentionally limited to already-shipped native server routes
- it covers current response media types truthfully, including JSON error envelopes for migrated internal node-session and manage rollout failures
- it now publishes the minimal public bootstrap route `GET /claw/api/v1/discovery`
- it does not yet depend on `utoipa`; the current slice publishes a manually assembled OpenAPI JSON document to stay compatible with offline workspace verification

### Manage

Implemented in `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`:

- `GET /claw/manage/v1/rollouts` -> persistence-backed JSON rollout list
- `GET /claw/manage/v1/rollouts/{rolloutId}` -> one rollout record from the persistence-backed catalog
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets` -> current per-target preview records derived from the rollout preview engine
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` -> one preview-derived target record for a concrete node
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves` -> current per-wave preview summary records grouped by `waveId`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview` -> live preview result with preflight and candidate revision summary
- `POST /claw/manage/v1/rollouts/{rolloutId}:start` -> persisted rollout record transitioned to `promoting`

Important implementation detail:

- Axum routes now use one catch-all rollout subpath handler so item reads, target reads, and `:preview` / `:start` action suffixes can coexist without route-shape drift
- this preserves the final public path shape without introducing a second path convention
- the current runtime seeds a minimal rollout catalog on first boot so the API is usable before rollout create APIs land
- rollout target reads currently reuse the persisted preview engine with `includeTargets = true`, so they expose the same preflight/projection truth as `:preview`
- rollout target item reads filter that same preview-backed target list by `nodeId`, so target list and item reads cannot drift in the current slice
- rollout wave reads also reuse that same preview-backed target truth and aggregate ordered wave summaries with per-wave admissible, degraded, and blocked counts
- non-`2xx` rollout route outcomes now return the same JSON envelope shape used by the migrated internal route family, including `x-claw-correlation-id`

## Browser App Serving

Static serving is implemented in `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`.

Current behavior:

- real files under the web `dist` directory are returned before SPA fallback
- unmatched browser routes fall back to `index.html` from `../sdkwork-claw-web/dist`
- the returned `index.html` is injected with:
  - `sdkwork-claw-host-mode=server`
  - `sdkwork-claw-manage-base-path=/claw/manage/v1`
  - `sdkwork-claw-internal-base-path=/claw/internal/v1`
- if the web bundle is missing, the fallback returns `503 Service Unavailable`

This means the current server runtime can serve the browser bundle and its hashed asset files while giving the browser enough metadata to switch from the mock bridge to the live same-origin server bridge.

## Verification Commands

Current server verification uses:

```bash
pnpm check:server
```

Current release asset packaging also exposes:

```bash
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
```

## Current Boundaries

Implemented now:

- shared host-core bootstrapping
- server host mode
- health route family
- public native API discovery under `/claw/api/v1/discovery`
- OpenAPI discovery and native `v1` document publication
- internal host-platform status route plus live node-session runtime/list merge
- internal node-session `hello`, `admit`, `heartbeat`, `pull-desired-state`, `ack-desired-state`, and `close`
- manage rollout list, item read, target list read, target item read, preview, and start backed by JSON-file persistence
- manage rollout wave list reads backed by the same preview-derived host-core read model
- shared JSON error envelope transport for migrated internal and manage route families
- browser app asset serving plus server metadata injection
- browser same-origin live bridge wiring for `manage` and `internal`

Not implemented yet:

- wider `/claw/api/v1/*` product-domain resources beyond discovery/bootstrap
- plugin-managed HTTP surfaces
