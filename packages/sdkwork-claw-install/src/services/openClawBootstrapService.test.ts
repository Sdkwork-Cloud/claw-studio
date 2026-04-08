import assert from 'node:assert/strict';
import type {
  HubInstallAssessmentResult,
  HubInstallResult,
  PlatformAPI,
  StoragePlatformAPI,
  StudioPlatformAPI,
} from '@sdkwork/claw-infrastructure';

type StudioCreateInstanceInput = Parameters<StudioPlatformAPI['createInstance']>[0];
type StudioCreateInstanceRecord = Awaited<ReturnType<StudioPlatformAPI['createInstance']>>;
type StudioUpdateInstanceInput = Parameters<StudioPlatformAPI['updateInstance']>[1];

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createPlatformStub(
  fileSystem: Record<string, string>,
  overrides: Partial<PlatformAPI> = {},
): PlatformAPI {
  return {
    getPlatform: () => 'desktop',
    getDeviceId: async () => 'bootstrap-test-device',
    setStorage: async () => {},
    getStorage: async () => null,
    copy: async () => {},
    showNotification: async () => {},
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
    pathExists: async (path) => fileSystem[path.replace(/\\/g, '/')] !== undefined,
    pathExistsForUserTooling: async (path) => fileSystem[path.replace(/\\/g, '/')] !== undefined,
    getPathInfo: async (path) => ({
      path,
      name: path.split(/[\\/]/).pop() || path,
      kind: fileSystem[path.replace(/\\/g, '/')] !== undefined ? 'file' : 'missing',
      size: fileSystem[path.replace(/\\/g, '/')]?.length ?? null,
      extension: path.includes('.') ? path.slice(path.lastIndexOf('.')) : null,
      exists: fileSystem[path.replace(/\\/g, '/')] !== undefined,
      lastModifiedMs: null,
    }),
    createDirectory: async () => {},
    removePath: async () => {},
    copyPath: async () => {},
    movePath: async () => {},
    readBinaryFile: async () => new Uint8Array(),
    writeBinaryFile: async () => {},
    readFile: async (path) => {
      const normalized = path.replace(/\\/g, '/');
      if (fileSystem[normalized] === undefined) {
        throw new Error(`Missing file: ${normalized}`);
      }

      return fileSystem[normalized];
    },
    readFileForUserTooling: async (path) => {
      const normalized = path.replace(/\\/g, '/');
      if (fileSystem[normalized] === undefined) {
        throw new Error(`Missing file: ${normalized}`);
      }

      return fileSystem[normalized];
    },
    writeFile: async (path, content) => {
      fileSystem[path.replace(/\\/g, '/')] = content;
    },
    ...overrides,
  };
}

function createStudioStub(
  originalStudio: StudioPlatformAPI,
  instanceState: {
    instances: StudioCreateInstanceRecord[];
    created: StudioCreateInstanceInput[];
    updated: Array<{ id: string; input: StudioUpdateInstanceInput }>;
  },
): StudioPlatformAPI {
  return {
    listInstances: async () => instanceState.instances.map((instance) => ({ ...instance })),
    getInstance: async (id) =>
      instanceState.instances.find((instance) => instance.id === id) || null,
    getInstanceDetail: originalStudio.getInstanceDetail.bind(originalStudio),
    createInstance: async (input) => {
      const created = createStudioInstanceRecord(input, {
        id: `synced-${instanceState.instances.length + 1}`,
      });

      instanceState.instances.push(created);
      instanceState.created.push(input);
      return { ...created };
    },
    updateInstance: async (id, input) => {
      const current = instanceState.instances.find((instance) => instance.id === id);
      if (!current) {
        throw new Error(`Instance not found: ${id}`);
      }

      Object.assign(current, input, {
        baseUrl: input.baseUrl ?? current.baseUrl,
        websocketUrl: input.websocketUrl ?? current.websocketUrl,
        host: input.host ?? current.host,
        port: input.port ?? current.port,
        config: {
          ...current.config,
          ...(input.config || {}),
          port: input.config?.port ?? current.config.port,
        },
      });
      instanceState.updated.push({ id, input });
      return { ...current };
    },
    deleteInstance: originalStudio.deleteInstance.bind(originalStudio),
    startInstance: originalStudio.startInstance.bind(originalStudio),
    stopInstance: originalStudio.stopInstance.bind(originalStudio),
    restartInstance: originalStudio.restartInstance.bind(originalStudio),
    setInstanceStatus: originalStudio.setInstanceStatus.bind(originalStudio),
    getInstanceConfig: originalStudio.getInstanceConfig.bind(originalStudio),
    updateInstanceConfig: originalStudio.updateInstanceConfig.bind(originalStudio),
    getInstanceLogs: originalStudio.getInstanceLogs.bind(originalStudio),
    cloneInstanceTask: originalStudio.cloneInstanceTask.bind(originalStudio),
    runInstanceTaskNow: originalStudio.runInstanceTaskNow.bind(originalStudio),
    listInstanceTaskExecutions: originalStudio.listInstanceTaskExecutions.bind(originalStudio),
    createInstanceTask: originalStudio.createInstanceTask.bind(originalStudio),
    updateInstanceTask: originalStudio.updateInstanceTask.bind(originalStudio),
    updateInstanceTaskStatus: originalStudio.updateInstanceTaskStatus.bind(originalStudio),
    updateInstanceFileContent: originalStudio.updateInstanceFileContent.bind(originalStudio),
    updateInstanceLlmProviderConfig:
      originalStudio.updateInstanceLlmProviderConfig.bind(originalStudio),
    deleteInstanceTask: originalStudio.deleteInstanceTask.bind(originalStudio),
    listConversations: originalStudio.listConversations.bind(originalStudio),
    putConversation: originalStudio.putConversation.bind(originalStudio),
    deleteConversation: originalStudio.deleteConversation.bind(originalStudio),
  };
}

function createStorageStub(
  seed: Record<string, string> = {},
  overrides: Partial<StoragePlatformAPI> = {},
): StoragePlatformAPI {
  const records = new Map(Object.entries(seed));
  const activeProfileId = 'default-sqlite';

  return {
    getStorageInfo: async () => ({
      activeProfileId,
      rootDir: 'test://storage',
      providers: [
        {
          id: 'sqlite-test',
          kind: 'sqlite',
          label: 'SQLite Test Storage',
          availability: 'ready',
          requiresConfiguration: false,
          capabilities: {
            durable: true,
            structured: true,
            queryable: true,
            transactional: true,
            remote: false,
          },
        },
      ],
      profiles: [
        {
          id: activeProfileId,
          label: 'Default SQLite',
          provider: 'sqlite',
          active: true,
          availability: 'ready',
          namespace: 'sdkwork-claw',
          readOnly: false,
          connectionConfigured: true,
          databaseConfigured: true,
          endpointConfigured: false,
        },
      ],
    }),
    getText: async (request) => {
      const profileId = request.profileId || activeProfileId;
      const namespace = request.namespace || 'sdkwork-claw';
      const storageKey = `${profileId}:${namespace}:${request.key}`;

      return {
        profileId,
        namespace,
        key: request.key,
        value: records.get(storageKey) ?? null,
      };
    },
    putText: async (request) => {
      const profileId = request.profileId || activeProfileId;
      const namespace = request.namespace || 'sdkwork-claw';
      const storageKey = `${profileId}:${namespace}:${request.key}`;
      records.set(storageKey, request.value);

      return {
        profileId,
        namespace,
        key: request.key,
      };
    },
    delete: async (request) => {
      const profileId = request.profileId || activeProfileId;
      const namespace = request.namespace || 'sdkwork-claw';
      const storageKey = `${profileId}:${namespace}:${request.key}`;
      const existed = records.delete(storageKey);

      return {
        profileId,
        namespace,
        key: request.key,
        existed,
      };
    },
    listKeys: async (request = {}) => {
      const profileId = request.profileId || activeProfileId;
      const namespace = request.namespace || 'sdkwork-claw';
      const prefix = `${profileId}:${namespace}:`;
      const keys = [...records.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
        .sort((left, right) => left.localeCompare(right));

      return {
        profileId,
        namespace,
        keys,
      };
    },
    ...overrides,
  };
}

function createStudioInstanceRecord(
  input: StudioCreateInstanceInput,
  overrides: Partial<StudioCreateInstanceRecord> = {},
): StudioCreateInstanceRecord {
  return {
    id: 'synced-1',
    name: input.name,
    description: input.description,
    runtimeKind: input.runtimeKind,
    deploymentMode: input.deploymentMode,
    transportKind: input.transportKind,
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: input.iconType || 'server',
    version: input.version || 'host',
    typeLabel: input.typeLabel || 'Host Managed',
    host: input.host || '127.0.0.1',
    port: input.port ?? 28789,
    baseUrl: input.baseUrl ?? null,
    websocketUrl: input.websocketUrl ?? null,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health', 'tasks', 'models'],
    storage: {
      profileId: 'default-local',
      provider: input.storage?.provider || 'localFile',
      namespace: input.storage?.namespace || 'openclaw-local-external',
      database: null,
      connectionHint: null,
      endpoint: null,
    },
    config: {
      port: input.config?.port || String(input.port ?? 28789),
      sandbox: input.config?.sandbox ?? true,
      autoUpdate: input.config?.autoUpdate ?? false,
      logLevel: input.config?.logLevel || 'info',
      corsOrigins: input.config?.corsOrigins || '*',
      workspacePath: input.config?.workspacePath ?? null,
      baseUrl: input.config?.baseUrl ?? input.baseUrl ?? null,
      websocketUrl: input.config?.websocketUrl ?? input.websocketUrl ?? null,
      authToken: input.config?.authToken ?? null,
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
    ...overrides,
  };
}

function createStudioState() {
  return {
    instances: [] as StudioCreateInstanceRecord[],
    created: [] as StudioCreateInstanceInput[],
    updated: [] as Array<{ id: string; input: StudioUpdateInstanceInput }>,
  };
}

function createAssessmentResult(overrides: Partial<HubInstallAssessmentResult> = {}): HubInstallAssessmentResult {
  return {
    registryName: 'hub-installer',
    registrySource: 'https://example.com/registry',
    softwareName: 'openclaw',
    manifestSource: 'openclaw-pnpm.hub.yaml',
    manifestName: 'openclaw-pnpm',
    manifestDescription: 'OpenClaw PNPM install',
    manifestHomepage: 'https://openclaw.dev',
    ready: true,
    requiresElevatedSetup: false,
    platform: 'windows',
    effectiveRuntimePlatform: 'windows',
    resolvedInstallScope: 'user',
    resolvedInstallRoot: 'D:/OpenClaw/install',
    resolvedWorkRoot: 'D:/OpenClaw/work',
    resolvedBinDir: 'D:/OpenClaw/bin',
    resolvedDataRoot: 'D:/OpenClaw/data',
    installControlLevel: 'partial',
    installStatus: 'installed',
    dependencies: [],
    issues: [],
    recommendations: [],
    installation: null,
    dataItems: [],
    migrationStrategies: [],
    runtime: {
      hostPlatform: 'windows',
      requestedRuntimePlatform: 'windows',
      effectiveRuntimePlatform: 'windows',
      containerRuntimePreference: 'host',
      resolvedContainerRuntime: 'host',
      wslDistribution: null,
      availableWslDistributions: [],
      wslAvailable: false,
      hostDockerAvailable: false,
      wslDockerAvailable: false,
      runtimeHomeDir: 'D:/Users/admin',
      commandAvailability: {},
    },
    ...overrides,
  };
}

function createInstallResult(overrides: Partial<HubInstallResult> = {}): HubInstallResult {
  return {
    registryName: 'hub-installer',
    registrySource: 'https://example.com/registry',
    softwareName: 'openclaw',
    manifestSource: 'openclaw-pnpm.hub.yaml',
    manifestName: 'openclaw-pnpm',
    success: true,
    durationMs: 5000,
    platform: 'windows',
    effectiveRuntimePlatform: 'windows',
    resolvedInstallScope: 'user',
    resolvedInstallRoot: 'D:/OpenClaw/install',
    resolvedWorkRoot: 'D:/OpenClaw/work',
    resolvedBinDir: 'D:/OpenClaw/bin',
    resolvedDataRoot: 'D:/OpenClaw/data',
    installControlLevel: 'partial',
    stageReports: [],
    artifactReports: [],
    ...overrides,
  };
}

await runTest(
  'openClawBootstrapService prefers the kernel OpenClaw runtime home when install assessment paths drift',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import(
      '@sdkwork/claw-infrastructure'
    );
    const { kernelPlatformService } = await import('@sdkwork/claw-core');
    const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

    const originalBridge = getPlatformBridge();
    const originalEnsureRunning = kernelPlatformService.ensureRunning;
    const originalGetInfo = kernelPlatformService.getInfo;
    const fileSystem: Record<string, string> = {
      'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {},
  models: { providers: {} },
  agents: { defaults: {} }
}`,
    };
    const instanceState = createStudioState();

    configurePlatformBridge({
      platform: createPlatformStub(fileSystem),
      storage: createStorageStub(),
      studio: createStudioStub(originalBridge.studio, instanceState),
    });

    kernelPlatformService.ensureRunning = async () => null;
    kernelPlatformService.getInfo = async () =>
      ({
        openClawRuntime: {
          homeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
        },
        localAiProxy: {
          lifecycle: 'running',
          baseUrl: 'http://ai.sdkwork.localhost:18791/v1',
          rootBaseUrl: 'http://ai.sdkwork.localhost:18791',
          openaiCompatibleBaseUrl: 'http://ai.sdkwork.localhost:18791/v1',
          anthropicBaseUrl: 'http://ai.sdkwork.localhost:18791/v1',
          geminiBaseUrl: 'http://ai.sdkwork.localhost:18791',
          activePort: 18791,
          loopbackOnly: true,
          defaultRouteId: 'local-ai-proxy-system-default-openai-compatible',
          defaultRouteName: 'SDKWork Default',
          upstreamBaseUrl: 'https://ai.sdkwork.com',
          modelCount: 3,
          configPath: 'D:/state/local-ai-proxy.json',
          snapshotPath: 'D:/state/local-ai-proxy.snapshot.json',
          logPath: 'D:/logs/local-ai-proxy.log',
          lastError: null,
        },
      }) as any;

    try {
      const data = await openClawBootstrapService.loadBootstrapData({
        assessment: createAssessmentResult({
          runtime: {
            ...createAssessmentResult().runtime,
            runtimeHomeDir: 'D:/stale-home',
          },
        }),
        installResult: createInstallResult(),
      });

      assert.equal(
        data.configPath,
        'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
      );
    } finally {
      kernelPlatformService.ensureRunning = originalEnsureRunning;
      kernelPlatformService.getInfo = originalGetInfo;
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest('openClawBootstrapService resolves the installed openclaw.json and syncs one local-external instance before configuration', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import(
    '@sdkwork/claw-infrastructure'
  );
  const { kernelPlatformService, OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY } = await import(
    '@sdkwork/claw-core'
  );
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

  const originalBridge = getPlatformBridge();
  const originalEnsureRunning = kernelPlatformService.ensureRunning;
  const originalGetInfo = kernelPlatformService.getInfo;
  const fileSystem: Record<string, string> = {
    'D:/Users/admin/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {},
  models: { providers: {} },
  agents: { defaults: {} },
}`,
  };
  const instanceState = createStudioState();
  const ensureCalls: string[] = [];
  const storageSeed = {
    'default-sqlite:studio.provider-center:provider-config-openai-primary': JSON.stringify({
      id: 'provider-config-openai-primary',
      name: 'OpenAI Primary',
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '<SECRET>',
      defaultModelId: 'gpt-4.1',
      models: [
        {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
        },
      ],
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
      },
      createdAt: 1,
      updatedAt: 2,
    }),
  };

  configurePlatformBridge({
    platform: createPlatformStub(fileSystem),
    storage: createStorageStub(storageSeed),
    studio: createStudioStub(originalBridge.studio, instanceState),
  });

  kernelPlatformService.ensureRunning = async () => {
    ensureCalls.push('ensureRunning');
    return null;
  };
  kernelPlatformService.getInfo = async () =>
    ({
      localAiProxy: {
        lifecycle: 'running',
        baseUrl: 'http://ai.sdkwork.localhost:18791/v1',
        rootBaseUrl: 'http://ai.sdkwork.localhost:18791',
        openaiCompatibleBaseUrl: 'http://ai.sdkwork.localhost:18791/v1',
        anthropicBaseUrl: 'http://ai.sdkwork.localhost:18791/v1',
        geminiBaseUrl: 'http://ai.sdkwork.localhost:18791',
        activePort: 18791,
        loopbackOnly: true,
        defaultRouteId: 'local-ai-proxy-system-default-openai-compatible',
        defaultRouteName: 'SDKWork Default',
        upstreamBaseUrl: 'https://ai.sdkwork.com',
        modelCount: 3,
        configPath: 'D:/state/local-ai-proxy.json',
        snapshotPath: 'D:/state/local-ai-proxy.snapshot.json',
        logPath: 'D:/logs/local-ai-proxy.log',
        lastError: null,
      },
    }) as any;

  try {
    const data = await openClawBootstrapService.loadBootstrapData({
      assessment: createAssessmentResult(),
      installResult: createInstallResult(),
    });

    assert.equal(data.configPath, 'D:/Users/admin/.openclaw/openclaw.json');
    assert.equal(typeof data.syncedInstanceId, 'string');
    assert.equal(data.providers.length, 3);
    assert.deepEqual(
      data.providers.find((provider) => provider.id === 'provider-config-openai-primary')
        ? {
            id: data.providers.find((provider) => provider.id === 'provider-config-openai-primary')?.id,
            channelId:
              data.providers.find((provider) => provider.id === 'provider-config-openai-primary')
                ?.channelId,
            baseUrl:
              data.providers.find((provider) => provider.id === 'provider-config-openai-primary')
                ?.baseUrl,
            apiKey:
              data.providers.find((provider) => provider.id === 'provider-config-openai-primary')
                ?.apiKey,
          }
        : null,
      {
        id: 'provider-config-openai-primary',
        channelId: 'openai',
        baseUrl: 'http://ai.sdkwork.localhost:18791/v1',
        apiKey: OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY,
      },
    );
    assert.equal(
      data.providers.some(
        (provider) =>
          provider.id === 'local-ai-proxy-system-default-anthropic' &&
          provider.channelId === 'sdkwork' &&
          provider.baseUrl === 'http://ai.sdkwork.localhost:18791/v1' &&
          provider.apiKey === OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY,
      ),
      true,
    );
    assert.equal(
      data.providers.some(
        (provider) =>
          provider.id === 'local-ai-proxy-system-default-gemini' &&
          provider.channelId === 'sdkwork' &&
          provider.baseUrl === 'http://ai.sdkwork.localhost:18791' &&
          provider.apiKey === OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY,
      ),
      true,
    );
    assert.deepEqual(ensureCalls, ['ensureRunning']);
    assert.ok(data.channels.some((channel) => channel.id === 'telegram'));
    assert.equal(instanceState.created.length, 1);
    assert.equal(instanceState.instances[0]?.deploymentMode, 'local-external');
    assert.equal(instanceState.instances[0]?.runtimeKind, 'openclaw');
    assert.equal(instanceState.instances[0]?.transportKind, 'openclawGatewayWs');
    assert.equal(data.websocketUrl, 'ws://127.0.0.1:28789');
    assert.equal(instanceState.instances[0]?.websocketUrl, 'ws://127.0.0.1:28789');
    assert.equal(instanceState.instances[0]?.config.websocketUrl, 'ws://127.0.0.1:28789');
  } finally {
    kernelPlatformService.ensureRunning = originalEnsureRunning;
    kernelPlatformService.getInfo = originalGetInfo;
    configurePlatformBridge(originalBridge);
  }
});

await runTest(
  'openClawBootstrapService keeps broader OpenAI-compatible provider families visible for OpenClaw bootstrap',
  async () => {
    const { configurePlatformBridge, getPlatformBridge } = await import(
      '@sdkwork/claw-infrastructure'
    );
    const { kernelPlatformService, OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY } = await import(
      '@sdkwork/claw-core'
    );
    const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

    const originalBridge = getPlatformBridge();
    const originalEnsureRunning = kernelPlatformService.ensureRunning;
    const originalGetInfo = kernelPlatformService.getInfo;
    const fileSystem: Record<string, string> = {
      'D:/Users/admin/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {},
  models: { providers: {} },
  agents: { defaults: {} },
}`,
    };
    const instanceState = createStudioState();
    const storageSeed = {
      'default-sqlite:studio.provider-center:provider-config-meta-primary': JSON.stringify({
        id: 'provider-config-meta-primary',
        name: 'Meta Llama Primary',
        providerId: 'meta',
        baseUrl: 'https://meta.example.com/v1',
        apiKey: '<SECRET>',
        defaultModelId: 'llama-4-maverick',
        models: [
          {
            id: 'llama-4-maverick',
            name: 'Llama 4 Maverick',
          },
        ],
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 8192,
          timeoutMs: 60000,
          streaming: true,
        },
        createdAt: 1,
        updatedAt: 2,
      }),
    };

    configurePlatformBridge({
      platform: createPlatformStub(fileSystem),
      storage: createStorageStub(storageSeed),
      studio: createStudioStub(originalBridge.studio, instanceState),
    });

    kernelPlatformService.ensureRunning = async () => null;
    kernelPlatformService.getInfo = async () =>
      ({
        localAiProxy: {
          lifecycle: 'running',
          baseUrl: 'http://ai.sdkwork.localhost:18791/v1',
          rootBaseUrl: 'http://ai.sdkwork.localhost:18791',
          openaiCompatibleBaseUrl: 'http://ai.sdkwork.localhost:18791/v1',
          anthropicBaseUrl: 'http://ai.sdkwork.localhost:18791/v1',
          geminiBaseUrl: 'http://ai.sdkwork.localhost:18791',
          activePort: 18791,
          loopbackOnly: true,
          defaultRouteId: 'local-ai-proxy-system-default-openai-compatible',
          defaultRouteName: 'SDKWork Default',
          upstreamBaseUrl: 'https://ai.sdkwork.com',
          modelCount: 3,
          configPath: 'D:/state/local-ai-proxy.json',
          snapshotPath: 'D:/state/local-ai-proxy.snapshot.json',
          logPath: 'D:/logs/local-ai-proxy.log',
          lastError: null,
        },
      }) as any;

    try {
      const data = await openClawBootstrapService.loadBootstrapData({
        assessment: createAssessmentResult(),
        installResult: createInstallResult(),
      });

      assert.equal(
        data.providers.some(
          (provider) =>
            provider.id === 'provider-config-meta-primary' &&
            provider.channelId === 'meta' &&
            provider.baseUrl === 'http://ai.sdkwork.localhost:18791/v1' &&
            provider.apiKey === OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY,
        ),
        true,
      );
    } finally {
      kernelPlatformService.ensureRunning = originalEnsureRunning;
      kernelPlatformService.getInfo = originalGetInfo;
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest('openClawBootstrapService includes a real gateway validation snapshot instead of assuming the runtime is ready', async () => {
  const { configurePlatformBridge, getPlatformBridge, openClawGatewayClient } = await import(
    '@sdkwork/claw-infrastructure'
  );
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

  const originalBridge = getPlatformBridge();
  const originalValidateAccess = openClawGatewayClient.validateAccess;
  const fileSystem: Record<string, string> = {
    'D:/Users/admin/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {
    telegram: {
      enabled: true,
      botToken: "bot-token"
    }
  },
  models: {
    providers: {
      primary: {
        status: "ready"
      }
    }
  },
  agents: { defaults: {} }
}`,
  };
  const instanceState = createStudioState();
  const storageSeed = {
    'default-sqlite:studio.provider-center:provider-config-openai-primary': JSON.stringify({
      id: 'provider-config-openai-primary',
      name: 'OpenAI Primary',
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '<SECRET>',
      defaultModelId: 'gpt-4.1',
      models: [
        {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
        },
      ],
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
      },
      createdAt: 1,
      updatedAt: 2,
    }),
  };

  configurePlatformBridge({
    platform: createPlatformStub(fileSystem),
    storage: createStorageStub(storageSeed),
    studio: createStudioStub(originalBridge.studio, instanceState),
  });
  openClawGatewayClient.validateAccess = async () => ({
    status: 'unreachable',
    message: 'Gateway is still starting.',
    endpoint: 'http://127.0.0.1:28789',
  });

  try {
    const data = await openClawBootstrapService.loadBootstrapData({
      assessment: createAssessmentResult(),
      installResult: createInstallResult(),
    });
    const snapshot = await openClawBootstrapService.loadVerificationSnapshot({
      instanceId: data.syncedInstanceId,
      configPath: data.configPath,
      selectedChannelIds: ['telegram'],
      packIds: [],
      skillIds: [],
    });

    assert.equal(snapshot.installSucceeded, true);
    assert.equal(snapshot.gatewayReachable, false);
    assert.equal(snapshot.gatewayStatus, 'unreachable');
  } finally {
    openClawGatewayClient.validateAccess = originalValidateAccess;
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawBootstrapService applies provider-center routes through the managed local proxy projection', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import(
    '@sdkwork/claw-infrastructure'
  );
  const {
    kernelPlatformService,
    openClawConfigService,
  } = await import('@sdkwork/claw-core');

  const originalBridge = getPlatformBridge();
  const originalEnsureRunning = kernelPlatformService.ensureRunning;
  const originalGetInfo = kernelPlatformService.getInfo;
  const originalSaveManagedLocalProxyProjection =
    openClawConfigService.saveManagedLocalProxyProjection.bind(openClawConfigService);
  const originalSaveProviderSelection =
    openClawConfigService.saveProviderSelection.bind(openClawConfigService);

  const fileSystem: Record<string, string> = {
    'D:/Users/admin/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {},
  models: { providers: {} },
  agents: { defaults: {} },
}`,
  };
  const instanceState = createStudioState();
  const storageSeed = {
    'default-sqlite:studio.provider-center:provider-config-openai-primary': JSON.stringify({
      id: 'provider-config-openai-primary',
      schemaVersion: 1,
      name: 'OpenAI Primary',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      clientProtocol: 'openai-compatible',
      upstreamProtocol: 'openai-compatible',
      providerId: 'openai',
      upstreamBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'o4-mini',
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
        {
          id: 'o4-mini',
          name: 'o4-mini',
        },
      ],
      config: {
        temperature: 0.35,
        topP: 0.9,
        maxTokens: 24000,
        timeoutMs: 90000,
        streaming: false,
      },
      createdAt: 1,
      updatedAt: 2,
    }),
  };
  const projectionCalls: Array<Record<string, unknown>> = [];
  const ensureCalls: string[] = [];

  configurePlatformBridge({
    platform: createPlatformStub(fileSystem),
    storage: createStorageStub(storageSeed),
    studio: createStudioStub(originalBridge.studio, instanceState),
  });

  kernelPlatformService.ensureRunning = async () => {
    ensureCalls.push('ensureRunning');
    return null;
  };
  kernelPlatformService.getInfo = async () =>
    ({
      localAiProxy: {
        lifecycle: 'running',
        baseUrl: 'http://localhost:18791/v1',
        rootBaseUrl: 'http://localhost:18791',
        openaiCompatibleBaseUrl: 'http://localhost:18791/v1',
        anthropicBaseUrl: 'http://localhost:18791/v1',
        geminiBaseUrl: 'http://localhost:18791',
        activePort: 18791,
        loopbackOnly: true,
        defaultRouteId: 'local-ai-proxy-system-default-openai-compatible',
        defaultRouteName: 'SDKWork Default',
        upstreamBaseUrl: 'https://ai.sdkwork.com',
        modelCount: 2,
        configPath: 'D:/state/local-ai-proxy.json',
        snapshotPath: 'D:/state/local-ai-proxy.snapshot.json',
        logPath: 'D:/logs/local-ai-proxy.log',
        lastError: null,
      },
    }) as any;
  openClawConfigService.saveManagedLocalProxyProjection = async (input) => {
    projectionCalls.push(input as Record<string, unknown>);
    return null as any;
  };
  openClawConfigService.saveProviderSelection = async () => {
    throw new Error('raw upstream provider writes should not be used during bootstrap apply');
  };

  try {
    const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

    const result = await openClawBootstrapService.applyConfiguration({
      configPath: 'D:/Users/admin/.openclaw/openclaw.json',
      syncedInstanceId: 'synced-1',
      providerId: 'provider-config-openai-primary',
      modelSelection: {
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
      },
      channels: [],
      disabledChannelIds: [],
    });

    assert.deepEqual(ensureCalls, ['ensureRunning']);
    assert.equal(projectionCalls.length, 1);
    assert.deepEqual(projectionCalls[0], {
      configPath: 'D:/Users/admin/.openclaw/openclaw.json',
      projection: {
        sourceRoute: {
          id: 'provider-config-openai-primary',
          schemaVersion: 1,
          name: 'OpenAI Primary',
          enabled: true,
          isDefault: true,
          managedBy: 'user',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'openai-compatible',
          providerId: 'openai',
          upstreamBaseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-openai',
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'o4-mini',
          embeddingModelId: undefined,
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
            {
              id: 'o4-mini',
              name: 'o4-mini',
            },
          ],
          notes: undefined,
          exposeTo: ['openclaw'],
        },
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'openai-compatible',
          name: 'SDKWork Local Proxy',
          apiKey: 'sk_sdkwork_api_key',
          baseUrl: 'http://localhost:18791/v1',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
            {
              id: 'o4-mini',
              name: 'o4-mini',
            },
          ],
          notes: 'Managed local proxy projection for route "OpenAI Primary".',
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
          embeddingModelId: undefined,
        },
      },
    });
    assert.equal(result.providerId, 'provider-config-openai-primary');
    assert.equal(result.syncedInstanceId, 'synced-1');
  } finally {
    kernelPlatformService.ensureRunning = originalEnsureRunning;
    kernelPlatformService.getInfo = originalGetInfo;
    openClawConfigService.saveManagedLocalProxyProjection =
      originalSaveManagedLocalProxyProjection;
    openClawConfigService.saveProviderSelection = originalSaveProviderSelection;
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawBootstrapService applies native gemini provider-center routes through the gemini local proxy endpoint', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import(
    '@sdkwork/claw-infrastructure'
  );
  const {
    kernelPlatformService,
    openClawConfigService,
  } = await import('@sdkwork/claw-core');

  const originalBridge = getPlatformBridge();
  const originalEnsureRunning = kernelPlatformService.ensureRunning;
  const originalGetInfo = kernelPlatformService.getInfo;
  const originalSaveManagedLocalProxyProjection =
    openClawConfigService.saveManagedLocalProxyProjection.bind(openClawConfigService);
  const originalSaveProviderSelection =
    openClawConfigService.saveProviderSelection.bind(openClawConfigService);

  const fileSystem: Record<string, string> = {
    'D:/Users/admin/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {},
  models: { providers: {} },
  agents: { defaults: {} },
}`,
  };
  const instanceState = createStudioState();
  const storageSeed = {
    'default-sqlite:studio.provider-center:provider-config-gemini-native': JSON.stringify({
      id: 'provider-config-gemini-native',
      schemaVersion: 1,
      name: 'Gemini Native',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      clientProtocol: 'gemini',
      upstreamProtocol: 'gemini',
      providerId: 'google',
      upstreamBaseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'sk-gemini',
      defaultModelId: 'gemini-2.5-pro',
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
      config: {
        temperature: 0.25,
        topP: 0.95,
        maxTokens: 32000,
        timeoutMs: 70000,
        streaming: true,
      },
      createdAt: 1,
      updatedAt: 2,
    }),
  };
  const projectionCalls: Array<Record<string, unknown>> = [];
  const ensureCalls: string[] = [];

  configurePlatformBridge({
    platform: createPlatformStub(fileSystem),
    storage: createStorageStub(storageSeed),
    studio: createStudioStub(originalBridge.studio, instanceState),
  });

  kernelPlatformService.ensureRunning = async () => {
    ensureCalls.push('ensureRunning');
    return null;
  };
  kernelPlatformService.getInfo = async () =>
    ({
      localAiProxy: {
        lifecycle: 'running',
        baseUrl: 'http://localhost:18791/v1',
        rootBaseUrl: 'http://localhost:18791',
        openaiCompatibleBaseUrl: 'http://localhost:18791/v1',
        anthropicBaseUrl: 'http://localhost:18791/v1',
        geminiBaseUrl: 'http://localhost:18791',
        activePort: 18791,
        loopbackOnly: true,
        defaultRouteId: 'local-ai-proxy-system-default-openai-compatible',
        defaultRouteName: 'SDKWork Default',
        upstreamBaseUrl: 'https://ai.sdkwork.com',
        modelCount: 2,
        configPath: 'D:/state/local-ai-proxy.json',
        snapshotPath: 'D:/state/local-ai-proxy.snapshot.json',
        logPath: 'D:/logs/local-ai-proxy.log',
        lastError: null,
      },
    }) as any;
  openClawConfigService.saveManagedLocalProxyProjection = async (input) => {
    projectionCalls.push(input as Record<string, unknown>);
    return null as any;
  };
  openClawConfigService.saveProviderSelection = async () => {
    throw new Error('raw upstream provider writes should not be used during bootstrap apply');
  };

  try {
    const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

    const result = await openClawBootstrapService.applyConfiguration({
      configPath: 'D:/Users/admin/.openclaw/openclaw.json',
      syncedInstanceId: 'synced-1',
      providerId: 'provider-config-gemini-native',
      modelSelection: {
        defaultModelId: 'gemini-2.5-pro',
        embeddingModelId: 'text-embedding-004',
      },
      channels: [],
      disabledChannelIds: [],
    });

    assert.deepEqual(ensureCalls, ['ensureRunning']);
    assert.equal(projectionCalls.length, 1);
    assert.deepEqual(projectionCalls[0], {
      configPath: 'D:/Users/admin/.openclaw/openclaw.json',
      projection: {
        sourceRoute: {
          id: 'provider-config-gemini-native',
          schemaVersion: 1,
          name: 'Gemini Native',
          enabled: true,
          isDefault: true,
          managedBy: 'user',
          clientProtocol: 'gemini',
          upstreamProtocol: 'gemini',
          providerId: 'google',
          upstreamBaseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: 'sk-gemini',
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
          notes: undefined,
          exposeTo: ['openclaw'],
        },
        provider: {
          id: 'sdkwork-local-proxy',
          channelId: 'gemini',
          name: 'SDKWork Local Proxy',
          apiKey: 'sk_sdkwork_api_key',
          baseUrl: 'http://localhost:18791',
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
          notes: 'Managed local proxy projection for route "Gemini Native".',
          config: {
            temperature: 0.25,
            topP: 0.95,
            maxTokens: 32000,
            timeoutMs: 70000,
            streaming: true,
          },
        },
        selection: {
          defaultModelId: 'gemini-2.5-pro',
          reasoningModelId: undefined,
          embeddingModelId: 'text-embedding-004',
        },
      },
    });
    assert.equal(result.providerId, 'provider-config-gemini-native');
    assert.equal(result.syncedInstanceId, 'synced-1');
  } finally {
    kernelPlatformService.ensureRunning = originalEnsureRunning;
    kernelPlatformService.getInfo = originalGetInfo;
    openClawConfigService.saveManagedLocalProxyProjection =
      originalSaveManagedLocalProxyProjection;
    openClawConfigService.saveProviderSelection = originalSaveProviderSelection;
    configurePlatformBridge(originalBridge);
  }
});
