# Kernel Standard Contract And OpenClaw Surface Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cut the TypeScript shared model and OpenClaw instance-detail surface from historical `managed*` semantics to the new `KernelConfig` and `KernelAuthority` standard.

**Architecture:** Introduce the standard kernel config and authority projection in shared TypeScript contracts first, then migrate instance workbench snapshots and derived state onto those projections while keeping legacy path discovery as adapter-only input. After the shared model is stable, align OpenClaw detail sections, config workbench, and user-facing labels so UI behavior is driven by standard kernel terms instead of `managedConfigPath` and related heuristics.

**Tech Stack:** TypeScript, React, pnpm workspace packages, existing `node --experimental-strip-types` tests, instance-detail module architecture, i18n locale JSON

---

## Execution Notes

- Work from the repo root.
- This plan assumes the spec baseline in `docs/superpowers/specs/2026-04-17-kernel-standard-model-and-built-in-governance-design.md`.
- Execute implementation in a dedicated worktree before touching product code.
- Do not stage unrelated dirty workspace files.
- Preserve OpenClaw behavior while removing `managed*` shared vocabulary.
- Legacy config route parsing may remain in adapter services, but shared DTOs and UI labels must not expose it.

## File Map

**Create:**

- `packages/sdkwork-claw-types/src/kernelModel.ts`
- `packages/sdkwork-claw-types/src/kernelModel.test.ts`
- `packages/sdkwork-claw-instances/src/services/kernelConfigProjection.ts`
- `packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts`
- `packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.ts`
- `packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts`

**Modify:**

- `packages/sdkwork-claw-types/src/index.ts`
- `packages/sdkwork-claw-instances/src/types/index.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts`
- `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.ts`
- `packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.test.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchNativeCodexPanel.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedXSearchPanel.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedAuthCooldownsPanel.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx`
- `packages/sdkwork-claw-instances/src/pages/OpenClawInstanceDetailPage.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/instances.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/instances.json`

**Primary test surfaces:**

- `packages/sdkwork-claw-types/src/kernelModel.test.ts`
- `packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts`
- `packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`

### Task 1: Introduce Shared Kernel Model Contracts

**Files:**
- Create: `packages/sdkwork-claw-types/src/kernelModel.ts`
- Create: `packages/sdkwork-claw-types/src/kernelModel.test.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Test: `packages/sdkwork-claw-types/src/kernelModel.test.ts`

- [ ] **Step 1: Write the failing shared-contract tests**

```ts
import assert from 'node:assert/strict';
import { KernelConfigAccessMode, type KernelAuthority, type KernelConfig } from './kernelModel.ts';

assert.equal(KernelConfigAccessMode.LocalFs, 'localFs');
assert.deepEqual(
  Object.keys({} as KernelConfig).sort(),
  ['access', 'configFile', 'configRoot', 'format', 'provenance', 'resolved', 'schemaVersion', 'userRoot', 'writable'].sort(),
);
assert.deepEqual(
  Object.keys({} as KernelAuthority).sort(),
  ['configControl', 'controlPlane', 'doctorSupport', 'migrationSupport', 'observable', 'owner', 'upgradeControl', 'writable', 'lifecycleControl'].sort(),
);
```

- [ ] **Step 2: Run the targeted shared-contract test**

Run: `node --experimental-strip-types packages/sdkwork-claw-types/src/kernelModel.test.ts`
Expected: FAIL because `kernelModel.ts` and the new exports do not exist yet.

- [ ] **Step 3: Add the shared kernel model types and enums**

```ts
export type DeploymentMode = 'builtIn' | 'localExternal' | 'attached' | 'remote';
export type AuthorityOwner = 'appManaged' | 'userManaged' | 'remoteManaged';
export type ControlPlaneKind = 'desktopHost' | 'kernelGateway' | 'bridge' | 'remoteApi' | 'none';

export interface KernelConfig {
  configFile: string | null;
  configRoot: string | null;
  userRoot: string | null;
  format: 'json' | 'json5' | 'yaml' | 'unknown';
  access: KernelConfigAccessMode;
  provenance: string;
  writable: boolean;
  resolved: boolean;
  schemaVersion: string | null;
}
```

- [ ] **Step 4: Re-export the new model from `@sdkwork/claw-types` and thread the new fields into `InstanceWorkbenchSnapshot`**

```ts
export * from './kernelModel.ts';

export interface InstanceWorkbenchSnapshot {
  kernelConfig?: KernelConfig | null;
  kernelAuthority?: KernelAuthority | null;
}
```

- [ ] **Step 5: Re-run the targeted shared-contract test**

Run: `node --experimental-strip-types packages/sdkwork-claw-types/src/kernelModel.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-types/src/kernelModel.ts packages/sdkwork-claw-types/src/kernelModel.test.ts packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-instances/src/types/index.ts
git commit -m "feat: add shared kernel config and authority contracts"
```

### Task 2: Project Canonical KernelConfig Into Instance Workbench Snapshots

**Files:**
- Create: `packages/sdkwork-claw-instances/src/services/kernelConfigProjection.ts`
- Create: `packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

- [ ] **Step 1: Write failing tests for canonical kernel config projection**

```ts
await runTest('buildKernelConfigProjection canonicalizes OpenClaw config under userRoot', () => {
  const projected = buildKernelConfigProjection({
    runtimeKind: 'openclaw',
    configPath: 'C:/Users/admin/.sdkwork/crawstudio/.openclaw/openclaw.json',
    configWritable: true,
  } as any);

  assert.equal(projected?.configFile, 'C:/Users/admin/.sdkwork/crawstudio/.openclaw/openclaw.json');
  assert.equal(projected?.configRoot, 'C:/Users/admin/.sdkwork/crawstudio/.openclaw');
  assert.equal(projected?.access, 'localFs');
  assert.equal(projected?.resolved, true);
});
```

- [ ] **Step 2: Run the targeted projection tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
Expected: FAIL because the workbench snapshot still exposes `managedConfigPath` only.

- [ ] **Step 3: Add `buildKernelConfigProjection()` and move snapshot finalization onto `kernelConfig`**

```ts
export function buildKernelConfigProjection(input: {
  runtimeKind?: string | null;
  configPath?: string | null;
  configWritable?: boolean;
}): KernelConfig | null {
  if (!input.configPath) return null;
  return {
    configFile: input.configPath,
    configRoot: dirname(input.configPath),
    userRoot: deriveUserRoot(input.configPath),
    format: 'json',
    access: 'localFs',
    provenance: 'standardUserRoot',
    writable: input.configWritable === true,
    resolved: true,
    schemaVersion: null,
  };
}
```

- [ ] **Step 4: Keep a short-lived legacy alias read only inside adapter code while removing `managedConfigPath` from the shared snapshot surface**

```ts
const kernelConfig = buildKernelConfigProjection({...});
return {
  ...snapshot,
  kernelConfig,
};
```

- [ ] **Step 5: Re-run the targeted projection and workbench tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-instances/src/services/kernelConfigProjection.ts packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts
git commit -m "feat: project canonical kernel config in instance workbench"
```

### Task 3: Replace Managed Heuristics With KernelAuthority Projection

**Files:**
- Create: `packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.ts`
- Create: `packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`

- [ ] **Step 1: Write failing authority projection tests**

```ts
await runTest('buildKernelAuthorityProjection keeps config control separate from deployment mode', () => {
  const authority = buildKernelAuthorityProjection({
    deploymentMode: 'remote',
    configWritable: true,
    endpointObserved: true,
    workbenchManaged: false,
  } as any);

  assert.equal(authority.owner, 'remoteManaged');
  assert.equal(authority.controlPlane, 'remoteApi');
  assert.equal(authority.configControl, true);
});
```

- [ ] **Step 2: Run the targeted authority tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`
Expected: FAIL because management capability logic still depends on `workbenchManaged`, `managedDirectory`, and `managedConfigPath`.

- [ ] **Step 3: Add `buildKernelAuthorityProjection()` and thread it through detail derived state**

```ts
export function buildKernelAuthorityProjection(detail: StudioInstanceDetailRecord | null | undefined): KernelAuthority {
  return {
    owner: resolveAuthorityOwner(detail),
    controlPlane: resolveControlPlane(detail),
    lifecycleControl: detail?.lifecycle.owner === 'appManaged',
    configControl: detail?.lifecycle.configWritable === true,
    upgradeControl: detail?.lifecycle.owner === 'appManaged',
    doctorSupport: true,
    migrationSupport: detail?.instance.isBuiltIn === true,
    observable: true,
    writable: detail?.lifecycle.configWritable === true,
  };
}
```

- [ ] **Step 4: Replace provider and config gating to use `kernelAuthority` plus `kernelConfig` instead of `providerCenterManaged` and `managedConfigPath`**

```ts
const canEditManagedChannels = Boolean(id && kernelConfig?.resolved && kernelConfig?.writable && kernelAuthority?.configControl);
```

- [ ] **Step 5: Re-run the targeted authority tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.ts packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts
git commit -m "feat: drive instance detail capabilities from kernel authority"
```

### Task 4: Align Instance Detail Surfaces And Labels To Kernel Terms

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.test.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchNativeCodexPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedXSearchPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedAuthCooldownsPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx`
- Modify: `packages/sdkwork-claw-instances/src/pages/OpenClawInstanceDetailPage.tsx`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en/instances.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh/instances.json`
- Test: `packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
- Test: `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.test.tsx`

- [ ] **Step 1: Write failing tests for the new labels and config-file surface**

```ts
await runTest('instance workbench formatting exposes Config File instead of Managed File', () => {
  assert.equal(formatWorkbenchLabel('configFile' as any), 'Config File');
});

await runTest('InstanceDetailSectionContent passes kernel config to channel and provider sections', () => {
  const props = buildInstanceDetailSectionModels({
    workbench: { kernelConfig: { configFile: '/user/.openclaw/openclaw.json' } } as any,
  });
  assert.equal(props.kernelConfig?.configFile, '/user/.openclaw/openclaw.json');
});
```

- [ ] **Step 2: Run the targeted UI tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
Expected: FAIL because the formatter and config workbench still expose `Managed File` and `managedConfigPath`.

- [ ] **Step 3: Rename shared labels and wire all OpenClaw panels to `kernelConfig.configFile`**

```tsx
<div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
  {t('instances.detail.kernelConfig.configFile')}
</div>
<div className="mt-1 break-all font-mono">{kernelConfig?.configFile}</div>
```

- [ ] **Step 4: Update config workbench summaries and i18n strings to use `Config File`, `Managed By`, and `Control Plane` terminology**

```ts
document: {
  configPath: workbench.kernelConfig?.configFile || null,
  isWritable: Boolean(workbench.kernelConfig?.writable && workbench.kernelAuthority?.configControl),
}
```

- [ ] **Step 5: Re-run the targeted UI and formatting tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.ts packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchNativeCodexPanel.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedXSearchPanel.tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedAuthCooldownsPanel.tsx packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx packages/sdkwork-claw-instances/src/pages/OpenClawInstanceDetailPage.tsx packages/sdkwork-claw-i18n/src/locales/en/instances.json packages/sdkwork-claw-i18n/src/locales/zh/instances.json
git commit -m "feat: align openclaw detail surfaces to kernel config vocabulary"
```

### Task 5: Remove Shared Managed Vocabulary And Lock It Out

**Files:**
- Modify: `packages/sdkwork-claw-instances/src/types/index.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- Modify: `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- Test: `packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`

- [ ] **Step 1: Write failing regression tests that assert shared snapshots no longer expose `managedConfigPath`**

```ts
await runTest('InstanceWorkbenchSnapshot does not expose managedConfigPath in shared truth', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /managedConfigPath\?: string \| null/);
});
```

- [ ] **Step 2: Run the regression tests**

Run: `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts`
Expected: FAIL because `managedConfigPath` still exists in shared snapshot and derived-state contracts.

- [ ] **Step 3: Remove `managedConfigPath` from shared types and keep legacy aliasing only inside adapter-local projection code**

```ts
interface LegacyOpenClawConfigProjectionInput {
  legacyManagedConfigPath?: string | null;
}
```

- [ ] **Step 4: Sweep shared TypeScript contracts and detail props until only adapter-local code still mentions `managed*` legacy concepts**

- [ ] **Step 5: Re-run the regression tests plus the targeted TypeScript suite**

Run: `node --experimental-strip-types packages/sdkwork-claw-types/src/kernelModel.test.ts packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts packages/sdkwork-claw-instances/src/services/kernelAuthorityProjection.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.test.ts packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdkwork-claw-types/src/kernelModel.ts packages/sdkwork-claw-types/src/index.ts packages/sdkwork-claw-instances/src/types/index.ts packages/sdkwork-claw-instances/src/services packages/sdkwork-claw-instances/src/components packages/sdkwork-claw-instances/src/pages/OpenClawInstanceDetailPage.tsx packages/sdkwork-claw-i18n/src/locales/en/instances.json packages/sdkwork-claw-i18n/src/locales/zh/instances.json
git commit -m "refactor: remove shared managed config vocabulary"
```
