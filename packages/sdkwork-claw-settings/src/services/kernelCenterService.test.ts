import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const DEFAULT_RUNTIME_VERSION = 'v2026.4.11';
const DEFAULT_NODE_VERSION = '22.0.0';
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

async function readKernelCenterServiceSource() {
  return readFile(new URL('./kernelCenterService.ts', import.meta.url), 'utf8');
}

function createSnapshot(overrides: Record<string, unknown> = {}) {
  const raw = {
    topology: {
      kind: 'localManagedNative',
      state: 'installed',
      label: 'Built-In Native Runtime',
      recommended: true,
    },
    runtime: {
      state: 'running',
      health: 'healthy',
      reason: 'Kernel attached to a healthy packaged OpenClaw install.',
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
      installKey: `${DEFAULT_RUNTIME_VERSION}-windows-x64`,
      runtimeVersion: DEFAULT_RUNTIME_VERSION,
      nodeVersion: DEFAULT_NODE_VERSION,
      platform: 'windows',
      arch: 'x64',
      installSource: 'bundled',
      configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
      runtimeHomeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
      runtimeInstallDir:
        `C:/Program Files/SdkWork/CrawStudio/runtimes/openclaw/${DEFAULT_RUNTIME_VERSION}-windows-x64`,
    },
  };

  return {
    raw,
    topologyKind: raw.topology.kind,
    topologyState: raw.topology.state,
    runtimeState: raw.runtime.state,
    runtimeHealth: raw.runtime.health,
    runtimeId: raw.provenance.runtimeId,
    hostManager: raw.host.serviceManager,
    controlMode: 'supervisedFallback',
    baseUrl: raw.endpoint.baseUrl,
    websocketUrl: raw.endpoint.websocketUrl,
    preferredPort: raw.endpoint.preferredPort,
    activePort: raw.endpoint.activePort,
    usesDynamicPort: raw.endpoint.dynamicPort,
    serviceConfigPath: raw.host.serviceConfigPath,
    runtimeVersion: raw.provenance.runtimeVersion,
    nodeVersion: raw.provenance.nodeVersion,
    ...overrides,
  };
}

function createKernelInfo(overrides: Record<string, unknown> = {}) {
  const snapshot = createSnapshot();

  return {
    capabilities: [
      { key: 'doctor', status: 'ready', detail: 'Health diagnostics are available.' },
      { key: 'upgrades', status: 'planned', detail: 'Slot-based upgrades will be exposed next.' },
    ],
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
    localAiProxy: {
      lifecycle: 'running',
      baseUrl: LOCAL_AI_PROXY_BASE_URL,
      rootBaseUrl: LOCAL_AI_PROXY_ROOT_BASE_URL,
      openaiCompatibleBaseUrl: LOCAL_AI_PROXY_BASE_URL,
      anthropicBaseUrl: LOCAL_AI_PROXY_BASE_URL,
      geminiBaseUrl: LOCAL_AI_PROXY_ROOT_BASE_URL,
      activePort: 18791,
      loopbackOnly: true,
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
      ],
      upstreamBaseUrl: 'https://ai.sdkwork.com',
      modelCount: 3,
      routeMetrics: [],
      routeTests: [],
      messageCaptureEnabled: false,
      observabilityDbPath: null,
      configPath: 'C:/ProgramData/SdkWork/ClawStudio/state/local-ai-proxy.json',
      snapshotPath: 'C:/ProgramData/SdkWork/ClawStudio/runtime/state/local-ai-proxy.snapshot.json',
      logPath: 'C:/ProgramData/SdkWork/ClawStudio/logs/app/local-ai-proxy.log',
      lastError: null,
    },
    host: snapshot.raw,
    ...overrides,
  };
}

function createHostPlatformStatus(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'desktopCombined',
    lifecycle: 'ready',
    hostId: 'desktop-combined',
    displayName: 'Desktop Combined Host',
    version: '0.1.0',
    desiredStateProjectionVersion: 'phase1',
    rolloutEngineVersion: 'phase1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    capabilityKeys: ['nodeSessions', 'rollouts'],
    capabilityCount: 2,
    isReady: true,
    ...overrides,
  };
}

function createRolloutListResult(overrides: Record<string, unknown> = {}) {
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

function createRuntimeInfo(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'desktop',
    startup: {
      hostMode: 'desktopCombined',
      distributionFamily: 'desktop',
      deploymentFamily: 'bareMetal',
      acceleratorProfile: null,
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
    ...overrides,
  };
}

let kernelCenterServiceModule:
  | typeof import('./kernelCenterService.ts')
  | undefined;

try {
  kernelCenterServiceModule = await import('./kernelCenterService.ts');
} catch {
  kernelCenterServiceModule = undefined;
}

if (kernelCenterServiceModule) {
  await runTest(
    'kernelCenterService composes the shared dashboard model with runtimeVersion provenance',
    async () => {
      const { createKernelCenterService } = kernelCenterServiceModule;

      const service = createKernelCenterService({
        kernelPlatformService: {
          getInfo: async () => createKernelInfo(),
          getStatus: async () => createSnapshot(),
          ensureRunning: async () => createSnapshot(),
          restart: async () => createSnapshot(),
        },
        hostPlatformService: {
          getStatus: async () => createHostPlatformStatus(),
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
          getRuntimeInfo: async () => createRuntimeInfo(),
        },
      });

      const dashboard = await service.getDashboard();

      assert.equal(dashboard.snapshot?.runtimeState, 'running');
      assert.equal(dashboard.statusTone, 'healthy');
      assert.equal(dashboard.host.serviceManagerLabel, 'Windows Service');
      assert.equal(dashboard.host.ownershipLabel, 'App Supervisor Fallback');
      assert.equal(dashboard.endpoint.activePort, 18845);
      assert.equal(dashboard.localAiProxy.baseUrl, LOCAL_AI_PROXY_BASE_URL);
      assert.equal(dashboard.localAiProxy.defaultRouteName, 'SDKWork Default');
      assert.equal(dashboard.storage.activeProfileLabel, 'SQLite Profile');
      assert.deepEqual(dashboard.capabilities.readyKeys, ['doctor']);
      assert.deepEqual(dashboard.capabilities.plannedKeys, ['upgrades']);
      assert.equal(dashboard.provenance.installSource, 'bundled');
      assert.equal(dashboard.provenance.runtimeVersion, DEFAULT_RUNTIME_VERSION);
      assert.equal(dashboard.provenance.nodeVersion, DEFAULT_NODE_VERSION);
      assert.equal(dashboard.hostRuntimeContract.hostMode, 'desktopCombined');
      assert.equal(dashboard.hostRuntimeContract.runtimeDataDir, 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home');
      assert.equal(dashboard.hostEndpoints.rows[0]?.portBindingLabel, '18801 -> 18819');
      assert.equal(dashboard.rollouts.latestUpdatedAt, 1_743_100_300_000);
    },
  );

  await runTest(
    'kernelCenterService prefers OpenClaw-specific runtime evidence over stale shared provenance fields',
    async () => {
      const { createKernelCenterService } = kernelCenterServiceModule;

      const snapshot = createSnapshot();
      snapshot.raw.provenance.runtimeVersion = 'stale-runtime';
      snapshot.raw.provenance.nodeVersion = 'stale-node';
      snapshot.raw.provenance.platform = 'stale-platform';
      snapshot.raw.provenance.arch = 'stale-arch';
      snapshot.raw.provenance.configPath = 'C:/stale/openclaw.json';
      snapshot.raw.provenance.runtimeHomeDir = 'C:/stale/home';
      snapshot.raw.provenance.runtimeInstallDir = 'C:/stale/install';
      snapshot.runtimeVersion = 'stale-runtime';
      snapshot.nodeVersion = 'stale-node';

      const info = createKernelInfo({
        openClawRuntime: {
          runtimeId: 'openclaw',
          openclawVersion: DEFAULT_RUNTIME_VERSION,
          nodeVersion: DEFAULT_NODE_VERSION,
          platform: 'windows',
          arch: 'x64',
          installDir:
            `C:/Program Files/SdkWork/CrawStudio/runtimes/openclaw/${DEFAULT_RUNTIME_VERSION}-windows-x64`,
          homeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
          configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
          startupChain: [{ id: 'configureOpenClawGateway', status: 'ready', detail: 'configured' }],
        },
      });

      const service = createKernelCenterService({
        kernelPlatformService: {
          getInfo: async () => info,
          getStatus: async () => snapshot,
          ensureRunning: async () => snapshot,
          restart: async () => snapshot,
        },
        hostPlatformService: {
          getStatus: async () => createHostPlatformStatus(),
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
          getRuntimeInfo: async () => createRuntimeInfo(),
        },
      });

      const dashboard = await service.getDashboard();

      assert.equal(dashboard.provenance.runtimeVersion, DEFAULT_RUNTIME_VERSION);
      assert.equal(dashboard.provenance.nodeVersion, DEFAULT_NODE_VERSION);
      assert.equal(dashboard.provenance.platformLabel, 'windows/x64');
      assert.equal(dashboard.provenance.configPath, 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json');
      assert.equal(dashboard.provenance.runtimeHomeDir, 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home');
    },
  );

  await runTest(
    'kernelCenterService does not let legacy OpenClaw runtime diagnostics override non-OpenClaw shared provenance',
    async () => {
      const { createKernelCenterService } = kernelCenterServiceModule;

      const snapshot = createSnapshot({
        runtimeId: 'hermes',
        runtimeVersion: '2026.4.13',
        nodeVersion: null,
      });
      snapshot.raw.provenance.runtimeId = 'hermes';
      snapshot.raw.provenance.runtimeVersion = '2026.4.13';
      snapshot.raw.provenance.nodeVersion = null;
      snapshot.raw.provenance.platform = 'linux';
      snapshot.raw.provenance.arch = 'x64';
      snapshot.raw.provenance.installSource = 'external';
      snapshot.raw.provenance.configPath = '/srv/hermes/config.yaml';
      snapshot.raw.provenance.runtimeHomeDir = '/srv/hermes';
      snapshot.raw.provenance.runtimeInstallDir = '/opt/hermes';

      const info = createKernelInfo({
        openClawRuntime: {
          runtimeId: 'openclaw',
          openclawVersion: DEFAULT_RUNTIME_VERSION,
          nodeVersion: DEFAULT_NODE_VERSION,
          platform: 'windows',
          arch: 'x64',
          installDir:
            `C:/Program Files/SdkWork/CrawStudio/runtimes/openclaw/${DEFAULT_RUNTIME_VERSION}-windows-x64`,
          homeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
          configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
          startupChain: [{ id: 'configureOpenClawGateway', status: 'ready', detail: 'configured' }],
        },
      });

      const service = createKernelCenterService({
        kernelPlatformService: {
          getInfo: async () => info,
          getStatus: async () => snapshot,
          ensureRunning: async () => snapshot,
          restart: async () => snapshot,
        },
        hostPlatformService: {
          getStatus: async () => createHostPlatformStatus(),
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
          getRuntimeInfo: async () => createRuntimeInfo(),
        },
      });

      const dashboard = await service.getDashboard();

      assert.equal(dashboard.provenance.installSource, 'external');
      assert.equal(dashboard.provenance.runtimeVersion, '2026.4.13');
      assert.equal(dashboard.provenance.nodeVersion, null);
      assert.equal(dashboard.provenance.platformLabel, 'linux/x64');
      assert.equal(dashboard.provenance.configPath, '/srv/hermes/config.yaml');
      assert.equal(dashboard.provenance.runtimeHomeDir, '/srv/hermes');
      assert.equal(dashboard.provenance.runtimeInstallDir, '/opt/hermes');
    },
  );

  await runTest(
    'kernelCenterService degrades gracefully for host runtime and endpoint summaries during control actions',
    async () => {
      const { createKernelCenterService } = kernelCenterServiceModule;

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
          getStatus: async () => createHostPlatformStatus({ lifecycle: 'degraded', isReady: false }),
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
      assert.equal(ensured.hostRuntime.browserManagementAvailable, false);
      assert.equal(ensured.hostRuntime.browserManagementLabel, 'Host Runtime Available');
      assert.equal(ensured.hostRuntimeContract.hostMode, null);
      assert.equal(ensured.hostEndpoints.totalEndpoints, 0);
      assert.equal(ensured.hostEndpoints.browserBaseUrl, null);
    },
  );
} else {
  await runTest(
    'kernelCenterService source keeps package-root imports and exposes runtimeVersion as shared provenance output',
    async () => {
      const source = await readKernelCenterServiceSource();

      assert.match(source, /from '@sdkwork\/claw-core'/);
      assert.match(source, /from '@sdkwork\/claw-infrastructure'/);
      assert.match(
        source,
        /provenance:\s*{[\s\S]*installSource:\s*string \| null;[\s\S]*platformLabel:\s*string;[\s\S]*runtimeVersion:\s*string \| null;[\s\S]*nodeVersion:\s*string \| null;/,
      );
      assert.doesNotMatch(source, /provenance:\s*{[\s\S]*openclawVersion:\s*string \| null;/);
      assert.doesNotMatch(source, /installSourceLabel:\s*string;/);
    },
  );

  await runTest(
    'kernelCenterService source only bridges OpenClaw-specific runtime data when the shared snapshot still identifies OpenClaw',
    async () => {
      const source = await readKernelCenterServiceSource();

      assert.match(source, /function resolvePreferredOpenClawRuntime\(/);
      assert.match(source, /if \(snapshot\?\.runtimeId === 'openclaw'\) \{/);
      assert.match(source, /if \(!snapshot && openClawRuntime\?\.runtimeId === 'openclaw'\) \{/);
      assert.match(source, /const openClawRuntime = resolvePreferredOpenClawRuntime\(snapshot, info\);/);
      assert.match(
        source,
        /runtimeVersion:\s*openClawRuntime\?\.openclawVersion \?\? snapshot\?\.runtimeVersion \?\? null/,
      );
      assert.match(
        source,
        /platformLabel:\s*formatPlatformLabel\(\s*openClawRuntime\?\.platform \?\? snapshot\?\.raw\.provenance\.platform,/,
      );
      assert.match(
        source,
        /configPath:\s*openClawRuntime\?\.configPath \?\? snapshot\?\.raw\.provenance\.configPath \?\? null/,
      );
    },
  );

  await runTest(
    'kernelCenterService source preserves host fallback and observability mappings for iterative convergence',
    async () => {
      const source = await readKernelCenterServiceSource();

      assert.match(source, /const EMPTY_HOST_PORT_SETTINGS_SUMMARY/);
      assert.match(source, /function createFallbackHostRuntimeSummary\(/);
      assert.match(source, /routeMetrics:\s*info\?\.localAiProxy\?\.routeMetrics \?\? \[\]/);
      assert.match(source, /routeTests:\s*info\?\.localAiProxy\?\.routeTests \?\? \[\]/);
      assert.match(source, /path:\s*startupEvidence\?\.evidencePath \?\? null/);
      assert.match(source, /errorCause:\s*startupEvidence\?\.errorCause \?\? null/);
    },
  );

  await runTest(
    'kernelCenterService source exposes raw install provenance without embedding install-source copy',
    async () => {
      const source = await readKernelCenterServiceSource();

      assert.match(
        source,
        /installSource:\s*snapshot\?\.raw\.provenance\.installSource \?\? null/,
      );
      assert.doesNotMatch(source, /function formatInstallSource\(/);
      assert.doesNotMatch(source, /case 'bundled':\s*return 'Packaged';/);
      assert.doesNotMatch(source, /case 'bundled':\s*return 'Bundled';/);
    },
  );
}
