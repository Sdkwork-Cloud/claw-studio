# Unified Gemini and Cross-Platform Env Install Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable routed Unified API Keys to configure Gemini CLI and add user-selectable, cross-platform environment-variable installation modes for supported API Router clients.

**Architecture:** Extend the API Router setup flow with capability-driven install modes and scopes, keep manual snippets and one-click setup aligned, and move persistent environment writes into a structured desktop installer contract. Gemini routed support is implemented by reusing provider-based config generation and by writing the extra env keys required by the official Gemini CLI for custom base URLs.

**Tech Stack:** TypeScript, React, pnpm workspace services, Tauri bridge, Rust, serde_json, toml_edit

---

### Task 1: Document the design and implementation scope

**Files:**
- Modify: `docs/plans/2026-03-19-unified-gemini-env-install-design.md`
- Modify: `docs/plans/2026-03-19-unified-gemini-env-install-implementation-plan.md`

**Step 1: Re-read the current API Router setup architecture**

Run: `Get-Content -Path 'packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts' -TotalCount 260`
Expected: the current unified-key Gemini block is still present and needs implementation work.

**Step 2: Confirm the written plan still matches the codebase**

Run: `Get-Content -Path 'packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts' -TotalCount 260`
Expected: installer contract does not yet include install mode or env scope.

**Step 3: Update the documents if any file paths or responsibilities drift**

Expected: docs stay aligned with the current file layout before code work starts.

### Task 2: Add failing TypeScript tests for unified Gemini support

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.test.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`

**Step 1: Write the failing tests**

Add tests that assert:

- unified API key Gemini config is available
- unified API key Gemini setup no longer throws the direct-Google-key error
- Gemini routed snippets include `GOOGLE_GEMINI_BASE_URL`
- Gemini routed snippets include `GEMINI_API_KEY_AUTH_MECHANISM="bearer"`

**Step 2: Run the targeted tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.test.ts`
Expected: FAIL because Gemini is still marked unavailable or setup still throws.

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
Expected: FAIL because Gemini snippets do not yet include the routed env variables.

**Step 3: Write the minimal TypeScript implementation**

Modify:

- `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts`
- `packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts`

Expected: tests can pass with the smallest change that enables routed Gemini support.

**Step 4: Re-run the targeted tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
Expected: PASS

### Task 3: Add failing tests for install-mode capability metadata

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts`

**Step 1: Write the failing tests**

Add tests that assert:

- capability metadata exposes the supported install modes for Codex, OpenCode, Claude Code, and Gemini
- Gemini supports `env` mode
- Codex and OpenCode support `both`

**Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
Expected: FAIL because the capability metadata does not exist yet.

**Step 3: Implement the minimal capability metadata**

Modify:

- `packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts`

**Step 4: Re-run the test**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
Expected: PASS

### Task 4: Thread install preferences through the apply services and dialogs

**Files:**
- Modify: `packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts`
- Modify: `packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx`
- Modify: `packages/sdkwork-claw-apirouter/src/components/ApiRouterAccessMethodShared.tsx`

**Step 1: Write the failing tests or assertions for request shape changes**

Add or extend service tests to assert install requests carry:

- `installMode`
- `envScope` when applicable

**Step 2: Run the relevant tests to verify failure**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.test.ts`
Expected: FAIL because install preferences are not forwarded yet.

**Step 3: Implement the minimal service and UI changes**

Expected:

- dialogs expose supported options from capability metadata
- apply services send the selected preferences to the installer layer
- manual preview remains platform-aware

**Step 4: Re-run the targeted tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.test.ts`
Expected: PASS

### Task 5: Add failing Rust tests for env install modes and Gemini routed persistence

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`

**Step 1: Write the failing Rust tests**

Add tests that assert:

- Gemini standard install writes the routed base URL and bearer auth mechanism into `~/.gemini/.env`
- env-only install can persist supported keys without writing standard config files
- both mode writes both config files and persistent env state
- unsupported or invalid combinations fail with clear validation errors

**Step 2: Run the focused Rust test target and verify failure**

Run: `cargo test api_router --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because install mode and env scope are not implemented yet.

**Step 3: Write the minimal Rust implementation**

Modify:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

Expected: structured install requests are accepted and routed to platform-specific env persistence logic.

**Step 4: Re-run the focused Rust tests**

Run: `cargo test api_router --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 6: Add Unix and Windows env persistence helpers and keep them idempotent

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`

**Step 1: Write the failing tests for helper behavior**

Add helper-level assertions for:

- replacing an existing managed env value without duplication
- preserving unrelated profile content
- stable managed block output

**Step 2: Run the Rust tests to verify failure**

Run: `cargo test api_router --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL until the helpers are implemented.

**Step 3: Implement the minimal helpers**

Expected:

- Windows gets native environment persistence support
- Unix gets managed include-file plus profile-loader behavior
- repeat execution stays idempotent

**Step 4: Re-run the Rust tests**

Run: `cargo test api_router --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 7: Run end-to-end targeted verification

**Files:**
- Modify: none

**Step 1: Run the TypeScript service tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.test.ts`
Expected: PASS

Run: `node --experimental-strip-types packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.test.ts`
Expected: PASS

**Step 2: Run the focused package verification**

Run: `pnpm check:sdkwork-apirouter`
Expected: PASS

**Step 3: Run the Rust verification**

Run: `cargo test api_router --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 4: Run any lightweight compile checks that are stable in this repo**

Run: `pnpm exec esbuild packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx --bundle --platform=browser --format=esm --outfile=$env:TEMP\\unified-dialog.js`
Expected: PASS

Run: `pnpm exec esbuild packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts --bundle --platform=node --format=esm --outfile=$env:TEMP\\provider-access-config.js`
Expected: PASS

### Task 8: Review the diff and document any residual gaps

**Files:**
- Modify: none

**Step 1: Inspect the final diff**

Run: `git diff -- packages/sdkwork-claw-apirouter packages/sdkwork-claw-infrastructure packages/sdkwork-claw-desktop docs/plans`
Expected: only the intended files for this feature are included.

**Step 2: Record any non-blocking repo issues discovered during verification**

Expected: note pre-existing failures separately so they are not confused with this feature.
