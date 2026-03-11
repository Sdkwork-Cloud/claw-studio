# Tauri Execution Policy Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden desktop process execution so working directories and child-process environments are validated against managed runtime policy.

**Architecture:** Keep the existing `app -> commands -> framework` direction and stable Tauri command names. Strengthen `framework/policy.rs`, bind validation to `AppPaths`, and make `ProcessService` execute only normalized requests with managed roots and sanitized environments.

**Tech Stack:** Tauri v2, Rust 2021, cargo unit tests, existing desktop foundation scripts

---

### Task 1: Define the execution policy behavior with failing tests

**Files:**
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\policy.rs`
- Modify: `D:\sdkwork-opensource\claw-studio\packages\claw-studio-desktop\src-tauri\src\framework\services\process.rs`

**Step 1: Write the failing test**
- Add policy tests for:
  - resolving a managed working directory
  - rejecting an unmanaged working directory
  - canonicalizing a nested managed directory
- Add process service tests for:
  - defaulting `cwd` to `paths.data_dir`
  - sanitizing child environment variables to the allow-list

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::policy framework::services::process`
Expected: FAIL because the policy model and sanitized environment behavior do not exist yet.

**Step 3: Write minimal implementation**
- Introduce a context-bound working-directory resolver in `policy.rs`.
- Add a validated request flow in `process.rs`.
- Add an environment allow-list helper that returns sanitized environment pairs.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::policy framework::services::process`
Expected: PASS with managed-root enforcement and sanitized environment behavior.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-11-tauri-execution-policy-hardening-design.md docs/plans/2026-03-11-tauri-execution-policy-hardening.md packages/claw-studio-desktop/src-tauri/src/framework/policy.rs packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs packages/claw-studio-desktop/src-tauri/src/framework/context.rs packages/claw-studio-desktop/src-tauri/src/framework/services/mod.rs
git commit -m "feat: harden desktop execution policy"
```

### Task 2: Verify the hardened desktop execution boundary

**Files:**
- Verify only

**Step 1: Run targeted Rust verification**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml framework::policy framework::services::process`
Expected: PASS

**Step 2: Run full desktop Rust tests**

Run: `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 3: Run architecture checks**

Run: `node scripts/check-desktop-platform-foundation.mjs`
Expected: PASS

Run: `node scripts/check-arch-boundaries.mjs`
Expected: PASS

**Step 4: Run TypeScript verification**

Run: `pnpm --filter @sdkwork/claw-studio-desktop lint`
Expected: PASS
