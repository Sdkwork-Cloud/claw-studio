# Unified Rust Host Runtime Hardening Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status Update (2026-04-05):** Tasks 1-7 are implemented and verified. Task 8 Steps 1-4 are implemented and verified. Task 8 Step 5 still requires real packaged/manual runtime evidence outside this sandbox.

**Goal:** Make `desktop`, `server`, `docker`, and `kubernetes` share one truthful runtime authority for OpenClaw management, readiness, config workbench, chat/conversation, and cron/task behavior.

**Architecture:** Keep the shared Rust host kernel, but replace mode-specific truth leaks with explicit provider boundaries. Desktop combined mode must route hosted HTTP through the same supervisor-backed runtime authority as Tauri direct calls; hosted browser modes must stop assuming local file IO and local managed runtime ownership; deployment readiness must be derived from real runtime state rather than static route availability.

**Tech Stack:** Rust host services, Tauri desktop runtime, TypeScript service layer, React shell, Cargo tests, Node `--experimental-strip-types` tests, deployment contract tests

---

### Task 1: Replace desktop combined-mode OpenClaw split-brain with one shared authority

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add coverage proving that in desktop combined mode:
- `/claw/manage/v1/host-endpoints` returns the live supervisor-backed endpoint projection
- `/claw/manage/v1/openclaw/runtime` matches the desktop direct runtime lifecycle
- `/claw/manage/v1/openclaw/gateway` matches the desktop direct gateway projection

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_openclaw`
Expected: FAIL because desktop combined mode still reads the default inactive server control plane

- [ ] **Step 3: Implement the provider abstraction**

Introduce a manage OpenClaw provider boundary in shared server state, and bind desktop combined mode to a supervisor-backed live provider instead of the default inactive server control plane.

- [ ] **Step 4: Re-run the focused test**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml manage_openclaw`
Expected: PASS

- [ ] **Step 5: Re-run broader host verification**

Run: `pnpm.cmd check:server`
Expected: PASS

### Task 2: Make hosted runtime readiness truthful and fail the bootstrap when the runtime is not usable

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
- Test: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Test: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that desktop hosted readiness fails unless all of these are true:
- host lifecycle is ready
- OpenClaw runtime lifecycle is ready
- OpenClaw gateway lifecycle is ready
- `local-built-in` exists
- `baseUrl` is non-empty
- `websocketUrl` is non-empty

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_host_platform`
Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: FAIL because the current route hardcodes `ready` and the frontend probe only checks lifecycle plus endpoint count

- [ ] **Step 3: Implement the minimal readiness fix**

Project a truthful hosted lifecycle from real runtime state, and tighten `probeDesktopHostedRuntimeReadiness()` so bootstrap blocks until the built-in runtime is actually reachable.

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml internal_host_platform`
Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run desktop verification**

Run: `pnpm.cmd check:desktop`
Expected: PASS

### Task 3: Make desktop setup fail-fast for bundled install and bundled OpenClaw activation

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add coverage proving that:
- bundled install sync failure aborts bootstrap
- `start_default_services()` actually starts the required services or fails
- bundled OpenClaw activation failure aborts packaged setup

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bootstrap`
Expected: FAIL because setup currently logs and continues

- [ ] **Step 3: Implement the minimal fail-fast behavior**

Convert these startup failures from warnings into typed bootstrap errors and ensure the supervisor starts the default service set instead of returning an empty success result.

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml bootstrap`
Expected: PASS

- [ ] **Step 5: Re-run desktop verification**

Run: `pnpm.cmd check:desktop`
Expected: PASS

### Task 4: Implement hosted manage gateway invoke against the real desktop supervisor runtime

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_control.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that a non-dry-run hosted gateway invoke:
- reaches the real supervisor-backed OpenClaw control path
- returns the same accepted/result shape as the desktop direct path
- returns a truthful unavailability error only when the runtime is actually not ready

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml gateway`
Expected: FAIL because non-dry-run hosted invoke is currently hardcoded as "not implemented"

- [ ] **Step 3: Implement the minimal hosted invoke path**

Wire the hosted manage invoke route through the same OpenClaw control helper used by the desktop direct service.

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml gateway`
Expected: PASS

- [ ] **Step 5: Re-run server-host verification**

Run: `pnpm.cmd check:server`
Expected: PASS

### Task 5: Move managed OpenClaw config workbench off platform file IO in hosted browser modes

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`
- Modify: `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/web.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- Test: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that browser-hosted instance config workbench can load and save managed OpenClaw config without calling `platform.readFile/writeFile`.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
Expected: FAIL because hosted modes still call the platform file API

- [ ] **Step 3: Implement the minimal authority shift**

Introduce a host API or gateway-backed managed config document interface and reserve direct platform file IO for desktop-local implementations only.

- [ ] **Step 4: Re-run the focused tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run host runtime verification**

Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: PASS

### Task 6: Remove fake built-in managed runtime projections and unify hosted authority for conversations and cron/tasks

**Files:**
- Modify: `packages/sdkwork-claw-host-studio/src-host/src/lib.rs`
- Modify: `packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Test: `packages/sdkwork-claw-host-studio/src-host/src/lib.rs`
- Test: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- Test: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that:
- server/docker/k8s do not project `local-built-in` as managed when no real runtime is attached
- conversation list authority matches live runtime truth instead of JSON snapshot truth
- cron/task CRUD and execution history use the same runtime authority across desktop and hosted modes

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml built_in`
Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: FAIL because hosted modes still project fake managed runtime semantics and snapshot-backed authority

- [ ] **Step 3: Implement the minimal authority convergence**

Separate registry metadata from live runtime ownership, then route conversation and task/cron flows to the runtime-authoritative source in every supported mode.

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml built_in`
Run: `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run chat and host verification**

Run: `pnpm.cmd check:sdkwork-host-runtime`
Expected: PASS

### Task 7: Correct readiness endpoints and deployment contracts for docker and kubernetes

**Files:**
- Modify: `packages/sdkwork-claw-server/src-host/src/http/routes/health.rs`
- Modify: `deploy/kubernetes/templates/deployment.yaml`
- Modify: `deploy/kubernetes/values.yaml`
- Modify: `scripts/release-deployment-contract.test.mjs`
- Test: `packages/sdkwork-claw-server/src-host/src/main.rs`

- [ ] **Step 1: Write the failing tests**

Add coverage proving that:
- `/claw/health/ready` depends on real runtime readiness
- Helm `readinessProbe` targets `/claw/health/ready`
- unsupported multi-replica deployment is explicitly rejected or guarded

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml health`
Run: `node scripts/release-deployment-contract.test.mjs`
Expected: FAIL because readiness is constant and Helm still points readiness to `/claw/health/live`

- [ ] **Step 3: Implement the minimal deployment-truth fix**

Make `/ready` runtime-aware, align Helm probe paths, and add an explicit singleton guard until runtime state supports shared multi-replica coordination.

- [ ] **Step 4: Re-run the focused tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml health`
Run: `node scripts/release-deployment-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Re-run server verification**

Run: `pnpm.cmd check:server`
Expected: PASS

### Task 8: Add real-runtime smoke coverage for desktop, hosted browser, docker, and singleton-k8s flows

**Files:**
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`
- Modify: `scripts/release-deployment-contract.test.mjs`
- Create: `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md`
- Reference: `docs/reports/2026-04-05-unified-rust-host-kernel-followup-review.md`

- [ ] **Step 1: Add the failing smoke contracts**

Add contract tests and documented manual smoke steps for:
- desktop packaged startup and built-in OpenClaw readiness
- hosted HTTP vs Tauri parity
- browser/server config workbench load and save
- conversation list plus free chat parity
- cron/task CRUD and execution parity
- docker unmanaged-runtime truth
- singleton-k8s readiness truth

- [ ] **Step 2: Run the smoke contracts to verify the gaps**

Run: `pnpm.cmd check:sdkwork-host-runtime`
Run: `pnpm.cmd check:desktop`
Run: `pnpm.cmd check:server`
Expected: at least one focused smoke contract FAIL until the runtime convergence work above lands

- [ ] **Step 3: Land only the missing verification harness**

Do not add new product features here. Only add the coverage needed to lock the corrected runtime behavior.

- [ ] **Step 4: Re-run the full verification batch**

Run: `pnpm.cmd check:sdkwork-host-runtime`
Run: `pnpm.cmd check:desktop`
Run: `pnpm.cmd check:server`
Run: `node scripts/release-deployment-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Record the final manual smoke results**

Update `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md` with:
- platform tested
- packaged or dev runtime used
- exact flows executed
- pass/fail evidence
