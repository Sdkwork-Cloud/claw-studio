# Tauri Runtime Public Projection Design

## Goal

Harden the desktop runtime boundary so the Tauri host exposes a stable, frontend-safe projection of native configuration and storage metadata without leaking raw connection strings or remote endpoint details.

The product UI, route surface, and current user workflows must remain unchanged.

## User Workflow Constraint

The user explicitly requested autonomous execution without further requirement questioning. This design therefore treats the current scope as approved and proceeds with the recommended path directly.

## Current Gap

The desktop runtime currently exposes internal native configuration too directly:

- `get_app_config` returns the full native `AppConfig`
- storage profile snapshots expose raw `connection`, `database`, and `endpoint` fields
- TypeScript runtime contracts mirror these raw fields into the frontend boundary

This creates two template-quality problems:

- the frontend contract is coupled to internal native config shape instead of a deliberate public DTO
- future secrets or credentials embedded in storage connection strings can cross the native boundary

## Options Considered

### Option A: keep exposing raw config

Pros:

- zero migration work
- no new DTO layer

Cons:

- poor security baseline
- weak abstraction boundary
- makes future secret-backed providers harder to add safely

### Option B: redact storage snapshots only

Pros:

- reduces the biggest immediate leak
- smaller code change

Cons:

- `get_app_config` still exposes raw native storage profile config
- the public runtime contract remains inconsistent

### Option C: introduce a public runtime projection layer

Pros:

- strongest separation between native config and frontend contract
- safer baseline for postgres, sqlite, remote API, and future secret-backed adapters
- preserves current product behavior while improving template quality

Cons:

- requires DTO and bridge updates across Rust and TypeScript

## Recommendation

Use Option C.

The desktop runtime should treat `AppConfig` as an internal kernel object and expose a dedicated public projection for frontend consumers. Storage profile snapshots should only expose:

- managed path information
- provider and availability metadata
- whether optional connection fields are configured

They should not expose raw connection strings or arbitrary endpoint values.

## Target Architecture

### Native boundary

Keep `AppConfig` internal to the Rust framework and add a public projection type for command responses.

The `get_app_config` command should return a public config DTO rather than the internal config struct itself.

### Storage projection

Split storage profile data into two layers conceptually:

- internal profile resolution still uses raw `connection`, `database`, and `endpoint`
- public storage snapshots expose only safe metadata such as:
  - `path`
  - `connectionConfigured`
  - `databaseConfigured`
  - `endpointConfigured`

This keeps storage runtime behavior unchanged while shrinking the public attack surface.

### TypeScript contract

Update the runtime and storage contracts so web and desktop hosts share the same redacted shape.

The web host should continue to return its browser-local storage profile and does not need to synthesize secret metadata beyond the shared public fields.

## Error Handling

- Projection should be deterministic and never fail on normal config data.
- Invalid or empty config fields should map to `false` configured flags.
- No command should return secret-bearing data after this change.

## Testing Strategy

- add contract coverage that runtime/storage contracts expose configured flags instead of raw connection fields
- add native unit tests proving redacted config snapshots do not include raw storage connection values
- rerun desktop contract checks, lint, parity, and both host builds
- keep recording the known Rust system-library blocker separately from code regressions
