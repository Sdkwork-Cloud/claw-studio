import assert from 'node:assert/strict';
import { instanceService } from './instanceService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('instanceService follows the v3 instances API contract', async () => {
  const originalFetch = globalThis.fetch;

  const instances = [
    {
      id: 'local-mac',
      name: 'MacBook Pro (Local)',
      type: 'macOS Native',
      iconType: 'apple',
      status: 'online',
      version: 'v0.2.1',
      uptime: '5d 12h',
      ip: '127.0.0.1',
      cpu: 12,
      memory: 35,
      totalMemory: '32 GB',
    },
    {
      id: 'aws-node',
      name: 'AWS EC2 Node',
      type: 'Ubuntu Linux',
      iconType: 'server',
      status: 'offline',
      version: 'v0.2.0',
      uptime: '-',
      ip: '3.14.15.92',
      cpu: 0,
      memory: 0,
      totalMemory: '64 GB',
    },
  ];

  const configs = new Map([
    [
      'local-mac',
      {
        port: '18789',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
    ],
  ]);

  const tokens = new Map([['local-mac', 'oc_token_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c']]);
  const requests: Array<{ url: string; method: string }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    requests.push({ url, method });

    if (url === '/api/instances') {
      return new Response(JSON.stringify(instances), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const configMatch = url.match(/^\/api\/instances\/([^/]+)\/config$/);
    if (configMatch) {
      const config = configs.get(configMatch[1]);
      return config
        ? new Response(JSON.stringify(config), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        : new Response('not found', { status: 404 });
    }

    const tokenMatch = url.match(/^\/api\/instances\/([^/]+)\/token$/);
    if (tokenMatch) {
      const token = tokens.get(tokenMatch[1]);
      return token
        ? new Response(JSON.stringify({ token }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        : new Response('not found', { status: 404 });
    }

    const instanceMatch = url.match(/^\/api\/instances\/([^/]+)$/);
    if (instanceMatch) {
      const index = instances.findIndex((instance) => instance.id === instanceMatch[1]);
      if (index === -1) {
        return new Response('not found', { status: 404 });
      }

      if (method === 'DELETE') {
        instances.splice(index, 1);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(instances[index]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const actionMatch = url.match(/^\/api\/instances\/([^/]+)\/(start|stop|restart)$/);
    if (actionMatch) {
      const target = instances.find((instance) => instance.id === actionMatch[1]);
      if (!target) {
        return new Response('not found', { status: 404 });
      }

      target.status = actionMatch[2] === 'stop' ? 'offline' : 'online';
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  try {
    const page = await instanceService.getList({ keyword: 'aws', page: 1, pageSize: 10 });
    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.id, 'aws-node');

    const config = await instanceService.getInstanceConfig('local-mac');
    const token = await instanceService.getInstanceToken('local-mac');
    const logs = await instanceService.getInstanceLogs('local-mac');
    assert.equal(config?.port, '18789');
    assert.match(token ?? '', /^oc_token_/);
    assert.match(logs, /Starting OpenClaw Daemon/);

    await instanceService.stopInstance('local-mac');
    assert.equal((await instanceService.getInstanceById('local-mac'))?.status, 'offline');

    await instanceService.startInstance('aws-node');
    assert.equal((await instanceService.getInstanceById('aws-node'))?.status, 'online');

    await instanceService.restartInstance('local-mac');
    assert.equal((await instanceService.getInstanceById('local-mac'))?.status, 'online');

    await instanceService.deleteInstance('aws-node');
    assert.equal(await instanceService.getInstanceById('aws-node'), undefined);

    assert.equal(
      requests.some((request) => request.url === '/api/instances/local-mac/stop' && request.method === 'POST'),
      true,
    );
    assert.equal(
      requests.some((request) => request.url === '/api/instances/aws-node' && request.method === 'DELETE'),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await runTest('instanceService falls back to the built-in instance when the v3 API is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;

  globalThis.fetch = async () => {
    throw new Error('network unavailable');
  };
  console.warn = () => {};

  try {
    const instances = await instanceService.getInstances();

    assert.equal(instances.length, 1);
    assert.equal(instances[0]?.id, 'builtin-instance');
    assert.equal(instances[0]?.status, 'online');
  } finally {
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
  }
});
