import JSON5 from 'json5';
import { platform } from '@sdkwork/claw-infrastructure';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue | undefined;
}
type JsonArray = JsonValue[];

export interface OpenClawConfigPathInput {
  installRoot?: string | null;
  workRoot?: string | null;
  dataRoot?: string | null;
  homeRoots?: string[];
}

export interface OpenClawConfigBackedRoute {
  scope: string;
  mode: string;
  target?: string | null;
  authoritative?: boolean;
}

export interface OpenClawConfigBackedArtifact {
  kind: string;
  location?: string | null;
}

export interface OpenClawConfigBackedDetail {
  dataAccess?: {
    routes?: OpenClawConfigBackedRoute[];
  } | null;
  artifacts?: OpenClawConfigBackedArtifact[] | null;
}

export interface OpenClawProviderModelInput {
  id: string;
  name: string;
}

export interface OpenClawProviderInput {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: OpenClawProviderModelInput[];
  notes?: string;
  config?: Partial<OpenClawProviderRuntimeConfig>;
}

export interface OpenClawModelSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawChannelFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
}

export interface OpenClawChannelDefinition {
  id: string;
  name: string;
  description: string;
  setupSteps: string[];
  configurationMode?: 'required' | 'none';
  fields: OpenClawChannelFieldDefinition[];
}

export interface OpenClawChannelSnapshot {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode: 'required' | 'none';
  fieldCount: number;
  configuredFieldCount: number;
  setupSteps: string[];
  values: Record<string, string>;
  fields: OpenClawChannelFieldDefinition[];
}

export interface OpenClawProviderSnapshot {
  id: string;
  providerKey: string;
  name: string;
  provider: string;
  endpoint: string;
  apiKeySource: string;
  status: 'ready' | 'degraded' | 'configurationRequired';
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  description: string;
  icon: string;
  lastCheckedAt: string;
  capabilities: string[];
  models: Array<{
    id: string;
    name: string;
    role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
    contextWindow: string;
  }>;
  config: OpenClawProviderRuntimeConfig;
}

export interface OpenClawProviderRuntimeConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
  streaming: boolean;
}

export type OpenClawAgentParamValue = string | number | boolean;

export interface OpenClawAgentModelConfig {
  primary?: string;
  fallbacks?: string[];
}

export interface OpenClawAgentInput {
  id: string;
  name?: string;
  avatar?: string;
  workspace?: string;
  agentDir?: string;
  isDefault?: boolean;
  model?: string | OpenClawAgentModelConfig | null;
  params?: Record<string, OpenClawAgentParamValue | null | undefined>;
}

export interface OpenClawAgentSnapshot {
  id: string;
  name: string;
  avatar: string;
  description: string;
  workspace: string;
  agentDir: string;
  isDefault: boolean;
  model: {
    primary?: string;
    fallbacks: string[];
  };
  params: Record<string, OpenClawAgentParamValue>;
}

export interface OpenClawResolvedAgentPaths {
  id: string;
  workspace: string;
  agentDir: string;
  isDefault: boolean;
}

export interface OpenClawSubagentDefaultsInput {
  maxConcurrent?: number;
  maxSpawnDepth?: number;
  maxChildrenPerAgent?: number;
}

export interface ConfigureOpenClawMultiAgentSupportInput {
  configPath: string;
  coordinatorAgentId?: string;
  allowAgentIds: string[];
  subagentDefaults?: OpenClawSubagentDefaultsInput;
  sessionsVisibility?: 'self' | 'tree' | 'agent' | 'all';
}

export interface OpenClawConfigSnapshot {
  configPath: string;
  providerSnapshots: OpenClawProviderSnapshot[];
  agentSnapshots: OpenClawAgentSnapshot[];
  channelSnapshots: OpenClawChannelSnapshot[];
  root: JsonObject;
}

export interface SaveOpenClawChannelConfigurationInput {
  configPath: string;
  channelId: string;
  values: Record<string, string>;
  enabled?: boolean;
}

export interface SaveOpenClawSkillEntryInput {
  configPath: string;
  skillKey: string;
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
}

export interface DeleteOpenClawSkillEntryInput {
  configPath: string;
  skillKey: string;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

const DEFAULT_AGENT_ID = 'main';
const VALID_AGENT_ID_RE = /^[a-z0-9](?:[a-z0-9._-]{0,63})$/;
const INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9._-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

function pushCandidatePath(target: string[], nextPath?: string | null) {
  if (!nextPath) {
    return;
  }

  const normalized = normalizePath(nextPath);
  if (!normalized || target.includes(normalized)) {
    return;
  }

  target.push(normalized);
}

function joinPath(root?: string | null, ...segments: string[]) {
  if (!root) {
    return null;
  }

  const normalizedRoot = normalizePath(root).replace(/\/+$/, '');
  if (!normalizedRoot) {
    return null;
  }

  return [normalizedRoot, ...segments].join('/');
}

function getDirectoryName(path: string) {
  const normalized = normalizePath(path).replace(/\/+$/, '');
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return lastSlashIndex === 0 ? '/' : normalized;
  }

  return normalized.slice(0, lastSlashIndex);
}

function normalizeJoinedPath(path: string) {
  return normalizePath(path)
    .replace(/\/\.\//g, '/')
    .replace(/\/{2,}/g, '/');
}

function isAbsolutePath(path: string) {
  return /^([a-zA-Z]:\/|\/|\/\/)/.test(normalizePath(path));
}

function resolveStateRootFromConfigPath(configPath: string) {
  const normalized = normalizePath(configPath).replace(/\/+$/, '');
  if (normalized.endsWith('/.openclaw/openclaw.json')) {
    return getDirectoryName(normalized);
  }
  if (normalized.endsWith('/config/openclaw.json')) {
    return getDirectoryName(getDirectoryName(normalized));
  }
  return getDirectoryName(normalized);
}

function resolveUserRootFromConfigPath(configPath: string) {
  const stateRoot = resolveStateRootFromConfigPath(configPath);
  if (stateRoot.endsWith('/.openclaw')) {
    return stateRoot.slice(0, -'/.openclaw'.length);
  }

  return getDirectoryName(stateRoot);
}

function resolveUserPathFromConfig(configPath: string, rawPath?: string | null) {
  const trimmed = rawPath?.trim() || '';
  if (!trimmed) {
    return '';
  }

  if (trimmed === '~') {
    return resolveUserRootFromConfigPath(configPath);
  }

  if (trimmed.startsWith('~/')) {
    return normalizeJoinedPath(
      `${resolveUserRootFromConfigPath(configPath)}/${trimmed.slice(2)}`,
    );
  }

  if (isAbsolutePath(trimmed)) {
    return normalizeJoinedPath(trimmed);
  }

  const relativePath = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  return normalizeJoinedPath(
    `${resolveStateRootFromConfigPath(configPath)}/${relativePath}`,
  );
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function ensureArray(parent: JsonObject, key: string): JsonArray {
  const current = parent[key];
  if (!Array.isArray(current)) {
    parent[key] = [];
  }

  return parent[key] as JsonArray;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readObject(value: JsonValue | undefined) {
  return isJsonObject(value) ? value : null;
}

function deleteIfEmptyObject(parent: JsonObject, key: string) {
  const value = parent[key];
  if (!isJsonObject(value) || Object.keys(value).length > 0) {
    return;
  }

  delete parent[key];
}

function readScalar(value: JsonValue | undefined) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function readNumber(value: JsonValue | undefined, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readBoolean(value: JsonValue | undefined, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }

  return fallback;
}

function setOptionalScalar(target: JsonObject, key: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[key];
    return;
  }

  target[key] = normalized;
}

function normalizeAgentId(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }

  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_AGENT_ID_CHARS_RE, '-')
      .replace(LEADING_DASH_RE, '')
      .replace(TRAILING_DASH_RE, '')
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isReasoningModel(modelId: string, modelName: string, explicitReasoning?: JsonValue) {
  if (typeof explicitReasoning === 'boolean') {
    return explicitReasoning;
  }

  return /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(`${modelId} ${modelName}`);
}

function isEmbeddingModel(modelId: string, modelName: string) {
  return /(embed|embedding|bge|vector)/i.test(`${modelId} ${modelName}`);
}

function inferContextWindow(
  role: 'primary' | 'reasoning' | 'embedding' | 'fallback',
  explicitContextWindow?: JsonValue,
) {
  if (typeof explicitContextWindow === 'number') {
    if (explicitContextWindow >= 1000) {
      return `${Math.round(explicitContextWindow / 1000)}K`;
    }

    return String(explicitContextWindow);
  }

  if (role === 'embedding') {
    return '8K';
  }

  if (role === 'reasoning') {
    return '200K';
  }

  return '128K';
}

function getProviderIcon(channelId: string) {
  const iconMap: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AT',
    xai: 'XI',
    deepseek: 'DS',
    qwen: 'QW',
    zhipu: 'ZP',
    baidu: 'BD',
    'tencent-hunyuan': 'TH',
    doubao: 'DB',
    moonshot: 'KI',
    minimax: 'MM',
    stepfun: 'SF',
    'iflytek-spark': 'IF',
  };

  return iconMap[channelId] || 'AR';
}

const LEGACY_PROVIDER_KEY_PREFIX = 'api-router-';

function normalizeProviderKey(providerId: string | undefined | null) {
  const normalized = (providerId || '').trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith(LEGACY_PROVIDER_KEY_PREFIX)
    ? normalized.slice(LEGACY_PROVIDER_KEY_PREFIX.length)
    : normalized;
}

function buildProviderKey(providerId: string) {
  return normalizeProviderKey(providerId);
}

function buildModelRef(providerKey: string, modelId: string) {
  return `${normalizeProviderKey(providerKey)}/${modelId}`;
}

function normalizeModelRefString(value: string | undefined | null) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return '';
  }

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    return trimmed;
  }

  return `${normalizeProviderKey(trimmed.slice(0, slashIndex))}/${trimmed.slice(slashIndex + 1)}`;
}

function parseModelRef(value: JsonValue | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeModelRefString(value);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return {
    providerKey: normalized.slice(0, slashIndex),
    modelId: normalized.slice(slashIndex + 1),
  };
}

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function titleizeProviderKey(providerKey: string) {
  return normalizeProviderKey(providerKey)
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function readModelConfig(value: JsonValue | undefined): OpenClawAgentModelConfig {
  if (typeof value === 'string') {
    return {
      primary: normalizeModelRefString(value),
      fallbacks: [],
    };
  }

  if (!isJsonObject(value)) {
    return {
      fallbacks: [],
    };
  }

  const primary = normalizeModelRefString(readScalar(value.primary).trim()) || undefined;
  const fallbacks = readArray(value.fallbacks)
    .map((entry) => normalizeModelRefString(readScalar(entry).trim()))
    .filter(Boolean);

  return {
    primary,
    fallbacks,
  };
}

function writeModelConfig(
  target: JsonObject,
  key: string,
  value: string | OpenClawAgentModelConfig | null | undefined,
) {
  if (value == null) {
    delete target[key];
    return;
  }

  const config = typeof value === 'string' ? { primary: value, fallbacks: [] } : value;
  const primary = normalizeModelRefString(config.primary?.trim()) || '';
  const fallbacks = (config.fallbacks || [])
    .map((entry) => normalizeModelRefString(entry.trim()))
    .filter(Boolean);

  if (!primary && fallbacks.length === 0) {
    delete target[key];
    return;
  }

  const modelConfig: JsonObject = {};
  if (primary) {
    modelConfig.primary = primary;
  }
  if (fallbacks.length > 0) {
    modelConfig.fallbacks = [...new Set(fallbacks)];
  }

  target[key] = modelConfig;
}

function normalizeLegacyProviderLayout(root: JsonObject) {
  const modelsRoot = readObject(root.models);
  const providersRoot = readObject(modelsRoot?.providers);
  if (providersRoot) {
    const nextProviders: JsonObject = {};

    for (const [rawProviderKey, providerValue] of Object.entries(providersRoot)) {
      const normalizedProviderKey = normalizeProviderKey(rawProviderKey);
      if (!normalizedProviderKey) {
        continue;
      }

      if (!(normalizedProviderKey in nextProviders) || rawProviderKey === normalizedProviderKey) {
        nextProviders[normalizedProviderKey] = providerValue;
      }
    }

    modelsRoot!.providers = nextProviders;
  }

  const defaultsRoot = readObject(readObject(root.agents)?.defaults);
  if (defaultsRoot) {
    if (defaultsRoot.model !== undefined) {
      writeModelConfig(defaultsRoot, 'model', readModelConfig(defaultsRoot.model));
    }

    const modelsCatalogRoot = readObject(defaultsRoot.models);
    if (modelsCatalogRoot) {
      const nextModelsCatalogRoot: JsonObject = {};
      for (const [rawModelRef, modelMetadata] of Object.entries(modelsCatalogRoot)) {
        const normalizedModelRef = normalizeModelRefString(rawModelRef);
        if (!normalizedModelRef) {
          continue;
        }

        if (!(normalizedModelRef in nextModelsCatalogRoot) || rawModelRef === normalizedModelRef) {
          nextModelsCatalogRoot[normalizedModelRef] = modelMetadata;
        }
      }

      defaultsRoot.models = nextModelsCatalogRoot;
    }
  }

  for (const entry of getAgentListEntries(root)) {
    if (entry.model !== undefined) {
      writeModelConfig(entry, 'model', readModelConfig(entry.model));
    }
  }
}

function readAgentParams(value: JsonValue | undefined): Record<string, OpenClawAgentParamValue> {
  if (!isJsonObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
        ? [[key, entry]]
        : [],
    ),
  );
}

function writeAgentParams(
  target: JsonObject,
  params?: Record<string, OpenClawAgentParamValue | null | undefined>,
) {
  if (!params) {
    return;
  }

  const nextParams = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? [[key, value]]
        : [],
    ),
  );

  if (Object.keys(nextParams).length === 0) {
    delete target.params;
    return;
  }

  target.params = nextParams;
}

function readStringArray(value: JsonValue | undefined) {
  return readArray(value)
    .map((entry) => readScalar(entry).trim())
    .filter(Boolean);
}

function normalizeAgentIdList(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (value === '*' ? value : normalizeAgentId(value))),
    ),
  ];
}

function setStringArray(
  target: JsonObject,
  key: string,
  values: string[],
) {
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalizedValues.length === 0) {
    delete target[key];
    return;
  }

  target[key] = normalizedValues;
}

function getAgentListEntries(root: JsonObject) {
  const agentList = readObject(root.agents)?.list;
  return readArray(agentList).filter((entry): entry is JsonObject => isJsonObject(entry));
}

function resolveDefaultAgentId(root: JsonObject) {
  const agentList = getAgentListEntries(root);
  if (agentList.length === 0) {
    return DEFAULT_AGENT_ID;
  }

  const defaultEntry =
    agentList.find((entry) => readBoolean(entry.default, false)) || agentList[0];

  return normalizeAgentId(readScalar(defaultEntry?.id));
}

function collectAvailableModelEntries(root: JsonObject) {
  const providersRoot = readObject(readObject(root.models)?.providers) || {};
  const availableEntries = new Map<string, { alias: string; streaming: boolean }>();

  for (const [providerKey, rawProvider] of Object.entries(providersRoot)) {
    if (!isJsonObject(rawProvider)) {
      continue;
    }

    for (const entry of readArray(rawProvider.models)) {
      if (!isJsonObject(entry)) {
        continue;
      }

      const modelId = readScalar(entry.id).trim();
      if (!modelId) {
        continue;
      }

      availableEntries.set(buildModelRef(providerKey, modelId), {
        alias: readScalar(entry.name).trim() || modelId,
        streaming: !isEmbeddingModel(modelId, readScalar(entry.name)),
      });
    }
  }

  return availableEntries;
}

function syncModelCatalog(root: JsonObject) {
  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  const availableEntries = collectAvailableModelEntries(root);

  for (const key of Object.keys(catalogRoot)) {
    if (!availableEntries.has(key)) {
      delete catalogRoot[key];
    }
  }

  for (const [modelRef, metadata] of availableEntries.entries()) {
    const current = readObject(catalogRoot[modelRef]) || {};
    catalogRoot[modelRef] = {
      ...current,
      alias: readScalar(current.alias).trim() || metadata.alias,
      streaming:
        typeof current.streaming === 'boolean' ? current.streaming : metadata.streaming,
    };
  }

  deleteIfEmptyObject(defaultsRoot, 'models');
}

function sanitizeModelConfig(
  value: JsonValue | undefined,
  availableModelRefs: Set<string>,
  fallbackPrimary?: string,
) {
  const modelConfig = readModelConfig(value);
  const fallbacks = [...new Set((modelConfig.fallbacks || []).filter((entry) => availableModelRefs.has(entry)))];
  let primary =
    modelConfig.primary && availableModelRefs.has(modelConfig.primary)
      ? modelConfig.primary
      : undefined;

  if (primary) {
    const filteredFallbacks = fallbacks.filter((entry) => entry !== primary);
    return {
      primary,
      fallbacks: filteredFallbacks,
    };
  }

  if (fallbacks.length > 0) {
    primary = fallbacks[0];
    return {
      primary,
      fallbacks: fallbacks.slice(1).filter((entry) => entry !== primary),
    };
  }

  if (fallbackPrimary && availableModelRefs.has(fallbackPrimary)) {
    return {
      primary: fallbackPrimary,
      fallbacks: [],
    };
  }

  return {
    fallbacks: [],
  };
}

function pruneModelReferences(root: JsonObject) {
  const availableModelRefs = new Set(collectAvailableModelEntries(root).keys());
  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const firstAvailableModelRef = [...availableModelRefs][0];
  const nextDefaultsModel = sanitizeModelConfig(
    defaultsRoot.model,
    availableModelRefs,
    firstAvailableModelRef,
  );

  writeModelConfig(defaultsRoot, 'model', nextDefaultsModel);
  const defaultPrimary = nextDefaultsModel.primary;

  for (const entry of getAgentListEntries(root)) {
    const nextAgentModel = sanitizeModelConfig(entry.model, availableModelRefs, defaultPrimary);
    if (!nextAgentModel.primary && nextAgentModel.fallbacks.length === 0) {
      delete entry.model;
      continue;
    }

    writeModelConfig(entry, 'model', nextAgentModel);
  }

  deleteIfEmptyObject(defaultsRoot, 'model');
  deleteIfEmptyObject(agentsRoot, 'defaults');
}

function ensureSingleDefaultAgent(root: JsonObject) {
  const agentsRoot = ensureObject(root, 'agents');
  const agentList = ensureArray(agentsRoot, 'list');
  const entries = agentList.filter((entry): entry is JsonObject => isJsonObject(entry));
  if (entries.length === 0) {
    return;
  }

  const defaultIndex = entries.findIndex((entry) => readBoolean(entry.default, false));
  const normalizedDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  entries.forEach((entry, index) => {
    entry.default = index === normalizedDefaultIndex;
  });

  agentList.length = 0;
  for (const entry of entries) {
    agentList.push(entry);
  }
}

function updateModelRefInConfig(
  target: JsonObject,
  key: string,
  oldModelRef: string,
  nextModelRef: string,
) {
  const current = readModelConfig(target[key]);
  const nextPrimary = current.primary === oldModelRef ? nextModelRef : current.primary;
  const nextFallbacks = (current.fallbacks || []).map((entry) =>
    entry === oldModelRef ? nextModelRef : entry,
  );
  writeModelConfig(target, key, {
    primary: nextPrimary,
    fallbacks: nextFallbacks,
  });
}

function renameModelRefAcrossConfig(root: JsonObject, oldModelRef: string, nextModelRef: string) {
  const defaultsRoot = ensureObject(ensureObject(root, 'agents'), 'defaults');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  if (catalogRoot[oldModelRef] !== undefined) {
    catalogRoot[nextModelRef] = catalogRoot[oldModelRef];
    delete catalogRoot[oldModelRef];
  }

  updateModelRefInConfig(defaultsRoot, 'model', oldModelRef, nextModelRef);
  for (const entry of getAgentListEntries(root)) {
    updateModelRefInConfig(entry, 'model', oldModelRef, nextModelRef);
  }
}

function buildAgentSnapshots(root: JsonObject, configPath: string): OpenClawAgentSnapshot[] {
  const defaultsRoot = readObject(readObject(root.agents)?.defaults) || {};
  const defaultModel = readModelConfig(defaultsRoot.model);
  const defaultAgentId = resolveDefaultAgentId(root);
  const defaultWorkspace = readScalar(defaultsRoot.workspace).trim();
  const agentEntries = [...getAgentListEntries(root)].sort((left, right) => {
    const leftId = normalizeAgentId(readScalar(left.id));
    const rightId = normalizeAgentId(readScalar(right.id));
    if (leftId === defaultAgentId) {
      return -1;
    }
    if (rightId === defaultAgentId) {
      return 1;
    }
    return 0;
  });

  return agentEntries.map((entry) => {
    const id = normalizeAgentId(readScalar(entry.id));
    const name = readScalar(entry.name).trim() || titleizeIdentifier(id);
    const identityRoot = readObject(entry.identity) || {};
    const avatar =
      readScalar(identityRoot.emoji).trim() ||
      readScalar(identityRoot.avatar).trim() ||
      '*';
    const configuredWorkspace = readScalar(entry.workspace).trim();
    const configuredAgentDir = readScalar(entry.agentDir).trim();
    const workspace =
      resolveUserPathFromConfig(
        configPath,
        configuredWorkspace || (id === defaultAgentId ? defaultWorkspace || 'workspace' : `workspace-${id}`),
      ) || resolveUserPathFromConfig(configPath, `workspace-${id}`);
    const agentDir =
      resolveUserPathFromConfig(
        configPath,
        configuredAgentDir || `agents/${id}/agent`,
      ) || resolveUserPathFromConfig(configPath, `agents/${id}/agent`);
    const configuredModel = readModelConfig(entry.model);
    const effectiveModel =
      configuredModel.primary || configuredModel.fallbacks?.length
        ? configuredModel
        : defaultModel;

    return {
      id,
      name,
      avatar,
      description: `${name} agent backed by workspace ${workspace}.`,
      workspace,
      agentDir,
      isDefault: id === defaultAgentId,
      model: {
        primary: effectiveModel.primary,
        fallbacks: [...new Set((effectiveModel.fallbacks || []).filter(Boolean))],
      },
      params: readAgentParams(entry.params),
    };
  });
}

function buildResolvedAgentPaths(
  root: JsonObject,
  configPath: string,
  agentId: string,
  overrides: {
    workspace?: string | null;
    agentDir?: string | null;
  } = {},
): OpenClawResolvedAgentPaths {
  const normalizedId = normalizeAgentId(agentId);
  const defaultsRoot = readObject(readObject(root.agents)?.defaults) || {};
  const defaultAgentId = resolveDefaultAgentId(root);
  const defaultWorkspace = readScalar(defaultsRoot.workspace).trim();
  const workspaceHint =
    overrides.workspace?.trim() ||
    (normalizedId === defaultAgentId ? defaultWorkspace || 'workspace' : `workspace-${normalizedId}`);
  const agentDirHint = overrides.agentDir?.trim() || `agents/${normalizedId}/agent`;
  const workspace =
    resolveUserPathFromConfig(configPath, workspaceHint) ||
    resolveUserPathFromConfig(
      configPath,
      normalizedId === defaultAgentId ? 'workspace' : `workspace-${normalizedId}`,
    );
  const agentDir =
    resolveUserPathFromConfig(configPath, agentDirHint) ||
    resolveUserPathFromConfig(configPath, `agents/${normalizedId}/agent`);

  return {
    id: normalizedId,
    workspace,
    agentDir,
    isDefault: normalizedId === defaultAgentId,
  };
}

const OPENCLAW_CHANNEL_DEFINITIONS: OpenClawChannelDefinition[] = [
  {
    id: 'sdkworkchat',
    name: 'Sdkwork Chat',
    description: 'Deliver OpenClaw conversations directly into the first-party Sdkwork Chat experience.',
    setupSteps: [
      'Download the Sdkwork Chat app or open the existing Sdkwork Chat workspace.',
      'Sign in with your SDKWork account to receive OpenClaw conversations immediately.',
      'Keep this channel enabled when the current runtime should hand off into Sdkwork Chat.',
    ],
    configurationMode: 'none',
    fields: [],
  },
  {
    id: 'wehcat',
    name: 'Wehcat',
    description: 'Connect a WeChat official account workflow so OpenClaw can serve China-facing channels.',
    setupSteps: [
      'Create or manage a WeChat official account in the WeChat platform.',
      'Paste the App ID, App Secret, token, and optional AES key here.',
      'Configure the callback URL on the WeChat side and enable the channel.',
    ],
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'wx1234567890abcdef',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        placeholder: 'WeChat app secret',
        required: true,
        sensitive: true,
      },
      {
        key: 'token',
        label: 'Token',
        placeholder: 'Verification token',
        required: true,
      },
      {
        key: 'encodingAesKey',
        label: 'Encoding AES Key',
        placeholder: 'Optional AES key',
        sensitive: true,
      },
    ],
  },
  {
    id: 'qq',
    name: 'QQ',
    description: 'Connect a QQ bot so OpenClaw can route commands, alerts, and approvals into QQ groups.',
    setupSteps: [
      'Create or manage the target QQ bot in the QQ bot platform.',
      'Paste the bot key and target group ID here.',
      'Enable the channel after a dry-run delivery succeeds.',
    ],
    fields: [
      {
        key: 'botKey',
        label: 'Bot Key',
        placeholder: 'QQ bot key',
        required: true,
        sensitive: true,
      },
      {
        key: 'groupId',
        label: 'Group ID',
        placeholder: '123456789',
        required: true,
        helpText: 'The target QQ group that receives OpenClaw updates.',
      },
    ],
  },
  {
    id: 'dingtalk',
    name: 'DingTalk',
    description: 'Connect a DingTalk custom robot so OpenClaw can broadcast updates into DingTalk workspaces.',
    setupSteps: [
      'Create a custom robot in the target DingTalk group.',
      'Copy the access token and signing secret into this form.',
      'Enable the channel after the first connectivity check succeeds.',
    ],
    fields: [
      {
        key: 'accessToken',
        label: 'Access Token',
        placeholder: 'DingTalk access token',
        required: true,
        sensitive: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        placeholder: 'Robot signing secret',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'wecom',
    name: 'WeCom',
    description: 'Connect a WeCom application so OpenClaw can serve enterprise WeCom conversations.',
    setupSteps: [
      'Create a WeCom application with bot or customer-contact permissions.',
      'Paste the corp ID, agent ID, and secret here.',
      'Save the configuration and verify that message delivery succeeds.',
    ],
    fields: [
      {
        key: 'corpId',
        label: 'Corp ID',
        placeholder: 'ww1234567890abcdef',
        required: true,
      },
      {
        key: 'agentId',
        label: 'Agent ID',
        placeholder: '1000002',
        required: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        placeholder: 'WeCom app secret',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'feishu',
    name: 'Feishu',
    description: 'Connect a Feishu bot so OpenClaw can receive and reply to team messages.',
    setupSteps: [
      'Create a Feishu app in the open platform.',
      'Copy the App ID and App Secret into this form.',
      'Add the event callback URL from your OpenClaw deployment if needed.',
    ],
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'cli_xxxxxxxxxxxxx',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        placeholder: 'App secret',
        required: true,
        sensitive: true,
      },
      {
        key: 'encryptKey',
        label: 'Encrypt Key',
        placeholder: 'Optional encrypt key',
        sensitive: true,
      },
      {
        key: 'verificationToken',
        label: 'Verification Token',
        placeholder: 'Optional verification token',
        sensitive: true,
      },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Use a Telegram bot token to bring OpenClaw into direct messages or group chats.',
    setupSteps: [
      'Create a bot with BotFather and copy the bot token.',
      'Optionally set a webhook URL if Telegram should push events to your host.',
      'Enable the channel after the required credentials are filled.',
    ],
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: '123456:AA...',
        required: true,
        sensitive: true,
      },
      {
        key: 'tokenFile',
        label: 'Token File',
        placeholder: 'Optional token file path',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/openclaw/telegram',
        inputMode: 'url',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Optional webhook secret',
        sensitive: true,
      },
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        placeholder: '/telegram/webhook',
      },
      {
        key: 'webhookHost',
        label: 'Webhook Host',
        placeholder: '0.0.0.0',
      },
      {
        key: 'webhookPort',
        label: 'Webhook Port',
        placeholder: '8443',
        inputMode: 'numeric',
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Attach OpenClaw to a Discord bot for server and DM conversations.',
    setupSteps: [
      'Create a Discord application and bot in the developer portal.',
      'Paste the bot token here and invite the bot to your server.',
      'Turn the channel on once the token has been validated.',
    ],
    fields: [
      {
        key: 'token',
        label: 'Bot Token',
        placeholder: 'Discord bot token',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Configure bot and app tokens so OpenClaw can work inside Slack workspaces.',
    setupSteps: [
      'Create or open your Slack app and install it to the target workspace.',
      'Paste the bot token and app token below.',
      'Add a signing secret if your workspace uses slash commands or events.',
    ],
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: 'xoxb-...',
        required: true,
        sensitive: true,
      },
      {
        key: 'appToken',
        label: 'App Token',
        placeholder: 'xapp-...',
        required: true,
        sensitive: true,
      },
      {
        key: 'signingSecret',
        label: 'Signing Secret',
        placeholder: 'Optional signing secret',
        sensitive: true,
      },
    ],
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    description: 'Provide Google Chat service account or ref details for enterprise workspace delivery.',
    setupSteps: [
      'Create a Google Chat app and service account.',
      'Provide either the inline service account JSON or a service account reference.',
      'Fill audience or webhook information if your deployment requires it.',
    ],
    fields: [
      {
        key: 'serviceAccount',
        label: 'Service Account JSON',
        placeholder: '{ \"type\": \"service_account\", ... }',
        multiline: true,
      },
      {
        key: 'serviceAccountRef',
        label: 'Service Account Ref',
        placeholder: 'secret://googlechat/service-account',
      },
      {
        key: 'audienceType',
        label: 'Audience Type',
        placeholder: 'SPACE or DM',
      },
      {
        key: 'audience',
        label: 'Audience',
        placeholder: 'spaces/AAAA12345',
      },
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        placeholder: '/googlechat/webhook',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/openclaw/googlechat',
        inputMode: 'url',
      },
    ],
  },
];

function getChannelDefinition(channelId: string) {
  return OPENCLAW_CHANNEL_DEFINITIONS.find((definition) => definition.id === channelId) || null;
}

async function readConfigRoot(configPath: string) {
  const raw = await platform.readFile(configPath);
  const parsed = raw.trim() ? JSON5.parse(raw) : {};

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {} as JsonObject;
  }

  const root = parsed as JsonObject;
  normalizeLegacyProviderLayout(root);
  return root;
}

async function writeConfigRoot(configPath: string, root: JsonObject) {
  const content = `${JSON5.stringify(root, null, 2)}\n`;
  await platform.writeFile(configPath, content);
}

function buildChannelSnapshots(root: JsonObject): OpenClawChannelSnapshot[] {
  const channelsRoot =
    root.channels && typeof root.channels === 'object' && !Array.isArray(root.channels)
      ? (root.channels as JsonObject)
      : {};

  return OPENCLAW_CHANNEL_DEFINITIONS.map((definition) => {
    const channelConfig =
      channelsRoot[definition.id] &&
      typeof channelsRoot[definition.id] === 'object' &&
      !Array.isArray(channelsRoot[definition.id])
        ? (channelsRoot[definition.id] as JsonObject)
        : {};
    const configurationMode = definition.configurationMode || 'required';
    const values = Object.fromEntries(
      definition.fields.map((field) => [field.key, readScalar(channelConfig[field.key])]),
    );
    const configuredFieldCount = definition.fields.filter((field) => Boolean(values[field.key])).length;
    const enabled = Boolean(
      channelConfig.enabled ?? (configurationMode === 'none' ? true : configuredFieldCount > 0),
    );
    const status =
      configurationMode === 'none'
        ? enabled
          ? 'connected'
          : 'disconnected'
        : configuredFieldCount === 0
          ? 'not_configured'
          : enabled
            ? 'connected'
            : 'disconnected';

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      status,
      enabled,
      configurationMode,
      fieldCount: definition.fields.length,
      configuredFieldCount,
      setupSteps: [...definition.setupSteps],
      values,
      fields: definition.fields.map((field) => ({ ...field })),
    };
  });
}

function buildProviderSnapshots(root: JsonObject): OpenClawProviderSnapshot[] {
  const providersRoot = readObject(readObject(root.models)?.providers) || {};
  const defaultsRoot = readObject(readObject(root.agents)?.defaults) || {};
  const defaultsModel = readModelConfig(defaultsRoot.model);
  const primaryRef = parseModelRef(defaultsModel.primary);
  const fallbackRefs = (defaultsModel.fallbacks || [])
    .map((entry) => parseModelRef(entry))
    .filter((entry): entry is { providerKey: string; modelId: string } => Boolean(entry));

  return Object.entries(providersRoot).flatMap(([rawProviderKey, rawProvider]) => {
    if (!rawProvider || typeof rawProvider !== 'object' || Array.isArray(rawProvider)) {
      return [];
    }

    const providerKey = normalizeProviderKey(rawProviderKey);
    const provider = rawProvider as JsonObject;
    const rawModels = readArray(provider.models).filter(
      (entry): entry is JsonObject => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
    );
    if (rawModels.length === 0) {
      return [];
    }

    const defaultModelId =
      primaryRef?.providerKey === providerKey ? primaryRef.modelId : readScalar(rawModels[0]?.id);
    const reasoningFallback = fallbackRefs.find((entry) => entry.providerKey === providerKey);
    const reasoningModelId =
      reasoningFallback?.modelId ||
      rawModels.find((model) => isReasoningModel(readScalar(model.id), readScalar(model.name), model.reasoning))
        ?.id;
    const embeddingModelId = rawModels.find((model) =>
      isEmbeddingModel(readScalar(model.id), readScalar(model.name)),
    )?.id;
    const status = readScalar(provider.apiKey).trim() ? 'ready' : 'configurationRequired';

    return [
      {
        id: providerKey,
        providerKey,
        name: titleizeProviderKey(providerKey),
        provider: providerKey,
        endpoint: readScalar(provider.baseUrl),
        apiKeySource: readScalar(provider.apiKey),
        status,
        defaultModelId,
        reasoningModelId: reasoningModelId ? readScalar(reasoningModelId) : undefined,
        embeddingModelId: embeddingModelId ? readScalar(embeddingModelId) : undefined,
        description: `${titleizeProviderKey(providerKey)} provider configured through Claw Studio and OpenClaw.`,
        icon: getProviderIcon(providerKey.toLowerCase()),
        lastCheckedAt: new Date().toISOString(),
        capabilities: [
          'chat',
          ...(reasoningModelId ? ['reasoning'] : []),
          ...(embeddingModelId ? ['embedding'] : []),
        ],
        models: rawModels.map((model) => {
          const modelId = readScalar(model.id);
          const modelName = readScalar(model.name) || modelId;
          const role =
            modelId === defaultModelId
              ? 'primary'
              : modelId === embeddingModelId
                ? 'embedding'
                : modelId === reasoningModelId
                  ? 'reasoning'
                  : 'fallback';

          return {
            id: modelId,
            name: modelName,
            role,
            contextWindow: inferContextWindow(role, model.contextWindow),
          };
        }),
        config: {
          temperature: readNumber(provider.temperature, 0.2),
          topP: readNumber(provider.topP, 1),
          maxTokens: readNumber(provider.maxTokens, 8192),
          timeoutMs: readNumber(provider.timeoutMs, 60000),
          streaming:
            typeof provider.streaming === 'boolean'
              ? provider.streaming
              : readScalar(provider.streaming) !== 'false',
        },
      },
    ];
  });
}

function updateProviderConfig(root: JsonObject, provider: OpenClawProviderInput, selection: OpenClawModelSelection) {
  const modelsRoot = ensureObject(root, 'models');
  const providersRoot = ensureObject(modelsRoot, 'providers');
  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const providerKey = buildProviderKey(provider.id);
  const providerRoot = ensureObject(providersRoot, providerKey);

  providerRoot.baseUrl = provider.baseUrl;
  providerRoot.apiKey = provider.apiKey;
  providerRoot.api = 'openai-completions';
  providerRoot.auth = 'api-key';
  if (typeof provider.config?.temperature === 'number') {
    providerRoot.temperature = provider.config.temperature;
  }
  if (typeof provider.config?.topP === 'number') {
    providerRoot.topP = provider.config.topP;
  }
  if (typeof provider.config?.maxTokens === 'number') {
    providerRoot.maxTokens = provider.config.maxTokens;
  }
  if (typeof provider.config?.timeoutMs === 'number') {
    providerRoot.timeoutMs = provider.config.timeoutMs;
  }
  if (typeof provider.config?.streaming === 'boolean') {
    providerRoot.streaming = provider.config.streaming;
  }
  providerRoot.models = provider.models.map((model) => ({
    id: model.id,
    name: model.name,
    reasoning: model.id === selection.reasoningModelId,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: model.id === selection.embeddingModelId ? 8192 : model.id === selection.reasoningModelId ? 200000 : 128000,
    maxTokens: model.id === selection.embeddingModelId ? 8192 : 32000,
  })) as JsonValue;

  writeModelConfig(defaultsRoot, 'model', {
    primary: buildModelRef(providerKey, selection.defaultModelId),
    fallbacks: selection.reasoningModelId
      ? [buildModelRef(providerKey, selection.reasoningModelId)]
      : [],
  });

  syncModelCatalog(root);
  pruneModelReferences(root);
}

function updateChannelConfig(root: JsonObject, input: SaveOpenClawChannelConfigurationInput) {
  const channelsRoot = ensureObject(root, 'channels');
  const channelRoot = ensureObject(channelsRoot, input.channelId);
  const definition = getChannelDefinition(input.channelId);

  if (!definition) {
    throw new Error(`Unsupported OpenClaw channel: ${input.channelId}`);
  }

  for (const field of definition.fields) {
    setOptionalScalar(channelRoot, field.key, input.values[field.key]);
  }

  const configuredFieldCount = definition.fields.filter(
    (field) => Boolean(input.values[field.key]?.trim()),
  ).length;
  channelRoot.enabled =
    input.enabled ??
    ((definition.configurationMode || 'required') === 'none' ? true : configuredFieldCount > 0);
}

function updateSkillEntry(root: JsonObject, input: SaveOpenClawSkillEntryInput) {
  const skillKey = input.skillKey.trim();
  if (!skillKey) {
    throw new Error('OpenClaw skill key is required.');
  }

  const skillsRoot = ensureObject(root, 'skills');
  const entriesRoot = ensureObject(skillsRoot, 'entries');
  const current = readObject(entriesRoot[skillKey]) || {};

  if (typeof input.enabled === 'boolean') {
    if (input.enabled) {
      delete current.enabled;
    } else {
      current.enabled = false;
    }
  }

  if (input.apiKey !== undefined) {
    const normalizedApiKey = input.apiKey.trim();
    if (normalizedApiKey) {
      current.apiKey = normalizedApiKey;
    } else {
      delete current.apiKey;
    }
  }

  if (input.env) {
    const nextEnv = readObject(current.env) || {};

    for (const [rawKey, rawValue] of Object.entries(input.env)) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }

      const value = rawValue.trim();
      if (value) {
        nextEnv[key] = value;
      } else {
        delete nextEnv[key];
      }
    }

    if (Object.keys(nextEnv).length > 0) {
      current.env = nextEnv;
    } else {
      delete current.env;
    }
  }

  if (Object.keys(current).length > 0) {
    entriesRoot[skillKey] = current;
  } else {
    delete entriesRoot[skillKey];
  }

  deleteIfEmptyObject(skillsRoot, 'entries');
  deleteIfEmptyObject(root, 'skills');
}

function deleteSkillEntry(root: JsonObject, skillKey: string) {
  const normalizedSkillKey = skillKey.trim();
  if (!normalizedSkillKey) {
    throw new Error('OpenClaw skill key is required.');
  }

  const skillsRoot = ensureObject(root, 'skills');
  const entriesRoot = ensureObject(skillsRoot, 'entries');
  delete entriesRoot[normalizedSkillKey];

  deleteIfEmptyObject(skillsRoot, 'entries');
  deleteIfEmptyObject(root, 'skills');
}

function resolveProviderEntry(root: JsonObject, providerId: string) {
  const providersRoot = ensureObject(ensureObject(root, 'models'), 'providers');
  const providerKey = buildProviderKey(providerId);
  const providerRoot = readObject(providersRoot[providerKey]);

  return {
    providersRoot,
    providerKey,
    providerRoot,
  };
}

function resolveProviderModelEntries(providerRoot: JsonObject) {
  return readArray(providerRoot.models).filter((entry): entry is JsonObject => isJsonObject(entry));
}

function updateProviderModelCatalog(root: JsonObject) {
  syncModelCatalog(root);
  pruneModelReferences(root);
}

function saveAgentConfig(root: JsonObject, input: OpenClawAgentInput) {
  const agentsRoot = ensureObject(root, 'agents');
  const agentList = ensureArray(agentsRoot, 'list');
  const normalizedId = normalizeAgentId(input.id);
  const existingIndex = agentList.findIndex(
    (entry) => isJsonObject(entry) && normalizeAgentId(readScalar(entry.id)) === normalizedId,
  );
  const currentEntry =
    existingIndex >= 0 && isJsonObject(agentList[existingIndex])
      ? (agentList[existingIndex] as JsonObject)
      : {};

  currentEntry.id = normalizedId;
  setOptionalScalar(currentEntry, 'name', input.name);
  if (input.workspace !== undefined) {
    setOptionalScalar(currentEntry, 'workspace', input.workspace);
  }
  if (input.agentDir !== undefined) {
    setOptionalScalar(currentEntry, 'agentDir', input.agentDir);
  }
  if (input.model !== undefined) {
    writeModelConfig(currentEntry, 'model', input.model);
  }
  if (input.params !== undefined) {
    writeAgentParams(currentEntry, input.params);
  }
  if (input.avatar !== undefined) {
    const identityRoot = ensureObject(currentEntry, 'identity');
    setOptionalScalar(identityRoot, 'emoji', input.avatar);
    deleteIfEmptyObject(currentEntry, 'identity');
  }
  if (typeof input.isDefault === 'boolean') {
    currentEntry.default = input.isDefault;
  }

  if (existingIndex >= 0) {
    agentList[existingIndex] = currentEntry;
  } else {
    agentList.push(currentEntry);
  }

  if (input.isDefault) {
    for (const entry of getAgentListEntries(root)) {
      entry.default = normalizeAgentId(readScalar(entry.id)) === normalizedId;
    }
  }

  ensureSingleDefaultAgent(root);
  pruneModelReferences(root);
}

function deleteAgentConfig(root: JsonObject, agentId: string) {
  const agentsRoot = ensureObject(root, 'agents');
  const agentList = ensureArray(agentsRoot, 'list');
  const normalizedId = normalizeAgentId(agentId);
  const nextEntries = agentList.filter(
    (entry) => !isJsonObject(entry) || normalizeAgentId(readScalar(entry.id)) !== normalizedId,
  );
  agentList.length = 0;
  for (const entry of nextEntries) {
    agentList.push(entry);
  }

  ensureSingleDefaultAgent(root);
  pruneModelReferences(root);
}

function setMissingNumericValue(target: JsonObject, key: string, value: number | undefined) {
  if (!Number.isFinite(value)) {
    return;
  }
  if (typeof target[key] === 'number') {
    return;
  }

  target[key] = Math.max(1, Math.floor(value as number));
}

function configureMultiAgentSupport(
  root: JsonObject,
  input: ConfigureOpenClawMultiAgentSupportInput,
) {
  const normalizedCoordinatorId = normalizeAgentId(input.coordinatorAgentId || DEFAULT_AGENT_ID);
  const normalizedAllowAgentIds = normalizeAgentIdList([
    normalizedCoordinatorId,
    ...input.allowAgentIds,
  ]);
  const existingCoordinator = getAgentListEntries(root).find(
    (entry) => normalizeAgentId(readScalar(entry.id)) === normalizedCoordinatorId,
  );

  if (!existingCoordinator) {
    saveAgentConfig(root, {
      id: normalizedCoordinatorId,
      isDefault: normalizedCoordinatorId === DEFAULT_AGENT_ID,
    });
  }

  const coordinatorEntry = getAgentListEntries(root).find(
    (entry) => normalizeAgentId(readScalar(entry.id)) === normalizedCoordinatorId,
  );
  if (coordinatorEntry) {
    const subagentsRoot = ensureObject(coordinatorEntry, 'subagents');
    const currentAllowAgents = readStringArray(subagentsRoot.allowAgents);
    const nextAllowAgents = normalizeAgentIdList([
      ...currentAllowAgents,
      ...normalizedAllowAgentIds.filter((agentId) => agentId !== normalizedCoordinatorId),
    ]);
    setStringArray(subagentsRoot, 'allowAgents', nextAllowAgents);
    deleteIfEmptyObject(coordinatorEntry, 'subagents');
  }

  const defaultsRoot = ensureObject(ensureObject(root, 'agents'), 'defaults');
  const subagentDefaultsRoot = ensureObject(defaultsRoot, 'subagents');
  setMissingNumericValue(
    subagentDefaultsRoot,
    'maxConcurrent',
    input.subagentDefaults?.maxConcurrent,
  );
  setMissingNumericValue(
    subagentDefaultsRoot,
    'maxSpawnDepth',
    input.subagentDefaults?.maxSpawnDepth,
  );
  setMissingNumericValue(
    subagentDefaultsRoot,
    'maxChildrenPerAgent',
    input.subagentDefaults?.maxChildrenPerAgent,
  );
  deleteIfEmptyObject(defaultsRoot, 'subagents');

  const toolsRoot = ensureObject(root, 'tools');
  const agentToAgentRoot = ensureObject(toolsRoot, 'agentToAgent');
  agentToAgentRoot.enabled = true;
  const currentAllowAgentIds = readStringArray(agentToAgentRoot.allow);
  setStringArray(
    agentToAgentRoot,
    'allow',
    normalizeAgentIdList([...currentAllowAgentIds, ...normalizedAllowAgentIds]),
  );
  deleteIfEmptyObject(toolsRoot, 'agentToAgent');

  if (input.sessionsVisibility) {
    const sessionsRoot = ensureObject(toolsRoot, 'sessions');
    const currentVisibility = readScalar(sessionsRoot.visibility).trim();
    if (!currentVisibility) {
      sessionsRoot.visibility = input.sessionsVisibility;
    }
    deleteIfEmptyObject(toolsRoot, 'sessions');
  }

  deleteIfEmptyObject(root, 'tools');
  ensureSingleDefaultAgent(root);
}

class OpenClawConfigService {
  getChannelDefinitions() {
    return OPENCLAW_CHANNEL_DEFINITIONS.map((definition) => ({
      ...definition,
      fields: definition.fields.map((field) => ({ ...field })),
      setupSteps: [...definition.setupSteps],
    }));
  }

  async resolveInstallConfigPath(input: OpenClawConfigPathInput) {
    const candidates: string[] = [];

    for (const homeRoot of input.homeRoots || []) {
      pushCandidatePath(candidates, joinPath(homeRoot, '.openclaw', 'openclaw.json'));
    }

    pushCandidatePath(candidates, joinPath(input.workRoot, '.openclaw', 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.installRoot, '.openclaw', 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.dataRoot, 'config', 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.dataRoot, 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.dataRoot, '.openclaw', 'openclaw.json'));

    for (const candidate of candidates) {
      if (await platform.pathExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  resolveInstanceConfigPath(detail: OpenClawConfigBackedDetail | null | undefined) {
    const configRoute = detail?.dataAccess?.routes?.find(
      (route) => route.scope === 'config' && route.mode === 'managedFile' && route.target,
    );
    if (configRoute?.target) {
      return normalizePath(configRoute.target);
    }

    const configArtifact = detail?.artifacts?.find(
      (artifact) => artifact.kind === 'configFile' && artifact.location,
    );
    if (configArtifact?.location) {
      return normalizePath(configArtifact.location);
    }

    return null;
  }

  async resolveAgentPaths(input: {
    configPath: string;
    agentId: string;
    workspace?: string | null;
    agentDir?: string | null;
  }) {
    const root = await readConfigRoot(input.configPath);
    return buildResolvedAgentPaths(root, input.configPath, input.agentId, {
      workspace: input.workspace,
      agentDir: input.agentDir,
    });
  }

  async readConfigSnapshot(configPath: string): Promise<OpenClawConfigSnapshot> {
    const root = await readConfigRoot(configPath);
    return {
      configPath: normalizePath(configPath),
      providerSnapshots: buildProviderSnapshots(root),
      agentSnapshots: buildAgentSnapshots(root, configPath),
      channelSnapshots: buildChannelSnapshots(root),
      root,
    };
  }

  async saveProviderSelection(input: {
    configPath: string;
    provider: OpenClawProviderInput;
    selection: OpenClawModelSelection;
  }) {
    const root = await readConfigRoot(input.configPath);
    updateProviderConfig(root, input.provider, input.selection);
    await writeConfigRoot(input.configPath, root);

    const providerKey = buildProviderKey(input.provider.id);
    return buildProviderSnapshots(root).find((provider) => provider.providerKey === providerKey) || null;
  }

  async createProviderModel(input: {
    configPath: string;
    providerId: string;
    model: OpenClawProviderModelInput;
  }) {
    const root = await readConfigRoot(input.configPath);
    const { providerRoot } = resolveProviderEntry(root, input.providerId);
    if (!providerRoot) {
      throw new Error(`OpenClaw provider "${input.providerId}" was not found.`);
    }

    const models = resolveProviderModelEntries(providerRoot);
    if (models.some((entry) => readScalar(entry.id).trim() === input.model.id.trim())) {
      throw new Error(`Model "${input.model.id}" already exists for provider "${input.providerId}".`);
    }

    providerRoot.models = [
      ...models,
      {
        id: input.model.id.trim(),
        name: input.model.name.trim() || input.model.id.trim(),
      },
    ] as JsonValue;
    updateProviderModelCatalog(root);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async updateProviderModel(input: {
    configPath: string;
    providerId: string;
    modelId: string;
    model: OpenClawProviderModelInput;
  }) {
    const root = await readConfigRoot(input.configPath);
    const { providerKey, providerRoot } = resolveProviderEntry(root, input.providerId);
    if (!providerRoot) {
      throw new Error(`OpenClaw provider "${input.providerId}" was not found.`);
    }

    const models = resolveProviderModelEntries(providerRoot);
    const target = models.find((entry) => readScalar(entry.id).trim() === input.modelId.trim());
    if (!target) {
      throw new Error(`Model "${input.modelId}" was not found for provider "${input.providerId}".`);
    }

    const nextModelId = input.model.id.trim();
    if (
      nextModelId !== input.modelId.trim() &&
      models.some((entry) => readScalar(entry.id).trim() === nextModelId)
    ) {
      throw new Error(`Model "${nextModelId}" already exists for provider "${input.providerId}".`);
    }

    const previousModelRef = buildModelRef(providerKey, input.modelId.trim());
    const nextModelRef = buildModelRef(providerKey, nextModelId);
    target.id = nextModelId;
    target.name = input.model.name.trim() || nextModelId;

    if (previousModelRef !== nextModelRef) {
      renameModelRefAcrossConfig(root, previousModelRef, nextModelRef);
    }

    updateProviderModelCatalog(root);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async deleteProviderModel(input: {
    configPath: string;
    providerId: string;
    modelId: string;
  }) {
    const root = await readConfigRoot(input.configPath);
    const { providerRoot } = resolveProviderEntry(root, input.providerId);
    if (!providerRoot) {
      throw new Error(`OpenClaw provider "${input.providerId}" was not found.`);
    }

    const nextModels = resolveProviderModelEntries(providerRoot).filter(
      (entry) => readScalar(entry.id).trim() !== input.modelId.trim(),
    );
    providerRoot.models = nextModels as JsonValue;
    updateProviderModelCatalog(root);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async deleteProvider(input: {
    configPath: string;
    providerId: string;
  }) {
    const root = await readConfigRoot(input.configPath);
    const { providersRoot, providerKey } = resolveProviderEntry(root, input.providerId);
    delete providersRoot[providerKey];
    updateProviderModelCatalog(root);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async saveAgent(input: {
    configPath: string;
    agent: OpenClawAgentInput;
  }) {
    const root = await readConfigRoot(input.configPath);
    saveAgentConfig(root, input.agent);
    await writeConfigRoot(input.configPath, root);

    return buildAgentSnapshots(root, input.configPath).find(
      (agent) => agent.id === normalizeAgentId(input.agent.id),
    ) || null;
  }

  async deleteAgent(input: {
    configPath: string;
    agentId: string;
  }) {
    const root = await readConfigRoot(input.configPath);
    deleteAgentConfig(root, input.agentId);
    await writeConfigRoot(input.configPath, root);

    return buildAgentSnapshots(root, input.configPath);
  }

  async configureMultiAgentSupport(input: ConfigureOpenClawMultiAgentSupportInput) {
    const root = await readConfigRoot(input.configPath);
    configureMultiAgentSupport(root, input);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async saveChannelConfiguration(input: SaveOpenClawChannelConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateChannelConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildChannelSnapshots(root).find((channel) => channel.id === input.channelId) || null;
  }

  async saveSkillEntry(input: SaveOpenClawSkillEntryInput) {
    const root = await readConfigRoot(input.configPath);
    updateSkillEntry(root, input);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async deleteSkillEntry(input: DeleteOpenClawSkillEntryInput) {
    const root = await readConfigRoot(input.configPath);
    deleteSkillEntry(root, input.skillKey);
    await writeConfigRoot(input.configPath, root);

    return this.readConfigSnapshot(input.configPath);
  }

  async setChannelEnabled(input: {
    configPath: string;
    channelId: string;
    enabled: boolean;
  }) {
    const root = await readConfigRoot(input.configPath);
    const channelsRoot = ensureObject(root, 'channels');
    const channelRoot = ensureObject(channelsRoot, input.channelId);
    channelRoot.enabled = input.enabled;
    await writeConfigRoot(input.configPath, root);

    return buildChannelSnapshots(root).find((channel) => channel.id === input.channelId) || null;
  }
}

export const openClawConfigService = new OpenClawConfigService();
