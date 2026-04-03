import {
  openClawGatewayClient,
  studio,
  type StudioCreateInstanceInput,
  type StudioUpdateInstanceInput,
  type OpenClawAgentFileResult,
} from '@sdkwork/claw-infrastructure';
import type {
  SaveOpenClawAuthCooldownsConfigurationInput,
  OpenClawAgentInput,
  OpenClawModelSelection,
  OpenClawProviderInput,
  OpenClawProviderModelInput,
  SaveOpenClawWebSearchConfigurationInput,
} from '@sdkwork/claw-core';
import { openClawConfigService } from '@sdkwork/claw-core';
import type {
  ListParams,
  PaginatedResult,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import type { Instance, InstanceConfig, InstanceLLMProviderUpdate } from '../types/index.ts';
import {
  buildOpenClawAgentFileId,
  getArrayValue,
  getObjectValue,
  parseOpenClawAgentFileId,
  upsertOpenClawProviderModels,
} from './openClawSupport.ts';

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

interface InstanceServiceDependencies {
  studioApi: {
    listInstances(): Promise<StudioInstanceRecord[]>;
    getInstance(id: string): Promise<StudioInstanceRecord | null>;
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
    createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
    updateInstance(id: string, input: StudioUpdateInstanceInput): Promise<StudioInstanceRecord>;
    deleteInstance(id: string): Promise<boolean>;
    startInstance(id: string): Promise<StudioInstanceRecord | null>;
    stopInstance(id: string): Promise<StudioInstanceRecord | null>;
    restartInstance(id: string): Promise<StudioInstanceRecord | null>;
    getInstanceConfig(id: string): Promise<{
      port: string;
      sandbox: boolean;
      autoUpdate: boolean;
      logLevel: string;
      corsOrigins: string;
      authToken?: string | null;
    } | null>;
    updateInstanceConfig(
      id: string,
      config: {
        port: string;
        sandbox: boolean;
        autoUpdate: boolean;
        logLevel: string;
        corsOrigins: string;
        authToken?: string | null;
      },
    ): Promise<{
      port: string;
      sandbox: boolean;
      autoUpdate: boolean;
      logLevel: string;
      corsOrigins: string;
      authToken?: string | null;
    } | null>;
    getInstanceLogs(id: string): Promise<string>;
    updateInstanceFileContent(instanceId: string, fileId: string, content: string): Promise<boolean>;
    updateInstanceLlmProviderConfig(
      instanceId: string,
      providerId: string,
      update: InstanceLLMProviderUpdate,
    ): Promise<boolean>;
  };
  openClawGatewayClient: {
    getAgentFile(
      instanceId: string,
      args: { agentId: string; name: string },
    ): Promise<OpenClawAgentFileResult>;
    setAgentFile(
      instanceId: string,
      args: { agentId: string; name: string; content: string },
    ): Promise<unknown>;
    getConfig(instanceId: string): Promise<{
      baseHash?: string;
      config?: Record<string, unknown>;
    }>;
    patchConfig(
      instanceId: string,
      args: { raw: string; baseHash?: string },
    ): Promise<{ ok?: boolean }>;
  };
}

export interface InstanceServiceDependencyOverrides {
  studioApi?: Partial<InstanceServiceDependencies['studioApi']>;
  openClawGatewayClient?: Partial<InstanceServiceDependencies['openClawGatewayClient']>;
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

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function isBuiltInManagedOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return (
    detail?.instance.runtimeKind === 'openclaw' &&
    detail.instance.isBuiltIn &&
    detail.instance.deploymentMode === 'local-managed'
  );
}

function isProviderCenterManagedOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return (
    detail?.instance.runtimeKind === 'openclaw' &&
    detail.instance.deploymentMode !== 'remote'
  );
}

function shouldUseStudioBridgeForFileContent(
  detail: StudioInstanceDetailRecord | null | undefined,
  fileId: string,
) {
  if (isBuiltInManagedOpenClawDetail(detail)) {
    return true;
  }

  return Boolean(
    detail?.workbench?.files.some((file) => file.id === fileId) &&
      !isOpenClawDetail(detail),
  );
}

function shouldUseStudioBridgeForProviderConfig(
  detail: StudioInstanceDetailRecord | null | undefined,
  providerId: string,
) {
  return Boolean(
    detail?.workbench?.llmProviders.some((provider) => provider.id === providerId) &&
      !isOpenClawDetail(detail),
  );
}

function createManagedOpenClawProviderControlPlaneError() {
  return new Error(
    'Config-backed OpenClaw provider routes are managed through Provider Center.',
  );
}

function buildOpenClawModelRef(providerId: string, modelId: string) {
  return `${providerId.trim()}/${modelId.trim()}`;
}

function inferOpenClawModelCatalogStreaming(model: Record<string, unknown>) {
  if (typeof model.role === 'string' && model.role.trim().toLowerCase() === 'embedding') {
    return false;
  }

  const id = typeof model.id === 'string' ? model.id.toLowerCase() : '';
  const name = typeof model.name === 'string' ? model.name.toLowerCase() : '';
  const api = typeof model.api === 'string' ? model.api.toLowerCase() : '';
  return !(
    id.includes('embed') ||
    name.includes('embed') ||
    api.includes('embedding')
  );
}

function buildOpenClawRuntimeParamsPatch(update: InstanceLLMProviderUpdate) {
  return {
    temperature: update.config.temperature,
    topP: update.config.topP,
    maxTokens: update.config.maxTokens,
    timeoutMs: update.config.timeoutMs,
    streaming: update.config.streaming,
  };
}

function buildRemoteOpenClawProviderConfigPatch(
  providerId: string,
  update: InstanceLLMProviderUpdate,
  existingModels: unknown[],
) {
  const normalizedProviderId = providerId.trim();
  const normalizedDefaultModelId = update.defaultModelId.trim();
  const normalizedReasoningModelId = update.reasoningModelId?.trim() || undefined;
  const normalizedEmbeddingModelId = update.embeddingModelId?.trim() || undefined;
  const nextModels = upsertOpenClawProviderModels(
    existingModels,
    normalizedDefaultModelId,
    normalizedReasoningModelId,
    normalizedEmbeddingModelId,
  );
  const defaultsModelsPatch = Object.fromEntries(
    nextModels.flatMap((model) => {
      if (!model || typeof model !== 'object' || Array.isArray(model)) {
        return [];
      }

      const modelRecord = model as Record<string, unknown>;
      const modelId = typeof modelRecord.id === 'string' ? modelRecord.id.trim() : '';
      if (!modelId) {
        return [];
      }

      const entry: Record<string, unknown> = {
        alias:
          (typeof modelRecord.name === 'string' && modelRecord.name.trim()) ||
          modelId,
        streaming: inferOpenClawModelCatalogStreaming(modelRecord),
      };

      if (modelId === normalizedDefaultModelId) {
        entry.params = buildOpenClawRuntimeParamsPatch(update);
      }

      return [[buildOpenClawModelRef(normalizedProviderId, modelId), entry]];
    }),
  );

  const defaultsModelPatch: Record<string, unknown> = {
    primary: buildOpenClawModelRef(normalizedProviderId, normalizedDefaultModelId),
  };
  if (normalizedReasoningModelId) {
    defaultsModelPatch.fallbacks = [
      buildOpenClawModelRef(normalizedProviderId, normalizedReasoningModelId),
    ];
  }

  return {
    models: {
      providers: {
        [normalizedProviderId]: {
          baseUrl: update.endpoint.trim(),
          apiKey: update.apiKeySource.trim() || null,
          temperature: null,
          topP: null,
          maxTokens: null,
          timeoutMs: null,
          streaming: null,
          models: nextModels,
        },
      },
    },
    agents: {
      defaults: {
        model: defaultsModelPatch,
        models: defaultsModelsPatch,
      },
    },
  };
}

function createDefaultDependencies(): InstanceServiceDependencies {
  return {
    studioApi: {
      listInstances: () => studio.listInstances(),
      getInstance: (id) => studio.getInstance(id),
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
      createInstance: (input) => studio.createInstance(input),
      updateInstance: (id, input) => studio.updateInstance(id, input),
      deleteInstance: (id) => studio.deleteInstance(id),
      startInstance: (id) => studio.startInstance(id),
      stopInstance: (id) => studio.stopInstance(id),
      restartInstance: (id) => studio.restartInstance(id),
      getInstanceConfig: (id) => studio.getInstanceConfig(id),
      updateInstanceConfig: (id, config) => studio.updateInstanceConfig(id, config),
      getInstanceLogs: (id) => studio.getInstanceLogs(id),
      updateInstanceFileContent: (instanceId, fileId, content) =>
        studio.updateInstanceFileContent(instanceId, fileId, content),
      updateInstanceLlmProviderConfig: (instanceId, providerId, update) =>
        studio.updateInstanceLlmProviderConfig(instanceId, providerId, update),
    },
    openClawGatewayClient: {
      getAgentFile: (instanceId, args) => openClawGatewayClient.getAgentFile(instanceId, args),
      setAgentFile: (instanceId, args) => openClawGatewayClient.setAgentFile(instanceId, args),
      getConfig: (instanceId) => openClawGatewayClient.getConfig(instanceId),
      patchConfig: (instanceId, args) => openClawGatewayClient.patchConfig(instanceId, args),
    },
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
  getInstanceFileContent(id: string, fileId: string): Promise<string>;
  updateInstanceFileContent(id: string, fileId: string, content: string): Promise<void>;
  updateInstanceLlmProviderConfig(
    id: string,
    providerId: string,
    update: InstanceLLMProviderUpdate,
  ): Promise<void>;
  createInstanceLlmProvider(
    id: string,
    provider: OpenClawProviderInput,
    selection: OpenClawModelSelection,
  ): Promise<void>;
  deleteInstanceLlmProvider(id: string, providerId: string): Promise<void>;
  createInstanceLlmProviderModel(
    id: string,
    providerId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void>;
  updateInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void>;
  deleteInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
  ): Promise<void>;
  createOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void>;
  updateOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void>;
  deleteOpenClawAgent(id: string, agentId: string): Promise<void>;
  saveOpenClawChannelConfig(
    id: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<void>;
  saveOpenClawWebSearchConfig(
    id: string,
    input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configPath'>,
  ): Promise<void>;
  saveOpenClawAuthCooldownsConfig(
    id: string,
    input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configPath'>,
  ): Promise<void>;
  setOpenClawChannelEnabled(id: string, channelId: string, enabled: boolean): Promise<void>;
}

class InstanceService implements IInstanceService {
  private readonly dependencies: InstanceServiceDependencies;

  constructor(dependencies: InstanceServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async resolveManagedOpenClawConfig(
    id: string,
    detail?: StudioInstanceDetailRecord | null,
  ) {
    const resolvedDetail =
      detail === undefined
        ? await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null)
        : detail;
    if (
      !resolvedDetail ||
      resolvedDetail.instance.runtimeKind !== 'openclaw' ||
      !resolvedDetail.lifecycle.configWritable
    ) {
      return null;
    }

    const configPath = openClawConfigService.resolveInstanceConfigPath(resolvedDetail);
    if (!configPath) {
      return null;
    }

    return {
      detail: resolvedDetail,
      configPath,
    };
  }

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
    const created = await this.dependencies.studioApi.createInstance(mapCreateInput(data));
    return mapStudioInstance(created);
  }

  async update(id: string, data: UpdateInstanceDTO): Promise<Instance> {
    const updated = await this.dependencies.studioApi.updateInstance(id, mapUpdateInput(data));
    return mapStudioInstance(updated);
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteInstance(id);
    return true;
  }

  async getInstances(): Promise<Instance[]> {
    const instances = await this.dependencies.studioApi.listInstances();
    return instances.map((instance) => mapStudioInstance(instance));
  }

  async getInstanceById(id: string): Promise<Instance | undefined> {
    const instance = await this.dependencies.studioApi.getInstance(id);
    return instance ? mapStudioInstance(instance) : undefined;
  }

  async startInstance(id: string): Promise<void> {
    const updated = await this.dependencies.studioApi.startInstance(id);
    if (!updated) {
      throw new Error('Failed to start instance');
    }
  }

  async stopInstance(id: string): Promise<void> {
    const updated = await this.dependencies.studioApi.stopInstance(id);
    if (!updated) {
      throw new Error('Failed to stop instance');
    }
  }

  async restartInstance(id: string): Promise<void> {
    const updated = await this.dependencies.studioApi.restartInstance(id);
    if (!updated) {
      throw new Error('Failed to restart instance');
    }
  }

  async getInstanceConfig(id: string): Promise<InstanceConfig | undefined> {
    const config = await this.dependencies.studioApi.getInstanceConfig(id);
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
    const current = await this.dependencies.studioApi.getInstanceConfig(id);
    const updated = await this.dependencies.studioApi.updateInstanceConfig(id, {
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
    const config = await this.dependencies.studioApi.getInstanceConfig(id);
    return config?.authToken || undefined;
  }

  async deleteInstance(id: string): Promise<void> {
    const deleted = await this.dependencies.studioApi.deleteInstance(id);
    if (!deleted) {
      throw new Error('Failed to delete instance');
    }
  }

  async getInstanceLogs(id: string): Promise<string> {
    return this.dependencies.studioApi.getInstanceLogs(id);
  }

  async getInstanceFileContent(id: string, fileId: string): Promise<string> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);

    const workbenchFile = detail?.workbench?.files.find((file) => file.id === fileId);
    if (workbenchFile && (!isOpenClawDetail(detail) || isBuiltInManagedOpenClawDetail(detail))) {
      return workbenchFile.content;
    }

    if (isOpenClawDetail(detail)) {
      const target = parseOpenClawAgentFileId(fileId);
      if (!target) {
        return workbenchFile?.content || '';
      }

      const fetched = await this.dependencies.openClawGatewayClient.getAgentFile(id, {
        agentId: target.agentId,
        name: target.name,
      });
      return typeof fetched.file?.content === 'string' ? fetched.file.content : '';
    }

    if (detail) {
      return workbenchFile?.content || '';
    }

    throw new Error('The selected file is not available because instance detail is unavailable.');
  }

  async updateInstanceFileContent(id: string, fileId: string, content: string): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);

    if (shouldUseStudioBridgeForFileContent(detail, fileId)) {
      const updated = await this.dependencies.studioApi.updateInstanceFileContent(id, fileId, content);
      if (!updated) {
        throw new Error('Failed to update instance file');
      }
      return;
    }

    if (isOpenClawDetail(detail)) {
      const target = parseOpenClawAgentFileId(fileId);
      if (!target) {
        throw new Error('The selected OpenClaw file is not writable through the gateway.');
      }

      await this.dependencies.openClawGatewayClient.setAgentFile(id, {
        agentId: target.agentId,
        name: target.name,
        content,
      });
      return;
    }

    if (detail) {
      throw new Error('The selected file is not writable through the studio backend.');
    }

    throw new Error('The selected file is not writable because instance detail is unavailable.');
  }

  async updateInstanceLlmProviderConfig(
    id: string,
    providerId: string,
    update: InstanceLLMProviderUpdate,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);

    if (isProviderCenterManagedOpenClawDetail(detail)) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    if (shouldUseStudioBridgeForProviderConfig(detail, providerId)) {
      const updated = await this.dependencies.studioApi.updateInstanceLlmProviderConfig(
        id,
        providerId,
        update,
      );
      if (!updated) {
        throw new Error('Failed to update LLM provider config');
      }
      return;
    }

    const managedConfig = await this.resolveManagedOpenClawConfig(id, detail);
    if (managedConfig) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    if (isOpenClawDetail(detail)) {
      const snapshot = await this.dependencies.openClawGatewayClient.getConfig(id);
      const providerConfig =
        getObjectValue(snapshot.config, ['models', 'providers', providerId]) || {};
      const existingModels = getArrayValue(providerConfig, ['models']) || [];
      const patch = buildRemoteOpenClawProviderConfigPatch(
        providerId,
        update,
        existingModels,
      );

      const result = await this.dependencies.openClawGatewayClient.patchConfig(id, {
        raw: JSON.stringify(patch, null, 2),
        baseHash: snapshot.baseHash,
      });
      if (result.ok === false) {
        throw new Error('Failed to update LLM provider config');
      }
      return;
    }

    if (detail) {
      throw new Error('The selected provider is not writable through the studio backend.');
    }

    throw new Error(
      'The selected provider is not writable because instance detail is unavailable.',
    );
  }

  async createInstanceLlmProvider(
    id: string,
    provider: OpenClawProviderInput,
    selection: OpenClawModelSelection,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterManagedOpenClawDetail(detail)) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    const managedConfig = await this.resolveManagedOpenClawConfig(id, detail);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void provider;
    void selection;
    throw createManagedOpenClawProviderControlPlaneError();
  }

  async deleteInstanceLlmProvider(id: string, providerId: string): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterManagedOpenClawDetail(detail)) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    const managedConfig = await this.resolveManagedOpenClawConfig(id, detail);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    throw createManagedOpenClawProviderControlPlaneError();
  }

  async createInstanceLlmProviderModel(
    id: string,
    providerId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterManagedOpenClawDetail(detail)) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    const managedConfig = await this.resolveManagedOpenClawConfig(id, detail);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    void model;
    throw createManagedOpenClawProviderControlPlaneError();
  }

  async updateInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterManagedOpenClawDetail(detail)) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    const managedConfig = await this.resolveManagedOpenClawConfig(id, detail);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    void modelId;
    void model;
    throw createManagedOpenClawProviderControlPlaneError();
  }

  async deleteInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterManagedOpenClawDetail(detail)) {
      throw createManagedOpenClawProviderControlPlaneError();
    }

    const managedConfig = await this.resolveManagedOpenClawConfig(id, detail);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    void modelId;
    throw createManagedOpenClawProviderControlPlaneError();
  }

  async createOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.saveAgent({
      configPath: managedConfig.configPath,
      agent,
    });
  }

  async updateOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.saveAgent({
      configPath: managedConfig.configPath,
      agent,
    });
  }

  async deleteOpenClawAgent(id: string, agentId: string): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.deleteAgent({
      configPath: managedConfig.configPath,
      agentId,
    });
  }

  async saveOpenClawChannelConfig(
    id: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.saveChannelConfiguration({
      configPath: managedConfig.configPath,
      channelId,
      values,
      enabled: true,
    });
  }

  async saveOpenClawWebSearchConfig(
    id: string,
    input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configPath'>,
  ): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.saveWebSearchConfiguration({
      configPath: managedConfig.configPath,
      ...input,
    });
  }

  async saveOpenClawAuthCooldownsConfig(
    id: string,
    input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configPath'>,
  ): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.saveAuthCooldownsConfiguration({
      configPath: managedConfig.configPath,
      ...input,
    });
  }

  async setOpenClawChannelEnabled(
    id: string,
    channelId: string,
    enabled: boolean,
  ): Promise<void> {
    const managedConfig = await this.resolveManagedOpenClawConfig(id);
    if (!managedConfig) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.setChannelEnabled({
      configPath: managedConfig.configPath,
      channelId,
      enabled,
    });
  }
}

export function createInstanceService(
  overrides: InstanceServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new InstanceService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
  });
}

export { buildOpenClawAgentFileId };

export const instanceService = createInstanceService();
