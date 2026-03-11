import { getApiUrl, readAccessToken, type AppEnvConfig, APP_ENV } from '../config/env.ts';
import { postJson } from '../http/httpClient.ts';
import type {
  AppInstallPackage,
  AppUpdateCheckRequest,
  AppUpdateCheckResult,
  AppUpdateClientOptions,
} from './contracts.ts';

interface ApiResult<T> {
  code?: number;
  message?: string;
  data?: T | null;
}

const APP_UPDATE_CHECK_PATH = '/app/v3/api/update/check';

function resolveEnv(options?: AppUpdateClientOptions): AppEnvConfig {
  return (options?.env as AppEnvConfig | undefined) ?? APP_ENV;
}

function mapInstallPackage(value: unknown): AppInstallPackage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as AppInstallPackage;
}

function mapUpdateCheckResult(value: unknown): AppUpdateCheckResult {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  return {
    hasUpdate: payload.hasUpdate === true,
    updateRequired: payload.updateRequired === true,
    forceUpdate: payload.forceUpdate === true,
    currentVersion: typeof payload.currentVersion === 'string' ? payload.currentVersion : '',
    targetVersion: typeof payload.targetVersion === 'string' ? payload.targetVersion : '',
    releaseChannel: typeof payload.releaseChannel === 'string' ? payload.releaseChannel : undefined,
    updateMode: typeof payload.updateMode === 'string' ? payload.updateMode : undefined,
    deliveryType: typeof payload.deliveryType === 'string' ? payload.deliveryType : undefined,
    updateUrl: typeof payload.updateUrl === 'string' ? payload.updateUrl : undefined,
    title: typeof payload.title === 'string' ? payload.title : undefined,
    summary: typeof payload.summary === 'string' ? payload.summary : undefined,
    content: typeof payload.content === 'string' ? payload.content : undefined,
    highlights: Array.isArray(payload.highlights)
      ? payload.highlights.filter((item): item is string => typeof item === 'string')
      : [],
    sizeBytes: typeof payload.sizeBytes === 'number' ? payload.sizeBytes : undefined,
    publishedAt: typeof payload.publishedAt === 'string' ? payload.publishedAt : undefined,
    resolvedPackage: mapInstallPackage(payload.resolvedPackage),
    storeUrl: typeof payload.storeUrl === 'string' ? payload.storeUrl : undefined,
    storeType: typeof payload.storeType === 'string' ? payload.storeType : undefined,
    frameworkPayload:
      payload.frameworkPayload && typeof payload.frameworkPayload === 'object'
        ? (payload.frameworkPayload as Record<string, unknown>)
        : null,
  };
}

export async function checkAppUpdate(
  request: AppUpdateCheckRequest,
  options?: AppUpdateClientOptions,
): Promise<AppUpdateCheckResult> {
  const env = resolveEnv(options);
  const url = getApiUrl(APP_UPDATE_CHECK_PATH, env);
  const accessToken = readAccessToken(env);
  const headers: Record<string, string> = {};

  if (!url || url === APP_UPDATE_CHECK_PATH) {
    throw new Error('App update check is unavailable because VITE_API_BASE_URL is not configured.');
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await postJson<ApiResult<unknown>>(url, request, {
    headers,
    signal: AbortSignal.timeout(env.api.timeout),
  });

  if (!response || typeof response !== 'object') {
    throw new Error('App update check failed because the backend returned an invalid response.');
  }

  if (response.code !== undefined && response.code !== 0) {
    throw new Error(response.message || 'App update check failed.');
  }

  return mapUpdateCheckResult(response.data);
}

export { APP_UPDATE_CHECK_PATH };
