# OpenClaw Installer Prewarm And Startup Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows desktop installer prewarm the bundled OpenClaw runtime so first user launch does not need to unpack it, and add a startup fast path so already-prepared runtimes skip expensive revalidation work.

**Architecture:** Keep the existing bundled OpenClaw resource model and runtime activation seams, but split installer postinstall preparation from CLI registration. Add one dedicated internal CLI action for runtime prewarm, keep the NSIS hook responsible for invoking it during install, and teach the runtime activation path to trust the prepared runtime sidecar manifest before falling back to deep dependency sentinel validation.

**Tech Stack:** Rust desktop host, NSIS installer hooks, existing Rust unit tests, existing script contract tests.

---

### Task 1: Lock Installer Prewarm Intent In Tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- Modify: `scripts/tauri-dev-command-contract.test.mjs`

- [ ] **Step 1: Write the failing test**

Add coverage that:
- internal CLI parsing recognizes a dedicated bundled OpenClaw prepare flag
- Windows installer hooks invoke the prepare flag before CLI registration

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml internal_cli`
- `node scripts/tauri-dev-command-contract.test.mjs`

Expected:
- Rust test fails because the new flag is not parsed yet
- script contract fails because installer hooks do not call the new prepare step

### Task 2: Implement Dedicated Installer Prewarm Action

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/installer-hooks.nsh`

- [ ] **Step 1: Add the minimal internal CLI action**

Add a dedicated action that:
- resolves current paths and bundled resource root
- calls the existing bundled OpenClaw runtime preparation path
- exits without doing PATH or shell shim work

- [ ] **Step 2: Wire installer postinstall to prewarm first**

Update NSIS postinstall hooks so they:
- run the bundled runtime prepare action first
- keep CLI registration as a second, best-effort step
- log runtime-prewarm deferral separately from CLI-registration deferral

- [ ] **Step 3: Run targeted tests to verify they pass**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml internal_cli`
- `node scripts/tauri-dev-command-contract.test.mjs`

Expected:
- both pass

### Task 3: Lock Startup Fast Path In Tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Write the failing test**

Add coverage that an installed runtime with:
- matching bundled manifest
- matching runtime sidecar manifest
- present node and CLI entrypoints

is treated as complete without requiring deep dependency sentinel validation.

- [ ] **Step 2: Run targeted test to verify it fails**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_runtime`

Expected:
- failure because the current implementation always falls through to dependency sentinel validation

### Task 4: Implement Runtime Sidecar Fast Path

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Add minimal sidecar helpers**

Add helpers to:
- resolve the installed runtime sidecar manifest path
- read the sidecar manifest when present
- compare it to the bundled manifest

- [ ] **Step 2: Use sidecar match as the first completion check**

Update runtime completeness checks so they:
- return ready immediately when manifest, sidecar, node, and CLI all match
- fall back to the existing dependency sentinel validation for legacy installs or mismatched trees

- [ ] **Step 3: Run targeted tests to verify they pass**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_runtime`

Expected:
- pass with the new fast-path coverage

### Task 5: Verify The End-To-End Contract

**Files:**
- Modify: `docs/plans/2026-03-23-openclaw-embedded-integration-audit.md` if needed
- Create: `docs/reports/2026-04-04-openclaw-installer-and-runtime-report.md`

- [ ] **Step 1: Run focused verification**

Run:
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml internal_cli openclaw_runtime`
- `node scripts/tauri-dev-command-contract.test.mjs`

Expected:
- all pass

- [ ] **Step 2: Write the final report**

Document:
- root cause
- current integrated path
- implemented fixes
- residual risks
- next recommended iteration to collapse the remaining double-track bundled OpenClaw architecture
