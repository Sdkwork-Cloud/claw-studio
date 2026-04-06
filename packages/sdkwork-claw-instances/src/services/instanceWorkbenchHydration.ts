import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchFile,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';

type LazyLoadDecisionInput = {
  activeSection: InstanceWorkbenchSectionId;
  detail: StudioInstanceDetailRecord | null | undefined;
  workbench: InstanceWorkbenchSnapshot | null | undefined;
};

function isOpenClawLazyLoadContext(
  input: LazyLoadDecisionInput,
  targetSection: InstanceWorkbenchSectionId,
) {
  return Boolean(
    input.detail?.instance.runtimeKind === 'openclaw' &&
      input.workbench &&
      input.activeSection === targetSection,
  );
}

export function shouldLazyLoadInstanceWorkbenchFiles(
  input: LazyLoadDecisionInput,
) {
  if (
    !input.workbench ||
    !input.detail ||
    !['files', 'agents'].includes(input.activeSection)
  ) {
    return false;
  }

  return (
    input.detail.instance.runtimeKind === 'openclaw' &&
    input.workbench.files.length === 0
  );
}

export function shouldLazyLoadInstanceWorkbenchMemory(
  input: LazyLoadDecisionInput,
) {
  return (
    isOpenClawLazyLoadContext(input, 'memory') &&
    input.workbench!.memories.length === 0
  );
}

export function mergeLazyLoadedWorkbenchFiles(
  current: InstanceWorkbenchSnapshot,
  files: InstanceWorkbenchFile[],
): InstanceWorkbenchSnapshot {
  if (files.length === 0) {
    return current;
  }

  return {
    ...current,
    files,
    sectionCounts: {
      ...current.sectionCounts,
      files: files.length,
    },
    sectionAvailability: {
      ...current.sectionAvailability,
      files: {
        status: 'ready',
        detail: 'Runtime file data is available for this instance workbench.',
      },
    },
  };
}

export function mergeLazyLoadedWorkbenchMemories(
  current: InstanceWorkbenchSnapshot,
  memories: InstanceWorkbenchMemoryEntry[],
): InstanceWorkbenchSnapshot {
  if (memories.length === 0) {
    return current;
  }

  return {
    ...current,
    memories,
    sectionCounts: {
      ...current.sectionCounts,
      memory: memories.length,
    },
    sectionAvailability: {
      ...current.sectionAvailability,
      memory: {
        status: 'ready',
        detail: 'Runtime memory data is available for this instance workbench.',
      },
    },
  };
}
