import assert from 'node:assert/strict';
import type { PlatformAPI } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createPlatformBridgeStub(overrides: Partial<PlatformAPI> = {}): PlatformAPI {
  return {
    getPlatform: () => 'desktop',
    getDeviceId: async () => 'test-device',
    setStorage: async () => {},
    getStorage: async () => null,
    copy: async () => {},
    openExternal: async () => {},
    selectFile: async () => [],
    saveFile: async () => {},
    minimizeWindow: async () => {},
    maximizeWindow: async () => {},
    restoreWindow: async () => {},
    isWindowMaximized: async () => false,
    subscribeWindowMaximized: async () => async () => {},
    closeWindow: async () => {},
    listDirectory: async () => [],
    pathExists: async () => false,
    getPathInfo: async (path) => ({
      path,
      name: path.split(/[\\/]/).pop() || path,
      kind: 'missing',
      size: null,
      extension: null,
      exists: false,
      lastModifiedMs: null,
    }),
    createDirectory: async () => {},
    removePath: async () => {},
    copyPath: async () => {},
    movePath: async () => {},
    readBinaryFile: async () => new Uint8Array(),
    writeBinaryFile: async () => {},
    readFile: async () => {
      throw new Error('readFile stub not configured');
    },
    writeFile: async () => {},
    ...overrides,
  };
}

function createInstanceDetailWithManagedConfig(
  configPath = 'D:/OpenClaw/.openclaw/openclaw.json',
): StudioInstanceDetailRecord {
  return {
    instance: {
      id: 'openclaw-local-external',
      name: 'OpenClaw Host',
      description: 'Host-managed OpenClaw runtime',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.5.0',
      typeLabel: 'Host Managed',
      host: '127.0.0.1',
      port: 28789,
      baseUrl: 'http://127.0.0.1:28789',
      websocketUrl: 'ws://127.0.0.1:28789/ws',
      cpu: 12,
      memory: 32,
      totalMemory: '16 GB',
      uptime: '3h',
      capabilities: ['chat', 'tasks', 'models'],
      storage: {
        provider: 'localFile',
        namespace: 'openclaw-local',
      },
      config: {
        port: '28789',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        workspacePath: 'D:/OpenClaw/work',
        baseUrl: 'http://127.0.0.1:28789',
        websocketUrl: 'ws://127.0.0.1:28789/ws',
        authToken: null,
      },
      createdAt: 1,
      updatedAt: 2,
      lastSeenAt: 3,
    },
    config: {
      port: '28789',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: 'D:/OpenClaw/work',
      baseUrl: 'http://127.0.0.1:28789',
      websocketUrl: 'ws://127.0.0.1:28789/ws',
      authToken: null,
    },
    logs: '',
    health: {
      score: 100,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'externalProcess',
      startStopSupported: false,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      profileId: null,
      provider: 'localFile',
      namespace: 'openclaw-local',
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
      logFilePath: null,
      logPreview: [],
      lastSeenAt: 3,
      metricsSource: 'derived',
    },
    dataAccess: {
      routes: [
        {
          id: 'config',
          label: 'Configuration',
          scope: 'config',
          mode: 'managedFile',
          status: 'ready',
          target: configPath,
          readonly: false,
          authoritative: true,
          detail: 'Native config file',
          source: 'integration',
        },
      ],
    },
    artifacts: [
      {
        id: 'config-file',
        label: 'Config File',
        kind: 'configFile',
        status: 'available',
        location: configPath,
        readonly: false,
        detail: 'Native OpenClaw config',
        source: 'integration',
      },
    ],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: null,
    workbench: null,
  };
}

await runTest('openClawConfigService resolves install config paths using the same candidate order as desktop discovery', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  const existingPaths = new Set([
    'D:/Users/admin/.openclaw/openclaw.json',
    'D:/OpenClaw/work/.openclaw/openclaw.json',
    'D:/OpenClaw/data/config/openclaw.json',
  ]);

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      pathExists: async (path) => existingPaths.has(path.replace(/\\/g, '/')),
    }),
  });

  try {
    const resolved = await openClawConfigService.resolveInstallConfigPath({
      installRoot: 'D:/OpenClaw/install',
      workRoot: 'D:/OpenClaw/work',
      dataRoot: 'D:/OpenClaw/data',
      homeRoots: ['D:/Users/admin'],
    });

    assert.equal(resolved, 'D:/Users/admin/.openclaw/openclaw.json');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService persists API-router provider defaults and root-level channel credentials into openclaw.json', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  const writes: Array<{ path: string; content: string }> = [];
  let fileContent = `{
  gateway: {
    port: 28789,
  },
  models: {
    mode: "merge",
    providers: {},
  },
  agents: {
    defaults: {},
  },
  channels: {},
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (path, content) => {
        fileContent = content;
        writes.push({ path, content });
      },
    }),
  });

  try {
    const provider = {
      id: 'provider-openai-primary',
      channelId: 'openai',
      name: 'OpenAI Shared Router',
      apiKey: 'sk-router-live',
      groupId: 'ops',
      usage: {
        requestCount: 0,
        tokenCount: 0,
        spendUsd: 0,
        period: '30d' as const,
      },
      expiresAt: null,
      status: 'active' as const,
      createdAt: '2026-03-20T00:00:00.000Z',
      baseUrl: 'https://router.example.com/v1',
      models: [
        { id: 'gpt-4.1', name: 'GPT-4.1' },
        { id: 'o4-mini', name: 'o4-mini' },
        { id: 'text-embedding-3-small', name: 'text-embedding-3-small' },
      ],
      notes: 'shared router',
    };

    await openClawConfigService.saveProviderSelection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      provider,
      selection: {
        defaultModelId: 'gpt-4.1',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-small',
      },
    });

    await openClawConfigService.saveChannelConfiguration({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      channelId: 'telegram',
      enabled: true,
      values: {
        botToken: '123456:telegram-token',
        webhookUrl: 'https://example.com/telegram/webhook',
      },
    });

    const snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );

    assert.equal(writes.length >= 2, true);
    assert.equal(snapshot.providerSnapshots[0]?.id, 'api-router-provider-openai-primary');
    assert.equal(snapshot.providerSnapshots[0]?.defaultModelId, 'gpt-4.1');
    assert.equal(snapshot.providerSnapshots[0]?.reasoningModelId, 'o4-mini');
    assert.equal(snapshot.providerSnapshots[0]?.embeddingModelId, 'text-embedding-3-small');
    assert.equal(snapshot.providerSnapshots[0]?.status, 'ready');
    assert.equal(snapshot.providerSnapshots[0]?.endpoint, 'https://router.example.com/v1');
    assert.equal(snapshot.channelSnapshots.find((channel) => channel.id === 'telegram')?.enabled, true);
    assert.equal(
      snapshot.channelSnapshots.find((channel) => channel.id === 'telegram')?.configuredFieldCount,
      2,
    );
    assert.match(fileContent, /api-router-provider-openai-primary/);
    assert.match(fileContent, /api-router-provider-openai-primary\/gpt-4\.1/);
    assert.match(fileContent, /channels:\s*\{/);
    assert.match(fileContent, /telegram/);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService resolves a file-backed config path from instance detail data access first', async () => {
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const detail = createInstanceDetailWithManagedConfig();

  assert.equal(
    openClawConfigService.resolveInstanceConfigPath(detail),
    'D:/OpenClaw/.openclaw/openclaw.json',
  );
});
