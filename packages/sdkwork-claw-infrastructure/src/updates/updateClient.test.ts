import assert from 'node:assert/strict';
import { createAppEnvConfig } from '../config/env.ts';
import {
  checkAppUpdate,
  type AppUpdateCheckRequest,
} from './updateClient.ts';

async function runTest(name: string, callback: () => Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const sampleRequest: AppUpdateCheckRequest = {
  appId: 42,
  runtime: 'TAURI',
  platform: 'desktop_windows',
  architecture: 'x86_64',
  currentVersion: '0.1.0',
  buildNumber: '100',
  releaseChannel: 'stable',
  packageName: 'claw-studio',
  bundleId: 'com.sdkwork.claw-studio',
  deviceId: 'device-1',
  osVersion: 'Windows 11',
  locale: 'zh-CN',
  metadata: {
    distributionId: 'global',
  },
};

await runTest('checkAppUpdate posts to the backend update endpoint with bearer auth', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      code: 0,
      message: 'ok',
      data: {
        hasUpdate: true,
        currentVersion: '0.1.0',
        targetVersion: '0.2.0',
        updateUrl: 'https://downloads.sdkwork.com/claw-studio-0.2.0',
        deliveryType: 'DOWNLOAD_URL',
        releaseChannel: 'stable',
        resolvedPackage: {
          url: 'https://downloads.sdkwork.com/claw-studio-0.2.0.exe',
          packageFormat: 'nsis',
          architecture: 'x86_64',
        },
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    const env = createAppEnvConfig({
      VITE_API_BASE_URL: 'http://localhost:8080/',
      VITE_ACCESS_TOKEN: 'Bearer desktop-token',
      VITE_APP_ID: '42',
    });

    const result = await checkAppUpdate(sampleRequest, { env });

    assert.equal(requestUrl, 'http://localhost:8080/app/v3/api/update/check');
    assert.equal(requestInit?.method, 'POST');
    assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer desktop-token');
    assert.equal(result.hasUpdate, true);
    assert.equal(result.targetVersion, '0.2.0');
    assert.equal(result.resolvedPackage?.url, 'https://downloads.sdkwork.com/claw-studio-0.2.0.exe');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await runTest('checkAppUpdate omits Authorization when no access token is configured', async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(JSON.stringify({
      code: 0,
      message: 'ok',
      data: {
        hasUpdate: false,
        currentVersion: '0.1.0',
        targetVersion: '0.1.0',
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    const env = createAppEnvConfig({
      VITE_API_BASE_URL: 'http://localhost:8080',
      VITE_APP_ID: '42',
    });

    await checkAppUpdate(sampleRequest, { env });

    assert.equal('Authorization' in ((requestInit?.headers as Record<string, string>) ?? {}), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
