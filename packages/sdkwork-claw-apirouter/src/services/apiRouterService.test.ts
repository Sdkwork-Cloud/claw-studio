import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('apiRouterService exposes the channel and proxy provider service surface', async () => {
  let module: typeof import('./apiRouterService.ts');

  try {
    module = await import('./apiRouterService.ts');
  } catch (error) {
    assert.fail(`apiRouterService module is missing: ${String(error)}`);
  }

  assert.equal(typeof module.apiRouterService.getChannels, 'function');
  assert.equal(typeof module.apiRouterService.getGroups, 'function');
  assert.equal(typeof module.apiRouterService.getProxyProviders, 'function');
  assert.equal(typeof module.apiRouterService.createProvider, 'function');
  assert.equal(typeof module.apiRouterService.updateGroup, 'function');
  assert.equal(typeof module.apiRouterService.updateStatus, 'function');
  assert.equal(typeof module.apiRouterService.updateProvider, 'function');
  assert.equal(typeof module.apiRouterService.deleteProvider, 'function');
  assert.equal(typeof module.apiRouterService.getUsageRecordApiKeys, 'function');
  assert.equal(typeof module.apiRouterService.getUsageRecordSummary, 'function');
  assert.equal(typeof module.apiRouterService.getUsageRecords, 'function');
});

await runTest('apiRouterService can list and mutate proxy providers', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');

  const channels = await apiRouterService.getChannels();
  const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });

  assert.equal(channels.some((channel) => channel.id === 'openai'), true);
  assert.equal(providers.some((provider) => provider.channelId === 'openai'), true);

  const target = providers[0];
  assert.ok(target);

  const changedGroup = await apiRouterService.updateGroup(target.id, 'team-ops');
  assert.equal(changedGroup.groupId, 'team-ops');

  const changedStatus = await apiRouterService.updateStatus(target.id, 'disabled');
  assert.equal(changedStatus.status, 'disabled');
});

await runTest('apiRouterService can create and remove proxy providers for the selected channel', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const before = await apiRouterService.getProxyProviders({ channelId: 'openai' });

  const created = await apiRouterService.createProvider({
    channelId: 'openai',
    name: 'OpenAI Burst Key',
    apiKey: 'sk-openai-burst-1234567890',
    groupId: 'sandbox-lab',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
      },
    ],
    expiresAt: '2026-08-01T23:59:59.000Z',
    notes: 'Created by API Router create flow test.',
  });

  assert.equal(created.channelId, 'openai');
  assert.equal(created.name, 'OpenAI Burst Key');
  assert.equal(created.groupId, 'sandbox-lab');
  assert.deepEqual(created.models, [
    {
      id: 'gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
    },
  ]);
  assert.equal(created.status, 'active');

  const afterCreate = await apiRouterService.getProxyProviders({ channelId: 'openai' });
  assert.equal(afterCreate.some((provider) => provider.id === created.id), true);
  assert.equal(afterCreate.length, before.length + 1);

  const deleted = await apiRouterService.deleteProvider(created.id);
  assert.equal(deleted, true);

  const afterDelete = await apiRouterService.getProxyProviders({ channelId: 'openai' });
  assert.equal(afterDelete.some((provider) => provider.id === created.id), false);
});

await runTest('apiRouterService exposes a broad channel catalog across major US and China model vendors', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const channels = await apiRouterService.getChannels();
  const channelIds = new Set(channels.map((channel) => channel.id));
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

  for (const channelId of requiredChannelIds) {
    assert.equal(channelIds.has(channelId), true, `Expected channel catalog to include ${channelId}`);
  }
});

await runTest('apiRouterService can return usage record filter options and aggregated summary data', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');

  const apiKeys = await apiRouterService.getUsageRecordApiKeys();
  const summary = await apiRouterService.getUsageRecordSummary({
    apiKeyId: 'all',
    timeRange: '7d',
  });

  assert.equal(apiKeys.length > 0, true);
  assert.equal(apiKeys.some((item) => item.id !== 'all'), true);
  assert.equal(summary.totalRequests > 0, true);
  assert.equal(summary.totalTokens > 0, true);
  assert.equal(summary.promptTokens > 0, true);
  assert.equal(summary.completionTokens > 0, true);
  assert.equal(summary.totalSpendUsd > 0, true);
  assert.equal(summary.averageDurationMs > 0, true);
});

await runTest('apiRouterService can filter, sort, and paginate usage records', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');

  const result = await apiRouterService.getUsageRecords({
    apiKeyId: 'team-web-dev',
    timeRange: '30d',
    sortBy: 'time',
    sortOrder: 'asc',
    page: 1,
    pageSize: 5,
  });

  assert.equal(result.items.length > 0, true);
  assert.equal(result.items.length <= 5, true);
  assert.equal(result.total >= result.items.length, true);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 5);

  for (const item of result.items) {
    assert.equal(item.apiKeyId, 'team-web-dev');
  }

  const timestamps = result.items.map((item) => new Date(item.startedAt).getTime());
  const sortedTimestamps = [...timestamps].sort((left, right) => left - right);
  assert.deepEqual(timestamps, sortedTimestamps);
});
