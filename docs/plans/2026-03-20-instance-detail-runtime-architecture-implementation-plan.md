# Instance Detail Runtime Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Tauri-backed instance detail snapshot so the instance workbench can render real runtime overview, connectivity, storage, observability, and capability state for OpenClaw, ZeroClaw, IronClaw, and future runtimes.

**Architecture:** Extend the shared studio contract with a new instance detail snapshot, implement snapshot assembly in the Tauri `studio` service, expose it through desktop and web platform bridges, then map the feature-layer workbench to this backend-authored detail model. Preserve the existing workbench UI where it is already valuable, but add a real `overview` section and capability-aware degradation states.

**Tech Stack:** TypeScript, React, Rust, Tauri 2, serde, existing studio/storage services, existing instance workbench feature package.

---

### Task 1: Lock the shared instance detail contract

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`

**Step 1: Write the failing test**

- Add a contract assertion to `scripts/sdkwork-instances-contract.test.ts` that expects the instance workbench service to depend on a studio-backed detail method instead of only mock runtime data.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because no shared instance detail contract exists yet.

**Step 3: Write minimal implementation**

- Add shared types for:
  - `StudioInstanceDetailRecord`
  - `StudioInstanceHealthSnapshot`
  - `StudioInstanceConnectivityEndpoint`
  - `StudioInstanceCapabilitySnapshot`
  - `StudioInstanceStorageSnapshot`
  - `StudioInstanceObservabilitySnapshot`
  - `StudioInstanceLifecycleSnapshot`
- Extend the studio platform contract with `getInstanceDetail`.

**Step 4: Run test to verify it passes**

Run: `pnpm lint`

Expected: PASS for shared contract exports.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts packages/sdkwork-claw-infrastructure/src/platform/index.ts scripts/sdkwork-instances-contract.test.ts
git commit -m "feat: add shared studio instance detail contract"
```

### Task 2: Add Tauri instance detail snapshot assembly

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

**Step 1: Write the failing test**

Add Rust unit tests for:

- built-in OpenClaw detail exposes gateway ws, base HTTP, and OpenAI chat endpoint metadata
- remote ZeroClaw detail exposes external lifecycle and configured storage readiness
- remote IronClaw detail exposes PostgreSQL-oriented storage and web-gateway capability posture

**Step 2: Run test to verify it fails**

Run: `cargo test studio --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because `get_instance_detail` does not exist yet.

**Step 3: Write minimal implementation**

- Add new snapshot structs in Rust.
- Implement `StudioService::get_instance_detail`.
- Derive:
  - health score and checks
  - connectivity endpoints
  - lifecycle owner
  - storage readiness summary
  - observability summary
  - capability status matrix
  - official runtime notes by runtime kind
- Expose `studio_get_instance_detail` as a Tauri command.

**Step 4: Run test to verify it passes**

Run: `cargo test studio --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: add tauri instance detail snapshot service"
```

### Task 3: Expose detail snapshot through desktop and web platform bridges

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`

**Step 1: Write the failing test**

Use TypeScript build coverage and the contract test to force the platform surface to expose `getInstanceDetail`.

**Step 2: Run test to verify it fails**

Run: `pnpm lint`

Expected: FAIL because bridge implementations do not yet satisfy the new contract.

**Step 3: Write minimal implementation**

- Add the new desktop command constant.
- Add desktop invoke wrappers.
- Add a web fallback that derives a lightweight detail snapshot from the local storage-backed instance record.

**Step 4: Run test to verify it passes**

Run: `pnpm lint`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src/desktop/catalog.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts
git commit -m "feat: expose instance detail snapshot through studio platform"
```

### Task 4: Refactor the feature-layer workbench service to consume the backend detail snapshot

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceService.ts`

**Step 1: Write the failing test**

- Extend `scripts/sdkwork-instances-contract.test.ts` to assert that the workbench service uses `getInstanceDetail`.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because the workbench service still depends on mock-only top-level aggregation.

**Step 3: Write minimal implementation**

- Add feature-layer types for overview/capability/status rendering.
- Fetch `studio.getInstanceDetail` first.
- Map overview, connectivity, storage, observability, and capability state from backend data.
- Keep task/channel/file/provider/memory/tool fallback behavior only for sections not yet migrated.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-instances/src/types/index.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts packages/sdkwork-claw-instances/src/services/instanceService.ts scripts/sdkwork-instances-contract.test.ts
git commit -m "feat: back instance workbench overview with studio detail snapshot"
```

### Task 5: Add the overview section and capability-aware rendering to `InstanceDetail`

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Write the failing test**

- Extend the contract test to require an `overview` section and capability-aware rendering markers.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: FAIL because the page does not render the new overview surface yet.

**Step 3: Write minimal implementation**

- Add `overview` to the sidebar.
- Render:
  - runtime/deployment/transport chips
  - lifecycle owner
  - connectivity endpoint cards
  - storage summary
  - health checks
  - capability matrix
  - observability summary and log preview
- Add per-section degradation notices when a capability is unsupported or not configured.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx packages/sdkwork-claw-i18n/src/locales/en.json packages/sdkwork-claw-i18n/src/locales/zh.json scripts/sdkwork-instances-contract.test.ts
git commit -m "feat: add runtime overview to instance detail"
```

### Task 6: Verify the vertical slice

**Files:**
- No code changes required unless a verification failure appears

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

**Step 5: Record manual verification**

Verify:

- built-in OpenClaw detail shows loopback WS and OpenAI HTTP endpoint data
- remote ZeroClaw detail shows external lifecycle and gateway/dashboard endpoint summary
- remote IronClaw detail shows PostgreSQL-oriented storage requirements and web-gateway posture
- unsupported sections clearly explain why data is absent

## Execution Mode

The user explicitly requested autonomous execution, so this plan should be executed directly in the current session.
