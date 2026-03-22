import {
  getApiRouterPlatform,
  type ApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterChannel,
  ApiRouterUsageRecordApiKeyOption,
  ApiRouterUsageRecordSummary,
  ApiRouterUsageRecordsQuery,
  ApiRouterUsageRecordsResult,
  ProxyProviderCreate,
  ProxyProvider,
  ProxyProviderGroup,
  ProxyProviderStatus,
  ProxyProviderUpdate,
} from '@sdkwork/claw-types';

export interface GetProxyProvidersParams {
  channelId?: string;
  keyword?: string;
  groupId?: string;
}

export interface ApiRouterService {
  getRuntimeStatus(): Promise<ApiRouterRuntimeStatus>;
  getChannels(): Promise<ApiRouterChannel[]>;
  getGroups(): Promise<ProxyProviderGroup[]>;
  getProxyProviders(params?: GetProxyProvidersParams): Promise<ProxyProvider[]>;
  createProvider(input: ProxyProviderCreate): Promise<ProxyProvider>;
  updateGroup(id: string, groupId: string): Promise<ProxyProvider>;
  updateStatus(id: string, status: ProxyProviderStatus): Promise<ProxyProvider>;
  updateProvider(id: string, update: ProxyProviderUpdate): Promise<ProxyProvider>;
  deleteProvider(id: string): Promise<boolean>;
  getUsageRecordApiKeys(): Promise<ApiRouterUsageRecordApiKeyOption[]>;
  getUsageRecordSummary(query?: ApiRouterUsageRecordsQuery): Promise<ApiRouterUsageRecordSummary>;
  getUsageRecords(query?: ApiRouterUsageRecordsQuery): Promise<ApiRouterUsageRecordsResult>;
}

class DefaultApiRouterService implements ApiRouterService {
  async getRuntimeStatus() {
    return getApiRouterPlatform().getRuntimeStatus();
  }

  async getChannels() {
    return getApiRouterPlatform().getChannels();
  }

  async getGroups() {
    return getApiRouterPlatform().getGroups();
  }

  async getProxyProviders(params: GetProxyProvidersParams = {}) {
    return getApiRouterPlatform().getProxyProviders(params);
  }

  async createProvider(input: ProxyProviderCreate) {
    return getApiRouterPlatform().createProxyProvider(input);
  }

  async updateGroup(id: string, groupId: string) {
    return getApiRouterPlatform().updateProxyProviderGroup(id, groupId);
  }

  async updateStatus(id: string, status: ProxyProviderStatus) {
    return getApiRouterPlatform().updateProxyProviderStatus(id, status);
  }

  async updateProvider(id: string, update: ProxyProviderUpdate) {
    return getApiRouterPlatform().updateProxyProvider(id, update);
  }

  async deleteProvider(id: string) {
    return getApiRouterPlatform().deleteProxyProvider(id);
  }

  async getUsageRecordApiKeys() {
    return getApiRouterPlatform().getUsageRecordApiKeys();
  }

  async getUsageRecordSummary(query: ApiRouterUsageRecordsQuery = {}) {
    return getApiRouterPlatform().getUsageRecordSummary(query);
  }

  async getUsageRecords(query: ApiRouterUsageRecordsQuery = {}) {
    return getApiRouterPlatform().getUsageRecords(query);
  }
}

export const apiRouterService = new DefaultApiRouterService();
