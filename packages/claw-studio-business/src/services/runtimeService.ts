import {
  getRuntimePlatform,
  type RuntimeEventUnsubscribe,
  type RuntimeJobRecord,
  type RuntimeJobUpdateEvent,
  type RuntimeProcessOutputEvent,
} from '@sdkwork/claw-studio-infrastructure';

export const runtimeService = {
  getRuntimeInfo: async () => {
    return getRuntimePlatform().getRuntimeInfo();
  },
  submitProcessJob: async (profileId: string): Promise<string> => {
    return getRuntimePlatform().submitProcessJob(profileId);
  },
  getJob: async (id: string): Promise<RuntimeJobRecord> => {
    return getRuntimePlatform().getJob(id);
  },
  listJobs: async (): Promise<RuntimeJobRecord[]> => {
    return getRuntimePlatform().listJobs();
  },
  cancelJob: async (id: string): Promise<RuntimeJobRecord> => {
    return getRuntimePlatform().cancelJob(id);
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
