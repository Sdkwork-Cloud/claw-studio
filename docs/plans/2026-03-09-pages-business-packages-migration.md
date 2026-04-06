# Pages to Packages Migration

## Goal
- Move legacy `web/src/pages/*` business screens into dedicated feature packages.
- Keep each feature package aligned to `src/components`, `src/pages`, and `src/services`.
- Preserve strict package layering and eliminate cross-package subpath coupling.

## Target Packages
- `pages/apps` -> `@sdkwork/claw-studio-apps`
- `pages/channels` -> `@sdkwork/claw-studio-channels`
- `pages/chat` -> `@sdkwork/claw-studio-chat`
- `pages/claw-center` -> `@sdkwork/claw-studio-claw-center`
- `pages/community` -> `@sdkwork/claw-studio-community`
- `pages/devices` -> `@sdkwork/claw-studio-devices`
- `pages/docs` -> `@sdkwork/claw-studio-docs`
- `pages/github` -> `@sdkwork/claw-studio-github`
- `pages/huggingface` -> `@sdkwork/claw-studio-huggingface`
- `pages/install` -> `@sdkwork/claw-studio-install`
- `pages/instances` -> `@sdkwork/claw-studio-instances`
- `pages/market` -> `@sdkwork/claw-studio-market`
- `pages/settings` -> `@sdkwork/claw-studio-settings`
- `pages/tasks` -> `@sdkwork/claw-studio-tasks`

## Migration Rules
- Business pages move into feature packages under `src/pages/<module>`.
- Shared services, hooks, stores, and platform adapters must be consumed from package roots only.
- Allowed examples:
  - `@sdkwork/claw-studio-business`
  - `@sdkwork/claw-studio-domain`
  - `@sdkwork/claw-studio-infrastructure`
- Forbidden examples:
  - any package-internal service path
  - any package-internal store path
  - any package-internal infrastructure adapter path
- `web` remains the application shell for routes, providers, and bootstrap only.

## Verification
- `pnpm lint`
- `pnpm build`
- `node scripts/check-arch-boundaries.mjs`
