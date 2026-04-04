# Claw Host Core Storage Drivers Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real SQLite-backed host-core catalog driver and let the server runtime explicitly choose between JSON-file and SQLite persistence without changing the current default behavior.

**Architecture:** Keep the new SPI from phase 1 intact. Add SQLite implementations behind the existing rollout and node-session catalog store traits, expose explicit host-core constructors for JSON and SQLite, and teach the server bootstrap to resolve a storage driver from environment with JSON remaining the safe default.

**Tech Stack:** Rust, `serde`, `serde_json`, `rusqlite` with bundled SQLite, existing host-core storage SPI, existing server bootstrap and docs.

---

### Task 1: Add failing tests for SQLite catalog persistence

**Files:**
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/Cargo.toml`

- [ ] **Step 1: Write the failing tests**

Add tests that expect:
- `RolloutControlPlane::open_sqlite(...)` persists rollout preview state across reopen
- `NodeSessionRegistry::open_sqlite(...)` persists live session state across reopen

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml sqlite_catalog -- --nocapture`
Expected: FAIL because the SQLite constructors and driver implementations do not exist yet.

### Task 2: Implement SQLite catalog drivers in host-core

**Files:**
- Create: `packages/sdkwork-claw-host-core/src-host/src/storage/sqlite_store.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/Cargo.toml`

- [ ] **Step 1: Implement the minimal SQLite driver**

Add:
- a shared SQLite document store for serialized catalog documents
- one rollout catalog store wrapper
- one node-session catalog store wrapper
- `open_sqlite(path)` convenience constructors on `RolloutControlPlane` and `NodeSessionRegistry`

- [ ] **Step 2: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml sqlite_catalog -- --nocapture`
Expected: PASS with state persisting through SQLite-backed reopen.

### Task 3: Add explicit server driver selection

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/.env.example`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`

- [ ] **Step 1: Write the failing server tests**

Add bootstrap tests that expect:
- `CLAW_SERVER_STATE_STORE_DRIVER=sqlite` seeds a single SQLite database file
- missing or empty driver config still falls back to JSON files
- invalid driver values fail with a stable configuration error in the fallible bootstrap path

- [ ] **Step 2: Run the focused server tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml build_server_state -- --nocapture`
Expected: FAIL because driver resolution and SQLite bootstrap support do not exist yet.

- [ ] **Step 3: Implement the minimal bootstrap selection layer**

Add:
- a parsed server storage driver enum
- JSON and SQLite path resolution under `CLAW_SERVER_DATA_DIR`
- optional `CLAW_SERVER_STATE_STORE_SQLITE_PATH` override
- a fallible bootstrap helper that the current infallible wrappers can still call

- [ ] **Step 4: Re-run the focused server tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml build_server_state -- --nocapture`
Expected: PASS with JSON default preserved and SQLite selection working.

### Task 4: Run full verification and update docs

**Files:**
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`

- [ ] **Step 1: Update docs**

Document:
- supported server state-store drivers for this slice
- JSON remains the default built-in driver
- SQLite is now supported for consolidated host runtime catalog persistence
- PostgreSQL and Redis remain later slices, not current behavior

- [ ] **Step 2: Run final verification**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Run: `pnpm check:server`
Expected: PASS. Any unrelated workspace lint failures should be called out separately and not conflated with this slice.
