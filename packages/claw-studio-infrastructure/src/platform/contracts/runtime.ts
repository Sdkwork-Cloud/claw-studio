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

export interface RuntimeInfo {
  platform: 'web' | 'desktop';
  app?: RuntimeAppInfo | null;
  paths?: RuntimePathsInfo | null;
  config?: RuntimeConfigInfo | null;
  system?: RuntimeSystemInfo | null;
}

export interface RuntimePlatformAPI {
  getRuntimeInfo(): Promise<RuntimeInfo>;
}