import assert from 'node:assert/strict';
import type { ApiRouterRuntimeStatus } from '@sdkwork/claw-infrastructure';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function buildRuntimeStatus(
  overrides: Partial<ApiRouterRuntimeStatus> = {},
): ApiRouterRuntimeStatus {
  return {
    ownership: 'managed',
    routerHomeDir: 'C:/Users/test/.sdkwork/router',
    metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
    databasePath: 'C:/Users/test/.sdkwork/router/router.db',
    extractionDir: 'C:/Users/test/AppData/Local/claw-studio/router/runtime',
    adminBaseUrl: 'http://127.0.0.1:18081/admin',
    gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
    adminHealthy: true,
    gatewayHealthy: true,
    authSessionReady: true,
    adminAuthReady: true,
    adminPid: 20880,
    gatewayPid: 20881,
    ...overrides,
  };
}

await runTest(
  'apiRouterRuntimeViewService builds a runtime view model with local bindings and process ownership',
  async () => {
    let module: typeof import('./apiRouterRuntimeViewService.ts');

    try {
      module = await import('./apiRouterRuntimeViewService.ts');
    } catch (error) {
      assert.fail(`apiRouterRuntimeViewService module is missing: ${String(error)}`);
    }

    const view = module.buildApiRouterRuntimeView(buildRuntimeStatus());
    const gatewayEndpoint = view.endpoints.find((item) => item.id === 'gateway');
    const adminEndpoint = view.endpoints.find((item) => item.id === 'admin');

    assert.equal(view.ownership.mode, 'managed');
    assert.equal(view.ownership.tone, 'success');
    assert.equal(gatewayEndpoint?.url, 'http://127.0.0.1:18080/v1');
    assert.equal(gatewayEndpoint?.binding, '127.0.0.1:18080');
    assert.equal(gatewayEndpoint?.host, '127.0.0.1');
    assert.equal(gatewayEndpoint?.port, '18080');
    assert.equal(gatewayEndpoint?.pathname, '/v1');
    assert.equal(adminEndpoint?.binding, '127.0.0.1:18081');
    assert.equal(adminEndpoint?.pathname, '/admin');
    assert.deepEqual(
      view.signals.map((item) => item.tone),
      ['success', 'success', 'success', 'success'],
    );
    assert.equal(
      view.processes.find((item) => item.id === 'gatewayPid')?.value,
      '20881',
    );
    assert.equal(
      view.paths.find((item) => item.id === 'metadataDir')?.value,
      'C:/Users/test/.sdkwork/router/claw-studio',
    );
  },
);

await runTest(
  'apiRouterRuntimeViewService keeps degraded signals visible when the shared router is attached but not ready',
  async () => {
    const { buildApiRouterRuntimeView } = await import('./apiRouterRuntimeViewService.ts');
    const view = buildApiRouterRuntimeView(
      buildRuntimeStatus({
        ownership: 'attached',
        adminBaseUrl: '',
        gatewayBaseUrl: 'not-a-valid-url',
        adminHealthy: false,
        gatewayHealthy: false,
        authSessionReady: false,
        adminAuthReady: false,
        adminPid: null,
        gatewayPid: null,
      }),
    );

    const gatewayEndpoint = view.endpoints.find((item) => item.id === 'gateway');
    const adminEndpoint = view.endpoints.find((item) => item.id === 'admin');

    assert.equal(view.ownership.mode, 'attached');
    assert.equal(view.ownership.tone, 'warning');
    assert.equal(gatewayEndpoint?.url, 'not-a-valid-url');
    assert.equal(gatewayEndpoint?.binding, '');
    assert.equal(gatewayEndpoint?.pathname, '');
    assert.equal(adminEndpoint?.url, '');
    assert.equal(
      view.signals.every((item) => item.tone === 'warning'),
      true,
    );
    assert.equal(view.processes.find((item) => item.id === 'adminPid')?.value, null);
  },
);
