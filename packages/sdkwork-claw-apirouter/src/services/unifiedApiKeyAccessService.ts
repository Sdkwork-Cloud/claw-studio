import {
  getApiRouterPlatform,
  type ApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';
import type { ProxyProvider, ProxyProviderModel, UnifiedApiKey } from '@sdkwork/claw-types';
import {
  buildProviderAccessClientConfigById,
  type ProviderAccessClientConfig,
  type ProviderAccessClientId,
} from './providerAccessConfigService.ts';
import {
  providerAccessApplyService,
  type ApplyClientSetupResult,
  type ApplyClientSetupOptions,
  type ApplyOpenClawSetupResult,
} from './providerAccessApplyService.ts';

const DEFAULT_USAGE_PERIOD = '30d' as const;
const OPENAI_GATEWAY_SUFFIX = '/v1';
const ANTHROPIC_GATEWAY_SUFFIX = '/anthropic';
const GEMINI_GATEWAY_SUFFIX = '/gemini';

export interface UnifiedApiAccessGateway {
  channelId: string;
  baseUrl: string;
  defaultModel: {
    id: string;
    name: string;
  };
}

export interface UnifiedApiAccessGatewayCatalog {
  openai: UnifiedApiAccessGateway;
  anthropic: UnifiedApiAccessGateway;
  gemini: UnifiedApiAccessGateway;
}

export const UNIFIED_API_ACCESS_GATEWAYS: UnifiedApiAccessGatewayCatalog = {
  openai: {
    channelId: 'openai',
    baseUrl: 'https://api-router.example.com/v1',
    defaultModel: {
      id: 'gpt-5.4',
      name: 'GPT-5.4',
    },
  },
  anthropic: {
    channelId: 'anthropic',
    baseUrl: 'https://api-router.example.com/anthropic',
    defaultModel: {
      id: 'claude-sonnet-4',
      name: 'Claude Sonnet 4',
    },
  },
  gemini: {
    channelId: 'google',
    baseUrl: 'https://api-router.example.com/gemini',
    defaultModel: {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
    },
  },
} as const;

function joinGatewayUrl(origin: string, basePath: string, suffix: string) {
  const normalizedBasePath = basePath.replace(/\/+$/g, '');
  return `${origin}${normalizedBasePath}${suffix}`;
}

function resolveGatewayRootPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/g, '');
  const lowerCasePath = normalizedPath.toLowerCase();

  for (const suffix of [
    OPENAI_GATEWAY_SUFFIX,
    ANTHROPIC_GATEWAY_SUFFIX,
    GEMINI_GATEWAY_SUFFIX,
  ]) {
    if (lowerCasePath.endsWith(suffix)) {
      return normalizedPath.slice(0, normalizedPath.length - suffix.length);
    }
  }

  return normalizedPath;
}

export function buildUnifiedApiAccessGateways(
  runtimeStatus?: Pick<ApiRouterRuntimeStatus, 'gatewayBaseUrl'> | null,
): UnifiedApiAccessGatewayCatalog {
  const gatewayBaseUrl = runtimeStatus?.gatewayBaseUrl?.trim();
  if (!gatewayBaseUrl) {
    return UNIFIED_API_ACCESS_GATEWAYS;
  }

  try {
    const gatewayUrl = new URL(gatewayBaseUrl);
    const gatewayRootPath = resolveGatewayRootPath(gatewayUrl.pathname);
    const gatewayOrigin = gatewayUrl.origin;

    return {
      openai: {
        ...UNIFIED_API_ACCESS_GATEWAYS.openai,
        baseUrl: joinGatewayUrl(gatewayOrigin, gatewayRootPath, OPENAI_GATEWAY_SUFFIX),
      },
      anthropic: {
        ...UNIFIED_API_ACCESS_GATEWAYS.anthropic,
        baseUrl: joinGatewayUrl(gatewayOrigin, gatewayRootPath, ANTHROPIC_GATEWAY_SUFFIX),
      },
      gemini: {
        ...UNIFIED_API_ACCESS_GATEWAYS.gemini,
        baseUrl: joinGatewayUrl(gatewayOrigin, gatewayRootPath, GEMINI_GATEWAY_SUFFIX),
      },
    };
  } catch {
    return UNIFIED_API_ACCESS_GATEWAYS;
  }
}

export async function resolveUnifiedApiAccessGateways() {
  try {
    const runtimeStatus = await getApiRouterPlatform().getRuntimeStatus();
    return buildUnifiedApiAccessGateways(runtimeStatus);
  } catch {
    return UNIFIED_API_ACCESS_GATEWAYS;
  }
}

const UNIFIED_API_CLIENT_IDS: ProviderAccessClientId[] = [
  'codex',
  'claude-code',
  'opencode',
  'openclaw',
  'gemini',
];

function getUnifiedApiClientGateway(
  clientId: ProviderAccessClientId,
  gateways: UnifiedApiAccessGatewayCatalog,
) {
  switch (clientId) {
    case 'codex':
    case 'opencode':
    case 'openclaw':
      return gateways.openai;
    case 'claude-code':
      return gateways.anthropic;
    case 'gemini':
      return gateways.gemini;
  }
}

function cloneModel(model: ProxyProviderModel): ProxyProviderModel {
  return {
    id: model.id,
    name: model.name,
  };
}

export function buildUnifiedApiKeySyntheticProvider(
  item: UnifiedApiKey,
  clientId: ProviderAccessClientId,
  gateways: UnifiedApiAccessGatewayCatalog = UNIFIED_API_ACCESS_GATEWAYS,
): ProxyProvider {
  const gateway = getUnifiedApiClientGateway(clientId, gateways);

  return {
    id: `unified-api-key-${item.id}-${clientId}`,
    channelId: gateway.channelId,
    name: item.name,
    apiKey: item.apiKey,
    groupId: item.groupId,
    usage: item.usage || {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: DEFAULT_USAGE_PERIOD,
    },
    expiresAt: item.expiresAt,
    status: item.status,
    createdAt: item.createdAt,
    baseUrl: gateway.baseUrl,
    models: [cloneModel(gateway.defaultModel)],
    notes: item.notes,
  };
}

export function buildUnifiedApiKeyAccessClientConfigs(
  item: UnifiedApiKey,
  gateways: UnifiedApiAccessGatewayCatalog = UNIFIED_API_ACCESS_GATEWAYS,
): ProviderAccessClientConfig[] {
  return UNIFIED_API_CLIENT_IDS.map((clientId) =>
    buildProviderAccessClientConfigById(
      clientId,
      buildUnifiedApiKeySyntheticProvider(item, clientId, gateways),
    ),
  );
}

export function buildUnifiedApiKeyCurlExample(
  item: UnifiedApiKey,
  gateways: UnifiedApiAccessGatewayCatalog = UNIFIED_API_ACCESS_GATEWAYS,
) {
  return `curl ${gateways.openai.baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${item.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-routed-model",
    "messages": [
      { "role": "user", "content": "Ping unified API Router" }
    ]
  }'`;
}

export interface ApplyUnifiedApiKeyOpenClawSetupOptions {
  apiKeyStrategy?: 'shared' | 'per-instance';
  modelMappingId?: string | null;
}

class UnifiedApiKeyAccessService {
  async applyClientSetup(
    item: UnifiedApiKey,
    client: ProviderAccessClientConfig,
    options: ApplyClientSetupOptions = {},
  ): Promise<ApplyClientSetupResult> {
    const gateways = await resolveUnifiedApiAccessGateways();
    const syntheticProvider = buildUnifiedApiKeySyntheticProvider(item, client.id, gateways);
    return providerAccessApplyService.applyClientSetup(syntheticProvider, client, options);
  }

  async applyOpenClawSetup(
    item: UnifiedApiKey,
    instanceIds: string[],
    options: 'shared' | 'per-instance' | ApplyUnifiedApiKeyOpenClawSetupOptions = 'shared',
  ): Promise<ApplyOpenClawSetupResult> {
    const gateways = await resolveUnifiedApiAccessGateways();
    const syntheticProvider = buildUnifiedApiKeySyntheticProvider(item, 'openclaw', gateways);
    const normalizedOptions =
      typeof options === 'string' ? { apiKeyStrategy: options } : options;
    const hasModelMappingOverride =
      typeof options === 'object' && options !== null && 'modelMappingId' in options;
    const modelMappingId = hasModelMappingOverride
      ? normalizedOptions.modelMappingId ?? undefined
      : item.modelMappingId || undefined;

    return providerAccessApplyService.applyOpenClawSetup(syntheticProvider, instanceIds, {
      apiKeyStrategy: normalizedOptions.apiKeyStrategy ?? 'shared',
      modelMappingId,
    });
  }
}

export const unifiedApiKeyAccessService = new UnifiedApiKeyAccessService();
