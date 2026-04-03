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
  instanceConfigs: Record<string, InstanceLLMState>;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  updateConfig: (instanceId: string, config: Partial<LLMConfig>) => void;
  getInstanceConfig: (instanceId: string) => InstanceLLMState;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
};

const DEFAULT_INSTANCE_CONFIG: InstanceLLMState = {
  activeChannelId: '',
  activeModelId: '',
  config: DEFAULT_LLM_CONFIG,
};

function createInstanceConfigFallback(
  current?: Partial<InstanceLLMState> | null,
): InstanceLLMState {
  return {
    activeChannelId: current?.activeChannelId ?? DEFAULT_INSTANCE_CONFIG.activeChannelId,
    activeModelId: current?.activeModelId ?? DEFAULT_INSTANCE_CONFIG.activeModelId,
    config: {
      ...DEFAULT_LLM_CONFIG,
      ...(current?.config ?? {}),
    },
  };
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      instanceConfigs: {},
      setActiveChannel: (instanceId, channelId) =>
        set((state) => ({
          instanceConfigs: {
            ...state.instanceConfigs,
            [instanceId]: {
              ...createInstanceConfigFallback(state.instanceConfigs[instanceId]),
              activeChannelId: channelId,
            },
          },
        })),
      setActiveModel: (instanceId, modelId) =>
        set((state) => ({
          instanceConfigs: {
            ...state.instanceConfigs,
            [instanceId]: {
              ...createInstanceConfigFallback(state.instanceConfigs[instanceId]),
              activeModelId: modelId,
            },
          },
        })),
      updateConfig: (instanceId, configUpdate) =>
        set((state) => {
          const currentConfig = createInstanceConfigFallback(state.instanceConfigs[instanceId]);

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
      getInstanceConfig: (instanceId) =>
        createInstanceConfigFallback(get().instanceConfigs[instanceId]),
    }),
    {
      name: 'llm-storage',
    },
  ),
);
