import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

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

export interface LLMState {
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

const STORAGE_KEY = 'llm-storage';

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
};

const DEFAULT_CHANNELS: LLMChannel[] = [
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    icon: '✦',
    defaultModelId: 'gemini-3-flash-preview',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
    ],
  },
  {
    id: 'openai-chatgpt',
    name: 'OpenAI ChatGPT',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    icon: '◎',
    defaultModelId: 'gpt-4o',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    provider: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey: '',
    icon: '◐',
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
    icon: '◇',
    defaultModelId: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen (Tongyi Qianwen)',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    icon: '◈',
    defaultModelId: 'qwen-turbo',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
    ],
  },
];

const noopStorage: StateStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

function createDefaultInstanceConfig(): InstanceLLMState {
  return {
    activeChannelId: 'google-gemini',
    activeModelId: 'gemini-3-flash-preview',
    config: { ...DEFAULT_LLM_CONFIG },
  };
}

function getFallbackChannel(channels: LLMChannel[]) {
  const channel = channels[0];
  if (!channel) {
    return {
      activeChannelId: '',
      activeModelId: '',
    };
  }

  return {
    activeChannelId: channel.id,
    activeModelId: channel.defaultModelId ?? channel.models[0]?.id ?? '',
  };
}

function createPersistOptions(storage?: StateStorage) {
  return {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => storage ?? noopStorage),
  };
}

const createLLMStoreState: StateCreator<LLMState, [], [], LLMState> = (set, get) => ({
  channels: DEFAULT_CHANNELS,
  instanceConfigs: {},
  addChannel(channel) {
    set((state) => ({
      channels: [
        ...state.channels,
        {
          ...channel,
          id: Math.random().toString(36).slice(2, 9),
        },
      ],
    }));
  },
  updateChannel(id, channelUpdate) {
    set((state) => ({
      channels: state.channels.map((channel) =>
        channel.id === id ? { ...channel, ...channelUpdate } : channel,
      ),
    }));
  },
  removeChannel(id) {
    set((state) => {
      const nextChannels = state.channels.filter((channel) => channel.id !== id);
      const fallback = getFallbackChannel(nextChannels);
      const nextInstanceConfigs = Object.fromEntries(
        Object.entries(state.instanceConfigs).map(([instanceId, config]) => {
          if (config.activeChannelId !== id) {
            return [instanceId, config];
          }

          return [
            instanceId,
            {
              ...config,
              activeChannelId: fallback.activeChannelId,
              activeModelId: fallback.activeModelId,
            },
          ];
        }),
      );

      return {
        channels: nextChannels,
        instanceConfigs: nextInstanceConfigs,
      };
    });
  },
  setActiveChannel(instanceId, channelId) {
    set((state) => ({
      instanceConfigs: {
        ...state.instanceConfigs,
        [instanceId]: {
          ...(state.instanceConfigs[instanceId] ?? createDefaultInstanceConfig()),
          activeChannelId: channelId,
        },
      },
    }));
  },
  setActiveModel(instanceId, modelId) {
    set((state) => ({
      instanceConfigs: {
        ...state.instanceConfigs,
        [instanceId]: {
          ...(state.instanceConfigs[instanceId] ?? createDefaultInstanceConfig()),
          activeModelId: modelId,
        },
      },
    }));
  },
  updateConfig(instanceId, configUpdate) {
    set((state) => {
      const currentConfig = state.instanceConfigs[instanceId] ?? createDefaultInstanceConfig();
      return {
        instanceConfigs: {
          ...state.instanceConfigs,
          [instanceId]: {
            ...currentConfig,
            config: {
              ...currentConfig.config,
              ...configUpdate,
            },
          },
        },
      };
    });
  },
  getInstanceConfig(instanceId) {
    return get().instanceConfigs[instanceId] ?? createDefaultInstanceConfig();
  },
});

export const useLLMStore = create<LLMState>()(
  persist(createLLMStoreState, createPersistOptions()),
);
