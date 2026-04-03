# Claw Server Node Session Admit Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real `:admit` transition so a live session can move from `pending` to `admitted` or `degraded` after `:hello`, making the internal node-session runtime state machine materially useful.

**Architecture:** Extend the host-core session registry with a persisted admit transition keyed by `sessionId` and `helloToken`, then expose it through a server route that parses `POST /claw/internal/v1/node-sessions/{sessionId}:admit`. Keep the response narrow: lease, compatibility result, effective capabilities, heartbeat policy, and desired-state cursor. Do not add heartbeat or desired-state apply yet.

**Tech Stack:** Rust, `axum`, serde JSON, existing host-core node-session registry, server route tests.

---

## Scope Check

This plan covers one vertical slice only:

- persisted `:admit` transition in host-core
- `POST /claw/internal/v1/node-sessions/{sessionId}:admit`
- list state reflecting admitted/degraded/blocked after admit

Explicitly deferred:

- heartbeat lease renewal
- desired-state pull or ack
- auth and mTLS enforcement
- stale lease rejection beyond basic hello-token validation

## File Structure

- Planning:
  - Create: `docs/superpowers/plans/2026-04-03-claw-server-node-session-admit-phase6-implementation-plan.md`
- Host-core:
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
  - Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Server:
  - Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
  - Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Docs:
  - Modify: `docs/reference/claw-server-runtime.md`

### Task 1: Add Failing Admit Tests

**Files:**

- Modify: `packages/sdkwork-claw-host-core/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Add a failing host-core test for admit transitioning a pending session**
- [ ] **Step 2: Add a failing server route test for hello -> admit -> list**
- [ ] **Step 3: Run focused tests and confirm failure**

### Task 2: Implement Admit Transition

**Files:**

- Modify: `packages/sdkwork-claw-host-core/src-host/src/internal/node_sessions.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `docs/reference/claw-server-runtime.md`

- [ ] **Step 1: Add admit request/response contracts and persisted transition logic**
- [ ] **Step 2: Add server route parsing for `{sessionId}:admit`**
- [ ] **Step 3: Re-run host-core/server tests**
- [ ] **Step 4: Run `pnpm.cmd lint`**
