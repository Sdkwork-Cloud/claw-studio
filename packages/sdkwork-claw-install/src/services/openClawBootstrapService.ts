import {
  studioMockService,
  type MockChannel,
  type MockInstance,
  type MockInstanceLLMProviderCreate,
} from '@sdkwork/claw-infrastructure';
import type { ProxyProvider, Skill, SkillPack } from '@sdkwork/claw-types';
import {
  buildOpenClawModelSelection,
  filterOpenClawCompatibleProviders,
  type OpenClawModelSelection,
} from './openClawInstallWizardService.ts';

export interface OpenClawBootstrapData {
  selectedInstanceId: string;
  instances: MockInstance[];
  providers: ProxyProvider[];
  channels: MockChannel[];
  packs: SkillPack[];
  skills: Skill[];
}

export interface OpenClawChannelConfigurationInput {
  channelId: string;
  values: Record<string, string>;
}

export interface ApplyOpenClawConfigurationInput {
  instanceId: string;
  providerId: string;
  modelSelection: OpenClawModelSelection;
  channels: OpenClawChannelConfigurationInput[];
}

export interface ApplyOpenClawConfigurationResult {
  instanceId: string;
  providerId: string;
  configuredChannelIds: string[];
}

export interface InitializeOpenClawInstanceInput {
  instanceId: string;
  packIds: string[];
  skillIds: string[];
}

export interface InitializeOpenClawInstanceResult {
  instanceId: string;
  installedPackIds: string[];
  installedSkillIds: string[];
}

export interface OpenClawVerificationSnapshot {
  instanceId: string;
  installSucceeded: boolean;
  hasReadyProvider: boolean;
  selectedChannelCount: number;
  configuredChannelCount: number;
  selectedSkillCount: number;
  initializedSkillCount: number;
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

function inferProviderRole(
  modelId: string,
  selection: OpenClawModelSelection,
): MockInstanceLLMProviderCreate['models'][number]['role'] {
  if (modelId === selection.defaultModelId) {
    return 'primary';
  }

  if (selection.embeddingModelId && modelId === selection.embeddingModelId) {
    return 'embedding';
  }

  if (selection.reasoningModelId && modelId === selection.reasoningModelId) {
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

function getProviderIcon(channelId: string) {
  const iconMap: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AT',
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

function buildInstanceProviderCreate(
  provider: ProxyProvider,
  instanceId: string,
  selection: OpenClawModelSelection,
): MockInstanceLLMProviderCreate {
  return {
    id: `provider-api-router-${provider.id}`,
    name: provider.name,
    provider: 'api-router',
    endpoint: provider.baseUrl,
    apiKeySource: provider.apiKey,
    status: 'ready',
    defaultModelId: selection.defaultModelId,
    reasoningModelId: selection.reasoningModelId,
    embeddingModelId: selection.embeddingModelId,
    description: `Managed from guided install using ${provider.name}.`,
    icon: getProviderIcon(provider.channelId),
    lastCheckedAt: 'just now',
    capabilities: ['Guided Install', 'API Router', 'OpenClaw'],
    models: provider.models.map((model) => {
      const role = inferProviderRole(model.id, selection);

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
  const allPacks = await studioMockService.listPacks();
  const allSkills = await studioMockService.listSkills();
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

class OpenClawBootstrapService {
  async loadBootstrapData(preferredInstanceId?: string): Promise<OpenClawBootstrapData> {
    const [instances, allProviders, packs, skills] = await Promise.all([
      studioMockService.listInstances(),
      studioMockService.listProxyProviders(),
      studioMockService.listPacks(),
      studioMockService.listSkills(),
    ]);
    const selectedInstance = pickDefaultInstance(instances, preferredInstanceId);

    if (!selectedInstance) {
      throw new Error('No OpenClaw instance is available for configuration.');
    }

    const channels = await studioMockService.listChannels(selectedInstance.id);

    return {
      selectedInstanceId: selectedInstance.id,
      instances,
      providers: filterOpenClawCompatibleProviders(allProviders),
      channels,
      packs,
      skills,
    };
  }

  async applyConfiguration(
    input: ApplyOpenClawConfigurationInput,
  ): Promise<ApplyOpenClawConfigurationResult> {
    const providers = await studioMockService.listProxyProviders();
    const provider = providers.find((item) => item.id === input.providerId);

    if (!provider) {
      throw new Error('Selected provider was not found.');
    }

    await studioMockService.upsertInstanceLlmProvider(
      input.instanceId,
      buildInstanceProviderCreate(provider, input.instanceId, input.modelSelection),
    );

    for (const channel of input.channels) {
      await studioMockService.saveChannelConfig(channel.channelId, channel.values);
    }

    return {
      instanceId: input.instanceId,
      providerId: provider.id,
      configuredChannelIds: input.channels.map((channel) => channel.channelId),
    };
  }

  async initializeOpenClawInstance(
    input: InitializeOpenClawInstanceInput,
  ): Promise<InitializeOpenClawInstanceResult> {
    const installedSkillIds = new Set<string>();

    for (const packId of input.packIds) {
      await studioMockService.installPack(input.instanceId, packId);
      const packs = await studioMockService.listPacks();
      const pack = packs.find((item) => item.id === packId);
      pack?.skills.forEach((skill) => installedSkillIds.add(skill.id));
    }

    for (const skillId of input.skillIds) {
      if (!installedSkillIds.has(skillId)) {
        await studioMockService.installSkill(input.instanceId, skillId);
        installedSkillIds.add(skillId);
      }
    }

    return {
      instanceId: input.instanceId,
      installedPackIds: [...input.packIds],
      installedSkillIds: [...installedSkillIds],
    };
  }

  async loadVerificationSnapshot(input: {
    instanceId: string;
    selectedChannelIds: string[];
    packIds: string[];
    skillIds: string[];
  }): Promise<OpenClawVerificationSnapshot> {
    const [providers, channels, installedSkills] = await Promise.all([
      studioMockService.listInstanceLlmProviders(input.instanceId),
      studioMockService.listChannels(input.instanceId),
      studioMockService.listInstalledSkills(input.instanceId),
    ]);

    const selectedSkillIds = await resolveSelectedSkillIds(input.packIds, input.skillIds);
    const installedSkillIdSet = new Set(installedSkills.map((skill) => skill.id));

    return {
      instanceId: input.instanceId,
      installSucceeded: true,
      hasReadyProvider: providers.some((provider) => provider.status === 'ready'),
      selectedChannelCount: input.selectedChannelIds.length,
      configuredChannelCount: channels.filter(
        (channel) =>
          input.selectedChannelIds.includes(channel.id) &&
          channel.status === 'connected' &&
          channel.enabled,
      ).length,
      selectedSkillCount: selectedSkillIds.length,
      initializedSkillCount: selectedSkillIds.filter((skillId) => installedSkillIdSet.has(skillId))
        .length,
    };
  }

  buildDefaultModelSelection(provider: ProxyProvider) {
    return buildOpenClawModelSelection(provider);
  }
}

export const openClawBootstrapService = new OpenClawBootstrapService();
