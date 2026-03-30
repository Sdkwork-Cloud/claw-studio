import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('kernelPlatformService maps kernel host status into a UI-friendly platform snapshot', async () => {
  const { createKernelPlatformService } = await import('./kernelPlatformService.ts');

  const service = createKernelPlatformService({
    getKernelPlatform: () => ({
      getInfo: async () => null,
      getStorageInfo: async () => null,
      getStatus: async () => ({
        topology: {
          kind: 'localManagedNative',
          state: 'installed',
          label: 'Built-In Native Runtime',
          recommended: true,
        },
        runtime: {
          state: 'running',
          health: 'healthy',
          reason: 'Kernel attached to a healthy local OpenClaw gateway.',
          startedBy: 'appSupervisor',
          lastTransitionAt: 1743000000000,
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
          serviceConfigPath:
            'C:/ProgramData/SdkWork/CrawStudio/machine/state/kernel-host/windows-service.json',
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
          installKey: '2026.3.24-windows-x64',
          openclawVersion: '2026.3.24',
          nodeVersion: '22.14.0',
          platform: 'windows',
          arch: 'x64',
          installSource: 'bundled',
          configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
          runtimeHomeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
          runtimeInstallDir:
            'C:/ProgramData/SdkWork/CrawStudio/machine/runtime/runtimes/openclaw/2026.3.24-windows-x64',
        },
      }),
      ensureRunning: async () => {
        throw new Error('not needed');
      },
      restart: async () => {
        throw new Error('not needed');
      },
    }),
  });

  const snapshot = await service.getStatus();

  assert.equal(snapshot.topologyKind, 'localManagedNative');
  assert.equal(snapshot.runtimeState, 'running');
  assert.equal(snapshot.hostManager, 'windowsService');
  assert.equal(snapshot.controlMode, 'supervisedFallback');
  assert.equal(snapshot.baseUrl, 'http://127.0.0.1:18845');
  assert.equal(snapshot.usesDynamicPort, true);
  assert.equal(snapshot.openclawVersion, '2026.3.24');
  assert.equal(snapshot.nodeVersion, '22.14.0');
  assert.equal(snapshot.serviceConfigPath.endsWith('windows-service.json'), true);
});

await runTest('kernelPlatformService delegates ensureRunning and restart to the shared kernel bridge', async () => {
  const { createKernelPlatformService } = await import('./kernelPlatformService.ts');

  const calls: string[] = [];
  const response = {
    topology: {
      kind: 'localManagedNative',
      state: 'installed',
      label: 'Built-In Native Runtime',
      recommended: true,
    },
    runtime: {
      state: 'running',
      health: 'healthy',
      reason: 'Kernel is ready.',
      startedBy: 'nativeService',
      lastTransitionAt: 1743000001000,
    },
    endpoint: {
      preferredPort: 18789,
      activePort: 18789,
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
      loopbackOnly: true,
      dynamicPort: false,
      endpointSource: 'configured',
    },
    host: {
      serviceManager: 'systemdUser',
      ownership: 'nativeService',
      serviceName: 'claw-studio-openclaw',
      serviceConfigPath: '/home/admin/.config/systemd/user/claw-studio-openclaw.service',
      startupMode: 'auto',
      attachSupported: true,
      repairSupported: true,
      controlSocket: {
        socketKind: 'unixDomainSocket',
        location: '/home/admin/.sdkwork/crawstudio/run/kernel-host.sock',
        available: true,
      },
    },
    provenance: {
      runtimeId: 'openclaw',
      installKey: '2026.3.24-linux-x64',
      openclawVersion: '2026.3.24',
      nodeVersion: '22.14.0',
      platform: 'linux',
      arch: 'x64',
      installSource: 'bundled',
      configPath: '/home/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
      runtimeHomeDir: '/home/admin/.sdkwork/crawstudio/openclaw-home',
      runtimeInstallDir: '/var/lib/claw-studio/openclaw/2026.3.24-linux-x64',
    },
  } as const;

  const service = createKernelPlatformService({
    getKernelPlatform: () => ({
      getInfo: async () => null,
      getStorageInfo: async () => null,
      getStatus: async () => response,
      ensureRunning: async () => {
        calls.push('ensureRunning');
        return response;
      },
      restart: async () => {
        calls.push('restart');
        return response;
      },
    }),
  });

  const ensured = await service.ensureRunning();
  const restarted = await service.restart();

  assert.deepEqual(calls, ['ensureRunning', 'restart']);
  assert.equal(ensured.controlMode, 'nativeService');
  assert.equal(restarted.hostManager, 'systemdUser');
});
