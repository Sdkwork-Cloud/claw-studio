import assert from 'node:assert/strict';
import {
  configurePlatformBridge,
  type RuntimeApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';

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

await runTest('apiRouterRuntimeService loads runtime status from the shared runtime bridge', async () => {
  const status = createRuntimeStatus();
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => status,
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

  const { apiRouterRuntimeService } = await import('./apiRouterRuntimeService.ts');
  const result = await apiRouterRuntimeService.getStatus();

  assert.deepEqual(result, status);
});

await runTest('apiRouterRuntimeService maps attached external runtimes into a healthy presentation model', async () => {
  const { describeApiRouterRuntimeStatus } = await import('./apiRouterRuntimeService.ts');
  const description = describeApiRouterRuntimeStatus(createRuntimeStatus());

  assert.equal(description.tone, 'healthy');
  assert.equal(description.modeKey, 'apiRouterPage.runtime.mode.attachedExternal');
  assert.equal(description.showManagedHint, false);
  assert.equal(description.showConflictWarning, false);
});

await runTest('apiRouterRuntimeService maps managed-start recommendations into an actionable warning model', async () => {
  const { describeApiRouterRuntimeStatus } = await import('./apiRouterRuntimeService.ts');
  const description = describeApiRouterRuntimeStatus(
    createRuntimeStatus({
      mode: 'needsManagedStart',
      recommendedManagedMode: 'inProcess',
      admin: {
        bindAddr: '127.0.0.1:18081',
        healthUrl: 'http://127.0.0.1:18081/admin/health',
        enabled: true,
        publicBaseUrl: 'http://127.0.0.1:18083/api/admin',
        healthy: false,
        portAvailable: true,
      },
      portal: {
        bindAddr: '127.0.0.1:18082',
        healthUrl: 'http://127.0.0.1:18082/portal/health',
        enabled: true,
        publicBaseUrl: 'http://127.0.0.1:18083/api/portal',
        healthy: false,
        portAvailable: true,
      },
      gateway: {
        bindAddr: '127.0.0.1:18080',
        healthUrl: 'http://127.0.0.1:18080/health',
        enabled: true,
        publicBaseUrl: 'http://127.0.0.1:18083/api',
        healthy: false,
        portAvailable: true,
      },
      reason: 'No healthy external sdkwork-api-router runtime is attached.',
    }),
  );

  assert.equal(description.tone, 'warning');
  assert.equal(description.modeKey, 'apiRouterPage.runtime.mode.needsManagedStart');
  assert.equal(description.showManagedHint, true);
  assert.equal(description.showConflictWarning, false);
  assert.equal(
    description.recommendedManagedModeKey,
    'apiRouterPage.runtime.managedMode.inProcess',
  );
});

await runTest('apiRouterRuntimeService maps conflicted ports into a blocking warning model', async () => {
  const { describeApiRouterRuntimeStatus } = await import('./apiRouterRuntimeService.ts');
  const description = describeApiRouterRuntimeStatus(
    createRuntimeStatus({
      mode: 'conflicted',
      recommendedManagedMode: null,
      admin: {
        bindAddr: '127.0.0.1:28081',
        healthUrl: 'http://127.0.0.1:28081/admin/health',
        enabled: true,
        publicBaseUrl: 'http://127.0.0.1:28083/api/admin',
        healthy: false,
        portAvailable: false,
      },
      portal: {
        bindAddr: '127.0.0.1:28082',
        healthUrl: 'http://127.0.0.1:28082/portal/health',
        enabled: true,
        publicBaseUrl: 'http://127.0.0.1:28083/api/portal',
        healthy: false,
        portAvailable: false,
      },
      gateway: {
        bindAddr: '127.0.0.1:28080',
        healthUrl: 'http://127.0.0.1:28080/health',
        enabled: true,
        publicBaseUrl: 'http://127.0.0.1:28083/api',
        healthy: false,
        portAvailable: false,
      },
      reason: 'The configured sdkwork-api-router ports are occupied but the runtime health probe failed.',
    }),
  );

  assert.equal(description.tone, 'danger');
  assert.equal(description.modeKey, 'apiRouterPage.runtime.mode.conflicted');
  assert.equal(description.showManagedHint, false);
  assert.equal(description.showConflictWarning, true);
});

await runTest('apiRouterRuntimeService maps Claw-managed runtimes into a healthy managed presentation model', async () => {
  const { describeApiRouterRuntimeStatus } = await import('./apiRouterRuntimeService.ts');
  const description = describeApiRouterRuntimeStatus(
    createRuntimeStatus({
      mode: 'managedActive',
      recommendedManagedMode: null,
      reason: 'Claw Studio is managing the sdkwork-api-router runtime for this session.',
    }),
  );

  assert.equal(description.tone, 'healthy');
  assert.equal(description.modeKey, 'apiRouterPage.runtime.mode.managedActive');
  assert.equal(description.summaryKey, 'apiRouterPage.runtime.summary.managedActive');
  assert.equal(description.showManagedHint, false);
  assert.equal(description.showConflictWarning, false);
});
