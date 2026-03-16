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
- Rust and Tauri prerequisites if you plan to run desktop builds

If you are only working on the web shell, Node.js and `pnpm` are enough.

## Install Dependencies

```bash
pnpm install
```

## Run The Web Workspace

```bash
pnpm dev
```

This starts the development server from `packages/sdkwork-claw-web/server.ts` on `http://localhost:3001`.

## Run The Desktop App

```bash
pnpm tauri:dev
```

The desktop package serves the shell through Vite on `127.0.0.1:1420` and then launches the Tauri application.

## Build Targets

```bash
pnpm build
pnpm tauri:build
pnpm docs:build
```

Use `pnpm build` for the web shell, `pnpm tauri:build` for desktop packaging, and `pnpm docs:build` for the public documentation site.

## Environment Setup

Start from the root `.env.example`.

Important variables:

- `GEMINI_API_KEY`: required for AI capabilities
- `VITE_API_BASE_URL`: backend API base URL
- `VITE_ACCESS_TOKEN`: optional backend token
- desktop update variables such as `VITE_APP_ID` and `VITE_RELEASE_CHANNEL`

Desktop-specific examples also exist in `packages/sdkwork-claw-desktop/.env.example`.

## Next Steps

- Read [Development](/guide/development) for the daily workflow
- Read [Architecture](/core/architecture) before moving code between packages
- Read [Commands](/reference/commands) for verification and packaging scripts
