# Mobile App Download Guide Design

## Context

The current Claw Studio workspace runs on desktop and PC web, but it does not give users a clear, reusable path to continue on mobile. The repository architecture keeps host packages thin and pushes user-facing product behavior into `@sdkwork/claw-shell` and feature packages. That means the mobile guidance flow must avoid host-level business logic while still feeling globally available.

There is also an important boundary constraint in this repository:

- `@sdkwork/claw-shell` can depend on feature packages
- feature packages can depend on `core`, `infrastructure`, `types`, `ui`, `i18n`, and `commons`
- feature packages cannot depend on `@sdkwork/claw-distribution`

Because of that, the mobile guidance flow must read distribution information through `@sdkwork/claw-infrastructure` instead of importing `@sdkwork/claw-distribution` directly.

## Goals

1. Add a clear entry point from desktop and PC web to mobile continuation.
2. Auto-surface the guidance once without repeatedly interrupting the user.
3. Keep a durable entry point available after the first prompt.
4. Reuse the install feature for the actual guidance content instead of duplicating ad-hoc UI in the shell.
5. Keep the implementation within the current architecture rules.

## Options Considered

### Option A: Put everything in `@sdkwork/claw-web` and `@sdkwork/claw-desktop`

Pros:

- Fastest short-term placement
- Easy to detect runtime differences close to bootstrap

Cons:

- Violates the host-thin architecture already enforced in this repository
- Duplicates behavior between web and desktop hosts
- Makes future refinement harder

### Option B: Put all logic directly in `@sdkwork/claw-shell`

Pros:

- Shell already owns global layout and header affordances
- Easy to mount globally

Cons:

- Guidance content becomes layout-owned instead of feature-owned
- Harder to evolve into richer mobile install/help surfaces later

### Option C: Split responsibility across shell, install, and core

Pros:

- Matches repository layering
- Keeps shell responsible only for global entry points and mounting
- Keeps install responsible for download guidance content
- Keeps persistence and one-time prompt logic in core store

Cons:

- Touches more than one package
- Requires careful coordination of exports and tests

## Decision

Choose Option C.

The best architecture-safe version of the feature is:

- `@sdkwork/claw-shell` for the persistent header action and global modal mount
- `removed-install-feature` for the mobile guidance service and UI components
- `@sdkwork/claw-core` for one-time prompt state
- `@sdkwork/claw-i18n` for copy

## User Experience

### Global Entry

Add a header action in the main shell chrome:

- label: "Mobile App" or equivalent localized copy
- always available on desktop and PC web authenticated surfaces
- opens the shared mobile download dialog

### One-Time Prompt

Auto-open the same dialog once on the main non-auth shell after first entering the application.

Rules:

- do not auto-open on auth routes
- do not auto-open on the install page
- mark the prompt as seen the first time it opens
- do not auto-open again after it has been seen

### Install Page Reinforcement

Add an inline mobile section to the install page so users can rediscover the flow later without relying on the header or the first-run prompt.

## Content Strategy

The current public product surface appears stronger on documentation than direct public mobile-store distribution, so the guidance should be honest and capability-aware.

The mobile guide should therefore provide:

- a short explanation of the mobile continuation benefit
- Android and iOS cards
- availability states such as available, setup, or preview
- primary actions that open the official mobile documentation or access instructions
- secondary actions that copy the link

Distribution-aware URLs should be resolved from the current environment:

- `global` -> English docs paths
- `cn` -> Chinese docs paths

## Architecture

### `removed-install-feature`

Add:

- a pure service that resolves mobile guide metadata from `APP_ENV.distribution.id`
- a reusable channel card component
- a reusable inline section
- a dialog component used by the shell

### `@sdkwork/claw-shell`

Update:

- `AppHeader` to expose the persistent action
- `MainLayout` to mount the one-time dialog and trigger the first-run prompt

### `@sdkwork/claw-core`

Extend `useAppStore` with:

- `isMobileAppDialogOpen`
- `hasSeenMobileAppPrompt`
- `openMobileAppDialog`
- `closeMobileAppDialog`
- `markMobileAppPromptSeen`

Do not persist the ephemeral open state. Persist only the "seen" state.

## Testing Strategy

1. Add a pure service test for distribution-aware URL resolution and availability metadata.
2. Expand the install contract test to lock in the new mobile guide surface and exports.
3. Expand the shell contract test to lock in the persistent header entry and global dialog mount.
4. Run focused tests first, then a broader lint/build verification if the shared workspace state allows it.

## Success Criteria

This work is successful when:

- desktop and PC web both expose a global mobile entry in the shell
- the mobile guide auto-opens once and then stays non-intrusive
- the install page contains a long-lived mobile guidance section
- mobile links are resolved by distribution without breaking architecture boundaries
- the behavior is covered by focused tests
