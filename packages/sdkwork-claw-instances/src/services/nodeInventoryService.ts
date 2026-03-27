import {
  kernelPlatformService,
  type KernelPlatformSnapshot,
} from '@sdkwork/claw-core';
import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';

export type NodeInventoryKind =
  | 'localPrimary'
  | 'managedRemote'
  | 'attachedRemote'
  | 'localExternal';

export type NodeInventoryHealth = 'ok' | 'degraded' | 'quarantined';
export type NodeInventoryManagement = 'managed' | 'attached';

export interface NodeInventoryRecord {
  id: string;
  name: string;
  kind: NodeInventoryKind;
  management: NodeInventoryManagement;
  topologyKind: string;
  runtimeState: string;
  health: NodeInventoryHealth;
  endpoint: string | null;
  host: string | null;
  version: string | null;
  source: 'kernel' | 'instance';
  instanceId?: string;
  detailPath: string;
}

type NodeKernelPlatformService = Pick<
  typeof kernelPlatformService,
  'getStatus' | 'ensureRunning' | 'restart'
>;

interface NodeInventoryServiceDependencies {
  kernelPlatformService: NodeKernelPlatformService;
  studioApi: {
    getInstances(): Promise<StudioInstanceRecord[]>;
  };
}

export interface NodeInventoryServiceOverrides {
  kernelPlatformService?: Partial<NodeKernelPlatformService>;
  studioApi?: Partial<NodeInventoryServiceDependencies['studioApi']>;
}

function createDependencies(
  overrides: NodeInventoryServiceOverrides = {},
): NodeInventoryServiceDependencies {
  return {
    kernelPlatformService: {
      getStatus: overrides.kernelPlatformService?.getStatus ?? kernelPlatformService.getStatus,
      ensureRunning:
        overrides.kernelPlatformService?.ensureRunning ?? kernelPlatformService.ensureRunning,
      restart: overrides.kernelPlatformService?.restart ?? kernelPlatformService.restart,
    },
    studioApi: {
      getInstances: overrides.studioApi?.getInstances ?? (() => studio.listInstances()),
    },
  };
}

function isLoopbackHost(host?: string | null) {
  return ['127.0.0.1', 'localhost', '::1'].includes((host || '').toLowerCase());
}

function mapKernelHealth(snapshot: KernelPlatformSnapshot): NodeInventoryHealth {
  if (snapshot.runtimeHealth === 'healthy') {
    return 'ok';
  }

  if (snapshot.runtimeHealth === 'degraded') {
    return 'degraded';
  }

  return 'quarantined';
}

function mapInstanceHealth(status: StudioInstanceRecord['status']): NodeInventoryHealth {
  switch (status) {
    case 'online':
      return 'ok';
    case 'starting':
    case 'syncing':
      return 'degraded';
    default:
      return 'quarantined';
  }
}

function isBuiltInLocalInstance(instance: StudioInstanceRecord) {
  return (
    instance.runtimeKind === 'openclaw'
    && instance.isBuiltIn
    && instance.isDefault
    && instance.deploymentMode === 'local-managed'
  );
}

function mapKernelNode(snapshot: KernelPlatformSnapshot): NodeInventoryRecord {
  return {
    id: 'local-openclaw',
    name: 'Local Built-In Kernel',
    kind: 'localPrimary',
    management: snapshot.controlMode === 'attached' ? 'attached' : 'managed',
    topologyKind: snapshot.topologyKind,
    runtimeState: snapshot.runtimeState,
    health: mapKernelHealth(snapshot),
    endpoint: snapshot.baseUrl,
    host: snapshot.raw.provenance.platform,
    version: snapshot.openclawVersion ?? null,
    source: 'kernel',
    detailPath: '/kernel',
  };
}

function mapInstanceNode(instance: StudioInstanceRecord): NodeInventoryRecord {
  const localHost = isLoopbackHost(instance.host);
  const attachedRemote = instance.deploymentMode === 'remote';
  const managedRemote = !attachedRemote && !localHost && instance.deploymentMode === 'local-managed';
  const kind: NodeInventoryKind = attachedRemote
    ? 'attachedRemote'
    : managedRemote
      ? 'managedRemote'
      : 'localExternal';

  const management: NodeInventoryManagement =
    attachedRemote || instance.deploymentMode === 'local-external' ? 'attached' : 'managed';

  const topologyKind = attachedRemote
    ? 'remoteAttachedNode'
    : managedRemote
      ? 'remoteManagedNode'
      : instance.deploymentMode === 'local-external'
        ? 'localExternal'
        : 'localManagedNative';

  return {
    id: instance.id,
    name: instance.name,
    kind,
    management,
    topologyKind,
    runtimeState: instance.status,
    health: mapInstanceHealth(instance.status),
    endpoint: instance.baseUrl ?? null,
    host: instance.host,
    version: instance.version || null,
    source: 'instance',
    instanceId: instance.id,
    detailPath: `/instances/${instance.id}`,
  };
}

function sortNodes(left: NodeInventoryRecord, right: NodeInventoryRecord) {
  const rank = (node: NodeInventoryRecord) => {
    switch (node.kind) {
      case 'localPrimary':
        return 0;
      case 'managedRemote':
        return 1;
      case 'attachedRemote':
        return 2;
      default:
        return 3;
    }
  };

  if (rank(left) !== rank(right)) {
    return rank(left) - rank(right);
  }

  return left.name.localeCompare(right.name);
}

export function createNodeInventoryService(
  overrides: NodeInventoryServiceOverrides = {},
) {
  const dependencies = createDependencies(overrides);

  return {
    async listNodes(): Promise<NodeInventoryRecord[]> {
      const [snapshot, instances] = await Promise.all([
        dependencies.kernelPlatformService.getStatus(),
        dependencies.studioApi.getInstances(),
      ]);

      const nodes: NodeInventoryRecord[] = [];
      if (snapshot) {
        nodes.push(mapKernelNode(snapshot));
      }

      for (const instance of instances) {
        if (snapshot && isBuiltInLocalInstance(instance)) {
          continue;
        }
        nodes.push(mapInstanceNode(instance));
      }

      return nodes.sort(sortNodes);
    },

    async ensureLocalNodeRunning() {
      return dependencies.kernelPlatformService.ensureRunning();
    },

    async restartLocalNode() {
      return dependencies.kernelPlatformService.restart();
    },
  };
}

export const nodeInventoryService = createNodeInventoryService();
