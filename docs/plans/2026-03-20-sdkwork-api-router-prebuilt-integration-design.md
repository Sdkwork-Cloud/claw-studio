# SDKWork API Router Prebuilt Integration Design

## Goal

Integrate `sdkwork-api-router` into the desktop app as a built-in local control plane without recompiling the router workspace during every Claw build. The integration must keep shared router state under `~/.sdkwork/router`, reuse the current Claw login experience without a second login, and avoid interfering with an independently started router process.

## Context

The earlier direction of linking router crates directly into the desktop Tauri host had one major architectural flaw:

- every desktop build would pull `sdkwork-api-router` into the Rust compilation graph
- local iteration and CI packaging time would increase sharply
- CMake and toolchain drift in the router workspace would now become a hard dependency of every Claw desktop build
- aborting or parallelizing builds leaves lingering `cargo` and `rustc` processes, which is already visible in the current environment

That makes the direct-source embedding model too expensive operationally even if it is technically feasible.

The integration still needs to preserve these user requirements:

- fully built-in desktop experience
- shared config root at `~/.sdkwork/router`
- if an independent router instance is already running, Claw must attach instead of starting another one
- current Claw login flow must directly open router admin capability without a second credential prompt
- high cohesion, low coupling, stable upgrade path

## Approaches Considered

### Option A: Link router crates into the Tauri app

Claw depends directly on router Rust crates and starts admin and gateway listeners in-process.

Pros:

- single parent process
- no external binaries to manage
- simplest runtime ownership model

Cons:

- every Claw build recompiles the router workspace
- toolchain and native dependency cost becomes part of the app build
- upstream router changes are tightly coupled to desktop host compilation
- poor local iteration speed

### Option B: Bundle prebuilt router runtime artifacts and manage them as sidecars

Claw ships a prebuilt router runtime package for the current target as app resources, extracts it to a managed runtime directory on first use, and starts the router binaries only when no compatible external router is already running.

Pros:

- main desktop build no longer compiles router source
- low coupling between desktop host and router implementation
- versioned runtime upgrade path is clear
- startup and shutdown ownership remains explicit
- compatible with shared config and external-instance attach mode

Cons:

- requires a separate artifact preparation pipeline
- runtime now spans multiple processes
- needs checksum verification, extraction, and PID ownership safeguards

### Option C: Download router release artifacts at install time or first launch

Claw fetches router binaries from a remote release endpoint when needed.

Pros:

- smallest desktop bundle
- no repo or CI artifact storage burden inside the app repo

Cons:

- network dependency at install or first run
- weaker reproducibility
- more failure modes
- conflicts with the user's preference for a fully built-in experience

## Recommendation

Use Option B.

This is the best balance of build performance, operational stability, and architectural cleanliness:

- the router source can still be pinned in `vendor/` like `hub-installer`
- the desktop app consumes prebuilt router artifacts, not router source, during normal builds
- the runtime remains fully local and bundled
- Claw can still attach to an already running external router instance using shared config and health probes

## Final Architecture

### 1. Two-layer vendor model

Keep two related integration layers:

- `packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router`
  - pinned git submodule or vendored source mirror
  - used for audits, patch management, and artifact production
- `packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router-artifacts`
  - version manifest plus target-specific prebuilt runtime archives
  - consumed by Claw desktop packaging

The critical rule is:

- the desktop app build never compiles `sdkwork-api-router`
- artifact preparation is an explicit separate step

### 2. Artifact format

For each supported target, ship a single versioned runtime archive plus a manifest.

Recommended structure:

```text
vendor/sdkwork-api-router-artifacts/
  manifest.json
  windows-x64/
    sdkwork-api-router-<version>.zip
  windows-arm64/
    sdkwork-api-router-<version>.zip
  linux-x64/
    sdkwork-api-router-<version>.tar.gz
  macos-aarch64/
    sdkwork-api-router-<version>.tar.gz
```

Each archive should include only the required binaries for Claw phase 1:

- `admin-api-service`
- `gateway-service`

Optional later additions:

- `portal-api-service`
- `router-web-service`

Phase 1 should not ship the upstream web UI because Claw should remain the operator UI. That avoids shipping redundant assets and a second login surface.

### 3. Build and release workflow

Split the workflow into two phases.

Artifact preparation phase:

- build patched `sdkwork-api-router` once per target from the vendored source repo
- collect only the required binaries
- generate checksums and version metadata
- write or refresh `vendor/sdkwork-api-router-artifacts/manifest.json`

Desktop packaging phase:

- verify that the matching runtime archive already exists
- fail fast if it does not
- include the archive and manifest as Tauri resources
- do not invoke router cargo builds

This preserves fast local `tauri:dev` and `tauri:build` loops.

### 4. Runtime installation layout

Claw should not execute binaries directly from the read-only app bundle. On first use, extract the bundled archive into a versioned managed runtime directory.

Recommended runtime layout:

```text
<machine_runtime_dir>/sdkwork-api-router/
  manifest.json
  versions/
    <router-version>/
      admin-api-service(.exe)
      gateway-service(.exe)
      INSTALLATION_OK
  current -> <router-version>
```

Extraction rules:

- verify archive checksum against bundled manifest before extraction
- use a temp directory and atomic rename
- write `INSTALLATION_OK` only after all files are present
- use a file lock to prevent concurrent extraction from multiple Claw instances

### 5. Shared config and attach-or-start behavior

The router config root stays exactly at:

- `~/.sdkwork/router`

Claw does not remap this path.

Startup algorithm:

1. Resolve the shared router config and effective binds.
2. Probe the configured admin and gateway health endpoints with a short timeout.
3. If both are healthy:
   - mark runtime mode as `attached_external`
   - do not launch bundled binaries
4. If neither is healthy and ports are free:
   - start the bundled admin and gateway binaries
   - mark runtime mode as `managed_local`
5. If ports are occupied but health probes fail:
   - mark runtime mode as `conflicted`
   - do not alter config or switch ports automatically
   - surface diagnostics in Claw

Claw must never silently change the configured ports because the user explicitly wants unified shared configuration.

### 6. Process ownership and shutdown

Claw only stops processes that it launched itself.

Ownership record should include:

- executable path
- PID
- process creation time
- router version
- started_at timestamp

On shutdown:

- if mode is `attached_external`, do nothing
- if mode is `managed_local`, stop owned services in reverse order
- verify PID and creation time before termination to avoid killing an unrelated reused PID

Recommended stop order:

1. `gateway-service`
2. `admin-api-service`

### 7. Auth bridge with no second login

Because the current Claw auth store is local-session based and does not produce a backend token, the router cannot simply reuse an existing JWT. A dedicated local trust bridge is required.

Recommended design:

- patch `sdkwork-api-router` admin auth to add a loopback-only exchange endpoint such as `POST /admin/auth/claw/exchange`
- store a shared bridge secret inside the router config root, for example under `~/.sdkwork/router/runtime/claw-bridge.json`
- the secret is created once and reused by both Claw-managed and independently started patched router processes
- Claw frontend calls a Tauri command
- the Tauri host signs a short-lived exchange envelope with the bridge secret
- router validates:
  - loopback source
  - HMAC signature
  - nonce freshness
  - short TTL
- router then upserts a mapped local operator user and returns a normal admin JWT

Why this is the right boundary:

- no second login prompt
- the frontend never sees the bridge secret
- external compatible router processes can still participate as long as they use the same shared config root
- router admin still uses its native JWT after exchange

This bridge is a local desktop SSO mechanism, not a remote auth bypass.

### 8. External-version compatibility rule

An external router process may already be using the configured ports but may not support the Claw exchange endpoint.

Claw should detect this explicitly:

- healthy admin and gateway probes succeed
- `POST /admin/auth/claw/exchange` returns 404 or incompatible response

In that case:

- do not launch a second managed router
- do not downgrade to password login
- surface runtime state `attached_external_incompatible`
- instruct the operator, through UI diagnostics, that the external router must be upgraded to the Claw-compatible build

This avoids hidden security downgrades.

### 9. UI integration boundary

Claw should keep its own API Router feature package as the operator surface, but it should stop pretending mock-only concepts are the router system of record.

Recommended UI direction:

- replace mock service implementations with real admin and gateway clients
- add a dedicated runtime-status surface for:
  - attached vs managed mode
  - router version
  - health state
  - config path
  - logs path
- migrate the UI toward router-native concepts:
  - channels
  - providers
  - credentials
  - models
  - gateway API keys
  - routing and usage

Do not keep inventing durable backend semantics for:

- provider groups
- unified API keys
- model mappings

Those are current Claw mock abstractions, not upstream router truth. Keeping them as first-class persisted concepts would create a second source of truth and increase coupling.

### 10. Performance and memory posture

This design improves build performance significantly:

- normal Claw builds only compile the desktop host and frontend
- router compilation moves to a one-time artifact preparation phase

Runtime cost is acceptable if the shipped service set is minimized.

Recommended phase 1 runtime set:

- `admin-api-service`
- `gateway-service`

Do not start unused router services by default.

Additional runtime optimizations:

- health probes use short timeout plus bounded retry window
- process logs stream directly to disk, not unbounded in-memory buffers
- extracted runtimes are versioned and reused across launches
- old runtime versions are garbage-collected lazily, not during hot startup

### 11. Security controls

Mandatory safeguards:

- bundled artifact checksum verification
- loopback-only binds
- no automatic port mutation
- HMAC-signed auth exchange with nonce and short TTL
- bridge secret never leaves Tauri or router process memory
- PID plus creation-time validation before process termination
- fail-closed behavior when external instance is incompatible

Optional later safeguards:

- signed artifact manifest
- code-sign verification for shipped binaries where platform support is available
- bridge user role scoping if Claw adds multi-role auth later

## Error Handling

### Missing artifact

- desktop build should fail before packaging
- runtime should never try to compile router source as fallback

### Corrupt extracted runtime

- delete the incomplete temp directory
- keep previous installed version untouched
- report extraction failure in diagnostics

### Port conflict with non-router process

- do not auto-rewrite config
- do not choose new ports automatically
- show conflict status and exact occupied bind

### Managed router crash

- bounded restart policy with backoff
- if restart budget is exhausted, mark runtime degraded and stop retrying

### External router disappears after attach

- degrade runtime status
- allow Claw to re-enter managed start flow only after a fresh health and port-free check

## Testing Strategy

### Artifact pipeline tests

- manifest format validation
- archive checksum validation
- required binary presence per target

### Desktop runtime tests

- attach to healthy external router
- refuse to start when ports are occupied by non-router process
- extract bundled archive only once
- stop only owned processes
- detect incompatible external router auth bridge

### Auth tests

- exchange endpoint accepts valid signed request
- rejects expired or replayed nonces
- rejects non-loopback requests
- returns standard admin JWT on success

### Manual verification

- build Claw without router source compilation
- first launch extracts runtime archive
- existing external router prevents managed launch
- Claw login opens router management without second password entry

## Success Criteria

- `pnpm tauri:build` does not compile `sdkwork-api-router`
- Claw ships a fully local router runtime package for the current target
- router state remains under `~/.sdkwork/router`
- Claw attaches to an existing healthy router instead of launching a duplicate
- Claw starts and stops only its own managed router processes
- router admin access is available through Claw login without a second credential prompt
- the integration does not introduce a second source of truth for router domain objects
