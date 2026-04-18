import assert from 'node:assert/strict';
import { instanceStore } from '@sdkwork/claw-core';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import { chatService, createChatService } from './chatService.ts';

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

function createHttpSnapshotInstance(instanceId: string): StudioInstanceRecord {
  return {
    id: instanceId,
    name: 'HTTP Runtime',
    description: 'HTTP transport fixture.',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customHttp',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '2026.4.2',
    typeLabel: 'Custom HTTP',
    host: '127.0.0.1',
    port: 18080,
    baseUrl: 'http://127.0.0.1:18080',
    websocketUrl: null,
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
      port: '18080',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18080',
      websocketUrl: null,
      authToken: 'fixture-token',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
  };
}

function createAdapterResolution(
  instance: StudioInstanceRecord,
  input: {
    adapterId: string;
    authorityKind: 'gateway' | 'sqlite' | 'http' | 'localProjection';
    supported?: boolean;
    durable?: boolean;
    writable?: boolean;
    supportsStreaming?: boolean;
    supportsRuns?: boolean;
    supportsAgentProfiles?: boolean;
    supportsSessionMutation?: boolean;
    reason?: string | null;
  },
) {
  const capabilities = {
    adapterId: input.adapterId,
    authorityKind: input.authorityKind,
    supported: input.supported ?? true,
    durable: input.durable ?? true,
    writable: input.writable ?? true,
    supportsStreaming: input.supportsStreaming ?? true,
    supportsRuns: input.supportsRuns ?? true,
    supportsAgentProfiles: input.supportsAgentProfiles ?? true,
    supportsSessionMutation: input.supportsSessionMutation ?? true,
    reason: input.reason ?? null,
  };

  return {
    instanceId: instance.id,
    instance,
    adapterId: input.adapterId,
    capabilities,
    adapter: {
      adapterId: input.adapterId,
      getCapabilities() {
        return capabilities;
      },
    },
  };
}

function createStartingDetail(instanceId: string): StudioInstanceDetailRecord {
  const snapshot = createGatewaySnapshotInstance(instanceId);
  return {
    instance: {
      ...snapshot,
      status: 'starting',
      baseUrl: null,
      websocketUrl: null,
      config: {
        ...snapshot.config,
        baseUrl: null,
        websocketUrl: null,
        authToken: 'detail-token',
      },
    },
    config: {
      ...snapshot.config,
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

async function collectStream(stream: AsyncGenerator<string, void, unknown>) {
  let output = '';
  for await (const chunk of stream) {
    output += chunk;
  }
  return output;
}

await runTest(
  'chatService sendMessageStream uses authoritative instance detail truth before reporting built-in OpenClaw route readiness',
  async () => {
    const instanceId = 'chat-authority-instance';
    const originalBridge = getPlatformBridge();
    const originalActiveInstanceId = instanceStore.getState().activeInstanceId;

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
    instanceStore.setState({ activeInstanceId: instanceId });

    try {
      const output = await collectStream(
        chatService.sendMessageStream(
          null,
          'hello',
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
            provider: 'openai',
            icon: 'OA',
          },
        ),
      );

      assert.match(output, /not chat-ready yet/i);
      assert.match(output, /status: starting/i);
      assert.doesNotMatch(output, /native OpenClaw Gateway WebSocket flow/i);
    } finally {
      instanceStore.setState({ activeInstanceId: originalActiveInstanceId });
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatService prefers adapter identity over raw route mode when deciding whether a kernel must use the native gateway path',
  async () => {
    let streamed = false;
    const instance = createHttpSnapshotInstance('adapter-first-openclaw');
    const service = createChatService({
      async resolveActiveInstanceContext() {
        return {
          activeInstance: instance,
          route: {
            mode: 'instanceOpenAiHttp',
            runtimeKind: instance.runtimeKind,
            transportKind: instance.transportKind,
            deploymentMode: instance.deploymentMode,
            endpoint: 'http://127.0.0.1:18080/chat/completions',
          },
          adapterResolution: createAdapterResolution(instance, {
            adapterId: 'openclawGateway',
            authorityKind: 'gateway',
          }),
        };
      },
      async *streamRequest() {
        streamed = true;
        yield 'unexpected';
      },
    });

    const output = await collectStream(
      service.sendMessageStream(
        null,
        'hello',
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          provider: 'openai',
          icon: 'OA',
        },
      ),
    );

    assert.match(output, /native gateway WebSocket flow/i);
    assert.equal(streamed, false);
  },
);

await runTest(
  'chatService blocks adapter-unsupported kernels before attempting generic HTTP streaming',
  async () => {
    let streamed = false;
    const instance = createHttpSnapshotInstance('adapter-unsupported-http');
    const service = createChatService({
      async resolveActiveInstanceContext() {
        return {
          activeInstance: instance,
          route: {
            mode: 'instanceOpenAiHttp',
            runtimeKind: instance.runtimeKind,
            transportKind: instance.transportKind,
            deploymentMode: instance.deploymentMode,
            endpoint: 'http://127.0.0.1:18080/chat/completions',
          },
          adapterResolution: createAdapterResolution(instance, {
            adapterId: 'hermes',
            authorityKind: 'sqlite',
            supported: false,
            supportsStreaming: false,
            supportsRuns: false,
            supportsAgentProfiles: false,
            supportsSessionMutation: false,
            reason: 'Hermes chat transport is not wired yet.',
          }),
        };
      },
      async *streamRequest() {
        streamed = true;
        yield 'unexpected';
      },
    });

    const output = await collectStream(
      service.sendMessageStream(
        null,
        'hello',
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          provider: 'openai',
          icon: 'OA',
        },
      ),
    );

    assert.match(output, /not chat-ready yet/i);
    assert.match(output, /Hermes chat transport is not wired yet/i);
    assert.equal(streamed, false);
  },
);
