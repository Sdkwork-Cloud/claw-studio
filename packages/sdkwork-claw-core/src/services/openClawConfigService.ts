import { getPlatformBridge, platform } from '@sdkwork/claw-infrastructure';
import type {
  StudioWorkbenchLLMProviderRequestAuthMode,
  StudioWorkbenchLLMProviderRequestAuthRecord,
  StudioWorkbenchLLMProviderRequestOverridesRecord,
  StudioWorkbenchLLMProviderRequestProxyMode,
  StudioWorkbenchLLMProviderRequestProxyRecord,
  StudioWorkbenchLLMProviderRequestTlsRecord,
} from '@sdkwork/claw-types';
import {
  normalizeLegacyProviderId,
  normalizeLegacyProviderModelRef,
} from './legacyProviderCompat.ts';
import type { OpenClawLocalProxyProjection } from './openClawLocalProxyProjectionService.ts';
import { parseJson5, stringifyJson5 } from './json5Compat.ts';

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
  storageFormat?: 'scalar' | 'stringArray' | 'jsonObject';
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

const OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD: OpenClawChannelFieldDefinition = {
  key: 'contextVisibility',
  label: 'Context Visibility',
  placeholder: 'allowlist_quote',
  helpText:
    'Optional per-channel context visibility policy, for example quote, none, or allowlist_quote.',
};

export interface OpenClawWebSearchProviderSnapshot {
  id: string;
  name: string;
  description: string;
  apiKeySource: string;
  baseUrl: string;
  model: string;
  advancedConfig: string;
  supportsApiKey: boolean;
  supportsBaseUrl: boolean;
  supportsModel: boolean;
}

export interface OpenClawWebSearchConfigSnapshot {
  enabled: boolean;
  provider: string;
  maxResults: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  providers: OpenClawWebSearchProviderSnapshot[];
}

export interface OpenClawXSearchConfigSnapshot {
  enabled: boolean;
  apiKeySource: string;
  model: string;
  inlineCitations: boolean;
  maxTurns: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  advancedConfig: string;
}

export interface OpenClawWebSearchNativeCodexUserLocationSnapshot {
  country: string;
  city: string;
  timezone: string;
}

export interface OpenClawWebSearchNativeCodexConfigSnapshot {
  enabled: boolean;
  mode: string;
  allowedDomains: string[];
  contextSize: string;
  userLocation: OpenClawWebSearchNativeCodexUserLocationSnapshot;
  advancedConfig: string;
}

export interface OpenClawWebFetchFallbackProviderSnapshot {
  providerId: 'firecrawl';
  name: string;
  description: string;
  apiKeySource: string;
  baseUrl: string;
  advancedConfig: string;
  supportsApiKey: boolean;
  supportsBaseUrl: boolean;
}

export interface OpenClawWebFetchConfigSnapshot {
  enabled: boolean;
  maxChars: number;
  maxCharsCap: number;
  maxResponseBytes: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  maxRedirects: number;
  readability: boolean;
  userAgent: string;
  fallbackProvider: OpenClawWebFetchFallbackProviderSnapshot;
}

export interface OpenClawAuthCooldownsConfigSnapshot {
  rateLimitedProfileRotations: number | null;
  overloadedProfileRotations: number | null;
  overloadedBackoffMs: number | null;
  billingBackoffHours: number | null;
  billingMaxHours: number | null;
  failureWindowHours: number | null;
}

export interface OpenClawDreamingConfigSnapshot {
  enabled: boolean;
  frequency: string;
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
  request?: StudioWorkbenchLLMProviderRequestOverridesRecord;
}

const OPENCLAW_PROVIDER_REQUEST_AUTH_MODES: readonly StudioWorkbenchLLMProviderRequestAuthMode[] = [
  'provider-default',
  'authorization-bearer',
  'header',
];

const OPENCLAW_PROVIDER_REQUEST_PROXY_MODES: readonly StudioWorkbenchLLMProviderRequestProxyMode[] = [
  'env-proxy',
  'explicit-proxy',
];

export type OpenClawAgentParamValue = string | number | boolean;
export type OpenClawAgentParamSource = 'agent' | 'defaults';

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
  paramSources: Record<string, OpenClawAgentParamSource>;
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
  webSearchConfig: OpenClawWebSearchConfigSnapshot;
  xSearchConfig: OpenClawXSearchConfigSnapshot;
  webSearchNativeCodexConfig: OpenClawWebSearchNativeCodexConfigSnapshot;
  webFetchConfig: OpenClawWebFetchConfigSnapshot;
  authCooldownsConfig: OpenClawAuthCooldownsConfigSnapshot;
  dreamingConfig: OpenClawDreamingConfigSnapshot;
  root: JsonObject;
}

export interface OpenClawConfigDocumentSection {
  key: string;
  kind: 'object' | 'array' | 'scalar';
  entryCount: number;
  fieldNames: string[];
  formattedValue: string;
  preview: string;
}

export interface OpenClawConfigDocumentAnalysis {
  parseError: string | null;
  sections: OpenClawConfigDocumentSection[];
}

export interface OpenClawParsedConfigDocument {
  parsed: JsonObject | null;
  parseError: string | null;
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

export interface SaveOpenClawWebSearchConfigurationInput {
  configPath: string;
  enabled: boolean;
  provider: string;
  maxResults: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  providerConfig: {
    providerId: string;
    apiKeySource?: string;
    baseUrl?: string;
    model?: string;
    advancedConfig?: string;
  };
}

export interface SaveOpenClawXSearchConfigurationInput {
  configPath: string;
  enabled: boolean;
  apiKeySource?: string;
  model?: string;
  inlineCitations: boolean;
  maxTurns: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  advancedConfig?: string;
}

export interface SaveOpenClawWebSearchNativeCodexConfigurationInput {
  configPath: string;
  enabled: boolean;
  mode?: string;
  allowedDomains: string[];
  contextSize?: string;
  userLocation?: Partial<OpenClawWebSearchNativeCodexUserLocationSnapshot>;
  advancedConfig?: string;
}

export interface SaveOpenClawWebFetchConfigurationInput {
  configPath: string;
  enabled: boolean;
  maxChars: number;
  maxCharsCap: number;
  maxResponseBytes: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  maxRedirects: number;
  readability: boolean;
  userAgent?: string;
  fallbackProviderConfig: {
    providerId: 'firecrawl';
    apiKeySource?: string;
    baseUrl?: string;
    advancedConfig?: string;
  };
}

export interface SaveOpenClawAuthCooldownsConfigurationInput {
  configPath: string;
  rateLimitedProfileRotations?: number;
  overloadedProfileRotations?: number;
  overloadedBackoffMs?: number;
  billingBackoffHours?: number;
  billingMaxHours?: number;
  failureWindowHours?: number;
}

export interface SaveOpenClawDreamingConfigurationInput {
  configPath: string;
  enabled: boolean;
  frequency?: string;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

const DEFAULT_AGENT_ID = 'main';
const VALID_AGENT_ID_RE = /^[a-z0-9](?:[a-z0-9._-]{0,63})$/;
const INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9._-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;
const OPENCLAW_CONFIG_SNAPSHOT_CACHE_TTL_MS = 2_000;
const DEFAULT_WEB_SEARCH_MAX_RESULTS = 5;
const DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS = 30;
const DEFAULT_WEB_SEARCH_CACHE_TTL_MINUTES = 15;
const DEFAULT_X_SEARCH_MAX_TURNS = 2;
const DEFAULT_X_SEARCH_TIMEOUT_SECONDS = 30;
const DEFAULT_X_SEARCH_CACHE_TTL_MINUTES = 15;
const DEFAULT_WEB_SEARCH_NATIVE_CODEX_MODE = 'cached';
const DEFAULT_WEB_FETCH_MAX_CHARS = 50_000;
const DEFAULT_WEB_FETCH_MAX_CHARS_CAP = 50_000;
const DEFAULT_WEB_FETCH_MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_WEB_FETCH_TIMEOUT_SECONDS = 30;
const DEFAULT_WEB_FETCH_CACHE_TTL_MINUTES = 15;
const DEFAULT_WEB_FETCH_MAX_REDIRECTS = 3;

interface OpenClawConfigSnapshotCacheEntry {
  expiresAt: number;
  value: OpenClawConfigSnapshot;
}

interface OpenClawConfigRootCacheEntry {
  expiresAt: number;
  value: JsonObject;
}

interface OpenClawWebSearchProviderDefinition {
  id: string;
  pluginId: string;
  name: string;
  description: string;
  supportsApiKey: boolean;
  supportsBaseUrl: boolean;
  supportsModel: boolean;
}

type OpenClawPlatformBridge = ReturnType<typeof getPlatformBridge>;

const openClawConfigRootCacheByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, OpenClawConfigRootCacheEntry>
>();
const pendingOpenClawConfigRootByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, Promise<JsonObject>>
>();
const openClawConfigSnapshotCacheByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, OpenClawConfigSnapshotCacheEntry>
>();
const pendingOpenClawConfigSnapshotByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, Promise<OpenClawConfigSnapshot>>
>();
const openClawConfigSnapshotVersionByPath = new Map<string, number>();

function getOpenClawConfigRootCache(
  bridge = getPlatformBridge(),
) {
  let cache = openClawConfigRootCacheByReader.get(bridge);
  if (!cache) {
    cache = new Map<string, OpenClawConfigRootCacheEntry>();
    openClawConfigRootCacheByReader.set(bridge, cache);
  }

  return cache;
}

function getPendingOpenClawConfigRoots(
  bridge = getPlatformBridge(),
) {
  let pending = pendingOpenClawConfigRootByReader.get(bridge);
  if (!pending) {
    pending = new Map<string, Promise<JsonObject>>();
    pendingOpenClawConfigRootByReader.set(bridge, pending);
  }

  return pending;
}

function getOpenClawConfigSnapshotCache(
  bridge = getPlatformBridge(),
) {
  let cache = openClawConfigSnapshotCacheByReader.get(bridge);
  if (!cache) {
    cache = new Map<string, OpenClawConfigSnapshotCacheEntry>();
    openClawConfigSnapshotCacheByReader.set(bridge, cache);
  }

  return cache;
}

function getPendingOpenClawConfigSnapshots(
  bridge = getPlatformBridge(),
) {
  let pending = pendingOpenClawConfigSnapshotByReader.get(bridge);
  if (!pending) {
    pending = new Map<string, Promise<OpenClawConfigSnapshot>>();
    pendingOpenClawConfigSnapshotByReader.set(bridge, pending);
  }

  return pending;
}

function getOpenClawConfigSnapshotVersion(configPath: string) {
  return openClawConfigSnapshotVersionByPath.get(configPath) || 0;
}

function invalidateOpenClawConfigSnapshot(configPath: string) {
  const normalizedPath = normalizePath(configPath);
  openClawConfigSnapshotVersionByPath.set(
    normalizedPath,
    getOpenClawConfigSnapshotVersion(normalizedPath) + 1,
  );
  getOpenClawConfigRootCache().delete(normalizedPath);
  getPendingOpenClawConfigRoots().delete(normalizedPath);
  getOpenClawConfigSnapshotCache().delete(normalizedPath);
  getPendingOpenClawConfigSnapshots().delete(normalizedPath);
}

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

function cloneJsonObject(value: JsonObject) {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
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

function readOptionalNumber(value: JsonValue | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
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

function setOptionalFiniteNumber(target: JsonObject, key: string, value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    delete target[key];
    return;
  }

  target[key] = Math.max(1, Math.round(value));
}

function setOptionalWholeNumber(
  target: JsonObject,
  key: string,
  value: number | undefined,
  options: {
    minimum?: number;
  } = {},
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    delete target[key];
    return;
  }

  const minimum = options.minimum ?? 0;
  target[key] = Math.max(minimum, Math.round(value));
}

function setOptionalBoolean(target: JsonObject, key: string, value: boolean | undefined) {
  if (typeof value !== 'boolean') {
    delete target[key];
    return;
  }

  target[key] = value;
}

function parseJsonObjectText(label: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    return {} as JsonObject;
  }

  const parsed = parseJson5<JsonValue>(normalized);
  if (!isJsonObject(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed;
}

function truncateConfigDocumentPreview(value: string, maxLength = 96) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function buildConfigDocumentPreview(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Empty list';
    }

    return truncateConfigDocumentPreview(
      value
        .slice(0, 3)
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (isJsonObject(entry as JsonValue | undefined)) {
            return Object.keys(entry as JsonObject)
              .slice(0, 2)
              .join(', ');
          }
          return String(entry);
        })
        .filter(Boolean)
        .join(' • '),
    );
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    const keys = Object.keys(value as JsonObject);
    if (keys.length === 0) {
      return 'Empty object';
    }

    return truncateConfigDocumentPreview(keys.slice(0, 4).join(', '));
  }

  if (value == null) {
    return 'No value';
  }

  if (typeof value === 'string') {
    return truncateConfigDocumentPreview(value || 'Empty string');
  }

  return truncateConfigDocumentPreview(String(value));
}

function getConfigDocumentSectionKind(value: unknown): OpenClawConfigDocumentSection['kind'] {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    return 'object';
  }

  return 'scalar';
}

function countConfigDocumentSectionEntries(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    return Object.keys(value as JsonObject).length;
  }

  return value == null ? 0 : 1;
}

function collectConfigDocumentFieldNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((_, index) => `[${index}]`);
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    return Object.keys(value as JsonObject);
  }

  return [];
}

function formatConfigDocumentValue(value: unknown) {
  const formatted = JSON.stringify(value, null, 2);
  return typeof formatted === 'string' ? formatted : String(value);
}

export function analyzeOpenClawConfigDocument(raw: string): OpenClawConfigDocumentAnalysis {
  const parsedDocument = parseOpenClawConfigDocument(raw);
  if (!parsedDocument.parsed) {
    return {
      parseError: parsedDocument.parseError,
      sections: [],
    };
  }

  return {
    parseError: null,
    sections: Object.entries(parsedDocument.parsed).map(([key, value]) => ({
      key,
      kind: getConfigDocumentSectionKind(value),
      entryCount: countConfigDocumentSectionEntries(value),
      fieldNames: collectConfigDocumentFieldNames(value),
      formattedValue: formatConfigDocumentValue(value),
      preview: buildConfigDocumentPreview(value),
    })),
  };
}

export function parseOpenClawConfigDocument(raw: string): OpenClawParsedConfigDocument {
  const normalized = raw.trim();
  if (!normalized) {
    return {
      parsed: {},
      parseError: null,
    };
  }

  try {
    const parsed = parseJson5<JsonValue>(raw);
    if (!isJsonObject(parsed)) {
      return {
        parsed: null,
        parseError: 'OpenClaw config document must contain a top-level object.',
      };
    }

    return {
      parsed,
      parseError: null,
    };
  } catch (error: any) {
    const rawErrorMessage =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Failed to parse openclaw.json draft.';
    return {
      parsed: null,
      parseError: /openclaw\.json|json5|json/i.test(rawErrorMessage)
        ? rawErrorMessage
        : `Invalid openclaw.json JSON5: ${rawErrorMessage}`,
    };
  }
}

export function serializeOpenClawConfigDocument(root: Record<string, unknown>) {
  return `${JSON.stringify(root, null, 2).trimEnd()}\n`;
}

function requireOpenClawConfigDocumentRoot(raw: string): JsonObject {
  const parsedDocument = parseOpenClawConfigDocument(raw);
  if (!parsedDocument.parsed) {
    throw new Error(
      parsedDocument.parseError || 'OpenClaw config document must contain a top-level object.',
    );
  }

  return parsedDocument.parsed;
}

function mutateOpenClawConfigDocument(
  raw: string,
  mutate: (root: JsonObject) => void,
) {
  const root = requireOpenClawConfigDocumentRoot(raw);
  mutate(root);
  return serializeOpenClawConfigDocument(root);
}

export function saveOpenClawAgentInConfigDocument(raw: string, agent: OpenClawAgentInput) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveAgentConfig(root, agent);
  });
}

export function deleteOpenClawAgentFromConfigDocument(raw: string, agentId: string) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    deleteAgentConfig(root, agentId);
  });
}

export function saveOpenClawChannelConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawChannelConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateChannelConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function saveOpenClawWebSearchConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateWebSearchConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function saveOpenClawXSearchConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawXSearchConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateXSearchConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function saveOpenClawWebSearchNativeCodexConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawWebSearchNativeCodexConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateWebSearchNativeCodexConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function saveOpenClawWebFetchConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawWebFetchConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateWebFetchConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function saveOpenClawAuthCooldownsConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateAuthCooldownsConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function saveOpenClawDreamingConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawDreamingConfigurationInput, 'configPath'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateDreamingConfig(root, {
      configPath: '',
      ...input,
    });
  });
}

export function setOpenClawChannelEnabledInDocument(
  raw: string,
  input: {
    channelId: string;
    enabled: boolean;
  },
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    const channelsRoot = ensureObject(root, 'channels');
    const channelRoot = ensureObject(channelsRoot, input.channelId);
    channelRoot.enabled = input.enabled;
  });
}

function parseChannelStringArrayValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonArray {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('[')) {
    const parsed = parseJson5<JsonObject>(normalized);
    if (!Array.isArray(parsed)) {
      throw new Error(`${field.label} must be a JSON array.`);
    }

    return parsed
      .map((entry) => (entry == null ? '' : String(entry).trim()))
      .filter(Boolean);
  }

  return normalized
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseChannelJsonObjectValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonObject {
  const parsed = parseJson5<JsonValue>(value);
  if (!isJsonObject(parsed)) {
    throw new Error(`${field.label} must be a JSON object.`);
  }

  return parsed;
}

function setOptionalChannelField(
  target: JsonObject,
  field: OpenClawChannelFieldDefinition,
  value: string | undefined,
) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[field.key];
    return;
  }

  if (field.storageFormat === 'stringArray') {
    target[field.key] = parseChannelStringArrayValue(field, normalized);
    return;
  }

  if (field.storageFormat === 'jsonObject') {
    target[field.key] = parseChannelJsonObjectValue(field, normalized);
    return;
  }

  target[field.key] = normalized;
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

function normalizeProviderKey(providerId: string | undefined | null) {
  return normalizeLegacyProviderId(providerId);
}

function buildProviderKey(providerId: string) {
  return normalizeProviderKey(providerId);
}

function buildModelRef(providerKey: string, modelId: string) {
  const normalizedProviderKey = normalizeProviderKey(providerKey);
  const normalizedModelRef = normalizeModelRefString(modelId);
  return normalizedModelRef.includes('/')
    ? normalizedModelRef
    : `${normalizedProviderKey}/${normalizedModelRef}`;
}

function normalizeModelRefString(value: string | undefined | null) {
  return normalizeLegacyProviderModelRef(value);
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

function readStringRecord(root: JsonObject | null | undefined) {
  if (!root) {
    return undefined;
  }

  const nextRecord = Object.fromEntries(
    Object.entries(root).flatMap(([key, value]) => {
      const nextValue = readScalar(value);
      return nextValue ? [[key, nextValue]] : [];
    }),
  );

  return Object.keys(nextRecord).length > 0 ? nextRecord : undefined;
}

function writeStringRecord(target: JsonObject, key: string, value: Record<string, string> | undefined) {
  const nextRecord = Object.fromEntries(
    Object.entries(value || {}).flatMap(([entryKey, entryValue]) => {
      const normalizedKey = entryKey.trim();
      const normalizedValue = entryValue.trim();
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : [];
    }),
  );

  if (Object.keys(nextRecord).length === 0) {
    delete target[key];
    return;
  }

  target[key] = nextRecord;
}

function readProviderRequestTls(
  value: JsonValue | undefined,
): StudioWorkbenchLLMProviderRequestTlsRecord | undefined {
  const root = readObject(value);
  if (!root) {
    return undefined;
  }

  const nextTls: StudioWorkbenchLLMProviderRequestTlsRecord = {};
  const ca = readScalar(root.ca);
  const cert = readScalar(root.cert);
  const key = readScalar(root.key);
  const passphrase = readScalar(root.passphrase);
  const serverName = readScalar(root.serverName);

  if (ca) {
    nextTls.ca = ca;
  }
  if (cert) {
    nextTls.cert = cert;
  }
  if (key) {
    nextTls.key = key;
  }
  if (passphrase) {
    nextTls.passphrase = passphrase;
  }
  if (serverName) {
    nextTls.serverName = serverName;
  }
  if (typeof root.insecureSkipVerify === 'boolean') {
    nextTls.insecureSkipVerify = root.insecureSkipVerify;
  }

  return Object.values(nextTls).some((entry) => entry !== undefined) ? nextTls : undefined;
}

function writeProviderRequestTls(
  value: StudioWorkbenchLLMProviderRequestTlsRecord | undefined,
): JsonObject | undefined {
  if (!value) {
    return undefined;
  }

  const nextRoot: JsonObject = {};
  setOptionalScalar(nextRoot, 'ca', value.ca);
  setOptionalScalar(nextRoot, 'cert', value.cert);
  setOptionalScalar(nextRoot, 'key', value.key);
  setOptionalScalar(nextRoot, 'passphrase', value.passphrase);
  setOptionalScalar(nextRoot, 'serverName', value.serverName);
  setOptionalBoolean(nextRoot, 'insecureSkipVerify', value.insecureSkipVerify);

  return Object.keys(nextRoot).length > 0 ? nextRoot : undefined;
}

function readProviderRequestAuth(
  value: JsonValue | undefined,
): StudioWorkbenchLLMProviderRequestAuthRecord | undefined {
  const root = readObject(value);
  if (!root) {
    return undefined;
  }

  const mode = readScalar(root.mode) as StudioWorkbenchLLMProviderRequestAuthMode;
  if (!OPENCLAW_PROVIDER_REQUEST_AUTH_MODES.includes(mode)) {
    return undefined;
  }

  const nextAuth: StudioWorkbenchLLMProviderRequestAuthRecord = {
    mode,
  };
  if (mode === 'authorization-bearer') {
    const token = readScalar(root.token);
    if (token) {
      nextAuth.token = token;
    }
  }
  if (mode === 'header') {
    const headerName = readScalar(root.headerName);
    const value = readScalar(root.value);
    const prefix = readScalar(root.prefix);
    if (headerName) {
      nextAuth.headerName = headerName;
    }
    if (value) {
      nextAuth.value = value;
    }
    if (prefix) {
      nextAuth.prefix = prefix;
    }
  }

  return nextAuth;
}

function writeProviderRequestAuth(
  value: StudioWorkbenchLLMProviderRequestAuthRecord | undefined,
): JsonObject | undefined {
  if (!value || !OPENCLAW_PROVIDER_REQUEST_AUTH_MODES.includes(value.mode)) {
    return undefined;
  }

  const nextRoot: JsonObject = {
    mode: value.mode,
  };
  if (value.mode === 'authorization-bearer') {
    setOptionalScalar(nextRoot, 'token', value.token);
  }
  if (value.mode === 'header') {
    setOptionalScalar(nextRoot, 'headerName', value.headerName);
    setOptionalScalar(nextRoot, 'value', value.value);
    setOptionalScalar(nextRoot, 'prefix', value.prefix);
  }

  return nextRoot;
}

function readProviderRequestProxy(
  value: JsonValue | undefined,
): StudioWorkbenchLLMProviderRequestProxyRecord | undefined {
  const root = readObject(value);
  if (!root) {
    return undefined;
  }

  const mode = readScalar(root.mode) as StudioWorkbenchLLMProviderRequestProxyMode;
  if (!OPENCLAW_PROVIDER_REQUEST_PROXY_MODES.includes(mode)) {
    return undefined;
  }

  const nextProxy: StudioWorkbenchLLMProviderRequestProxyRecord = {
    mode,
  };
  if (mode === 'explicit-proxy') {
    const url = readScalar(root.url);
    if (url) {
      nextProxy.url = url;
    }
  }
  const tls = readProviderRequestTls(root.tls);
  if (tls) {
    nextProxy.tls = tls;
  }

  return nextProxy;
}

function writeProviderRequestProxy(
  value: StudioWorkbenchLLMProviderRequestProxyRecord | undefined,
): JsonObject | undefined {
  if (!value || !OPENCLAW_PROVIDER_REQUEST_PROXY_MODES.includes(value.mode)) {
    return undefined;
  }

  const nextRoot: JsonObject = {
    mode: value.mode,
  };
  if (value.mode === 'explicit-proxy') {
    setOptionalScalar(nextRoot, 'url', value.url);
  }
  const tls = writeProviderRequestTls(value.tls);
  if (tls) {
    nextRoot.tls = tls;
  }

  return nextRoot;
}

function readProviderRequestConfig(
  providerRoot: JsonObject,
): StudioWorkbenchLLMProviderRequestOverridesRecord | undefined {
  const requestRoot = readObject(providerRoot.request);
  if (!requestRoot) {
    return undefined;
  }

  const headers = readStringRecord(readObject(requestRoot.headers));
  const auth = readProviderRequestAuth(requestRoot.auth);
  const proxy = readProviderRequestProxy(requestRoot.proxy);
  const tls = readProviderRequestTls(requestRoot.tls);

  return headers || auth || proxy || tls
    ? {
        ...(headers ? { headers } : {}),
        ...(auth ? { auth } : {}),
        ...(proxy ? { proxy } : {}),
        ...(tls ? { tls } : {}),
      }
    : undefined;
}

function writeProviderRequestConfig(
  providerRoot: JsonObject,
  request: StudioWorkbenchLLMProviderRequestOverridesRecord | undefined,
) {
  if (!request) {
    delete providerRoot.request;
    return;
  }

  const requestRoot: JsonObject = {};
  writeStringRecord(requestRoot, 'headers', request.headers);
  const auth = writeProviderRequestAuth(request.auth);
  if (auth) {
    requestRoot.auth = auth;
  }
  const proxy = writeProviderRequestProxy(request.proxy);
  if (proxy) {
    requestRoot.proxy = proxy;
  }
  const tls = writeProviderRequestTls(request.tls);
  if (tls) {
    requestRoot.tls = tls;
  }

  if (Object.keys(requestRoot).length === 0) {
    delete providerRoot.request;
    return;
  }

  providerRoot.request = requestRoot;
}

function readProviderRuntimeConfig(
  root: JsonObject,
  providerKey: string,
  modelId: string | undefined,
  providerRoot?: JsonObject,
): OpenClawProviderRuntimeConfig {
  const defaultsModelsRoot = readObject(readObject(readObject(root.agents)?.defaults)?.models) || {};
  const modelRoot = modelId
    ? readObject(defaultsModelsRoot[buildModelRef(providerKey, modelId)])
    : undefined;
  const modelParams = modelRoot ? readAgentParams(modelRoot.params) : {};
  const request = providerRoot ? readProviderRequestConfig(providerRoot) : undefined;

  return {
    temperature: readNumber(modelParams.temperature, 0.2),
    topP: readNumber(modelParams.topP, 1),
    maxTokens: readNumber(modelParams.maxTokens, 8192),
    timeoutMs: readNumber(modelParams.timeoutMs, 60000),
    streaming: readBoolean(modelParams.streaming, true),
    ...(request ? { request } : {}),
  };
}

function writeProviderRuntimeConfig(
  root: JsonObject,
  providerKey: string,
  modelId: string | undefined,
  config?: Partial<OpenClawProviderRuntimeConfig>,
) {
  const normalizedModelId = modelId?.trim() || '';
  if (!normalizedModelId) {
    return;
  }

  const defaultsRoot = ensureObject(ensureObject(root, 'agents'), 'defaults');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  const modelRoot = ensureObject(catalogRoot, buildModelRef(providerKey, normalizedModelId));
  writeAgentParams(modelRoot, {
    temperature: config?.temperature,
    topP: config?.topP,
    maxTokens: config?.maxTokens,
    timeoutMs: config?.timeoutMs,
    streaming: config?.streaming,
  });
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
  const defaultParams = readAgentParams(defaultsRoot.params);
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
    const agentParams = readAgentParams(entry.params);
    const effectiveParams = {
      ...defaultParams,
      ...agentParams,
    };
    const paramSources = Object.fromEntries(
      Object.keys(effectiveParams).map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(agentParams, key) ? 'agent' : 'defaults',
      ]),
    ) as Record<string, OpenClawAgentParamSource>;

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
      params: effectiveParams,
      paramSources,
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
    name: 'SDKWORK Official Account',
    description:
      'Use the built-in SDKWORK official account delivery path so OpenClaw can hand off conversations without extra credential setup.',
    setupSteps: [
      'Open the integrated SDKWORK official account experience or install the SDKWORK client if this machine has not signed in yet.',
      'Sign in with your SDKWORK account so the default media channel is ready immediately.',
      'Keep this channel enabled when the current runtime should hand off into the SDKWORK official account.',
    ],
    configurationMode: 'none',
    fields: [],
  },
  {
    id: 'wehcat',
    name: 'WeChat Official Account',
    description:
      'Connect a WeChat official account workflow so OpenClaw can serve China-facing media channels.',
    setupSteps: [
      'Create or manage a WeChat official account in the WeChat official account platform.',
      'Paste the App ID, App Secret, token, and optional AES key here.',
      'Configure the callback URL on the WeChat side and enable the official account channel.',
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
      {
        key: 'errorPolicy',
        label: 'Error Policy',
        placeholder: 'retry',
        helpText: 'Optional Telegram delivery error policy, for example retry or disable.',
      },
      {
        key: 'errorCooldownMs',
        label: 'Error Cooldown (ms)',
        placeholder: '300000',
        inputMode: 'numeric',
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description:
      'Manage optional WhatsApp access rules for direct-message allowlists and group delivery behavior.',
    setupSteps: [
      'Authenticate the OpenClaw WhatsApp channel with the official CLI or runtime login flow.',
      'Optionally restrict allowed direct-message senders or define per-group behavior here.',
      'Keep the channel enabled so runtime login state can be reused without extra config wiring.',
    ],
    configurationMode: 'none',
    fields: [
      {
        key: 'allowFrom',
        label: 'Allow From',
        placeholder: '+15555550123\n+15555550124',
        helpText:
          'Optional allowlist of direct-message senders. Enter one phone number per line or a JSON array.',
        multiline: true,
        storageFormat: 'stringArray',
      },
      {
        key: 'groups',
        label: 'Groups',
        placeholder: `{
  "*": {
    "requireMention": true
  }
}`,
        helpText:
          'Optional JSON object of WhatsApp group rules. Use "*" to define defaults for all groups.',
        multiline: true,
        storageFormat: 'jsonObject',
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

const OPENCLAW_WEB_SEARCH_PROVIDER_DEFINITIONS: OpenClawWebSearchProviderDefinition[] = [
  {
    id: 'brave',
    pluginId: 'brave',
    name: 'Brave Search',
    description: 'Use Brave Search as the OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: false,
  },
  {
    id: 'duckduckgo',
    pluginId: 'duckduckgo',
    name: 'DuckDuckGo Search',
    description: 'Use DuckDuckGo without additional provider credentials.',
    supportsApiKey: false,
    supportsBaseUrl: false,
    supportsModel: false,
  },
  {
    id: 'exa',
    pluginId: 'exa',
    name: 'Exa Search',
    description: 'Use Exa as the active OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: false,
  },
  {
    id: 'firecrawl',
    pluginId: 'firecrawl',
    name: 'Firecrawl Search',
    description: 'Use Firecrawl search and extraction as the web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: false,
  },
  {
    id: 'gemini',
    pluginId: 'google',
    name: 'Gemini Search',
    description: 'Use Gemini web search through the official OpenClaw adapter.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'grok',
    pluginId: 'xai',
    name: 'Grok Search',
    description: 'Use Grok web search through the official OpenClaw adapter.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'kimi',
    pluginId: 'moonshot',
    name: 'Kimi Search',
    description: 'Use Kimi as the active OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'perplexity',
    pluginId: 'perplexity',
    name: 'Perplexity Search',
    description: 'Use Perplexity for grounded web-search results.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'searxng',
    pluginId: 'searxng',
    name: 'SearXNG',
    description: 'Use a self-hosted SearXNG endpoint as the web search provider.',
    supportsApiKey: false,
    supportsBaseUrl: true,
    supportsModel: false,
  },
  {
    id: 'tavily',
    pluginId: 'tavily',
    name: 'Tavily Search',
    description: 'Use Tavily as the OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: false,
  },
];

function resolveChannelDefinition(
  definition: OpenClawChannelDefinition,
): OpenClawChannelDefinition {
  const fields = definition.fields.map((field) => ({ ...field }));
  const shouldExposeContextVisibility = definition.id !== 'sdkworkchat';

  if (
    shouldExposeContextVisibility &&
    !fields.some((field) => field.key === OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD.key)
  ) {
    fields.push({ ...OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD });
  }

  return {
    ...definition,
    setupSteps: [...definition.setupSteps],
    fields,
  };
}

function listResolvedChannelDefinitions() {
  return OPENCLAW_CHANNEL_DEFINITIONS.map(resolveChannelDefinition);
}

function getChannelDefinition(channelId: string) {
  return (
    listResolvedChannelDefinitions().find((definition) => definition.id === channelId) || null
  );
}

function getWebSearchProviderDefinition(providerId: string) {
  return (
    OPENCLAW_WEB_SEARCH_PROVIDER_DEFINITIONS.find(
      (definition) => definition.id === normalizeWebSearchProviderId(providerId),
    ) ||
    null
  );
}

function getPluginConfigRoot(root: JsonObject, pluginId: string) {
  return (
    readObject(
      readObject(
        readObject(readObject(root.plugins)?.entries)?.[pluginId],
      )?.config,
    ) || null
  );
}

async function readConfigRoot(configPath: string) {
  const normalizedConfigPath = normalizePath(configPath);
  const rootCache = getOpenClawConfigRootCache();
  const pendingRoots = getPendingOpenClawConfigRoots();
  const currentTime = Date.now();
  const cached = rootCache.get(normalizedConfigPath);
  if (cached && cached.expiresAt > currentTime) {
    return cloneJsonObject(cached.value);
  }

  const pending = pendingRoots.get(normalizedConfigPath);
  if (pending) {
    return pending.then((root) => cloneJsonObject(root));
  }

  const version = getOpenClawConfigSnapshotVersion(normalizedConfigPath);
  const request = platform.readFile(normalizedConfigPath)
    .then((raw) => {
      const parsed = raw.trim() ? parseJson5<JsonObject>(raw) : {};

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {} as JsonObject;
      }

      const root = parsed as JsonObject;
      normalizeLegacyProviderLayout(root);
      return root;
    })
    .then((root) => {
      const cachedRoot = cloneJsonObject(root);
      if (getOpenClawConfigSnapshotVersion(normalizedConfigPath) === version) {
        rootCache.set(normalizedConfigPath, {
          expiresAt: Date.now() + OPENCLAW_CONFIG_SNAPSHOT_CACHE_TTL_MS,
          value: cachedRoot,
        });
      }

      return cachedRoot;
    })
    .finally(() => {
      if (pendingRoots.get(normalizedConfigPath) === request) {
        pendingRoots.delete(normalizedConfigPath);
      }
    });

  pendingRoots.set(normalizedConfigPath, request);
  return request.then((root) => cloneJsonObject(root));
}

async function writeConfigRoot(configPath: string, root: JsonObject) {
  const normalizedConfigPath = normalizePath(configPath);
  const content = `${stringifyJson5(root, 2)}\n`;
  await platform.writeFile(normalizedConfigPath, content);
  invalidateOpenClawConfigSnapshot(normalizedConfigPath);
}

function buildChannelSnapshots(root: JsonObject): OpenClawChannelSnapshot[] {
  const channelsRoot =
    root.channels && typeof root.channels === 'object' && !Array.isArray(root.channels)
      ? (root.channels as JsonObject)
      : {};

  return listResolvedChannelDefinitions().map((definition) => {
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

function readWebSearchRoot(root: JsonObject) {
  return readObject(readObject(readObject(root.tools)?.web)?.search) || null;
}

function normalizeWebSearchProviderId(providerId: string) {
  const normalizedProviderId = providerId.trim().toLowerCase();
  switch (normalizedProviderId) {
    case 'google':
      return 'gemini';
    case 'xai':
      return 'grok';
    case 'moonshot':
      return 'kimi';
    default:
      return normalizedProviderId;
  }
}

function getPluginEntryConfigRoot(root: JsonObject, providerId: string) {
  const pluginId = getWebSearchProviderDefinition(providerId)?.pluginId ?? normalizeWebSearchProviderId(providerId);
  return getPluginConfigRoot(root, pluginId);
}

function getPluginWebSearchAuthRoot(root: JsonObject, providerId: string) {
  return readObject(getPluginEntryConfigRoot(root, providerId)?.webSearch) || null;
}

function getPluginWebSearchSettingsRoot(root: JsonObject, providerId: string) {
  return readObject(getPluginEntryConfigRoot(root, providerId)?.webSearch) || null;
}

function buildWebSearchProviderAdvancedConfig(
  root: JsonObject,
  definition: OpenClawWebSearchProviderDefinition,
) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.apiKey;
  if (definition.supportsBaseUrl) {
    delete nextRoot.baseUrl;
  }
  if (definition.supportsModel) {
    delete nextRoot.model;
  }

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

function buildWebSearchProviderSnapshots(root: JsonObject): OpenClawWebSearchProviderSnapshot[] {
  return OPENCLAW_WEB_SEARCH_PROVIDER_DEFINITIONS.map((definition) => {
    const providerAuthRoot = getPluginWebSearchAuthRoot(root, definition.id) || {};
    const providerSettingsRoot = getPluginWebSearchSettingsRoot(root, definition.id) || {};

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      apiKeySource: readScalar(providerAuthRoot.apiKey),
      baseUrl: readScalar(providerSettingsRoot.baseUrl),
      model: readScalar(providerSettingsRoot.model),
      advancedConfig: buildWebSearchProviderAdvancedConfig(providerSettingsRoot, definition),
      supportsApiKey: definition.supportsApiKey,
      supportsBaseUrl: definition.supportsBaseUrl,
      supportsModel: definition.supportsModel,
    };
  });
}

function buildWebSearchConfigSnapshot(root: JsonObject): OpenClawWebSearchConfigSnapshot {
  const searchRoot = readWebSearchRoot(root) || {};

  return {
    enabled: readBoolean(searchRoot.enabled, true),
    provider: normalizeWebSearchProviderId(readScalar(searchRoot.provider)),
    maxResults: readNumber(searchRoot.maxResults, DEFAULT_WEB_SEARCH_MAX_RESULTS),
    timeoutSeconds: readNumber(searchRoot.timeoutSeconds, DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS),
    cacheTtlMinutes: readNumber(searchRoot.cacheTtlMinutes, DEFAULT_WEB_SEARCH_CACHE_TTL_MINUTES),
    providers: buildWebSearchProviderSnapshots(root),
  };
}

function readLegacyXSearchRoot(root: JsonObject) {
  return readObject(readObject(readObject(root.tools)?.web)?.x_search) || null;
}

function getPluginXSearchConfigRoot(root: JsonObject) {
  return readObject(getPluginConfigRoot(root, 'xai')?.xSearch) || null;
}

function readXSearchRoot(root: JsonObject) {
  return getPluginXSearchConfigRoot(root) || readLegacyXSearchRoot(root) || null;
}

function buildXSearchAdvancedConfig(root: JsonObject) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.enabled;
  delete nextRoot.model;
  delete nextRoot.inlineCitations;
  delete nextRoot.maxTurns;
  delete nextRoot.timeoutSeconds;
  delete nextRoot.cacheTtlMinutes;

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

function buildXSearchConfigSnapshot(root: JsonObject): OpenClawXSearchConfigSnapshot {
  const xSearchRoot = readXSearchRoot(root) || {};
  const xaiWebSearchRoot = getPluginWebSearchAuthRoot(root, 'grok') || {};

  return {
    enabled: readBoolean(xSearchRoot.enabled, false),
    apiKeySource: readScalar(xaiWebSearchRoot.apiKey),
    model: readScalar(xSearchRoot.model),
    inlineCitations: readBoolean(xSearchRoot.inlineCitations, false),
    maxTurns: readNumber(xSearchRoot.maxTurns, DEFAULT_X_SEARCH_MAX_TURNS),
    timeoutSeconds: readNumber(xSearchRoot.timeoutSeconds, DEFAULT_X_SEARCH_TIMEOUT_SECONDS),
    cacheTtlMinutes: readNumber(xSearchRoot.cacheTtlMinutes, DEFAULT_X_SEARCH_CACHE_TTL_MINUTES),
    advancedConfig: buildXSearchAdvancedConfig(xSearchRoot),
  };
}

function getWebSearchNativeCodexRoot(root: JsonObject) {
  return readObject(readWebSearchRoot(root)?.openaiCodex) || null;
}

function buildWebSearchNativeCodexAdvancedConfig(root: JsonObject) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.enabled;
  delete nextRoot.mode;
  delete nextRoot.allowedDomains;
  delete nextRoot.contextSize;
  delete nextRoot.userLocation;

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

function buildWebSearchNativeCodexConfigSnapshot(
  root: JsonObject,
): OpenClawWebSearchNativeCodexConfigSnapshot {
  const openaiCodexRoot = getWebSearchNativeCodexRoot(root) || {};
  const userLocationRoot = readObject(openaiCodexRoot.userLocation) || {};

  return {
    enabled: readBoolean(openaiCodexRoot.enabled, false),
    mode: readScalar(openaiCodexRoot.mode) || DEFAULT_WEB_SEARCH_NATIVE_CODEX_MODE,
    allowedDomains: readStringArray(openaiCodexRoot.allowedDomains),
    contextSize: readScalar(openaiCodexRoot.contextSize),
    userLocation: {
      country: readScalar(userLocationRoot.country),
      city: readScalar(userLocationRoot.city),
      timezone: readScalar(userLocationRoot.timezone),
    },
    advancedConfig: buildWebSearchNativeCodexAdvancedConfig(openaiCodexRoot),
  };
}

function readWebFetchRoot(root: JsonObject) {
  return readObject(readObject(readObject(root.tools)?.web)?.fetch) || null;
}

function getPluginWebFetchConfigRoot(root: JsonObject) {
  return readObject(getPluginConfigRoot(root, 'firecrawl')?.webFetch) || null;
}

function buildWebFetchFallbackAdvancedConfig(root: JsonObject) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.apiKey;
  delete nextRoot.baseUrl;

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

function buildWebFetchConfigSnapshot(root: JsonObject): OpenClawWebFetchConfigSnapshot {
  const fetchRoot = readWebFetchRoot(root) || {};
  const firecrawlRoot = getPluginWebFetchConfigRoot(root) || {};

  return {
    enabled: readBoolean(fetchRoot.enabled, true),
    maxChars: readNumber(fetchRoot.maxChars, DEFAULT_WEB_FETCH_MAX_CHARS),
    maxCharsCap: readNumber(fetchRoot.maxCharsCap, DEFAULT_WEB_FETCH_MAX_CHARS_CAP),
    maxResponseBytes: readNumber(fetchRoot.maxResponseBytes, DEFAULT_WEB_FETCH_MAX_RESPONSE_BYTES),
    timeoutSeconds: readNumber(fetchRoot.timeoutSeconds, DEFAULT_WEB_FETCH_TIMEOUT_SECONDS),
    cacheTtlMinutes: readNumber(fetchRoot.cacheTtlMinutes, DEFAULT_WEB_FETCH_CACHE_TTL_MINUTES),
    maxRedirects: readNumber(fetchRoot.maxRedirects, DEFAULT_WEB_FETCH_MAX_REDIRECTS),
    readability: readBoolean(fetchRoot.readability, true),
    userAgent: readScalar(fetchRoot.userAgent),
    fallbackProvider: {
      providerId: 'firecrawl',
      name: 'Firecrawl Fetch',
      description: 'Use Firecrawl as the OpenClaw web_fetch fallback provider.',
      apiKeySource: readScalar(firecrawlRoot.apiKey),
      baseUrl: readScalar(firecrawlRoot.baseUrl),
      advancedConfig: buildWebFetchFallbackAdvancedConfig(firecrawlRoot),
      supportsApiKey: true,
      supportsBaseUrl: true,
    },
  };
}

function readAuthCooldownsRoot(root: JsonObject) {
  return readObject(readObject(root.auth)?.cooldowns) || null;
}

function buildAuthCooldownsConfigSnapshot(root: JsonObject): OpenClawAuthCooldownsConfigSnapshot {
  const cooldownsRoot = readAuthCooldownsRoot(root) || {};

  return {
    rateLimitedProfileRotations: readOptionalNumber(cooldownsRoot.rateLimitedProfileRotations),
    overloadedProfileRotations: readOptionalNumber(cooldownsRoot.overloadedProfileRotations),
    overloadedBackoffMs: readOptionalNumber(cooldownsRoot.overloadedBackoffMs),
    billingBackoffHours: readOptionalNumber(cooldownsRoot.billingBackoffHours),
    billingMaxHours: readOptionalNumber(cooldownsRoot.billingMaxHours),
    failureWindowHours: readOptionalNumber(cooldownsRoot.failureWindowHours),
  };
}

function readDreamingRoot(root: JsonObject) {
  return readObject(getPluginConfigRoot(root, 'memory-core')?.dreaming) || null;
}

function buildDreamingConfigSnapshot(root: JsonObject): OpenClawDreamingConfigSnapshot {
  const dreamingRoot = readDreamingRoot(root) || {};

  return {
    enabled: readBoolean(dreamingRoot.enabled, false),
    frequency: readScalar(dreamingRoot.frequency),
  };
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
    const config = readProviderRuntimeConfig(root, providerKey, defaultModelId, provider);

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
        config,
      },
    ];
  });
}

function resolveOpenClawProviderAdapter(channelId: string) {
  switch (channelId.trim().toLowerCase()) {
    case 'anthropic':
      return {
        api: 'anthropic-messages',
        auth: 'api-key',
      };
    case 'ollama':
      return {
        api: 'ollama',
        auth: 'api-key',
      };
    case 'gemini':
    case 'google':
    case 'google-generative-ai':
      return {
        api: 'google-generative-ai',
        auth: 'api-key',
      };
    default:
      return {
        api: 'openai-completions',
        auth: 'api-key',
      };
  }
}

function updateProviderConfig(
  root: JsonObject,
  provider: OpenClawProviderInput,
  selection: OpenClawModelSelection,
  options: {
    overwriteDefaults?: boolean;
  } = {},
) {
  const modelsRoot = ensureObject(root, 'models');
  const providersRoot = ensureObject(modelsRoot, 'providers');
  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const providerKey = buildProviderKey(provider.id);
  const providerRoot = ensureObject(providersRoot, providerKey);
  const adapter = resolveOpenClawProviderAdapter(provider.channelId);

  providerRoot.baseUrl = provider.baseUrl;
  providerRoot.apiKey = provider.apiKey;
  providerRoot.api = adapter.api;
  providerRoot.auth = adapter.auth;
  clearLegacyProviderRuntimeConfig(providerRoot);
  providerRoot.models = provider.models.map((model) => ({
    id: model.id,
    name: model.name,
    reasoning: model.id === selection.reasoningModelId,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: model.id === selection.embeddingModelId ? 8192 : model.id === selection.reasoningModelId ? 200000 : 128000,
    maxTokens: model.id === selection.embeddingModelId ? 8192 : 32000,
  })) as JsonValue;

  if (options.overwriteDefaults !== false) {
    writeModelConfig(defaultsRoot, 'model', {
      primary: buildModelRef(providerKey, selection.defaultModelId),
      fallbacks: selection.reasoningModelId
        ? [buildModelRef(providerKey, selection.reasoningModelId)]
        : [],
    });
  }

  syncModelCatalog(root);
  writeProviderRuntimeConfig(root, providerKey, selection.defaultModelId, provider.config);
  writeProviderRequestConfig(providerRoot, provider.config?.request);
  pruneModelReferences(root);
}

function clearLegacyProviderRuntimeConfig(providerRoot: JsonObject) {
  delete providerRoot.temperature;
  delete providerRoot.topP;
  delete providerRoot.maxTokens;
  delete providerRoot.timeoutMs;
  delete providerRoot.streaming;
}

function canonicalizeManagedLocalProxyProviders(root: JsonObject, providerId: string) {
  const providersRoot = ensureObject(ensureObject(root, 'models'), 'providers');
  const managedProviderKey = buildProviderKey(providerId);

  for (const providerKey of Object.keys(providersRoot)) {
    if (providerKey !== managedProviderKey) {
      delete providersRoot[providerKey];
    }
  }
}

function updateChannelConfig(root: JsonObject, input: SaveOpenClawChannelConfigurationInput) {
  const channelsRoot = ensureObject(root, 'channels');
  const channelRoot = ensureObject(channelsRoot, input.channelId);
  const definition = getChannelDefinition(input.channelId);

  if (!definition) {
    throw new Error(`Unsupported OpenClaw channel: ${input.channelId}`);
  }

  for (const field of definition.fields) {
    setOptionalChannelField(channelRoot, field, input.values[field.key]);
  }

  const configuredFieldCount = definition.fields.filter(
    (field) => Boolean(input.values[field.key]?.trim()),
  ).length;
  channelRoot.enabled =
    input.enabled ??
    ((definition.configurationMode || 'required') === 'none' ? true : configuredFieldCount > 0);
}

function ensurePluginWebSearchRoots(root: JsonObject, providerId: string) {
  const definition = getWebSearchProviderDefinition(providerId);
  if (!definition) {
    throw new Error(`Unsupported OpenClaw web search provider: ${providerId}`);
  }

  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, definition.pluginId);
  const configRoot = ensureObject(entryRoot, 'config');
  const settingsRootKey = 'webSearch';
  const authRootKey = 'webSearch';

  return {
    pluginId: definition.pluginId,
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    authRootKey,
    authRoot: ensureObject(configRoot, authRootKey),
    settingsRootKey,
    settingsRoot: ensureObject(configRoot, settingsRootKey),
  };
}

function ensurePluginWebFetchRoots(root: JsonObject) {
  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, 'firecrawl');
  const configRoot = ensureObject(entryRoot, 'config');
  const settingsRootKey = 'webFetch';

  return {
    pluginId: 'firecrawl',
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    settingsRootKey,
    settingsRoot: ensureObject(configRoot, settingsRootKey),
  };
}

function updateWebSearchConfig(root: JsonObject, input: SaveOpenClawWebSearchConfigurationInput) {
  const toolsRoot = ensureObject(root, 'tools');
  const webRoot = ensureObject(toolsRoot, 'web');
  const searchRoot = ensureObject(webRoot, 'search');
  const providerId = normalizeWebSearchProviderId(input.provider);
  searchRoot.enabled = input.enabled;
  setOptionalScalar(searchRoot, 'provider', providerId);
  setOptionalFiniteNumber(searchRoot, 'maxResults', input.maxResults);
  setOptionalFiniteNumber(searchRoot, 'timeoutSeconds', input.timeoutSeconds);
  setOptionalFiniteNumber(searchRoot, 'cacheTtlMinutes', input.cacheTtlMinutes);

  const providerConfigId = normalizeWebSearchProviderId(input.providerConfig.providerId);
  const definition = getWebSearchProviderDefinition(providerConfigId);
  if (!definition) {
    throw new Error(`Unsupported OpenClaw web search provider: ${input.providerConfig.providerId}`);
  }

  const advancedRoot = parseJsonObjectText('Advanced Config', input.providerConfig.advancedConfig);
  const {
    pluginId,
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    authRootKey,
    authRoot,
    settingsRootKey,
    settingsRoot,
  } = ensurePluginWebSearchRoots(root, providerConfigId);

  for (const key of Object.keys(settingsRoot)) {
    delete settingsRoot[key];
  }

  Object.assign(settingsRoot, advancedRoot);

  if (definition.supportsApiKey) {
    if (authRoot !== settingsRoot) {
      for (const key of Object.keys(authRoot)) {
        delete authRoot[key];
      }
    }
    setOptionalScalar(authRoot, 'apiKey', input.providerConfig.apiKeySource);
  }
  if (definition.supportsBaseUrl) {
    setOptionalScalar(settingsRoot, 'baseUrl', input.providerConfig.baseUrl);
  }
  if (definition.supportsModel) {
    setOptionalScalar(settingsRoot, 'model', input.providerConfig.model);
  }

  deleteIfEmptyObject(configRoot, settingsRootKey);
  if (authRootKey !== settingsRootKey) {
    deleteIfEmptyObject(configRoot, authRootKey);
  }
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, pluginId);
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}

function updateXSearchConfig(root: JsonObject, input: SaveOpenClawXSearchConfigurationInput) {
  const advancedRoot = parseJsonObjectText('Advanced Config', input.advancedConfig);
  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, 'xai');
  const configRoot = ensureObject(entryRoot, 'config');
  const webSearchRoot = ensureObject(configRoot, 'webSearch');
  const xSearchRoot = ensureObject(configRoot, 'xSearch');

  for (const key of Object.keys(xSearchRoot)) {
    delete xSearchRoot[key];
  }

  Object.assign(xSearchRoot, advancedRoot);
  xSearchRoot.enabled = input.enabled;
  xSearchRoot.inlineCitations = input.inlineCitations;
  setOptionalScalar(xSearchRoot, 'model', input.model);
  setOptionalWholeNumber(xSearchRoot, 'maxTurns', input.maxTurns);
  setOptionalFiniteNumber(xSearchRoot, 'timeoutSeconds', input.timeoutSeconds);
  setOptionalFiniteNumber(xSearchRoot, 'cacheTtlMinutes', input.cacheTtlMinutes);
  setOptionalScalar(webSearchRoot, 'apiKey', input.apiKeySource);

  const toolsRoot = readObject(root.tools);
  const webRoot = toolsRoot ? readObject(toolsRoot.web) : null;
  if (webRoot) {
    delete webRoot.x_search;
    deleteIfEmptyObject(toolsRoot!, 'web');
    deleteIfEmptyObject(root, 'tools');
  }

  deleteIfEmptyObject(configRoot, 'xSearch');
  deleteIfEmptyObject(configRoot, 'webSearch');
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, 'xai');
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}

function updateWebSearchNativeCodexConfig(
  root: JsonObject,
  input: SaveOpenClawWebSearchNativeCodexConfigurationInput,
) {
  const advancedRoot = parseJsonObjectText('Advanced Config', input.advancedConfig);
  const toolsRoot = ensureObject(root, 'tools');
  const webRoot = ensureObject(toolsRoot, 'web');
  const searchRoot = ensureObject(webRoot, 'search');
  const openaiCodexRoot = ensureObject(searchRoot, 'openaiCodex');

  for (const key of Object.keys(openaiCodexRoot)) {
    delete openaiCodexRoot[key];
  }

  Object.assign(openaiCodexRoot, advancedRoot);
  openaiCodexRoot.enabled = input.enabled;
  setOptionalScalar(
    openaiCodexRoot,
    'mode',
    input.mode?.trim() || DEFAULT_WEB_SEARCH_NATIVE_CODEX_MODE,
  );
  setStringArray(openaiCodexRoot, 'allowedDomains', input.allowedDomains || []);
  setOptionalScalar(openaiCodexRoot, 'contextSize', input.contextSize);

  const userLocationRoot = ensureObject(openaiCodexRoot, 'userLocation');
  setOptionalScalar(userLocationRoot, 'country', input.userLocation?.country);
  setOptionalScalar(userLocationRoot, 'city', input.userLocation?.city);
  setOptionalScalar(userLocationRoot, 'timezone', input.userLocation?.timezone);
  deleteIfEmptyObject(openaiCodexRoot, 'userLocation');

  deleteIfEmptyObject(searchRoot, 'openaiCodex');
  deleteIfEmptyObject(webRoot, 'search');
  deleteIfEmptyObject(toolsRoot, 'web');
  deleteIfEmptyObject(root, 'tools');
}

function updateWebFetchConfig(root: JsonObject, input: SaveOpenClawWebFetchConfigurationInput) {
  const toolsRoot = ensureObject(root, 'tools');
  const webRoot = ensureObject(toolsRoot, 'web');
  const fetchRoot = ensureObject(webRoot, 'fetch');

  fetchRoot.enabled = input.enabled;
  setOptionalFiniteNumber(fetchRoot, 'maxChars', input.maxChars);
  setOptionalFiniteNumber(fetchRoot, 'maxCharsCap', input.maxCharsCap);
  setOptionalFiniteNumber(fetchRoot, 'maxResponseBytes', input.maxResponseBytes);
  setOptionalFiniteNumber(fetchRoot, 'timeoutSeconds', input.timeoutSeconds);
  setOptionalFiniteNumber(fetchRoot, 'cacheTtlMinutes', input.cacheTtlMinutes);
  setOptionalFiniteNumber(fetchRoot, 'maxRedirects', input.maxRedirects);
  fetchRoot.readability = input.readability;
  setOptionalScalar(fetchRoot, 'userAgent', input.userAgent);

  const providerId = input.fallbackProviderConfig.providerId.trim().toLowerCase();
  if (providerId !== 'firecrawl') {
    throw new Error(`Unsupported OpenClaw web fetch fallback provider: ${input.fallbackProviderConfig.providerId}`);
  }

  const advancedRoot = parseJsonObjectText('Advanced Config', input.fallbackProviderConfig.advancedConfig);
  const {
    pluginId,
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    settingsRootKey,
    settingsRoot,
  } = ensurePluginWebFetchRoots(root);

  for (const key of Object.keys(settingsRoot)) {
    delete settingsRoot[key];
  }

  Object.assign(settingsRoot, advancedRoot);
  setOptionalScalar(settingsRoot, 'apiKey', input.fallbackProviderConfig.apiKeySource);
  setOptionalScalar(settingsRoot, 'baseUrl', input.fallbackProviderConfig.baseUrl);

  deleteIfEmptyObject(configRoot, settingsRootKey);
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, pluginId);
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}

function updateAuthCooldownsConfig(root: JsonObject, input: SaveOpenClawAuthCooldownsConfigurationInput) {
  const authRoot = ensureObject(root, 'auth');
  const cooldownsRoot = ensureObject(authRoot, 'cooldowns');

  setOptionalWholeNumber(cooldownsRoot, 'rateLimitedProfileRotations', input.rateLimitedProfileRotations);
  setOptionalWholeNumber(cooldownsRoot, 'overloadedProfileRotations', input.overloadedProfileRotations);
  setOptionalWholeNumber(cooldownsRoot, 'overloadedBackoffMs', input.overloadedBackoffMs);
  setOptionalWholeNumber(cooldownsRoot, 'billingBackoffHours', input.billingBackoffHours);
  setOptionalWholeNumber(cooldownsRoot, 'billingMaxHours', input.billingMaxHours);
  setOptionalWholeNumber(cooldownsRoot, 'failureWindowHours', input.failureWindowHours);

  deleteIfEmptyObject(authRoot, 'cooldowns');
  deleteIfEmptyObject(root, 'auth');
}

function updateDreamingConfig(root: JsonObject, input: SaveOpenClawDreamingConfigurationInput) {
  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, 'memory-core');
  const configRoot = ensureObject(entryRoot, 'config');
  const dreamingRoot = ensureObject(configRoot, 'dreaming');

  for (const key of Object.keys(dreamingRoot)) {
    delete dreamingRoot[key];
  }

  dreamingRoot.enabled = input.enabled;
  setOptionalScalar(dreamingRoot, 'frequency', input.frequency?.trim() || '');

  deleteIfEmptyObject(configRoot, 'dreaming');
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, 'memory-core');
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
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
    return listResolvedChannelDefinitions();
  }

  async readConfigDocument(configPath: string) {
    return platform.readFile(normalizePath(configPath));
  }

  async writeConfigDocument(configPath: string, raw: string) {
    const normalizedConfigPath = normalizePath(configPath);
    const parsed = raw.trim() ? parseJson5<JsonObject>(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('OpenClaw config document must contain a top-level object.');
    }

    await platform.writeFile(normalizedConfigPath, raw);
    invalidateOpenClawConfigSnapshot(normalizedConfigPath);
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
    const configRoute = detail?.dataAccess?.routes?.find((route) => route.scope === 'config');
    if (configRoute) {
      if (configRoute.mode === 'managedFile' && configRoute.target) {
        return normalizePath(configRoute.target);
      }

      return null;
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
    const normalizedConfigPath = normalizePath(configPath);
    const snapshotCache = getOpenClawConfigSnapshotCache();
    const pendingSnapshots = getPendingOpenClawConfigSnapshots();
    const currentTime = Date.now();
    const cached = snapshotCache.get(normalizedConfigPath);
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const pending = pendingSnapshots.get(normalizedConfigPath);
    if (pending) {
      return pending;
    }

    const version = getOpenClawConfigSnapshotVersion(normalizedConfigPath);
    const request = readConfigRoot(normalizedConfigPath)
      .then((root) => ({
        configPath: normalizedConfigPath,
        providerSnapshots: buildProviderSnapshots(root),
        agentSnapshots: buildAgentSnapshots(root, normalizedConfigPath),
        channelSnapshots: buildChannelSnapshots(root),
        webSearchConfig: buildWebSearchConfigSnapshot(root),
        xSearchConfig: buildXSearchConfigSnapshot(root),
        webSearchNativeCodexConfig: buildWebSearchNativeCodexConfigSnapshot(root),
        webFetchConfig: buildWebFetchConfigSnapshot(root),
        authCooldownsConfig: buildAuthCooldownsConfigSnapshot(root),
        dreamingConfig: buildDreamingConfigSnapshot(root),
        root,
      }))
      .then((snapshot) => {
        if (getOpenClawConfigSnapshotVersion(normalizedConfigPath) === version) {
          snapshotCache.set(normalizedConfigPath, {
            expiresAt: Date.now() + OPENCLAW_CONFIG_SNAPSHOT_CACHE_TTL_MS,
            value: snapshot,
          });
        }

        return snapshot;
      })
      .finally(() => {
        if (pendingSnapshots.get(normalizedConfigPath) === request) {
          pendingSnapshots.delete(normalizedConfigPath);
        }
      });

    pendingSnapshots.set(normalizedConfigPath, request);
    return request;
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

  async saveManagedLocalProxyProjection(input: {
    configPath: string;
    projection: OpenClawLocalProxyProjection;
  }) {
    const root = await readConfigRoot(input.configPath);
    canonicalizeManagedLocalProxyProviders(root, input.projection.provider.id);
    updateProviderConfig(root, input.projection.provider, input.projection.selection, {
      overwriteDefaults: true,
    });
    await writeConfigRoot(input.configPath, root);

    const providerKey = buildProviderKey(input.projection.provider.id);
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

  async saveWebSearchConfiguration(input: SaveOpenClawWebSearchConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateWebSearchConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildWebSearchConfigSnapshot(root);
  }

  async saveXSearchConfiguration(input: SaveOpenClawXSearchConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateXSearchConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildXSearchConfigSnapshot(root);
  }

  async saveWebSearchNativeCodexConfiguration(
    input: SaveOpenClawWebSearchNativeCodexConfigurationInput,
  ) {
    const root = await readConfigRoot(input.configPath);
    updateWebSearchNativeCodexConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildWebSearchNativeCodexConfigSnapshot(root);
  }

  async saveWebFetchConfiguration(input: SaveOpenClawWebFetchConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateWebFetchConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildWebFetchConfigSnapshot(root);
  }

  async saveAuthCooldownsConfiguration(input: SaveOpenClawAuthCooldownsConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateAuthCooldownsConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildAuthCooldownsConfigSnapshot(root);
  }

  async saveDreamingConfiguration(input: SaveOpenClawDreamingConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateDreamingConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildDreamingConfigSnapshot(root);
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
