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

const DEFAULT_CHANNELS: LLMChannel[] = [
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    icon: '\u2728',
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
    icon: '\ud83e\udde0',
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
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen (Tongyi Qianwen)',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    icon: '\u2601\ufe0f',
    defaultModelId: 'qwen-turbo',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
    ],
  },
];

const DEFAULT_INSTANCE_CONFIG: InstanceLLMState = {
  activeChannelId: 'google-gemini',
  activeModelId: 'gemini-3-flash-preview',
  config: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
  },
};

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      channels: DEFAULT_CHANNELS,
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
    },
  ),
);
