# Claw Server Node Session Heartbeat Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real `:heartbeat` flow so admitted sessions can refresh their lease and receive a steady-state posture response from the server control plane.

**Architecture:** Extend the host-core session registry with a heartbeat transition keyed by `sessionId` and `leaseId`, then expose it through the existing dynamic node-session action route. Keep the response narrow: refreshed lease, compatibility result, management posture, and desired-state hint. Do not implement pull or ack yet.

**Tech Stack:** Rust, `axum`, serde JSON, existing host-core node-session registry and server route parser.

---

## Scope Check

This plan covers one vertical slice only:

- persisted `:heartbeat` transition in host-core
- `POST /claw/internal/v1/node-sessions/{sessionId}:heartbeat`
- list `lastSeenAt` reflecting heartbeat refresh

Explicitly deferred:

- desired-state pull payloads
- desired-state ack
- lease expiry enforcement beyond lease-id matching

## File Structure

- Planning:
  - Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-heartbeat-phase7-implementation-plan.md`
- Host-core:
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Server:
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Docs:
  - Modify: `docs/reference/claw-server-runtime.md`
