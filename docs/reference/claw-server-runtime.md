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

## Native CLI

The Rust entry now exposes a real command surface:

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- run
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- print-config
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform linux
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

Current command notes:

- the packaged binary command shape is `claw-server run`, `claw-server print-config`, `claw-server service print-manifest --platform <linux|macos|windows>`, and `claw-server service <install|start|stop|restart|status>`
- `run` is the default command, so `cargo run --manifest-path ...` and the packaged `claw-server` binary both start the server without requiring an explicit subcommand
- `print-config` resolves the effective configuration after applying CLI overrides, config-file values, environment variables, and built-in defaults
- `service print-manifest` prints portable service metadata plus the platform-specific unit content for `systemd`, `launchd`, or `windowsService` packaging workflows
- `service install`, `service start`, `service stop`, `service restart`, and `service status` reuse the same runtime-config resolution path and execute the current platform service manager directly
- `--config <path>` points the server at a JSON config file
- `--host <value>` and `--port <value>` override the resolved host and port for `run`, `print-config`, and every `service *` subcommand

## Service Manifest Projection

The first two productized service-management slices now expose both canonical manifest projection and a real lifecycle shell so packaging, installers, and operators can consume the same runtime contract:

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform linux
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform macos
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform windows
```

Current manifest notes:

- Linux projects `systemd` semantics with the canonical unit target `/etc/systemd/system/claw-server.service`
- macOS projects `launchd` semantics with the canonical daemon target `/Library/LaunchDaemons/ai.sdkwork.claw.server.plist`
- Windows projects `windowsService` semantics with a companion manifest under `<CLAW_SERVER_DATA_DIR>/service/windows-service.json`
- the manifest includes the effective executable path, effective config path, runtime args, runtime environment, working directory, log paths, and the projected runtime config payload
- when `CLAW_SERVER_CONFIG` and `--config` are both omitted, the canonical service config path falls back to `<CLAW_SERVER_DATA_DIR>/claw-server.config.json`

## Service Lifecycle Commands

The native CLI now drives the platform service manager directly:

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service install
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service start
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service stop
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service restart
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

Current lifecycle notes:

- Linux uses `systemctl` with system-service semantics and writes `/etc/systemd/system/claw-server.service`
- macOS uses `launchctl` with the system domain and writes `/Library/LaunchDaemons/ai.sdkwork.claw.server.plist`
- Windows uses `sc.exe` plus the projected companion manifest under `<CLAW_SERVER_DATA_DIR>/service/windows-service.json`
- `service install` materializes the resolved `claw-server.config.json` first, then writes the platform service artifact, then runs the minimum enable/register commands for that platform
- `service status` always prints structured JSON, even when the service is inactive or missing, so packaging and operators can inspect the current state without parsing stderr
- the same Rust lifecycle control plane is also exposed through `GET /claw/manage/v1/service` plus `POST /claw/manage/v1/service:install|start|stop|restart`, so browser management reuses the exact same native service logic as the CLI
- these commands currently expect the operator to run with the privileges required by the platform service manager

## Environment Variables

The current server shell reads:

```bash
CLAW_SERVER_CONFIG=
CLAW_SERVER_HOST=127.0.0.1
CLAW_SERVER_PORT=18797
CLAW_SERVER_DATA_DIR=.claw-server
CLAW_SERVER_STATE_STORE_DRIVER=sqlite
CLAW_SERVER_STATE_STORE_SQLITE_PATH=
CLAW_SERVER_STATE_STORE_POSTGRES_URL=
CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA=
CLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist
CLAW_SERVER_MANAGE_USERNAME=
CLAW_SERVER_MANAGE_PASSWORD=
CLAW_SERVER_INTERNAL_USERNAME=
CLAW_SERVER_INTERNAL_PASSWORD=
CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false
```

Current behavior notes:

- `CLAW_SERVER_CONFIG` optionally points to a JSON config file for the native `claw-server` CLI; the current precedence order is `CLI overrides -> config file -> environment variables -> built-in defaults`.
- when the server projects a service manifest and no config file is explicitly set, it derives a canonical config file path at `<CLAW_SERVER_DATA_DIR>/claw-server.config.json` so service installers can stamp one stable runtime contract.
- `service install`, `service start`, `service stop`, `service restart`, and `service status` all resolve config through the same precedence order instead of introducing a second service-only config path.
- `CLAW_SERVER_HOST` defaults to `127.0.0.1` so the server stays loopback-only unless an operator explicitly widens exposure.
- `CLAW_SERVER_PORT` defaults to `18797`.
- `CLAW_SERVER_DATA_DIR` defaults to `.claw-server` and acts as the root for state-store files.
- `CLAW_SERVER_STATE_STORE_DRIVER` defaults to `sqlite`; supported values in this slice are `json-file` and `sqlite`.
- `CLAW_SERVER_STATE_STORE_SQLITE_PATH` optionally overrides the SQLite catalog database path; when omitted and `sqlite` is selected, the server uses `<CLAW_SERVER_DATA_DIR>/host-state.sqlite3`.
- `CLAW_SERVER_STATE_STORE_POSTGRES_URL` and `CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA` are projection-only in this slice; they let the host-platform status report planned PostgreSQL readiness, but they do not activate a PostgreSQL runtime driver.
- selecting `CLAW_SERVER_STATE_STORE_DRIVER=postgres` fails fast with an explicit metadata-only hint because PostgreSQL is not yet an activatable runtime driver in the current slice.
- with `json-file`, the runtime stores `rollouts.json` and `node-sessions.json` under `CLAW_SERVER_DATA_DIR` as an explicit bootstrap or developer fallback.
- with `sqlite`, the runtime stores both catalogs inside one SQLite database and the business logic still reaches them through the same host-core storage SPI.
- `CLAW_SERVER_WEB_DIST` defaults to `../sdkwork-claw-web/dist` when the server runs from the source tree or a workspace-style layout.
- `CLAW_SERVER_MANAGE_USERNAME` and `CLAW_SERVER_MANAGE_PASSWORD` enable HTTP basic auth for the browser shell and `/claw/manage/v1/*`.
- `CLAW_SERVER_INTERNAL_USERNAME` and `CLAW_SERVER_INTERNAL_PASSWORD` enable HTTP basic auth for `/claw/internal/v1/*`; when omitted, the internal surface falls back to the manage credentials.
- when `CLAW_SERVER_HOST` is not loopback, startup now requires those control-plane credentials unless `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true` is set explicitly for a trusted environment.
- packaged server archives and deployment bundles set `CLAW_SERVER_WEB_DIST` through their bundled launcher or container environment so the extracted runtime serves the embedded `web/dist` assets instead of looking back into the repository tree.

## Startup Behavior

The entrypoint is `packages/sdkwork-claw-server/src-host/src/main.rs`.

At startup the server:

1. loads shared host-core metadata
2. parses the native CLI command (`run` by default, `print-config`, `service print-manifest`, and `service <install|start|stop|restart|status>` when requested)
3. resolves effective runtime configuration from CLI overrides, optional config file, environment variables, and built-in defaults
4. attempts to bind the requested port
5. when the requested port is busy, automatically binds an available fallback port on the same host
6. builds `ServerState` from the effective runtime config
7. mounts the Axum router
8. logs the final listening address

Current endpoint note:

- the server now treats the configured listen port as the requested port
- if that requested port is unavailable, runtime binding selects an active port automatically instead of exiting immediately
- startup logs distinguish the requested port from the active port whenever fallback occurs, which is the first step toward the broader requested-port versus active-port host governance model
- service manifest output preserves the same effective requested host and requested port in the projected runtime config so later service installers do not need a second config-resolution path
- service lifecycle commands use that same projected config path and never introduce a separate service-specific configuration resolver

Current storage note:

- startup still seeds state catalogs on first boot
- `sqlite` seeds `host-state.sqlite3` by default unless `CLAW_SERVER_STATE_STORE_SQLITE_PATH` overrides the database location
- `json-file` seeds `rollouts.json` and `node-sessions.json` when that fallback driver is explicitly selected
- the server shell reaches both persistence modes through host-core store traits, which is the compatibility layer that future PostgreSQL and Redis-backed providers will replace
- planned PostgreSQL configuration is surfaced only as redacted host-platform metadata through `stateStore.providers[*].configurationKeys`, `stateStore.profiles[*].configuredKeys`, and `projectionMode = metadataOnly` on the projected postgres provider and profile records
- the same resolved runtime config snapshot is also embedded into `service print-manifest` output so a later installer can materialize the service config file without re-parsing environment state

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
- the route now resolves projections and desired-state pulls from the active rollout selected by the control plane instead of a hard-coded seeded rollout id
- the host-platform status payload now includes `stateStoreDriver` and a nested `stateStore` snapshot so browser and operator tooling can see the active profile, built-in providers, and planned PostgreSQL configuration readiness without exposing raw connection material
- projected state-store provider and profile records now carry `projectionMode`, which explicitly distinguishes real runtime-backed entries (`runtime`) from metadata-only placeholders (`metadataOnly`)
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

Implemented in `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs` and `packages/sdkwork-claw-server/src-host/src/http/routes/manage_service.rs`:

- `GET /claw/manage/v1/service` -> structured native service status using the shared Rust service control plane
- `POST /claw/manage/v1/service:install` -> install the native service with the same runtime contract used by `claw-server service install`
- `POST /claw/manage/v1/service:start` -> start the native service
- `POST /claw/manage/v1/service:stop` -> stop the native service
- `POST /claw/manage/v1/service:restart` -> restart the native service

- `GET /claw/manage/v1/rollouts` -> persistence-backed JSON rollout list
- `GET /claw/manage/v1/rollouts/{rolloutId}` -> one rollout record from the persistence-backed catalog
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets` -> current per-target preview records derived from the rollout preview engine
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` -> one preview-derived target record for a concrete node
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves` -> current per-wave preview summary records grouped by `waveId`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview` -> live preview result with preflight and candidate revision summary
- `POST /claw/manage/v1/rollouts/{rolloutId}:start` -> persisted rollout record transitioned to `promoting`

Important implementation detail:

- the native service manage routes call the same `ServerServiceControlPlane` used by the CLI, so browser management cannot drift into a second HTTP-only service manager implementation
- Axum routes now use one catch-all rollout subpath handler so item reads, target reads, and `:preview` / `:start` action suffixes can coexist without route-shape drift
- this preserves the final public path shape without introducing a second path convention
- the current runtime seeds a minimal rollout catalog on first boot so the API is usable before rollout create APIs land
- rollout target reads currently reuse the persisted preview engine with `includeTargets = true`, so they expose the same preflight/projection truth as `:preview`
- rollout target item reads filter that same preview-backed target list by `nodeId`, so target list and item reads cannot drift in the current slice
- rollout wave reads also reuse that same preview-backed target truth and aggregate ordered wave summaries with per-wave admissible, degraded, and blocked counts
- `:start` now also updates the active rollout pointer used by the internal node-session runtime and desired-state resolution flows
- non-`2xx` rollout route outcomes now return the same JSON envelope shape used by the migrated internal route family, including `x-claw-correlation-id`

## Browser App Serving

Static serving is implemented in `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`.

Current behavior:

- when manage credentials are configured, browser shell routes and static assets require the same basic-auth challenge as `/claw/manage/v1/*`
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

Packaging notes:

- `pnpm release:package:server` now auto-builds the native server binary first when you invoke the root local wrapper.
- `pnpm release:package:container` requires the Linux server target that matches the bundle architecture. The root local wrapper now auto-builds that target first when it is missing. On Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` routes through WSL automatically when an installed distro is available. On other non-Linux hosts, the same fallback still depends on a matching cross-build toolchain.
- `pnpm release:package:kubernetes` packages Helm assets and release values only, so it does not require a local native server build.

## Current Boundaries

Implemented now:

- shared host-core bootstrapping
- server host mode
- health route family
- public native API discovery under `/claw/api/v1/discovery`
- OpenAPI discovery and native `v1` document publication
- internal host-platform status route plus live node-session runtime/list merge
- internal node-session `hello`, `admit`, `heartbeat`, `pull-desired-state`, `ack-desired-state`, and `close`
- manage native service status plus install/start/stop/restart control routes
- manage rollout list, item read, target list read, target item read, preview, and start backed by JSON-file persistence
- rollout and node-session persistence flowing through host-core store traits with JSON as the current built-in driver
- explicit server state-store driver selection with `json-file` and `sqlite`
- host-platform `stateStore` projection with provider configuration keys, explicit `projectionMode` posture, and redacted planned PostgreSQL readiness metadata
- manage rollout wave list reads backed by the same preview-derived host-core read model
- shared JSON error envelope transport for migrated internal and manage route families
- browser app asset serving plus server metadata injection
- browser same-origin live bridge wiring for `manage` and `internal`

Not implemented yet:

- wider `/claw/api/v1/*` product-domain resources beyond discovery/bootstrap
- plugin-managed HTTP surfaces
