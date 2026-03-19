import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInstanceStore } from '@sdkwork/claw-core';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import {
  Button,
  ChannelCatalog,
  Input,
  Label,
  OverlaySurface,
  getChannelOfficialLink,
} from '@sdkwork/claw-ui';
import { Channel, channelService } from '../../services';

export function Channels() {
  const { t } = useTranslation();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { activeInstanceId } = useInstanceStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchChannels = async () => {
      if (!activeInstanceId) return;
      setIsLoading(true);
      try {
        const data = await channelService.getChannels(activeInstanceId);
        setChannels(data);
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchChannels();
  }, [activeInstanceId]);

  const handleConfigure = (channel: Channel) => {
    setSelectedChannel(channel);
    const initialFormData: Record<string, string> = {};
    channel.fields.forEach((field) => {
      if (field.value !== undefined) {
        initialFormData[field.key] = field.value;
      }
    });
    setFormData(initialFormData);
    setIsPanelOpen(true);
  };

  const handleToggleEnable = async (channel: Channel, nextEnabled: boolean) => {
    if (!activeInstanceId) return;

    if (nextEnabled && channel.status === 'not_configured') {
      handleConfigure(channel);
      return;
    }

    try {
      const updatedChannels = await channelService.updateChannelStatus(
        activeInstanceId,
        channel.id,
        nextEnabled,
      );
      setChannels(updatedChannels);
    } catch (error) {
      console.error('Failed to update channel status:', error);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const openOfficialLink = async (href: string) => {
    await openExternalUrl(href);
  };

  const handleSave = async () => {
    if (!selectedChannel || !activeInstanceId) return;
    setIsSaving(true);
    try {
      const updatedChannels = await channelService.saveChannelConfig(activeInstanceId, selectedChannel.id, formData);
      setChannels(updatedChannels);
      setIsPanelOpen(false);
    } catch (error) {
      console.error('Failed to save channel config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!selectedChannel || !activeInstanceId) return;
    try {
      const updatedChannels = await channelService.deleteChannelConfig(activeInstanceId, selectedChannel.id);
      setChannels(updatedChannels);
      setIsPanelOpen(false);
    } catch (error) {
      console.error('Failed to delete channel config:', error);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      );
    }

    return (
      <div className="scrollbar-hide flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('channels.page.title')}
            </h1>
            <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
              {t('channels.page.subtitle')}
            </p>
          </div>

          <ChannelCatalog
            items={channels}
            variant="management"
            texts={{
              statusActive: t('channels.page.status.active'),
              statusConnected: t('dashboard.status.connected'),
              statusDisconnected: t('channels.page.status.disconnected'),
              statusNotConfigured: t('channels.page.status.notConfigured'),
              actionConnect: t('channels.page.actions.connect'),
              actionConfigure: t('channels.page.actions.configure'),
              actionOpenOfficialSite: t('channels.page.actions.openOfficialSite'),
              actionEnableChannel: (name: string) =>
                t('channels.page.actions.enableChannel', { name }),
              metricConfiguredFields: '',
              metricSetupSteps: '',
              metricDeliveryState: '',
              stateEnabled: '',
              statePending: '',
              summaryFallback: '',
            }}
            onOpenOfficialLink={(_channel, link) => void openOfficialLink(link.href)}
            onConfigure={handleConfigure}
            onToggleEnabled={(channel, nextEnabled) => {
              void handleToggleEnable(channel as Channel, nextEnabled);
            }}
          />
        </div>
      </div>
    );
  };

  const selectedChannelOfficialLink = selectedChannel
    ? getChannelOfficialLink(selectedChannel.id)
    : null;

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {renderContent()}

      {selectedChannel ? (
        <OverlaySurface
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          variant="drawer"
          className="max-w-md"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                {selectedChannel.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedChannel.name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('channels.page.panel.configuration')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPanelOpen(false)}
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
                  {t('channels.page.panel.setupGuide')}
                </h3>
                <ol className="space-y-3">
                  {selectedChannel.setupGuide.map((step, index) => (
                    <li
                      key={index}
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
                    onClick={() => void openOfficialLink(selectedChannelOfficialLink.href)}
                  >
                    {t('channels.page.panel.openOfficialSite')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>

              <div className="space-y-5">
                <h3 className="border-b border-zinc-100 pb-2 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  {t('channels.page.panel.credentials')}
                </h3>
                {selectedChannel.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="mb-1.5 block">
                      {field.label}
                    </Label>
                    <Input
                      type={field.type}
                      value={formData[field.key] || ''}
                      onChange={(event) => handleFieldChange(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.helpText && (
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {field.helpText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('channels.page.actions.saving')}
                  </>
                ) : (
                  t('channels.page.actions.saveAndEnable')
                )}
              </Button>
              {selectedChannel.status !== 'not_configured' && (
                <button
                  onClick={() => void handleDeleteConfig()}
                  className="w-full py-3 text-sm font-semibold text-red-500 transition-colors hover:text-red-600"
                >
                  {t('channels.page.actions.deleteConfiguration')}
                </button>
              )}
            </div>
          </div>
        </OverlaySurface>
      ) : null}
    </div>
  );
}
