import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Hash, Webhook, Settings, CheckCircle2, X, ExternalLink, AlertCircle, BookOpen, ChevronRight, Smile, MessageCircle, Zap, Building2 } from 'lucide-react';
import { channelService, Channel } from '../../services/channelService';
import { useInstanceStore } from '../../store/useInstanceStore';


export function Channels() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true);
      try {
        const data = await channelService.getChannels();
        setChannels(data);
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChannels();
  }, []);

  const handleConfigure = (channel: Channel) => {
    setSelectedChannel(channel);
    const initialFormData: Record<string, string> = {};
    channel.fields.forEach(f => {
      if (f.value !== undefined) {
        initialFormData[f.key] = f.value;
      }
    });
    setFormData(initialFormData);
    setIsPanelOpen(true);
  };

  const handleToggleEnable = async (id: string, currentEnabled: boolean) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;

    // If trying to enable but not configured, open config panel instead
    if (!currentEnabled && channel.status === 'not_configured') {
      handleConfigure(channel);
      return;
    }

    try {
      const updatedChannels = await channelService.updateChannelStatus(id, !currentEnabled);
      setChannels(updatedChannels);
    } catch (error) {
      console.error('Failed to update channel status:', error);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedChannel) return;
    setIsSaving(true);
    try {
      const updatedChannels = await channelService.saveChannelConfig(selectedChannel.id, formData);
      setChannels(updatedChannels);
      setIsPanelOpen(false);
    } catch (error) {
      console.error('Failed to save channel config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!selectedChannel) return;
    try {
      const updatedChannels = await channelService.deleteChannelConfig(selectedChannel.id);
      setChannels(updatedChannels);
      setIsPanelOpen(false);
    } catch (error) {
      console.error('Failed to delete channel config:', error);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Channels</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">Connect your OpenClaw agents to external messaging platforms and APIs.</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {channels.map((channel) => (
                <div key={channel.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-start gap-5 flex-1">
                    <div className="w-14 h-14 bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
                      {channel.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{channel.name}</h3>
                        {channel.status === 'connected' && channel.enabled && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        )}
                        {channel.status === 'not_configured' && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 uppercase tracking-wider">
                            Not Configured
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed max-w-2xl">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:pl-6 sm:border-l border-zinc-100 dark:border-zinc-800">
                    {channel.status === 'not_configured' ? (
                      <button 
                        onClick={() => handleConfigure(channel)}
                        className="flex items-center gap-2 text-sm font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-200"
                      >
                        Connect
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleConfigure(channel)}
                          className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors px-4 py-2.5 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-500/10"
                        >
                          <Settings className="w-4 h-4" />
                          Configure
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleToggleEnable(channel.id, channel.enabled)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                              channel.enabled ? 'bg-primary-500 shadow-inner shadow-primary-600' : 'bg-zinc-200 dark:bg-zinc-700 shadow-inner shadow-zinc-300 dark:shadow-zinc-800'
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
    <div className="h-full flex bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {renderContent()}

      {/* Slide-over Configuration Panel */}
      {isPanelOpen && selectedChannel && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity" onClick={() => setIsPanelOpen(false)}></div>
          
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex">
            <div className="w-full h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-zinc-200 dark:border-zinc-800">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    {selectedChannel.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedChannel.name}</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Channel Configuration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPanelOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-8">
                  
                  {/* Setup Guide Section */}
                  <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 rounded-2xl p-5">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-primary-900 dark:text-primary-100 mb-3">
                      <BookOpen className="w-4 h-4 text-primary-500" />
                      Setup Guide
                    </h3>
                    <ol className="space-y-3">
                      {selectedChannel.setupGuide.map((step, index) => (
                        <li key={index} className="flex gap-3 text-sm text-primary-800 dark:text-primary-200">
                          <span className="font-mono font-bold text-primary-400 dark:text-primary-500 shrink-0">{index + 1}.</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <a href="#" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-4 hover:underline">
                      Read full documentation <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">Credentials</h3>
                    {selectedChannel.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                          {field.label}
                        </label>
                        <input 
                          type={field.type}
                          placeholder={field.placeholder}
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all shadow-sm"
                        />
                        {field.helpText && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{field.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col gap-3">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-md shadow-primary-500/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...</>
                  ) : (
                    'Save & Enable Channel'
                  )}
                </button>
                {selectedChannel.status !== 'not_configured' && (
                  <button 
                    onClick={handleDeleteConfig}
                    className="w-full py-3 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Delete Configuration
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
