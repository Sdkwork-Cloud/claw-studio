import { useMemo } from 'react';
import {
  createClient,
  type SdkworkAppClient,
  type SdkworkAppConfig,
} from '@sdkwork/app-sdk';
import {
  APP_ENV,
  type AppRuntimeEnv,
} from '@sdkwork/claw-infrastructure';

export type { AppRuntimeEnv };

export interface AppSdkClientConfig extends SdkworkAppConfig {
  env: AppRuntimeEnv;
}

export interface AppSdkSessionTokens {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

const DEFAULT_TIMEOUT = 30_000;
const APP_SDK_SESSION_STORAGE_KEY = 'claw-studio-auth-session';

let appSdkClient: SdkworkAppClient | null = null;
let appSdkConfig: AppSdkClientConfig | null = null;

function readEnv(name: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.[name];
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function readStorage(key: string): string | undefined {
  const storage = getStorage();
  if (!storage) {
    return undefined;
  }

  try {
    return storage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value?: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    if (value && value.trim()) {
      storage.setItem(key, value.trim());
      return;
    }
    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function removeStorage(key: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function normalizeAuthToken(value?: string): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase().startsWith('bearer ')) {
    return normalized.slice(7).trim();
  }

  return normalized;
}

function parseTimeout(value?: string, fallback = DEFAULT_TIMEOUT): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl || '').trim().replace(/\/+$/g, '');
}

function readPersistedSession(): Pick<AppSdkSessionTokens, 'authToken' | 'refreshToken'> {
  const rawValue = readStorage(APP_SDK_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AppSdkSessionTokens>;
    return {
      authToken: normalizeAuthToken(parsed.authToken),
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken.trim() : undefined,
    };
  } catch {
    return {};
  }
}

function writePersistedSession(tokens: Pick<AppSdkSessionTokens, 'authToken' | 'refreshToken'>): void {
  const authToken = normalizeAuthToken(tokens.authToken);
  const refreshToken = (tokens.refreshToken || '').trim();

  if (!authToken) {
    removeStorage(APP_SDK_SESSION_STORAGE_KEY);
    return;
  }

  writeStorage(
    APP_SDK_SESSION_STORAGE_KEY,
    JSON.stringify({
      authToken,
      refreshToken: refreshToken || undefined,
    }),
  );
}

function applySessionTokensToClient(client: SdkworkAppClient, tokens: AppSdkSessionTokens): void {
  client.setAuthToken(normalizeAuthToken(tokens.authToken));
  client.setAccessToken((tokens.accessToken ?? resolveAppSdkAccessToken()).trim());
}

export function createAppSdkClientConfig(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClientConfig {
  const env = APP_ENV.appEnv;

  return {
    env,
    baseUrl: normalizeBaseUrl(
      firstDefined(overrides.baseUrl, readEnv('VITE_API_BASE_URL'), APP_ENV.api.baseUrl),
    ),
    timeout: overrides.timeout ?? parseTimeout(readEnv('VITE_TIMEOUT'), APP_ENV.api.timeout || DEFAULT_TIMEOUT),
    apiKey: overrides.apiKey ?? firstDefined(readEnv('VITE_API_KEY')),
    authToken: overrides.authToken,
    accessToken: overrides.accessToken ?? firstDefined(readEnv('VITE_ACCESS_TOKEN'), APP_ENV.auth.accessToken),
    tenantId: overrides.tenantId ?? firstDefined(readEnv('VITE_TENANT_ID')),
    organizationId: overrides.organizationId ?? firstDefined(readEnv('VITE_ORGANIZATION_ID')),
    platform: overrides.platform ?? firstDefined(readEnv('VITE_PLATFORM'), APP_ENV.platform.id) ?? 'web',
    tokenManager: overrides.tokenManager,
    authMode: overrides.authMode,
    headers: overrides.headers,
  };
}

export function initAppSdkClient(overrides: Partial<SdkworkAppConfig> = {}): SdkworkAppClient {
  appSdkConfig = createAppSdkClientConfig(overrides);
  appSdkClient = createClient(appSdkConfig);
  return appSdkClient;
}

export function getAppSdkClient(): SdkworkAppClient {
  if (!appSdkClient) {
    return initAppSdkClient();
  }
  return appSdkClient;
}

export function getAppSdkClientConfig(): AppSdkClientConfig | null {
  return appSdkConfig;
}

export function resolveAppSdkAccessToken(): string {
  return (
    firstDefined(
      getAppSdkClientConfig()?.accessToken,
      readEnv('VITE_ACCESS_TOKEN'),
      APP_ENV.auth.accessToken,
    ) || ''
  ).trim();
}

export function resetAppSdkClient(): void {
  appSdkClient = null;
  appSdkConfig = null;
}

export function applyAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  const client = getAppSdkClient();
  applySessionTokensToClient(client, tokens);
}

export function readAppSdkSessionTokens(): AppSdkSessionTokens {
  const stored = readPersistedSession();
  const accessToken = resolveAppSdkAccessToken();

  return {
    authToken: stored.authToken || undefined,
    accessToken: accessToken || undefined,
    refreshToken: stored.refreshToken || undefined,
  };
}

export function persistAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  const authToken = normalizeAuthToken(tokens.authToken);
  const refreshToken = (tokens.refreshToken || '').trim();
  const accessToken = (tokens.accessToken ?? resolveAppSdkAccessToken()).trim();

  writePersistedSession({
    authToken,
    refreshToken: refreshToken || undefined,
  });
  applyAppSdkSessionTokens({
    authToken,
    accessToken,
    refreshToken,
  });
}

export function clearAppSdkSessionTokens(): void {
  removeStorage(APP_SDK_SESSION_STORAGE_KEY);
  const configuredAccessToken = resolveAppSdkAccessToken();
  if (appSdkClient) {
    applySessionTokensToClient(appSdkClient, {
      authToken: '',
      accessToken: configuredAccessToken,
    });
  }
  resetAppSdkClient();
}

function createScopedAppSdkClient(overrides: Partial<SdkworkAppConfig> = {}): SdkworkAppClient {
  const config = createAppSdkClientConfig(overrides);
  const client = createClient(config);
  applySessionTokensToClient(client, readAppSdkSessionTokens());
  return client;
}

export function getAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): SdkworkAppClient {
  if (Object.keys(overrides).length > 0) {
    return createScopedAppSdkClient(overrides);
  }

  const client = getAppSdkClient();
  applySessionTokensToClient(client, readAppSdkSessionTokens());
  return client;
}

export function useAppSdkClient(
  overrides: Partial<SdkworkAppConfig> = {},
): SdkworkAppClient {
  const key = JSON.stringify(overrides || {});
  return useMemo(() => getAppSdkClientWithSession(overrides), [key]);
}
