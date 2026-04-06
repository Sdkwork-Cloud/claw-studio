# Claw Studio Mainline Release Automation Design

## Goal

Make `main` the single trustworthy integration line for Claw Studio, ensure release packaging is gated by real verification, and make GitHub Actions own repeatable cross-platform release publication.

## Current State

- `main` is aligned with `origin/main`.
- All local feature branches are behind `main` and have no commits ahead of it, so there is no remaining branch work to merge.
- The repository already has a cross-platform `.github/workflows/release.yml`, but it lacks a dedicated mainline CI workflow and does not gate release packaging on an explicit preflight verification job.
- Release workflow expectations are covered by `scripts/release-flow-contract.test.mjs`, but those checks are not wired into the standard workspace verification scripts.

## Decision

Adopt a three-part release architecture:

1. Keep `main` as the only integration branch. Branch consolidation is done by auditing ahead/behind state, not by force-merging stale branches with no unique commits.
2. Add a dedicated `.github/workflows/ci.yml` that verifies `main` and pull requests targeting `main` with the commands that matter for this repo: workspace lint/parity checks, desktop contract checks, Rust desktop tests, and production builds.
3. Upgrade `.github/workflows/release.yml` so it first runs a preflight verification job, then runs the existing multi-platform packaging matrix, and finally publishes the release assets. Add concurrency so repeated pushes/tags do not create duplicate in-flight release jobs.

## Workflow Design

### Mainline CI

- Trigger on `push` to `main`, `pull_request` targeting `main`, and manual dispatch.
- Add concurrency keyed by workflow name and ref with `cancel-in-progress: true`.
- Run one Ubuntu verification job for:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm check:desktop`
  - `pnpm build`
  - `pnpm docs:build`
- Run one Windows Rust verification job for:
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

This keeps desktop-host Rust logic validated on the platform that compiles the Windows SCM code path, while keeping the heavier workspace checks on a single Linux job.

### Release Workflow

- Preserve the existing `release-*` tag trigger and manual dispatch.
- Add workflow-level concurrency keyed by release tag.
- Add a `verify-release` job before any asset packaging.
- Make both desktop and web release jobs depend on `verify-release`.
- Preserve the current multi-platform release matrix and asset packaging commands.

### Local Verification Hooks

- Add explicit package scripts for workflow contract checks.
- Include those contract tests in the standard `pnpm lint` path so CI/release automation changes are locally enforced before push.

## Release Operation

- Build and package the Windows desktop bundle locally on the current machine.
- Package local web assets if the build output exists.
- Commit all verified changes directly on `main`.
- Push `main` to `origin`.
- Create and push a new `release-*` tag so GitHub Actions performs the authoritative multi-platform release packaging and publication.

## Risks and Handling

- Windows local desktop bundling may hit host toolchain quirks. Mitigation: verify locally before commit and keep GitHub release matrix as the final authority.
- Release workflow regressions can silently break publication. Mitigation: add contract tests and make them part of standard lint.
- Stale local branches may create confusion. Mitigation: audit branch divergence and report that stale branches have no unique commits instead of creating meaningless merge commits.

## Success Criteria

- `main` contains the latest OpenClaw kernel-host integration work.
- All local feature branches are confirmed to have no unmerged commits ahead of `main`.
- `pnpm lint`, `pnpm check:desktop`, `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`, and `pnpm build` pass.
- A local Windows desktop release bundle is produced successfully.
- `main` is pushed to `origin/main`.
- A new `release-*` tag is pushed and the GitHub release workflow is triggered from that tag.
