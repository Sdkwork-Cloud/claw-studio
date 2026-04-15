# OpenClaw Built-In Port Selection Design

> **Supersession Note (2026-04-13):** This document is preserved for historical OpenClaw port-behavior context. The current source of truth is `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md`, with active OpenClaw runtime packaging and activation aligned to `docs/superpowers/plans/2026-04-13-openclaw-external-node-hard-cut-implementation-plan.md`. The preferred-port behavior below can still inform the OpenClaw adapter, but references to built-in or bundled runtime assumptions are historical only and must now be interpreted through the managed OpenClaw packaged payload plus external Node.js contract.

## Goal

Allow the built-in OpenClaw runtime started by Claw Studio to honor a user-selected gateway port while still avoiding conflicts automatically when that port is occupied.

## Current Problem

The built-in instance already exposes a configurable `port` field through the studio instance model and writes that value into `openclaw.json`. However, the runtime activation flow resolves and caches the managed OpenClaw runtime before later start and restart calls. As a result, a user can save a port in the built-in instance config without guaranteeing that the next built-in launch will actually use that port.

## Desired Behavior

1. When the built-in instance config contains a valid port, the managed OpenClaw activation flow should treat it as the preferred gateway port.
2. If the preferred port is available on loopback, the bundled gateway should use it exactly.
3. If the preferred port is occupied, the activation flow should search nearby loopback ports using the existing conflict-avoidance behavior and persist the resolved port back into `openclaw.json`.
4. Built-in instance metadata, workbench details, control URLs, and gateway bridge calls should continue reading the final resolved port from managed config, so they stay aligned automatically.

## Architecture

The change stays inside the desktop Tauri boundary.

- `studio.rs` remains the owner of built-in instance configuration persistence.
- `openclaw_runtime.rs` remains the owner of managed OpenClaw state creation and final port resolution.
- `bootstrap.rs` and `supervisor.rs` continue orchestrating activation and process lifecycle, but they must refresh the configured runtime from the latest built-in config before starting or restarting the gateway.

## Design Decisions

### Preferred Port Source

The built-in instance config is the source of truth for an explicit user choice. The managed OpenClaw config file remains the source of truth for the final resolved runtime state after conflict handling.

### Conflict Handling

Conflict handling should remain non-fatal for the normal built-in flow. Claw Studio is meant to keep the bundled runtime usable by default, so if the requested port is busy the system should continue scanning a small loopback range and update the config file to the resolved port.

### Runtime Refresh Timing

The managed runtime must be re-resolved:

- during initial bundled activation
- before starting the built-in instance
- before restarting the built-in instance

This ensures the cached runtime inside the supervisor always matches the latest built-in configuration and any port fallback chosen by runtime activation.

## Testing Strategy

Add focused Rust tests that prove:

1. a configured preferred port is used when it is free
2. a busy configured preferred port is rewritten to a nearby free port
3. built-in instance config updates plus a subsequent runtime refresh produce a supervisor runtime aligned with the saved port

## Non-Goals

- No new UI fields or validation flows
- No new environment-variable override for the built-in port
- No change to external or remote instance port semantics
