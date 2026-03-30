import {
  APP_ENV,
  type AppEnvConfig,
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
  type ApplyOpenClawSetupOptions,
  type ApplyOpenClawSetupResult,
} from './providerAccessApplyService.ts';

const DEFAULT_USAGE_PERIOD = '30d' as const;

export interface UnifiedApiAccessGatewayEntry {
  channelId: string;
  baseUrl: string;
  defaultModel: {
    id: string;
    name: string;
  };
}

export interface UnifiedApiAccessGatewayCatalog {
  openai: UnifiedApiAccessGatewayEntry;
  anthropic: UnifiedApiAccessGatewayEntry;
  gemini: UnifiedApiAccessGatewayEntry;
}

export const UNIFIED_API_ACCESS_GATEWAYS: UnifiedApiAccessGatewayCatalog = {
  openai: {
    channelId: 'openai',
    baseUrl: '/v1',
    defaultModel: {
      id: 'gpt-5.4',
      name: 'GPT-5.4',
    },
  },
  anthropic: {
    channelId: 'anthropic',
    baseUrl: '/v1',
    defaultModel: {
      id: 'claude-sonnet-4',
      name: 'Claude Sonnet 4',
    },
  },
  gemini: {
    channelId: 'google',
    baseUrl: '/v1',
    defaultModel: {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro',
    },
  },
};

const UNIFIED_API_CLIENT_IDS: ProviderAccessClientId[] = [
  'codex',
  'claude-code',
  'opencode',
  'openclaw',
  'gemini',
];

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!normalizedBaseUrl) {
    return normalizedPath;
  }

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export async function resolveUnifiedApiAccessGateways(
  options: { env?: AppEnvConfig; baseUrl?: string } = {},
): Promise<UnifiedApiAccessGatewayCatalog> {
  const env = options.env ?? APP_ENV;
  const gatewayBaseUrl = normalizeBaseUrl(
    options.baseUrl || env.openclaw.gatewayBaseUrl || '',
  );

  return {
    openai: {
      ...UNIFIED_API_ACCESS_GATEWAYS.openai,
      baseUrl: joinUrl(gatewayBaseUrl, '/v1'),
    },
    anthropic: {
      ...UNIFIED_API_ACCESS_GATEWAYS.anthropic,
      baseUrl: joinUrl(gatewayBaseUrl, '/v1'),
    },
    gemini: {
      ...UNIFIED_API_ACCESS_GATEWAYS.gemini,
      baseUrl: joinUrl(gatewayBaseUrl, '/v1'),
    },
  };
}

function getUnifiedApiClientGateway(
  clientId: ProviderAccessClientId,
  gateways: UnifiedApiAccessGatewayCatalog,
) {
  switch (clientId) {
    case 'codex':
    case 'claude-code':
    case 'opencode':
    case 'openclaw':
    case 'gemini':
      return gateways.openai;
  }
}

function cloneModel(model: ProxyProviderModel): ProxyProviderModel {
  return {
    id: model.id,
    name: model.name,
  };
}

function hasVisibleUnifiedApiKeySecret(item: UnifiedApiKey) {
  return item.canCopyApiKey !== false && !!item.apiKey;
}

function markConfigUnavailable(
  config: ProviderAccessClientConfig,
): ProviderAccessClientConfig {
  return {
    ...config,
    available: false,
    reason: 'requiresOneTimeKeyReveal',
    install: {
      ...config.install,
      supportedModes: [],
      defaultMode: null,
      supportedEnvScopes: [],
      defaultEnvScope: null,
      environmentVariables: [],
    },
    snippets: [],
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
  const hasVisibleSecret = hasVisibleUnifiedApiKeySecret(item);

  return UNIFIED_API_CLIENT_IDS.map((clientId) => {
    const config = buildProviderAccessClientConfigById(
      clientId,
      buildUnifiedApiKeySyntheticProvider(item, clientId, gateways),
    );

    return hasVisibleSecret ? config : markConfigUnavailable(config);
  });
}

export function buildUnifiedApiKeyCurlExample(
  item: UnifiedApiKey,
  gateways: UnifiedApiAccessGatewayCatalog = UNIFIED_API_ACCESS_GATEWAYS,
) {
  const apiKey = hasVisibleUnifiedApiKeySecret(item)
    ? item.apiKey
    : '<managed-router-key-unavailable-on-this-device>';

  return `curl ${gateways.openai.baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-routed-model",
    "messages": [
      { "role": "user", "content": "Ping unified API Router" }
    ]
  }'`;
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
    options: ApplyOpenClawSetupOptions = {
      apiKeyStrategy: 'shared',
    },
  ): Promise<ApplyOpenClawSetupResult> {
    const gateways = await resolveUnifiedApiAccessGateways();
    const syntheticProvider = buildUnifiedApiKeySyntheticProvider(item, 'openclaw', gateways);

    return providerAccessApplyService.applyOpenClawSetup(syntheticProvider, instanceIds, options);
  }
}

export const unifiedApiKeyAccessService = new UnifiedApiKeyAccessService();
