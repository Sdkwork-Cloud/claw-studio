import { studioMockService } from '@sdkwork/claw-infrastructure';
import { ListParams, PaginatedResult } from '@sdkwork/claw-types';
import { Instance, InstanceConfig, InstanceLLMProviderUpdate } from '../types';

export interface CreateInstanceDTO {
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
}

export interface UpdateInstanceDTO extends Partial<CreateInstanceDTO> {
  status?: 'online' | 'offline' | 'starting' | 'error';
}

export interface IInstanceService {
  getList(params?: ListParams): Promise<PaginatedResult<Instance>>;
  getById(id: string): Promise<Instance | null>;
  create(data: CreateInstanceDTO): Promise<Instance>;
  update(id: string, data: UpdateInstanceDTO): Promise<Instance>;
  delete(id: string): Promise<boolean>;
  getInstances(): Promise<Instance[]>;
  getInstanceById(id: string): Promise<Instance | undefined>;
  startInstance(id: string): Promise<void>;
  stopInstance(id: string): Promise<void>;
  restartInstance(id: string): Promise<void>;
  getInstanceConfig(id: string): Promise<InstanceConfig | undefined>;
  updateInstanceConfig(id: string, config: InstanceConfig): Promise<void>;
  getInstanceToken(id: string): Promise<string | undefined>;
  deleteInstance(id: string): Promise<void>;
  getInstanceLogs(id: string): Promise<string>;
  updateInstanceFileContent(id: string, fileId: string, content: string): Promise<void>;
  updateInstanceLlmProviderConfig(
    id: string,
    providerId: string,
    update: InstanceLLMProviderUpdate,
  ): Promise<void>;
}

class InstanceService implements IInstanceService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<Instance>> {
    const instances = await this.getInstances();

    let filtered = instances;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (instance) =>
          instance.name.toLowerCase().includes(lowerKeyword) ||
          instance.type.toLowerCase().includes(lowerKeyword),
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<Instance | null> {
    const instance = await this.getInstanceById(id);
    return instance || null;
  }

  async create(_data: CreateInstanceDTO): Promise<Instance> {
    throw new Error('Method not implemented.');
  }

  async update(_id: string, _data: UpdateInstanceDTO): Promise<Instance> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteInstance(id);
    return true;
  }

  async getInstances(): Promise<Instance[]> {
    return studioMockService.listInstances();
  }

  async getInstanceById(id: string): Promise<Instance | undefined> {
    return studioMockService.getInstance(id);
  }

  async startInstance(id: string): Promise<void> {
    const updated = await studioMockService.setInstanceStatus(id, 'online');
    if (!updated) {
      throw new Error('Failed to start instance');
    }
  }

  async stopInstance(id: string): Promise<void> {
    const updated = await studioMockService.setInstanceStatus(id, 'offline');
    if (!updated) {
      throw new Error('Failed to stop instance');
    }
  }

  async restartInstance(id: string): Promise<void> {
    const updated = await studioMockService.setInstanceStatus(id, 'online');
    if (!updated) {
      throw new Error('Failed to restart instance');
    }
  }

  async getInstanceConfig(id: string): Promise<InstanceConfig | undefined> {
    return studioMockService.getInstanceConfig(id);
  }

  async updateInstanceConfig(id: string, config: InstanceConfig): Promise<void> {
    const updated = await studioMockService.updateInstanceConfig(id, config);
    if (!updated) {
      throw new Error('Failed to update instance config');
    }
  }

  async getInstanceToken(id: string): Promise<string | undefined> {
    return studioMockService.getInstanceToken(id);
  }

  async deleteInstance(id: string): Promise<void> {
    const deleted = await studioMockService.deleteInstance(id);
    if (!deleted) {
      throw new Error('Failed to delete instance');
    }
  }

  async getInstanceLogs(id: string): Promise<string> {
    return studioMockService.getInstanceLogs(id);
  }

  async updateInstanceFileContent(id: string, fileId: string, content: string): Promise<void> {
    const updated = await studioMockService.updateInstanceFileContent(id, fileId, content);
    if (!updated) {
      throw new Error('Failed to update instance file');
    }
  }

  async updateInstanceLlmProviderConfig(
    id: string,
    providerId: string,
    update: InstanceLLMProviderUpdate,
  ): Promise<void> {
    const updated = await studioMockService.updateInstanceLlmProviderConfig(id, providerId, update);
    if (!updated) {
      throw new Error('Failed to update LLM provider config');
    }
  }
}

export const instanceService = new InstanceService();
