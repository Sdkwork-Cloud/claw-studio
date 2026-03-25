import {
  sdkworkApiRouterAdminClient,
  type ApiRouterCreatedGatewayApiKeyDto,
  type ApiRouterGatewayApiKeyRecordDto,
  type ApiRouterProjectDto,
  type ApiRouterTenantDto,
  type ApiRouterUsageRecordDto,
} from '@sdkwork/claw-infrastructure';
import type {
  ProxyProviderGroup,
  ProxyProviderStatus,
  ProxyProviderUsage,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeySource,
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

interface RouterUnifiedApiKeyDataset {
  tenants: ApiRouterTenantDto[];
  projects: ApiRouterProjectDto[];
  apiKeys: ApiRouterGatewayApiKeyRecordDto[];
  usageRecords: ApiRouterUsageRecordDto[];
}

const DEFAULT_USAGE_PERIOD: ProxyProviderUsage['period'] = '30d';
const DEFAULT_ROUTER_ENVIRONMENT = 'live';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ROUTER_MANAGED_API_KEY_PREFIX = 'sk-ar-v1-';
const ROUTER_MANAGED_API_KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ROUTER_MANAGED_API_KEY_RANDOM_LENGTH = 32;

export const ROUTER_PLAINTEXT_KEY_STORAGE_KEY = 'claw-studio-router-plaintext-api-keys';

const routerPlaintextRevealCache = new Map<
  string,
  {
    apiKey: string;
    source: UnifiedApiKeySource;
    updatedAtMs: number;
  }
>();
let routerPlaintextRevealCacheLoaded = false;

function toIsoString(value?: number | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function normalizeUnifiedApiKeySource(value?: string | null): UnifiedApiKeySource {
  return value === 'custom' ? 'custom' : 'system-generated';
}

function persistRouterPlaintextRevealCache() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const payload = Object.fromEntries(
    [...routerPlaintextRevealCache.entries()].map(([hashedKey, secret]) => [
      hashedKey,
      {
        apiKey: secret.apiKey,
        source: secret.source,
        updatedAtMs: secret.updatedAtMs,
      },
    ]),
  );

  storage.setItem(ROUTER_PLAINTEXT_KEY_STORAGE_KEY, JSON.stringify(payload));
}

function loadRouterPlaintextRevealCache() {
  if (routerPlaintextRevealCacheLoaded) {
    return;
  }

  routerPlaintextRevealCacheLoaded = true;
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const rawValue = storage.getItem(ROUTER_PLAINTEXT_KEY_STORAGE_KEY);
  if (!rawValue) {
    return;
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<
      string,
      {
        apiKey?: string;
        source?: UnifiedApiKeySource;
        updatedAtMs?: number;
      }
    >;

    for (const [hashedKey, secret] of Object.entries(parsed)) {
      const apiKey = normalizeOptionalText(secret.apiKey);
      if (!apiKey) {
        continue;
      }

      routerPlaintextRevealCache.set(hashedKey, {
        apiKey,
        source: normalizeUnifiedApiKeySource(secret.source),
        updatedAtMs: typeof secret.updatedAtMs === 'number' ? secret.updatedAtMs : Date.now(),
      });
    }
  } catch {
    routerPlaintextRevealCache.clear();
  }
}

function fillRandomBytes(length: number) {
  const bytes = new Uint8Array(length);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function generateManagedRouterApiKey() {
  const bytes = fillRandomBytes(ROUTER_MANAGED_API_KEY_RANDOM_LENGTH);
  return `${ROUTER_MANAGED_API_KEY_PREFIX}${Array.from(bytes, (value) =>
    ROUTER_MANAGED_API_KEY_ALPHABET[value % ROUTER_MANAGED_API_KEY_ALPHABET.length],
  ).join('')}`;
}

function resolveStatus(item: ApiRouterGatewayApiKeyRecordDto): ProxyProviderStatus {
  if (!item.active) {
    return 'disabled';
  }

  if (item.expires_at_ms && item.expires_at_ms <= Date.now()) {
    return 'expired';
  }

  return 'active';
}

function buildGroupDescription(tenant: ApiRouterTenantDto) {
  return `Tenant ${tenant.id}`;
}

function mapTenantToGroup(tenant: ApiRouterTenantDto): ProxyProviderGroup {
  return {
    id: tenant.id,
    name: tenant.name,
    description: buildGroupDescription(tenant),
  };
}

function buildUsageByProject(
  usageRecords: ApiRouterUsageRecordDto[],
): Map<string, ProxyProviderUsage> {
  const now = Date.now();
  const usageByProject = new Map<string, ProxyProviderUsage>();

  for (const record of usageRecords) {
    if (record.created_at_ms < now - THIRTY_DAYS_MS) {
      continue;
    }

    const current = usageByProject.get(record.project_id) || {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: DEFAULT_USAGE_PERIOD,
    };

    current.requestCount += 1;
    current.tokenCount += record.total_tokens;
    current.spendUsd += record.amount;
    usageByProject.set(record.project_id, current);
  }

  return usageByProject;
}

function buildProjectNameLookup(projects: ApiRouterProjectDto[]) {
  return new Map(projects.map((project) => [project.id, project.name]));
}

function getProjectName(
  projectId: string,
  projectNamesById: Map<string, string>,
  fallbackLabel: string,
) {
  return projectNamesById.get(projectId)?.trim() || fallbackLabel;
}

function buildUnifiedApiKeyFromRouterRecord(
  item: ApiRouterGatewayApiKeyRecordDto,
  projectNamesById: Map<string, string>,
  usageByProject: Map<string, ProxyProviderUsage>,
): UnifiedApiKey {
  loadRouterPlaintextRevealCache();
  const plaintextKey =
    normalizeOptionalText(item.plaintext) || normalizeOptionalText(item.plaintext_key);
  if (plaintextKey) {
    rememberRouterPlaintextSecret(
      item.hashed_key,
      plaintextKey,
      normalizeUnifiedApiKeySource(item.source),
    );
  }

  const revealedSecret = routerPlaintextRevealCache.get(item.hashed_key);
  const projectName = getProjectName(item.project_id, projectNamesById, item.label);
  const localOverlay = getUnifiedApiKeyLocalOverlay(item.hashed_key);

  return {
    id: item.hashed_key,
    name: normalizeOptionalText(item.label) || projectName,
    apiKey: revealedSecret?.apiKey || '',
    source: revealedSecret?.source || normalizeUnifiedApiKeySource(item.source),
    groupId: item.tenant_id,
    usage: usageByProject.get(item.project_id) || {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: DEFAULT_USAGE_PERIOD,
    },
    expiresAt: toIsoString(item.expires_at_ms),
    status: resolveStatus(item),
    createdAt: toIsoString(item.created_at_ms) || new Date(0).toISOString(),
    modelMappingId: localOverlay.modelMappingId || undefined,
    routeMode: localOverlay.routeMode,
    routeProviderId: localOverlay.routeProviderId || undefined,
    notes: normalizeOptionalText(item.notes) || undefined,
    canCopyApiKey: Boolean(revealedSecret?.apiKey),
    hashedKey: item.hashed_key,
    tenantId: item.tenant_id,
    projectId: item.project_id,
    environment: item.environment,
  };
}

function matchesKeyword(item: UnifiedApiKey, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(normalizedKeyword) ||
    item.apiKey.toLowerCase().includes(normalizedKeyword) ||
    (item.hashedKey || '').toLowerCase().includes(normalizedKeyword) ||
    item.notes?.toLowerCase().includes(normalizedKeyword) === true
  );
}

function filterUnifiedApiKeys(items: UnifiedApiKey[], params: GetUnifiedApiKeysParams) {
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

async function loadRouterUnifiedApiKeyDataset(): Promise<RouterUnifiedApiKeyDataset> {
  const [tenants, projects, apiKeys, usageRecords] = await Promise.all([
    sdkworkApiRouterAdminClient.listTenants(),
    sdkworkApiRouterAdminClient.listProjects(),
    sdkworkApiRouterAdminClient.listApiKeys(),
    sdkworkApiRouterAdminClient.listUsageRecords(),
  ]);

  return {
    tenants,
    projects,
    apiKeys,
    usageRecords,
  };
}

function buildUnifiedApiKeysFromRouterDataset(
  dataset: RouterUnifiedApiKeyDataset,
  params: GetUnifiedApiKeysParams = {},
) {
  const projectNamesById = buildProjectNameLookup(dataset.projects);
  const usageByProject = buildUsageByProject(dataset.usageRecords);

  return filterUnifiedApiKeys(
    dataset.apiKeys.map((item) =>
      buildUnifiedApiKeyFromRouterRecord(item, projectNamesById, usageByProject),
    ),
    params,
  );
}

function resolveExpiresAtMs(expiresAt?: string | null) {
  if (!expiresAt) {
    return null;
  }

  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildHiddenProjectId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return `uak-${Date.now().toString(36)}-${slug || 'key'}`;
}

function buildHiddenProjectName(name: string) {
  return `${name.trim()} Router Project`;
}

function buildRouterTenantId(groupName: string, existingTenantIds: Set<string>) {
  const slug = groupName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const baseId = `tenant-${slug || 'workspace'}`;

  if (!existingTenantIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index += 1) {
    const nextId = `${baseId}-${index}`;
    if (!existingTenantIds.has(nextId)) {
      return nextId;
    }
  }

  return `tenant-${Date.now().toString(36)}`;
}

async function ensureRouterTenantExists(groupId: string, groupName?: string) {
  const tenantId = groupId.trim();
  const tenantName = normalizeOptionalText(groupName);
  const tenants = await sdkworkApiRouterAdminClient.listTenants();
  if (tenants.some((tenant) => tenant.id === tenantId)) {
    return tenantId;
  }

  if (!tenantId && tenantName) {
    const matchedTenant = tenants.find(
      (tenant) => tenant.name.trim().toLowerCase() === tenantName.toLowerCase(),
    );
    if (matchedTenant) {
      return matchedTenant.id;
    }

    const createdTenantId = buildRouterTenantId(
      tenantName,
      new Set(tenants.map((tenant) => tenant.id)),
    );
    await sdkworkApiRouterAdminClient.createTenant({
      id: createdTenantId,
      name: tenantName,
    });

    return createdTenantId;
  }

  if (!tenantId) {
    throw new Error('Unified API key group is required');
  }

  await sdkworkApiRouterAdminClient.createTenant({
    id: tenantId,
    name: tenantName || tenantId,
  });

  return tenantId;
}

function rememberRouterPlaintextSecret(
  hashedKey: string,
  apiKey: string,
  source: UnifiedApiKeySource,
) {
  loadRouterPlaintextRevealCache();
  routerPlaintextRevealCache.set(hashedKey, {
    apiKey,
    source,
    updatedAtMs: Date.now(),
  });
  persistRouterPlaintextRevealCache();
}

function buildUnifiedApiKeyFromCreateResponse(
  created: ApiRouterCreatedGatewayApiKeyDto,
  projectName: string,
  source: UnifiedApiKeySource,
): UnifiedApiKey {
  rememberRouterPlaintextSecret(created.hashed, created.plaintext, source);

  return {
    id: created.hashed,
    name: normalizeOptionalText(created.label) || projectName,
    apiKey: created.plaintext,
    source,
    groupId: created.tenant_id,
    usage: {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: DEFAULT_USAGE_PERIOD,
    },
    expiresAt: toIsoString(created.expires_at_ms),
    status: 'active',
    createdAt: toIsoString(created.created_at_ms) || new Date().toISOString(),
    modelMappingId: undefined,
    routeMode: 'sdkwork-remote',
    routeProviderId: undefined,
    notes: normalizeOptionalText(created.notes) || undefined,
    canCopyApiKey: true,
    hashedKey: created.hashed,
    tenantId: created.tenant_id,
    projectId: created.project_id,
    environment: created.environment,
  };
}

function findRouterApiKeyRecord(
  dataset: RouterUnifiedApiKeyDataset,
  hashedKey: string,
) {
  return dataset.apiKeys.find((item) => item.hashed_key === hashedKey);
}

function findRouterProject(
  dataset: RouterUnifiedApiKeyDataset,
  projectId: string,
) {
  return dataset.projects.find((item) => item.id === projectId);
}

function buildRouterUpdatePayload(
  current: ApiRouterGatewayApiKeyRecordDto,
  update: UnifiedApiKeyUpdate,
  tenantId: string,
  projectId: string,
) {
  const nextNotes =
    update.notes !== undefined
      ? normalizeOptionalText(update.notes)
      : normalizeOptionalText(current.notes);
  const nextExpiresAtMs =
    update.expiresAt !== undefined
      ? resolveExpiresAtMs(update.expiresAt)
      : current.expires_at_ms ?? null;

  return {
    tenant_id: tenantId,
    project_id: projectId,
    environment: current.environment,
    label: update.name?.trim() || current.label,
    notes: nextNotes,
    expires_at_ms: nextExpiresAtMs,
    source:
      update.source
      ?? routerPlaintextRevealCache.get(current.hashed_key)?.source
      ?? normalizeOptionalText(current.source)
      ?? null,
  };
}

function updateTouchesLocalOverlay(update: UnifiedApiKeyUpdate) {
  return (
    update.modelMappingId !== undefined
    || update.routeMode !== undefined
    || update.routeProviderId !== undefined
  );
}

async function updateRouterUnifiedApiKey(
  id: string,
  update: UnifiedApiKeyUpdate,
): Promise<UnifiedApiKey> {
  const dataset = await loadRouterUnifiedApiKeyDataset();
  const current = findRouterApiKeyRecord(dataset, id);
  if (!current) {
    throw new Error('Unified API key not found');
  }

  const tenantId = update.groupId?.trim() || current.tenant_id;
  const projectId = current.project_id;
  const project = findRouterProject(dataset, projectId);
  const projectName = update.name?.trim()
    ? buildHiddenProjectName(update.name)
    : project?.name || current.label;
  const shouldUpdateLocalOverlay = updateTouchesLocalOverlay(update);

  await sdkworkApiRouterAdminClient.createProject({
    tenant_id: tenantId,
    id: projectId,
    name: projectName,
  });

  const updatedRecord = await sdkworkApiRouterAdminClient.updateApiKey(
    id,
    buildRouterUpdatePayload(current, update, tenantId, projectId),
  );

  if (shouldUpdateLocalOverlay) {
    updateUnifiedApiKeyLocalOverlay(id, {
      modelMappingId: update.modelMappingId,
      routeMode: update.routeMode,
      routeProviderId: update.routeProviderId,
    });
  }

  const projectNamesById = buildProjectNameLookup([
    ...dataset.projects.filter((item) => item.id !== projectId),
    {
      tenant_id: tenantId,
      id: projectId,
      name: projectName,
    },
  ]);
  const usageByProject = buildUsageByProject(dataset.usageRecords);

  return buildUnifiedApiKeyFromRouterRecord(updatedRecord, projectNamesById, usageByProject);
}

class DefaultUnifiedApiKeyService implements UnifiedApiKeyService {
  async getGroups() {
    const tenants = await sdkworkApiRouterAdminClient.listTenants();
    return tenants.map(mapTenantToGroup);
  }

  async getUnifiedApiKeys(params: GetUnifiedApiKeysParams = {}) {
    const routerDataset = await loadRouterUnifiedApiKeyDataset();
    return buildUnifiedApiKeysFromRouterDataset(routerDataset, params);
  }

  async createUnifiedApiKey(input: UnifiedApiKeyCreate) {
    const name = input.name.trim();
    const tenantId = await ensureRouterTenantExists(input.groupId, input.groupName);
    const projectId = buildHiddenProjectId(name);
    const projectName = buildHiddenProjectName(name);

    await sdkworkApiRouterAdminClient.createProject({
      tenant_id: tenantId,
      id: projectId,
      name: projectName,
    });

    const source = normalizeUnifiedApiKeySource(
      input.source || (input.apiKey ? 'custom' : 'system-generated'),
    );
    const plaintextKey =
      source === 'system-generated'
        ? generateManagedRouterApiKey()
        : normalizeOptionalText(input.apiKey);
    const created = await sdkworkApiRouterAdminClient.createApiKey({
      tenant_id: tenantId,
      project_id: projectId,
      environment: DEFAULT_ROUTER_ENVIRONMENT,
      label: name,
      expires_at_ms: resolveExpiresAtMs(input.expiresAt),
      notes: normalizeOptionalText(input.notes),
      plaintext_key: plaintextKey || undefined,
      source,
    });

    updateUnifiedApiKeyLocalOverlay(created.hashed, {
      routeMode: 'sdkwork-remote',
      routeProviderId: null,
      modelMappingId: null,
    });
    return buildUnifiedApiKeyFromCreateResponse(created, projectName, source);
  }

  async updateGroup(id: string, groupId: string) {
    return updateRouterUnifiedApiKey(id, { groupId });
  }

  async updateStatus(id: string, status: ProxyProviderStatus) {
    const routerDataset = await loadRouterUnifiedApiKeyDataset();
    const current = findRouterApiKeyRecord(routerDataset, id);
    if (!current) {
      throw new Error('Unified API key not found');
    }

    const updatedRecord = await sdkworkApiRouterAdminClient.updateApiKeyStatus(id, {
      active: status !== 'disabled',
    });
    const projectNamesById = buildProjectNameLookup(routerDataset.projects);
    const usageByProject = buildUsageByProject(routerDataset.usageRecords);
    return buildUnifiedApiKeyFromRouterRecord(updatedRecord, projectNamesById, usageByProject);
  }

  async assignModelMapping(id: string, modelMappingId: string | null) {
    const routerDataset = await loadRouterUnifiedApiKeyDataset();
    const current = findRouterApiKeyRecord(routerDataset, id);
    if (!current) {
      throw new Error('Unified API key not found');
    }

    updateUnifiedApiKeyLocalOverlay(id, {
      modelMappingId,
    });
    const projectNamesById = buildProjectNameLookup(routerDataset.projects);
    const usageByProject = buildUsageByProject(routerDataset.usageRecords);
    return buildUnifiedApiKeyFromRouterRecord(current, projectNamesById, usageByProject);
  }

  async updateUnifiedApiKey(id: string, update: UnifiedApiKeyUpdate) {
    return updateRouterUnifiedApiKey(id, update);
  }

  async deleteUnifiedApiKey(id: string) {
    const routerDataset = await loadRouterUnifiedApiKeyDataset();
    if (!findRouterApiKeyRecord(routerDataset, id)) {
      throw new Error('Unified API key not found');
    }

    loadRouterPlaintextRevealCache();
    routerPlaintextRevealCache.delete(id);
    persistRouterPlaintextRevealCache();
    clearUnifiedApiKeyLocalOverlay(id);
    return sdkworkApiRouterAdminClient.deleteApiKey(id);
  }
}

export const unifiedApiKeyService = new DefaultUnifiedApiKeyService();
