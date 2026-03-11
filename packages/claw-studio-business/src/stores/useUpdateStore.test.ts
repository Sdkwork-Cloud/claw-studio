import assert from 'node:assert/strict';
import type { AppUpdateCheckResult } from '@sdkwork/claw-studio-infrastructure';
import { createUpdateStore } from './useUpdateStore.ts';

async function runTest(name: string, callback: () => Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const updateResult: AppUpdateCheckResult = {
  hasUpdate: true,
  updateRequired: false,
  forceUpdate: false,
  currentVersion: '1.2.3',
  targetVersion: '1.3.0',
  releaseChannel: 'stable',
  deliveryType: 'DOWNLOAD_URL',
  updateUrl: 'https://downloads.sdkwork.com/claw-studio-1.3.0',
  highlights: ['Improved desktop runtime'],
  resolvedPackage: {
    url: 'https://downloads.sdkwork.com/claw-studio-1.3.0.exe',
  },
};

await runTest('checkForUpdates transitions the store through checking to ready', async () => {
  const store = createUpdateStore({
    getUpdateCapability: () => ({ available: true }),
    checkForAppUpdate: async () => updateResult,
    openUpdateTarget: async () => ({ kind: 'open-download', url: updateResult.resolvedPackage?.url }),
  });

  const pending = store.getState().checkForUpdates();
  assert.equal(store.getState().status, 'checking');

  await pending;

  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().result?.targetVersion, '1.3.0');
  assert.equal(typeof store.getState().lastCheckedAt, 'number');
  assert.equal(store.getState().error, null);
});

await runTest('runStartupCheck is optional and does nothing when disabled', async () => {
  let called = false;
  const store = createUpdateStore({
    getUpdateCapability: () => ({ available: true }),
    checkForAppUpdate: async () => {
      called = true;
      return updateResult;
    },
    openUpdateTarget: async () => ({ kind: 'open-download', url: updateResult.resolvedPackage?.url }),
  });

  await store.getState().runStartupCheck(false);

  assert.equal(called, false);
  assert.equal(store.getState().status, 'idle');
});

await runTest('checkForUpdates marks the store unavailable when capability is missing', async () => {
  const store = createUpdateStore({
    getUpdateCapability: () => ({
      available: false,
      reason: 'App update capability is unavailable because VITE_API_BASE_URL is missing or unsupported.',
    }),
    checkForAppUpdate: async () => updateResult,
    openUpdateTarget: async () => ({ kind: 'open-download', url: updateResult.resolvedPackage?.url }),
  });

  await store.getState().checkForUpdates();

  assert.equal(store.getState().status, 'unavailable');
  assert.match(store.getState().error ?? '', /VITE_API_BASE_URL/);
});

await runTest('openLatestUpdateTarget triggers the current update action', async () => {
  let opened = false;
  const store = createUpdateStore({
    getUpdateCapability: () => ({ available: true }),
    checkForAppUpdate: async () => updateResult,
    openUpdateTarget: async () => {
      opened = true;
      return { kind: 'open-download', url: updateResult.resolvedPackage?.url };
    },
  });

  await store.getState().checkForUpdates();
  const action = await store.getState().openLatestUpdateTarget();

  assert.equal(opened, true);
  assert.equal(action?.kind, 'open-download');
});
