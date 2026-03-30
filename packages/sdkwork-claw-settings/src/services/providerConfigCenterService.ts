import { openClawConfigService, type OpenClawProviderRuntimeConfig } from '@sdkwork/claw-core';
import { storage, studio, type StoragePlatformAPI, type StudioPlatformAPI } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/claw-types';

export const PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE = 'studio.provider-center';
const DEFAULT_SQLITE_PROFILE_ID = 'default-sqlite';
const PROVIDER_CONFIG_ID_PREFIX = 'provider-config-';

export interface ProviderConfigModelRecord {
  id: string;
  name: string;
}

export interface ProviderConfigDraft {
  presetId?: string;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  models: ProviderConfigModelRecord[];
  notes?: string;
  config?: Partial<OpenClawProviderRuntimeConfig>;
}

export interface ProviderConfigRecord {
  id: string;
  presetId?: string;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  models: ProviderConfigModelRecord[];
  notes?: string;
  config: OpenClawProviderRuntimeConfig;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderConfigPreset {
  id: string;
  label: string;
  description: string;
  draft: ProviderConfigDraft;
}

export interface ProviderConfigApplyInstance {
  id: string;
  name: string;
  isDefault: boolean;
  status: StudioInstanceRecord['status'];
  deploymentMode: StudioInstanceRecord['deploymentMode'];
  configPath: string;
}

export interface ProviderConfigApplyAgent {
  id: string;
  name: string;
  isDefault: boolean;
  primaryModel?: string;
}

export interface ProviderConfigApplyTarget {
  instance: ProviderConfigApplyInstance;
  agents: ProviderConfigApplyAgent[];
}

export interface ApplyProviderConfigInput {
  instanceId: string;
  config: ProviderConfigRecord;
  agentIds?: string[];
}

interface ProviderConfigCenterServiceDependencies {
  storageApi: StoragePlatformAPI;
  studioApi: Pick<StudioPlatformAPI, 'listInstances' | 'getInstanceDetail'>;
  openClawConfigService: Pick<
    typeof openClawConfigService,
    'resolveInstanceConfigPath' | 'readConfigSnapshot' | 'saveProviderSelection' | 'saveAgent'
  >;
  now: () => number;
}

export interface ProviderConfigCenterServiceOverrides {
  storageApi?: ProviderConfigCenterServiceDependencies['storageApi'];
  studioApi?: Partial<ProviderConfigCenterServiceDependencies['studioApi']>;
  openClawConfigService?: Partial<ProviderConfigCenterServiceDependencies['openClawConfigService']>;
  now?: ProviderConfigCenterServiceDependencies['now'];
}

function createDefaultRuntimeConfig(): OpenClawProviderRuntimeConfig {
  return {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: true,
  };
}

function normalizeFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeRuntimeConfig(
  input?: Partial<OpenClawProviderRuntimeConfig> | null,
): OpenClawProviderRuntimeConfig {
  const defaults = createDefaultRuntimeConfig();

  return {
    temperature: normalizeFiniteNumber(input?.temperature, defaults.temperature),
    topP: normalizeFiniteNumber(input?.topP, defaults.topP),
    maxTokens: Math.max(1, Math.round(normalizeFiniteNumber(input?.maxTokens, defaults.maxTokens))),
    timeoutMs: Math.max(
      1000,
      Math.round(normalizeFiniteNumber(input?.timeoutMs, defaults.timeoutMs)),
    ),
    streaming: typeof input?.streaming === 'boolean' ? input.streaming : defaults.streaming,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function normalizeProviderId(providerId: string) {
  return providerId
    .trim()
    .toLowerCase()
    .replace(/^api-router-/, '');
}

function normalizeModelId(modelId: string) {
  return modelId.trim();
}

function normalizeModelName(model: ProviderConfigModelRecord) {
  const id = normalizeModelId(model.id);
  const name = model.name.trim();
  return {
    id,
    name: name || id,
  };
}

function normalizeModels(models: ProviderConfigModelRecord[]) {
  return Array.from(
    new Map(
      models
        .map(normalizeModelName)
        .filter((model) => model.id)
        .map((model) => [model.id, model] as const),
    ).values(),
  );
}

function normalizeOptionalModelId(modelId?: string) {
  const normalized = modelId?.trim();
  return normalized ? normalized : undefined;
}

function normalizeDraft(input: ProviderConfigDraft): ProviderConfigDraft {
  return {
    presetId: input.presetId?.trim() || undefined,
    name: input.name.trim(),
    providerId: normalizeProviderId(input.providerId),
    baseUrl: input.baseUrl.trim(),
    apiKey: input.apiKey.trim(),
    defaultModelId: normalizeModelId(input.defaultModelId),
    reasoningModelId: normalizeOptionalModelId(input.reasoningModelId),
    embeddingModelId: normalizeOptionalModelId(input.embeddingModelId),
    models: normalizeModels(input.models),
    notes: input.notes?.trim() || undefined,
    config: normalizeRuntimeConfig(input.config),
  };
}

function buildRecordId(providerId: string, now: number) {
  const slug = slugify(providerId) || 'provider';
  return `${PROVIDER_CONFIG_ID_PREFIX}${slug}-${now.toString(36)}`;
}

function parseStoredRecord(value: string | null): ProviderConfigRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ProviderConfigRecord>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      presetId: typeof parsed.presetId === 'string' ? parsed.presetId : undefined,
      name: typeof parsed.name === 'string' ? parsed.name : '',
      providerId: normalizeProviderId(typeof parsed.providerId === 'string' ? parsed.providerId : ''),
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      defaultModelId: typeof parsed.defaultModelId === 'string' ? parsed.defaultModelId : '',
      reasoningModelId:
        typeof parsed.reasoningModelId === 'string' ? parsed.reasoningModelId : undefined,
      embeddingModelId:
        typeof parsed.embeddingModelId === 'string' ? parsed.embeddingModelId : undefined,
      models: normalizeModels(Array.isArray(parsed.models) ? parsed.models : []),
      notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
      config: normalizeRuntimeConfig(parsed.config),
      createdAt:
        typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt)
          ? parsed.createdAt
          : 0,
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : 0,
    };
  } catch {
    return null;
  }
}

function sortRecords(records: ProviderConfigRecord[]) {
  return [...records].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildAgentModelRef(providerId: string, modelId: string) {
  return `${normalizeProviderId(providerId)}/${normalizeModelId(modelId)}`;
}

function toUniqueIds(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function ensureWritableOpenClawDetail(
  detail: StudioInstanceDetailRecord | null,
  configPath: string | null,
): ProviderConfigApplyInstance {
  if (!detail || detail.instance.runtimeKind !== 'openclaw') {
    throw new Error('Only OpenClaw instances support provider quick apply.');
  }

  if (!detail.lifecycle.configWritable || !configPath) {
    throw new Error('The selected OpenClaw instance does not expose a writable config file.');
  }

  return {
    id: detail.instance.id,
    name: detail.instance.name,
    isDefault: detail.instance.isDefault,
    status: detail.instance.status,
    deploymentMode: detail.instance.deploymentMode,
    configPath,
  };
}

function createPresets(): ProviderConfigPreset[] {
  return [
    {
      id: 'openai',
      label: 'OpenAI',
      description: 'OpenAI-compatible route with GPT-5 and embedding defaults.',
      draft: {
        presetId: 'openai',
        name: 'OpenAI',
        providerId: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4' },
          { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
          { id: 'o4-mini', name: 'o4-mini' },
          { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
        ],
      },
    },
    {
      id: 'anthropic',
      label: 'Anthropic',
      description: 'Anthropic Claude route preset.',
      draft: {
        presetId: 'anthropic',
        name: 'Anthropic',
        providerId: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
        defaultModelId: 'claude-sonnet-4-20250514',
        reasoningModelId: 'claude-opus-4-20250514',
        models: [
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
          { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
        ],
      },
    },
    {
      id: 'google',
      label: 'Google Gemini',
      description: 'Gemini-compatible Google AI Studio route preset.',
      draft: {
        presetId: 'google',
        name: 'Google Gemini',
        providerId: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: '',
        defaultModelId: 'gemini-3-flash-preview',
        reasoningModelId: 'gemini-3.1-pro-preview',
        models: [
          { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
          { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
        ],
        notes:
          'Use Gemini-compatible routed credentials. Gemini CLI can reuse the routed gateway through GEMINI_API_KEY and GOOGLE_GEMINI_BASE_URL.',
      },
    },
    {
      id: 'xai',
      label: 'xAI',
      description: 'xAI Grok preset for the native Responses API endpoint.',
      draft: {
        presetId: 'xai',
        name: 'xAI',
        providerId: 'xai',
        baseUrl: 'https://api.x.ai/v1',
        apiKey: '',
        defaultModelId: 'grok-4',
        reasoningModelId: 'grok-4-fast',
        models: [
          { id: 'grok-4', name: 'Grok 4' },
          { id: 'grok-4-fast', name: 'Grok 4 Fast' },
          { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast' },
        ],
        notes:
          'Use an xAI API key with the native Responses API endpoint. OpenClaw can expose X search when the xAI plugin and tool allowlist are enabled for the runtime or agent.',
      },
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      description: 'DeepSeek chat and reasoning route preset.',
      draft: {
        presetId: 'deepseek',
        name: 'DeepSeek',
        providerId: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        defaultModelId: 'deepseek-chat',
        reasoningModelId: 'deepseek-reasoner',
        models: [
          { id: 'deepseek-chat', name: 'DeepSeek Chat' },
          { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
        ],
      },
    },
    {
      id: 'minimax',
      label: 'MiniMax',
      description: 'MiniMax M2.7 preset for the current OpenClaw global and CN Anthropic routes.',
      draft: {
        presetId: 'minimax',
        name: 'MiniMax',
        providerId: 'minimax',
        baseUrl: 'https://api.minimax.io/anthropic',
        apiKey: '',
        defaultModelId: 'MiniMax-M2.7',
        reasoningModelId: 'MiniMax-M2.7-highspeed',
        models: [
          { id: 'MiniMax-M2.7', name: 'MiniMax M2.7' },
          { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed' },
        ],
        notes:
          'Use https://api.minimax.io/anthropic for the global route or https://api.minimaxi.com/anthropic for the CN route. OpenClaw 2026.3.28 also exposes MiniMax image generation through image-01 on the dedicated media path.',
      },
    },
    {
      id: 'qwen',
      label: 'Qwen',
      description: 'Qwen preset for Alibaba Cloud Model Studio (DashScope).',
      draft: {
        presetId: 'qwen',
        name: 'Qwen',
        providerId: 'qwen',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: '',
        defaultModelId: 'qwen-max',
        reasoningModelId: 'qwq-plus',
        embeddingModelId: 'text-embedding-v4',
        models: [
          { id: 'qwen-max', name: 'Qwen Max' },
          { id: 'qwq-plus', name: 'QwQ Plus' },
          { id: 'text-embedding-v4', name: 'Text Embedding V4' },
        ],
        notes:
          'Use Alibaba Cloud Model Studio / DashScope API keys. OpenClaw no longer supports portal.qwen.ai OAuth onboarding.',
      },
    },
  ].map((preset) => ({
    ...preset,
    draft: normalizeDraft({
      ...preset.draft,
      config: createDefaultRuntimeConfig(),
    }),
  }));
}

class ProviderConfigCenterService {
  private readonly dependencies: ProviderConfigCenterServiceDependencies;

  constructor(dependencies: ProviderConfigCenterServiceDependencies) {
    this.dependencies = dependencies;
  }

  listPresets() {
    return createPresets();
  }

  private async resolveStorageProfileId() {
    const info = await this.dependencies.storageApi.getStorageInfo().catch(() => null);
    const writableSqliteProfiles =
      info?.profiles.filter((profile) => profile.provider === 'sqlite' && !profile.readOnly) || [];

    if (writableSqliteProfiles.length > 0) {
      const activeSqliteProfile = writableSqliteProfiles.find((profile) => profile.active);
      return activeSqliteProfile?.id || writableSqliteProfiles[0]!.id;
    }

    return (
      info?.profiles.find((profile) => profile.id === DEFAULT_SQLITE_PROFILE_ID && !profile.readOnly)
        ?.id ||
      info?.profiles.find((profile) => profile.active && !profile.readOnly)?.id ||
      DEFAULT_SQLITE_PROFILE_ID
    );
  }

  async listProviderConfigs() {
    const profileId = await this.resolveStorageProfileId();
    const response = await this.dependencies.storageApi.listKeys({
      profileId,
      namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
    });
    const records = await Promise.all(
      response.keys.map(async (key) => {
        const entry = await this.dependencies.storageApi.getText({
          profileId,
          namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
          key,
        });
        return parseStoredRecord(entry.value);
      }),
    );

    return sortRecords(records.filter((record): record is ProviderConfigRecord => Boolean(record)));
  }

  async saveProviderConfig(input: ProviderConfigDraft & { id?: string }) {
    const normalized = normalizeDraft(input);
    if (!normalized.name) {
      throw new Error('Provider config name is required.');
    }
    if (!normalized.providerId) {
      throw new Error('Provider id is required.');
    }
    if (!normalized.defaultModelId) {
      throw new Error('Default model is required.');
    }
    if (normalized.models.length === 0) {
      throw new Error('At least one model is required.');
    }
    if (!normalized.models.some((model) => model.id === normalized.defaultModelId)) {
      throw new Error('Default model must exist in the model list.');
    }
    if (
      normalized.reasoningModelId &&
      !normalized.models.some((model) => model.id === normalized.reasoningModelId)
    ) {
      throw new Error('Reasoning model must exist in the model list.');
    }
    if (
      normalized.embeddingModelId &&
      !normalized.models.some((model) => model.id === normalized.embeddingModelId)
    ) {
      throw new Error('Embedding model must exist in the model list.');
    }

    const now = this.dependencies.now();
    const profileId = await this.resolveStorageProfileId();
    const existingRecord =
      input.id && input.id.trim()
        ? (await this.dependencies.storageApi.getText({
            profileId,
            namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
            key: input.id.trim(),
          }).catch(() => null))
        : null;
    const parsedExistingRecord = parseStoredRecord(existingRecord?.value || null);
    const id = input.id?.trim() || buildRecordId(normalized.providerId, now);

    const record: ProviderConfigRecord = {
      id,
      presetId: normalized.presetId,
      name: normalized.name,
      providerId: normalized.providerId,
      baseUrl: normalized.baseUrl,
      apiKey: normalized.apiKey,
      defaultModelId: normalized.defaultModelId,
      reasoningModelId: normalized.reasoningModelId,
      embeddingModelId: normalized.embeddingModelId,
      models: normalized.models,
      notes: normalized.notes,
      config: normalizeRuntimeConfig(normalized.config),
      createdAt: parsedExistingRecord?.createdAt || now,
      updatedAt: now,
    };

    await this.dependencies.storageApi.putText({
      profileId,
      namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
      key: id,
      value: JSON.stringify(record),
    });

    return record;
  }

  async deleteProviderConfig(id: string) {
    const profileId = await this.resolveStorageProfileId();
    const result = await this.dependencies.storageApi.delete({
      profileId,
      namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
      key: id.trim(),
    });

    return result.existed;
  }

  private async resolveApplyInstance(instanceId: string) {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId);
    const configPath = this.dependencies.openClawConfigService.resolveInstanceConfigPath(detail);
    return ensureWritableOpenClawDetail(detail, configPath);
  }

  async listApplyInstances() {
    const instances = await this.dependencies.studioApi.listInstances();
    const openClawInstances = instances.filter((instance) => instance.runtimeKind === 'openclaw');
    const resolved = await Promise.all(
      openClawInstances.map(async (instance) => {
        try {
          return await this.resolveApplyInstance(instance.id);
        } catch {
          return null;
        }
      }),
    );

    return resolved.filter((instance): instance is ProviderConfigApplyInstance => Boolean(instance));
  }

  async getInstanceApplyTarget(instanceId: string): Promise<ProviderConfigApplyTarget> {
    const instance = await this.resolveApplyInstance(instanceId);
    const snapshot = await this.dependencies.openClawConfigService.readConfigSnapshot(
      instance.configPath,
    );

    return {
      instance,
      agents: (snapshot.agentSnapshots || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        isDefault: agent.isDefault,
        primaryModel: agent.model.primary,
      })),
    };
  }

  async applyProviderConfig(input: ApplyProviderConfigInput) {
    const instance = await this.resolveApplyInstance(input.instanceId);
    const record = input.config;

    await this.dependencies.openClawConfigService.saveProviderSelection({
      configPath: instance.configPath,
      provider: {
        id: record.providerId,
        channelId: record.providerId,
        name: record.name,
        apiKey: record.apiKey,
        baseUrl: record.baseUrl,
        models: record.models.map((model) => ({
          id: model.id,
          name: model.name,
        })),
        notes: record.notes,
        config: record.config,
      },
      selection: {
        defaultModelId: record.defaultModelId,
        reasoningModelId: record.reasoningModelId,
        embeddingModelId: record.embeddingModelId,
      },
    });

    const agentIds = toUniqueIds(input.agentIds || []);
    const fallbacks = record.reasoningModelId
      ? [buildAgentModelRef(record.providerId, record.reasoningModelId)]
      : [];

    for (const agentId of agentIds) {
      await this.dependencies.openClawConfigService.saveAgent({
        configPath: instance.configPath,
        agent: {
          id: agentId,
          model: {
            primary: buildAgentModelRef(record.providerId, record.defaultModelId),
            fallbacks,
          },
        },
      });
    }
  }
}

function createDefaultDependencies(): ProviderConfigCenterServiceDependencies {
  return {
    storageApi: storage,
    studioApi: {
      listInstances: () => studio.listInstances(),
      getInstanceDetail: (instanceId) => studio.getInstanceDetail(instanceId),
    },
    openClawConfigService: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
      readConfigSnapshot: (configPath) => openClawConfigService.readConfigSnapshot(configPath),
      saveProviderSelection: (input) => openClawConfigService.saveProviderSelection(input),
      saveAgent: (input) => openClawConfigService.saveAgent(input),
    },
    now: () => Date.now(),
  };
}

export function createProviderConfigCenterService(
  overrides: ProviderConfigCenterServiceOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new ProviderConfigCenterService({
    storageApi: overrides.storageApi || defaults.storageApi,
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawConfigService: {
      ...defaults.openClawConfigService,
      ...(overrides.openClawConfigService || {}),
    },
    now: overrides.now || defaults.now,
  });
}

export const providerConfigCenterService = createProviderConfigCenterService();
