import assert from 'node:assert/strict';
import { createInstallBootstrapService } from './installBootstrapService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createBootstrapProvider(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'provider-config-openai-primary',
    channelId: 'openai',
    name: 'OpenAI Primary',
    apiKey: '',
    groupId: 'provider-config-center',
    usage: {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: '30d',
    },
    expiresAt: null,
    status: 'active',
    createdAt: null,
    baseUrl: 'https://ai.sdkwork.com',
    models: [
      {
        id: 'sdkwork-chat',
        name: 'SDKWork Chat',
      },
    ],
    ...overrides,
  };
}

await runTest('loadBootstrapData projects the synced OpenClaw bootstrap state into the generic guided-install surface', async () => {
  const service = createInstallBootstrapService({
    studioApi: {
      async listInstances() {
        return [
          {
            id: 'local-built-in',
            name: 'Local Built-In',
            status: 'online',
            runtimeKind: 'openclaw',
          },
        ];
      },
    },
    openClawBootstrapApi: {
      async loadBootstrapData() {
        return {
          configPath: 'C:/Users/admin/.openclaw/openclaw.json',
          syncedInstanceId: 'local-built-in',
          providers: [
            createBootstrapProvider(),
          ],
          channels: [
            {
              id: 'telegram',
              name: 'Telegram',
              description: 'Telegram bot access',
              status: 'connected',
              enabled: true,
              configurationMode: 'required',
              fieldCount: 2,
              configuredFieldCount: 2,
              setupSteps: ['Create bot', 'Paste token'],
              values: {
                token: 'tg-secret',
                chatId: '123',
              },
              fields: [
                {
                  key: 'token',
                  label: 'Bot Token',
                  placeholder: 'tg-token',
                },
                {
                  key: 'chatId',
                  label: 'Chat ID',
                  placeholder: '123456',
                },
              ],
            },
          ],
          packs: [
            {
              id: 'starter-pack',
              name: 'Starter Pack',
              description: 'Starter pack',
              author: 'SDKWork',
              rating: 5,
              downloads: 10,
              skills: [],
              category: 'Starter',
            },
          ],
          skills: [
            {
              id: 'skill-1',
              skillKey: 'weather',
              name: 'Weather',
              description: 'Weather skill',
              author: 'SDKWork',
              rating: 5,
              downloads: 10,
              category: 'Utility',
            },
          ],
        };
      },
      async applyConfiguration() {
        throw new Error('not implemented');
      },
      async initializeOpenClawInstance() {
        throw new Error('not implemented');
      },
    },
    providerRoutingApi: {
      async saveProviderRoutingRecord() {
        throw new Error('not implemented');
      },
    },
    openClawConfigApi: {
      async readConfigSnapshot() {
        return {
          providerSnapshots: [],
        };
      },
      async saveProviderSelection() {
        throw new Error('not implemented');
      },
    },
  });

  const data = await service.loadBootstrapData('local-built-in');

  assert.equal(data.selectedInstanceId, 'local-built-in');
  assert.deepEqual(data.instances.map((instance) => instance.id), ['local-built-in']);
  assert.equal(data.providers.length, 1);
  assert.equal(data.providers[0]?.id, 'provider-config-openai-primary');
  assert.equal(data.providerChannels[0]?.id, 'openai');
  assert.equal(data.providerChannels.some((channel) => channel.id === 'meta'), true);
  assert.equal(data.providerChannels.some((channel) => channel.id === 'baichuan'), true);
  assert.equal(data.providerChannels.some((channel) => channel.id === 'azure-openai'), true);
  assert.equal(data.providerChannels.some((channel) => channel.id === 'openrouter'), true);
  assert.equal(data.communicationChannels[0]?.id, 'telegram');
  assert.equal(data.communicationChannels[0]?.fields[0]?.key, 'token');
});

await runTest(
  'loadBootstrapData remaps SDKWork system-default routes onto protocol-native install channels',
  async () => {
    const service = createInstallBootstrapService({
      studioApi: {
        async listInstances() {
          return [
            {
              id: 'local-built-in',
              name: 'Local Built-In',
              status: 'online',
              runtimeKind: 'openclaw',
            },
          ];
        },
      },
      openClawBootstrapApi: {
        async loadBootstrapData() {
          return {
            configPath: 'C:/Users/admin/.openclaw/openclaw.json',
            syncedInstanceId: 'local-built-in',
            providers: [
              createBootstrapProvider({
                id: 'local-ai-proxy-system-default-openai-compatible',
                channelId: 'sdkwork',
                name: 'SDKWork Default',
                managedBy: 'system-default',
                clientProtocol: 'openai-compatible',
                upstreamProtocol: 'sdkwork',
              }),
              createBootstrapProvider({
                id: 'local-ai-proxy-system-default-anthropic',
                channelId: 'sdkwork',
                name: 'SDKWork Anthropic Default',
                managedBy: 'system-default',
                clientProtocol: 'anthropic',
                upstreamProtocol: 'sdkwork',
              }),
              createBootstrapProvider({
                id: 'local-ai-proxy-system-default-gemini',
                channelId: 'sdkwork',
                name: 'SDKWork Gemini Default',
                managedBy: 'system-default',
                clientProtocol: 'gemini',
                upstreamProtocol: 'sdkwork',
              }),
            ],
            channels: [],
            packs: [],
            skills: [],
          };
        },
        async applyConfiguration() {
          throw new Error('not implemented');
        },
        async initializeOpenClawInstance() {
          throw new Error('not implemented');
        },
      },
      providerRoutingApi: {
        async saveProviderRoutingRecord() {
          throw new Error('not implemented');
        },
      },
      openClawConfigApi: {
        async readConfigSnapshot() {
          return {
            providerSnapshots: [],
          };
        },
      },
    });

    const data = await service.loadBootstrapData('local-built-in');

    assert.deepEqual(
      data.providers.map((provider) => ({ id: provider.id, channelId: provider.channelId })),
      [
        {
          id: 'local-ai-proxy-system-default-openai-compatible',
          channelId: 'openai',
        },
        {
          id: 'local-ai-proxy-system-default-anthropic',
          channelId: 'anthropic',
        },
        {
          id: 'local-ai-proxy-system-default-gemini',
          channelId: 'google',
        },
      ],
    );
    assert.equal(data.providerChannels.some((channel) => channel.id === 'sdkwork'), false);
    assert.equal(data.providerChannels.find((channel) => channel.id === 'openai')?.providerCount, 1);
    assert.equal(
      data.providerChannels.find((channel) => channel.id === 'anthropic')?.providerCount,
      1,
    );
    assert.equal(data.providerChannels.find((channel) => channel.id === 'google')?.providerCount, 1);
  },
);

await runTest('applyConfiguration delegates existing provider selection to the OpenClaw bootstrap flow', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = createInstallBootstrapService({
    studioApi: {
      async listInstances() {
        return [
          {
            id: 'local-built-in',
            name: 'Local Built-In',
            status: 'online',
            runtimeKind: 'openclaw',
          },
        ];
      },
    },
    openClawBootstrapApi: {
      async loadBootstrapData() {
        return {
          configPath: 'C:/Users/admin/.openclaw/openclaw.json',
          syncedInstanceId: 'local-built-in',
          providers: [
            {
              id: 'openai-managed',
              channelId: 'openai',
              name: 'OpenAI Managed',
              apiKey: 'sk-live',
              groupId: 'provider-config-center',
              usage: {
                requestCount: 0,
                tokenCount: 0,
                spendUsd: 0,
                period: '30d',
              },
              expiresAt: null,
              status: 'active',
              createdAt: null,
              baseUrl: 'https://api.openai.com/v1',
              models: [
                {
                  id: 'gpt-5.4',
                  name: 'GPT-5.4',
                },
              ],
            },
          ],
          channels: [],
          packs: [],
          skills: [],
        };
      },
      async applyConfiguration(input: Record<string, unknown>) {
        calls.push(input);
        return {
          configPath: 'C:/Users/admin/.openclaw/openclaw.json',
          providerId: 'openai-managed',
          syncedInstanceId: 'local-built-in',
          configuredChannelIds: ['telegram'],
        };
      },
      async initializeOpenClawInstance() {
        throw new Error('not implemented');
      },
    },
    providerRoutingApi: {
      async saveProviderRoutingRecord() {
        throw new Error('not implemented');
      },
    },
    openClawConfigApi: {
      async readConfigSnapshot() {
        return {
          providerSnapshots: [],
        };
      },
    },
  });

  const result = await service.applyConfiguration({
    instanceId: 'local-built-in',
    provider: {
      providerId: 'openai-managed',
      channelId: 'openai',
      name: 'OpenAI Managed',
      apiKey: 'sk-live',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.4',
    },
    communicationChannels: [
      {
        channelId: 'telegram',
        values: {
          token: 'tg-secret',
        },
      },
    ],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.providerId, 'openai-managed');
  assert.deepEqual(calls[0]?.modelSelection, {
    defaultModelId: 'gpt-5.4',
    reasoningModelId: undefined,
    embeddingModelId: undefined,
  });
  assert.equal(result.providerId, 'openai-managed');
  assert.equal(result.instanceProviderId, 'openai-managed');
});

await runTest('applyConfiguration saves a new provider route and applies it through the OpenClaw bootstrap flow', async () => {
  const routeSaveCalls: Array<Record<string, unknown>> = [];
  const applyCalls: Array<Record<string, unknown>> = [];
  const service = createInstallBootstrapService({
    studioApi: {
      async listInstances() {
        return [
          {
            id: 'local-built-in',
            name: 'Local Built-In',
            status: 'online',
            runtimeKind: 'openclaw',
          },
        ];
      },
    },
    openClawBootstrapApi: {
      async loadBootstrapData() {
        return {
          configPath: 'C:/Users/admin/.openclaw/openclaw.json',
          syncedInstanceId: 'local-built-in',
          providers: [],
          channels: [],
          packs: [],
          skills: [],
        };
      },
      async applyConfiguration(input: Record<string, unknown>) {
        applyCalls.push(input);
        return {
          configPath: 'C:/Users/admin/.openclaw/openclaw.json',
          providerId: 'provider-config-openai-guided',
          syncedInstanceId: 'local-built-in',
          configuredChannelIds: [],
        };
      },
      async initializeOpenClawInstance() {
        throw new Error('not implemented');
      },
    },
    providerRoutingApi: {
      async saveProviderRoutingRecord(input: Record<string, unknown>) {
        routeSaveCalls.push(input);
        return {
          id: 'provider-config-openai-guided',
          schemaVersion: 1,
          name: 'Guided OpenAI',
          providerId: 'openai',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'openai-compatible',
          upstreamBaseUrl: 'https://api.openai.com/v1',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-guided-openai',
          enabled: true,
          isDefault: true,
          managedBy: 'user',
          defaultModelId: 'gpt-5.4',
          reasoningModelId: undefined,
          embeddingModelId: undefined,
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
          exposeTo: ['openclaw'],
          config: {
            temperature: 0.2,
            topP: 1,
            maxTokens: 8192,
            timeoutMs: 60000,
            streaming: true,
          },
          createdAt: 1,
          updatedAt: 1,
        };
      },
    },
    openClawConfigApi: {
      async readConfigSnapshot() {
        return {
          providerSnapshots: [],
        };
      },
    },
  });

  const result = await service.applyConfiguration({
    instanceId: 'local-built-in',
    provider: {
      channelId: 'openai',
      name: 'Guided OpenAI',
      apiKey: 'sk-guided-openai',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.4',
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
      ],
    },
    communicationChannels: [],
  });

  assert.equal(routeSaveCalls.length, 1);
  assert.equal(routeSaveCalls[0]?.name, 'Guided OpenAI');
  assert.equal(routeSaveCalls[0]?.providerId, 'openai');
  assert.equal(routeSaveCalls[0]?.upstreamBaseUrl, 'https://api.openai.com/v1');
  assert.equal(routeSaveCalls[0]?.apiKey, 'sk-guided-openai');
  assert.deepEqual(routeSaveCalls[0]?.config, {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: true,
  });
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0]?.providerId, 'provider-config-openai-guided');
  assert.deepEqual(applyCalls[0]?.modelSelection, {
    defaultModelId: 'gpt-5.4',
    reasoningModelId: undefined,
    embeddingModelId: undefined,
  });
  assert.equal(result.providerId, 'provider-config-openai-guided');
  assert.equal(result.instanceProviderId, 'provider-config-openai-guided');
});

await runTest(
  'applyConfiguration saves native gemini routes with the gemini local proxy client protocol',
  async () => {
    const routeSaveCalls: Array<Record<string, unknown>> = [];
    const service = createInstallBootstrapService({
      studioApi: {
        async listInstances() {
          return [
            {
              id: 'local-built-in',
              name: 'Local Built-In',
              status: 'online',
              runtimeKind: 'openclaw',
            },
          ];
        },
      },
      openClawBootstrapApi: {
        async loadBootstrapData() {
          return {
            configPath: 'C:/Users/admin/.openclaw/openclaw.json',
            syncedInstanceId: 'local-built-in',
            providers: [],
            channels: [],
            packs: [],
            skills: [],
          };
        },
        async applyConfiguration() {
          return {
            configPath: 'C:/Users/admin/.openclaw/openclaw.json',
            providerId: 'provider-config-gemini-guided',
            syncedInstanceId: 'local-built-in',
            configuredChannelIds: [],
          };
        },
        async initializeOpenClawInstance() {
          throw new Error('not implemented');
        },
      },
      providerRoutingApi: {
        async saveProviderRoutingRecord(input: Record<string, unknown>) {
          routeSaveCalls.push(input);
          return {
            id: 'provider-config-gemini-guided',
            schemaVersion: 1,
            name: 'Guided Gemini',
            providerId: 'google',
            clientProtocol: 'gemini',
            upstreamProtocol: 'gemini',
            upstreamBaseUrl: 'https://generativelanguage.googleapis.com',
            baseUrl: 'https://generativelanguage.googleapis.com',
            apiKey: 'sk-guided-gemini',
            enabled: true,
            isDefault: true,
            managedBy: 'user',
            defaultModelId: 'gemini-2.5-pro',
            reasoningModelId: undefined,
            embeddingModelId: 'text-embedding-004',
            models: [
              {
                id: 'gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
              },
              {
                id: 'text-embedding-004',
                name: 'text-embedding-004',
              },
            ],
            exposeTo: ['openclaw'],
            config: {
              temperature: 0.2,
              topP: 1,
              maxTokens: 8192,
              timeoutMs: 60000,
              streaming: true,
            },
            createdAt: 1,
            updatedAt: 1,
          };
        },
      },
      openClawConfigApi: {
        async readConfigSnapshot() {
          return {
            providerSnapshots: [],
          };
        },
      },
    });

    await service.applyConfiguration({
      instanceId: 'local-built-in',
      provider: {
        channelId: 'google',
        name: 'Guided Gemini',
        apiKey: 'sk-guided-gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        modelId: 'gemini-2.5-pro',
        models: [
          {
            id: 'gemini-2.5-pro',
            name: 'Gemini 2.5 Pro',
          },
          {
            id: 'text-embedding-004',
            name: 'text-embedding-004',
          },
        ],
      },
      communicationChannels: [],
    });

    assert.equal(routeSaveCalls.length, 1);
    assert.equal(routeSaveCalls[0]?.providerId, 'google');
    assert.equal(routeSaveCalls[0]?.clientProtocol, 'gemini');
    assert.equal(routeSaveCalls[0]?.upstreamProtocol, 'gemini');
    assert.equal(routeSaveCalls[0]?.defaultModelId, 'gemini-2.5-pro');
    assert.equal(routeSaveCalls[0]?.embeddingModelId, 'text-embedding-004');
  },
);

await runTest('initializeInstance delegates to the OpenClaw initializer surface', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = createInstallBootstrapService({
    studioApi: {
      async listInstances() {
        return [];
      },
    },
    openClawBootstrapApi: {
      async loadBootstrapData() {
        throw new Error('not implemented');
      },
      async applyConfiguration() {
        throw new Error('not implemented');
      },
      async initializeOpenClawInstance(input: Record<string, unknown>) {
        calls.push(input);
        return {
          instanceId: 'local-built-in',
          installedPackIds: ['starter-pack'],
          installedSkillIds: ['skill-1'],
        };
      },
    },
    providerRoutingApi: {
      async saveProviderRoutingRecord() {
        throw new Error('not implemented');
      },
    },
    openClawConfigApi: {
      async readConfigSnapshot() {
        return {
          providerSnapshots: [],
        };
      },
    },
  });

  const result = await service.initializeInstance({
    instanceId: 'local-built-in',
    packIds: ['starter-pack'],
    skillIds: ['skill-1'],
  });

  assert.deepEqual(calls, [
    {
      instanceId: 'local-built-in',
      packIds: ['starter-pack'],
      skillIds: ['skill-1'],
    },
  ]);
  assert.deepEqual(result.installedPackIds, ['starter-pack']);
  assert.deepEqual(result.installedSkillIds, ['skill-1']);
});
