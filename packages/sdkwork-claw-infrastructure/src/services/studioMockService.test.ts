import assert from 'node:assert/strict';
import { createStudioMockService } from './studioMockService.ts';

function createTaskPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Nightly Backup',
    description: 'Protect the workspace every night.',
    prompt: 'Create a backup summary and verify the archive.',
    schedule: '0 3 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 3 * * *',
    },
    cronExpression: '0 3 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 90,
    deliveryMode: 'publishSummary',
    deliveryChannel: 'qq',
    recipient: 'ops-room',
    ...overrides,
  };
}

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('installing a skill makes it visible from installed skill queries', async () => {
  const service = createStudioMockService();

  await service.installSkill('local-built-in', 'skill-prompt-lab');

  const installedSkills = await service.listInstalledSkills('local-built-in');
  assert.equal(installedSkills.some((skill) => skill.id === 'skill-prompt-lab'), true);
});

await runTest('instance status and config mutations persist across reads', async () => {
  const service = createStudioMockService();

  await service.setInstanceStatus('local-built-in', 'starting');
  await service.updateInstanceConfig('local-built-in', {
    port: '19001',
    sandbox: false,
    autoUpdate: true,
    logLevel: 'debug',
    corsOrigins: 'http://localhost:4173',
  });

  const instance = await service.getInstance('local-built-in');
  const config = await service.getInstanceConfig('local-built-in');

  assert.equal(instance?.status, 'starting');
  assert.deepEqual(config, {
    port: '19001',
    sandbox: false,
    autoUpdate: true,
    logLevel: 'debug',
    corsOrigins: 'http://localhost:4173',
  });
});

await runTest('tasks can be created and status updates round-trip', async () => {
  const service = createStudioMockService();

  const created = await service.createTask('local-built-in', createTaskPayload());

  await service.updateTaskStatus(created.id, 'paused');

  const tasks = await service.listTasks('local-built-in');
  assert.equal(tasks.some((task) => task.id === created.id && task.status === 'paused'), true);
});

await runTest('tasks can be updated, cloned, run immediately, and queried for execution history', async () => {
  const service = createStudioMockService();

  const created = await service.createTask('local-built-in', createTaskPayload());
  const updated = await service.updateTask(created.id, {
    name: 'Nightly Backup v2',
    prompt: 'Create a backup summary, verify the archive, and notify operators.',
    timeoutSeconds: 120,
  });

  assert.equal(updated?.name, 'Nightly Backup v2');
  assert.equal(updated?.timeoutSeconds, 120);

  const cloned = await service.cloneTask(created.id, {
    name: 'Nightly Backup Copy',
  });

  assert.ok(cloned);
  assert.equal(cloned?.name, 'Nightly Backup Copy');
  assert.equal(cloned?.status, 'paused');

  const run = await service.runTaskNow(created.id);
  assert.equal(run?.taskId, created.id);
  assert.equal(run?.trigger, 'manual');
  assert.equal(run?.status, 'success');

  const history = await service.listTaskExecutions(created.id);
  assert.equal(history.length > 0, true);
  assert.equal(history[0]?.taskId, created.id);
});

await runTest('instance file edits persist and can be reloaded from the runtime file store', async () => {
  const service = createStudioMockService();

  const before = await service.listInstanceFiles('local-built-in');
  const target = before.find((file) => file.id === 'file-local-config');

  assert.ok(target);

  await service.updateInstanceFileContent('local-built-in', 'file-local-config', '{\n  "port": 19002\n}');

  const after = await service.listInstanceFiles('local-built-in');
  const reloaded = after.find((file) => file.id === 'file-local-config');

  assert.equal(reloaded?.content, '{\n  "port": 19002\n}');
  assert.equal(reloaded?.status, 'modified');
});

await runTest('instance llm provider config updates persist and can be reloaded', async () => {
  const service = createStudioMockService();

  const before = await service.listInstanceLlmProviders('local-built-in');
  const target = before.find((provider) => provider.id === 'provider-openai-primary');

  assert.ok(target);

  await service.updateInstanceLlmProviderConfig('local-built-in', 'provider-openai-primary', {
    endpoint: 'https://api.openai.com/v1/enterprise',
    apiKeySource: 'OPENAI_ENTERPRISE_KEY',
    defaultModelId: 'gpt-4.1',
    reasoningModelId: 'o4-mini',
    config: {
      temperature: 0.3,
      topP: 0.92,
      maxTokens: 4096,
      timeoutMs: 90000,
      streaming: false,
    },
  });

  const after = await service.listInstanceLlmProviders('local-built-in');
  const reloaded = after.find((provider) => provider.id === 'provider-openai-primary');

  assert.equal(reloaded?.endpoint, 'https://api.openai.com/v1/enterprise');
  assert.equal(reloaded?.apiKeySource, 'OPENAI_ENTERPRISE_KEY');
  assert.equal(reloaded?.defaultModelId, 'gpt-4.1');
  assert.equal(reloaded?.reasoningModelId, 'o4-mini');
  assert.deepEqual(reloaded?.config, {
    temperature: 0.3,
    topP: 0.92,
    maxTokens: 4096,
    timeoutMs: 90000,
    streaming: false,
  });
});

await runTest('preference updates merge nested sections without dropping existing values', async () => {
  const service = createStudioMockService();

  const updated = await service.updatePreferences({
    notifications: {
      taskFailures: false,
    },
  });

  assert.equal(updated.notifications.taskFailures, false);
  assert.equal(updated.notifications.systemUpdates, true);
  assert.equal(updated.general.launchOnStartup, true);
});

await runTest('api router channels and proxy providers are exposed through the mock service', async () => {
  const service = createStudioMockService();

  const channels = await service.listApiRouterChannels();
  const providers = await service.listProxyProviders('openai');

  assert.equal(channels.some((channel) => channel.id === 'openai'), true);
  assert.equal(providers.some((provider) => provider.channelId === 'openai'), true);
});

await runTest('api router provider group, status, and delete mutations round-trip through the mock service', async () => {
  const service = createStudioMockService();

  const before = await service.listProxyProviders('openai');
  const target = before[0];

  assert.ok(target);

  const updatedGroup = await service.updateProxyProviderGroup(target.id, 'shared-core');
  assert.equal(updatedGroup?.groupId, 'shared-core');

  const disabled = await service.updateProxyProviderStatus(target.id, 'disabled');
  assert.equal(disabled?.status, 'disabled');

  const deleted = await service.deleteProxyProvider(target.id);
  assert.equal(deleted, true);

  const after = await service.listProxyProviders('openai');
  assert.equal(after.some((provider) => provider.id === target.id), false);
});

await runTest('api router providers can be created with sensible defaults and queried back', async () => {
  const service = createStudioMockService();
  const before = await service.listProxyProviders('anthropic');

  const created = await service.createProxyProvider({
    channelId: 'anthropic',
    name: 'Claude Sandbox',
    apiKey: 'claude-sandbox-123456',
    groupId: 'sandbox-lab',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-4-sonnet',
        name: 'Claude 4 Sonnet',
      },
    ],
    expiresAt: '2026-09-30T23:59:59.000Z',
    notes: 'Created from test coverage.',
  });

  assert.equal(created.channelId, 'anthropic');
  assert.equal(created.groupId, 'sandbox-lab');
  assert.equal(created.status, 'active');
  assert.deepEqual(created.models, [
    {
      id: 'claude-4-sonnet',
      name: 'Claude 4 Sonnet',
    },
  ]);
  assert.deepEqual(created.usage, {
    requestCount: 0,
    tokenCount: 0,
    spendUsd: 0,
    period: '30d',
  });
  assert.equal(Boolean(created.createdAt), true);

  const after = await service.listProxyProviders('anthropic');
  assert.equal(after.some((provider) => provider.id === created.id), true);
  assert.equal(after.length, before.length + 1);
});

await runTest('api router exposes a market-complete channel catalog with seeded providers for major US and China model vendors', async () => {
  const service = createStudioMockService();

  const channels = await service.listApiRouterChannels();
  const providers = await service.listProxyProviders();
  const channelIds = new Set(channels.map((channel) => channel.id));
  const seededChannelIds = new Set(providers.map((provider) => provider.channelId));
  const requiredChannelIds = [
    'openai',
    'anthropic',
    'google',
    'xai',
    'meta',
    'mistral',
    'cohere',
    'amazon-nova',
    'microsoft',
    'nvidia',
    'deepseek',
    'qwen',
    'zhipu',
    'baidu',
    'tencent-hunyuan',
    'doubao',
    'moonshot',
    'minimax',
    'stepfun',
    'sensenova',
    'baichuan',
    'yi',
    'iflytek-spark',
    'huawei-pangu',
  ];

  assert.equal(channels.length >= requiredChannelIds.length, true);
  assert.equal(providers.length >= requiredChannelIds.length, true);

  for (const channelId of requiredChannelIds) {
    assert.equal(channelIds.has(channelId), true, `Expected channel catalog to include ${channelId}`);
    assert.equal(
      seededChannelIds.has(channelId),
      true,
      `Expected seeded proxy providers for ${channelId}`,
    );
  }
});

await runTest('instance llm providers can be upserted for API Router driven OpenClaw setup', async () => {
  const service = createStudioMockService();

  const created = await service.upsertInstanceLlmProvider('home-nas', {
    id: 'provider-api-router-moonshot',
    name: 'Kimi Router',
    provider: 'api-router',
    endpoint: 'https://api.moonshot.cn/v1',
    apiKeySource: 'moonshot-router-live-123',
    status: 'ready',
    defaultModelId: 'kimi-k2-0905-preview',
    reasoningModelId: 'kimi-thinking',
    description: 'Injected from API Router one-click setup.',
    icon: 'KI',
    lastCheckedAt: 'just now',
    capabilities: ['API Router', 'Long Context'],
    models: [
      { id: 'kimi-k2-0905-preview', name: 'Kimi K2 Preview', role: 'primary', contextWindow: '128K' },
      { id: 'kimi-thinking', name: 'Kimi Thinking', role: 'reasoning', contextWindow: '128K' },
    ],
    config: {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    },
  });

  assert.equal(created.instanceId, 'home-nas');
  assert.equal(created.provider, 'api-router');
  assert.equal(created.defaultModelId, 'kimi-k2-0905-preview');

  const reloaded = await service.listInstanceLlmProviders('home-nas');
  assert.equal(reloaded.some((provider) => provider.id === 'provider-api-router-moonshot'), true);
});

await runTest('api router model mappings can be listed, created, updated, and deleted through the mock service', async () => {
  const service = createStudioMockService();
  const before = await service.listModelMappings();

  assert.equal(before.length > 0, true);

  const created = await service.createModelMapping({
    name: 'Cross Vendor Assistant Mapping',
    description: 'Map OpenAI and Claude source models into approved fallback targets.',
    effectiveFrom: '2026-03-20T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.000Z',
    rules: [
      {
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: {
          channelId: 'google',
          channelName: 'Google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
      },
    ],
  });

  assert.equal(created.name, 'Cross Vendor Assistant Mapping');
  assert.equal(created.status, 'active');
  assert.equal(created.rules.length, 1);

  const updated = await service.updateModelMapping(created.id, {
    description: 'Updated mapping description',
    rules: [
      {
        id: created.rules[0]?.id,
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1-mini',
          modelName: 'GPT-4.1 Mini',
        },
        target: {
          channelId: 'anthropic',
          channelName: 'Anthropic',
          modelId: 'claude-sonnet-4',
          modelName: 'Claude Sonnet 4',
        },
      },
    ],
  });

  assert.equal(updated?.description, 'Updated mapping description');
  assert.equal(updated?.rules[0]?.source.modelId, 'gpt-4.1-mini');
  assert.equal(updated?.rules[0]?.target.modelId, 'claude-sonnet-4');

  const disabled = await service.updateModelMappingStatus(created.id, 'disabled');
  assert.equal(disabled?.status, 'disabled');

  const afterCreate = await service.listModelMappings();
  assert.equal(afterCreate.some((item) => item.id === created.id), true);
  assert.equal(afterCreate.length, before.length + 1);

  const deleted = await service.deleteModelMapping(created.id);
  assert.equal(deleted, true);

  const afterDelete = await service.listModelMappings();
  assert.equal(afterDelete.some((item) => item.id === created.id), false);
});

await runTest('api router model mapping catalog and unified API key association round-trip through the mock service', async () => {
  const service = createStudioMockService();

  const catalog = await service.listModelMappingCatalog();
  const openaiCatalog = catalog.find((channel) => channel.channelId === 'openai');
  const googleCatalog = catalog.find((channel) => channel.channelId === 'google');

  assert.ok(openaiCatalog);
  assert.ok(googleCatalog);
  assert.equal(openaiCatalog.models.some((model) => model.modelId === 'gpt-4.1'), true);
  assert.equal(googleCatalog.models.some((model) => model.modelId === 'gemini-2.5-pro'), true);

  const mappings = await service.listModelMappings();
  const keys = await service.listUnifiedApiKeys();
  const mapping = mappings[0];
  const key = keys[0];

  assert.ok(mapping);
  assert.ok(key);

  const associated = await service.assignUnifiedApiKeyModelMapping(key.id, mapping.id);
  assert.equal(associated?.modelMappingId, mapping.id);

  const cleared = await service.assignUnifiedApiKeyModelMapping(key.id, null);
  assert.equal(cleared?.modelMappingId ?? null, null);
});

await runTest('api router usage records expose filter options and aggregate summary metrics', async () => {
  const service = createStudioMockService();

  const apiKeys = await service.listApiRouterUsageRecordApiKeys();
  const summary = await service.getApiRouterUsageRecordSummary({
    apiKeyId: 'all',
    timeRange: '7d',
  });

  assert.equal(apiKeys.length > 0, true);
  assert.equal(apiKeys[0]?.id, 'all');
  assert.equal(summary.totalRequests > 0, true);
  assert.equal(summary.totalTokens, summary.promptTokens + summary.completionTokens + summary.cachedTokens);
  assert.equal(summary.totalSpendUsd > 0, true);
  assert.equal(summary.averageDurationMs > 0, true);
});

await runTest('api router usage records support api key filtering, sorting, and pagination', async () => {
  const service = createStudioMockService();

  const result = await service.listApiRouterUsageRecords({
    apiKeyId: 'team-web-dev',
    timeRange: '30d',
    sortBy: 'model',
    sortOrder: 'asc',
    page: 1,
    pageSize: 3,
  });

  assert.equal(result.items.length > 0, true);
  assert.equal(result.items.length <= 3, true);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 3);
  assert.equal(result.total >= result.items.length, true);

  for (const item of result.items) {
    assert.equal(item.apiKeyId, 'team-web-dev');
  }

  const models = result.items.map((item) => item.model);
  const sortedModels = [...models].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(models, sortedModels);
});

await runTest('api router usage records respect custom date ranges and time sorting', async () => {
  const service = createStudioMockService();

  const result = await service.listApiRouterUsageRecords({
    apiKeyId: 'all',
    timeRange: 'custom',
    startDate: '2026-03-14',
    endDate: '2026-03-18',
    sortBy: 'time',
    sortOrder: 'desc',
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.items.length > 0, true);

  for (const item of result.items) {
    const time = item.startedAt.slice(0, 10);
    assert.equal(time >= '2026-03-14', true);
    assert.equal(time <= '2026-03-18', true);
  }

  const timestamps = result.items.map((item) => new Date(item.startedAt).getTime());
  const sortedTimestamps = [...timestamps].sort((left, right) => right - left);
  assert.deepEqual(timestamps, sortedTimestamps);
});

await runTest('api router usage records span multiple pages for the default 30 day view', async () => {
  const service = createStudioMockService();

  const result = await service.listApiRouterUsageRecords({
    apiKeyId: 'all',
    timeRange: '30d',
    sortBy: 'time',
    sortOrder: 'desc',
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.total > 20, true);
  assert.equal(result.hasMore, true);
});
