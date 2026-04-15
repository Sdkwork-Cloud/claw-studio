import {
  inferLocalAiProxyClientProtocol,
  inferLocalAiProxyUpstreamProtocol,
  listKnownProviderRoutingChannels,
  LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
  LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
  OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER,
  OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
  createOpenClawLocalProxyProjection,
  createDefaultOpenClawProviderRuntimeConfig,
  createProviderRoutingCatalogService,
  kernelPlatformService,
  normalizeOpenClawProviderRuntimeConfig,
  normalizeLegacyProviderId,
  openClawConfigService,
  providerRoutingCatalogService,
  resolveOpenClawLocalProxyBaseUrl,
  type OpenClawProviderRuntimeConfig,
} from '@sdkwork/claw-core';
import {
  storage,
  studio,
  type StoragePlatformAPI,
  type StudioPlatformAPI,
} from '@sdkwork/claw-infrastructure';
import type {
  LocalAiProxyClientProtocol,
  LocalAiProxyRouteManagedBy,
  LocalAiProxyRouteModelRecord,
  LocalAiProxyRouteRecord,
  LocalAiProxyRouteRuntimeMetrics,
  LocalAiProxyRouteTestRecord,
  LocalAiProxyUpstreamProtocol,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';

export { PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE } from '@sdkwork/claw-core';

export type ProviderConfigModelRecord = LocalAiProxyRouteModelRecord;

export interface ProviderConfigDraft {
  presetId?: string;
  name: string;
  providerId: string;
  clientProtocol?: LocalAiProxyClientProtocol;
  upstreamProtocol?: LocalAiProxyUpstreamProtocol;
  upstreamBaseUrl?: string;
  baseUrl?: string;
  apiKey: string;
  enabled?: boolean;
  isDefault?: boolean;
  managedBy?: LocalAiProxyRouteManagedBy;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  models: ProviderConfigModelRecord[];
  notes?: string;
  exposeTo?: string[];
  config?: Partial<OpenClawProviderRuntimeConfig>;
}

export interface ProviderConfigRecord extends LocalAiProxyRouteRecord {
  presetId?: string;
  baseUrl: string;
  config: OpenClawProviderRuntimeConfig;
  createdAt: number;
  updatedAt: number;
  runtimeMetrics?: LocalAiProxyRouteRuntimeMetrics;
  latestTest?: LocalAiProxyRouteTestRecord | null;
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

export interface ProviderConfigCenterActionSupportItem {
  available: boolean;
  reasonKey?:
    | 'runtimeUnavailable'
    | 'runtimeStatusUnavailable'
    | 'quickApplyTargetsUnavailable'
    | 'quickApplyInstanceUnavailable'
    | 'quickApplyRequiresLoopback';
  reason?: string;
}

export interface ProviderConfigCenterActionSupport {
  quickApply: ProviderConfigCenterActionSupportItem;
  test: ProviderConfigCenterActionSupportItem;
}

type ProviderRoutingCatalogApi = Pick<
  typeof providerRoutingCatalogService,
  'listProviderRoutingRecords' | 'saveProviderRoutingRecord' | 'deleteProviderRoutingRecord'
>;

interface ProviderConfigCenterServiceDependencies {
  providerRoutingApi: ProviderRoutingCatalogApi;
  studioApi: Pick<StudioPlatformAPI, 'listInstances' | 'getInstanceDetail'>;
  kernelPlatformService: Pick<
    typeof kernelPlatformService,
    'ensureRunning' | 'getInfo' | 'testLocalAiProxyRoute'
  >;
  openClawConfigService: Pick<
    typeof openClawConfigService,
    | 'resolveInstanceConfigPath'
    | 'readConfigSnapshot'
    | 'saveManagedLocalProxyProjection'
    | 'saveAgent'
  >;
}

export interface ProviderConfigCenterServiceOverrides {
  storageApi?: StoragePlatformAPI;
  providerRoutingApi?: Partial<ProviderRoutingCatalogApi>;
  studioApi?: Partial<ProviderConfigCenterServiceDependencies['studioApi']>;
  kernelPlatformService?: Partial<ProviderConfigCenterServiceDependencies['kernelPlatformService']>;
  openClawConfigService?: Partial<ProviderConfigCenterServiceDependencies['openClawConfigService']>;
  now?: () => number;
}

const LOCAL_AI_PROXY_RUNTIME_UNAVAILABLE_ERROR =
  'The local AI proxy runtime is not available for the active platform bridge.';
const LOCAL_AI_PROXY_RUNTIME_STATUS_UNAVAILABLE_ERROR =
  'The local AI proxy runtime status is temporarily unavailable.';
const OPENCLAW_QUICK_APPLY_INSTANCE_UNAVAILABLE_ERROR =
  'No writable OpenClaw instance is available for quick apply.';
const OPENCLAW_QUICK_APPLY_TARGETS_UNAVAILABLE_ERROR =
  'Quick apply targets are temporarily unavailable.';
const OPENCLAW_QUICK_APPLY_REQUIRES_LOOPBACK_ERROR =
  'Quick apply requires a loopback-only local AI proxy runtime.';
const LOCAL_AI_PROXY_CLIENT_PROTOCOLS: LocalAiProxyClientProtocol[] = [
  'openai-compatible',
  'anthropic',
  'gemini',
];

function hasAvailableLocalAiProxyRuntime(
  kernelInfo: Awaited<ReturnType<ProviderConfigCenterServiceDependencies['kernelPlatformService']['getInfo']>>,
) {
  return LOCAL_AI_PROXY_CLIENT_PROTOCOLS.some((clientProtocol) =>
    Boolean(resolveOpenClawLocalProxyBaseUrl(kernelInfo, clientProtocol)),
  );
}

function hasLoopbackOnlyLocalAiProxyRuntime(
  kernelInfo: Awaited<ReturnType<ProviderConfigCenterServiceDependencies['kernelPlatformService']['getInfo']>>,
) {
  return kernelInfo?.localAiProxy?.loopbackOnly === true;
}

function normalizeRuntimeConfig(
  input?: Partial<OpenClawProviderRuntimeConfig> | null,
): OpenClawProviderRuntimeConfig {
  return normalizeOpenClawProviderRuntimeConfig(input);
}

function normalizeProviderId(providerId: string | undefined | null) {
  return normalizeLegacyProviderId(providerId).toLowerCase();
}

function normalizeModelId(modelId: string | undefined | null) {
  return (modelId || '').trim();
}

function normalizeModelName(model: ProviderConfigModelRecord) {
  const id = normalizeModelId(model.id);
  const name = (model.name || '').trim();
  return {
    id,
    name: name || id,
  };
}

function normalizeModels(models: ProviderConfigModelRecord[]) {
  return Array.from(
    new Map(
      (models || [])
        .map(normalizeModelName)
        .filter((model) => model.id)
        .map((model) => [model.id, model] as const),
    ).values(),
  );
}

function normalizeOptionalModelId(modelId?: string) {
  const normalized = normalizeModelId(modelId);
  return normalized || undefined;
}

function normalizeExposeTo(exposeTo?: string[]) {
  return Array.from(
    new Set((exposeTo || []).map((entry) => entry.trim()).filter(Boolean)),
  );
}

function normalizeDraft(input: ProviderConfigDraft): ProviderConfigDraft {
  const upstreamBaseUrl = (input.upstreamBaseUrl ?? input.baseUrl ?? '').trim();

  return {
    presetId: input.presetId?.trim() || undefined,
    name: input.name.trim(),
    providerId: normalizeProviderId(input.providerId),
    clientProtocol: input.clientProtocol,
    upstreamProtocol: input.upstreamProtocol,
    upstreamBaseUrl,
    baseUrl: upstreamBaseUrl,
    apiKey: input.apiKey.trim(),
    enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
    isDefault: input.isDefault === true,
    managedBy: input.managedBy || 'user',
    defaultModelId: normalizeModelId(input.defaultModelId),
    reasoningModelId: normalizeOptionalModelId(input.reasoningModelId),
    embeddingModelId: normalizeOptionalModelId(input.embeddingModelId),
    models: normalizeModels(input.models),
    notes: input.notes?.trim() || undefined,
    exposeTo: normalizeExposeTo(input.exposeTo),
    config: normalizeRuntimeConfig(input.config),
  };
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

function createPresetDraft(input: ProviderConfigDraft): ProviderConfigDraft {
  return normalizeDraft({
    ...input,
    clientProtocol: input.clientProtocol || inferLocalAiProxyClientProtocol(input.providerId),
    enabled: true,
    isDefault: false,
    managedBy: 'user',
    exposeTo: input.exposeTo || ['openclaw'],
    config: createDefaultOpenClawProviderRuntimeConfig(),
  });
}

function createTemplatePreset(
  channel: ReturnType<typeof listKnownProviderRoutingChannels>[number],
): ProviderConfigPreset {
  return {
    id: channel.id,
    label: channel.name,
    description: `${channel.description} Fill in model ids for this provider or keep the SDKWork upstream fallback.`,
    draft: createPresetDraft({
      presetId: channel.id,
      name: channel.name,
      providerId: channel.id,
      upstreamProtocol: inferLocalAiProxyUpstreamProtocol(channel.id),
      upstreamBaseUrl: LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
      apiKey: '',
      defaultModelId: '',
      reasoningModelId: undefined,
      embeddingModelId: undefined,
      models: [],
    }),
  };
}

function createCuratedPresets(): ProviderConfigPreset[] {
  return [
    {
      id: 'sdkwork',
      label: 'SDKWork',
      description:
        'SDKWork universal gateway preset with OpenAI, Gemini, and Claude Code compatible APIs across mainstream global and China model families.',
      draft: createPresetDraft({
        presetId: 'sdkwork',
        name: 'SDKWork',
        providerId: 'sdkwork',
        upstreamProtocol: 'sdkwork',
        upstreamBaseUrl: LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
        apiKey: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4' },
          { id: 'o4-mini', name: 'o4-mini' },
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'deepseek-chat', name: 'DeepSeek Chat' },
          { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
          { id: 'glm-5.1', name: 'GLM-5.1' },
          { id: 'glm-5v-turbo', name: 'GLM-5V Turbo' },
          { id: 'qwen-max', name: 'Qwen Max' },
          { id: 'qwq-plus', name: 'QwQ Plus' },
          { id: 'minimax-m1', name: 'MiniMax M1' },
          { id: 'kimi-k2', name: 'Moonshot Kimi K2' },
          { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
        ],
      }),
    },
    {
      id: 'openai',
      label: 'OpenAI',
      description: 'OpenAI-compatible route with GPT-5 and embedding defaults.',
      draft: createPresetDraft({
        presetId: 'openai',
        name: 'OpenAI',
        providerId: 'openai',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.openai.com/v1',
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
      }),
    },
    {
      id: 'anthropic',
      label: 'Anthropic',
      description: 'Anthropic Claude route preset.',
      draft: createPresetDraft({
        presetId: 'anthropic',
        name: 'Anthropic',
        providerId: 'anthropic',
        upstreamProtocol: 'anthropic',
        upstreamBaseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
        defaultModelId: 'claude-sonnet-4-20250514',
        reasoningModelId: 'claude-opus-4-20250514',
        models: [
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
          { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
        ],
      }),
    },
    {
      id: 'cloudflare-ai-gateway',
      label: 'Cloudflare AI Gateway',
      description:
        'Cloudflare AI Gateway Anthropic-compatible preset with the official gateway URL shape and Claude Sonnet 4.5 starter model. Add optional cf-aig-authorization headers through Request Overrides when gateway auth is enabled.',
      draft: createPresetDraft({
        presetId: 'cloudflare-ai-gateway',
        name: 'Cloudflare AI Gateway',
        providerId: 'cloudflare-ai-gateway',
        clientProtocol: 'anthropic',
        upstreamProtocol: 'anthropic',
        upstreamBaseUrl: 'https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic',
        apiKey: '',
        defaultModelId: 'cloudflare-ai-gateway/claude-sonnet-4-5',
        reasoningModelId: 'cloudflare-ai-gateway/claude-sonnet-4-5',
        models: [
          {
            id: 'cloudflare-ai-gateway/claude-sonnet-4-5',
            name: 'Claude Sonnet 4.5 (Cloudflare AI Gateway)',
          },
        ],
      }),
    },
    {
      id: 'gemini',
      label: 'Gemini',
      description: 'Google Gemini native route preset.',
      draft: createPresetDraft({
        presetId: 'gemini',
        name: 'Gemini',
        providerId: 'google',
        upstreamProtocol: 'gemini',
        upstreamBaseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        defaultModelId: 'gemini-2.5-pro',
        reasoningModelId: 'gemini-2.5-pro',
        embeddingModelId: 'text-embedding-004',
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'text-embedding-004', name: 'text-embedding-004' },
        ],
      }),
    },
    {
      id: 'xai',
      label: 'xAI',
      description: 'xAI Grok route preset.',
      draft: createPresetDraft({
        presetId: 'xai',
        name: 'xAI',
        providerId: 'xai',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.x.ai/v1',
        apiKey: '',
        defaultModelId: 'grok-4',
        reasoningModelId: 'grok-4',
        models: [
          { id: 'grok-4', name: 'Grok 4' },
          { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning' },
        ],
      }),
    },
    {
      id: 'groq',
      label: 'Groq',
      description:
        'Groq OpenAI-compatible route preset with the official Llama 3.3 70B Versatile starter model.',
      draft: createPresetDraft({
        presetId: 'groq',
        name: 'Groq',
        providerId: 'groq',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.groq.com/openai/v1',
        apiKey: '',
        defaultModelId: 'llama-3.3-70b-versatile',
        models: [{ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' }],
      }),
    },
    {
      id: 'ollama',
      label: 'Ollama',
      description:
        'Ollama native local-runtime preset aligned with the official OpenClaw provider guide and localhost deployment default.',
      draft: createPresetDraft({
        presetId: 'ollama',
        name: 'Ollama',
        providerId: 'ollama',
        upstreamProtocol: 'ollama',
        upstreamBaseUrl: 'http://127.0.0.1:11434',
        apiKey: 'ollama-local',
        defaultModelId: 'glm-4.7-flash',
        models: [
          { id: 'glm-4.7-flash', name: 'GLM 4.7 Flash' },
          { id: 'gpt-oss:20b', name: 'GPT-OSS 20B' },
          { id: 'nomic-embed-text', name: 'nomic-embed-text' },
        ],
      }),
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      description: 'DeepSeek chat and reasoning route preset.',
      draft: createPresetDraft({
        presetId: 'deepseek',
        name: 'DeepSeek',
        providerId: 'deepseek',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        defaultModelId: 'deepseek-chat',
        reasoningModelId: 'deepseek-reasoner',
        models: [
          { id: 'deepseek-chat', name: 'DeepSeek Chat' },
          { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
        ],
      }),
    },
    {
      id: 'qwen',
      label: 'Qwen',
      description: 'Qwen OpenAI-compatible route preset.',
      draft: createPresetDraft({
        presetId: 'qwen',
        name: 'Qwen',
        providerId: 'qwen',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: '',
        defaultModelId: 'qwen-max',
        reasoningModelId: 'qwq-plus',
        embeddingModelId: 'text-embedding-v4',
        models: [
          { id: 'qwen-max', name: 'Qwen Max' },
          { id: 'qwq-plus', name: 'QwQ Plus' },
          { id: 'text-embedding-v4', name: 'Text Embedding V4' },
        ],
      }),
    },
    {
      id: 'azure-openai',
      label: 'Azure OpenAI',
      description: 'Azure OpenAI v1 route preset for resource-scoped deployments.',
      draft: createPresetDraft({
        presetId: 'azure-openai',
        name: 'Azure OpenAI',
        providerId: 'azure-openai',
        upstreamProtocol: 'azure-openai',
        upstreamBaseUrl: 'https://YOUR-RESOURCE-NAME.openai.azure.com',
        apiKey: '',
        defaultModelId: 'gpt-4.1',
        reasoningModelId: 'gpt-4.1',
        embeddingModelId: 'text-embedding-3-large',
        models: [
          { id: 'gpt-4.1', name: 'GPT-4.1' },
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
          { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
        ],
      }),
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      description: 'OpenRouter OpenAI-compatible route preset.',
      draft: createPresetDraft({
        presetId: 'openrouter',
        name: 'OpenRouter',
        providerId: 'openrouter',
        upstreamProtocol: 'openrouter',
        upstreamBaseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '',
        defaultModelId: 'openai/gpt-4o',
        reasoningModelId: 'anthropic/claude-3.7-sonnet',
        models: [
          { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
          { id: 'anthropic/claude-3.7-sonnet', name: 'Anthropic Claude 3.7 Sonnet' },
          { id: 'google/gemini-2.5-pro', name: 'Google Gemini 2.5 Pro' },
        ],
      }),
    },
    {
      id: 'vercel-ai-gateway',
      label: 'Vercel AI Gateway',
      description:
        'Vercel AI Gateway Anthropic-compatible preset with the official Claude Opus 4.6 starter model and multi-provider gateway examples.',
      draft: createPresetDraft({
        presetId: 'vercel-ai-gateway',
        name: 'Vercel AI Gateway',
        providerId: 'vercel-ai-gateway',
        clientProtocol: 'anthropic',
        upstreamProtocol: 'anthropic',
        upstreamBaseUrl: 'https://ai-gateway.vercel.sh',
        apiKey: '',
        defaultModelId: 'anthropic/claude-opus-4.6',
        reasoningModelId: 'anthropic/claude-opus-4.6',
        models: [
          { id: 'anthropic/claude-opus-4.6', name: 'Anthropic Claude Opus 4.6' },
          { id: 'openai/gpt-5.4', name: 'OpenAI GPT-5.4' },
          { id: 'xai/grok-4-fast-reasoning', name: 'xAI Grok 4 Fast Reasoning' },
        ],
      }),
    },
    {
      id: 'litellm',
      label: 'LiteLLM',
      description:
        'LiteLLM gateway preset aligned with the official local proxy example for a localhost deployment.',
      draft: createPresetDraft({
        presetId: 'litellm',
        name: 'LiteLLM',
        providerId: 'litellm',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'http://localhost:4000',
        apiKey: '',
        defaultModelId: 'claude-opus-4-6',
        models: [
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
          { id: 'gpt-4o', name: 'GPT-4o' },
        ],
      }),
    },
    {
      id: 'together',
      label: 'Together',
      description:
        'Together AI OpenAI-compatible route preset with the official Kimi K2.5 starter model.',
      draft: createPresetDraft({
        presetId: 'together',
        name: 'Together',
        providerId: 'together',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.together.xyz/v1',
        apiKey: '',
        defaultModelId: 'moonshotai/Kimi-K2.5',
        models: [
          { id: 'moonshotai/Kimi-K2.5', name: 'Kimi K2.5' },
          { id: 'zai-org/GLM-4.7', name: 'GLM-4.7' },
        ],
      }),
    },
    {
      id: 'fireworks',
      label: 'Fireworks',
      description:
        'Fireworks OpenAI-compatible preset with the bundled Kimi K2.5 Turbo Fire Pass starter model.',
      draft: createPresetDraft({
        presetId: 'fireworks',
        name: 'Fireworks',
        providerId: 'fireworks',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.fireworks.ai/inference/v1',
        apiKey: '',
        defaultModelId: 'fireworks/accounts/fireworks/routers/kimi-k2p5-turbo',
        models: [
          {
            id: 'fireworks/accounts/fireworks/routers/kimi-k2p5-turbo',
            name: 'Kimi K2.5 Turbo (Fire Pass)',
          },
        ],
      }),
    },
    {
      id: 'amazon-bedrock-mantle',
      label: 'Amazon Bedrock Mantle',
      description:
        'Amazon Bedrock Mantle OpenAI-compatible preset with the documented us-east-1 manual configuration sample.',
      draft: createPresetDraft({
        presetId: 'amazon-bedrock-mantle',
        name: 'Amazon Bedrock Mantle',
        providerId: 'amazon-bedrock-mantle',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://bedrock-mantle.us-east-1.api.aws/v1',
        apiKey: '',
        defaultModelId: 'gpt-oss-120b',
        reasoningModelId: 'gpt-oss-120b',
        models: [{ id: 'gpt-oss-120b', name: 'GPT-OSS 120B' }],
      }),
    },
    {
      id: 'kilocode',
      label: 'Kilo Code',
      description:
        'Kilo Gateway OpenAI-compatible preset with the official auto-routing starter model.',
      draft: createPresetDraft({
        presetId: 'kilocode',
        name: 'Kilo Code',
        providerId: 'kilocode',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.kilo.ai/api/gateway/',
        apiKey: '',
        defaultModelId: 'kilo/auto',
        models: [{ id: 'kilo/auto', name: 'Kilo Auto' }],
      }),
    },
    {
      id: 'venice',
      label: 'Venice',
      description:
        'Venice AI OpenAI-compatible preset with the current Kimi K2.5 starter model from the official docs.',
      draft: createPresetDraft({
        presetId: 'venice',
        name: 'Venice',
        providerId: 'venice',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://api.venice.ai/api/v1',
        apiKey: '',
        defaultModelId: 'kimi-k2-5',
        models: [{ id: 'kimi-k2-5', name: 'Kimi K2.5' }],
      }),
    },
    {
      id: 'vllm',
      label: 'vLLM',
      description:
        'vLLM local OpenAI-compatible preset with the official localhost endpoint and placeholder API key.',
      draft: createPresetDraft({
        presetId: 'vllm',
        name: 'vLLM',
        providerId: 'vllm',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'http://127.0.0.1:8000/v1',
        apiKey: 'vllm-local',
        defaultModelId: '',
        models: [],
      }),
    },
    {
      id: 'sglang',
      label: 'SGLang',
      description:
        'SGLang local OpenAI-compatible preset with the official localhost endpoint and placeholder API key.',
      draft: createPresetDraft({
        presetId: 'sglang',
        name: 'SGLang',
        providerId: 'sglang',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'http://127.0.0.1:30000/v1',
        apiKey: 'sglang-local',
        defaultModelId: '',
        models: [],
      }),
    },
    {
      id: 'zhipu',
      label: 'Z.AI',
      description: 'Z.AI GLM route preset for GLM-5 generation and vision-capable workloads.',
      draft: createPresetDraft({
        presetId: 'zhipu',
        name: 'Z.AI',
        providerId: 'zhipu',
        upstreamProtocol: 'openai-compatible',
        upstreamBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: '',
        defaultModelId: 'glm-5.1',
        reasoningModelId: 'glm-5.1',
        models: [
          { id: 'glm-5.1', name: 'GLM-5.1' },
          { id: 'glm-5v-turbo', name: 'GLM-5V Turbo' },
        ],
      }),
    },
  ];
}

function createPresets(): ProviderConfigPreset[] {
  const curatedPresets = createCuratedPresets();
  const coveredProviderIds = new Set(
    curatedPresets.flatMap((preset) => [
      normalizeProviderId(preset.id),
      normalizeProviderId(preset.draft.providerId),
    ]),
  );
  const templatePresets = listKnownProviderRoutingChannels()
    .filter((channel) => !coveredProviderIds.has(normalizeProviderId(channel.id)))
    .map(createTemplatePreset)
    .sort((left, right) => left.label.localeCompare(right.label));

  return [...curatedPresets, ...templatePresets];
}

function indexRouteRuntimeMetrics(
  metrics: LocalAiProxyRouteRuntimeMetrics[] | undefined | null,
) {
  return new Map((metrics || []).map((metric) => [metric.routeId, metric] as const));
}

function indexRouteLatestTests(
  tests: LocalAiProxyRouteTestRecord[] | undefined | null,
) {
  return new Map((tests || []).map((test) => [test.routeId, test] as const));
}

function attachRouteRuntimeState(
  records: ProviderConfigRecord[],
  metrics: LocalAiProxyRouteRuntimeMetrics[] | undefined | null,
  tests: LocalAiProxyRouteTestRecord[] | undefined | null,
) {
  const metricsByRouteId = indexRouteRuntimeMetrics(metrics);
  const testsByRouteId = indexRouteLatestTests(tests);

  return records.map((record) => ({
    ...record,
    runtimeMetrics: metricsByRouteId.get(record.id),
    latestTest: testsByRouteId.get(record.id) ?? null,
  }));
}

class ProviderConfigCenterService {
  private readonly dependencies: ProviderConfigCenterServiceDependencies;

  constructor(dependencies: ProviderConfigCenterServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async resolveKernelInfo() {
    try {
      return {
        info: await this.dependencies.kernelPlatformService.getInfo(),
        readFailed: false,
      };
    } catch {
      return {
        info: null,
        readFailed: true,
      };
    }
  }

  listPresets() {
    return createPresets();
  }

  async listProviderConfigs() {
    const [records, kernelInfoResult] = await Promise.all([
      this.dependencies.providerRoutingApi.listProviderRoutingRecords(),
      this.resolveKernelInfo(),
    ]);
    const kernelInfo = kernelInfoResult.info;

    return attachRouteRuntimeState(
      records,
      kernelInfo?.localAiProxy?.routeMetrics,
      kernelInfo?.localAiProxy?.routeTests,
    );
  }

  private async syncLocalAiProxyRuntime() {
    try {
      await this.dependencies.kernelPlatformService.ensureRunning();
    } catch {
      // Route catalog persistence is authoritative; runtime sync is best-effort.
    }
  }

  async saveProviderConfig(input: ProviderConfigDraft & { id?: string }) {
    const normalizedDraft = normalizeDraft(input);
    const record = await this.dependencies.providerRoutingApi.saveProviderRoutingRecord({
      ...normalizedDraft,
      id: input.id?.trim() || undefined,
    });
    await this.syncLocalAiProxyRuntime();
    return record;
  }

  async deleteProviderConfig(id: string) {
    const existed = await this.dependencies.providerRoutingApi.deleteProviderRoutingRecord(id.trim());
    await this.syncLocalAiProxyRuntime();
    return existed;
  }

  async testProviderConfigRoute(routeId: string) {
    await this.dependencies.kernelPlatformService.ensureRunning();
    const kernelInfoResult = await this.resolveKernelInfo();
    if (kernelInfoResult.readFailed) {
      throw new Error(LOCAL_AI_PROXY_RUNTIME_STATUS_UNAVAILABLE_ERROR);
    }
    if (!hasAvailableLocalAiProxyRuntime(kernelInfoResult.info)) {
      throw new Error(LOCAL_AI_PROXY_RUNTIME_UNAVAILABLE_ERROR);
    }

    const result = await this.dependencies.kernelPlatformService.testLocalAiProxyRoute(
      routeId.trim(),
    );
    if (!result) {
      throw new Error(LOCAL_AI_PROXY_RUNTIME_UNAVAILABLE_ERROR);
    }

    return result;
  }

  private async resolveApplyInstance(instanceId: string) {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId);
    const configPath = this.dependencies.openClawConfigService.resolveInstanceConfigPath(detail);
    return ensureWritableOpenClawDetail(detail, configPath);
  }

  private async listWritableOpenClawApplyInstances() {
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

  async getActionSupport(): Promise<ProviderConfigCenterActionSupport> {
    const kernelInfoResult = await this.resolveKernelInfo();
    if (kernelInfoResult.readFailed) {
      return {
        quickApply: {
          available: false,
          reasonKey: 'runtimeStatusUnavailable',
          reason: LOCAL_AI_PROXY_RUNTIME_STATUS_UNAVAILABLE_ERROR,
        },
        test: {
          available: false,
          reasonKey: 'runtimeStatusUnavailable',
          reason: LOCAL_AI_PROXY_RUNTIME_STATUS_UNAVAILABLE_ERROR,
        },
      };
    }

    if (!hasAvailableLocalAiProxyRuntime(kernelInfoResult.info)) {
      return {
        quickApply: {
          available: false,
          reasonKey: 'runtimeUnavailable',
          reason: LOCAL_AI_PROXY_RUNTIME_UNAVAILABLE_ERROR,
        },
        test: {
          available: false,
          reasonKey: 'runtimeUnavailable',
          reason: LOCAL_AI_PROXY_RUNTIME_UNAVAILABLE_ERROR,
        },
      };
    }

    if (!hasLoopbackOnlyLocalAiProxyRuntime(kernelInfoResult.info)) {
      return {
        quickApply: {
          available: false,
          reasonKey: 'quickApplyRequiresLoopback',
          reason: OPENCLAW_QUICK_APPLY_REQUIRES_LOOPBACK_ERROR,
        },
        test: {
          available: true,
        },
      };
    }

    let writableInstances: ProviderConfigApplyInstance[] = [];
    try {
      writableInstances = await this.listWritableOpenClawApplyInstances();
    } catch {
      return {
        quickApply: {
          available: false,
          reasonKey: 'quickApplyTargetsUnavailable',
          reason: OPENCLAW_QUICK_APPLY_TARGETS_UNAVAILABLE_ERROR,
        },
        test: {
          available: true,
        },
      };
    }

    return {
      quickApply:
        writableInstances.length > 0
          ? {
              available: true,
            }
          : {
              available: false,
              reasonKey: 'quickApplyInstanceUnavailable',
              reason: OPENCLAW_QUICK_APPLY_INSTANCE_UNAVAILABLE_ERROR,
            },
      test: {
        available: true,
      },
    };
  }

  async listApplyInstances() {
    const kernelInfoResult = await this.resolveKernelInfo();
    if (kernelInfoResult.readFailed || !hasAvailableLocalAiProxyRuntime(kernelInfoResult.info)) {
      return [];
    }
    if (!hasLoopbackOnlyLocalAiProxyRuntime(kernelInfoResult.info)) {
      return [];
    }

    return this.listWritableOpenClawApplyInstances();
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
    await this.dependencies.kernelPlatformService.ensureRunning();
    const kernelInfoResult = await this.resolveKernelInfo();
    if (kernelInfoResult.readFailed) {
      throw new Error(LOCAL_AI_PROXY_RUNTIME_STATUS_UNAVAILABLE_ERROR);
    }
    if (!hasLoopbackOnlyLocalAiProxyRuntime(kernelInfoResult.info)) {
      throw new Error(OPENCLAW_QUICK_APPLY_REQUIRES_LOOPBACK_ERROR);
    }
    const proxyBaseUrl = resolveOpenClawLocalProxyBaseUrl(
      kernelInfoResult.info,
      record.clientProtocol,
    );
    if (!proxyBaseUrl) {
      throw new Error('The local AI proxy is not available for OpenClaw apply.');
    }

    const projection = createOpenClawLocalProxyProjection({
      routes: [record],
      preferredClientProtocol: record.clientProtocol,
      proxyBaseUrl,
      proxyApiKey: OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER,
      runtimeConfig: record.config,
    });

    await this.dependencies.openClawConfigService.saveManagedLocalProxyProjection({
      configPath: instance.configPath,
      projection,
    });

    const agentIds = toUniqueIds(input.agentIds || []);
    const fallbacks = projection.selection.reasoningModelId
      ? [buildAgentModelRef(OPENCLAW_LOCAL_PROXY_PROVIDER_ID, projection.selection.reasoningModelId)]
      : [];

    for (const agentId of agentIds) {
      await this.dependencies.openClawConfigService.saveAgent({
        configPath: instance.configPath,
        agent: {
          id: agentId,
          model: {
            primary: buildAgentModelRef(
              OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
              projection.selection.defaultModelId,
            ),
            fallbacks,
          },
        },
      });
    }
  }
}

function createDefaultDependencies(
  overrides: ProviderConfigCenterServiceOverrides = {},
): ProviderConfigCenterServiceDependencies {
  const routingDefaults = createProviderRoutingCatalogService({
    storageApi: overrides.storageApi || storage,
    now: overrides.now || (() => Date.now()),
  });

  return {
    providerRoutingApi: {
      listProviderRoutingRecords:
        overrides.providerRoutingApi?.listProviderRoutingRecords ??
        routingDefaults.listProviderRoutingRecords.bind(routingDefaults),
      saveProviderRoutingRecord:
        overrides.providerRoutingApi?.saveProviderRoutingRecord ??
        routingDefaults.saveProviderRoutingRecord.bind(routingDefaults),
      deleteProviderRoutingRecord:
        overrides.providerRoutingApi?.deleteProviderRoutingRecord ??
        routingDefaults.deleteProviderRoutingRecord.bind(routingDefaults),
    },
    studioApi: {
      listInstances: () => studio.listInstances(),
      getInstanceDetail: (instanceId) => studio.getInstanceDetail(instanceId),
    },
    kernelPlatformService: {
      getInfo: () => kernelPlatformService.getInfo(),
      ensureRunning: () => kernelPlatformService.ensureRunning(),
      testLocalAiProxyRoute: (routeId) => kernelPlatformService.testLocalAiProxyRoute(routeId),
    },
    openClawConfigService: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
      readConfigSnapshot: (configPath) => openClawConfigService.readConfigSnapshot(configPath),
      saveManagedLocalProxyProjection: (input) =>
        openClawConfigService.saveManagedLocalProxyProjection(input),
      saveAgent: (input) => openClawConfigService.saveAgent(input),
    },
  };
}

export function createProviderConfigCenterService(
  overrides: ProviderConfigCenterServiceOverrides = {},
) {
  const defaults = createDefaultDependencies(overrides);

  return new ProviderConfigCenterService({
    providerRoutingApi: defaults.providerRoutingApi,
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    kernelPlatformService: {
      ...defaults.kernelPlatformService,
      ...(overrides.kernelPlatformService || {}),
    },
    openClawConfigService: {
      ...defaults.openClawConfigService,
      ...(overrides.openClawConfigService || {}),
    },
  });
}

export const providerConfigCenterService = createProviderConfigCenterService();
