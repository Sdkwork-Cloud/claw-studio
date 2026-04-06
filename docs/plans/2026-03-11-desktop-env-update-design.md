# Desktop Env And Update Design

## Goal

Build a production-shaped desktop update foundation for the current Tauri architecture by adding a centralized environment configuration model, integrating the backend update-check API, and exposing update actions through the existing infrastructure and business boundaries.

## Context

The current desktop package only reads `VITE_DISTRIBUTION_ID` directly in the provider layer. There is no typed environment module, no standardized access-token resolution, and no update client bound to the backend business API.

The backend does not currently expose a Tauri updater protocol endpoint. The authoritative interface is the business API `POST /app/v3/api/update/check`, discovered from the local OpenAPI schema at `http://localhost:8080/v3/api-docs/app`.

The design must preserve the workspace dependency direction:

- `web/desktop shell -> business -> infrastructure`
- page components must not directly call Tauri APIs, read scattered env values, or construct update HTTP requests

## Requirements

- Centralize env parsing and normalization using the same style as `magic-studio-v2`
- Resolve update API base URL and access token from env instead of hardcoding
- Build a stable typed DTO for desktop update checks
- Use runtime metadata from the desktop bridge to populate backend update request fields
- Keep update capability non-blocking and non-fatal when configuration is missing
- Expose a clean action model so the UI can trigger “check update” and “open update target” without protocol knowledge

## Proposed Architecture

### 1. Centralized Env Module

Add a shared env module in `@sdkwork/claw-studio-infrastructure` that:

- reads `import.meta.env` once
- exposes a typed config object
- normalizes API base URLs by trimming trailing slashes
- resolves access token consistently
- provides helper methods such as `getApiUrl(path)` and `getAccessToken()`

Planned variables:

- `VITE_APP_ENV`
- `VITE_API_BASE_URL`
- `VITE_ACCESS_TOKEN`
- `VITE_APP_ID`
- `VITE_RELEASE_CHANNEL`
- `VITE_DISTRIBUTION_ID`
- `VITE_PLATFORM`
- `VITE_TIMEOUT`
- `VITE_ENABLE_STARTUP_UPDATE_CHECK`

Missing non-critical values should fall back to safe defaults. Missing critical update values should disable update checks without breaking the application.

### 2. Infrastructure Update Client

Add a dedicated update client in `@sdkwork/claw-studio-infrastructure` that:

- calls `POST /app/v3/api/update/check`
- constructs the final URL from the env module
- adds `Authorization: Bearer <token>` when an access token is available
- maps backend responses into a stable local contract
- converts transport and schema failures into stable application errors

This layer owns HTTP details and backend endpoint knowledge.

### 3. Desktop Runtime Metadata Integration

Use the existing desktop runtime bridge to collect the data needed by `AppUpdateCheckForm`, including:

- app version
- build number if available
- package name and bundle identifier if available
- OS/platform/architecture
- device ID
- locale
- release channel

This metadata is merged with env configuration before sending the request. If a field is unavailable in the current runtime, the request should still be sent with the available subset.

### 4. Business Update Service

Add a business-facing update service that:

- exposes `checkForAppUpdate()`
- exposes `resolvePreferredUpdateAction(result)`
- exposes `openUpdateTarget(result)` or equivalent action helpers

The business layer should not know fetch semantics or OpenAPI schema shapes beyond the local typed contracts.

### 5. Update Action Model

The first phase supports these actions:

- open resolved package URL
- open explicit update URL
- open store URL

Action resolution rules:

1. prefer `resolvedPackage.url`
2. otherwise use `updateUrl`
3. otherwise use `storeUrl`
4. otherwise report that no actionable update target is available

The actual action is executed through the platform bridge’s `openExternal` capability.

This deliberately avoids implementing native download/install behavior until the backend update payload and release distribution flow stabilize.

### 6. App Integration

Integrate update capability into the desktop app in two places:

- startup bootstrap: trigger an optional non-blocking update check in desktop runtime only
- settings or app-level entry point: provide a user-triggered “Check for updates” action

Startup behavior:

- only run when desktop runtime is active
- only run when env enables startup checks
- never block initial render
- persist the latest check result in state

### 7. Error Handling

Update checks must degrade cleanly:

- missing base URL or app ID: mark update capability unavailable
- missing token: attempt anonymous request if supported; otherwise surface a clear auth error
- network failure: produce stable error state
- malformed backend data: produce stable parse error state

At no point should update errors break app bootstrap or page rendering.

### 8. Testing Strategy

Follow TDD:

- env tests for parsing, defaults, normalization, and token resolution
- update client tests for URL, method, headers, and request body assembly
- business service tests for runtime-info to request mapping
- optional UI/store tests for startup check status transitions if UI state is added in this slice

## Why This Approach

This design matches the current monorepo architecture, preserves desktop/runtime boundaries, and keeps future changes isolated. The backend update API may still evolve, so the correct move is to centralize env and API integration first, expose stable local contracts second, and defer native installer protocol work until the server contract is stable.

## Out Of Scope For This Slice

- Native binary download and install orchestration
- Tauri updater plugin integration against a self-hosted updater protocol
- Background delta patching
- Release publishing pipeline changes

## Completion Criteria

This slice is complete when:

- a centralized typed env module exists and is documented
- desktop update checks call the backend using env-based base URL and token
- update results are mapped into stable local contracts
- the app can trigger a check from a business-facing API
- the app can resolve and open the recommended update target
- update failures do not affect normal desktop app startup
