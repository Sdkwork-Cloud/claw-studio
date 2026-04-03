import {
  createClient,
  type AppUpdateCheckForm,
  type AppUpdateCheckVO,
  type PlusApiResultAppUpdateCheckVO,
} from '@sdkwork/app-sdk';
import { readAccessToken, type AppEnvConfig, APP_ENV } from '../config/env.ts';
import type {
  AppInstallPackage,
  AppUpdateCheckRequest,
  AppUpdateCheckResult,
  AppUpdateClientOptions,
} from './contracts.ts';

interface AppSdkResult<T> {
  code?: number | string;
  message?: string;
  msg?: string;
  data?: T | null;
}

const APP_UPDATE_CHECK_PATH = '/app/v3/api/app/update/check';

function resolveEnv(options?: AppUpdateClientOptions): AppEnvConfig {
  return (options?.env as AppEnvConfig | undefined) ?? APP_ENV;
}

function isSuccessCode(code: number | string | undefined): boolean {
  if (code === undefined || code === null) {
    return true;
  }

  const normalized = String(code).trim();
  return normalized === '0' || normalized === '200' || normalized === '2000';
}

function getEnvelopeMessage<T>(payload: AppSdkResult<T>): string {
  return String(payload.message || payload.msg || 'App update check failed.').trim();
}

function unwrapAppSdkResponse<T>(payload: AppSdkResult<T> | T | null | undefined): T {
  if (!payload || typeof payload !== 'object') {
    throw new Error('App update check failed because the backend returned an invalid response.');
  }

  if (!('code' in payload) && !('data' in payload)) {
    return payload as T;
  }

  const envelope = payload as AppSdkResult<T>;
  if (!isSuccessCode(envelope.code)) {
    throw new Error(getEnvelopeMessage(envelope));
  }

  return (envelope.data ?? null) as T;
}

function createUpdateSdkRequest(request: AppUpdateCheckRequest): AppUpdateCheckForm {
  return {
    appId: request.appId,
    runtime: request.runtime,
    platform: request.platform,
    architecture: request.architecture,
    currentVersion: request.currentVersion,
    buildNumber: request.buildNumber,
    releaseChannel: request.releaseChannel,
    packageName: request.packageName,
    bundleId: request.bundleId,
    deviceId: request.deviceId,
    osVersion: request.osVersion,
    locale: request.locale,
    capabilities: request.capabilities,
    metadata: request.metadata,
  };
}

function mapInstallPackage(value: unknown): AppInstallPackage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as AppInstallPackage;
}

function mapUpdateCheckResult(value: unknown): AppUpdateCheckResult {
  const payload = (value && typeof value === 'object' ? value : {}) as AppUpdateCheckVO &
    Record<string, unknown>;

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
  const accessToken = readAccessToken(env);

  if (!env.api.baseUrl) {
    throw new Error('App update check is unavailable because VITE_API_BASE_URL is not configured.');
  }

  const client = createClient({
    baseUrl: env.api.baseUrl,
    timeout: env.api.timeout,
  });

  if (accessToken) {
    client.setApiKey(accessToken);
  }

  const response = await client.app.checkAppUpdate(
    createUpdateSdkRequest(request),
  ) as PlusApiResultAppUpdateCheckVO;

  return mapUpdateCheckResult(
    unwrapAppSdkResponse<AppUpdateCheckVO>(response),
  );
}

export { APP_UPDATE_CHECK_PATH };
