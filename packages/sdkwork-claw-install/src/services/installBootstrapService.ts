import {
  studioMockService,
  type MockChannel,
  type MockInstance,
  type MockInstanceLLMProviderCreate,
} from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterChannel,
  ProxyProvider,
  ProxyProviderModel,
  Skill,
  SkillPack,
} from '@sdkwork/claw-types';

export interface InstallBootstrapData {
  selectedInstanceId: string;
  instances: MockInstance[];
  apiRouterChannels: ApiRouterChannel[];
  providers: ProxyProvider[];
  communicationChannels: MockChannel[];
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

function pickDefaultInstance(instances: MockInstance[], preferredInstanceId?: string) {
  const preferredInstance = preferredInstanceId
    ? instances.find((instance) => instance.id === preferredInstanceId)
    : null;

  if (preferredInstance) {
    return preferredInstance;
  }

  return instances.find((instance) => instance.status === 'online') || instances[0] || null;
}

function getProviderIcon(channelId: string) {
  const iconMap: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AT',
    google: 'GG',
    xai: 'XI',
    deepseek: 'DS',
    qwen: 'QW',
    zhipu: 'ZP',
    baidu: 'BD',
    'tencent-hunyuan': 'TH',
    doubao: 'DB',
    moonshot: 'KI',
    minimax: 'MM',
    stepfun: 'SF',
    'iflytek-spark': 'IF',
  };

  return iconMap[channelId] || 'AR';
}

function isReasoningModel(model: ProxyProviderModel) {
  return /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(
    `${model.id} ${model.name}`,
  );
}

function isEmbeddingModel(model: ProxyProviderModel) {
  return /(embed|embedding|bge|vector)/i.test(`${model.id} ${model.name}`);
}

function inferProviderRole(
  modelId: string,
  selectedModelId: string,
  models: ProxyProviderModel[],
): MockInstanceLLMProviderCreate['models'][number]['role'] {
  if (modelId === selectedModelId) {
    return 'primary';
  }

  const model = models.find((item) => item.id === modelId);
  if (model && isEmbeddingModel(model)) {
    return 'embedding';
  }

  if (model && isReasoningModel(model)) {
    return 'reasoning';
  }

  return 'fallback';
}

function inferContextWindow(role: MockInstanceLLMProviderCreate['models'][number]['role']) {
  if (role === 'embedding') {
    return '8K';
  }

  if (role === 'reasoning') {
    return '200K';
  }

  return '128K';
}

function normalizeModels(input: InstallProviderDraft, existingProvider?: ProxyProvider) {
  const models = input.models?.length
    ? input.models
    : existingProvider?.models?.length
      ? existingProvider.models
      : [
          {
            id: input.modelId,
            name: input.modelId,
          },
        ];

  const seen = new Set<string>();
  const normalized = models.filter((model) => {
    if (!model.id || seen.has(model.id)) {
      return false;
    }

    seen.add(model.id);
    return true;
  });

  if (!seen.has(input.modelId)) {
    normalized.unshift({
      id: input.modelId,
      name: input.modelId,
    });
  }

  return normalized;
}

function buildInstanceProviderCreate(
  provider: ProxyProvider,
  selectedModelId: string,
): MockInstanceLLMProviderCreate {
  const instanceProviderId = `provider-api-router-${provider.id}`;

  return {
    id: instanceProviderId,
    name: provider.name,
    provider: 'api-router',
    endpoint: provider.baseUrl,
    apiKeySource: provider.apiKey,
    status: 'ready',
    defaultModelId: selectedModelId,
    reasoningModelId: provider.models.find(isReasoningModel)?.id,
    embeddingModelId: provider.models.find(isEmbeddingModel)?.id,
    description: `Managed from guided install using ${provider.name}.`,
    icon: getProviderIcon(provider.channelId),
    lastCheckedAt: 'just now',
    capabilities: ['Guided Install', 'API Router'],
    models: provider.models.map((model) => {
      const role = inferProviderRole(model.id, selectedModelId, provider.models);

      return {
        id: model.id,
        name: model.name,
        role,
        contextWindow: inferContextWindow(role),
      };
    }),
    config: {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    },
  };
}

async function resolveSelectedSkillIds(packIds: string[], skillIds: string[]) {
  const [allPacks, allSkills] = await Promise.all([
    studioMockService.listPacks(),
    studioMockService.listSkills(),
  ]);
  const selectedIds = new Set<string>();

  for (const packId of packIds) {
    const pack = allPacks.find((item) => item.id === packId);
    pack?.skills.forEach((skill) => selectedIds.add(skill.id));
  }

  const validSkillIds = new Set(allSkills.map((skill) => skill.id));
  for (const skillId of skillIds) {
    if (validSkillIds.has(skillId)) {
      selectedIds.add(skillId);
    }
  }

  return [...selectedIds];
}

class InstallBootstrapService {
  async loadBootstrapData(preferredInstanceId?: string): Promise<InstallBootstrapData> {
    const [instances, apiRouterChannels, providers, packs, skills] = await Promise.all([
      studioMockService.listInstances(),
      studioMockService.listApiRouterChannels(),
      studioMockService.listProxyProviders(),
      studioMockService.listPacks(),
      studioMockService.listSkills(),
    ]);

    const selectedInstance = pickDefaultInstance(instances, preferredInstanceId);
    if (!selectedInstance) {
      throw new Error('No instance is available for guided configuration.');
    }

    const communicationChannels = await studioMockService.listChannels(selectedInstance.id);

    return {
      selectedInstanceId: selectedInstance.id,
      instances,
      apiRouterChannels,
      providers,
      communicationChannels,
      packs,
      skills,
    };
  }

  async loadCommunicationChannels(instanceId: string) {
    return studioMockService.listChannels(instanceId);
  }

  async applyConfiguration(
    input: ApplyInstallConfigurationInput,
  ): Promise<ApplyInstallConfigurationResult> {
    const existingProvider = input.provider.providerId
      ? (await studioMockService.listProxyProviders()).find(
          (provider) => provider.id === input.provider.providerId,
        )
      : undefined;
    const models = normalizeModels(input.provider, existingProvider);
    const providerName = input.provider.name.trim() || `Guided ${input.provider.channelId}`;

    const provider = input.provider.providerId
      ? await studioMockService.updateProxyProvider(input.provider.providerId, {
          name: providerName,
          apiKey: input.provider.apiKey,
          baseUrl: input.provider.baseUrl,
          models,
        })
      : await studioMockService.createProxyProvider({
          channelId: input.provider.channelId,
          name: providerName,
          apiKey: input.provider.apiKey,
          groupId: existingProvider?.groupId || 'guided-install',
          baseUrl: input.provider.baseUrl,
          models,
          expiresAt: existingProvider?.expiresAt ?? null,
          notes: 'Created from the guided install wizard.',
        });

    if (!provider) {
      throw new Error('Selected provider could not be updated.');
    }

    const instanceProvider = buildInstanceProviderCreate(provider, input.provider.modelId);
    await studioMockService.upsertInstanceLlmProvider(input.instanceId, instanceProvider);

    for (const channel of input.communicationChannels) {
      await studioMockService.saveChannelConfig(channel.channelId, channel.values);
      await studioMockService.updateChannelStatus(channel.channelId, true);
    }

    return {
      instanceId: input.instanceId,
      providerId: provider.id,
      instanceProviderId: instanceProvider.id,
      configuredChannelIds: input.communicationChannels.map((channel) => channel.channelId),
    };
  }

  async initializeInstance(
    input: InitializeInstallInstanceInput,
  ): Promise<InitializeInstallInstanceResult> {
    const installedSkillIds = new Set<string>();

    for (const packId of input.packIds) {
      await studioMockService.installPack(input.instanceId, packId);
    }

    const selectedSkillIds = await resolveSelectedSkillIds(input.packIds, input.skillIds);
    for (const skillId of selectedSkillIds) {
      await studioMockService.installSkill(input.instanceId, skillId);
      installedSkillIds.add(skillId);
    }

    return {
      instanceId: input.instanceId,
      installedPackIds: [...input.packIds],
      installedSkillIds: [...installedSkillIds],
    };
  }
}

export const installBootstrapService = new InstallBootstrapService();
