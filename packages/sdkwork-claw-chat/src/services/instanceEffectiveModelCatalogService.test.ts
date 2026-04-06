import assert from 'node:assert/strict';
import { createInstanceEffectiveModelCatalogService } from './instanceEffectiveModelCatalogCore.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'instance effective model catalog uses authoritative detail truth before probing the OpenClaw gateway runtime',
  async () => {
    let gatewayModelCalls = 0;
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-openclaw-authority-mismatch',
          runtimeKind: 'openclaw',
          transportKind: 'openclawGatewayWs',
          deploymentMode: 'local-managed',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18795',
          websocketUrl: 'ws://127.0.0.1:18789',
        }) as any,
      getInstanceDetail: async () =>
        ({
          instance: {
            id: 'instance-openclaw-authority-mismatch',
            runtimeKind: 'openclaw',
            transportKind: 'openclawGatewayWs',
            deploymentMode: 'local-managed',
            status: 'starting',
            baseUrl: null,
            websocketUrl: null,
          },
          dataAccess: {
            routes: [],
          },
          artifacts: [],
        }) as any,
      listRouterChannels: async () => [
        { id: 'general', name: 'General' },
      ],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-4.1',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: () => null,
      readOpenClawConfigSnapshot: async () => {
        throw new Error('should not read OpenClaw config while authoritative detail says the runtime is still starting');
      },
      listGatewayModels: async () => {
        gatewayModelCalls += 1;
        throw new Error('should not probe gateway models while authoritative detail says the runtime is still starting');
      },
    });

    const catalog = await service.getCatalog('instance-openclaw-authority-mismatch');

    assert.equal(gatewayModelCalls, 0);
    assert.deepEqual(catalog.channels, [
      {
        id: 'general',
        name: 'General',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        icon: 'AI',
        defaultModelId: 'gpt-4.1',
        models: [
          {
            id: 'gpt-4.1',
            name: 'gpt-4.1',
          },
        ],
      },
    ]);
    assert.equal(catalog.preferredModelId, null);
  },
);

await runTest(
  'instance effective model catalog filters OpenClaw models by managed config and gateway runtime availability',
  async () => {
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-openclaw',
          runtimeKind: 'openclaw',
          transportKind: 'openclawGatewayWs',
          deploymentMode: 'local-managed',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18795',
          websocketUrl: 'ws://127.0.0.1:18789',
        }) as any,
      getInstanceDetail: async () =>
        ({
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: 'C:/openclaw/openclaw.json',
              },
            ],
          },
          artifacts: [],
        }) as any,
      listRouterChannels: async () => [
        { id: 'general', name: 'General' },
        { id: 'vision', name: 'Vision' },
      ],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
        {
          id: 'anthropic',
          channel_id: 'general',
          extension_id: 'anthropic',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.anthropic.com/v1',
          display_name: 'Anthropic',
          channel_bindings: [
            {
              provider_id: 'anthropic',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
        {
          id: 'visionlab',
          channel_id: 'vision',
          extension_id: 'visionlab',
          adapter_kind: 'openai-compatible',
          base_url: 'https://vision.example.com/v1',
          display_name: 'Vision Lab',
          channel_bindings: [
            {
              provider_id: 'visionlab',
              channel_id: 'vision',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-4.1',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
        {
          external_name: 'claude-3-7-sonnet',
          provider_id: 'anthropic',
          capabilities: ['chat'],
          streaming: true,
        },
        {
          external_name: 'vision-pro',
          provider_id: 'visionlab',
          capabilities: ['vision'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: (detail) =>
        detail?.dataAccess?.routes?.[0]?.target ?? null,
      readOpenClawConfigSnapshot: async () =>
        ({
          configPath: 'C:/openclaw/openclaw.json',
          providerSnapshots: [
            {
              id: 'api-router-openai',
            },
            {
              id: 'api-router-anthropic',
            },
          ],
          channelSnapshots: [],
          root: {},
        }) as any,
      listGatewayModels: async () => ({
        models: [
          {
            id: 'gpt-4.1',
            name: 'GPT-4.1',
            provider: 'openai',
          },
          {
            id: 'claude-3-7-sonnet',
            name: 'Claude 3.7 Sonnet',
            provider: 'anthropic',
          },
        ],
      }),
    });

    const catalog = await service.getCatalog('instance-openclaw');
    assert.deepEqual(
      catalog.channels.map((channel) => channel.id),
      ['general'],
    );
    assert.deepEqual(
      catalog.channels[0]?.models.map((model) => ({
        id: model.id,
        name: model.name,
      })),
      [
        {
          id: 'anthropic/claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet',
        },
        {
          id: 'openai/gpt-4.1',
          name: 'GPT-4.1',
        },
      ],
    );
  },
);

await runTest(
  'instance effective model catalog returns router channel-model relations for non-OpenClaw instances',
  async () => {
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-http',
          runtimeKind: 'custom',
          transportKind: 'openaiHttp',
          deploymentMode: 'remote',
          baseUrl: 'http://127.0.0.1:11434/v1',
          config: {
            baseUrl: 'http://127.0.0.1:11434/v1',
            websocketUrl: null,
          },
        }) as any,
      getInstanceDetail: async () => null,
      listRouterChannels: async () => [
        { id: 'general', name: 'General' },
        { id: 'coding', name: 'Coding' },
      ],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
        {
          id: 'deepseek',
          channel_id: 'coding',
          extension_id: 'deepseek',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.deepseek.com/v1',
          display_name: 'DeepSeek',
          channel_bindings: [
            {
              provider_id: 'deepseek',
              channel_id: 'coding',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-4.1',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
        {
          external_name: 'deepseek-chat',
          provider_id: 'deepseek',
          capabilities: ['chat'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: () => null,
      readOpenClawConfigSnapshot: async () => {
        throw new Error('should not read OpenClaw config for non-OpenClaw instances');
      },
      listGatewayModels: async () => {
        throw new Error('should not query gateway models for non-OpenClaw instances');
      },
    });

    const catalog = await service.getCatalog('instance-http');
    assert.deepEqual(
      catalog.channels.map((channel) => ({
        id: channel.id,
        models: channel.models.map((model) => model.id),
      })),
      [
        {
          id: 'coding',
          models: ['deepseek-chat'],
        },
        {
          id: 'general',
          models: ['gpt-4.1'],
        },
      ],
    );
  },
);

await runTest(
  'instance effective model catalog falls back to gateway runtime models when managed OpenClaw config and router catalog no longer intersect',
  async () => {
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-openclaw-fallback',
          runtimeKind: 'openclaw',
          transportKind: 'openclawGatewayWs',
          deploymentMode: 'local-managed',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18795',
          config: {
            baseUrl: 'http://127.0.0.1:18795',
            websocketUrl: null,
          },
        }) as any,
      getInstanceDetail: async () =>
        ({
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: 'C:/openclaw/openclaw.json',
              },
            ],
          },
        }) as any,
      listRouterChannels: async () => [
        { id: 'general', name: 'General' },
      ],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-4.1',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: (detail) =>
        detail?.dataAccess?.routes?.[0]?.target ?? null,
      readOpenClawConfigSnapshot: async () =>
        ({
          configPath: 'C:/openclaw/openclaw.json',
          providerSnapshots: [
            {
              id: 'api-router-anthropic',
            },
          ],
          channelSnapshots: [],
          root: {},
        }) as any,
      listGatewayModels: async () => ({
        models: [
          {
            id: 'anthropic/claude-3-7-sonnet',
            name: 'Claude 3.7 Sonnet',
            provider: 'anthropic',
          },
          {
            id: 'anthropic/claude-3-5-haiku',
            name: 'Claude 3.5 Haiku',
            provider: 'anthropic',
          },
        ],
      }),
    });

    const catalog = await service.getCatalog('instance-openclaw-fallback');
    assert.deepEqual(catalog.channels, [
      {
        id: 'anthropic',
        name: 'Anthropic',
        provider: 'anthropic',
        baseUrl: '',
        apiKey: '',
        icon: 'AT',
        defaultModelId: 'anthropic/claude-3-5-haiku',
        models: [
          {
            id: 'anthropic/claude-3-5-haiku',
            name: 'Claude 3.5 Haiku',
          },
          {
            id: 'anthropic/claude-3-7-sonnet',
            name: 'Claude 3.7 Sonnet',
          },
        ],
      },
    ]);
  },
);

await runTest(
  'instance effective model catalog prioritizes the configured default OpenClaw model when building chat channel defaults',
  async () => {
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-openclaw-default-model',
          runtimeKind: 'openclaw',
          transportKind: 'openclawGatewayWs',
          deploymentMode: 'local-managed',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18795',
          websocketUrl: 'ws://127.0.0.1:18789',
        }) as any,
      getInstanceDetail: async () =>
        ({
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: 'C:/openclaw/openclaw.json',
              },
            ],
          },
          artifacts: [],
        }) as any,
      listRouterChannels: async () => [
        { id: 'general', name: 'General' },
      ],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
        {
          id: 'anthropic',
          channel_id: 'general',
          extension_id: 'anthropic',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.anthropic.com/v1',
          display_name: 'Anthropic',
          channel_bindings: [
            {
              provider_id: 'anthropic',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-4.1',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
        {
          external_name: 'claude-3-7-sonnet',
          provider_id: 'anthropic',
          capabilities: ['chat'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: (detail) =>
        detail?.dataAccess?.routes?.[0]?.target ?? null,
      readOpenClawConfigSnapshot: async () =>
        ({
          configPath: 'C:/openclaw/openclaw.json',
          providerSnapshots: [
            {
              id: 'api-router-openai',
            },
            {
              id: 'api-router-anthropic',
            },
          ],
          agentSnapshots: [
            {
              id: 'main',
              isDefault: true,
              model: {
                primary: 'openai/gpt-4.1',
                fallbacks: ['anthropic/claude-3-7-sonnet'],
              },
            },
          ],
          channelSnapshots: [],
          root: {
            agents: {
              defaults: {
                model: {
                  primary: 'anthropic/claude-3-7-sonnet',
                },
              },
              list: [
                {
                  id: 'main',
                  default: true,
                  model: {
                    primary: 'openai/gpt-4.1',
                    fallbacks: ['anthropic/claude-3-7-sonnet'],
                  },
                },
              ],
            },
          },
        }) as any,
      listGatewayModels: async () => ({
        models: [
          {
            id: 'gpt-4.1',
            name: 'GPT-4.1',
            provider: 'openai',
          },
          {
            id: 'claude-3-7-sonnet',
            name: 'Claude 3.7 Sonnet',
            provider: 'anthropic',
          },
        ],
      }),
    });

    const catalog = await service.getCatalog('instance-openclaw-default-model');

    assert.equal(catalog.channels[0]?.id, 'general');
    assert.equal(catalog.channels[0]?.defaultModelId, 'openai/gpt-4.1');
    assert.deepEqual(
      catalog.channels[0]?.models.map((model) => model.id),
      ['openai/gpt-4.1', 'anthropic/claude-3-7-sonnet'],
    );
  },
);

await runTest(
  'instance effective model catalog prefers the selected OpenClaw agent model override when an agent-specific chat route is requested',
  async () => {
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-openclaw-selected-agent-model',
          runtimeKind: 'openclaw',
          transportKind: 'openclawGatewayWs',
          deploymentMode: 'local-managed',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18795',
          websocketUrl: 'ws://127.0.0.1:18789',
        }) as any,
      getInstanceDetail: async () =>
        ({
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: 'C:/openclaw/openclaw.json',
              },
            ],
          },
          artifacts: [],
        }) as any,
      listRouterChannels: async () => [
        { id: 'general', name: 'General' },
      ],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
        {
          id: 'anthropic',
          channel_id: 'general',
          extension_id: 'anthropic',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.anthropic.com/v1',
          display_name: 'Anthropic',
          channel_bindings: [
            {
              provider_id: 'anthropic',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-4.1',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
        {
          external_name: 'claude-3-7-sonnet',
          provider_id: 'anthropic',
          capabilities: ['chat'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: (detail) =>
        detail?.dataAccess?.routes?.[0]?.target ?? null,
      readOpenClawConfigSnapshot: async () =>
        ({
          configPath: 'C:/openclaw/openclaw.json',
          providerSnapshots: [
            {
              id: 'api-router-openai',
            },
            {
              id: 'api-router-anthropic',
            },
          ],
          agentSnapshots: [
            {
              id: 'main',
              isDefault: true,
              model: {
                primary: 'openai/gpt-4.1',
                fallbacks: [],
              },
            },
            {
              id: 'research',
              isDefault: false,
              model: {
                primary: 'anthropic/claude-3-7-sonnet',
                fallbacks: ['openai/gpt-4.1'],
              },
            },
          ],
          channelSnapshots: [],
          root: {
            agents: {
              defaults: {
                model: {
                  primary: 'openai/gpt-4.1',
                },
              },
              list: [
                {
                  id: 'main',
                  default: true,
                  model: {
                    primary: 'openai/gpt-4.1',
                  },
                },
                {
                  id: 'research',
                  model: {
                    primary: 'anthropic/claude-3-7-sonnet',
                    fallbacks: ['openai/gpt-4.1'],
                  },
                },
              ],
            },
          },
        }) as any,
      listGatewayModels: async () => ({
        models: [
          {
            id: 'gpt-4.1',
            name: 'GPT-4.1',
            provider: 'openai',
          },
          {
            id: 'claude-3-7-sonnet',
            name: 'Claude 3.7 Sonnet',
            provider: 'anthropic',
          },
        ],
      }),
    });

    const catalog = await service.getCatalog(
      'instance-openclaw-selected-agent-model',
      'research',
    );

    assert.equal(catalog.preferredModelId, 'anthropic/claude-3-7-sonnet');
    assert.equal(catalog.channels[0]?.defaultModelId, 'anthropic/claude-3-7-sonnet');
    assert.deepEqual(
      catalog.channels[0]?.models.map((model) => model.id),
      ['anthropic/claude-3-7-sonnet', 'openai/gpt-4.1'],
    );
  },
);

await runTest(
  'instance effective model catalog accepts the upgraded OpenClaw gateway model payload shape',
  async () => {
    const service = createInstanceEffectiveModelCatalogService({
      getInstance: async () =>
        ({
          id: 'instance-openclaw-upgraded-gateway-models',
          runtimeKind: 'openclaw',
          transportKind: 'openclawGatewayWs',
          deploymentMode: 'local-managed',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18795',
          websocketUrl: 'ws://127.0.0.1:18789',
        }) as any,
      getInstanceDetail: async () =>
        ({
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: 'C:/openclaw/openclaw.json',
              },
            ],
          },
          artifacts: [],
        }) as any,
      listRouterChannels: async () => [{ id: 'general', name: 'General' }],
      listRouterProviders: async () => [
        {
          id: 'openai',
          channel_id: 'general',
          extension_id: 'openai',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.openai.com/v1',
          display_name: 'OpenAI',
          channel_bindings: [
            {
              provider_id: 'openai',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
        {
          id: 'anthropic',
          channel_id: 'general',
          extension_id: 'anthropic',
          adapter_kind: 'openai-compatible',
          base_url: 'https://api.anthropic.com/v1',
          display_name: 'Anthropic',
          channel_bindings: [
            {
              provider_id: 'anthropic',
              channel_id: 'general',
              is_primary: true,
            },
          ],
        },
      ],
      listRouterModels: async () => [
        {
          external_name: 'gpt-5.4',
          provider_id: 'openai',
          capabilities: ['chat'],
          streaming: true,
        },
        {
          external_name: 'claude-3-7-sonnet',
          provider_id: 'anthropic',
          capabilities: ['chat'],
          streaming: true,
        },
      ],
      resolveOpenClawConfigPath: (detail) =>
        detail?.dataAccess?.routes?.[0]?.target ?? null,
      readOpenClawConfigSnapshot: async () =>
        ({
          configPath: 'C:/openclaw/openclaw.json',
          providerSnapshots: [
            { id: 'api-router-openai' },
            { id: 'api-router-anthropic' },
          ],
          channelSnapshots: [],
          root: {},
        }) as any,
      listGatewayModels: async () => ({
        models: [
          {
            provider: 'openai',
            model: 'gpt-5.4',
            label: 'GPT-5.4',
          },
          {
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            title: 'Claude 3.7 Sonnet',
          },
        ],
      }),
    });

    const catalog = await service.getCatalog('instance-openclaw-upgraded-gateway-models');

    assert.deepEqual(
      catalog.channels.map((channel) => ({
        id: channel.id,
        defaultModelId: channel.defaultModelId,
        models: channel.models.map((model) => ({
          id: model.id,
          name: model.name,
        })),
      })),
      [
        {
          id: 'general',
          defaultModelId: 'anthropic/claude-3-7-sonnet',
          models: [
            {
              id: 'anthropic/claude-3-7-sonnet',
              name: 'Claude 3.7 Sonnet',
            },
            {
              id: 'openai/gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
        },
      ],
    );
  },
);
