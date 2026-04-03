import { useMemo } from 'react';
import type { SdkworkAppClient, SdkworkAppConfig } from '@sdkwork/app-sdk';
import {
  applyAppClientSessionTokens,
  createAppClientConfigFromEnv,
  getAppClient,
  getAppClientConfig,
  getAppClientWithSession,
  initAppClient,
  resolveAppClientAccessToken,
} from '@sdkwork/core-pc-react/app';
import { readPcReactEnvSource } from '@sdkwork/core-pc-react/env';
import {
  clearPcReactRuntimeSession,
  configurePcReactRuntime,
  persistPcReactRuntimeSession,
  readPcReactRuntimeSession,
  resetPcReactRuntime,
} from '@sdkwork/core-pc-react/runtime';

export type AppRuntimeEnv = 'development' | 'staging' | 'production' | 'test';

export interface AppSdkClientConfig extends SdkworkAppConfig {
  env: AppRuntimeEnv;
}

export interface AppSdkSessionTokens {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export const APP_SDK_SESSION_STORAGE_KEY = 'claw-studio-auth-session';

let runtimeConfigured = false;

function ensureConfigured(): void {
  if (runtimeConfigured) {
    return;
  }

  configurePcReactRuntime({
    legacyStorageKeys: {
      runtimeSession: [APP_SDK_SESSION_STORAGE_KEY],
    },
  });
  runtimeConfigured = true;
}

export function createAppSdkClientConfig(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClientConfig {
  return createAppClientConfigFromEnv(readPcReactEnvSource(), overrides) as AppSdkClientConfig;
}

export function initAppSdkClient(overrides: Partial<SdkworkAppConfig> = {}): SdkworkAppClient {
  ensureConfigured();
  return initAppClient(overrides);
}

export function getAppSdkClient(): SdkworkAppClient {
  ensureConfigured();
  return getAppClient();
}

export function getAppSdkClientConfig(): AppSdkClientConfig | null {
  return getAppClientConfig() as AppSdkClientConfig | null;
}

export function resolveAppSdkAccessToken(): string {
  ensureConfigured();
  return resolveAppClientAccessToken();
}

export function resetAppSdkClient(): void {
  resetPcReactRuntime({
    clearStorage: false,
    clearConfiguration: false,
  });
  runtimeConfigured = false;
}

export function applyAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  ensureConfigured();
  applyAppClientSessionTokens(tokens);
}

export function readAppSdkSessionTokens(): AppSdkSessionTokens {
  const session = readPcReactRuntimeSession();

  return {
    authToken: session.authToken,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
}

export function persistAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  ensureConfigured();
  persistPcReactRuntimeSession(tokens);
}

export function clearAppSdkSessionTokens(): void {
  ensureConfigured();
  void clearPcReactRuntimeSession();
}

export function getAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): SdkworkAppClient {
  ensureConfigured();
  return Object.keys(overrides).length > 0
    ? getAppClientWithSession(overrides)
    : getAppClientWithSession();
}

export function useAppSdkClient(
  overrides: Partial<SdkworkAppConfig> = {},
): SdkworkAppClient {
  const key = JSON.stringify(overrides || {});
  return useMemo(() => getAppSdkClientWithSession(overrides), [key]);
}
