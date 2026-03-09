import { getRuntimePlatform } from '@sdkwork/claw-studio-infrastructure';

export const runtimeService = {
  getRuntimeInfo: async () => {
    return getRuntimePlatform().getRuntimeInfo();
  },
};
