import assert from 'node:assert/strict';
import JSON5 from 'json5';
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
    supportsNativeScreenshot: () => false,
    captureScreenshot: async () => null,
    fetchRemoteUrl: async (url) => ({
      url,
      bytes: new Uint8Array(),
    }),
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
    pathExistsForUserTooling: async () => false,
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
    readFileForUserTooling: async () => {
      throw new Error('readFileForUserTooling stub not configured');
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

await runTest('openClawConfigService deduplicates repeated snapshot reads for the same config path', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let readFileCalls = 0;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => {
        readFileCalls += 1;
        return `{
  providers: {
    openai: {
      apiKey: "test-key"
    }
  }
}`;
      },
    }),
  });

  try {
    const configPath = 'D:/OpenClaw/.openclaw/openclaw-cache-test.json';
    const [first, second] = await Promise.all([
      openClawConfigService.readConfigSnapshot(configPath),
      openClawConfigService.readConfigSnapshot(configPath),
    ]);
    const third = await openClawConfigService.readConfigSnapshot(configPath);

    assert.equal(readFileCalls, 1);
    assert.deepEqual(first.providerSnapshots, second.providerSnapshots);
    assert.deepEqual(second.providerSnapshots, third.providerSnapshots);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService reuses a cached parsed root across different readers for the same config path', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let readFileCalls = 0;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => {
        readFileCalls += 1;
        return `{
  agents: {
    defaults: {
      workspace: "~/workspace"
    }
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "123456:telegram-token"
    }
  }
}`;
      },
    }),
  });

  try {
    const configPath = 'D:/OpenClaw/.openclaw/openclaw-root-cache-test.json';

    const resolvedPaths = await openClawConfigService.resolveAgentPaths({
      configPath,
      agentId: 'main',
    });
    const snapshot = await openClawConfigService.readConfigSnapshot(configPath);

    assert.equal(readFileCalls, 1);
    assert.equal(resolvedPaths.workspace, 'D:/OpenClaw/workspace');
    assert.equal(snapshot.channelSnapshots.find((channel) => channel.id === 'telegram')?.enabled, true);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService persists native OpenClaw provider defaults and root-level channel credentials into openclaw.json', async () => {
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
    assert.equal(snapshot.providerSnapshots[0]?.id, 'provider-openai-primary');
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
    assert.equal(snapshot.channelSnapshots[0]?.id, 'sdkworkchat');
    assert.equal(snapshot.channelSnapshots[0]?.fieldCount, 0);
    assert.equal(snapshot.channelSnapshots[0]?.configuredFieldCount, 0);
    assert.equal(snapshot.channelSnapshots[0]?.status, 'connected');
    assert.equal(snapshot.channelSnapshots[0]?.enabled, true);
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'wehcat'), true);
    assert.deepEqual(
      snapshot.channelSnapshots.slice(0, 5).map((channel) => channel.id),
      ['sdkworkchat', 'wehcat', 'qq', 'dingtalk', 'wecom'],
    );
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'qq'), true);
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'dingtalk'), true);
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'wecom'), true);
    assert.match(fileContent, /provider-openai-primary/);
    assert.match(fileContent, /provider-openai-primary\/gpt-4\.1/);
    assert.match(fileContent, /channels:\s*\{/);
    assert.match(fileContent, /telegram/);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest(
  'openClawConfigService exposes stable Telegram channel recovery knobs through the existing channel definition catalog',
  async () => {
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const telegram = openClawConfigService
      .getChannelDefinitions()
      .find((channel) => channel.id === 'telegram');

    assert.ok(telegram);
    assert.equal(telegram?.fields.some((field) => field.key === 'errorPolicy'), true);
    assert.equal(
      telegram?.fields.find((field) => field.key === 'errorCooldownMs')?.inputMode,
      'numeric',
    );
  },
);

await runTest(
  'openClawConfigService exposes WhatsApp managed channel controls aligned to the official access-rule config surface',
  async () => {
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const whatsapp = openClawConfigService
      .getChannelDefinitions()
      .find((channel) => channel.id === 'whatsapp');

    assert.ok(whatsapp);
    assert.equal(whatsapp?.configurationMode, 'none');
    assert.equal(whatsapp?.fields.find((field) => field.key === 'allowFrom')?.multiline, true);
    assert.equal(whatsapp?.fields.find((field) => field.key === 'groups')?.multiline, true);
  },
);

await runTest(
  'openClawConfigService writes WhatsApp access rules as native array and object values instead of string blobs',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const originalBridge = getPlatformBridge();
    let fileContent = `{
  channels: {},
}`;

    configurePlatformBridge({
      platform: createPlatformBridgeStub({
        readFile: async () => fileContent,
        writeFile: async (_path, content) => {
          fileContent = content;
        },
      }),
    });

    try {
      await openClawConfigService.saveChannelConfiguration({
        configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
        channelId: 'whatsapp',
        enabled: true,
        values: {
          allowFrom: '+15555550123\n+15555550124',
          groups: `{
  "*": {
    "requireMention": true
  }
}`,
        },
      });

      const snapshot = await openClawConfigService.readConfigSnapshot(
        'D:/OpenClaw/.openclaw/openclaw.json',
      );
      const parsed = JSON5.parse(fileContent) as {
        channels?: {
          whatsapp?: {
            allowFrom?: string[];
            groups?: Record<string, { requireMention?: boolean }>;
          };
        };
      };
      const whatsapp = snapshot.channelSnapshots.find((channel) => channel.id === 'whatsapp');

      assert.deepEqual(parsed.channels?.whatsapp?.allowFrom, ['+15555550123', '+15555550124']);
      assert.deepEqual(parsed.channels?.whatsapp?.groups, {
        '*': {
          requireMention: true,
        },
      });
      assert.equal(whatsapp?.enabled, true);
      assert.equal(whatsapp?.configuredFieldCount, 2);
      assert.match(whatsapp?.values.allowFrom || '', /\+15555550123/);
      assert.match(whatsapp?.values.groups || '', /requireMention/);
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'openClawConfigService reads web search settings from shared tools.web.search and provider plugin config together',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const originalBridge = getPlatformBridge();
    const fileContent = `{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "searxng",
        maxResults: 9,
        timeoutSeconds: 45,
        cacheTtlMinutes: 25,
      },
    },
  },
  plugins: {
    entries: {
      searxng: {
        config: {
          webSearch: {
            baseUrl: "http://127.0.0.1:8080",
            categories: "general,news",
            language: "zh-CN",
          },
        },
      },
      perplexity: {
        config: {
          webSearch: {
            apiKey: "pplx-live",
            model: "sonar-pro",
          },
        },
      },
    },
  },
}`;

    configurePlatformBridge({
      platform: createPlatformBridgeStub({
        readFile: async () => fileContent,
      }),
    });

    try {
      const snapshot = await openClawConfigService.readConfigSnapshot(
        'D:/OpenClaw/.openclaw/openclaw.json',
      );
      const searxng = snapshot.webSearchConfig.providers.find((provider) => provider.id === 'searxng');
      const perplexity = snapshot.webSearchConfig.providers.find((provider) => provider.id === 'perplexity');

      assert.equal(snapshot.webSearchConfig.enabled, true);
      assert.equal(snapshot.webSearchConfig.provider, 'searxng');
      assert.equal(snapshot.webSearchConfig.maxResults, 9);
      assert.equal(snapshot.webSearchConfig.timeoutSeconds, 45);
      assert.equal(snapshot.webSearchConfig.cacheTtlMinutes, 25);
      assert.equal(searxng?.baseUrl, 'http://127.0.0.1:8080');
      assert.match(searxng?.advancedConfig || '', /categories/);
      assert.equal(perplexity?.apiKeySource, 'pplx-live');
      assert.equal(perplexity?.model, 'sonar-pro');
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'openClawConfigService writes managed web search settings without clobbering sibling plugin config',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const originalBridge = getPlatformBridge();
    let fileContent = `{
  tools: {
    web: {
      search: {
        enabled: false,
        provider: "brave",
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
    },
  },
  plugins: {
    entries: {
      searxng: {
        enabled: false,
        metadata: {
          label: "Self-hosted SearXNG",
        },
        config: {
          theme: "dark",
          webSearch: {
            baseUrl: "http://old.example",
          },
        },
      },
    },
  },
}`;

    configurePlatformBridge({
      platform: createPlatformBridgeStub({
        readFile: async () => fileContent,
        writeFile: async (_path, content) => {
          fileContent = content;
        },
      }),
    });

    try {
      const saved = await openClawConfigService.saveWebSearchConfiguration({
        configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
        enabled: true,
        provider: 'searxng',
        maxResults: 12,
        timeoutSeconds: 60,
        cacheTtlMinutes: 20,
        providerConfig: {
          providerId: 'searxng',
          baseUrl: 'http://search.internal:8080',
          advancedConfig: `{
  "categories": "general",
  "language": "en"
}`,
        },
      });
      const parsed = JSON5.parse(fileContent) as {
        tools?: {
          web?: {
            search?: {
              enabled?: boolean;
              provider?: string;
              maxResults?: number;
              timeoutSeconds?: number;
              cacheTtlMinutes?: number;
            };
          };
        };
        plugins?: {
          entries?: {
            searxng?: {
              enabled?: boolean;
              metadata?: {
                label?: string;
              };
              config?: {
                theme?: string;
                webSearch?: {
                  baseUrl?: string;
                  categories?: string;
                  language?: string;
                };
              };
            };
          };
        };
      };
      const searxng = saved.providers.find((provider) => provider.id === 'searxng');

      assert.equal(parsed.tools?.web?.search?.enabled, true);
      assert.equal(parsed.tools?.web?.search?.provider, 'searxng');
      assert.equal(parsed.tools?.web?.search?.maxResults, 12);
      assert.equal(parsed.tools?.web?.search?.timeoutSeconds, 60);
      assert.equal(parsed.tools?.web?.search?.cacheTtlMinutes, 20);
      assert.equal(parsed.plugins?.entries?.searxng?.enabled, false);
      assert.equal(parsed.plugins?.entries?.searxng?.metadata?.label, 'Self-hosted SearXNG');
      assert.equal(parsed.plugins?.entries?.searxng?.config?.theme, 'dark');
      assert.equal(
        parsed.plugins?.entries?.searxng?.config?.webSearch?.baseUrl,
        'http://search.internal:8080',
      );
      assert.equal(parsed.plugins?.entries?.searxng?.config?.webSearch?.categories, 'general');
      assert.equal(parsed.plugins?.entries?.searxng?.config?.webSearch?.language, 'en');
      assert.equal(searxng?.baseUrl, 'http://search.internal:8080');
      assert.match(searxng?.advancedConfig || '', /language/);
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'openClawConfigService reads auth cooldown settings from auth.cooldowns',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const originalBridge = getPlatformBridge();
    const fileContent = `{
  auth: {
    cooldowns: {
      rateLimitedProfileRotations: 2,
      overloadedProfileRotations: 1,
      overloadedBackoffMs: 45000,
      billingBackoffHours: 5,
      billingMaxHours: 24,
      failureWindowHours: 24,
    },
  },
}`;

    configurePlatformBridge({
      platform: createPlatformBridgeStub({
        readFile: async () => fileContent,
      }),
    });

    try {
      const snapshot = await openClawConfigService.readConfigSnapshot(
        'D:/OpenClaw/.openclaw/openclaw.json',
      );

      assert.equal(snapshot.authCooldownsConfig?.rateLimitedProfileRotations, 2);
      assert.equal(snapshot.authCooldownsConfig?.overloadedProfileRotations, 1);
      assert.equal(snapshot.authCooldownsConfig?.overloadedBackoffMs, 45000);
      assert.equal(snapshot.authCooldownsConfig?.billingBackoffHours, 5);
      assert.equal(snapshot.authCooldownsConfig?.billingMaxHours, 24);
      assert.equal(snapshot.authCooldownsConfig?.failureWindowHours, 24);
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'openClawConfigService writes managed auth cooldown settings without clobbering sibling auth config',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const originalBridge = getPlatformBridge();
    let fileContent = `{
  auth: {
    order: ["openai", "anthropic"],
    defaultProfile: "openai",
    cooldowns: {
      billingBackoffHoursByProvider: {
        openai: 3,
      },
      failureWindowHours: 12,
    },
  },
}`;

    configurePlatformBridge({
      platform: createPlatformBridgeStub({
        readFile: async () => fileContent,
        writeFile: async (_path, content) => {
          fileContent = content;
        },
      }),
    });

    try {
      const saved = await openClawConfigService.saveAuthCooldownsConfiguration({
        configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
        rateLimitedProfileRotations: 2,
        overloadedProfileRotations: 1,
        overloadedBackoffMs: 45000,
        billingBackoffHours: 5,
        billingMaxHours: 24,
        failureWindowHours: 36,
      });
      const parsed = JSON5.parse(fileContent) as {
        auth?: {
          order?: string[];
          defaultProfile?: string;
          cooldowns?: {
            rateLimitedProfileRotations?: number;
            overloadedProfileRotations?: number;
            overloadedBackoffMs?: number;
            billingBackoffHours?: number;
            billingMaxHours?: number;
            failureWindowHours?: number;
            billingBackoffHoursByProvider?: {
              openai?: number;
            };
          };
        };
      };

      assert.deepEqual(parsed.auth?.order, ['openai', 'anthropic']);
      assert.equal(parsed.auth?.defaultProfile, 'openai');
      assert.equal(parsed.auth?.cooldowns?.rateLimitedProfileRotations, 2);
      assert.equal(parsed.auth?.cooldowns?.overloadedProfileRotations, 1);
      assert.equal(parsed.auth?.cooldowns?.overloadedBackoffMs, 45000);
      assert.equal(parsed.auth?.cooldowns?.billingBackoffHours, 5);
      assert.equal(parsed.auth?.cooldowns?.billingMaxHours, 24);
      assert.equal(parsed.auth?.cooldowns?.failureWindowHours, 36);
      assert.equal(parsed.auth?.cooldowns?.billingBackoffHoursByProvider?.openai, 3);
      assert.equal(saved.rateLimitedProfileRotations, 2);
      assert.equal(saved.overloadedBackoffMs, 45000);
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest('openClawConfigService canonicalizes managed local proxy projection as the only OpenClaw provider and default model source', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  models: {
    providers: {
      "openai": {
        baseUrl: "https://router.example.com/v1",
        apiKey: "sk-router-live",
        models: [
          { id: "gpt-4.1", name: "GPT-4.1" },
        ],
      },
      "anthropic": {
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "sk-anthropic",
        models: [
          { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
      },
    },
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.saveManagedLocalProxyProjection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      projection: {
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'openai-compatible',
          name: 'SDKWork Local Proxy',
          apiKey: '${SDKWORK_LOCAL_PROXY_TOKEN}',
          baseUrl: 'http://127.0.0.1:18791/v1',
          models: [
            { id: 'gpt-5.4', name: 'GPT-5.4' },
            { id: 'o4-mini', name: 'o4-mini' },
          ],
          notes: 'Managed local proxy provider',
        },
        selection: {
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'o4-mini',
        },
      },
    });

    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    let managedProvider = snapshot.providerSnapshots.find(
      (provider) => provider.id === 'sdkwork-local-proxy',
    );

    assert.ok(managedProvider);
    assert.equal(managedProvider?.endpoint, 'http://127.0.0.1:18791/v1');
    assert.deepEqual(
      snapshot.providerSnapshots.map((provider) => provider.id),
      ['sdkwork-local-proxy'],
    );
    assert.equal(
      (snapshot.root.agents as Record<string, any>).defaults.model.primary,
      'sdkwork-local-proxy/gpt-5.4',
    );

    await openClawConfigService.saveProviderSelection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      provider: {
        id: 'sdkwork-local-proxy',
        channelId: 'openai-compatible',
        name: 'SDKWork Local Proxy',
        apiKey: '${SDKWORK_LOCAL_PROXY_TOKEN}',
        baseUrl: 'http://127.0.0.1:18791/v1',
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4' },
          { id: 'o4-mini', name: 'o4-mini' },
        ],
        notes: 'Managed local proxy provider',
      },
      selection: {
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
      },
    });

    await openClawConfigService.saveManagedLocalProxyProjection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      projection: {
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'openai-compatible',
          name: 'SDKWork Local Proxy',
          apiKey: '${SDKWORK_LOCAL_PROXY_TOKEN}',
          baseUrl: 'http://127.0.0.1:18791/v1',
          models: [
            { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
            { id: 'o4-mini', name: 'o4-mini' },
          ],
          notes: 'Managed local proxy provider',
        },
        selection: {
          defaultModelId: 'gpt-5.4-mini',
          reasoningModelId: 'o4-mini',
        },
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    managedProvider = snapshot.providerSnapshots.find((provider) => provider.id === 'sdkwork-local-proxy');

    assert.equal(managedProvider?.defaultModelId, 'gpt-5.4-mini');
    assert.equal(
      (snapshot.root.agents as Record<string, any>).defaults.model.primary,
      'sdkwork-local-proxy/gpt-5.4-mini',
    );
    assert.equal(fileContent.includes('sdkwork-local-proxy'), true);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService writes protocol-aware managed local proxy provider adapters for native routes', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  models: {
    providers: {},
  },
  agents: {
    defaults: {
      model: {},
    },
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.saveManagedLocalProxyProjection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      projection: {
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'anthropic',
          name: 'SDKWork Local Proxy',
          apiKey: 'sk_sdkwork_api_key',
          baseUrl: 'http://127.0.0.1:18791/v1',
          models: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
            { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
          ],
          notes: 'Managed local proxy provider',
        },
        selection: {
          defaultModelId: 'claude-sonnet-4-20250514',
          reasoningModelId: 'claude-opus-4-20250514',
        },
      },
    });

    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    assert.equal(
      ((snapshot.root.models as Record<string, any>).providers['sdkwork-local-proxy'] as Record<string, any>).api,
      'anthropic-messages',
    );
    assert.equal(
      ((snapshot.root.models as Record<string, any>).providers['sdkwork-local-proxy'] as Record<string, any>).auth,
      'api-key',
    );

    await openClawConfigService.saveManagedLocalProxyProjection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      projection: {
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'gemini',
          name: 'SDKWork Local Proxy',
          apiKey: 'sk_sdkwork_api_key',
          baseUrl: 'http://127.0.0.1:18791',
          models: [
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            { id: 'text-embedding-004', name: 'text-embedding-004' },
          ],
          notes: 'Managed local proxy provider',
        },
        selection: {
          defaultModelId: 'gemini-2.5-pro',
          embeddingModelId: 'text-embedding-004',
        },
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    assert.equal(
      ((snapshot.root.models as Record<string, any>).providers['sdkwork-local-proxy'] as Record<string, any>).api,
      'google-generative-ai',
    );
    assert.equal(
      ((snapshot.root.models as Record<string, any>).providers['sdkwork-local-proxy'] as Record<string, any>).baseUrl,
      'http://127.0.0.1:18791',
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService strips legacy provider runtime keys when saving managed local proxy projection', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  models: {
    providers: {
      "sdkwork-local-proxy": {
        baseUrl: "http://127.0.0.1:18791/v1",
        apiKey: "sk_sdkwork_api_key",
        temperature: 0.35,
        topP: 0.9,
        maxTokens: 24000,
        timeoutMs: 90000,
        streaming: false,
        models: [
          { id: "gpt-5.4", name: "GPT-5.4" },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: {
        primary: "sdkwork-local-proxy/gpt-5.4",
      },
    },
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.saveManagedLocalProxyProjection({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      projection: {
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'openai-compatible',
          name: 'SDKWork Local Proxy',
          apiKey: 'sk_sdkwork_api_key',
          baseUrl: 'http://127.0.0.1:18791/v1',
          models: [
            { id: 'gpt-5.4', name: 'GPT-5.4' },
            { id: 'o4-mini', name: 'o4-mini' },
          ],
          notes: 'Managed local proxy provider',
          config: {
            temperature: 0.35,
            topP: 0.9,
            maxTokens: 24000,
            timeoutMs: 90000,
            streaming: false,
          },
        },
        selection: {
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'o4-mini',
        },
      },
    });

    const snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    const provider = ((snapshot.root.models as Record<string, any>).providers[
      'sdkwork-local-proxy'
    ] as Record<string, any>);

    assert.equal('temperature' in provider, false);
    assert.equal('topP' in provider, false);
    assert.equal('maxTokens' in provider, false);
    assert.equal('timeoutMs' in provider, false);
    assert.equal('streaming' in provider, false);

    const defaultsModels = ((((snapshot.root.agents as Record<string, any>).defaults ||
      {}) as Record<string, any>).models || {}) as Record<string, any>;
    assert.deepEqual(defaultsModels['sdkwork-local-proxy/gpt-5.4']?.params, {
      temperature: 0.35,
      topP: 0.9,
      maxTokens: 24000,
      timeoutMs: 90000,
      streaming: false,
    });

    const managedProvider = snapshot.providerSnapshots.find(
      (entry) => entry.id === 'sdkwork-local-proxy',
    );
    assert.deepEqual(managedProvider?.config, {
      temperature: 0.35,
      topP: 0.9,
      maxTokens: 24000,
      timeoutMs: 90000,
      streaming: false,
    });
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService reads provider runtime config from canonical defaults model params instead of provider-root legacy fields', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  const fileContent = `{
  models: {
    providers: {
      openai: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "\${OPENAI_API_KEY}",
        temperature: 0.05,
        topP: 0.1,
        maxTokens: 256,
        timeoutMs: 1000,
        streaming: false,
        models: [
          { id: "gpt-5.4", name: "GPT-5.4" },
          { id: "o4-mini", name: "o4-mini", reasoning: true },
          { id: "text-embedding-3-large", name: "text-embedding-3-large", api: "embedding" },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: {
        primary: "openai/gpt-5.4",
        fallbacks: ["openai/o4-mini"],
      },
      models: {
        "openai/gpt-5.4": {
          alias: "GPT-5.4",
          params: {
            temperature: 0.45,
            topP: 0.92,
            maxTokens: 16000,
            timeoutMs: 180000,
            streaming: true,
          },
        },
      },
    },
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
    }),
  });

  try {
    const snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    const provider = snapshot.providerSnapshots.find((entry) => entry.id === 'openai');

    assert.deepEqual(provider?.config, {
      temperature: 0.45,
      topP: 0.92,
      maxTokens: 16000,
      timeoutMs: 180000,
      streaming: true,
    });
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

await runTest('openClawConfigService reads legacy api-router-prefixed providers and migrates them to native provider ids on save', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  models: {
    providers: {
      "api-router-openai": {
        baseUrl: "https://router.example.com/v1",
        apiKey: "sk-router-live",
        models: [
          { id: "gpt-4.1", name: "GPT-4.1" },
          { id: "text-embedding-3-small", name: "text-embedding-3-small", api: "embedding" },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: {
        primary: "api-router-openai/gpt-4.1",
      },
    },
    list: [
      {
        id: "main",
        default: true,
        model: {
          primary: "api-router-openai/gpt-4.1",
        },
      },
    ],
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    assert.equal(snapshot.providerSnapshots[0]?.id, 'openai');
    assert.equal(snapshot.agentSnapshots[0]?.model.primary, 'openai/gpt-4.1');

    await openClawConfigService.saveAgent({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'main',
        model: {
          primary: 'openai/gpt-4.1',
          fallbacks: [],
        },
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    assert.equal(snapshot.providerSnapshots[0]?.id, 'openai');
    assert.equal(snapshot.agentSnapshots[0]?.model.primary, 'openai/gpt-4.1');
    assert.equal(fileContent.includes('api-router-openai'), false);
    assert.match(fileContent, /openai/);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService manages agent CRUD with OpenClaw-compatible default, workspace, agentDir, and model rules', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  models: {
    providers: {
      "openai": {
        baseUrl: "https://router.example.com/v1",
        apiKey: "sk-router-live",
        models: [
          { id: "gpt-4.1", name: "GPT-4.1" },
          { id: "o4-mini", name: "o4-mini", reasoning: true },
        ],
      },
    },
  },
  agents: {
    defaults: {
      workspace: "D:/OpenClaw/workspace",
      model: {
        primary: "openai/gpt-4.1",
        fallbacks: ["openai/o4-mini"],
      },
    },
    list: [
      {
        id: "main",
        default: true,
        name: "Main",
        identity: {
          emoji: "🤖",
        },
      },
    ],
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.saveAgent({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'research',
        name: 'Research',
        avatar: '🔬',
        model: {
          primary: 'openai/o4-mini',
          fallbacks: ['openai/gpt-4.1'],
        },
        params: {
          temperature: 0.4,
          maxTokens: 24000,
        },
      },
    });

    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    let research = snapshot.agentSnapshots.find((agent) => agent.id === 'research');
    let main = snapshot.agentSnapshots.find((agent) => agent.id === 'main');

    assert.equal(research?.name, 'Research');
    assert.equal(research?.avatar, '🔬');
    assert.equal(research?.isDefault, false);
    assert.equal(research?.workspace, 'D:/OpenClaw/.openclaw/workspace-research');
    assert.equal(research?.agentDir, 'D:/OpenClaw/.openclaw/agents/research/agent');
    assert.equal(research?.model.primary, 'openai/o4-mini');
    assert.deepEqual(research?.model.fallbacks, ['openai/gpt-4.1']);
    assert.equal(research?.params.temperature, 0.4);
    assert.equal(research?.params.maxTokens, 24000);
    assert.equal(main?.isDefault, true);

    await openClawConfigService.saveAgent({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'research',
        name: 'Research Ops',
        avatar: '🧠',
        workspace: './workspace-research-ops',
        agentDir: './agents/research-home/agent',
        isDefault: true,
        model: {
          primary: 'openai/gpt-4.1',
          fallbacks: ['openai/o4-mini'],
        },
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    research = snapshot.agentSnapshots.find((agent) => agent.id === 'research');
    main = snapshot.agentSnapshots.find((agent) => agent.id === 'main');

    assert.equal(research?.name, 'Research Ops');
    assert.equal(research?.avatar, '🧠');
    assert.equal(research?.isDefault, true);
    assert.equal(research?.workspace, 'D:/OpenClaw/.openclaw/workspace-research-ops');
    assert.equal(research?.agentDir, 'D:/OpenClaw/.openclaw/agents/research-home/agent');
    assert.equal(main?.isDefault, false);

    await openClawConfigService.deleteAgent({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agentId: 'research',
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');

    assert.equal(snapshot.agentSnapshots.some((agent) => agent.id === 'research'), false);
    assert.equal(snapshot.agentSnapshots[0]?.id, 'main');
    assert.equal(snapshot.agentSnapshots[0]?.isDefault, true);
    assert.match(fileContent, /default:\s*true/);
    assert.match(fileContent, /workspace:\s*['"]D:\/OpenClaw\/workspace['"]/);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest(
  'openClawConfigService merges agents.defaults.params into effective agent params while tracking param sources',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
    const { openClawConfigService } = await import('./openClawConfigService.ts');

    const originalBridge = getPlatformBridge();
    const fileContent = `{
  agents: {
    defaults: {
      workspace: "workspace",
      params: {
        temperature: 0.25,
        streaming: false,
        timeoutMs: 90000,
      },
    },
    list: [
      {
        id: "main",
        default: true,
        name: "Main",
        params: {
          temperature: 0.4,
        },
      },
      {
        id: "research",
        name: "Research",
      },
    ],
  },
}`;

    configurePlatformBridge({
      platform: createPlatformBridgeStub({
        readFile: async () => fileContent,
      }),
    });

    try {
      const snapshot = await openClawConfigService.readConfigSnapshot(
        'D:/OpenClaw/.openclaw/openclaw.json',
      );
      const main = snapshot.agentSnapshots.find((agent) => agent.id === 'main');
      const research = snapshot.agentSnapshots.find((agent) => agent.id === 'research');

      assert.deepEqual(main?.params, {
        temperature: 0.4,
        streaming: false,
        timeoutMs: 90000,
      });
      assert.deepEqual(main?.paramSources, {
        temperature: 'agent',
        streaming: 'defaults',
        timeoutMs: 'defaults',
      });
      assert.deepEqual(research?.params, {
        temperature: 0.25,
        streaming: false,
        timeoutMs: 90000,
      });
      assert.deepEqual(research?.paramSources, {
        temperature: 'defaults',
        streaming: 'defaults',
        timeoutMs: 'defaults',
      });
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest('openClawConfigService updates provider-model references and prunes removed providers without leaving stale defaults behind', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  models: {
    providers: {
      "openai": {
        baseUrl: "https://router.example.com/v1",
        apiKey: "sk-router-live",
        models: [
          { id: "gpt-4.1", name: "GPT-4.1" },
          { id: "o4-mini", name: "o4-mini", reasoning: true },
        ],
      },
      "anthropic": {
        baseUrl: "https://anthropic.example.com/v1",
        apiKey: "sk-ant-live",
        models: [
          { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: {
        primary: "openai/gpt-4.1",
        fallbacks: [
          "openai/o4-mini",
          "anthropic/claude-sonnet-4-5",
        ],
      },
      models: {
        "openai/gpt-4.1": {
          alias: "GPT-4.1",
          streaming: true,
          params: {
            transport: "sse",
          },
        },
        "openai/o4-mini": {
          alias: "o4-mini",
          streaming: true,
        },
        "anthropic/claude-sonnet-4-5": {
          alias: "Claude Sonnet 4.5",
          streaming: true,
        },
      },
    },
    list: [
      {
        id: "main",
        default: true,
        name: "Main",
        model: {
          primary: "openai/o4-mini",
          fallbacks: ["anthropic/claude-sonnet-4-5"],
        },
      },
    ],
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.createProviderModel({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      providerId: 'openai',
      model: {
        id: 'text-embedding-3-small',
        name: 'text-embedding-3-small',
      },
    });

    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    let openai = snapshot.providerSnapshots.find((provider) => provider.id === 'openai');
    assert.equal(
      openai?.models.some((model) => model.id === 'text-embedding-3-small'),
      true,
    );
    assert.equal(
      snapshot.root.agents &&
        typeof snapshot.root.agents === 'object' &&
        !Array.isArray(snapshot.root.agents) &&
        (snapshot.root.agents as Record<string, any>).defaults.models['openai/text-embedding-3-small']
          .alias,
      'text-embedding-3-small',
    );

    await openClawConfigService.updateProviderModel({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      providerId: 'openai',
      modelId: 'o4-mini',
      model: {
        id: 'o4-mini-high',
        name: 'o4-mini-high',
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    openai = snapshot.providerSnapshots.find((provider) => provider.id === 'openai');
    const mainAgent = snapshot.agentSnapshots.find((agent) => agent.id === 'main');
    const defaultsAfterRename = (snapshot.root.agents as Record<string, any>).defaults;

    assert.equal(openai?.models.some((model) => model.id === 'o4-mini-high'), true);
    assert.equal(openai?.models.some((model) => model.id === 'o4-mini'), false);
    assert.equal(
      defaultsAfterRename.model.fallbacks.includes('openai/o4-mini'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        defaultsAfterRename.models,
        'openai/o4-mini',
      ),
      false,
    );
    assert.equal(mainAgent?.model.primary, 'openai/o4-mini-high');

    await openClawConfigService.deleteProvider({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      providerId: 'openai',
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    const remainingProviderIds = snapshot.providerSnapshots.map((provider) => provider.id);
    const remainingMainAgent = snapshot.agentSnapshots.find((agent) => agent.id === 'main');

    assert.deepEqual(remainingProviderIds, ['anthropic']);
    assert.equal(
      snapshot.root.agents && JSON.stringify(snapshot.root.agents).includes('openai/'),
      false,
    );
    assert.equal(
      snapshot.root.agents &&
        JSON.stringify(snapshot.root.agents).includes('anthropic/claude-sonnet-4-5'),
      true,
    );
    assert.equal(remainingMainAgent?.model.primary, 'anthropic/claude-sonnet-4-5');
    assert.match(fileContent, /anthropic/);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService persists skill entry overrides and removes empty skill config cleanly', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  skills: {
    entries: {
      "research-skill": {
        enabled: false,
        apiKey: "\${OLD_RESEARCH_KEY}",
        env: {
          RESEARCH_API_KEY: "\${OLD_RESEARCH_KEY}",
        },
      },
    },
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.saveSkillEntry({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      skillKey: 'research-skill',
      enabled: false,
      apiKey: '${RESEARCH_API_KEY}',
      env: {
        RESEARCH_API_KEY: '${RESEARCH_API_KEY}',
        RESEARCH_REGION: 'global',
      },
    });

    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    let entries = (((snapshot.root.skills as Record<string, any>) || {}).entries ||
      {}) as Record<string, any>;

    assert.equal(entries['research-skill']?.enabled, false);
    assert.equal(entries['research-skill']?.apiKey, '${RESEARCH_API_KEY}');
    assert.equal(entries['research-skill']?.env?.RESEARCH_API_KEY, '${RESEARCH_API_KEY}');
    assert.equal(entries['research-skill']?.env?.RESEARCH_REGION, 'global');

    await openClawConfigService.saveSkillEntry({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      skillKey: 'research-skill',
      enabled: true,
      apiKey: '',
      env: {
        RESEARCH_API_KEY: '',
        RESEARCH_REGION: '',
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    entries = (((snapshot.root.skills as Record<string, any>) || {}).entries || {}) as Record<
      string,
      any
    >;

    assert.equal(entries['research-skill'], undefined);
    assert.equal(fileContent.includes('research-skill'), false);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawConfigService deletes a persisted skill entry without touching sibling skill config', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  skills: {
    entries: {
      "research-skill": {
        enabled: false,
      },
      "calendar-skill": {
        env: {
          CALDAV_URL: "https://calendar.example.com",
        },
      },
    },
  },
}`;

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      readFile: async () => fileContent,
      writeFile: async (_path, content) => {
        fileContent = content;
      },
    }),
  });

  try {
    await openClawConfigService.deleteSkillEntry({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      skillKey: 'research-skill',
    });

    const snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    const entries = (((snapshot.root.skills as Record<string, any>) || {}).entries ||
      {}) as Record<string, any>;

    assert.equal(entries['research-skill'], undefined);
    assert.deepEqual(entries['calendar-skill'], {
      env: {
        CALDAV_URL: 'https://calendar.example.com',
      },
    });
  } finally {
    configurePlatformBridge(originalBridge);
  }
});
