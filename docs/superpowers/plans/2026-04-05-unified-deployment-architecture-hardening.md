# Unified Deployment Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `desktop`, `server`, `docker`, and `kubernetes` share truthful instance lifecycle, detail, load, and removal behavior without frontend-only guesswork.

**Architecture:** Move instance action gating onto explicit shared capabilities, then bring the server detail projection up to the same management contract that desktop already exposes. After that, fix degraded workbench fallback so failure paths still preserve deployment truth instead of inventing a generic topology.

**Tech Stack:** Rust host services, TypeScript service layer, React pages, plain Node `--experimental-strip-types` tests, Cargo tests

## Execution Update

Implemented on 2026-04-05:
- Task 1 completed: shared instance action capabilities now gate delete/start/stop/restart actions and hide built-in delete affordances.
- Task 2 completed: instance list rendering is decoupled from per-instance detail failures.
- Task 3 completed: server detail parity now includes truthful endpoint readiness, `consoleAccess`, and parity regression coverage for built-in, local-external, and remote OpenClaw shapes.
- Task 3 follow-up completed: built-in server-hosted OpenClaw now restores console auth truth from the persisted managed `openclaw.json` workbench snapshot, and workbench synchronization no longer overwrites user-edited managed config content.
- Task 4 completed: degraded workbench fallback now preserves runtime/deployment/storage/transport truth from the registry projection.
- Task 4 follow-up completed: registry-backed metadata-only fallback no longer leaks into the overview management summary as writable or partially controllable.
- Task 4 follow-up completed: explicit `config` route semantics now win over `configFile` artifact fallback, preventing metadata-only projections from surfacing as attached writable/managed OpenClaw config files.
- Task 5 completed: host runtime contract coverage now locks parity expectations across desktop and server detail shapes.

Verification completed:
- `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`

---

### Task 1: Extract shared instance action capabilities and remove impossible built-in delete actions

**Files:**
- Create: `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts`
- Create: `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/pages/Instances.tsx`
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

- [ ] **Step 1: Write the failing test**

Add focused capability tests that prove:
- built-in instances cannot be deleted
- lifecycle actions are disabled when detail is missing
- lifecycle actions are enabled only when the detail capability says so

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`
Expected: FAIL because the shared capability helper does not exist yet

- [ ] **Step 3: Write minimal implementation**

Create a small helper that computes:
- `canDelete`
- `canStart`
- `canStop`
- `canRestart`

Use that helper from both `Instances.tsx` and `InstanceDetail.tsx` so built-in delete actions are hidden and action rules stay aligned.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`
Expected: PASS

- [ ] **Step 5: Run package-level regression coverage**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
Expected: PASS

### Task 2: Decouple instances list rendering from per-instance detail failures

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/Instances.tsx`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`

- [ ] **Step 1: Extend the failing test**

Add a case showing that:
- `getInstances()` succeeds
- one `getInstanceDetail()` call fails
- the list still renders all instances with only that one instance falling back to disabled actions

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`
Expected: FAIL because the current list-loading path treats one detail failure as page-wide failure

- [ ] **Step 3: Write minimal implementation**

Replace the current `Promise.all(...)` list capability probe with one of:
- `Promise.allSettled(...)`, or
- per-instance `.catch(() => null)`

Make `setInstances(data)` independent from secondary capability fetches.

- [ ] **Step 4: Re-run the focused test**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run package regression coverage**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
Expected: PASS

### Task 3: Bring server detail projection to parity with the shared hosted architecture

**Files:**
- Modify: `packages/sdkwork-claw-host-studio/src-host/src/lib.rs`
- Reference: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Add failing Rust coverage**

Add server-provider tests proving that remote OpenClaw detail:
- does not mark a null `baseUrl` endpoint as ready
- exposes console/control-plane metadata when it can be derived from the instance projection
- preserves the capability truth already shipped in lifecycle fields

- [ ] **Step 2: Run the Rust test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml remote`
Expected: FAIL because the current detail payload still hardcodes `"status": "ready"` and omits `consoleAccess`

- [ ] **Step 3: Write minimal implementation**

Update the server `instance_detail(...)` projection so it:
- computes connectivity status from actual configured endpoint presence
- emits `consoleAccess` for OpenClaw shapes where the URL can be derived
- stays consistent with the shared UI contract already consumed by `InstanceDetail.tsx` and `instanceManagementPresentation.ts`

- [ ] **Step 4: Re-run the focused Rust test**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml remote`
Expected: PASS

- [ ] **Step 5: Re-run broader server-host verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml`
Expected: PASS

### Task 4: Fix degraded workbench fallback so it preserves registry truth

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

- [ ] **Step 1: Write the failing test**

Add fallback tests proving that when backend detail is absent:
- remote instances keep their real deployment mode
- storage provider and `remote` flags are preserved
- transport kind is not rewritten to `customHttp` unless it is truly unknown

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
Expected: FAIL because the current fallback rewrites the topology into a generic remote/custom HTTP snapshot

- [ ] **Step 3: Write minimal implementation**

Change `buildRegistryBackedDetail(...)` and the fallback path in `getWorkbench(...)` so they copy deployment truth from the registry record instead of inventing a new topology.

- [ ] **Step 4: Re-run the focused test**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run package regression coverage**

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
Expected: PASS

### Task 5: Add explicit cross-mode parity checks

**Files:**
- Modify: `packages/sdkwork-claw-host-studio/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Add parity assertions**

Add assertions that compare shared contract fields across desktop and server for:
- remote OpenClaw
- local-external OpenClaw
- built-in managed OpenClaw

Required parity fields:
- lifecycle capability flags
- connectivity endpoint readiness semantics
- `consoleAccess` presence and shape
- workbench absence for non-managed instances

- [ ] **Step 2: Run the parity tests to verify they fail**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: FAIL until the shared contract is aligned

- [ ] **Step 3: Implement only the missing parity wiring**

Do not expand product scope. Only close the contract gaps needed for the above assertions to pass.

- [ ] **Step 4: Re-run parity coverage**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run the final verification batch**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml`
Expected: PASS

Run: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
Expected: PASS
