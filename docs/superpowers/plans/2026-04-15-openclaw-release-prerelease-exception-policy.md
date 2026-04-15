# OpenClaw Release Prerelease Exception Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repeated non-blocking supplemental-package warning with an explicit, auditable prerelease exception policy so release verification stays green only when unstable runtime dependencies are intentionally approved.

**Architecture:** Keep `runtimeSupplementalPackages` as the installation source of truth, but add a sibling exception list for prerelease or `<1.0.0` specs. Centralize validation in the shared OpenClaw release metadata loaders used by both `scripts/` and `@sdkwork/claw-types`, so every consumer sees the same governance behavior and new unstable packages fail fast unless explicitly approved.

**Tech Stack:** Node.js ESM scripts, TypeScript runtime metadata module, JSON configuration, existing parity/contract tests.

---

### Task 1: Freeze the Desired Governance Contract in Tests

**Files:**
- Modify: `scripts/openclaw-release-contract.test.mjs`
- Test: `scripts/openclaw-release-contract.test.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions that the shared release config contains:
- `runtimeSupplementalPackageExceptions`
- an approved exception entry for `@buape/carbon@0.0.0-beta-20260327000044`

Add source assertions that:
- `scripts/openclaw-release.mjs` validates prerelease supplemental packages against exceptions
- `packages/sdkwork-claw-types/src/openclawRelease.ts` mirrors the same validation shape

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/openclaw-release-contract.test.mjs`
Expected: FAIL because the config and loaders do not yet expose the prerelease exception policy.

- [ ] **Step 3: Write minimal implementation**

Add the config field and wire shared validation helpers in both release metadata loaders.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/openclaw-release-contract.test.mjs`
Expected: PASS

### Task 2: Replace Repeated Warning Noise with Explicit Validation

**Files:**
- Modify: `config/openclaw-release.json`
- Modify: `scripts/openclaw-release.mjs`
- Modify: `packages/sdkwork-claw-types/src/openclawRelease.ts`
- Test: `scripts/openclaw-release-contract.test.mjs`

- [ ] **Step 1: Add explicit prerelease exception metadata**

Define a normalized exception entry shape containing:
- `spec`
- `reason`
- `reviewedAt`

- [ ] **Step 2: Implement shared validation rules**

Validation rules:
- unstable supplemental packages are detected consistently
- approved unstable specs are accepted without runtime warning spam
- unapproved unstable specs throw immediately with a clear error
- orphaned exceptions that do not match any configured supplemental package also throw

- [ ] **Step 3: Keep the exported runtime API backward compatible**

Preserve:
- `OPENCLAW_RELEASE.runtimeSupplementalPackages`
- `DEFAULT_*_RUNTIME_SUPPLEMENTAL_PACKAGES`

Optionally expose:
- `runtimeSupplementalPackageExceptions`

- [ ] **Step 4: Re-run the focused contract**

Run: `node scripts/openclaw-release-contract.test.mjs`
Expected: PASS with no generic unstable supplemental package warning.

### Task 3: Prove the Policy Holds in Product Verification Paths

**Files:**
- Modify: `scripts/openclaw-upgrade-readiness.test.mjs` if needed for config fixtures
- Modify: any additional fixtures touched by release config parsing
- Test: `scripts/openclaw-upgrade-readiness.test.mjs`
- Test: `pnpm.cmd check:desktop-openclaw-runtime`

- [ ] **Step 1: Update any config fixtures that now require approved exceptions**

Bring temporary release-config fixtures in line with the new governance contract.

- [ ] **Step 2: Run focused runtime verification**

Run: `node scripts/openclaw-upgrade-readiness.test.mjs`
Expected: PASS

- [ ] **Step 3: Run broader release/runtime verification**

Run: `pnpm.cmd check:desktop-openclaw-runtime`
Expected: PASS

### Task 4: Full Regression and Delivery Validation

**Files:**
- Verify only

- [ ] **Step 1: Run architecture and parity verification**

Run: `pnpm.cmd lint`
Expected: PASS

- [ ] **Step 2: Run multi-mode verification**

Run: `pnpm.cmd check:multi-mode`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `pnpm.cmd build`
Expected: PASS

- [ ] **Step 4: Summarize the commercial-grade outcome**

Document:
- root cause
- implemented policy
- evidence that warning noise is eliminated or reduced to approved governance semantics
- residual risks that still need separate hardening passes
