import { studioMockService } from '@sdkwork/claw-infrastructure';
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

function matchesKeyword(item: UnifiedApiKey, keyword: string) {
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

async function requireUnifiedApiKey(
  item: Promise<UnifiedApiKey | undefined>,
  errorMessage: string,
) {
  const resolvedItem = await item;
  if (!resolvedItem) {
    throw new Error(errorMessage);
  }

  return resolvedItem;
}

class DefaultUnifiedApiKeyService implements UnifiedApiKeyService {
  async getGroups() {
    return studioMockService.listProxyProviderGroups();
  }

  async getUnifiedApiKeys(params: GetUnifiedApiKeysParams = {}) {
    const items = await studioMockService.listUnifiedApiKeys();

    return items.filter((item) => {
      if (params.groupId && params.groupId !== 'all' && item.groupId !== params.groupId) {
        return false;
      }

      if (params.keyword && !matchesKeyword(item, params.keyword)) {
        return false;
      }

      return true;
    });
  }

  async createUnifiedApiKey(input: UnifiedApiKeyCreate) {
    return studioMockService.createUnifiedApiKey(input);
  }

  async updateGroup(id: string, groupId: string) {
    return requireUnifiedApiKey(
      studioMockService.updateUnifiedApiKeyGroup(id, groupId),
      'Unified API key not found',
    );
  }

  async updateStatus(id: string, status: ProxyProviderStatus) {
    return requireUnifiedApiKey(
      studioMockService.updateUnifiedApiKeyStatus(id, status),
      'Unified API key not found',
    );
  }

  async assignModelMapping(id: string, modelMappingId: string | null) {
    return requireUnifiedApiKey(
      studioMockService.assignUnifiedApiKeyModelMapping(id, modelMappingId),
      'Unified API key not found',
    );
  }

  async updateUnifiedApiKey(id: string, update: UnifiedApiKeyUpdate) {
    return requireUnifiedApiKey(
      studioMockService.updateUnifiedApiKey(id, update),
      'Unified API key not found',
    );
  }

  async deleteUnifiedApiKey(id: string) {
    return studioMockService.deleteUnifiedApiKey(id);
  }
}

export const unifiedApiKeyService = new DefaultUnifiedApiKeyService();
