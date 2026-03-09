import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Edit2, Save, X, Check, Settings2, Key, Globe, Cpu, Hash, MessageSquare, Star, ChevronDown } from 'lucide-react';
import { useLLMStore, LLMChannel, LLMModel } from '@sdkwork/claw-studio-business/stores/useLLMStore';
import { motion, AnimatePresence } from 'motion/react';

export function LLMSettings() {
  const { channels, config, activeChannelId, activeModelId, addChannel, updateChannel, removeChannel, updateConfig, setActiveChannel, setActiveModel } = useLLMStore();
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LLMChannel>>({});
  const [isAdding, setIsAdding] = useState(false);

  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];

  const handleEdit = (channel: LLMChannel) => {
    setEditingChannelId(channel.id);
    setEditForm(channel);
    setIsAdding(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingChannelId(null);
    setEditForm({
      name: 'New Channel',
      provider: 'custom',
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      icon: '🔌',
      models: [{ id: 'custom-model', name: 'Custom Model' }]
    });
  };

  const handleSave = () => {
    if (isAdding) {
      addChannel(editForm as Omit<LLMChannel, 'id'>);
      setIsAdding(false);
    } else if (editingChannelId) {
      updateChannel(editingChannelId, editForm);
      setEditingChannelId(null);
    }
  };

  const handleCancel = () => {
    setEditingChannelId(null);
    setIsAdding(false);
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-900 dark:to-black rounded-3xl p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <Sparkles className="w-6 h-6 text-primary-400" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">LLM Configuration</h2>
            </div>
            <p className="text-zinc-400 max-w-xl text-lg">
              Fine-tune your AI experience. Manage model providers, API keys, and global generation parameters for the ultimate control.
            </p>
          </div>
          <button
            onClick={handleAdd}
            disabled={isAdding || editingChannelId !== null}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl font-bold transition-all shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-5 h-5" /> Add Channel
          </button>
        </div>
      </div>

      {/* Global Defaults */}
      <section>
        <div className="flex items-center gap-2 mb-6 px-2">
          <Star className="w-5 h-5 text-primary-500 fill-primary-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Global Defaults</h3>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                Default Channel
              </label>
              <div className="relative">
                <select
                  value={activeChannelId}
                  onChange={(e) => {
                    const newChannelId = e.target.value;
                    setActiveChannel(newChannelId);
                    const newChannel = channels.find(c => c.id === newChannelId);
                    if (newChannel && newChannel.models.length > 0) {
                      setActiveModel(newChannel.defaultModelId || newChannel.models[0].id);
                    }
                  }}
                  className="w-full appearance-none px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 pr-10 cursor-pointer"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">This channel will be selected by default in new chats.</p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                Default Model
              </label>
              <div className="relative">
                <select
                  value={activeModelId}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="w-full appearance-none px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 pr-10 cursor-pointer"
                >
                  {activeChannel?.models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">The default model to use for the selected channel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Global Parameters */}
      <section>
        <div className="flex items-center gap-2 mb-6 px-2">
          <Settings2 className="w-5 h-5 text-primary-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Global Parameters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Temperature */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Temperature
              </label>
              <span className="px-2.5 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold font-mono">
                {config.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-primary-500 mb-3"
            />
            <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Max Tokens
              </label>
              <Hash className="w-4 h-4 text-zinc-400" />
            </div>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) => updateConfig({ maxTokens: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 font-medium">Maximum length of the generated response.</p>
          </div>

          {/* Top P */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Top P
              </label>
              <span className="px-2.5 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold font-mono">
                {config.topP.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.topP}
              onChange={(e) => updateConfig({ topP: parseFloat(e.target.value) })}
              className="w-full accent-primary-500 mb-3"
            />
            <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <span>Focused</span>
              <span>Diverse</span>
            </div>
          </div>
        </div>
      </section>

      {/* Channels List */}
      <section>
        <div className="flex items-center gap-2 mb-6 px-2">
          <Globe className="w-5 h-5 text-primary-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Model Channels</h3>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isAdding && (
              <motion.div 
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-zinc-900 border-2 border-primary-500/50 rounded-3xl p-6 shadow-lg overflow-hidden"
              >
                <ChannelForm 
                  form={editForm} 
                  setForm={setEditForm} 
                  onSave={handleSave} 
                  onCancel={handleCancel} 
                />
              </motion.div>
            )}

            {channels.map(channel => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={channel.id} 
                className={`bg-white dark:bg-zinc-900 border rounded-3xl overflow-hidden transition-all duration-300 ${
                  editingChannelId === channel.id 
                    ? 'border-primary-500/50 shadow-lg' 
                    : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {editingChannelId === channel.id ? (
                  <div className="p-6">
                    <ChannelForm 
                      form={editForm} 
                      setForm={setEditForm} 
                      onSave={handleSave} 
                      onCancel={handleCancel} 
                    />
                  </div>
                ) : (
                  <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl shrink-0 shadow-inner border border-zinc-200/50 dark:border-zinc-700/50">
                        {channel.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                            {channel.name}
                          </h4>
                          <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-zinc-200 dark:border-zinc-700">
                            {channel.provider}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-4 font-mono bg-zinc-50 dark:bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800/50 inline-flex">
                          <Globe className="w-3.5 h-3.5" />
                          {channel.baseUrl}
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {channel.models.map(model => (
                            <button 
                              key={model.id} 
                              onClick={() => updateChannel(channel.id, { defaultModelId: model.id })}
                              title={channel.defaultModelId === model.id ? "Default Model" : "Click to set as default"}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                              channel.defaultModelId === model.id 
                                ? 'bg-primary-500 text-white border-primary-600 shadow-sm' 
                                : 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 border-primary-100 dark:border-primary-500/20 hover:bg-primary-100 dark:hover:bg-primary-500/20 cursor-pointer'
                            }`}>
                              {channel.defaultModelId === model.id ? <Star className="w-3.5 h-3.5 fill-current" /> : <Cpu className="w-3.5 h-3.5" />}
                              {model.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-start">
                      <button
                        onClick={() => handleEdit(channel)}
                        className="p-2.5 text-zinc-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl transition-colors"
                        title="Edit Channel"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeChannel(channel.id)}
                        className="p-2.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                        title="Delete Channel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

function ChannelForm({ form, setForm, onSave, onCancel }: any) {
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const handleAddModel = () => {
    if (!newModelId.trim() || !newModelName.trim()) return;
    const newModel = { id: newModelId.trim(), name: newModelName.trim() };
    const updatedModels = [...(form.models || []), newModel];
    
    // If it's the first model, make it default
    if (updatedModels.length === 1) {
      setForm({ ...form, models: updatedModels, defaultModelId: newModel.id });
    } else {
      setForm({ ...form, models: updatedModels });
    }
    
    setNewModelId('');
    setNewModelName('');
  };

  const handleRemoveModel = (modelId: string) => {
    const updatedModels = form.models.filter((m: any) => m.id !== modelId);
    let updatedDefault = form.defaultModelId;
    
    // If we removed the default model, pick a new one or clear it
    if (form.defaultModelId === modelId) {
      updatedDefault = updatedModels.length > 0 ? updatedModels[0].id : undefined;
    }
    
    setForm({ ...form, models: updatedModels, defaultModelId: updatedDefault });
  };

  const handleSetDefaultModel = (modelId: string) => {
    setForm({ ...form, defaultModelId: modelId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center text-primary-500">
          <Settings2 className="w-5 h-5" />
        </div>
        <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {form.id ? 'Edit Channel' : 'Configure New Channel'}
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            Channel Name
          </label>
          <input
            type="text"
            value={form.name || ''}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., My Custom OpenAI"
            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            Provider Type
          </label>
          <input
            type="text"
            value={form.provider || ''}
            onChange={e => setForm({ ...form, provider: e.target.value })}
            placeholder="e.g., openai, custom"
            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Globe className="w-4 h-4 text-zinc-400" /> Base URL
          </label>
          <input
            type="text"
            value={form.baseUrl || ''}
            onChange={e => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-400" /> API Key
          </label>
          <input
            type="password"
            value={form.apiKey || ''}
            onChange={e => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-... (Leave empty to use environment variable)"
            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            Icon (Emoji)
          </label>
          <input
            type="text"
            value={form.icon || ''}
            onChange={e => setForm({ ...form, icon: e.target.value })}
            placeholder="🤖"
            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-zinc-400" /> Models Configuration
            </label>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Click the star to set as default
            </span>
          </div>

          {/* Visual Model List */}
          <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            {form.models?.length > 0 ? (
              <div className="space-y-2">
                {form.models.map((model: any) => (
                  <div key={model.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm group">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSetDefaultModel(model.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          form.defaultModelId === model.id 
                            ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10' 
                            : 'text-zinc-300 dark:text-zinc-700 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10'
                        }`}
                        title={form.defaultModelId === model.id ? "Default Model" : "Set as Default"}
                      >
                        <Star className={`w-4 h-4 ${form.defaultModelId === model.id ? 'fill-current' : ''}`} />
                      </button>
                      <div>
                        <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{model.name}</div>
                        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{model.id}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveModel(model.id)}
                      className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove Model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                No models configured. Add one below.
              </div>
            )}

            {/* Add Model Input */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <input
                type="text"
                value={newModelId}
                onChange={e => setNewModelId(e.target.value)}
                placeholder="Model ID (e.g., gpt-4o)"
                className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                onKeyDown={e => e.key === 'Enter' && handleAddModel()}
              />
              <input
                type="text"
                value={newModelName}
                onChange={e => setNewModelName(e.target.value)}
                placeholder="Display Name (e.g., GPT-4o)"
                className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                onKeyDown={e => e.key === 'Enter' && handleAddModel()}
              />
              <button
                onClick={handleAddModel}
                disabled={!newModelId.trim() || !newModelName.trim()}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-800 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-6 py-2.5 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 rounded-xl transition-all shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 flex items-center gap-2 active:scale-95"
        >
          <Save className="w-4 h-4" /> Save Configuration
        </button>
      </div>
    </div>
  );
}
