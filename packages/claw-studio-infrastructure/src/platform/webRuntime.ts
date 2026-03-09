import type { RuntimeInfo, RuntimePlatformAPI } from './contracts/runtime';

export class WebRuntimePlatform implements RuntimePlatformAPI {
  async getRuntimeInfo(): Promise<RuntimeInfo> {
    return { platform: 'web' };
  }
}
