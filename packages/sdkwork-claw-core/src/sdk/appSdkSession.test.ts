import assert from 'node:assert/strict';
import {
  clearAppSdkSessionStorage,
  persistAppSdkSessionStorage,
  readAppSdkSessionTokens,
  resetConfiguredAppSdkAccessToken,
  setConfiguredAppSdkAccessToken,
} from './appSdkSession.ts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

async function runTest(name: string, callback: () => void | Promise<void>) {
  try {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
    resetConfiguredAppSdkAccessToken();
    clearAppSdkSessionStorage();
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'appSdkSession persists normalized auth tokens while exposing the configured access token on reads',
  () => {
    setConfiguredAppSdkAccessToken('Bearer configured-access-token');

    persistAppSdkSessionStorage({
      authToken: 'Bearer session-auth-token',
      refreshToken: ' refresh-token ',
    });

    assert.deepEqual(readAppSdkSessionTokens(), {
      authToken: 'session-auth-token',
      accessToken: 'configured-access-token',
      refreshToken: 'refresh-token',
    });
  },
);

await runTest(
  'appSdkSession clears persisted auth state without dropping the configured access token fallback',
  () => {
    setConfiguredAppSdkAccessToken('configured-access-token');

    persistAppSdkSessionStorage({
      authToken: 'session-auth-token',
      refreshToken: 'refresh-token',
    });
    clearAppSdkSessionStorage();

    assert.deepEqual(readAppSdkSessionTokens(), {
      authToken: undefined,
      accessToken: 'configured-access-token',
      refreshToken: undefined,
    });
  },
);

await runTest(
  'appSdkSession ignores corrupted persisted payloads instead of throwing during bootstrap',
  () => {
    const storage = globalThis.localStorage;
    storage.setItem('claw-studio-auth-session', '{broken-json');

    assert.deepEqual(readAppSdkSessionTokens(), {
      authToken: undefined,
      accessToken: undefined,
      refreshToken: undefined,
    });
  },
);
