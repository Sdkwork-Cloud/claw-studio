import assert from 'node:assert/strict';
import {
  DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
} from '../../../sdkwork-claw-types/src/openclawRelease.ts';

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
          installKey: `${DEFAULT_BUNDLED_OPENCLAW_VERSION}-windows-x64`,
          openclawVersion: DEFAULT_BUNDLED_OPENCLAW_VERSION,
          nodeVersion: DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
          platform: 'windows',
          arch: 'x64',
          installSource: 'bundled',
          configPath: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
          runtimeHomeDir: 'C:/Users/admin/.sdkwork/crawstudio/openclaw-home',
          runtimeInstallDir:
            `C:/Program Files/SdkWork/CrawStudio/runtimes/openclaw/${DEFAULT_BUNDLED_OPENCLAW_VERSION}-windows-x64`,
        },
      }),
      ensureRunning: async () => {
        throw new Error('not needed');
      },
      restart: async () => {
        throw new Error('not needed');
      },
      testLocalAiProxyRoute: async () => null,
      inspectOpenClawMirrorExport: async () => null,
      exportOpenClawMirror: async () => {
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
  assert.equal(snapshot.openclawVersion, DEFAULT_BUNDLED_OPENCLAW_VERSION);
  assert.equal(snapshot.nodeVersion, DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION);
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
      installKey: `${DEFAULT_BUNDLED_OPENCLAW_VERSION}-linux-x64`,
      openclawVersion: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      nodeVersion: DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION,
      platform: 'linux',
      arch: 'x64',
      installSource: 'bundled',
      configPath: '/home/admin/.sdkwork/crawstudio/openclaw-home/.openclaw/openclaw.json',
      runtimeHomeDir: '/home/admin/.sdkwork/crawstudio/openclaw-home',
      runtimeInstallDir:
        `/opt/sdkwork/crawstudio/runtimes/openclaw/${DEFAULT_BUNDLED_OPENCLAW_VERSION}-linux-x64`,
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
      testLocalAiProxyRoute: async () => null,
      inspectOpenClawMirrorExport: async () => null,
      exportOpenClawMirror: async () => {
        throw new Error('not needed');
      },
    }),
  });

  const ensured = await service.ensureRunning();
  const restarted = await service.restart();

  assert.deepEqual(calls, ['ensureRunning', 'restart']);
  assert.equal(ensured.controlMode, 'nativeService');
  assert.equal(restarted.hostManager, 'systemdUser');
});

await runTest('kernelPlatformService exposes local ai proxy request logs, message logs, and message capture updates', async () => {
  const { createKernelPlatformService } = await import('./kernelPlatformService.ts');

  const calls: string[] = [];
  const service = createKernelPlatformService({
    getKernelPlatform: () => ({
      getInfo: async () => null,
      getStorageInfo: async () => null,
      getStatus: async () => null,
      ensureRunning: async () => null,
      restart: async () => null,
      testLocalAiProxyRoute: async () => null,
      listLocalAiProxyRequestLogs: async (query) => {
        calls.push(`requestLogs:${query.page}:${query.pageSize}:${query.search || ''}`);
        return {
          items: [
            {
              id: 'req_1',
              createdAt: 1743510000000,
              routeId: 'provider-config-openai',
              routeName: 'OpenAI',
              providerId: 'openai',
              clientProtocol: 'openai-compatible',
              upstreamProtocol: 'openai-compatible',
              endpoint: '/v1/chat/completions',
              status: 'succeeded',
              modelId: 'gpt-5.4',
              baseUrl: 'https://api.openai.com/v1',
              ttftMs: 220,
              totalDurationMs: 810,
              totalTokens: 1800,
              promptTokens: 910,
              completionTokens: 840,
              inputTokens: 900,
              outputTokens: 850,
              cacheTokens: 50,
              responseStatus: 200,
            },
          ],
          total: 1,
          page: query.page || 1,
          pageSize: query.pageSize || 20,
          hasMore: false,
        };
      },
      listLocalAiProxyMessageLogs: async (query) => {
        calls.push(`messageLogs:${query.page}:${query.pageSize}:${query.search || ''}`);
        return {
          items: [
            {
              id: 'msg_1',
              requestLogId: 'req_1',
              createdAt: 1743510000000,
              routeId: 'provider-config-openai',
              routeName: 'OpenAI',
              providerId: 'openai',
              clientProtocol: 'openai-compatible',
              upstreamProtocol: 'openai-compatible',
              modelId: 'gpt-5.4',
              baseUrl: 'https://api.openai.com/v1',
              messageCount: 2,
              preview: 'Summarize this design.',
              messages: [
                { index: 0, role: 'system', content: 'You are helpful.' },
                { index: 1, role: 'user', content: 'Summarize this design.' },
              ],
            },
          ],
          total: 1,
          page: query.page || 1,
          pageSize: query.pageSize || 20,
          hasMore: false,
        };
      },
      updateLocalAiProxyMessageCapture: async (enabled) => {
        calls.push(`capture:${enabled}`);
        return {
          enabled,
          updatedAt: 1743510001234,
        };
      },
      inspectOpenClawMirrorExport: async () => null,
      exportOpenClawMirror: async () => {
        throw new Error('not needed');
      },
    }),
  });

  const requestLogs = await service.listLocalAiProxyRequestLogs({
    page: 2,
    pageSize: 10,
    search: 'openai',
  });
  const messageLogs = await service.listLocalAiProxyMessageLogs({
    page: 1,
    pageSize: 5,
    search: 'summarize',
  });
  const capture = await service.updateLocalAiProxyMessageCapture(true);

  assert.deepEqual(calls, [
    'requestLogs:2:10:openai',
    'messageLogs:1:5:summarize',
    'capture:true',
  ]);
  assert.equal(requestLogs.items[0]?.id, 'req_1');
  assert.equal(requestLogs.items[0]?.promptTokens, 910);
  assert.equal(requestLogs.items[0]?.completionTokens, 840);
  assert.equal(requestLogs.items[0]?.cacheTokens, 50);
  assert.equal(messageLogs.items[0]?.messages.length, 2);
  assert.deepEqual(capture, {
    enabled: true,
    updatedAt: 1743510001234,
  });
});
