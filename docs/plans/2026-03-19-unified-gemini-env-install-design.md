# Unified Gemini and Cross-Platform Env Install Design

**Date:** 2026-03-19

**Status:** Approved for implementation

## Goal

Enable `Unified API Key` to configure Gemini CLI through the routed API Router gateway, and add a user-selectable installation model that can write standard client config files, persistent environment variables, or both across Windows, macOS, and Linux.

## Problem Summary

The current API Router setup flow has two gaps:

1. `Unified API Key` explicitly disables Gemini even though the routed Gemini gateway metadata already exists.
2. One-click setup only supports client-specific config files. It does not expose a safe, structured way to persist environment variables at the user or system scope.

This creates an inconsistent experience across clients and prevents Gemini CLI from benefiting from routed API compatibility that is already supported by the official Gemini CLI source.

## Design Principles

- Be capability-driven instead of pretending every tool supports the same setup path.
- Let users choose installation mode, but only show options that are correct for the current client and platform.
- Prefer structured installer requests over ad hoc shell script generation.
- Preserve existing user config whenever possible and make repeated installs idempotent.
- Degrade gracefully on web runtimes and on platforms without sufficient permissions.

## Recommended Product Model

Each client setup flow exposes user-selectable installation options:

- `standard`: write the client's normal config files
- `env`: write only persistent environment variables when the client and platform safely support that mode
- `both`: write both standard config files and persistent environment variables

Each environment-variable install also exposes scope:

- `user`: persist for the current user
- `system`: persist machine-wide when the platform supports it and permissions allow it

The UI only offers modes returned by a capability service for the selected client, provider compatibility, and runtime platform.

## Architecture

### 1. Unified API Key -> Gemini

`packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts`

- Remove the hard-coded Gemini block.
- Build a synthetic Gemini-compatible provider from the unified key, just like the existing OpenAI and Anthropic paths.
- Reuse `buildProviderAccessClientConfigById('gemini', provider)` so Gemini setup stays in one place.

### 2. Provider Access Capability Layer

`packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts`

- Add capability metadata for installation modes and supported scopes.
- Keep client config snippets for manual setup, but augment them with metadata describing whether a client supports `standard`, `env`, or `both`.
- Treat environment-variable support as additive rather than universal.

Recommended first-phase defaults:

- Codex: `standard` and `both`
- Claude Code: `standard` and `both`
- OpenCode: `standard` and `both`
- Gemini: `standard`, `env`, and `both`
- OpenClaw: unchanged command/onboarding path, no global env mode

### 3. Structured Installer Contract

`packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts`

Extend the installer contract with structured install preferences:

- `installMode`: `standard | env | both`
- `envScope`: `user | system`

This keeps the renderer side declarative and lets the desktop implementation own platform-specific persistence details.

### 4. Desktop / Tauri Execution

`packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`

Implement environment persistence as native logic instead of free-form script text.

Responsibilities:

- Validate requested install mode against the client/platform capability
- Execute file writes for `standard`
- Execute persistent env writes for `env`
- Execute both branches and return combined, step-aware results for `both`
- Return partial success details instead of pretending the whole install failed when one branch succeeded

### 5. UI Flow

`packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx`

Expose:

- installation mode selector
- environment variable scope selector when mode includes env
- preview of files and env keys that will be written
- availability messaging when a requested mode is unsupported or requires manual completion

## Gemini-Specific Behavior

The official Gemini CLI supports routed/custom Gemini endpoints through environment variables. For routed API Router setup:

- `GEMINI_API_KEY=<router key>`
- `GOOGLE_GEMINI_BASE_URL=<router gemini base url>`
- `GEMINI_API_KEY_AUTH_MECHANISM=bearer`

Standard Gemini setup should still write:

- `~/.gemini/settings.json`
- `~/.gemini/.env`

When the provider base URL is the standard Google endpoint, the extra routed env keys may be omitted. When the provider is routed through API Router, they must be included.

## Cross-Platform Env Persistence Strategy

### Windows

- `user` scope: use native user-environment persistence
- `system` scope: use machine-environment persistence only when allowed
- avoid brittle shell-only approaches such as relying exclusively on `setx`

### macOS and Linux

- `user` scope: manage a dedicated sourced env file and ensure supported shell profiles load it
- `system` scope: write a managed file under a standard global shell location when permissions allow
- preserve existing shell profile content and update only the managed block

## Error Handling

- Unsupported mode: block before execution and explain why
- Permission failure on system scope: return partial success plus manual fallback guidance
- Unknown shell/profile location: preserve the client-specific standard setup and report env fallback steps
- Repeat execution: update existing managed entries instead of duplicating them

## Testing Strategy

### TypeScript

- unified key Gemini config is available instead of blocked
- Gemini routed snippets include base URL and auth mechanism env values
- capability mapping exposes only supported modes per client/platform
- apply service forwards install preferences correctly

### Rust

- Gemini standard install writes routed env values when using API Router
- user-scope env persistence is idempotent
- system-scope failures surface as explicit errors or partial success
- combined `both` mode reports written files and env updates together

## Risks and Mitigations

- Risk: env-only behavior differs by client.
  - Mitigation: capability-gated UI and conservative first-phase enablement.
- Risk: system-scope env writes require elevation.
  - Mitigation: treat system scope as best-effort with explicit fallback messaging.
- Risk: shell profile fragmentation on Unix.
  - Mitigation: standardize on one managed include file and avoid scattering unmanaged edits.

## Success Criteria

- Unified API Key can one-click configure Gemini CLI through routed API compatibility.
- Users can choose between `standard`, `env`, and `both` where supported.
- Environment persistence behaves correctly on Windows, macOS, and Linux, with clear fallback behavior.
- Re-running setup remains safe and does not duplicate config or managed env entries.
