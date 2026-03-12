# Development

## Daily Workflow

The normal repository loop is:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

When you change documentation, also run:

```bash
pnpm docs:build
```

## Verification Commands

Repository verification is intentionally layered:

- `pnpm lint`: TypeScript checks for the web package, architecture boundaries, and parity checks
- `pnpm build`: production build for the web package
- `pnpm check:arch`: package structure, layering rules, and root-only import validation
- `pnpm check:parity`: focused checks that keep critical behavior aligned with the v3 baseline
- `pnpm check:desktop`: desktop platform and Tauri command contract checks

## Package-Scoped Execution

Use pnpm filters when you need to work on one package directly:

```bash
pnpm --filter @sdkwork/claw-studio-web build
pnpm --filter @sdkwork/claw-studio-desktop tauri:info
pnpm --filter @sdkwork/claw-studio-market lint
```

## Rules That Matter

### Keep Entry Packages Thin

`@sdkwork/claw-studio-web` is an application entry. It should not absorb new stores, hooks, or business services. The same principle applies to `@sdkwork/claw-studio-desktop`.

### Import Package Roots Only

Cross-package imports must target package roots:

```ts
import { Market } from '@sdkwork/claw-studio-market';
```

Do not import feature internals across packages:

```ts
import { Market } from '@sdkwork/claw-studio-market/src/pages/market/Market';
```

### Keep Feature Logic Inside Feature Packages

Feature-local pages, components, and services belong in their own package. Promote code to `business` only when it is genuinely shared across multiple features.

## Documentation Workflow

- update `README.md` or `README.zh-CN.md` for repository entry changes
- update pages in `docs/` for public documentation changes
- keep `docs/plans/` for internal design and implementation plans

## Before Opening A Pull Request

Run the commands that prove your claim:

```bash
pnpm lint
pnpm build
pnpm docs:build
```

If the change touches desktop behavior, also run `pnpm check:desktop` and the relevant Tauri command.
