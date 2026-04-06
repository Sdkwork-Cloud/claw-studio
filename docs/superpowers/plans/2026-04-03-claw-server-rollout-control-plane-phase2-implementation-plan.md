# Claw Server Rollout Control Plane Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 1 server rollout scaffold into a real persistence-backed control-plane slice for `GET /claw/manage/v1/rollouts`, `POST /claw/manage/v1/rollouts/{rolloutId}:preview`, and `POST /claw/manage/v1/rollouts/{rolloutId}:start`.

**Architecture:** Keep this phase narrow. Add a small rollout repository and control-plane service inside `sdkwork-claw-host-core`, back it with a JSON-file document store that works offline and cross-platform, and inject that service into the Axum server state. Seed the store with a minimal default rollout catalog so the server API is immediately useful even before create/update rollout APIs land.

**Tech Stack:** Rust, `axum`, `tokio`, `tower`, `serde`, `serde_json`, existing `sdkwork-claw-host-core` projection/preflight modules, file-backed JSON persistence.

---

## Scope Check

This plan intentionally covers one vertical slice only:

- persistence-backed rollout list for the server shell
- real rollout preview generation with target preflight and candidate revision summaries
- real rollout start transition backed by persisted preview state
- runtime/docs updates that describe the new live behavior

Explicitly deferred:

- `POST /claw/manage/v1/rollouts`
- `GET /claw/manage/v1/rollouts/{rolloutId}`
- approve, pause, resume, cancel, retry, rollback
- public `/claw/api/v1/*`
- plugin runtime, Redis, SQLite/Postgres backends, or multi-database abstractions
- browser web-platform HTTP bridge wiring

## File Structure

Target structure for the Phase 2 implementation:

- Shared host-core rollout domain and storage:
  - Modify: `packages/sdkwork-claw-host-core/src-host/Cargo.toml`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/domain/rollout.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/projection/compiler.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs`
  - Create: `packages/sdkwork-claw-host-core/src-host/src/storage/file_store.rs`
- Server shell wiring:
  - Modify: `packages/sdkwork-claw-server/src-host/Cargo.toml`
  - Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
  - Modify: `packages/sdkwork-claw-server/.env.example`
- Documentation:
  - Modify: `docs/reference/claw-server-runtime.md`
  - Modify: `docs/reference/claw-rollout-api.md`

### Task 1: Add Failing Host-Core Rollout Control Tests

**Files:**

- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/storage/mod.rs`
- Create: `packages/sdkwork-claw-host-core/src-host/src/storage/file_store.rs`

- [ ] **Step 1: Write failing host-core tests for list, preview, and start behavior**

```rust
#[test]
fn rollout_control_plane_lists_seeded_rollouts() {
    let service = create_test_rollout_control_plane();
    let list = service.list_rollouts().expect("list should succeed");
    assert!(!list.items.is_empty());
}

#[test]
fn rollout_control_plane_preview_persists_candidate_revisions() {
    let service = create_test_rollout_control_plane();
    let preview = service.preview_rollout("rollout-a", false, true).expect("preview should succeed");
    assert!(preview.candidate_revision_summary.is_some());
}

#[test]
fn rollout_control_plane_start_requires_preview_and_persists_promoting_state() {
    let service = create_test_rollout_control_plane();
    let _ = service.preview_rollout("rollout-a", false, true).expect("preview should succeed");
    let record = service.start_rollout("rollout-a").expect("start should succeed");
    assert_eq!(record.phase, RolloutPhase::Promoting);
}
```

- [ ] **Step 2: Run the focused host-core tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Expected: FAIL because the rollout control-plane and file store do not exist yet.

- [ ] **Step 3: Implement the minimal host-core rollout control plane**

```rust
pub struct RolloutControlPlane {
    repository: FileBackedRolloutStore,
    compiler: ProjectionCompiler,
}
```

- [ ] **Step 4: Re-run the host-core tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Expected: PASS.

### Task 2: Add Failing Server Route Tests

**Files:**

- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs`

- [ ] **Step 1: Write failing server route tests for list, preview, and start**

```rust
#[tokio::test]
async fn manage_rollout_routes_return_live_rollout_data() {
    let app = build_router(test_server_state());
    let response = app.oneshot(Request::get("/claw/manage/v1/rollouts").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
```

- [ ] **Step 2: Run the focused server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: FAIL because the server state does not yet carry the host-core rollout service and the manage routes are still scaffolded.

- [ ] **Step 3: Wire the host-core rollout control plane into server state and routes**

```rust
pub struct ServerState {
    pub mode: &'static str,
    pub host: String,
    pub port: u16,
    pub rollout_control_plane: Arc<RolloutControlPlane>,
}
```

- [ ] **Step 4: Re-run the focused server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

### Task 3: Document The Live Phase 2 Runtime Slice

**Files:**

- Modify: `docs/reference/claw-server-runtime.md`
- Modify: `docs/reference/claw-rollout-api.md`
- Modify: `packages/sdkwork-claw-server/.env.example`

- [ ] **Step 1: Update runtime docs and env docs for the new storage-backed rollout behavior**

```md
- `GET /claw/manage/v1/rollouts` -> persistence-backed JSON result
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview` -> live preview result
- `POST /claw/manage/v1/rollouts/{rolloutId}:start` -> persisted `promoting` rollout record
```

- [ ] **Step 2: Run focused verification**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml && cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 3: Run workspace lint**

Run: `pnpm.cmd lint`

Expected: PASS.

## Deferred Follow-Up Plans

These remain out of scope for this plan and should become later implementation slices:

- browser web-platform HTTP bridge for `manage` and `internal`
- rollout item/detail/targets/waves read APIs
- rollout creation and mutation APIs
- manual approval and recovery actions
- pluggable storage backends, Redis, or distributed coordination
