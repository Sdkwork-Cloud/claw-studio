export interface RuntimeInfo {
  platform: 'web' | 'desktop';
}

export interface RuntimePlatformAPI {
  getRuntimeInfo(): Promise<RuntimeInfo>;
}
