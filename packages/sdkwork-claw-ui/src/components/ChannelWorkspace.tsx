import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  ChannelCatalog,
  type ChannelCatalogItem,
  type ChannelCatalogTexts,
  type ChannelCatalogVariant,
} from './ChannelCatalog';
import { Button } from './Button';
import { ChannelRegionTabs } from './ChannelRegionTabs';
import { Input } from './Input';
import { Label } from './Label';
import { OverlaySurface } from './OverlaySurface';
import { Textarea } from './Textarea';
import {
  getChannelCatalogRegions,
  isChannelDownloadAppAction,
  getChannelCatalogMonogram,
  getChannelCatalogTone,
  getChannelOfficialLink,
  partitionChannelCatalogItemsByRegion,
  resolveDefaultChannelCatalogRegion,
  type ChannelCatalogRegion,
  type ChannelOfficialLink,
} from './channelCatalogMeta';
import { getChannelCatalogIcon } from './channelCatalogIcons';

export interface ChannelWorkspaceField {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
  type?: React.HTMLInputTypeAttribute;
}

export interface ChannelWorkspaceItem extends Omit<ChannelCatalogItem, 'setupSteps'> {
  fields: ChannelWorkspaceField[];
  setupSteps: string[];
  values?: Record<string, string>;
}

export interface ChannelWorkspaceTexts extends ChannelCatalogTexts {
  managedFileLabel?: string;
  panelEyebrow: string;
  setupGuideTitle: string;
  credentialsTitle: string;
  saveAction: string;
  savingAction: string;
  deleteConfigurationAction?: string;
}

export interface ChannelWorkspaceProps {
  items: ChannelWorkspaceItem[];
  texts: ChannelWorkspaceTexts;
  variant?: ChannelCatalogVariant;
  emptyState?: React.ReactNode;
  selectedChannelId: string | null;
  valuesByChannelId?: Record<string, Record<string, string>>;
  managedFilePath?: string | null;
  error?: React.ReactNode;
  isSaving?: boolean;
  className?: string;
  drawerClassName?: string;
  resolveOfficialLink?: (channel: ChannelWorkspaceItem) => ChannelOfficialLink | null;
  onOpenOfficialLink?: (
    channel: ChannelWorkspaceItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
  onSelectedChannelIdChange: (channelId: string | null) => void;
  onFieldChange?: (
    channel: ChannelWorkspaceItem,
    fieldKey: string,
    value: string,
  ) => Promise<void> | void;
  onSave?: (
    channel: ChannelWorkspaceItem,
    values: Record<string, string>,
  ) => Promise<void> | void;
  onDeleteConfiguration?: (channel: ChannelWorkspaceItem) => Promise<void> | void;
  onToggleEnabled?: (
    channel: ChannelWorkspaceItem,
    nextEnabled: boolean,
  ) => Promise<void> | void;
}

function deriveFieldValues(channel: ChannelWorkspaceItem) {
  return channel.fields.reduce<Record<string, string>>((accumulator, field) => {
    if (typeof channel.values?.[field.key] === 'string') {
      accumulator[field.key] = channel.values[field.key];
      return accumulator;
    }

    accumulator[field.key] = '';
    return accumulator;
  }, {});
}

function getInputType(field: ChannelWorkspaceField) {
  if (field.type) {
    return field.type;
  }
  if (field.sensitive) {
    return 'password';
  }
  if (field.inputMode === 'numeric') {
    return 'number';
  }
  if (field.inputMode === 'url') {
    return 'url';
  }
  return 'text';
}

function ChannelIdentity({
  channel,
}: {
  channel: ChannelWorkspaceItem;
}) {
  const builtInIcon = getChannelCatalogIcon(channel.id);

  return (
    <div
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm',
        getChannelCatalogTone(channel.id),
      )}
    >
      {builtInIcon ? (
        builtInIcon
      ) : channel.icon ? (
        channel.icon
      ) : (
        <span className="text-xs font-bold uppercase tracking-[0.18em]">
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

export function ChannelWorkspace({
  items,
  texts,
  variant = 'management',
  emptyState = null,
  selectedChannelId,
  valuesByChannelId = {},
  managedFilePath,
  error,
  isSaving = false,
  className,
  drawerClassName,
  resolveOfficialLink = (channel) => getChannelOfficialLink(channel.id),
  onOpenOfficialLink,
  onSelectedChannelIdChange,
  onFieldChange,
  onSave,
  onDeleteConfiguration,
  onToggleEnabled,
}: ChannelWorkspaceProps) {
  const { t } = useTranslation();
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const regionGroups = React.useMemo(
    () => partitionChannelCatalogItemsByRegion(items),
    [items],
  );
  const [activeRegion, setActiveRegion] = React.useState<ChannelCatalogRegion>(() =>
    resolveDefaultChannelCatalogRegion(regionGroups),
  );
  const visibleItems = regionGroups[activeRegion];

  const selectedChannel = React.useMemo(
    () => items.find((channel) => channel.id === selectedChannelId) || null,
    [items, selectedChannelId],
  );

  const selectedValues = React.useMemo<Record<string, string>>(() => {
    if (!selectedChannel) {
      return {};
    }

    return valuesByChannelId[selectedChannel.id] || deriveFieldValues(selectedChannel);
  }, [selectedChannel, valuesByChannelId]);

  React.useEffect(() => {
    setValidationError(null);
  }, [selectedChannelId]);

  React.useEffect(() => {
    const preferredRegion = resolveDefaultChannelCatalogRegion(regionGroups);
    if (regionGroups[activeRegion].length === 0 && regionGroups[preferredRegion].length > 0) {
      setActiveRegion(preferredRegion);
    }
  }, [activeRegion, regionGroups]);

  React.useEffect(() => {
    if (!selectedChannel) {
      return;
    }

    if (
      activeRegion !== 'all' &&
      !getChannelCatalogRegions(selectedChannel.id).includes(activeRegion)
    ) {
      onSelectedChannelIdChange(null);
    }
  }, [activeRegion, onSelectedChannelIdChange, selectedChannel]);

  const displayedError = error || validationError;
  const selectedChannelOfficialLink = selectedChannel
    ? resolveOfficialLink(selectedChannel)
    : null;
  const selectedOfficialActionLabel =
    selectedChannel && isChannelDownloadAppAction(selectedChannel.id)
      ? texts.actionDownloadApp
      : texts.actionOpenOfficialSite;
  const deleteActionLabel = texts.deleteConfigurationAction || 'Delete configuration';
  const hasConfiguredValues = selectedChannel
    ? selectedChannel.fields.some((field) => Boolean((selectedValues[field.key] || '').trim()))
    : false;
  const regionLabels: Record<ChannelCatalogRegion, string> = {
    domestic: t('channels.page.catalog.tabs.domestic'),
    global: t('channels.page.catalog.tabs.global'),
    media: t('channels.page.catalog.tabs.media'),
    all: t('channels.page.catalog.tabs.all'),
  };
  const regionCounts: Record<ChannelCatalogRegion, number> = {
    domestic: regionGroups.domestic.length,
    global: regionGroups.global.length,
    media: regionGroups.media.length,
    all: regionGroups.all.length,
  };
  const regionEmptyText =
    activeRegion === 'domestic'
      ? t('channels.page.catalog.empty.domestic')
      : activeRegion === 'global'
        ? t('channels.page.catalog.empty.global')
        : activeRegion === 'media'
          ? t('channels.page.catalog.empty.media')
        : t('channels.page.catalog.empty.all');

  const handleOpenSelectedOfficialLink = () => {
    if (!selectedChannel || !selectedChannelOfficialLink) {
      return;
    }

    if (onOpenOfficialLink) {
      void onOpenOfficialLink(selectedChannel, selectedChannelOfficialLink);
      return;
    }

    if (typeof window !== 'undefined') {
      window.open(selectedChannelOfficialLink.href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSave = () => {
    if (!selectedChannel || !onSave) {
      return;
    }

    const missingField = selectedChannel.fields.find(
      (field) => field.required && !(selectedValues[field.key] || '').trim(),
    );
    if (missingField) {
      setValidationError(`${missingField.label} is required.`);
      return;
    }

    void onSave(selectedChannel, selectedValues);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {managedFilePath ? (
        <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300">
          {texts.managedFileLabel ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {texts.managedFileLabel}
            </div>
          ) : null}
          <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {managedFilePath}
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ChannelRegionTabs
          activeRegion={activeRegion}
          labels={regionLabels}
          counts={regionCounts}
          onChange={setActiveRegion}
        />
      ) : null}

      <ChannelCatalog
        items={visibleItems}
        texts={texts}
        variant={variant}
        emptyState={
          items.length === 0 ? emptyState : <RegionEmptyState title={regionEmptyText} />
        }
        showRegionTabs={false}
        resolveOfficialLink={(channel) => resolveOfficialLink(channel as ChannelWorkspaceItem)}
        onOpenOfficialLink={
          onOpenOfficialLink
            ? (channel, link) => onOpenOfficialLink(channel as ChannelWorkspaceItem, link)
            : undefined
        }
        onConfigure={
          variant === 'management'
            ? (channel) => {
                setValidationError(null);
                onSelectedChannelIdChange(channel.id);
              }
            : undefined
        }
        onToggleEnabled={
          variant === 'management' && onToggleEnabled
            ? (channel, nextEnabled) =>
                onToggleEnabled(channel as ChannelWorkspaceItem, nextEnabled)
            : undefined
        }
      />

      {variant === 'management' && selectedChannel ? (
        <OverlaySurface
          isOpen
          onClose={() => onSelectedChannelIdChange(null)}
          variant="drawer"
          className={cn('max-w-lg', drawerClassName)}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <ChannelIdentity channel={selectedChannel} />
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedChannel.name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{texts.panelEyebrow}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectedChannelIdChange(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-8 p-6">
              <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5 dark:border-primary-500/20 dark:bg-primary-500/10">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary-900 dark:text-primary-100">
                  <BookOpen className="h-4 w-4" />
                  {texts.setupGuideTitle}
                </h3>
                <ol className="space-y-3">
                  {selectedChannel.setupSteps.map((step, index) => (
                    <li
                      key={`${selectedChannel.id}-${index}`}
                      className="flex gap-3 text-sm text-primary-800 dark:text-primary-200"
                    >
                      <span className="shrink-0 font-mono font-bold text-primary-400">
                        {index + 1}.
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
                {selectedChannelOfficialLink ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    type="button"
                    title={selectedChannelOfficialLink.label}
                    onClick={handleOpenSelectedOfficialLink}
                  >
                    {selectedOfficialActionLabel}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>

              <div className="space-y-5">
                <h3 className="border-b border-zinc-100 pb-2 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  {texts.credentialsTitle}
                </h3>
                {selectedChannel.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="mb-1.5 block">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </Label>
                    {field.multiline ? (
                      <Textarea
                        value={selectedValues[field.key] || ''}
                        onChange={(event) => {
                          setValidationError(null);
                          if (!onFieldChange) {
                            return;
                          }
                          void onFieldChange(selectedChannel, field.key, event.target.value);
                        }}
                        placeholder={field.placeholder}
                        rows={5}
                      />
                    ) : (
                      <Input
                        type={getInputType(field)}
                        value={selectedValues[field.key] || ''}
                        onChange={(event) => {
                          setValidationError(null);
                          if (!onFieldChange) {
                            return;
                          }
                          void onFieldChange(selectedChannel, field.key, event.target.value);
                        }}
                        placeholder={field.placeholder}
                      />
                    )}
                    {field.helpText ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {field.helpText}
                      </p>
                    ) : null}
                  </div>
                ))}

                {displayedError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    {displayedError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex flex-col gap-3">
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? texts.savingAction : texts.saveAction}
              </Button>
              {onDeleteConfiguration && hasConfiguredValues ? (
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    void onDeleteConfiguration(selectedChannel);
                  }}
                  className="w-full py-3 text-sm font-semibold text-red-500 transition-colors hover:text-red-600"
                >
                  {deleteActionLabel}
                </button>
              ) : null}
            </div>
          </div>
        </OverlaySurface>
      ) : null}
    </div>
  );
}
