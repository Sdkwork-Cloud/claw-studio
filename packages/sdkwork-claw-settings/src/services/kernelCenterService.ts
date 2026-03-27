import {
  kernelPlatformService,
  type KernelPlatformSnapshot,
} from '@sdkwork/claw-core';
import type { RuntimeDesktopKernelInfo } from '@sdkwork/claw-infrastructure';

export type KernelCenterStatusTone = 'healthy' | 'degraded' | 'warning';

export interface KernelCenterDashboard {
  snapshot: KernelPlatformSnapshot | null;
  info: RuntimeDesktopKernelInfo | null;
  statusTone: KernelCenterStatusTone;
  statusTitle: string;
  statusSummary: string;
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

export interface KernelCenterServiceOverrides {
  kernelPlatformService?: Partial<KernelCenterPlatformService>;
}

interface KernelCenterServiceDependencies {
  kernelPlatformService: KernelCenterPlatformService;
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

function formatPlatformLabel(platform?: string | null, arch?: string | null) {
  const normalizedPlatform = platform?.trim() || 'unknown';
  const normalizedArch = arch?.trim() || 'unknown';
  return `${normalizedPlatform}/${normalizedArch}`;
}

function resolveStatusTone(snapshot: KernelPlatformSnapshot | null): KernelCenterStatusTone {
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
  };
}

function mapDashboard(
  snapshot: KernelPlatformSnapshot | null,
  info: RuntimeDesktopKernelInfo | null,
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
    statusTone: resolveStatusTone(snapshot),
    statusTitle: formatRuntimeState(snapshot?.runtimeState),
    statusSummary: snapshot?.raw.runtime.reason ?? 'Kernel host status is currently unavailable.',
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
    const [snapshot, info] = await Promise.all([
      snapshotPromise,
      dependencies.kernelPlatformService.getInfo(),
    ]);
    return mapDashboard(snapshot, info);
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
