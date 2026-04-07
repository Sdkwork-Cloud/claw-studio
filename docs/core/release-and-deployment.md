# Release And Deployment

## Overview

Claw Studio now publishes a unified multi-family release instead of a desktop-only artifact set.

The release flow produces:

- `desktop` installers and native application bundles
- `server` native Rust server archives with embedded web assets
- `container` deployment bundles for Docker-oriented environments
- `kubernetes` deployment bundles with Helm-compatible chart assets
- `web` static web/docs archives

This keeps one tag and one workflow while still giving desktop users, server operators, and platform teams the release shape they actually need.

## Local Verification And Packaging

When a change touches cross-mode runtime authority or delivery behavior and you
need one decisive gate instead of a manual checklist, run the unified multi-mode
verification command from the workspace root:

```bash
pnpm check:multi-mode
```

`pnpm check:multi-mode` chains the current desktop runtime contract, native
server contract, unified host-runtime authority smoke contract, bundled
OpenClaw readiness checks, and release-flow packaging contracts. Treat it as
the highest-signal local gate for "desktop + server + docker/kubernetes release
surfaces still close correctly together".

Before changing desktop embedded-host bootstrap, desktop hosted browser
authority, or packaged startup behavior, verify the current desktop runtime
contract from the workspace root:

```bash
pnpm check:desktop
```

`pnpm check:desktop` now enforces both the renderer-side desktop hosted-runtime
regression suite and focused Rust embedded-host bootstrap regressions for the
structured browser bootstrap descriptor plus canonical hosted route families.

Before attempting to upgrade the bundled desktop OpenClaw runtime to a newer
upstream tag, verify upgrade readiness from the workspace root:

```bash
pnpm check:desktop-openclaw-runtime
pnpm exec node scripts/openclaw-upgrade-readiness.mjs <target-version>
```

Interpret the readiness output before touching `config/openclaw-release.json` or
the bundled manifest files:

- `versionSourcesAligned: true` means the configured release source, bundled
  manifest, generated manifest, prepared runtime, and local upstream checkout
  all agree on the same OpenClaw version baseline.
- `readyToUpgrade: true` means the local checkout, local tag, and local offline
  asset inputs are present for a real upgrade attempt.
- `readyToUpgrade: false` means do not change bundled runtime version sources
  yet.
- `versionSourcesAligned: true` and `readyToUpgrade: false` can both be correct
  at the same time. That state means the current bundled baseline is internally
  consistent, but the workspace is not prepared for a future retargeting step
  yet.
- If `localUpstreamDirtyCheck` is `unavailable` in the Node diagnostic, run
  `git -C .cache/bundled-components/upstreams/openclaw status --short`
  separately before refreshing the upstream checkout.

Before changing native server behavior, deployment bundles, or release metadata, verify the current server runtime contract from the workspace root:

```bash
pnpm check:server
```

Before finalizing a release that changes desktop/server/container/kubernetes runtime authority, readiness, built-in OpenClaw ownership, or hosted/browser bridge behavior, re-run the unified host runtime smoke contract:

```bash
pnpm check:sdkwork-host-runtime
```

The persisted unified host runtime smoke report lives at `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md`. Treat that report as release evidence, not as optional notes. It records the automated verification batch and the remaining manual runtime checklist for desktop packaged startup, hosted parity, docker, and singleton-kubernetes flows.

The persisted deployment bootstrap smoke report lives at `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md`. Treat that deployment bootstrap smoke report as release evidence as well. It records the automated verification batch plus the required packaged container image startup, docker compose startup, and singleton-k8s readiness commands that still need live execution outside this sandbox.

Before changing GitHub workflows, release packaging scripts, or asset finalization behavior, validate the release automation contracts:

```bash
pnpm check:automation
```

Before pushing a release tag after shared SDK changes, compare the configured
GitHub release sources against the local source-of-truth package roots:

```bash
pnpm check:shared-sdk-release-parity
```

This check clones the pinned refs from `config/shared-sdk-release-sources.json`
and compares them with the local sibling SDK package roots that development
still uses through relative workspace paths, including `@sdkwork/app-sdk`,
`@sdkwork/sdk-common`, `@sdkwork/core-pc-react`,
`@sdkwork/im-backend-sdk`, `@openchat/sdkwork-im-sdk`, and
`@openchat/sdkwork-im-wukongim-adapter`. The comparison normalizes text-file
line endings so Windows `CRLF` checkouts and GitHub `LF` checkouts do not raise
false drift. If this check fails, do not push a release tag yet.

Before collecting artifacts, inspect the current multi-family release matrices:

```bash
pnpm release:plan
```

Local family packagers remain available when you need to validate one slice without waiting for the full GitHub workflow:

```bash
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch -- --platform <platform> --arch <arch> --target <target>
pnpm release:smoke:desktop-startup -- --platform <platform> --arch <arch> --startup-evidence-path <path-to-desktop-startup-evidence.json>
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
```

These commands collect family-specific assets into `artifacts/release` so they can be reviewed locally or aggregated for final release processing.

Local prerequisite notes:

- `pnpm release:package:desktop` only collects installers and app bundles that already exist; run `pnpm release:desktop` or `pnpm tauri:build` first.
- `pnpm release:package:desktop` now also runs the same desktop installer smoke contract used by release finalization, so each packaged desktop target persists an `installer-smoke-report.json` beside its `release-asset-manifest.json`.
- `pnpm release:smoke:desktop` now re-runs the packaged desktop installer smoke and then closes the launched-session check for the same target. When `--startup-evidence-path` is omitted it launches the canonical packaged desktop artifact for that platform, waits until `desktop-startup-evidence.json` reaches `status=passed` and `phase=shell-mounted`, and then writes `desktop-startup-smoke-report.json`. When `--startup-evidence-path` is provided it imports that external evidence instead of launching the package.
- `pnpm release:smoke:desktop-packaged-launch` launches the canonical packaged desktop artifact for the requested target, captures isolated packaged-session startup evidence, and forwards that evidence into the canonical startup smoke report writer. On Linux it automatically falls back to `xvfb-run` when no desktop display is available.
- `pnpm release:smoke:desktop-startup` validates only the captured launched-session startup evidence and copies that evidence into the canonical release asset path when you provide `--startup-evidence-path`.
- `pnpm release:package:server` now auto-builds the missing native server release binary before packaging when you invoke the root local wrapper.
- `pnpm release:package:server` now also runs packaged bundle-runtime smoke and persists a `release-smoke-report.json` beside the server `release-asset-manifest.json`.
- `pnpm release:package:container` packages Docker deployment assets around a Linux server binary. The root local wrapper auto-builds that binary first when it is missing. On Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` bridges into an installed WSL distro automatically. On macOS and other non-Linux hosts, the same fallback still depends on a working Linux target toolchain.
- `pnpm release:package:kubernetes` packages chart assets and release values, so it does not require a locally built server binary.
- `pnpm release:smoke:server` re-runs only the packaged server bundle smoke stage when you want fresh runtime evidence for an existing server artifact set without rebuilding it.
- `pnpm release:smoke:container` now extracts the packaged deployment bundle, verifies that the packaged runtime profile keeps `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false` and `CLAW_SERVER_DATA_DIR=/var/lib/claw-server`, verifies that the packaged Docker Compose layout requires explicit manage credentials and persists `/var/lib/claw-server`, runs Docker Compose against that packaged layout, requires Docker to report the packaged services healthy, and then verifies `/claw/health/ready`, `/claw/manage/v1/host-endpoints`, and the bundled browser shell before persisting `release-smoke-report.json`.
- `pnpm release:smoke:kubernetes` now renders the packaged chart with `helm template`, requires immutable image metadata from `release-metadata.json`, verifies the rendered readiness, Secret-backed credential wiring, and `/var/lib/claw-server` PersistentVolumeClaim contract, and uses `kubectl apply --dry-run=client` when `kubectl` is available. When Helm is unavailable, it still emits machine-readable skipped evidence instead of silently succeeding.

The local wrapper defaults `release:plan`, `release:package:*`, and `release:finalize` to `artifacts/release`. CI still aggregates assets under `release-assets/`. Override the local defaults with environment variables such as:

- `SDKWORK_RELEASE_TAG`
- `SDKWORK_RELEASE_OUTPUT_DIR`
- `SDKWORK_RELEASE_ASSETS_DIR`
- `SDKWORK_RELEASE_TARGET`
- `SDKWORK_RELEASE_PLATFORM`
- `SDKWORK_RELEASE_ARCH`
- `SDKWORK_RELEASE_ACCELERATOR`
- `SDKWORK_RELEASE_IMAGE_REPOSITORY`
- `SDKWORK_RELEASE_IMAGE_TAG`
- `SDKWORK_RELEASE_IMAGE_DIGEST`
- `SDKWORK_RELEASE_REPOSITORY`

## Release Notes Source

GitHub release notes are now repository-owned artifacts instead of auto-generated
platform summaries.

- Release metadata lives in `docs/release/releases.json`
- Per-tag release note documents live under `docs/release/`
- The reusable GitHub release workflow renders notes with `node scripts/release/render-release-notes.mjs --release-tag <tag> --output release-assets/release-notes.md`

When a release attempt fails before GitHub publishes the release, carry the
unpublished change log forward by referencing the earlier failed tags in the
next successful release entry.

## Release Metadata Contract

Each unified release produces two top-level inventory files under the active release asset directory, which is `artifacts/release` for the local wrapper and `release-assets/` inside GitHub workflows:

- `release-manifest.json`
- `SHA256SUMS.txt`

`SHA256SUMS.txt` is the portable checksum surface.

`release-manifest.json` is the machine-readable inventory surface for download portals, deployment automation, and release verification. Each artifact entry carries:

- `family`: one of `desktop`, `web`, `server`, `container`, or `kubernetes`
- `platform`: target platform such as `windows`, `linux`, `macos`, or `web`
- `arch`: target architecture such as `x64`, `arm64`, or `any`
- `accelerator`: deployment-layer accelerator profile when applicable, currently `cpu`, `nvidia-cuda`, or `amd-rocm`
- `kind`: artifact classification such as `installer`, `package`, or `archive`
- `relativePath`: stable path inside the release asset directory
- `sha256`: final artifact checksum
- `size`: final artifact size in bytes

Desktop artifacts carry additional machine-readable metadata because install-time OpenClaw preparation is a release contract, not a best-effort implementation detail:

- `openClawInstallerContract`: the normalized desktop OpenClaw install contract stamped from the current source of truth and persisted from packaging through finalization
- `desktopInstallerSmoke`: the aggregated desktop installer smoke summary lifted from `installer-smoke-report.json`
- `desktopInstallerSmoke.installReadyLayout`: normalized first-launch readiness proof showing how the packaged installer leaves OpenClaw ready for startup reuse
- `desktopStartupSmoke`: the aggregated launched-session desktop runtime smoke summary lifted from `desktop-startup-smoke-report.json` when that evidence has been captured for the artifact
- `desktopStartupSmoke.capturedEvidenceRelativePath`: the preserved path of the captured `diagnostics/desktop-startup-evidence.json` launch record inside the release asset directory

Server artifacts also carry aggregated runtime evidence because a packaged server bundle is not considered releasable until the extracted archive actually boots:

- `serverBundleSmoke`: the aggregated packaged server runtime smoke summary lifted from `release-smoke-report.json`
- `serverBundleSmoke.checks`: ordered readiness checks proving `/claw/health/ready`, `/claw/manage/v1/host-endpoints`, and the bundled browser shell all respond from the packaged archive

Deployment artifacts also carry aggregated deployment evidence because packaging alone is not sufficient proof that the published bundle can be used safely:

- `deploymentSmoke`: the aggregated deployment smoke summary lifted from `release-smoke-report.json` for `container` and `kubernetes` artifacts
- `deploymentSmoke.checks`: ordered deployment checks proving packaged container runtime-profile, Docker Compose credential and persistence contracts, Compose startup, container health, and runtime readiness for `container`, plus rendered chart image-reference, readiness, Secret wiring, and persistent-storage validation for `kubernetes`

The persisted `desktopInstallerSmoke.installReadyLayout` object is intentionally stronger than `{ mode, installKey }`. It must prove all of the following:

- `reuseOnFirstLaunch` is `true`
- `requiresArchiveExtractionOnFirstLaunch` is `false`
- `manifestRelativePath` is `manifest.json`
- `runtimeSidecarRelativePath` is `runtime/.sdkwork-openclaw-runtime.json`
- `nodeEntryRelativePath` matches the bundled manifest's Node entrypoint
- `cliEntryRelativePath` matches the bundled manifest's OpenClaw CLI entrypoint

Release verification treats any field loss or drift in that object as a release-breaking regression, because it would weaken the audit trail for "prepare during install, reuse on first launch".

The `installReadyLayout.mode` contract is platform-specific and is treated as release-breaking when it drifts:

- Windows and Linux desktop installers must produce `simulated-prewarm`
- macOS desktop installers must produce `staged-layout`

The desktop install contract also anchors installer-time OpenClaw preparation to a platform-specific canonical install root:

- Windows NSIS hooks invoke the embedded OpenClaw prepare and CLI registration actions with `--install-root "$INSTDIR"`
- Linux postinstall resolves the packaged install root from the bundled OpenClaw manifest and forwards it as `--install-root "$install_root"`
- macOS projects a preexpanded managed runtime layout into the app bundle instead of relying on a postinstall extraction hook

Family-specific packagers emit partial manifests first. The finalization step then merges them, recomputes final checksums, and also infers the same `family`, `platform`, `arch`, and `accelerator` metadata from fallback asset paths when a partial family manifest is missing. That keeps `server`, `container`, and `kubernetes` assets machine-readable even under degraded packaging conditions.

## GitHub Workflow

The release entrypoint is `.github/workflows/release.yml`, which delegates to `.github/workflows/release-reusable.yml`.

For a `release-*` tag or a manual dispatch, the reusable workflow now builds:

- desktop assets for Windows, Linux, and macOS
- server assets for Windows, Linux, and macOS
- container bundles for Linux `x64` and `arm64`
- architecture-scoped OCI server images published to `ghcr.io/<owner>/claw-studio-server`
- kubernetes bundles for Linux `x64` and `arm64`
- CPU, NVIDIA CUDA, and AMD ROCm-oriented deployment variants where that difference lives at the deployment layer
- a final `release-manifest.json` plus `SHA256SUMS.txt`

## Artifact Families

### Desktop

Desktop remains the existing Tauri-first path:

- Windows: `nsis`
- Linux: `deb`, `rpm`
- macOS: `.app` archive plus `.dmg`

### Server

Server archives are native per-platform bundles. Each archive contains:

- the Rust server binary
- the built browser app under `web/dist`
- `.env.example`
- launcher scripts

The bundled launcher sets `CLAW_SERVER_WEB_DIST` to the extracted `web/dist` directory so the archive can run outside the repository source tree.

Each packaged server target now also persists `release-smoke-report.json` next to its partial manifest. Release finalization rejects the server artifact if that report is missing, stale, or no longer matches the current archive set.

### Container

Container bundles package:

- the prepared server runtime under `app/`
- Docker build files
- Docker Compose files
- CPU and GPU-oriented env overlays

The source repository keeps the container templates under `deploy/docker/` for review and
packaging input:

- `deploy/docker/docker-compose.yml`
- `deploy/docker/docker-compose.nvidia-cuda.yml`
- `deploy/docker/docker-compose.amd-rocm.yml`
- `deploy/docker/Dockerfile`
- `deploy/docker/profiles/*`

Those source tree paths are not the final runnable release layout. Render the packaged layout
locally with `pnpm release:package:container`, then run Docker Compose from the extracted bundle
root.

Inside the extracted bundle root, the same deployment surface becomes:

- `deploy/docker-compose.yml`
- `deploy/docker-compose.nvidia-cuda.yml`
- `deploy/docker-compose.amd-rocm.yml`
- `deploy/Dockerfile`
- `deploy/profiles/*`

Inside that extracted bundle, `deploy/docker-compose.yml` resolves env overlays from
`deploy/profiles/*` and treats the extracted bundle root as the Docker build context.

Base deployment from the extracted bundle root:

```bash
export CLAW_SERVER_MANAGE_USERNAME=claw-admin
export CLAW_SERVER_MANAGE_PASSWORD='replace-with-a-strong-secret'
docker compose -f deploy/docker-compose.yml up -d
```

NVIDIA CUDA overlay:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.amd-rocm.yml up -d
```

The base compose file now requires an explicit manage credential pair before it will start the
public control plane, and the default env overlay keeps
`CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false`.

Each packaged container target now also persists `release-smoke-report.json` next to its partial
manifest. Release finalization rejects the container artifact if Docker Compose smoke is missing,
stale, or no longer matches the current packaged bundle.

### Kubernetes

Kubernetes bundles package:

- a Helm-compatible chart under `chart/`
- base `values.yaml`
- accelerator-specific values files
- generated `values.release.yaml`

Typical deployment:

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml --set auth.manageUsername=claw-admin --set auth.managePassword='replace-with-a-strong-secret'
```

GitHub release automation publishes one OCI image per Linux architecture and then stamps each
Kubernetes bundle with that immutable image reference. `values.release.yaml` pins `image.tag` to
an architecture-qualified release tag such as `release-2026-04-04-01-linux-x64`, and the release
workflow also writes `image.digest` so production clusters can pull by digest without depending on
mutable tags. Override `image.repository` only when you mirror the published image into another
registry, and keep `image.digest` aligned with the mirrored artifact.

The chart also generates or references a Secret-backed control-plane credential set and mounts a
PersistentVolumeClaim at `/var/lib/claw-server` so the SQLite host-state baseline survives Pod
restarts.

Each packaged kubernetes target now also persists `release-smoke-report.json` next to its partial
manifest. Release finalization rejects the kubernetes artifact if packaged chart rendering smoke is
missing, stale, or no longer matches the current bundle.

## Finalization Step

The packaging flow is intentionally split into:

1. family-specific package collection
2. desktop installer smoke verification for packaged desktop targets
3. launched-session desktop startup smoke verification from a real packaged desktop run for every desktop target
4. packaged server and deployment smoke verification for server/container/kubernetes targets
5. global release finalization

The finalization step emits the final inventory and checksums after all family outputs have been aggregated into one release asset directory. Locally that defaults to `artifacts/release`; in GitHub workflows the same step runs against `release-assets/`:

```bash
pnpm release:finalize
```

Finalization now requires `desktop-startup-smoke-report.json` beside every desktop partial manifest. It lifts that launched-session evidence onto the matching desktop artifact as `desktopStartupSmoke` and rejects desktop release assets when the packaged launch report or its captured `diagnostics/desktop-startup-evidence.json` evidence is missing, stale, or no longer matches the current artifact set.

## GPU Variant Model

The Rust server binary itself is CPU-neutral. GPU variants package deployment overlays and release metadata rather than pretending there are different server binaries.

Profiles:

- `cpu`
- `nvidia-cuda`
- `amd-rocm`

## Recommended Use

- choose `desktop` for local GUI-first installs
- choose `server` for native service-style deployments on Windows, Linux, or macOS
- choose `container` for Docker-based server environments
- choose `kubernetes` for cluster deployment and ingress-managed environments
- choose `web` only when you want the browser and docs static bundle
