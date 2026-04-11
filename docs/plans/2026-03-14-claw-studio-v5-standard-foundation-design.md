# Claw Studio V5 Standard Foundation Design

## Goal

Build a standardized, reusable Claw engineering foundation with `upgrade/claw-studio-v5` as the authoritative product baseline, while preserving the original V5 business package model and adding the minimum new foundations required for long-term product extension.

## Context

`upgrade/claw-studio-v5` is the latest functional business baseline. It already defines the target feature partitioning model:

- `sdkwork-claw-account`
- `sdkwork-claw-apps`
- `sdkwork-claw-auth`
- `sdkwork-claw-center`
- `sdkwork-claw-channels`
- `sdkwork-claw-chat`
- `sdkwork-claw-community`
- `sdkwork-claw-core`
- `sdkwork-claw-devices`
- `sdkwork-claw-docs`
- `sdkwork-claw-extensions`
- `sdkwork-claw-github`
- `sdkwork-claw-huggingface`
- `sdkwork-claw-i18n`
- `removed-install-feature`
- `sdkwork-claw-instances`
- `sdkwork-claw-market`
- `sdkwork-claw-settings`
- `sdkwork-claw-tasks`
- `sdkwork-claw-types`
- `sdkwork-claw-commons`

The current workspace introduced a different package architecture around `shell`, `business`, `infrastructure`, `shared-ui`, and `desktop`. That work contains valuable runtime and desktop capabilities, but its package split no longer matches the V5 business model.

The target is not to keep the current package architecture. The target is to preserve V5's business package design, then selectively migrate the valuable cross-cutting capabilities into V5-aligned packages.

## Requirements

- Keep V5 as the source of truth for routes, page logic, business package boundaries, and feature ownership.
- Preserve the original V5 feature package style rather than replacing it with a new platform-heavy package tree.
- Replace `sdkwork-claw-commons` with a stronger shared component package named `sdkwork-claw-ui`.
- Add a dedicated `sdkwork-claw-terminal` package for in-app terminal capability.
- Retain the current desktop runtime foundation because V5 does not include a complete Tauri host.
- Avoid direct feature-to-Tauri coupling. Feature packages should consume stable runtime APIs rather than invoking native commands ad hoc.
- Make the resulting workspace reusable as a sample foundation for future products without forcing a completely new package taxonomy.
- Keep local `backup/` and `upgrade/` directories in the working tree but out of version control through `.gitignore`.

## Design Principles

### 1. Preserve business packages, not current intermediate architecture

The V5 package model is the correct business partitioning model. The current `claw-studio-shell`, `claw-studio-business`, `claw-studio-infrastructure`, and `claw-studio-shared-ui` packages are implementation artifacts of the previous migration attempt, not the target architecture.

### 2. Add only the smallest new foundations required

Only two business-level additions are justified:

- `sdkwork-claw-ui`
- `sdkwork-claw-terminal`

Everything else should be folded back into V5-aligned packages or kept strictly as host runtime infrastructure.

### 3. Keep desktop as a host implementation, not a business package taxonomy driver

Desktop runtime support is necessary, but it must not force a new feature package model. The desktop host should provide runtime capabilities to V5 packages without rewriting the whole workspace around desktop concerns.

### 4. Abstract deeply inside stable packages

The abstraction goal is still high, but the abstraction should live inside stable packages:

- core contracts
- shared UI
- runtime facades
- feature exports
- root app composition

The abstraction should not depend on proliferating many new top-level package categories.

## Recommended Package Architecture

### 1. Root Application Shape

Keep the V5-style root application structure as the product entry surface:

- root `package.json`
- root `pnpm-workspace.yaml`
- root `src/main.tsx`
- root `src/App.tsx`
- root `server.ts`
- root Vite and TypeScript config

The root app remains the product composition point. It should not delegate to a separate `shell` package.

### 2. Business Package Layout

The target `packages/` directory should remain V5-shaped, with these active business packages:

- `sdkwork-claw-account`
- `sdkwork-claw-apps`
- `sdkwork-claw-auth`
- `sdkwork-claw-center`
- `sdkwork-claw-channels`
- `sdkwork-claw-chat`
- `sdkwork-claw-community`
- `sdkwork-claw-core`
- `sdkwork-claw-devices`
- `sdkwork-claw-docs`
- `sdkwork-claw-extensions`
- `sdkwork-claw-github`
- `sdkwork-claw-huggingface`
- `sdkwork-claw-i18n`
- `removed-install-feature`
- `sdkwork-claw-instances`
- `sdkwork-claw-market`
- `sdkwork-claw-settings`
- `sdkwork-claw-tasks`
- `sdkwork-claw-terminal`
- `sdkwork-claw-types`
- `sdkwork-claw-ui`

`sdkwork-claw-ui` replaces `sdkwork-claw-commons`.

`sdkwork-claw-terminal` is added as a new first-class feature package.

### 3. Host Runtime Package

Keep the current desktop host package as a runtime package outside the business package model:

- `packages/claw-studio-desktop`

This package remains the native Tauri host until a later rename is justified. It is allowed to exist because V5 does not currently provide an equivalent host implementation.

Its responsibility is limited to:

- `src-tauri`
- native command handlers
- bridge setup
- window, filesystem, process, and job integration
- desktop bootstrap

It must not own feature UI, feature routes, or application business structure.

## Package Mapping From Current Workspace

### Retain as-is

- `packages/claw-studio-desktop`

### Replace or fold into V5-aligned packages

- `packages/claw-studio-shell`
  - remove as a standalone package
  - move useful root composition concerns back into root `src/App.tsx` and root bootstrap files

- `packages/claw-studio-business`
  - dissolve as a standalone package
  - move app-wide state, shortcuts, and runtime facades into `sdkwork-claw-core`
  - move task-related state into `sdkwork-claw-tasks` when it is feature-specific
  - keep only the V5-shaped package destinations

- `packages/claw-studio-infrastructure`
  - dissolve as a standalone package
  - move i18n bootstrap to `sdkwork-claw-i18n`
  - move platform facade contracts into `sdkwork-claw-core`
  - keep native host implementation in `claw-studio-desktop`

- `packages/claw-studio-shared-ui`
  - remove as a standalone package
  - replace with `sdkwork-claw-ui`

- `packages/claw-studio-distribution`
  - fold any still-relevant branding or distribution metadata into root app configuration, `metadata.json`, or desktop host config

- `packages/cc-switch`
  - remove from the target architecture unless a verified V5 requirement still depends on it

## `sdkwork-claw-core` Responsibilities

`sdkwork-claw-core` is the correct place for cross-feature application logic that V5 already recognizes as shared.

It should own:

- global app store such as theme, language, and sidebar state
- global navigation models
- `Sidebar`
- `CommandPalette`
- browser and desktop runtime capability facade
- app-level command registration
- minimal shared runtime types that are too behavior-oriented for `sdkwork-claw-types`

It should not become a replacement for the removed `shell` or `business` monoliths.

## `sdkwork-claw-ui` Responsibilities

`sdkwork-claw-ui` replaces `sdkwork-claw-commons` and becomes the shared UI foundation for all products built on this workspace.

### Technology choice

Use:

- `shadcn/ui`
- `@radix-ui/*`
- `tailwindcss`

This preserves bottom-layer control while still giving the project a standardized component system.

### Scope

`sdkwork-claw-ui` should own:

- design tokens
- low-level primitives
- form controls
- dialog, drawer, dropdown, tabs, tooltip, toast, and command UI
- composable layout primitives
- standardized workbench components

Examples of shared components to centralize:

- `Button`
- `Input`
- `Textarea`
- `Select`
- `Dialog`
- `Drawer`
- `DropdownMenu`
- `Tabs`
- `ScrollArea`
- `CommandDialog`
- `PageHeader`
- `SectionCard`
- `ConfirmDialog`
- `AsyncActionButton`
- `RepositoryCard`
- `EmptyState`
- `StatusBadge`

### Migration rule

Feature packages can still own feature-specific visual components, but repeated workbench patterns should be migrated into `sdkwork-claw-ui` rather than reimplemented per package.

## `sdkwork-claw-terminal` Responsibilities

`sdkwork-claw-terminal` is a new feature package, not a host package.

It should provide:

- terminal page and route
- terminal tab model
- session list UI
- output viewport
- command input UI
- terminal-related feature state
- integration with runtime session APIs exposed through shared contracts

It should not directly call Tauri commands. It should consume runtime APIs exposed through shared interfaces owned by V5-aligned packages.

## Terminal Capability Design

### Why a dedicated package is required

Terminal is not just a background job status panel. It is a user-facing product capability with its own UX, navigation surface, session model, and security model.

That justifies a dedicated feature package instead of burying terminal logic inside `core` or `tasks`.

### Current reusable foundations

The current workspace already contains reusable runtime capabilities:

- process execution and streaming
- background jobs
- event subscriptions for process output
- runtime metadata queries

These exist today in the desktop host and current runtime facade code. They should be reused rather than replaced.

### Two runtime layers

The target terminal capability should distinguish between:

- one-shot process execution
- long-lived terminal sessions

The current process/job foundation can support one-shot process execution immediately. A true interactive terminal requires a session model to be added on top of the host.

### Terminal API direction

The shared runtime contract should eventually support:

- `createTerminalSession`
- `writeTerminalInput`
- `resizeTerminalSession`
- `closeTerminalSession`
- `listTerminalSessions`
- `subscribeTerminalOutput`

The first foundation phase does not need to implement full PTY support if the host is not ready, but the package design should reserve a clean contract for it.

## Root App Composition Rules

### Keep V5 root composition

Root `src/App.tsx` remains the place where the product assembles:

- routes
- providers
- layout
- sidebar
- command palette
- global task manager
- global overlays

Do not move these concerns into a new standalone shell package.

### Standardize through configuration and exports

To keep the workspace reusable for future products without adding a new package taxonomy:

- each feature package should expose stable entry exports
- navigation metadata should be centrally assembled from package exports
- root metadata and product configuration should stay data-driven where possible

This creates a standardized foundation without rewriting the package tree.

## Future Product Extension Strategy

The workspace should be reusable for future products by reusing:

- the same root app structure
- the same `sdkwork-claw-ui`
- the same desktop host
- the same `sdkwork-claw-core`
- the same feature package boundaries

Future products should extend the foundation by:

- enabling a different route set
- changing root composition and metadata
- reusing or omitting selected feature packages
- adding new business feature packages in the same V5 style

The extension mechanism should be based on composition and stable exports, not on a brand-new platform package hierarchy.

## Migration Strategy

### Phase 1: Establish the V5 package baseline

- replace the root app files with the authoritative `upgrade/claw-studio-v5` equivalents
- replace the current V4/V3-style business packages with the V5 package set
- keep `backup/` and `upgrade/` locally but ignore them in git

### Phase 2: Introduce `sdkwork-claw-ui`

- replace `sdkwork-claw-commons` with `sdkwork-claw-ui`
- move reusable UI primitives and cross-feature components into the new package
- rewire existing feature imports to consume `sdkwork-claw-ui`

### Phase 3: Re-home current reusable workspace logic

- move shared app stores and runtime facades from `claw-studio-business` into `sdkwork-claw-core`
- move i18n bootstrap from `claw-studio-infrastructure` into `sdkwork-claw-i18n`
- move useful shell composition patterns back into root app files
- keep desktop host implementation in `claw-studio-desktop`

### Phase 4: Add terminal foundation

- create `sdkwork-claw-terminal`
- expose terminal and process contracts through the shared runtime surface
- wire terminal output streaming from desktop host to the new feature package

### Phase 5: Harden the standard foundation

- centralize theme tokens and reusable controls in `sdkwork-claw-ui`
- clean package exports
- remove obsolete packages
- verify routing and behavior parity with V5

## Acceptance Criteria

The foundation is complete only when:

- the root app is based on `upgrade/claw-studio-v5`
- V5 business package boundaries are restored
- `sdkwork-claw-commons` is replaced by `sdkwork-claw-ui`
- `sdkwork-claw-terminal` exists as a first-class feature package
- `claw-studio-desktop` remains as the working native host
- useful logic from current `shell`, `business`, and `infrastructure` has been re-homed into V5-aligned destinations
- feature packages no longer depend on the removed intermediate architecture packages
- terminal capability has a stable API surface even if full PTY support is phased
- the workspace remains suitable as a reusable sample foundation for additional products

## Out Of Scope

- a full plugin platform redesign
- introducing a large new package taxonomy such as `platform`, `product`, or `shell` packages
- preserving every current intermediate package purely for historical reasons
- implementing complete PTY parity in the same step as the V5 structural migration if the host needs staged rollout
