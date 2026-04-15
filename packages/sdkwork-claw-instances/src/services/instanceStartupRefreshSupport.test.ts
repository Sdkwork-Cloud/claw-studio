import assert from 'node:assert/strict';
import { DEFAULT_BUNDLED_OPENCLAW_VERSION } from '@sdkwork/claw-types';
import {
  BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS,
  hasPendingBuiltInOpenClawStartup,
  hasPendingBuiltInOpenClawWorkbenchStartup,
  shouldRefreshInstancesForBuiltInOpenClawStatusChange,
  shouldRefreshWorkbenchForBuiltInOpenClawStatusChange,
} from './instanceStartupRefreshSupport.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'local-built-in',
    name: 'Built-In OpenClaw',
    type: 'OpenClaw',
    iconType: 'server',
    status: 'starting',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    uptime: '0m',
    ip: '127.0.0.1',
    cpu: 0,
    memory: 0,
    totalMemory: '16 GB',
    isBuiltIn: true,
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    ...overrides,
  };
}

function createWorkbench(overrides: Record<string, unknown> = {}) {
  return {
    detail: {
      instance: createInstance(),
    },
    ...overrides,
  };
}

function createManagedFutureKernelLikeInstance(overrides: Record<string, unknown> = {}) {
  return createInstance({
    id: 'local-built-in-phoenixclaw',
    name: 'Managed PhoenixClaw',
    type: 'PhoenixClaw',
    runtimeKind: 'phoenixclaw',
    transportKind: 'phoenixSocket',
    ...overrides,
  });
}

await runTest('instance startup refresh support exposes the built-in polling interval contract', () => {
  assert.equal(BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS, 1500);
});

await runTest('instance startup refresh support polls the registry while built-in OpenClaw is still starting', () => {
  assert.equal(
    hasPendingBuiltInOpenClawStartup([
      createInstance(),
      createInstance({
        id: 'remote-openclaw',
        isBuiltIn: false,
        deploymentMode: 'remote',
        status: 'online',
      }),
    ] as any),
    true,
  );
});

await runTest('instance startup refresh support also polls the registry for future built-in local-managed kernels that are still starting', () => {
  assert.equal(
    hasPendingBuiltInOpenClawStartup([
      createManagedFutureKernelLikeInstance(),
      createInstance({
        id: 'remote-openclaw',
        isBuiltIn: false,
        deploymentMode: 'remote',
        status: 'online',
      }),
    ] as any),
    true,
  );
});

await runTest('instance startup refresh support ignores non-built-in or settled instances', () => {
  assert.equal(
    hasPendingBuiltInOpenClawStartup([
      createInstance({ isBuiltIn: false }),
      createInstance({ id: 'local-built-in', status: 'online' }),
      createInstance({ id: 'local-built-in-syncing', status: 'syncing' }),
      createInstance({ id: 'local-built-in-error', status: 'error' }),
    ] as any),
    false,
  );
});

await runTest('instance startup refresh support polls the workbench while the built-in OpenClaw detail is still starting', () => {
  assert.equal(hasPendingBuiltInOpenClawWorkbenchStartup(createWorkbench() as any), true);
  assert.equal(
    hasPendingBuiltInOpenClawWorkbenchStartup(
      createWorkbench({
        detail: {
          instance: createInstance({
            status: 'online',
          }),
        },
      }) as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support also polls the workbench for future built-in local-managed kernels that are still starting', () => {
  assert.equal(
    hasPendingBuiltInOpenClawWorkbenchStartup(
      createWorkbench({
        detail: {
          instance: createManagedFutureKernelLikeInstance(),
        },
      }) as any,
    ),
    true,
  );
});

await runTest('instance startup refresh support refreshes the list when the built-in OpenClaw changes status in the background', () => {
  assert.equal(
    shouldRefreshInstancesForBuiltInOpenClawStatusChange(
      [
        createInstance(),
        createInstance({
          id: 'remote-openclaw',
          isBuiltIn: false,
          deploymentMode: 'remote',
          status: 'online',
        }),
      ] as any,
      {
        instanceId: 'local-built-in',
        status: 'online',
      } as any,
    ),
    true,
  );
  assert.equal(
    shouldRefreshInstancesForBuiltInOpenClawStatusChange(
      [
        createInstance({
          status: 'online',
        }),
      ] as any,
      {
        instanceId: 'local-built-in',
        status: 'online',
      } as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support also refreshes the list for future built-in local-managed kernel status changes', () => {
  assert.equal(
    shouldRefreshInstancesForBuiltInOpenClawStatusChange(
      [
        createManagedFutureKernelLikeInstance(),
      ] as any,
      {
        instanceId: 'local-built-in-phoenixclaw',
        status: 'online',
      } as any,
    ),
    true,
  );
});

await runTest('instance startup refresh support only refreshes the active workbench for the matching built-in OpenClaw event', () => {
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      'local-built-in',
      createWorkbench() as any,
      {
        instanceId: 'local-built-in',
        status: 'error',
      } as any,
    ),
    true,
  );
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      'local-built-in',
      createWorkbench() as any,
      {
        instanceId: 'another-instance',
        status: 'online',
      } as any,
    ),
    false,
  );
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      'remote-openclaw',
      createWorkbench({
        detail: {
          instance: createInstance({
            id: 'remote-openclaw',
            isBuiltIn: false,
            deploymentMode: 'remote',
          }),
        },
      }) as any,
      {
        instanceId: 'remote-openclaw',
        status: 'online',
      } as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support also refreshes the active workbench for future built-in local-managed kernel events', () => {
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      'local-built-in-phoenixclaw',
      createWorkbench({
        detail: {
          instance: createManagedFutureKernelLikeInstance(),
        },
      }) as any,
      {
        instanceId: 'local-built-in-phoenixclaw',
        status: 'online',
      } as any,
    ),
    true,
  );
});
