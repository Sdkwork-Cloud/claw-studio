import type { RuntimeEventUnsubscribe } from './runtime.ts';

export type HubInstallScope = 'user' | 'system';
export type HubInstallPlatform =
  | 'windows'
  | 'macos'
  | 'ubuntu'
  | 'android'
  | 'ios'
  | 'wsl';
export type HubInstallRecordStatus = 'installed' | 'uninstalled';
export type HubInstallControlLevel = 'managed' | 'partial' | 'opaque';
export type HubInstallContainerRuntimePreference = 'auto' | 'host' | 'wsl';
export type HubInstallProgressStream = 'stdout' | 'stderr';
export type HubInstallProgressOperationKind =
  | 'install'
  | 'dependencyInstall'
  | 'uninstall';
export type HubInstallCatalogHostPlatform = Extract<
  HubInstallPlatform,
  'windows' | 'macos' | 'ubuntu'
>;
export type HubInstallCatalogRuntimePlatform = 'host' | 'wsl';

export interface HubInstallRequest {
  softwareName: string;
  requestId?: string;
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

export interface HubInstallCatalogQuery {
  hostPlatform?: HubInstallCatalogHostPlatform;
}

export interface HubInstallCatalogVariant {
  id: string;
  label: string;
  summary: string;
  softwareName: string;
  hostPlatforms: HubInstallCatalogHostPlatform[];
  runtimePlatform: HubInstallCatalogRuntimePlatform;
  manifestName?: string | null;
  manifestDescription?: string | null;
  manifestHomepage?: string | null;
  installationMethod?: HubInstallAssessmentInstallationMethod | null;
  request: HubInstallRequest;
}

export interface HubInstallCatalogEntry {
  appId: string;
  title: string;
  developer: string;
  category: string;
  summary: string;
  description?: string | null;
  homepage?: string | null;
  tags: string[];
  defaultVariantId: string;
  defaultSoftwareName: string;
  supportedHostPlatforms: HubInstallCatalogHostPlatform[];
  variants: HubInstallCatalogVariant[];
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

export interface HubInstallDependencyRequest extends HubInstallRequest {
  dependencyIds?: string[];
  continueOnError?: boolean;
}

export interface HubInstallDependencyReport {
  dependencyId: string;
  description?: string | null;
  target: string;
  required: boolean;
  statusBefore: HubInstallAssessmentDependencyStatus;
  statusAfter: HubInstallAssessmentDependencyStatus;
  attemptedAutoRemediation: boolean;
  success: boolean;
  skipped: boolean;
  durationMs: number;
  stepCount: number;
  error?: string | null;
}

export interface HubInstallDependencyResult {
  manifestName: string;
  manifestSource: string;
  manifestSourceInput: string;
  manifestSourceKind: string;
  registryName: string;
  registrySource: string;
  softwareName: string;
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
  dependencyReports: HubInstallDependencyReport[];
}

export type HubInstallAssessmentSeverity = 'error' | 'warning' | 'info';
export type HubInstallAssessmentDependencyStatus =
  | 'available'
  | 'missing'
  | 'remediable'
  | 'unsupported';
export type HubInstallAssessmentCheckType = 'command' | 'file' | 'env' | 'platform';
export type HubInstallAssessmentShellKind = 'bash' | 'powershell' | 'cmd';
export type HubInstallResolvedContainerRuntime = 'host' | 'wsl';
export type HubInstallAssessmentMethodType =
  | 'binary'
  | 'command'
  | 'container'
  | 'git'
  | 'package'
  | 'script'
  | 'source'
  | 'wsl'
  | string;
export type HubInstallAssessmentDataItemKind =
  | 'database'
  | 'directory'
  | 'file'
  | 'log'
  | string;
export type HubInstallAssessmentDataUninstallPolicy = 'manual' | 'preserve' | 'remove' | string;
export type HubInstallAssessmentMigrationMode = 'command' | 'manual' | string;

export interface HubInstallAssessmentCommand {
  description: string;
  commandLine: string;
  shellKind?: HubInstallAssessmentShellKind | null;
  workingDirectory?: string | null;
  requiresElevation: boolean;
  autoRun: boolean;
}

export interface HubInstallAssessmentDependency {
  id: string;
  description?: string | null;
  required: boolean;
  checkType: HubInstallAssessmentCheckType;
  target: string;
  status: HubInstallAssessmentDependencyStatus;
  supportsAutoRemediation: boolean;
  remediationCommands: HubInstallAssessmentCommand[];
}

export interface HubInstallAssessmentInstallationMethod {
  id: string;
  label: string;
  type: HubInstallAssessmentMethodType;
  summary: string;
  supported?: boolean | null;
  documentationUrl?: string | null;
  notes: string[];
}

export interface HubInstallAssessmentInstallationDirectory {
  id?: string | null;
  path: string;
  customizable?: boolean | null;
  purpose?: string | null;
}

export interface HubInstallAssessmentInstallationDirectories {
  installRoot?: HubInstallAssessmentInstallationDirectory | null;
  workRoot?: HubInstallAssessmentInstallationDirectory | null;
  binDir?: HubInstallAssessmentInstallationDirectory | null;
  dataRoot?: HubInstallAssessmentInstallationDirectory | null;
  additional: HubInstallAssessmentInstallationDirectory[];
}

export interface HubInstallAssessmentInstallation {
  method: HubInstallAssessmentInstallationMethod;
  alternatives: HubInstallAssessmentInstallationMethod[];
  directories?: HubInstallAssessmentInstallationDirectories | null;
}

export interface HubInstallAssessmentDataItem {
  id: string;
  title: string;
  kind: HubInstallAssessmentDataItemKind;
  path?: string | null;
  description?: string | null;
  includes: string[];
  sensitive?: boolean | null;
  backupByDefault?: boolean | null;
  uninstallByDefault: HubInstallAssessmentDataUninstallPolicy;
}

export interface HubInstallAssessmentMigrationStrategy {
  id: string;
  source: string;
  title: string;
  mode: HubInstallAssessmentMigrationMode;
  summary: string;
  supported?: boolean | null;
  documentationUrl?: string | null;
  previewCommands: HubInstallAssessmentCommand[];
  applyCommands: HubInstallAssessmentCommand[];
  dataItemIds: string[];
  warnings: string[];
}

export interface HubInstallAssessmentIssue {
  severity: HubInstallAssessmentSeverity;
  code: string;
  message: string;
  dependencyId?: string | null;
}

export interface HubInstallAssessmentRuntime {
  hostPlatform: HubInstallPlatform;
  requestedRuntimePlatform: HubInstallPlatform;
  effectiveRuntimePlatform: HubInstallPlatform;
  containerRuntimePreference?: HubInstallContainerRuntimePreference | null;
  resolvedContainerRuntime?: HubInstallResolvedContainerRuntime | null;
  wslDistribution?: string | null;
  availableWslDistributions: string[];
  wslAvailable: boolean;
  hostDockerAvailable: boolean;
  wslDockerAvailable: boolean;
  runtimeHomeDir?: string | null;
  commandAvailability: Record<string, boolean>;
}

export interface HubInstallAssessmentResult {
  registryName: string;
  registrySource: string;
  softwareName: string;
  manifestSource: string;
  manifestName: string;
  manifestDescription?: string | null;
  manifestHomepage?: string | null;
  ready: boolean;
  requiresElevatedSetup: boolean;
  platform: HubInstallPlatform;
  effectiveRuntimePlatform: HubInstallPlatform;
  resolvedInstallScope: HubInstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: HubInstallControlLevel;
  installStatus?: HubInstallRecordStatus | null;
  dependencies: HubInstallAssessmentDependency[];
  issues: HubInstallAssessmentIssue[];
  recommendations: string[];
  installation?: HubInstallAssessmentInstallation | null;
  dataItems: HubInstallAssessmentDataItem[];
  migrationStrategies: HubInstallAssessmentMigrationStrategy[];
  runtime: HubInstallAssessmentRuntime;
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

export type HubInstallProgressEvent = {
  requestId?: string | null;
  softwareName: string;
  operationKind: HubInstallProgressOperationKind;
} & (
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
      type: 'dependencyStarted';
      dependencyId: string;
      target: string;
      description?: string | null;
    }
  | {
      type: 'dependencyCompleted';
      dependencyId: string;
      target: string;
      success: boolean;
      skipped: boolean;
      statusAfter: HubInstallAssessmentDependencyStatus;
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
    }
);

export interface InstallerPlatformAPI {
  listHubInstallCatalog(
    query?: HubInstallCatalogQuery,
  ): Promise<HubInstallCatalogEntry[]>;
  inspectHubInstall(request: HubInstallRequest): Promise<HubInstallAssessmentResult>;
  runHubDependencyInstall(request: HubInstallDependencyRequest): Promise<HubInstallDependencyResult>;
  runHubInstall(request: HubInstallRequest): Promise<HubInstallResult>;
  runHubUninstall(request: HubUninstallRequest): Promise<HubUninstallResult>;
  subscribeHubInstallProgress(
    listener: (event: HubInstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe>;
}
