import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileCode2,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppStore } from '@sdkwork/claw-core';
import type { InstanceWorkbenchFile } from '../types/index.ts';
import { activateWorkbenchFile, syncWorkbenchFileSelection } from '../pages/instanceFileWorkspaceState.ts';
import { InstanceFileExplorer, resolveRelativeFilePath } from './InstanceFileExplorer';
import { resolveInstanceFileWorkbenchEditorTheme } from './instanceFileWorkbenchTheme.ts';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

type FileTabContextAction = 'close' | 'closeOthers' | 'closeRight' | 'closeAll';

interface FileTabContextMenuState {
  fileId: string;
  x: number;
  y: number;
}

interface InstanceFileWorkbenchProps {
  files: InstanceWorkbenchFile[];
  workspacePath?: string | null;
  isLoading?: boolean;
  sidebarHeader?: React.ReactNode;
  className?: string;
  onSaveFile?: (
    file: InstanceWorkbenchFile,
    content: string,
  ) => Promise<void> | void;
}

function areSameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function closeFileTabsByAction(
  openFileIds: string[],
  selectedFileId: string | null,
  targetFileId: string,
  action: FileTabContextAction,
) {
  const targetIndex = openFileIds.indexOf(targetFileId);
  if (targetIndex < 0 && action !== 'closeAll') {
    return {
      openFileIds,
      selectedFileId,
    };
  }

  let nextOpenFileIds = openFileIds;
  let nextSelectedFileId = selectedFileId;

  if (action === 'close') {
    nextOpenFileIds = openFileIds.filter((fileId) => fileId !== targetFileId);
    if (selectedFileId === targetFileId) {
      nextSelectedFileId =
        nextOpenFileIds[targetIndex] || nextOpenFileIds[Math.max(0, targetIndex - 1)] || null;
    }
  } else if (action === 'closeOthers') {
    nextOpenFileIds = [targetFileId];
    nextSelectedFileId = targetFileId;
  } else if (action === 'closeRight') {
    nextOpenFileIds = openFileIds.slice(0, targetIndex + 1);
    nextSelectedFileId = nextOpenFileIds.includes(selectedFileId || '')
      ? selectedFileId
      : targetFileId;
  } else if (action === 'closeAll') {
    nextOpenFileIds = [];
    nextSelectedFileId = null;
  }

  if (nextSelectedFileId && !nextOpenFileIds.includes(nextSelectedFileId)) {
    nextSelectedFileId = nextOpenFileIds[nextOpenFileIds.length - 1] || null;
  }

  return {
    openFileIds: nextOpenFileIds,
    selectedFileId: nextSelectedFileId,
  };
}

function getStatusBadge(status: string) {
  if (status === 'online' || status === 'connected' || status === 'active' || status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (
    status === 'starting' ||
    status === 'paused' ||
    status === 'disconnected' ||
    status === 'beta' ||
    status === 'configurationRequired'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getDangerBadge(status: string) {
  if (
    status === 'error' ||
    status === 'failed' ||
    status === 'missing' ||
    status === 'restricted' ||
    status === 'degraded'
  ) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return getStatusBadge(status);
}

export function InstanceFileWorkbench({
  files,
  workspacePath,
  isLoading = false,
  sidebarHeader = null,
  className,
  onSaveFile,
}: InstanceFileWorkbenchProps) {
  const { t } = useTranslation();
  const themeMode = useAppStore((state) => state.themeMode);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [tabContextMenu, setTabContextMenu] = useState<FileTabContextMenuState | null>(null);
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [prefersDark, setPrefersDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const filesTabStripRef = useRef<HTMLDivElement | null>(null);
  const fileTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tabStripOverflow, setTabStripOverflow] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const visibleFiles = files;
  const openFiles = useMemo(
    () =>
      openFileIds
        .map((fileId) => visibleFiles.find((file) => file.id === fileId) || null)
        .filter((file): file is (typeof visibleFiles)[number] => Boolean(file)),
    [openFileIds, visibleFiles],
  );
  const selectedFile = useMemo(
    () => visibleFiles.find((file) => file.id === selectedFileId) || null,
    [selectedFileId, visibleFiles],
  );
  const selectedFileRelativePath = useMemo(
    () => (selectedFile ? resolveRelativeFilePath(selectedFile, workspacePath) : null),
    [selectedFile, workspacePath],
  );
  const selectedFileDraft = selectedFile ? fileDrafts[selectedFile.id] ?? selectedFile.content : '';
  const hasPendingFileChanges = Boolean(
    selectedFile && !selectedFile.isReadonly && selectedFileDraft !== selectedFile.content,
  );
  const editorTheme = resolveInstanceFileWorkbenchEditorTheme(themeMode, prefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setPrefersDark(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const next = syncWorkbenchFileSelection(visibleFiles, openFileIds, selectedFileId);
    setOpenFileIds((current) => (areSameIds(current, next.openFileIds) ? current : next.openFileIds));
    setSelectedFileId((current) => (current === next.selectedFileId ? current : next.selectedFileId));
  }, [openFileIds, selectedFileId, visibleFiles]);

  useEffect(() => {
    if (visibleFiles.length === 0) {
      setFileDrafts({});
      return;
    }

    setFileDrafts((current) => {
      const next = Object.fromEntries(
        visibleFiles.map((file) => [file.id, current[file.id] ?? file.content]),
      );

      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [visibleFiles]);

  const updateTabStripOverflow = () => {
    const element = filesTabStripRef.current;
    if (!element) {
      setTabStripOverflow((current) =>
        current.canScrollLeft || current.canScrollRight
          ? { canScrollLeft: false, canScrollRight: false }
          : current,
      );
      return;
    }

    const next = {
      canScrollLeft: element.scrollLeft > 4,
      canScrollRight: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    };
    setTabStripOverflow((current) =>
      current.canScrollLeft === next.canScrollLeft &&
      current.canScrollRight === next.canScrollRight
        ? current
        : next,
    );
  };

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (selectedFileId) {
        fileTabRefs.current[selectedFileId]?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'smooth',
        });
      }
      window.requestAnimationFrame(updateTabStripOverflow);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isLoading, openFiles, selectedFileId]);

  useEffect(() => {
    if (!tabContextMenu || typeof window === 'undefined') {
      return;
    }

    const handlePointerDown = () => {
      setTabContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTabContextMenu(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handlePointerDown);
    };
  }, [tabContextMenu]);

  const handleOpenFileTab = (fileId: string) => {
    const next = activateWorkbenchFile(openFileIds, fileId);
    setOpenFileIds(next.openFileIds);
    setSelectedFileId(next.selectedFileId);
    setTabContextMenu(null);
  };

  const handleCloseFileTab = (fileId: string) => {
    const next = closeFileTabsByAction(openFileIds, selectedFileId, fileId, 'close');
    setOpenFileIds(next.openFileIds);
    setSelectedFileId(next.selectedFileId);
    setTabContextMenu(null);
  };

  const handleFileTabContextAction = (fileId: string, action: FileTabContextAction) => {
    const next = closeFileTabsByAction(openFileIds, selectedFileId, fileId, action);
    setOpenFileIds(next.openFileIds);
    setSelectedFileId(next.selectedFileId);
    setTabContextMenu(null);
  };

  const handleCopyFileTabPath = async (fileId: string, mode: 'relative' | 'workspace') => {
    const file = visibleFiles.find((entry) => entry.id === fileId);
    if (!file || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setTabContextMenu(null);
      return;
    }

    const value =
      mode === 'relative' ? resolveRelativeFilePath(file, workspacePath) : file.path;

    await navigator.clipboard.writeText(value);
    toast.success(mode === 'relative' ? 'Relative path copied' : 'Workspace path copied');
    setTabContextMenu(null);
  };

  const handleTabStripWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const element = filesTabStripRef.current;
    if (!element || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    element.scrollLeft += event.deltaY;
    updateTabStripOverflow();
  };

  const handleTabStripStepScroll = (direction: 'left' | 'right') => {
    const element = filesTabStripRef.current;
    if (!element || typeof window === 'undefined') {
      return;
    }

    const step = Math.max(160, Math.floor(element.clientWidth * 0.72));
    element.scrollTo({
      left: element.scrollLeft + (direction === 'left' ? -step : step),
      behavior: 'smooth',
    });
    window.requestAnimationFrame(updateTabStripOverflow);
  };

  const handleFileDraftChange = (value: string) => {
    if (!selectedFile || selectedFile.isReadonly) {
      return;
    }

    setFileDrafts((current) => ({
      ...current,
      [selectedFile.id]: value,
    }));
  };

  const handleResetFileDraft = () => {
    if (!selectedFile) {
      return;
    }

    setFileDrafts((current) => ({
      ...current,
      [selectedFile.id]: selectedFile.content,
    }));
  };

  const handleSaveFile = async () => {
    if (!selectedFile || selectedFile.isReadonly || !onSaveFile) {
      return;
    }

    setIsSavingFile(true);
    try {
      await onSaveFile(selectedFile, selectedFileDraft);
    } finally {
      setIsSavingFile(false);
    }
  };

  return (
    <div
      className={`grid h-[max(42rem,calc(100vh-18rem))] min-h-[42rem] min-w-0 xl:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(24rem,32rem)_minmax(0,1fr)] ${className || ''}`.trim()}
    >
      <aside
        data-slot="instance-files-explorer"
        className="flex min-h-0 flex-col border-b border-zinc-200/70 bg-zinc-950/[0.02] p-3 dark:border-zinc-800 dark:bg-white/[0.02] xl:border-r xl:border-b-0"
      >
        <div data-slot="instance-files-explorer-header" className="space-y-3 px-2 pb-3 pt-1">
          {sidebarHeader}
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.files.explorer')}
            </div>
            <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
              {visibleFiles.length}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('common.loading')}
          </div>
        ) : visibleFiles.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            <InstanceFileExplorer
              files={visibleFiles}
              selectedFileId={selectedFileId}
              onSelectFile={handleOpenFileTab}
              workspacePath={workspacePath}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-200/70 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.empty.files')}
          </div>
        )}
      </aside>

      <div data-slot="instance-files-editor" className="flex min-h-0 h-full min-w-0 flex-col">
        {isLoading ? (
          <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('common.loading')}
          </div>
        ) : selectedFile ? (
          <>
            <div
              data-slot="instance-files-tabs"
              className="relative border-b border-zinc-200/70 bg-zinc-50/90 px-0 dark:border-zinc-800 dark:bg-zinc-950/70"
            >
              <button
                type="button"
                data-slot="instance-files-tab-scroll-left"
                onClick={() => handleTabStripStepScroll('left')}
                disabled={!tabStripOverflow.canScrollLeft}
                className={`absolute left-0 top-0 z-20 flex h-full w-10 items-center justify-center border-r border-zinc-200/80 bg-zinc-50/96 backdrop-blur transition-colors dark:border-zinc-800 dark:bg-zinc-950/92 ${
                  tabStripOverflow.canScrollLeft
                    ? 'text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                    : 'cursor-not-allowed text-zinc-300 dark:text-zinc-700'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-slot="instance-files-tab-scroll-right"
                onClick={() => handleTabStripStepScroll('right')}
                disabled={!tabStripOverflow.canScrollRight}
                className={`absolute right-0 top-0 z-20 flex h-full w-10 items-center justify-center border-l border-zinc-200/80 bg-zinc-50/96 backdrop-blur transition-colors dark:border-zinc-800 dark:bg-zinc-950/92 ${
                  tabStripOverflow.canScrollRight
                    ? 'text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                    : 'cursor-not-allowed text-zinc-300 dark:text-zinc-700'
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {tabStripOverflow.canScrollLeft ? (
                <div className="pointer-events-none absolute inset-y-0 left-10 z-10 w-8 bg-gradient-to-r from-zinc-50/98 via-zinc-50/72 to-transparent dark:from-zinc-950/98 dark:via-zinc-950/72" />
              ) : null}
              {tabStripOverflow.canScrollRight ? (
                <div className="pointer-events-none absolute inset-y-0 right-10 z-10 w-8 bg-gradient-to-l from-zinc-50/98 via-zinc-50/72 to-transparent dark:from-zinc-950/98 dark:via-zinc-950/72" />
              ) : null}
              <div
                ref={filesTabStripRef}
                onWheel={handleTabStripWheel}
                onScroll={updateTabStripOverflow}
                className="overflow-x-auto overflow-y-hidden pl-10 pr-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="flex min-w-max items-stretch">
                  {openFiles.map((file) => {
                    const tabPath = resolveRelativeFilePath(file, workspacePath);
                    const isActive = file.id === selectedFileId;
                    const isDirty =
                      !file.isReadonly && (fileDrafts[file.id] ?? file.content) !== file.content;
                    return (
                      <button
                        key={file.id}
                        ref={(node) => {
                          fileTabRefs.current[file.id] = node;
                        }}
                        type="button"
                        data-slot="instance-files-tab"
                        onClick={() => handleOpenFileTab(file.id)}
                        onAuxClick={(event) => {
                          if (event.button === 1) {
                            event.preventDefault();
                            handleCloseFileTab(file.id);
                          }
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          handleOpenFileTab(file.id);
                          setTabContextMenu({
                            fileId: file.id,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        title={tabPath}
                        className={`group relative -mb-px flex h-10 max-w-[16rem] items-center gap-2 border-r px-3 text-left transition-colors ${
                          isActive
                            ? 'z-[1] border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50'
                            : 'border-zinc-200/80 bg-zinc-50/96 text-zinc-600 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/92 dark:text-zinc-300 dark:hover:bg-zinc-900'
                        }`}
                      >
                        {isActive ? (
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-sky-500 dark:bg-sky-400" />
                        ) : null}
                        <FileCode2 className={`h-4 w-4 shrink-0 ${isActive ? 'text-sky-500 dark:text-sky-400' : ''}`} />
                        <span className={`truncate text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                          {tabPath}
                        </span>
                        {isDirty ? (
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              isActive ? 'bg-amber-500 dark:bg-amber-400' : 'bg-amber-500'
                            }`}
                          />
                        ) : null}
                        <span
                          role="button"
                          aria-label={`Close ${tabPath}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCloseFileTab(file.id);
                          }}
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all ${
                            isActive || !isDirty
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                          } ${
                            isActive
                              ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                              : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                          }`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {tabContextMenu ? (
                <div
                  data-slot="instance-files-tab-context-menu"
                  onPointerDown={(event) => event.stopPropagation()}
                  className="fixed z-50 w-48 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/98 p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/98"
                  style={{
                    left:
                      typeof window === 'undefined'
                        ? tabContextMenu.x
                        : Math.min(tabContextMenu.x, window.innerWidth - 208),
                    top:
                      typeof window === 'undefined'
                        ? tabContextMenu.y
                        : Math.min(tabContextMenu.y, window.innerHeight - 220),
                  }}
                >
                  {(() => {
                    const targetIndex = openFileIds.indexOf(tabContextMenu.fileId);
                    const hasRightTabs =
                      targetIndex >= 0 && targetIndex < openFileIds.length - 1;
                    const items: Array<{
                      key:
                        | 'close'
                        | 'closeOthers'
                        | 'closeRight'
                        | 'closeAll'
                        | 'copyRelativePath'
                        | 'copyWorkspacePath';
                      label: string;
                      disabled?: boolean;
                      separated?: boolean;
                    }> = [
                      { key: 'copyRelativePath', label: 'Copy Relative Path' },
                      { key: 'copyWorkspacePath', label: 'Copy Workspace Path' },
                      { key: 'close', label: 'Close' },
                      {
                        key: 'closeOthers',
                        label: 'Close Others',
                        disabled: openFileIds.length <= 1,
                      },
                      {
                        key: 'closeRight',
                        label: 'Close Right',
                        disabled: !hasRightTabs,
                      },
                      {
                        key: 'closeAll',
                        label: 'Close All',
                        disabled: openFileIds.length === 0,
                        separated: true,
                      },
                    ];

                    return items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          if (item.key === 'copyRelativePath') {
                            void handleCopyFileTabPath(tabContextMenu.fileId, 'relative');
                            return;
                          }
                          if (item.key === 'copyWorkspacePath') {
                            void handleCopyFileTabPath(tabContextMenu.fileId, 'workspace');
                            return;
                          }

                          handleFileTabContextAction(
                            tabContextMenu.fileId,
                            item.key,
                          );
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                          item.separated ? 'mt-1 border-t border-zinc-200/80 pt-3 dark:border-zinc-800' : ''
                        } ${
                          item.disabled
                            ? 'cursor-not-allowed text-zinc-400 dark:text-zinc-600'
                            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ));
                  })()}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 bg-white dark:bg-[#1e1e1e]">
              <Suspense
                fallback={
                  <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {t('common.loading')}
                  </div>
                }
              >
                <MonacoEditor
                  height="100%"
                  path={selectedFile.path}
                  saveViewState
                  language={selectedFile.language}
                  theme={editorTheme}
                  value={selectedFileDraft}
                  onChange={(value) => handleFileDraftChange(value ?? '')}
                  options={{
                    automaticLayout: true,
                    fontSize: 13,
                    lineHeight: 20,
                    minimap: { enabled: true },
                    padding: { top: 16, bottom: 16 },
                    readOnly: selectedFile.isReadonly,
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    wordWrap: 'on',
                  }}
                />
              </Suspense>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/70 px-4 py-3 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="max-w-full truncate rounded-full bg-zinc-950/[0.04] px-2.5 py-1 font-mono dark:bg-white/[0.06]">
                  {selectedFileRelativePath ?? selectedFile.name}
                </span>
                <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                  {selectedFile.size}
                </span>
                <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                  {selectedFile.updatedAt}
                </span>
                <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                  {t(`instances.detail.instanceWorkbench.fileCategories.${selectedFile.category}`)}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 ${
                    selectedFile.status === 'missing'
                      ? getDangerBadge(selectedFile.status)
                      : getStatusBadge(selectedFile.status)
                  }`}
                >
                  {t(`instances.detail.instanceWorkbench.fileStatus.${selectedFile.status}`)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedFile.isReadonly ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    {t('instances.detail.instanceWorkbench.files.readonlyNotice')}
                  </span>
                ) : null}
                {hasPendingFileChanges ? (
                  <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-amber-700 dark:text-amber-300">
                    {t('instances.detail.instanceWorkbench.files.unsavedChanges')}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleResetFileDraft}
                  disabled={!hasPendingFileChanges || selectedFile.isReadonly}
                  className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('instances.detail.instanceWorkbench.files.revertDraft')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveFile()}
                  disabled={!hasPendingFileChanges || isSavingFile || selectedFile.isReadonly || !onSaveFile}
                  className="flex items-center gap-2 rounded-2xl bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {isSavingFile ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t('instances.detail.instanceWorkbench.files.savingFile')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {t('instances.detail.instanceWorkbench.files.saveFile')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {openFiles.length > 0
              ? t('instances.detail.instanceWorkbench.files.selectFile')
              : t('instances.detail.instanceWorkbench.empty.files')}
          </div>
        )}
      </div>
    </div>
  );
}
