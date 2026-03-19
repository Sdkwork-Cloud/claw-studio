import React, { useState } from 'react';
import {
  AlertCircle,
  Cpu,
  Edit2,
  Globe,
  Hash,
  Key,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useInstanceStore } from '@sdkwork/claw-core';
import { useLocalizedText } from '@sdkwork/claw-i18n';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from '@sdkwork/claw-ui';
import { type LLMChannel, useLLMStore } from './store/useLLMStore';

export function LLMSettings() {
  const { activeInstanceId } = useInstanceStore();
  const {
    channels,
    addChannel,
    updateChannel,
    removeChannel,
    updateConfig,
    setActiveChannel,
    setActiveModel,
    getInstanceConfig,
  } = useLLMStore();
  const { text } = useLocalizedText();

  const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;
  const activeChannelId = instanceConfig?.activeChannelId ?? '';
  const activeModelId = instanceConfig?.activeModelId ?? '';
  const config = instanceConfig?.config ?? { temperature: 0.7, maxTokens: 2048, topP: 1.0 };

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LLMChannel>>({});
  const [isAdding, setIsAdding] = useState(false);

  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? channels[0];
  const selectedChannelId = activeChannelId || activeChannel?.id;
  const selectedModelId =
    activeModelId || activeChannel?.defaultModelId || activeChannel?.models[0]?.id;

  const handleEdit = (channel: LLMChannel) => {
    setEditingChannelId(channel.id);
    setEditForm(channel);
    setIsAdding(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingChannelId(null);
    setEditForm({
      name: text('New Channel', '\u65b0\u6e20\u9053'),
      provider: 'custom',
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      icon: '\u2728',
      models: [
        {
          id: 'custom-model',
          name: text('Custom Model', '\u81ea\u5b9a\u4e49\u6a21\u578b'),
        },
      ],
    });
  };

  const handleSave = () => {
    if (isAdding) {
      addChannel(editForm as Omit<LLMChannel, 'id'>);
      setIsAdding(false);
      return;
    }

    if (editingChannelId) {
      updateChannel(editingChannelId, editForm);
      setEditingChannelId(null);
    }
  };

  const handleCancel = () => {
    setEditingChannelId(null);
    setIsAdding(false);
  };

  if (!activeInstanceId) {
    return (
      <div className="mx-auto flex h-64 max-w-[1400px] flex-col items-center justify-center p-6 text-center md:p-10">
        <AlertCircle className="mb-4 h-12 w-12 text-zinc-400" />
        <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {text('No Instance Selected', '\u672a\u9009\u4e2d\u5b9e\u4f8b')}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400">
          {text(
            'Please select an instance from the sidebar to configure LLM settings.',
            '\u8bf7\u5148\u4ece\u4fa7\u8fb9\u680f\u9009\u62e9\u4e00\u4e2a\u5b9e\u4f8b\uff0c\u7136\u540e\u518d\u914d\u7f6e LLM \u8bbe\u7f6e\u3002',
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 text-white shadow-2xl dark:from-zinc-900 dark:to-black md:p-10">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/2 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/3 translate-y-1/3 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-md">
                <Sparkles className="h-6 w-6 text-primary-400" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">
                {text('LLM Configuration', 'LLM \u914d\u7f6e')}
              </h2>
            </div>
            <p className="max-w-xl text-lg text-zinc-400">
              {text(
                'Fine-tune your AI experience. Manage model providers, API keys, and global generation parameters for the ultimate control.',
                '\u7ec6\u81f4\u8c03\u6574\u4f60\u7684 AI \u4f53\u9a8c\uff0c\u7edf\u4e00\u7ba1\u7406\u6a21\u578b\u63d0\u4f9b\u65b9\u3001API \u5bc6\u94a5\u4e0e\u5168\u5c40\u751f\u6210\u53c2\u6570\uff0c\u83b7\u5f97\u66f4\u5f3a\u63a7\u5236\u529b\u3002',
              )}
            </p>
          </div>
          <Button
            onClick={handleAdd}
            disabled={isAdding || editingChannelId !== null}
            variant="secondary"
            className="h-auto shrink-0 rounded-xl bg-white px-6 py-3 font-bold text-zinc-900 shadow-xl transition-all hover:scale-105 hover:bg-zinc-100 active:scale-95 disabled:hover:scale-100"
          >
            <Plus className="h-5 w-5" />
            {text('Add Channel', '\u65b0\u589e\u6e20\u9053')}
          </Button>
        </div>
      </div>

      <section>
        <div className="mb-6 flex items-center gap-2 px-2">
          <Star className="h-5 w-5 fill-primary-500 text-primary-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {text('Instance Defaults', '\u5b9e\u4f8b\u9ed8\u8ba4\u503c')}
          </h3>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {text('Default Channel', '\u9ed8\u8ba4\u6e20\u9053')}
              </Label>
              <Select
                value={selectedChannelId}
                onValueChange={(channelId) => {
                  if (!channelId) {
                    return;
                  }

                  if (activeInstanceId) {
                    setActiveChannel(activeInstanceId, channelId);
                  }

                  const channel = channels.find((item) => item.id === channelId);
                  if (activeInstanceId && channel && channel.models.length > 0) {
                    setActiveModel(activeInstanceId, channel.defaultModelId ?? channel.models[0].id);
                  }
                }}
              >
                <SelectTrigger className="h-auto rounded-xl bg-zinc-50 px-4 py-3.5 font-bold dark:bg-zinc-950">
                  <SelectValue placeholder={text('Select channel', '\u9009\u62e9\u6e20\u9053')} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.icon} {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {text(
                  'This channel will be selected by default in new chats.',
                  '\u65b0\u5efa\u804a\u5929\u65f6\u5c06\u9ed8\u8ba4\u9009\u62e9\u6b64\u6e20\u9053\u3002',
                )}
              </p>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {text('Default Model', '\u9ed8\u8ba4\u6a21\u578b')}
              </Label>
              <Select
                value={selectedModelId}
                onValueChange={(value) => {
                  if (activeInstanceId) {
                    setActiveModel(activeInstanceId, value);
                  }
                }}
              >
                <SelectTrigger className="h-auto rounded-xl bg-zinc-50 px-4 py-3.5 font-bold dark:bg-zinc-950">
                  <SelectValue placeholder={text('Select model', '\u9009\u62e9\u6a21\u578b')} />
                </SelectTrigger>
                <SelectContent>
                  {activeChannel?.models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {text(
                  'The default model to use for the selected channel.',
                  '\u5f53\u524d\u6e20\u9053\u9ed8\u8ba4\u4f7f\u7528\u7684\u6a21\u578b\u3002',
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-center gap-2 px-2">
          <Settings2 className="h-5 w-5 text-primary-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {text('Instance Parameters', '\u5b9e\u4f8b\u53c2\u6570')}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="group rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {text('Temperature', '\u6e29\u5ea6')}
              </Label>
              <span className="rounded-lg bg-primary-50 px-2.5 py-1 font-mono text-xs font-bold text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                {config.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[config.temperature]}
              onValueChange={([value]) =>
                updateConfig(activeInstanceId, {
                  temperature: value ?? config.temperature,
                })
              }
              className="mb-4"
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span>{text('Precise', '\u7cbe\u786e')}</span>
              <span>{text('Creative', '\u521b\u9020')}</span>
            </div>
          </div>

          <div className="group rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {text('Max Tokens', '\u6700\u5927 Tokens')}
              </Label>
              <Hash className="h-4 w-4 text-zinc-400" />
            </div>
            <Input
              type="number"
              value={config.maxTokens}
              onChange={(event) =>
                updateConfig(activeInstanceId, {
                  maxTokens: parseInt(event.target.value, 10),
                })
              }
              className="bg-zinc-50 font-mono dark:bg-zinc-950"
            />
            <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {text(
                'Maximum length of the generated response.',
                '\u751f\u6210\u54cd\u5e94\u7684\u6700\u5927\u957f\u5ea6\u3002',
              )}
            </p>
          </div>

          <div className="group rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {text('Top P', 'Top P')}
              </Label>
              <span className="rounded-lg bg-primary-50 px-2.5 py-1 font-mono text-xs font-bold text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                {config.topP.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[config.topP]}
              onValueChange={([value]) =>
                updateConfig(activeInstanceId, {
                  topP: value ?? config.topP,
                })
              }
              className="mb-4"
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span>{text('Focused', '\u96c6\u4e2d')}</span>
              <span>{text('Diverse', '\u591a\u6837')}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-center gap-2 px-2">
          <Globe className="h-5 w-5 text-primary-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {text('Model Channels', '\u6a21\u578b\u6e20\u9053')}
          </h3>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-3xl border-2 border-primary-500/50 bg-white p-6 shadow-lg dark:bg-zinc-900"
              >
                <ChannelForm
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              </motion.div>
            )}

            {channels.map((channel) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={channel.id}
                className={`overflow-hidden rounded-3xl border bg-white transition-all duration-300 dark:bg-zinc-900 ${
                  editingChannelId === channel.id
                    ? 'border-primary-500/50 shadow-lg'
                    : 'border-zinc-200 shadow-sm hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700'
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
                  <div className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-start">
                    <div className="flex items-start gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/50 bg-zinc-100 text-3xl shadow-inner dark:border-zinc-700/50 dark:bg-zinc-800">
                        {channel.icon}
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <h4 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                            {channel.name}
                          </h4>
                          <span className="rounded-lg border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            {channel.provider}
                          </span>
                        </div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 font-mono text-sm text-zinc-500 dark:border-zinc-800/50 dark:bg-zinc-950/50 dark:text-zinc-400">
                          <Globe className="h-3.5 w-3.5" />
                          {channel.baseUrl}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {channel.models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => updateChannel(channel.id, { defaultModelId: model.id })}
                              title={
                                channel.defaultModelId === model.id
                                  ? text('Default model', '\u9ed8\u8ba4\u6a21\u578b')
                                  : text(
                                      'Click to set as default',
                                      '\u70b9\u51fb\u8bbe\u4e3a\u9ed8\u8ba4',
                                    )
                              }
                              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                                channel.defaultModelId === model.id
                                  ? 'border-primary-600 bg-primary-500 text-white shadow-sm'
                                  : 'border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300 dark:hover:bg-primary-500/20'
                              }`}
                            >
                              {channel.defaultModelId === model.id ? (
                                <Star className="h-3.5 w-3.5 fill-current" />
                              ) : (
                                <Cpu className="h-3.5 w-3.5" />
                              )}
                              {model.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-start">
                      <button
                        onClick={() => handleEdit(channel)}
                        className="rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-primary-50 hover:text-primary-500 dark:hover:bg-primary-500/10"
                        title={text('Edit channel', '\u7f16\u8f91\u6e20\u9053')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeChannel(channel.id)}
                        className="rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                        title={text('Delete channel', '\u5220\u9664\u6e20\u9053')}
                      >
                        <Trash2 className="h-4 w-4" />
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

function ChannelForm({
  form,
  setForm,
  onSave,
  onCancel,
}: {
  form: Partial<LLMChannel>;
  setForm: React.Dispatch<React.SetStateAction<Partial<LLMChannel>>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const { text } = useLocalizedText();

  const handleAddModel = () => {
    if (!newModelId.trim() || !newModelName.trim()) {
      return;
    }

    const model = { id: newModelId.trim(), name: newModelName.trim() };
    const models = [...(form.models ?? []), model];
    setForm((current) => ({
      ...current,
      models,
      defaultModelId: current.defaultModelId ?? model.id,
    }));
    setNewModelId('');
    setNewModelName('');
  };

  const handleRemoveModel = (modelId: string) => {
    const models = (form.models ?? []).filter((model) => model.id !== modelId);
    const defaultModelId =
      form.defaultModelId === modelId ? models[0]?.id : form.defaultModelId;

    setForm((current) => ({
      ...current,
      models,
      defaultModelId,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-500 dark:bg-primary-500/10">
          <Settings2 className="h-5 w-5" />
        </div>
        <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {form.id
            ? text('Edit Channel', '\u7f16\u8f91\u6e20\u9053')
            : text('Configure New Channel', '\u914d\u7f6e\u65b0\u6e20\u9053')}
        </h4>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {text('Channel Name', '\u6e20\u9053\u540d\u79f0')}
          </Label>
          <Input
            type="text"
            value={form.name ?? ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder={text(
              'e.g., My Custom OpenAI',
              '\u4f8b\u5982\uff1aMy Custom OpenAI',
            )}
            className="bg-zinc-50 text-sm font-medium dark:bg-zinc-950"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {text('Provider Type', '\u63d0\u4f9b\u65b9\u7c7b\u578b')}
          </Label>
          <Input
            type="text"
            value={form.provider ?? ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, provider: event.target.value }))
            }
            placeholder={text('e.g., openai, custom', '\u4f8b\u5982\uff1aopenai, custom')}
            className="bg-zinc-50 text-sm font-medium dark:bg-zinc-950"
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
            <Globe className="h-4 w-4 text-zinc-400" />
            {text('Base URL', '\u57fa\u7840 URL')}
          </Label>
          <Input
            type="text"
            value={form.baseUrl ?? ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, baseUrl: event.target.value }))
            }
            placeholder={'https://api.openai.com/v1'}
            className="bg-zinc-50 font-mono dark:bg-zinc-950"
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
            <Key className="h-4 w-4 text-zinc-400" />
            {text('API Key', 'API \u5bc6\u94a5')}
          </Label>
          <Input
            type="password"
            value={form.apiKey ?? ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, apiKey: event.target.value }))
            }
            placeholder={text(
              'sk-... (Leave empty to use environment variable)',
              'sk-... (\u7559\u7a7a\u5219\u4f7f\u7528\u73af\u5883\u53d8\u91cf)',
            )}
            className="bg-zinc-50 font-mono dark:bg-zinc-950"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {text('Icon (Emoji)', '\u56fe\u6807\uff08Emoji\uff09')}
          </Label>
          <Input
            type="text"
            value={form.icon ?? ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, icon: event.target.value }))
            }
            placeholder={text('e.g. icon', '\u4f8b\u5982\uff1a\u56fe\u6807')}
            className="bg-zinc-50 dark:bg-zinc-950"
          />
        </div>

        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
              <Cpu className="h-4 w-4 text-zinc-400" />
              {text('Models Configuration', '\u6a21\u578b\u914d\u7f6e')}
            </Label>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {text(
                'Click the star to set as default',
                '\u70b9\u51fb\u661f\u6807\u8bbe\u4e3a\u9ed8\u8ba4',
              )}
            </span>
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {(form.models ?? []).length > 0 ? (
              <div className="space-y-2">
                {(form.models ?? []).map((model) => (
                  <div
                    key={model.id}
                    className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setForm((current) => ({ ...current, defaultModelId: model.id }))
                        }
                        className={`rounded-lg p-1.5 transition-colors ${
                          form.defaultModelId === model.id
                            ? 'bg-yellow-50 text-yellow-500 dark:bg-yellow-500/10'
                            : 'text-zinc-300 hover:bg-yellow-50 hover:text-yellow-500 dark:text-zinc-700 dark:hover:bg-yellow-500/10'
                        }`}
                        title={
                          form.defaultModelId === model.id
                            ? text('Default model', '\u9ed8\u8ba4\u6a21\u578b')
                            : text('Set as default', '\u8bbe\u4e3a\u9ed8\u8ba4')
                        }
                      >
                        <Star
                          className={`h-4 w-4 ${
                            form.defaultModelId === model.id ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                      <div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {model.name}
                        </div>
                        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {model.id}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveModel(model.id)}
                      className="rounded-lg p-2 text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      title={text('Remove model', '\u79fb\u9664\u6a21\u578b')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {text(
                  'No models configured. Add one below.',
                  '\u5c1a\u672a\u914d\u7f6e\u6a21\u578b\uff0c\u53ef\u5728\u4e0b\u65b9\u6dfb\u52a0\u3002',
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800 sm:flex-row">
              <Input
                type="text"
                value={newModelId}
                onChange={(event) => setNewModelId(event.target.value)}
                placeholder={text(
                  'Model ID (e.g., gpt-4o)',
                  '\u6a21\u578b ID\uff08\u4f8b\u5982\uff1agpt-4o\uff09',
                )}
                onKeyDown={(event) => event.key === 'Enter' && handleAddModel()}
                className="flex-1 bg-white font-mono dark:border-zinc-800 dark:bg-zinc-900"
              />
              <Input
                type="text"
                value={newModelName}
                onChange={(event) => setNewModelName(event.target.value)}
                placeholder={text(
                  'Display Name (e.g., GPT-4o)',
                  '\u663e\u793a\u540d\u79f0\uff08\u4f8b\u5982\uff1aGPT-4o\uff09',
                )}
                onKeyDown={(event) => event.key === 'Enter' && handleAddModel()}
                className="flex-1 bg-white text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900"
              />
              <Button
                onClick={handleAddModel}
                disabled={!newModelId.trim() || !newModelName.trim()}
                className="h-auto shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                {text('Add', '\u6dfb\u52a0')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Button
          onClick={onCancel}
          variant="ghost"
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {text('Cancel', '\u53d6\u6d88')}
        </Button>
        <Button
          onClick={onSave}
          className="h-auto rounded-xl px-6 py-2.5 text-sm font-bold shadow-lg shadow-primary-500/20 transition-all hover:shadow-xl hover:shadow-primary-500/30 active:scale-95"
        >
          <Save className="h-4 w-4" />
          {text('Save Configuration', '\u4fdd\u5b58\u914d\u7f6e')}
        </Button>
      </div>
    </div>
  );
}
