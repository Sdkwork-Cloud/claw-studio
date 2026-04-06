# Tauri Job Process Orchestration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real native job-to-process orchestration flow with static command profiles, active-process cancellation, and runtime bridge exposure.

**Architecture:** Keep the current `commands -> framework services` layering and stable event names. Introduce a profile-backed orchestration path under the Rust desktop kernel, extend job records and process events with correlation identifiers, and expose the new workflow through the runtime bridge without importing Tauri APIs into business/page layers.

**Tech Stack:** Tauri v2, Rust 2021, TypeScript workspace packages, cargo unit tests, tsc lint

---

### Task 1: Define orchestration behavior with failing Rust tests

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\jobs.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\process.rs`

**Step 1: Write the failing test**
- Add tests for:
  - a submitted process job transitions from `queued` to `running` to `succeeded`
  - a cancelled process job ends as `cancelled`
  - process job records retain `profile_id` and `process_id`
  - process output events retain `job_id`
  - unknown profile ids are rejected

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
Expected: FAIL because orchestration APIs, profiles, and active cancellation do not exist yet.

**Step 3: Write minimal implementation**
- Add static process profiles.
- Add active process registry and cancellation support.
- Add orchestration flow that binds job lifecycle to process execution.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
Expected: PASS with orchestration and cancellation behavior.

**Step 5: Commit**

```bash
git add packages/claw-studio-desktop/src-tauri/src/framework/services/jobs.rs packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs packages/claw-studio-desktop/src-tauri/src/commands/job_commands.rs packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: orchestrate desktop jobs through process profiles"
```

### Task 2: Extend runtime bridge contracts for orchestration

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\contracts\runtime.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\webRuntime.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-infrastructure\src\platform\index.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-business\src\services\runtimeService.ts`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src\desktop\tauriBridge.ts`

**Step 1: Write the failing test**
- Add type-level or compile-time coverage by extending runtime contracts so the new methods and payload fields must exist.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd --filter @sdkwork/claw-studio-desktop lint`
Expected: FAIL because the bridge and contracts do not yet match.

**Step 3: Write minimal implementation**
- Add runtime API methods for:
  - `submitProcessJob`
  - `getJob`
  - `listJobs`
  - `cancelJob`
- Extend event record types with correlation fields.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd --filter @sdkwork/claw-studio-desktop lint`
Expected: PASS with updated contracts and bridge exposure.

**Step 5: Commit**

```bash
git add packages/claw-studio-infrastructure/src/platform/contracts/runtime.ts packages/claw-studio-infrastructure/src/platform/webRuntime.ts packages/claw-studio-infrastructure/src/platform/index.ts packages/claw-studio-business/src/services/runtimeService.ts packages/claw-studio-desktop/src/desktop/tauriBridge.ts
git commit -m "feat: expose orchestrated runtime job commands"
```

### Task 3: Verify the orchestration slice end to end

**Files:**
- Verify only

**Step 1: Run Rust tests**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 2: Run architecture checks**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 3: Run TypeScript verification**

Run: `pnpm.cmd --filter @sdkwork/claw-studio-desktop lint`
Expected: PASS
