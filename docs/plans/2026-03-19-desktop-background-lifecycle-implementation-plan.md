# Desktop Background Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the desktop app hide instead of quit when the window is closed, add a tray menu with explicit quit behavior, and introduce a supervisor foundation for long-lived background services.

**Architecture:** Keep the Tauri host as the single application supervisor. Add a Rust-side tray and close-interception layer in `app/bootstrap.rs`, a new `SupervisorService` in the framework services layer, and lifecycle tests that verify hide-vs-quit behavior and graceful shutdown ordering.

**Tech Stack:** Tauri 2, Rust, existing desktop framework services, TypeScript desktop bridge, pnpm workspace.

---

### Task 1: Add the design-time documents

**Files:**
- Create: `docs/plans/2026-03-19-desktop-background-lifecycle-design.md`
- Create: `docs/plans/2026-03-19-desktop-background-lifecycle-implementation-plan.md`

**Step 1: Write the failing test**

No code test for this task.

**Step 2: Run test to verify it fails**

No command for this task.

**Step 3: Write minimal implementation**

Create the design and implementation plan documents with the exact lifecycle contract, tray behavior, and supervisor responsibilities.

**Step 4: Run test to verify it passes**

No command for this task.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-19-desktop-background-lifecycle-design.md docs/plans/2026-03-19-desktop-background-lifecycle-implementation-plan.md
git commit -m "docs: add desktop background lifecycle design"
```

### Task 2: Add supervisor domain types and unit tests

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`

**Step 1: Write the failing test**

Add Rust unit tests for:

- a default supervisor definition containing `openclaw_gateway`, `web_server`, and `api_router`
- reverse-order shutdown planning
- restart throttling behavior
- intentional shutdown disabling restart attempts
- manual restart requests for single services and full background restart plans

**Step 2: Run test to verify it fails**

Run: `cargo test supervisor --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because `SupervisorService` and related tests do not exist yet.

**Step 3: Write minimal implementation**

Implement `SupervisorService` with:

- managed service definitions
- in-memory runtime status
- startup/shutdown planning helpers
- graceful-stop/force-kill lifecycle helpers
- restart-throttling rules

Wire it into `FrameworkServices`.

**Step 4: Run test to verify it passes**

Run: `cargo test supervisor --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs
git commit -m "feat: add desktop supervisor foundation"
```

### Task 3: Add application close-intent state and tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/state/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

**Step 1: Write the failing test**

Add unit tests that verify:

- normal close requests are intercepted and converted into hide requests
- intentional shutdown bypasses close interception

**Step 2: Run test to verify it fails**

Run: `cargo test close_request --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because close-intent state and helpers do not exist yet.

**Step 3: Write minimal implementation**

Add app-level shutdown intent state and pure helper functions that decide whether a close event should be prevented.

**Step 4: Run test to verify it passes**

Run: `cargo test close_request --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/state/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs
git commit -m "feat: add desktop shutdown intent handling"
```

### Task 4: Add tray creation, tray menu routing, and tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

**Step 1: Write the failing test**

Add tests for:

- tray menu IDs mapping to window restore, grouped navigation routes, service restarts, diagnostics, and `quit_app`
- tray actions choosing the expected app behavior

**Step 2: Run test to verify it fails**

Run: `cargo test tray --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because tray helpers and routing are not implemented.

**Step 3: Write minimal implementation**

Implement:

- tray icon creation at app setup
- menu item IDs
- menu event routing
- show-window helper
- explicit quit helper that marks shutdown intent before stopping services and exiting
- single-instance activation routed through the same show-window helper

**Step 4: Run test to verify it passes**

Run: `cargo test tray --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs
git commit -m "feat: add desktop tray lifecycle"
```

### Task 5: Expose supervisor state in kernel diagnostics

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`

**Step 1: Write the failing test**

Add tests that verify `desktop_kernel_info` now exposes supervisor summaries for managed background services.

**Step 2: Run test to verify it fails**

Run: `cargo test kernel_info --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: FAIL because supervisor diagnostics are not yet projected.

**Step 3: Write minimal implementation**

Extend desktop kernel info with:

- service count
- managed service IDs
- runtime status summaries

**Step 4: Run test to verify it passes**

Run: `cargo test kernel_info --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs
git commit -m "feat: expose supervisor kernel diagnostics"
```

### Task 6: Verify desktop package quality gates

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: any touched test files as needed

**Step 1: Write the failing test**

No new test file for this task; this is the verification pass.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sdkwork/claw-desktop lint`

Expected: Any typing or API mistakes show up here before final cleanup.

**Step 3: Write minimal implementation**

Fix the smallest remaining issues until the lint and Rust tests pass cleanly.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sdkwork/claw-desktop lint
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: both commands exit successfully

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri docs/plans/2026-03-19-desktop-background-lifecycle-design.md docs/plans/2026-03-19-desktop-background-lifecycle-implementation-plan.md
git commit -m "feat: add desktop background lifecycle management"
```

Plan complete and saved to `docs/plans/2026-03-19-desktop-background-lifecycle-implementation-plan.md`. The user explicitly asked for autonomous execution in this session, so continue locally without waiting for a separate execution handoff.
