import type {
  ProviderChannel,
  ProxyProvider,
  ProxyProviderModel,
  Skill,
  SkillPack,
} from '@sdkwork/claw-types';
import type {
  OpenClawConfigSnapshot,
  OpenClawModelSelection,
  SaveOpenClawChannelConfigurationInput,
  ProviderRoutingDraft,
  ProviderRoutingRecord,
} from '@sdkwork/claw-core';
import {
  inferLocalAiProxyClientProtocol,
  inferLocalAiProxyUpstreamProtocol,
  listKnownProviderRoutingChannels,
} from '@sdkwork/claw-core';
import type { HubInstallAssessmentResult, HubInstallResult } from '@sdkwork/claw-infrastructure';
import type {
  ApplyOpenClawConfigurationInput,
  ApplyOpenClawConfigurationResult,
  OpenClawBootstrapData,
} from './openClawBootstrapService.ts';
import { openClawBootstrapService } from './openClawBootstrapService.ts';

export interface InstallBootstrapInstance {
  id: string;
  name: string;
  status?: string;
  runtimeKind?: string;
}

export interface InstallCommunicationChannelField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  value?: string;
  helpText?: string;
}

export interface InstallCommunicationChannel {
  id: string;
  instanceId: string | null;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode?: 'required' | 'none';
  fields: InstallCommunicationChannelField[];
  setupGuide: string[];
}

export interface InstallBootstrapData {
  selectedInstanceId: string;
  instances: InstallBootstrapInstance[];
  providerChannels: ProviderChannel[];
  providers: ProxyProvider[];
  communicationChannels: InstallCommunicationChannel[];
  packs: SkillPack[];
  skills: Skill[];
}

export interface InstallProviderDraft {
  providerId?: string;
  channelId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  models?: ProxyProviderModel[];
}

export interface InstallCommunicationChannelInput {
  channelId: string;
  values: Record<string, string>;
}

export interface ApplyInstallConfigurationInput {
  instanceId: string;
  provider: InstallProviderDraft;
  communicationChannels: InstallCommunicationChannelInput[];
}

export interface ApplyInstallConfigurationResult {
  instanceId: string;
  providerId: string;
  instanceProviderId: string;
  configuredChannelIds: string[];
}

export interface InitializeInstallInstanceInput {
  instanceId: string;
  packIds: string[];
  skillIds: string[];
}

export interface InitializeInstallInstanceResult {
  instanceId: string;
  installedPackIds: string[];
  installedSkillIds: string[];
}

interface OpenClawChannelFieldLike {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
}

interface OpenClawChannelSnapshotLike {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode?: 'required' | 'none';
  setupSteps: string[];
  values: Record<string, string>;
  fields: OpenClawChannelFieldLike[];
}

interface OpenClawProviderSnapshotLike {
  id: string;
  providerKey: string;
  provider: string;
  name: string;
  endpoint: string;
  apiKeySource: string;
  status: 'ready' | 'degraded' | 'configurationRequired';
  description: string;
  models: Array<{
    id: string;
    name: string;
    role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
    contextWindow: string;
  }>;
}

interface InstallBootstrapServiceDependencies {
  studioApi: {
    listInstances(): Promise<InstallBootstrapInstance[]>;
  };
  openClawBootstrapApi: {
    loadBootstrapData(input?: {
      installResult?: HubInstallResult | null;
      assessment?: HubInstallAssessmentResult | null;
    }): Promise<OpenClawBootstrapData>;
    applyConfiguration(
      input: ApplyOpenClawConfigurationInput,
    ): Promise<ApplyOpenClawConfigurationResult>;
    initializeOpenClawInstance(
      input: InitializeInstallInstanceInput,
    ): Promise<InitializeInstallInstanceResult>;
  };
  providerRoutingApi: {
    saveProviderRoutingRecord(
      input: ProviderRoutingDraft & { id?: string },
    ): Promise<ProviderRoutingRecord>;
  };
  openClawConfigApi: {
    readConfigSnapshot(configPath: string): Promise<Pick<OpenClawConfigSnapshot, 'providerSnapshots' | 'channelSnapshots'>>;
    saveChannelConfiguration?(input: SaveOpenClawChannelConfigurationInput): Promise<unknown>;
    setChannelEnabled?(input: {
      configPath: string;
      channelId: string;
      enabled: boolean;
    }): Promise<unknown>;
  };
}

export interface InstallBootstrapServiceDependencyOverrides {
  studioApi?: Partial<InstallBootstrapServiceDependencies['studioApi']>;
  openClawBootstrapApi?: Partial<InstallBootstrapServiceDependencies['openClawBootstrapApi']>;
  providerRoutingApi?: Partial<InstallBootstrapServiceDependencies['providerRoutingApi']>;
  openClawConfigApi?: Partial<InstallBootstrapServiceDependencies['openClawConfigApi']>;
}

let defaultDependenciesPromise: Promise<InstallBootstrapServiceDependencies> | null = null;

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function isReasoningModel(model: ProxyProviderModel) {
  return /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(`${model.id} ${model.name}`);
}

function isEmbeddingModel(model: ProxyProviderModel) {
  return /(embed|embedding|bge|vector)/i.test(`${model.id} ${model.name}`);
}

function buildModelSelection(models: ProxyProviderModel[], modelId: string) {
  const defaultModelId = modelId.trim() || models[0]?.id || 'model-id';

  return {
    defaultModelId,
    reasoningModelId: models.find((model) => model.id !== defaultModelId && isReasoningModel(model))?.id,
    embeddingModelId: models.find((model) => model.id !== defaultModelId && isEmbeddingModel(model))?.id,
  };
}

function createDefaultProviderRuntimeConfig() {
  return {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: true,
  };
}

function normalizeProviderModels(input: InstallProviderDraft) {
  const models = input.models?.length
    ? input.models
    : [
        {
          id: input.modelId,
          name: input.modelId,
        },
      ];
  const seen = new Set<string>();

  return models.filter((model) => {
    const normalizedId = model.id.trim();
    if (!normalizedId || seen.has(normalizedId)) {
      return false;
    }

    seen.add(normalizedId);
    return true;
  });
}

function mapProviderSnapshot(snapshot: OpenClawProviderSnapshotLike): ProxyProvider {
  return {
    id: snapshot.id,
    channelId: snapshot.provider,
    name: snapshot.name,
    apiKey: snapshot.apiKeySource,
    groupId: 'openclaw-config',
    usage: {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: '30d',
    },
    expiresAt: null,
    status: snapshot.status === 'ready' ? 'active' : 'warning',
    createdAt: null,
    baseUrl: snapshot.endpoint,
    models: snapshot.models.map((model) => ({
      id: model.id,
      name: model.name,
    })),
    notes: snapshot.description,
    credentialReference: 'openclaw-config',
    canCopyApiKey: false,
  };
}

function mergeProviders(
  providers: ProxyProvider[],
  providerSnapshots: OpenClawProviderSnapshotLike[],
) {
  const merged = new Map<string, ProxyProvider>();

  providerSnapshots.forEach((snapshot) => {
    merged.set(snapshot.id, mapProviderSnapshot(snapshot));
  });

  providers.forEach((provider) => {
    if (!merged.has(provider.id)) {
      merged.set(provider.id, provider);
    }
  });

  return [...merged.values()];
}

function resolveInstallProviderChannelId(provider: ProxyProvider) {
  if (provider.managedBy === 'system-default' && provider.channelId === 'sdkwork') {
    switch (provider.clientProtocol) {
      case 'anthropic':
        return 'anthropic';
      case 'gemini':
        return 'google';
      case 'openai-compatible':
        return 'openai';
      default:
        return provider.channelId;
    }
  }

  return provider.channelId;
}

function normalizeInstallProviders(providers: ProxyProvider[]) {
  return providers.map((provider) => {
    const channelId = resolveInstallProviderChannelId(provider);
    return channelId === provider.channelId ? provider : { ...provider, channelId };
  });
}

function buildProviderChannels(providers: ProxyProvider[]): ProviderChannel[] {
  const providersByChannel = new Map<string, ProxyProvider[]>();

  providers.forEach((provider) => {
    const current = providersByChannel.get(provider.channelId) || [];
    current.push(provider);
    providersByChannel.set(provider.channelId, current);
  });

  const baseChannels = listKnownProviderRoutingChannels();
  const dynamicChannels = [...providersByChannel.keys()]
    .filter((channelId) => !baseChannels.some((channel) => channel.id === channelId))
    .sort((left, right) => left.localeCompare(right))
    .map((channelId) => ({
      id: channelId,
      name: channelId
        .split(/[-_]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' '),
      vendor: channelId,
      description: `${channelId} routes configured through the OpenClaw install wizard.`,
      modelFamily:
        providersByChannel.get(channelId)?.slice(0, 2).map((provider) => provider.models[0]?.name || provider.name).filter(Boolean).join(' / ') ||
        'Custom',
    }));

  return [...baseChannels, ...dynamicChannels].map((channel) => {
    const channelProviders = providersByChannel.get(channel.id) || [];

    return {
      ...channel,
      providerCount: channelProviders.length,
      activeProviderCount: channelProviders.filter((provider) => provider.status === 'active').length,
      warningProviderCount: channelProviders.filter(
        (provider) => provider.status === 'warning' || provider.status === 'expired',
      ).length,
      disabledProviderCount: channelProviders.filter((provider) => provider.status === 'disabled').length,
    } satisfies ProviderChannel;
  });
}

function mapChannelFieldType(field: OpenClawChannelFieldLike) {
  if (field.sensitive) {
    return 'password';
  }
  if (field.inputMode === 'url') {
    return 'url';
  }
  if (field.inputMode === 'numeric') {
    return 'number';
  }

  return 'text';
}

function mapChannelSnapshot(
  channel: OpenClawChannelSnapshotLike,
  instanceId: string,
): InstallCommunicationChannel {
  return {
    id: channel.id,
    instanceId,
    name: channel.name,
    description: channel.description,
    icon: channel.name.slice(0, 2).toUpperCase(),
    status: channel.status,
    enabled: channel.enabled,
    configurationMode: channel.configurationMode,
    fields: channel.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: mapChannelFieldType(field),
      placeholder: field.placeholder,
      value: channel.values[field.key] || '',
      helpText: field.helpText,
    })),
    setupGuide: [...channel.setupSteps],
  };
}

function slugifyProviderId(name: string, fallbackChannelId: string) {
  const normalized = (name || fallbackChannelId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `guided-${fallbackChannelId}`;
}

function deriveSavedProviderId(value: unknown, fallback: string) {
  const record = asObject(value);
  const id = asString(record.id)?.trim();
  if (id) {
    return id;
  }

  const providerKey = asString(record.providerKey)?.trim();
  if (providerKey) {
    return providerKey.replace(/^provider[-_/]?/i, '') || fallback;
  }

  return fallback;
}

function pickSyncedInstance(
  instances: InstallBootstrapInstance[],
  syncedInstanceId: string,
  preferredInstanceId?: string,
) {
  if (preferredInstanceId && preferredInstanceId === syncedInstanceId) {
    const preferred = instances.find((instance) => instance.id === preferredInstanceId);
    if (preferred) {
      return preferred;
    }
  }

  return instances.find((instance) => instance.id === syncedInstanceId) || null;
}

async function loadDefaultDependencies(): Promise<InstallBootstrapServiceDependencies> {
  if (!defaultDependenciesPromise) {
    defaultDependenciesPromise = Promise.all([
      import('@sdkwork/claw-core'),
      import('@sdkwork/claw-infrastructure'),
    ]).then(([coreModule, infrastructureModule]) => ({
      studioApi: {
        listInstances: () => infrastructureModule.studio.listInstances(),
      },
      openClawBootstrapApi: {
        loadBootstrapData: (input = {}) => openClawBootstrapService.loadBootstrapData(input),
        applyConfiguration: (input) => openClawBootstrapService.applyConfiguration(input),
        initializeOpenClawInstance: (input) =>
          openClawBootstrapService.initializeOpenClawInstance(input),
      },
      providerRoutingApi: {
        saveProviderRoutingRecord: (input) =>
          coreModule.providerRoutingCatalogService.saveProviderRoutingRecord(input),
      },
      openClawConfigApi: {
        readConfigSnapshot: (configPath) => coreModule.openClawConfigService.readConfigSnapshot(configPath),
        saveChannelConfiguration: (input) =>
          coreModule.openClawConfigService.saveChannelConfiguration(input),
        setChannelEnabled: (input) => coreModule.openClawConfigService.setChannelEnabled(input),
      },
    }));
  }

  return defaultDependenciesPromise;
}

async function resolveDependencies(
  overrides: InstallBootstrapServiceDependencyOverrides,
): Promise<InstallBootstrapServiceDependencies> {
  if (
    overrides.studioApi?.listInstances &&
    overrides.openClawBootstrapApi?.loadBootstrapData &&
    overrides.openClawBootstrapApi?.applyConfiguration &&
    overrides.openClawBootstrapApi?.initializeOpenClawInstance &&
    overrides.providerRoutingApi?.saveProviderRoutingRecord &&
    overrides.openClawConfigApi?.readConfigSnapshot
  ) {
    return {
      studioApi: {
        listInstances: overrides.studioApi.listInstances,
      },
      openClawBootstrapApi: {
        loadBootstrapData: overrides.openClawBootstrapApi.loadBootstrapData,
        applyConfiguration: overrides.openClawBootstrapApi.applyConfiguration,
        initializeOpenClawInstance: overrides.openClawBootstrapApi.initializeOpenClawInstance,
      },
      providerRoutingApi: {
        saveProviderRoutingRecord: overrides.providerRoutingApi.saveProviderRoutingRecord,
      },
      openClawConfigApi: {
        readConfigSnapshot: overrides.openClawConfigApi.readConfigSnapshot,
        saveChannelConfiguration: overrides.openClawConfigApi.saveChannelConfiguration,
        setChannelEnabled: overrides.openClawConfigApi.setChannelEnabled,
      },
    };
  }

  const defaults = await loadDefaultDependencies();

  return {
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawBootstrapApi: {
      ...defaults.openClawBootstrapApi,
      ...(overrides.openClawBootstrapApi || {}),
    },
    providerRoutingApi: {
      ...defaults.providerRoutingApi,
      ...(overrides.providerRoutingApi || {}),
    },
    openClawConfigApi: {
      ...defaults.openClawConfigApi,
      ...(overrides.openClawConfigApi || {}),
    },
  };
}

class InstallBootstrapService {
  private readonly dependencyOverrides: InstallBootstrapServiceDependencyOverrides;

  constructor(dependencyOverrides: InstallBootstrapServiceDependencyOverrides) {
    this.dependencyOverrides = dependencyOverrides;
  }

  private async getDependencies() {
    return resolveDependencies(this.dependencyOverrides);
  }

  async loadBootstrapData(preferredInstanceId?: string): Promise<InstallBootstrapData> {
    const dependencies = await this.getDependencies();
    const bootstrap = await dependencies.openClawBootstrapApi.loadBootstrapData({});
    const [instances, configSnapshot] = await Promise.all([
      dependencies.studioApi.listInstances(),
      dependencies.openClawConfigApi.readConfigSnapshot(bootstrap.configPath),
    ]);

    const selectedInstance = pickSyncedInstance(
      instances,
      bootstrap.syncedInstanceId,
      preferredInstanceId,
    );
    if (!selectedInstance) {
      throw new Error('No synced OpenClaw instance is available for guided configuration.');
    }

    const mergedProviders = normalizeInstallProviders(bootstrap.providers);
    const providerChannels = buildProviderChannels(mergedProviders);
    const channelSnapshots = bootstrap.channels.length
      ? bootstrap.channels
      : configSnapshot.channelSnapshots || [];

    return {
      selectedInstanceId: selectedInstance.id,
      instances: [selectedInstance],
      providerChannels,
      providers: mergedProviders,
      communicationChannels: channelSnapshots.map((channel) =>
        mapChannelSnapshot(channel, selectedInstance.id),
      ),
      packs: bootstrap.packs,
      skills: bootstrap.skills,
    };
  }

  async loadCommunicationChannels(instanceId: string) {
    const data = await this.loadBootstrapData(instanceId);
    return data.communicationChannels;
  }

  async applyConfiguration(
    input: ApplyInstallConfigurationInput,
  ): Promise<ApplyInstallConfigurationResult> {
    const dependencies = await this.getDependencies();
    const bootstrap = await dependencies.openClawBootstrapApi.loadBootstrapData({});
    const selectedChannelIds = input.communicationChannels.map((channel) => channel.channelId);
    const disabledChannelIds = bootstrap.channels
      .map((channel) => channel.id)
      .filter((channelId) => !selectedChannelIds.includes(channelId));
    const normalizedModels = normalizeProviderModels(input.provider);
    const modelSelection = buildModelSelection(normalizedModels, input.provider.modelId);

    if (input.provider.providerId) {
      const result = asObject(
        await dependencies.openClawBootstrapApi.applyConfiguration({
          configPath: bootstrap.configPath,
          syncedInstanceId: bootstrap.syncedInstanceId,
          providerId: input.provider.providerId,
          modelSelection,
          channels: input.communicationChannels.map((channel) => ({
            channelId: channel.channelId,
            values: channel.values,
          })),
          disabledChannelIds,
        }),
      );
      const configuredChannelIds = readStringArray(result.configuredChannelIds);
      const providerId = asString(result.providerId)?.trim() || input.provider.providerId;

      return {
        instanceId: bootstrap.syncedInstanceId,
        providerId,
        instanceProviderId: providerId,
        configuredChannelIds:
          configuredChannelIds.length > 0 ? configuredChannelIds : selectedChannelIds,
      };
    }

    const providerId = slugifyProviderId(input.provider.name, input.provider.channelId);
    const providerName = input.provider.name.trim() || providerId;
    const clientProtocol = inferLocalAiProxyClientProtocol(input.provider.channelId);
    const upstreamProtocol = inferLocalAiProxyUpstreamProtocol(input.provider.channelId);
    const savedProvider = await dependencies.providerRoutingApi.saveProviderRoutingRecord({
      name: providerName,
      providerId: input.provider.channelId,
      clientProtocol,
      upstreamProtocol,
      upstreamBaseUrl: input.provider.baseUrl,
      apiKey: input.provider.apiKey,
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      defaultModelId: modelSelection.defaultModelId,
      reasoningModelId: modelSelection.reasoningModelId,
      embeddingModelId: modelSelection.embeddingModelId,
      models: normalizedModels,
      exposeTo: ['openclaw'],
      config: createDefaultProviderRuntimeConfig(),
    });
    const savedProviderId = deriveSavedProviderId(savedProvider, providerId);
    const result = await dependencies.openClawBootstrapApi.applyConfiguration({
      configPath: bootstrap.configPath,
      syncedInstanceId: bootstrap.syncedInstanceId,
      providerId: savedProviderId,
      modelSelection,
      channels: input.communicationChannels.map((channel) => ({
        channelId: channel.channelId,
        values: channel.values,
      })),
      disabledChannelIds,
    });

    return {
      instanceId: result.syncedInstanceId,
      providerId: result.providerId,
      instanceProviderId: result.providerId,
      configuredChannelIds:
        result.configuredChannelIds.length > 0 ? result.configuredChannelIds : selectedChannelIds,
    };
  }

  async initializeInstance(
    input: InitializeInstallInstanceInput,
  ): Promise<InitializeInstallInstanceResult> {
    const dependencies = await this.getDependencies();
    return dependencies.openClawBootstrapApi.initializeOpenClawInstance(input);
  }
}

export function createInstallBootstrapService(
  overrides: InstallBootstrapServiceDependencyOverrides = {},
) {
  return new InstallBootstrapService(overrides);
}

export const installBootstrapService = createInstallBootstrapService();
