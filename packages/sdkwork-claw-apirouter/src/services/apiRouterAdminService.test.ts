import assert from 'node:assert/strict';
import {
  clearApiRouterAdminSession,
  configurePlatformBridge,
  readApiRouterAdminSession,
  writeApiRouterAdminSession,
  type RuntimeApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createRuntimeStatus(
  overrides: Partial<RuntimeApiRouterRuntimeStatus> = {},
): RuntimeApiRouterRuntimeStatus {
  return {
    mode: 'attachedExternal',
    recommendedManagedMode: null,
    sharedRootDir: 'C:/Users/admin/.sdkwork/router',
    configDir: 'C:/Users/admin/.sdkwork/router',
    configSource: 'file',
    resolvedConfigFile: 'C:/Users/admin/.sdkwork/router/config.yml',
    admin: {
      bindAddr: '127.0.0.1:8081',
      healthUrl: 'http://127.0.0.1:8081/admin/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api/admin',
      healthy: true,
      portAvailable: false,
    },
    portal: {
      bindAddr: '127.0.0.1:8082',
      healthUrl: 'http://127.0.0.1:8082/portal/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api/portal',
      healthy: true,
      portAvailable: false,
    },
    gateway: {
      bindAddr: '127.0.0.1:8080',
      healthUrl: 'http://127.0.0.1:8080/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api',
      healthy: true,
      portAvailable: false,
    },
    adminSiteBaseUrl: 'http://127.0.0.1:13003/admin',
    portalSiteBaseUrl: 'http://127.0.0.1:13003/portal',
    reason: 'Detected a healthy independently started sdkwork-api-router runtime.',
    ...overrides,
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

function configureRouterRuntime() {
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-api-router-admin-service',
      getJob: async () => ({
        id: 'job-api-router-admin-service',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-api-router-admin-service',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });
}

await runTest('apiRouterAdminService reports an authenticated router admin session when /auth/me succeeds', async () => {
  configureRouterRuntime();
  writeApiRouterAdminSession({
    token: 'router-admin-token',
    user: {
      id: 'admin_local_default',
      email: 'admin@sdkwork.local',
      displayName: 'Admin Operator',
      active: true,
      createdAtMs: 1_700_000_000_000,
    },
  });

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: 'admin_local_default',
        email: 'admin@sdkwork.local',
        display_name: 'Admin Operator',
        active: true,
        created_at_ms: 1_700_000_000_000,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    )) as typeof fetch;

  const { apiRouterAdminService } = await import('./apiRouterAdminService.ts');

  const status = await apiRouterAdminService.getStatus();

  assert.equal(status.state, 'authenticated');
  assert.equal(status.authenticated, true);
  assert.equal(status.authSource, 'session');
  assert.equal(status.operator?.email, 'admin@sdkwork.local');
  assert.equal(status.adminBaseUrl, 'http://127.0.0.1:13003/api/admin');
  assert.equal(status.gatewayBaseUrl, 'http://127.0.0.1:13003/api');
});

await runTest('apiRouterAdminService silently authenticates when Claw manages a local router session', async () => {
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () =>
        createRuntimeStatus({
          mode: 'managedActive',
          reason: 'Claw Studio is managing the sdkwork-api-router runtime for this session.',
        }),
      getApiRouterAdminBootstrapSession: async () => ({
        token: 'managed-bootstrap-token',
        source: 'managedLocalJwt',
        user: {
          id: 'admin_local_default',
          email: 'admin@sdkwork.local',
          displayName: 'Admin Operator',
          active: true,
          createdAtMs: 1_700_000_000_000,
        },
      }),
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-api-router-admin-bootstrap-status',
      getJob: async () => ({
        id: 'job-api-router-admin-bootstrap-status',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-api-router-admin-bootstrap-status',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });
  clearApiRouterAdminSession();

  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response('Unauthorized', { status: 401 });
  }) as typeof fetch;

  const { apiRouterAdminService } = await import('./apiRouterAdminService.ts');

  const status = await apiRouterAdminService.getStatus();

  assert.equal(status.state, 'authenticated');
  assert.equal(status.authenticated, true);
  assert.equal(status.authSource, 'managedBootstrap');
  assert.equal(status.sessionUser?.email, 'admin@sdkwork.local');
  assert.equal(status.operator?.email, 'admin@sdkwork.local');
  assert.equal(fetchCount, 0);
});

await runTest('apiRouterAdminService drops a stored managed bootstrap session when the runtime is no longer host-managed', async () => {
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      getApiRouterAdminBootstrapSession: async () => null,
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-api-router-admin-bootstrap-stale',
      getJob: async () => ({
        id: 'job-api-router-admin-bootstrap-stale',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-api-router-admin-bootstrap-stale',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });
  writeApiRouterAdminSession({
    token: 'managed-bootstrap-token',
    source: 'managedBootstrap',
    user: {
      id: 'admin_local_default',
      email: 'admin@sdkwork.local',
      displayName: 'Admin Operator',
      active: true,
      createdAtMs: 1_700_000_000_000,
    },
  });

  globalThis.fetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;

  const { apiRouterAdminService } = await import('./apiRouterAdminService.ts');

  const status = await apiRouterAdminService.getStatus();

  assert.equal(status.state, 'needsLogin');
  assert.equal(status.authenticated, false);
  assert.equal(status.authSource, 'none');
  assert.equal(readApiRouterAdminSession(), null);
});

await runTest('apiRouterAdminService asks for login when no router admin credentials are configured', async () => {
  configureRouterRuntime();
  clearApiRouterAdminSession();
  globalThis.fetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;

  const { apiRouterAdminService } = await import('./apiRouterAdminService.ts');

  const status = await apiRouterAdminService.getStatus();

  assert.equal(status.state, 'needsLogin');
  assert.equal(status.authenticated, false);
  assert.equal(status.authSource, 'none');
});

await runTest('apiRouterAdminService clears a stale local session when the router rejects it', async () => {
  configureRouterRuntime();
  writeApiRouterAdminSession({
    token: 'expired-router-admin-token',
    user: {
      id: 'admin_local_default',
      email: 'admin@sdkwork.local',
      displayName: 'Admin Operator',
      active: true,
      createdAtMs: 1_700_000_000_000,
    },
  });

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: {
          message: 'Unauthorized',
        },
      }),
      {
        status: 401,
        headers: {
          'content-type': 'application/json',
        },
      },
    )) as typeof fetch;

  const { apiRouterAdminService } = await import('./apiRouterAdminService.ts');

  const status = await apiRouterAdminService.getStatus();

  assert.equal(status.state, 'needsLogin');
  assert.equal(readApiRouterAdminSession(), null);
});
