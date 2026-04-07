import type { OpenClawDreamingConfigSnapshot } from '@sdkwork/claw-core';
import type { InstanceWorkbenchMemoryEntry } from '../types/index.ts';

export interface OpenClawDreamingFormState {
  enabled: boolean;
  frequency: string;
}

export interface InstanceMemoryWorkbenchState {
  hasManagedDreamingPanel: boolean;
  hasMemoryEntries: boolean;
  isEmpty: boolean;
  dreamDiaryEntries: InstanceWorkbenchMemoryEntry[];
}

export function createOpenClawDreamingFormState(
  config: OpenClawDreamingConfigSnapshot | null | undefined,
): OpenClawDreamingFormState | null {
  if (!config) {
    return null;
  }

  return {
    enabled: config.enabled,
    frequency: config.frequency,
  };
}

export function buildOpenClawDreamingSaveInput(
  draft: OpenClawDreamingFormState,
): {
  enabled: boolean;
  frequency?: string;
} {
  const frequency = draft.frequency.trim();

  return {
    enabled: draft.enabled,
    ...(frequency ? { frequency } : {}),
  };
}

export function isDreamDiaryMemoryEntry(entry: InstanceWorkbenchMemoryEntry) {
  return entry.type === 'dream' && Boolean(entry.content?.trim());
}

export function buildInstanceMemoryWorkbenchState(workbench: {
  managedDreamingConfig?: OpenClawDreamingConfigSnapshot | null;
  memories: InstanceWorkbenchMemoryEntry[];
} | null | undefined): InstanceMemoryWorkbenchState {
  const memories = workbench?.memories || [];
  const dreamDiaryEntries = memories.filter(isDreamDiaryMemoryEntry);
  const hasManagedDreamingPanel = Boolean(workbench?.managedDreamingConfig);
  const hasMemoryEntries = memories.length > 0;

  return {
    hasManagedDreamingPanel,
    hasMemoryEntries,
    isEmpty: !hasManagedDreamingPanel && !hasMemoryEntries,
    dreamDiaryEntries,
  };
}
