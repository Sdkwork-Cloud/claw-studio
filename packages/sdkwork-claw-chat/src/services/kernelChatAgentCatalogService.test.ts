import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { createKernelChatAgentCatalogService } from './kernelChatAgentCatalogService.ts';

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

function createDetail(
  runtimeKind: StudioInstanceDetailRecord['instance']['runtimeKind'],
  agents: Array<{
    id: string;
    name: string;
    description: string;
    avatar: string;
    systemPrompt: string;
    creator: string;
  }> = [],
): StudioInstanceDetailRecord {
  return {
    instance: {
      id: 'instance-a',
      name: 'Kernel Runtime',
      description: 'Fixture',
      runtimeKind,
      deploymentMode: 'remote',
      transportKind: runtimeKind === 'openclaw' ? 'openclawGatewayWs' : 'customHttp',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: 'test',
      typeLabel: 'Fixture',
      host: '127.0.0.1',
      port: 18080,
      baseUrl: 'http://127.0.0.1:18080',
      websocketUrl: 'ws://127.0.0.1:18080',
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
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
    },
    config: {
      port: '18080',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
    },
    logs: '',
    health: {
      score: 100,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: false,
      configWritable: false,
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
      primaryTransport: runtimeKind === 'openclaw' ? 'openclawGatewayWs' : 'customHttp',
      endpoints: [],
    },
    observability: {
      status: 'limited',
      logAvailable: false,
      logPreview: [],
      metricsSource: 'derived',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    workbench: {
      channels: [],
      cronTasks: {
        tasks: [],
        taskExecutionsById: {},
      },
      llmProviders: [],
      agents: agents.map((agent) => ({
        agent,
        focusAreas: [],
        automationFitScore: 80,
      })),
      skills: [],
      files: [],
      memory: [],
      tools: [],
    },
  };
}

await runTest('kernelChatAgentCatalogService prefers OpenClaw kernel catalogs over workbench fallbacks', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('openclaw', [
        {
          id: 'stale',
          name: 'Stale Agent',
          description: 'Should not win over kernel catalog.',
          avatar: 'S',
          systemPrompt: 'stale',
          creator: 'Workbench',
        },
      ]);
    },
    async getOpenClawCatalog() {
      return {
        defaultAgentId: 'main',
        agents: [
          {
            id: 'main',
            name: 'Main',
            description: 'Main kernel agent.',
            avatar: 'M',
            systemPrompt: 'main',
            creator: 'OpenClaw',
            isDefault: true,
          },
        ],
      };
    },
  });

  const profiles = await service.listAgentProfiles('instance-a');

  assert.deepEqual(profiles, [
    {
      kernelId: 'openclaw',
      instanceId: 'instance-a',
      agentId: 'main',
      label: 'Main',
      description: 'Main kernel agent.',
      source: 'kernelCatalog',
      systemPrompt: 'main',
      avatar: 'M',
      creator: 'OpenClaw',
    },
  ]);
});

await runTest('kernelChatAgentCatalogService falls back to workbench agents for non-openclaw runtimes', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('custom', [
        {
          id: 'ops',
          name: 'Ops',
          description: 'Operations agent.',
          avatar: 'O',
          systemPrompt: 'ops',
          creator: 'Workbench',
        },
      ]);
    },
    async getOpenClawCatalog() {
      throw new Error('should not call openclaw catalog for non-openclaw runtimes');
    },
  });

  const profiles = await service.listAgentProfiles('instance-a');
  const agents = await service.listAgents('instance-a');

  assert.deepEqual(profiles, [
    {
      kernelId: 'custom',
      instanceId: 'instance-a',
      agentId: 'ops',
      label: 'Ops',
      description: 'Operations agent.',
      source: 'workbenchProjection',
      systemPrompt: 'ops',
      avatar: 'O',
      creator: 'Workbench',
    },
  ]);
  assert.deepEqual(agents, [
    {
      id: 'ops',
      name: 'Ops',
      description: 'Operations agent.',
      avatar: 'O',
      systemPrompt: 'ops',
      creator: 'Workbench',
    },
  ]);
});
