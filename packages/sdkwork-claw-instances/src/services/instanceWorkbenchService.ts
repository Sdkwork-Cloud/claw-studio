import {
  openClawGatewayClient,
  studio,
  studioMockService,
  type OpenClawAgentFileResult,
  type OpenClawAgentFilesListResult,
  type OpenClawAgentsListResult,
  type OpenClawChannelStatusResult,
  type OpenClawConfigSnapshot,
  type OpenClawModelRecord,
  type OpenClawSkillsStatusResult,
  type OpenClawToolsCatalogResult,
  type MockInstanceLLMProvider,
  type MockInstanceMemoryEntry,
  type MockTaskExecutionHistoryEntry,
  type MockInstanceTool,
} from '@sdkwork/claw-infrastructure';
import { openClawConfigService } from '@sdkwork/claw-core';
import type {
  Agent,
  Skill,
  StudioInstanceCapabilitySnapshot,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchAgent,
  InstanceWorkbenchSectionAvailability,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchChannel,
  InstanceWorkbenchFile,
  InstanceWorkbenchLLMProvider,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSnapshot,
  InstanceWorkbenchTask,
  InstanceWorkbenchTaskExecution,
  InstanceWorkbenchTool,
} from '../types/index.ts';
import {
  buildOpenClawAgentFileId,
  describeSecretSource,
  formatSize,
  getArrayValue,
  getBooleanValue,
  getNumberValue,
  getObjectValue,
  getRecordValue,
  getStringValue,
  inferLanguageFromPath,
  inferProviderCapabilities,
  isNonEmptyString,
  isRecord,
  mapOpenClawProviderModels,
  parseOpenClawAgentFileId,
  summarizeMarkdown,
  titleCaseIdentifier,
  tokenEstimate,
  toIsoStringFromMs,
} from './openClawSupport.ts';
import { instanceService } from './instanceService.ts';

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function deriveRuntimeHealthScore(
  cpu: number,
  memory: number,
  status: string,
  connectedChannels: number,
  activeTasks: number,
  installedSkills: number,
) {
  const baseline =
    status === 'online' ? 88 : status === 'starting' ? 62 : status === 'error' ? 24 : 18;

  return clampScore(
    baseline -
      cpu * 0.28 -
      memory * 0.24 +
      Math.min(10, connectedChannels * 4) +
      Math.min(10, activeTasks * 3) +
      Math.min(8, installedSkills * 2),
  );
}

function deriveFocusAreas(agent: Agent, skills: Skill[]) {
  const source = `${agent.name} ${agent.description} ${agent.systemPrompt}`.toLowerCase();
  const focusAreas = new Set<string>();

  if (source.includes('code') || source.includes('software') || source.includes('debug')) {
    focusAreas.add('Code');
  }
  if (source.includes('data') || source.includes('analysis')) {
    focusAreas.add('Analytics');
  }
  if (source.includes('operat') || source.includes('workflow') || source.includes('incident')) {
    focusAreas.add('Operations');
  }
  if (source.includes('creative') || source.includes('story') || source.includes('content')) {
    focusAreas.add('Content');
  }

  skills.slice(0, 2).forEach((skill) => focusAreas.add(skill.category));

  if (focusAreas.size === 0) {
    focusAreas.add('Generalist');
  }

  return [...focusAreas].slice(0, 4);
}

function mapAgent(agent: Agent, tasks: InstanceWorkbenchTask[], skills: Skill[]): InstanceWorkbenchAgent {
  const focusAreas = deriveFocusAreas(agent, skills);
  const automationFitScore = clampScore(
    focusAreas.length * 15 + tasks.filter((task) => task.status === 'active').length * 12,
  );

  return {
    agent,
    focusAreas,
    automationFitScore,
    configSource: 'runtime',
  };
}

function mapMemoryEntry(entry: MockInstanceMemoryEntry): InstanceWorkbenchMemoryEntry {
  return { ...entry };
}

function mapTool(tool: MockInstanceTool): InstanceWorkbenchTool {
  return { ...tool };
}

function mapLlmProvider(provider: MockInstanceLLMProvider): InstanceWorkbenchLLMProvider {
  return {
    ...provider,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

function mapManagedChannel(
  channel: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>['channelSnapshots'][number],
): InstanceWorkbenchChannel {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    status: channel.status,
    enabled: channel.enabled,
    fieldCount: channel.fieldCount,
    configuredFieldCount: channel.configuredFieldCount,
    setupSteps: [...channel.setupSteps],
  };
}

function cloneManagedChannel(
  channel: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>['channelSnapshots'][number],
) {
  return {
    ...channel,
    setupSteps: [...channel.setupSteps],
    values: { ...channel.values },
    fields: channel.fields.map((field) => ({ ...field })),
  };
}

function mapManagedProvider(
  provider: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>['providerSnapshots'][number],
): InstanceWorkbenchLLMProvider {
  return {
    id: provider.id,
    name: provider.name,
    provider: provider.provider,
    endpoint: provider.endpoint,
    apiKeySource: provider.apiKeySource,
    status: provider.status,
    defaultModelId: provider.defaultModelId,
    reasoningModelId: provider.reasoningModelId,
    embeddingModelId: provider.embeddingModelId,
    description: provider.description,
    icon: provider.icon,
    lastCheckedAt: provider.lastCheckedAt,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

function mapManagedAgent(
  agentSnapshot: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>['agentSnapshots'][number],
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
  runtimeRecord?: InstanceWorkbenchAgent,
): InstanceWorkbenchAgent {
  const agentProfile = {
    id: agentSnapshot.id,
    name: agentSnapshot.name,
    description: agentSnapshot.description,
    avatar: agentSnapshot.avatar,
    systemPrompt: runtimeRecord?.agent.systemPrompt || '',
    creator: runtimeRecord?.agent.creator || 'OpenClaw',
  };
  const focusAreas =
    runtimeRecord?.focusAreas && runtimeRecord.focusAreas.length > 0
      ? [...runtimeRecord.focusAreas]
      : deriveFocusAreas(agentProfile, skills);
  const automationFitScore =
    runtimeRecord?.automationFitScore ??
    clampScore(focusAreas.length * 15 + tasks.filter((task) => task.status === 'active').length * 12);

  return {
    agent: agentProfile,
    focusAreas,
    automationFitScore,
    workspace: agentSnapshot.workspace,
    agentDir: agentSnapshot.agentDir,
    isDefault: agentSnapshot.isDefault,
    model: {
      primary: agentSnapshot.model.primary,
      fallbacks: [...agentSnapshot.model.fallbacks],
    },
    params: { ...agentSnapshot.params },
    configSource: 'managedConfig',
  };
}

function cloneTaskExecution(
  execution: InstanceWorkbenchTaskExecution,
): InstanceWorkbenchTaskExecution {
  return { ...execution };
}

function cloneWorkbenchAgent(agent: InstanceWorkbenchAgent): InstanceWorkbenchAgent {
  return {
    ...agent,
    agent: { ...agent.agent },
    focusAreas: [...agent.focusAreas],
    model: agent.model
      ? {
          primary: agent.model.primary,
          fallbacks: [...agent.model.fallbacks],
        }
      : undefined,
    params: agent.params ? { ...agent.params } : undefined,
  };
}

function cloneWorkbenchTask(task: InstanceWorkbenchTask): InstanceWorkbenchTask {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
    latestExecution: task.latestExecution ? cloneTaskExecution(task.latestExecution) : task.latestExecution ?? null,
    rawDefinition: task.rawDefinition
      ? JSON.parse(JSON.stringify(task.rawDefinition)) as Record<string, unknown>
      : undefined,
  };
}

function mapBackendWorkbench(
  detail: StudioInstanceDetailRecord,
  managedConfigSnapshot?: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>> | null,
): InstanceWorkbenchSnapshot {
  if (!detail.workbench) {
    throw new Error('Backend workbench payload is required.');
  }

  const workbench = detail.workbench;
  const mappedChannels: InstanceWorkbenchChannel[] = detail.workbench.channels.map((channel) => ({
    ...channel,
    setupSteps: [...channel.setupSteps],
  }));
  const mappedTasks = workbench.cronTasks.tasks.map(cloneWorkbenchTask);
  const mappedSkills = workbench.skills.map((skill) => ({ ...skill }));
  const runtimeAgents: InstanceWorkbenchAgent[] = workbench.agents.map(
    ({ agent, focusAreas, automationFitScore }) => ({
      agent: { ...agent },
      focusAreas: [...focusAreas],
      automationFitScore,
      configSource: 'runtime' as const,
    }),
  );
  const managedAgents: InstanceWorkbenchAgent[] =
    managedConfigSnapshot?.agentSnapshots.map((agentSnapshot) =>
      mapManagedAgent(
        agentSnapshot,
        mappedTasks,
        mappedSkills,
        runtimeAgents.find((record) => record.agent.id === agentSnapshot.id),
      ),
    ) || [];
  const mappedAgents: InstanceWorkbenchAgent[] =
    managedAgents.length > 0
      ? [
          ...managedAgents,
          ...runtimeAgents
            .filter(
              (record) => !managedAgents.some((managedAgent) => managedAgent.agent.id === record.agent.id),
            )
            .map(cloneWorkbenchAgent),
        ]
      : runtimeAgents.map(cloneWorkbenchAgent);
  const mappedFiles = workbench.files.map((file) => ({ ...file }));
  const mappedLlmProviders = workbench.llmProviders.map(mapLlmProvider);
  const mappedMemories = workbench.memory.map((entry) => ({ ...entry }));
  const mappedTools = workbench.tools.map((tool) => ({ ...tool }));
  const connectedChannelCount = mappedChannels.filter(
    (channel) => channel.status === 'connected' && channel.enabled,
  ).length;
  const activeTaskCount = mappedTasks.filter((task) => task.status === 'active').length;
  const readyToolCount = mappedTools.filter((tool) => tool.status === 'ready').length;
  const sectionCounts = {
    overview:
      detail.connectivity.endpoints.length +
      detail.capabilities.length +
      detail.dataAccess.routes.length +
      detail.artifacts.length,
    channels: mappedChannels.length,
    cronTasks: mappedTasks.length,
    llmProviders: mappedLlmProviders.length,
    agents: mappedAgents.length,
    skills: mappedSkills.length,
    files: mappedFiles.length,
    memory: mappedMemories.length,
    tools: mappedTools.length,
  } as const;

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    managedConfigPath: openClawConfigService.resolveInstanceConfigPath(detail),
    managedChannels: managedConfigSnapshot?.channelSnapshots.map(cloneManagedChannel),
    healthScore: detail.health.score,
    runtimeStatus: detail.health.status,
    connectedChannelCount,
    activeTaskCount,
    installedSkillCount: mappedSkills.length,
    readyToolCount,
    sectionCounts,
    sectionAvailability: buildSectionAvailability(detail, sectionCounts),
    channels: mappedChannels,
    tasks: mappedTasks,
    agents: mappedAgents.map(cloneWorkbenchAgent),
    skills: mappedSkills,
    files: mappedFiles,
    llmProviders: mappedLlmProviders,
    memories: mappedMemories,
    tools: mappedTools,
  };
}

function mapStudioInstance(instance: StudioInstanceRecord) {
  const status =
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
  } as const;
}

function mapStudioConfig(detail: StudioInstanceDetailRecord) {
  return {
    port: detail.config.port,
    sandbox: detail.config.sandbox,
    autoUpdate: detail.config.autoUpdate,
    logLevel: detail.config.logLevel,
    corsOrigins: detail.config.corsOrigins,
  };
}

function getCapabilityMap(detail: StudioInstanceDetailRecord) {
  return new Map(detail.capabilities.map((capability) => [capability.id, capability]));
}

function resolveCapabilityAvailability(
  capability: StudioInstanceCapabilitySnapshot | undefined,
): InstanceWorkbenchSectionAvailability {
  if (!capability) {
    return {
      status: 'planned',
      detail: 'This section is planned for a future runtime adapter.',
    };
  }

  return {
    status: capability.status,
    detail: capability.detail,
  };
}

function buildSectionAvailability(
  detail: StudioInstanceDetailRecord,
  counts: Record<Exclude<InstanceWorkbenchSectionId, 'overview'>, number>,
): Record<InstanceWorkbenchSectionId, InstanceWorkbenchSectionAvailability> {
  const capabilityMap = getCapabilityMap(detail);
  const templateReady = (count: number, detailText: string): InstanceWorkbenchSectionAvailability =>
    count > 0
      ? {
          status: 'ready',
          detail: detailText,
        }
      : {
          status: 'planned',
          detail: 'This section is not yet backed by a runtime-specific adapter for this instance.',
        };

  return {
    overview: {
      status: 'ready',
      detail: 'Overview is authored by the studio backend and reflects runtime identity, connectivity, storage, and diagnostics.',
    },
    channels: templateReady(
      counts.channels,
      'Channel data is available for this instance workbench.',
    ),
    cronTasks: resolveCapabilityAvailability(capabilityMap.get('tasks')),
    llmProviders: resolveCapabilityAvailability(capabilityMap.get('models')),
    agents: templateReady(
      counts.agents,
      'Agent catalog data is available for this instance workbench.',
    ),
    skills: templateReady(
      counts.skills,
      'Installed skill data is available for this instance workbench.',
    ),
    files: resolveCapabilityAvailability(capabilityMap.get('files')),
    memory: resolveCapabilityAvailability(capabilityMap.get('memory')),
    tools: resolveCapabilityAvailability(capabilityMap.get('tools')),
  };
}

interface InstanceWorkbenchServiceDependencies {
  studioApi: {
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
    cloneInstanceTask(instanceId: string, taskId: string, name?: string): Promise<void>;
    runInstanceTaskNow(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution>;
    listInstanceTaskExecutions(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution[]>;
    updateInstanceTaskStatus(
      instanceId: string,
      taskId: string,
      status: 'active' | 'paused',
    ): Promise<void>;
    deleteInstanceTask(instanceId: string, taskId: string): Promise<boolean>;
  };
  studioMockService: {
    getInstance(id: string): Promise<any>;
    getInstanceConfig(id: string): Promise<any>;
    getInstanceToken(id: string): Promise<string>;
    getInstanceLogs(id: string): Promise<string>;
    listChannels(id: string): Promise<any[]>;
    listTasks(id: string): Promise<any[]>;
    listInstalledSkills(id: string): Promise<Skill[]>;
    listAgents(): Promise<Agent[]>;
    listInstanceFiles(id: string): Promise<MockInstanceTool[] | any[]>;
    listInstanceLlmProviders(id: string): Promise<MockInstanceLLMProvider[]>;
    listInstanceMemories(id: string): Promise<MockInstanceMemoryEntry[]>;
    listInstanceTools(id: string): Promise<MockInstanceTool[]>;
    listTaskExecutions(id: string): Promise<MockTaskExecutionHistoryEntry[]>;
    cloneTask(id: string, overrides?: { name?: string }): Promise<any>;
    runTaskNow(id: string): Promise<any>;
    updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<boolean>;
    deleteTask(id: string): Promise<boolean>;
  };
  instanceService: {
    getInstanceById(id: string): Promise<any>;
    getInstanceConfig(id: string): Promise<any>;
    getInstanceToken(id: string): Promise<string | undefined>;
    getInstanceLogs(id: string): Promise<string>;
  };
  openClawGatewayClient: {
    getConfig(instanceId: string): Promise<OpenClawConfigSnapshot>;
    listModels(instanceId: string): Promise<OpenClawModelRecord[]>;
    getChannelStatus(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<OpenClawChannelStatusResult>;
    getSkillsStatus(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<OpenClawSkillsStatusResult>;
    getToolsCatalog(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<OpenClawToolsCatalogResult>;
    listAgents(instanceId: string): Promise<OpenClawAgentsListResult>;
    listAgentFiles(
      instanceId: string,
      args: { agentId: string },
    ): Promise<OpenClawAgentFilesListResult>;
    getAgentFile(
      instanceId: string,
      args: { agentId: string; name: string },
    ): Promise<OpenClawAgentFileResult>;
    listWorkbenchCronJobs(instanceId: string): Promise<InstanceWorkbenchTask[]>;
    listWorkbenchCronRuns(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution[]>;
  };
}

export interface InstanceWorkbenchServiceDependencyOverrides {
  studioApi?: Partial<InstanceWorkbenchServiceDependencies['studioApi']>;
  studioMockService?: Partial<InstanceWorkbenchServiceDependencies['studioMockService']>;
  instanceService?: Partial<InstanceWorkbenchServiceDependencies['instanceService']>;
  openClawGatewayClient?: Partial<InstanceWorkbenchServiceDependencies['openClawGatewayClient']>;
}

function createDefaultDependencies(): InstanceWorkbenchServiceDependencies {
  return {
    studioApi: {
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
      cloneInstanceTask: (instanceId, taskId, name) => studio.cloneInstanceTask(instanceId, taskId, name),
      runInstanceTaskNow: (instanceId, taskId) => studio.runInstanceTaskNow(instanceId, taskId),
      listInstanceTaskExecutions: (instanceId, taskId) => studio.listInstanceTaskExecutions(instanceId, taskId),
      updateInstanceTaskStatus: (instanceId, taskId, status) =>
        studio.updateInstanceTaskStatus(instanceId, taskId, status),
      deleteInstanceTask: (instanceId, taskId) => studio.deleteInstanceTask(instanceId, taskId),
    },
    studioMockService: {
      getInstance: (id) => studioMockService.getInstance(id),
      getInstanceConfig: (id) => studioMockService.getInstanceConfig(id),
      getInstanceToken: (id) => studioMockService.getInstanceToken(id),
      getInstanceLogs: (id) => studioMockService.getInstanceLogs(id),
      listChannels: (id) => studioMockService.listChannels(id),
      listTasks: (id) => studioMockService.listTasks(id),
      listInstalledSkills: (id) => studioMockService.listInstalledSkills(id),
      listAgents: () => studioMockService.listAgents(),
      listInstanceFiles: (id) => studioMockService.listInstanceFiles(id),
      listInstanceLlmProviders: (id) => studioMockService.listInstanceLlmProviders(id),
      listInstanceMemories: (id) => studioMockService.listInstanceMemories(id),
      listInstanceTools: (id) => studioMockService.listInstanceTools(id),
      listTaskExecutions: (id) => studioMockService.listTaskExecutions(id),
      cloneTask: (id, overrides) => studioMockService.cloneTask(id, overrides),
      runTaskNow: (id) => studioMockService.runTaskNow(id),
      updateTaskStatus: (id, status) => studioMockService.updateTaskStatus(id, status).then(Boolean),
      deleteTask: (id) => studioMockService.deleteTask(id),
    },
    instanceService: {
      getInstanceById: (id) => instanceService.getInstanceById(id),
      getInstanceConfig: (id) => instanceService.getInstanceConfig(id),
      getInstanceToken: (id) => instanceService.getInstanceToken(id),
      getInstanceLogs: (id) => instanceService.getInstanceLogs(id),
    },
    openClawGatewayClient: {
      getConfig: (instanceId) => openClawGatewayClient.getConfig(instanceId),
      listModels: (instanceId) => openClawGatewayClient.listModels(instanceId),
      getChannelStatus: (instanceId, args) => openClawGatewayClient.getChannelStatus(instanceId, args),
      getSkillsStatus: (instanceId, args) => openClawGatewayClient.getSkillsStatus(instanceId, args),
      getToolsCatalog: (instanceId, args) => openClawGatewayClient.getToolsCatalog(instanceId, args),
      listAgents: (instanceId) => openClawGatewayClient.listAgents(instanceId),
      listAgentFiles: (instanceId, args) => openClawGatewayClient.listAgentFiles(instanceId, args),
      getAgentFile: (instanceId, args) => openClawGatewayClient.getAgentFile(instanceId, args),
      listWorkbenchCronJobs: (instanceId) => openClawGatewayClient.listWorkbenchCronJobs(instanceId),
      listWorkbenchCronRuns: (instanceId, taskId) =>
        openClawGatewayClient.listWorkbenchCronRuns(instanceId, taskId),
    },
  };
}

interface OpenClawGatewaySections {
  channels: InstanceWorkbenchChannel[];
  tasks: InstanceWorkbenchTask[];
  agents: InstanceWorkbenchAgent[];
  skills: Skill[];
  files: InstanceWorkbenchFile[];
  llmProviders: InstanceWorkbenchLLMProvider[];
  memories: InstanceWorkbenchMemoryEntry[];
  tools: InstanceWorkbenchTool[];
}

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function countOverviewEntries(detail: StudioInstanceDetailRecord) {
  return (
    detail.connectivity.endpoints.length +
    detail.capabilities.length +
    detail.dataAccess.routes.length +
    detail.artifacts.length
  );
}

function isConfiguredValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return false;
}

function buildOpenClawSectionCounts(
  detail: StudioInstanceDetailRecord,
  sections: OpenClawGatewaySections,
): Record<InstanceWorkbenchSectionId, number> {
  return {
    overview: countOverviewEntries(detail),
    channels: sections.channels.length,
    cronTasks: sections.tasks.length,
    llmProviders: sections.llmProviders.length,
    agents: sections.agents.length,
    skills: sections.skills.length,
    files: sections.files.length,
    memory: sections.memories.length,
    tools: sections.tools.length,
  };
}

function buildOpenClawSnapshotFromSections(
  detail: StudioInstanceDetailRecord,
  sections: OpenClawGatewaySections,
): InstanceWorkbenchSnapshot {
  const connectedChannelCount = sections.channels.filter(
    (channel) => channel.status === 'connected' && channel.enabled,
  ).length;
  const activeTaskCount = sections.tasks.filter((task) => task.status === 'active').length;
  const readyToolCount = sections.tools.filter((tool) => tool.status === 'ready').length;
  const sectionCounts = buildOpenClawSectionCounts(detail, sections);

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    healthScore: detail.health.score,
    runtimeStatus: detail.health.status,
    connectedChannelCount,
    activeTaskCount,
    installedSkillCount: sections.skills.length,
    readyToolCount,
    sectionCounts,
    sectionAvailability: buildSectionAvailability(detail, {
      channels: sections.channels.length,
      cronTasks: sections.tasks.length,
      llmProviders: sections.llmProviders.length,
      agents: sections.agents.length,
      skills: sections.skills.length,
      files: sections.files.length,
      memory: sections.memories.length,
      tools: sections.tools.length,
    }),
    channels: sections.channels,
    tasks: sections.tasks.map(cloneWorkbenchTask),
    agents: sections.agents.map((agent) => ({
      ...agent,
      agent: { ...agent.agent },
      focusAreas: [...agent.focusAreas],
    })),
    skills: sections.skills.map((skill) => ({ ...skill })),
    files: sections.files.map((file) => ({ ...file })),
    llmProviders: sections.llmProviders.map((provider) => ({
      ...provider,
      capabilities: [...provider.capabilities],
      models: provider.models.map((model) => ({ ...model })),
      config: { ...provider.config },
    })),
    memories: sections.memories.map((entry) => ({ ...entry })),
    tools: sections.tools.map((tool) => ({ ...tool })),
  };
}

function mergeOpenClawSnapshots(
  base: InstanceWorkbenchSnapshot,
  live: InstanceWorkbenchSnapshot,
): InstanceWorkbenchSnapshot {
  return buildOpenClawSnapshotFromSections(base.detail, {
    channels: live.channels.length > 0 ? live.channels : base.channels,
    tasks: live.tasks.length > 0 ? live.tasks : base.tasks,
    llmProviders: live.llmProviders.length > 0 ? live.llmProviders : base.llmProviders,
    agents: live.agents.length > 0 ? live.agents : base.agents,
    skills: live.skills.length > 0 ? live.skills : base.skills,
    files: base.files.length > 0 ? base.files : live.files,
    memories: base.memories.length > 0 ? base.memories : live.memories,
    tools: live.tools.length > 0 ? live.tools : base.tools,
  });
}

function buildOpenClawChannels(status: OpenClawChannelStatusResult): InstanceWorkbenchChannel[] {
  const rawChannels = isRecord(status.channels) ? status.channels : {};
  const orderedIds = Array.from(
    new Set([
      ...(Array.isArray(status.channelOrder) ? status.channelOrder.filter(isNonEmptyString) : []),
      ...Object.keys(rawChannels),
    ]),
  );

  return orderedIds
    .map((channelId) => {
      const rawChannel = rawChannels[channelId];
      if (!isRecord(rawChannel)) {
        return null;
      }

      const rawFields = getObjectValue(rawChannel, ['fields']) || {};
      const rawAccounts = getObjectValue(rawChannel, ['accounts']) || {};
      const fieldCount = Object.keys(rawFields).length;
      const accountCount = Object.keys(rawAccounts).length;
      const configuredFieldCount = Object.values(rawFields).filter((value) => isConfiguredValue(value)).length;
      const enabled = getBooleanValue(rawChannel, ['enabled']) ?? false;
      const configured =
        (getBooleanValue(rawChannel, ['configured']) ?? false) ||
        configuredFieldCount > 0 ||
        accountCount > 0;
      const setupSteps = configured
        ? [
            `${status.channelLabels?.[channelId] || titleCaseIdentifier(channelId)} channel is configured for the gateway runtime.`,
            enabled
              ? 'Channel is enabled for runtime delivery.'
              : 'Enable the channel after validating connectivity.',
          ]
        : [
            `Configure credentials or routing for ${status.channelLabels?.[channelId] || titleCaseIdentifier(channelId)}.`,
            'Add at least one account or destination target.',
          ];

      return {
        id: channelId,
        name: status.channelLabels?.[channelId] || titleCaseIdentifier(channelId),
        description:
          status.channelDetailLabels?.[channelId] ||
          `${status.channelLabels?.[channelId] || titleCaseIdentifier(channelId)} integration managed by the OpenClaw gateway.`,
        status: configured ? (enabled ? 'connected' : 'disconnected') : 'not_configured',
        enabled,
        fieldCount: Math.max(fieldCount, accountCount, configured ? 1 : 0),
        configuredFieldCount: configured ? Math.max(configuredFieldCount, accountCount, 1) : 0,
        setupSteps,
      } satisfies InstanceWorkbenchChannel;
    })
    .filter(Boolean) as InstanceWorkbenchChannel[];
}

function providerMatchesId(model: OpenClawModelRecord, providerId: string) {
  const candidates = [
    typeof model.provider === 'string' ? model.provider : undefined,
    typeof model.providerId === 'string' ? model.providerId : undefined,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  return candidates.includes(providerId.toLowerCase());
}

function buildOpenClawLlmProviders(
  configSnapshot: OpenClawConfigSnapshot | null,
  liveModels: OpenClawModelRecord[],
  detail: StudioInstanceDetailRecord,
): InstanceWorkbenchLLMProvider[] {
  const providers = getObjectValue(configSnapshot?.config, ['models', 'providers']) || {};
  const lastCheckedAt =
    getStringValue(configSnapshot?.config, ['meta', 'lastTouchedAt']) ||
    (detail.observability.lastSeenAt ? new Date(detail.observability.lastSeenAt).toISOString() : 'Unknown');

  return Object.entries(providers)
    .filter(([, providerValue]) => isRecord(providerValue))
    .map(([providerId, providerValue]) => {
      const configModels = getArrayValue(providerValue, ['models']) || [];
      const providerModels = liveModels.filter((model) => providerMatchesId(model, providerId));
      const modelSource = providerModels.length > 0 ? providerModels : configModels;
      const models = mapOpenClawProviderModels(modelSource);
      const defaultModelId =
        models.find((model) => model.role === 'primary')?.id || models[0]?.id || '';

      return {
        id: providerId,
        name: titleCaseIdentifier(providerId),
        provider: providerId,
        endpoint:
          getStringValue(providerValue, ['baseUrl']) ||
          getStringValue(providerValue, ['endpoint']) ||
          '',
        apiKeySource: describeSecretSource(getRecordValue(providerValue, ['apiKey'])),
        status: defaultModelId ? 'ready' : 'configurationRequired',
        defaultModelId,
        reasoningModelId: models.find((model) => model.role === 'reasoning')?.id,
        embeddingModelId: models.find((model) => model.role === 'embedding')?.id,
        description: `${titleCaseIdentifier(providerId)} provider configured through the OpenClaw gateway.`,
        icon: providerId.charAt(0).toUpperCase() || 'O',
        lastCheckedAt,
        capabilities: inferProviderCapabilities(modelSource),
        models,
        config: {
          temperature: getNumberValue(providerValue, ['temperature']) ?? 0.2,
          topP: getNumberValue(providerValue, ['topP']) ?? 1,
          maxTokens: getNumberValue(providerValue, ['maxTokens']) ?? 4096,
          timeoutMs: getNumberValue(providerValue, ['timeoutMs']) ?? 60000,
          streaming: getBooleanValue(providerValue, ['streaming']) ?? true,
        },
      } satisfies InstanceWorkbenchLLMProvider;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function inferSkillCategory(skillName: string, content: string) {
  const source = `${skillName} ${content}`.toLowerCase();

  if (source.includes('browser') || source.includes('web')) {
    return 'Integration';
  }
  if (source.includes('image') || source.includes('audio')) {
    return 'Media';
  }
  if (source.includes('cron') || source.includes('automation')) {
    return 'Automation';
  }
  if (source.includes('code') || source.includes('patch') || source.includes('git')) {
    return 'Code';
  }

  return 'General';
}

function buildOpenClawSkills(status: OpenClawSkillsStatusResult): Skill[] {
  const entries =
    (Array.isArray(status.skills) ? status.skills : Array.isArray(status.entries) ? status.entries : [])
      .filter(isRecord);

  return entries.map((entry) => {
    const name =
      (typeof entry.name === 'string' && entry.name.trim()) ||
      (typeof entry.id === 'string' && entry.id.trim()) ||
      'Unnamed Skill';
    const readme = typeof entry.readme === 'string' ? entry.readme : undefined;
    const description =
      (typeof entry.description === 'string' && entry.description.trim()) ||
      (readme ? summarizeMarkdown(readme, 220) : 'Installed OpenClaw skill.');

    return {
      id: (typeof entry.id === 'string' && entry.id.trim()) || name,
      name,
      description,
      author:
        (typeof entry.author === 'string' && entry.author.trim()) || 'OpenClaw',
      rating: 5,
      downloads: 1,
      category: inferSkillCategory(name, `${description} ${readme || ''}`),
      icon: undefined,
      version: typeof entry.version === 'string' ? entry.version : undefined,
      size: typeof entry.size === 'string' ? entry.size : undefined,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
      readme,
    };
  });
}

function inferToolCategory(
  toolId: string,
  groupId: string,
  groupLabel: string,
): InstanceWorkbenchTool['category'] {
  const source = `${toolId} ${groupId} ${groupLabel}`.toLowerCase();

  if (
    source.includes('file') ||
    source.includes('read') ||
    source.includes('write') ||
    source.includes('patch')
  ) {
    return 'filesystem';
  }
  if (
    source.includes('cron') ||
    source.includes('update') ||
    source.includes('automation')
  ) {
    return 'automation';
  }
  if (
    source.includes('log') ||
    source.includes('status') ||
    source.includes('usage') ||
    source.includes('secret')
  ) {
    return 'observability';
  }
  if (
    source.includes('session') ||
    source.includes('memory') ||
    source.includes('agent') ||
    source.includes('model')
  ) {
    return 'reasoning';
  }

  return 'integration';
}

function inferToolAccess(toolId: string): InstanceWorkbenchTool['access'] {
  const normalized = toolId.toLowerCase();

  if (
    normalized.includes('read') ||
    normalized.includes('get') ||
    normalized.includes('list') ||
    normalized.includes('status') ||
    normalized.includes('search') ||
    normalized.includes('tail') ||
    normalized.includes('catalog') ||
    normalized.includes('resolve')
  ) {
    return 'read';
  }
  if (
    normalized.includes('set') ||
    normalized.includes('update') ||
    normalized.includes('patch') ||
    normalized.includes('install') ||
    normalized.includes('create') ||
    normalized.includes('delete') ||
    normalized.includes('logout')
  ) {
    return 'write';
  }

  return 'execute';
}

function buildOpenClawTools(catalog: OpenClawToolsCatalogResult): InstanceWorkbenchTool[] {
  const toolMap = new Map<string, InstanceWorkbenchTool>();

  (Array.isArray(catalog.groups) ? catalog.groups : []).forEach((group) => {
    const tools = Array.isArray(group.tools) ? group.tools : [];
    tools.forEach((tool) => {
      const id = typeof tool.id === 'string' ? tool.id : '';
      if (!id || toolMap.has(id)) {
        return;
      }

      toolMap.set(id, {
        id,
        name:
          (typeof tool.label === 'string' && tool.label.trim()) ||
          titleCaseIdentifier(id),
        description:
          (typeof tool.description === 'string' && tool.description.trim()) ||
          `${titleCaseIdentifier(id)} tool exposed by the OpenClaw gateway.`,
        category: inferToolCategory(
          id,
          typeof group.id === 'string' ? group.id : '',
          typeof group.label === 'string' ? group.label : '',
        ),
        status: tool.optional ? 'beta' : 'ready',
        access: inferToolAccess(id),
        command: `tool:${id}`,
        lastUsedAt: undefined,
      });
    });
  });

  return [...toolMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function inferOpenClawFileCategory(
  name: string,
  path: string,
): InstanceWorkbenchFile['category'] {
  const normalized = `${name} ${path}`.toLowerCase();

  if (normalized.includes('memory.md')) {
    return 'memory';
  }
  if (normalized.endsWith('.log')) {
    return 'log';
  }
  if (
    normalized.endsWith('.json') ||
    normalized.endsWith('.json5') ||
    normalized.includes('config')
  ) {
    return 'config';
  }
  if (normalized.endsWith('.md')) {
    return 'prompt';
  }

  return 'artifact';
}

function buildOpenClawAgents(
  agentsResult: OpenClawAgentsListResult | null,
  configSnapshot: OpenClawConfigSnapshot | null,
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
): InstanceWorkbenchAgent[] {
  const configuredAgents =
    (getArrayValue(configSnapshot?.config, ['agents', 'list']) || []).filter(isRecord);
  const configuredById = new Map(
    configuredAgents
      .map((entry) => {
        const id = getStringValue(entry, ['id']);
        return id ? [id, entry] as const : null;
      })
      .filter(Boolean) as Array<readonly [string, Record<string, unknown>]>,
  );
  const sourceAgents =
    (Array.isArray(agentsResult?.agents) ? agentsResult?.agents : configuredAgents).filter(isRecord);

  return sourceAgents.map((entry) => {
    const agentId = getStringValue(entry, ['id']) || 'main';
    const configured = configuredById.get(agentId);
    const name =
      getStringValue(entry, ['name']) ||
      getStringValue(configured, ['name']) ||
      titleCaseIdentifier(agentId);
    const description =
      getStringValue(entry, ['description']) ||
      `${name} agent exposed by the OpenClaw gateway.`;
    const avatar =
      getStringValue(entry, ['avatar']) ||
      getStringValue(entry, ['identity', 'emoji']) ||
      getStringValue(configured, ['identity', 'emoji']) ||
      name.charAt(0).toUpperCase() ||
      'O';
    const systemPrompt =
      getStringValue(entry, ['systemPrompt']) ||
      getStringValue(entry, ['prompt']) ||
      description;

    return mapAgent(
      {
        id: agentId,
        name,
        description,
        avatar,
        systemPrompt,
        creator: getStringValue(entry, ['creator']) || 'OpenClaw',
      },
      tasks,
      skills,
    );
  });
}

async function buildOpenClawFiles(
  instanceId: string,
  agents: InstanceWorkbenchAgent[],
  dependencies: InstanceWorkbenchServiceDependencies,
): Promise<InstanceWorkbenchFile[]> {
  const files = await Promise.all(
    agents.map(async (agent) => {
      const listed = await dependencies.openClawGatewayClient
        .listAgentFiles(instanceId, {
          agentId: agent.agent.id,
        })
        .catch(() => ({ files: [] }) as OpenClawAgentFilesListResult);
      const workspace = listed.workspace || '';

      return Promise.all(
        listed.files
          .filter((entry) => isRecord(entry) && isNonEmptyString(entry.name))
          .map(async (entry) => {
            const name = entry.name.trim();
            const fetched = await dependencies.openClawGatewayClient
              .getAgentFile(instanceId, {
                agentId: agent.agent.id,
                name,
              })
              .catch(() => null);
            const fileRecord = isRecord(fetched?.file) ? fetched.file : entry;
            const path =
              (typeof fileRecord.path === 'string' && fileRecord.path.trim()) ||
              (workspace ? `${workspace.replace(/\/+$/, '')}/${name}` : `/${agent.agent.id}/${name}`);
            const content =
              typeof fileRecord.content === 'string' ? fileRecord.content : '';

            return {
              id: buildOpenClawAgentFileId(agent.agent.id, name),
              name,
              path,
              category: inferOpenClawFileCategory(name, path),
              language: inferLanguageFromPath(path),
              size: formatSize(
                typeof fileRecord.size === 'number' ? fileRecord.size : undefined,
              ),
              updatedAt: toIsoStringFromMs(
                typeof fileRecord.updatedAtMs === 'number' ? fileRecord.updatedAtMs : undefined,
              ) || 'Unknown',
              status:
                fileRecord.missing === true ? 'missing' : 'synced',
              description: `${name} bootstrap file for ${agent.agent.name}.`,
              content,
              isReadonly: false,
            } satisfies InstanceWorkbenchFile;
          }),
      );
    }),
  );

  return files.flat().sort((left, right) => left.path.localeCompare(right.path));
}

function buildOpenClawMemories(
  configSnapshot: OpenClawConfigSnapshot | null,
  files: InstanceWorkbenchFile[],
  agents: InstanceWorkbenchAgent[],
): InstanceWorkbenchMemoryEntry[] {
  const agentNameById = new Map(agents.map((agent) => [agent.agent.id, agent.agent.name]));
  const backend = getStringValue(configSnapshot?.config, ['memory', 'backend']) || 'builtin';
  const citations = getStringValue(configSnapshot?.config, ['memory', 'citations']) || 'auto';
  const entries: InstanceWorkbenchMemoryEntry[] = [
    {
      id: 'memory-backend',
      title: 'Memory Backend',
      type: 'fact',
      summary: `Backend=${backend}, citations=${citations}.`,
      source: 'system',
      updatedAt:
        getStringValue(configSnapshot?.config, ['meta', 'lastTouchedAt']) || 'Unknown',
      retention: 'rolling',
      tokens: 32,
    },
  ];

  files.forEach((file) => {
    if (file.category !== 'memory' || !file.content.trim()) {
      return;
    }

    const parsed = parseOpenClawAgentFileId(file.id);
    const agentName = parsed ? agentNameById.get(parsed.agentId) || titleCaseIdentifier(parsed.agentId) : file.name;

    entries.push({
      id: `memory-${file.id}`,
      title: `${agentName} Memory`,
      type: 'conversation',
      summary: summarizeMarkdown(file.content, 220),
      source: parsed && parsed.agentId !== 'main' ? 'agent' : 'system',
      updatedAt: file.updatedAt,
      retention: 'pinned',
      tokens: tokenEstimate(file.content),
    });
  });

  (getArrayValue(configSnapshot?.config, ['memory', 'qmd', 'paths']) || [])
    .filter(isRecord)
    .forEach((entry, index) => {
      const path = getStringValue(entry, ['path']);
      if (!path) {
        return;
      }

      entries.push({
        id: `qmd-${index}`,
        title: getStringValue(entry, ['name']) || path,
        type: 'artifact',
        summary: `QMD index path ${path}${
          getStringValue(entry, ['pattern'])
            ? ` (pattern: ${getStringValue(entry, ['pattern'])})`
            : ''
        }`,
        source: 'system',
        updatedAt: 'Configured',
        retention: 'rolling',
        tokens: 16,
      });
    });

  return entries;
}

class InstanceWorkbenchService {
  private readonly backendTaskExecutionsById = new Map<string, InstanceWorkbenchTaskExecution[]>();

  private readonly openClawTaskInstanceById = new Map<string, string>();

  private readonly dependencies: InstanceWorkbenchServiceDependencies;

  constructor(dependencies: InstanceWorkbenchServiceDependencies) {
    this.dependencies = dependencies;
  }

  private clearOpenClawTasksForInstance(instanceId: string) {
    for (const [taskId, currentInstanceId] of [...this.openClawTaskInstanceById.entries()]) {
      if (currentInstanceId === instanceId) {
        this.openClawTaskInstanceById.delete(taskId);
        this.backendTaskExecutionsById.delete(taskId);
      }
    }
  }

  private rememberBackendTaskExecutions(detail: StudioInstanceDetailRecord) {
    const workbench = detail.workbench;
    if (!workbench) {
      return;
    }

    for (const [taskId, instanceId] of [...this.openClawTaskInstanceById.entries()]) {
      if (instanceId === detail.instance.id) {
        this.openClawTaskInstanceById.delete(taskId);
        this.backendTaskExecutionsById.delete(taskId);
      }
    }

    workbench.cronTasks.tasks.forEach((task) => {
      this.openClawTaskInstanceById.set(task.id, detail.instance.id);
      this.backendTaskExecutionsById.set(
        task.id,
        (workbench.cronTasks.taskExecutionsById[task.id] || []).map(cloneTaskExecution),
      );
    });
  }

  private rememberOpenClawTasks(
    instanceId: string,
    tasks: InstanceWorkbenchTask[],
    fallbackExecutionsById: Record<string, InstanceWorkbenchTaskExecution[]> = {},
  ) {
    this.clearOpenClawTasksForInstance(instanceId);

    tasks.forEach((task) => {
      this.openClawTaskInstanceById.set(task.id, instanceId);

      const executions =
        fallbackExecutionsById[task.id] ||
        (task.latestExecution ? [cloneTaskExecution(task.latestExecution)] : []);
      if (executions.length > 0) {
        this.backendTaskExecutionsById.set(
          task.id,
          executions.map(cloneTaskExecution),
        );
      }
    });
  }

  private async buildGatewayOpenClawSnapshot(
    instanceId: string,
    detail: StudioInstanceDetailRecord,
  ): Promise<InstanceWorkbenchSnapshot | null> {
    const [
      configResult,
      modelsResult,
      channelsResult,
      skillsResult,
      toolsResult,
      agentsResult,
      tasksResult,
    ] = await Promise.allSettled([
      this.dependencies.openClawGatewayClient.getConfig(instanceId),
      this.dependencies.openClawGatewayClient.listModels(instanceId),
      this.dependencies.openClawGatewayClient.getChannelStatus(instanceId, {}),
      this.dependencies.openClawGatewayClient.getSkillsStatus(instanceId, {}),
      this.dependencies.openClawGatewayClient.getToolsCatalog(instanceId, {}),
      this.dependencies.openClawGatewayClient.listAgents(instanceId),
      this.dependencies.openClawGatewayClient.listWorkbenchCronJobs(instanceId),
    ]);

    const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
    const skills = skillsResult.status === 'fulfilled' ? buildOpenClawSkills(skillsResult.value) : [];
    const llmProviders =
      configResult.status === 'fulfilled'
        ? buildOpenClawLlmProviders(
            configResult.value,
            modelsResult.status === 'fulfilled' ? modelsResult.value : [],
            detail,
          )
        : [];
    const channels =
      channelsResult.status === 'fulfilled' ? buildOpenClawChannels(channelsResult.value) : [];
    const agents = buildOpenClawAgents(
      agentsResult.status === 'fulfilled' ? agentsResult.value : null,
      configResult.status === 'fulfilled' ? configResult.value : null,
      tasks,
      skills,
    );
    const tools =
      toolsResult.status === 'fulfilled' ? buildOpenClawTools(toolsResult.value) : [];
    const files = await buildOpenClawFiles(instanceId, agents, this.dependencies).catch(() => []);
    const memories = buildOpenClawMemories(
      configResult.status === 'fulfilled' ? configResult.value : null,
      files,
      agents,
    );

    const hasGatewayData =
      channels.length > 0 ||
      tasks.length > 0 ||
      llmProviders.length > 0 ||
      agents.length > 0 ||
      skills.length > 0 ||
      files.length > 0 ||
      memories.length > 1 ||
      tools.length > 0;

    if (!hasGatewayData) {
      return null;
    }

    return buildOpenClawSnapshotFromSections(detail, {
      channels,
      tasks,
      agents,
      skills,
      files,
      llmProviders,
      memories,
      tools,
    });
  }

  private async getOpenClawWorkbench(
    instanceId: string,
    detail: StudioInstanceDetailRecord,
    managedConfigSnapshot: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>> | null,
  ): Promise<InstanceWorkbenchSnapshot> {
    const backendSnapshot = detail.workbench ? mapBackendWorkbench(detail, managedConfigSnapshot) : null;
    if (detail.workbench) {
      this.rememberBackendTaskExecutions(detail);
    }

    const liveSnapshot = await this.buildGatewayOpenClawSnapshot(instanceId, detail).catch(
      () => null,
    );

    const snapshot =
      backendSnapshot && liveSnapshot
        ? mergeOpenClawSnapshots(backendSnapshot, liveSnapshot)
        : backendSnapshot || liveSnapshot;

    if (snapshot) {
      this.rememberOpenClawTasks(
        instanceId,
        snapshot.tasks,
        detail.workbench?.cronTasks.taskExecutionsById || {},
      );
      return snapshot;
    }

    if (backendSnapshot) {
      this.rememberOpenClawTasks(
        instanceId,
        backendSnapshot.tasks,
        detail.workbench?.cronTasks.taskExecutionsById || {},
      );
      return backendSnapshot;
    }

    return buildOpenClawSnapshotFromSections(detail, {
      channels: [],
      tasks: [],
      agents: [],
      skills: [],
      files: [],
      llmProviders: [],
      memories: [],
      tools: [],
    });
  }

  async getInstanceWorkbench(id: string): Promise<InstanceWorkbenchSnapshot | null> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id);
    const managedConfigPath =
      isOpenClawDetail(detail) ? openClawConfigService.resolveInstanceConfigPath(detail) : null;
    const managedConfigSnapshot = managedConfigPath
      ? await openClawConfigService.readConfigSnapshot(managedConfigPath).catch(() => null)
      : null;

    if (isOpenClawDetail(detail)) {
      return this.getOpenClawWorkbench(id, detail, managedConfigSnapshot);
    }

    const [
      instance,
      config,
      token,
      logs,
      channels,
      rawTasks,
      skills,
      agents,
      files,
      llmProviders,
      memories,
      tools,
    ] = await Promise.all([
      this.dependencies.studioMockService.getInstance(id),
      this.dependencies.studioMockService.getInstanceConfig(id),
      this.dependencies.studioMockService.getInstanceToken(id),
      this.dependencies.studioMockService.getInstanceLogs(id),
      this.dependencies.studioMockService.listChannels(id),
      this.dependencies.studioMockService.listTasks(id),
      this.dependencies.studioMockService.listInstalledSkills(id),
      this.dependencies.studioMockService.listAgents(),
      this.dependencies.studioMockService.listInstanceFiles(id),
      this.dependencies.studioMockService.listInstanceLlmProviders(id),
      this.dependencies.studioMockService.listInstanceMemories(id),
      this.dependencies.studioMockService.listInstanceTools(id),
    ]);

    if (detail) {
      const mappedChannels: InstanceWorkbenchChannel[] =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.channels.map((channel) => ({
              ...channel,
              setupSteps: [...channel.setupSteps],
            }))
          : managedConfigSnapshot
            ? managedConfigSnapshot.channelSnapshots.map(mapManagedChannel)
          : channels.map((channel) => ({
              id: channel.id,
              name: channel.name,
              description: channel.description,
              status: channel.status,
              enabled: channel.enabled,
              fieldCount: channel.fields.length,
              configuredFieldCount: channel.fields.filter((field) => Boolean(field.value)).length,
              setupSteps: [...channel.setupGuide],
            }));

      const deliveryChannelNameMap = Object.fromEntries(
        mappedChannels.map((channel) => [channel.id, channel.name]),
      ) as Record<string, string>;
      const taskExecutionsById =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? Object.fromEntries(
              Object.entries(detail.workbench.cronTasks.taskExecutionsById).map(
                ([taskId, executions]) => [
                  taskId,
                  executions.map((execution) => ({ ...execution })),
                ],
              ),
            ) as Record<string, InstanceWorkbenchTaskExecution[]>
          : (Object.fromEntries(
              await Promise.all(
                rawTasks.map(async (task) => {
                  const executions = await this.dependencies.studioMockService.listTaskExecutions(task.id);
                  return [task.id, executions] as const;
                }),
              ),
            ) as Record<string, MockTaskExecutionHistoryEntry[]>);
      const mappedTasks: InstanceWorkbenchTask[] =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.cronTasks.tasks.map((task) => ({
              ...task,
              scheduleConfig: { ...task.scheduleConfig },
              latestExecution:
                task.latestExecution ?? taskExecutionsById[task.id]?.[0] ?? null,
            }))
          : rawTasks.map((task) => ({
              ...task,
              deliveryLabel:
                task.deliveryMode === 'none'
                  ? undefined
                  : deliveryChannelNameMap[task.deliveryChannel || ''] ||
                    task.deliveryChannel ||
                    undefined,
              latestExecution: taskExecutionsById[task.id]?.[0] || null,
            }));
      const mappedFiles: InstanceWorkbenchFile[] =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.files.map((file) => ({ ...file }))
          : files.map((file) => ({ ...file }));
      const mappedLlmProviders =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.llmProviders.map((provider) => ({
              ...provider,
              capabilities: [...provider.capabilities],
              models: provider.models.map((model) => ({ ...model })),
              config: { ...provider.config },
            }))
          : managedConfigSnapshot
            ? managedConfigSnapshot.providerSnapshots.map(mapManagedProvider)
          : llmProviders.map(mapLlmProvider);
      const mappedMemories =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.memory.map((entry) => ({ ...entry }))
          : memories.map(mapMemoryEntry);
      const mappedTools =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.tools.map((tool) => ({ ...tool }))
          : tools.map(mapTool);
      const mappedSkills =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? detail.workbench.skills.map((skill) => ({ ...skill }))
          : skills;
      const mappedAgents: InstanceWorkbenchAgent[] =
        detail.instance.runtimeKind === 'openclaw' && detail.workbench
          ? (() => {
              const runtimeAgents: InstanceWorkbenchAgent[] = detail.workbench.agents.map((agent) => ({
                ...agent,
                agent: { ...agent.agent },
                focusAreas: [...agent.focusAreas],
                configSource: 'runtime' as const,
              }));
              const managedAgents: InstanceWorkbenchAgent[] =
                managedConfigSnapshot?.agentSnapshots.map((agentSnapshot) =>
                  mapManagedAgent(
                    agentSnapshot,
                    mappedTasks,
                    mappedSkills,
                    runtimeAgents.find((record) => record.agent.id === agentSnapshot.id),
                  ),
                ) || [];

              return managedAgents.length > 0
                ? [
                    ...managedAgents,
                    ...runtimeAgents.filter(
                      (record) =>
                        !managedAgents.some((managedAgent) => managedAgent.agent.id === record.agent.id),
                    ),
                  ]
                : runtimeAgents.map(cloneWorkbenchAgent);
            })()
          : managedConfigSnapshot?.agentSnapshots.length
            ? managedConfigSnapshot.agentSnapshots.map((agentSnapshot) =>
                mapManagedAgent(agentSnapshot, mappedTasks, mappedSkills),
              )
            : agents.map((agent) => mapAgent(agent, mappedTasks, mappedSkills));
      const connectedChannelCount = mappedChannels.filter(
        (channel) => channel.status === 'connected' && channel.enabled,
      ).length;
      const activeTaskCount = mappedTasks.filter((task) => task.status === 'active').length;
      const readyToolCount = mappedTools.filter((tool) => tool.status === 'ready').length;
      const sectionCounts = {
        overview:
          detail.connectivity.endpoints.length +
          detail.capabilities.length +
          detail.dataAccess.routes.length +
          detail.artifacts.length,
        channels: mappedChannels.length,
        cronTasks: mappedTasks.length,
        llmProviders: mappedLlmProviders.length,
        agents: mappedAgents.length,
        skills: mappedSkills.length,
        files: mappedFiles.length,
        memory: mappedMemories.length,
        tools: mappedTools.length,
      } as const;

      return {
        instance: mapStudioInstance(detail.instance),
        config: mapStudioConfig(detail),
        token: detail.config.authToken || '',
        logs: detail.logs,
        detail,
        managedConfigPath,
        managedChannels: managedConfigSnapshot?.channelSnapshots.map(cloneManagedChannel),
        healthScore: detail.health.score,
        runtimeStatus: detail.health.status,
        connectedChannelCount,
        activeTaskCount,
        installedSkillCount: mappedSkills.length,
        readyToolCount,
        sectionCounts,
        sectionAvailability: buildSectionAvailability(detail, sectionCounts),
        channels: mappedChannels,
        tasks: mappedTasks,
        agents: mappedAgents,
        skills: mappedSkills,
        files: mappedFiles,
        llmProviders: mappedLlmProviders,
        memories: mappedMemories,
        tools: mappedTools,
      };
    }

    if (!instance || !config) {
      const [liveInstance, liveConfig, liveToken, liveLogs] = await Promise.all([
        this.dependencies.instanceService.getInstanceById(id),
        this.dependencies.instanceService.getInstanceConfig(id),
        this.dependencies.instanceService.getInstanceToken(id),
        this.dependencies.instanceService.getInstanceLogs(id),
      ]);

      if (!liveInstance || !liveConfig) {
        return null;
      }

      return {
        instance: liveInstance,
        config: liveConfig,
        token: liveToken || '',
        logs: liveLogs,
        detail: {
          instance: detail?.instance || {
            id: liveInstance.id,
            name: liveInstance.name,
            description: undefined,
            runtimeKind: 'custom',
            deploymentMode: 'remote',
            transportKind: 'customHttp',
            status: liveInstance.status === 'starting' ? 'starting' : liveInstance.status,
            isBuiltIn: false,
            isDefault: false,
            iconType: liveInstance.iconType,
            version: liveInstance.version,
            typeLabel: liveInstance.type,
            host: liveInstance.ip,
            port: Number.parseInt(liveConfig.port, 10) || null,
            baseUrl: null,
            websocketUrl: null,
            cpu: liveInstance.cpu,
            memory: liveInstance.memory,
            totalMemory: liveInstance.totalMemory,
            uptime: liveInstance.uptime,
            capabilities: ['chat', 'health'],
            storage: {
              provider: 'localFile',
              namespace: 'claw-studio',
            },
            config: {
              port: liveConfig.port,
              sandbox: liveConfig.sandbox,
              autoUpdate: liveConfig.autoUpdate,
              logLevel: liveConfig.logLevel,
              corsOrigins: liveConfig.corsOrigins,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastSeenAt: Date.now(),
          },
          config: {
            port: liveConfig.port,
            sandbox: liveConfig.sandbox,
            autoUpdate: liveConfig.autoUpdate,
            logLevel: liveConfig.logLevel,
            corsOrigins: liveConfig.corsOrigins,
          },
          logs: liveLogs,
          health: {
            score: liveInstance.status === 'online' ? 80 : 35,
            status: liveInstance.status === 'online' ? 'healthy' : liveInstance.status === 'offline' ? 'offline' : 'attention',
            checks: [],
            evaluatedAt: Date.now(),
          },
          lifecycle: {
            owner: 'remoteService',
            startStopSupported: false,
            configWritable: true,
            notes: ['Fallback detail projection.'],
          },
          storage: {
            status: 'planned',
            provider: 'localFile',
            namespace: 'claw-studio',
            durable: true,
            queryable: false,
            transactional: false,
            remote: false,
          },
          connectivity: {
            primaryTransport: 'customHttp',
            endpoints: [],
          },
          observability: {
            status: 'limited',
            logAvailable: Boolean(liveLogs),
            logPreview: liveLogs ? liveLogs.split('\n').filter(Boolean).slice(-5) : [],
            metricsSource: 'derived',
            lastSeenAt: Date.now(),
          },
          dataAccess: {
            routes: [
              {
                id: 'config',
                label: 'Configuration',
                scope: 'config',
                mode: 'metadataOnly',
                status: 'ready',
                target: 'studio.instances registry metadata',
                readonly: false,
                authoritative: false,
                detail: 'Fallback detail projects configuration from Claw Studio metadata.',
                source: 'integration',
              },
              {
                id: 'logs',
                label: 'Logs',
                scope: 'logs',
                mode: 'metadataOnly',
                status: liveLogs ? 'limited' : 'planned',
                target: null,
                readonly: true,
                authoritative: false,
                detail: 'Fallback detail only exposes derived log preview lines.',
                source: 'derived',
              },
            ],
          },
          artifacts: [
            {
              id: 'storage-binding',
              label: 'Storage Binding',
              kind: 'storageBinding',
              status: 'planned',
              location: 'claw-studio',
              readonly: false,
              detail: 'Fallback detail projects storage metadata only.',
              source: 'storage',
            },
          ],
          capabilities: [
            {
              id: 'chat',
              status: 'ready',
              detail: 'Fallback instance detail projection.',
              source: 'runtime',
            },
            {
              id: 'health',
              status: 'ready',
              detail: 'Fallback instance detail projection.',
              source: 'runtime',
            },
          ],
          officialRuntimeNotes: [],
        },
        managedConfigPath: null,
        managedChannels: undefined,
        healthScore: liveInstance.status === 'online' ? 80 : 35,
        runtimeStatus:
          liveInstance.status === 'online'
            ? 'healthy'
            : liveInstance.status === 'offline'
              ? 'offline'
              : 'attention',
        connectedChannelCount: 0,
        activeTaskCount: 0,
        installedSkillCount: 0,
        readyToolCount: 0,
        sectionCounts: {
          overview: 1,
          channels: 0,
          cronTasks: 0,
          llmProviders: 0,
          agents: 0,
          skills: 0,
          files: 0,
          memory: 0,
          tools: 0,
        },
        sectionAvailability: {
          overview: {
            status: 'ready',
            detail: 'Fallback overview is available.',
          },
          channels: {
            status: 'planned',
            detail: 'No channel adapter is configured for this instance yet.',
          },
          cronTasks: {
            status: 'planned',
            detail: 'No task adapter is configured for this instance yet.',
          },
          llmProviders: {
            status: 'planned',
            detail: 'No model adapter is configured for this instance yet.',
          },
          agents: {
            status: 'planned',
            detail: 'No agent adapter is configured for this instance yet.',
          },
          skills: {
            status: 'planned',
            detail: 'No skill adapter is configured for this instance yet.',
          },
          files: {
            status: 'planned',
            detail: 'No file adapter is configured for this instance yet.',
          },
          memory: {
            status: 'planned',
            detail: 'No memory adapter is configured for this instance yet.',
          },
          tools: {
            status: 'planned',
            detail: 'No tool adapter is configured for this instance yet.',
          },
        },
        channels: [],
        tasks: [],
        agents: [],
        skills: [],
        files: [],
        llmProviders: [],
        memories: [],
        tools: [],
      };
    }

    const mappedChannels: InstanceWorkbenchChannel[] = channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      status: channel.status,
      enabled: channel.enabled,
      fieldCount: channel.fields.length,
      configuredFieldCount: channel.fields.filter((field) => Boolean(field.value)).length,
      setupSteps: [...channel.setupGuide],
    }));

    const deliveryChannelNameMap = Object.fromEntries(
      mappedChannels.map((channel) => [channel.id, channel.name]),
    ) as Record<string, string>;
    const taskExecutions = await Promise.all(
      rawTasks.map(async (task) => {
        const executions = await this.dependencies.studioMockService.listTaskExecutions(task.id);
        return [task.id, executions] as const;
      }),
    );
    const taskExecutionsById = Object.fromEntries(
      taskExecutions,
    ) as Record<string, MockTaskExecutionHistoryEntry[]>;
    const mappedTasks: InstanceWorkbenchTask[] = rawTasks.map((task) => ({
      ...task,
      deliveryLabel:
        task.deliveryMode === 'none'
          ? undefined
          : deliveryChannelNameMap[task.deliveryChannel || ''] ||
            task.deliveryChannel ||
            undefined,
      latestExecution: taskExecutionsById[task.id]?.[0] || null,
    }));
    const mappedFiles: InstanceWorkbenchFile[] = files.map((file) => ({ ...file }));
    const mappedLlmProviders = llmProviders.map(mapLlmProvider);
    const mappedMemories = memories.map(mapMemoryEntry);
    const mappedTools = tools.map(mapTool);

    const connectedChannelCount = mappedChannels.filter(
      (channel) => channel.status === 'connected' && channel.enabled,
    ).length;
    const activeTaskCount = mappedTasks.filter((task) => task.status === 'active').length;
    const readyToolCount = mappedTools.filter((tool) => tool.status === 'ready').length;
    const healthScore = deriveRuntimeHealthScore(
      instance.cpu,
      instance.memory,
      instance.status,
      connectedChannelCount,
      activeTaskCount,
      skills.length,
    );

    return {
      instance,
      config,
      token: token || '',
      logs,
      detail: {
        instance: {
          id: instance.id,
          name: instance.name,
          description: undefined,
          runtimeKind: 'custom',
          deploymentMode: 'remote',
          transportKind: 'customHttp',
          status: instance.status === 'starting' ? 'starting' : instance.status,
          isBuiltIn: false,
          isDefault: false,
          iconType: instance.iconType,
          version: instance.version,
          typeLabel: instance.type,
          host: instance.ip,
          port: Number.parseInt(config.port, 10) || null,
          baseUrl: null,
          websocketUrl: null,
          cpu: instance.cpu,
          memory: instance.memory,
          totalMemory: instance.totalMemory,
          uptime: instance.uptime,
          capabilities: ['chat', 'health'],
          storage: {
            provider: 'localFile',
            namespace: 'claw-studio',
          },
          config: {
            port: config.port,
            sandbox: config.sandbox,
            autoUpdate: config.autoUpdate,
            logLevel: config.logLevel,
            corsOrigins: config.corsOrigins,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastSeenAt: Date.now(),
        },
        config: {
          port: config.port,
          sandbox: config.sandbox,
          autoUpdate: config.autoUpdate,
          logLevel: config.logLevel,
          corsOrigins: config.corsOrigins,
        },
        logs,
        health: {
          score: healthScore,
          status: healthScore >= 80 ? 'healthy' : healthScore >= 55 ? 'attention' : 'degraded',
          checks: [],
          evaluatedAt: Date.now(),
        },
        lifecycle: {
          owner: 'externalProcess',
          startStopSupported: false,
          configWritable: true,
          notes: ['Mock-backed detail projection.'],
        },
        storage: {
          status: 'planned',
          provider: 'localFile',
          namespace: 'claw-studio',
          durable: true,
          queryable: false,
          transactional: false,
          remote: false,
        },
        connectivity: {
          primaryTransport: 'customHttp',
          endpoints: [],
        },
        observability: {
          status: logs ? 'ready' : 'limited',
          logAvailable: Boolean(logs),
          logPreview: logs ? logs.split('\n').filter(Boolean).slice(-5) : [],
          metricsSource: 'derived',
          lastSeenAt: Date.now(),
        },
        dataAccess: {
          routes: [
            {
              id: 'config',
              label: 'Configuration',
              scope: 'config',
              mode: 'metadataOnly',
              status: 'ready',
              target: 'studio.instances registry metadata',
              readonly: false,
              authoritative: false,
              detail: 'Mock-backed detail projects configuration from Claw Studio metadata.',
              source: 'integration',
            },
            {
              id: 'logs',
              label: 'Logs',
              scope: 'logs',
              mode: 'metadataOnly',
              status: logs ? 'limited' : 'planned',
              target: null,
              readonly: true,
              authoritative: false,
              detail: 'Mock-backed detail only exposes derived log preview lines.',
              source: 'derived',
            },
          ],
        },
        artifacts: [
          {
            id: 'storage-binding',
            label: 'Storage Binding',
            kind: 'storageBinding',
            status: 'planned',
            location: 'claw-studio',
            readonly: false,
            detail: 'Mock-backed detail projects storage metadata only.',
            source: 'storage',
          },
        ],
        capabilities: [
          {
            id: 'chat',
            status: 'ready',
            detail: 'Mock-backed detail projection.',
            source: 'runtime',
          },
          {
            id: 'health',
            status: 'ready',
            detail: 'Mock-backed detail projection.',
            source: 'runtime',
          },
        ],
        officialRuntimeNotes: [],
      },
      managedConfigPath: null,
      managedChannels: undefined,
      healthScore,
      runtimeStatus: healthScore >= 80 ? 'healthy' : healthScore >= 55 ? 'attention' : 'degraded',
      connectedChannelCount,
      activeTaskCount,
      installedSkillCount: skills.length,
      readyToolCount,
      sectionCounts: {
        overview: 1,
        channels: mappedChannels.length,
        cronTasks: mappedTasks.length,
        llmProviders: mappedLlmProviders.length,
        agents: agents.length,
        skills: skills.length,
        files: mappedFiles.length,
        memory: mappedMemories.length,
        tools: mappedTools.length,
      },
      sectionAvailability: {
        overview: {
          status: 'ready',
          detail: 'Overview is available through the workbench projection.',
        },
        channels: {
          status: mappedChannels.length > 0 ? 'ready' : 'planned',
          detail:
            mappedChannels.length > 0
              ? 'Channel data is available for this instance workbench.'
              : 'Channel data is not configured for this instance yet.',
        },
        cronTasks: {
          status: mappedTasks.length > 0 ? 'ready' : 'planned',
          detail:
            mappedTasks.length > 0
              ? 'Task data is available for this instance workbench.'
              : 'Task data is not configured for this instance yet.',
        },
        llmProviders: {
          status: mappedLlmProviders.length > 0 ? 'ready' : 'planned',
          detail:
            mappedLlmProviders.length > 0
              ? 'Model provider data is available for this instance workbench.'
              : 'Model provider data is not configured for this instance yet.',
        },
        agents: {
          status: agents.length > 0 ? 'ready' : 'planned',
          detail:
            agents.length > 0
              ? 'Agent data is available for this instance workbench.'
              : 'Agent data is not configured for this instance yet.',
        },
        skills: {
          status: skills.length > 0 ? 'ready' : 'planned',
          detail:
            skills.length > 0
              ? 'Skill data is available for this instance workbench.'
              : 'Skill data is not configured for this instance yet.',
        },
        files: {
          status: mappedFiles.length > 0 ? 'ready' : 'planned',
          detail:
            mappedFiles.length > 0
              ? 'Runtime file data is available for this instance workbench.'
              : 'Runtime file data is not configured for this instance yet.',
        },
        memory: {
          status: mappedMemories.length > 0 ? 'ready' : 'planned',
          detail:
            mappedMemories.length > 0
              ? 'Memory data is available for this instance workbench.'
              : 'Memory data is not configured for this instance yet.',
        },
        tools: {
          status: mappedTools.length > 0 ? 'ready' : 'planned',
          detail:
            mappedTools.length > 0
              ? 'Tool data is available for this instance workbench.'
              : 'Tool data is not configured for this instance yet.',
        },
      },
      channels: mappedChannels,
      tasks: mappedTasks,
      agents: agents.map((agent) => mapAgent(agent, mappedTasks, skills)),
      skills,
      files: mappedFiles,
      llmProviders: mappedLlmProviders,
      memories: mappedMemories,
      tools: mappedTools,
    };
  }

  async createTask(instanceId: string, payload: Record<string, unknown>): Promise<void> {
    await studio.createInstanceTask(instanceId, payload);
  }

  async updateTask(
    instanceId: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await studio.updateInstanceTask(instanceId, id, payload);
  }

  async cloneTask(id: string, name?: string): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      await this.dependencies.studioApi.cloneInstanceTask(instanceId, id, name);
      return;
    }
    const cloned = await this.dependencies.studioMockService.cloneTask(id, name ? { name } : {});
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
  }

  async runTaskNow(id: string): Promise<InstanceWorkbenchTaskExecution> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const execution = await this.dependencies.studioApi.runInstanceTaskNow(instanceId, id);
      const current = this.backendTaskExecutionsById.get(id) || [];
      this.backendTaskExecutionsById.set(id, [cloneTaskExecution(execution), ...current]);
      return execution;
    }
    const execution = await this.dependencies.studioMockService.runTaskNow(id);
    if (!execution) {
      throw new Error('Failed to run task');
    }
    return execution;
  }

  async listTaskExecutions(id: string): Promise<InstanceWorkbenchTaskExecution[]> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      try {
        const executions = await this.dependencies.openClawGatewayClient.listWorkbenchCronRuns(
          instanceId,
          id,
        );
        this.backendTaskExecutionsById.set(id, executions.map(cloneTaskExecution));
        return executions;
      } catch {
        const executions = await this.dependencies.studioApi.listInstanceTaskExecutions(instanceId, id);
        this.backendTaskExecutionsById.set(
          id,
          executions.map(cloneTaskExecution),
        );
        return executions;
      }
    }
    return this.dependencies.studioMockService.listTaskExecutions(id);
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      await this.dependencies.studioApi.updateInstanceTaskStatus(instanceId, id, status);
      return;
    }
    const updated = await this.dependencies.studioMockService.updateTaskStatus(id, status);
    if (!updated) {
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(id: string): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const deleted = await this.dependencies.studioApi.deleteInstanceTask(instanceId, id);
      if (!deleted) {
        throw new Error('Failed to delete task');
      }
      this.openClawTaskInstanceById.delete(id);
      this.backendTaskExecutionsById.delete(id);
      return;
    }
    const deleted = await this.dependencies.studioMockService.deleteTask(id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
  }
}

export function createInstanceWorkbenchService(
  overrides: InstanceWorkbenchServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();
  return new InstanceWorkbenchService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    studioMockService: {
      ...defaults.studioMockService,
      ...(overrides.studioMockService || {}),
    },
    instanceService: {
      ...defaults.instanceService,
      ...(overrides.instanceService || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
  });
}

export const instanceWorkbenchService = createInstanceWorkbenchService();
