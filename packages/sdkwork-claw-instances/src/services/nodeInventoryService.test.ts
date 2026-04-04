import assert from 'node:assert/strict';
import type {
  HostPlatformStatusRecord,
  InternalNodeSessionRecord,
} from '@sdkwork/claw-infrastructure';
import type { KernelPlatformSnapshot } from '@sdkwork/claw-core';
import {
  DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
} from '../../../sdkwork-claw-types/src/openclawRelease.ts';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createKernelSnapshot(
  overrides: Partial<KernelPlatformSnapshot> = {},
): KernelPlatformSnapshot {
  const raw: KernelPlatformSnapshot['raw'] = {
    topology: {
      kind: 'localManagedNative',
      state: 'installed',
      label: 'Built-In Native Runtime',
      recommended: true,
    },
    runtime: {
      state: 'running',
      health: 'healthy',
      reason: 'Bundled OpenClaw is healthy.',
      startedBy: 'appSupervisor',
      lastTransitionAt: 1_743_100_000_000,
    },
    endpoint: {
      preferredPort: 18789,
      activePort: 18845,
      baseUrl: 'http://127.0.0.1:18845',
      websocketUrl: 'ws://127.0.0.1:18845',
      loopbackOnly: true,
      dynamicPort: true,
      endpointSource: 'allocated',
    },
    host: {
      serviceManager: 'windowsService',
      ownership: 'appSupervisor',
      serviceName: 'ClawStudioOpenClawKernel',
      serviceConfigPath: 'C:/ProgramData/SdkWork/ClawStudio/kernel/windows-service.json',
      startupMode: 'auto',
      attachSupported: true,
      repairSupported: true,
      controlSocket: null,
    },
    provenance: {
      runtimeId: 'openclaw',
      installKey: `${DEFAULT_BUNDLED_OPENCLAW_VERSION}-windows-x64`,
      openclawVersion: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      nodeVersion: DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
      platform: 'windows',
      arch: 'x64',
      installSource: 'bundled',
      configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
      runtimeHomeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
      runtimeInstallDir: `C:/Program Files/SdkWork/CrawStudio/runtimes/openclaw/${DEFAULT_BUNDLED_OPENCLAW_VERSION}-windows-x64`,
    },
  };

  return {
    raw,
    topologyKind: raw.topology.kind,
    topologyState: raw.topology.state,
    runtimeState: raw.runtime.state,
    runtimeHealth: raw.runtime.health,
    hostManager: raw.host.serviceManager,
    controlMode: 'supervisedFallback',
    baseUrl: raw.endpoint.baseUrl,
    websocketUrl: raw.endpoint.websocketUrl,
    preferredPort: raw.endpoint.preferredPort,
    activePort: raw.endpoint.activePort,
    usesDynamicPort: raw.endpoint.dynamicPort,
    serviceConfigPath: raw.host.serviceConfigPath,
    openclawVersion: raw.provenance.openclawVersion,
    nodeVersion: raw.provenance.nodeVersion,
    ...overrides,
  };
}

function createInstance(
  overrides: Partial<StudioInstanceRecord> = {},
): StudioInstanceRecord {
  return {
    id: 'local-built-in',
    name: 'Local Built-In',
    description: 'Bundled OpenClaw runtime.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    typeLabel: 'OpenClaw Gateway',
    host: '127.0.0.1',
    port: 18845,
    baseUrl: 'http://127.0.0.1:18845',
    websocketUrl: 'ws://127.0.0.1:18845',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '2h',
    capabilities: ['chat'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18845',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: 'http://localhost:3001',
      baseUrl: 'http://127.0.0.1:18845',
      websocketUrl: 'ws://127.0.0.1:18845',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
    ...overrides,
  };
}

function createHostPlatformStatus(
  overrides: Partial<HostPlatformStatusRecord> = {},
): HostPlatformStatusRecord {
  return {
    mode: 'desktopCombined',
    lifecycle: 'ready',
    hostId: 'desktop-combined',
    displayName: 'Desktop Combined Host',
    version: '0.1.0',
    desiredStateProjectionVersion: 'phase1',
    rolloutEngineVersion: 'phase1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    stateStoreDriver: 'sqlite',
    stateStore: {
      activeProfileId: 'default-sqlite',
      providers: [
        {
          id: 'sqlite',
          label: 'SQLite',
          availability: 'ready',
          requiresConfiguration: false,
          configurationKeys: [],
        },
      ],
      profiles: [
        {
          id: 'default-sqlite',
          label: 'SQLite',
          driver: 'sqlite',
          active: true,
          availability: 'ready',
          path: 'C:/Users/admin/.sdkwork/crawstudio/storage/default.db',
          connectionConfigured: false,
          configuredKeys: ['path'],
        },
      ],
    },
    capabilityKeys: ['nodeSessions', 'rollouts'],
    updatedAt: 1_743_100_500_000,
    ...overrides,
  };
}

function createNodeSession(
  overrides: Partial<InternalNodeSessionRecord> = {},
): InternalNodeSessionRecord {
  return {
    sessionId: 'desktop-combined-local-built-in',
    nodeId: 'local-built-in',
    state: 'admitted',
    compatibilityState: 'compatible',
    desiredStateRevision: 6,
    desiredStateHash: 'rev-6',
    lastSeenAt: 1_743_100_501_000,
    ...overrides,
  };
}

await runTest('nodeInventoryService separates the local managed kernel node from attached remote nodes', async () => {
  const { createNodeInventoryService } = await import('./nodeInventoryService.ts');

  const service = createNodeInventoryService({
    kernelPlatformService: {
      getStatus: async () => createKernelSnapshot(),
    },
    hostPlatformService: {
      getStatus: async () => ({
        ...createHostPlatformStatus(),
        capabilityCount: 2,
        isReady: true,
      }),
      listNodeSessions: async () => [
        createNodeSession(),
        createNodeSession({
          sessionId: 'remote-attached-session',
          nodeId: 'remote-attached',
          state: 'degraded',
          compatibilityState: 'degraded',
          desiredStateRevision: 3,
          desiredStateHash: 'rev-3',
        }),
      ],
    },
    studioApi: {
      getInstances: async () => [
        createInstance(),
        createInstance({
          id: 'remote-attached',
          name: 'Edge Gateway',
          deploymentMode: 'remote',
          isBuiltIn: false,
          isDefault: false,
          status: 'online',
          host: 'gateway.example.com',
          port: 28789,
          baseUrl: 'https://gateway.example.com',
          websocketUrl: 'wss://gateway.example.com',
        }),
      ],
    },
  });

  const inventory = await service.listNodes();

  assert.deepEqual(
    inventory.map((node) => node.id),
    ['local-built-in', 'remote-attached'],
  );
  assert.equal(inventory[0]?.kind, 'localPrimary');
  assert.equal(inventory[0]?.management, 'managed');
  assert.equal(inventory[0]?.topologyKind, 'localManagedNative');
  assert.equal(inventory[0]?.health, 'ok');
  assert.equal(inventory[0]?.sessionState, 'admitted');
  assert.equal(inventory[0]?.compatibilityState, 'compatible');
  assert.equal(inventory[0]?.desiredStateRevision, 6);
  assert.equal(inventory[1]?.kind, 'attachedRemote');
  assert.equal(inventory[1]?.management, 'attached');
  assert.equal(inventory[1]?.health, 'degraded');
  assert.equal(inventory[1]?.sessionState, 'degraded');
});

await runTest('nodeInventoryService maps degraded kernel health and managed remote nodes without dropping control metadata', async () => {
  const { createNodeInventoryService } = await import('./nodeInventoryService.ts');

  const service = createNodeInventoryService({
    kernelPlatformService: {
      getStatus: async () =>
        createKernelSnapshot({
          runtimeHealth: 'failedSafe',
          runtimeState: 'failedSafe',
          controlMode: 'attached',
        }),
    },
    hostPlatformService: {
      getStatus: async () => ({
        ...createHostPlatformStatus({ lifecycle: 'degraded' }),
        capabilityCount: 2,
        isReady: false,
      }),
      listNodeSessions: async () => [
        createNodeSession({
          state: 'blocked',
          compatibilityState: 'blocked',
          desiredStateRevision: null,
          desiredStateHash: null,
        }),
        createNodeSession({
          sessionId: 'managed-remote-session',
          nodeId: 'managed-remote',
          state: 'blocked',
          compatibilityState: 'blocked',
          desiredStateRevision: null,
          desiredStateHash: null,
        }),
      ],
    },
    studioApi: {
      getInstances: async () => [
        createInstance({
          id: 'managed-remote',
          name: 'Cluster Worker',
          deploymentMode: 'local-managed',
          isBuiltIn: false,
          isDefault: false,
          status: 'starting',
          host: '10.0.0.8',
          port: 28789,
          baseUrl: 'http://10.0.0.8:28789',
          websocketUrl: 'ws://10.0.0.8:28789',
        }),
      ],
    },
  });

  const inventory = await service.listNodes();

  assert.equal(inventory[0]?.health, 'quarantined');
  assert.equal(inventory[0]?.management, 'attached');
  assert.equal(inventory[0]?.compatibilityState, 'blocked');
  assert.equal(inventory[1]?.kind, 'managedRemote');
  assert.equal(inventory[1]?.management, 'managed');
  assert.equal(inventory[1]?.health, 'quarantined');
  assert.equal(inventory[1]?.sessionState, 'blocked');
});
