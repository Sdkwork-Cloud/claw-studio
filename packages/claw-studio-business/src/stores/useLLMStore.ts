import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LLMModel {
  id: string;
  name: string;
}

export interface LLMChannel {
  id: string;
  name: string;
  provider: string; // e.g., 'openai', 'google', 'anthropic', 'moonshot', 'deepseek', 'qwen'
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

interface LLMState {
  channels: LLMChannel[];
  activeChannelId: string;
  activeModelId: string;
  config: LLMConfig;
  addChannel: (channel: Omit<LLMChannel, 'id'>) => void;
  updateChannel: (id: string, channel: Partial<LLMChannel>) => void;
  removeChannel: (id: string) => void;
  setActiveChannel: (id: string) => void;
  setActiveModel: (id: string) => void;
  updateConfig: (config: Partial<LLMConfig>) => void;
}

const DEFAULT_CHANNELS: LLMChannel[] = [
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    icon: '✨',
    defaultModelId: 'gemini-3-flash-preview',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
    ]
  },
  {
    id: 'openai-chatgpt',
    name: 'OpenAI ChatGPT',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    icon: '🤖',
    defaultModelId: 'gpt-4o',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ]
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    provider: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey: '',
    icon: '🌙',
    defaultModelId: 'moonshot-v1-8k',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    icon: '🐋',
    defaultModelId: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ]
  },
  {
    id: 'qwen',
    name: 'Qwen (Tongyi Qianwen)',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    icon: '🚀',
    defaultModelId: 'qwen-turbo',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
    ]
  }
];

export const useLLMStore = create<LLMState>()(
  persist(
    (set) => ({
      channels: DEFAULT_CHANNELS,
      activeChannelId: 'google-gemini',
      activeModelId: 'gemini-3-flash-preview',
      config: {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1.0,
      },
      addChannel: (channel) => set((state) => ({
        channels: [...state.channels, { ...channel, id: Math.random().toString(36).substring(7) }]
      })),
      updateChannel: (id, channelUpdate) => set((state) => ({
        channels: state.channels.map(c => c.id === id ? { ...c, ...channelUpdate } : c)
      })),
      removeChannel: (id) => set((state) => ({
        channels: state.channels.filter(c => c.id !== id)
      })),
      setActiveChannel: (id) => set({ activeChannelId: id }),
      setActiveModel: (id) => set({ activeModelId: id }),
      updateConfig: (configUpdate) => set((state) => ({
        config: { ...state.config, ...configUpdate }
      })),
    }),
    {
      name: 'llm-storage',
    }
  )
);
