import assert from 'node:assert/strict';
import type {
  ApiRouterChannel,
  ProxyProviderModel,
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createRouterChannelCatalog(): ApiRouterChannel[] {
  return [
    {
      id: 'openai',
      name: 'OpenAI',
      vendor: 'OpenAI',
      description: 'OpenAI Responses and chat-completions routes.',
      modelFamily: 'GPT-5 / GPT-4.1',
      providerCount: 99,
      activeProviderCount: 99,
      warningProviderCount: 0,
      disabledProviderCount: 0,
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      vendor: 'Anthropic',
      description: 'Claude routes.',
      modelFamily: 'Claude 4',
      providerCount: 99,
      activeProviderCount: 99,
      warningProviderCount: 0,
      disabledProviderCount: 0,
    },
  ];
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

await runTest('apiRouterService aggregates router-backed provider rows per tenant credential and enriches channel counts', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listUsageRecords: infrastructure.sdkworkApiRouterAdminClient.listUsageRecords,
    listTenants: infrastructure.sdkworkApiRouterAdminClient.listTenants,
    listProviderHealthSnapshots:
      infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => [
    {
      id: 'provider-openai-global',
      channel_id: 'openai',
      extension_id: 'sdkwork.provider.custom-openai',
      adapter_kind: 'custom-openai',
      base_url: 'https://router.openai.example.com/v1',
      display_name: 'OpenAI Global',
      channel_bindings: [
        {
          channel_id: 'openai',
          is_primary: true,
        },
      ],
    },
    {
      id: 'provider-anthropic-eu',
      channel_id: 'anthropic',
      extension_id: 'sdkwork.provider.custom-anthropic',
      adapter_kind: 'anthropic',
      base_url: 'https://router.anthropic.example.com/v1',
      display_name: 'Anthropic Europe',
      channel_bindings: [
        {
          channel_id: 'anthropic',
          is_primary: true,
        },
      ],
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () => [
    {
      tenant_id: 'team-ops',
      provider_id: 'provider-openai-global',
      key_reference: 'cred-openai-team-ops',
      secret_backend: 'keyring',
    },
    {
      tenant_id: 'team-web',
      provider_id: 'provider-openai-global',
      key_reference: 'cred-openai-team-web',
      secret_backend: 'keyring',
    },
    {
      tenant_id: 'team-ops',
      provider_id: 'provider-anthropic-eu',
      key_reference: 'cred-anthropic-team-ops',
      secret_backend: 'keyring',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => [
    {
      external_name: 'gpt-5.4',
      provider_id: 'provider-openai-global',
      capabilities: ['responses'],
      streaming: true,
      context_window: 200000,
    },
    {
      external_name: 'gpt-4.1-mini',
      provider_id: 'provider-openai-global',
      capabilities: ['chat_completions'],
      streaming: true,
      context_window: 128000,
    },
    {
      external_name: 'claude-sonnet-4',
      provider_id: 'provider-anthropic-eu',
      capabilities: ['messages'],
      streaming: true,
      context_window: 200000,
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listUsageRecords = async () => [
    {
      project_id: 'project-alpha',
      model: 'gpt-5.4',
      provider: 'provider-openai-global',
      units: 1,
      amount: 1.2,
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      created_at_ms: 1_710_000_000_000,
    },
    {
      project_id: 'project-beta',
      model: 'gpt-4.1-mini',
      provider: 'provider-openai-global',
      units: 1,
      amount: 0.3,
      input_tokens: 200,
      output_tokens: 100,
      total_tokens: 300,
      created_at_ms: 1_710_000_500_000,
    },
    {
      project_id: 'project-claude',
      model: 'claude-sonnet-4',
      provider: 'provider-anthropic-eu',
      units: 1,
      amount: 0.6,
      input_tokens: 400,
      output_tokens: 100,
      total_tokens: 500,
      created_at_ms: 1_710_001_000_000,
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listTenants = async () => [
    {
      id: 'team-ops',
      name: 'Team Ops',
    },
    {
      id: 'team-web',
      name: 'Team Web',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots = async () => [
    {
      provider_id: 'provider-openai-global',
      extension_id: 'sdkwork.provider.custom-openai',
      runtime: 'connector',
      observed_at_ms: 1_710_002_000_000,
      instance_id: 'provider-openai-global',
      running: true,
      healthy: true,
      message: null,
    },
    {
      provider_id: 'provider-anthropic-eu',
      extension_id: 'sdkwork.provider.custom-anthropic',
      runtime: 'connector',
      observed_at_ms: 1_710_002_000_000,
      instance_id: 'provider-anthropic-eu',
      running: false,
      healthy: false,
      message: 'Connector offline',
    },
  ];
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone(createRouterChannelCatalog());

  try {
    const channels = await apiRouterService.getChannels();
    const providers = await apiRouterService.getProxyProviders();

    assert.equal(providers.length, 3);

    const openAiTeamOps = providers.find(
      (provider) =>
        provider.tenantId === 'team-ops'
        && provider.credentialReference === 'cred-openai-team-ops',
    );
    const openAiTeamWeb = providers.find(
      (provider) =>
        provider.tenantId === 'team-web'
        && provider.credentialReference === 'cred-openai-team-web',
    );
    const anthropicTeamOps = providers.find(
      (provider) =>
        provider.tenantId === 'team-ops'
        && provider.credentialReference === 'cred-anthropic-team-ops',
    );

    assert.ok(openAiTeamOps);
    assert.ok(openAiTeamWeb);
    assert.ok(anthropicTeamOps);

    assert.equal(openAiTeamOps.apiKey, '');
    assert.equal(openAiTeamOps.canCopyApiKey, false);
    assert.equal(openAiTeamOps.groupId, 'team-ops');
    assert.equal(openAiTeamOps.status, 'active');
    assert.equal(openAiTeamOps.baseUrl, 'https://router.openai.example.com/v1');
    assert.equal(openAiTeamOps.createdAt, null);
    assert.equal(openAiTeamOps.expiresAt, null);
    assert.equal(openAiTeamOps.notes, undefined);
    assert.deepEqual(openAiTeamOps.models, [
      {
        id: 'gpt-5.4',
        name: 'gpt-5.4',
      },
      {
        id: 'gpt-4.1-mini',
        name: 'gpt-4.1-mini',
      },
    ]);
    assert.deepEqual(openAiTeamOps.usage, {
      requestCount: 2,
      tokenCount: 1800,
      spendUsd: 1.5,
      period: '30d',
    });
    assert.notEqual(openAiTeamOps.id, openAiTeamWeb.id);

    assert.equal(anthropicTeamOps.status, 'disabled');
    assert.deepEqual(anthropicTeamOps.usage, {
      requestCount: 1,
      tokenCount: 500,
      spendUsd: 0.6,
      period: '30d',
    });

    const openAiChannel = channels.find((channel) => channel.id === 'openai');
    const anthropicChannel = channels.find((channel) => channel.id === 'anthropic');

    assert.ok(openAiChannel);
    assert.ok(anthropicChannel);
    assert.equal(openAiChannel.providerCount, 2);
    assert.equal(openAiChannel.activeProviderCount, 2);
    assert.equal(openAiChannel.warningProviderCount, 0);
    assert.equal(openAiChannel.disabledProviderCount, 0);
    assert.equal(anthropicChannel.providerCount, 1);
    assert.equal(anthropicChannel.activeProviderCount, 0);
    assert.equal(anthropicChannel.disabledProviderCount, 1);
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listUsageRecords =
      originalAdminClient.listUsageRecords;
    infrastructure.sdkworkApiRouterAdminClient.listTenants =
      originalAdminClient.listTenants;
    infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots =
      originalAdminClient.listProviderHealthSnapshots;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('apiRouterService creates router-backed providers, creates missing tenants on demand, and reveals the secret once', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listTenants: infrastructure.sdkworkApiRouterAdminClient.listTenants,
    createTenant: infrastructure.sdkworkApiRouterAdminClient.createTenant,
    createProvider: infrastructure.sdkworkApiRouterAdminClient.createProvider,
    createCredential: infrastructure.sdkworkApiRouterAdminClient.createCredential,
    createModel: infrastructure.sdkworkApiRouterAdminClient.createModel,
    listUsageRecords: infrastructure.sdkworkApiRouterAdminClient.listUsageRecords,
    listProviderHealthSnapshots:
      infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  const providerRecords: Array<{
    id: string;
    channel_id: string;
    extension_id: string;
    adapter_kind: string;
    base_url: string;
    display_name: string;
    channel_bindings: Array<{ channel_id: string; is_primary: boolean }>;
  }> = [];
  const credentialRecords: Array<{
    tenant_id: string;
    provider_id: string;
    key_reference: string;
    secret_backend: string;
  }> = [];
  const modelRecords: Array<{
    external_name: string;
    provider_id: string;
    capabilities: string[];
    streaming: boolean;
    context_window?: number | null;
  }> = [];
  const tenantRecords = [
    {
      id: 'team-ops',
      name: 'Team Ops',
    },
  ];
  const createTenantRequests: Array<{ id: string; name: string }> = [];
  const createProviderRequests: Array<{
    id: string;
    channel_id: string;
    extension_id?: string;
    adapter_kind: string;
    base_url: string;
    display_name: string;
    channel_bindings?: Array<{ channel_id: string; is_primary?: boolean }>;
  }> = [];
  const createCredentialRequests: Array<{
    tenant_id: string;
    provider_id: string;
    key_reference: string;
    secret_value: string;
  }> = [];
  const createModelRequests: Array<{
    external_name: string;
    provider_id: string;
    capabilities?: string[];
    streaming?: boolean;
    context_window?: number | null;
  }> = [];

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () =>
    clone(providerRecords);
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () =>
    clone(credentialRecords);
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () =>
    clone(modelRecords);
  infrastructure.sdkworkApiRouterAdminClient.listUsageRecords = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.listTenants = async () =>
    clone(tenantRecords);
  infrastructure.sdkworkApiRouterAdminClient.createTenant = async (request) => {
    createTenantRequests.push(clone(request));
    tenantRecords.push(clone(request));
    return clone(request);
  };
  infrastructure.sdkworkApiRouterAdminClient.createProvider = async (request) => {
    createProviderRequests.push(clone(request));
    const record = {
      id: request.id,
      channel_id: request.channel_id,
      extension_id: request.extension_id || 'sdkwork.provider.custom-openai',
      adapter_kind: request.adapter_kind,
      base_url: request.base_url,
      display_name: request.display_name,
      channel_bindings: request.channel_bindings?.map((binding) => ({
        channel_id: binding.channel_id,
        is_primary: binding.is_primary ?? false,
      })) || [],
    };

    providerRecords.push(record);
    return clone(record);
  };
  infrastructure.sdkworkApiRouterAdminClient.createCredential = async (request) => {
    createCredentialRequests.push(clone(request));
    const record = {
      tenant_id: request.tenant_id,
      provider_id: request.provider_id,
      key_reference: request.key_reference,
      secret_backend: 'keyring',
    };
    credentialRecords.push(record);
    return clone(record);
  };
  infrastructure.sdkworkApiRouterAdminClient.createModel = async (request) => {
    createModelRequests.push(clone(request));
    const record = {
      external_name: request.external_name,
      provider_id: request.provider_id,
      capabilities: request.capabilities || [],
      streaming: request.streaming ?? true,
      context_window: request.context_window ?? null,
    };
    modelRecords.push(record);
    return clone(record);
  };
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone(createRouterChannelCatalog());

  try {
    const created = await apiRouterService.createProvider({
      channelId: 'openai',
      name: 'OpenAI Burst',
      apiKey: 'sk-create-openai-001',
      groupId: 'team-new',
      baseUrl: 'https://router.openai.example.com/v1',
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
        {
          id: 'gpt-4.1-mini',
          name: 'GPT-4.1 Mini',
        },
      ],
      expiresAt: '2026-08-01T23:59:59.000Z',
      notes: 'New provider',
    });

    assert.equal(createTenantRequests.length, 1);
    assert.deepEqual(createTenantRequests[0], {
      id: 'team-new',
      name: 'team-new',
    });
    assert.equal(createProviderRequests.length, 1);
    assert.equal(createProviderRequests[0]?.channel_id, 'openai');
    assert.equal(createCredentialRequests.length, 1);
    assert.equal(createCredentialRequests[0]?.tenant_id, 'team-new');
    assert.equal(createCredentialRequests[0]?.secret_value, 'sk-create-openai-001');
    assert.equal(createCredentialRequests[0]?.provider_id, createProviderRequests[0]?.id);
    assert.equal(createModelRequests.length, 2);
    assert.deepEqual(
      createModelRequests.map((request) => request.external_name),
      ['gpt-5.4', 'gpt-4.1-mini'],
    );

    assert.equal(created.channelId, 'openai');
    assert.equal(created.groupId, 'team-new');
    assert.equal(created.apiKey, 'sk-create-openai-001');
    assert.equal(created.canCopyApiKey, true);
    assert.equal(created.credentialReference, createCredentialRequests[0]?.key_reference);
    assert.equal(created.expiresAt, null);
    assert.equal(created.notes, undefined);
    assert.equal(created.status, 'warning');
    assert.deepEqual(created.models, [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
      },
    ]);

    const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });
    const createdRow = providers.find((provider) => provider.id === created.id);

    assert.ok(createdRow);
    assert.equal(createdRow.apiKey, 'sk-create-openai-001');
    assert.equal(createdRow.canCopyApiKey, true);
    assert.equal(createdRow.groupId, 'team-new');
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listTenants =
      originalAdminClient.listTenants;
    infrastructure.sdkworkApiRouterAdminClient.createTenant =
      originalAdminClient.createTenant;
    infrastructure.sdkworkApiRouterAdminClient.createProvider =
      originalAdminClient.createProvider;
    infrastructure.sdkworkApiRouterAdminClient.createCredential =
      originalAdminClient.createCredential;
    infrastructure.sdkworkApiRouterAdminClient.createModel =
      originalAdminClient.createModel;
    infrastructure.sdkworkApiRouterAdminClient.listUsageRecords =
      originalAdminClient.listUsageRecords;
    infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots =
      originalAdminClient.listProviderHealthSnapshots;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('apiRouterService updates router-backed providers without rotating the credential when the secret is unchanged', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listUsageRecords: infrastructure.sdkworkApiRouterAdminClient.listUsageRecords,
    listTenants: infrastructure.sdkworkApiRouterAdminClient.listTenants,
    listProviderHealthSnapshots:
      infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots,
    createProvider: infrastructure.sdkworkApiRouterAdminClient.createProvider,
    createCredential: infrastructure.sdkworkApiRouterAdminClient.createCredential,
    createModel: infrastructure.sdkworkApiRouterAdminClient.createModel,
    deleteModel: infrastructure.sdkworkApiRouterAdminClient.deleteModel,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  const providerRecord = {
    id: 'provider-update-target',
    channel_id: 'openai',
    extension_id: 'sdkwork.provider.custom-openai',
    adapter_kind: 'custom-openai',
    base_url: 'https://router-before.example.com/v1',
    display_name: 'OpenAI Before',
    channel_bindings: [
      {
        channel_id: 'openai',
        is_primary: true,
      },
    ],
  };
  const credentialRecord = {
    tenant_id: 'team-ops',
    provider_id: 'provider-update-target',
    key_reference: 'cred-update-target',
    secret_backend: 'keyring',
  };
  let modelRecords = [
    {
      external_name: 'gpt-5.4',
      provider_id: 'provider-update-target',
      capabilities: ['responses'],
      streaming: true,
      context_window: 200000,
    },
    {
      external_name: 'gpt-4.1-mini',
      provider_id: 'provider-update-target',
      capabilities: ['chat_completions'],
      streaming: true,
      context_window: 128000,
    },
  ];
  const createProviderRequests: Array<{
    id: string;
    channel_id: string;
    extension_id?: string;
    adapter_kind: string;
    base_url: string;
    display_name: string;
    channel_bindings?: Array<{ channel_id: string; is_primary?: boolean }>;
  }> = [];
  const createCredentialRequests: Array<{
    tenant_id: string;
    provider_id: string;
    key_reference: string;
    secret_value: string;
  }> = [];
  const createModelRequests: Array<{
    external_name: string;
    provider_id: string;
    capabilities?: string[];
    streaming?: boolean;
    context_window?: number | null;
  }> = [];
  const deleteModelRequests: Array<{
    externalName: string;
    providerId: string;
  }> = [];

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () =>
    clone([providerRecord]);
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () =>
    clone([credentialRecord]);
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => clone(modelRecords);
  infrastructure.sdkworkApiRouterAdminClient.listUsageRecords = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.listTenants = async () => [
    {
      id: 'team-ops',
      name: 'Team Ops',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots = async () => [
    {
      provider_id: 'provider-update-target',
      extension_id: 'sdkwork.provider.custom-openai',
      runtime: 'connector',
      observed_at_ms: 1_710_002_000_000,
      instance_id: 'provider-update-target',
      running: true,
      healthy: true,
      message: null,
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.createProvider = async (request) => {
    createProviderRequests.push(clone(request));
    providerRecord.base_url = request.base_url;
    providerRecord.display_name = request.display_name;
    providerRecord.adapter_kind = request.adapter_kind;
    providerRecord.extension_id =
      request.extension_id || providerRecord.extension_id;
    providerRecord.channel_bindings = request.channel_bindings?.map((binding) => ({
      channel_id: binding.channel_id,
      is_primary: binding.is_primary ?? false,
    })) || providerRecord.channel_bindings;
    return clone(providerRecord);
  };
  infrastructure.sdkworkApiRouterAdminClient.createCredential = async (request) => {
    createCredentialRequests.push(clone(request));
    return {
      tenant_id: request.tenant_id,
      provider_id: request.provider_id,
      key_reference: request.key_reference,
      secret_backend: 'keyring',
    };
  };
  infrastructure.sdkworkApiRouterAdminClient.createModel = async (request) => {
    createModelRequests.push(clone(request));
    modelRecords = modelRecords
      .filter(
        (record) =>
          !(
            record.external_name === request.external_name
            && record.provider_id === request.provider_id
          ),
      )
      .concat({
        external_name: request.external_name,
        provider_id: request.provider_id,
        capabilities: request.capabilities || [],
        streaming: request.streaming ?? true,
        context_window: request.context_window ?? null,
      });
    return clone(modelRecords[modelRecords.length - 1]);
  };
  infrastructure.sdkworkApiRouterAdminClient.deleteModel = async (
    externalName,
    providerId,
  ) => {
    deleteModelRequests.push({
      externalName,
      providerId,
    });
    modelRecords = modelRecords.filter(
      (record) =>
        !(record.external_name === externalName && record.provider_id === providerId),
    );
    return true;
  };
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone(createRouterChannelCatalog());

  try {
    const [provider] = await apiRouterService.getProxyProviders({
      channelId: 'openai',
      groupId: 'team-ops',
    });
    assert.ok(provider);
    assert.equal(provider.canCopyApiKey, false);
    assert.equal(provider.apiKey, '');

    const updatedModels: ProxyProviderModel[] = [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
      },
      {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 Nano',
      },
    ];

    const updated = await apiRouterService.updateProvider(provider.id, {
      name: 'OpenAI After',
      groupId: 'team-ops',
      baseUrl: 'https://router-after.example.com/v1',
      models: updatedModels,
      notes: 'ignored by router backend',
      expiresAt: '2026-09-01T23:59:59.000Z',
    });

    assert.equal(createProviderRequests.length, 1);
    assert.equal(createProviderRequests[0]?.id, 'provider-update-target');
    assert.equal(
      createProviderRequests[0]?.base_url,
      'https://router-after.example.com/v1',
    );
    assert.equal(createProviderRequests[0]?.display_name, 'OpenAI After');
    assert.equal(createCredentialRequests.length, 0);
    assert.equal(
      deleteModelRequests.some(
        (request) =>
          request.externalName === 'gpt-4.1-mini'
          && request.providerId === 'provider-update-target',
      ),
      true,
    );
    assert.equal(
      createModelRequests.some(
        (request) =>
          request.external_name === 'gpt-4.1-nano'
          && request.provider_id === 'provider-update-target',
      ),
      true,
    );

    assert.equal(updated.name, 'OpenAI After');
    assert.equal(updated.baseUrl, 'https://router-after.example.com/v1');
    assert.equal(updated.apiKey, '');
    assert.equal(updated.canCopyApiKey, false);
    assert.equal(updated.credentialReference, 'cred-update-target');
    assert.equal(updated.notes, undefined);
    assert.equal(updated.expiresAt, null);
    assert.deepEqual(updated.models, updatedModels);
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listUsageRecords =
      originalAdminClient.listUsageRecords;
    infrastructure.sdkworkApiRouterAdminClient.listTenants =
      originalAdminClient.listTenants;
    infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots =
      originalAdminClient.listProviderHealthSnapshots;
    infrastructure.sdkworkApiRouterAdminClient.createProvider =
      originalAdminClient.createProvider;
    infrastructure.sdkworkApiRouterAdminClient.createCredential =
      originalAdminClient.createCredential;
    infrastructure.sdkworkApiRouterAdminClient.createModel =
      originalAdminClient.createModel;
    infrastructure.sdkworkApiRouterAdminClient.deleteModel =
      originalAdminClient.deleteModel;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('apiRouterService rejects moving a router-backed provider to another group when the plaintext secret is unavailable', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listUsageRecords: infrastructure.sdkworkApiRouterAdminClient.listUsageRecords,
    listProviderHealthSnapshots:
      infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => [
    {
      id: 'provider-group-lock',
      channel_id: 'openai',
      extension_id: 'sdkwork.provider.custom-openai',
      adapter_kind: 'custom-openai',
      base_url: 'https://router-lock.example.com/v1',
      display_name: 'Group Locked Provider',
      channel_bindings: [
        {
          channel_id: 'openai',
          is_primary: true,
        },
      ],
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () => [
    {
      tenant_id: 'team-ops',
      provider_id: 'provider-group-lock',
      key_reference: 'cred-group-lock',
      secret_backend: 'keyring',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => [
    {
      external_name: 'gpt-5.4',
      provider_id: 'provider-group-lock',
      capabilities: ['responses'],
      streaming: true,
      context_window: 200000,
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listUsageRecords = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots = async () => [];
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone(createRouterChannelCatalog());

  try {
    const [provider] = await apiRouterService.getProxyProviders({
      channelId: 'openai',
      groupId: 'team-ops',
    });
    assert.ok(provider);
    assert.equal(provider.apiKey, '');
    assert.equal(provider.canCopyApiKey, false);

    await assert.rejects(
      () => apiRouterService.updateGroup(provider.id, 'team-web'),
      /re-entering the API key/i,
    );
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listUsageRecords =
      originalAdminClient.listUsageRecords;
    infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots =
      originalAdminClient.listProviderHealthSnapshots;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('apiRouterService rejects manual status toggles for router-backed providers because status is derived from health snapshots', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listUsageRecords: infrastructure.sdkworkApiRouterAdminClient.listUsageRecords,
    listProviderHealthSnapshots:
      infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => [
    {
      id: 'provider-status-derived',
      channel_id: 'openai',
      extension_id: 'sdkwork.provider.custom-openai',
      adapter_kind: 'custom-openai',
      base_url: 'https://router-status.example.com/v1',
      display_name: 'Status Derived Provider',
      channel_bindings: [
        {
          channel_id: 'openai',
          is_primary: true,
        },
      ],
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () => [
    {
      tenant_id: 'team-ops',
      provider_id: 'provider-status-derived',
      key_reference: 'cred-status-derived',
      secret_backend: 'keyring',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => [
    {
      external_name: 'gpt-5.4',
      provider_id: 'provider-status-derived',
      capabilities: ['responses'],
      streaming: true,
      context_window: 200000,
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listUsageRecords = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots = async () => [
    {
      provider_id: 'provider-status-derived',
      extension_id: 'sdkwork.provider.custom-openai',
      runtime: 'connector',
      observed_at_ms: 1_710_002_000_000,
      instance_id: 'provider-status-derived',
      running: true,
      healthy: true,
      message: null,
    },
  ];
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone(createRouterChannelCatalog());

  try {
    const [provider] = await apiRouterService.getProxyProviders({
      channelId: 'openai',
      groupId: 'team-ops',
    });
    assert.ok(provider);
    assert.equal(provider.status, 'active');

    await assert.rejects(
      () => apiRouterService.updateStatus(provider.id, 'disabled'),
      /health snapshots/i,
    );
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listUsageRecords =
      originalAdminClient.listUsageRecords;
    infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots =
      originalAdminClient.listProviderHealthSnapshots;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('apiRouterService deletes router-backed provider rows by removing the tenant credential first and cleaning up catalog rows when it is the last credential', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listUsageRecords: infrastructure.sdkworkApiRouterAdminClient.listUsageRecords,
    listTenants: infrastructure.sdkworkApiRouterAdminClient.listTenants,
    listProviderHealthSnapshots:
      infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots,
    deleteCredential: infrastructure.sdkworkApiRouterAdminClient.deleteCredential,
    deleteModel: infrastructure.sdkworkApiRouterAdminClient.deleteModel,
    deleteProvider: infrastructure.sdkworkApiRouterAdminClient.deleteProvider,
  };
  const originalListApiRouterChannels =
    infrastructure.studioMockService.listApiRouterChannels;

  const deleteCredentialRequests: Array<{
    tenantId: string;
    providerId: string;
    keyReference: string;
  }> = [];
  const deleteModelRequests: Array<{
    externalName: string;
    providerId: string;
  }> = [];
  const deleteProviderRequests: string[] = [];

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => [
    {
      id: 'provider-delete-target',
      channel_id: 'openai',
      extension_id: 'sdkwork.provider.custom-openai',
      adapter_kind: 'custom-openai',
      base_url: 'https://router-delete.example.com/v1',
      display_name: 'Delete Target',
      channel_bindings: [
        {
          channel_id: 'openai',
          is_primary: true,
        },
      ],
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () => [
    {
      tenant_id: 'team-ops',
      provider_id: 'provider-delete-target',
      key_reference: 'cred-delete-target',
      secret_backend: 'keyring',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => [
    {
      external_name: 'gpt-5.4',
      provider_id: 'provider-delete-target',
      capabilities: ['responses'],
      streaming: true,
      context_window: 200000,
    },
    {
      external_name: 'gpt-4.1-mini',
      provider_id: 'provider-delete-target',
      capabilities: ['chat_completions'],
      streaming: true,
      context_window: 128000,
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listUsageRecords = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.listTenants = async () => [
    {
      id: 'team-ops',
      name: 'Team Ops',
    },
  ];
  infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots = async () => [];
  infrastructure.sdkworkApiRouterAdminClient.deleteCredential = async (
    tenantId,
    providerId,
    keyReference,
  ) => {
    deleteCredentialRequests.push({
      tenantId,
      providerId,
      keyReference,
    });
    return true;
  };
  infrastructure.sdkworkApiRouterAdminClient.deleteModel = async (
    externalName,
    providerId,
  ) => {
    deleteModelRequests.push({
      externalName,
      providerId,
    });
    return true;
  };
  infrastructure.sdkworkApiRouterAdminClient.deleteProvider = async (providerId) => {
    deleteProviderRequests.push(providerId);
    return true;
  };
  infrastructure.studioMockService.listApiRouterChannels = async () =>
    clone(createRouterChannelCatalog());

  try {
    const [provider] = await apiRouterService.getProxyProviders({
      channelId: 'openai',
      groupId: 'team-ops',
    });
    assert.ok(provider);

    const deleted = await apiRouterService.deleteProvider(provider.id);

    assert.equal(deleted, true);
    assert.deepEqual(deleteCredentialRequests, [
      {
        tenantId: 'team-ops',
        providerId: 'provider-delete-target',
        keyReference: 'cred-delete-target',
      },
    ]);
    assert.deepEqual(deleteModelRequests, [
      {
        externalName: 'gpt-5.4',
        providerId: 'provider-delete-target',
      },
      {
        externalName: 'gpt-4.1-mini',
        providerId: 'provider-delete-target',
      },
    ]);
    assert.deepEqual(deleteProviderRequests, ['provider-delete-target']);
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listUsageRecords =
      originalAdminClient.listUsageRecords;
    infrastructure.sdkworkApiRouterAdminClient.listTenants =
      originalAdminClient.listTenants;
    infrastructure.sdkworkApiRouterAdminClient.listProviderHealthSnapshots =
      originalAdminClient.listProviderHealthSnapshots;
    infrastructure.sdkworkApiRouterAdminClient.deleteCredential =
      originalAdminClient.deleteCredential;
    infrastructure.sdkworkApiRouterAdminClient.deleteModel =
      originalAdminClient.deleteModel;
    infrastructure.sdkworkApiRouterAdminClient.deleteProvider =
      originalAdminClient.deleteProvider;
    infrastructure.studioMockService.listApiRouterChannels =
      originalListApiRouterChannels;
  }
});

await runTest('apiRouterService rejects reads when router admin access is unavailable instead of falling back to mock provider data', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listTenants: infrastructure.sdkworkApiRouterAdminClient.listTenants,
  };

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };
  infrastructure.sdkworkApiRouterAdminClient.listTenants = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };

  try {
    await assert.rejects(
      () => apiRouterService.getProxyProviders({ channelId: 'openai' }),
      /401|unauthorized/i,
    );
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listTenants =
      originalAdminClient.listTenants;
  }
});

await runTest('apiRouterService rejects writes when router admin access is unavailable instead of creating mock providers', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const originalAdminClient = {
    listProviders: infrastructure.sdkworkApiRouterAdminClient.listProviders,
    listCredentials: infrastructure.sdkworkApiRouterAdminClient.listCredentials,
    listModels: infrastructure.sdkworkApiRouterAdminClient.listModels,
    listTenants: infrastructure.sdkworkApiRouterAdminClient.listTenants,
  };

  infrastructure.sdkworkApiRouterAdminClient.listProviders = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };
  infrastructure.sdkworkApiRouterAdminClient.listCredentials = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };
  infrastructure.sdkworkApiRouterAdminClient.listModels = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };
  infrastructure.sdkworkApiRouterAdminClient.listTenants = async () => {
    throw new Error('sdkwork-api-router admin request failed: 401 Unauthorized');
  };

  try {
    await assert.rejects(
      () =>
        apiRouterService.createProvider({
          channelId: 'openai',
          name: 'Unavailable Provider',
          apiKey: 'sk-router-unavailable',
          groupId: 'team-local',
          baseUrl: 'https://router.openai.example.com/v1',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
        }),
      /401|unauthorized/i,
    );
  } finally {
    infrastructure.sdkworkApiRouterAdminClient.listProviders =
      originalAdminClient.listProviders;
    infrastructure.sdkworkApiRouterAdminClient.listCredentials =
      originalAdminClient.listCredentials;
    infrastructure.sdkworkApiRouterAdminClient.listModels =
      originalAdminClient.listModels;
    infrastructure.sdkworkApiRouterAdminClient.listTenants =
      originalAdminClient.listTenants;
  }
});
