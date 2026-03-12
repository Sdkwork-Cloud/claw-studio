# Claw Studio

[简体中文](./README.zh-CN.md)

Claw Studio is a package-first workspace for the modern Claw Studio application, shared web shell, and Tauri desktop runtime. The current implementation is aligned to `upgrade/claw-studio-v3`, but reorganized into maintainable feature packages with strict architecture boundaries and root-only cross-package imports.

This repository focuses on the Claw Studio product. It also contains `packages/cc-switch` as a separate package family, but the primary workspace, scripts, and documentation here center on Claw Studio.

## Highlights

- Shared product shell across web and desktop entry packages
- Vertical feature packages for chat, apps, market, settings, devices, account, extensions, community, and more
- Strict dependency layering enforced by repository checks
- Tauri desktop runtime with update, distribution, and platform foundation checks
- Multilingual documentation for users and contributors

## Architecture Snapshot

```text
web/desktop -> shell -> feature/business -> (domain + infrastructure)
feature -> shared-ui
```

Key package roles:

- `@sdkwork/claw-studio-web`: runnable web app and development server
- `@sdkwork/claw-studio-desktop`: Tauri desktop entry and native bridge
- `@sdkwork/claw-studio-shell`: routes, layouts, providers, sidebar, command palette
- `@sdkwork/claw-studio-business`: shared stores and cross-feature orchestration
- `@sdkwork/claw-studio-domain`: pure types and shared models
- `@sdkwork/claw-studio-infrastructure`: environment, HTTP, i18n, and platform adapters
- `@sdkwork/claw-studio-*`: vertical feature packages such as `chat`, `market`, `settings`, `account`, and `extensions`

The repository rejects cross-package subpath imports. Use package roots such as `@sdkwork/claw-studio-market`, not `@sdkwork/claw-studio-market/src/...`.

## Quick Start

```bash
pnpm install
pnpm dev
```

The default web development server runs from `packages/claw-studio-web/server.ts` on `http://localhost:3001`.

For desktop development and packaging:

```bash
pnpm tauri:dev
pnpm tauri:build
```

## Common Commands

```bash
pnpm dev           # start the web shell
pnpm build         # build the web package
pnpm lint          # TypeScript + architecture + parity checks
pnpm check:arch    # validate package boundaries and root imports
pnpm check:parity  # verify critical parity checks against the v3 baseline
pnpm check:desktop # validate desktop platform wiring
pnpm docs:dev      # run the VitePress docs site
pnpm docs:build    # build the VitePress docs site
```

Package-scoped execution stays available through pnpm filters, for example:

```bash
pnpm --filter @sdkwork/claw-studio-web build
pnpm --filter @sdkwork/claw-studio-desktop tauri:info
```

## Environment

Start from [`.env.example`](./.env.example). The most important variables are:

- `GEMINI_API_KEY`: required for Gemini-backed AI features
- `VITE_API_BASE_URL`: backend API base URL used by typed clients and desktop update checks
- `VITE_ACCESS_TOKEN`: optional bearer token for update and backend calls
- `VITE_APP_ID`, `VITE_RELEASE_CHANNEL`, `VITE_DISTRIBUTION_ID`, `VITE_PLATFORM`, `VITE_TIMEOUT`: desktop runtime and update configuration

Desktop-specific examples are also available in [`packages/claw-studio-desktop/.env.example`](./packages/claw-studio-desktop/.env.example).

## Documentation

- [Getting Started](./docs/guide/getting-started.md)
- [Development Guide](./docs/guide/development.md)
- [Architecture](./docs/core/architecture.md)
- [Package Layout](./docs/core/packages.md)
- [Desktop Runtime](./docs/core/desktop.md)
- [Commands Reference](./docs/reference/commands.md)
- [Contribution Guide](./docs/contributing/index.md)

The repository also ships an in-app documentation feature package at `@sdkwork/claw-studio-docs`. The VitePress site in `docs/` is the public project documentation for GitHub and open-source contributors.

## Contributing

Use Conventional Commits such as `feat:`, `fix:`, `refactor:`, and `docs:`. Before opening a pull request, run:

```bash
pnpm lint
pnpm build
pnpm docs:build
```

Pull requests should include a concise summary, affected packages, verification commands, and screenshots for UI-facing changes.
