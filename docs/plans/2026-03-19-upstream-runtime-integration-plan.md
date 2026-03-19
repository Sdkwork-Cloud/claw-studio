# Upstream Runtime Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a desktop-first, API Router-centered integration stack for OpenClaw, ZeroClaw, IronClaw, and Codex while preserving backward compatibility with older local installs.

**Architecture:** Keep the Tauri Rust host as the parent installer and supervisor, embed SDKWork API Router as the local control plane, and integrate each upstream through its strongest supported boundary: managed Node process for OpenClaw, native Rust runtime for ZeroClaw and IronClaw, and JSON-RPC app-server for Codex. Preserve old registry names as compatibility aliases and record install provenance so upgrades and migrations stay safe.

**Tech Stack:** Tauri 2, Rust, Hub Installer manifests, pnpm workspace packages, VitePress docs, JSON-RPC over stdio, OpenAI-compatible loopback routing.

---

### Task 1: Replace remaining mock-only API Router wiring

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`
- Test: `scripts/sdkwork-install-contract.test.ts`

**Step 1: Write the failing integration test**

Add a focused test that proves the frontend service no longer calls `studioMockService` for provider CRUD and usage queries.

**Step 2: Run test to verify it fails**

Run: `pnpm tsx scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because `apiRouterService.ts` still resolves data from `studioMockService`.

**Step 3: Write minimal implementation**

- Replace mock reads and writes with calls to the Tauri bridge or platform service abstraction.
- Keep all imports at package roots only.
- Preserve current type contracts from `@sdkwork/claw-types`.

**Step 4: Run test to verify it passes**

Run: `pnpm tsx scripts/sdkwork-install-contract.test.ts`
Expected: PASS for the new API Router integration assertions.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs scripts/sdkwork-install-contract.test.ts
git commit -m "feat: wire apirouter package to real desktop backend"
```

### Task 2: Replace mock-only extension catalog wiring

**Files:**
- Modify: `packages/sdkwork-claw-extensions/src/services/extensionService.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Test: `scripts/check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**

Add a focused check that extension list, install, and uninstall calls resolve through a real platform service instead of in-memory mock seeds.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the extension package still serves static mock data.

**Step 3: Write minimal implementation**

- Replace `MOCK_EXTENSIONS` reads with desktop runtime queries.
- Keep pagination and localized descriptions in the feature package.
- Move runtime-specific logic into infrastructure or Tauri commands instead of the feature package.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for extension backend integration expectations.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-extensions/src/services/extensionService.ts packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs scripts/check-desktop-platform-foundation.mjs
git commit -m "feat: wire extension feature to real desktop runtime"
```

### Task 3: Add Codex app-server supervision and protocol bridge

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/runtime.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/codex_app_server.rs`
- Test: `scripts/check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**

Add a test that expects the desktop runtime to start a supervised Codex process in `app-server` mode and exchange a minimal `initialize` request over stdio.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because no Codex app-server bridge exists yet.

**Step 3: Write minimal implementation**

- Spawn `codex app-server --listen stdio://`.
- Send `initialize` and `initialized`.
- Stream JSON-RPC notifications into typed desktop events.
- Record install provenance and executable resolution separately from session state.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for minimal Codex handshake coverage.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/codex_app_server.rs scripts/check-desktop-platform-foundation.mjs
git commit -m "feat: add codex app-server supervision bridge"
```

### Task 4: Add managed OpenClaw runtime supervision

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml`
- Test: `scripts/sdkwork-install-contract.test.ts`

**Step 1: Write the failing test**

Add a test that expects OpenClaw install provenance, process status, and health metadata to be recorded after a managed install path is selected.

**Step 2: Run test to verify it fails**

Run: `pnpm tsx scripts/sdkwork-install-contract.test.ts`
Expected: FAIL because OpenClaw install and process supervision are still separate concerns.

**Step 3: Write minimal implementation**

- Persist OpenClaw install provenance.
- Start and stop the OpenClaw process through the desktop supervisor.
- Surface logs, health, and upgrade eligibility through the runtime state model.

**Step 4: Run test to verify it passes**

Run: `pnpm tsx scripts/sdkwork-install-contract.test.ts`
Expected: PASS for managed OpenClaw lifecycle coverage.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml scripts/sdkwork-install-contract.test.ts
git commit -m "feat: supervise managed openclaw runtime"
```

### Task 5: Add runtime inventory, compatibility metadata, and rollback support

**Files:**
- Create: `packages/sdkwork-claw-core/src/services/runtimeInventoryService.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Test: `scripts/check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**

Add a test that expects every managed runtime to report install provenance, pinned upstream ref, compatibility channel, and rollback target.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: FAIL because the runtime inventory model does not exist yet.

**Step 3: Write minimal implementation**

- Add shared runtime inventory types.
- Persist install provenance and rollback metadata in the desktop kernel or state layer.
- Keep UI consumption in feature packages.

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS for runtime inventory assertions.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-core/src/services/runtimeInventoryService.ts packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs scripts/check-desktop-platform-foundation.mjs
git commit -m "feat: add runtime inventory and rollback metadata"
```

### Task 6: Add upstream sync and compatibility verification workflow

**Files:**
- Create: `scripts/sync-upstream-runtime-matrix.mjs`
- Modify: `docs/reference/upstream-integration.md`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml`
- Test: `pnpm docs:build`

**Step 1: Write the failing test**

Add a focused check that the sync script emits a compatibility matrix for OpenClaw, ZeroClaw, IronClaw, Codex, and API Router.

**Step 2: Run test to verify it fails**

Run: `pnpm docs:build`
Expected: FAIL or missing output because the sync workflow and published reference do not exist yet.

**Step 3: Write minimal implementation**

- Add a script that captures pinned upstream refs and install strategy metadata.
- Keep the published reference doc aligned with the generated matrix.
- Update the bundled registry only after compatibility verification succeeds.

**Step 4: Run test to verify it passes**

Run: `pnpm docs:build`
Expected: PASS with the new documentation and sync metadata in place.

**Step 5: Commit**

```bash
git add scripts/sync-upstream-runtime-matrix.mjs docs/reference/upstream-integration.md packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml
git commit -m "feat: add upstream runtime sync and compatibility workflow"
```

## Verification Checklist

- `pnpm docs:build`
- `pnpm tsx scripts/sdkwork-install-contract.test.ts`
- `node scripts/check-desktop-platform-foundation.mjs`
- `pnpm lint`

## Rollout Order

1. Real API Router backend
2. Real extension backend
3. Codex app-server bridge
4. Managed OpenClaw supervision
5. Runtime inventory and rollback
6. Automated upstream sync
