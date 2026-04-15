# OpenClaw 2026.3.24 Upgrade Design

**Date:** 2026-03-26

> **Supersession Note (2026-04-13):** This document is preserved for historical release-upgrade context. The current source of truth is `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md`, with active OpenClaw runtime packaging and activation aligned to `docs/superpowers/plans/2026-04-13-openclaw-external-node-hard-cut-implementation-plan.md`. References below to a bundled OpenClaw runtime, bundled Node.js, or embedded runtime artifacts are historical only and must not drive current release or runtime work.

## Goal

Upgrade Claw Studio's bundled OpenClaw runtime from `2026.3.23-2` to the latest stable `2026.3.24`, then verify from source and packaged runtime artifacts that the embedded desktop integration still works correctly.

## Current State

As of 2026-03-26, the workspace is pinned to bundled OpenClaw `2026.3.23-2` in the runtime prepare flow and in the prepared desktop runtime resources.

The current pin appears in these places:

- `scripts/prepare-openclaw-runtime.mjs`
- `scripts/prepare-openclaw-runtime.test.mjs`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/manifest.json`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/runtime/package/package.json`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/runtime/package/node_modules/openclaw/package.json`
- Rust test fixtures that hard-code the bundled OpenClaw version, including:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`

The desktop integration relies on the bundled runtime contract, not just on a loose npm dependency:

- bundled manifest fields: `openclawVersion`, `nodeVersion`, `nodeRelativePath`, `cliRelativePath`
- bundled CLI path: `runtime/package/node_modules/openclaw/openclaw.mjs`
- desktop embedded runtime activation in `openclaw_runtime.rs`
- desktop control/admin flows that assume the gateway stays reachable through the current embedded configuration and the `cron.*` tool surface

## Source Of Truth For "Latest"

The upgrade target should follow the latest stable npm release, not beta builds.

On 2026-03-26, `npm view openclaw version dist-tags --json` reports:

- `latest`: `2026.3.24`
- `beta`: `2026.3.24-beta.2`

This design therefore targets stable `2026.3.24`.

## Recommended Approach

Use a controlled bundled-runtime upgrade, not a partial version bump.

The implementation should:

1. update the OpenClaw version pin to `2026.3.24`
2. regenerate the bundled desktop runtime resources using the existing prepare script
3. update all version-sensitive tests and fixtures
4. verify that Claw Studio's real embedded assumptions still hold against the upgraded runtime

This keeps the change narrow and aligned with the repo's current architecture. It avoids unrelated churn from a full bundled-components resync while still treating the desktop runtime as a real shipped artifact.

## Why This Approach

### Option 1: Version string only

Pros:

- minimal textual change

Cons:

- easy to leave runtime artifacts stale
- easy to miss Rust-side fixture constants
- gives weak evidence that the packaged runtime actually upgraded

### Option 2: Version pin + prepare + compatibility audit

Pros:

- upgrades the actual shipped runtime, not just metadata
- validates the desktop bootstrap path against the packaged runtime layout
- keeps scope limited to OpenClaw

Cons:

- slightly more work than a naive bump

This is the recommended approach.

### Option 3: Full upstream bundled-components resync

Pros:

- closest to a broad upstream refresh

Cons:

- may introduce unrelated updates and noise
- expands review and rollback surface without serving the user's immediate goal

This is not recommended for this task.

## Integration Contract To Preserve

The upgrade is correct only if all of the following remain true after the bump:

1. The bundled CLI still exists at `runtime/package/node_modules/openclaw/openclaw.mjs`.
2. The bundled Node runtime remains compatible with OpenClaw's engine requirement.
3. `manifest.json` and packaged files agree on the same OpenClaw version.
4. The desktop embedded runtime service can still install and activate the bundled runtime using the current manifest format.
5. The desktop control plane assumptions around embedded gateway management still hold:
   - loopback gateway boot
   - managed auth token flow
   - `cron.add`
   - `cron.update`
   - `cron.run`
   - `cron.remove`
   - `/tools/invoke`

## Compatibility Findings Before Implementation

The local upstream checkout already contains `openclaw` `2026.3.24`, which provides a useful pre-implementation comparison point.

Observed compatibility signals:

- The upstream package still ships `openclaw.mjs`.
- The bundled runtime path convention still appears unchanged.
- The desktop integration uses gateway HTTP tool invocation and does not depend on the old CLI-based cron mutation path.
- The current embedded Node version is `22.16.0`.
- The current packaged `2026.3.23-2` runtime declares `engines.node >=22.16.0`.
- The local upstream `2026.3.24` package declares `engines.node >=22.14.0`.

That means the existing bundled Node `22.16.0` remains sufficient for `2026.3.24`.

## Files Expected To Change

### Version pin and runtime preparation

- Modify `scripts/prepare-openclaw-runtime.mjs`
- Modify `scripts/prepare-openclaw-runtime.test.mjs`

### Prepared desktop bundled runtime artifacts

- Modify `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/manifest.json`
- Modify `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/runtime/package/package.json`
- Modify `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/runtime/package/node_modules/openclaw/package.json`
- Potentially modify other files under `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/runtime/package/node_modules/openclaw/` if the regenerated package contents differ between releases

### Rust fixture/test constants

- Modify `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Modify `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`

### Optional derived metadata

- If the workspace has generated bundle metadata tied to the packaged runtime version, update only the files actually affected by the prepare flow. Do not broaden scope unless verification shows it is necessary.

## Validation Strategy

Validation should prove both packaging correctness and integration correctness.

### Artifact validation

- the prepared runtime manifest says `2026.3.24`
- the packaged `node_modules/openclaw/package.json` says `2026.3.24`
- the packaged CLI entry exists at the expected path

### Script-level validation

Run:

```powershell
node scripts/prepare-openclaw-runtime.test.mjs
```

This should confirm the version pin, manifest generation, runtime preparation, cache reuse, and packaged path invariants.

### Desktop Rust validation

Run the focused tests that validate embedded OpenClaw runtime assumptions, including at least:

```powershell
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bundled_openclaw_activation
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml framework::services::openclaw_runtime
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml internal_cli
```

If exact test filters need narrowing, keep them focused on:

- bundled runtime installation
- runtime manifest handling
- CLI path handling
- embedded gateway activation

### Manual source audit after upgrade

Re-check:

- bundled `openclaw.mjs`
- packaged `package.json`
- Node engine requirement
- desktop source assumptions around manifest and CLI path

## Non-Goals

This task does not include:

- switching to beta OpenClaw releases
- refactoring the embedded OpenClaw architecture
- resyncing all bundled components
- changing the desktop OpenClaw control protocol unless the upgrade proves an actual break

## Risks

### Packaged runtime drift

Risk:

- the version pin changes but the shipped runtime files remain old

Mitigation:

- regenerate packaged resources and verify packaged `package.json`

### Fixture drift

Risk:

- tests remain pinned to `2026.3.23-2`

Mitigation:

- update all version-bearing fixture constants

### Silent protocol break

Risk:

- desktop control paths still compile but embedded gateway admin operations break at runtime

Mitigation:

- review real integration points and rerun focused embedded runtime tests

## Success Criteria

The upgrade is complete when:

- bundled OpenClaw version is `2026.3.24` everywhere that matters
- prepared runtime tests pass
- focused desktop embedded OpenClaw tests pass
- bundled runtime layout still matches what Claw Studio expects
- no additional integration change is required to keep the embedded desktop runtime functioning
