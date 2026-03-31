# Claw Studio Release Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a fully green `main` CI pipeline, publish a fresh `release-*` tag, and drive the GitHub multi-platform release matrix to a successful published release.

**Architecture:** Treat CI and release as separate gates. First instrument and fix the smallest failing layer on `main` until Ubuntu workspace verification is green, then trigger the tagged release workflow and iterate only on release-specific failures. All completion claims require fresh local verification and remote GitHub workflow evidence.

**Tech Stack:** GitHub Actions, pnpm workspace, Vite, Tauri, Rust, PowerShell, bash

---

### Task 1: Capture current release-recovery state

**Files:**
- Create: `docs/superpowers/plans/2026-03-31-release-recovery.md`
- Modify: `.github/workflows/ci.yml`
- Inspect: `.github/workflows/release.yml`

- [ ] **Step 1: Record the current branch, worktree status, and recent commits**

Run: `git status --short && git branch --show-current && git log --oneline -5`
Expected: `main` checked out, current workflow diff visible, recent recovery commit listed.

- [ ] **Step 2: Persist the execution plan**

Write this plan file and keep subsequent work aligned with the CI-first then release-second sequence.

- [ ] **Step 3: Review current CI and release workflows**

Inspect `.github/workflows/ci.yml` and `.github/workflows/release.yml` to confirm where diagnostics and release gates belong before making additional edits.

### Task 2: Surface the actual Linux CI failure

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Wrap the failing Rust test step with log capture**

Ensure the Ubuntu `cargo test` step writes `cargo-test.log`, prints the tail on failure, and emits a GitHub Actions error annotation that includes the final failure context.

- [ ] **Step 2: Keep Windows coverage equivalent**

Apply the same log-capture pattern to the Windows Rust test step so future failures are equally diagnosable.

- [ ] **Step 3: Commit only the diagnostic change**

Run:
```bash
git add .github/workflows/ci.yml docs/superpowers/plans/2026-03-31-release-recovery.md
git commit -m "ci: surface desktop rust test failures"
git push origin main
```
Expected: a new `main` CI run starts for the pushed commit.

### Task 3: Identify and fix the root cause

**Files:**
- Modify: exact files depend on the observed failing Linux Rust/build error
- Verify: `packages/sdkwork-claw-desktop/src-tauri/**`, `scripts/**`, workflow files only if needed

- [ ] **Step 1: Read the new GitHub Actions run annotations and failing job metadata**

Use the GitHub API for the latest `main` run and inspect the failing job annotations until the concrete error message is available.

- [ ] **Step 2: Reproduce or narrow locally**

Run the smallest local command that matches the remote failure, for example:
`cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
or the failing package/script only.

- [ ] **Step 3: Make the minimal root-cause fix**

Change only the component proven to be responsible by the evidence trail.

- [ ] **Step 4: Verify locally before pushing**

Run the exact relevant verification commands plus any broader release gate that the change affects.

- [ ] **Step 5: Commit and push the fix**

Use a focused Conventional Commit message and push to `main`, then wait for the next CI run.

### Task 4: Drive main CI to green

**Files:**
- Modify: only files required by each identified failure

- [ ] **Step 1: Repeat the diagnose/fix/verify loop**

Do not create a release tag until the full `main` CI workflow is green.

- [ ] **Step 2: Confirm the exact passing run**

Capture the successful run id, commit SHA, and key job conclusions as the release baseline.

### Task 5: Publish and verify the tagged release

**Files:**
- Modify: release-related files only if a tagged workflow exposes a release-specific defect
- Inspect: `.github/workflows/release.yml`, `scripts/release/**`, `packages/sdkwork-claw-desktop/src-tauri/**`

- [ ] **Step 1: Create a fresh release tag from the green main commit**

Run:
```bash
git tag release-2026-03-31-01
git push origin release-2026-03-31-01
```
Expected: the GitHub `release` workflow starts from that tag.

- [ ] **Step 2: Monitor the full release matrix**

Track:
- Windows x64
- Windows arm64
- Linux x64
- Linux arm64
- macOS x64
- macOS arm64
- Web/docs packaging
- Publish job

- [ ] **Step 3: Fix any release-only failures**

If a matrix job fails, gather the exact error, reproduce the narrowest failing path locally where possible, patch the root cause, verify, push to `main`, and create a new `release-*` tag.

- [ ] **Step 4: Confirm published assets**

Do not stop at green build jobs; verify the `publish` job succeeded and that the release contains desktop and web assets for every intended platform.
