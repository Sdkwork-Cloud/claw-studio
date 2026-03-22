import { APP_ENV, type AppEnvConfig } from '../config/env.ts';
import {
  clearApiRouterAdminSession,
  ensureApiRouterAdminSessionToken,
  type ApiRouterAdminSession,
  writeApiRouterAdminSession,
} from '../auth/apiRouterAdminSession.ts';
import { resolveApiRouterResolvedEndpoints } from './sdkworkApiRouterAccess.ts';

export interface ApiRouterAdminLoginRequest {
  email: string;
  password: string;
}

export interface ApiRouterAdminClaimsDto {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface ApiRouterAdminUserProfileDto {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  created_at_ms: number;
}

export interface ApiRouterAdminLoginResponseDto {
  token: string;
  claims: ApiRouterAdminClaimsDto;
  user: ApiRouterAdminUserProfileDto;
}

export interface ApiRouterAdminUserProfile {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  createdAtMs: number;
}

export interface ApiRouterTenantDto {
  id: string;
  name: string;
}

export interface ApiRouterProjectDto {
  tenant_id: string;
  id: string;
  name: string;
}

export interface ApiRouterChannelDto {
  id: string;
  name: string;
}

export interface ApiRouterProviderChannelBindingDto {
  provider_id: string;
  channel_id: string;
  is_primary: boolean;
}

export interface ApiRouterProviderDto {
  id: string;
  channel_id: string;
  extension_id: string;
  adapter_kind: string;
  base_url: string;
  display_name: string;
  channel_bindings?: ApiRouterProviderChannelBindingDto[];
}

export interface ApiRouterCredentialDto {
  tenant_id: string;
  provider_id: string;
  key_reference: string;
  secret_backend: string;
  secret_local_file?: string | null;
  secret_keyring_service?: string | null;
  secret_master_key_id?: string | null;
}

export interface ApiRouterModelDto {
  external_name: string;
  provider_id: string;
  capabilities: string[];
  streaming: boolean;
  context_window?: number | null;
}

export interface ApiRouterProviderHealthSnapshotDto {
  provider_id: string;
  extension_id: string;
  runtime: string;
  observed_at_ms: number;
  instance_id?: string | null;
  running: boolean;
  healthy: boolean;
  message?: string | null;
}

export interface ApiRouterCreateTenantRequest {
  id: string;
  name: string;
}

export interface ApiRouterCreateProjectRequest {
  tenant_id: string;
  id: string;
  name: string;
}

export interface ApiRouterCreateChannelRequest {
  id: string;
  name: string;
}

export interface ApiRouterCreateProviderChannelBindingRequest {
  channel_id: string;
  is_primary?: boolean;
}

export interface ApiRouterCreateProviderRequest {
  id: string;
  channel_id: string;
  extension_id?: string;
  channel_bindings?: ApiRouterCreateProviderChannelBindingRequest[];
  adapter_kind: string;
  base_url: string;
  display_name: string;
}

export interface ApiRouterCreateCredentialRequest {
  tenant_id: string;
  provider_id: string;
  key_reference: string;
  secret_value: string;
}

export interface ApiRouterCreateModelRequest {
  external_name: string;
  provider_id: string;
  capabilities?: string[];
  streaming?: boolean;
  context_window?: number | null;
}

export interface ApiRouterGatewayApiKeyRecordDto {
  tenant_id: string;
  project_id: string;
  environment: string;
  hashed_key: string;
  plaintext?: string | null;
  plaintext_key?: string | null;
  label: string;
  notes?: string | null;
  source?: string | null;
  created_at_ms: number;
  last_used_at_ms?: number | null;
  expires_at_ms?: number | null;
  active: boolean;
}

export interface ApiRouterCreateApiKeyRequest {
  tenant_id: string;
  project_id: string;
  environment: string;
  label?: string;
  expires_at_ms?: number | null;
  notes?: string | null;
  plaintext_key?: string;
  source?: string;
}

export interface ApiRouterCreatedGatewayApiKeyDto {
  plaintext: string;
  hashed: string;
  tenant_id: string;
  project_id: string;
  environment: string;
  label: string;
  notes?: string | null;
  source?: string | null;
  created_at_ms: number;
  expires_at_ms?: number | null;
}

export interface ApiRouterUpdateApiKeyRequest {
  tenant_id?: string;
  project_id?: string;
  environment?: string;
  label?: string;
  expires_at_ms?: number | null;
  notes?: string | null;
  source?: string | null;
}

export interface ApiRouterUpdateApiKeyStatusRequest {
  active: boolean;
}

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

export interface ApiRouterAdminClientRequestOptions {
  baseUrl?: string;
  env?: AppEnvConfig;
  requireAuth?: boolean;
}

function mapAdminUserProfile(
  value: ApiRouterAdminUserProfileDto,
): ApiRouterAdminUserProfile {
  return {
    id: value.id,
    email: value.email,
    displayName: value.display_name,
    active: value.active,
    createdAtMs: value.created_at_ms,
  };
}

export async function resolveApiRouterAdminBaseUrl(
  options: Pick<ApiRouterAdminClientRequestOptions, 'baseUrl' | 'env'> = {},
) {
  return (
    await resolveApiRouterResolvedEndpoints({
      adminBaseUrl: options.baseUrl,
      env: options.env,
    })
  ).adminBaseUrl;
}

export async function resolveApiRouterGatewayBaseUrl(
  options: Pick<ApiRouterAdminClientRequestOptions, 'baseUrl' | 'env'> = {},
) {
  return (
    await resolveApiRouterResolvedEndpoints({
      gatewayBaseUrl: options.baseUrl,
      env: options.env,
    })
  ).gatewayBaseUrl;
}

async function readResponseJson<T>(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null as T | null;
  }

  return (await response.json()) as T;
}

function isAuthResponseStatus(status: number) {
  return status === 401 || status === 403;
}

async function performApiRouterAdminFetch(
  baseUrl: string,
  path: string,
  options: ApiRouterAdminClientRequestOptions & {
    method?: string;
    bodyJson?: unknown;
  },
  env: AppEnvConfig,
  requestToken: string,
) {
  const headers = new Headers({
    Accept: 'application/json',
    ...(options.bodyJson !== undefined
      ? {
          'Content-Type': 'application/json',
        }
      : {}),
  });

  if (options.requireAuth !== false && requestToken) {
    headers.set('Authorization', `Bearer ${requestToken}`);
  }

  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : undefined,
    signal: AbortSignal.timeout(env.api.timeout),
  });
}

async function refreshManagedBootstrapToken(requestToken: string) {
  clearApiRouterAdminSession();
  const retryToken = await ensureApiRouterAdminSessionToken({ forceBootstrap: true });
  if (!retryToken || retryToken === requestToken) {
    return '';
  }

  return retryToken;
}

async function requestApiRouterAdmin<T>(
  path: string,
  options: ApiRouterAdminClientRequestOptions & {
    method?: string;
    bodyJson?: unknown;
  } = {},
): Promise<T> {
  const env = options.env ?? APP_ENV;
  const { adminBaseUrl: baseUrl } = await resolveApiRouterResolvedEndpoints({
    adminBaseUrl: options.baseUrl,
    env,
  });
  let requestToken =
    options.requireAuth === false
      ? ''
      : (await ensureApiRouterAdminSessionToken()) || env.apiRouter.adminToken;
  let response = await performApiRouterAdminFetch(
    baseUrl,
    path,
    options,
    env,
    requestToken,
  );
  let payload = await readResponseJson<{
    error?: {
      message?: string;
    };
    message?: string;
  }>(response);

  if (!response.ok && options.requireAuth !== false && isAuthResponseStatus(response.status)) {
    const retryToken = await refreshManagedBootstrapToken(requestToken);
    if (retryToken) {
      requestToken = retryToken;
      response = await performApiRouterAdminFetch(
        baseUrl,
        path,
        options,
        env,
        requestToken,
      );
      payload = await readResponseJson<{
        error?: {
          message?: string;
        };
        message?: string;
      }>(response);
    }
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `sdkwork-api-router admin request failed: ${response.status} ${response.statusText}`,
    );
  }

  return payload as T;
}

class SdkworkApiRouterAdminClient {
  async login(
    request: ApiRouterAdminLoginRequest,
    options: Pick<ApiRouterAdminClientRequestOptions, 'baseUrl' | 'env'> = {},
  ): Promise<ApiRouterAdminSession> {
    const response = await requestApiRouterAdmin<ApiRouterAdminLoginResponseDto>('/auth/login', {
      ...options,
      method: 'POST',
      requireAuth: false,
      bodyJson: request,
    });

    const session: ApiRouterAdminSession = {
      token: response.token,
      user: mapAdminUserProfile(response.user),
    };
    writeApiRouterAdminSession(session);
    return session;
  }

  async getMe(options: ApiRouterAdminClientRequestOptions = {}): Promise<ApiRouterAdminUserProfile> {
    const profile = await requestApiRouterAdmin<ApiRouterAdminUserProfileDto>('/auth/me', options);
    return mapAdminUserProfile(profile);
  }

  async logout() {
    clearApiRouterAdminSession();
  }

  async listTenants(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterTenantDto[]>('/tenants', options);
  }

  async createTenant(
    request: ApiRouterCreateTenantRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterTenantDto>('/tenants', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async listProjects(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterProjectDto[]>('/projects', options);
  }

  async createProject(
    request: ApiRouterCreateProjectRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterProjectDto>('/projects', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async listChannels(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterChannelDto[]>('/channels', options);
  }

  async createChannel(
    request: ApiRouterCreateChannelRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterChannelDto>('/channels', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async deleteChannel(
    channelId: string,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    await requestApiRouterAdmin<void>(`/channels/${channelId}`, {
      ...options,
      method: 'DELETE',
    });
    return true;
  }

  async listProviders(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterProviderDto[]>('/providers', options);
  }

  async createProvider(
    request: ApiRouterCreateProviderRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterProviderDto>('/providers', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async deleteProvider(
    providerId: string,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    await requestApiRouterAdmin<void>(`/providers/${providerId}`, {
      ...options,
      method: 'DELETE',
    });
    return true;
  }

  async listCredentials(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterCredentialDto[]>('/credentials', options);
  }

  async createCredential(
    request: ApiRouterCreateCredentialRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterCredentialDto>('/credentials', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async deleteCredential(
    tenantId: string,
    providerId: string,
    keyReference: string,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    await requestApiRouterAdmin<void>(
      `/credentials/${tenantId}/providers/${providerId}/keys/${keyReference}`,
      {
        ...options,
        method: 'DELETE',
      },
    );
    return true;
  }

  async listModels(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterModelDto[]>('/models', options);
  }

  async listProviderHealthSnapshots(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterProviderHealthSnapshotDto[]>(
      '/routing/health-snapshots',
      options,
    );
  }

  async createModel(
    request: ApiRouterCreateModelRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterModelDto>('/models', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async deleteModel(
    externalName: string,
    providerId: string,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    await requestApiRouterAdmin<void>(`/models/${externalName}/providers/${providerId}`, {
      ...options,
      method: 'DELETE',
    });
    return true;
  }

  async listApiKeys(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterGatewayApiKeyRecordDto[]>('/api-keys', options);
  }

  async createApiKey(
    request: ApiRouterCreateApiKeyRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterCreatedGatewayApiKeyDto>('/api-keys', {
      ...options,
      method: 'POST',
      bodyJson: request,
    });
  }

  async updateApiKey(
    hashedKey: string,
    request: ApiRouterUpdateApiKeyRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterGatewayApiKeyRecordDto>(`/api-keys/${hashedKey}`, {
      ...options,
      method: 'PUT',
      bodyJson: request,
    });
  }

  async updateApiKeyStatus(
    hashedKey: string,
    request: ApiRouterUpdateApiKeyStatusRequest,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    return requestApiRouterAdmin<ApiRouterGatewayApiKeyRecordDto>(
      `/api-keys/${hashedKey}/status`,
      {
        ...options,
        method: 'POST',
        bodyJson: request,
      },
    );
  }

  async deleteApiKey(
    hashedKey: string,
    options: ApiRouterAdminClientRequestOptions = {},
  ) {
    await requestApiRouterAdmin<void>(`/api-keys/${hashedKey}`, {
      ...options,
      method: 'DELETE',
    });
    return true;
  }

  async listUsageRecords(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterUsageRecordDto[]>('/admin/usage/records', options);
  }

  async getUsageSummary(options: ApiRouterAdminClientRequestOptions = {}) {
    return requestApiRouterAdmin<ApiRouterUsageSummaryDto>('/admin/usage/summary', options);
  }
}

export const sdkworkApiRouterAdminClient = new SdkworkApiRouterAdminClient();
