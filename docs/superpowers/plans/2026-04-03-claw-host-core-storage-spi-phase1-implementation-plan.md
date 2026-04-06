# Claw Host Core Storage SPI Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple `sdkwork-claw-host-core` rollout and node-session runtime logic from direct JSON-file persistence so later SQLite/PostgreSQL/Redis drivers can plug in without rewriting control-plane behavior.

**Architecture:** Keep this slice intentionally small. Introduce domain-specific storage traits for rollout and node-session catalogs, keep JSON files as the default concrete driver, and preserve the existing public constructors so the server shell remains unchanged. Prove the abstraction with in-memory test stores before touching runtime wiring beyond the host core.

**Tech Stack:** Rust, `serde`, `serde_json`, existing host-core domain modules, existing server bootstrap.

---

### Task 1: Define the storage SPI surface

**Files:**
- Modify: `packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/storage/rollout_store.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/storage/node_session_store.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/storage/file_store.rs`

- [ ] **Step 1: Write the failing tests**

Add focused host-core tests that expect:
- `RolloutControlPlane` can be created from a store implementation without a filesystem path
- `NodeSessionRegistry` can be created from a store implementation without a filesystem path
- reopening via the same shared in-memory store preserves saved catalogs

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml storage_spi -- --nocapture`
Expected: FAIL because the new store traits and constructor paths do not exist yet.

- [ ] **Step 3: Add the minimal storage trait layer**

Implement:
- shared `StorageError`
- rollout catalog store trait
- node-session catalog store trait
- JSON-file-backed concrete store implementations
- JSON helpers that can load `Option<T>` instead of forcing load-and-seed in one function

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml storage_spi -- --nocapture`
Expected: PASS with the new store traits and JSON drivers in place.

### Task 2: Move rollout and node-session runtime logic behind the SPI

**Files:**
- Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Extend the failing tests for behavior parity**

Add targeted tests that expect:
- JSON-backed `open(path)` still seeds the catalog on first use
- in-memory store backed `from_store(...)` persists rollout preview/start state across reopen
- in-memory store backed `from_store(...)` persists node-session hello/admit state across reopen

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml storage_spi rollout_control_plane node_session_registry -- --nocapture`
Expected: FAIL because the host-core runtime types still hold raw paths and file helpers directly.

- [ ] **Step 3: Implement the minimal runtime refactor**

Refactor:
- `RolloutControlPlane` to hold a rollout catalog store object instead of a raw path
- `NodeSessionRegistry` to hold a node-session catalog store object instead of a raw path
- preserve `open(path)` as a convenience constructor that installs the JSON driver
- add explicit store-based constructors for future server/desktop driver selection

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml storage_spi rollout_control_plane node_session_registry -- --nocapture`
Expected: PASS with no behavior regression.

### Task 3: Keep server shell compatibility and document the new default driver posture

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/environment.md`

- [ ] **Step 1: Write the failing regression test or contract check**

Add or extend a server test that expects:
- server bootstrap still initializes rollout and node-session persistence using the default JSON driver
- seeded files still appear inside `CLAW_SERVER_DATA_DIR` after startup

- [ ] **Step 2: Run the focused server test to verify it fails if wiring drifted**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml build_server_state -- --nocapture`
Expected: PASS or targeted source change requirement only. If behavior already holds through preserved `open(path)`, keep the bootstrap unchanged and treat the test as regression coverage.

- [ ] **Step 3: Update docs**

Document that:
- host-core now exposes storage SPI boundaries for rollout and node-session catalogs
- JSON file persistence is the current built-in default driver for server mode
- future DB/cache providers will attach behind the same host-core storage boundary

- [ ] **Step 4: Run the final verification set**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`
Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`
Run: `pnpm check:server`
Expected: PASS. `pnpm lint` may remain blocked by pre-existing unrelated chat/UI contract failures and should not be treated as a regression from this slice.
