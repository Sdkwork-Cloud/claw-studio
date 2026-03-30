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
import {
  clearAppSdkSessionStorage,
  normalizeAppSdkAuthToken,
  persistAppSdkSessionStorage,
  readAppSdkSessionTokens,
  resetConfiguredAppSdkAccessToken,
  resolveAppSdkAccessToken,
  setConfiguredAppSdkAccessToken,
  type AppSdkSessionTokens,
} from './appSdkSession.ts';

export type { AppRuntimeEnv };
export type { AppSdkSessionTokens } from './appSdkSession.ts';
export {
  readAppSdkSessionTokens,
  resolveAppSdkAccessToken,
} from './appSdkSession.ts';

export interface AppSdkClientConfig extends SdkworkAppConfig {
  env: AppRuntimeEnv;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_DEV_BASE_URL = 'https://api-dev.sdkwork.com';
const DEFAULT_TEST_BASE_URL = 'https://api-test.sdkwork.com';
const DEFAULT_PROD_BASE_URL = 'https://api.sdkwork.com';

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

function parseTimeout(value?: string, fallback = DEFAULT_TIMEOUT): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveDefaultBaseUrl(env: AppRuntimeEnv): string {
  if (env === 'production') {
    return DEFAULT_PROD_BASE_URL;
  }

  if (env === 'test') {
    return DEFAULT_TEST_BASE_URL;
  }

  return DEFAULT_DEV_BASE_URL;
}

function normalizeBaseUrl(baseUrl?: string, env: AppRuntimeEnv = 'development'): string {
  const safe = (baseUrl || resolveDefaultBaseUrl(env)).trim();
  return safe.replace(/\/+$/g, '');
}

function applySessionTokensToClient(client: SdkworkAppClient, tokens: AppSdkSessionTokens): void {
  client.setAuthToken(normalizeAppSdkAuthToken(tokens.authToken));
  client.setAccessToken((tokens.accessToken ?? resolveAppSdkAccessToken()).trim());
}

export function createAppSdkClientConfig(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClientConfig {
  const env = APP_ENV.appEnv;

  return {
    env,
    baseUrl: normalizeBaseUrl(
      firstDefined(overrides.baseUrl, APP_ENV.api.baseUrl),
      env,
    ),
    timeout: overrides.timeout ?? APP_ENV.api.timeout ?? DEFAULT_TIMEOUT,
    apiKey: overrides.apiKey ?? firstDefined(readEnv('VITE_API_KEY')),
    authToken: overrides.authToken,
    accessToken: overrides.accessToken ?? APP_ENV.auth.accessToken,
    tenantId: overrides.tenantId ?? firstDefined(readEnv('VITE_TENANT_ID')),
    organizationId: overrides.organizationId ?? firstDefined(readEnv('VITE_ORGANIZATION_ID')),
    platform: overrides.platform ?? APP_ENV.platform.id ?? 'web',
    tokenManager: overrides.tokenManager,
    authMode: overrides.authMode,
    headers: overrides.headers,
  };
}

export function initAppSdkClient(overrides: Partial<SdkworkAppConfig> = {}): SdkworkAppClient {
  appSdkConfig = createAppSdkClientConfig(overrides);
  setConfiguredAppSdkAccessToken(appSdkConfig.accessToken);
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

export function resetAppSdkClient(): void {
  appSdkClient = null;
  appSdkConfig = null;
  resetConfiguredAppSdkAccessToken();
}

export function applyAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  const client = getAppSdkClient();
  applySessionTokensToClient(client, tokens);
}

export function persistAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  const authToken = normalizeAppSdkAuthToken(tokens.authToken);
  const refreshToken = (tokens.refreshToken || '').trim();
  const accessToken = (tokens.accessToken ?? resolveAppSdkAccessToken()).trim();

  persistAppSdkSessionStorage({
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
  clearAppSdkSessionStorage();
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
