import React, { useMemo } from 'react';
import { FileCode2 } from 'lucide-react';
import type { InstanceWorkbenchFile } from '../types';

interface InstanceFileExplorerProps {
  files: InstanceWorkbenchFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
  workspacePath?: string | null;
}

function normalizePath(path?: string | null) {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export function resolveRelativeFilePath(
  file: Pick<InstanceWorkbenchFile, 'name' | 'path'>,
  workspacePath?: string | null,
) {
  const normalizedWorkspacePath = normalizePath(workspacePath);
  const normalizedFilePath = normalizePath(file.path);

  if (!normalizedFilePath) {
    return file.name;
  }

  if (
    normalizedWorkspacePath &&
    (normalizedFilePath === normalizedWorkspacePath ||
      normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`))
  ) {
    const relativePath = normalizedFilePath
      .slice(normalizedWorkspacePath.length)
      .replace(/^\/+/, '');

    return relativePath || file.name;
  }

  return file.name;
}

export function InstanceFileExplorer({
  files,
  selectedFileId,
  onSelectFile,
  workspacePath,
}: InstanceFileExplorerProps) {
  const sortedFiles = useMemo(
    () =>
      [...files].sort((left, right) =>
        resolveRelativeFilePath(left, workspacePath).localeCompare(
          resolveRelativeFilePath(right, workspacePath),
        ),
      ),
    [files, workspacePath],
  );

  return (
    <div data-slot="instance-files-list" className="space-y-1">
      {sortedFiles.map((file) => {
        const isActive = file.id === selectedFileId;
        const relativePath = resolveRelativeFilePath(file, workspacePath);

        return (
          <button
            key={file.id}
            type="button"
            data-slot="instance-files-list-item"
            onClick={() => onSelectFile(file.id)}
            className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
              isActive
                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                : 'border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-950/[0.04] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-white/[0.05]'
            }`}
          >
            <FileCode2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{relativePath}</div>
              <div
                className={`mt-1 truncate text-[11px] uppercase tracking-[0.16em] ${
                  isActive ? 'text-white/70 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {file.status}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
