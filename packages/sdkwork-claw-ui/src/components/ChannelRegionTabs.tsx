import * as React from 'react';
import { cn } from '../lib/utils';
import type { ChannelCatalogRegion } from './channelCatalogMeta';

interface ChannelRegionTabsProps {
  activeRegion: ChannelCatalogRegion;
  counts: Record<ChannelCatalogRegion, number>;
  labels: Record<ChannelCatalogRegion, string>;
  onChange: (region: ChannelCatalogRegion) => void;
  className?: string;
}

export function ChannelRegionTabs({
  activeRegion,
  counts,
  labels,
  onChange,
  className,
}: ChannelRegionTabsProps) {
  const regions: ChannelCatalogRegion[] = ['domestic', 'global'];

  return (
    <div
      data-slot="channel-region-tabs"
      className={cn(
        'inline-flex w-full flex-wrap items-center gap-2 rounded-[1.4rem] border border-zinc-200/80 bg-white/80 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/45',
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
              'inline-flex flex-1 min-w-[12rem] items-center justify-between gap-3 rounded-[1rem] px-4 py-3 text-left text-sm font-semibold transition-all',
              isActive
                ? 'bg-zinc-950 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/80',
            )}
          >
            <span>{labels[region]}</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
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
