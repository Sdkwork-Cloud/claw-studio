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
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
```

These commands collect family-specific assets into `artifacts/release` so they can be reviewed locally or aggregated for final release processing.

Local prerequisite notes:

- `pnpm release:package:desktop` only collects installers and app bundles that already exist; run `pnpm release:desktop` or `pnpm tauri:build` first.
- `pnpm release:package:desktop` now also runs the same desktop installer smoke contract used by release finalization, so each packaged desktop target persists an `installer-smoke-report.json` beside its `release-asset-manifest.json`.
- `pnpm release:package:server` now auto-builds the missing native server release binary before packaging when you invoke the root local wrapper.
- `pnpm release:package:server` now also runs packaged bundle-runtime smoke and persists a `release-smoke-report.json` beside the server `release-asset-manifest.json`.
- `pnpm release:package:container` packages Docker deployment assets around a Linux server binary. The root local wrapper auto-builds that binary first when it is missing. On Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` bridges into an installed WSL distro automatically. On macOS and other non-Linux hosts, the same fallback still depends on a working Linux target toolchain.
- `pnpm release:package:kubernetes` packages chart assets and release values, so it does not require a locally built server binary.
- `pnpm release:smoke:desktop` re-runs only the packaged desktop installer smoke stage when you want to re-verify an already collected desktop artifact set without rebuilding bundles.
- `pnpm release:smoke:server` re-runs only the packaged server bundle smoke stage when you want fresh runtime evidence for an existing server artifact set without rebuilding it.
- `pnpm release:smoke:container` now extracts the packaged deployment bundle, runs Docker Compose against the packaged layout, and verifies `/claw/health/ready`, `/claw/manage/v1/host-endpoints`, and the bundled browser shell before persisting `release-smoke-report.json`.
- `pnpm release:smoke:kubernetes` now renders the packaged chart with `helm template`, verifies the rendered readiness and image contracts, and uses `kubectl apply --dry-run=client` when `kubectl` is available. When Helm is unavailable, it still emits machine-readable skipped evidence instead of silently succeeding.

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

Server artifacts also carry aggregated runtime evidence because a packaged server bundle is not considered releasable until the extracted archive actually boots:

- `serverBundleSmoke`: the aggregated packaged server runtime smoke summary lifted from `release-smoke-report.json`
- `serverBundleSmoke.checks`: ordered readiness checks proving `/claw/health/ready`, `/claw/manage/v1/host-endpoints`, and the bundled browser shell all respond from the packaged archive

Deployment artifacts also carry aggregated deployment evidence because packaging alone is not sufficient proof that the published bundle can be used safely:

- `deploymentSmoke`: the aggregated deployment smoke summary lifted from `release-smoke-report.json` for `container` and `kubernetes` artifacts
- `deploymentSmoke.checks`: ordered deployment checks proving Docker Compose startup and runtime readiness for `container`, plus rendered chart readiness and image-reference validation for `kubernetes`

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
3. packaged server and deployment smoke verification for server/container/kubernetes targets
4. global release finalization

The finalization step emits the final inventory and checksums after all family outputs have been aggregated into one release asset directory. Locally that defaults to `artifacts/release`; in GitHub workflows the same step runs against `release-assets/`:

```bash
pnpm release:finalize
```

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
