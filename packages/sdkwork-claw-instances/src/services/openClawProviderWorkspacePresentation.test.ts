import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { buildOpenClawProviderWorkspaceState } from './openClawProviderWorkspacePresentation.ts';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createDetail(overrides: Partial<StudioInstanceDetailRecord> = {}): StudioInstanceDetailRecord {
  const {
    instance: instanceOverrides,
    config: configOverrides,
    lifecycle: lifecycleOverrides,
    ...detailOverrides
  } = overrides;

  return {
    instance: {
      id: 'openclaw-instance',
      name: 'OpenClaw Instance',
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '2026.4.5',
      typeLabel: 'OpenClaw Gateway',
      host: '10.0.0.8',
      port: 18789,
      baseUrl: 'https://gateway.example.com',
      websocketUrl: 'wss://gateway.example.com/ws',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: [],
      storage: {
        provider: 'localFile',
        namespace: 'openclaw-instance',
      },
      config: {
        port: '18789',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'https://gateway.example.com',
        websocketUrl: 'wss://gateway.example.com/ws',
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
      ...(instanceOverrides || {}),
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'https://gateway.example.com',
      websocketUrl: 'wss://gateway.example.com/ws',
      ...(configOverrides || {}),
    },
    logs: '',
    health: {
      score: 90,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: false,
      configWritable: false,
      notes: [],
      ...(lifecycleOverrides || {}),
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'openclaw-instance',
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
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    workbench: null,
    ...detailOverrides,
  };
}

await runTest(
  'buildOpenClawProviderWorkspaceState treats managed directory routes as Provider Center managed even without a managed config file path',
  () => {
    const state = buildOpenClawProviderWorkspaceState(
      createDetail({
        instance: {
          deploymentMode: 'local-external',
        },
        lifecycle: {
          owner: 'externalProcess',
          configWritable: true,
          workbenchManaged: false,
          lifecycleControllable: false,
          endpointObserved: false,
          notes: [],
        },
        dataAccess: {
          routes: [
            {
              id: 'config-directory',
              label: 'OpenClaw workspace',
              scope: 'config',
              mode: 'managedDirectory',
              status: 'ready',
              target: 'D:/OpenClaw/.openclaw',
              readonly: false,
              authoritative: true,
              detail: 'Writable managed directory.',
              source: 'integration',
            },
          ],
        },
      }),
    );

    assert.equal(state.providerCenterManaged, true);
    assert.equal(state.isProviderConfigReadonly, true);
    assert.equal(state.canManageProviderCatalog, false);
  },
);

await runTest(
  'buildOpenClawProviderWorkspaceState keeps remote openclaw provider config editable when no Provider Center managed route exists',
  () => {
    const state = buildOpenClawProviderWorkspaceState(createDetail());

    assert.equal(state.providerCenterManaged, false);
    assert.equal(state.isProviderConfigReadonly, false);
    assert.equal(state.canManageProviderCatalog, false);
  },
);

await runTest(
  'buildOpenClawProviderWorkspaceState keeps non-openclaw runtimes writable through the standard provider workspace flow',
  () => {
    const state = buildOpenClawProviderWorkspaceState(
      createDetail({
        instance: {
          runtimeKind: 'custom',
          transportKind: 'customHttp',
        },
      }),
    );

    assert.equal(state.providerCenterManaged, false);
    assert.equal(state.isProviderConfigReadonly, false);
    assert.equal(state.canManageProviderCatalog, true);
  },
);
