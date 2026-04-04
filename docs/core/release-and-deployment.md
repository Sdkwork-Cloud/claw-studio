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
```

These commands collect family-specific assets into `artifacts/release` so they can be reviewed locally or aggregated for final release processing.

Local prerequisite notes:

- `pnpm release:package:desktop` only collects installers and app bundles that already exist; run `pnpm release:desktop` or `pnpm tauri:build` first.
- `pnpm release:package:server` now auto-builds the missing native server release binary before packaging when you invoke the root local wrapper.
- `pnpm release:package:container` packages Docker deployment assets around a Linux server binary. The root local wrapper auto-builds that binary first when it is missing. On Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` bridges into an installed WSL distro automatically. On macOS and other non-Linux hosts, the same fallback still depends on a working Linux target toolchain.
- `pnpm release:package:kubernetes` packages chart assets and release values, so it does not require a locally built server binary.

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

### Container

Container bundles package:

- the prepared server runtime under `app/`
- Docker build files
- Docker Compose files
- CPU and GPU-oriented env overlays

Inside the extracted bundle, `deploy/docker-compose.yml` resolves env overlays from `deploy/profiles/*` and treats the extracted bundle root as the Docker build context.

Base deployment:

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

## Finalization Step

The packaging flow is intentionally split into:

1. family-specific package collection
2. global release finalization

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
