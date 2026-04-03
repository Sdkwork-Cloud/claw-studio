import assert from 'node:assert/strict';
import { openClawConfigService } from '@sdkwork/claw-core';
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

function createCustomDetail(
  instanceId = 'custom-runtime',
  overrides: Partial<StudioInstanceDetailRecord> = {},
): StudioInstanceDetailRecord {
  const base = createOpenClawDetail(instanceId);

  return {
    ...base,
    instance: {
      ...base.instance,
      runtimeKind: 'custom',
      deploymentMode: 'remote',
      transportKind: 'customHttp',
      typeLabel: 'Custom Runtime',
      config: {
        port: '17890',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      ...(overrides.instance || {}),
    },
    config: {
      port: '17890',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      ...(overrides.config || {}),
    },
    capabilities:
      overrides.capabilities || [
        {
          id: 'files',
          status: 'ready',
          detail: 'Files are available.',
          source: 'runtime',
        },
        {
          id: 'models',
          status: 'ready',
          detail: 'Provider config is available.',
          source: 'runtime',
        },
      ],
    workbench:
      overrides.workbench || {
        channels: [],
        cronTasks: {
          tasks: [],
          taskExecutionsById: {},
        },
        llmProviders: [],
        agents: [],
        skills: [],
        files: [],
        memory: [],
        tools: [],
      },
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
    openClawGatewayClient: {
      setAgentFile: async () => {
        throw new Error('gateway file write should not be used for built-in OpenClaw');
      },
    },
  });

  await service.updateInstanceFileContent('local-built-in', '/workspace/main/AGENTS.md', '# updated');

  assert.deepEqual(calls, [['local-built-in', '/workspace/main/AGENTS.md', '# updated']]);
});

await runTest('updateInstanceFileContent routes backend-authored non-OpenClaw writes through the studio bridge', async () => {
  const calls: Array<[string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () =>
        createCustomDetail('custom-runtime', {
          workbench: {
            channels: [],
            cronTasks: {
              tasks: [],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [
              {
                id: 'project-plan.md',
                name: 'project-plan.md',
                path: '/workspace/project-plan.md',
                category: 'prompt',
                language: 'markdown',
                size: '1 KB',
                updatedAt: '2025-03-19T00:00:00.000Z',
                status: 'synced',
                description: 'Backend-authored project plan.',
                content: '# original',
                isReadonly: false,
              },
            ],
            memory: [],
            tools: [],
          },
        }),
      updateInstanceFileContent: async (instanceId, fileId, content) => {
        calls.push([instanceId, fileId, content]);
        return true;
      },
    },
    openClawGatewayClient: {
      setAgentFile: async () => {
        throw new Error('gateway file write should not be used for non-OpenClaw instances');
      },
    },
  });

  await service.updateInstanceFileContent('custom-runtime', 'project-plan.md', '# updated');

  assert.deepEqual(calls, [['custom-runtime', 'project-plan.md', '# updated']]);
});

await runTest('updateInstanceFileContent routes remote OpenClaw agent files through the gateway client', async () => {
  const calls: Array<[string, string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createOpenClawDetail('remote-openclaw'),
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

await runTest('getInstanceFileContent routes remote OpenClaw agent file reads through the gateway client', async () => {
  const calls: Array<[string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createOpenClawDetail('remote-openclaw'),
    },
    openClawGatewayClient: {
      getAgentFile: async (instanceId, args) => {
        calls.push([instanceId, args.agentId, args.name]);
        return {
          agentId: args.agentId,
          file: {
            name: args.name,
            path: `/workspace/${args.agentId}/${args.name}`,
            content: '# remote content',
          },
        };
      },
    },
  });

  const content = await service.getInstanceFileContent(
    'remote-openclaw',
    buildOpenClawAgentFileId('ops', 'AGENTS.md'),
  );

  assert.equal(content, '# remote content');
  assert.deepEqual(calls, [['remote-openclaw', 'ops', 'AGENTS.md']]);
});

await runTest('getInstanceFileContent returns built-in workbench file content without gateway reads', async () => {
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
          workbench: {
            channels: [],
            cronTasks: {
              tasks: [],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [
              {
                id: '/workspace/main/AGENTS.md',
                name: 'AGENTS.md',
                path: '/workspace/main/AGENTS.md',
                category: 'prompt',
                language: 'markdown',
                size: '1 KB',
                updatedAt: '2025-03-19T00:00:00.000Z',
                status: 'synced',
                description: 'Built-in file',
                content: '# built-in content',
                isReadonly: false,
              },
            ],
            memory: [],
            tools: [],
          },
        }),
    },
    openClawGatewayClient: {
      getAgentFile: async () => {
        throw new Error('gateway file read should not be used for built-in OpenClaw');
      },
    },
  });

  const content = await service.getInstanceFileContent(
    'local-built-in',
    '/workspace/main/AGENTS.md',
  );

  assert.equal(content, '# built-in content');
});

await runTest('getInstanceFileContent rejects reads when instance detail is unavailable', async () => {
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => null,
    },
  });

  await assert.rejects(
    () => service.getInstanceFileContent('custom-runtime', 'missing-file.md'),
    /instance detail is unavailable/i,
  );
});

await runTest('updateInstanceLlmProviderConfig rejects built-in managed OpenClaw provider edits and keeps Provider Center as the control plane', async () => {
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
    openClawGatewayClient: {
      getConfig: async () => {
        throw new Error('gateway config patch should not be used for built-in OpenClaw');
      },
      patchConfig: async () => {
        throw new Error('gateway config patch should not be used for built-in OpenClaw');
      },
    },
  });

  await assert.rejects(
    () =>
      service.updateInstanceLlmProviderConfig('local-built-in', 'openai', {
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
      }),
    /provider center/i,
  );

  assert.deepEqual(calls, []);
});

await runTest('updateInstanceFileContent rejects non-OpenClaw files not exposed by the backend workbench', async () => {
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createCustomDetail('custom-runtime'),
    },
  });

  await assert.rejects(
    () => service.updateInstanceFileContent('custom-runtime', 'missing-file.md', '# updated'),
    /not writable through the studio backend/i,
  );
});

await runTest('updateInstanceLlmProviderConfig routes backend-authored non-OpenClaw providers through the studio bridge', async () => {
  const calls: Array<[string, string, string]> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () =>
        createCustomDetail('custom-runtime', {
          workbench: {
            channels: [],
            cronTasks: {
              tasks: [],
              taskExecutionsById: {},
            },
            llmProviders: [
              {
                id: 'openai',
                name: 'OpenAI',
                provider: 'openai',
                endpoint: 'https://api.openai.com/v1',
                apiKeySource: '${OPENAI_API_KEY}',
                status: 'ready',
                defaultModelId: 'gpt-5.4',
                description: 'Backend-authored provider.',
                icon: 'O',
                lastCheckedAt: '2025-03-19T00:00:00.000Z',
                capabilities: ['chat'],
                models: [
                  {
                    id: 'gpt-5.4',
                    name: 'GPT-5.4',
                    role: 'primary',
                    contextWindow: '200K',
                  },
                ],
                config: {
                  temperature: 0.3,
                  topP: 0.95,
                  maxTokens: 12000,
                  timeoutMs: 120000,
                  streaming: true,
                },
              },
            ],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        }),
      updateInstanceLlmProviderConfig: async (instanceId, providerId, update) => {
        calls.push([instanceId, providerId, update.defaultModelId]);
        return true;
      },
    },
    openClawGatewayClient: {
      getConfig: async () => {
        throw new Error('gateway config read should not be used for non-OpenClaw instances');
      },
      patchConfig: async () => {
        throw new Error('gateway config patch should not be used for non-OpenClaw instances');
      },
    },
  });

  await service.updateInstanceLlmProviderConfig('custom-runtime', 'openai', {
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

  assert.deepEqual(calls, [['custom-runtime', 'openai', 'gpt-5.4']]);
});

await runTest('updateInstanceLlmProviderConfig rejects non-OpenClaw providers not exposed by the backend workbench', async () => {
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createCustomDetail('custom-runtime'),
    },
  });

  await assert.rejects(
    () =>
      service.updateInstanceLlmProviderConfig('custom-runtime', 'missing-provider', {
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
      }),
    /not writable through the studio backend/i,
  );
});

await runTest('updateInstanceLlmProviderConfig patches remote OpenClaw provider config through the gateway client', async () => {
  const patches: Array<{ instanceId: string; args: { raw: string; baseHash?: string } }> = [];
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () => createOpenClawDetail('remote-openclaw'),
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
          agents: {
            defaults: {
              model: {
                primary: 'openai/old-default',
              },
              models: {
                'openai/old-default': {
                  alias: 'old-default',
                  params: {
                    temperature: 0.2,
                    topP: 1,
                    maxTokens: 4096,
                    timeoutMs: 60000,
                    streaming: true,
                  },
                },
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
          temperature: null,
          topP: null,
          maxTokens: null,
          timeoutMs: null,
          streaming: null,
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
    agents: {
      defaults: {
        model: {
          primary: 'openai/gpt-5.4',
          fallbacks: ['openai/o4-mini'],
        },
        models: {
          'openai/gpt-5.4': {
            alias: 'gpt-5.4',
            streaming: true,
            params: {
              temperature: 0.3,
              topP: 0.95,
              maxTokens: 12000,
              timeoutMs: 120000,
              streaming: true,
            },
          },
          'openai/o4-mini': {
            alias: 'o4-mini',
            streaming: true,
          },
          'openai/text-embedding-3-large': {
            alias: 'text-embedding-3-large',
            streaming: false,
          },
          'openai/old-default': {
            alias: 'old-default',
            streaming: true,
          },
          'openai/old-embedding': {
            alias: 'old-embedding',
            streaming: false,
          },
        },
      },
    },
  });
});

await runTest('createInstanceLlmProvider rejects config-backed OpenClaw provider creation and keeps Provider Center as the control plane', async () => {
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () =>
        createOpenClawDetail('managed-openclaw', {
          instance: {
            ...createOpenClawDetail('managed-openclaw').instance,
            deploymentMode: 'local-external',
          },
          dataAccess: {
            routes: [
              {
                id: 'config',
                label: 'Configuration',
                scope: 'config',
                mode: 'managedFile',
                status: 'ready',
                target: 'D:/OpenClaw/.openclaw/openclaw.json',
                readonly: false,
                authoritative: true,
                detail: 'Managed config file is writable.',
                source: 'integration',
              },
            ],
          },
        }),
    },
  });

  await assert.rejects(
    () =>
      service.createInstanceLlmProvider(
        'managed-openclaw',
        {
          id: 'openai',
          channelId: 'openai',
          name: 'OpenAI',
          apiKey: '${OPENAI_API_KEY}',
          baseUrl: 'https://api.openai.com/v1',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
          config: {
            temperature: 0.3,
            topP: 0.95,
            maxTokens: 12000,
            timeoutMs: 120000,
            streaming: true,
          },
        },
        {
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'gpt-5.4',
          embeddingModelId: 'text-embedding-3-large',
        },
      ),
    /provider center/i,
  );
});

await runTest('createInstanceLlmProvider rejects built-in managed OpenClaw provider creation and keeps Provider Center as the control plane', async () => {
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
    },
  });

  await assert.rejects(
    () =>
      service.createInstanceLlmProvider(
        'local-built-in',
        {
          id: 'openai',
          channelId: 'openai',
          name: 'OpenAI',
          apiKey: '${OPENAI_API_KEY}',
          baseUrl: 'https://api.openai.com/v1',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
          config: {
            temperature: 0.3,
            topP: 0.95,
            maxTokens: 12000,
            timeoutMs: 120000,
            streaming: true,
          },
        },
        {
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'gpt-5.4',
          embeddingModelId: 'text-embedding-3-large',
        },
      ),
    /provider center/i,
  );
});

await runTest('deleteInstanceLlmProvider rejects built-in managed OpenClaw provider deletion and keeps Provider Center as the control plane', async () => {
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
    },
  });

  await assert.rejects(
    () => service.deleteInstanceLlmProvider('local-built-in', 'sdkwork-local-proxy'),
    /provider center/i,
  );
});

await runTest('createInstanceLlmProviderModel rejects built-in managed OpenClaw provider model creation and keeps Provider Center as the control plane', async () => {
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
    },
  });

  await assert.rejects(
    () =>
      service.createInstanceLlmProviderModel('local-built-in', 'sdkwork-local-proxy', {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
      }),
    /provider center/i,
  );
});

await runTest('updateInstanceLlmProviderModel rejects built-in managed OpenClaw provider model edits and keeps Provider Center as the control plane', async () => {
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
    },
  });

  await assert.rejects(
    () =>
      service.updateInstanceLlmProviderModel(
        'local-built-in',
        'sdkwork-local-proxy',
        'gpt-5.4',
        {
          id: 'gpt-5.4-mini',
          name: 'GPT-5.4 Mini',
        },
      ),
    /provider center/i,
  );
});

await runTest('deleteInstanceLlmProviderModel rejects built-in managed OpenClaw provider model deletion and keeps Provider Center as the control plane', async () => {
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
    },
  });

  await assert.rejects(
    () =>
      service.deleteInstanceLlmProviderModel(
        'local-built-in',
        'sdkwork-local-proxy',
        'gpt-5.4',
      ),
    /provider center/i,
  );
});

await runTest('updateInstanceLlmProviderConfig rejects config-backed OpenClaw provider edits and keeps Provider Center as the control plane', async () => {
  const service = createInstanceService({
    studioApi: {
      getInstanceDetail: async () =>
        createOpenClawDetail('managed-openclaw', {
          instance: {
            ...createOpenClawDetail('managed-openclaw').instance,
            deploymentMode: 'local-external',
          },
          dataAccess: {
            routes: [
              {
                id: 'config',
                label: 'Configuration',
                scope: 'config',
                mode: 'managedFile',
                status: 'ready',
                target: 'D:/OpenClaw/.openclaw/openclaw.json',
                readonly: false,
                authoritative: true,
                detail: 'Managed config file is writable.',
                source: 'integration',
              },
            ],
          },
        }),
    },
  });

  await assert.rejects(
    () =>
      service.updateInstanceLlmProviderConfig('managed-openclaw', 'sdkwork-local-proxy', {
        endpoint: 'http://localhost:18791/v1',
        apiKeySource: 'sk_sdkwork_api_key',
        defaultModelId: 'sdkwork-chat',
        reasoningModelId: 'sdkwork-reasoning',
        embeddingModelId: 'sdkwork-embedding',
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 8192,
          timeoutMs: 60000,
          streaming: true,
        },
      }),
    /provider center/i,
  );
});
