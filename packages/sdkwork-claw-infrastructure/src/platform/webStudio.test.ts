import assert from 'node:assert/strict';
import { DEFAULT_BUNDLED_OPENCLAW_VERSION } from '@sdkwork/claw-types';
import { WebStudioPlatform } from './webStudio.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const INSTANCE_STORAGE_KEY = 'claw-studio:studio:instances:v1';
const WORKBENCH_STORAGE_KEY = 'claw-studio:studio:workbench:v1';

interface MockedWindowStorageContext {
  storage: Map<string, string>;
  readJson(key: string): unknown;
}

async function withMockedWindowStorage(
  fn: (context: MockedWindowStorageContext) => Promise<void>,
) {
  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  (globalThis as typeof globalThis & { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  try {
    await fn({
      storage,
      readJson(key: string) {
        const value = storage.get(key);
        return value ? JSON.parse(value) : null;
      },
    });
  } finally {
    (globalThis as typeof globalThis & { window?: unknown }).window = originalWindow;
  }
}

await runTest('web studio persists created OpenClaw workbench tasks through instance detail', async () => {
  await withMockedWindowStorage(async () => {
    const platform = new WebStudioPlatform();
    const taskName = 'Web studio main session cron test';

    await platform.createInstanceTask('local-built-in', {
      name: taskName,
      description: 'Runs on the main session heartbeat.',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 9 * * *',
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        text: 'Post a main-session reminder.',
      },
    });

    const detail = await platform.getInstanceDetail('local-built-in');
    const created = detail?.workbench?.cronTasks.tasks.find((task) => task.name === taskName);

    assert.ok(created);
    assert.equal(created.sessionMode, 'main');
    assert.equal(created.executionContent, 'sendPromptMessage');
    assert.equal(created.deliveryMode, 'none');
    assert.equal(created.deliveryChannel, undefined);
    assert.equal(created.recipient, undefined);
  });
});

await runTest('web studio preserves advanced OpenClaw cron fields inside the persisted workbench detail', async () => {
  await withMockedWindowStorage(async () => {
    const platform = new WebStudioPlatform();

    await platform.createInstanceTask('local-built-in', {
      name: 'Web studio advanced cron source',
      description: 'Created as a baseline task before OpenClaw-style update.',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 8 * * *',
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'Baseline prompt.',
        timeoutSeconds: 120,
      },
      delivery: {
        mode: 'announce',
        channel: 'telegram',
        to: 'channel:baseline',
      },
    });

    const originalDetail = await platform.getInstanceDetail('local-built-in');
    const original = originalDetail?.workbench?.cronTasks.tasks.find(
      (task) => task.name === 'Web studio advanced cron source',
    );

    assert.ok(original);

    await platform.updateInstanceTask('local-built-in', original.id, {
      name: 'Web studio advanced cron mapped',
      description: 'Uses a persistent custom session and webhook delivery.',
      enabled: false,
      deleteAfterRun: true,
      agentId: 'ops',
      schedule: {
        kind: 'cron',
        expr: '0 7 * * *',
        tz: 'Asia/Shanghai',
        staggerMs: 30000,
      },
      sessionTarget: 'session:project-alpha-monitor',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'Summarize overnight updates.',
        model: 'openai/gpt-5.4',
        thinking: 'high',
        timeoutSeconds: 600,
        lightContext: true,
      },
      delivery: {
        mode: 'webhook',
        to: 'https://hooks.example.com/openclaw/cron',
        bestEffort: true,
      },
    });

    const updatedDetail = await platform.getInstanceDetail('local-built-in');
    const updated = updatedDetail?.workbench?.cronTasks.tasks.find((task) => task.id === original.id);

    assert.ok(updated);
    assert.equal(updated.name, 'Web studio advanced cron mapped');
    assert.equal(updated.status, 'paused');
    assert.equal(updated.sessionMode, 'custom');
    assert.equal(updated.customSessionId, 'project-alpha-monitor');
    assert.equal(updated.executionContent, 'runAssistantTask');
    assert.equal(updated.deleteAfterRun, true);
    assert.equal(updated.agentId, 'ops');
    assert.equal(updated.model, 'openai/gpt-5.4');
    assert.equal(updated.thinking, 'high');
    assert.equal(updated.lightContext, true);
    assert.equal(updated.deliveryMode, 'webhook');
    assert.equal(updated.deliveryBestEffort, true);
    assert.equal(updated.deliveryChannel, undefined);
    assert.equal(updated.recipient, 'https://hooks.example.com/openclaw/cron');
    assert.equal(updated.scheduleConfig.cronTimezone, 'Asia/Shanghai');
    assert.equal(updated.scheduleConfig.staggerMs, 30000);
  });
});

await runTest('web studio persists current-session OpenClaw jobs, file edits, and provider edits through the workbench detail', async () => {
  await withMockedWindowStorage(async ({ readJson }) => {
    const platform = new WebStudioPlatform();
    const taskName = 'Web studio current session cron test';

    await platform.createInstanceTask('local-built-in', {
      name: taskName,
      description: 'Runs against the current session context.',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '*/30 * * * *',
      },
      sessionTarget: 'current',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'Check the current session context.',
        timeoutSeconds: 90,
      },
      delivery: {
        mode: 'announce',
        channel: 'telegram',
        to: 'channel:current-session',
        bestEffort: true,
      },
    });

    const taskDetail = await platform.getInstanceDetail('local-built-in');
    const created = taskDetail?.workbench?.cronTasks.tasks.find((task) => task.name === taskName);

    assert.ok(created);
    assert.equal(created.sessionMode, 'current');
    assert.equal(created.customSessionId, undefined);
    assert.equal(created.deliveryMode, 'publishSummary');
    assert.equal(created.deliveryBestEffort, true);
    assert.equal(created.deliveryChannel, 'telegram');
    assert.equal(created.recipient, 'channel:current-session');

    const nextAgentsContent = '# Updated from web fallback';
    const nextModelId = 'gpt-5.4';

    const fileUpdated = await platform.updateInstanceFileContent(
      'local-built-in',
      '/workspace/main/AGENTS.md',
      nextAgentsContent,
    );
    const providerUpdated = await platform.updateInstanceLlmProviderConfig('local-built-in', 'openai', {
      endpoint: 'https://api.openai.com/v1',
      apiKeySource: 'env:OPENAI_API_KEY',
      defaultModelId: nextModelId,
      reasoningModelId: 'o4-mini',
      embeddingModelId: 'text-embedding-3-large',
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 4096,
        timeoutMs: 60000,
        streaming: true,
      },
    });

    assert.equal(fileUpdated, true);
    assert.equal(providerUpdated, true);

    const updatedDetail = await platform.getInstanceDetail('local-built-in');
    assert.equal(
      updatedDetail?.workbench?.files.find((file) => file.id === '/workspace/main/AGENTS.md')?.content,
      nextAgentsContent,
    );
    assert.equal(
      updatedDetail?.workbench?.llmProviders.find((provider) => provider.id === 'openai')?.defaultModelId,
      nextModelId,
    );
    const persistedWorkbench = readJson(WORKBENCH_STORAGE_KEY) as {
      workbenches?: Record<string, {
        llmProviders?: Array<{
          id: string;
          endpoint?: string;
          apiKeySource?: string;
          config?: {
            request?: unknown;
          };
        }>;
      }>;
    } | null;
    const persistedProvider = persistedWorkbench?.workbenches?.['local-built-in']?.llmProviders?.find(
      (provider) => provider.id === 'openai',
    );

    assert.ok(persistedProvider);
    assert.equal(persistedProvider?.endpoint, 'https://api.openai.com/v1');
    assert.equal(persistedProvider?.apiKeySource, '');
    assert.equal(persistedProvider?.config?.request, undefined);
  });
});

await runTest('web studio persists managed channel configuration through the browser workbench detail', async () => {
  await withMockedWindowStorage(async ({ readJson }) => {
    const platform = new WebStudioPlatform();

    const saved = await platform.saveInstanceChannelConfig('local-built-in', 'wehcat', {
      appId: 'wx1234567890abcdef',
      appSecret: 'secret',
      token: 'verify-token',
    });

    assert.equal(saved, true);

    let detail = await platform.getInstanceDetail('local-built-in');
    let wehcat = detail?.workbench?.channels.find((channel) => channel.id === 'wehcat') as
      | ({ values?: Record<string, string> } & NonNullable<
          NonNullable<typeof detail>['workbench']
        >['channels'][number])
      | undefined;

    assert.ok(wehcat);
    assert.equal(wehcat?.enabled, true);
    assert.equal(wehcat?.status, 'connected');
    assert.equal(wehcat?.configuredFieldCount, 3);
    assert.equal(wehcat?.values?.appId, 'wx1234567890abcdef');
    assert.equal(wehcat?.values?.appSecret, undefined);
    assert.equal(wehcat?.values?.token, undefined);

    const persistedWorkbench = readJson(WORKBENCH_STORAGE_KEY) as {
      workbenches?: Record<string, {
        channels?: Array<{
          id: string;
          configuredFieldCount?: number;
          values?: Record<string, string>;
        }>;
        files?: Array<{
          id: string;
          content: string;
        }>;
      }>;
    } | null;
    const persistedWehcat = persistedWorkbench?.workbenches?.['local-built-in']?.channels?.find(
      (channel) => channel.id === 'wehcat',
    );
    const persistedConfigFile = persistedWorkbench?.workbenches?.['local-built-in']?.files?.find(
      (file) => file.id === '/workspace/main/openclaw.json',
    );
    const persistedConfigRoot = persistedConfigFile
      ? JSON.parse(persistedConfigFile.content) as {
          channels?: Record<string, Record<string, unknown>>;
        }
      : null;

    assert.ok(persistedWehcat);
    assert.equal(persistedWehcat?.configuredFieldCount, 3);
    assert.deepEqual(persistedWehcat?.values, {
      appId: 'wx1234567890abcdef',
    });
    assert.deepEqual(persistedConfigRoot?.channels?.wehcat, {
      appId: 'wx1234567890abcdef',
      enabled: true,
    });

    const disabled = await platform.setInstanceChannelEnabled('local-built-in', 'wehcat', false);
    assert.equal(disabled, true);

    detail = await platform.getInstanceDetail('local-built-in');
    wehcat = detail?.workbench?.channels.find((channel) => channel.id === 'wehcat') as
      | ({ values?: Record<string, string> } & NonNullable<
          NonNullable<typeof detail>['workbench']
        >['channels'][number])
      | undefined;

    assert.ok(wehcat);
    assert.equal(wehcat?.enabled, false);
    assert.equal(wehcat?.status, 'disconnected');
    assert.equal(wehcat?.configuredFieldCount, 3);
    assert.equal(wehcat?.values?.token, undefined);

    const deleted = await platform.deleteInstanceChannelConfig('local-built-in', 'wehcat');
    assert.equal(deleted, true);

    detail = await platform.getInstanceDetail('local-built-in');
    wehcat = detail?.workbench?.channels.find((channel) => channel.id === 'wehcat') as
      | ({ values?: Record<string, string> } & NonNullable<
          NonNullable<typeof detail>['workbench']
        >['channels'][number])
      | undefined;

    assert.ok(wehcat);
    assert.equal(wehcat?.enabled, false);
    assert.equal(wehcat?.status, 'not_configured');
    assert.deepEqual(wehcat?.values || {}, {});
  });
});

await runTest('web studio does not fabricate OpenAI HTTP endpoints for the built-in OpenClaw gateway metadata', async () => {
  const platform = new WebStudioPlatform();

  const detail = await platform.getInstanceDetail('local-built-in');

  assert.ok(detail);
  assert.equal(detail.lifecycle.owner, 'appManaged');
  assert.equal(detail.lifecycle.startStopSupported, false);
  assert.equal(detail.lifecycle.configWritable, true);
  assert.equal(detail.lifecycle.lifecycleControllable, false);
  assert.equal(detail.lifecycle.workbenchManaged, true);
  assert.equal(detail.lifecycle.endpointObserved, false);
  assert.ok(detail.connectivity.endpoints.some((endpoint) => endpoint.id === 'gateway-http'));
  assert.ok(detail.connectivity.endpoints.some((endpoint) => endpoint.id === 'gateway-ws'));
  assert.ok(!detail.connectivity.endpoints.some((endpoint) => endpoint.id === 'openai-http-chat'));
  assert.ok(
    detail.officialRuntimeNotes.some((note) =>
      note.content.includes('optionally expose OpenAI-compatible HTTP endpoints when enabled'),
    ),
  );
});

await runTest('web studio preserves an explicitly configured OpenClaw responses endpoint without inventing chat completions', async () => {
  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  (globalThis as typeof globalThis & { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  try {
    const platform = new WebStudioPlatform();
    const created = await platform.createInstance({
      name: 'Responses Runtime',
      description: 'OpenClaw runtime with an explicit responses endpoint.',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      iconType: 'server',
      typeLabel: 'OpenClaw Responses',
      host: '127.0.0.1',
      port: 18802,
      baseUrl: 'http://127.0.0.1:18802/v1/responses',
      websocketUrl: 'ws://127.0.0.1:18802',
      config: {
        port: '18802',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18802/v1/responses',
        websocketUrl: 'ws://127.0.0.1:18802',
      },
    });

    const detail = await platform.getInstanceDetail(created.id);

    assert.ok(detail);
    assert.ok(detail.connectivity.endpoints.some((endpoint) => endpoint.id === 'gateway-http'));
    assert.ok(detail.connectivity.endpoints.some((endpoint) => endpoint.id === 'gateway-ws'));
    assert.ok(!detail.connectivity.endpoints.some((endpoint) => endpoint.id === 'openai-http-chat'));
    assert.ok(
      detail.connectivity.endpoints.some(
        (endpoint) =>
          endpoint.id === 'openai-http-responses' &&
          endpoint.url === 'http://127.0.0.1:18802/v1/responses',
      ),
    );
  } finally {
    (globalThis as typeof globalThis & { window?: unknown }).window = originalWindow;
  }
});

await runTest(
  'web studio treats custom local-managed OpenClaw entries as external metadata-only runtimes',
  async () => {
    await withMockedWindowStorage(async () => {
      const platform = new WebStudioPlatform();
      const created = await platform.createInstance({
        name: 'Custom Local Managed',
        description: 'OpenClaw metadata with local-managed labels but no built-in controller.',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        iconType: 'server',
        typeLabel: 'Custom Local Managed',
        host: '127.0.0.1',
        port: 18812,
        baseUrl: 'http://127.0.0.1:18812',
        websocketUrl: 'ws://127.0.0.1:18812',
        config: {
          port: '18812',
          sandbox: true,
          autoUpdate: false,
          logLevel: 'info',
          corsOrigins: '*',
          baseUrl: 'http://127.0.0.1:18812',
          websocketUrl: 'ws://127.0.0.1:18812',
        },
      });

      const detail = await platform.getInstanceDetail(created.id);

      assert.ok(detail);
      assert.equal(detail.lifecycle.owner, 'externalProcess');
      assert.equal(detail.lifecycle.startStopSupported, false);
      assert.equal(detail.lifecycle.configWritable, false);
      assert.equal(detail.lifecycle.lifecycleControllable, false);
      assert.equal(detail.lifecycle.workbenchManaged, false);
      assert.equal(detail.lifecycle.endpointObserved, false);
      assert.equal(detail.workbench, null);
    });
  },
);

await runTest('web studio strips trusted built-in instance config state from browser storage', async () => {
  await withMockedWindowStorage(async ({ readJson }) => {
    const platform = new WebStudioPlatform();

    await platform.updateInstanceConfig('local-built-in', {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: 'C:\\kernel\\workspace',
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
      authToken: 'root-secret',
    });

    const config = await platform.getInstanceConfig('local-built-in');
    const persistedInstances = readJson(INSTANCE_STORAGE_KEY) as {
      instances?: Array<{
        id: string;
        config?: {
          workspacePath?: string | null;
          authToken?: string | null;
          baseUrl?: string | null;
          websocketUrl?: string | null;
        };
      }>;
    } | null;
    const persistedBuiltIn = persistedInstances?.instances?.find(
      (instance) => instance.id === 'local-built-in',
    );

    assert.equal(config?.workspacePath, undefined);
    assert.equal(config?.authToken, undefined);
    assert.ok(persistedBuiltIn);
    assert.equal(persistedBuiltIn?.config?.workspacePath, undefined);
    assert.equal(persistedBuiltIn?.config?.authToken, undefined);
    assert.equal(persistedBuiltIn?.config?.baseUrl, 'http://127.0.0.1:18789');
    assert.equal(persistedBuiltIn?.config?.websocketUrl, 'ws://127.0.0.1:18789');
  });
});

await runTest('web studio upgrades the stored built-in OpenClaw instance metadata to the latest bundled version', async () => {
  await withMockedWindowStorage(async ({ readJson }) => {
    const storage = (globalThis as typeof globalThis & {
      window: { localStorage: { setItem(key: string, value: string): void; getItem(key: string): string | null } };
    }).window.localStorage;

    storage.setItem(
      'claw-studio:studio:instances:v1',
      JSON.stringify({
        version: 1,
        instances: [
          {
            id: 'local-built-in',
            name: 'Local Built-In',
            description: 'Old bundled runtime',
            runtimeKind: 'openclaw',
            deploymentMode: 'local-managed',
            transportKind: 'openclawGatewayWs',
            status: 'online',
            isBuiltIn: true,
            isDefault: true,
            iconType: 'server',
            version: '2026.3.24',
            typeLabel: 'Built-In OpenClaw',
            host: '127.0.0.1',
            port: 19991,
            baseUrl: 'http://127.0.0.1:19991',
            websocketUrl: 'ws://127.0.0.1:19991',
            cpu: 0,
            memory: 0,
            totalMemory: 'Unknown',
            uptime: '-',
            capabilities: ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'],
            storage: {
              profileId: 'default-local',
              provider: 'localFile',
              namespace: 'claw-studio',
              database: null,
              connectionHint: null,
              endpoint: null,
            },
            config: {
              port: '19991',
              sandbox: true,
              autoUpdate: true,
              logLevel: 'info',
              corsOrigins: '*',
              workspacePath: null,
              baseUrl: 'http://127.0.0.1:19991',
              websocketUrl: 'ws://127.0.0.1:19991',
              authToken: null,
            },
            createdAt: 1,
            updatedAt: 1,
            lastSeenAt: 1,
          },
        ],
      }),
    );

    const platform = new WebStudioPlatform();
    const instances = await platform.listInstances();
    const builtIn = instances.find((instance) => instance.id === 'local-built-in');
    const persistedDocument = readJson(INSTANCE_STORAGE_KEY) as {
      instances?: Array<{
        id: string;
        version?: string;
        config?: {
          workspacePath?: string | null;
          authToken?: string | null;
        };
      }>;
    } | null;
    const persistedBuiltIn = persistedDocument?.instances?.find(
      (instance) => instance.id === 'local-built-in',
    );

    assert.ok(builtIn);
    assert.equal(builtIn?.version, DEFAULT_BUNDLED_OPENCLAW_VERSION);
    assert.equal(builtIn?.port, 19991);
    assert.equal(builtIn?.baseUrl, 'http://127.0.0.1:19991');
    assert.equal(
      persistedBuiltIn?.version,
      DEFAULT_BUNDLED_OPENCLAW_VERSION,
    );
    assert.equal(persistedBuiltIn?.config?.workspacePath, undefined);
    assert.equal(persistedBuiltIn?.config?.authToken, undefined);
  });
});
