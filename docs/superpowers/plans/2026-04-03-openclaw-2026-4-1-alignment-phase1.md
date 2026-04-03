# OpenClaw 2026.4.1 Phase 1 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Claw Studio's built-in OpenClaw integration to stable `2026.4.1` by closing control-surface regressions, matching gateway/runtime behavior, and exposing the stable config additions that already fit the current architecture.

**Architecture:** Keep the current bundled-runtime, local-proxy, and managed-config architecture intact. Extend the existing seams only: Tauri Rust services for embedded runtime and proxy behavior, `openClawConfigService` for file-backed config projection, chat gateway client/store for websocket behavior, and the existing settings/instance workbench editors for product exposure. Phase 1 is deliberately limited to stable `2026.4.1` parity and regression coverage. Do not broaden scope into the `2026.4.2` beta config direction or a provider-schema redesign.

**Tech Stack:** pnpm workspace, TypeScript, React, Zustand, Node `--experimental-strip-types` tests, Tauri Rust services/tests, OpenClaw managed config files.

---

## File Map

### Runtime and embedded control-plane surfaces

- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\studio\openclaw_control.rs`
  - Owns the embedded OpenClaw console bridge and `/tools/invoke` control-plane integration.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\local_ai_proxy.rs`
  - Owns local proxy lifecycle, health endpoint, route testing, and managed OpenClaw projection behavior.

### Gateway chat behavior

- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\openclaw\openClawGatewayClient.ts`
  - Owns websocket `chat.history` request serialization.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\openClawGatewaySessionStore.ts`
  - Owns transcript refresh orchestration and active-session history loading.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\useChatStore.ts`
  - Owns gateway session-store instantiation and any new store-level options.

### Workbench and task projections

- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.ts`
  - Owns instance detail projection for channels, tasks, providers, agents, and tools.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\pages\InstanceDetail.tsx`
  - Owns the instance workbench shell and section rendering behavior.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-commons\src\components\CronTasksManager.tsx`
  - Owns task management surface behavior for cron/task rows.

### Config projection and product exposure

- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.ts`
  - Owns file-backed OpenClaw provider, channel, agent, and defaults projection.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\services\providerConfigCenterService.ts`
  - Owns provider center presets, route normalization, and local proxy application.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\ProviderConfigCenter.tsx`
  - Owns route table actions, test flows, and settings-center product surface.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\ProviderConfigEditorSheet.tsx`
  - Owns route editing UI for provider-specific runtime options.
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\components\AgentWorkbenchPanel.tsx`
  - Owns agent-specific configuration/readout in the instance workbench.

### Focused tests and contract coverage

- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\openclaw\openClawGatewayClient.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\openClawGatewaySessionStore.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\services\providerConfigCenterService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\providerConfigCenterPresentation.test.ts`
- Reference: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\config\openclaw-release.json`
- Reference: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\resources\openclaw\manifest.json`

---

### Task 1: Lock Embedded Control UI And Proxy HTTP Regressions

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\studio\openclaw_control.rs`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\local_ai_proxy.rs`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\studio\openclaw_control.rs`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-desktop\src-tauri\src\framework\services\local_ai_proxy.rs`

- [ ] **Step 1: Add failing Rust regressions for the built-in console path**

Cover these cases before changing production code:

- opening the embedded OpenClaw console still targets `/tools/invoke`
- the console bridge can resolve a running entity without returning `Internal Server Error`
- the proxy `/health` and `/v1/health` endpoints still report the running snapshot the console depends on

- [ ] **Step 2: Run the focused desktop Rust tests to verify the gap**

Run:

```powershell
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_control
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_ai_proxy
```

Expected:

- at least one assertion fails or exposes the exact mismatch between the running built-in instance and the control UI bridge

- [ ] **Step 3: Make the minimal runtime/control fix**

Allowed production changes:

- normalize control-plane target resolution
- fix built-in entity lookup or payload shaping
- preserve the existing embedded runtime and local proxy architecture

Not allowed:

- replacing the control bridge with a new transport
- redesigning the OpenClaw desktop integration

- [ ] **Step 4: Re-run the same focused Rust tests until green**

Run:

```powershell
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_control
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_ai_proxy
```

Expected:

- PASS

---

### Task 2: Thread `chat.history.maxChars` Through The Gateway Client And Store

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\openclaw\openClawGatewayClient.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\openclaw\openClawGatewayClient.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\openClawGatewaySessionStore.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\openClawGatewaySessionStore.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\useChatStore.ts`

- [ ] **Step 1: Write the failing transport tests first**

Add coverage for:

- `chat.history` includes `maxChars` when the caller supplies it
- legacy callers without `maxChars` still send the existing `limit` payload unchanged
- the session store can accept an optional history character cap without breaking current history refresh behavior

- [ ] **Step 2: Run the focused gateway/store tests to verify the failure**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts
```

Expected:

- FAIL because `maxChars` is not yet part of the request path

- [ ] **Step 3: Implement the smallest forward-compatible plumbing**

Production changes must:

- extend `getChatHistory` to accept `{ sessionKey, limit?, maxChars? }`
- serialize `maxChars` only when defined
- give the store an optional `historyMaxChars` setting so a later config surface can populate it without another transport change

- [ ] **Step 4: Re-run the focused gateway/store tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts
```

Expected:

- PASS

---

### Task 3: Harden Task Registry And Instance Workbench Stability Against `2026.4.1` Runtime Changes

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\pages\InstanceDetail.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-commons\src\components\CronTasksManager.tsx`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-instances-contract.test.ts`

- [ ] **Step 1: Add failing projection tests for stale or partial task/runtime payloads**

Cover the upstream-shaped cases most likely to regress:

- task entries missing optional metadata
- stale task ids that should degrade to empty or warning states instead of blanking the panel
- partial runtime summaries that should not block the rest of the instance workbench

- [ ] **Step 2: Run the focused instance tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts
node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts
```

Expected:

- FAIL on current stale-task or partial-payload handling

- [ ] **Step 3: Fix normalization and UI fallbacks without redesigning the page**

Production changes must:

- keep task/workbench projection resilient when OpenClaw omits or prunes runtime fields
- avoid page-level blank states when only one section payload is incomplete
- preserve the current tabs/section model instead of reworking the information architecture

- [ ] **Step 4: Re-run the focused instance checks**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts
node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts
```

Expected:

- PASS

---

### Task 4: Align Exec Approval Semantics With Upstream `allow-always` Behavior

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\openClawGatewayClient.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\openClawGatewayClient.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en\instances.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\components\AgentWorkbenchPanel.tsx`

- [ ] **Step 1: Write the failing gateway contract for persisted approval decisions**

Add coverage for:

- reading approvals from the official gateway methods
- writing an `allow-always` style decision without collapsing it into a one-shot approval
- preserving node-level approval APIs already exposed by the infrastructure client

- [ ] **Step 2: Run the focused infrastructure client tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts
```

Expected:

- FAIL or reveal a missing persisted approval mapping

- [ ] **Step 3: Implement semantic alignment and tighten wording**

Production changes must:

- preserve the official gateway method names already shipped in the infrastructure client
- represent a persistent "always allow" decision distinctly from transient approval
- update operator-facing wording only where the product already surfaces approval state

- [ ] **Step 4: Re-run the focused infrastructure checks**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts
```

Expected:

- PASS

---

### Task 5: Expose `agents.defaults.params` Through Config, Workbench Projection, And Agent UI

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\components\AgentWorkbenchPanel.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\pages\InstanceDetail.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en\instances.json`

- [ ] **Step 1: Add failing config-service and workbench tests first**

Cover:

- reading `agents.defaults.params`
- merging agent defaults with per-agent overrides in snapshots
- exposing parameter source information clearly enough for the workbench to show defaults versus overrides

- [ ] **Step 2: Run the focused config/workbench tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts
```

Expected:

- FAIL on missing defaults-param projection or editing support

- [ ] **Step 3: Implement minimal end-to-end defaults-param support**

Production changes must:

- keep `openClawConfigService` the single writer for config-file changes
- project effective params into workbench snapshots without duplicating config logic in React
- surface defaults in the agent UI as inherited values, not as silently copied overrides

- [ ] **Step 4: Re-run the focused config/workbench tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts
```

Expected:

- PASS

---

### Task 6: Extend Stable `2026.4.1` Config Knobs In Existing Editors

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\services\providerConfigCenterService.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\services\providerConfigCenterService.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\ProviderConfigCenter.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\ProviderConfigEditorSheet.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\providerConfigCenterPresentation.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\providerConfigCenterPresentation.test.ts`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-commons\src\components\CronTasksManager.tsx`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en\settings.json`
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-i18n\src\locales\en\instances.json`

- [ ] **Step 1: Add failing tests for the stable `2026.4.1` knobs that are currently missing**

Cover the existing architecture only:

- `gateway.webchat.chatHistoryMaxChars`
- `auth.cooldowns.rateLimitedProfileRotations`
- Telegram `errorPolicy` and `errorCooldownMs`
- WhatsApp `reactionLevel`
- cron/tool allowlist fields that belong in the current task/tool editors
- provider catalog additions that fit the current local proxy model, including SearXNG and Z.AI `glm-5.1` / `glm-5v-turbo`
- Bedrock guardrails fields only if they can live in the existing provider runtime schema without inventing a second config system

- [ ] **Step 2: Run the focused settings/core tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/providerConfigCenterPresentation.test.ts
```

Expected:

- FAIL on at least the currently missing config keys or catalog entries

- [ ] **Step 3: Implement the config and UI additions through the existing editors**

Production changes must:

- extend the current config projection instead of inventing a parallel schema
- keep provider-center additions inside the route editor and route presentation surfaces
- keep channel/task additions inside the existing instance/settings editors that already own those concerns
- avoid adding `2026.4.2`-style provider-specific extension architecture in this phase

- [ ] **Step 4: Re-run the focused settings/core tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/providerConfigCenterPresentation.test.ts
```

Expected:

- PASS

---

### Task 7: Run Phase 1 Verification Before Any Further OpenClaw Upgrade Work

**Files:**
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\services\openclaw\openClawGatewayClient.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-chat\src\store\openClawGatewaySessionStore.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-core\src\services\openClawConfigService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-infrastructure\src\services\openClawGatewayClient.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-instances\src\services\instanceWorkbenchService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\services\providerConfigCenterService.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\packages\sdkwork-claw-settings\src\providerConfigCenterPresentation.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-chat-contract.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-instances-contract.test.ts`
- Test: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\scripts\sdkwork-settings-contract.test.ts`

- [ ] **Step 1: Run the focused strip-types package tests**

Run:

```powershell
node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts
node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts
node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts
node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts
node --experimental-strip-types packages/sdkwork-claw-settings/src/providerConfigCenterPresentation.test.ts
```

Expected:

- PASS

- [ ] **Step 2: Run the OpenClaw-adjacent contract suites**

Run:

```powershell
node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts
node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts
node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Run the desktop and workspace verification gates**

Run:

```powershell
pnpm check:desktop
pnpm check:sdkwork-chat
pnpm check:sdkwork-instances
pnpm check:sdkwork-settings
pnpm lint
```

Expected:

- PASS
- no new OpenClaw parity regressions

- [ ] **Step 4: Record the remaining gap list separately**

Only after all Phase 1 verification passes:

- capture any leftover `2026.4.2` preparatory work as a new plan
- keep this plan closed as the stable `2026.4.1` alignment checkpoint
