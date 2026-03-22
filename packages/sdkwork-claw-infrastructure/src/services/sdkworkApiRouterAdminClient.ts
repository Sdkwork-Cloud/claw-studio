import { getJson } from '../http/httpClient.ts';

export interface ApiRouterUsageRecordDto {
  project_id: string;
  model: string;
  provider: string;
  units: number;
  amount: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at_ms: number;
}

export interface ApiRouterUsageProjectSummaryDto {
  project_id: string;
  request_count: number;
}

export interface ApiRouterUsageProviderSummaryDto {
  provider: string;
  request_count: number;
  project_count: number;
}

export interface ApiRouterUsageModelSummaryDto {
  model: string;
  request_count: number;
  provider_count: number;
}

export interface ApiRouterUsageSummaryDto {
  total_requests: number;
  project_count: number;
  model_count: number;
  provider_count: number;
  projects: ApiRouterUsageProjectSummaryDto[];
  providers: ApiRouterUsageProviderSummaryDto[];
  models: ApiRouterUsageModelSummaryDto[];
}

interface ImportMetaEnvLike {
  env?: Record<string, string | undefined>;
}

function readEnv(key: string) {
  return ((import.meta as ImportMetaEnvLike).env ?? {})[key]?.trim() ?? '';
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

function resolveApiRouterAdminBaseUrl() {
  const configured = trimTrailingSlash(readEnv('VITE_API_ROUTER_ADMIN_BASE_URL'));
  if (!configured) {
    throw new Error('VITE_API_ROUTER_ADMIN_BASE_URL is not configured.');
  }

  return configured;
}

function buildAuthHeaders() {
  const token = readEnv('VITE_API_ROUTER_ADMIN_TOKEN');
  if (!token) {
    return {};
  }

  return {
    Authorization: token.toLowerCase().startsWith('bearer ')
      ? token
      : `Bearer ${token}`,
  };
}

async function requestApiRouterAdmin<T>(path: string) {
  const baseUrl = resolveApiRouterAdminBaseUrl();
  return getJson<T>(`${baseUrl}${path}`, {
    headers: buildAuthHeaders(),
  });
}

class SdkworkApiRouterAdminClient {
  async listUsageRecords() {
    return requestApiRouterAdmin<ApiRouterUsageRecordDto[]>('/admin/usage/records');
  }

  async getUsageSummary() {
    return requestApiRouterAdmin<ApiRouterUsageSummaryDto>('/admin/usage/summary');
  }
}

export const sdkworkApiRouterAdminClient = new SdkworkApiRouterAdminClient();
