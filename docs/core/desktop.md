# Desktop Runtime

## Overview

Claw Studio ships a Tauri desktop runtime through `@sdkwork/claw-desktop`. It reuses the shared shell and product feature packages while adding native runtime integration, update checks, and packaging commands.

## Important Paths

- `packages/sdkwork-claw-desktop/src/main.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- `packages/sdkwork-claw-desktop/src/desktop/runtime.ts`
- `packages/sdkwork-claw-desktop/src/desktop/providers/DesktopProviders.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-claw-desktop/src-tauri/`

The template-grade bridge surface is documented in [Desktop Template API](./desktop-template.md).

## Run Desktop Development

```bash
pnpm tauri:dev
```

The desktop package uses a dedicated Vite command for Tauri development on `127.0.0.1:1420`.

## Build The Desktop App

```bash
pnpm tauri:build
```

Useful supporting commands:

```bash
pnpm tauri:info
pnpm tauri:icon
pnpm check:desktop
```

## Environment Model

Desktop runtime behavior relies on typed environment configuration from the infrastructure layer. Common variables include:

- `VITE_API_BASE_URL`
- `VITE_ACCESS_TOKEN`
- `VITE_APP_ID`
- `VITE_RELEASE_CHANNEL`
- `VITE_DISTRIBUTION_ID`
- `VITE_PLATFORM`
- `VITE_TIMEOUT`
- `VITE_ENABLE_STARTUP_UPDATE_CHECK`

The root `.env.example` and `packages/sdkwork-claw-desktop/.env.example` document these values.

## Desktop Architecture Notes

- the desktop entry package stays thin
- shell composition remains in `@sdkwork/claw-shell`
- update and configuration logic flow through shared infrastructure and core layers
- native execution and packaging live under `src-tauri`
- the standard desktop bridge now exposes a template API with command catalog, event catalog, grouped domain facades, and a normalized bridge error model

This split matters because the desktop runtime must stay aligned with the same UI and feature surface used by the web application.
