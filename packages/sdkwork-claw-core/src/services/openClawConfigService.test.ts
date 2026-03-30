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

await runTest('openClawConfigService exposes the bundled chat channels in upstream order', async () => {
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  assert.deepEqual(
    openClawConfigService.getChannelDefinitions().map((definition) => definition.id),
    ['telegram', 'whatsapp', 'discord', 'irc', 'googlechat', 'slack', 'signal', 'imessage', 'line'],
  );
});

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
    assert.equal(snapshot.channelSnapshots[0]?.id, 'telegram');
    assert.equal(snapshot.channelSnapshots[0]?.fieldCount, 7);
    assert.equal(snapshot.channelSnapshots[0]?.configuredFieldCount, 2);
    assert.equal(snapshot.channelSnapshots[0]?.status, 'connected');
    assert.equal(snapshot.channelSnapshots[0]?.enabled, true);
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'whatsapp'), true);
    assert.deepEqual(
      snapshot.channelSnapshots.slice(0, 5).map((channel) => channel.id),
      ['telegram', 'whatsapp', 'discord', 'irc', 'googlechat'],
    );
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'signal'), true);
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'imessage'), true);
    assert.equal(snapshot.channelSnapshots.some((channel) => channel.id === 'line'), true);
    assert.match(fileContent, /provider-openai-primary/);
    assert.match(fileContent, /provider-openai-primary\/gpt-4\.1/);
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

await runTest('openClawConfigService persists per-agent skill allowlists, including empty lists and reset-to-all semantics', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const { openClawConfigService } = await import('./openClawConfigService.ts');

  const originalBridge = getPlatformBridge();
  let fileContent = `{
  agents: {
    defaults: {},
    list: [
      {
        id: "main",
        default: true,
        skills: ["Browser", "Calendar"],
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
        id: 'main',
        skills: ['Browser', 'Calendar', 'Browser'],
      },
    });

    let snapshot = await openClawConfigService.readConfigSnapshot(
      'D:/OpenClaw/.openclaw/openclaw.json',
    );
    let mainAgent = snapshot.agentSnapshots.find((agent) => agent.id === 'main');

    assert.deepEqual(mainAgent?.skills, ['Browser', 'Calendar']);

    await openClawConfigService.saveAgent({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'main',
        skills: [],
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    mainAgent = snapshot.agentSnapshots.find((agent) => agent.id === 'main');

    assert.deepEqual(mainAgent?.skills, []);
    assert.equal(
      Array.isArray(((snapshot.root.agents as Record<string, any>).list[0] as Record<string, any>).skills),
      true,
    );
    assert.equal(
      (((snapshot.root.agents as Record<string, any>).list[0] as Record<string, any>).skills as unknown[])
        .length,
      0,
    );

    await openClawConfigService.saveAgent({
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      agent: {
        id: 'main',
        skills: null,
      },
    });

    snapshot = await openClawConfigService.readConfigSnapshot('D:/OpenClaw/.openclaw/openclaw.json');
    mainAgent = snapshot.agentSnapshots.find((agent) => agent.id === 'main');

    assert.equal(mainAgent?.skills, undefined);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        ((snapshot.root.agents as Record<string, any>).list[0] as Record<string, any>),
        'skills',
      ),
      false,
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

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
