import assert from 'node:assert/strict';
import {
  createAppEnvConfig,
  type AppUpdateCheckRequest,
  type AppUpdateCheckResult,
  type RuntimeInfo,
} from '@sdkwork/claw-studio-infrastructure';
import { createUpdateService } from './updateService.ts';

async function runTest(name: string, callback: () => Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const runtimeInfo: RuntimeInfo = {
  platform: 'desktop',
  app: {
    name: 'Claw Studio',
    version: '1.2.3',
    target: 'windows-x86_64',
  },
  system: {
    os: 'Windows 11',
    arch: 'x86_64',
    family: 'windows',
    target: 'windows-x86_64',
  },
};

const updateResult: AppUpdateCheckResult = {
  hasUpdate: true,
  updateRequired: false,
  forceUpdate: false,
  currentVersion: '1.2.3',
  targetVersion: '1.3.0',
  releaseChannel: 'stable',
  deliveryType: 'DOWNLOAD_URL',
  updateUrl: 'https://downloads.sdkwork.com/claw-studio-1.3.0',
  highlights: ['Improved updates'],
  resolvedPackage: {
    url: 'https://downloads.sdkwork.com/claw-studio-1.3.0.exe',
    architecture: 'x86_64',
  },
};

await runTest('checkForAppUpdate maps env and runtime metadata into the backend request', async () => {
  let capturedRequest: AppUpdateCheckRequest | null = null;

  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_API_BASE_URL: 'http://localhost:8080',
      VITE_ACCESS_TOKEN: 'Bearer desktop-token',
      VITE_APP_ID: '42',
      VITE_RELEASE_CHANNEL: 'stable',
      VITE_DISTRIBUTION_ID: 'global',
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => runtimeInfo,
    getDeviceId: async () => 'device-1',
    getLocale: () => 'zh-CN',
    checkAppUpdate: async (request) => {
      capturedRequest = request;
      return updateResult;
    },
    openExternal: async () => {},
  });

  const result = await service.checkForAppUpdate();

  assert.ok(capturedRequest);
  assert.equal(capturedRequest?.appId, 42);
  assert.equal(capturedRequest?.runtime, 'TAURI');
  assert.equal(capturedRequest?.platform, 'desktop_windows');
  assert.equal(capturedRequest?.architecture, 'x86_64');
  assert.equal(capturedRequest?.currentVersion, '1.2.3');
  assert.equal(capturedRequest?.releaseChannel, 'stable');
  assert.equal(capturedRequest?.deviceId, 'device-1');
  assert.equal(capturedRequest?.locale, 'zh-CN');
  assert.deepEqual(capturedRequest?.metadata, {
    distributionId: 'global',
    runtimePlatform: 'desktop',
    target: 'windows-x86_64',
    family: 'windows',
  });
  assert.equal(result?.targetVersion, '1.3.0');
});

await runTest('getUpdateCapability reports unavailable when env is incomplete and skips the request', async () => {
  let called = false;

  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => runtimeInfo,
    getDeviceId: async () => 'device-1',
    getLocale: () => 'zh-CN',
    checkAppUpdate: async () => {
      called = true;
      return updateResult;
    },
    openExternal: async () => {},
  });

  const capability = service.getUpdateCapability();
  const result = await service.checkForAppUpdate();

  assert.equal(capability.available, false);
  assert.match(capability.reason ?? '', /VITE_API_BASE_URL|VITE_APP_ID/);
  assert.equal(result, null);
  assert.equal(called, false);
});

await runTest('resolvePreferredUpdateAction prefers package url, then update url, then store url', async () => {
  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_API_BASE_URL: 'http://localhost:8080',
      VITE_APP_ID: '42',
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => runtimeInfo,
    getDeviceId: async () => 'device-1',
    getLocale: () => 'zh-CN',
    checkAppUpdate: async () => updateResult,
    openExternal: async () => {},
  });

  const packageAction = service.resolvePreferredUpdateAction(updateResult);
  const updateAction = service.resolvePreferredUpdateAction({
    ...updateResult,
    resolvedPackage: null,
  });
  const storeAction = service.resolvePreferredUpdateAction({
    ...updateResult,
    resolvedPackage: null,
    updateUrl: undefined,
    storeUrl: 'https://apps.microsoft.com/detail/claw-studio',
  });

  assert.deepEqual(packageAction, {
    kind: 'open-download',
    url: 'https://downloads.sdkwork.com/claw-studio-1.3.0.exe',
  });
  assert.deepEqual(updateAction, {
    kind: 'open-download',
    url: 'https://downloads.sdkwork.com/claw-studio-1.3.0',
  });
  assert.deepEqual(storeAction, {
    kind: 'open-store',
    url: 'https://apps.microsoft.com/detail/claw-studio',
  });
});

await runTest('openUpdateTarget opens the preferred url through the platform bridge dependency', async () => {
  let openedUrl = '';

  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_API_BASE_URL: 'http://localhost:8080',
      VITE_APP_ID: '42',
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => runtimeInfo,
    getDeviceId: async () => 'device-1',
    getLocale: () => 'zh-CN',
    checkAppUpdate: async () => updateResult,
    openExternal: async (url) => {
      openedUrl = url;
    },
  });

  const action = await service.openUpdateTarget(updateResult);

  assert.equal(openedUrl, 'https://downloads.sdkwork.com/claw-studio-1.3.0.exe');
  assert.equal(action.kind, 'open-download');
});
