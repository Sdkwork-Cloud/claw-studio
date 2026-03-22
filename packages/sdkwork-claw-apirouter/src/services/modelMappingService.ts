import { getApiRouterPlatform } from '@sdkwork/claw-infrastructure';
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

class DefaultModelMappingService implements ModelMappingService {
  async getModelCatalog() {
    return getApiRouterPlatform().getModelCatalog();
  }

  async getModelMappings(params: GetModelMappingsParams = {}) {
    return getApiRouterPlatform().getModelMappings(params);
  }

  async createModelMapping(input: ModelMappingCreate) {
    return getApiRouterPlatform().createModelMapping(input);
  }

  async updateModelMapping(id: string, update: ModelMappingUpdate) {
    return getApiRouterPlatform().updateModelMapping(id, update);
  }

  async updateStatus(id: string, status: ModelMappingStatus) {
    return getApiRouterPlatform().updateModelMappingStatus(id, status);
  }

  async deleteModelMapping(id: string) {
    return getApiRouterPlatform().deleteModelMapping(id);
  }
}

export const modelMappingService = new DefaultModelMappingService();
