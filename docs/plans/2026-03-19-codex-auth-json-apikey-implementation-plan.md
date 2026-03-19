# Codex Auth JSON API Key Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Codex one-click setup so it follows the official API key authentication flow by writing `~/.codex/auth.json` and `~/.codex/config.toml`.

**Architecture:** Keep the existing API Router feature boundary intact. Update the frontend setup snippet generator to emit Codex `auth.json` plus a `config.toml` provider that uses `requires_openai_auth = true`, then update the Tauri installer to materialize those files instead of editing shell profile env blocks.

**Tech Stack:** TypeScript, React feature services, Rust Tauri framework services, Node strip-types tests, Rust unit tests

---

### Task 1: Lock the new Codex behavior with failing frontend tests

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.test.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.test.ts`

**Step 1: Write the failing test expectations**

Assert that Codex setup now:

- emits `~/.codex/auth.json`
- emits `~/.codex/config.toml`
- stores `auth_mode = apikey` and `OPENAI_API_KEY` in JSON
- uses `requires_openai_auth = true` in TOML
- no longer references shell profile env blocks

**Step 2: Run the focused frontend tests**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.test.ts
```

Expected: FAIL on current Codex expectations.

### Task 2: Update the frontend Codex setup generator

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.ts`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

**Step 1: Implement the minimal config changes**

Generate:

- `~/.codex/auth.json`
- `~/.codex/config.toml`

with Codex provider settings aligned to official source behavior:

- `requires_openai_auth = true`
- `wire_api = "responses"`
- no `env_key`
- no shell env snippet

**Step 2: Update UI copy**

Reflect that one-click setup writes `auth.json` and `config.toml`, not shell profile exports.

**Step 3: Re-run the focused frontend tests**

Run the three Node tests from Task 1.

Expected: PASS

### Task 3: Update the desktop installer and Rust tests

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`

**Step 1: Write the failing Rust test expectation**

Assert Codex installation writes:

- `.codex/config.toml`
- `.codex/auth.json`

and that config contains `requires_openai_auth = true`.

**Step 2: Run the targeted Rust test**

Run:

```bash
cargo test installs_codex_config_and_auth_json_for_api_key_flow --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: FAIL before implementation.

**Step 3: Implement the installer change**

Write managed Codex config and auth files, and remove shell profile mutation for Codex setup.

**Step 4: Re-run the targeted Rust test**

Run the same `cargo test` command.

Expected: PASS

### Task 4: Verify integration

**Files:**
- Modify only if verification reveals issues

**Step 1: Run focused verification**

Run:

```bash
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.test.ts
node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.test.ts
cargo test installs_codex_config_and_auth_json_for_api_key_flow --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
```

Expected: PASS

**Step 2: Run broader desktop-facing safety checks if the workspace remains stable**

Run:

```bash
pnpm check:sdkwork-apirouter
```

Expected: PASS, or only pre-existing unrelated failures.
