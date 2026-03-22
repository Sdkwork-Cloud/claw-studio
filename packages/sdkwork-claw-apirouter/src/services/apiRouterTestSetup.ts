import {
  configurePlatformBridge,
  studioMockService,
  type ApiRouterPlatformAPI,
  type ApiRouterProviderQuery,
  type ApiRouterRuntimeStatus,
  type ApiRouterUnifiedApiKeyQuery,
  type ApiRouterModelMappingQuery,
} from '@sdkwork/claw-infrastructure';
import type {
  ModelMapping,
  ProxyProvider,
  UnifiedApiKey,
} from '@sdkwork/claw-types';

const TEST_RUNTIME_STATUS: ApiRouterRuntimeStatus = {
  ownership: 'managed',
  routerHomeDir: 'C:/Users/test/.sdkwork/router',
  metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
  databasePath: 'C:/Users/test/.sdkwork/router/sdkwork-api-server.db',
  extractionDir: 'C:/Users/test/AppData/Local/Claw/router/1.0.0/windows-x64',
  adminBaseUrl: 'http://127.0.0.1:18081/admin',
  gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
  adminHealthy: true,
  gatewayHealthy: true,
  authSessionReady: true,
  adminAuthReady: true,
  adminPid: 18081,
  gatewayPid: 18080,
};

function matchesProxyProviderKeyword(provider: ProxyProvider, keyword: string) {
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

function matchesUnifiedApiKeyKeyword(item: UnifiedApiKey, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(normalizedKeyword) ||
    item.apiKey.toLowerCase().includes(normalizedKeyword) ||
    item.notes?.toLowerCase().includes(normalizedKeyword) === true
  );
}

function matchesModelMappingKeyword(item: ModelMapping, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return [
    item.name,
    item.description,
    ...item.rules.flatMap((rule) => [
      rule.source.channelName,
      rule.source.modelId,
      rule.source.modelName,
      rule.target.channelName,
      rule.target.modelId,
      rule.target.modelName,
    ]),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

async function requireValue<T>(
  value: Promise<T | undefined>,
  errorMessage: string,
): Promise<T> {
  const resolved = await value;
  if (!resolved) {
    throw new Error(errorMessage);
  }

  return resolved;
}

function createApiRouterTestPlatform(): ApiRouterPlatformAPI {
  return {
    async getRuntimeStatus() {
      return TEST_RUNTIME_STATUS;
    },
    async getChannels() {
      return studioMockService.listApiRouterChannels();
    },
    async getGroups() {
      return studioMockService.listProxyProviderGroups();
    },
    async getProxyProviders(query: ApiRouterProviderQuery = {}) {
      const providers = await studioMockService.listProxyProviders(query.channelId);
      return providers.filter((provider) => {
        if (query.groupId && query.groupId !== 'all' && provider.groupId !== query.groupId) {
          return false;
        }

        if (query.keyword && !matchesProxyProviderKeyword(provider, query.keyword)) {
          return false;
        }

        return true;
      });
    },
    async createProxyProvider(input) {
      return studioMockService.createProxyProvider(input);
    },
    async updateProxyProviderGroup(id, groupId) {
      return requireValue(
        studioMockService.updateProxyProviderGroup(id, groupId),
        'Proxy provider not found',
      );
    },
    async updateProxyProviderStatus(id, status) {
      return requireValue(
        studioMockService.updateProxyProviderStatus(id, status),
        'Proxy provider not found',
      );
    },
    async updateProxyProvider(id, update) {
      return requireValue(
        studioMockService.updateProxyProvider(id, update),
        'Proxy provider not found',
      );
    },
    async deleteProxyProvider(id) {
      return studioMockService.deleteProxyProvider(id);
    },
    async getUsageRecordApiKeys() {
      return studioMockService.listApiRouterUsageRecordApiKeys();
    },
    async getUsageRecordSummary(query = {}) {
      return studioMockService.getApiRouterUsageRecordSummary(query);
    },
    async getUsageRecords(query = {}) {
      return studioMockService.listApiRouterUsageRecords(query);
    },
    async getUnifiedApiKeys(query: ApiRouterUnifiedApiKeyQuery = {}) {
      const items = await studioMockService.listUnifiedApiKeys();
      return items.filter((item) => {
        if (query.groupId && query.groupId !== 'all' && item.groupId !== query.groupId) {
          return false;
        }

        if (query.keyword && !matchesUnifiedApiKeyKeyword(item, query.keyword)) {
          return false;
        }

        return true;
      });
    },
    async createUnifiedApiKey(input) {
      return studioMockService.createUnifiedApiKey(input);
    },
    async updateUnifiedApiKeyGroup(id, groupId) {
      return requireValue(
        studioMockService.updateUnifiedApiKeyGroup(id, groupId),
        'Unified API key not found',
      );
    },
    async updateUnifiedApiKeyStatus(id, status) {
      return requireValue(
        studioMockService.updateUnifiedApiKeyStatus(id, status),
        'Unified API key not found',
      );
    },
    async assignUnifiedApiKeyModelMapping(id, modelMappingId) {
      return requireValue(
        studioMockService.assignUnifiedApiKeyModelMapping(id, modelMappingId),
        'Unified API key not found',
      );
    },
    async updateUnifiedApiKey(id, update) {
      return requireValue(
        studioMockService.updateUnifiedApiKey(id, update),
        'Unified API key not found',
      );
    },
    async deleteUnifiedApiKey(id) {
      return studioMockService.deleteUnifiedApiKey(id);
    },
    async getModelCatalog() {
      return studioMockService.listModelMappingCatalog();
    },
    async getModelMappings(query: ApiRouterModelMappingQuery = {}) {
      const items = await studioMockService.listModelMappings();
      return items.filter((item) =>
        query.keyword ? matchesModelMappingKeyword(item, query.keyword) : true,
      );
    },
    async createModelMapping(input) {
      return studioMockService.createModelMapping(input);
    },
    async updateModelMapping(id, update) {
      return requireValue(
        studioMockService.updateModelMapping(id, update),
        'Model mapping not found',
      );
    },
    async updateModelMappingStatus(id, status) {
      return requireValue(
        studioMockService.updateModelMappingStatus(id, status),
        'Model mapping not found',
      );
    },
    async deleteModelMapping(id) {
      return studioMockService.deleteModelMapping(id);
    },
  };
}

configurePlatformBridge({
  apiRouter: createApiRouterTestPlatform(),
});
