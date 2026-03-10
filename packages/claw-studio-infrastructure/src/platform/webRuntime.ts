import type {
  RuntimeEventUnsubscribe,
  RuntimeInfo,
  RuntimeJobUpdateEvent,
  RuntimePlatformAPI,
  RuntimeProcessOutputEvent,
} from './contracts/runtime';

export class WebRuntimePlatform implements RuntimePlatformAPI {
  async getRuntimeInfo(): Promise<RuntimeInfo> {
    return { platform: 'web' };
  }

  async subscribeJobUpdates(_listener: (event: RuntimeJobUpdateEvent) => void): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }

  async subscribeProcessOutput(_listener: (event: RuntimeProcessOutputEvent) => void): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }
}
