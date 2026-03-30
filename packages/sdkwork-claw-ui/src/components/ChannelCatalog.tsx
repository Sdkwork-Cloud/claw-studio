import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Switch } from './Switch';
import { ChannelRegionTabs } from './ChannelRegionTabs';
import {
  getChannelCatalogMonogram,
  getChannelCatalogTone,
  getChannelOfficialLink,
  getSupplementalChannelCatalogEntries,
  isChannelDownloadAppAction,
  isManagedChannelCatalogEntry,
  partitionChannelCatalogItemsByRegion,
  resolveDefaultChannelCatalogRegion,
  sortChannelCatalogItems,
  type ChannelCatalogRegion,
  type ChannelOfficialLink,
} from './channelCatalogMeta';
import { getChannelCatalogIcon } from './channelCatalogIcons';

export type ChannelCatalogVariant = 'management' | 'summary';

export interface ChannelCatalogItem {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  icon?: React.ReactNode;
  configurationMode?: 'required' | 'none';
  fieldCount?: number;
  configuredFieldCount?: number;
  setupSteps?: string[];
}

export interface ChannelCatalogTexts {
  statusActive: string;
  statusConnected: string;
  statusDisconnected: string;
  statusNotConfigured: string;
  actionConnect: string;
  actionConfigure: string;
  actionDownloadApp: string;
  actionOpenOfficialSite: string;
  actionEnableChannel: (name: string) => string;
  metricConfiguredFields: string;
  metricSetupSteps: string;
  metricDeliveryState: string;
  stateEnabled: string;
  statePending: string;
  summaryFallback: string;
}

export interface ChannelCatalogProps {
  items: ChannelCatalogItem[];
  texts: ChannelCatalogTexts;
  variant?: ChannelCatalogVariant;
  emptyState?: React.ReactNode;
  showRegionTabs?: boolean;
  includeSupplementalItems?: boolean;
  resolveOfficialLink?: (channel: ChannelCatalogItem) => ChannelOfficialLink | null;
  onOpenOfficialLink?: (
    channel: ChannelCatalogItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
  onConfigure?: (channel: ChannelCatalogItem) => void;
  onToggleEnabled?: (channel: ChannelCatalogItem, nextEnabled: boolean) => void;
}

interface StatusBadgeConfig {
  className: string;
  label: string;
}

function getOfficialActionLabel(channel: ChannelCatalogItem, texts: ChannelCatalogTexts) {
  return isChannelDownloadAppAction(channel.id)
    ? texts.actionDownloadApp
    : texts.actionOpenOfficialSite;
}

function getStatusBadge(
  channel: ChannelCatalogItem,
  texts: ChannelCatalogTexts,
  variant: ChannelCatalogVariant,
): StatusBadgeConfig {
  if (variant === 'management') {
    if (channel.status === 'connected' && channel.enabled) {
      return {
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
        label: texts.statusActive,
      };
    }

    if (channel.status === 'not_configured') {
      return {
        className:
          'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
        label: texts.statusNotConfigured,
      };
    }
  }

  if (channel.status === 'connected') {
    return {
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
      label: texts.statusConnected,
    };
  }

  if (channel.status === 'disconnected') {
    return {
      className:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
      label: texts.statusDisconnected,
    };
  }

  return {
    className:
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    label: texts.statusNotConfigured,
  };
}

function buildSupplementalChannelCatalogItems(
  t: (key: string) => string,
): ChannelCatalogItem[] {
  return getSupplementalChannelCatalogEntries().map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: t(entry.descriptionKey),
    status: 'disconnected',
    enabled: false,
    configurationMode: 'none',
    fieldCount: 0,
    configuredFieldCount: 0,
    setupSteps: [t('channels.page.catalog.supplemental.referenceSetup')],
  }));
}

function mergeSupplementalChannelCatalogItems(
  items: ChannelCatalogItem[],
  t: (key: string) => string,
  includeSupplementalItems: boolean,
) {
  if (!includeSupplementalItems) {
    return sortChannelCatalogItems(items);
  }

  const existingIds = new Set(items.map((item) => item.id));
  const supplementalItems = buildSupplementalChannelCatalogItems(t).filter(
    (item) => !existingIds.has(item.id),
  );

  return sortChannelCatalogItems([...items, ...supplementalItems]);
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-[7rem]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function OfficialLinkButton({
  channel,
  link,
  label,
  className,
  onOpenOfficialLink,
}: {
  channel: ChannelCatalogItem;
  link: ChannelOfficialLink;
  label: string;
  className?: string;
  onOpenOfficialLink?: (
    channel: ChannelCatalogItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
}) {
  if (onOpenOfficialLink) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={className}
        type="button"
        title={link.label}
        onClick={() => {
          void onOpenOfficialLink(channel, link);
        }}
      >
        {label}
        <ExternalLink className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className={className} asChild>
      <a href={link.href} target="_blank" rel="noreferrer" title={link.label}>
        {label}
        <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  );
}

function ChannelIdentity({
  channel,
}: {
  channel: ChannelCatalogItem;
}) {
  const builtInIcon = getChannelCatalogIcon(channel.id);

  return (
    <div
      className={cn(
        'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-300 group-hover:scale-105',
        getChannelCatalogTone(channel.id),
      )}
    >
      {builtInIcon ? (
        builtInIcon
      ) : channel.icon ? (
        channel.icon
      ) : (
        <span className="text-sm font-bold uppercase tracking-[0.18em]">
          {getChannelCatalogMonogram(channel.id, channel.name)}
        </span>
      )}
    </div>
  );
}

function RegionEmptyState({
  title,
}: {
  title: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white/75 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/35 dark:text-zinc-400">
      {title}
    </div>
  );
}

function SummaryContent({
  items,
  texts,
  resolveOfficialLink,
  onOpenOfficialLink,
}: {
  items: ChannelCatalogItem[];
  texts: ChannelCatalogTexts;
  resolveOfficialLink: (channel: ChannelCatalogItem) => ChannelOfficialLink | null;
  onOpenOfficialLink?: (
    channel: ChannelCatalogItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
}) {
  return (
    <div
      data-slot="channel-catalog-summary"
      className="overflow-hidden rounded-[1.5rem] border border-zinc-200/70 bg-white/75 dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      {items.map((channel, index) => {
        const badge = getStatusBadge(channel, texts, 'summary');
        const officialLink = resolveOfficialLink(channel);
        const shouldShowConfiguredFieldMetric =
          typeof channel.configuredFieldCount === 'number' &&
          typeof channel.fieldCount === 'number' &&
          channel.fieldCount > 0;

        return (
          <div
            key={channel.id}
            className={cn(
              'grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto] xl:items-center',
              index === items.length - 1 ? '' : 'border-b border-zinc-200/70 dark:border-zinc-800',
            )}
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {channel.name}
                </h3>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {channel.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-5">
              {shouldShowConfiguredFieldMetric ? (
                <SummaryMetric
                  label={texts.metricConfiguredFields}
                  value={`${channel.configuredFieldCount}/${channel.fieldCount}`}
                />
              ) : null}
              <SummaryMetric
                label={texts.metricSetupSteps}
                value={channel.setupSteps?.length || 0}
              />
              <SummaryMetric
                label={texts.metricDeliveryState}
                value={channel.enabled ? texts.stateEnabled : texts.statePending}
              />
            </div>

            <div className="xl:max-w-sm">
              <div className="rounded-2xl bg-zinc-950/[0.04] px-4 py-3 text-sm text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-300">
                {channel.setupSteps?.[0] || texts.summaryFallback}
              </div>
              {officialLink ? (
                <OfficialLinkButton
                  channel={channel}
                  link={officialLink}
                  label={getOfficialActionLabel(channel, texts)}
                  className="mt-3"
                  onOpenOfficialLink={onOpenOfficialLink}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManagementContent({
  items,
  texts,
  resolveOfficialLink,
  onOpenOfficialLink,
  onConfigure,
  onToggleEnabled,
}: {
  items: ChannelCatalogItem[];
  texts: ChannelCatalogTexts;
  resolveOfficialLink: (channel: ChannelCatalogItem) => ChannelOfficialLink | null;
  onOpenOfficialLink?: (
    channel: ChannelCatalogItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
  onConfigure?: (channel: ChannelCatalogItem) => void;
  onToggleEnabled?: (channel: ChannelCatalogItem, nextEnabled: boolean) => void;
}) {
  return (
    <div
      data-slot="channel-catalog-management"
      className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((channel) => {
          const badge = getStatusBadge(channel, texts, 'management');
          const officialLink = resolveOfficialLink(channel);
          const isDownloadAppChannel = isChannelDownloadAppAction(channel.id);
          const canManageChannel = isManagedChannelCatalogEntry(channel.id);

          return (
            <div
              key={channel.id}
              className="group flex flex-col justify-between gap-6 p-6 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-start gap-5">
                <ChannelIdentity channel={channel} />
                <div className="flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                      {channel.name}
                    </h3>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {channel.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:border-l sm:border-zinc-100 sm:pl-6 dark:sm:border-zinc-800">
                {officialLink ? (
                  <OfficialLinkButton
                    channel={channel}
                    link={officialLink}
                    label={getOfficialActionLabel(channel, texts)}
                    onOpenOfficialLink={onOpenOfficialLink}
                  />
                ) : null}

                {!canManageChannel ? null : isDownloadAppChannel ? (
                  onToggleEnabled ? (
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(checked) => onToggleEnabled(channel, checked === true)}
                      aria-label={texts.actionEnableChannel(channel.name)}
                    />
                  ) : null
                ) : channel.status === 'not_configured' ? (
                  onConfigure ? (
                    <Button onClick={() => onConfigure(channel)}>{texts.actionConnect}</Button>
                  ) : null
                ) : (
                  <>
                    {onConfigure ? (
                      <Button variant="ghost" onClick={() => onConfigure(channel)}>
                        <Settings className="h-4 w-4" />
                        {texts.actionConfigure}
                      </Button>
                    ) : null}
                    {onToggleEnabled ? (
                      <Switch
                        checked={channel.enabled}
                        onCheckedChange={(checked) => onToggleEnabled(channel, checked === true)}
                        aria-label={texts.actionEnableChannel(channel.name)}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChannelCatalog({
  items,
  texts,
  variant = 'management',
  emptyState = null,
  showRegionTabs = true,
  includeSupplementalItems,
  resolveOfficialLink = (channel) => getChannelOfficialLink(channel.id),
  onOpenOfficialLink,
  onConfigure,
  onToggleEnabled,
}: ChannelCatalogProps) {
  const { t } = useTranslation();
  const shouldIncludeSupplementalItems = includeSupplementalItems ?? items.length > 0;

  const catalogItems = React.useMemo(
    () =>
      mergeSupplementalChannelCatalogItems(items, t, shouldIncludeSupplementalItems),
    [items, shouldIncludeSupplementalItems, t],
  );

  const regionGroups = React.useMemo(
    () => partitionChannelCatalogItemsByRegion(catalogItems),
    [catalogItems],
  );

  const [activeRegion, setActiveRegion] = React.useState<ChannelCatalogRegion>(() =>
    resolveDefaultChannelCatalogRegion(regionGroups),
  );

  React.useEffect(() => {
    const preferredRegion = resolveDefaultChannelCatalogRegion(regionGroups);
    if (regionGroups[activeRegion].length === 0 && regionGroups[preferredRegion].length > 0) {
      setActiveRegion(preferredRegion);
    }
  }, [activeRegion, regionGroups]);

  if (catalogItems.length === 0) {
    return <>{emptyState}</>;
  }

  const visibleItems = showRegionTabs ? regionGroups[activeRegion] : catalogItems;
  const regionLabels: Record<ChannelCatalogRegion, string> = {
    domestic: t('channels.page.catalog.tabs.domestic'),
    global: t('channels.page.catalog.tabs.global'),
  };
  const regionCounts: Record<ChannelCatalogRegion, number> = {
    domestic: regionGroups.domestic.length,
    global: regionGroups.global.length,
  };
  const regionEmptyMessage =
    activeRegion === 'domestic'
      ? t('channels.page.catalog.empty.domestic')
      : t('channels.page.catalog.empty.global');

  return (
    <div className="space-y-4">
      {showRegionTabs ? (
        <ChannelRegionTabs
          activeRegion={activeRegion}
          counts={regionCounts}
          labels={regionLabels}
          onChange={setActiveRegion}
        />
      ) : null}

      {visibleItems.length === 0 ? (
        <RegionEmptyState title={regionEmptyMessage} />
      ) : variant === 'summary' ? (
        <SummaryContent
          items={visibleItems}
          texts={texts}
          resolveOfficialLink={resolveOfficialLink}
          onOpenOfficialLink={onOpenOfficialLink}
        />
      ) : (
        <ManagementContent
          items={visibleItems}
          texts={texts}
          resolveOfficialLink={resolveOfficialLink}
          onOpenOfficialLink={onOpenOfficialLink}
          onConfigure={onConfigure}
          onToggleEnabled={onToggleEnabled}
        />
      )}
    </div>
  );
}
