import { getApiRouterPlatform } from '@sdkwork/claw-infrastructure';
import type {
  ProxyProviderGroup,
  ProxyProviderStatus,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeyUpdate,
} from '@sdkwork/claw-types';

export interface GetUnifiedApiKeysParams {
  keyword?: string;
  groupId?: string;
}

export interface UnifiedApiKeyService {
  getGroups(): Promise<ProxyProviderGroup[]>;
  getUnifiedApiKeys(params?: GetUnifiedApiKeysParams): Promise<UnifiedApiKey[]>;
  createUnifiedApiKey(input: UnifiedApiKeyCreate): Promise<UnifiedApiKey>;
  updateGroup(id: string, groupId: string): Promise<UnifiedApiKey>;
  updateStatus(id: string, status: ProxyProviderStatus): Promise<UnifiedApiKey>;
  assignModelMapping(id: string, modelMappingId: string | null): Promise<UnifiedApiKey>;
  updateUnifiedApiKey(id: string, update: UnifiedApiKeyUpdate): Promise<UnifiedApiKey>;
  deleteUnifiedApiKey(id: string): Promise<boolean>;
}

class DefaultUnifiedApiKeyService implements UnifiedApiKeyService {
  async getGroups() {
    return getApiRouterPlatform().getGroups();
  }

  async getUnifiedApiKeys(params: GetUnifiedApiKeysParams = {}) {
    return getApiRouterPlatform().getUnifiedApiKeys(params);
  }

  async createUnifiedApiKey(input: UnifiedApiKeyCreate) {
    return getApiRouterPlatform().createUnifiedApiKey(input);
  }

  async updateGroup(id: string, groupId: string) {
    return getApiRouterPlatform().updateUnifiedApiKeyGroup(id, groupId);
  }

  async updateStatus(id: string, status: ProxyProviderStatus) {
    return getApiRouterPlatform().updateUnifiedApiKeyStatus(id, status);
  }

  async assignModelMapping(id: string, modelMappingId: string | null) {
    return getApiRouterPlatform().assignUnifiedApiKeyModelMapping(id, modelMappingId);
  }

  async updateUnifiedApiKey(id: string, update: UnifiedApiKeyUpdate) {
    return getApiRouterPlatform().updateUnifiedApiKey(id, update);
  }

  async deleteUnifiedApiKey(id: string) {
    return getApiRouterPlatform().deleteUnifiedApiKey(id);
  }
}

export const unifiedApiKeyService = new DefaultUnifiedApiKeyService();
