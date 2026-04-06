# Claw Server Internal Node Sessions Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server-mode `/claw/internal/v1/node-sessions` return a real combined-host read model instead of an empty array, so browser-hosted Nodes and host views expose useful live data.

**Architecture:** Keep the slice narrow and read-only. Reuse the existing rollout preview data in `sdkwork-claw-host-core` to project node-session records for the server shell, without introducing the full hello/admit/heartbeat internal session lifecycle yet. Put the projection logic in `host-core` so future desktop/server convergence can reuse the same mapping rules.

**Tech Stack:** Rust, `axum`, existing `sdkwork-claw-host-core` rollout control plane, serde, existing server route tests.

---

## Scope Check

This plan covers one vertical slice only:

- project server node-session records from rollout preview data
- return that projection from `GET /claw/internal/v1/node-sessions`
- keep browser server mode aligned with the server shell's real internal read model

Explicitly deferred:

- `:hello`, `:admit`, `:heartbeat`, `:pull-desired-state`, `:ack-desired-state`, and `:close`
- persisted internal session lifecycle state machines
- auth, RBAC, remote browser access policy, or multi-node coordination
- public `/claw/api/v1/*` APIs

## File Structure

Target structure for the Phase 4 implementation:

- Planning:
  - Create: `docs/superpowers/plans/2026-04-03-claw-server-internal-node-sessions-phase4-implementation-plan.md`
- Host-core projection:
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Server route integration:
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Documentation:
  - Modify: `docs/reference/claw-server-runtime.md`

### Task 1: Add Failing Route Coverage

**Files:**

- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write a failing server test for projected node sessions**

```rust
#[tokio::test]
async fn internal_node_sessions_route_returns_projected_combined_sessions() {
    let app = build_router(build_server_state_with_rollout_data_dir(
        create_test_rollout_data_dir("node-sessions"),
    ));
    let response = app
        .oneshot(
            Request::get("/claw/internal/v1/node-sessions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(response_body_text(response).await.contains("\"nodeId\":\"local-built-in\""));
}
```

- [ ] **Step 2: Run the focused server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: FAIL because the route still returns `[]`.

### Task 2: Add Minimal Host-Core Projection

**Files:**

- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/rollout/control_plane.rs`
- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`

- [ ] **Step 1: Add a shared internal node-session projection record and preview mapping helper**

```rust
pub fn project_node_sessions_from_preview(
    preview: &ManageRolloutPreview,
    lifecycle_ready: bool,
    session_prefix: &str,
    last_seen_at: u64,
) -> Vec<NodeSessionRecord> {
    preview.targets.iter().map(|target| ...).collect()
}
```

- [ ] **Step 2: Add host-core tests for the projection rules**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-host-core/src-host/Cargo.toml`

Expected: FAIL first, then PASS after the minimal projection logic is added.

### Task 3: Wire The Server Route To The Live Projection

**Files:**

- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Replace the empty route response with a control-plane backed projection**

```rust
let sessions = state
    .rollout_control_plane
    .list_projected_node_sessions("rollout-a", true, "server-combined", state.host_platform_updated_at())?;
```

- [ ] **Step 2: Re-run the server tests**

Run: `cargo test --offline --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml`

Expected: PASS.

- [ ] **Step 3: Run workspace lint**

Run: `pnpm.cmd lint`

Expected: PASS.

## Deferred Follow-Up Plans

These remain out of scope for this plan and should become later implementation slices:

- server-side durable session admission and heartbeats
- projection of multi-rollout or per-wave session inventories
- internal session reconciliation against real runtime heartbeats
- browser/server auth around internal operational routes
