import { studio } from '@sdkwork/claw-infrastructure';
import type { Agent, KernelChatAgentProfile, StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { resolveAuthoritativeInstanceKernelChatAdapter } from './authoritativeKernelChatAdapter.ts';
import { openClawChatAgentCatalogService } from './openClawChatAgentCatalogService.ts';

export interface KernelChatAgentCatalogDependencies {
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  resolveAdapterResolution: (
    instanceId: string,
  ) => Promise<
    Awaited<ReturnType<typeof resolveAuthoritativeInstanceKernelChatAdapter>>
  >;
  getOpenClawCatalog: (
    instanceId: string,
  ) => Promise<Awaited<ReturnType<typeof openClawChatAgentCatalogService.getCatalog>>>;
}

export interface KernelChatAgentCatalogDependencyOverrides {
  getInstanceDetail?: KernelChatAgentCatalogDependencies['getInstanceDetail'];
  resolveAdapterResolution?: KernelChatAgentCatalogDependencies['resolveAdapterResolution'];
  getOpenClawCatalog?: KernelChatAgentCatalogDependencies['getOpenClawCatalog'];
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toAgent(profile: KernelChatAgentProfile): Agent {
  const fallbackCreator = titleizeIdentifier(profile.kernelId) || 'Kernel';

  return {
    id: profile.agentId,
    name: profile.label,
    description: profile.description ?? '',
    avatar: profile.avatar ?? 'AI',
    systemPrompt: profile.systemPrompt ?? '',
    creator: profile.creator ?? fallbackCreator,
  };
}

function mapOpenClawProfile(input: {
  instanceId: string;
  agent: Awaited<ReturnType<typeof openClawChatAgentCatalogService.getCatalog>>['agents'][number];
}): KernelChatAgentProfile {
  return {
    kernelId: 'openclaw',
    instanceId: input.instanceId,
    agentId: input.agent.id,
    label: input.agent.name,
    description: normalizeOptionalString(input.agent.description),
    source: 'kernelCatalog',
    systemPrompt: normalizeOptionalString(input.agent.systemPrompt),
    avatar: normalizeOptionalString(input.agent.avatar),
    creator: normalizeOptionalString(input.agent.creator),
  };
}

function mapWorkbenchProfile(input: {
  detail: StudioInstanceDetailRecord;
  record: NonNullable<StudioInstanceDetailRecord['workbench']>['agents'][number];
}): KernelChatAgentProfile {
  return {
    kernelId: input.detail.instance.runtimeKind,
    instanceId: input.detail.instance.id,
    agentId: input.record.agent.id,
    label: input.record.agent.name,
    description: normalizeOptionalString(input.record.agent.description),
    source: 'workbenchProjection',
    systemPrompt: normalizeOptionalString(input.record.agent.systemPrompt),
    avatar: normalizeOptionalString(input.record.agent.avatar),
    creator: normalizeOptionalString(input.record.agent.creator),
  };
}

class DefaultKernelChatAgentCatalogService {
  private readonly dependencies: KernelChatAgentCatalogDependencies;

  constructor(dependencies: KernelChatAgentCatalogDependencies) {
    this.dependencies = dependencies;
  }

  async listAgentProfiles(instanceId?: string): Promise<KernelChatAgentProfile[]> {
    if (!instanceId) {
      return [];
    }

    const detail = await this.dependencies.getInstanceDetail(instanceId);
    if (!detail) {
      return [];
    }

    const adapterResolution = await this.dependencies.resolveAdapterResolution(instanceId);
    if (!adapterResolution || adapterResolution.capabilities.supported === false) {
      return [];
    }

    if (adapterResolution.adapterId === 'openclawGateway') {
      const catalog = await this.dependencies.getOpenClawCatalog(instanceId);
      return catalog.agents.map((agent) => mapOpenClawProfile({ instanceId, agent }));
    }

    return (detail.workbench?.agents ?? []).map((record) => mapWorkbenchProfile({ detail, record }));
  }

  async getAgentProfile(agentId: string, instanceId?: string): Promise<KernelChatAgentProfile> {
    const profiles = await this.listAgentProfiles(instanceId);
    const profile = profiles.find((candidate) => candidate.agentId === agentId);
    if (!profile) {
      throw new Error('Kernel chat agent profile not found');
    }

    return profile;
  }

  async listAgents(instanceId?: string): Promise<Agent[]> {
    const profiles = await this.listAgentProfiles(instanceId);
    return profiles.map(toAgent);
  }

  async getAgent(agentId: string, instanceId?: string): Promise<Agent> {
    return toAgent(await this.getAgentProfile(agentId, instanceId));
  }
}

export function createKernelChatAgentCatalogService(
  overrides: KernelChatAgentCatalogDependencyOverrides = {},
) {
  return new DefaultKernelChatAgentCatalogService({
    getInstanceDetail: overrides.getInstanceDetail || ((instanceId) => studio.getInstanceDetail(instanceId)),
    resolveAdapterResolution:
      overrides.resolveAdapterResolution ||
      ((instanceId) => resolveAuthoritativeInstanceKernelChatAdapter(instanceId)),
    getOpenClawCatalog:
      overrides.getOpenClawCatalog ||
      ((instanceId) => openClawChatAgentCatalogService.getCatalog(instanceId)),
  });
}

export const kernelChatAgentCatalogService = createKernelChatAgentCatalogService();
