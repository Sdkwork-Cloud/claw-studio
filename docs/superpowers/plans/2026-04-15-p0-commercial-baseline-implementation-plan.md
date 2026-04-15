# P0 Commercial Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a trustworthy commercial-delivery baseline by fixing the current toolchain gate failure, removing browser-side root token injection, enforcing a browser persistence whitelist, and tightening control-plane CORS/auth exposure rules.

**Architecture:** Execute the approved `P0 Commercial Baseline` spec as one bounded first slice: `Phase A + Phase B + the minimum viable subset of Phase C`. Keep trusted credential and runtime truth in the server/desktop hosts, reduce browser mode to view plus non-sensitive cache, and freeze the resulting boundary rules into formal regression gates before touching broader feature work.

**Tech Stack:** TypeScript 6, Vite host configs, Node.js ESM scripts, `node:test` / strip-types test runners, Rust/Axum host runtime, Tauri desktop host, existing parity/release gate scripts

---

## Spec Reference

- `docs/superpowers/specs/2026-04-15-p0-commercial-baseline-design.md`

## Execution Notes

- Run `pnpm.cmd`, not `pnpm`, from PowerShell on this machine to avoid `.ps1` execution-policy failures.
- Keep the first execution slice limited to the baseline closure. Do not fold in unrelated UI polish, feature additions, or broad refactors.
- When a step says “record the next blocker,” update the plan progress notes before widening scope.

## File Map

### Toolchain And Gate Baseline

- `tsconfig.base.json`
  - workspace TypeScript baseline; remove or replace unsupported `ignoreDeprecations` usage
- `package.json`
  - formal gate wiring for new contract tests
- `scripts/run-workspace-tsc.mjs`
  - existing TSC runner proving host compilation
- `scripts/openclaw-quality-gate-contract.test.mjs`
  - gate wiring assertions for parity/automation

### Browser Secret Boundary

- `packages/sdkwork-claw-web/vite.config.ts`
  - web host Vite env injection
- `packages/sdkwork-claw-desktop/vite.config.ts`
  - desktop host Vite env injection
- `packages/sdkwork-claw-web/src/vite-env.d.ts`
  - web import-meta env typing
- `packages/sdkwork-claw-desktop/src/vite-env.d.ts`
  - desktop import-meta env typing
- `packages/sdkwork-claw-infrastructure/src/config/env.ts`
  - browser/runtime env parsing and update capability config
- `packages/sdkwork-claw-infrastructure/src/config/env.test.ts`
  - env contract coverage
- `packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts`
  - update-check request auth path
- `packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts`
  - update auth contract coverage
- `.env.example`
  - root documented env surface
- `.env.development`
  - tracked dev env surface
- `.env.test`
  - tracked test env surface
- `.env.production`
  - tracked prod env surface
- `packages/sdkwork-claw-web/.env.example`
  - web package env surface
- `packages/sdkwork-claw-desktop/.env.example`
  - desktop package env surface
- `docs/reference/environment.md`
  - English env reference
- `docs/zh-CN/reference/environment.md`
  - Chinese env reference
- `docs/guide/getting-started.md`
  - English getting-started guide
- `docs/zh-CN/guide/getting-started.md`
  - Chinese getting-started guide
- `docs/core/desktop.md`
  - English desktop env documentation
- `docs/zh-CN/core/desktop.md`
  - Chinese desktop env documentation
- `scripts/sdkwork-core-contract.test.ts`
  - env/docs contract coverage that still references `VITE_ACCESS_TOKEN`

### Browser Persistence Boundary

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
  - browser demo platform implementation currently persisting sensitive fields
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - browser-backed workbench/runtime fact-source tests
- `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.ts`
  - new explicit persistence whitelist and sanitization helpers
- `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts`
  - new unit tests for the whitelist policy
- `scripts/run-sdkwork-foundation-check.mjs`
  - include new persistence-policy unit test in the formal runner

### Server Control-Plane Exposure

- `packages/sdkwork-claw-server/src-host/src/http/router.rs`
  - current broad CORS middleware
- `packages/sdkwork-claw-server/src-host/src/http/auth.rs`
  - existing auth helpers; adjust only if surface-specific response behavior needs shared helpers
- `packages/sdkwork-claw-server/src-host/src/http/cors_policy.rs`
  - new surface-aware CORS policy helper if extraction is warranted
- `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
  - expose new CORS policy module if created
- `packages/sdkwork-claw-server/src-host/src/main.rs`
  - existing Rust integration tests for hosted browser preflight and response headers

### Boundary Contracts

- `scripts/typescript-toolchain-contract.test.mjs`
  - new contract ensuring the workspace TS baseline stays valid for the active toolchain
- `scripts/client-secret-boundary-contract.test.mjs`
  - new contract ensuring host bundles and env typings no longer expose browser root-token injection
- `scripts/browser-persistence-policy-contract.test.mjs`
  - new contract ensuring browser persistence rules are wired into formal checks
- `scripts/control-plane-cors-auth-contract.test.mjs`
  - new contract ensuring route/gate wiring covers control-plane exposure hardening

## Task 1: Restore The TypeScript 6 Gate Baseline

**Files:**
- Create: `scripts/typescript-toolchain-contract.test.mjs`
- Modify: `tsconfig.base.json`
- Modify: `package.json`
- Test: `scripts/typescript-toolchain-contract.test.mjs`

- [ ] **Step 1: Write the failing toolchain contract**

Create `scripts/typescript-toolchain-contract.test.mjs` so it asserts:

- `tsconfig.base.json` does not pin an `ignoreDeprecations` value rejected by the active TypeScript toolchain
- `package.json` keeps `pnpm check:automation` or equivalent running this contract

- [ ] **Step 2: Run the new contract to capture the current failure**

Run:

```powershell
node scripts/typescript-toolchain-contract.test.mjs
```

Expected:

- FAIL because `tsconfig.base.json` still contains the unsupported `ignoreDeprecations: "6.0"` baseline

- [ ] **Step 3: Change the workspace TS baseline to an accepted configuration**

Update `tsconfig.base.json` to the smallest valid fix:

- prefer removing `ignoreDeprecations` entirely if the active toolchain no longer needs it
- if a value is still required, use only a compiler-accepted value verified by the active `typescript` version in this workspace

- [ ] **Step 4: Wire the toolchain contract into formal automation**

Update `package.json` so the new contract is part of the formal automated gate path that runs before claiming the baseline is restored.

- [ ] **Step 5: Re-run the targeted contract and top-level lint gate**

Run:

```powershell
node scripts/typescript-toolchain-contract.test.mjs
pnpm.cmd lint
```

Expected:

- the new contract passes
- `pnpm.cmd lint` advances beyond the current `TS5103` failure
- if another gate fails next, record that exact blocker before expanding scope

- [ ] **Step 6: Commit**

```bash
git add scripts/typescript-toolchain-contract.test.mjs tsconfig.base.json package.json
git commit -m "fix: restore typescript toolchain gate"
```

### Task 2: Remove Browser Root-Token Injection From Host Builds And Update Checks

**Files:**
- Modify: `packages/sdkwork-claw-web/vite.config.ts`
- Modify: `packages/sdkwork-claw-desktop/vite.config.ts`
- Modify: `packages/sdkwork-claw-web/src/vite-env.d.ts`
- Modify: `packages/sdkwork-claw-desktop/src/vite-env.d.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/config/env.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/config/env.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts`
- Modify: `.env.example`
- Modify: `.env.development`
- Modify: `.env.test`
- Modify: `.env.production`
- Modify: `packages/sdkwork-claw-web/.env.example`
- Modify: `packages/sdkwork-claw-desktop/.env.example`
- Modify: `docs/reference/environment.md`
- Modify: `docs/zh-CN/reference/environment.md`
- Modify: `docs/guide/getting-started.md`
- Modify: `docs/zh-CN/guide/getting-started.md`
- Modify: `docs/core/desktop.md`
- Modify: `docs/zh-CN/core/desktop.md`
- Modify: `scripts/sdkwork-core-contract.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/config/env.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts`
- Test: `scripts/sdkwork-core-contract.test.ts`

- [ ] **Step 1: Rewrite the env and update tests to express the new boundary**

Update `env.test.ts` and `updateClient.test.ts` so they now assert:

- no browser `readAccessToken()` path exists for update checks
- `createAppEnvConfig()` no longer exposes `VITE_ACCESS_TOKEN` as a browser runtime contract
- `checkAppUpdate()` does not call `setApiKey()` from browser env state

Update `scripts/sdkwork-core-contract.test.ts` so it fails while any host env example, Vite config, or env typing still references `VITE_ACCESS_TOKEN`.

- [ ] **Step 2: Run the focused tests to capture the current failure**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/config/env.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts
node --experimental-strip-types scripts/sdkwork-core-contract.test.ts
```

Expected:

- the updated tests fail because the current browser env and Vite configs still expose `VITE_ACCESS_TOKEN`

- [ ] **Step 3: Remove browser token injection and simplify the update-check credential model**

Implement the smallest trusted-boundary fix:

- delete `import.meta.env.VITE_ACCESS_TOKEN` injection from both host Vite configs
- remove `VITE_ACCESS_TOKEN` from host `ImportMetaEnv` typings
- remove `readAccessToken()` and any equivalent browser-root update auth path from `env.ts` / `updateClient.ts`
- keep update checks using only `VITE_API_BASE_URL`, `VITE_APP_ID`, release-channel, runtime metadata, and any future host-mediated credential path

- [ ] **Step 4: Clean up tracked env examples and docs**

Update all tracked env files and docs listed above so they no longer advertise `VITE_ACCESS_TOKEN` as a supported browser or desktop-shell setting.

- [ ] **Step 5: Re-run the focused tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/config/env.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts
node --experimental-strip-types scripts/sdkwork-core-contract.test.ts
```

Expected:

- all focused tests pass
- no tracked env file or Vite config still documents or injects the root token

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-web/vite.config.ts packages/sdkwork-claw-desktop/vite.config.ts packages/sdkwork-claw-web/src/vite-env.d.ts packages/sdkwork-claw-desktop/src/vite-env.d.ts packages/sdkwork-claw-infrastructure/src/config/env.ts packages/sdkwork-claw-infrastructure/src/config/env.test.ts packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts .env.example .env.development .env.test .env.production packages/sdkwork-claw-web/.env.example packages/sdkwork-claw-desktop/.env.example docs/reference/environment.md docs/zh-CN/reference/environment.md docs/guide/getting-started.md docs/zh-CN/guide/getting-started.md docs/core/desktop.md docs/zh-CN/core/desktop.md scripts/sdkwork-core-contract.test.ts
git commit -m "fix: remove browser update token injection"
```

### Task 3: Enforce A Browser Persistence Whitelist In The Demo Platform

**Files:**
- Create: `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- Modify: `scripts/run-sdkwork-foundation-check.mjs`
- Create: `scripts/browser-persistence-policy-contract.test.mjs`
- Modify: `package.json`
- Test: `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- Test: `scripts/browser-persistence-policy-contract.test.mjs`

- [ ] **Step 1: Write the failing whitelist and integration tests**

Add `browserPersistencePolicy.test.ts` with cases like:

```ts
assert.equal(isPersistableClientField('authToken'), false);
assert.equal(isPersistableClientField('token'), false);
assert.equal(isPersistableClientField('workspacePath'), false);
assert.equal(isPersistableClientField('description'), true);
```

Update `webStudio.test.ts` so it fails while:

- channel `token` values are still persisted to storage
- provider `apiKeySource` or other sensitive config survives round-trip persistence
- instance `authToken` / trusted endpoint state persists as production truth in browser demo mode

Add `scripts/browser-persistence-policy-contract.test.mjs` so the formal runner and package script wiring fail until the new unit test is part of the baseline.

- [ ] **Step 2: Run the focused persistence tests to capture the current failure**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts
node scripts/browser-persistence-policy-contract.test.mjs
```

Expected:

- FAIL because `webStudio.ts` still persists sensitive values to browser storage and the new policy is not yet wired

- [ ] **Step 3: Implement the whitelist policy and apply it to browser writes**

Create `browserPersistencePolicy.ts` with helpers that:

- classify persistable vs non-persistable fields
- sanitize nested records before browser storage writes
- preserve enough metadata for UI display such as configured-field counts and status without keeping raw secrets

Update `webStudio.ts` so browser-demo persistence:

- strips `authToken`, provider secrets, bot tokens, signing secrets, and workspace paths from stored records
- stores only non-sensitive projections and counts
- keeps trusted runtime state as read-only host projection, not browser truth

- [ ] **Step 4: Wire the new unit and contract tests into the formal baseline**

Update `scripts/run-sdkwork-foundation-check.mjs` and `package.json` so the new persistence-policy tests run as part of the formal baseline and not only as ad hoc developer checks.

- [ ] **Step 5: Re-run the focused persistence tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts
node scripts/browser-persistence-policy-contract.test.mjs
```

Expected:

- the whitelist unit tests pass
- `webStudio.test.ts` passes with sanitized browser persistence
- the contract test confirms the new coverage is formally wired

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.ts packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts scripts/run-sdkwork-foundation-check.mjs scripts/browser-persistence-policy-contract.test.mjs package.json
git commit -m "fix: enforce browser persistence whitelist"
```

### Task 4: Split Server Control-Plane CORS Policy By Surface

**Files:**
- Create: `packages/sdkwork-claw-server/src-host/src/http/cors_policy.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/mod.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/router.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/http/auth.rs`
- Modify: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Create: `scripts/control-plane-cors-auth-contract.test.mjs`
- Modify: `package.json`
- Test: `packages/sdkwork-claw-server/src-host/src/main.rs`
- Test: `scripts/control-plane-cors-auth-contract.test.mjs`

- [ ] **Step 1: Write the failing Rust and script contracts**

Add or update Rust integration tests in `main.rs` so they assert:

- desktop-hosted startup origin remains allowed for the exact startup routes that need it
- arbitrary remote origins are not mirrored onto `manage` and `internal` surfaces
- `public api` behavior stays intentionally narrower than control-plane behavior

Add `scripts/control-plane-cors-auth-contract.test.mjs` so gate wiring fails until the new surface-aware tests are part of the formal baseline.

- [ ] **Step 2: Run the targeted server tests to capture the current failure**

Run:

```powershell
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml desktop_combined_hosted_startup_preflight_allows_browser_session_header_for_critical_routes -- --exact
node scripts/control-plane-cors-auth-contract.test.mjs
```

Expected:

- after updating the tests, at least one assertion fails because the current middleware still mirrors broad CORS behavior across all `/claw/*` routes

- [ ] **Step 3: Extract a surface-aware CORS policy helper**

Create `cors_policy.rs` and update `router.rs` so:

- `public api`, `manage api`, and `internal api` are classified explicitly
- desktop-hosted startup origins remain allowed only where required
- management and internal surfaces stop mirroring arbitrary origins
- existing auth semantics in `auth.rs` stay aligned with the surface split

- [ ] **Step 4: Wire the contract into the formal gate**

Update `package.json` so the new control-plane contract test becomes part of the formal automation path.

- [ ] **Step 5: Re-run the targeted server tests and the full server gate**

Run:

```powershell
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
node scripts/control-plane-cors-auth-contract.test.mjs
pnpm.cmd check:server
```

Expected:

- the Rust integration tests pass
- the control-plane contract passes
- `pnpm.cmd check:server` remains green after the surface split

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-server/src-host/src/http/cors_policy.rs packages/sdkwork-claw-server/src-host/src/http/mod.rs packages/sdkwork-claw-server/src-host/src/http/router.rs packages/sdkwork-claw-server/src-host/src/http/auth.rs packages/sdkwork-claw-server/src-host/src/main.rs scripts/control-plane-cors-auth-contract.test.mjs package.json
git commit -m "fix: tighten control plane cors boundaries"
```

### Task 5: Freeze Browser Secret-Boundary Contracts Into Formal Gates

**Files:**
- Create: `scripts/client-secret-boundary-contract.test.mjs`
- Modify: `scripts/openclaw-quality-gate-contract.test.mjs`
- Modify: `package.json`
- Test: `scripts/client-secret-boundary-contract.test.mjs`
- Test: `scripts/openclaw-quality-gate-contract.test.mjs`

- [ ] **Step 1: Write the failing browser secret-boundary contract**

Create `scripts/client-secret-boundary-contract.test.mjs` so it fails while:

- either host Vite config still injects `VITE_ACCESS_TOKEN`
- either host `vite-env.d.ts` still types `VITE_ACCESS_TOKEN`
- tracked env examples still advertise browser root-token injection

- [ ] **Step 2: Run the new contract to confirm the current baseline is not frozen yet**

Run:

```powershell
node scripts/client-secret-boundary-contract.test.mjs
```

Expected:

- FAIL until the new contract and gate wiring are fully aligned with the Task 2 implementation

- [ ] **Step 3: Wire the contract into formal automation**

Update:

- `package.json`
- `scripts/openclaw-quality-gate-contract.test.mjs`

so the secret-boundary and persistence-boundary checks are both required parts of the formal quality gate.

- [ ] **Step 4: Re-run the contract tests**

Run:

```powershell
node scripts/client-secret-boundary-contract.test.mjs
node scripts/openclaw-quality-gate-contract.test.mjs
```

Expected:

- both tests pass
- the formal quality-gate contract now enforces the new browser-boundary rules

- [ ] **Step 5: Commit**

```bash
git add scripts/client-secret-boundary-contract.test.mjs scripts/openclaw-quality-gate-contract.test.mjs package.json
git commit -m "test: freeze browser boundary contracts"
```

### Task 6: Verify The Full P0 First Slice

**Files:**
- Test: `scripts/typescript-toolchain-contract.test.mjs`
- Test: `scripts/client-secret-boundary-contract.test.mjs`
- Test: `scripts/browser-persistence-policy-contract.test.mjs`
- Test: `scripts/control-plane-cors-auth-contract.test.mjs`
- Test: `packages/sdkwork-claw-infrastructure/src/config/env.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts`
- Test: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- Test: `scripts/sdkwork-core-contract.test.ts`

- [ ] **Step 1: Run the focused boundary and unit contracts**

Run:

```powershell
node scripts/typescript-toolchain-contract.test.mjs
node scripts/client-secret-boundary-contract.test.mjs
node scripts/browser-persistence-policy-contract.test.mjs
node scripts/control-plane-cors-auth-contract.test.mjs
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/config/env.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts
node --experimental-strip-types scripts/sdkwork-core-contract.test.ts
```

Expected:

- all focused contracts pass

- [ ] **Step 2: Run the formal workspace gates**

Run:

```powershell
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd check:server
pnpm.cmd check:desktop
pnpm.cmd check:release-flow
```

Expected:

- all commands exit `0`
- no browser token injection path or persistence-policy regression remains hidden behind partial checks

- [ ] **Step 3: Record any residual blockers before Phase D**

Capture any remaining issues that are outside this first slice, especially:

- concentration-risk cleanup still pending in `webStudio.ts`
- concentration-risk cleanup still pending in `openClawGatewayClient.ts`
- any host-mediated update credential work intentionally deferred after removing the browser root-token path

