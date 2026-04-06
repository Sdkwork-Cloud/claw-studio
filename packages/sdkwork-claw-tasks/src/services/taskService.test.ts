import assert from 'node:assert/strict';
import {
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
  type StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';
import { createTaskService } from './taskService.ts';

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

function createOpenClawDetail(): StudioInstanceDetailRecord {
  return {
    instance: {
      id: 'openclaw-prod',
      name: 'OpenClaw Prod',
      description: 'Primary OpenClaw gateway.',
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      typeLabel: 'OpenClaw Gateway',
      host: '10.0.0.8',
      port: 18789,
      baseUrl: 'http://10.0.0.8:18789',
      websocketUrl: 'ws://10.0.0.8:18789',
      cpu: 12,
      memory: 35,
      totalMemory: '64GB',
      uptime: '18h',
      capabilities: ['chat', 'health', 'tasks'],
      storage: {
        provider: 'localFile',
        namespace: 'openclaw-prod',
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
      namespace: 'openclaw-prod',
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
    ],
    officialRuntimeNotes: [],
  };
}

function createMockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mock-task-1',
    name: 'Mock Task',
    description: 'Fallback task',
    prompt: 'Fallback prompt',
    schedule: '@every 1h',
    scheduleMode: 'interval',
    scheduleConfig: {
      intervalValue: 1,
      intervalUnit: 'hour',
    },
    cronExpression: '0 * * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 60,
    deliveryMode: 'publishSummary',
    deliveryChannel: 'qq',
    recipient: 'ops-room',
    ...overrides,
  };
}

function createOpenClawJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-ops-daily',
    name: 'Ops Daily Brief',
    description: 'Morning operations summary',
    enabled: true,
    createdAtMs: 100,
    updatedAtMs: 200,
    schedule: {
      kind: 'cron',
      expr: '0 9 * * *',
      tz: 'Asia/Shanghai',
    },
    sessionTarget: 'isolated',
    wakeMode: 'next-heartbeat',
    payload: {
      kind: 'agentTurn',
      message: 'Summarize operations updates.',
      timeoutSeconds: 120,
    },
    delivery: {
      mode: 'announce',
      channel: 'slack',
      to: 'channel:C001',
    },
    state: {
      nextRunAtMs: 1742432400000,
      lastRunAtMs: 1742346000000,
      lastRunStatus: 'ok',
    },
    ...overrides,
  };
}

await runTest('getTasks prefers OpenClaw HTTP reads for OpenClaw instances', async () => {
  let mockReads = 0;
  let gatewayReads = 0;
  const service = createTaskService({
    getInstanceDetail: async () => createOpenClawDetail(),
    studioMockService: {
      listTasks: async () => {
        mockReads += 1;
        return [];
      },
    },
    openClawGatewayClient: {
      listCronJobs: async () => {
        gatewayReads += 1;
        return [createOpenClawJob()];
      },
    },
  });

  const tasks = await service.getTasks('openclaw-prod');

  assert.equal(gatewayReads, 1);
  assert.equal(mockReads, 0);
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0], {
    id: 'job-ops-daily',
    name: 'Ops Daily Brief',
    description: 'Morning operations summary',
    prompt: 'Summarize operations updates.',
    schedule: '0 9 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 9 * * *',
    },
    cronExpression: '0 9 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'nextCycle',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 120,
    deliveryMode: 'publishSummary',
    deliveryChannel: 'slack',
    recipient: 'channel:C001',
    lastRun: '2025-03-19T01:00:00.000Z',
    nextRun: '2025-03-20T01:00:00.000Z',
  });
});

await runTest('getTasks falls back to mock data when OpenClaw direct access fails', async () => {
  let mockReads = 0;
  const service = createTaskService({
    getInstanceDetail: async () => createOpenClawDetail(),
    studioMockService: {
      listTasks: async () => {
        mockReads += 1;
        return [createMockTask()];
      },
    },
    openClawGatewayClient: {
      listCronJobs: async () => {
        throw new Error('Gateway unavailable');
      },
    },
  });

  const tasks = await service.getTasks('openclaw-prod');

  assert.equal(mockReads, 1);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.id, 'mock-task-1');
});

await runTest('listTaskExecutions reads OpenClaw cron history for remembered OpenClaw tasks', async () => {
  let gatewayHistoryReads = 0;
  const service = createTaskService({
    getInstanceDetail: async () => createOpenClawDetail(),
    studioMockService: {
      listTasks: async () => [createMockTask()],
      listTaskExecutions: async () => [],
    },
    openClawGatewayClient: {
      listCronJobs: async () => [createOpenClawJob()],
      listCronRuns: async () => {
        gatewayHistoryReads += 1;
        return [
          {
            ts: 1742346060000,
            jobId: 'job-ops-daily',
            action: 'finished',
            status: 'ok',
            summary: 'Run finished successfully.',
            runAtMs: 1742346000000,
            durationMs: 60000,
          },
        ];
      },
    },
  });

  await service.getTasks('openclaw-prod');
  const executions = await service.listTaskExecutions('job-ops-daily');

  assert.equal(gatewayHistoryReads, 1);
  assert.deepEqual(executions, [
    {
      id: 'job-ops-daily-1742346060000',
      taskId: 'job-ops-daily',
      status: 'success',
      trigger: 'schedule',
      startedAt: '2025-03-19T01:00:00.000Z',
      finishedAt: '2025-03-19T01:01:00.000Z',
      summary: 'Run finished successfully.',
      details: undefined,
    },
  ]);
});

await runTest('updateTaskStatus patches OpenClaw tasks through the HTTP client', async () => {
  const updates: unknown[] = [];
  const service = createTaskService({
    getInstanceDetail: async () => createOpenClawDetail(),
    studioMockService: {
      listTasks: async () => [],
      updateTaskStatus: async () => false,
    },
    openClawGatewayClient: {
      listCronJobs: async () => [createOpenClawJob()],
      updateCronJob: async (_instanceId: string, taskId: string, patch: unknown) => {
        updates.push([taskId, patch]);
        return createOpenClawJob();
      },
    },
  });

  await service.getTasks('openclaw-prod');
  await service.updateTaskStatus('job-ops-daily', 'paused');

  assert.deepEqual(updates, [['job-ops-daily', { enabled: false }]]);
});

await runTest('createTask uses the OpenClaw HTTP client for OpenClaw instances', async () => {
  const creates: unknown[] = [];
  const service = createTaskService({
    getInstanceDetail: async () => createOpenClawDetail(),
    studioMockService: {
      createTask: async () => createMockTask(),
    },
    openClawGatewayClient: {
      addCronJob: async (_instanceId: string, job: unknown) => {
        creates.push(job);
        return createOpenClawJob();
      },
    },
  });

  const created = await service.createTask('openclaw-prod', createMockTask());

  assert.equal(creates.length, 1);
  assert.equal(created.id, 'job-ops-daily');
  assert.equal(created.name, 'Ops Daily Brief');
});

await runTest('instance switching keeps OpenClaw task updates scoped to the selected instance even when task ids overlap', async () => {
  const updates: Array<[string, string, unknown]> = [];
  const detailById: Record<string, StudioInstanceDetailRecord> = {
    alpha: {
      ...createOpenClawDetail(),
      instance: {
        ...createOpenClawDetail().instance,
        id: 'alpha',
        name: 'OpenClaw Alpha',
        storage: {
          provider: 'localFile',
          namespace: 'alpha',
        },
      },
      storage: {
        ...createOpenClawDetail().storage,
        namespace: 'alpha',
      },
    },
    beta: {
      ...createOpenClawDetail(),
      instance: {
        ...createOpenClawDetail().instance,
        id: 'beta',
        name: 'OpenClaw Beta',
        storage: {
          provider: 'localFile',
          namespace: 'beta',
        },
      },
      storage: {
        ...createOpenClawDetail().storage,
        namespace: 'beta',
      },
    },
  };
  const service = createTaskService({
    getInstanceDetail: async (instanceId) => detailById[instanceId] || null,
    openClawGatewayClient: {
      listCronJobs: async (instanceId) => [
        createOpenClawJob({
          id: 'shared-task',
          name: `${instanceId} task`,
        }),
      ],
      updateCronJob: async (instanceId, jobId, patch) => {
        updates.push([instanceId, jobId, patch]);
        return createOpenClawJob({
          id: jobId,
          name: `${instanceId} task`,
          enabled: patch.enabled !== false,
        });
      },
    },
  });

  await service.getTasks('alpha');
  await service.getTasks('beta');
  await service.updateTaskStatus('shared-task', 'paused');
  await service.getTasks('alpha');
  await service.updateTaskStatus('shared-task', 'active');

  assert.deepEqual(updates, [
    ['beta', 'shared-task', { enabled: false }],
    ['alpha', 'shared-task', { enabled: true }],
  ]);
});
