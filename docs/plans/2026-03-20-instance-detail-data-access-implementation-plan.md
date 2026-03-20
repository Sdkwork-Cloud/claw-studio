# Instance Detail Data Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the instance detail vertical slice with backend-authored data access and artifact snapshots so Claw Studio can explain how each runtime is linked, how data is read, and which local/remote resources are authoritative.

**Architecture:** Expand the shared studio detail contract with `dataAccess` and `artifacts`, implement the snapshot assembly in the Tauri `studio` service, surface it through desktop and web bridges, and enrich the `InstanceDetail` overview plus section degradation messaging using those backend-authored surfaces.

**Tech Stack:** TypeScript, React, Rust, Tauri 2, serde, existing studio/storage/path services.

---

### Task 1: Lock the new detail contract

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`

**Step 1: Write the failing test**

- Extend `scripts/sdkwork-instances-contract.test.ts` to require `data-slot` markers for the new overview surfaces and references to `detail.dataAccess` plus `detail.artifacts`.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because the new contract shape is not consumed yet.

**Step 3: Write minimal implementation**

- Add shared types for:
  - `StudioInstanceDataAccessSnapshot`
  - `StudioInstanceDataAccessEntry`
  - `StudioInstanceArtifactRecord`
- Extend `StudioInstanceDetailRecord` with `dataAccess` and `artifacts`.
- Update the web fallback builder to produce the same shape.

**Step 4: Run test to verify it passes**

Run: `pnpm lint`

Expected: PASS for shared contract exports.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts scripts/sdkwork-instances-contract.test.ts
git commit -m "feat: add studio instance data access detail contract"
```

### Task 2: Add Tauri-backed data access and artifact snapshots

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

**Step 1: Write the failing test**

Add Rust tests that assert:

- built-in OpenClaw exposes config/log/workspace artifacts plus managed local data access routes
- remote ZeroClaw exposes gateway/dashboard artifacts plus remote endpoint or metadata-only access routes
- remote IronClaw exposes PostgreSQL storage artifacts and storage-backed memory access posture

**Step 2: Run test to verify it fails**

Run: `cargo test studio --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because the new snapshot fields and builders do not exist yet.

**Step 3: Write minimal implementation**

- Add new Rust detail structs and enums.
- Build `data_access` and `artifacts` from:
  - instance deployment mode
  - runtime kind
  - configured endpoints
  - storage binding
  - managed path layout
- Keep the rules runtime-neutral and deployment-aware.

**Step 4: Run test to verify it passes**

Run: `cargo test studio --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs
git commit -m "feat: add tauri instance data access and artifact snapshots"
```

### Task 3: Map the new backend truth into the feature workbench

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`

**Step 1: Write the failing test**

- Extend `scripts/sdkwork-instances-contract.test.ts` to assert that the workbench service and detail page reference the new backend-authored data access and artifact surfaces.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because the feature layer does not yet consume the new snapshot data.

**Step 3: Write minimal implementation**

- Pass `dataAccess` and `artifacts` through the workbench snapshot.
- Improve section availability details using backend-authored access route truth where helpful.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-instances/src/types/index.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts scripts/sdkwork-instances-contract.test.ts
git commit -m "feat: map instance data access truth into workbench"
```

### Task 4: Upgrade the overview UX and i18n

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Extend `scripts/sdkwork-instances-contract.test.ts` to require:
  - `data-slot="instance-detail-data-access"`
  - `data-slot="instance-detail-artifacts"`
  - rendering paths that read from `detail.dataAccess` and `detail.artifacts`

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because the overview does not yet render the new surfaces.

**Step 3: Write minimal implementation**

- Add overview cards/lists for `Data Access` and `Artifacts`.
- Show:
  - scope
  - route mode
  - status
  - authority
  - mutability
  - concrete path/URL/storage location
- Add smarter degradation copy where a runtime is metadata-only or planned.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx packages/sdkwork-claw-i18n/src/locales/en.json packages/sdkwork-claw-i18n/src/locales/zh.json scripts/sdkwork-instances-contract.test.ts
git commit -m "feat: expose instance data access and artifact detail overview"
```

### Task 5: Verify the full slice

**Files:**
- No code changes required unless verification surfaces an issue

**Step 1: Run Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS.

**Step 2: Run instance contract**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS.

**Step 3: Run workspace lint**

Run: `pnpm lint`

Expected: PASS.

**Step 4: Run production build**

Run: `pnpm build`

Expected: PASS.

**Step 5: Manual review checklist**

Verify:

- built-in OpenClaw shows concrete managed config/log/workspace artifacts
- ZeroClaw detail explains gateway/dashboard and remote metadata boundaries
- IronClaw detail highlights PostgreSQL-backed storage truth
- the UI clearly distinguishes authoritative access from planned integration

## Execution Mode

The user explicitly requested autonomous execution, so this plan should be executed directly in the current session.
