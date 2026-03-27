import {
  getKernelPlatform,
  type KernelPlatformAPI,
  type RuntimeDesktopKernelHostInfo,
  type RuntimeDesktopKernelInfo,
} from '@sdkwork/claw-infrastructure';

export type KernelPlatformControlMode =
  | 'nativeService'
  | 'supervisedFallback'
  | 'attached';

export interface KernelPlatformSnapshot {
  raw: RuntimeDesktopKernelHostInfo;
  topologyKind: RuntimeDesktopKernelHostInfo['topology']['kind'];
  topologyState: RuntimeDesktopKernelHostInfo['topology']['state'];
  runtimeState: RuntimeDesktopKernelHostInfo['runtime']['state'];
  runtimeHealth: RuntimeDesktopKernelHostInfo['runtime']['health'];
  hostManager: RuntimeDesktopKernelHostInfo['host']['serviceManager'];
  controlMode: KernelPlatformControlMode;
  baseUrl: string;
  websocketUrl: string;
  preferredPort: number;
  activePort: number;
  usesDynamicPort: boolean;
  serviceConfigPath: string;
  openclawVersion?: string | null;
  nodeVersion?: string | null;
}

export interface CreateKernelPlatformServiceOptions {
  getKernelPlatform?: () => KernelPlatformAPI;
}

function mapControlMode(
  status: RuntimeDesktopKernelHostInfo,
): KernelPlatformControlMode {
  if (status.host.ownership === 'nativeService') {
    return 'nativeService';
  }

  if (status.host.ownership === 'attached') {
    return 'attached';
  }

  return 'supervisedFallback';
}

export function mapKernelPlatformSnapshot(
  status: RuntimeDesktopKernelHostInfo,
): KernelPlatformSnapshot {
  return {
    raw: status,
    topologyKind: status.topology.kind,
    topologyState: status.topology.state,
    runtimeState: status.runtime.state,
    runtimeHealth: status.runtime.health,
    hostManager: status.host.serviceManager,
    controlMode: mapControlMode(status),
    baseUrl: status.endpoint.baseUrl,
    websocketUrl: status.endpoint.websocketUrl,
    preferredPort: status.endpoint.preferredPort,
    activePort: status.endpoint.activePort,
    usesDynamicPort: status.endpoint.dynamicPort,
    serviceConfigPath: status.host.serviceConfigPath,
    openclawVersion: status.provenance.openclawVersion ?? null,
    nodeVersion: status.provenance.nodeVersion ?? null,
  };
}

export function createKernelPlatformService(
  options: CreateKernelPlatformServiceOptions = {},
) {
  const resolveKernelPlatform = options.getKernelPlatform ?? getKernelPlatform;

  return {
    async getInfo(): Promise<RuntimeDesktopKernelInfo | null> {
      return resolveKernelPlatform().getInfo();
    },

    async getStatus(): Promise<KernelPlatformSnapshot | null> {
      const status = await resolveKernelPlatform().getStatus();
      return status ? mapKernelPlatformSnapshot(status) : null;
    },

    async ensureRunning(): Promise<KernelPlatformSnapshot | null> {
      const status = await resolveKernelPlatform().ensureRunning();
      return status ? mapKernelPlatformSnapshot(status) : null;
    },

    async restart(): Promise<KernelPlatformSnapshot | null> {
      const status = await resolveKernelPlatform().restart();
      return status ? mapKernelPlatformSnapshot(status) : null;
    },
  };
}

export const kernelPlatformService = createKernelPlatformService();
