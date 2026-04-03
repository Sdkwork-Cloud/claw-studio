# Getting Started

## What You Are Setting Up

This repository contains the package-based Claw Studio workspace. It includes:

- a web entry package
- a Tauri desktop entry package
- a shared shell package
- shared `core`, `types`, and `infrastructure` packages
- vertical feature packages such as `chat`, `market`, `settings`, `account`, and `extensions`

## Prerequisites

- Node.js
- `pnpm`
- Rust if you plan to run the native server or desktop builds
- Tauri prerequisites if you plan to run desktop builds

If you are only working on the web shell, Node.js and `pnpm` are enough.

## Install Dependencies

```bash
pnpm install
```

## Run The Web Workspace

```bash
pnpm dev
```

This starts the Vite development server for `@sdkwork/claw-web` on `http://localhost:3001`.

## Run The Desktop App

```bash
pnpm tauri:dev
```

The desktop package serves the shell through Vite on `127.0.0.1:1420` and then launches the Tauri application.

## Run The Native Server

```bash
pnpm server:dev
```

The server package boots the Rust host and serves the browser application through the bundled `/claw/*` control-plane routes plus the built web assets.

## Build Targets

```bash
pnpm build
pnpm check:server
pnpm server:build
pnpm tauri:build
pnpm docs:build
```

Use `pnpm build` for the web shell, `pnpm check:server` to validate the native server runtime, `pnpm server:build` for native server packaging, `pnpm tauri:build` for desktop packaging, and `pnpm docs:build` for the public documentation site.

## Plan And Verify Releases

```bash
pnpm check:automation
pnpm release:plan
pnpm release:finalize
```

Use `pnpm check:automation` to validate release and CI workflow contracts before changing packaging automation, `pnpm release:plan` to inspect the current multi-family release matrices before packaging or CI changes, and `pnpm release:finalize` after aggregating packaged artifacts into one `release-assets/` directory.

## Automated Releases

Claw Studio release packaging is automated through GitHub Actions.

- push a `release-*` tag to build and publish a full release
- use the `release` workflow with `workflow_dispatch` to rebuild assets for an existing tag or ref
- desktop release jobs package Windows, Linux, and macOS installers or bundles
- server release jobs package native server archives for Windows, Linux, and macOS
- container release jobs package Linux deployment bundles for CPU, NVIDIA CUDA, and AMD ROCm-oriented variants
- kubernetes release jobs package Helm-compatible deployment bundles for Linux server targets
- companion web and docs assets are published as a versioned archive on the same GitHub release

## Environment Setup

Start from the root `.env.example`.

Important variables:

- AI capabilities require an active OpenClaw-compatible instance and Provider Center configuration
- `VITE_API_BASE_URL`: backend API base URL
- `VITE_ACCESS_TOKEN`: optional backend token
- desktop update variables such as `VITE_APP_ID` and `VITE_RELEASE_CHANNEL`

Desktop-specific examples also exist in `packages/sdkwork-claw-desktop/.env.example`.

## Next Steps

- Read [Development](/guide/development) for the daily workflow
- Read [Architecture](/core/architecture) before moving code between packages
- Read [Release And Deployment](/core/release-and-deployment) before planning server, Docker, or Kubernetes installs
- Read [Commands](/reference/commands) for verification and packaging scripts
