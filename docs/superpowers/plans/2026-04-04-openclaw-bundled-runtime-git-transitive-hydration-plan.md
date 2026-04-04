# OpenClaw Bundled Runtime Git-Transitive Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bundled OpenClaw runtime preparation deterministic and complete even when a bundled plugin runtime dependency pulls a Git-hosted transitive dependency such as `@whiskeysockets/baileys -> libsignal`.

**Architecture:** Keep the existing fast path for normal registry installs. Add a narrow fallback hydrator in `prepare-openclaw-runtime.mjs` that detects known Git-transitive bundled runtime dependencies, stages them from their published registry tarballs, hydrates Git-hosted transitive packages with a direct clone/extract flow, and then reuses the existing validation path.

**Tech Stack:** Node.js ESM build scripts, npm package metadata, git, existing OpenClaw runtime preparation tests.

---

### Task 1: Lock The Reproduction In Tests

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage for:
- a bundled plugin runtime dependency that must be hydrated from a registry tarball
- a Git-hosted transitive dependency that must be cloned/staged without delegating to npm's Git resolution
- expected install target paths for both the direct dependency and its nested Git dependency

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node scripts/prepare-openclaw-runtime.test.mjs`

Expected: failure because the helper/hydration path does not exist yet.

### Task 2: Implement Targeted Hydration Fallback

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.mjs`

- [ ] **Step 1: Add minimal package metadata helpers**

Add helpers to:
- normalize package names and install destinations
- fetch/inspect registry tarball metadata for an exact package version
- extract a tarball into a destination package directory
- read dependency metadata from a staged package

- [ ] **Step 2: Add the Git-transitive fallback for known bundled deps**

Implement a narrow fallback for the `@whiskeysockets/baileys` chain:
- stage `@whiskeysockets/baileys@7.0.0-rc.9` from the registry tarball
- stage `libsignal` from `https://github.com/whiskeysockets/libsignal-node.git`
- hydrate `libsignal` into the dependency location expected by Baileys
- install or stage the remaining registry-only Baileys dependencies with the existing installer path

- [ ] **Step 3: Integrate fallback into bundled plugin runtime installation**

Only invoke the fallback when:
- normal bundled plugin runtime installation fails
- the missing spec matches a known Git-transitive bundled runtime dependency

Keep the existing fast path unchanged for all other dependencies.

### Task 3: Re-validate The Prepared Runtime Tree

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.mjs`
- Modify: `scripts/prepare-openclaw-runtime.test.mjs`

- [ ] **Step 1: Ensure validation covers the hydrated result**

Confirm validation succeeds when:
- the direct dependency exists
- the nested Git dependency exists
- supplemental packages such as `@buape/carbon` still pass validation

- [ ] **Step 2: Keep failure reporting explicit**

If hydration still cannot produce a valid tree, surface which direct dependency or nested Git dependency is missing so runtime drift remains diagnosable.

### Task 4: Verify Without Launching Desktop

**Files:**
- Modify: `scripts/prepare-openclaw-runtime.mjs` if needed

- [ ] **Step 1: Run the script tests**

Run:
- `node scripts/prepare-openclaw-runtime.test.mjs`
- `node scripts/openclaw-release-contract.test.mjs`
- `node scripts/sync-bundled-components.test.mjs`

Expected: all pass.

- [ ] **Step 2: Inspect staged/cache evidence**

Verify from the prepared cache or regenerated resource tree that:
- `openclaw` package version is `2026.4.2`
- `@buape/carbon` exists
- `@whiskeysockets/baileys` exists
- `libsignal` exists at the location expected by Baileys
