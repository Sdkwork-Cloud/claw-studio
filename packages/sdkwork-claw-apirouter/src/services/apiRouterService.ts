import {
  sdkworkApiRouterAdminClient,
  studioMockService,
  type ApiRouterCredentialDto,
  type ApiRouterGatewayApiKeyRecordDto,
  type ApiRouterModelDto,
  type ApiRouterProviderDto,
  type ApiRouterProviderHealthSnapshotDto,
  type ApiRouterTenantDto,
  type ApiRouterUsageRecordDto,
} from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterChannel,
  ApiRouterUsageRecordApiKeyOption,
  ApiRouterUsageRecordSummary,
  ApiRouterUsageRecordsQuery,
  ApiRouterUsageRecordsResult,
  ProxyProviderCreate,
  ProxyProvider,
  ProxyProviderModel,
  ProxyProviderGroup,
  ProxyProviderStatus,
  ProxyProviderUpdate,
} from '@sdkwork/claw-types';
import type { PaginatedResult } from '@sdkwork/claw-types';

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

type RouterProviderDataset = {
  providers: ApiRouterProviderDto[];
  credentials: ApiRouterCredentialDto[];
  models: ApiRouterModelDto[];
  usageRecords: ApiRouterUsageRecordDto[];
  healthSnapshots: ApiRouterProviderHealthSnapshotDto[];
  channelMetadata: ApiRouterChannel[];
};

type RouterProviderRowContext = {
  row: ProxyProvider;
  provider: ApiRouterProviderDto;
  credential: ApiRouterCredentialDto;
};

const OPENAI_COMPATIBLE_PROVIDER_CHANNELS = new Set([
  'openai',
  'xai',
  'deepseek',
  'qwen',
  'zhipu',
  'baidu',
  'tencent-hunyuan',
  'doubao',
  'moonshot',
  'stepfun',
  'iflytek-spark',
  'meta',
  'mistral',
  'cohere',
  'amazon-nova',
  'microsoft',
  'nvidia',
  'sensenova',
  'baichuan',
  'yi',
  'huawei-pangu',
]);
const ANTHROPIC_COMPATIBLE_PROVIDER_CHANNELS = new Set(['anthropic', 'minimax']);
const GEMINI_COMPATIBLE_PROVIDER_CHANNELS = new Set(['google']);
const ROUTER_PROVIDER_SECRET_CACHE = new Map<string, string>();
const ROUTER_PROVIDER_MODEL_NAME_CACHE = new Map<string, string>();

const ROUTER_PROVIDER_GROUP_MOVE_REQUIRES_SECRET_ERROR =
  'This router-backed provider requires re-entering the API key before changing groups.';
const ROUTER_PROVIDER_STATUS_DERIVED_ERROR =
  'This router-backed provider status is derived from sdkwork-api-router health snapshots and cannot be changed manually.';

function buildRouterProviderRowId(
  tenantId: string,
  providerId: string,
  keyReference: string,
) {
  return `${providerId}::${tenantId}::${keyReference}`;
}

function parseRouterProviderRowId(value: string) {
  const [providerId, tenantId, ...keyReferenceParts] = value.split('::');
  const keyReference = keyReferenceParts.join('::');
  if (!providerId || !tenantId || !keyReference) {
    return null;
  }

  return {
    providerId,
    tenantId,
    keyReference,
  };
}

function createUniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugifyProviderSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'provider';
}

function createRouterProviderId(channelId: string, name: string) {
  return `provider-${channelId}-${slugifyProviderSegment(name)}-${createUniqueSuffix()}`;
}

function createRouterCredentialReference(channelId: string) {
  return `cred-${channelId}-${createUniqueSuffix()}`;
}

function resolveRouterProviderChannelId(provider: ApiRouterProviderDto) {
  return (
    provider.channel_bindings?.find((binding) => binding.is_primary)?.channel_id
    || provider.channel_id
  );
}

function resolveRouterProviderAdapterKind(channelId: string, existing?: string) {
  const normalizedExisting = existing?.trim();
  if (normalizedExisting) {
    return normalizedExisting;
  }

  if (OPENAI_COMPATIBLE_PROVIDER_CHANNELS.has(channelId)) {
    return 'custom-openai';
  }

  if (ANTHROPIC_COMPATIBLE_PROVIDER_CHANNELS.has(channelId)) {
    return 'anthropic';
  }

  if (GEMINI_COMPATIBLE_PROVIDER_CHANNELS.has(channelId)) {
    return 'google';
  }

  return channelId;
}

function resolveRouterProviderExtensionId(channelId: string, existing?: string) {
  const normalizedExisting = existing?.trim();
  if (normalizedExisting) {
    return normalizedExisting;
  }

  if (resolveRouterProviderAdapterKind(channelId) === 'custom-openai') {
    return 'sdkwork.provider.custom-openai';
  }

  return undefined;
}

function resolveRouterModelCapabilities(channelId: string, existing?: string[]) {
  if (existing && existing.length > 0) {
    return [...new Set(existing)];
  }

  if (ANTHROPIC_COMPATIBLE_PROVIDER_CHANNELS.has(channelId)) {
    return ['messages'];
  }

  if (GEMINI_COMPATIBLE_PROVIDER_CHANNELS.has(channelId)) {
    return ['generate_content'];
  }

  return ['responses', 'chat_completions'];
}

function normalizeProviderModelsInput(models: ProxyProviderModel[]) {
  return models
    .map((model) => {
      const id = model.id.trim();
      const name = model.name.trim() || id;

      return {
        id,
        name,
      };
    })
    .filter((model) => model.id && model.name);
}

function buildEmptyProviderUsage(): ProxyProvider['usage'] {
  return {
    requestCount: 0,
    tokenCount: 0,
    spendUsd: 0,
    period: '30d' as const,
  };
}

function buildRouterProviderStatus(
  snapshot?: ApiRouterProviderHealthSnapshotDto,
): ProxyProviderStatus {
  if (!snapshot) {
    return 'warning';
  }

  if (!snapshot.running) {
    return 'disabled';
  }

  if (!snapshot.healthy) {
    return 'warning';
  }

  return 'active';
}

function buildRouterProviderModelCacheKey(providerId: string, externalName: string) {
  return `${providerId}::${externalName}`;
}

function rememberRouterProviderModelNames(providerId: string, models: ProxyProviderModel[]) {
  for (const model of normalizeProviderModelsInput(models)) {
    ROUTER_PROVIDER_MODEL_NAME_CACHE.set(
      buildRouterProviderModelCacheKey(providerId, model.id),
      model.name,
    );
  }
}

function forgetRouterProviderModelNames(providerId: string, externalNames?: string[]) {
  if (!externalNames || externalNames.length === 0) {
    for (const cacheKey of ROUTER_PROVIDER_MODEL_NAME_CACHE.keys()) {
      if (cacheKey.startsWith(`${providerId}::`)) {
        ROUTER_PROVIDER_MODEL_NAME_CACHE.delete(cacheKey);
      }
    }
    return;
  }

  for (const externalName of externalNames) {
    ROUTER_PROVIDER_MODEL_NAME_CACHE.delete(
      buildRouterProviderModelCacheKey(providerId, externalName),
    );
  }
}

function buildRouterModelsByProviderId(models: ApiRouterModelDto[]) {
  const modelsByProviderId = new Map<string, ProxyProviderModel[]>();

  for (const model of models) {
    const providerModels = modelsByProviderId.get(model.provider_id) || [];
    providerModels.push({
      id: model.external_name,
      name:
        ROUTER_PROVIDER_MODEL_NAME_CACHE.get(
          buildRouterProviderModelCacheKey(model.provider_id, model.external_name),
        ) || model.external_name,
    });
    modelsByProviderId.set(model.provider_id, providerModels);
  }

  return modelsByProviderId;
}

function buildRouterUsageByProviderId(records: ApiRouterUsageRecordDto[]) {
  const usageByProviderId = new Map<string, ReturnType<typeof buildEmptyProviderUsage>>();

  for (const item of records) {
    const current = usageByProviderId.get(item.provider) || buildEmptyProviderUsage();
    current.requestCount += 1;
    current.tokenCount += item.total_tokens;
    current.spendUsd += item.amount;
    usageByProviderId.set(item.provider, current);
  }

  return usageByProviderId;
}

function buildLatestHealthSnapshotsByProviderId(
  snapshots: ApiRouterProviderHealthSnapshotDto[],
) {
  const latestByProviderId = new Map<string, ApiRouterProviderHealthSnapshotDto>();

  for (const snapshot of snapshots) {
    const current = latestByProviderId.get(snapshot.provider_id);
    if (!current || current.observed_at_ms < snapshot.observed_at_ms) {
      latestByProviderId.set(snapshot.provider_id, snapshot);
    }
  }

  return latestByProviderId;
}

function buildRouterProviderRowContexts(
  dataset: RouterProviderDataset,
): RouterProviderRowContext[] {
  const providerById = new Map(dataset.providers.map((provider) => [provider.id, provider]));
  const modelsByProviderId = buildRouterModelsByProviderId(dataset.models);
  const usageByProviderId = buildRouterUsageByProviderId(dataset.usageRecords);
  const healthByProviderId = buildLatestHealthSnapshotsByProviderId(dataset.healthSnapshots);

  return dataset.credentials
    .map<RouterProviderRowContext | null>((credential) => {
      const provider = providerById.get(credential.provider_id);
      if (!provider) {
        return null;
      }

      const rowId = buildRouterProviderRowId(
        credential.tenant_id,
        credential.provider_id,
        credential.key_reference,
      );
      const cachedSecret = ROUTER_PROVIDER_SECRET_CACHE.get(rowId) || '';

      return {
        provider,
        credential,
        row: {
          id: rowId,
          channelId: resolveRouterProviderChannelId(provider),
          name: provider.display_name,
          apiKey: cachedSecret,
          groupId: credential.tenant_id,
          usage: usageByProviderId.get(provider.id) || buildEmptyProviderUsage(),
          expiresAt: null,
          status: buildRouterProviderStatus(healthByProviderId.get(provider.id)),
          createdAt: null,
          baseUrl: provider.base_url,
          models: modelsByProviderId.get(provider.id) || [],
          canCopyApiKey: Boolean(cachedSecret),
          credentialReference: credential.key_reference,
          tenantId: credential.tenant_id,
        },
      };
    })
    .filter((item): item is RouterProviderRowContext => Boolean(item))
    .sort((left, right) => {
      const nameDelta = left.row.name.localeCompare(right.row.name);
      if (nameDelta !== 0) {
        return nameDelta;
      }

      return left.row.groupId.localeCompare(right.row.groupId);
    });
}

function findRouterProviderRowContext(
  dataset: RouterProviderDataset,
  id: string,
) {
  const contexts = buildRouterProviderRowContexts(dataset);
  const parsedId = parseRouterProviderRowId(id);

  if (parsedId) {
    return (
      contexts.find(
        (context) =>
          context.provider.id === parsedId.providerId
          && context.credential.tenant_id === parsedId.tenantId
          && context.credential.key_reference === parsedId.keyReference,
      )
      || null
    );
  }

  return contexts.find((context) => context.row.id === id) || null;
}

function buildRouterChannels(
  rows: ProxyProvider[],
  channelMetadata: ApiRouterChannel[],
) {
  const metadataById = new Map(channelMetadata.map((channel) => [channel.id, channel]));
  const countsByChannelId = new Map<
    string,
    Pick<
      ApiRouterChannel,
      | 'providerCount'
      | 'activeProviderCount'
      | 'warningProviderCount'
      | 'disabledProviderCount'
    >
  >();

  for (const row of rows) {
    const counts = countsByChannelId.get(row.channelId) || {
      providerCount: 0,
      activeProviderCount: 0,
      warningProviderCount: 0,
      disabledProviderCount: 0,
    };

    counts.providerCount += 1;
    if (row.status === 'active') {
      counts.activeProviderCount += 1;
    } else if (row.status === 'disabled') {
      counts.disabledProviderCount += 1;
    } else {
      counts.warningProviderCount += 1;
    }
    countsByChannelId.set(row.channelId, counts);
  }

  const channelIds = new Set([
    ...channelMetadata.map((channel) => channel.id),
    ...rows.map((row) => row.channelId),
  ]);

  return [...channelIds]
    .map((channelId) => {
      const metadata = metadataById.get(channelId);
      const counts = countsByChannelId.get(channelId) || {
        providerCount: 0,
        activeProviderCount: 0,
        warningProviderCount: 0,
        disabledProviderCount: 0,
      };

      return {
        id: channelId,
        name: metadata?.name || channelId,
        vendor: metadata?.vendor || metadata?.name || channelId,
        description: metadata?.description || '',
        modelFamily: metadata?.modelFamily || '',
        ...counts,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildRouterProviderRows(dataset: RouterProviderDataset) {
  return buildRouterProviderRowContexts(dataset).map((context) => context.row);
}

async function loadRouterChannelMetadata(): Promise<ApiRouterChannel[]> {
  const routerChannels = await sdkworkApiRouterAdminClient.listChannels();
  const seededChannels = await studioMockService.listApiRouterChannels().catch(() => []);
  const seededById = new Map<string, ApiRouterChannel>(
    seededChannels.map((channel): [string, ApiRouterChannel] => [channel.id, channel]),
  );
  const merged = new Map<string, ApiRouterChannel>();

  for (const channel of seededChannels) {
    merged.set(channel.id, { ...channel });
  }

  for (const channel of routerChannels) {
    const seeded = seededById.get(channel.id);
    merged.set(channel.id, {
      id: channel.id,
      name: channel.name || seeded?.name || channel.id,
      vendor: seeded?.vendor || channel.name || channel.id,
      description: seeded?.description || '',
      modelFamily: seeded?.modelFamily || '',
      providerCount: 0,
      activeProviderCount: 0,
      warningProviderCount: 0,
      disabledProviderCount: 0,
    });
  }

  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function loadRouterProviderDataset(): Promise<RouterProviderDataset> {
  const [providers, credentials, models] = await Promise.all([
    sdkworkApiRouterAdminClient.listProviders(),
    sdkworkApiRouterAdminClient.listCredentials(),
    sdkworkApiRouterAdminClient.listModels(),
  ]);
  const [usageRecords, healthSnapshots, channelMetadata] = await Promise.all([
    sdkworkApiRouterAdminClient.listUsageRecords().catch(() => []),
    sdkworkApiRouterAdminClient.listProviderHealthSnapshots().catch(() => []),
    loadRouterChannelMetadata().catch(() => []),
  ]);

  return {
    providers,
    credentials,
    models,
    usageRecords,
    healthSnapshots,
    channelMetadata,
  };
}

async function ensureRouterTenant(groupId: string) {
  const tenantId = groupId.trim();
  const tenants = await sdkworkApiRouterAdminClient.listTenants();

  if (tenants.some((tenant) => tenant.id === tenantId)) {
    return;
  }

  await sdkworkApiRouterAdminClient.createTenant({
    id: tenantId,
    name: tenantId,
  });
}

function buildRouterProviderBindings(channelId: string) {
  return [
    {
      channel_id: channelId,
      is_primary: true,
    },
  ];
}

async function syncRouterProviderModels(
  providerId: string,
  channelId: string,
  currentModels: ApiRouterModelDto[],
  nextModels: ProxyProviderModel[],
) {
  const normalizedNextModels = normalizeProviderModelsInput(nextModels);
  const currentModelsForProvider = currentModels.filter(
    (model) => model.provider_id === providerId,
  );
  const currentModelById = new Map(
    currentModelsForProvider.map((model) => [model.external_name, model]),
  );
  const nextModelIds = new Set(normalizedNextModels.map((model) => model.id));

  for (const currentModel of currentModelsForProvider) {
    if (!nextModelIds.has(currentModel.external_name)) {
      await sdkworkApiRouterAdminClient.deleteModel(currentModel.external_name, providerId);
    }
  }

  for (const nextModel of normalizedNextModels) {
    const currentModel = currentModelById.get(nextModel.id);
    await sdkworkApiRouterAdminClient.createModel({
      external_name: nextModel.id,
      provider_id: providerId,
      capabilities: resolveRouterModelCapabilities(channelId, currentModel?.capabilities),
      streaming: currentModel?.streaming ?? true,
      context_window: currentModel?.context_window ?? null,
    });
  }

  forgetRouterProviderModelNames(providerId);
  rememberRouterProviderModelNames(providerId, normalizedNextModels);
}

function filterProxyProviders(
  providers: ProxyProvider[],
  params: GetProxyProvidersParams,
) {
  return providers.filter((provider) => {
    if (params.channelId && provider.channelId !== params.channelId) {
      return false;
    }

    if (params.groupId && params.groupId !== 'all' && provider.groupId !== params.groupId) {
      return false;
    }

    if (params.keyword && !matchesKeyword(provider, params.keyword)) {
      return false;
    }

    return true;
  });
}

type RouterUsageDataset = {
  apiKeys: ApiRouterGatewayApiKeyRecordDto[];
  records: ApiRouterUsageRecordDto[];
};

function resolveUsagePage(page?: number) {
  return page && page > 0 ? page : 1;
}

function resolveUsagePageSize(pageSize?: number) {
  return pageSize && pageSize > 0 ? pageSize : 20;
}

function buildUsageApiKeyLabel(item: ApiRouterGatewayApiKeyRecordDto) {
  const label = item.label?.trim();
  if (label) {
    return label;
  }

  return `${item.project_id} (${item.environment})`;
}

function buildUsageApiKeyOptions(
  apiKeys: ApiRouterGatewayApiKeyRecordDto[],
  records: ApiRouterUsageRecordDto[],
): ApiRouterUsageRecordApiKeyOption[] {
  const options = new Map<string, ApiRouterUsageRecordApiKeyOption>();
  for (const item of apiKeys) {
    if (!options.has(item.project_id)) {
      options.set(item.project_id, {
        id: item.project_id,
        label: buildUsageApiKeyLabel(item),
      });
    }
  }

  for (const item of records) {
    if (!options.has(item.project_id)) {
      options.set(item.project_id, {
        id: item.project_id,
        label: item.project_id,
      });
    }
  }

  return [
    {
      id: 'all',
      label: 'All API Keys',
    },
    ...[...options.values()].sort((left, right) => left.label.localeCompare(right.label)),
  ];
}

function resolveUsageRangeStartMs(query: ApiRouterUsageRecordsQuery) {
  const now = Date.now();
  switch (query.timeRange) {
    case '24h':
      return now - 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'custom':
      return query.startDate ? Date.parse(query.startDate) : null;
    default:
      return null;
  }
}

function resolveUsageRangeEndMs(query: ApiRouterUsageRecordsQuery) {
  if (query.timeRange !== 'custom' || !query.endDate) {
    return null;
  }

  return Date.parse(`${query.endDate}T23:59:59.999Z`);
}

function filterRouterUsageRecords(
  records: ApiRouterUsageRecordDto[],
  query: ApiRouterUsageRecordsQuery,
) {
  const minTimestamp = resolveUsageRangeStartMs(query);
  const maxTimestamp = resolveUsageRangeEndMs(query);

  return records.filter((item) => {
    if (query.apiKeyId && query.apiKeyId !== 'all' && item.project_id !== query.apiKeyId) {
      return false;
    }

    if (minTimestamp !== null && item.created_at_ms < minTimestamp) {
      return false;
    }

    if (maxTimestamp !== null && item.created_at_ms > maxTimestamp) {
      return false;
    }

    return true;
  });
}

function mapRouterUsageRecord(
  item: ApiRouterUsageRecordDto,
  index: number,
  apiKeyOptionsById: Map<string, string>,
) {
  return {
    id: `${item.project_id}-${item.model}-${item.provider}-${item.created_at_ms}-${index}`,
    apiKeyId: item.project_id,
    apiKeyName: apiKeyOptionsById.get(item.project_id) || item.project_id,
    model: item.model,
    reasoningEffort: 'medium' as const,
    endpoint: item.provider,
    type: 'standard' as const,
    promptTokens: item.input_tokens,
    completionTokens: item.output_tokens,
    cachedTokens: 0,
    costUsd: item.amount,
    ttftMs: 0,
    durationMs: 0,
    startedAt: new Date(item.created_at_ms).toISOString(),
    userAgent: 'sdkwork-api-router',
  };
}

function sortUsageRecords(
  items: ReturnType<typeof mapRouterUsageRecord>[],
  query: ApiRouterUsageRecordsQuery,
) {
  const sortBy = query.sortBy || 'time';
  const sortOrder = query.sortOrder || (sortBy === 'time' ? 'desc' : 'asc');
  const direction = sortOrder === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    if (sortBy === 'model') {
      return left.model.localeCompare(right.model) * direction;
    }

    return (
      (new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()) * direction
    );
  });
}

function paginateUsageRecords(
  items: ReturnType<typeof mapRouterUsageRecord>[],
  query: ApiRouterUsageRecordsQuery,
): PaginatedResult<ReturnType<typeof mapRouterUsageRecord>> {
  const page = resolveUsagePage(query.page);
  const pageSize = resolveUsagePageSize(query.pageSize);
  const startIndex = (page - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: pageItems,
    total: items.length,
    page,
    pageSize,
    hasMore: startIndex + pageSize < items.length,
  };
}

function summarizeUsageRecords(items: ApiRouterUsageRecordDto[]): ApiRouterUsageRecordSummary {
  if (items.length === 0) {
    return {
      totalRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalSpendUsd: 0,
      averageDurationMs: 0,
    };
  }

  const totalRequests = items.length;
  const totalTokens = items.reduce((sum, item) => sum + item.total_tokens, 0);
  const promptTokens = items.reduce((sum, item) => sum + item.input_tokens, 0);
  const completionTokens = items.reduce((sum, item) => sum + item.output_tokens, 0);
  const totalSpendUsd = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    totalRequests,
    totalTokens,
    promptTokens,
    completionTokens,
    cachedTokens: 0,
    totalSpendUsd,
    averageDurationMs: 0,
  };
}

async function loadRouterUsageDataset(): Promise<RouterUsageDataset> {
  const [apiKeys, records] = await Promise.all([
    sdkworkApiRouterAdminClient.listApiKeys(),
    sdkworkApiRouterAdminClient.listUsageRecords(),
  ]);

  return {
    apiKeys,
    records,
  };
}

class DefaultApiRouterService implements ApiRouterService {
  async getChannels() {
    const routerDataset = await loadRouterProviderDataset();
    return buildRouterChannels(
      buildRouterProviderRows(routerDataset),
      routerDataset.channelMetadata,
    );
  }

  async getGroups() {
    const tenants = await sdkworkApiRouterAdminClient.listTenants();
    if (tenants.length > 0) {
      return tenants.map(mapTenantToGroup);
    }

    return studioMockService.listProxyProviderGroups();
  }

  async getProxyProviders(params: GetProxyProvidersParams = {}) {
    const routerDataset = await loadRouterProviderDataset();
    return filterProxyProviders(buildRouterProviderRows(routerDataset), params);
  }

  async createProvider(input: ProxyProviderCreate) {
    const normalizedModels = normalizeProviderModelsInput(input.models);
    const providerId = createRouterProviderId(input.channelId, input.name);
    const keyReference = createRouterCredentialReference(input.channelId);
    const trimmedGroupId = input.groupId.trim();
    const trimmedApiKey = input.apiKey.trim();

    await ensureRouterTenant(trimmedGroupId);
    await sdkworkApiRouterAdminClient.createProvider({
      id: providerId,
      channel_id: input.channelId,
      extension_id: resolveRouterProviderExtensionId(input.channelId),
      channel_bindings: buildRouterProviderBindings(input.channelId),
      adapter_kind: resolveRouterProviderAdapterKind(input.channelId),
      base_url: input.baseUrl.trim(),
      display_name: input.name.trim(),
    });
    await sdkworkApiRouterAdminClient.createCredential({
      tenant_id: trimmedGroupId,
      provider_id: providerId,
      key_reference: keyReference,
      secret_value: trimmedApiKey,
    });

    for (const model of normalizedModels) {
      await sdkworkApiRouterAdminClient.createModel({
        external_name: model.id,
        provider_id: providerId,
        capabilities: resolveRouterModelCapabilities(input.channelId),
        streaming: true,
        context_window: null,
      });
    }

    rememberRouterProviderModelNames(providerId, normalizedModels);
    const createdRowId = buildRouterProviderRowId(trimmedGroupId, providerId, keyReference);
    ROUTER_PROVIDER_SECRET_CACHE.set(createdRowId, trimmedApiKey);

    const refreshedDataset = await loadRouterProviderDataset();
    const context = findRouterProviderRowContext(refreshedDataset, createdRowId);
    if (!context) {
      throw new Error('Proxy provider not found');
    }

    return context.row;
  }

  async updateGroup(id: string, groupId: string) {
    const routerDataset = await loadRouterProviderDataset();
    const context = findRouterProviderRowContext(routerDataset, id);
    if (!context) {
      throw new Error('Proxy provider not found');
    }

    const nextGroupId = groupId.trim();
    if (!nextGroupId || nextGroupId === context.credential.tenant_id) {
      return context.row;
    }

    const cachedSecret = ROUTER_PROVIDER_SECRET_CACHE.get(context.row.id)?.trim() || '';
    if (!cachedSecret) {
      throw new Error(ROUTER_PROVIDER_GROUP_MOVE_REQUIRES_SECRET_ERROR);
    }

    await ensureRouterTenant(nextGroupId);
    await sdkworkApiRouterAdminClient.createCredential({
      tenant_id: nextGroupId,
      provider_id: context.provider.id,
      key_reference: context.credential.key_reference,
      secret_value: cachedSecret,
    });
    await sdkworkApiRouterAdminClient.deleteCredential(
      context.credential.tenant_id,
      context.credential.provider_id,
      context.credential.key_reference,
    );

    const nextRowId = buildRouterProviderRowId(
      nextGroupId,
      context.provider.id,
      context.credential.key_reference,
    );
    ROUTER_PROVIDER_SECRET_CACHE.set(nextRowId, cachedSecret);
    ROUTER_PROVIDER_SECRET_CACHE.delete(context.row.id);

    const refreshedDataset = await loadRouterProviderDataset();
    const nextContext = findRouterProviderRowContext(refreshedDataset, nextRowId);
    if (!nextContext) {
      throw new Error('Proxy provider not found');
    }

    return nextContext.row;
  }

  async updateStatus(id: string, status: ProxyProviderStatus): Promise<ProxyProvider> {
    const routerDataset = await loadRouterProviderDataset();
    const context = findRouterProviderRowContext(routerDataset, id);
    if (!context) {
      throw new Error('Proxy provider not found');
    }

    void status;
    throw new Error(ROUTER_PROVIDER_STATUS_DERIVED_ERROR);
  }

  async updateProvider(id: string, update: ProxyProviderUpdate) {
    const routerDataset = await loadRouterProviderDataset();
    const context = findRouterProviderRowContext(routerDataset, id);
    if (!context) {
      throw new Error('Proxy provider not found');
    }

    const currentRowId = context.row.id;
    const nextGroupId = update.groupId?.trim() || context.credential.tenant_id;
    const currentChannelId = resolveRouterProviderChannelId(context.provider);
    const explicitApiKey = update.apiKey?.trim() || '';
    const cachedSecret = ROUTER_PROVIDER_SECRET_CACHE.get(currentRowId)?.trim() || '';
    const nextSecret = explicitApiKey || cachedSecret;
    const groupChanged = nextGroupId !== context.credential.tenant_id;

    if (groupChanged && !nextSecret) {
      throw new Error(ROUTER_PROVIDER_GROUP_MOVE_REQUIRES_SECRET_ERROR);
    }

    await sdkworkApiRouterAdminClient.createProvider({
      id: context.provider.id,
      channel_id: currentChannelId,
      extension_id: resolveRouterProviderExtensionId(
        currentChannelId,
        context.provider.extension_id,
      ),
      channel_bindings: buildRouterProviderBindings(currentChannelId),
      adapter_kind: resolveRouterProviderAdapterKind(
        currentChannelId,
        context.provider.adapter_kind,
      ),
      base_url: update.baseUrl?.trim() || context.provider.base_url,
      display_name: update.name?.trim() || context.provider.display_name,
    });

    if (update.models) {
      await syncRouterProviderModels(
        context.provider.id,
        currentChannelId,
        routerDataset.models,
        update.models,
      );
    }

    if (groupChanged || explicitApiKey) {
      await ensureRouterTenant(nextGroupId);
      await sdkworkApiRouterAdminClient.createCredential({
        tenant_id: nextGroupId,
        provider_id: context.provider.id,
        key_reference: context.credential.key_reference,
        secret_value: nextSecret,
      });

      if (groupChanged) {
        await sdkworkApiRouterAdminClient.deleteCredential(
          context.credential.tenant_id,
          context.credential.provider_id,
          context.credential.key_reference,
        );
      }
    }

    const nextRowId = buildRouterProviderRowId(
      nextGroupId,
      context.provider.id,
      context.credential.key_reference,
    );

    if (nextSecret) {
      ROUTER_PROVIDER_SECRET_CACHE.set(nextRowId, nextSecret);
    } else {
      ROUTER_PROVIDER_SECRET_CACHE.delete(nextRowId);
    }

    if (nextRowId !== currentRowId) {
      ROUTER_PROVIDER_SECRET_CACHE.delete(currentRowId);
    }

    const refreshedDataset = await loadRouterProviderDataset();
    const nextContext = findRouterProviderRowContext(refreshedDataset, nextRowId);
    if (!nextContext) {
      throw new Error('Proxy provider not found');
    }

    return nextContext.row;
  }

  async deleteProvider(id: string) {
    const routerDataset = await loadRouterProviderDataset();
    const context = findRouterProviderRowContext(routerDataset, id);
    if (!context) {
      throw new Error('Proxy provider not found');
    }

    await sdkworkApiRouterAdminClient.deleteCredential(
      context.credential.tenant_id,
      context.credential.provider_id,
      context.credential.key_reference,
    );
    ROUTER_PROVIDER_SECRET_CACHE.delete(context.row.id);

    const remainingCredentialCount = routerDataset.credentials.filter(
      (credential) =>
        credential.provider_id === context.provider.id
        && !(
          credential.tenant_id === context.credential.tenant_id
          && credential.key_reference === context.credential.key_reference
        ),
    ).length;

    if (remainingCredentialCount === 0) {
      const modelIds = routerDataset.models
        .filter((model) => model.provider_id === context.provider.id)
        .map((model) => model.external_name);

      for (const modelId of modelIds) {
        await sdkworkApiRouterAdminClient.deleteModel(modelId, context.provider.id);
      }
      await sdkworkApiRouterAdminClient.deleteProvider(context.provider.id);
      forgetRouterProviderModelNames(context.provider.id);
    }

    return true;
  }

  async getUsageRecordApiKeys() {
    const routerDataset = await loadRouterUsageDataset();
    return buildUsageApiKeyOptions(routerDataset.apiKeys, routerDataset.records);
  }

  async getUsageRecordSummary(query: ApiRouterUsageRecordsQuery = {}) {
    const routerDataset = await loadRouterUsageDataset();
    return summarizeUsageRecords(filterRouterUsageRecords(routerDataset.records, query));
  }

  async getUsageRecords(query: ApiRouterUsageRecordsQuery = {}) {
    const routerDataset = await loadRouterUsageDataset();
    const apiKeyOptionsById = new Map(
      buildUsageApiKeyOptions(routerDataset.apiKeys, routerDataset.records)
        .filter((item) => item.id !== 'all')
        .map((item) => [item.id, item.label]),
    );
    const filteredRecords = filterRouterUsageRecords(routerDataset.records, query);
    const mappedRecords = filteredRecords.map((item, index) =>
      mapRouterUsageRecord(item, index, apiKeyOptionsById),
    );

    return paginateUsageRecords(sortUsageRecords(mappedRecords, query), query);
  }
}

export const apiRouterService = new DefaultApiRouterService();
