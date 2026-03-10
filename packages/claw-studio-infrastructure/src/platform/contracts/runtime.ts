export interface RuntimeAppInfo {
  name: string;
  version: string;
  target: string;
}

export interface RuntimePathsInfo {
  configDir: string;
  dataDir: string;
  cacheDir: string;
  logsDir: string;
  stateDir: string;
  configFile: string;
  deviceIdFile: string;
  mainLogFile: string;
}

export interface RuntimeConfigInfo {
  distribution: string;
  logLevel: string;
  theme: string;
  telemetryEnabled: boolean;
}

export interface RuntimeSystemInfo {
  os: string;
  arch: string;
  family: string;
  target: string;
}

export type RuntimeJobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RuntimeJobRecord {
  id: string;
  kind: string;
  state: RuntimeJobState;
  stage: string;
}

export interface RuntimeJobUpdateEvent {
  record: RuntimeJobRecord;
}

export type RuntimeProcessOutputStream = 'stdout' | 'stderr';

export interface RuntimeProcessOutputEvent {
  processId: string;
  command: string;
  stream: RuntimeProcessOutputStream;
  chunk: string;
}

export type RuntimeEventUnsubscribe = () => void | Promise<void>;

export interface RuntimeInfo {
  platform: 'web' | 'desktop';
  app?: RuntimeAppInfo | null;
  paths?: RuntimePathsInfo | null;
  config?: RuntimeConfigInfo | null;
  system?: RuntimeSystemInfo | null;
}

export interface RuntimePlatformAPI {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  subscribeJobUpdates(listener: (event: RuntimeJobUpdateEvent) => void): Promise<RuntimeEventUnsubscribe>;
  subscribeProcessOutput(listener: (event: RuntimeProcessOutputEvent) => void): Promise<RuntimeEventUnsubscribe>;
}
