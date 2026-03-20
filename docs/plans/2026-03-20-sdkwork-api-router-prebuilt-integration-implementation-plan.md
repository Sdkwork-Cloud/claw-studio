# SDKWork API Router Prebuilt Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate `sdkwork-api-router` into Claw Desktop through prebuilt runtime artifacts, shared-config attach-or-start lifecycle management, and a local trusted auth exchange that avoids a second login prompt.

**Architecture:** Keep the router source pinned in `vendor/` for audit and patch management, but move the desktop build to consume target-specific prebuilt router archives as Tauri resources. Add a dedicated desktop runtime service that extracts, verifies, and supervises the bundled binaries while attaching to existing external router instances when they are already healthy on the shared config binds.

**Tech Stack:** Tauri 2, Rust, Node.js scripts, pnpm workspace, bundled resource archives, shared router config under `~/.sdkwork/router`.

---

### Task 1: Add the revised design and implementation documents

**Files:**
- Create: `docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-design.md`
- Create: `docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-implementation-plan.md`

**Step 1: Write the failing test**

No code test for this documentation task.

**Step 2: Run test to verify it fails**

No command for this task.

**Step 3: Write minimal implementation**

Create the revised design and implementation-plan documents that replace the compile-integration approach with the prebuilt-artifact approach.

**Step 4: Run test to verify it passes**

No command for this task.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-design.md docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-implementation-plan.md
git commit -m "docs: revise sdkwork api router integration to prebuilt runtime"
```

### Task 2: Add the router artifact manifest and preparation workflow

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router-artifacts/manifest.json`
- Create: `scripts/prepare-sdkwork-api-router-artifacts.mjs`
- Modify: `packages/sdkwork-claw-desktop/package.json`
- Modify: `package.json`

**Step 1: Write the failing test**

Add a Node-based contract test that expects:

- a manifest file exists
- the manifest declares a pinned router version
- the manifest lists target-specific archives and checksums
- the desktop package exposes an explicit artifact-preparation script

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Expected: FAIL because no router artifact manifest or preparation script exists yet.

**Step 3: Write minimal implementation**

Implement:

- a manifest schema with router version, source ref, archive filenames, checksums, and included binaries
- a script that builds or assembles router artifacts into the vendor artifact directory only when explicitly invoked
- package scripts such as `router:prepare` and `router:verify`

The script must not run implicitly during normal `tauri:build`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`

Expected: PASS for manifest and script presence assertions.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router-artifacts/manifest.json scripts/prepare-sdkwork-api-router-artifacts.mjs packages/sdkwork-claw-desktop/package.json package.json
git commit -m "build: add sdkwork api router artifact preparation flow"
```

### Task 3: Bundle router artifacts as desktop resources without compiling router source

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/build.rs`
- Test: `scripts/check-desktop-platform-foundation.mjs`

**Step 1: Write the failing test**

Add a focused contract test that expects the Tauri config to bundle the router artifact manifest and current-target runtime archive as resources.

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`

Expected: FAIL because the Tauri config does not yet declare router artifact resources.

**Step 3: Write minimal implementation**

Implement:

- resource declarations for the router artifact manifest and archives
- build-time validation that the required artifact for the current target exists
- a hard failure when the artifact is missing, instead of a silent source compile fallback

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`

Expected: PASS for router artifact resource assertions.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json packages/sdkwork-claw-desktop/src-tauri/Cargo.toml packages/sdkwork-claw-desktop/src-tauri/build.rs scripts/check-desktop-platform-foundation.mjs
git commit -m "build: bundle prebuilt sdkwork api router resources"
```

### Task 4: Add a desktop router runtime installer and versioned extraction

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs`

**Step 1: Write the failing test**

Add Rust unit tests for:

- reading the bundled artifact manifest
- resolving the current-target archive
- extracting into a versioned runtime directory with an atomic success marker
- skipping re-extraction when the same version is already installed

**Step 2: Run test to verify it fails**

Run: `cargo test api_router_runtime --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because the runtime installer service does not exist yet.

**Step 3: Write minimal implementation**

Implement a dedicated runtime service that:

- loads the bundled manifest
- validates archive checksums
- extracts into `<machine_runtime_dir>/sdkwork-api-router/versions/<version>`
- creates `current` and `INSTALLATION_OK`
- uses a lock file to serialize extraction

**Step 4: Run test to verify it passes**

Run: `cargo test api_router_runtime --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs
git commit -m "feat: add prebuilt api router runtime installer"
```

### Task 5: Add attach-or-start lifecycle management for shared router config

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs`

**Step 1: Write the failing test**

Add Rust tests that verify:

- Claw attaches when admin and gateway health probes are already healthy
- Claw starts managed binaries only when probes fail and ports are free
- Claw refuses to start when ports are occupied by non-router processes
- Claw records owned process metadata and stops only owned processes

**Step 2: Run test to verify it fails**

Run: `cargo test api_router_attach --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because attach-or-start behavior does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- shared config resolution for `~/.sdkwork/router`
- admin and gateway health probes
- launch of `admin-api-service` and `gateway-service`
- PID plus creation-time ownership tracking
- reverse-order shutdown of owned processes only

**Step 4: Run test to verify it passes**

Run: `cargo test api_router_attach --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: add api router attach or start lifecycle"
```

### Task 6: Patch router auth for trusted Claw exchange and produce compatible artifacts

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router/...`
- Modify: `scripts/prepare-sdkwork-api-router-artifacts.mjs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router-artifacts/manifest.json`
- Test: patched router unit or integration tests inside the vendored router repo

**Step 1: Write the failing test**

Add router-side tests that verify:

- `POST /admin/auth/claw/exchange` accepts a valid signed loopback request
- rejects invalid signature
- rejects expired or replayed requests
- returns a normal admin JWT and user profile on success

**Step 2: Run test to verify it fails**

Run: `cargo test claw_exchange --manifest-path packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router/Cargo.toml`

Expected: FAIL because the auth exchange endpoint does not exist yet.

**Step 3: Write minimal implementation**

Patch the vendored router source to add:

- bridge secret loading from the shared config root
- signed exchange request validation
- loopback-only access enforcement
- mapped admin-user upsert plus native JWT issuance

Refresh the prepared artifacts after the patch is built.

**Step 4: Run test to verify it passes**

Run: `cargo test claw_exchange --manifest-path packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router scripts/prepare-sdkwork-api-router-artifacts.mjs packages/sdkwork-claw-desktop/src-tauri/vendor/sdkwork-api-router-artifacts/manifest.json
git commit -m "feat: add claw trusted auth exchange to vendored router"
```

### Task 7: Add desktop commands and frontend bridge for router runtime and auth session bootstrap

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/api_router_runtime.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`

**Step 1: Write the failing test**

Add contract tests that expect desktop commands for:

- router runtime status
- router logs and config path metadata
- router auth exchange bootstrap

**Step 2: Run test to verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`

Expected: FAIL because those commands are not yet exposed.

**Step 3: Write minimal implementation**

Expose Tauri commands that:

- return router mode and health status
- return the shared config path and managed runtime version
- perform the trusted auth exchange and hand the frontend a router admin JWT session

**Step 4: Run test to verify it passes**

Run: `node scripts/check-desktop-platform-foundation.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/commands/api_router_runtime.rs packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs packages/sdkwork-claw-desktop/src/desktop/catalog.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts
git commit -m "feat: expose api router runtime and auth bridge commands"
```

### Task 8: Replace mock API Router access with router-native clients

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/modelMappingService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx`
- Test: `scripts/sdkwork-apirouter-contract.test.ts`

**Step 1: Write the failing test**

Add a contract test that proves the API Router feature no longer reads from `studioMockService` for its primary data path.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts`

Expected: FAIL because the feature still depends on mock services.

**Step 3: Write minimal implementation**

Implement:

- a real admin API client
- runtime status awareness in the feature package
- deprecation or replacement of mock-only abstractions that do not map to router-native concepts

Do not create a second persistence layer for groups, unified keys, or model mappings if the router does not own them.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.ts packages/sdkwork-claw-apirouter/src/services/modelMappingService.ts packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx scripts/sdkwork-apirouter-contract.test.ts
git commit -m "feat: connect apirouter feature to real router backend"
```

### Task 9: Run full verification without router source rebuild in the normal desktop path

**Files:**
- Modify: any touched files as needed during cleanup

**Step 1: Write the failing test**

No new tests; this is the end-to-end verification pass.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm lint
node scripts/check-desktop-platform-foundation.mjs
node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: any remaining integration gaps surface here.

**Step 3: Write minimal implementation**

Fix the smallest remaining issues until:

- normal desktop verification does not compile router source
- router artifact resources resolve correctly
- lifecycle and auth bridge tests pass

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm lint
node scripts/check-desktop-platform-foundation.mjs
node --experimental-strip-types scripts/sdkwork-apirouter-contract.test.ts
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: all commands pass

**Step 5: Commit**

```bash
git add docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-design.md docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-implementation-plan.md packages/sdkwork-claw-desktop packages/sdkwork-claw-apirouter packages/sdkwork-claw-infrastructure scripts
git commit -m "feat: integrate sdkwork api router through prebuilt runtime artifacts"
```

Plan complete and saved to `docs/plans/2026-03-20-sdkwork-api-router-prebuilt-integration-implementation-plan.md`. The user asked for autonomous iteration, so the next execution session should implement this plan directly instead of revisiting the compile-integration design.
