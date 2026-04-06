import assert from 'node:assert/strict';
import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { chatStore } from './chatStore.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createGatewaySnapshotInstance(instanceId: string): StudioInstanceRecord {
  return {
    id: instanceId,
    name: 'Local Built-In Snapshot',
    description: 'Stale snapshot authority.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: '2026.4.2',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18797,
    baseUrl: 'http://127.0.0.1:18797/openclaw',
    websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
    cpu: 0,
    memory: 0,
    totalMemory: '0 GB',
    uptime: '0m',
    capabilities: ['chat'],
    storage: {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: {
      port: '18797',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18797/openclaw',
      websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
      authToken: 'snapshot-token',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
  };
}

function createStartingDetail(instanceId: string): StudioInstanceDetailRecord {
  return {
    instance: {
      ...createGatewaySnapshotInstance(instanceId),
      status: 'starting',
      baseUrl: null,
      websocketUrl: null,
      config: {
        ...createGatewaySnapshotInstance(instanceId).config,
        baseUrl: null,
        websocketUrl: null,
        authToken: 'detail-token',
      },
    },
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: null,
      websocketUrl: null,
      authToken: 'detail-token',
    },
    logs: '',
    health: {
      score: 50,
      status: 'degraded',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appManaged',
      startStopSupported: true,
      configWritable: true,
      lifecycleControllable: true,
      workbenchManaged: true,
      endpointObserved: false,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'fixture',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport: 'openclawGatewayWs',
      endpoints: [],
    },
    observability: {
      status: 'limited',
      logAvailable: true,
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: null,
    workbench: null,
  };
}

function resetChatStore() {
  chatStore.setState((state) => ({
    ...state,
    sessions: [],
    activeSessionIdByInstance: {},
    syncStateByInstance: {},
    gatewayConnectionStatusByInstance: {},
    lastErrorByInstance: {},
    instanceRouteModeById: {},
  }));
}

await runTest(
  'chatStore connectGatewayInstances uses instance detail authority before hydrating the built-in OpenClaw gateway',
  async () => {
    const instanceId = 'authority-mismatch-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createGatewaySnapshotInstance(requestedInstanceId);
        },
        async getInstanceDetail(requestedInstanceId) {
          return createStartingDetail(requestedInstanceId);
        },
      },
    });

    try {
      await chatStore.getState().connectGatewayInstances([instanceId]);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);
