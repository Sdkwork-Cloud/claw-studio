# Hub Installer Descriptor + Submodule Design

**Date:** 2026-03-20

## Goal

Make `hub-installer` the source of truth for product installation, uninstall, data preservation, and migration metadata, then consume that truth inside Claw Studio through a git submodule rather than a drifting vendored copy.

## Problem Summary

Claw Studio already has a stronger product-first install UI for OpenClaw, ZeroClaw, and IronClaw, but the upstream `hub-installer` manifest model still treats key product behavior as implicit shell logic. That leaves four gaps:

1. The UI cannot reliably explain actual install methods versus documented alternatives.
2. Custom install/work/data directories are not surfaced as structured capabilities.
3. Uninstall and data-preservation behavior is only partially inferable from lifecycle scripts.
4. Migration support and constraints are product-specific knowledge embedded in page copy instead of an install contract.

## Recommended Approach

Use a single structured descriptor model directly in `hub-installer` manifests and surface it unchanged through both TypeScript and Rust assessment APIs.

### Descriptor Model

Add three optional top-level manifest sections:

1. `installation`
   Captures the automated method for this profile, documented alternatives, and directory semantics.
2. `dataLayout`
   Declares product-owned files, directories, logs, secrets, and databases, including backup and uninstall defaults.
3. `migration`
   Declares supported or manual migration strategies, preview/apply commands, warnings, and which data items they touch.

### Why this approach

- It keeps product truth close to the registry manifest that already owns installation behavior.
- It prevents Claw Studio from inventing product rules that the installer engine cannot verify.
- It scales to more products without hard-coding more UI-only logic.
- It lets the Rust engine expose installation, uninstall, and migration context from one inspection call before execution starts.

## Rejected Alternatives

### 1. Keep the schema minimal and hard-code the rest in Claw Studio

Rejected because it duplicates product knowledge across repos and makes the desktop UI drift from the actual installer implementation.

### 2. Parse uninstall/migration intent heuristically from shell commands

Rejected because shell scripts are too ambiguous for reliable UX. We need explicit metadata for preservation policy, migration warnings, and custom-directory support.

### 3. Store descriptors only in a Claw Studio-side product catalog

Rejected because that makes `hub-installer` less reusable and prevents other consumers from benefiting from the same product descriptors.

## Data Model Boundaries

### `installation`

Must answer:

- What method is automated by this manifest?
- Which documented alternatives exist?
- Which directories are used?
- Which directories can the user customize?

### `dataLayout`

Must answer:

- What data/config/log/database assets exist?
- Which items are sensitive?
- Which items should be backed up by default?
- Which items should be preserved, removed, or handled manually on uninstall?

### `migration`

Must answer:

- What migration strategies exist?
- Are they automated, command-driven, or manual-only?
- What preview/apply commands should the UI show?
- What warnings or prerequisites must be visible before execution?

## Product Truth To Encode

### OpenClaw

- Multiple install profiles exist; Claw Studio should treat each profile truthfully instead of pretending there is one generic install path.
- Config/auth/channel setup should mention config file, secret references, channels, and model/profile choices.
- Windows should continue surfacing the WSL recommendation clearly.

### ZeroClaw

- Rust-native source install is the primary supported automated path.
- User data lives in `~/.zeroclaw`, including auth profiles, secret key, and workspace skills.
- OpenClaw migration is command-driven and previewable.

### IronClaw

- Rust source install is only one of several documented upstream install methods.
- Runtime data includes both `~/.ironclaw/.env` and PostgreSQL-backed state.
- Migration must warn that database-backed data is not automatically imported by the current profile.

### Codex

- The manifest should describe both source and release bootstrap methods truthfully.
- Config/log/sqlite state paths need to be represented as structured data items.
- Windows guidance should remain WSL-aware.

## Engine and UI Contract

The Rust assessment result should include:

- `installation`
- `dataItems`
- `migrationStrategies`

Claw Studio should consume those fields directly to render:

- install method summary and alternatives
- custom directory support
- data preservation/removal expectations
- migration visibility, commands, and warnings

## Repository Strategy

Claw Studio should stop carrying a detached vendored copy of `hub-installer`.

Recommended repository layout:

- `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer` becomes a real git submodule
- submodule remote: `https://github.com/Sdkwork-Cloud/hub-installer`
- Claw Studio keeps only the submodule pointer plus integration code

This preserves upstream history, keeps updates pullable, and avoids silent divergence.

## Verification Strategy

1. Add failing TS tests for manifest validation and bundled registry descriptor coverage.
2. Add failing Rust tests for assessment descriptor exposure.
3. Implement the minimal schema/types/engine changes to make those tests pass.
4. Extend registry manifests for OpenClaw, ZeroClaw, IronClaw, and Codex.
5. Verify `hub-installer` with `pnpm test`, `pnpm build`, and `cargo test`.
6. Integrate the upgraded submodule into Claw Studio and update contract/UI tests.

## Success Criteria

- `hub-installer` upstream contains structured descriptor support in TypeScript, schema, Rust, docs, and registry manifests.
- Claw Studio consumes the new descriptor fields and improves install/uninstall/migration UX without hard-coded product truth.
- `hub-installer` is linked as a submodule, not a dead vendored snapshot.
- Both upstream and parent repo verification pass, or remaining blockers are explicitly documented.
