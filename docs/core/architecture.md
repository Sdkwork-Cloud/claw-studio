# Architecture

## Dependency Direction

Claw Studio follows a strict dependency flow:

```text
web/desktop -> shell -> feature/business -> (domain + infrastructure)
feature -> shared-ui
```

This rule keeps application entry packages small, makes feature packages portable, and prevents hidden dependencies between unrelated business areas.

## Layer Responsibilities

### Web And Desktop

- bootstrap the runtime
- mount the shared shell
- provide platform-specific integration only

They should not own business stores, feature services, or page logic.

### Shell

`@sdkwork/claw-studio-shell` owns composition concerns:

- router
- layouts
- providers
- sidebar
- command palette
- global shell UX

The shell assembles feature exports. It should not turn into a monolith with feature-local services or stores.

### Business

`@sdkwork/claw-studio-business` holds cross-feature state and orchestration, such as global stores and shared hooks. It is not a dumping ground for feature-local services.

### Domain And Infrastructure

- `domain`: pure shared models and types
- `infrastructure`: environment access, HTTP clients, i18n bootstrap, platform adapters, update helpers

### Feature Packages

Feature packages own their own `components`, `pages`, and `services` directories. Examples include:

- `@sdkwork/claw-studio-chat`
- `@sdkwork/claw-studio-market`
- `@sdkwork/claw-studio-settings`
- `@sdkwork/claw-studio-account`
- `@sdkwork/claw-studio-extensions`

## Root-Only Imports

Cross-package imports must target the package root:

```ts
import { Settings } from '@sdkwork/claw-studio-settings';
```

This repository rejects imports that reach into another package's internal files.

## Enforced Repository Rules

The architecture checker validates:

- required package directory structure
- allowed dependency directions
- root-only cross-package imports
- package export shape
- web shell boundary rules

Run it explicitly with:

```bash
pnpm check:arch
```

## Why This Matters

The workspace was migrated from `upgrade/claw-studio-v3`, which remains the functional reference baseline. The package structure preserves the same product surface while making ownership explicit and long-term maintenance safer.
