# Claw Studio Desktop Template Audit

## Executive Summary

Claw Studio already has the beginnings of a serious desktop platform: the Rust side is split into framework, services, commands, and kernel/runtime contracts, and the repository already ships contract tests that protect the Tauri foundation. The weakest part of the current system is not the native kernel itself, but the inconsistency between the native kernel, the TypeScript bridge, the architecture rules, and the broader product shell.

This audit concludes that the highest-leverage path is:

1. Promote the desktop bridge to a template-grade standard API.
2. Align architecture rules with the actual role of `@sdkwork/claw-i18n`.
3. Keep documenting and enforcing the standard surface with contract tests.
4. Plan a second wave focused on config reloading, process profile extensibility, persistent jobs, and web mock backend decomposition.

## What Is Strong Today

- The Rust desktop runtime is already modular: `framework`, `services`, `commands`, `state`, and `plugins` are separated.
- Storage, process, and kernel capabilities already have explicit contract tests.
- Shell composition is shared across web and desktop, which is correct for a template application.
- Native platform leakage into feature packages is guarded by automated checks.

## Critical Gaps

### 1. The old TypeScript desktop bridge was not template-grade

Before this pass, `tauriBridge.ts` mixed runtime detection, command names, raw `invoke()`, raw `listen()`, fallback logic, and API grouping in one place. That made it reusable only by convention, not by standard.

### 2. Architecture governance drifted away from reality

`@sdkwork/claw-i18n` is already functioning as a foundation package, but `check-arch-boundaries.mjs` still treated it like a shell-only dependency. That made `pnpm check:arch` reject valid locale-aware feature code, which weakens trust in the architecture rules.

### 3. Web host mock backend is far too monolithic

`packages/sdkwork-claw-web/server.ts` is a giant in-memory demo backend with schema setup, mock data seeding, and many routes in one file. This is the biggest template blocker outside the desktop package because it prevents:

- testable service boundaries
- reusable mock adapters
- domain ownership
- realistic production migration

### 4. Desktop runtime configuration is still snapshot-based

The native runtime loads config during bootstrap and serves a snapshot. For a serious template, config should eventually support controlled reload or stateful config services instead of one-time cloning.

### 5. Process profiles are still hard-coded diagnostics

The current process kernel is structurally good, but profile registration is still static and diagnostics-oriented. A template application should move toward declarative or config-backed profile registries.

### 6. Jobs are in-memory only

The `JobService` is excellent as an orchestration scaffold, but it is not durable across restart. For a best-in-class desktop app platform, durable job records and resumability should be part of the next phase.

## Product Gaps

- The command palette still uses plain Fuse.js lexical search. Good enough for demo quality, not best-in-class for a serious AI workspace.
- The app currently mixes product shell concerns with demo-data experiences. That makes it harder to present Claw Studio as either a polished product or a clean reusable template.
- There is no explicit “capability health” or “runtime diagnostics” page surfacing the desktop kernel info for operators and developers.

## Algorithm Opportunities

The codebase does not currently need exotic algorithms to become excellent. The largest bottlenecks are architecture and product clarity. That said, there are clear places where top-tier algorithms can create separation later:

### Command Palette

- Replace pure lexical Fuse search with hybrid ranking: lexical score + recency + route popularity + semantic embedding match.
- Add per-user adaptive ranking from click history and context.

### Marketplace And Discovery

- Use hybrid retrieval for skills and packs: metadata filters + BM25 + embedding rerank.
- Add graph-based related-item expansion from installs, co-browse, and dependency data.

### Operations And Runtime

- Add anomaly detection for job failures, process timeouts, and update regressions.
- Use cost-aware scheduling for background native jobs when multiple process profiles are introduced.

## Decisions Made In This Pass

- Standardized the desktop bridge around a command catalog, event catalog, normalized error model, and grouped template API.
- Kept the existing flat bridge exports for compatibility.
- Strengthened `check:desktop` so template standards are now test-enforced.
- Updated architecture governance so `@sdkwork/claw-i18n` is treated as a foundation layer where appropriate.

## Recommended Next Wave

### P0

- Split `packages/sdkwork-claw-web/server.ts` into domain modules or move it into a dedicated mock service package.
- Add a desktop diagnostics screen that renders runtime kernel info and storage/provider status.
- Fix repo-wide TypeScript issues and make `pnpm lint` green again.

### P1

- Introduce config reload/versioning in the desktop runtime.
- Move process profile registration to declarative manifests or typed config.
- Persist job history to a durable storage profile.

### P2

- Upgrade command palette ranking to a hybrid retrieval model.
- Introduce usage-informed marketplace ranking and recommendation pipelines.
