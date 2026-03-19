import type { RuntimeEventUnsubscribe } from './runtime.ts';

export type HubInstallScope = 'user' | 'system';
export type HubInstallPlatform =
  | 'windows'
  | 'macos'
  | 'ubuntu'
  | 'android'
  | 'ios'
  | 'wsl';
export type HubInstallControlLevel = 'managed' | 'partial' | 'opaque';
export type HubInstallContainerRuntimePreference = 'auto' | 'host' | 'wsl';
export type HubInstallProgressStream = 'stdout' | 'stderr';

export interface HubInstallRequest {
  softwareName: string;
  registrySource?: string;
  installScope?: HubInstallScope;
  effectiveRuntimePlatform?: HubInstallPlatform;
  containerRuntimePreference?: HubInstallContainerRuntimePreference;
  wslDistribution?: string;
  dockerContext?: string;
  dockerHost?: string;
  dryRun?: boolean;
  verbose?: boolean;
  sudo?: boolean;
  timeoutMs?: number;
  installerHome?: string;
  installRoot?: string;
  workRoot?: string;
  binDir?: string;
  dataRoot?: string;
  variables?: Record<string, string>;
}

export interface HubInstallStageReport {
  stage: string;
  success: boolean;
  durationMs: number;
  totalSteps: number;
  failedSteps: number;
}

export interface HubInstallArtifactReport {
  artifactId: string;
  artifactType: string;
  success: boolean;
  durationMs: number;
  detail: string;
}

export interface HubInstallResult {
  registryName: string;
  registrySource: string;
  softwareName: string;
  manifestSource: string;
  manifestName: string;
  success: boolean;
  durationMs: number;
  platform: HubInstallPlatform;
  effectiveRuntimePlatform: HubInstallPlatform;
  resolvedInstallScope: HubInstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: HubInstallControlLevel;
  stageReports: HubInstallStageReport[];
  artifactReports: HubInstallArtifactReport[];
}

export interface HubUninstallRequest extends HubInstallRequest {
  purgeData?: boolean;
  backupBeforeUninstall?: boolean;
}

export type HubUninstallTarget = 'data' | 'install' | 'work';
export type HubUninstallTargetStatus = 'removed' | 'missing' | 'preserved';

export interface HubUninstallTargetReport {
  target: HubUninstallTarget;
  status: HubUninstallTargetStatus;
}

export interface HubUninstallResult {
  registryName: string;
  registrySource: string;
  softwareName: string;
  manifestSource: string;
  manifestName: string;
  success: boolean;
  durationMs: number;
  platform: HubInstallPlatform;
  effectiveRuntimePlatform: HubInstallPlatform;
  resolvedInstallScope: HubInstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: HubInstallControlLevel;
  purgeData: boolean;
  stageReports: HubInstallStageReport[];
  targetReports: HubUninstallTargetReport[];
}

export type HubInstallProgressEvent =
  | {
      type: 'stageStarted';
      stage: string;
      totalSteps: number;
    }
  | {
      type: 'stageCompleted';
      stage: string;
      success: boolean;
      totalSteps: number;
      failedSteps: number;
    }
  | {
      type: 'artifactStarted';
      artifactId: string;
      artifactType: string;
    }
  | {
      type: 'artifactCompleted';
      artifactId: string;
      artifactType: string;
      success: boolean;
    }
  | {
      type: 'stepStarted';
      stepId: string;
      description: string;
    }
  | {
      type: 'stepCommandStarted';
      stepId: string;
      commandLine: string;
      workingDirectory?: string | null;
    }
  | {
      type: 'stepLogChunk';
      stepId: string;
      stream: HubInstallProgressStream;
      chunk: string;
    }
  | {
      type: 'stepCompleted';
      stepId: string;
      success: boolean;
      skipped: boolean;
      durationMs: number;
      exitCode?: number | null;
    };

export type ApiRouterInstallerClientId =
  | 'codex'
  | 'claude-code'
  | 'opencode'
  | 'openclaw'
  | 'gemini';

export type ApiRouterInstallerCompatibility = 'openai' | 'anthropic' | 'gemini';
export type ApiRouterInstallerInstallMode = 'standard' | 'env' | 'both';
export type ApiRouterInstallerEnvScope = 'user' | 'system';
export type ApiRouterInstalledEnvironmentShell = 'powershell' | 'sh';

export interface ApiRouterInstallerModel {
  id: string;
  name: string;
}

export interface ApiRouterInstallerProvider {
  id: string;
  channelId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  compatibility: ApiRouterInstallerCompatibility;
  models: ApiRouterInstallerModel[];
}

export interface ApiRouterInstallerOpenClawOptions {
  instanceIds: string[];
}

export interface ApiRouterClientInstallRequest {
  clientId: ApiRouterInstallerClientId;
  provider: ApiRouterInstallerProvider;
  installMode?: ApiRouterInstallerInstallMode;
  envScope?: ApiRouterInstallerEnvScope;
  openClaw?: ApiRouterInstallerOpenClawOptions;
}

export interface ApiRouterInstalledFile {
  path: string;
  action: 'created' | 'updated';
}

export interface ApiRouterInstalledEnvironment {
  scope: ApiRouterInstallerEnvScope;
  shell: ApiRouterInstalledEnvironmentShell;
  target: string;
  variables: string[];
}

export interface ApiRouterClientInstallResult {
  clientId: ApiRouterInstallerClientId;
  writtenFiles: ApiRouterInstalledFile[];
  updatedEnvironments: ApiRouterInstalledEnvironment[];
  updatedInstanceIds: string[];
}

export interface InstallerPlatformAPI {
  runHubInstall(request: HubInstallRequest): Promise<HubInstallResult>;
  runHubUninstall(request: HubUninstallRequest): Promise<HubUninstallResult>;
  subscribeHubInstallProgress(
    listener: (event: HubInstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe>;
  installApiRouterClientSetup(
    request: ApiRouterClientInstallRequest,
  ): Promise<ApiRouterClientInstallResult>;
}
