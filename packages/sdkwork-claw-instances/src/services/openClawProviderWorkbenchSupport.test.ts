import assert from 'node:assert/strict';

function runTest(name: string, fn: () => void | Promise<void>) {
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

let providerWorkbenchSupportModule:
  | typeof import('./openClawProviderWorkbenchSupport.ts')
  | undefined;

try {
  providerWorkbenchSupportModule = await import('./openClawProviderWorkbenchSupport.ts');
} catch {
  providerWorkbenchSupportModule = undefined;
}

await runTest(
  'openClawProviderWorkbenchSupport exposes shared provider mapping and clone helpers',
  () => {
    assert.ok(
      providerWorkbenchSupportModule,
      'Expected openClawProviderWorkbenchSupport.ts to exist',
    );
    assert.equal(typeof providerWorkbenchSupportModule?.mapManagedProvider, 'function');
    assert.equal(typeof providerWorkbenchSupportModule?.mapLlmProvider, 'function');
    assert.equal(typeof providerWorkbenchSupportModule?.providerMatchesId, 'function');
    assert.equal(typeof providerWorkbenchSupportModule?.buildOpenClawLlmProviders, 'function');
  },
);

await runTest(
  'mapManagedProvider deep-clones managed provider snapshots',
  () => {
    const mapped = providerWorkbenchSupportModule?.mapManagedProvider({
      id: 'sdkwork-local-proxy',
      providerKey: 'sdkwork-local-proxy',
      name: 'SDKWork Local Proxy',
      provider: 'sdkwork-local-proxy',
      endpoint: 'http://127.0.0.1:18791/v1',
      apiKeySource: 'sk_sdkwork_api_key',
      status: 'ready',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'gpt-5.4',
      embeddingModelId: 'text-embedding-3-large',
      description: 'Managed local proxy projection.',
      icon: 'S',
      lastCheckedAt: '2026-04-02T00:00:00.000Z',
      capabilities: ['chat', 'embedding', 'reasoning'],
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          role: 'primary',
          contextWindow: '200K',
        },
      ],
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
      },
    } as any);

    assert.equal(mapped?.id, 'sdkwork-local-proxy');
    assert.deepEqual(mapped?.capabilities, ['chat', 'embedding', 'reasoning']);
    assert.deepEqual(mapped?.models, [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        role: 'primary',
        contextWindow: '200K',
      },
    ]);
    assert.deepEqual(mapped?.config, {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    });

    mapped?.capabilities.push('vision');
    if (mapped?.models[0]) {
      mapped.models[0].name = 'Changed';
    }
    if (mapped?.config) {
      mapped.config.streaming = false;
    }

    assert.deepEqual(mapped?.capabilities, ['chat', 'embedding', 'reasoning', 'vision']);
    assert.equal(mapped?.models[0]?.name, 'Changed');
    assert.equal(mapped?.config.streaming, false);
  },
);

await runTest(
  'mapLlmProvider deep-clones live workbench providers',
  () => {
    const mapped = providerWorkbenchSupportModule?.mapLlmProvider({
      id: 'openai',
      name: 'OpenAI',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKeySource: 'env:OPENAI_API_KEY',
      status: 'ready',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'gpt-5.4',
      embeddingModelId: 'text-embedding-3-large',
      description: 'OpenAI provider',
      icon: 'O',
      lastCheckedAt: '2026-04-09T00:00:00.000Z',
      capabilities: ['chat', 'embedding', 'reasoning'],
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          role: 'primary',
          contextWindow: '128000 tokens',
        },
      ],
      config: {
        temperature: 0.3,
        topP: 1,
        maxTokens: 4096,
        timeoutMs: 60000,
        streaming: true,
      },
    } as any);

    assert.equal(mapped?.name, 'OpenAI');
    mapped?.capabilities.push('vision');
    if (mapped?.models[0]) {
      mapped.models[0].name = 'Changed';
    }
    if (mapped?.config) {
      mapped.config.maxTokens = 8192;
    }

    assert.deepEqual(mapped?.capabilities, ['chat', 'embedding', 'reasoning', 'vision']);
    assert.equal(mapped?.models[0]?.name, 'Changed');
    assert.equal(mapped?.config.maxTokens, 8192);
  },
);

await runTest(
  'buildOpenClawLlmProviders prefers live models for matching providers and falls back to config models',
  () => {
    const providers = providerWorkbenchSupportModule?.buildOpenClawLlmProviders(
      {
        config: {
          meta: {
            lastTouchedAt: '2026-04-09T00:00:00.000Z',
          },
          models: {
            providers: {
              openai: {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '${OPENAI_API_KEY}',
                temperature: 0.4,
                models: [
                  {
                    id: 'gpt-4.1-mini',
                    name: 'GPT-4.1 Mini',
                    role: 'fallback',
                    contextWindow: 128000,
                  },
                ],
              },
              anthropic: {
                endpoint: 'https://api.anthropic.com',
                apiKey: '${ANTHROPIC_API_KEY}',
                streaming: false,
                models: [
                  {
                    id: 'claude-3-5-sonnet',
                    name: 'Claude 3.5 Sonnet',
                    role: 'primary',
                    contextWindow: 200000,
                  },
                ],
              },
            },
          },
        },
      } as any,
      [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          provider: 'openai',
          reasoning: true,
          contextWindow: 200000,
        },
        {
          id: 'text-embedding-3-large',
          name: 'Text Embedding 3 Large',
          providerId: 'openai',
          api: 'embedding',
          contextWindow: 8192,
        },
      ] as any,
      {
        observability: {
          lastSeenAt: 1744156800000,
        },
      } as any,
    );

    assert.deepEqual(
      providers?.map((provider) => provider.id),
      ['anthropic', 'openai'],
    );
    assert.equal(providers?.[1]?.defaultModelId, 'gpt-5.4');
    assert.equal(providers?.[1]?.embeddingModelId, 'text-embedding-3-large');
    assert.deepEqual(providers?.[1]?.capabilities, ['chat', 'embedding', 'reasoning']);
    assert.equal(providers?.[1]?.apiKeySource, 'env:OPENAI_API_KEY');
    assert.equal(providers?.[1]?.config.temperature, 0.4);
    assert.equal(providers?.[1]?.lastCheckedAt, '2026-04-09T00:00:00.000Z');

    assert.equal(providers?.[0]?.defaultModelId, 'claude-3-5-sonnet');
    assert.equal(providers?.[0]?.endpoint, 'https://api.anthropic.com');
    assert.equal(providers?.[0]?.apiKeySource, 'env:ANTHROPIC_API_KEY');
    assert.equal(providers?.[0]?.config.streaming, false);
    assert.deepEqual(providers?.[0]?.capabilities, ['chat']);
  },
);
