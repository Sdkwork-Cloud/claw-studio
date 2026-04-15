import type { RuntimeDesktopKernelInfo } from '@sdkwork/claw-infrastructure';
import type {
  LocalAiProxyClientProtocol,
  LocalAiProxyRouteRecord,
  StudioWorkbenchLLMProviderRequestOverridesRecord,
} from '@sdkwork/claw-types';
import {
  normalizeLocalAiProxyRouteRecords,
  selectDefaultLocalAiProxyRoute,
} from './localAiProxyRouteService.ts';
import { normalizeOpenClawProviderRequestOverrides } from './openClawProviderRuntimeConfigService.ts';

export const OPENCLAW_LOCAL_PROXY_PROVIDER_ID = 'sdkwork-local-proxy';
export const OPENCLAW_LOCAL_PROXY_TOKEN_ENV_VAR = 'SDKWORK_LOCAL_PROXY_TOKEN';
export const OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER = '${SDKWORK_LOCAL_PROXY_TOKEN}';
export const OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY = OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER;

export interface OpenClawLocalProxyProjectionProviderModel {
  id: string;
  name: string;
}

export interface OpenClawLocalProxyProjectionProvider {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: OpenClawLocalProxyProjectionProviderModel[];
  notes?: string;
  config?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutMs?: number;
    streaming: boolean;
    request?: StudioWorkbenchLLMProviderRequestOverridesRecord;
  };
}

export interface OpenClawLocalProxyProjectionSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawLocalProxyProjection {
  sourceRoute: LocalAiProxyRouteRecord;
  provider: OpenClawLocalProxyProjectionProvider;
  selection: OpenClawLocalProxyProjectionSelection;
}

function normalizeLoopbackBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/g, '');
}

function selectProjectedLocalAiProxyRoute(
  routes: readonly LocalAiProxyRouteRecord[],
  preferredClientProtocol?: LocalAiProxyClientProtocol,
) {
  const preferredProtocols = Array.from(
    new Set(
      [preferredClientProtocol, 'openai-compatible'].filter(
        (protocol): protocol is LocalAiProxyClientProtocol => Boolean(protocol),
      ),
    ),
  );

  for (const protocol of preferredProtocols) {
    const route = selectDefaultLocalAiProxyRoute(routes, protocol);
    if (route) {
      return route;
    }
  }

  const normalizedRoutes = normalizeLocalAiProxyRouteRecords(routes);
  return normalizedRoutes.find((route) => route.enabled && route.isDefault)
    || normalizedRoutes.find((route) => route.enabled)
    || null;
}

function normalizeRuntimeProxyBaseUrl(baseUrl?: string | null) {
  const normalized = baseUrl?.trim();
  return normalized ? normalizeLoopbackBaseUrl(normalized) : null;
}

export function resolveOpenClawLocalProxyBaseUrl(
  info: RuntimeDesktopKernelInfo | null,
  clientProtocol: LocalAiProxyClientProtocol = 'openai-compatible',
) {
  switch (clientProtocol) {
    case 'anthropic':
      return (
        normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.anthropicBaseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.openaiCompatibleBaseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.baseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.rootBaseUrl)
        || null
      );
    case 'gemini':
      return (
        normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.geminiBaseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.rootBaseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.baseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.openaiCompatibleBaseUrl)
        || null
      );
    default:
      return (
        normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.openaiCompatibleBaseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.baseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.anthropicBaseUrl)
        || normalizeRuntimeProxyBaseUrl(info?.localAiProxy?.rootBaseUrl)
        || null
      );
  }
}

export function createOpenClawLocalProxyProjection(input: {
  routes: readonly LocalAiProxyRouteRecord[];
  proxyBaseUrl: string;
  proxyApiKey: string;
  preferredClientProtocol?: LocalAiProxyClientProtocol;
  providerName?: string;
  selectionOverride?: Partial<OpenClawLocalProxyProjectionSelection>;
  runtimeConfig?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutMs?: number;
    streaming?: boolean;
    request?: StudioWorkbenchLLMProviderRequestOverridesRecord;
  };
}): OpenClawLocalProxyProjection {
  const sourceRoute = selectProjectedLocalAiProxyRoute(
    input.routes,
    input.preferredClientProtocol,
  );
  if (!sourceRoute) {
    throw new Error('No active local AI proxy route is available for OpenClaw local proxy projection.');
  }

  const defaultModelId = sourceRoute.defaultModelId || sourceRoute.models[0]?.id;
  if (!defaultModelId) {
    throw new Error('The selected route does not expose a default model for OpenClaw projection.');
  }
  const availableModelIds = new Set(sourceRoute.models.map((model) => model.id));
  const selectedDefaultModelId =
    input.selectionOverride?.defaultModelId?.trim() || defaultModelId;
  if (!availableModelIds.has(selectedDefaultModelId)) {
    throw new Error('The selected default model is not exposed by the projected route.');
  }
  const selectedReasoningModelId = input.selectionOverride?.reasoningModelId?.trim();
  if (selectedReasoningModelId && !availableModelIds.has(selectedReasoningModelId)) {
    throw new Error('The selected reasoning model is not exposed by the projected route.');
  }
  const selectedEmbeddingModelId = input.selectionOverride?.embeddingModelId?.trim();
  if (selectedEmbeddingModelId && !availableModelIds.has(selectedEmbeddingModelId)) {
    throw new Error('The selected embedding model is not exposed by the projected route.');
  }

  const proxyBaseUrl = normalizeLoopbackBaseUrl(input.proxyBaseUrl);
  if (!proxyBaseUrl) {
    throw new Error('A local proxy base URL is required for OpenClaw projection.');
  }
  const request = normalizeOpenClawProviderRequestOverrides(input.runtimeConfig?.request);

  return {
    sourceRoute,
    provider: {
      id: OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
      channelId: sourceRoute.clientProtocol,
      name: input.providerName?.trim() || 'SDKWork Local Proxy',
      apiKey: input.proxyApiKey.trim(),
      baseUrl: proxyBaseUrl,
      models: sourceRoute.models.map((model) => ({
        id: model.id,
        name: model.name,
      })),
      notes: `Managed local proxy projection for route "${sourceRoute.name}".`,
      config: {
        temperature: input.runtimeConfig?.temperature,
        topP: input.runtimeConfig?.topP,
        maxTokens: input.runtimeConfig?.maxTokens,
        timeoutMs: input.runtimeConfig?.timeoutMs,
        streaming:
          typeof input.runtimeConfig?.streaming === 'boolean'
            ? input.runtimeConfig.streaming
            : true,
        ...(request ? { request } : {}),
      },
    },
    selection: {
      defaultModelId: selectedDefaultModelId,
      reasoningModelId: selectedReasoningModelId || sourceRoute.reasoningModelId,
      embeddingModelId: selectedEmbeddingModelId || sourceRoute.embeddingModelId,
    },
  };
}
