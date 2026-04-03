import {
  hostPlatformService,
  kernelPlatformService,
  rolloutService,
  type HostPlatformSnapshot,
  type KernelPlatformSnapshot,
  type RolloutPhaseCounts,
} from '@sdkwork/claw-core';
import type {
  ManageRolloutListResult,
  ManageRolloutRecord,
  RuntimeDesktopKernelInfo,
} from '@sdkwork/claw-infrastructure';

export type KernelCenterStatusTone = 'healthy' | 'degraded' | 'warning';

export interface KernelCenterDashboard {
  snapshot: KernelPlatformSnapshot | null;
  info: RuntimeDesktopKernelInfo | null;
  statusTone: KernelCenterStatusTone;
  statusTitle: string;
  statusSummary: string;
  hostPlatform: {
    status: HostPlatformSnapshot | null;
    modeLabel: string;
    lifecycleLabel: string;
    hostId: string | null;
    displayName: string | null;
    version: string | null;
    desiredStateProjectionVersion: string | null;
    rolloutEngineVersion: string | null;
    manageBasePath: string | null;
    internalBasePath: string | null;
    capabilityKeys: string[];
    capabilityCount: number;
  };
  rollouts: {
    items: ManageRolloutRecord[];
    total: number;
    phaseCounts: RolloutPhaseCounts;
    latestUpdatedAt: number | null;
  };
  host: {
    serviceManagerLabel: string;
    ownershipLabel: string;
    startupModeLabel: string;
    controlSocketLabel: string | null;
    controlSocketAvailable: boolean;
    serviceConfigPath: string | null;
  };
  endpoint: {
    preferredPort: number | null;
    activePort: number | null;
    baseUrl: string | null;
    websocketUrl: string | null;
    usesDynamicPort: boolean;
  };
  localAiProxy: {
    lifecycle: string;
    baseUrl: string | null;
    rootBaseUrl: string | null;
    openaiCompatibleBaseUrl: string | null;
    anthropicBaseUrl: string | null;
    geminiBaseUrl: string | null;
    activePort: number | null;
    loopbackOnly: boolean;
    defaultRouteName: string | null;
    defaultRoutes: Array<{
      clientProtocol: string;
      id: string;
      name: string;
      managedBy: string;
      upstreamProtocol: string;
      upstreamBaseUrl: string;
      modelCount: number;
    }>;
    upstreamBaseUrl: string | null;
    modelCount: number;
    configPath: string | null;
    snapshotPath: string | null;
    logPath: string | null;
    lastError: string | null;
  };
  storage: {
    activeProfileId: string | null;
    activeProfileLabel: string | null;
    activeProfilePath: string | null;
    rootDir: string | null;
    profileCount: number;
  };
  capabilities: {
    readyKeys: string[];
    plannedKeys: string[];
  };
  provenance: {
    installSourceLabel: string;
    platformLabel: string;
    openclawVersion: string | null;
    nodeVersion: string | null;
    configPath: string | null;
    runtimeHomeDir: string | null;
    runtimeInstallDir: string | null;
  };
}

type KernelCenterPlatformService = Pick<
  typeof kernelPlatformService,
  'getInfo' | 'getStatus' | 'ensureRunning' | 'restart'
>;
type KernelCenterHostPlatformService = Pick<typeof hostPlatformService, 'getStatus'>;
type KernelCenterRolloutService = Pick<typeof rolloutService, 'list' | 'summarizePhases'>;

export interface KernelCenterServiceOverrides {
  kernelPlatformService?: Partial<KernelCenterPlatformService>;
  hostPlatformService?: Partial<KernelCenterHostPlatformService>;
  rolloutService?: Partial<KernelCenterRolloutService>;
}

interface KernelCenterServiceDependencies {
  kernelPlatformService: KernelCenterPlatformService;
  hostPlatformService: KernelCenterHostPlatformService;
  rolloutService: KernelCenterRolloutService;
}

function formatRuntimeState(state?: string | null) {
  switch (state) {
    case 'running':
      return 'Running';
    case 'starting':
      return 'Starting';
    case 'recovering':
      return 'Recovering';
    case 'degraded':
      return 'Degraded';
    case 'crashLoop':
      return 'Crash Loop';
    case 'failedSafe':
      return 'Failed Safe';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Unavailable';
  }
}

function formatServiceManager(serviceManager?: string | null) {
  switch (serviceManager) {
    case 'windowsService':
      return 'Windows Service';
    case 'launchdLaunchAgent':
      return 'launchd LaunchAgent';
    case 'systemdUser':
      return 'systemd User Service';
    case 'systemdSystem':
      return 'systemd System Service';
    case 'tauriSupervisor':
      return 'Tauri Supervisor';
    default:
      return 'Unknown Host';
  }
}

function formatOwnership(ownership?: string | null) {
  switch (ownership) {
    case 'nativeService':
      return 'Native Service Host';
    case 'appSupervisor':
      return 'App Supervisor Fallback';
    case 'attached':
      return 'Attached Runtime';
    default:
      return 'Unknown Ownership';
  }
}

function formatStartupMode(mode?: string | null) {
  return mode === 'auto' ? 'Auto Start' : 'Manual Start';
}

function formatInstallSource(source?: string | null) {
  switch (source) {
    case 'bundled':
      return 'Bundled';
    case 'external':
      return 'External';
    case 'remote':
      return 'Remote';
    default:
      return 'Unknown';
  }
}

function formatLocalAiProxyLifecycle(lifecycle?: string | null) {
  switch (lifecycle) {
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Unavailable';
  }
}

function formatPlatformLabel(platform?: string | null, arch?: string | null) {
  const normalizedPlatform = platform?.trim() || 'unknown';
  const normalizedArch = arch?.trim() || 'unknown';
  return `${normalizedPlatform}/${normalizedArch}`;
}

function formatHostPlatformMode(mode?: string | null) {
  switch (mode) {
    case 'desktopCombined':
      return 'Desktop Combined';
    case 'server':
      return 'Server';
    case 'web':
      return 'Web Preview';
    default:
      return 'Unknown';
  }
}

function formatHostPlatformLifecycle(lifecycle?: string | null) {
  switch (lifecycle) {
    case 'ready':
      return 'Ready';
    case 'starting':
      return 'Starting';
    case 'degraded':
      return 'Degraded';
    case 'stopping':
      return 'Stopping';
    case 'stopped':
      return 'Stopped';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Unavailable';
  }
}

function resolveStatusTone(
  snapshot: KernelPlatformSnapshot | null,
  hostPlatformStatus: HostPlatformSnapshot | null,
): KernelCenterStatusTone {
  if (hostPlatformStatus?.lifecycle === 'degraded') {
    return 'degraded';
  }

  if (!snapshot) {
    return 'warning';
  }

  if (snapshot.runtimeHealth === 'healthy') {
    return 'healthy';
  }

  if (snapshot.runtimeHealth === 'degraded') {
    return 'degraded';
  }

  return 'warning';
}

function createDependencies(
  overrides: KernelCenterServiceOverrides = {},
): KernelCenterServiceDependencies {
  return {
    kernelPlatformService: {
      getInfo: overrides.kernelPlatformService?.getInfo ?? kernelPlatformService.getInfo,
      getStatus: overrides.kernelPlatformService?.getStatus ?? kernelPlatformService.getStatus,
      ensureRunning:
        overrides.kernelPlatformService?.ensureRunning ?? kernelPlatformService.ensureRunning,
      restart: overrides.kernelPlatformService?.restart ?? kernelPlatformService.restart,
    },
    hostPlatformService: {
      getStatus: overrides.hostPlatformService?.getStatus ?? hostPlatformService.getStatus,
    },
    rolloutService: {
      list: overrides.rolloutService?.list ?? rolloutService.list,
      summarizePhases:
        overrides.rolloutService?.summarizePhases ?? rolloutService.summarizePhases,
    },
  };
}

function mapDashboard(
  snapshot: KernelPlatformSnapshot | null,
  info: RuntimeDesktopKernelInfo | null,
  hostPlatformStatus: HostPlatformSnapshot | null,
  rolloutResult: ManageRolloutListResult,
  rolloutPhaseCounts: RolloutPhaseCounts,
): KernelCenterDashboard {
  const activeProfile = info?.storage.profiles.find((profile) => profile.active) ?? null;
  const controlSocket = snapshot?.raw.host.controlSocket ?? info?.host.host.controlSocket ?? null;
  const readyKeys =
    info?.capabilities
      .filter((capability) => capability.status === 'ready')
      .map((capability) => capability.key) ?? [];
  const plannedKeys =
    info?.capabilities
      .filter((capability) => capability.status === 'planned')
      .map((capability) => capability.key) ?? [];

  return {
    snapshot,
    info,
    statusTone: resolveStatusTone(snapshot, hostPlatformStatus),
    statusTitle: formatRuntimeState(snapshot?.runtimeState),
    statusSummary: snapshot?.raw.runtime.reason ?? 'Kernel host status is currently unavailable.',
    hostPlatform: {
      status: hostPlatformStatus,
      modeLabel: formatHostPlatformMode(hostPlatformStatus?.mode),
      lifecycleLabel: formatHostPlatformLifecycle(hostPlatformStatus?.lifecycle),
      hostId: hostPlatformStatus?.hostId ?? null,
      displayName: hostPlatformStatus?.displayName ?? null,
      version: hostPlatformStatus?.version ?? null,
      desiredStateProjectionVersion:
        hostPlatformStatus?.desiredStateProjectionVersion ?? null,
      rolloutEngineVersion: hostPlatformStatus?.rolloutEngineVersion ?? null,
      manageBasePath: hostPlatformStatus?.manageBasePath ?? null,
      internalBasePath: hostPlatformStatus?.internalBasePath ?? null,
      capabilityKeys: hostPlatformStatus?.capabilityKeys ?? [],
      capabilityCount: hostPlatformStatus?.capabilityCount ?? 0,
    },
    rollouts: {
      items: rolloutResult.items,
      total: rolloutResult.total,
      phaseCounts: rolloutPhaseCounts,
      latestUpdatedAt: rolloutResult.items.reduce<number | null>((latest, item) => (
        latest === null || item.updatedAt > latest ? item.updatedAt : latest
      ), null),
    },
    host: {
      serviceManagerLabel: formatServiceManager(snapshot?.hostManager),
      ownershipLabel: formatOwnership(snapshot?.raw.host.ownership),
      startupModeLabel: formatStartupMode(snapshot?.raw.host.startupMode),
      controlSocketLabel: controlSocket
        ? `${controlSocket.socketKind} ${controlSocket.location}`
        : null,
      controlSocketAvailable: Boolean(controlSocket?.available),
      serviceConfigPath: snapshot?.serviceConfigPath ?? null,
    },
    endpoint: {
      preferredPort: snapshot?.preferredPort ?? null,
      activePort: snapshot?.activePort ?? null,
      baseUrl: snapshot?.baseUrl ?? null,
      websocketUrl: snapshot?.websocketUrl ?? null,
      usesDynamicPort: Boolean(snapshot?.usesDynamicPort),
    },
    localAiProxy: {
      lifecycle: formatLocalAiProxyLifecycle(info?.localAiProxy?.lifecycle),
      baseUrl: info?.localAiProxy?.baseUrl ?? null,
      rootBaseUrl: info?.localAiProxy?.rootBaseUrl ?? null,
      openaiCompatibleBaseUrl: info?.localAiProxy?.openaiCompatibleBaseUrl ?? null,
      anthropicBaseUrl: info?.localAiProxy?.anthropicBaseUrl ?? null,
      geminiBaseUrl: info?.localAiProxy?.geminiBaseUrl ?? null,
      activePort: info?.localAiProxy?.activePort ?? null,
      loopbackOnly: info?.localAiProxy?.loopbackOnly ?? true,
      defaultRouteName: info?.localAiProxy?.defaultRouteName ?? null,
      defaultRoutes: info?.localAiProxy?.defaultRoutes ?? [],
      upstreamBaseUrl: info?.localAiProxy?.upstreamBaseUrl ?? null,
      modelCount: info?.localAiProxy?.modelCount ?? 0,
      configPath: info?.localAiProxy?.configPath ?? null,
      snapshotPath: info?.localAiProxy?.snapshotPath ?? null,
      logPath: info?.localAiProxy?.logPath ?? null,
      lastError: info?.localAiProxy?.lastError ?? null,
    },
    storage: {
      activeProfileId: activeProfile?.id ?? info?.storage.activeProfileId ?? null,
      activeProfileLabel: activeProfile?.label ?? null,
      activeProfilePath: activeProfile?.path ?? null,
      rootDir: info?.storage.rootDir ?? null,
      profileCount: info?.storage.profiles.length ?? 0,
    },
    capabilities: {
      readyKeys,
      plannedKeys,
    },
    provenance: {
      installSourceLabel: formatInstallSource(snapshot?.raw.provenance.installSource),
      platformLabel: formatPlatformLabel(
        snapshot?.raw.provenance.platform,
        snapshot?.raw.provenance.arch,
      ),
      openclawVersion: snapshot?.openclawVersion ?? null,
      nodeVersion: snapshot?.nodeVersion ?? null,
      configPath: snapshot?.raw.provenance.configPath ?? null,
      runtimeHomeDir: snapshot?.raw.provenance.runtimeHomeDir ?? null,
      runtimeInstallDir: snapshot?.raw.provenance.runtimeInstallDir ?? null,
    },
  };
}

export function createKernelCenterService(
  overrides: KernelCenterServiceOverrides = {},
) {
  const dependencies = createDependencies(overrides);

  const buildDashboard = async (
    snapshotPromise: Promise<KernelPlatformSnapshot | null>,
  ): Promise<KernelCenterDashboard> => {
    const [snapshot, info, hostPlatformStatus, rolloutResult] = await Promise.all([
      snapshotPromise,
      dependencies.kernelPlatformService.getInfo(),
      dependencies.hostPlatformService.getStatus(),
      dependencies.rolloutService.list(),
    ]);
    return mapDashboard(
      snapshot,
      info,
      hostPlatformStatus,
      rolloutResult,
      dependencies.rolloutService.summarizePhases(rolloutResult),
    );
  };

  return {
    async getDashboard(): Promise<KernelCenterDashboard> {
      return buildDashboard(dependencies.kernelPlatformService.getStatus());
    },

    async ensureRunning(): Promise<KernelCenterDashboard> {
      return buildDashboard(dependencies.kernelPlatformService.ensureRunning());
    },

    async restart(): Promise<KernelCenterDashboard> {
      return buildDashboard(dependencies.kernelPlatformService.restart());
    },
  };
}

export const kernelCenterService = createKernelCenterService();
