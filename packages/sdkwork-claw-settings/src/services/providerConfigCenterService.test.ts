import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/claw-types';
import {
  PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
  createProviderConfigCenterService,
  type ProviderConfigDraft,
  type ProviderConfigRecord,
} from './providerConfigCenterService.ts';

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

function createDraft(overrides: Partial<ProviderConfigDraft> = {}): ProviderConfigDraft {
  return {
    name: 'OpenAI Production',
    providerId: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-live-secret',
    defaultModelId: 'gpt-5.4',
    reasoningModelId: 'o4-mini',
    embeddingModelId: 'text-embedding-3-large',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'o4-mini', name: 'o4-mini' },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
    ],
    config: {
      temperature: 0.2,
      topP: 1,
      maxTokens: 12000,
      timeoutMs: 120000,
      streaming: true,
    },
    ...overrides,
  };
}

function createOpenClawInstance(
  overrides: Partial<StudioInstanceRecord> = {},
): StudioInstanceRecord {
  return {
    id: 'local-built-in',
    name: 'Local Built-In',
    description: 'Bundled OpenClaw runtime.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: '2026.3.26',
    typeLabel: 'OpenClaw Gateway',
    host: '127.0.0.1',
    port: 18789,
    baseUrl: 'http://127.0.0.1:18789',
    websocketUrl: 'ws://127.0.0.1:18789',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'models'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
      authToken: 'token',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
    ...overrides,
  };
}

function createOpenClawDetail(
  overrides: Partial<StudioInstanceDetailRecord> = {},
): StudioInstanceDetailRecord {
  const instance = createOpenClawInstance();
  return {
    instance,
    config: instance.config,
    logs: '',
    health: {
      score: 90,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appManaged',
      startStopSupported: true,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'claw-studio',
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
      routes: [
        {
          id: 'config',
          label: 'Config',
          scope: 'config',
          mode: 'managedFile',
          status: 'ready',
          target: 'D:/OpenClaw/.openclaw/openclaw.json',
          readonly: false,
          authoritative: true,
          detail: 'Writable config file',
          source: 'config',
        },
      ],
    },
    artifacts: [
      {
        id: 'config-file',
        label: 'Config File',
        kind: 'configFile',
        status: 'configured',
        location: 'D:/OpenClaw/.openclaw/openclaw.json',
        readonly: false,
        detail: 'Writable config file',
        source: 'config',
      },
    ],
    capabilities: [],
    officialRuntimeNotes: [],
    ...overrides,
  };
}

await runTest('providerConfigCenterService persists route configs in the sqlite storage namespace and reads them back', async () => {
  const store = new Map<string, string>();
  const putCalls: Array<{ profileId?: string | null; namespace?: string | null; key: string }> = [];
  const service = createProviderConfigCenterService({
    now: () => 1_742_950_000_000,
    storageApi: {
      getStorageInfo: async () => ({
        activeProfileId: 'default-local',
        rootDir: 'D:/storage',
        providers: [],
        profiles: [
          {
            id: 'default-local',
            label: 'Managed Local File',
            provider: 'localFile',
            active: true,
            availability: 'ready',
            namespace: 'claw-studio',
            readOnly: false,
            connectionConfigured: false,
            databaseConfigured: false,
            endpointConfigured: false,
          },
          {
            id: 'default-sqlite',
            label: 'SQLite',
            provider: 'sqlite',
            active: false,
            availability: 'ready',
            namespace: 'claw-studio',
            readOnly: false,
            path: 'D:/storage/profiles/default.db',
            connectionConfigured: false,
            databaseConfigured: false,
            endpointConfigured: false,
          },
        ],
      }),
      getText: async ({ namespace, key }) => ({
        profileId: 'default-sqlite',
        namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key,
        value: store.get(`${namespace}:${key}`) ?? null,
      }),
      putText: async ({ profileId, namespace, key, value }) => {
        putCalls.push({ profileId, namespace, key });
        store.set(`${namespace}:${key}`, value);
        return {
          profileId: profileId || 'default-sqlite',
          namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
          key,
        };
      },
      delete: async ({ namespace, key }) => {
        const lookupKey = `${namespace}:${key}`;
        const existed = store.delete(lookupKey);
        return {
          profileId: 'default-sqlite',
          namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
          key,
          existed,
        };
      },
      listKeys: async ({ namespace } = {}) => ({
        profileId: 'default-sqlite',
        namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        keys: Array.from(store.keys())
          .map((entry) => entry.split(':').slice(1).join(':'))
          .sort((left, right) => left.localeCompare(right)),
      }),
    },
  });

  const saved = await service.saveProviderConfig(createDraft());
  const listed = await service.listProviderConfigs();

  assert.equal(saved.providerId, 'openai');
  assert.equal(saved.id.startsWith('provider-config-openai-'), true);
  assert.deepEqual(putCalls, [
    {
      profileId: 'default-sqlite',
      namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
      key: saved.id,
    },
  ]);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, saved.id);
  assert.equal(listed[0]?.embeddingModelId, 'text-embedding-3-large');
});

await runTest('providerConfigCenterService normalizes invalid runtime config values before persisting', async () => {
  const store = new Map<string, string>();
  const service = createProviderConfigCenterService({
    now: () => 1_742_950_000_100,
    storageApi: {
      getStorageInfo: async () => null,
      getText: async ({ namespace, key }) => ({
        profileId: 'default-sqlite',
        namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key,
        value: store.get(`${namespace}:${key}`) ?? null,
      }),
      putText: async ({ namespace, key, value }) => {
        store.set(`${namespace}:${key}`, value);
        return {
          profileId: 'default-sqlite',
          namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
          key,
        };
      },
      delete: async ({ namespace, key }) => ({
        profileId: 'default-sqlite',
        namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key,
        existed: false,
      }),
      listKeys: async ({ namespace } = {}) => ({
        profileId: 'default-sqlite',
        namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        keys: Array.from(store.keys()).map((entry) => entry.split(':').slice(1).join(':')),
      }),
    },
  });

  const saved = await service.saveProviderConfig(
    createDraft({
      config: {
        temperature: Number.NaN,
        topP: Number.POSITIVE_INFINITY,
        maxTokens: Number.NaN,
        timeoutMs: Number.NaN,
        streaming: false,
      },
    }),
  );

  assert.deepEqual(saved.config, {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: false,
  });
});

await runTest('providerConfigCenterService exposes writable OpenClaw instances and their agent targets', async () => {
  const service = createProviderConfigCenterService({
    storageApi: {
      getStorageInfo: async () => null,
      getText: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
        value: null,
      }),
      putText: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
      }),
      delete: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
        existed: false,
      }),
      listKeys: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        keys: [],
      }),
    },
    studioApi: {
      listInstances: async () => [
        createOpenClawInstance(),
        createOpenClawInstance({
          id: 'remote-custom',
          runtimeKind: 'custom',
          deploymentMode: 'remote',
          isDefault: false,
          isBuiltIn: false,
        }),
      ],
      getInstanceDetail: async () => createOpenClawDetail(),
    },
    openClawConfigService: {
      resolveInstanceConfigPath: () => 'D:/OpenClaw/.openclaw/openclaw.json',
      readConfigSnapshot: async () =>
        ({
          agentSnapshots: [
            {
              id: 'main',
              name: 'Main',
              avatar: 'M',
              description: 'Default agent',
              workspace: 'D:/OpenClaw/workspace',
              agentDir: 'D:/OpenClaw/agents/main/agent',
              isDefault: true,
              model: {
                primary: 'openai/gpt-4.1',
                fallbacks: [],
              },
              params: {},
            },
            {
              id: 'research',
              name: 'Research',
              avatar: 'R',
              description: 'Research agent',
              workspace: 'D:/OpenClaw/workspace-research',
              agentDir: 'D:/OpenClaw/agents/research/agent',
              isDefault: false,
              model: {
                primary: 'openai/gpt-4.1',
                fallbacks: [],
              },
              params: {},
            },
          ],
        }) as any,
    },
  });

  const instances = await service.listApplyInstances();
  const target = await service.getInstanceApplyTarget('local-built-in');

  assert.deepEqual(
    instances.map((instance) => instance.id),
    ['local-built-in'],
  );
  assert.equal(target.instance.configPath, 'D:/OpenClaw/.openclaw/openclaw.json');
  assert.deepEqual(
    target.agents.map((agent) => agent.id),
    ['main', 'research'],
  );
  assert.equal(target.agents[0]?.isDefault, true);
});

await runTest('providerConfigCenterService applies a saved provider config to instance defaults and selected agents', async () => {
  const providerCalls: Array<unknown> = [];
  const agentCalls: Array<unknown> = [];
  const record = {
    id: 'provider-config-openai-prod',
    createdAt: 1,
    updatedAt: 1,
    ...createDraft(),
  } satisfies ProviderConfigRecord;
  const service = createProviderConfigCenterService({
    storageApi: {
      getStorageInfo: async () => null,
      getText: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
        value: null,
      }),
      putText: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
      }),
      delete: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
        existed: false,
      }),
      listKeys: async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        keys: [],
      }),
    },
    studioApi: {
      getInstanceDetail: async () => createOpenClawDetail(),
    },
    openClawConfigService: {
      resolveInstanceConfigPath: () => 'D:/OpenClaw/.openclaw/openclaw.json',
      saveProviderSelection: async (input) => {
        providerCalls.push(input);
        return null;
      },
      saveAgent: async (input) => {
        agentCalls.push(input);
        return null;
      },
    },
  });

  await service.applyProviderConfig({
    instanceId: 'local-built-in',
    config: record,
    agentIds: ['main', 'research'],
  });

  assert.deepEqual(providerCalls, [
    {
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      provider: {
        id: 'openai',
        channelId: 'openai',
        name: 'OpenAI Production',
        apiKey: 'sk-live-secret',
        baseUrl: 'https://api.openai.com/v1',
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4' },
          { id: 'o4-mini', name: 'o4-mini' },
          { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
        ],
        notes: undefined,
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 12000,
          timeoutMs: 120000,
          streaming: true,
        },
      },
      selection: {
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
      },
    },
  ]);
  assert.deepEqual(agentCalls, [
    {
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'main',
        model: {
          primary: 'openai/gpt-5.4',
          fallbacks: ['openai/o4-mini'],
        },
      },
    },
    {
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'research',
        model: {
          primary: 'openai/gpt-5.4',
          fallbacks: ['openai/o4-mini'],
        },
      },
    },
  ]);
});
