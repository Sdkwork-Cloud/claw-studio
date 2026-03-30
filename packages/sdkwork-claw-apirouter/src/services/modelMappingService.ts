import { studioMockService } from '@sdkwork/claw-infrastructure';
import type {
  ModelMapping,
  ModelMappingCatalogChannel,
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

async function requireValue<T>(
  value: Promise<T | undefined>,
  errorMessage: string,
): Promise<T> {
  const resolved = await value;
  if (resolved === undefined) {
    throw new Error(errorMessage);
  }

  return resolved;
}

class DefaultModelMappingService implements ModelMappingService {
  async getModelCatalog() {
    return studioMockService.listModelMappingCatalog();
  }

  async getModelMappings(params: GetModelMappingsParams = {}) {
    const items = await studioMockService.listModelMappings();
    return filterModelMappings(items, params);
  }

  async createModelMapping(input: ModelMappingCreate) {
    return studioMockService.createModelMapping(input);
  }

  async updateModelMapping(id: string, update: ModelMappingUpdate) {
    return requireValue(
      studioMockService.updateModelMapping(id, update),
      'Model mapping not found',
    );
  }

  async updateStatus(id: string, status: ModelMappingStatus) {
    return requireValue(
      studioMockService.updateModelMappingStatus(id, status),
      'Model mapping not found',
    );
  }

  async deleteModelMapping(id: string) {
    return studioMockService.deleteModelMapping(id);
  }
}

export const modelMappingService = new DefaultModelMappingService();
