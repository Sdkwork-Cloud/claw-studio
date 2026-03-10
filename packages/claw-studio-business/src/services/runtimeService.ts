import {
  getRuntimePlatform,
  type RuntimeEventUnsubscribe,
  type RuntimeJobUpdateEvent,
  type RuntimeProcessOutputEvent,
} from '@sdkwork/claw-studio-infrastructure';

export const runtimeService = {
  getRuntimeInfo: async () => {
    return getRuntimePlatform().getRuntimeInfo();
  },
  subscribeJobUpdates: async (
    listener: (event: RuntimeJobUpdateEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return getRuntimePlatform().subscribeJobUpdates(listener);
  },
  subscribeProcessOutput: async (
    listener: (event: RuntimeProcessOutputEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return getRuntimePlatform().subscribeProcessOutput(listener);
  },
};
