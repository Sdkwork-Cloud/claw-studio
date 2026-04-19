import { studio } from '@sdkwork/claw-infrastructure';
import type { Agent, StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type { OpenClawConfigSnapshot } from './openClawConfigService.ts';
import { resolveAttachedKernelConfigFile } from './kernelConfigAttachmentService.ts';
import { openClawConfigService } from './openClawConfigService.ts';

export interface OpenClawAgentCatalogAgent extends Agent {
  isDefault: boolean;
}

export interface OpenClawAgentCatalog {
  agents: OpenClawAgentCatalogAgent[];
  defaultAgentId: string | null;
}

export interface OpenClawAgentCatalogDependencies {
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  resolveAttachedKernelConfigFile: (
    detail: StudioInstanceDetailRecord | null | undefined,
  ) => string | null;
  readOpenClawConfigSnapshot: (configPath: string) => Promise<OpenClawConfigSnapshot>;
}

export interface OpenClawAgentCatalogDependencyOverrides {
  getInstanceDetail?: OpenClawAgentCatalogDependencies['getInstanceDetail'];
  resolveAttachedKernelConfigFile?: OpenClawAgentCatalogDependencies['resolveAttachedKernelConfigFile'];
  readOpenClawConfigSnapshot?: OpenClawAgentCatalogDependencies['readOpenClawConfigSnapshot'];
}

export const DEFAULT_TASK_AGENT_SELECT_VALUE = '__default__';

export interface TaskAgentSelectOption {
  value: string;
  agentId: string | null;
  name: string;
  description: string;
  missing: boolean;
  defaultRoute: boolean;
  defaultAgent: boolean;
}

export interface TaskAgentSelectState {
  value: string;
  options: TaskAgentSelectOption[];
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function resolveDefaultAgentId(
  detail: StudioInstanceDetailRecord | null | undefined,
  configSnapshot: OpenClawConfigSnapshot | null,
) {
  const configuredDefaultAgentId =
    configSnapshot?.agentSnapshots.find((agent) => agent.isDefault)?.id || null;
  if (configuredDefaultAgentId) {
    return configuredDefaultAgentId;
  }

  const workbenchAgentIds =
    detail?.workbench?.agents.map((agentRecord) => agentRecord.agent.id).filter(Boolean) || [];
  if (workbenchAgentIds.includes('main')) {
    return 'main';
  }

  return workbenchAgentIds[0] || 'main';
}

class DefaultOpenClawAgentCatalogService {
  private readonly dependencies: OpenClawAgentCatalogDependencies;

  constructor(dependencies: OpenClawAgentCatalogDependencies) {
    this.dependencies = dependencies;
  }

  async getCatalog(instanceId: string): Promise<OpenClawAgentCatalog> {
    const detail = await this.dependencies.getInstanceDetail(instanceId);
    if (!isOpenClawDetail(detail)) {
      return {
        agents: [],
        defaultAgentId: null,
      };
    }

    const configPath = this.dependencies.resolveAttachedKernelConfigFile(detail);
    let configSnapshot: OpenClawConfigSnapshot | null = null;
    if (configPath) {
      configSnapshot = await this.dependencies.readOpenClawConfigSnapshot(configPath).catch(() => null);
    }

    const workbenchAgents = detail?.workbench?.agents || [];
    const workbenchAgentMap = new Map(
      workbenchAgents.map((agentRecord) => [agentRecord.agent.id, agentRecord.agent] as const),
    );
    const configAgentMap = new Map(
      (configSnapshot?.agentSnapshots || []).map((agent) => [agent.id, agent] as const),
    );
    const defaultAgentId = resolveDefaultAgentId(detail, configSnapshot);
    const orderedIds = Array.from(
      new Set([
        ...(configSnapshot?.agentSnapshots || []).map((agent) => agent.id),
        ...workbenchAgents.map((agentRecord) => agentRecord.agent.id),
      ]),
    ).filter(Boolean);
    const ids = orderedIds.length > 0 ? orderedIds : [defaultAgentId];
    const orderIndex = new Map(ids.map((id, index) => [id, index] as const));

    const agents = ids
      .map((id): OpenClawAgentCatalogAgent => {
        const workbenchAgent = workbenchAgentMap.get(id);
        const configAgent = configAgentMap.get(id);
        const fallbackName = titleizeIdentifier(id) || 'Main';

        return {
          id,
          name: workbenchAgent?.name || configAgent?.name || fallbackName,
          description:
            workbenchAgent?.description ||
            configAgent?.description ||
            `${fallbackName} agent`,
          avatar: workbenchAgent?.avatar || configAgent?.avatar || 'AI',
          systemPrompt: workbenchAgent?.systemPrompt || '',
          creator: workbenchAgent?.creator || 'OpenClaw',
          isDefault: id === defaultAgentId,
        };
      })
      .sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1;
        }

        return (orderIndex.get(left.id) || 0) - (orderIndex.get(right.id) || 0);
      });

    return {
      agents,
      defaultAgentId,
    };
  }
}

export function buildTaskAgentSelectState(input: {
  catalog: OpenClawAgentCatalog;
  selectedAgentId?: string | null;
}): TaskAgentSelectState {
  const normalizedSelectedAgentId = input.selectedAgentId?.trim() || '';
  const defaultAgent =
    input.catalog.agents.find((agent) => agent.isDefault) ||
    input.catalog.agents.find((agent) => agent.id === input.catalog.defaultAgentId) ||
    null;
  const options: TaskAgentSelectOption[] = [
    {
      value: DEFAULT_TASK_AGENT_SELECT_VALUE,
      agentId: null,
      name: defaultAgent?.name || titleizeIdentifier(input.catalog.defaultAgentId || 'main') || 'Main',
      description: defaultAgent?.description || 'Follow the default OpenClaw agent routing.',
      missing: false,
      defaultRoute: true,
      defaultAgent: false,
    },
    ...input.catalog.agents.map((agent) => ({
      value: agent.id,
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      missing: false,
      defaultRoute: false,
      defaultAgent: agent.isDefault,
    })),
  ];

  if (normalizedSelectedAgentId && !options.some((option) => option.value === normalizedSelectedAgentId)) {
    options.push({
      value: normalizedSelectedAgentId,
      agentId: normalizedSelectedAgentId,
      name: titleizeIdentifier(normalizedSelectedAgentId) || normalizedSelectedAgentId,
      description: 'This agent binding is no longer available from the connected instance.',
      missing: true,
      defaultRoute: false,
      defaultAgent: false,
    });
  }

  return {
    value: normalizedSelectedAgentId || DEFAULT_TASK_AGENT_SELECT_VALUE,
    options,
  };
}

export function createOpenClawAgentCatalogService(
  overrides: OpenClawAgentCatalogDependencyOverrides = {},
) {
  return new DefaultOpenClawAgentCatalogService({
    getInstanceDetail: overrides.getInstanceDetail || ((instanceId) => studio.getInstanceDetail(instanceId)),
    resolveAttachedKernelConfigFile:
      overrides.resolveAttachedKernelConfigFile ||
      ((detail) => resolveAttachedKernelConfigFile(detail)),
    readOpenClawConfigSnapshot:
      overrides.readOpenClawConfigSnapshot ||
      ((configPath) => openClawConfigService.readConfigSnapshot(configPath)),
  });
}

export const openClawAgentCatalogService = createOpenClawAgentCatalogService();
