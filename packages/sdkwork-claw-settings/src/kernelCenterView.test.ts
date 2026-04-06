import assert from 'node:assert/strict';
import type { KernelCenterDashboard } from './services/kernelCenterService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createDashboard(
  endpointOverrides: Partial<KernelCenterDashboard['endpoint']> = {},
): KernelCenterDashboard {
  return {
    snapshot: null,
    info: null,
    statusTone: 'warning',
    statusTitle: 'Unavailable',
    statusSummary: 'Unavailable',
    host: {
      serviceManagerLabel: 'Unknown Host',
      ownershipLabel: 'Unknown Ownership',
      startupModeLabel: 'Manual Start',
      controlSocketLabel: null,
      controlSocketAvailable: false,
      serviceConfigPath: null,
    },
    endpoint: {
      preferredPort: 18789,
      activePort: 18845,
      baseUrl: 'http://127.0.0.1:18845',
      websocketUrl: 'ws://127.0.0.1:18845',
      usesDynamicPort: true,
      ...endpointOverrides,
    },
    localAiProxy: {
      lifecycle: 'Stopped',
      baseUrl: null,
      activePort: null,
      loopbackOnly: true,
      defaultRouteName: null,
      upstreamBaseUrl: null,
      modelCount: 0,
      configPath: null,
      snapshotPath: null,
      logPath: null,
      lastError: null,
    },
    storage: {
      activeProfileId: null,
      activeProfileLabel: null,
      activeProfilePath: null,
      rootDir: null,
      profileCount: 0,
    },
    capabilities: {
      readyKeys: [],
      plannedKeys: [],
    },
    provenance: {
      installSourceLabel: 'Unknown',
      platformLabel: 'unknown/unknown',
      openclawVersion: null,
      nodeVersion: null,
      configPath: null,
      runtimeHomeDir: null,
      runtimeInstallDir: null,
    },
  };
}

await runTest('resolveEndpointPortValue returns null when dashboard is missing', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveEndpointPortValue, 'function');
  assert.equal(module.resolveEndpointPortValue?.(null, 'preferredPort'), null);
  assert.equal(module.resolveEndpointPortValue?.(null, 'activePort'), null);
});

await runTest('resolveEndpointPortValue returns null when the endpoint port is missing', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveEndpointPortValue, 'function');
  const dashboard = createDashboard({ preferredPort: null, activePort: null });

  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'preferredPort'), null);
  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'activePort'), null);
});

await runTest('resolveEndpointPortValue stringifies numeric endpoint ports', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveEndpointPortValue, 'function');
  const dashboard = createDashboard({ preferredPort: 18789, activePort: 18845 });

  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'preferredPort'), '18789');
  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'activePort'), '18845');
});

await runTest('resolveLocalAiProxyPortValue returns null when dashboard is missing or the proxy port is absent', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveLocalAiProxyPortValue, 'function');
  assert.equal(module.resolveLocalAiProxyPortValue?.(null), null);

  const dashboard = createDashboard();
  dashboard.localAiProxy.activePort = null;

  assert.equal(module.resolveLocalAiProxyPortValue?.(dashboard), null);
});

await runTest('resolveLocalAiProxyPortValue stringifies the active local proxy port', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveLocalAiProxyPortValue, 'function');
  const dashboard = createDashboard();
  dashboard.localAiProxy.activePort = 18791;

  assert.equal(module.resolveLocalAiProxyPortValue?.(dashboard), '18791');
});
