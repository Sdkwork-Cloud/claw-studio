# OpenClaw Mirror Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private OpenClaw mirror export and import foundation for the managed desktop runtime, starting with a working `full-private` export slice that produces a portable `.ocmirror` package and exposes it through the shared platform bridge.

**Architecture:** Keep the host apps thin. Define mirror contracts in `@sdkwork/claw-types`, expose them through the kernel platform contract in `@sdkwork/claw-infrastructure`, add a focused core service wrapper in `@sdkwork/claw-core`, and implement native manifest/build logic in the desktop Tauri Rust service layer. The first slice exports a managed OpenClaw runtime snapshot into a mirror container with a verified manifest and enough metadata to support later import, safety snapshot, and market/template flows.

**Tech Stack:** TypeScript, React platform bridge contracts, Tauri desktop bridge, Rust, `serde`, `serde_json`, `tempfile`, existing OpenClaw runtime services.

---

### Task 1: Define mirror contracts and bridge surface with failing tests

**Files:**
- Create: `packages/sdkwork-claw-core/src/services/openClawMirrorService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`

- [ ] **Step 1: Write the failing TypeScript contract tests**

Add tests that expect:
- the kernel platform contract exposes mirror export inspection and execution methods
- the desktop command catalog contains stable mirror command ids
- the Tauri bridge forwards the new mirror methods through desktop commands
- the core service exports a typed mirror service entry point

- [ ] **Step 2: Run the focused bridge tests to verify they fail**

Run: `pnpm --filter @sdkwork/claw-desktop test -- --runInBand src/desktop/tauriBridge.test.ts`
Expected: FAIL because the mirror bridge surface does not exist yet.

- [ ] **Step 3: Add the minimal shared contracts**

Define:
- mirror mode and export scope enums
- mirror manifest record
- managed runtime snapshot record
- export request and export result records

- [ ] **Step 4: Re-run the focused bridge tests**

Run: `pnpm --filter @sdkwork/claw-desktop test -- --runInBand src/desktop/tauriBridge.test.ts`
Expected: PASS with the new contract surface wired end to end in TypeScript.

### Task 2: Add failing native tests for mirror manifest assembly

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Write the failing Rust unit tests**

Add tests that expect:
- a managed OpenClaw runtime snapshot includes state, config, and workspace paths
- the generated mirror manifest records runtime provenance, export mode, and included components
- manifest generation rejects missing managed paths with a stable validation error

- [ ] **Step 2: Run the focused Rust tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_manifest -- --nocapture`
Expected: FAIL because the mirror service and manifest builder do not exist yet.

### Task 3: Implement the minimal native export builder

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Implement the minimal manifest and export builder**

Add:
- a managed-runtime mirror snapshot helper that reuses `OpenClawRuntimeService`
- a manifest builder for `full-private` phase-1 exports
- an export builder that writes a `.ocmirror` zip file with:
  - root `manifest.json`
  - `components/config/openclaw.json`
  - `components/state/**`
  - `components/workspace/**`

- [ ] **Step 2: Re-run the focused Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_manifest -- --nocapture`
Expected: PASS with manifest assembly and export packaging working.

### Task 4: Expose export commands through Tauri and the shared kernel platform

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/openclaw_mirror.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/kernel.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawMirrorService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`

- [ ] **Step 1: Write or extend failing command-wiring tests**

Add assertions that expect:
- Tauri command registration includes the new mirror commands
- the desktop bridge invokes the right command ids
- the shared kernel platform exposes the methods

- [ ] **Step 2: Run the focused bridge tests to verify they fail**

Run: `pnpm --filter @sdkwork/claw-desktop test -- --runInBand src/desktop/tauriBridge.test.ts`
Expected: FAIL until the command wiring is complete.

- [ ] **Step 3: Implement the minimal command wiring**

Expose:
- `kernel.inspectOpenClawMirrorExport()`
- `kernel.exportOpenClawMirror(request)`

Return:
- runtime snapshot and manifest preview for inspection
- final export record including destination path, file size, manifest, and exported component summary

- [ ] **Step 4: Re-run the focused bridge tests**

Run: `pnpm --filter @sdkwork/claw-desktop test -- --runInBand src/desktop/tauriBridge.test.ts`
Expected: PASS with the new export surface reachable from the shared bridge.

### Task 5: Add final verification and document phase boundaries

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [ ] **Step 1: Record the phase-1 delivery boundary**

Update the spec status notes to reflect that this slice ships:
- private managed export
- manifest verification foundations
- no import or market publishing yet

- [ ] **Step 2: Run final verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`
Run: `pnpm --filter @sdkwork/claw-desktop test -- --runInBand src/desktop/tauriBridge.test.ts`
Run: `pnpm lint`
Expected: mirror-focused tests pass. Any unrelated existing workspace failures should be called out separately.
