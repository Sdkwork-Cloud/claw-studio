# Claw One Host Runtime Multi-Shell Convergence Design

**Date:** 2026-04-04

## Goal

Define the durable architecture baseline that unifies `desktop`, `server`, `docker`, and `kubernetes` around one canonical Rust host runtime, one authoritative `/claw/*` API surface, and one browser application artifact.

This design locks the platform into a professional model that optimizes for:

- long-term maintainability over short-term convenience
- one implementation of host-owned behavior
- one authoritative API and OpenAPI contract
- one security model with explicit shell-only exceptions
- one release story across desktop, server, container, and cluster deployment

## Why This Design Exists

The current codebase already proves important parts of the target direction:

- `sdkwork-claw-host-core` exists and already owns durable host-side business logic
- `sdkwork-claw-server` already serves the browser app and exposes real `/claw/*` routes
- `sdkwork-claw-desktop` already owns native lifecycle, bundled OpenClaw runtime management, and local AI proxy behavior
- release automation already distinguishes `desktop`, `server`, `container`, and `kubernetes`

But the system still behaves like two host architectures:

- `server` is becoming a canonical HTTP control plane
- `desktop` still behaves as a Tauri-first bridge host with partial parity

That split is now the largest structural risk in the product. It creates:

- duplicated host logic
- duplicated transport models
- inconsistent capability exposure
- drift between docs, routes, and UI assumptions
- higher testing and release cost

This design resolves that by standardizing the platform on one runtime model.

## Final Decision

Adopt **One Host Runtime, Multiple Shells**.

The authoritative platform model becomes:

- one canonical Rust host runtime
- one authoritative host API rooted at `/claw/*`
- one browser app artifact consumed by every shell
- one shared OpenAPI contract
- one data-plane abstraction layer
- one plugin model

`desktop`, `server`, `docker`, and `kubernetes` are not separate business architectures. They are shells or deployment families over the same host runtime.

## Rejected Alternatives

### Option A: Keep desktop bridge and server HTTP as dual primary surfaces

Pros:

- lowest short-term change cost
- preserves current desktop paths

Cons:

- permanent duplication
- permanent parity drift
- two testing matrices for the same product behavior
- more documentation debt and more developer confusion

Decision: reject.

### Option B: Make desktop purely native and keep server purely HTTP

Pros:

- slightly lower local transport overhead inside desktop

Cons:

- turns desktop and server into two products
- breaks unified browser management
- blocks clean SDK generation and external API reuse
- makes container and cluster deployment an afterthought

Decision: reject.

### Option C: Run a sidecar server process from desktop

Pros:

- strongest process isolation
- very high parity with standalone server

Cons:

- more packaging complexity
- more upgrade and crash-recovery complexity
- harder Windows and macOS lifecycle management

Decision: defer as a future hardening option, not the baseline.

## Non-Negotiable Architecture Rules

### 1. One canonical host runtime

All host-owned operations must be implemented once in Rust host services.

That includes:

- host lifecycle
- endpoint and port governance
- OpenClaw runtime and gateway management
- rollout and desired-state orchestration
- storage and cache profile resolution
- plugin loading and plugin capability registration
- service install and control
- management and internal APIs

### 2. `/claw/*` is authoritative for platform-native APIs

All platform-owned HTTP APIs must stay under `/claw/*`.

Authoritative families:

- `/claw/health/*`
- `/claw/openapi/*`
- `/claw/api/v1/*`
- `/claw/manage/v1/*`
- `/claw/internal/v1/*`
- `/claw/admin/v1/*`
- `/claw/gateway/*`

Compatibility aliases without `/claw/` are allowed only for upstream-client compatibility and must stay contract-isomorphic with the governed gateway roots.

### 3. Desktop is a shell, not a parallel business host

Desktop may still expose native-only adapters through Tauri or shell bridges, but only for shell capabilities:

- windows and tray lifecycle
- native dialogs
- filesystem pickers
- screenshot and device access
- OS integration

Desktop must not own a separate business-management transport model for platform features.

### 4. All OpenClaw operations go through Rust host services

Browser code must never call the bundled OpenClaw gateway as a primary control surface.

Allowed model:

- UI calls canonical host APIs
- host runtime authorizes, validates, resolves active runtime, and proxies privately if needed

Forbidden model:

- renderer-owned gateway admin business logic
- desktop-only Tauri command as the primary management plane

### 5. Port governance is centralized

Requested ports, active ports, collision handling, fallback policy, endpoint publication, and UI projection must come from one shared host service.

No ad hoc bind logic is allowed to become the source of truth for a business endpoint.

### 6. One browser app artifact

There is one browser shell:

- desktop hosts it inside WebView
- server hosts it through the built-in web server
- docker and kubernetes host the same built artifact through the server shell

No separate admin frontend is introduced.

## Target Runtime Topology

## Desktop Combined Mode

Desktop becomes a native shell over the same host runtime model as server.

It owns:

- native shell lifecycle
- embedded Rust host runtime
- bundled OpenClaw runtime lifecycle
- local compatibility gateway
- local browser or WebView UI
- shell-only native adapters

Default behavior:

- start embedded host runtime on app boot
- bind canonical control plane to loopback only
- publish resolved host endpoints to UI bootstrap metadata
- let both local browser access and the embedded UI use the same `/claw/*` surface

## Standalone Server Mode

Server becomes the standalone deployment shell for the same runtime.

It owns:

- canonical host runtime
- browser hosting
- service lifecycle
- server-side storage and cache selection
- same `/claw/*` surface and compatibility gateway publication

## Docker and Kubernetes

`docker` and `kubernetes` are deployment families of standalone server mode.

They do not introduce a separate host API model.

They only vary in:

- packaging
- environment stamping
- infrastructure topology

## Module and Responsibility Standard

The architecture should not explode into many new packages immediately. Use the existing anchors and add modules before crates.

### `sdkwork-claw-host-core`

Authoritative Rust host domain.

Owns:

- host capability registry
- endpoint registry and port allocator
- storage SPI
- cache SPI
- plugin SPI
- OpenClaw control plane
- rollout and desired-state orchestration
- runtime metadata projection
- health and observability models

Must not own:

- Axum route wiring
- Tauri command wiring
- shell-specific window or tray behavior

### `sdkwork-claw-server`

Canonical HTTP shell around `host-core`.

Owns:

- Axum router
- auth middleware
- OpenAPI publication
- browser asset hosting
- CLI and service manager integration
- deployment-facing configuration resolution

Must not duplicate host-core business rules.

### `sdkwork-claw-desktop`

Native shell around the same host runtime.

Owns:

- Tauri startup and shutdown
- desktop packaging assets
- native dialogs and OS integration
- embedded-host bootstrapping
- shell-only native command surface

Must not own canonical business-management APIs.

### TypeScript workspace packages

- `sdkwork-claw-infrastructure`
  - one HTTP-first platform bridge for authoritative host APIs
  - shell-only adapter seams where HTTP cannot apply
- `sdkwork-claw-core`
  - browser-side service composition over authoritative contracts
- feature packages
  - consume package-root services and contracts only

## Transport Standard

### Authoritative business and management transport

Use HTTP against `/claw/*` in every runtime mode where the browser app is operating.

That includes:

- browser in standalone server mode
- browser in docker and kubernetes deployment
- WebView inside desktop
- external browser connecting to desktop loopback mode

### Shell-only transport

Use Tauri command or shell bridge only for capabilities that cannot or should not be modeled as canonical host APIs, such as:

- opening a native file dialog
- focusing a window
- interacting with tray or notifications
- shell bootstrap and crash reporting hooks

## API Standard

### Canonical route families

- `/claw/health/live`
- `/claw/health/ready`
- `/claw/health/deps`
- `/claw/health/metrics`
- `/claw/openapi/discovery`
- `/claw/openapi/v1.json`
- `/claw/api/v1/*`
- `/claw/manage/v1/*`
- `/claw/internal/v1/*`
- `/claw/admin/v1/*`
- `/claw/gateway/openai/v1/*`
- `/claw/gateway/anthropic/v1/*`
- `/claw/gateway/gemini/v1beta/*`

### Route family intent

- `api`
  - end-user and product-native API surface
- `manage`
  - operator-facing configuration and control-plane APIs
- `internal`
  - host coordination and node/runtime internals
- `admin`
  - higher-privilege administration, tenant, policy, or operator-only concerns
- `gateway`
  - compatibility proxies and alias publishing

### Compatibility proxy standard

The compatibility proxy must support:

- official governed routes under `/claw/gateway/...`
- alias routes without `/claw/` for client compatibility

Examples:

- `/claw/gateway/openai/v1/*` and `/v1/*`
- `/claw/gateway/anthropic/v1/*` and `/v1/messages`
- `/claw/gateway/gemini/v1beta/*` and `/v1beta/*`

The no-`/claw` aliases are exceptions for compatibility only. They are not the platform-native control plane.

### OpenAPI and SDK standard

- OpenAPI is the single source of truth for authoritative HTTP contracts
- docs and generated SDKs derive from the same published contract
- hand-written docs must never describe routes absent from OpenAPI

## Endpoint and Port Governance Standard

Each host-owned endpoint must publish:

- endpoint id
- bind host
- requested port
- active port
- base URL
- websocket URL if applicable
- loopback-only flag
- dynamic-port flag
- protocol family
- auth policy id
- capability keys
- updated timestamp

The system must treat `requestedPort` and `activePort` as separate fields. The operator can ask for a port, but the runtime may bind another one if policy allows dynamic fallback.

### Required behaviors

- desktop defaults to loopback-only
- server defaults to loopback-first unless explicitly widened
- conflicts are resolved by a centralized allocator
- active endpoint publication is observable and queryable
- UI settings show both requested and active values
- startup metadata includes resolved base URLs

## Data Plane Standard

### Desktop defaults

- SQLite is the default durable state store
- local file storage may exist for user content or cache, but not as the only professional metadata strategy

### Server defaults

- SQLite is acceptable for single-node or local deployments
- PostgreSQL is the preferred scalable durable store
- Redis is the preferred cache, lock, and coordination store

### SPI rules

All data and cache integrations must attach through shared SPI layers.

No business code may:

- directly call PostgreSQL
- directly call SQLite
- directly call Redis

without going through host-core storage or cache abstractions.

### Availability posture

- `json-file` is allowed as bootstrap or developer fallback only
- `sqlite` is ready and supported
- `postgres` and `redis` are required productization targets

## Plugin Standard

Plugins must follow a declared contract, versioning policy, and isolation posture.

### Plugin classes

- capability plugins
  - model providers
  - auth backends
  - storage drivers
  - cache drivers
  - audit sinks
- integration plugins
  - webhook sinks
  - notifications
  - enterprise connectors
- shell plugins
  - desktop-only shell integrations
  - server-only deployment hooks

### Plugin contract requirements

Every plugin must declare:

- plugin id
- version
- runtime compatibility
- capability keys
- required configuration keys
- secret bindings
- isolation level
- health and readiness status
- migration and uninstall hooks

### Plugin isolation

High-risk plugins must not run with unrestricted host privileges by default.

Preferred order:

- process isolation
- restricted runtime or WASI-like sandbox where feasible
- in-process only for low-risk or core trusted plugins

## Security Standard

### Default exposure policy

- desktop control plane binds to `127.0.0.1` by default
- standalone server binds loopback-first unless the operator widens exposure
- gateway aliases without `/claw/` inherit governed security policy

### Auth separation

At minimum, support separate policies for:

- browser shell access
- manage APIs
- internal APIs
- compatibility gateway APIs
- admin APIs

### Required controls

- credential and secret bindings stay in host-controlled storage
- correlation id on every request
- structured audit logging for privileged actions
- explicit capability and permission checks inside host services
- CSRF and origin protections for browser-managed flows where applicable

## Observability Standard

Every shell must expose consistent observability primitives.

Minimum requirements:

- liveness and readiness
- dependency health
- resolved host mode
- resolved endpoint registry
- active storage and cache providers
- plugin inventory and health
- OpenClaw runtime and gateway status
- structured logs
- error envelopes with stable codes and retryability hints

## Release and Packaging Standard

### Product family model

The product has one runtime model and multiple distribution families:

- desktop installers
- standalone server archives and service installs
- docker image and compose bundles
- kubernetes chart and deployment assets

### Release rules

- every release family must bind to the same host runtime version
- container images must use immutable tags or digests
- charts must reference immutable image versions, not `latest`
- release metadata must state family, platform, arch, accelerator, and runtime version
- docs must describe what is actually packaged

## Migration Strategy

The migration must be phased and non-destructive.

### Phase principles

- converge contracts first
- centralize host services second
- embed server into desktop third
- migrate UI transport fourth
- converge settings, observability, and docs fifth
- productize data, plugin, and deployment depth after parity is established

### Temporary compatibility rule

Legacy Tauri business commands may stay temporarily during migration, but:

- they must be explicitly marked transitional
- they must not gain new business scope
- they must be removed once HTTP parity is proven

## Acceptance Criteria

This design is considered implemented only when all of the following are true:

- desktop and server expose the same authoritative `/claw/*` business and management APIs
- the browser app uses HTTP for host-owned business flows in every supported shell
- Tauri command usage is limited to shell-only capabilities
- requested and active ports are centrally governed and observable
- OpenClaw management always routes through Rust host services
- docs and OpenAPI stay aligned with actual implementation
- docker and kubernetes releases are version-closed and reproducible
- storage, cache, and plugin attachment points are explicit and testable

## Detailed Verification and Evaluation Model

### 1. Contract verification

- TypeScript contract tests for platform bridge types
- OpenAPI snapshot verification
- doc-versus-route drift checks

### 2. Host-core verification

- Rust unit tests for endpoint registry and allocator
- Rust unit tests for OpenClaw control-plane behaviors
- storage SPI and cache SPI contract tests
- plugin registration and permission tests

### 3. Shell verification

- desktop startup tests proving embedded host runtime boot and endpoint publication
- desktop regression tests proving business flows no longer depend on legacy Tauri business commands
- server CLI and service lifecycle tests

### 4. Integration verification

- browser-to-host contract tests in desktop mode
- browser-to-host contract tests in server mode
- same test payloads across both shells

### 5. Deployment verification

- docker smoke test for canonical routes and browser shell
- helm template and deployment smoke verification
- release artifact manifest validation

### 6. Security verification

- auth boundary tests across shell, manage, internal, admin, and gateway families
- loopback-only exposure tests in desktop default mode
- alias-route security equivalence tests for compatibility proxy paths

### 7. Readiness gate

A phase is not complete until:

- tests pass
- docs are updated
- OpenAPI is updated
- release assets or workflows are validated for the affected mode
- the new path replaces the legacy path for that scope

## Recommended Execution Order

1. freeze authoritative contract and mode semantics
2. centralize endpoint registry and port governance in host-core
3. converge OpenClaw host APIs through host-core and server routes
4. embed canonical host server into desktop
5. switch browser-side business transport to HTTP-first host access
6. reduce Tauri command surface to shell-only concerns
7. finish settings, observability, and docs convergence
8. harden server shell, service control, docker, and kubernetes release closure
9. productize storage, cache, and plugin runtime depth

## Success Definition

Success is not "desktop and server both basically work."

Success is:

- one runtime model
- one contract model
- one observability model
- one deployment story
- one developer mental model

That is the baseline this design establishes.
