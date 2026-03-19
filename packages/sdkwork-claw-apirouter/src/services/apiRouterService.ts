import { studioMockService } from '@sdkwork/claw-infrastructure';
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

function matchesKeyword(provider: ProxyProvider, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return (
    provider.name.toLowerCase().includes(normalizedKeyword) ||
    provider.baseUrl.toLowerCase().includes(normalizedKeyword) ||
    provider.models.some(
      (model) =>
        model.id.toLowerCase().includes(normalizedKeyword) ||
        model.name.toLowerCase().includes(normalizedKeyword),
    )
  );
}

async function requireProvider(
  provider: Promise<ProxyProvider | undefined>,
  errorMessage: string,
) {
  const resolvedProvider = await provider;
  if (!resolvedProvider) {
    throw new Error(errorMessage);
  }

  return resolvedProvider;
}

class DefaultApiRouterService implements ApiRouterService {
  async getChannels() {
    return studioMockService.listApiRouterChannels();
  }

  async getGroups() {
    return studioMockService.listProxyProviderGroups();
  }

  async getProxyProviders(params: GetProxyProvidersParams = {}) {
    const providers = await studioMockService.listProxyProviders(params.channelId);

    return providers.filter((provider) => {
      if (params.groupId && params.groupId !== 'all' && provider.groupId !== params.groupId) {
        return false;
      }

      if (params.keyword && !matchesKeyword(provider, params.keyword)) {
        return false;
      }

      return true;
    });
  }

  async createProvider(input: ProxyProviderCreate) {
    return studioMockService.createProxyProvider(input);
  }

  async updateGroup(id: string, groupId: string) {
    return requireProvider(
      studioMockService.updateProxyProviderGroup(id, groupId),
      'Proxy provider not found',
    );
  }

  async updateStatus(id: string, status: ProxyProviderStatus) {
    return requireProvider(
      studioMockService.updateProxyProviderStatus(id, status),
      'Proxy provider not found',
    );
  }

  async updateProvider(id: string, update: ProxyProviderUpdate) {
    return requireProvider(
      studioMockService.updateProxyProvider(id, update),
      'Proxy provider not found',
    );
  }

  async deleteProvider(id: string) {
    return studioMockService.deleteProxyProvider(id);
  }

  async getUsageRecordApiKeys() {
    return studioMockService.listApiRouterUsageRecordApiKeys();
  }

  async getUsageRecordSummary(query: ApiRouterUsageRecordsQuery = {}) {
    return studioMockService.getApiRouterUsageRecordSummary(query);
  }

  async getUsageRecords(query: ApiRouterUsageRecordsQuery = {}) {
    return studioMockService.listApiRouterUsageRecords(query);
  }
}

export const apiRouterService = new DefaultApiRouterService();
