import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Settings, X } from 'lucide-react';
import { useInstanceStore } from '@sdkwork/claw-core';
import { Channel, channelService } from '../../services';

export function Channels() {
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

  const handleToggleEnable = async (id: string, currentEnabled: boolean) => {
    if (!activeInstanceId) return;
    const channel = channels.find((item) => item.id === id);
    if (!channel) return;

    if (!currentEnabled && channel.status === 'not_configured') {
      handleConfigure(channel);
      return;
    }

    try {
      const updatedChannels = await channelService.updateChannelStatus(activeInstanceId, id, !currentEnabled);
      setChannels(updatedChannels);
    } catch (error) {
      console.error('Failed to update channel status:', error);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
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
              Channels
            </h1>
            <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
              Connect your OpenClaw agents to external messaging platforms and APIs.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="group flex flex-col justify-between gap-6 p-6 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-start gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-zinc-700/80 dark:from-zinc-800 dark:to-zinc-900">
                      {channel.icon}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1.5 flex items-center gap-3">
                        <h3 className="text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                          {channel.name}
                        </h3>
                        {channel.status === 'connected' && channel.enabled && (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        {channel.status === 'not_configured' && (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            Not Configured
                          </span>
                        )}
                      </div>
                      <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:border-l sm:border-zinc-100 sm:pl-6 dark:sm:border-zinc-800">
                    {channel.status === 'not_configured' ? (
                      <button
                        onClick={() => handleConfigure(channel)}
                        className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-md dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      >
                        Connect
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleConfigure(channel)}
                          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:text-zinc-400 dark:hover:bg-primary-500/10 dark:hover:text-primary-400"
                        >
                          <Settings className="h-4 w-4" />
                          Configure
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleEnable(channel.id, channel.enabled)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                              channel.enabled
                                ? 'bg-primary-500 shadow-inner shadow-primary-600'
                                : 'bg-zinc-200 shadow-inner shadow-zinc-300 dark:bg-zinc-700 dark:shadow-zinc-800'
                            }`}
                          >
                            <span className="sr-only">Enable {channel.name}</span>
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${
                                channel.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {renderContent()}

      {isPanelOpen && selectedChannel && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsPanelOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 flex w-full max-w-md">
            <div className="animate-in slide-in-from-right flex h-full w-full flex-col border-l border-zinc-200 bg-white shadow-2xl duration-300 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    {selectedChannel.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedChannel.name}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Channel Configuration
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
                      Setup Guide
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
                    <a
                      href="#"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-300 dark:hover:text-primary-200"
                    >
                      Read full documentation <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="space-y-5">
                    <h3 className="border-b border-zinc-100 pb-2 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                      Credentials
                    </h3>
                    {selectedChannel.fields.map((field) => (
                      <div key={field.key}>
                        <label className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          value={formData[field.key] || ''}
                          onChange={(event) => handleFieldChange(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 shadow-sm transition-all outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
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

              <div className="border-t border-zinc-100 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary-500/20 transition-colors hover:bg-primary-600 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      'Save & Enable Channel'
                    )}
                  </button>
                  {selectedChannel.status !== 'not_configured' && (
                    <button
                      onClick={() => void handleDeleteConfig()}
                      className="w-full py-3 text-sm font-semibold text-red-500 transition-colors hover:text-red-600"
                    >
                      Delete Configuration
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
