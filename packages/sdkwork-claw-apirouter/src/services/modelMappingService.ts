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

function matchesKeyword(item: ModelMapping, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return [
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
    .includes(normalizedKeyword);
}

async function requireModelMapping(
  item: Promise<ModelMapping | undefined>,
  errorMessage: string,
) {
  const resolvedItem = await item;
  if (!resolvedItem) {
    throw new Error(errorMessage);
  }

  return resolvedItem;
}

class DefaultModelMappingService implements ModelMappingService {
  async getModelCatalog() {
    return studioMockService.listModelMappingCatalog();
  }

  async getModelMappings(params: GetModelMappingsParams = {}) {
    const items = await studioMockService.listModelMappings();

    return items.filter((item) => {
      if (params.keyword && !matchesKeyword(item, params.keyword)) {
        return false;
      }

      return true;
    });
  }

  async createModelMapping(input: ModelMappingCreate) {
    return studioMockService.createModelMapping(input);
  }

  async updateModelMapping(id: string, update: ModelMappingUpdate) {
    return requireModelMapping(
      studioMockService.updateModelMapping(id, update),
      'Model mapping not found',
    );
  }

  async updateStatus(id: string, status: ModelMappingStatus) {
    return requireModelMapping(
      studioMockService.updateModelMappingStatus(id, status),
      'Model mapping not found',
    );
  }

  async deleteModelMapping(id: string) {
    return studioMockService.deleteModelMapping(id);
  }
}

export const modelMappingService = new DefaultModelMappingService();
