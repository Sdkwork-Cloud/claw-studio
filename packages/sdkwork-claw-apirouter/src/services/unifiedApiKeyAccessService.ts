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

export const UNIFIED_API_ACCESS_GATEWAYS = {
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

const UNIFIED_API_CLIENT_IDS: ProviderAccessClientId[] = [
  'codex',
  'claude-code',
  'opencode',
  'openclaw',
  'gemini',
];

function getUnifiedApiClientGateway(clientId: ProviderAccessClientId) {
  switch (clientId) {
    case 'codex':
    case 'opencode':
    case 'openclaw':
      return UNIFIED_API_ACCESS_GATEWAYS.openai;
    case 'claude-code':
      return UNIFIED_API_ACCESS_GATEWAYS.anthropic;
    case 'gemini':
      return UNIFIED_API_ACCESS_GATEWAYS.gemini;
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
): ProxyProvider {
  const gateway = getUnifiedApiClientGateway(clientId);

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

export function buildUnifiedApiKeyAccessClientConfigs(item: UnifiedApiKey): ProviderAccessClientConfig[] {
  return UNIFIED_API_CLIENT_IDS.map((clientId) =>
    buildProviderAccessClientConfigById(clientId, buildUnifiedApiKeySyntheticProvider(item, clientId)),
  );
}

export function buildUnifiedApiKeyCurlExample(item: UnifiedApiKey) {
  return `curl ${UNIFIED_API_ACCESS_GATEWAYS.openai.baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${item.apiKey}" \\
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
    const syntheticProvider = buildUnifiedApiKeySyntheticProvider(item, client.id);
    return providerAccessApplyService.applyClientSetup(syntheticProvider, client, options);
  }

  async applyOpenClawSetup(
    item: UnifiedApiKey,
    instanceIds: string[],
  ): Promise<ApplyOpenClawSetupResult> {
    const syntheticProvider = buildUnifiedApiKeySyntheticProvider(item, 'openclaw');

    return providerAccessApplyService.applyOpenClawSetup(syntheticProvider, instanceIds);
  }
}

export const unifiedApiKeyAccessService = new UnifiedApiKeyAccessService();
