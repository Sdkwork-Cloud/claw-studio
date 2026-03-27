# Mainline Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the current OpenClaw integration work on `main`, harden GitHub automation for CI and release publication, and push a new release tag that triggers packaging.

**Architecture:** Treat branch consolidation as an audited `main`-line integration problem, not a blind merge problem. Enforce workflow expectations with contract tests, add a dedicated `ci.yml`, gate `release.yml` with a verification job, then verify, commit, push, and tag from `main`.

**Tech Stack:** Git, GitHub Actions YAML, Node.js contract tests, pnpm workspace scripts, Rust desktop tests, Tauri desktop release build.

---

### Task 1: Audit Mainline and Record the Plan

**Files:**
- Create: `docs/superpowers/specs/2026-03-27-mainline-release-automation-design.md`
- Create: `docs/superpowers/plans/2026-03-27-mainline-release-automation.md`

- [ ] **Step 1: Confirm branch divergence and remote state**

Run: `git fetch --all --tags --prune`
Expected: remote refs refresh cleanly

- [ ] **Step 2: Confirm local branches have no unique commits ahead of `main`**

Run: `git for-each-ref --format='%(refname:short)' refs/heads`
Expected: local branches are enumerable for ahead/behind checks

- [ ] **Step 3: Write the design and plan documents**

Expected: both docs explain why stale branches are not force-merged and how CI/release automation will be hardened

### Task 2: Add Failing Workflow Contract Tests

**Files:**
- Create: `scripts/ci-flow-contract.test.mjs`
- Modify: `scripts/release-flow-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write a failing CI workflow contract test**

Expected assertions:
- `.github/workflows/ci.yml` exists
- it triggers on `push` to `main` and `pull_request` targeting `main`
- it defines concurrency
- it runs `pnpm lint`, `pnpm check:desktop`, `pnpm build`, `pnpm docs:build`
- it runs `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

- [ ] **Step 2: Tighten the release workflow contract test**

Expected assertions:
- `.github/workflows/release.yml` defines concurrency
- it defines a `verify-release` job
- release packaging jobs depend on that verification job
- package scripts expose workflow contract checks
- `pnpm lint` includes those workflow contract checks

- [ ] **Step 3: Run the workflow contract tests and verify they fail**

Run: `node scripts/ci-flow-contract.test.mjs`
Expected: FAIL because `ci.yml` does not exist yet

Run: `node scripts/release-flow-contract.test.mjs`
Expected: FAIL because the tightened release workflow constraints are not satisfied yet

### Task 3: Implement CI and Release Workflow Changes

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`

- [ ] **Step 1: Add the `ci.yml` workflow**

Include:
- `push`/`pull_request` on `main`
- `workflow_dispatch`
- concurrency with cancellation
- Ubuntu verification job for pnpm checks/builds
- Windows Rust verification job for desktop Rust tests

- [ ] **Step 2: Update `release.yml`**

Include:
- workflow-level concurrency
- new `verify-release` job
- `desktop-release` and `web-release` depend on `verify-release`

- [ ] **Step 3: Add local workflow contract scripts**

Add scripts such as:
- `check:release-flow`
- `check:ci-flow`
- `check:automation`

Update `lint` to execute `check:automation`.

- [ ] **Step 4: Run workflow contract tests and verify they pass**

Run:
- `node scripts/ci-flow-contract.test.mjs`
- `node scripts/release-flow-contract.test.mjs`

Expected: PASS

### Task 4: Verify Packaging and Integration

**Files:**
- Modify if needed based on verification output only

- [ ] **Step 1: Run workspace verification**

Run:
- `pnpm lint`
- `pnpm check:desktop`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- `pnpm build`

Expected: all commands pass

- [ ] **Step 2: Build the local Windows desktop release bundle**

Run: `node scripts/run-desktop-release-build.mjs --phase all --target x86_64-pc-windows-msvc --release`
Expected: local Windows desktop bundle is emitted under `packages/sdkwork-claw-desktop/src-tauri/target/.../release/bundle`

- [ ] **Step 3: Package local release assets**

Run:
- `node scripts/release/package-release-assets.mjs desktop --platform windows --arch x64 --target x86_64-pc-windows-msvc --output-dir artifacts/release`
- `node scripts/release/package-release-assets.mjs web --release-tag release-2026-03-27-4 --output-dir artifacts/release`

Expected: release archives and `.sha256.txt` files are emitted

### Task 5: Commit, Push, and Trigger Release

**Files:**
- None beyond the verified implementation changes

- [ ] **Step 1: Stage and commit the verified changes on `main`**

Commit message recommendation:
`feat: harden mainline release automation`

- [ ] **Step 2: Push `main` to origin**

Run: `git push origin main`
Expected: origin/main updates successfully

- [ ] **Step 3: Create and push the next release tag**

Run:
- `git tag release-2026-03-27-4`
- `git push origin release-2026-03-27-4`

Expected: GitHub Actions release workflow is triggered from the new tag
