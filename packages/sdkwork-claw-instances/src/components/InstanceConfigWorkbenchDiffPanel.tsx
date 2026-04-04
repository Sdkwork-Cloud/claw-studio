import React from 'react';
import type {
  InstanceConfigWorkbenchDiffEntry,
  InstanceConfigWorkbenchModeId,
} from '../services';
import { countSensitiveConfigValues, isSensitiveConfigPath } from '../services';
import { InstanceConfigWorkbenchStatusChip } from './InstanceConfigWorkbenchStatusChip.tsx';

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

function diffKindTone(kind: 'added' | 'removed' | 'changed') {
  if (kind === 'added') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  if (kind === 'removed') {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function formatDiffValuePreview(path: string, value: unknown) {
  if (value === undefined) {
    return 'Not set';
  }

  if (isSensitiveConfigPath(path)) {
    return '[redacted]';
  }

  if (typeof value === 'string') {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return '""';
    }
    return compact.length > 56 ? `"${compact.slice(0, 56)}..."` : `"${compact}"`;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return 'Not set';
    }
    return serialized.length > 72 ? `${serialized.slice(0, 72)}...` : serialized;
  } catch {
    return 'Updated';
  }
}

function formatDiffValuePreviewWithHints(
  path: string,
  value: unknown,
  uiHints: Record<string, { sensitive?: boolean }>,
) {
  const pathSegments = path.split('.').filter(Boolean);
  if (
    isSensitiveConfigPath(path) ||
    countSensitiveConfigValues(value, pathSegments, uiHints) > 0
  ) {
    return '[redacted]';
  }

  return formatDiffValuePreview(path, value);
}

interface InstanceConfigWorkbenchDiffPanelProps {
  tr: Translate;
  entries: InstanceConfigWorkbenchDiffEntry[];
  sectionLabelByKey: Map<string, string>;
  availableSectionKeys: Set<string>;
  uiHints: Record<string, { sensitive?: boolean }>;
  setActiveMode: React.Dispatch<React.SetStateAction<InstanceConfigWorkbenchModeId>>;
  setActiveSectionKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export function InstanceConfigWorkbenchDiffPanel(
  props: InstanceConfigWorkbenchDiffPanelProps,
) {
  if (props.entries.length === 0) {
    return null;
  }

  return (
    <details className="rounded-[1.4rem] border border-zinc-200/70 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/30">
      <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {props.tr('', 'Pending changes', 'Pending changes')} ({props.entries.length})
      </summary>
      <div className="mt-3 space-y-2">
        {props.entries.slice(0, 8).map((entry) => (
          <button
            key={`${entry.kind}:${entry.path}`}
            type="button"
            onClick={() => {
              if (props.availableSectionKeys.has(entry.sectionKey)) {
                props.setActiveMode('config');
                props.setActiveSectionKey(entry.sectionKey);
                return;
              }
              props.setActiveMode('raw');
            }}
            className="w-full rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-3 text-left transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <InstanceConfigWorkbenchStatusChip tone={diffKindTone(entry.kind)}>
                {entry.kind}
              </InstanceConfigWorkbenchStatusChip>
              <InstanceConfigWorkbenchStatusChip>
                {props.sectionLabelByKey.get(entry.sectionKey) || entry.sectionKey}
              </InstanceConfigWorkbenchStatusChip>
              <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                {entry.path}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="rounded-lg bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                {formatDiffValuePreviewWithHints(entry.path, entry.before, props.uiHints)}
              </span>
              <span>{'->'}</span>
              <span className="rounded-lg bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                {formatDiffValuePreviewWithHints(entry.path, entry.after, props.uiHints)}
              </span>
            </div>
          </button>
        ))}
        {props.entries.length > 8 ? (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {props.tr('', 'More changes remain in this draft.', 'More changes remain in this draft.')}
          </div>
        ) : null}
      </div>
    </details>
  );
}
