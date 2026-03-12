# Claw Studio V3 Migration Design

## Goal

Migrate `upgrade/claw-studio-v3` into the workspace package architecture without losing any v3 behavior, while restructuring package boundaries so the resulting monorepo is easier to maintain than the current partial migration.

## Context

`upgrade/claw-studio-v3` is the authoritative product baseline. It contains the complete single-package web app, including all routes, feature pages, shared shell components, stores, services, locales, and platform abstractions.

The current workspace only represents a partial migration. Several v3 capabilities are missing or simplified, including:

- dedicated `/account` and `/extensions` routes
- the sidebar instance selector
- `BillingSettings`
- `useInstanceStore`
- `accountService`, `extensionService`, `mySkillService`, `githubService`, `huggingfaceService`, `clawChatService`, and `agentService`

The migration must preserve the workspace dependency rule:

- `web/desktop -> shell -> feature/business -> domain/infrastructure`
- `feature -> shared-ui`

## Requirements

- Keep feature behavior, route surface, and navigation structure aligned with `upgrade/claw-studio-v3`
- Allow package boundaries to be re-planned where the current split is weak
- Keep `@sdkwork/claw-studio-web` and `@sdkwork/claw-studio-desktop` as thin entry shells
- Prevent `@sdkwork/claw-studio-shell` from becoming a new monolith
- Move single-feature services back into feature packages whenever possible
- Keep only truly cross-feature state and orchestration in `@sdkwork/claw-studio-business`
- Preserve a clean platform abstraction through `@sdkwork/claw-studio-infrastructure`

## Proposed Architecture

### 1. Shell And Entry Packages

- `@sdkwork/claw-studio-web`: web bootstrap only
- `@sdkwork/claw-studio-desktop`: desktop bootstrap and Tauri bridge only
- `@sdkwork/claw-studio-shell`: router, layout, providers, sidebar, command palette, global task manager, route aggregation

`shell` may compose feature exports, but it must not own page-level business logic or feature-local services.

### 2. Shared Core Packages

- `@sdkwork/claw-studio-domain`: pure types, entities, DTOs, enums, shared business models
- `@sdkwork/claw-studio-infrastructure`: env/config, HTTP client, runtime/platform adapters, browser/dialog/install/update helpers, i18n bootstrap
- `@sdkwork/claw-studio-business`: global stores, global hooks, and the small set of orchestration services truly shared across features

The global business layer should be reduced to items like `useAppStore`, `useInstanceStore`, `useTaskStore`, `useLLMStore`, `useChatStore`, and `useKeyboardShortcuts`.

### 3. Vertical Feature Packages

Existing feature packages remain and are completed:

- `apps`
- `channels`
- `chat`
- `claw-center`
- `community`
- `devices`
- `docs`
- `github`
- `huggingface`
- `install`
- `instances`
- `market`
- `settings`
- `tasks`

New feature packages are added to restore v3 parity:

- `account`
- `extensions`

Each feature package should own its `pages`, feature components, and feature-local services.

### 4. Service Placement Rules

- Move feature-local services into their feature package:
  - `githubService` -> `github`
  - `huggingfaceService` -> `huggingface`
  - `accountService` -> `account`
  - `extensionService` and `mySkillService` -> `extensions`
- Audit `agentService` and `clawChatService`; keep them in `chat` unless a cross-feature dependency proves otherwise
- Keep only genuinely shared orchestration services in `business`

### 5. Routing And Navigation

The route list and sidebar structure must be aligned to v3. That includes:

- restoring `/account`
- restoring `/extensions`
- restoring the v3 default landing route
- restoring the sidebar instance selector
- restoring v3 navigation groups and entry ordering

Each feature package should export its route elements and route metadata so `shell` composes the application without embedding feature-specific details.

### 6. I18n And Shared UX

V3 includes `i18n.ts` and locale JSON files. The workspace should reintroduce the same translation capability through infrastructure or shell bootstrap rather than leaving those assets in the upgrade snapshot. Shared UX pieces such as `CommandPalette`, `GlobalTaskManager`, and modal patterns stay in shell/shared-ui as appropriate, but their behavior must remain aligned with v3.

## Migration Strategy

### Phase 1: Baseline Audit

Create a route/page/service/store/component/locale parity checklist between `upgrade/claw-studio-v3` and `packages/*`. This prevents missing implicit dependencies during package moves.

### Phase 2: Shared Core Alignment

Restore missing shared stores and infrastructure-level wiring first:

- `useInstanceStore`
- i18n bootstrap and locale assets
- missing global exports
- any shared domain types referenced by multiple features

### Phase 3: Feature-By-Feature Migration

Migrate one feature at a time into a closed loop:

- pages
- feature-local components
- feature-local services
- barrel exports
- shell route registration

Priority order:

1. account
2. extensions
3. shell parity updates
4. settings parity (`BillingSettings`)
5. service ownership cleanup across existing packages

### Phase 4: Shell Parity

Once feature exports exist, align:

- router
- sidebar
- providers
- root route behavior

### Phase 5: Verification

Use targeted tests, architecture checks, and full workspace build/lint to prove parity and dependency safety.

## Acceptance Criteria

The migration is complete only when:

- every v3 route exists in the workspace build
- every v3 page has a package home in the monorepo
- all v3 shell-level navigation affordances are restored
- missing services/stores are reintroduced with working exports
- package boundaries follow the new vertical-feature architecture
- `pnpm lint` and `pnpm build` succeed
- logic-heavy additions include regression tests where feasible

## Out Of Scope

- net-new product features beyond v3
- visual redesign beyond what is required to preserve v3 behavior
- backend API redesign
- replacing the existing platform/runtime abstraction model
