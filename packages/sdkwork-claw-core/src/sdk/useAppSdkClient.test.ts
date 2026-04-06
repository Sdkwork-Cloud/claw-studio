import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAppSdkSessionTokens,
  createAppSdkClientConfig,
  persistAppSdkSessionTokens,
  resetAppSdkClient,
} from './useAppSdkClient.ts';

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

function stubRuntimeEnv(name: string, value: string): void {
  vi.stubEnv(name, value);
  process.env[name] = value;
}

function installBrowserStorage(storage: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
  });
}

beforeEach(() => {
  resetAppSdkClient();
  clearAppSdkSessionTokens();
  installBrowserStorage(createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.VITE_APP_ENV;
  delete process.env.VITE_OWNER_MODE;
  delete process.env.VITE_API_BASE_URL;
  delete process.env.VITE_ORGANIZATION_API_BASE_URL;
  delete process.env.VITE_ACCESS_TOKEN;
  delete process.env.VITE_ORGANIZATION_ACCESS_TOKEN;
  delete process.env.VITE_PLATFORM;
});

describe('createAppSdkClientConfig', () => {
  it('supports owner-scoped organization base urls and access tokens', () => {
    stubRuntimeEnv('VITE_APP_ENV', 'development');
    stubRuntimeEnv('VITE_OWNER_MODE', 'organization');
    stubRuntimeEnv('VITE_API_BASE_URL', 'https://api-root.sdkwork.com');
    stubRuntimeEnv('VITE_ORGANIZATION_API_BASE_URL', 'https://api-org.sdkwork.com/');
    stubRuntimeEnv('VITE_ACCESS_TOKEN', 'root-access-token');
    stubRuntimeEnv('VITE_ORGANIZATION_ACCESS_TOKEN', 'organization-access-token');
    stubRuntimeEnv('VITE_PLATFORM', 'desktop');

    const config = createAppSdkClientConfig();

    expect(config.env).toBe('development');
    expect(config.baseUrl).toBe('https://api-org.sdkwork.com');
    expect(config.accessToken).toBe('organization-access-token');
    expect(config.platform).toBe('desktop');
  });

  it('persists auth runtime state into standardized core storage keys', () => {
    persistAppSdkSessionTokens({
      authToken: 'Bearer auth-token',
      accessToken: 'owner-access-token',
      refreshToken: 'refresh-token',
    });

    expect(globalThis.localStorage.getItem('sdkwork.core.pc-react.auth-token')).toBe('auth-token');
    expect(globalThis.localStorage.getItem('sdkwork.core.pc-react.access-token')).toBe('owner-access-token');
    expect(globalThis.localStorage.getItem('sdkwork.core.pc-react.refresh-token')).toBe('refresh-token');
    expect(globalThis.localStorage.getItem('claw-studio-auth-session')).toBeNull();
  });
});
