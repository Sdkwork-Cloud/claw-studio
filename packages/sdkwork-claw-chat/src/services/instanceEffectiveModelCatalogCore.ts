import type { OpenClawConfigSnapshot } from '@sdkwork/claw-core';
import type {
  ApiRouterChannelDto,
  ApiRouterModelDto,
  ApiRouterProviderDto,
} from '@sdkwork/claw-infrastructure';
import type { LLMChannel, LLMModel } from '@sdkwork/claw-settings';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/claw-types';
import { resolveInstanceChatRoute } from './instanceChatRouteService.ts';

type GatewayModelsListResult = {
  models: Array<{
    id: string;
    name: string;
    provider?: string;
  }>;
};

type RouterCatalogModelEntry = {
  channelId: string;
  channelName: string;
  channelProvider: string;
  channelBaseUrl: string;
  channelIcon: string;
  modelId: string;
  modelName: string;
  modelRef: string;
  providerId: string;
};

export interface InstanceEffectiveModelCatalog {
  channels: LLMChannel[];
}

export interface InstanceEffectiveModelCatalogService {
  getCatalog(instanceId: string): Promise<InstanceEffectiveModelCatalog>;
}

export interface InstanceEffectiveModelCatalogDependencies {
  getInstance: (instanceId: string) => Promise<StudioInstanceRecord | null>;
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  listRouterChannels: () => Promise<ApiRouterChannelDto[]>;
  listRouterProviders: () => Promise<ApiRouterProviderDto[]>;
  listRouterModels: () => Promise<ApiRouterModelDto[]>;
  resolveOpenClawConfigPath: (
    detail: StudioInstanceDetailRecord | null | undefined,
  ) => string | null;
  readOpenClawConfigSnapshot: (configPath: string) => Promise<OpenClawConfigSnapshot>;
  listGatewayModels: (instanceId: string) => Promise<GatewayModelsListResult>;
}

const CHANNEL_ICON_MAP: Record<string, string> = {
  anthropic: 'AT',
  baidu: 'BD',
  coding: 'CD',
  deepseek: 'DS',
  general: 'AI',
  moonshot: 'KI',
  openai: 'OA',
  qwen: 'QW',
  vision: 'VS',
  zhipu: 'ZP',
};

function normalizeProviderId(providerId: string) {
  return providerId.startsWith('api-router-')
    ? providerId.slice('api-router-'.length)
    : providerId;
}

function resolveProviderChannelId(provider: ApiRouterProviderDto) {
  return (
    provider.channel_bindings?.find((binding) => binding.is_primary)?.channel_id ||
    provider.channel_id
  );
}

function resolveChannelIcon(channelId: string, providerId: string) {
  return (
    CHANNEL_ICON_MAP[channelId] ||
    CHANNEL_ICON_MAP[providerId] ||
    providerId.slice(0, 2).toUpperCase() ||
    'AI'
  );
}

function sortModels(models: LLMModel[]) {
  return [...models].sort((left, right) => left.name.localeCompare(right.name));
}

function sortChannels(channels: LLMChannel[]) {
  return [...channels].sort((left, right) => left.name.localeCompare(right.name));
}

function buildGatewayModelRef(entry: { id: string; provider?: string }) {
  const provider = entry.provider?.trim();
  const id = entry.id.trim();
  if (!provider || id.startsWith(`${provider}/`)) {
    return id;
  }

  return `${provider}/${id}`;
}

function buildRouterCatalog(params: {
  channels: ApiRouterChannelDto[];
  providers: ApiRouterProviderDto[];
  models: ApiRouterModelDto[];
}) {
  const channelById = new Map(params.channels.map((channel) => [channel.id, channel]));
  const providerById = new Map(params.providers.map((provider) => [provider.id, provider]));
  const entries: RouterCatalogModelEntry[] = [];

  for (const model of params.models) {
    const provider = providerById.get(model.provider_id);
    if (!provider) {
      continue;
    }

    const channelId = resolveProviderChannelId(provider);
    const channel = channelById.get(channelId);
    const providerId = normalizeProviderId(provider.id);
    const modelId = model.external_name.trim();
    if (!modelId) {
      continue;
    }

    entries.push({
      channelId,
      channelName: channel?.name || channelId,
      channelProvider: providerId,
      channelBaseUrl: provider.base_url,
      channelIcon: resolveChannelIcon(channelId, providerId),
      modelId,
      modelName: modelId,
      modelRef: `${providerId}/${modelId}`,
      providerId,
    });
  }

  return entries;
}

function groupEntriesToChannels(
  entries: RouterCatalogModelEntry[],
  params: {
    useModelRefAsId: boolean;
    runtimeNameByRef?: Map<string, string>;
  },
) {
  const channelMap = new Map<string, LLMChannel>();

  for (const entry of entries) {
    const existing =
      channelMap.get(entry.channelId) ||
      ({
        id: entry.channelId,
        name: entry.channelName,
        provider: entry.channelProvider,
        baseUrl: entry.channelBaseUrl,
        apiKey: '',
        icon: entry.channelIcon,
        models: [],
      } satisfies LLMChannel);
    const modelId = params.useModelRefAsId ? entry.modelRef : entry.modelId;
    const modelName = params.runtimeNameByRef?.get(entry.modelRef) || entry.modelName;
    if (!existing.models.some((model) => model.id === modelId)) {
      existing.models.push({
        id: modelId,
        name: modelName,
      });
    }
    channelMap.set(entry.channelId, existing);
  }

  return sortChannels(
    [...channelMap.values()].map((channel) => {
      const models = sortModels(channel.models);
      return {
        ...channel,
        models,
        defaultModelId: models[0]?.id,
      };
    }),
  );
}

function buildRuntimeFallbackChannels(result: GatewayModelsListResult) {
  const channelMap = new Map<string, LLMChannel>();

  for (const model of result.models) {
    const providerId = normalizeProviderId(model.provider?.trim() || 'openclaw');
    const modelRef = buildGatewayModelRef(model);
    const channel =
      channelMap.get(providerId) ||
      ({
        id: providerId,
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        provider: providerId,
        baseUrl: '',
        apiKey: '',
        icon: resolveChannelIcon(providerId, providerId),
        models: [],
      } satisfies LLMChannel);
    if (!channel.models.some((entry) => entry.id === modelRef)) {
      channel.models.push({
        id: modelRef,
        name: model.name || model.id,
      });
    }
    channelMap.set(providerId, channel);
  }

  return sortChannels(
    [...channelMap.values()].map((channel) => {
      const models = sortModels(channel.models);
      return {
        ...channel,
        models,
        defaultModelId: models[0]?.id,
      };
    }),
  );
}

class DefaultInstanceEffectiveModelCatalogService
  implements InstanceEffectiveModelCatalogService
{
  private readonly dependencies: InstanceEffectiveModelCatalogDependencies;

  constructor(dependencies: InstanceEffectiveModelCatalogDependencies) {
    this.dependencies = dependencies;
  }

  async getCatalog(instanceId: string) {
    const instance = await this.dependencies.getInstance(instanceId);
    if (!instance) {
      return { channels: [] };
    }

    const [routerChannels, routerProviders, routerModels] = await Promise.all([
      this.dependencies.listRouterChannels(),
      this.dependencies.listRouterProviders(),
      this.dependencies.listRouterModels(),
    ]);
    const routerCatalog = buildRouterCatalog({
      channels: routerChannels,
      providers: routerProviders,
      models: routerModels,
    });

    const route = resolveInstanceChatRoute(instance);
    if (route.mode !== 'instanceOpenClawGatewayWs' || instance.runtimeKind !== 'openclaw') {
      return {
        channels: groupEntriesToChannels(routerCatalog, {
          useModelRefAsId: false,
        }),
      };
    }

    const detail = await this.dependencies.getInstanceDetail(instanceId);
    const configPath = this.dependencies.resolveOpenClawConfigPath(detail);
    const gatewayModels = await this.dependencies.listGatewayModels(instanceId);
    const runtimeModelRefs = new Set(gatewayModels.models.map((model) => buildGatewayModelRef(model)));
    const runtimeNamesByRef = new Map(
      gatewayModels.models.map((model) => [buildGatewayModelRef(model), model.name || model.id] as const),
    );

    if (!configPath) {
      return {
        channels: buildRuntimeFallbackChannels(gatewayModels),
      };
    }

    const configSnapshot = await this.dependencies.readOpenClawConfigSnapshot(configPath);
    const configuredProviderIds = new Set(
      configSnapshot.providerSnapshots.map((provider) => normalizeProviderId(provider.id)),
    );
    const filtered = routerCatalog.filter(
      (entry) =>
        configuredProviderIds.has(entry.providerId) && runtimeModelRefs.has(entry.modelRef),
    );

    return {
      channels:
        filtered.length > 0
          ? groupEntriesToChannels(filtered, {
              useModelRefAsId: true,
              runtimeNameByRef: runtimeNamesByRef,
            })
          : buildRuntimeFallbackChannels(gatewayModels),
    };
  }
}

export function createInstanceEffectiveModelCatalogService(
  dependencies: InstanceEffectiveModelCatalogDependencies,
) {
  return new DefaultInstanceEffectiveModelCatalogService(dependencies);
}
