import {
  sdkworkApiRouterAdminClient,
  studioMockService,
  type ApiRouterProviderDto,
} from '@sdkwork/claw-infrastructure';
import type {
  ModelMapping,
  ModelMappingCatalogChannel,
  ModelMappingCatalogModel,
  ModelMappingCreate,
  ModelMappingStatus,
  ModelMappingUpdate,
} from '@sdkwork/claw-types';

export interface GetModelMappingsParams {
  keyword?: string;
}

export interface ModelMappingService {
  getModelCatalog(): Promise<ModelMappingCatalogChannel[]>;
  getModelMappings(params?: GetModelMappingsParams): Promise<ModelMapping[]>;
  createModelMapping(input: ModelMappingCreate): Promise<ModelMapping>;
  updateModelMapping(id: string, update: ModelMappingUpdate): Promise<ModelMapping>;
  updateStatus(id: string, status: ModelMappingStatus): Promise<ModelMapping>;
  deleteModelMapping(id: string): Promise<boolean>;
}

const MODEL_MAPPING_UNSUPPORTED_ERROR =
  'The connected sdkwork-api-router build does not expose first-class model mapping APIs yet. Routing policies exist on the router backend, but Claw Studio cannot safely emulate full model mapping CRUD without a dedicated backend contract.';

function resolveProviderChannelId(provider: ApiRouterProviderDto) {
  return (
    provider.channel_bindings?.find((binding) => binding.is_primary)?.channel_id
    || provider.channel_id
  );
}

function sortCatalogModels(models: Iterable<ModelMappingCatalogModel>) {
  return [...models].sort((left, right) => left.modelName.localeCompare(right.modelName));
}

async function loadRouterModelCatalog(): Promise<ModelMappingCatalogChannel[]> {
  const [channels, providers, models] = await Promise.all([
    sdkworkApiRouterAdminClient.listChannels(),
    sdkworkApiRouterAdminClient.listProviders(),
    sdkworkApiRouterAdminClient.listModels(),
  ]);
  const seededChannels = await studioMockService.listApiRouterChannels().catch(() => []);
  const seededById = new Map<string, Awaited<typeof seededChannels>[number]>(
    seededChannels.map(
      (channel): [string, Awaited<typeof seededChannels>[number]] => [channel.id, channel],
    ),
  );
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const modelsByChannelId = new Map<string, Map<string, ModelMappingCatalogModel>>();

  for (const model of models) {
    const provider = providersById.get(model.provider_id);
    if (!provider) {
      continue;
    }

    const channelId = resolveProviderChannelId(provider);
    const channelModels = modelsByChannelId.get(channelId) || new Map<string, ModelMappingCatalogModel>();
    channelModels.set(model.external_name, {
      modelId: model.external_name,
      modelName: model.external_name,
    });
    modelsByChannelId.set(channelId, channelModels);
  }

  return [...modelsByChannelId.entries()]
    .map(([channelId, channelModels]) => {
      const seededChannel = seededById.get(channelId);
      const routerChannel = channels.find((channel) => channel.id === channelId);

      return {
        channelId,
        channelName: seededChannel?.name || routerChannel?.name || channelId,
        models: sortCatalogModels(channelModels.values()),
      };
    })
    .sort((left, right) => left.channelName.localeCompare(right.channelName));
}

function filterModelMappings(items: ModelMapping[], params: GetModelMappingsParams = {}) {
  if (!params.keyword?.trim()) {
    return items;
  }

  const normalizedKeyword = params.keyword.trim().toLowerCase();
  return items.filter((item) =>
    [
      item.name,
      item.description,
      ...item.rules.flatMap((rule) => [
        rule.source.channelName,
        rule.source.modelId,
        rule.source.modelName,
        rule.target.channelName,
        rule.target.modelId,
        rule.target.modelName,
      ]),
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword),
  );
}

function createUnsupportedError() {
  return new Error(MODEL_MAPPING_UNSUPPORTED_ERROR);
}

class DefaultModelMappingService implements ModelMappingService {
  async getModelCatalog() {
    return loadRouterModelCatalog();
  }

  async getModelMappings(params: GetModelMappingsParams = {}) {
    await loadRouterModelCatalog();
    return filterModelMappings([], params);
  }

  async createModelMapping(input: ModelMappingCreate): Promise<ModelMapping> {
    void input;
    throw createUnsupportedError();
  }

  async updateModelMapping(id: string, update: ModelMappingUpdate): Promise<ModelMapping> {
    void id;
    void update;
    throw createUnsupportedError();
  }

  async updateStatus(id: string, status: ModelMappingStatus): Promise<ModelMapping> {
    void id;
    void status;
    throw createUnsupportedError();
  }

  async deleteModelMapping(id: string): Promise<boolean> {
    void id;
    throw createUnsupportedError();
  }
}

export const modelMappingService = new DefaultModelMappingService();
export { MODEL_MAPPING_UNSUPPORTED_ERROR };
