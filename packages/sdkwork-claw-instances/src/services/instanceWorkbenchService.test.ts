import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { createInstanceWorkbenchService } from './instanceWorkbenchService.ts';

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
    capabilities: [
      {
        id: 'tasks',
        status: 'ready',
        detail: 'Cron tasks are enabled.',
        source: 'runtime',
      },
      {
        id: 'files',
        status: 'ready',
        detail: 'Agent files are readable.',
        source: 'runtime',
      },
      {
        id: 'memory',
        status: 'ready',
        detail: 'Memory reads are enabled.',
        source: 'runtime',
      },
      {
        id: 'tools',
        status: 'ready',
        detail: 'Tool catalog is available.',
        source: 'runtime',
      },
      {
        id: 'models',
        status: 'ready',
        detail: 'Model configuration is available.',
        source: 'runtime',
      },
    ],
    officialRuntimeNotes: [],
    ...overrides,
  };
}

function createBuiltInOpenClawDetail(): StudioInstanceDetailRecord {
  return {
    ...createOpenClawDetail('local-built-in'),
    instance: {
      ...createOpenClawDetail('local-built-in').instance,
      isBuiltIn: true,
      isDefault: true,
      deploymentMode: 'local-managed',
      host: '127.0.0.1',
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
    },
    config: {
      ...createOpenClawDetail('local-built-in').config,
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
    },
    workbench: {
      channels: [
        {
          id: 'old-channel',
          name: 'Old Channel',
          description: 'Stale backend data',
          status: 'disconnected',
          enabled: false,
          fieldCount: 1,
          configuredFieldCount: 0,
          setupSteps: ['Reconnect the channel.'],
        },
      ],
      cronTasks: {
        tasks: [
          {
            id: 'backend-task-1',
            name: 'Backend Snapshot Task',
            description: 'Task from backend snapshot',
            prompt: 'Snapshot prompt',
            schedule: '0 8 * * *',
            scheduleMode: 'cron',
            scheduleConfig: {
              cronExpression: '0 8 * * *',
            },
            cronExpression: '0 8 * * *',
            actionType: 'skill',
            status: 'active',
            executionContent: 'runAssistantTask',
            deliveryMode: 'publishSummary',
            deliveryChannel: 'slack',
            deliveryLabel: 'Slack',
            recipient: 'channel:C001',
            lastRun: '2025-03-19T00:00:00.000Z',
            nextRun: '2025-03-20T00:00:00.000Z',
            latestExecution: null,
          },
        ],
        taskExecutionsById: {
          'backend-task-1': [],
        },
      },
      llmProviders: [
        {
          id: 'backend-provider',
          name: 'Backend Provider',
          provider: 'backend',
          endpoint: 'https://backend.example.com',
          apiKeySource: 'env:BACKEND_KEY',
          status: 'ready',
          defaultModelId: 'backend-model',
          description: 'Stale backend provider.',
          icon: 'B',
          lastCheckedAt: '2025-03-19T00:00:00.000Z',
          capabilities: ['chat'],
          models: [
            {
              id: 'backend-model',
              name: 'Backend Model',
              role: 'primary',
              contextWindow: 'Unknown',
            },
          ],
          config: {
            temperature: 0.2,
            topP: 1,
            maxTokens: 4096,
            timeoutMs: 60000,
            streaming: true,
          },
        },
      ],
      agents: [
        {
          agent: {
            id: 'backend-agent',
            name: 'Backend Agent',
            description: 'Stale backend agent.',
            avatar: 'B',
            systemPrompt: 'Handle backend tasks.',
            creator: 'Claw Studio',
          },
          focusAreas: ['Generalist'],
          automationFitScore: 55,
        },
      ],
      skills: [
        {
          id: 'backend-skill',
          name: 'Backend Skill',
          description: 'Stale backend skill.',
          author: 'Claw Studio',
          rating: 5,
          downloads: 1,
          category: 'Automation',
        },
      ],
      files: [
        {
          id: '/workspace/main/AGENTS.md',
          name: 'AGENTS.md',
          path: '/workspace/main/AGENTS.md',
          category: 'prompt',
          language: 'markdown',
          size: '1.0 KB',
          updatedAt: '2025-03-19T00:00:00.000Z',
          status: 'synced',
          description: 'Built-in managed file.',
          content: '# Backend file',
          isReadonly: false,
        },
      ],
      memory: [
        {
          id: 'backend-memory',
          title: 'Backend Memory',
          type: 'fact',
          summary: 'Stale backend memory.',
          source: 'system',
          updatedAt: '2025-03-19T00:00:00.000Z',
          retention: 'rolling',
          tokens: 12,
        },
      ],
      tools: [
        {
          id: 'backend-tool',
          name: 'Backend Tool',
          description: 'Stale backend tool.',
          category: 'automation',
          status: 'ready',
          access: 'execute',
          command: 'tool:backend',
        },
      ],
    },
  };
}

function createLiveTask(taskId = 'job-ops-daily') {
  return {
    id: taskId,
    name: 'Ops Daily Brief',
    description: 'Morning operations summary',
    prompt: 'Summarize operations updates.',
    schedule: '0 9 * * *',
    scheduleMode: 'cron' as const,
    scheduleConfig: {
      cronExpression: '0 9 * * *',
    },
    cronExpression: '0 9 * * *',
    actionType: 'skill' as const,
    status: 'active' as const,
    executionContent: 'runAssistantTask' as const,
    deliveryMode: 'publishSummary' as const,
    deliveryChannel: 'slack',
    deliveryLabel: 'slack',
    recipient: 'channel:C001',
    lastRun: '2025-03-19T01:00:00.000Z',
    nextRun: '2025-03-20T01:00:00.000Z',
    latestExecution: {
      id: `${taskId}-latest`,
      taskId,
      status: 'success' as const,
      trigger: 'schedule' as const,
      startedAt: '2025-03-19T01:00:00.000Z',
      finishedAt: '2025-03-19T01:00:00.000Z',
      summary: 'Cron job completed successfully.',
      details: undefined,
    },
  };
}

await runTest('getInstanceWorkbench builds a remote OpenClaw snapshot from gateway-backed sections', async () => {
  const mockReads = {
    instance: 0,
    tasks: 0,
    files: 0,
  };
  const service = createInstanceWorkbenchService({
    studioApi: {
      getInstanceDetail: async () =>
        createOpenClawDetail('openclaw-prod', {
          workbench: null,
        }),
    },
    studioMockService: {
      getInstance: async () => {
        mockReads.instance += 1;
        return null;
      },
      listTasks: async () => {
        mockReads.tasks += 1;
        return [];
      },
      listInstanceFiles: async () => {
        mockReads.files += 1;
        return [];
      },
    },
    openClawGatewayClient: {
      listWorkbenchCronJobs: async () => [createLiveTask()],
      listWorkbenchCronRuns: async () => [],
      getConfig: async () => ({
        baseHash: 'hash-1',
        config: {
          meta: {
            lastTouchedAt: '2025-03-19T02:00:00.000Z',
          },
          memory: {
            backend: 'vector',
            citations: 'auto',
            qmd: {
              paths: [
                {
                  name: 'Runbooks',
                  path: '/memory/runbooks',
                  pattern: '**/*.md',
                },
              ],
            },
          },
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
                    name: 'GPT-5.4',
                    contextWindow: 200000,
                    reasoning: true,
                  },
                  {
                    id: 'text-embedding-3-large',
                    name: 'text-embedding-3-large',
                    contextWindow: 8192,
                    api: 'embeddings',
                  },
                ],
              },
            },
          },
          agents: {
            list: [
              {
                id: 'ops',
                name: 'Ops',
                default: true,
                identity: {
                  emoji: 'O',
                },
              },
            ],
          },
        },
      }),
      listModels: async () => [
        {
          provider: 'openai',
          id: 'gpt-5.4',
          label: 'GPT-5.4',
          contextWindow: 200000,
          reasoning: true,
          input: ['text', 'image'],
        },
        {
          provider: 'openai',
          id: 'text-embedding-3-large',
          label: 'text-embedding-3-large',
          contextWindow: 8192,
          api: 'embeddings',
        },
      ],
      getChannelStatus: async () => ({
        channelOrder: ['slack'],
        channelLabels: {
          slack: 'Slack',
        },
        channels: {
          slack: {
            enabled: true,
            configured: true,
            fields: {
              token: true,
              workspace: true,
            },
            accounts: {
              primary: {
                configured: true,
              },
            },
          },
        },
      }),
      getSkillsStatus: async () => ({
        agentId: 'ops',
        skills: [
          {
            id: 'diag-helper',
            name: 'Diagnostics Helper',
            description: 'Troubleshoot runtime incidents.',
            author: 'Managed OpenClaw',
            version: '1.0.0',
            size: '4 KB',
            updatedAt: '2025-03-19T03:00:00.000Z',
            readme: '# Diagnostics Helper',
          },
        ],
      }),
      getToolsCatalog: async () => ({
        agentId: 'ops',
        profiles: [
          {
            id: 'coding',
            label: 'Coding',
          },
        ],
        groups: [
          {
            id: 'group:filesystem',
            label: 'Filesystem',
            source: 'core',
            tools: [
              {
                id: 'read',
                label: 'read',
                description: 'Read files.',
              },
            ],
          },
          {
            id: 'group:automation',
            label: 'Automation',
            source: 'core',
            tools: [
              {
                id: 'cron',
                label: 'cron',
                description: 'Schedule work.',
              },
            ],
          },
        ],
      }),
      listAgents: async () => ({
        requester: 'main',
        agents: [
          {
            id: 'ops',
            name: 'Ops',
            description: 'Automation and incident response agent.',
            avatar: 'O',
            systemPrompt: 'Handle cron tasks and debug incidents.',
            creator: 'OpenClaw',
            workspace: '/workspace/ops',
          },
        ],
      }),
      listAgentFiles: async (_instanceId, args) => ({
        agentId: args.agentId,
        workspace: '/workspace/ops',
        files: [
          {
            name: 'AGENTS.md',
            path: '/workspace/ops/AGENTS.md',
            size: 128,
            updatedAtMs: 1742353200000,
          },
          {
            name: 'MEMORY.md',
            path: '/workspace/ops/MEMORY.md',
            size: 256,
            updatedAtMs: 1742356800000,
          },
        ],
      }),
      getAgentFile: async (_instanceId, args) => ({
        agentId: args.agentId,
        workspace: '/workspace/ops',
        file: {
          name: args.name,
          path: `/workspace/ops/${args.name}`,
          content:
            args.name === 'MEMORY.md'
              ? '# Ops Memory\nIncident note and rollback plan.'
              : '# Ops Agent\nYou handle incidents and automation.',
          size: args.name === 'MEMORY.md' ? 256 : 128,
          updatedAtMs: args.name === 'MEMORY.md' ? 1742356800000 : 1742353200000,
        },
      }),
    },
  });

  const workbench = await service.getInstanceWorkbench('openclaw-prod');

  assert.ok(workbench);
  assert.equal(mockReads.instance, 0);
  assert.equal(mockReads.tasks, 0);
  assert.equal(mockReads.files, 0);
  assert.equal(workbench?.channels.length, 1);
  assert.equal(workbench?.channels[0]?.name, 'Slack');
  assert.equal(workbench?.tasks.length, 1);
  assert.equal(workbench?.tasks[0]?.id, 'job-ops-daily');
  assert.equal(workbench?.llmProviders.length, 1);
  assert.equal(workbench?.llmProviders[0]?.defaultModelId, 'gpt-5.4');
  assert.equal(workbench?.llmProviders[0]?.embeddingModelId, 'text-embedding-3-large');
  assert.deepEqual(workbench?.llmProviders[0]?.capabilities, ['chat', 'embedding', 'reasoning', 'vision']);
  assert.equal(workbench?.agents.length, 1);
  assert.equal(workbench?.agents[0]?.agent.id, 'ops');
  assert.equal(workbench?.skills.length, 1);
  assert.equal(workbench?.files.length, 2);
  assert.ok(workbench?.files.some((file) => file.id.startsWith('openclaw-agent-file:ops:')));
  assert.ok(workbench?.files.every((file) => file.isReadonly === false));
  assert.equal(workbench?.memories.length, 3);
  assert.equal(workbench?.memories[0]?.title, 'Memory Backend');
  assert.equal(workbench?.tools.length, 2);
  assert.equal(workbench?.sectionCounts.files, 2);
  assert.equal(workbench?.sectionAvailability.files.status, 'ready');
});

await runTest('getInstanceWorkbench overlays live OpenClaw gateway sections on the built-in backend snapshot', async () => {
  const service = createInstanceWorkbenchService({
    studioApi: {
      getInstanceDetail: async () => createBuiltInOpenClawDetail(),
    },
    openClawGatewayClient: {
      listWorkbenchCronJobs: async () => [createLiveTask('live-task-1')],
      listWorkbenchCronRuns: async () => [],
      getConfig: async () => ({
        config: {
          models: {
            providers: {
              openai: {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '${OPENAI_API_KEY}',
                models: [
                  {
                    id: 'gpt-5.4',
                    name: 'GPT-5.4',
                    contextWindow: 200000,
                    reasoning: true,
                  },
                ],
              },
            },
          },
          agents: {
            list: [
              {
                id: 'ops',
                name: 'Ops',
                default: true,
              },
            ],
          },
        },
      }),
      listModels: async () => [
        {
          provider: 'openai',
          id: 'gpt-5.4',
          label: 'GPT-5.4',
          contextWindow: 200000,
          reasoning: true,
        },
      ],
      getChannelStatus: async () => ({
        channelOrder: ['slack'],
        channelLabels: {
          slack: 'Slack',
        },
        channels: {
          slack: {
            enabled: true,
            configured: true,
            fields: {
              token: true,
            },
          },
        },
      }),
      getSkillsStatus: async () => ({
        skills: [
          {
            id: 'diag-helper',
            name: 'Diagnostics Helper',
            description: 'Troubleshoot runtime incidents.',
          },
        ],
      }),
      getToolsCatalog: async () => ({
        profiles: [],
        groups: [
          {
            id: 'group:automation',
            label: 'Automation',
            source: 'core',
            tools: [
              {
                id: 'cron',
                label: 'cron',
                description: 'Schedule work.',
              },
            ],
          },
        ],
      }),
      listAgents: async () => ({
        agents: [
          {
            id: 'ops',
            name: 'Ops',
            description: 'Automation and incident response agent.',
            avatar: 'O',
            systemPrompt: 'Handle cron tasks and debug incidents.',
            creator: 'OpenClaw',
            workspace: '/workspace/ops',
          },
        ],
      }),
      listAgentFiles: async () => ({
        files: [],
      }),
      getAgentFile: async () => ({
        file: undefined,
      }),
    },
  });

  const workbench = await service.getInstanceWorkbench('local-built-in');

  assert.ok(workbench);
  assert.equal(workbench?.channels[0]?.id, 'slack');
  assert.equal(workbench?.tasks[0]?.id, 'live-task-1');
  assert.equal(workbench?.llmProviders[0]?.id, 'openai');
  assert.equal(workbench?.agents[0]?.agent.id, 'ops');
  assert.equal(workbench?.skills[0]?.id, 'diag-helper');
  assert.equal(workbench?.tools[0]?.id, 'cron');
  assert.equal(workbench?.files[0]?.id, '/workspace/main/AGENTS.md');
  assert.equal(workbench?.memories[0]?.id, 'backend-memory');
});

await runTest('listTaskExecutions stays scoped to the most recently loaded OpenClaw instance when task ids overlap', async () => {
  const taskExecutionReads: Array<[string, string]> = [];
  const detailById: Record<string, StudioInstanceDetailRecord> = {
    alpha: createOpenClawDetail('alpha', { workbench: null }),
    beta: createOpenClawDetail('beta', { workbench: null }),
  };
  const service = createInstanceWorkbenchService({
    studioApi: {
      getInstanceDetail: async (instanceId) => detailById[instanceId] || null,
    },
    openClawGatewayClient: {
      listWorkbenchCronJobs: async (instanceId) => [createLiveTask(`shared-task`)].map((task) => ({
        ...task,
        name: `${instanceId} task`,
      })),
      listWorkbenchCronRuns: async (instanceId, taskId) => {
        taskExecutionReads.push([instanceId, taskId]);
        return [];
      },
      getConfig: async () => ({
        config: {
          models: {
            providers: {},
          },
        },
      }),
      listModels: async () => [],
      getChannelStatus: async () => ({
        channels: {},
      }),
      getSkillsStatus: async () => ({
        skills: [],
      }),
      getToolsCatalog: async () => ({
        profiles: [],
        groups: [],
      }),
      listAgents: async () => ({
        agents: [],
      }),
      listAgentFiles: async () => ({
        files: [],
      }),
      getAgentFile: async () => ({
        file: undefined,
      }),
    },
  });

  await service.getInstanceWorkbench('alpha');
  await service.getInstanceWorkbench('beta');
  await service.listTaskExecutions('shared-task');
  await service.getInstanceWorkbench('alpha');
  await service.listTaskExecutions('shared-task');

  assert.deepEqual(taskExecutionReads, [
    ['beta', 'shared-task'],
    ['alpha', 'shared-task'],
  ]);
});
