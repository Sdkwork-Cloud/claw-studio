import type { InstanceWorkbenchFile } from '../types/index.ts';

export interface InstanceFileWorkspaceStateSnapshot {
  openFileIds: string[];
  selectedFileId: string | null;
}

export function activateWorkbenchFile(
  openFileIds: string[],
  fileId: string,
): InstanceFileWorkspaceStateSnapshot {
  return {
    openFileIds: openFileIds.includes(fileId) ? openFileIds : [...openFileIds, fileId],
    selectedFileId: fileId,
  };
}

export function syncWorkbenchFileSelection(
  visibleFiles: Pick<InstanceWorkbenchFile, 'id'>[],
  openFileIds: string[],
  selectedFileId: string | null,
): InstanceFileWorkspaceStateSnapshot {
  if (visibleFiles.length === 0) {
    return {
      openFileIds: [],
      selectedFileId: null,
    };
  }

  const visibleFileIds = new Set(visibleFiles.map((file) => file.id));
  const nextOpenFileIds = openFileIds.filter((fileId) => visibleFileIds.has(fileId));
  const nextSelectedFileId =
    selectedFileId && visibleFileIds.has(selectedFileId) ? selectedFileId : null;

  if (nextSelectedFileId && !nextOpenFileIds.includes(nextSelectedFileId)) {
    nextOpenFileIds.push(nextSelectedFileId);
  }

  if (nextOpenFileIds.length === 0) {
    const fallbackFileId = nextSelectedFileId ?? visibleFiles[0].id;
    return {
      openFileIds: [fallbackFileId],
      selectedFileId: fallbackFileId,
    };
  }

  return {
    openFileIds: nextOpenFileIds,
    selectedFileId: nextSelectedFileId ?? nextOpenFileIds[nextOpenFileIds.length - 1],
  };
}
