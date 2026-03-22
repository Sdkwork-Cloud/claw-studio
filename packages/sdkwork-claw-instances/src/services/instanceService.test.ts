import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import {
  buildOpenClawAgentFileId,
  createInstanceService,
} from './instanceService.ts';

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

function createOpenClawDetail(
  instanceId = 'openclaw-prod',
  overrides: Partial<StudioInstanceDetailRecord> = {},
): StudioInstanceDetailRecord {
  return {
    instance: {
      id: instanceId,
      name: `OpenClaw ${instanceId}`,
      description: 'Primary OpenClaw gateway.',
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '2026.3.13',
      typeLabel: 'OpenClaw Gateway',
      host: '10.0.0.8',
      port: 18789,
      baseUrl: 'http://10.0.0.8:18789',
      websocketUrl: 'ws://10.0.0.8:18789',
      cpu: 12,
      memory: 35,
      totalMemory: '64GB',
      uptime: '18h',
      capabilities: ['chat', 'health', 'tasks', 'files', 'memory', 'tools', 'models'],
      storage: {
        provider: 'localFile',
        namespace: instanceId,
      },
      config: {
        port: '18789',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://10.0.0.8:18789',
        websocketUrl: 'ws://10.0.0.8:18789',
        authToken: 'gateway-token',
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://10.0.0.8:18789',
      websocketUrl: 'ws://10.0.0.8:18789',
      authToken: 'gateway-token',
    },
    logs: '',
    health: {
      score: 91,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: false,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: instanceId,
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
      status: 'ready',
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
    ...overrides,
  };
}

await runTest('updateInstanceFileContent routes built-in managed OpenClaw writes through the studio bridge', async () => {
  const calls: Array<[string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () =>
        createOpenClawDetail('local-built-in', {
          instance: {
            ...createOpenClawDetail('local-built-in').instance,
            isBuiltIn: true,
            isDefault: true,
            deploymentMode: 'local-managed',
            host: '127.0.0.1',
          },
        }),
      updateInstanceFileContent: async (instanceId, fileId, content) => {
        calls.push([instanceId, fileId, content]);
        return true;
      },
    },
    studioMockService: {
      updateInstanceFileContent: async () => false,
    },
    openClawGatewayClient: {
      setAgentFile: async () => {
        throw new Error('gateway file write should not be used for built-in OpenClaw');
      },
    },
  });

  await service.updateInstanceFileContent('local-built-in', '/workspace/main/AGENTS.md', '# updated');

  assert.deepEqual(calls, [['local-built-in', '/workspace/main/AGENTS.md', '# updated']]);
});

await runTest('updateInstanceFileContent routes remote OpenClaw agent files through the gateway client', async () => {
  const calls: Array<[string, string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createOpenClawDetail('remote-openclaw'),
    },
    studioMockService: {
      updateInstanceFileContent: async () => false,
    },
    openClawGatewayClient: {
      setAgentFile: async (instanceId, args) => {
        calls.push([instanceId, args.agentId, args.name, args.content]);
        return {
          ok: true,
          agentId: args.agentId,
        };
      },
    },
  });

  await service.updateInstanceFileContent(
    'remote-openclaw',
    buildOpenClawAgentFileId('ops', 'AGENTS.md'),
    '# remote update',
  );

  assert.deepEqual(calls, [['remote-openclaw', 'ops', 'AGENTS.md', '# remote update']]);
});

await runTest('updateInstanceLlmProviderConfig routes built-in managed OpenClaw providers through the studio bridge', async () => {
  const calls: Array<[string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () =>
        createOpenClawDetail('local-built-in', {
          instance: {
            ...createOpenClawDetail('local-built-in').instance,
            isBuiltIn: true,
            isDefault: true,
            deploymentMode: 'local-managed',
            host: '127.0.0.1',
          },
        }),
      updateInstanceLlmProviderConfig: async (instanceId, providerId, update) => {
        calls.push([instanceId, providerId, update.defaultModelId]);
        return true;
      },
    },
    studioMockService: {
      updateInstanceLlmProviderConfig: async () => false,
    },
    openClawGatewayClient: {
      getConfig: async () => {
        throw new Error('gateway config patch should not be used for built-in OpenClaw');
      },
      patchConfig: async () => {
        throw new Error('gateway config patch should not be used for built-in OpenClaw');
      },
    },
  });

  await service.updateInstanceLlmProviderConfig('local-built-in', 'openai', {
    endpoint: 'https://api.openai.com/v1',
    apiKeySource: '${OPENAI_API_KEY}',
    defaultModelId: 'gpt-5.4',
    reasoningModelId: 'gpt-5.4',
    embeddingModelId: 'text-embedding-3-large',
    config: {
      temperature: 0.3,
      topP: 0.95,
      maxTokens: 12000,
      timeoutMs: 120000,
      streaming: true,
    },
  });

  assert.deepEqual(calls, [['local-built-in', 'openai', 'gpt-5.4']]);
});

await runTest('updateInstanceLlmProviderConfig patches remote OpenClaw provider config through the gateway client', async () => {
  const patches: Array<{ instanceId: string; args: { raw: string; baseHash?: string } }> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createOpenClawDetail('remote-openclaw'),
    },
    studioMockService: {
      updateInstanceLlmProviderConfig: async () => false,
    },
    openClawGatewayClient: {
      getConfig: async () => ({
        baseHash: 'hash-1',
        config: {
          models: {
            providers: {
              openai: {
                baseUrl: 'https://old.example.com/v1',
                apiKey: '${OLD_KEY}',
                models: [
                  {
                    id: 'old-default',
                    name: 'old-default',
                    role: 'primary',
                  },
                  {
                    id: 'old-embedding',
                    name: 'old-embedding',
                    role: 'embedding',
                  },
                ],
                temperature: 0.2,
                topP: 1,
                maxTokens: 4096,
                timeoutMs: 60000,
                streaming: true,
              },
            },
          },
        },
      }),
      patchConfig: async (instanceId, args) => {
        patches.push({ instanceId, args });
        return {
          ok: true,
        };
      },
    },
  });

  await service.updateInstanceLlmProviderConfig('remote-openclaw', 'openai', {
    endpoint: 'https://api.openai.com/v1',
    apiKeySource: '${OPENAI_API_KEY}',
    defaultModelId: 'gpt-5.4',
    reasoningModelId: 'o4-mini',
    embeddingModelId: 'text-embedding-3-large',
    config: {
      temperature: 0.3,
      topP: 0.95,
      maxTokens: 12000,
      timeoutMs: 120000,
      streaming: true,
    },
  });

  assert.equal(patches.length, 1);
  assert.equal(patches[0]?.instanceId, 'remote-openclaw');
  assert.equal(patches[0]?.args.baseHash, 'hash-1');
  assert.deepEqual(JSON.parse(patches[0]!.args.raw), {
    models: {
      providers: {
        openai: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '${OPENAI_API_KEY}',
          temperature: 0.3,
          topP: 0.95,
          maxTokens: 12000,
          timeoutMs: 120000,
          streaming: true,
          models: [
            {
              id: 'gpt-5.4',
              name: 'gpt-5.4',
              role: 'primary',
            },
            {
              id: 'o4-mini',
              name: 'o4-mini',
              role: 'reasoning',
            },
            {
              id: 'text-embedding-3-large',
              name: 'text-embedding-3-large',
              role: 'embedding',
            },
            {
              id: 'old-default',
              name: 'old-default',
              role: 'primary',
            },
            {
              id: 'old-embedding',
              name: 'old-embedding',
              role: 'embedding',
            },
          ],
        },
      },
    },
  });
});
