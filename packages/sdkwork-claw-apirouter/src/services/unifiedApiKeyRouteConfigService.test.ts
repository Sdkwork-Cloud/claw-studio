import assert from 'node:assert/strict';
import type {
  ApiRouterChannel,
  ProxyProvider,
  ProxyProviderGroup,
  UnifiedApiKey,
} from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createChannels(): ApiRouterChannel[] {
  return [
    {
      id: 'openai',
      name: 'OpenAI',
      vendor: 'OpenAI',
      description: 'OpenAI routes',
      modelFamily: 'GPT',
      providerCount: 1,
      activeProviderCount: 1,
      warningProviderCount: 0,
      disabledProviderCount: 0,
    },
    {
      id: 'google',
      name: 'Google',
      vendor: 'Google',
      description: 'Gemini routes',
      modelFamily: 'Gemini',
      providerCount: 1,
      activeProviderCount: 1,
      warningProviderCount: 0,
      disabledProviderCount: 0,
    },
  ];
}

function createGroups(): ProxyProviderGroup[] {
  return [
    {
      id: 'group-ops',
      name: 'Ops',
      description: 'Ops traffic',
    },
    {
      id: 'group-rnd',
      name: 'R&D',
      description: 'Research traffic',
    },
  ];
}

function createProviders(): ProxyProvider[] {
  return [
    {
      id: 'provider-openai-primary',
      channelId: 'openai',
      name: 'OpenAI Primary',
      apiKey: '',
      groupId: 'group-ops',
      usage: {
        requestCount: 0,
        tokenCount: 0,
        spendUsd: 0,
        period: '30d',
      },
      expiresAt: null,
      status: 'active',
      createdAt: '2026-03-24T09:00:00.000Z',
      baseUrl: 'https://router.openai.example.com/v1',
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
      ],
    },
    {
      id: 'provider-google-fallback',
      channelId: 'google',
      name: 'Google Fallback',
      apiKey: '',
      groupId: 'group-rnd',
      usage: {
        requestCount: 0,
        tokenCount: 0,
        spendUsd: 0,
        period: '30d',
      },
      expiresAt: null,
      status: 'warning',
      createdAt: '2026-03-24T10:00:00.000Z',
      baseUrl: 'https://router.google.example.com/v1',
      models: [
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
        },
      ],
    },
  ];
}

await runTest('unifiedApiKeyRouteConfigService builds searchable route-config options from providers, channels, and groups', async () => {
  const { buildUnifiedApiKeyRouteConfigOptions } = await import(
    './unifiedApiKeyRouteConfigService.ts'
  );

  const items = buildUnifiedApiKeyRouteConfigOptions({
    providers: createProviders(),
    channels: createChannels(),
    groups: createGroups(),
    keyword: 'gemini',
  });

  assert.deepEqual(items, [
    {
      providerId: 'provider-google-fallback',
      providerName: 'Google Fallback',
      channelId: 'google',
      channelName: 'Google',
      groupId: 'group-rnd',
      groupName: 'R&D',
      status: 'warning',
      modelNames: ['Gemini 2.5 Pro'],
    },
  ]);
});

await runTest('unifiedApiKeyRouteConfigService resolves route summaries with remote-default fallback', async () => {
  const { resolveUnifiedApiKeyRouteConfigMeta } = await import(
    './unifiedApiKeyRouteConfigService.ts'
  );

  const providers = createProviders();
  const remoteKey: UnifiedApiKey = {
    id: 'key-remote',
    name: 'Remote Key',
    apiKey: '',
    source: 'system-generated',
    groupId: 'group-ops',
    usage: {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: '30d',
    },
    expiresAt: null,
    status: 'active',
    createdAt: '2026-03-24T11:00:00.000Z',
  };
  const customKey: UnifiedApiKey = {
    ...remoteKey,
    id: 'key-custom',
    routeMode: 'custom',
    routeProviderId: 'provider-openai-primary',
  };

  assert.deepEqual(resolveUnifiedApiKeyRouteConfigMeta(remoteKey, providers), {
    routeMode: 'sdkwork-remote',
    routeProvider: null,
    baseUrl: 'https://ai.sdkwork.com/v1',
  });
  assert.deepEqual(resolveUnifiedApiKeyRouteConfigMeta(customKey, providers), {
    routeMode: 'custom',
    routeProvider: providers[0],
    baseUrl: 'https://router.openai.example.com/v1',
  });
});
