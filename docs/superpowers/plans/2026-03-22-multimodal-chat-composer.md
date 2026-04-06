# Multimodal Chat Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Claw Studio chat to support polished file attachments, image paste/drop, voice messages, screenshot capture, optional screen recording, and S3 presigned uploads with attachment-aware message persistence and rendering.

**Architecture:** Keep remote upload logic in `@sdkwork/claw-core` through the generated `@sdkwork/app-sdk` upload surface, keep desktop-native screenshot capture in `@sdkwork/claw-desktop`, and keep chat composition/rendering inside `@sdkwork/claw-chat`. Persist attachment metadata in the shared conversation record so local and desktop storage remain consistent.

**Tech Stack:** React 19, TypeScript, Zustand, Tauri 2, Rust, `@sdkwork/app-sdk`, browser MediaRecorder APIs, native screenshot capture via a Rust crate.

---

### Task 1: Extend Shared Conversation Types For Attachments

**Files:**
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-chat/src/types/index.ts`
- Modify: `packages/sdkwork-claw-chat/src/chatSessionMapping.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/useChatStore.ts`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`

- [ ] **Step 1: Add a failing attachment mapping test**

Create or extend tests so a stored conversation with attachment metadata round-trips through the chat mapping layer and preserves message attachments.

- [ ] **Step 2: Run the targeted test and verify it fails for missing attachment support**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatAttachmentPayload.test.ts`

- [ ] **Step 3: Add canonical conversation attachment types**

Define attachment metadata for image, file, audio, video, screenshot, screen recording, and link references. Keep them optional and backward compatible.

- [ ] **Step 4: Update message/session models and storage mappings**

Thread the optional attachment array through chat message types, TS mapping code, and the Rust desktop conversation record serializer.

- [ ] **Step 5: Re-run the attachment mapping test**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatAttachmentPayload.test.ts`

### Task 2: Add Generated-SDK Presigned Upload Service

**Files:**
- Create: `packages/sdkwork-claw-core/src/services/chatUploadService.ts`
- Create: `packages/sdkwork-claw-core/src/services/chatUploadService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/index.ts`

- [ ] **Step 1: Write failing tests for object key generation, presigned upload, and register flow**

Cover:
- deterministic object key formatting
- `getPresignedUrl` followed by `fetch PUT`
- `registerPresigned` returning a normalized attachment payload
- failure handling when PUT or registration fails

- [ ] **Step 2: Run the new upload service tests and verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/chatUploadService.test.ts`

- [ ] **Step 3: Implement the upload service through `@sdkwork/app-sdk`**

Use `getAppSdkClientWithSession().upload` only. Do not add raw business HTTP clients outside the presigned `PUT` itself.

- [ ] **Step 4: Normalize uploaded assets into chat attachment objects**

Include stable ids, file kind, mime type, size, object key, preview URL/access URL, and human-readable labels.

- [ ] **Step 5: Re-run the upload service tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-core/src/services/chatUploadService.test.ts`

### Task 3: Add Composer Utilities For Attachments And Outgoing Payloads

**Files:**
- Create: `packages/sdkwork-claw-chat/src/services/chatComposerAttachments.ts`
- Create: `packages/sdkwork-claw-chat/src/services/chatComposerAttachments.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/index.ts`

- [ ] **Step 1: Write failing tests for attachment classification and outgoing prompt composition**

Cover:
- kind detection from mime/type/source
- text fallback when sending attachments to text-only models
- OpenClaw attachment payload mapping
- title derivation when a message is attachment-only

- [ ] **Step 2: Run the composer utility tests and verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatComposerAttachments.test.ts`

- [ ] **Step 3: Implement the composer utility module**

Keep the send pipeline centralized and deterministic. Generate a clean textual summary for providers that only accept text.

- [ ] **Step 4: Re-run the composer utility tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatComposerAttachments.test.ts`

### Task 4: Add Desktop Screenshot Bridge

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/types.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/web.ts`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/commands/capture_screenshot.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Add a failing desktop contract test or command smoke expectation**

At minimum, update the desktop command surface contract so the new screenshot command is required.

- [ ] **Step 2: Run the relevant desktop contract test and verify it fails**

Run: `node scripts/check-desktop-platform-foundation.mjs`

- [ ] **Step 3: Implement a native screenshot command**

Use a mature Rust screen-capture crate. Return PNG bytes and monitor metadata in a frontend-friendly shape.

- [ ] **Step 4: Expose the command through the desktop bridge and a safe web fallback**

Desktop uses native capture. Web returns unsupported so the chat UI can hide or degrade gracefully.

- [ ] **Step 5: Re-run the desktop contract test**

Run: `node scripts/check-desktop-platform-foundation.mjs`

### Task 5: Build The Multimodal Chat Composer UI

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/components/ChatInput.tsx`
- Modify: `packages/sdkwork-claw-chat/src/components/ChatMessage.tsx`
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/services/chatService.ts`
- Modify: `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`

- [ ] **Step 1: Add failing tests for the chat send pipeline**

Cover attachment-aware send behavior, including:
- local persistence of attachments
- outgoing text fallback for direct LLM providers
- attachment arrays being passed through the OpenClaw gateway client

- [ ] **Step 2: Run the chat tests and verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/useChatStore.test.ts`

- [ ] **Step 3: Implement the polished composer**

Add:
- drag/drop and paste support
- file/image attach
- URL add flow
- voice recording
- screen recording
- native screenshot insert
- attachment chips, previews, progress, failure states, and retry/remove actions

- [ ] **Step 4: Update message rendering**

Render images, audio, video, screenshots, recordings, links, and generic file cards inside the chat transcript.

- [ ] **Step 5: Wire the send pipeline**

Upload assets before send, persist attachment metadata in user messages, include attachment context for provider chat, and pass attachment payloads to OpenClaw gateway requests.

- [ ] **Step 6: Re-run targeted chat tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatComposerAttachments.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/useChatStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`

### Task 6: Verify End To End

**Files:**
- Modify as needed from previous tasks

- [ ] **Step 1: Run package-level targeted tests**

Run:
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/chatUploadService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatComposerAttachments.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/store/useChatStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts`

- [ ] **Step 2: Run workspace architectural verification**

Run: `pnpm check:arch`

- [ ] **Step 3: Run the main type/build verification**

Run:
- `pnpm lint`
- `pnpm build`

- [ ] **Step 4: If a desktop-only change was made, run desktop verification**

Run: `pnpm check:desktop`

- [ ] **Step 5: Only after fresh passing output, summarize results and residual risk**
