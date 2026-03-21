import {
  studio,
  studioMockService,
  type StudioCreateInstanceInput,
  type StudioUpdateInstanceInput,
} from '@sdkwork/claw-infrastructure';
import { openClawConfigService } from '@sdkwork/claw-core';
import { ListParams, PaginatedResult, type StudioInstanceRecord } from '@sdkwork/claw-types';
import { Instance, InstanceConfig, InstanceLLMProviderUpdate } from '../types';

export interface CreateInstanceDTO {
  name: string;
  type?: string;
  iconType?: 'apple' | 'box' | 'server';
  description?: string;
  runtimeKind?: 'openclaw' | 'zeroclaw' | 'ironclaw' | 'custom';
  deploymentMode?: 'local-managed' | 'local-external' | 'remote';
  transportKind?:
    | 'openclawGatewayWs'
    | 'zeroclawHttp'
    | 'ironclawWeb'
    | 'openaiHttp'
    | 'customHttp'
    | 'customWs';
  host?: string;
  port?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
}

export interface UpdateInstanceDTO extends Partial<CreateInstanceDTO> {
  status?: 'online' | 'offline' | 'starting' | 'error';
}

function mapStudioInstance(instance: StudioInstanceRecord): Instance {
  const status: Instance['status'] =
    instance.status === 'syncing' ? 'starting' : instance.status;

  return {
    id: instance.id,
    name: instance.name,
    type: instance.typeLabel,
    iconType: instance.iconType,
    status,
    version: instance.version,
    uptime: instance.uptime,
    ip: instance.host,
    cpu: instance.cpu,
    memory: instance.memory,
    totalMemory: instance.totalMemory,
  };
}

function mapCreateInput(data: CreateInstanceDTO): StudioCreateInstanceInput {
  return {
    name: data.name,
    description: data.description,
    runtimeKind: data.runtimeKind || 'custom',
    deploymentMode: data.deploymentMode || 'remote',
    transportKind: data.transportKind || 'customHttp',
    iconType: data.iconType || 'server',
    typeLabel: data.type,
    host: data.host,
    port: data.port ?? null,
    baseUrl: data.baseUrl ?? null,
    websocketUrl: data.websocketUrl ?? null,
  };
}

function mapUpdateInput(data: UpdateInstanceDTO): StudioUpdateInstanceInput {
  return {
    name: data.name,
    description: data.description,
    iconType: data.iconType,
    typeLabel: data.type,
    host: data.host,
    port: data.port ?? null,
    baseUrl: data.baseUrl ?? null,
    websocketUrl: data.websocketUrl ?? null,
    status:
      data.status === 'starting'
        ? 'starting'
        : data.status === 'error'
          ? 'error'
          : data.status,
  };
}

function trimApiRouterProviderId(providerId: string) {
  return providerId.startsWith('api-router-')
    ? providerId.slice('api-router-'.length)
    : providerId;
}

const updateMockInstanceLlmProviderConfig =
  studioMockService['updateInstanceLlmProviderConfig'];

async function resolveManagedOpenClawConfig(id: string) {
  const detail = await studio.getInstanceDetail(id);
  if (!detail || detail.instance.runtimeKind !== 'openclaw') {
    return null;
  }

  const configPath = openClawConfigService.resolveInstanceConfigPath(detail);
  if (!configPath) {
    return null;
  }

  return {
    detail,
    configPath,
  };
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
  saveOpenClawChannelConfig(
    id: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<void>;
  setOpenClawChannelEnabled(id: string, channelId: string, enabled: boolean): Promise<void>;
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

  async create(data: CreateInstanceDTO): Promise<Instance> {
    const created = await studio.createInstance(mapCreateInput(data));
    return mapStudioInstance(created);
  }

  async update(id: string, data: UpdateInstanceDTO): Promise<Instance> {
    const updated = await studio.updateInstance(id, mapUpdateInput(data));
    return mapStudioInstance(updated);
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteInstance(id);
    return true;
  }

  async getInstances(): Promise<Instance[]> {
    const instances = await studio.listInstances();
    return instances.map((instance) => mapStudioInstance(instance));
  }

  async getInstanceById(id: string): Promise<Instance | undefined> {
    const instance = await studio.getInstance(id);
    return instance ? mapStudioInstance(instance) : undefined;
  }

  async startInstance(id: string): Promise<void> {
    const updated = await studio.startInstance(id);
    if (!updated) {
      throw new Error('Failed to start instance');
    }
  }

  async stopInstance(id: string): Promise<void> {
    const updated = await studio.stopInstance(id);
    if (!updated) {
      throw new Error('Failed to stop instance');
    }
  }

  async restartInstance(id: string): Promise<void> {
    const updated = await studio.restartInstance(id);
    if (!updated) {
      throw new Error('Failed to restart instance');
    }
  }

  async getInstanceConfig(id: string): Promise<InstanceConfig | undefined> {
    const config = await studio.getInstanceConfig(id);
    if (!config) {
      return undefined;
    }

    return {
      port: config.port,
      sandbox: config.sandbox,
      autoUpdate: config.autoUpdate,
      logLevel: config.logLevel,
      corsOrigins: config.corsOrigins,
    };
  }

  async updateInstanceConfig(id: string, config: InstanceConfig): Promise<void> {
    const current = await studio.getInstanceConfig(id);
    const updated = await studio.updateInstanceConfig(id, {
      ...(current || {
        port: config.port,
        sandbox: config.sandbox,
        autoUpdate: config.autoUpdate,
        logLevel: config.logLevel,
        corsOrigins: config.corsOrigins,
      }),
      port: config.port,
      sandbox: config.sandbox,
      autoUpdate: config.autoUpdate,
      logLevel: config.logLevel,
      corsOrigins: config.corsOrigins,
    });
    if (!updated) {
      throw new Error('Failed to update instance config');
    }
  }

  async getInstanceToken(id: string): Promise<string | undefined> {
    const config = await studio.getInstanceConfig(id);
    return config?.authToken || undefined;
  }

  async deleteInstance(id: string): Promise<void> {
    const deleted = await studio.deleteInstance(id);
    if (!deleted) {
      throw new Error('Failed to delete instance');
    }
  }

  async getInstanceLogs(id: string): Promise<string> {
    return studio.getInstanceLogs(id);
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
    const managedConfig = await resolveManagedOpenClawConfig(id);
    if (managedConfig) {
      const configSnapshot = await openClawConfigService.readConfigSnapshot(managedConfig.configPath);
      const currentProvider = configSnapshot.providerSnapshots.find(
        (provider) => provider.id === providerId,
      );

      if (!currentProvider) {
        throw new Error('Failed to resolve the managed OpenClaw provider configuration.');
      }

      await openClawConfigService.saveProviderSelection({
        configPath: managedConfig.configPath,
        provider: {
          id: trimApiRouterProviderId(providerId),
          channelId: currentProvider.provider,
          name: currentProvider.name,
          apiKey: update.apiKeySource,
          baseUrl: update.endpoint,
          models: currentProvider.models.map((model) => ({
            id: model.id,
            name: model.name,
          })),
          config: update.config,
        },
        selection: {
          defaultModelId: update.defaultModelId,
          reasoningModelId: update.reasoningModelId,
          embeddingModelId: update.embeddingModelId,
        },
      });
      return;
    }

    const updated = await updateMockInstanceLlmProviderConfig(id, providerId, update);
    if (!updated) {
      throw new Error('Failed to update LLM provider config');
    }
  }

  async saveOpenClawChannelConfig(
    id: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<void> {
    const managedConfig = await resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Managed OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.saveChannelConfiguration({
      configPath: managedConfig.configPath,
      channelId,
      values,
      enabled: true,
    });
  }

  async setOpenClawChannelEnabled(
    id: string,
    channelId: string,
    enabled: boolean,
  ): Promise<void> {
    const managedConfig = await resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Managed OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.setChannelEnabled({
      configPath: managedConfig.configPath,
      channelId,
      enabled,
    });
  }
}

export const instanceService = new InstanceService();
