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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

await runTest('modelMappingService exposes the mapping and catalog service surface', async () => {
  let module: typeof import('./modelMappingService.ts');

  try {
    module = await import('./modelMappingService.ts');
  } catch (error) {
    assert.fail(`modelMappingService module is missing: ${String(error)}`);
  }

  assert.equal(typeof module.modelMappingService.getModelMappings, 'function');
  assert.equal(typeof module.modelMappingService.createModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.updateModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.updateStatus, 'function');
  assert.equal(typeof module.modelMappingService.deleteModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.getModelCatalog, 'function');
});

await runTest('modelMappingService derives the model catalog from router providers and models instead of mock data', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { modelMappingService } = await import('./modelMappingService.ts');
  const originalAdminClient = {
    listChannels: infrastructure.sdkworkApiRouterAdminClient.listChannels,
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  infrastructure.sdkworkApiRouterAdminClient.listChannels = async () => [
    {
      id: 'openai',
      name: 'OpenAI',
    },
    {
      id: 'google',
      name: 'Google',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => [
    {
      id: 'provider-openai-official',
      channel_id: 'openai',
      extension_id: 'sdkwork.provider.custom-openai',
      adapter_kind: 'custom-openai',
      base_url: 'https://router.openai.example.com/v1',
      display_name: 'OpenAI Official',
      channel_bindings: [
        {
          provider_id: 'provider-openai-official',
          channel_id: 'openai',
          is_primary: true,
        },
      ],
    },
    {
      id: 'provider-google-official',
      channel_id: 'google',
      extension_id: 'sdkwork.provider.google',
      adapter_kind: 'google',
      base_url: 'https://router.google.example.com/v1',
      display_name: 'Google Official',
      channel_bindings: [
        {
          provider_id: 'provider-google-official',
          channel_id: 'google',
          is_primary: true,
        },
      ],
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => [
    {
      external_name: 'gpt-5.4',
      provider_id: 'provider-openai-official',
      capabilities: ['responses'],
      streaming: true,
      context_window: 200000,
    },
    {
      external_name: 'gpt-4.1-mini',
      provider_id: 'provider-openai-official',
      capabilities: ['chat_completions'],
      streaming: true,
      context_window: 128000,
    },
    {
      external_name: 'gemini-2.5-pro',
      provider_id: 'provider-google-official',
      capabilities: ['generate_content'],
      streaming: true,
      context_window: 1048576,
    },
  ];
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone([
      {
        id: 'openai',
        name: 'OpenAI',
        vendor: 'OpenAI',
        description: 'OpenAI routes',
        modelFamily: 'GPT',
        providerCount: 0,
        activeProviderCount: 0,
        warningProviderCount: 0,
        disabledProviderCount: 0,
      },
      {
        id: 'google',
        name: 'Google',
        vendor: 'Google',
        description: 'Google routes',
        modelFamily: 'Gemini',
        providerCount: 0,
        activeProviderCount: 0,
        warningProviderCount: 0,
        disabledProviderCount: 0,
      },
    ]);

  try {
    const catalog = await modelMappingService.getModelCatalog();
    const mappings = await modelMappingService.getModelMappings({
      keyword: 'gemini',
    });

    assert.deepEqual(catalog, [
      {
        channelId: 'google',
        channelName: 'Google',
        models: [
          {
            modelId: 'gemini-2.5-pro',
            modelName: 'gemini-2.5-pro',
          },
        ],
      },
      {
        channelId: 'openai',
        channelName: 'OpenAI',
        models: [
          {
            modelId: 'gpt-4.1-mini',
            modelName: 'gpt-4.1-mini',
          },
          {
            modelId: 'gpt-5.4',
            modelName: 'gpt-5.4',
          },
        ],
      },
    ]);
    assert.deepEqual(mappings, []);
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listChannels =
      originalAdminClient.listChannels;
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('modelMappingService rejects CRUD operations until sdkwork-api-router exposes first-class model mapping APIs', async () => {
  const { modelMappingService, MODEL_MAPPING_UNSUPPORTED_ERROR } = await import(
    './modelMappingService.ts'
  );

  await assert.rejects(
    () =>
      modelMappingService.createModelMapping({
        name: 'Policy Bridge',
        description: 'Should not be accepted without backend support',
        effectiveFrom: '2026-03-21T00:00:00.000Z',
        effectiveTo: '2026-12-31T23:59:59.000Z',
        rules: [
          {
            source: {
              channelId: 'openai',
              channelName: 'OpenAI',
              modelId: 'gpt-5.4',
              modelName: 'GPT-5.4',
            },
            target: {
              channelId: 'google',
              channelName: 'Google',
              modelId: 'gemini-2.5-pro',
              modelName: 'Gemini 2.5 Pro',
            },
          },
        ],
      }),
    new RegExp(MODEL_MAPPING_UNSUPPORTED_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );

  await assert.rejects(
    () => modelMappingService.updateModelMapping('mapping-1', { name: 'Updated' }),
    /first-class model mapping APIs/i,
  );
  await assert.rejects(
    () => modelMappingService.updateStatus('mapping-1', 'disabled'),
    /first-class model mapping APIs/i,
  );
  await assert.rejects(
    () => modelMappingService.deleteModelMapping('mapping-1'),
    /first-class model mapping APIs/i,
  );
});
