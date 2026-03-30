import { studioMockService } from '@sdkwork/claw-infrastructure';
import type {
  ProxyProviderGroup,
  ProxyProviderStatus,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeyUpdate,
} from '@sdkwork/claw-types';
import {
  clearUnifiedApiKeyLocalOverlay,
  getUnifiedApiKeyLocalOverlay,
  updateUnifiedApiKeyLocalOverlay,
} from './apiRouterLocalOverlayStore.ts';

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

export const ROUTER_PLAINTEXT_KEY_STORAGE_KEY = 'claw-studio-router-plaintext-api-keys';

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

function filterUnifiedApiKeys(items: UnifiedApiKey[], params: GetUnifiedApiKeysParams = {}) {
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

function applyUnifiedApiKeyOverlay(item: UnifiedApiKey): UnifiedApiKey {
  const overlay = getUnifiedApiKeyLocalOverlay(item.id);

  return {
    ...item,
    modelMappingId: overlay.modelMappingId || item.modelMappingId || undefined,
    routeMode: overlay.routeMode,
    routeProviderId: overlay.routeProviderId || undefined,
  };
}

async function requireValue<T>(
  value: Promise<T | undefined>,
  errorMessage: string,
): Promise<T> {
  const resolved = await value;
  if (resolved === undefined) {
    throw new Error(errorMessage);
  }

  return resolved;
}

class DefaultUnifiedApiKeyService implements UnifiedApiKeyService {
  async getGroups() {
    return studioMockService.listProxyProviderGroups();
  }

  async getUnifiedApiKeys(params: GetUnifiedApiKeysParams = {}) {
    const items = await studioMockService.listUnifiedApiKeys();
    return filterUnifiedApiKeys(items.map(applyUnifiedApiKeyOverlay), params);
  }

  async createUnifiedApiKey(input: UnifiedApiKeyCreate) {
    const created = await studioMockService.createUnifiedApiKey(input);
    updateUnifiedApiKeyLocalOverlay(created.id, {
      modelMappingId: created.modelMappingId || null,
      routeMode: 'sdkwork-remote',
      routeProviderId: null,
    });
    return applyUnifiedApiKeyOverlay(created);
  }

  async updateGroup(id: string, groupId: string) {
    const updated = await requireValue(
      studioMockService.updateUnifiedApiKeyGroup(id, groupId),
      'Unified API key not found',
    );
    return applyUnifiedApiKeyOverlay(updated);
  }

  async updateStatus(id: string, status: ProxyProviderStatus) {
    const updated = await requireValue(
      studioMockService.updateUnifiedApiKeyStatus(id, status),
      'Unified API key not found',
    );
    return applyUnifiedApiKeyOverlay(updated);
  }

  async assignModelMapping(id: string, modelMappingId: string | null) {
    const updated = await requireValue(
      studioMockService.assignUnifiedApiKeyModelMapping(id, modelMappingId),
      'Unified API key not found',
    );
    updateUnifiedApiKeyLocalOverlay(id, {
      modelMappingId,
    });
    return applyUnifiedApiKeyOverlay(updated);
  }

  async updateUnifiedApiKey(id: string, update: UnifiedApiKeyUpdate) {
    const updated = await requireValue(
      studioMockService.updateUnifiedApiKey(id, update),
      'Unified API key not found',
    );

    if (
      update.modelMappingId !== undefined ||
      update.routeMode !== undefined ||
      update.routeProviderId !== undefined
    ) {
      updateUnifiedApiKeyLocalOverlay(id, {
        modelMappingId: update.modelMappingId,
        routeMode: update.routeMode,
        routeProviderId: update.routeProviderId,
      });
    }

    return applyUnifiedApiKeyOverlay(updated);
  }

  async deleteUnifiedApiKey(id: string) {
    clearUnifiedApiKeyLocalOverlay(id);
    return studioMockService.deleteUnifiedApiKey(id);
  }
}

export const unifiedApiKeyService = new DefaultUnifiedApiKeyService();
