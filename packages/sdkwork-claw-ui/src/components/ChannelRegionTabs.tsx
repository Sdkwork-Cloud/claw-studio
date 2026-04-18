import * as React from 'react';
import { cn } from '../lib/utils';
import type { ChannelCatalogRegion } from './channelCatalogMeta';

interface ChannelRegionTabsProps {
  activeRegion: ChannelCatalogRegion;
  labels: Record<ChannelCatalogRegion, string>;
  counts: Record<ChannelCatalogRegion, number>;
  onChange: (region: ChannelCatalogRegion) => void;
  className?: string;
}

export function ChannelRegionTabs({
  activeRegion,
  labels,
  counts,
  onChange,
  className,
}: ChannelRegionTabsProps) {
  const regions: ChannelCatalogRegion[] = ['domestic', 'global', 'media', 'all'];
  const railClassName =
    'inline-flex max-w-full flex-wrap items-center gap-1 rounded-[0.875rem] border border-zinc-200/80 bg-white/80 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40';
  const triggerClassName =
    'inline-flex h-9 min-w-[9rem] shrink-0 items-center justify-between gap-2 rounded-[0.75rem] px-3 text-left text-[13px] font-semibold transition-colors';
  const countClassName = 'rounded-full px-1.5 py-0.5 text-[11px] font-semibold';

  return (
    <div
      data-slot="channel-region-tabs"
      className={cn(
        railClassName,
        className,
      )}
    >
      {regions.map((region) => {
        const isActive = region === activeRegion;

        return (
          <button
            key={region}
            type="button"
            onClick={() => onChange(region)}
            className={cn(
              triggerClassName,
              isActive
                ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900',
            )}
          >
            <span>{labels[region]}</span>
            <span
              className={cn(
                countClassName,
                isActive
                  ? 'bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              {counts[region]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
