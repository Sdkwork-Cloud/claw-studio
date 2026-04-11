import assert from 'node:assert/strict';

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

let registryWorkbenchSupportModule:
  | typeof import('./instanceRegistryWorkbenchSupport.ts')
  | undefined;

try {
  registryWorkbenchSupportModule = await import('./instanceRegistryWorkbenchSupport.ts');
} catch {
  registryWorkbenchSupportModule = undefined;
}

await runTest(
  'instanceRegistryWorkbenchSupport exposes shared registry-backed detail projection helpers',
  () => {
    assert.ok(
      registryWorkbenchSupportModule,
      'Expected instanceRegistryWorkbenchSupport.ts to exist',
    );
    assert.equal(
      typeof registryWorkbenchSupportModule?.buildRegistryBackedDetail,
      'function',
    );
  },
);

await runTest(
  'buildRegistryBackedDetail infers built-in OpenClaw runtime defaults and loopback connectivity from registry metadata',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'built-in-openclaw',
        name: 'Built-in OpenClaw',
        type: 'Built-in OpenClaw Runtime',
        iconType: 'box',
        status: 'online',
        version: '2026.4.2',
        uptime: '3h',
        ip: '127.0.0.1',
        cpu: 6,
        memory: 12,
        totalMemory: '32GB',
        isBuiltIn: true,
        baseUrl: 'http://127.0.0.1:17890',
        websocketUrl: 'ws://127.0.0.1:17890',
      } as any,
      {
        port: '17890',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      undefined,
      '',
    );

    assert.equal(detail?.instance.runtimeKind, 'openclaw');
    assert.equal(detail?.instance.deploymentMode, 'local-managed');
    assert.equal(detail?.instance.transportKind, 'openclawGatewayWs');
    assert.equal(detail?.lifecycle.owner, 'appManaged');
    assert.equal(detail?.storage.provider, 'localFile');
    assert.equal(detail?.storage.status, 'ready');
    assert.equal(detail?.storage.remote, false);
    assert.equal(detail?.connectivity.endpoints[0]?.exposure, 'loopback');
    assert.equal(detail?.connectivity.endpoints[0]?.auth, 'unknown');
    assert.deepEqual(detail?.instance.capabilities, [
      'chat',
      'health',
      'files',
      'memory',
      'tasks',
      'tools',
      'models',
    ]);
  },
);

await runTest(
  'buildRegistryBackedDetail preserves explicit remote OpenClaw transport and remote storage truth',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'remote-openclaw',
        name: 'Remote OpenClaw',
        type: 'Remote OpenClaw',
        iconType: 'server',
        status: 'online',
        version: '2026.4.2',
        uptime: '10h',
        ip: 'gateway.example.com',
        cpu: 10,
        memory: 22,
        totalMemory: '64GB',
        isBuiltIn: false,
        runtimeKind: 'openclaw',
        deploymentMode: 'remote',
        transportKind: 'openclawGatewayWs',
        baseUrl: 'https://gateway.example.com/claw/api',
        websocketUrl: 'wss://gateway.example.com/claw/ws',
        storage: {
          provider: 'remoteApi',
          namespace: 'gateway.example.com',
          endpoint: 'https://gateway.example.com/claw/api',
        },
      } as any,
      {
        port: '443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      'remote-token',
      'remote fallback log',
    );

    assert.equal(detail?.instance.runtimeKind, 'openclaw');
    assert.equal(detail?.instance.deploymentMode, 'remote');
    assert.equal(detail?.instance.transportKind, 'openclawGatewayWs');
    assert.equal(detail?.lifecycle.owner, 'remoteService');
    assert.equal(detail?.storage.provider, 'remoteApi');
    assert.equal(detail?.storage.status, 'planned');
    assert.equal(detail?.storage.remote, true);
    assert.equal(detail?.connectivity.endpoints[0]?.exposure, 'remote');
    assert.equal(detail?.connectivity.endpoints[0]?.auth, 'token');
    assert.equal(detail?.observability.logAvailable, true);
    assert.deepEqual(detail?.observability.logPreview, ['remote fallback log']);
  },
);
