import assert from 'node:assert/strict';
import {
  configurePlatformBridge,
  type RuntimeApiRouterRuntimeStatus,
} from '../platform/index.ts';
import {
  clearApiRouterAdminSession,
  readApiRouterAdminSession,
} from '../auth/apiRouterAdminSession.ts';

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
      publicBaseUrl: 'http://127.0.0.1:13003/api',
      healthy: true,
      portAvailable: false,
    },
    adminSiteBaseUrl: 'http://127.0.0.1:13003/admin',
    portalSiteBaseUrl: 'http://127.0.0.1:13003/portal',
    reason: 'Detected a healthy independently started sdkwork-api-router runtime.',
    ...overrides,
  } as RuntimeApiRouterRuntimeStatus;
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

await runTest('sdkworkApiRouterAdminClient resolves the admin base URL from runtime status and sends the router admin bearer token', async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const runtimeStatus = createRuntimeStatus();
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => runtimeStatus,
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-1',
      getJob: async () => ({
        id: 'job-1',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-1',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(input),
      authorization: headers.get('authorization'),
    });

    return new Response(
      JSON.stringify([
        {
          project_id: 'project-1',
          model: 'gpt-5.4',
          provider: 'provider-openai-official',
          units: 1,
          amount: 0.42,
          input_tokens: 120,
          output_tokens: 80,
          total_tokens: 200,
          created_at_ms: 1_710_000_000_000,
        },
      ]),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  }) as typeof fetch;

  const { writeApiRouterAdminSession } = await import('../auth/apiRouterAdminSession.ts');
  const { sdkworkApiRouterAdminClient } = await import('./sdkworkApiRouterAdminClient.ts');

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

  const result = await sdkworkApiRouterAdminClient.listUsageRecords();

  assert.equal(result.length, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, 'http://127.0.0.1:13003/api/admin/usage/records');
  assert.equal(requests[0]?.authorization, 'Bearer router-admin-token');
});

await runTest('sdkworkApiRouterAdminClient resolves the gateway base URL from runtime status', async () => {
  const runtimeStatus = createRuntimeStatus();
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => runtimeStatus,
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-gateway-base-url',
      getJob: async () => ({
        id: 'job-gateway-base-url',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-gateway-base-url',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  const { resolveApiRouterGatewayBaseUrl } = await import('./sdkworkApiRouterAdminClient.ts');

  const gatewayBaseUrl = await resolveApiRouterGatewayBaseUrl();

  assert.equal(gatewayBaseUrl, 'http://127.0.0.1:13003/api');
});

await runTest('sdkworkApiRouterAdminClient bootstraps a managed local admin session before sending authenticated requests', async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
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
      submitProcessJob: async () => 'job-bootstrap-session',
      getJob: async () => ({
        id: 'job-bootstrap-session',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-bootstrap-session',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(input),
      authorization: headers.get('authorization'),
    });

    return new Response(
      JSON.stringify([
        {
          project_id: 'project-bootstrap',
          model: 'gpt-5.4',
          provider: 'provider-openai-official',
          units: 1,
          amount: 0.12,
          input_tokens: 40,
          output_tokens: 20,
          total_tokens: 60,
          created_at_ms: 1_710_100_000_000,
        },
      ]),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  }) as typeof fetch;

  const { sdkworkApiRouterAdminClient } = await import('./sdkworkApiRouterAdminClient.ts');

  clearApiRouterAdminSession();
  const result = await sdkworkApiRouterAdminClient.listUsageRecords();

  assert.equal(result.length, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.authorization, 'Bearer managed-bootstrap-token');
  assert.equal(readApiRouterAdminSession()?.token, 'managed-bootstrap-token');
  assert.equal(readApiRouterAdminSession()?.user.email, 'admin@sdkwork.local');
});

await runTest('sdkworkApiRouterAdminClient login stores the router admin session', async () => {
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-2',
      getJob: async () => ({
        id: 'job-2',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-2',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        token: 'login-token',
        user: {
          id: 'admin_local_default',
          email: 'admin@sdkwork.local',
          display_name: 'Admin Operator',
          active: true,
          created_at_ms: 1_700_000_000_000,
        },
        claims: {
          sub: 'admin_local_default',
          iss: 'sdkwork-admin',
          aud: 'sdkwork-admin-ui',
          exp: 1_800_000_000,
          iat: 1_700_000_000,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    )) as typeof fetch;

  const { clearApiRouterAdminSession, readApiRouterAdminSession } = await import(
    '../auth/apiRouterAdminSession.ts'
  );
  const { sdkworkApiRouterAdminClient } = await import('./sdkworkApiRouterAdminClient.ts');

  clearApiRouterAdminSession();
  const session = await sdkworkApiRouterAdminClient.login({
    email: 'admin@sdkwork.local',
    password: 'ChangeMe123!',
  });

  assert.equal(session.token, 'login-token');
  assert.equal(readApiRouterAdminSession()?.token, 'login-token');
  assert.equal(readApiRouterAdminSession()?.user.email, 'admin@sdkwork.local');
});

await runTest('sdkworkApiRouterAdminClient reads provider health snapshots from the routing admin endpoint', async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-health-snapshots',
      getJob: async () => ({
        id: 'job-health-snapshots',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-health-snapshots',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(input),
      authorization: headers.get('authorization'),
    });

    return new Response(
      JSON.stringify([
        {
          provider_id: 'provider-openai-global',
          extension_id: 'sdkwork.provider.custom-openai',
          runtime: 'connector',
          observed_at_ms: 1_710_002_000_000,
          instance_id: 'provider-openai-global',
          running: true,
          healthy: true,
          message: null,
        },
      ]),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  }) as typeof fetch;

  const { writeApiRouterAdminSession } = await import('../auth/apiRouterAdminSession.ts');
  const { sdkworkApiRouterAdminClient } = await import('./sdkworkApiRouterAdminClient.ts');

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

  const result = await sdkworkApiRouterAdminClient.listProviderHealthSnapshots();

  assert.equal(result.length, 1);
  assert.equal(result[0]?.provider_id, 'provider-openai-global');
  assert.equal(result[0]?.healthy, true);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.url,
    'http://127.0.0.1:13003/api/admin/routing/health-snapshots',
  );
  assert.equal(requests[0]?.authorization, 'Bearer router-admin-token');
});
