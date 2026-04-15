# OpenClaw Built-In Runtime Design

> **Supersession Note (2026-04-13):** This design is preserved for historical context. The built-in OpenClaw product direction it introduced is still relevant, but the current source of truth is `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md`. Any references below that imply bundled language runtimes or pre-hard-cut desktop assumptions must be read as historical only.

## Goal

Make Claw Studio's built-in OpenClaw integration product-grade:

- bundle the latest verified OpenClaw runtime
- keep Windows, macOS, and Linux terminal invocation consistent
- expose `openclaw` globally after built-in installation
- avoid leaking managed runtime secrets into on-disk shell shims
- keep upgrades, rollback, and verification explicit

## Approved Direction

Claw Studio should use a hybrid product model with one default behavior:

- the default experience is a fully managed built-in OpenClaw runtime
- external npm, pnpm, installer-script, source, WSL, and container routes remain available as advanced paths
- Windows native terminals must work without requiring WSL

The built-in path owns:

- runtime provisioning
- runtime activation
- gateway lifecycle
- CLI shell exposure
- PATH registration
- command verification

## Core Decisions

### 1. Single runtime truth source

The bundled OpenClaw manifest is the only source of truth for:

- OpenClaw version
- Node version
- target platform
- target architecture
- bundled CLI path

UI, activation, CLI registration, and verification must read from that contract instead of duplicating version literals.

### 2. Managed shell command model

The globally exposed `openclaw` command is not a copied CLI binary.

It is a launcher shim that delegates to Claw Studio's internal CLI entrypoint. That launcher:

- resolves the active bundled runtime at execution time
- injects managed runtime environment only in-process
- forwards all user arguments
- never stores gateway auth tokens in the shim itself

### 3. Native terminal first

The built-in terminal contract is:

- Windows: `cmd`, PowerShell, Windows Terminal
- macOS: `zsh`, `bash`
- Linux: login/profile shells and common interactive shells

WSL may be supported as an additional path, but it is not required for the built-in runtime contract.

### 4. PATH and profile ownership

Claw Studio owns a managed user bin directory and PATH/profile registration for the current user.

Requirements:

- Windows PATH registration must be idempotent and prioritize the managed bin directory
- Unix shell profile sourcing must cover both login and common interactive shells
- repeated registration must not duplicate blocks or PATH entries

### 5. Lifecycle and verification

Built-in installation is only considered fully successful when:

- the bundled runtime is provisioned
- the CLI launcher shims exist
- PATH/profile registration is complete
- `openclaw --version` resolves successfully
- the reported version matches the bundled manifest

If shell exposure fails but the embedded runtime still works in-app, the product should treat that as partial success, not silent success.

### 6. Upgrade and rollback safety

Built-in runtime activation must preserve fallback metadata through the active runtime layout state so a newer runtime can be promoted without destroying the previous verified slot.

## Implementation Scope For This Round

This round focuses on the highest-value product gaps:

1. move the bundled OpenClaw default version to the current npm `latest` verified on 2026-03-24
2. replace secret-bearing shims with launcher-based shims
3. extend internal CLI support so the launcher can execute the managed OpenClaw runtime securely
4. widen shell profile registration coverage on Unix
5. keep runtime activation and CLI registration tests aligned with the new behavior

## Non-Goals

This round does not fully replace the gateway subprocess control plane or redesign the full profile registry model. Those are larger architectural follow-ups.

## Verification Targets

- targeted runtime preparation tests
- targeted internal CLI and path registration tests
- targeted desktop bootstrap tests
- desktop contract checks that cover bundled runtime expectations
