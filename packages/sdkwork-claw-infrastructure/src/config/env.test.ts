import assert from 'node:assert/strict';
import {
  createAppEnvConfig,
  getApiUrl,
  hasDesktopUpdateConfig,
  readAccessToken,
  readImWsUrl,
} from './env.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('createAppEnvConfig applies defaults and normalizes the base URL', () => {
  const env = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080/',
    VITE_IM_WS_URL: 'ws://localhost:5201/ws/',
  });

  assert.equal(env.appEnv, 'development');
  assert.equal(env.api.baseUrl, 'http://localhost:8080');
  assert.equal(env.im.wsUrl, 'ws://localhost:5201/ws');
  assert.equal(getApiUrl('/app/v3/api/update/check', env), 'http://localhost:8080/app/v3/api/update/check');
});

runTest('readImWsUrl returns the normalized IM websocket endpoint', () => {
  const env = createAppEnvConfig({
    VITE_IM_WS_URL: 'wss://im.example.com/ws/',
  });

  assert.equal(readImWsUrl(env), 'wss://im.example.com/ws');
});

runTest('createAppEnvConfig preserves the explicit test runtime environment', () => {
  const env = createAppEnvConfig({
    VITE_APP_ENV: 'test',
    VITE_API_BASE_URL: 'https://api-test.sdkwork.com',
  });

  assert.equal(env.appEnv, 'test');
  assert.equal(env.isDev, false);
  assert.equal(env.isProduction, false);
  assert.equal(env.api.baseUrl, 'https://api-test.sdkwork.com');
});

runTest('readAccessToken trims whitespace and removes the bearer prefix', () => {
  const env = createAppEnvConfig({
    VITE_ACCESS_TOKEN: '  Bearer test-token  ',
  });

  assert.equal(readAccessToken(env), 'test-token');
});

runTest('hasDesktopUpdateConfig reports readiness only when base URL and app id exist', () => {
  const missingAppId = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080',
  });
  const ready = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080',
    VITE_APP_ID: '42',
  });

  assert.equal(hasDesktopUpdateConfig(missingAppId), false);
  assert.equal(hasDesktopUpdateConfig(ready), true);
  assert.equal(ready.update.appId, 42);
});

runTest('createAppEnvConfig keeps startup update checks enabled by default', () => {
  const env = createAppEnvConfig({});

  assert.equal(env.update.enableStartupCheck, true);
  assert.equal(env.platform.isDesktop, false);
});
