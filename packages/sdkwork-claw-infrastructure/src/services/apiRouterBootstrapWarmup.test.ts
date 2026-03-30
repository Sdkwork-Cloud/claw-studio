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

function createRuntimeStatus(
  overrides: Partial<RuntimeApiRouterRuntimeStatus> = {},
): RuntimeApiRouterRuntimeStatus {
  return {
    mode: 'managedActive',
    recommendedManagedMode: null,
    sharedRootDir: 'C:/Users/admin/.sdkwork/router',
    configDir: 'C:/Users/admin/.sdkwork/router',
    configSource: 'defaults',
    resolvedConfigFile: 'C:/Users/admin/.sdkwork/router/config.json',
    admin: {
      bindAddr: '127.0.0.1:12101',
      healthUrl: 'http://127.0.0.1:12101/admin/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:12103/api/admin',
      healthy: true,
      portAvailable: false,
    },
    portal: {
      bindAddr: '127.0.0.1:12102',
      healthUrl: 'http://127.0.0.1:12102/portal/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:12103/api/portal',
      healthy: true,
      portAvailable: false,
    },
    gateway: {
      bindAddr: '127.0.0.1:12100',
      healthUrl: 'http://127.0.0.1:12100/health',
      publicBaseUrl: 'http://127.0.0.1:12103/api',
      healthy: true,
      portAvailable: false,
    },
    adminSiteBaseUrl: 'http://127.0.0.1:12103/admin',
    portalSiteBaseUrl: 'http://127.0.0.1:12103/portal',
    reason: 'Claw Studio is managing the sdkwork-api-router runtime for this session.',
    ...overrides,
  } as RuntimeApiRouterRuntimeStatus;
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

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

await runTest('warmApiRouterAdminSession primes a managed bootstrap session for a healthy local desktop runtime', async () => {
  clearApiRouterAdminSession();

  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      getApiRouterAdminBootstrapSession: async () => ({
        token: 'warmup-bootstrap-token',
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

  const { warmApiRouterAdminSession } = await import('./apiRouterBootstrapWarmup.ts');

  const warmed = await warmApiRouterAdminSession();
  const session = readApiRouterAdminSession();

  assert.equal(warmed, true);
  assert.equal(session?.token, 'warmup-bootstrap-token');
  assert.equal(session?.source, 'managedBootstrap');
});

await runTest('warmApiRouterAdminSession skips bootstrap when the local router is not ready to attach', async () => {
  clearApiRouterAdminSession();
  let bootstrapRequests = 0;

  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () =>
        createRuntimeStatus({
          mode: 'needsManagedStart',
          admin: {
            bindAddr: '127.0.0.1:12101',
            healthUrl: 'http://127.0.0.1:12101/admin/health',
            enabled: true,
            publicBaseUrl: 'http://127.0.0.1:12103/api/admin',
            healthy: false,
            portAvailable: true,
          },
          gateway: {
            bindAddr: '127.0.0.1:12100',
            healthUrl: 'http://127.0.0.1:12100/health',
            publicBaseUrl: 'http://127.0.0.1:12103/api',
            healthy: false,
            portAvailable: true,
          },
          reason:
            'No healthy external sdkwork-api-router runtime is attached; start the managed in-process runtime.',
        }),
      getApiRouterAdminBootstrapSession: async () => {
        bootstrapRequests += 1;
        return null;
      },
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

  const { warmApiRouterAdminSession } = await import('./apiRouterBootstrapWarmup.ts');

  const warmed = await warmApiRouterAdminSession();

  assert.equal(warmed, false);
  assert.equal(bootstrapRequests, 0);
  assert.equal(readApiRouterAdminSession(), null);
});

await runTest('warmApiRouterAdminSession starts the managed local router before warming bootstrap auth', async () => {
  clearApiRouterAdminSession();
  let runtimeStatusCallCount = 0;
  let ensureRuntimeStartedCallCount = 0;
  let bootstrapRequests = 0;

  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => {
        runtimeStatusCallCount += 1;

        if (runtimeStatusCallCount === 1) {
          return createRuntimeStatus({
            mode: 'needsManagedStart',
            recommendedManagedMode: 'inProcess',
            admin: {
              bindAddr: '127.0.0.1:12101',
              healthUrl: 'http://127.0.0.1:12101/admin/health',
              enabled: true,
              publicBaseUrl: 'http://127.0.0.1:12103/api/admin',
              healthy: false,
              portAvailable: true,
            },
            gateway: {
              bindAddr: '127.0.0.1:12100',
              healthUrl: 'http://127.0.0.1:12100/health',
              publicBaseUrl: 'http://127.0.0.1:12103/api',
              healthy: false,
              portAvailable: true,
            },
            reason:
              'No healthy external sdkwork-api-router runtime is attached; start the managed in-process runtime.',
          });
        }

        return createRuntimeStatus();
      },
      ensureApiRouterRuntimeStarted: async () => {
        ensureRuntimeStartedCallCount += 1;
        return createRuntimeStatus();
      },
      getApiRouterAdminBootstrapSession: async () => {
        bootstrapRequests += 1;
        return {
          token: 'ensured-bootstrap-token',
          source: 'managedLocalJwt',
          user: {
            id: 'admin_local_default',
            email: 'admin@sdkwork.local',
            displayName: 'Admin Operator',
            active: true,
            createdAtMs: 1_700_000_000_000,
          },
        };
      },
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-3',
      getJob: async () => ({
        id: 'job-3',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-3',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  const { warmApiRouterAdminSession } = await import('./apiRouterBootstrapWarmup.ts');

  const warmed = await warmApiRouterAdminSession();

  assert.equal(warmed, true);
  assert.equal(ensureRuntimeStartedCallCount, 1);
  assert.equal(bootstrapRequests, 1);
  assert.equal(readApiRouterAdminSession()?.token, 'ensured-bootstrap-token');
});
