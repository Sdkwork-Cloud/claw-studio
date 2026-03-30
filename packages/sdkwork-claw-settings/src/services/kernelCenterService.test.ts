import assert from 'node:assert/strict';
import type { RuntimeDesktopKernelInfo } from '@sdkwork/claw-infrastructure';
import type { KernelPlatformSnapshot } from '@sdkwork/claw-core';

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
      installKey: '2026.3.28-windows-x64',
      openclawVersion: '2026.3.28',
      nodeVersion: '22.14.0',
      platform: 'windows',
      arch: 'x64',
      installSource: 'bundled',
      configPath: 'C:/Users/admin/.sdkwork/claw-studio/openclaw-home/.openclaw/openclaw.json',
      runtimeHomeDir: 'C:/Users/admin/.sdkwork/claw-studio/openclaw-home',
      runtimeInstallDir: 'C:/ProgramData/SdkWork/ClawStudio/runtime/openclaw/2026.3.28-windows-x64',
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
      userRoot: 'C:/Users/admin/.sdkwork/claw-studio',
      studioDir: 'C:/Users/admin/.sdkwork/claw-studio/studio',
      storageDir: 'C:/Users/admin/.sdkwork/claw-studio/storage',
      pluginsDir: 'C:/Users/admin/.sdkwork/claw-studio/plugins',
      integrationsDir: 'C:/Users/admin/.sdkwork/claw-studio/integrations',
      backupsDir: 'C:/Users/admin/.sdkwork/claw-studio/backups',
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
      managedRoots: ['C:/Users/admin/.sdkwork/claw-studio'],
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
      pluginsDir: 'C:/Users/admin/.sdkwork/claw-studio/plugins',
      integrationsDir: 'C:/Users/admin/.sdkwork/claw-studio/integrations',
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
          bundledVersion: '2026.3.28',
          startupMode: 'embedded',
          installSubdir: 'runtime/openclaw',
        },
      ],
    },
    storage: {
      activeProfileId: 'default-sqlite',
      rootDir: 'C:/Users/admin/.sdkwork/claw-studio/storage',
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
          path: 'C:/Users/admin/.sdkwork/claw-studio/storage/default.db',
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

await runTest('kernelCenterService composes kernel status, host ownership, and storage into a dashboard model', async () => {
  const { createKernelCenterService } = await import('./kernelCenterService.ts');

  const service = createKernelCenterService({
    kernelPlatformService: {
      getInfo: async () => createKernelInfo(),
      getStatus: async () => createSnapshot(),
      ensureRunning: async () => createSnapshot(),
      restart: async () => createSnapshot(),
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
  assert.equal(dashboard.storage.activeProfileLabel, 'SQLite Profile');
  assert.equal(dashboard.storage.activeProfilePath?.endsWith('default.db'), true);
  assert.deepEqual(dashboard.capabilities.readyKeys, ['doctor']);
  assert.deepEqual(dashboard.capabilities.plannedKeys, ['upgrades']);
  assert.equal(dashboard.provenance.installSourceLabel, 'Bundled');
});

await runTest('kernelCenterService forwards ensureRunning and restart actions through the kernel platform service', async () => {
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
  });

  const ensured = await service.ensureRunning();
  const restarted = await service.restart();

  assert.deepEqual(calls, ['ensureRunning', 'restart']);
  assert.equal(ensured.snapshot?.controlMode, 'nativeService');
  assert.equal(restarted.snapshot?.runtimeState, 'recovering');
});
