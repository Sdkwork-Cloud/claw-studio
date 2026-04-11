# SDKWork Claw Package Matrix

## Goal

Track the active `sdkwork-claw-*` workspace graph, its `@sdkwork/claw-*` package names, and how it relates to the `upgrade/claw-studio-v5` baseline.

## Active Host Packages

| Active Directory | Package Name | Role | V5 Relationship |
| --- | --- | --- | --- |
| `packages/sdkwork-claw-web` | `@sdkwork/claw-web` | active browser host and dev server | workspace-only host retained to keep the browser runtime thin |
| `packages/sdkwork-claw-desktop` | `@sdkwork/claw-desktop` | active Tauri host and native bridge | workspace-only desktop host retained to keep the Tauri runtime thin |
| `packages/sdkwork-claw-shell` | `@sdkwork/claw-shell` | shared routes, layout, providers, and app composition | wraps the V5 feature surface in the retained dual-host architecture |

## Active Shared Foundation Packages

| Active Directory | Package Name | Role | V5 Relationship |
| --- | --- | --- | --- |
| `packages/sdkwork-claw-core` | `@sdkwork/claw-core` | shared stores, orchestration hooks, app state | workspace split of V5 shared state responsibilities |
| `packages/sdkwork-claw-types` | `@sdkwork/claw-types` | pure shared types and models | extracted shared typing layer for the workspace graph |
| `packages/sdkwork-claw-infrastructure` | `@sdkwork/claw-infrastructure` | environment, HTTP, runtime, install, and update adapters | workspace-only infrastructure layer retained for web and desktop hosts |
| `packages/sdkwork-claw-i18n` | `@sdkwork/claw-i18n` | locale bootstrap and resources | extracted i18n layer reused by hosts and features |
| `packages/sdkwork-claw-ui` | `@sdkwork/claw-ui` | reusable UI primitives and utilities | workspace UI foundation aligned with V5 visuals |
| `packages/sdkwork-claw-commons` | `@sdkwork/claw-commons` | shared non-feature widgets and hooks | V5 `commons` package carried forward locally |
| `packages/sdkwork-claw-distribution` | `@sdkwork/claw-distribution` | desktop distribution metadata and packaging support | workspace-only desktop support layer |

## Active Feature Packages

| Active Directory | Package Name | Role | V5 Relationship |
| --- | --- | --- | --- |
| `packages/sdkwork-claw-auth` | `@sdkwork/claw-auth` | auth entry surface | required V5 package, implemented locally |
| `packages/sdkwork-claw-account` | `@sdkwork/claw-account` | account pages and services | V5 feature package implemented locally |
| `packages/sdkwork-claw-apps` | `@sdkwork/claw-apps` | app marketplace surface | V5 feature package implemented locally |
| `packages/sdkwork-claw-center` | `@sdkwork/claw-center` | Claw Center pages and upload flow | V5 feature package implemented locally |
| `packages/sdkwork-claw-channels` | `@sdkwork/claw-channels` | provider and channel views | V5 feature package implemented locally |
| `packages/sdkwork-claw-chat` | `@sdkwork/claw-chat` | AI chat experience | V5 feature package implemented locally |
| `packages/sdkwork-claw-community` | `@sdkwork/claw-community` | community feed and post flows | V5 feature package implemented locally |
| `packages/sdkwork-claw-devices` | `@sdkwork/claw-devices` | device management views | V5 feature package implemented locally |
| `packages/sdkwork-claw-docs` | `@sdkwork/claw-docs` | in-app docs surface | V5 feature package implemented locally |
| `packages/sdkwork-claw-extensions` | `@sdkwork/claw-extensions` | extension install and manage flows | V5 feature package implemented locally |
| `packages/sdkwork-claw-github` | `@sdkwork/claw-github` | GitHub repository flows | V5 feature package implemented locally |
| `packages/sdkwork-claw-huggingface` | `@sdkwork/claw-huggingface` | Hugging Face discovery and model detail | V5 feature package implemented locally |
| `packages/removed-install-feature` | `removed-install-feature` | installation flows and system requirements | V5 feature package implemented locally |
| `packages/sdkwork-claw-instances` | `@sdkwork/claw-instances` | instance management flows | V5 feature package implemented locally |
| `packages/sdkwork-claw-market` | `@sdkwork/claw-market` | market, skill, and pack views | V5 feature package implemented locally |
| `packages/sdkwork-claw-settings` | `@sdkwork/claw-settings` | settings pages and API key management | V5 feature package implemented locally |
| `packages/sdkwork-claw-tasks` | `@sdkwork/claw-tasks` | scheduled task management | V5 feature package implemented locally |

## Non-Target Package

| Directory | Decision |
| --- | --- |
| `packages/cc-switch` | kept outside the active Claw Studio migration target and excluded from the main workspace execution path |

## Verification Targets

- structure and naming: `node scripts/check-sdkwork-claw-structure.mjs`
- route surface: `node scripts/check-sdkwork-claw-route-surface.mjs`
- host graph: `node scripts/check-sdkwork-claw-hosts.mjs`
- feature contracts: `node --experimental-strip-types scripts/sdkwork-*.test.ts`
- V5 contract surface: `node --experimental-strip-types scripts/v5-product-contract.test.ts`
