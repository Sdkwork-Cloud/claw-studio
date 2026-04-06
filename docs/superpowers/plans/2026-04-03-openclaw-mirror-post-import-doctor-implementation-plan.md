# OpenClaw Mirror Post-Import Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a managed `openclaw doctor --fix` step automatically after private mirror import restores files so imported runtimes finish in a repaired state.

**Architecture:** Extend the native mirror import service with a post-restore doctor runner that reuses the managed OpenClaw runtime command launch pattern already used by the embedded CLI and supervisor. Keep the feature inside the Rust service layer so desktop bridge contracts stay stable while import tests assert the doctor side effect through the managed runtime fixture.

**Tech Stack:** Rust, Tauri desktop services, managed OpenClaw runtime launcher, Node-based OpenClaw CLI fixtures, Cargo unit tests.

---

### Task 1: Add failing Rust coverage for post-import doctor execution

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Write the failing Rust test**

Add a test that imports a mirror into a managed runtime fixture whose CLI script records when `doctor --fix` is executed. Assert the marker exists after import.

- [ ] **Step 2: Run the focused Rust tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`
Expected: FAIL because import currently restores files but does not invoke doctor.

### Task 2: Implement the managed post-import doctor runner

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Add the minimal doctor runner**

Implement a helper that launches the managed runtime as:

```rust
node <openclaw-cli> doctor --fix
```

with the same managed environment and working directory conventions used by the embedded CLI/supervisor.

- [ ] **Step 2: Wire doctor execution into the import flow**

Run the doctor helper after restore and before optional gateway restart. Surface non-zero exit as a framework error.

- [ ] **Step 3: Re-run the focused Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import -- --nocapture`
Expected: PASS with doctor execution covered by the new test and existing import tests still green.

### Task 3: Re-run mirror verification and update the delivery boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-openclaw-mirror-design.md`

- [ ] **Step 1: Update spec delivery notes**

Record that Phase 1 now includes post-import doctor execution in addition to private export/import and safety snapshot.

- [ ] **Step 2: Run final focused verification**

Run: `node packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
Run: `node packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts`
Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror -- --nocapture`
Expected: PASS.
