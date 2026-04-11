import { kernelPlatformService } from '@sdkwork/claw-core';
import type {
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyMessageLogsQuery,
  LocalAiProxyRequestLogRecord,
  LocalAiProxyRequestLogsQuery,
  PaginatedResult,
} from '@sdkwork/claw-types';

interface LocalAiProxyLogsServiceDependencies {
  kernelPlatformService: Pick<
    typeof kernelPlatformService,
    | 'getInfo'
    | 'listLocalAiProxyRequestLogs'
    | 'listLocalAiProxyMessageLogs'
    | 'updateLocalAiProxyMessageCapture'
  >;
}

export interface LocalAiProxyLogsServiceOverrides {
  kernelPlatformService?: Partial<LocalAiProxyLogsServiceDependencies['kernelPlatformService']>;
}

export interface LocalAiProxyRuntimeSummary {
  lifecycle: string;
  observabilityDbPath: string | null;
  snapshotPath: string | null;
  logPath: string | null;
}

function normalizePage(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.round(Number(value)) : fallback;
}

function normalizePageSize(value: number | undefined, fallback: number) {
  const normalized = normalizePage(value, fallback);
  return Math.max(1, Math.min(100, normalized));
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStatus(
  value: LocalAiProxyRequestLogsQuery['status'],
): Exclude<LocalAiProxyRequestLogsQuery['status'], 'all'> | undefined {
  if (value === 'succeeded' || value === 'failed') {
    return value;
  }

  return undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function resolveRuntimeSummary(
  localAiProxy:
    | {
        lifecycle?: string | null;
        observabilityDbPath?: string | null;
        snapshotPath?: string | null;
        logPath?: string | null;
      }
    | null
    | undefined,
): LocalAiProxyRuntimeSummary {
  return {
    lifecycle: normalizeOptionalText(localAiProxy?.lifecycle) ?? 'unavailable',
    observabilityDbPath: normalizeNullableText(localAiProxy?.observabilityDbPath),
    snapshotPath: normalizeNullableText(localAiProxy?.snapshotPath),
    logPath: normalizeNullableText(localAiProxy?.logPath),
  };
}

export function createLocalAiProxyLogsService(
  overrides: LocalAiProxyLogsServiceOverrides = {},
) {
  const dependencies: LocalAiProxyLogsServiceDependencies = {
    kernelPlatformService: {
      getInfo: () => kernelPlatformService.getInfo(),
      listLocalAiProxyRequestLogs: (query) =>
        kernelPlatformService.listLocalAiProxyRequestLogs(query),
      listLocalAiProxyMessageLogs: (query) =>
        kernelPlatformService.listLocalAiProxyMessageLogs(query),
      updateLocalAiProxyMessageCapture: (enabled) =>
        kernelPlatformService.updateLocalAiProxyMessageCapture(enabled),
      ...overrides.kernelPlatformService,
    },
  };

  return {
    async listRequestLogs(
      query: LocalAiProxyRequestLogsQuery,
    ): Promise<PaginatedResult<LocalAiProxyRequestLogRecord>> {
      return dependencies.kernelPlatformService.listLocalAiProxyRequestLogs(compactObject({
        page: normalizePage(query.page, 1),
        pageSize: normalizePageSize(query.pageSize, 20),
        search: normalizeOptionalText(query.search),
        providerId: normalizeOptionalText(query.providerId),
        modelId: normalizeOptionalText(query.modelId),
        routeId: normalizeOptionalText(query.routeId),
        status: normalizeStatus(query.status),
      }));
    },

    async listMessageLogs(
      query: LocalAiProxyMessageLogsQuery,
    ): Promise<PaginatedResult<LocalAiProxyMessageLogRecord>> {
      return dependencies.kernelPlatformService.listLocalAiProxyMessageLogs(compactObject({
        page: normalizePage(query.page, 1),
        pageSize: normalizePageSize(query.pageSize, 20),
        search: normalizeOptionalText(query.search),
        providerId: normalizeOptionalText(query.providerId),
        modelId: normalizeOptionalText(query.modelId),
        routeId: normalizeOptionalText(query.routeId),
      }));
    },

    async getMessageCaptureSettings(): Promise<LocalAiProxyMessageCaptureSettings> {
      const info = await dependencies.kernelPlatformService.getInfo();
      return {
        enabled: info?.localAiProxy?.messageCaptureEnabled ?? false,
        updatedAt: null,
      };
    },

    async updateMessageCaptureSettings(
      enabled: boolean,
    ): Promise<LocalAiProxyMessageCaptureSettings> {
      return dependencies.kernelPlatformService.updateLocalAiProxyMessageCapture(enabled);
    },

    async getRuntimeSummary(): Promise<LocalAiProxyRuntimeSummary> {
      const info = await dependencies.kernelPlatformService.getInfo();
      return resolveRuntimeSummary(info?.localAiProxy);
    },
  };
}

export const localAiProxyLogsService = createLocalAiProxyLogsService();
