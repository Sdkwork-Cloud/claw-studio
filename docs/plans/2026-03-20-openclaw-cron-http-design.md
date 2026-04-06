# OpenClaw Cron HTTP Integration Design

**Date:** 2026-03-20

## Goal

Replace mock-backed OpenClaw cron task access with a shared, typed HTTP integration that reads the current instance's cron jobs and run history directly from the OpenClaw Gateway management API, automatically validates access credentials, and exposes a reusable TypeScript client for both the homepage tasks view and the instance detail workbench.

## Problem Summary

The current cron task experience is split across two incomplete paths:

- The homepage tasks feature still reads from `studioMockService`, so it cannot show the real jobs that belong to an OpenClaw instance.
- The instance detail workbench can render backend-projected OpenClaw task snapshots and execute a few task actions through the `studio` bridge, but it does not own a reusable direct-access HTTP client for reading tasks from the current instance.

This leaves the product without a single authoritative task access layer for OpenClaw instances.

## Upstream Standard

OpenClaw's supported management HTTP surface is:

- `POST /tools/invoke`
- auth via `Authorization: Bearer <token>`
- cron methods surfaced through the `cron` tool:
  - `cron.status`
  - `cron.list`
  - `cron.runs`
  - `cron.add`
  - `cron.update`
  - `cron.remove`
  - `cron.run`

The OpenClaw Control UI primarily uses WebSocket RPC, but the official HTTP route is the better fit for Claw Studio because it is simpler to validate, easier to type, and directly matches the requirement to access data through the instance API itself.

## Design Decision

Adopt a shared OpenClaw Gateway HTTP client built around the official `/tools/invoke` endpoint instead of extending the current backend-only bridge or reproducing the Control UI WebSocket protocol.

### Why this is the best option

- It follows the official OpenClaw management contract.
- It supports deterministic login verification by probing a safe read method before task reads.
- It keeps homepage tasks and instance detail on the same source of truth.
- It avoids the extra connection lifecycle and pairing complexity of the browser WebSocket control channel.
- It preserves the existing backend snapshot path as a graceful fallback instead of forcing a risky all-or-nothing migration.

## Scope

### In scope

- Shared infrastructure client for OpenClaw Gateway HTTP access
- Typed `/tools/invoke` request and response contracts
- Typed cron list, run history, status, and mutation contracts
- Automatic endpoint and token resolution from instance detail metadata
- Automatic auth validation and readable error classification
- Homepage tasks read path wired to the shared client for OpenClaw instances
- Instance detail cron task read path wired to the shared client for OpenClaw instances
- Fallback to existing backend snapshot or mock behavior when direct access is unavailable

### Out of scope

- Rebuilding the OpenClaw Control UI WebSocket RPC layer
- Full replacement of every existing `studio` task mutation bridge in one step
- Non-OpenClaw runtime task adapters

## Architecture

### New Shared Client

Create a new service in `@sdkwork/claw-infrastructure`:

- `openClawGatewayClient`

Its responsibilities:

- resolve how to reach a specific OpenClaw instance over HTTP
- normalize the Gateway base URL
- construct `Authorization` headers from the instance token
- validate connectivity and auth before reads
- send typed `/tools/invoke` requests
- translate OpenClaw cron payloads into Claw Studio task models
- expose a small, reusable interface for feature packages

### Access Resolution

The client will derive access data from `studio.getInstanceDetail(instanceId)` and prefer:

1. `detail.instance.baseUrl`
2. `detail.config.baseUrl`
3. `http://<host>:<port>` when host and port are present

Auth will prefer:

1. `detail.config.authToken`
2. `detail.instance.config.authToken`

If endpoint or token is missing, the client should fail with a typed validation result rather than a generic fetch error.

### Validation Strategy

Before the first read, the client will run a safe probe through `/tools/invoke`, preferring:

- `tool: "cron"`
- `action: "status"`

This establishes whether the instance is reachable and whether the provided auth token is valid for the HTTP API.

Validation results will be classified as:

- `ok`
- `missing_endpoint`
- `missing_auth`
- `unauthorized`
- `rate_limited`
- `unreachable`
- `tool_denied`
- `invalid_response`

This validation result becomes the basis for deciding whether to use direct access or fall back to the existing backend snapshot path.

### Consumer Wiring

#### Homepage Tasks

`packages/sdkwork-claw-tasks/src/services/taskService.ts` should:

- detect whether the active instance is an OpenClaw instance
- attempt direct HTTP reads for task list and run history
- map OpenClaw cron jobs into existing task list contracts
- keep the current mock path for non-OpenClaw or fallback scenarios

#### Instance Detail

`packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts` should:

- use the shared client to refresh the OpenClaw cron task list and executions for the current instance
- overlay those reads onto the existing workbench mapping model
- retain the current backend or bridge-backed mutations for clone, run-now, status toggle, and delete until the direct mutation path is proven stable

This gives users real task reads immediately without destabilizing the already-working mutation flow.

## HTTP Interface Contract

### Request envelope

```ts
interface OpenClawInvokeRequest<TArgs = Record<string, unknown>> {
  tool: string;
  action?: string;
  args?: TArgs;
  sessionKey?: string;
  dryRun?: boolean;
}
```

### Response envelope

```ts
interface OpenClawInvokeSuccess<TResult> {
  ok: true;
  result: TResult;
}

interface OpenClawInvokeFailure {
  ok: false;
  error: {
    type?: string;
    message: string;
  };
}
```

### Access descriptor

```ts
interface OpenClawGatewayAccessDescriptor {
  instanceId: string;
  baseUrl: string | null;
  token: string | null;
  runtimeKind: 'openclaw' | string;
}
```

### Validation result

```ts
type OpenClawGatewayValidationStatus =
  | 'ok'
  | 'missing_endpoint'
  | 'missing_auth'
  | 'unauthorized'
  | 'rate_limited'
  | 'unreachable'
  | 'tool_denied'
  | 'invalid_response';

interface OpenClawGatewayValidationResult {
  status: OpenClawGatewayValidationStatus;
  message: string;
  endpoint?: string | null;
  httpStatus?: number;
}
```

### Cron methods exposed by the wrapper

- `validateAccess(instanceId)`
- `listCronJobs(instanceId)`
- `listCronRuns(instanceId, jobId)`
- `runCronJob(instanceId, jobId)`
- `updateCronJob(instanceId, jobId, patch)`
- `removeCronJob(instanceId, jobId)`

The initial rollout must guarantee read coverage for:

- homepage task list
- instance detail task list
- instance detail task history

Mutations can continue to use the backend bridge when appropriate.

## Mapping Model

OpenClaw cron payloads should be normalized into the existing Studio task shapes used by feature packages.

### Job mapping

Map cron jobs into:

- `id`
- `name`
- `description`
- `prompt`
- `schedule`
- `scheduleMode`
- `scheduleConfig`
- `cronExpression`
- `status`
- `deliveryMode`
- `deliveryChannel`
- `recipient`
- `lastRun`
- `nextRun`

### Run history mapping

Map OpenClaw run records into:

- `id`
- `taskId`
- `status`
- `trigger`
- `startedAt`
- `finishedAt`
- `summary`
- `details`

Where upstream fields differ, the mapping should make a conservative best-effort projection and avoid fabricating values that cannot be derived from the source payload.

## Error Handling and Fallback

### Direct access success

- use direct HTTP data as the authoritative read source

### Direct access failure with recoverable validation result

- keep user-facing read experiences working by falling back:
  - instance detail: existing backend `detail.workbench` snapshot or bridge-backed history path
  - homepage tasks: existing mock path until real fallback data is available

### User-visible behavior

- prefer truthful degraded reads over empty-state breakage
- do not silently swallow auth failures in logs
- keep thrown errors human-readable for mutation or manual refresh actions

## Testing Strategy

- Add focused tests for access resolution and validation result classification.
- Add tests for `/tools/invoke` success and failure parsing.
- Add tests for cron job and run-history mapping into Claw Studio task models.
- Add service-level tests proving homepage tasks switch to OpenClaw direct access when possible.
- Add service-level tests proving instance detail OpenClaw reads prefer direct access and fall back safely.

## Risks

- Some OpenClaw instances may expose WebSocket connectivity without complete HTTP access metadata; endpoint normalization must stay defensive.
- Upstream cron payloads may evolve, so the mapping layer should tolerate unknown fields.
- The current workspace already contains unrelated changes; implementation must stay scoped and avoid collateral edits.

## Success Criteria

- The current OpenClaw instance task list can be read through the instance's real HTTP API.
- Access validation automatically derives the login request information and verifies it before reads.
- Homepage tasks and instance detail both use the shared OpenClaw client for OpenClaw instances.
- Instance detail can read the current instance's cron jobs and run history without relying only on mock data.
- The implementation stays inside workspace dependency boundaries and is reusable from package roots.
