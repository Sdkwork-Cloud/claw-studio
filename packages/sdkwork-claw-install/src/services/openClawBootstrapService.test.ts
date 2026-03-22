import assert from 'node:assert/strict';
import type {
  HubInstallAssessmentResult,
  HubInstallResult,
  PlatformAPI,
  StudioPlatformAPI,
} from '@sdkwork/claw-infrastructure';

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
    pathExists: async (path) => fileSystem[path.replace(/\\/g, '/')] !== undefined,
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
    writeFile: async (path, content) => {
      fileSystem[path.replace(/\\/g, '/')] = content;
    },
    ...overrides,
  };
}

function createStudioStub(
  originalStudio: StudioPlatformAPI,
  instanceState: {
    instances: Array<Awaited<ReturnType<StudioPlatformAPI['createInstance']>>>;
    created: Array<Record<string, unknown>>;
    updated: Array<{ id: string; input: Record<string, unknown> }>;
  },
): StudioPlatformAPI {
  return {
    listInstances: async () => instanceState.instances.map((instance) => ({ ...instance })),
    getInstance: async (id) =>
      instanceState.instances.find((instance) => instance.id === id) || null,
    getInstanceDetail: originalStudio.getInstanceDetail.bind(originalStudio),
    createInstance: async (input) => {
      const created = {
        id: `synced-${instanceState.instances.length + 1}`,
        name: input.name,
        description: input.description,
        runtimeKind: input.runtimeKind,
        deploymentMode: input.deploymentMode,
        transportKind: input.transportKind,
        status: 'online' as const,
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
      };

      instanceState.instances.push(created);
      instanceState.created.push(input as Record<string, unknown>);
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
      instanceState.updated.push({ id, input: input as Record<string, unknown> });
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
    updateInstanceTaskStatus: originalStudio.updateInstanceTaskStatus.bind(originalStudio),
    deleteInstanceTask: originalStudio.deleteInstanceTask.bind(originalStudio),
    listConversations: originalStudio.listConversations.bind(originalStudio),
    putConversation: originalStudio.putConversation.bind(originalStudio),
    deleteConversation: originalStudio.deleteConversation.bind(originalStudio),
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

await runTest('openClawBootstrapService resolves the installed openclaw.json and syncs one local-external instance before configuration', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import(
    '@sdkwork/claw-infrastructure'
  );
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

  const originalBridge = getPlatformBridge();
  const fileSystem: Record<string, string> = {
    'D:/Users/admin/.openclaw/openclaw.json': `{
  gateway: { port: 28789 },
  channels: {},
  models: { providers: {} },
  agents: { defaults: {} },
}`,
  };
  const instanceState = {
    instances: [],
    created: [] as Array<Record<string, unknown>>,
    updated: [] as Array<{ id: string; input: Record<string, unknown> }>,
  };

  configurePlatformBridge({
    platform: createPlatformStub(fileSystem),
    studio: createStudioStub(originalBridge.studio, instanceState),
  });

  try {
    const data = await openClawBootstrapService.loadBootstrapData({
      assessment: createAssessmentResult(),
      installResult: createInstallResult(),
    });

    assert.equal(data.configPath, 'D:/Users/admin/.openclaw/openclaw.json');
    assert.equal(typeof data.syncedInstanceId, 'string');
    assert.ok(data.providers.length >= 1);
    assert.ok(data.channels.some((channel) => channel.id === 'telegram'));
    assert.equal(instanceState.created.length, 1);
    assert.equal(instanceState.instances[0]?.deploymentMode, 'local-external');
    assert.equal(instanceState.instances[0]?.runtimeKind, 'openclaw');
    assert.equal(instanceState.instances[0]?.transportKind, 'openclawGatewayWs');
    assert.equal(data.websocketUrl, 'ws://127.0.0.1:28789');
    assert.equal(instanceState.instances[0]?.websocketUrl, 'ws://127.0.0.1:28789');
    assert.equal(instanceState.instances[0]?.config.websocketUrl, 'ws://127.0.0.1:28789');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

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
  const instanceState = {
    instances: [],
    created: [] as Array<Record<string, unknown>>,
    updated: [] as Array<{ id: string; input: Record<string, unknown> }>,
  };

  configurePlatformBridge({
    platform: createPlatformStub(fileSystem),
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
