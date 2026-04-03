import {
  hostPlatformService,
  kernelPlatformService,
  type HostPlatformSnapshot,
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
  hostPlatformMode: HostPlatformSnapshot['mode'] | null;
  sessionId: string | null;
  sessionState: string | null;
  compatibilityState: string | null;
  desiredStateRevision: number | null;
  desiredStateHash: string | null;
  detailPath: string;
}

export interface NodeInventorySnapshot {
  hostPlatform: HostPlatformSnapshot | null;
  nodes: NodeInventoryRecord[];
  sessionCount: number;
}

type NodeKernelPlatformService = Pick<
  typeof kernelPlatformService,
  'getStatus' | 'ensureRunning' | 'restart'
>;
type NodeHostPlatformService = Pick<typeof hostPlatformService, 'getStatus' | 'listNodeSessions'>;

interface NodeInventoryServiceDependencies {
  kernelPlatformService: NodeKernelPlatformService;
  hostPlatformService: NodeHostPlatformService;
  studioApi: {
    getInstances(): Promise<StudioInstanceRecord[]>;
  };
}

export interface NodeInventoryServiceOverrides {
  kernelPlatformService?: Partial<NodeKernelPlatformService>;
  hostPlatformService?: Partial<NodeHostPlatformService>;
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
    hostPlatformService: {
      getStatus: overrides.hostPlatformService?.getStatus ?? hostPlatformService.getStatus,
      listNodeSessions:
        overrides.hostPlatformService?.listNodeSessions ?? hostPlatformService.listNodeSessions,
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

function resolveSessionHealth(
  health: NodeInventoryHealth,
  compatibilityState?: string | null,
  sessionState?: string | null,
): NodeInventoryHealth {
  if (compatibilityState === 'blocked' || sessionState === 'blocked') {
    return 'quarantined';
  }

  if (compatibilityState === 'degraded' || sessionState === 'degraded') {
    return health === 'quarantined' ? health : 'degraded';
  }

  return health;
}

function resolveSessionNodeIds(node: Pick<NodeInventoryRecord, 'id' | 'source' | 'instanceId'>) {
  if (node.source === 'kernel') {
    return ['local-built-in', node.id];
  }

  return [node.id, node.instanceId].filter((value): value is string => Boolean(value));
}

function findNodeSession(
  node: Pick<NodeInventoryRecord, 'id' | 'source' | 'instanceId'>,
  sessions: ReturnType<NodeHostPlatformService['listNodeSessions']> extends Promise<infer T> ? T : never,
) {
  const candidateNodeIds = new Set(resolveSessionNodeIds(node));
  return sessions.find((session) => candidateNodeIds.has(session.nodeId)) ?? null;
}

function applyNodeSession(
  node: NodeInventoryRecord,
  session: ReturnType<typeof findNodeSession>,
): NodeInventoryRecord {
  if (!session) {
    return node;
  }

  return {
    ...node,
    health: resolveSessionHealth(node.health, session.compatibilityState, session.state),
    sessionId: session.sessionId,
    sessionState: session.state,
    compatibilityState: session.compatibilityState,
    desiredStateRevision: session.desiredStateRevision ?? null,
    desiredStateHash: session.desiredStateHash ?? null,
  };
}

function mapKernelNode(
  snapshot: KernelPlatformSnapshot,
  hostStatus: HostPlatformSnapshot | null,
): NodeInventoryRecord {
  return {
    id: 'local-built-in',
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
    hostPlatformMode: hostStatus?.mode ?? null,
    sessionId: null,
    sessionState: null,
    compatibilityState: null,
    desiredStateRevision: null,
    desiredStateHash: null,
    detailPath: '/kernel',
  };
}

function mapInstanceNode(
  instance: StudioInstanceRecord,
  hostStatus: HostPlatformSnapshot | null,
): NodeInventoryRecord {
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
    hostPlatformMode: hostStatus?.mode ?? null,
    sessionId: null,
    sessionState: null,
    compatibilityState: null,
    desiredStateRevision: null,
    desiredStateHash: null,
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
    async getInventory(): Promise<NodeInventorySnapshot> {
      const [snapshot, hostStatus, sessions, instances] = await Promise.all([
        dependencies.kernelPlatformService.getStatus(),
        dependencies.hostPlatformService.getStatus(),
        dependencies.hostPlatformService.listNodeSessions(),
        dependencies.studioApi.getInstances(),
      ]);

      const nodes: NodeInventoryRecord[] = [];
      if (snapshot) {
        nodes.push(mapKernelNode(snapshot, hostStatus));
      }

      for (const instance of instances) {
        if (snapshot && isBuiltInLocalInstance(instance)) {
          continue;
        }
        nodes.push(mapInstanceNode(instance, hostStatus));
      }

      return {
        hostPlatform: hostStatus,
        nodes: nodes
          .map((node) => applyNodeSession(node, findNodeSession(node, sessions)))
          .sort(sortNodes),
        sessionCount: sessions.length,
      };
    },

    async listNodes(): Promise<NodeInventoryRecord[]> {
      const inventory = await this.getInventory();
      return inventory.nodes;
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
