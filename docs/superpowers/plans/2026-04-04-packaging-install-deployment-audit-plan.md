# Packaging Install Deployment Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden the desktop, server, Docker, and Kubernetes packaging, installation, and deployment paths so the repository’s workflows, scripts, manifests, and documentation describe a real end-to-end release process without broken links.

**Architecture:** Treat release delivery as one shared productization surface with four families: desktop bundles, native server archives, container bundles, and Kubernetes manifests. Audit must trace each family from root npm scripts to reusable workflow jobs, packaging scripts, deployment templates, and install docs, then close gaps with focused fixes and regression checks.

**Tech Stack:** pnpm workspace scripts, GitHub Actions workflows, Rust/Tauri build entrypoints, Node.js release packaging scripts, Docker Compose, Helm chart templates, VitePress docs.

---

### Task 1: Map release and deployment entrypoints

**Files:**
- Modify: `docs/superpowers/plans/2026-04-04-packaging-install-deployment-audit-plan.md`
- Inspect: `package.json`
- Inspect: `.github/workflows/ci.yml`
- Inspect: `.github/workflows/release.yml`
- Inspect: `.github/workflows/release-reusable.yml`
- Inspect: `scripts/run-desktop-release-build.mjs`
- Inspect: `scripts/run-claw-server-build.mjs`
- Inspect: `scripts/release/package-release-assets.mjs`
- Inspect: `deploy/docker/Dockerfile`
- Inspect: `deploy/docker/docker-compose.yml`
- Inspect: `deploy/kubernetes/Chart.yaml`
- Inspect: `deploy/kubernetes/templates/*.yaml`

- [ ] **Step 1: Enumerate packaging and deployment entrypoints**

Run: `rg -n "\"check:desktop\"|\"check:server\"|\"check:release-flow\"|release:package|tauri:build|server:build" package.json .github/workflows scripts/release scripts -g '!**/target/**'`
Expected: Lists the shared audit surface for desktop, server, container, and kubernetes release families.

- [ ] **Step 2: Compare workflow jobs against local scripts**

Run: `Get-Content .github/workflows/release-reusable.yml`
Expected: Each release family calls a concrete local packaging/build script and publishes artifacts.

- [ ] **Step 3: Record missing or suspicious links**

Expected: Produce a short checklist of mismatches such as missing inputs, missing docs coverage, broken relative paths, or family-specific gaps.

### Task 2: Execute packaging and deployment contract checks

**Files:**
- Inspect: `scripts/release-flow-contract.test.mjs`
- Inspect: `scripts/release-deployment-contract.test.mjs`
- Inspect: `scripts/package-release-assets.test.mjs`
- Inspect: `scripts/run-desktop-release-build.test.mjs`
- Inspect: `scripts/run-claw-server-build.test.mjs`
- Inspect: `scripts/run-windows-tauri-bundle.test.mjs`

- [ ] **Step 1: Run release workflow contract checks**

Run: `pnpm check:release-flow`
Expected: Exit code `0`; validates workflow, packaging manifests, and release asset closure.

- [ ] **Step 2: Run CI workflow contract checks**

Run: `pnpm check:ci-flow`
Expected: Exit code `0`; confirms CI still exercises the required families.

- [ ] **Step 3: Run desktop packaging checks**

Run: `pnpm check:desktop`
Expected: Exit code `0`; validates Tauri bundle orchestration, Windows bundle entrypoint, OpenClaw bundling, and desktop packaging contract tests.

- [ ] **Step 4: Run server packaging checks**

Run: `pnpm check:server`
Expected: Exit code `0`; validates server platform foundation and Rust tests.

### Task 3: Verify release asset generation per family

**Files:**
- Inspect: `scripts/release/release-profiles.mjs`
- Inspect: `scripts/release/resolve-release-plan.mjs`
- Inspect: `scripts/release/finalize-release-assets.mjs`
- Inspect: `artifacts/release/` (generated during audit)

- [ ] **Step 1: Resolve the current release matrix**

Run: `pnpm release:plan`
Expected: Emits desktop/server/container/kubernetes matrices and the current artifact naming plan.

- [ ] **Step 2: Generate server release assets locally**

Run: `pnpm release:package:server`
Expected: Produces a server family bundle under `artifacts/release`.

- [ ] **Step 3: Generate container release assets locally**

Run: `pnpm release:package:container`
Expected: Produces Docker deployment assets under `artifacts/release`.

- [ ] **Step 4: Generate kubernetes release assets locally**

Run: `pnpm release:package:kubernetes`
Expected: Produces Helm deployment assets and release values under `artifacts/release`.

- [ ] **Step 5: If the local Windows environment allows it, generate desktop release assets**

Run: `pnpm release:package:desktop`
Expected: Produces desktop release artifacts or reveals the concrete packaging break that must be fixed.

### Task 4: Repair packaging or deployment gaps with targeted regression coverage

**Files:**
- Modify only the specific workflow/script/manifest/doc files implicated by failing verification.
- Test: the matching `scripts/*.test.mjs` or Rust tests tied to the failing family.

- [ ] **Step 1: Reproduce one failing family at a time**

Expected: Capture the exact failing command, file, and mismatch instead of bundling fixes.

- [ ] **Step 2: Add or update the smallest regression check first**

Expected: A contract test, script assertion, manifest assertion, or route/build test fails before implementation.

- [ ] **Step 3: Implement the minimal fix**

Expected: Workflow/script/template/doc change only for the identified root cause.

- [ ] **Step 4: Re-run the failing command**

Expected: The targeted family moves from failing to passing with no unrelated behavior changes.

### Task 5: Regress the full multi-mode audit surface

**Files:**
- Inspect: `docs/guide/install-and-deploy.md`
- Inspect: `docs/zh-CN/guide/install-and-deploy.md`
- Inspect: `docs/reference/claw-server-runtime.md`
- Inspect: `docs/zh-CN/reference/claw-server-runtime.md`

- [ ] **Step 1: Re-run all targeted verification commands after fixes**

Run: `pnpm check:release-flow && pnpm check:ci-flow && pnpm check:desktop && pnpm check:server`
Expected: Exit code `0`.

- [ ] **Step 2: Re-check generated release assets**

Run: `Get-ChildItem -Recurse artifacts/release | Select-Object FullName`
Expected: Desktop/server/container/kubernetes asset directories and manifests exist for the families exercised locally.

- [ ] **Step 3: Reconcile docs with the final verified behavior**

Expected: English and Chinese install/deploy docs reference the actual release families, service management semantics, and deployment entrypoints.

- [ ] **Step 4: Summarize remaining environment-bound risks**

Expected: Explicitly call out anything not fully runnable on the current machine, such as non-Windows desktop bundle variants or live cluster deployment smoke tests.
