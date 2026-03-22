import assert from 'node:assert/strict';
import { resolveInstanceChatRoute } from './instanceChatRouteService.ts';

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

await runTest('openclaw gateway instances prefer the native websocket route even when http metadata exists', () => {
  const route = resolveInstanceChatRoute({
    id: 'openclaw-local',
    name: 'OpenClaw Local',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: 'bundled',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18789,
    baseUrl: 'http://127.0.0.1:18789',
    websocketUrl: 'ws://127.0.0.1:18789',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  assert.equal(route.mode, 'instanceOpenClawGatewayWs');
  assert.equal(route.websocketUrl, 'ws://127.0.0.1:18789');
  assert.equal(route.endpoint, 'http://127.0.0.1:18789/v1/chat/completions');
});

await runTest(
  'openclaw runtime instances still resolve to the gateway websocket route when legacy metadata labels them as customHttp',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-legacy-http',
      name: 'OpenClaw Legacy HTTP',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'customHttp',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Legacy',
      host: '127.0.0.1',
      port: 18795,
      baseUrl: 'http://127.0.0.1:18795',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18795',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18795',
        websocketUrl: null,
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18795');
    assert.equal(route.endpoint, 'http://127.0.0.1:18795/v1/chat/completions');
  },
);

await runTest(
  'openclaw runtime instances normalize legacy /ws websocket metadata and keep the gateway route even when transportKind is openaiHttp',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-legacy-openai',
      name: 'OpenClaw Legacy OpenAI',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openaiHttp',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Legacy',
      host: '127.0.0.1',
      port: 18796,
      baseUrl: 'http://127.0.0.1:18796/v1/chat/completions',
      websocketUrl: 'ws://127.0.0.1:18796/ws',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18796',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18796/v1/chat/completions',
        websocketUrl: 'ws://127.0.0.1:18796/ws',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18796');
    assert.equal(route.endpoint, 'http://127.0.0.1:18796/v1/chat/completions');
  },
);

await runTest(
  'openclaw runtime instances prefer the baseUrl-derived websocket when legacy websocket metadata points at a stale port',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-stale-websocket',
      name: 'OpenClaw Stale WebSocket',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Legacy',
      host: '127.0.0.1',
      port: 18795,
      baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
      websocketUrl: 'ws://127.0.0.1:18789',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18795',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
        websocketUrl: 'ws://127.0.0.1:18789',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18795');
    assert.equal(route.endpoint, 'http://127.0.0.1:18795/v1/chat/completions');
  },
);

await runTest(
  'openclaw runtime instances still resolve the gateway route when migrated records omit the nested config object',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-missing-config',
      name: 'OpenClaw Missing Config',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Migrated',
      host: '127.0.0.1',
      port: 18801,
      baseUrl: 'http://127.0.0.1:18801/v1/chat/completions',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      createdAt: 1,
      updatedAt: 1,
    } as any);

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18801');
    assert.equal(route.endpoint, 'http://127.0.0.1:18801/v1/chat/completions');
  },
);
