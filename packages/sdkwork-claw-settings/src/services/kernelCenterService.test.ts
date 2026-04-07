import assert from 'node:assert/strict';
import type {
  HostPlatformStatusRecord,
  ManageRolloutListResult,
  RuntimeDesktopKernelInfo,
  RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import type { KernelPlatformSnapshot } from '@sdkwork/claw-core';
import {
  DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
} from '../../../sdkwork-claw-types/src/openclawRelease.ts';

const LOCAL_AI_PROXY_ROOT_BASE_URL = 'http://localhost:18791';
const LOCAL_AI_PROXY_BASE_URL = `${LOCAL_AI_PROXY_ROOT_BASE_URL}/v1`;

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createSnapshot(
  overrides: Partial<KernelPlatformSnapshot> = {},
): KernelPlatformSnapshot {
  const raw: KernelPlatformSnapshot['raw'] = {
    topology: {
      kind: 'localManagedNative',
      state: 'installed',
      label: 'Built-In Native Runtime',
      recommended: true,
    },
    runtime: {
      state: 'running',
      health: 'healthy',
      reason: 'Kernel attached to a healthy bundled OpenClaw runtime.',
      startedBy: 'appSupervisor',
      lastTransitionAt: 1_743_100_000_000,
    },
    endpoint: {
      preferredPort: 18789,
      activePort: 18845,
      baseUrl: 'http://127.0.0.1:18845',
      websocketUrl: 'ws://127.0.0.1:18845',
      loopbackOnly: true,
      dynamicPort: true,
      endpointSource: 'allocated',
    },
    host: {
      serviceManager: 'windowsService',
      ownership: 'appSupervisor',
      serviceName: 'ClawStudioOpenClawKernel',
      serviceConfigPath: 'C:/ProgramData/SdkWork/ClawStudio/kernel/windows-service.json',
      startupMode: 'auto',
      attachSupported: true,
      repairSupported: true,
      controlSocket: {
        socketKind: 'namedPipe',
        location: '\\\\.\\pipe\\claw-studio-openclaw',
        available: false,
      },
    },
    provenance: {
      runtimeId: 'openclaw',
      installKey: `${DEFAULT_BUNDLED_OPENCLAW_VERSION}-windows-x64`,
      openclawVersion: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      nodeVersion: DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
      platform: 'windows',
      arch: 'x64',
      installSource: 'bundled',
      configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
      runtimeHomeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
      runtimeInstallDir: `C:/Program Files/SdkWork/CrawStudio/runtimes/openclaw/${DEFAULT_BUNDLED_OPENCLAW_VERSION}-windows-x64`,
    },
  };

  return {
    raw,
    topologyKind: raw.topology.kind,
    topologyState: raw.topology.state,
    runtimeState: raw.runtime.state,
    runtimeHealth: raw.runtime.health,
    hostManager: raw.host.serviceManager,
    controlMode: 'supervisedFallback',
    baseUrl: raw.endpoint.baseUrl,
    websocketUrl: raw.endpoint.websocketUrl,
    preferredPort: raw.endpoint.preferredPort,
    activePort: raw.endpoint.activePort,
    usesDynamicPort: raw.endpoint.dynamicPort,
    serviceConfigPath: raw.host.serviceConfigPath,
    openclawVersion: raw.provenance.openclawVersion,
    nodeVersion: raw.provenance.nodeVersion,
    ...overrides,
  };
}

function createKernelInfo(
  overrides: Partial<RuntimeDesktopKernelInfo> = {},
): RuntimeDesktopKernelInfo {
  const snapshot = createSnapshot();
  return {
    directories: {
      installRoot: 'C:/Program Files/Claw Studio',
      modulesDir: 'C:/Program Files/Claw Studio/modules',
      runtimesDir: 'C:/ProgramData/SdkWork/ClawStudio/runtime',
      machineRoot: 'C:/ProgramData/SdkWork/ClawStudio',
      machineStateDir: 'C:/ProgramData/SdkWork/ClawStudio/state',
      machineStoreDir: 'C:/ProgramData/SdkWork/ClawStudio/store',
      machineStagingDir: 'C:/ProgramData/SdkWork/ClawStudio/staging',
      userRoot: 'C:/Users/admin/.sdkwork/crawstudio',
      studioDir: 'C:/Users/admin/.sdkwork/crawstudio/studio',
      storageDir: 'C:/Users/admin/.sdkwork/crawstudio/storage',
      pluginsDir: 'C:/Users/admin/.sdkwork/crawstudio/plugins',
      integrationsDir: 'C:/Users/admin/.sdkwork/crawstudio/integrations',
      backupsDir: 'C:/Users/admin/.sdkwork/crawstudio/backups',
    },
    capabilities: [
      {
        key: 'doctor',
        status: 'ready',
        detail: 'Health diagnostics are available.',
      },
      {
        key: 'upgrades',
        status: 'planned',
        detail: 'Slot-based upgrades will be exposed next.',
      },
    ],
    filesystem: {
      defaultWorkingDirectory: 'C:/Users/admin',
      managedRoots: ['C:/Users/admin/.sdkwork/crawstudio'],
      supportsBinaryIo: true,
    },
    security: {
      strictPathPolicy: true,
      allowExternalHttp: false,
      allowCustomProcessCwd: false,
      allowedSpawnCommands: ['node'],
    },
    process: {
      defaultTimeoutMs: 120000,
      maxConcurrentJobs: 4,
      activeJobCount: 0,
      activeProcessJobCount: 0,
      availableProfiles: [],
    },
    permissions: {
      entries: [],
    },
    notifications: {
      enabled: true,
      provider: 'native',
      requireUserConsent: true,
      status: 'ready',
      availableProviders: [],
    },
    payments: {
      provider: 'none',
      sandbox: true,
      status: 'planned',
      availableProviders: [],
    },
    integrations: {
      pluginsEnabled: true,
      remoteApiEnabled: true,
      allowUnsignedPlugins: false,
      pluginsDir: 'C:/Users/admin/.sdkwork/crawstudio/plugins',
      integrationsDir: 'C:/Users/admin/.sdkwork/crawstudio/integrations',
      installedPluginCount: 2,
      status: 'ready',
      availableAdapters: [],
    },
    supervisor: {
      lifecycle: 'active',
      shutdownRequested: false,
      serviceCount: 1,
      managedServiceIds: ['openclaw'],
      services: [
        {
          id: 'openclaw',
          displayName: 'OpenClaw',
          lifecycle: 'running',
          pid: 4321,
          restartCount: 1,
        },
      ],
    },
    localAiProxy: {
      lifecycle: 'running',
      baseUrl: LOCAL_AI_PROXY_BASE_URL,
      rootBaseUrl: LOCAL_AI_PROXY_ROOT_BASE_URL,
      openaiCompatibleBaseUrl: LOCAL_AI_PROXY_BASE_URL,
      anthropicBaseUrl: LOCAL_AI_PROXY_BASE_URL,
      geminiBaseUrl: LOCAL_AI_PROXY_ROOT_BASE_URL,
      activePort: 18791,
      loopbackOnly: true,
      defaultRouteId: 'local-ai-proxy-system-default-openai-compatible',
      defaultRouteName: 'SDKWork Default',
      defaultRoutes: [
        {
          clientProtocol: 'openai-compatible',
          id: 'local-ai-proxy-system-default-openai-compatible',
          name: 'SDKWork Default',
          managedBy: 'system-default',
          upstreamProtocol: 'sdkwork',
          upstreamBaseUrl: 'https://ai.sdkwork.com',
          modelCount: 3,
        },
        {
          clientProtocol: 'anthropic',
          id: 'local-ai-proxy-system-default-anthropic',
          name: 'SDKWork Anthropic Default',
          managedBy: 'system-default',
          upstreamProtocol: 'sdkwork',
          upstreamBaseUrl: 'https://ai.sdkwork.com',
          modelCount: 3,
        },
        {
          clientProtocol: 'gemini',
          id: 'local-ai-proxy-system-default-gemini',
          name: 'SDKWork Gemini Default',
          managedBy: 'system-default',
          upstreamProtocol: 'sdkwork',
          upstreamBaseUrl: 'https://ai.sdkwork.com',
          modelCount: 3,
        },
      ],
      upstreamBaseUrl: 'https://ai.sdkwork.com',
      modelCount: 3,
      configPath: 'C:/ProgramData/SdkWork/ClawStudio/state/local-ai-proxy.json',
      snapshotPath: 'C:/ProgramData/SdkWork/ClawStudio/runtime/state/local-ai-proxy.snapshot.json',
      logPath: 'C:/ProgramData/SdkWork/ClawStudio/logs/app/local-ai-proxy.log',
      lastError: null,
    },
    bundledComponents: {
      componentCount: 2,
      defaultStartupComponentIds: ['openclaw'],
      autoUpgradeEnabled: true,
      approvalMode: 'managed',
      components: [
        {
          id: 'openclaw',
          displayName: 'OpenClaw',
          kind: 'runtime',
          bundledVersion: DEFAULT_BUNDLED_OPENCLAW_VERSION,
          startupMode: 'embedded',
          installSubdir: 'runtime/openclaw',
        },
      ],
    },
    storage: {
      activeProfileId: 'default-sqlite',
      rootDir: 'C:/Users/admin/.sdkwork/crawstudio/storage',
      providers: [],
      profiles: [
        {
          id: 'default-sqlite',
          label: 'SQLite Profile',
          provider: 'sqlite',
          active: true,
          availability: 'ready',
          namespace: 'claw-studio',
          readOnly: false,
          path: 'C:/Users/admin/.sdkwork/crawstudio/storage/default.db',
          connectionConfigured: false,
          databaseConfigured: true,
          endpointConfigured: false,
        },
      ],
    },
    host: snapshot.raw,
    ...overrides,
  };
}

function createHostPlatformStatus(
  overrides: Partial<HostPlatformStatusRecord> = {},
): HostPlatformStatusRecord {
  return {
    mode: 'desktopCombined',
    lifecycle: 'ready',
    distributionFamily: 'desktop',
    deploymentFamily: 'bareMetal',
    acceleratorProfile: null,
    hostId: 'desktop-combined',
    displayName: 'Desktop Combined Host',
    version: '0.1.0',
    desiredStateProjectionVersion: 'phase1',
    rolloutEngineVersion: 'phase1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    stateStoreDriver: 'sqlite',
    stateStore: {
      activeProfileId: 'default-sqlite',
      providers: [
        {
          id: 'sqlite',
          label: 'SQLite',
          availability: 'ready',
          requiresConfiguration: false,
          configurationKeys: [],
          projectionMode: 'runtime',
        },
      ],
      profiles: [
        {
          id: 'default-sqlite',
          label: 'SQLite',
          driver: 'sqlite',
          active: true,
          availability: 'ready',
          path: 'C:/Users/admin/.sdkwork/crawstudio/storage/default.db',
          connectionConfigured: false,
          configuredKeys: ['path'],
          projectionMode: 'runtime',
        },
      ],
    },
    capabilityKeys: ['nodeSessions', 'rollouts'],
    updatedAt: 1_743_100_100_000,
    ...overrides,
  };
}

function createRolloutListResult(
  overrides: Partial<ManageRolloutListResult> = {},
): ManageRolloutListResult {
  return {
    items: [
      {
        id: 'desktop-bootstrap',
        phase: 'ready',
        attempt: 1,
        targetCount: 1,
        updatedAt: 1_743_100_200_000,
      },
      {
        id: 'remote-repair',
        phase: 'failed',
        attempt: 2,
        targetCount: 2,
        updatedAt: 1_743_100_300_000,
      },
    ],
    total: 2,
    ...overrides,
  };
}

function createRuntimeInfo(
  overrides: Partial<RuntimeInfo> = {},
): RuntimeInfo {
  return {
    platform: 'desktop',
    startup: {
      hostMode: 'desktopCombined',
      distributionFamily: 'desktop',
      deploymentFamily: 'bareMetal',
      acceleratorProfile: null,
      hostedBrowser: true,
      apiBasePath: '/claw/api',
      manageBasePath: '/claw/manage/v1',
      internalBasePath: '/claw/internal/v1',
      browserBaseUrl: 'http://127.0.0.1:18797',
      hostEndpointId: 'claw-manage-http',
      hostRequestedPort: 18797,
      hostActivePort: 18797,
      hostLoopbackOnly: true,
      hostDynamicPort: false,
      stateStoreDriver: 'sqlite',
      stateStoreProfileId: 'default-sqlite',
      runtimeDataDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
      webDistDir: 'C:/Program Files/Claw Studio/resources/web-dist',
    },
    app: null,
    paths: null,
    config: null,
    system: null,
    ...overrides,
  };
}

await runTest('kernelCenterService composes kernel status, host ownership, and storage into a dashboard model', async () => {
  const { createKernelCenterService } = await import('./kernelCenterService.ts');

  const service = createKernelCenterService({
    kernelPlatformService: {
      getInfo: async () => createKernelInfo(),
      getStatus: async () => createSnapshot(),
      ensureRunning: async () => createSnapshot(),
      restart: async () => createSnapshot(),
    },
    hostPlatformService: {
      getStatus: async () => ({
        ...createHostPlatformStatus(),
        capabilityCount: 2,
        isReady: true,
      }),
    },
    rolloutService: {
      list: async () => createRolloutListResult(),
      summarizePhases: () => ({
        active: 1,
        failed: 1,
        completed: 0,
        paused: 0,
        drafts: 0,
      }),
    },
    hostRuntimeModeService: {
      getSummary: async () => ({
        mode: 'desktopCombined',
        modeLabel: 'Desktop Combined',
        lifecycle: 'ready',
        lifecycleLabel: 'Ready',
        browserManagementSupported: true,
        browserManagementAvailable: true,
        browserManagementLabel: 'Embedded Browser Management',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
      }),
    },
    hostPortSettingsService: {
      getSummary: async () => ({
        totalEndpoints: 2,
        readyEndpoints: 2,
        conflictedEndpoints: 1,
        dynamicPortEndpoints: 2,
        browserBaseUrl: 'http://127.0.0.1:18797',
        rows: [
          {
            endpointId: 'claw-manage-http',
            bindHost: '127.0.0.1',
            requestedPort: 18797,
            activePort: 18797,
            portBindingLabel: '18797',
            statusLabel: 'Requested Port Active',
            exposureLabel: 'Loopback Only',
            conflictSummary: null,
            baseUrl: 'http://127.0.0.1:18797',
            websocketUrl: null,
          },
          {
            endpointId: 'openclaw-gateway-http',
            bindHost: '0.0.0.0',
            requestedPort: 18801,
            activePort: 18819,
            portBindingLabel: '18801 -> 18819',
            statusLabel: 'Fallback Active',
            exposureLabel: 'Network',
            conflictSummary: 'Requested port unavailable: EADDRINUSE',
            baseUrl: 'http://0.0.0.0:18819',
            websocketUrl: 'ws://0.0.0.0:18819',
          },
        ],
      }),
    },
    runtimeApi: {
      getRuntimeInfo: async () => createRuntimeInfo(),
    },
  });

  const dashboard = await service.getDashboard();

  assert.equal(dashboard.snapshot?.runtimeState, 'running');
  assert.equal(dashboard.statusTone, 'healthy');
  assert.equal(dashboard.host.serviceManagerLabel, 'Windows Service');
  assert.equal(dashboard.host.ownershipLabel, 'App Supervisor Fallback');
  assert.equal(dashboard.host.controlSocketAvailable, false);
  assert.equal(dashboard.endpoint.activePort, 18845);
  assert.equal(dashboard.endpoint.usesDynamicPort, true);
  assert.equal(dashboard.localAiProxy.lifecycle, 'Running');
  assert.equal(dashboard.localAiProxy.baseUrl, LOCAL_AI_PROXY_BASE_URL);
  assert.equal(dashboard.localAiProxy.rootBaseUrl, LOCAL_AI_PROXY_ROOT_BASE_URL);
  assert.equal(dashboard.localAiProxy.openaiCompatibleBaseUrl, LOCAL_AI_PROXY_BASE_URL);
  assert.equal(dashboard.localAiProxy.anthropicBaseUrl, LOCAL_AI_PROXY_BASE_URL);
  assert.equal(dashboard.localAiProxy.geminiBaseUrl, LOCAL_AI_PROXY_ROOT_BASE_URL);
  assert.equal(dashboard.localAiProxy.defaultRouteName, 'SDKWork Default');
  assert.deepEqual(
    dashboard.localAiProxy.defaultRoutes.map((route) => ({
      clientProtocol: route.clientProtocol,
      name: route.name,
      managedBy: route.managedBy,
      modelCount: route.modelCount,
    })),
    [
      {
        clientProtocol: 'openai-compatible',
        name: 'SDKWork Default',
        managedBy: 'system-default',
        modelCount: 3,
      },
      {
        clientProtocol: 'anthropic',
        name: 'SDKWork Anthropic Default',
        managedBy: 'system-default',
        modelCount: 3,
      },
      {
        clientProtocol: 'gemini',
        name: 'SDKWork Gemini Default',
        managedBy: 'system-default',
        modelCount: 3,
      },
    ],
  );
  assert.equal(dashboard.storage.activeProfileLabel, 'SQLite Profile');
  assert.equal(dashboard.storage.activeProfilePath?.endsWith('default.db'), true);
  assert.deepEqual(dashboard.capabilities.readyKeys, ['doctor']);
  assert.deepEqual(dashboard.capabilities.plannedKeys, ['upgrades']);
  assert.equal(dashboard.provenance.installSourceLabel, 'Bundled');
  assert.equal(dashboard.hostPlatform.modeLabel, 'Desktop Combined');
  assert.equal(dashboard.hostPlatform.lifecycleLabel, 'Ready');
  assert.deepEqual(dashboard.hostPlatform.capabilityKeys, ['nodeSessions', 'rollouts']);
  assert.equal(dashboard.hostPlatform.manageBasePath, '/claw/manage/v1');
  assert.equal(dashboard.hostRuntime.modeLabel, 'Desktop Combined');
  assert.equal(dashboard.hostRuntime.browserManagementAvailable, true);
  assert.equal(dashboard.hostRuntime.browserManagementLabel, 'Embedded Browser Management');
  assert.equal(dashboard.hostRuntimeContract.hostMode, 'desktopCombined');
  assert.equal(dashboard.hostRuntimeContract.distributionFamily, 'desktop');
  assert.equal(dashboard.hostRuntimeContract.deploymentFamily, 'bareMetal');
  assert.equal(dashboard.hostRuntimeContract.acceleratorProfile, null);
  assert.equal(dashboard.hostRuntimeContract.browserBaseUrl, 'http://127.0.0.1:18797');
  assert.equal(dashboard.hostRuntimeContract.hostEndpointId, 'claw-manage-http');
  assert.equal(dashboard.hostRuntimeContract.hostRequestedPort, 18797);
  assert.equal(dashboard.hostRuntimeContract.hostActivePort, 18797);
  assert.equal(dashboard.hostRuntimeContract.hostLoopbackOnly, true);
  assert.equal(dashboard.hostRuntimeContract.hostDynamicPort, false);
  assert.equal(dashboard.hostRuntimeContract.stateStoreDriver, 'sqlite');
  assert.equal(dashboard.hostRuntimeContract.stateStoreProfileId, 'default-sqlite');
  assert.equal(dashboard.hostRuntimeContract.runtimeDataDir, 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home');
  assert.equal(dashboard.hostRuntimeContract.webDistDir, 'C:/Program Files/Claw Studio/resources/web-dist');
  assert.equal(dashboard.hostEndpoints.totalEndpoints, 2);
  assert.equal(dashboard.hostEndpoints.conflictedEndpoints, 1);
  assert.equal(dashboard.hostEndpoints.browserBaseUrl, 'http://127.0.0.1:18797');
  assert.equal(dashboard.hostEndpoints.rows[1]?.portBindingLabel, '18801 -> 18819');
  assert.equal(dashboard.rollouts.total, 2);
  assert.equal(dashboard.rollouts.phaseCounts.active, 1);
  assert.equal(dashboard.rollouts.phaseCounts.failed, 1);
  assert.equal(dashboard.rollouts.latestUpdatedAt, 1_743_100_300_000);
});

await runTest(
  'kernelCenterService forwards ensureRunning and restart actions and degrades gracefully when host governance details are unavailable',
  async () => {
  const { createKernelCenterService } = await import('./kernelCenterService.ts');

  const calls: string[] = [];
  const service = createKernelCenterService({
    kernelPlatformService: {
      getInfo: async () => createKernelInfo(),
      getStatus: async () => createSnapshot(),
      ensureRunning: async () => {
        calls.push('ensureRunning');
        return createSnapshot({ controlMode: 'nativeService' });
      },
      restart: async () => {
        calls.push('restart');
        return createSnapshot({ runtimeState: 'recovering' });
      },
    },
    hostPlatformService: {
      getStatus: async () => ({
        ...createHostPlatformStatus({ lifecycle: 'degraded' }),
        capabilityCount: 2,
        isReady: false,
      }),
    },
    rolloutService: {
      list: async () => createRolloutListResult(),
      summarizePhases: () => ({
        active: 1,
        failed: 1,
        completed: 0,
        paused: 0,
        drafts: 0,
      }),
    },
    runtimeApi: {
      getRuntimeInfo: async () => ({ platform: 'desktop', startup: null }),
    },
  });

  const ensured = await service.ensureRunning();
  const restarted = await service.restart();

  assert.deepEqual(calls, ['ensureRunning', 'restart']);
  assert.equal(ensured.snapshot?.controlMode, 'nativeService');
  assert.equal(restarted.snapshot?.runtimeState, 'recovering');
  assert.equal(ensured.hostPlatform.lifecycleLabel, 'Degraded');
  assert.equal(ensured.hostRuntime.modeLabel, 'Desktop Combined');
  assert.equal(ensured.hostRuntime.lifecycleLabel, 'Degraded');
  assert.equal(ensured.hostRuntime.browserManagementAvailable, false);
  assert.equal(ensured.hostRuntime.browserManagementLabel, 'Host Runtime Available');
  assert.equal(ensured.hostRuntimeContract.hostMode, null);
  assert.equal(ensured.hostRuntimeContract.stateStoreDriver, null);
  assert.equal(ensured.hostRuntimeContract.runtimeDataDir, null);
  assert.equal(ensured.hostEndpoints.totalEndpoints, 0);
  assert.equal(ensured.hostEndpoints.rows.length, 0);
  assert.equal(ensured.hostEndpoints.browserBaseUrl, null);
});
