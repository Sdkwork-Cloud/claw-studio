import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LLMModel {
  id: string;
  name: string;
}

export interface LLMChannel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  models: LLMModel[];
  defaultModelId?: string;
  icon: string;
}

export interface LLMConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface InstanceLLMState {
  activeChannelId: string;
  activeModelId: string;
  config: LLMConfig;
}

interface LLMState {
  channels: LLMChannel[];
  instanceConfigs: Record<string, InstanceLLMState>;
  addChannel: (channel: Omit<LLMChannel, 'id'>) => void;
  updateChannel: (id: string, channel: Partial<LLMChannel>) => void;
  removeChannel: (id: string) => void;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  updateConfig: (instanceId: string, config: Partial<LLMConfig>) => void;
  getInstanceConfig: (instanceId: string) => InstanceLLMState;
}

function createDefaultChannels(): LLMChannel[] {
  return [
    {
      id: 'google-gemini',
      name: 'Google Gemini',
      provider: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: '',
      icon: '\u2728',
      defaultModelId: 'gemini-3-flash-preview',
      models: [
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
        { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
      ],
    },
    {
      id: 'openai-chatgpt',
      name: 'OpenAI',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      icon: '\ud83e\udde0',
      defaultModelId: 'gpt-5.4',
      models: [
        { id: 'gpt-5.4', name: 'GPT-5.4' },
        { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
        { id: 'o4-mini', name: 'o4-mini' },
      ],
    },
    {
      id: 'moonshot',
      name: 'Moonshot (Kimi)',
      provider: 'moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: '',
      icon: '\ud83c\udf19',
      defaultModelId: 'moonshot-v1-8k',
      models: [
        { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K' },
        { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
        { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' },
      ],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      icon: '\ud83d\udd0d',
      defaultModelId: 'deepseek-chat',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
      ],
    },
    {
      id: 'xai-grok',
      name: 'xAI Grok',
      provider: 'xai',
      baseUrl: 'https://api.x.ai/v1',
      apiKey: '',
      icon: '\u2699\ufe0f',
      defaultModelId: 'grok-4',
      models: [
        { id: 'grok-4', name: 'Grok 4' },
        { id: 'grok-4-fast', name: 'Grok 4 Fast' },
        { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast' },
      ],
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      provider: 'minimax',
      baseUrl: 'https://api.minimax.io/anthropic',
      apiKey: '',
      icon: '\ud83d\udd36',
      defaultModelId: 'MiniMax-M2.7',
      models: [
        { id: 'MiniMax-M2.7', name: 'MiniMax M2.7' },
        { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed' },
      ],
    },
    {
      id: 'qwen',
      name: 'Qwen (Model Studio)',
      provider: 'qwen',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: '',
      icon: '\u2601\ufe0f',
      defaultModelId: 'qwen-max',
      models: [
        { id: 'qwen-max', name: 'Qwen Max' },
        { id: 'qwq-plus', name: 'QwQ Plus' },
        { id: 'qwen-plus', name: 'Qwen Plus' },
      ],
    },
  ];
}

const DEFAULT_INSTANCE_CONFIG: InstanceLLMState = {
  activeChannelId: 'google-gemini',
  activeModelId: 'gemini-3-flash-preview',
  config: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
  },
};

const DEFAULT_CHANNEL_IDS = new Set(createDefaultChannels().map((channel) => channel.id));

function cloneModels(models: LLMModel[]) {
  return models.map((model) => ({ ...model }));
}

function cloneChannel(channel: LLMChannel): LLMChannel {
  return {
    ...channel,
    models: cloneModels(channel.models),
  };
}

function resolveDefaultChannelModels() {
  return createDefaultChannels().map(cloneChannel);
}

function mergeBuiltInChannel(base: LLMChannel, persisted?: Partial<LLMChannel>): LLMChannel {
  return {
    ...cloneChannel(base),
    apiKey: typeof persisted?.apiKey === 'string' ? persisted.apiKey : base.apiKey,
    baseUrl:
      typeof persisted?.baseUrl === 'string' && persisted.baseUrl.trim()
        ? persisted.baseUrl
        : base.baseUrl,
  };
}

function getFallbackInstanceConfig(channels: LLMChannel[]): InstanceLLMState {
  const firstChannel = channels[0] || cloneChannel(createDefaultChannels()[0]!);
  const defaultModelId = firstChannel.defaultModelId || firstChannel.models[0]?.id || '';

  return {
    activeChannelId: firstChannel.id,
    activeModelId: defaultModelId,
    config: { ...DEFAULT_INSTANCE_CONFIG.config },
  };
}

function normalizeInstanceConfigs(
  instanceConfigs: Record<string, InstanceLLMState> | undefined,
  channels: LLMChannel[],
) {
  const fallback = getFallbackInstanceConfig(channels);
  const entries = Object.entries(instanceConfigs || {});

  return Object.fromEntries(
    entries.map(([instanceId, config]) => {
      const channel = channels.find((item) => item.id === config?.activeChannelId) || channels[0];
      const activeModelId =
        channel?.models.some((model) => model.id === config?.activeModelId)
          ? config.activeModelId
          : channel?.defaultModelId || channel?.models[0]?.id || fallback.activeModelId;

      return [
        instanceId,
        {
          activeChannelId: channel?.id || fallback.activeChannelId,
          activeModelId,
          config: {
            temperature: config?.config?.temperature ?? fallback.config.temperature,
            maxTokens: config?.config?.maxTokens ?? fallback.config.maxTokens,
            topP: config?.config?.topP ?? fallback.config.topP,
          },
        } satisfies InstanceLLMState,
      ];
    }),
  );
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      channels: resolveDefaultChannelModels(),
      instanceConfigs: {},
      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, { ...channel, id: Math.random().toString(36).substring(7) }],
        })),
      updateChannel: (id, channelUpdate) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === id ? { ...channel, ...channelUpdate } : channel,
          ),
        })),
      removeChannel: (id) =>
        set((state) => {
          const newChannels = state.channels.filter((channel) => channel.id !== id);
          const newInstanceConfigs = { ...state.instanceConfigs };

          for (const instanceId in newInstanceConfigs) {
            if (newInstanceConfigs[instanceId].activeChannelId === id) {
              newInstanceConfigs[instanceId] = {
                ...newInstanceConfigs[instanceId],
                activeChannelId: newChannels.length > 0 ? newChannels[0].id : '',
                activeModelId:
                  newChannels.length > 0
                    ? newChannels[0].defaultModelId || newChannels[0].models[0]?.id || ''
                    : '',
              };
            }
          }

          return {
            channels: newChannels,
            instanceConfigs: newInstanceConfigs,
          };
        }),
      setActiveChannel: (instanceId, channelId) =>
        set((state) => ({
          instanceConfigs: {
            ...state.instanceConfigs,
            [instanceId]: {
              ...(state.instanceConfigs[instanceId] || DEFAULT_INSTANCE_CONFIG),
              activeChannelId: channelId,
            },
          },
        })),
      setActiveModel: (instanceId, modelId) =>
        set((state) => ({
          instanceConfigs: {
            ...state.instanceConfigs,
            [instanceId]: {
              ...(state.instanceConfigs[instanceId] || DEFAULT_INSTANCE_CONFIG),
              activeModelId: modelId,
            },
          },
        })),
      updateConfig: (instanceId, configUpdate) =>
        set((state) => {
          const currentConfig = state.instanceConfigs[instanceId] || DEFAULT_INSTANCE_CONFIG;

          return {
            instanceConfigs: {
              ...state.instanceConfigs,
              [instanceId]: {
                ...currentConfig,
                config: { ...currentConfig.config, ...configUpdate },
              },
            },
          };
        }),
      getInstanceConfig: (instanceId) => {
        const state = get();
        return state.instanceConfigs[instanceId] || DEFAULT_INSTANCE_CONFIG;
      },
    }),
    {
      name: 'llm-storage',
      version: 2,
      merge: (persistedState, currentState) => {
        const typedState = (persistedState || {}) as Partial<LLMState>;
        const builtInChannels = resolveDefaultChannelModels();
        const persistedChannels = Array.isArray(typedState.channels) ? typedState.channels : [];
        const mergedBuiltInChannels = builtInChannels.map((channel) =>
          mergeBuiltInChannel(
            channel,
            persistedChannels.find((persistedChannel) => persistedChannel.id === channel.id),
          ),
        );
        const customChannels = persistedChannels
          .filter((channel) => !DEFAULT_CHANNEL_IDS.has(channel.id))
          .map((channel) => cloneChannel(channel));
        const channels = [...mergedBuiltInChannels, ...customChannels];

        return {
          ...currentState,
          ...typedState,
          channels,
          instanceConfigs: normalizeInstanceConfigs(typedState.instanceConfigs, channels),
        };
      },
    },
  ),
);
