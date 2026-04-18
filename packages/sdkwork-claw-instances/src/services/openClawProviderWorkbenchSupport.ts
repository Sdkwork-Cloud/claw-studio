import type { OpenClawConfigSnapshot } from '@sdkwork/claw-core';
import type {
  OpenClawConfigSnapshot as GatewayOpenClawConfigSnapshot,
  OpenClawModelRecord,
} from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type { InstanceWorkbenchLLMProvider } from '../types/index.ts';
import {
  describeSecretSource,
  getArrayValue,
  getBooleanValue,
  getNumberValue,
  getObjectValue,
  getRecordValue,
  getStringValue,
  inferProviderCapabilities,
  isRecord,
  mapOpenClawProviderModels,
  titleCaseIdentifier,
} from './openClawSupport.ts';

export function mapConfigBackedProvider(
  provider: OpenClawConfigSnapshot['providerSnapshots'][number],
): InstanceWorkbenchLLMProvider {
  return {
    id: provider.id,
    name: provider.name,
    provider: provider.provider,
    endpoint: provider.endpoint,
    apiKeySource: provider.apiKeySource,
    status: provider.status,
    defaultModelId: provider.defaultModelId,
    reasoningModelId: provider.reasoningModelId,
    embeddingModelId: provider.embeddingModelId,
    description: provider.description,
    icon: provider.icon,
    lastCheckedAt: provider.lastCheckedAt,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

export function mapLlmProvider(
  provider: InstanceWorkbenchLLMProvider,
): InstanceWorkbenchLLMProvider {
  return {
    ...provider,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

export function providerMatchesId(model: OpenClawModelRecord, providerId: string) {
  const candidates = [
    typeof model.provider === 'string' ? model.provider : undefined,
    typeof model.providerId === 'string' ? model.providerId : undefined,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  return candidates.includes(providerId.toLowerCase());
}

export function buildOpenClawLlmProviders(
  configSnapshot: GatewayOpenClawConfigSnapshot | null,
  liveModels: OpenClawModelRecord[],
  detail: StudioInstanceDetailRecord,
): InstanceWorkbenchLLMProvider[] {
  const providers = getObjectValue(configSnapshot?.config, ['models', 'providers']) || {};
  const lastCheckedAt =
    getStringValue(configSnapshot?.config, ['meta', 'lastTouchedAt']) ||
    (detail.observability.lastSeenAt
      ? new Date(detail.observability.lastSeenAt).toISOString()
      : 'Unknown');

  return Object.entries(providers)
    .filter(([, providerValue]) => isRecord(providerValue))
    .map(([providerId, providerValue]) => {
      const configModels = getArrayValue(providerValue, ['models']) || [];
      const providerModels = liveModels.filter((model) => providerMatchesId(model, providerId));
      const modelSource = providerModels.length > 0 ? providerModels : configModels;
      const models = mapOpenClawProviderModels(modelSource);
      const defaultModelId =
        models.find((model) => model.role === 'primary')?.id || models[0]?.id || '';

      return {
        id: providerId,
        name: titleCaseIdentifier(providerId),
        provider: providerId,
        endpoint:
          getStringValue(providerValue, ['baseUrl']) ||
          getStringValue(providerValue, ['endpoint']) ||
          '',
        apiKeySource: describeSecretSource(getRecordValue(providerValue, ['apiKey'])),
        status: defaultModelId ? 'ready' : 'configurationRequired',
        defaultModelId,
        reasoningModelId: models.find((model) => model.role === 'reasoning')?.id,
        embeddingModelId: models.find((model) => model.role === 'embedding')?.id,
        description: `${titleCaseIdentifier(providerId)} provider configured through the OpenClaw gateway.`,
        icon: providerId.charAt(0).toUpperCase() || 'O',
        lastCheckedAt,
        capabilities: inferProviderCapabilities(modelSource),
        models,
        config: {
          temperature: getNumberValue(providerValue, ['temperature']) ?? 0.2,
          topP: getNumberValue(providerValue, ['topP']) ?? 1,
          maxTokens: getNumberValue(providerValue, ['maxTokens']) ?? 4096,
          timeoutMs: getNumberValue(providerValue, ['timeoutMs']) ?? 60000,
          streaming: getBooleanValue(providerValue, ['streaming']) ?? true,
        },
      } satisfies InstanceWorkbenchLLMProvider;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
