# Packages

## Workspace Layout

The repository is a `pnpm` workspace with packages under `packages/*`.

## Application And Runtime Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/claw-studio-web` | Web entry application and development server |
| `@sdkwork/claw-studio-desktop` | Tauri desktop entry, native bridge, and packaging scripts |
| `@sdkwork/claw-studio-shell` | Routes, layout, providers, sidebar, command palette, shell composition |
| `@sdkwork/claw-studio-distribution` | Desktop distribution manifests and provider-level distribution metadata |

## Shared Core Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/claw-studio-business` | Shared stores, hooks, and cross-feature orchestration |
| `@sdkwork/claw-studio-domain` | Types, DTOs, and shared business models |
| `@sdkwork/claw-studio-infrastructure` | Environment, HTTP, i18n, update client, and platform helpers |
| `@sdkwork/claw-studio-shared-ui` | Shared visual primitives used by feature packages |

## Feature Packages

The current workspace includes feature-oriented packages such as:

- `@sdkwork/claw-studio-account`
- `@sdkwork/claw-studio-apps`
- `@sdkwork/claw-studio-channels`
- `@sdkwork/claw-studio-chat`
- `@sdkwork/claw-studio-claw-center`
- `@sdkwork/claw-studio-community`
- `@sdkwork/claw-studio-devices`
- `@sdkwork/claw-studio-docs`
- `@sdkwork/claw-studio-extensions`
- `@sdkwork/claw-studio-github`
- `@sdkwork/claw-studio-huggingface`
- `@sdkwork/claw-studio-install`
- `@sdkwork/claw-studio-instances`
- `@sdkwork/claw-studio-market`
- `@sdkwork/claw-studio-settings`
- `@sdkwork/claw-studio-tasks`

Each feature package must keep at least:

```text
src/components
src/pages
src/services
```

## Package Boundaries

- entry packages depend on the shell and shared layers
- feature packages may depend on `business`, `domain`, `infrastructure`, and `shared-ui`
- feature packages should not import internals from other feature packages
- root barrels are part of the architecture contract

## Related Package Family

This repository also contains `packages/cc-switch`, but it is documented separately. The main public documentation here is intentionally centered on Claw Studio.
