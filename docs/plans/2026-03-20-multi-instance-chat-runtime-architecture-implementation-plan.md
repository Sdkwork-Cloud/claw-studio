# Multi-Instance Chat Runtime Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock-backed instance and chat state with a Tauri-backed multi-instance runtime model that seeds a built-in local OpenClaw instance and persists conversations through the runtime storage profile.

**Architecture:** Add shared runtime and conversation domain contracts, expose them through a new studio platform API, implement a Tauri `studio` service with document repositories over the active storage profile, and sync the existing chat UI against that backend. Keep the system SQL-ready by preserving repository seams and storage binding metadata.

**Tech Stack:** TypeScript, React, Zustand, Tauri 2, Rust, serde, existing storage profile abstraction.

---

### Task 1: Add shared studio domain contracts

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/index.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/registry.ts`
- Create: `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`

**Step 1: Write the failing test**

Add a focused contract check later through TypeScript build coverage by referencing the new exports from both infrastructure and desktop bridge code.

**Step 2: Run test to verify it fails**

Run: `pnpm lint`
Expected: FAIL because the new studio platform types and registry hooks do not exist yet.

**Step 3: Write minimal implementation**

- Add shared runtime, instance, storage binding, conversation, and message contracts.
- Extend the platform bridge with a `studio` API surface.
- Add a localStorage-backed web fallback implementation.

**Step 4: Run test to verify it passes**

Run: `pnpm lint`
Expected: PASS for the new type exports and platform bridge wiring.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts packages/sdkwork-claw-infrastructure/src/platform/index.ts packages/sdkwork-claw-infrastructure/src/platform/registry.ts packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts
git commit -m "feat: add shared studio runtime and chat contracts"
```

### Task 2: Implement the Tauri studio backend service and commands

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`

**Step 1: Write the failing test**

Add Rust unit tests for:

- seeding `local-built-in`
- CRUD for a remote instance
- persisting and reloading a conversation document

**Step 2: Run test to verify it fails**

Run: `cargo test studio --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because the new service and commands do not exist yet.

**Step 3: Write minimal implementation**

- Add a `studio` framework service that stores instance registry and conversation documents through the active storage profile.
- Seed and refresh the built-in OpenClaw instance from managed runtime files.
- Add commands for instance list/get/create/update/delete, instance config and logs, conversation list/upsert/delete.
- Expose command names in the desktop catalog and Tauri bridge.

**Step 4: Run test to verify it passes**

Run: `cargo test studio --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS for studio backend coverage.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs packages/sdkwork-claw-desktop/src/desktop/catalog.ts packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts
git commit -m "feat: add tauri studio backend for instances and conversations"
```

### Task 3: Replace mock-backed instance directory reads

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/instanceDirectoryService.ts`

**Step 1: Write the failing test**

Add a focused TypeScript assertion or smoke check by compiling the instance services against the new studio platform API.

**Step 2: Run test to verify it fails**

Run: `pnpm lint`
Expected: FAIL because the instance services still depend directly on `studioMockService`.

**Step 3: Write minimal implementation**

- Replace list, get, create, update, delete, status control, config, and logs with studio platform calls.
- Keep non-migrated workbench-only helpers on fallback behavior where needed.

**Step 4: Run test to verify it passes**

Run: `pnpm lint`
Expected: PASS for instance service integration.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-instances/src/services/instanceService.ts packages/sdkwork-claw-core/src/services/instanceDirectoryService.ts
git commit -m "feat: back instance directory with studio platform"
```

### Task 4: Move chat sessions to the backend-backed conversation store

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/store/useChatStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx`
- Create: `packages/sdkwork-claw-chat/src/services/studioConversationService.ts`

**Step 1: Write the failing test**

Use the typecheck as the minimum gate and rely on manual verification for send flow because no dedicated chat test harness exists yet.

**Step 2: Run test to verify it fails**

Run: `pnpm lint`
Expected: FAIL because the chat store still assumes browser-local persistence and no backend conversation service exists.

**Step 3: Write minimal implementation**

- Keep the existing chat UI but make the store backend-authoritative through hydration and optimistic sync.
- Persist every conversation by instance id.
- Preserve current model-streaming behavior while saving user and assistant messages to the backend.

**Step 4: Run test to verify it passes**

Run: `pnpm lint`
Expected: PASS for the new store and service wiring.

**Step 5: Commit**

```bash
git add packages/sdkwork-claw-chat/src/store/useChatStore.ts packages/sdkwork-claw-chat/src/pages/Chat.tsx packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx packages/sdkwork-claw-chat/src/services/studioConversationService.ts
git commit -m "feat: persist chat sessions through studio backend"
```

### Task 5: Verify desktop build and runtime contract integrity

**Files:**
- No code changes required unless a verification failure surfaces

**Step 1: Run Rust tests**

Run: `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 2: Run workspace lint**

Run: `pnpm lint`
Expected: PASS

**Step 3: Run production web build**

Run: `pnpm build`
Expected: PASS

**Step 4: Record manual verification**

Verify:

- app launch seeds `local-built-in`
- instance switch changes the visible conversation set
- restarting the app preserves conversations
- deleting a conversation removes it after reload

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify multi-instance chat backend slice"
```

## Verification Checklist

- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- `pnpm lint`
- `pnpm build`

## Execution Mode

The user explicitly requested autonomous execution without waiting for another review gate, so this plan should be executed directly in the current session.
