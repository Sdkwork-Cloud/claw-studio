import type {
  LocalAiProxyClientProtocol,
  LocalAiProxyUpstreamProtocol,
  LocalAiProxyRouteManagedBy,
  LocalAiProxyRouteModelRecord,
  LocalAiProxyRouteRecord,
} from '@sdkwork/claw-types';
import { normalizeLegacyProviderId } from './legacyProviderCompat.ts';

const LOCAL_AI_PROXY_CLIENT_PROTOCOLS: readonly LocalAiProxyClientProtocol[] = [
  'openai-compatible',
  'anthropic',
  'gemini',
];

const LOCAL_AI_PROXY_UPSTREAM_PROTOCOLS: readonly LocalAiProxyUpstreamProtocol[] = [
  'openai-compatible',
  'anthropic',
  'gemini',
  'ollama',
  'azure-openai',
  'openrouter',
  'sdkwork',
];

const LOCAL_AI_PROXY_REQUIRED_DEFAULT_PROTOCOLS: readonly LocalAiProxyClientProtocol[] = [
  'openai-compatible',
  'anthropic',
  'gemini',
];

const LOCAL_AI_PROXY_DEFAULT_ROUTE_MODELS: LocalAiProxyRouteModelRecord[] = [
  {
    id: 'sdkwork-chat',
    name: 'SDKWork Chat',
  },
  {
    id: 'sdkwork-reasoning',
    name: 'SDKWork Reasoning',
  },
  {
    id: 'sdkwork-embedding',
    name: 'SDKWork Embedding',
  },
];

export const LOCAL_AI_PROXY_ROUTE_SCHEMA_VERSION = 1 as const;
export const LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL = 'https://ai.sdkwork.com';
export const LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY = 'sk_sdkwork_api_key';
export const LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL: LocalAiProxyClientProtocol =
  'openai-compatible';
export const LOCAL_AI_PROXY_OPENCLAW_EXPOSE_TARGET = 'openclaw';
export const LOCAL_AI_PROXY_SYSTEM_DEFAULT_OPENAI_ROUTE_ID =
  'local-ai-proxy-system-default-openai-compatible';
const LOCAL_AI_PROXY_DESKTOP_CLIENTS_EXPOSE_TARGET = 'desktop-clients';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || undefined;
}

function normalizeProviderId(value: unknown) {
  return normalizeLegacyProviderId(normalizeString(value)).toLowerCase();
}

function normalizeClientProtocol(value: unknown): LocalAiProxyClientProtocol | null {
  const normalized = normalizeString(value) as LocalAiProxyClientProtocol;
  return LOCAL_AI_PROXY_CLIENT_PROTOCOLS.includes(normalized) ? normalized : null;
}

function normalizeUpstreamProtocol(value: unknown): LocalAiProxyUpstreamProtocol | null {
  const normalized = normalizeString(value) as LocalAiProxyUpstreamProtocol;
  return LOCAL_AI_PROXY_UPSTREAM_PROTOCOLS.includes(normalized) ? normalized : null;
}

function normalizeManagedBy(value: unknown): LocalAiProxyRouteManagedBy | null {
  return value === 'system-default' || value === 'user' ? value : null;
}

function normalizeModelId(value: unknown) {
  return normalizeString(value);
}

function normalizeModelName(model: UnknownRecord): LocalAiProxyRouteModelRecord | null {
  const id = normalizeModelId(model.id);
  if (!id) {
    return null;
  }

  const name = normalizeString(model.name);
  return {
    id,
    name: name || id,
  };
}

function normalizeModels(value: unknown): LocalAiProxyRouteModelRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Map(
      value
        .map((entry) => (isRecord(entry) ? normalizeModelName(entry) : null))
        .filter((model): model is LocalAiProxyRouteModelRecord => Boolean(model))
        .map((model) => [model.id, model] as const),
    ).values(),
  );
}

function ensureReferencedModels(
  models: LocalAiProxyRouteModelRecord[],
  modelIds: Array<string | undefined>,
) {
  const nextModels = [...models];

  for (const modelId of modelIds) {
    if (!modelId || nextModels.some((model) => model.id === modelId)) {
      continue;
    }

    nextModels.push({
      id: modelId,
      name: modelId,
    });
  }

  return nextModels;
}

function normalizeOptionalModelId(
  modelId: unknown,
  models: LocalAiProxyRouteModelRecord[],
) {
  const normalized = normalizeModelId(modelId);
  if (!normalized) {
    return undefined;
  }

  return models.some((model) => model.id === normalized) ? normalized : undefined;
}

function normalizeExposeTargets(value: unknown) {
  const nextTargets = Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => normalizeString(entry))
            .filter(Boolean),
        ),
      )
    : [];

  return nextTargets.length > 0 ? nextTargets : [LOCAL_AI_PROXY_OPENCLAW_EXPOSE_TARGET];
}

function titleize(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function inferLocalAiProxyUpstreamProtocol(
  providerId: string,
): LocalAiProxyUpstreamProtocol {
  switch (normalizeProviderId(providerId)) {
    case 'anthropic':
    case 'cloudflare-ai-gateway':
    case 'vercel-ai-gateway':
      return 'anthropic';
    case 'google':
    case 'gemini':
      return 'gemini';
    case 'ollama':
      return 'ollama';
    case 'azure':
    case 'azure-openai':
      return 'azure-openai';
    case 'openrouter':
      return 'openrouter';
    case 'sdkwork':
      return 'sdkwork';
    case 'openai-compatible':
    case 'openai':
    case 'deepseek':
    case 'qwen':
    case 'xai':
      return 'openai-compatible';
    default:
      return 'openai-compatible';
  }
}

export function inferLocalAiProxyClientProtocol(
  providerId: string,
): LocalAiProxyClientProtocol {
  const upstreamProtocol = inferLocalAiProxyUpstreamProtocol(providerId);
  if (upstreamProtocol === 'anthropic' || upstreamProtocol === 'gemini') {
    return upstreamProtocol;
  }

  return 'openai-compatible';
}

function buildRouteName(
  managedBy: LocalAiProxyRouteManagedBy,
  providerId: string,
  clientProtocol: LocalAiProxyClientProtocol,
  inputName: unknown,
) {
  const explicitName = normalizeString(inputName);
  if (explicitName) {
    return explicitName;
  }

  if (managedBy === 'system-default') {
    return clientProtocol === 'openai-compatible'
      ? 'SDKWork Default'
      : `SDKWork ${titleize(clientProtocol)} Default`;
  }

  return titleize(providerId || clientProtocol || 'Route') || 'Route';
}

function buildRouteId(
  managedBy: LocalAiProxyRouteManagedBy,
  clientProtocol: LocalAiProxyClientProtocol,
  providerId: string,
) {
  if (managedBy === 'system-default') {
    return clientProtocol === 'openai-compatible'
      ? LOCAL_AI_PROXY_SYSTEM_DEFAULT_OPENAI_ROUTE_ID
      : `local-ai-proxy-system-default-${clientProtocol}`;
  }

  const slug = (providerId || clientProtocol)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
  return `local-ai-route-${slug || 'route'}`;
}

function normalizeSystemDefaultRoute(
  clientProtocol: LocalAiProxyClientProtocol = LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
): LocalAiProxyRouteRecord {
  const models = LOCAL_AI_PROXY_DEFAULT_ROUTE_MODELS.map((model) => ({ ...model }));

  return {
    id: buildRouteId('system-default', clientProtocol, 'sdkwork'),
    schemaVersion: LOCAL_AI_PROXY_ROUTE_SCHEMA_VERSION,
    name:
      clientProtocol === 'openai-compatible'
        ? 'SDKWork Default'
        : `SDKWork ${titleize(clientProtocol)} Default`,
    enabled: true,
    isDefault: true,
    managedBy: 'system-default',
    clientProtocol,
    upstreamProtocol: 'sdkwork',
    providerId: 'sdkwork',
    upstreamBaseUrl: LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
    apiKey: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
    defaultModelId: models[0]!.id,
    reasoningModelId: models[1]?.id,
    embeddingModelId: models[2]?.id,
    models,
    notes: undefined,
    exposeTo: Array.from(
      new Set(
        clientProtocol === 'openai-compatible'
          ? [LOCAL_AI_PROXY_OPENCLAW_EXPOSE_TARGET]
          : [LOCAL_AI_PROXY_OPENCLAW_EXPOSE_TARGET, LOCAL_AI_PROXY_DESKTOP_CLIENTS_EXPOSE_TARGET],
      ),
    ),
  };
}

function normalizeRouteRecordSource(input: UnknownRecord): LocalAiProxyRouteRecord {
  const managedBy = normalizeManagedBy(input.managedBy) || 'user';
  const providerId = normalizeProviderId(input.providerId || input.channelId) || 'sdkwork';
  const clientProtocol =
    normalizeClientProtocol(input.clientProtocol) || inferLocalAiProxyClientProtocol(providerId);
  const upstreamProtocol =
    normalizeUpstreamProtocol(input.upstreamProtocol) || inferLocalAiProxyUpstreamProtocol(providerId);

  if (managedBy === 'system-default') {
    return normalizeSystemDefaultRoute(clientProtocol);
  }

  const baseModels = normalizeModels(input.models);
  const explicitDefaultModelId = normalizeModelId(input.defaultModelId);
  const explicitReasoningModelId = normalizeModelId(input.reasoningModelId);
  const explicitEmbeddingModelId = normalizeModelId(input.embeddingModelId);
  const models = ensureReferencedModels(baseModels, [
    explicitDefaultModelId,
    explicitReasoningModelId,
    explicitEmbeddingModelId,
  ]);
  const defaultModelId = explicitDefaultModelId || models[0]?.id || '';
  const normalizedModels = ensureReferencedModels(models, [defaultModelId]);
  const reasoningModelId = normalizeOptionalModelId(explicitReasoningModelId, normalizedModels);
  const embeddingModelId = normalizeOptionalModelId(explicitEmbeddingModelId, normalizedModels);

  return {
    id: normalizeString(input.id) || buildRouteId(managedBy, clientProtocol, providerId),
    schemaVersion: LOCAL_AI_PROXY_ROUTE_SCHEMA_VERSION,
    name: buildRouteName(managedBy, providerId, clientProtocol, input.name),
    enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
    isDefault: typeof input.isDefault === 'boolean' ? input.isDefault : false,
    managedBy,
    clientProtocol,
    upstreamProtocol,
    providerId,
    upstreamBaseUrl:
      normalizeString(input.upstreamBaseUrl || input.baseUrl) ||
      LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
    apiKey: normalizeString(input.apiKey),
    defaultModelId,
    reasoningModelId,
    embeddingModelId,
    models: normalizedModels,
    notes: normalizeOptionalString(input.notes),
    exposeTo: normalizeExposeTargets(input.exposeTo),
  };
}

function pickDefaultRouteIndex(routes: LocalAiProxyRouteRecord[]) {
  const preferredExplicitDefaultIndex = routes.findIndex((route) => route.enabled && route.isDefault);
  if (preferredExplicitDefaultIndex >= 0) {
    return preferredExplicitDefaultIndex;
  }

  return routes.findIndex((route) => route.enabled);
}

function normalizeDefaultFlags(routes: LocalAiProxyRouteRecord[]) {
  if (routes.length === 0) {
    return routes;
  }

  const defaultIndex = pickDefaultRouteIndex(routes);
  return routes.map((route, index) => ({
    ...route,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : false,
  }));
}

function ensureRequiredDefaultProtocols(routes: LocalAiProxyRouteRecord[]) {
  const nextRoutes = [...routes];

  for (const clientProtocol of LOCAL_AI_PROXY_REQUIRED_DEFAULT_PROTOCOLS) {
    const protocolRoutes = nextRoutes.filter((route) => route.clientProtocol === clientProtocol);
    const hasEnabledDefault = protocolRoutes.some((route) => route.enabled && route.isDefault);
    if (hasEnabledDefault) {
      continue;
    }

    nextRoutes.push(normalizeSystemDefaultRoute(clientProtocol));
  }

  return nextRoutes;
}

export function createSystemDefaultLocalAiProxyRoute(
  clientProtocol: LocalAiProxyClientProtocol = LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
) {
  return normalizeSystemDefaultRoute(clientProtocol);
}

export function normalizeLocalAiProxyRouteRecord(input: unknown) {
  if (!isRecord(input)) {
    return null;
  }

  return normalizeRouteRecordSource(input);
}

export function normalizeLocalAiProxyRouteRecords(inputs: readonly unknown[]) {
  const groupedRoutes = new Map<LocalAiProxyClientProtocol, LocalAiProxyRouteRecord[]>();

  for (const input of inputs) {
    const route = normalizeLocalAiProxyRouteRecord(input);
    if (!route) {
      continue;
    }

    const group = groupedRoutes.get(route.clientProtocol) || [];
    group.push(route);
    groupedRoutes.set(route.clientProtocol, group);
  }

  const normalizedRoutes = Array.from(groupedRoutes.values()).flatMap((routes) =>
    normalizeDefaultFlags(routes),
  );

  return ensureRequiredDefaultProtocols(normalizedRoutes);
}

export function listActiveLocalAiProxyRoutes(
  routes: readonly LocalAiProxyRouteRecord[],
  clientProtocol?: LocalAiProxyClientProtocol,
) {
  return routes.filter(
    (route) =>
      route.enabled && (clientProtocol ? route.clientProtocol === clientProtocol : true),
  );
}

export function selectDefaultLocalAiProxyRoute(
  routes: readonly LocalAiProxyRouteRecord[],
  clientProtocol: LocalAiProxyClientProtocol = LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
) {
  const protocolRoutes = normalizeLocalAiProxyRouteRecords(routes).filter(
    (route) => route.clientProtocol === clientProtocol,
  );

  return (
    protocolRoutes.find((route) => route.enabled && route.isDefault) ||
    protocolRoutes.find((route) => route.enabled) ||
    null
  );
}
