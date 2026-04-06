# Claw Studio Architecture Map

## Stack

- React + TypeScript + Vite
- pnpm workspace with host packages and feature packages
- Tauri desktop host plus web host

## Standard Remote Path

Use this path for any business capability backed by `spring-ai-plus-app-api`:

`host -> shell/core -> feature package service or store -> shared app-sdk wrapper -> @sdkwork/app-sdk -> spring-ai-plus-app-api`

The preferred wrapper ownership is a shared core layer, not a host-only package.

## Local And Native Path

Keep these concerns on their original boundaries:

- Tauri commands and platform bridges
- local files, shell processes, dialogs, device integration
- package boundary checks and workspace orchestration

Local-only capability should stay local even while adjacent business modules move to the generated SDK.

## Replace Or Remove

- `@sdkwork/claw-infrastructure` business HTTP calls
- raw REST helpers in feature packages
- duplicate DTO mapping that only exists to hide a missing SDK method
- host-specific backend clients that bypass the shared wrapper

## Contract Closure Rule

If a feature package needs a method that the generated app SDK does not expose:

1. Fix the contract in `spring-ai-plus-app-api` and required backend modules.
2. Regenerate the shared app SDK from the repository-standard generator flow.
3. Reconnect the feature package through the shared wrapper.
4. Delete the temporary bypass.

If that backend work would touch schema, migration, or embedded DB layout, pause and ask the user first.
