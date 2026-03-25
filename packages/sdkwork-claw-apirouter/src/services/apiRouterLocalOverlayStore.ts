import type {
  ModelMapping,
  ModelMappingCreate,
  ModelMappingRuleInput,
  ModelMappingStatus,
  ModelMappingUpdate,
  UnifiedApiKeyRouteMode,
} from '@sdkwork/claw-types';

export const API_ROUTER_MODEL_MAPPINGS_STORAGE_KEY =
  'claw-studio-api-router-model-mappings';
export const API_ROUTER_UNIFIED_KEY_OVERLAY_STORAGE_KEY =
  'claw-studio-api-router-unified-key-overlays';

export interface UnifiedApiKeyLocalOverlayRecord {
  modelMappingId?: string | null;
  routeMode: UnifiedApiKeyRouteMode;
  routeProviderId?: string | null;
  updatedAtMs: number;
}

let fallbackModelMappings: ModelMapping[] = [];
let fallbackUnifiedKeyOverlays: Record<string, UnifiedApiKeyLocalOverlayRecord> = {};

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readJson<T>(storageKey: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) {
    return fallback;
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeJson(storageKey: string, value: unknown) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(storageKey, JSON.stringify(value));
}

function createUniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createModelMappingId() {
  return `mapping-${createUniqueSuffix()}`;
}

function createModelMappingRuleId() {
  return `mapping-rule-${createUniqueSuffix()}`;
}

function cloneModelMappings(items: ModelMapping[]) {
  return JSON.parse(JSON.stringify(items)) as ModelMapping[];
}

function cloneUnifiedKeyOverlays(items: Record<string, UnifiedApiKeyLocalOverlayRecord>) {
  return JSON.parse(JSON.stringify(items)) as Record<string, UnifiedApiKeyLocalOverlayRecord>;
}

function readStoredModelMappings() {
  const parsed = readJson<ModelMapping[]>(
    API_ROUTER_MODEL_MAPPINGS_STORAGE_KEY,
    fallbackModelMappings,
  );
  fallbackModelMappings = cloneModelMappings(parsed);
  return cloneModelMappings(fallbackModelMappings);
}

function writeStoredModelMappings(items: ModelMapping[]) {
  fallbackModelMappings = cloneModelMappings(items);
  writeJson(API_ROUTER_MODEL_MAPPINGS_STORAGE_KEY, fallbackModelMappings);
}

function readStoredUnifiedKeyOverlays() {
  const parsed = readJson<Record<string, UnifiedApiKeyLocalOverlayRecord>>(
    API_ROUTER_UNIFIED_KEY_OVERLAY_STORAGE_KEY,
    fallbackUnifiedKeyOverlays,
  );
  fallbackUnifiedKeyOverlays = cloneUnifiedKeyOverlays(parsed);
  return cloneUnifiedKeyOverlays(fallbackUnifiedKeyOverlays);
}

function writeStoredUnifiedKeyOverlays(
  items: Record<string, UnifiedApiKeyLocalOverlayRecord>,
) {
  fallbackUnifiedKeyOverlays = cloneUnifiedKeyOverlays(items);
  writeJson(API_ROUTER_UNIFIED_KEY_OVERLAY_STORAGE_KEY, fallbackUnifiedKeyOverlays);
}

function normalizeRuleInput(rule: ModelMappingRuleInput) {
  return {
    id: rule.id?.trim() || createModelMappingRuleId(),
    source: {
      channelId: rule.source.channelId,
      channelName: rule.source.channelName.trim(),
      modelId: rule.source.modelId.trim(),
      modelName: rule.source.modelName.trim(),
    },
    target: {
      channelId: rule.target.channelId,
      channelName: rule.target.channelName.trim(),
      modelId: rule.target.modelId.trim(),
      modelName: rule.target.modelName.trim(),
    },
  };
}

function sortModelMappings(items: ModelMapping[]) {
  return [...items].sort((left, right) => {
    const createdAtDelta = right.createdAt.localeCompare(left.createdAt);
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

export function listLocalModelMappings() {
  return sortModelMappings(readStoredModelMappings());
}

export function createLocalModelMapping(input: ModelMappingCreate): ModelMapping {
  const created: ModelMapping = {
    id: createModelMappingId(),
    name: input.name.trim(),
    description: input.description?.trim() || '',
    status: 'active',
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    createdAt: new Date().toISOString(),
    rules: input.rules.map(normalizeRuleInput),
  };

  writeStoredModelMappings([created, ...readStoredModelMappings()]);
  return created;
}

export function updateLocalModelMapping(
  id: string,
  update: ModelMappingUpdate,
): ModelMapping {
  const items = readStoredModelMappings();
  const currentIndex = items.findIndex((item) => item.id === id);

  if (currentIndex < 0) {
    throw new Error('Model mapping not found');
  }

  const current = items[currentIndex];
  const updated: ModelMapping = {
    ...current,
    name: update.name?.trim() || current.name,
    description:
      update.description !== undefined
        ? update.description.trim()
        : current.description,
    status: update.status || current.status,
    effectiveFrom: update.effectiveFrom || current.effectiveFrom,
    effectiveTo: update.effectiveTo || current.effectiveTo,
    rules: update.rules ? update.rules.map(normalizeRuleInput) : current.rules,
  };

  items[currentIndex] = updated;
  writeStoredModelMappings(items);
  return updated;
}

export function updateLocalModelMappingStatus(
  id: string,
  status: ModelMappingStatus,
): ModelMapping {
  return updateLocalModelMapping(id, { status });
}

export function deleteLocalModelMapping(id: string): boolean {
  const items = readStoredModelMappings();
  const nextItems = items.filter((item) => item.id !== id);

  if (nextItems.length === items.length) {
    return false;
  }

  writeStoredModelMappings(nextItems);

  const overlays = readStoredUnifiedKeyOverlays();
  let changed = false;
  for (const [keyId, overlay] of Object.entries(overlays)) {
    if (overlay.modelMappingId === id) {
      overlays[keyId] = {
        ...overlay,
        modelMappingId: null,
        updatedAtMs: Date.now(),
      };
      changed = true;
    }
  }

  if (changed) {
    writeStoredUnifiedKeyOverlays(overlays);
  }

  return true;
}

export function getUnifiedApiKeyLocalOverlay(
  unifiedApiKeyId: string,
): UnifiedApiKeyLocalOverlayRecord {
  const overlays = readStoredUnifiedKeyOverlays();
  const overlay = overlays[unifiedApiKeyId];

  return {
    modelMappingId: overlay?.modelMappingId ?? null,
    routeMode: overlay?.routeMode || 'sdkwork-remote',
    routeProviderId: overlay?.routeProviderId ?? null,
    updatedAtMs: overlay?.updatedAtMs || 0,
  };
}

export function updateUnifiedApiKeyLocalOverlay(
  unifiedApiKeyId: string,
  update: {
    modelMappingId?: string | null;
    routeMode?: UnifiedApiKeyRouteMode;
    routeProviderId?: string | null;
  },
): UnifiedApiKeyLocalOverlayRecord {
  const overlays = readStoredUnifiedKeyOverlays();
  const current = getUnifiedApiKeyLocalOverlay(unifiedApiKeyId);
  const routeMode = update.routeMode || current.routeMode || 'sdkwork-remote';
  const routeProviderId =
    routeMode === 'custom'
      ? normalizeOptionalText(
          update.routeProviderId !== undefined
            ? update.routeProviderId
            : current.routeProviderId,
        )
      : null;
  const modelMappingId = normalizeOptionalText(
    update.modelMappingId !== undefined
      ? update.modelMappingId
      : current.modelMappingId,
  );

  const next: UnifiedApiKeyLocalOverlayRecord = {
    modelMappingId,
    routeMode,
    routeProviderId,
    updatedAtMs: Date.now(),
  };

  overlays[unifiedApiKeyId] = next;
  writeStoredUnifiedKeyOverlays(overlays);
  return next;
}

export function clearUnifiedApiKeyLocalOverlay(unifiedApiKeyId: string) {
  const overlays = readStoredUnifiedKeyOverlays();
  if (!overlays[unifiedApiKeyId]) {
    return;
  }

  delete overlays[unifiedApiKeyId];
  writeStoredUnifiedKeyOverlays(overlays);
}
