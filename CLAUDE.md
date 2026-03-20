# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # start web dev server at http://localhost:3001
pnpm build            # production build for @sdkwork/claw-web
pnpm lint             # tsc + check:arch + check:parity (run before every PR)
pnpm check:arch       # validate package layering and import boundaries
pnpm check:parity     # run all contract tests in scripts/
pnpm check:sdkwork-<name>  # run a single contract test, e.g. check:sdkwork-install
pnpm tauri:dev        # desktop development build
pnpm tauri:build      # desktop production build
pnpm docs:dev         # VitePress docs at http://127.0.0.1:4173
```

Individual contract tests (in `scripts/`) run directly via Node:
```bash
node --experimental-strip-types scripts/sdkwork-install-contract.test.ts
```

Unit tests live next to source as `*.test.ts` / `*.test.tsx` and have no shared runner — run them individually with Node or add a filter script as needed.

## Architecture

This is a pnpm workspace (`packages/sdkwork-claw-*`). The dependency flow is strictly enforced by `scripts/check-arch-boundaries.mjs`:

```
web / desktop
  └─> shell
        └─> feature packages
              └─> commons, core, infrastructure, i18n, types, ui
core  ──> infrastructure, i18n, types
infra ──> i18n, types
types / ui / i18n ──> self only
```

**Hosts** (`claw-web`, `claw-desktop`): routing, layout, providers, platform bootstrap only. No services, stores, hooks, or platform logic in `src/`.

**Shell** (`claw-shell`): routes, layouts, sidebar, command palette, providers. Imports all feature packages.

**Foundation layers**:
- `claw-core` — shared stores and cross-feature orchestration (`src/hooks`, `src/services`, `src/stores`)
- `claw-infrastructure` — HTTP, config, platform adapters, update checks (`src/config`, `src/http`, `src/platform`, `src/services`, `src/updates`)
- `claw-commons` — shared components, hooks, lib (`src/components`, `src/hooks`, `src/lib`)
- `claw-types` — pure types and shared models
- `claw-ui` — reusable UI primitives
- `claw-i18n` — locale bootstrap
- `claw-distribution` — manifests and providers (`src/manifests`, `src/providers`)

**Feature packages** (e.g. `claw-chat`, `claw-market`, `claw-settings`, `claw-install`): own `src/components`, `src/pages`, `src/services`. Allowed cross-feature deps:
- `claw-chat` → `claw-market`, `claw-settings`
- `claw-market` → `claw-instances`
- `claw-settings` → `claw-account`

## Import Rules (enforced by check:arch)

- Import from **package roots only**: `@sdkwork/claw-market`, never `@sdkwork/claw-market/src/...`
- Each package's `package.json` exports only `"."` — no subpath exports
- Within a package, import services via the barrel (`../services`), not direct file paths (`../services/fooService`)
- No stale `@sdkwork/claw-studio-*` bridge references

## Naming Conventions

- Components and pages: `PascalCase.tsx`
- Services and utilities: `camelCase.ts`
- Zustand stores: `useXStore.ts`
- Package scope: `@sdkwork/claw-xxx` / directory: `sdkwork-claw-xxx` (kebab-case)

## Contract Tests

`scripts/*-contract.test.ts` files assert the public surface of each package (exports, file existence, i18n keys, dependency constraints). When adding new exports or files to a package, check whether its contract test needs updating. Run `pnpm check:parity` to validate all contracts at once.

## Environment

Copy `.env.example` to `.env`. Key variables:
- `GEMINI_API_KEY` — required for AI features
- `VITE_API_BASE_URL` — backend API base (default `http://localhost:8080`)
- `VITE_ACCESS_TOKEN` — optional bearer token for update checks
- `VITE_APP_ID`, `VITE_RELEASE_CHANNEL`, `VITE_DISTRIBUTION_ID`, `VITE_PLATFORM` — desktop runtime config

## Commits

Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`. Scope each commit to one package or one architectural concern.
