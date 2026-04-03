# Instance Files Workbench VSCode Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the instance Files workbench display the correct file content for every click and align the tabs/editor chrome with VSCode-style single-line tabs, scroll buttons, and theme-aware visuals.

**Architecture:** Keep file identity strictly keyed by `file.id`, move file-body loading rules into focused workbench helpers, and make the UI treat list results as metadata only for remote OpenClaw files. Split the tab strip into a focused VSCode-like component so layout, scroll controls, and theme behavior are isolated from the large `InstanceDetail` page.

**Tech Stack:** React 19, TypeScript, Monaco Editor via `@monaco-editor/react`, existing workbench service tests using `node --experimental-strip-types`.

---

### Task 1: Lock the file-content identity bug with failing tests

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.ts`

- [ ] **Step 1: Write a failing helper test for remote files that must ignore list-level body content**

```ts
await runTest(
  'getWorkbenchFileResolvedContent prefers fetched cache over remote list content and otherwise shows empty while loading',
  () => {
    const file = createFile('openclaw-agent-file:ops:AGENTS.md', 'AGENTS.md', {
      content: '# stale list content',
    });

    assert.equal(
      getWorkbenchFileResolvedContent({
        file,
        loadedFileContents: {},
        runtimeKind: 'openclaw',
        isBuiltIn: false,
      }),
      '',
    );
  },
);
```

- [ ] **Step 2: Write a failing service test proving OpenClaw file catalogs must not inline body content from `listAgentFiles`**

```ts
await runTest(
  'listInstanceFiles strips list-level OpenClaw content so the UI must fetch the file body by id',
  async () => {
    const files = await service.listInstanceFiles('openclaw-prod', [opsAgent]);
    assert.equal(files[0]?.content, '');
  },
);
```

- [ ] **Step 3: Run the targeted tests to verify they fail**

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

Expected: the new assertions fail because remote list content is still treated as editor body content.

- [ ] **Step 4: Add minimal helper logic for “resolved file body” and “should fetch real body”**

```ts
export function shouldLoadWorkbenchFileBody(...) { ... }
export function getWorkbenchFileResolvedContent(...) { ... }
```

- [ ] **Step 5: Re-run the targeted tests until both pass**

### Task 2: Fix Files workbench state flow in the page and agent panel

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/services/index.ts`

- [ ] **Step 1: Route file-body rendering through the new helpers instead of `selectedFile.content`**

- [ ] **Step 2: Change the async fetch effect so remote OpenClaw files always fetch by `file.id` when no loaded cache exists**

- [ ] **Step 3: Ensure the editor shows loading/empty state instead of stale list payload before the fetch completes**

- [ ] **Step 4: Mirror the same rules in `AgentWorkbenchPanel` preview**

- [ ] **Step 5: Run the service tests again**

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts`

Expected: all pass.

### Task 3: Replace the tab strip with a VSCode-style implementation

**Files:**
- Create: `packages/sdkwork-claw-instances/src/components/InstanceFilesTabsBar.tsx`
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`

- [ ] **Step 1: Write a failing helper test for tab label presentation and scroll-button visibility rules**

```ts
await runTest('buildWorkbenchTabPresentation uses one-line labels with tooltip path fallback', () => {
  const presentation = buildWorkbenchTabPresentation(file, { active: true, dirty: false });
  assert.equal(presentation.title, 'README.md');
  assert.equal(presentation.description, undefined);
});
```

- [ ] **Step 2: Create `InstanceFilesTabsBar.tsx` with**
  single-line tabs, tighter height, active/dirty/close states, left and right scroll buttons, wheel scrolling, and auto-scroll-to-active behavior.

- [ ] **Step 3: Replace the inline tabs markup in `InstanceDetail.tsx` with the new component**

- [ ] **Step 4: Move full path display out of the tab row and into the editor header only**

- [ ] **Step 5: Re-run the helper tests**

### Task 4: Make the editor chrome theme-aware and verify integration

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceFilesTabsBar.tsx`
- Modify: `packages/sdkwork-claw-web/package.json` only if a dependency is unexpectedly required (otherwise do not touch)

- [ ] **Step 1: Use the page theme state to style the tabs bar, editor header, scroll buttons, and empty/loading states for both dark and light mode**

- [ ] **Step 2: Keep Monaco on `vs` / `vs-dark` while visually matching the surrounding chrome**

- [ ] **Step 3: Run type-check verification**

Run:
`pnpm.cmd --filter @sdkwork/claw-web lint`

Expected: exit code `0`.

- [ ] **Step 4: Run the full targeted regression set**

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

Run:
`node --experimental-strip-types packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts`

Run:
`pnpm.cmd --filter @sdkwork/claw-web lint`

Expected: all commands pass.
