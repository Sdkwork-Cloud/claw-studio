import {
  openClawGatewayClient,
  studio,
  type OpenClawAgentFileResult,
  type OpenClawAgentFilesListResult,
  type OpenClawAgentsListResult,
  type OpenClawChannelStatusResult,
  type OpenClawConfigSnapshot,
  type OpenClawMemorySearchResult,
  type OpenClawModelRecord,
  type OpenClawSkillsStatusResult,
  type OpenClawToolsCatalogResult,
} from '@sdkwork/claw-infrastructure';
import { buildOpenClawCronTaskPayload, openClawConfigService } from '@sdkwork/claw-core';
import type {
  Agent,
  Skill,
  StudioInstanceCapabilitySnapshot,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchAgent,
  InstanceManagedOpenClawConfigInsights,
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
  normalizeOpenClawAgentId,
  parseOpenClawAgentFileId,
  summarizeMarkdown,
  titleCaseIdentifier,
  tokenEstimate,
  toIsoStringFromMs,
} from './openClawSupport.ts';
import { instanceService } from './instanceService.ts';

type ManagedOpenClawConfigSnapshot = Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>;
type ManagedOpenClawAgentSnapshot = ManagedOpenClawConfigSnapshot['agentSnapshots'][number];
type ManagedOpenClawChannelSnapshot = ManagedOpenClawConfigSnapshot['channelSnapshots'][number];
type ManagedOpenClawWebSearchConfig = ManagedOpenClawConfigSnapshot['webSearchConfig'];
type ManagedOpenClawAuthCooldownsConfig = ManagedOpenClawConfigSnapshot['authCooldownsConfig'];
type OpenClawChannelDefinition = ReturnType<typeof openClawConfigService.getChannelDefinitions>[number];
type RegistryInstanceRecord = NonNullable<Awaited<ReturnType<typeof instanceService.getInstanceById>>>;
type RegistryInstanceConfig = NonNullable<Awaited<ReturnType<typeof instanceService.getInstanceConfig>>>;

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
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

function mapManagedChannel(
  channel: ManagedOpenClawChannelSnapshot,
): InstanceWorkbenchChannel {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    status: channel.status,
    enabled: channel.enabled,
    configurationMode: channel.configurationMode,
    fieldCount: channel.fieldCount,
    configuredFieldCount: channel.configuredFieldCount,
    setupSteps: [...channel.setupSteps],
  };
}

function cloneManagedChannel(
  channel: ManagedOpenClawChannelSnapshot,
) {
  return {
    ...channel,
    setupSteps: [...channel.setupSteps],
    values: { ...channel.values },
    fields: channel.fields.map((field) => ({ ...field })),
  };
}

function cloneWorkbenchChannel(channel: InstanceWorkbenchChannel): InstanceWorkbenchChannel {
  return {
    ...channel,
    setupSteps: [...channel.setupSteps],
    accounts: channel.accounts?.map((account) => ({ ...account })),
  };
}

function cloneManagedWebSearchConfig(
  config: ManagedOpenClawWebSearchConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    providers: config.providers.map((provider) => ({ ...provider })),
  };
}

function cloneManagedAuthCooldownsConfig(
  config: ManagedOpenClawAuthCooldownsConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function mapOpenClawChannelDefinition(definition: OpenClawChannelDefinition): InstanceWorkbenchChannel {
  const configurationMode = definition.configurationMode || 'required';
  const enabled = configurationMode === 'none';

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    status: configurationMode === 'none' ? 'connected' : 'not_configured',
    enabled,
    configurationMode,
    fieldCount: definition.fields.length,
    configuredFieldCount: 0,
    setupSteps: [...definition.setupSteps],
  };
}

function buildOpenClawChannelCatalog(
  managedConfigSnapshot?: ManagedOpenClawConfigSnapshot | null,
): InstanceWorkbenchChannel[] {
  if (managedConfigSnapshot?.channelSnapshots.length) {
    return managedConfigSnapshot.channelSnapshots.map(mapManagedChannel);
  }

  return openClawConfigService.getChannelDefinitions().map(mapOpenClawChannelDefinition);
}

function mergeOpenClawChannelCollections(
  baseChannels: InstanceWorkbenchChannel[],
  overrideChannels: InstanceWorkbenchChannel[],
): InstanceWorkbenchChannel[] {
  const orderedIds: string[] = [];
  const mergedChannels = new Map<string, InstanceWorkbenchChannel>();

  const rememberOrder = (channelId: string) => {
    if (!orderedIds.includes(channelId)) {
      orderedIds.push(channelId);
    }
  };

  baseChannels.forEach((channel) => {
    rememberOrder(channel.id);
    mergedChannels.set(channel.id, cloneWorkbenchChannel(channel));
  });

  overrideChannels.forEach((channel) => {
    rememberOrder(channel.id);
    const baseChannel = mergedChannels.get(channel.id);

    if (!baseChannel) {
      mergedChannels.set(channel.id, cloneWorkbenchChannel(channel));
      return;
    }

    mergedChannels.set(channel.id, {
      id: channel.id,
      name: baseChannel.name || channel.name,
      description: channel.description || baseChannel.description,
      status: channel.status,
      enabled: channel.enabled,
      configurationMode: channel.configurationMode || baseChannel.configurationMode || 'required',
      fieldCount: Math.max(baseChannel.fieldCount, channel.fieldCount),
      configuredFieldCount:
        typeof channel.configuredFieldCount === 'number'
          ? channel.configuredFieldCount
          : baseChannel.configuredFieldCount,
      setupSteps:
        channel.setupSteps.length > 0 ? [...channel.setupSteps] : [...baseChannel.setupSteps],
      accounts:
        channel.accounts && channel.accounts.length > 0
          ? channel.accounts.map((account) => ({ ...account }))
          : baseChannel.accounts?.map((account) => ({ ...account })),
    });
  });

  return orderedIds
    .map((channelId) => mergedChannels.get(channelId))
    .filter(Boolean) as InstanceWorkbenchChannel[];
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

function mapLlmProvider(provider: InstanceWorkbenchLLMProvider): InstanceWorkbenchLLMProvider {
  return {
    ...provider,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

function mapManagedAgent(
  agentSnapshot: ManagedOpenClawAgentSnapshot,
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
    paramSources: { ...agentSnapshot.paramSources },
    configSource: 'managedConfig',
  };
}

function cloneTaskExecution(
  execution: InstanceWorkbenchTaskExecution,
): InstanceWorkbenchTaskExecution {
  return { ...execution };
}

function cloneWorkbenchRawDefinition(rawDefinition: Record<string, unknown> | undefined) {
  return rawDefinition
    ? JSON.parse(JSON.stringify(rawDefinition)) as Record<string, unknown>
    : undefined;
}

function isWorkbenchTaskScheduleMode(
  value: unknown,
): value is InstanceWorkbenchTask['scheduleMode'] {
  return value === 'interval' || value === 'datetime' || value === 'cron';
}

function isWorkbenchTaskActionType(
  value: unknown,
): value is InstanceWorkbenchTask['actionType'] {
  return value === 'message' || value === 'skill';
}

function isWorkbenchTaskStatus(
  value: unknown,
): value is InstanceWorkbenchTask['status'] {
  return value === 'active' || value === 'paused' || value === 'failed';
}

function isWorkbenchTaskSessionMode(
  value: unknown,
): value is InstanceWorkbenchTask['sessionMode'] {
  return value === 'isolated' || value === 'main' || value === 'current' || value === 'custom';
}

function isWorkbenchTaskWakeUpMode(
  value: unknown,
): value is InstanceWorkbenchTask['wakeUpMode'] {
  return value === 'immediate' || value === 'nextCycle';
}

function isWorkbenchTaskExecutionContent(
  value: unknown,
): value is InstanceWorkbenchTask['executionContent'] {
  return value === 'runAssistantTask' || value === 'sendPromptMessage';
}

function isWorkbenchTaskDeliveryMode(
  value: unknown,
): value is InstanceWorkbenchTask['deliveryMode'] {
  return value === 'publishSummary' || value === 'webhook' || value === 'none';
}

function isWorkbenchTaskThinking(
  value: unknown,
): value is InstanceWorkbenchTask['thinking'] {
  return (
    value === 'off' ||
    value === 'minimal' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'xhigh'
  );
}

function isWorkbenchTaskExecutionStatus(
  value: unknown,
): value is InstanceWorkbenchTaskExecution['status'] {
  return value === 'success' || value === 'failed' || value === 'running';
}

function isWorkbenchTaskExecutionTrigger(
  value: unknown,
): value is InstanceWorkbenchTaskExecution['trigger'] {
  return value === 'schedule' || value === 'manual' || value === 'clone';
}

function normalizeWorkbenchTaskExecution(
  execution: unknown,
  taskId: string,
): InstanceWorkbenchTaskExecution | null {
  if (!isRecord(execution)) {
    return null;
  }

  const startedAt = getStringValue(execution, ['startedAt']);
  const status = isWorkbenchTaskExecutionStatus(execution.status) ? execution.status : null;
  if (!startedAt || !status) {
    return null;
  }

  return {
    id: getStringValue(execution, ['id']) || `${taskId}-latest`,
    taskId: getStringValue(execution, ['taskId']) || taskId,
    status,
    trigger: isWorkbenchTaskExecutionTrigger(execution.trigger) ? execution.trigger : 'schedule',
    startedAt,
    finishedAt: getStringValue(execution, ['finishedAt']),
    summary: getStringValue(execution, ['summary']) || 'Task execution recorded.',
    details: getStringValue(execution, ['details']),
  };
}

function normalizeWorkbenchTask(task: unknown): InstanceWorkbenchTask | null {
  if (!isRecord(task)) {
    return null;
  }

  const id = getStringValue(task, ['id']);
  if (!id) {
    return null;
  }

  const scheduleConfig = getObjectValue(task, ['scheduleConfig']) || {};
  const agentId = getStringValue(task, ['agentId']);
  const rawDefinition = getObjectValue(task, ['rawDefinition']);
  const hasLatestExecution = Object.prototype.hasOwnProperty.call(task, 'latestExecution');
  const latestExecutionValue = hasLatestExecution ? task.latestExecution : undefined;

  return {
    ...(task as unknown as InstanceWorkbenchTask),
    id,
    name: getStringValue(task, ['name']) || titleCaseIdentifier(id),
    description: getStringValue(task, ['description']),
    prompt: getStringValue(task, ['prompt']) as InstanceWorkbenchTask['prompt'],
    schedule: getStringValue(task, ['schedule']) as InstanceWorkbenchTask['schedule'],
    scheduleMode: isWorkbenchTaskScheduleMode(task.scheduleMode)
      ? task.scheduleMode
      : (task.scheduleMode as InstanceWorkbenchTask['scheduleMode']),
    scheduleConfig: { ...scheduleConfig },
    cronExpression: getStringValue(task, ['cronExpression']),
    actionType: isWorkbenchTaskActionType(task.actionType)
      ? task.actionType
      : (task.actionType as InstanceWorkbenchTask['actionType']),
    status: isWorkbenchTaskStatus(task.status)
      ? task.status
      : (task.status as InstanceWorkbenchTask['status']),
    sessionMode: isWorkbenchTaskSessionMode(task.sessionMode)
      ? task.sessionMode
      : (task.sessionMode as InstanceWorkbenchTask['sessionMode']),
    customSessionId: getStringValue(task, ['customSessionId']),
    wakeUpMode: isWorkbenchTaskWakeUpMode(task.wakeUpMode)
      ? task.wakeUpMode
      : (task.wakeUpMode as InstanceWorkbenchTask['wakeUpMode']),
    executionContent: isWorkbenchTaskExecutionContent(task.executionContent)
      ? task.executionContent
      : (task.executionContent as InstanceWorkbenchTask['executionContent']),
    timeoutSeconds: getNumberValue(task, ['timeoutSeconds']),
    deleteAfterRun: getBooleanValue(task, ['deleteAfterRun']),
    agentId: agentId ? normalizeOpenClawAgentId(agentId) : undefined,
    model: getStringValue(task, ['model']),
    thinking: isWorkbenchTaskThinking(task.thinking)
      ? task.thinking
      : (task.thinking as InstanceWorkbenchTask['thinking']),
    lightContext: getBooleanValue(task, ['lightContext']),
    deliveryMode: isWorkbenchTaskDeliveryMode(task.deliveryMode)
      ? task.deliveryMode
      : (task.deliveryMode as InstanceWorkbenchTask['deliveryMode']),
    deliveryBestEffort: getBooleanValue(task, ['deliveryBestEffort']),
    deliveryChannel: getStringValue(task, ['deliveryChannel']),
    deliveryLabel: getStringValue(task, ['deliveryLabel']),
    recipient: getStringValue(task, ['recipient']),
    lastRun: getStringValue(task, ['lastRun']),
    nextRun: getStringValue(task, ['nextRun']),
    latestExecution: hasLatestExecution
      ? latestExecutionValue === null
        ? null
        : latestExecutionValue === undefined
          ? undefined
          : normalizeWorkbenchTaskExecution(latestExecutionValue, id)
      : undefined,
    rawDefinition: cloneWorkbenchRawDefinition(rawDefinition),
  };
}

function normalizeWorkbenchTaskCollection(tasks: InstanceWorkbenchTask[]): InstanceWorkbenchTask[] {
  const orderedIds: string[] = [];
  const normalizedTasks = new Map<string, InstanceWorkbenchTask>();

  tasks.forEach((task) => {
    const normalizedTask = normalizeWorkbenchTask(task);
    if (!normalizedTask) {
      return;
    }

    const current = normalizedTasks.get(normalizedTask.id);
    if (!current) {
      orderedIds.push(normalizedTask.id);
      normalizedTasks.set(normalizedTask.id, normalizedTask);
      return;
    }

    normalizedTasks.set(normalizedTask.id, mergeWorkbenchTasks(current, normalizedTask));
  });

  return orderedIds
    .map((taskId) => normalizedTasks.get(taskId))
    .filter(Boolean) as InstanceWorkbenchTask[];
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
    paramSources: agent.paramSources ? { ...agent.paramSources } : undefined,
  };
}

function normalizeWorkbenchAgent(agent: InstanceWorkbenchAgent): InstanceWorkbenchAgent {
  return {
    ...cloneWorkbenchAgent(agent),
    agent: {
      ...agent.agent,
      id: normalizeOpenClawAgentId(agent.agent.id),
    },
  };
}

function mergeWorkbenchAgents(
  baseAgent: InstanceWorkbenchAgent,
  overrideAgent: InstanceWorkbenchAgent,
): InstanceWorkbenchAgent {
  const normalizedBase = normalizeWorkbenchAgent(baseAgent);
  const normalizedOverride = normalizeWorkbenchAgent(overrideAgent);

  return {
    ...normalizedBase,
    ...normalizedOverride,
    agent: {
      ...normalizedBase.agent,
      ...normalizedOverride.agent,
      id: normalizedOverride.agent.id || normalizedBase.agent.id,
      name: normalizedOverride.agent.name || normalizedBase.agent.name,
      description: normalizedOverride.agent.description || normalizedBase.agent.description,
      avatar: normalizedOverride.agent.avatar || normalizedBase.agent.avatar,
      systemPrompt:
        normalizedOverride.agent.systemPrompt || normalizedBase.agent.systemPrompt,
      creator: normalizedOverride.agent.creator || normalizedBase.agent.creator,
    },
    focusAreas:
      normalizedOverride.focusAreas.length > 0
        ? [...normalizedOverride.focusAreas]
        : [...normalizedBase.focusAreas],
    automationFitScore:
      normalizedOverride.automationFitScore ?? normalizedBase.automationFitScore,
    model: normalizedOverride.model
      ? {
          primary: normalizedOverride.model.primary,
          fallbacks: [...normalizedOverride.model.fallbacks],
        }
      : normalizedBase.model
        ? {
            primary: normalizedBase.model.primary,
            fallbacks: [...normalizedBase.model.fallbacks],
          }
        : undefined,
    params: normalizedOverride.params
      ? { ...normalizedOverride.params }
      : normalizedBase.params
        ? { ...normalizedBase.params }
        : undefined,
    paramSources: normalizedOverride.paramSources
      ? { ...normalizedOverride.paramSources }
      : normalizedBase.paramSources
        ? { ...normalizedBase.paramSources }
        : undefined,
  };
}

function mergeOpenClawAgentCollections(
  baseAgents: InstanceWorkbenchAgent[],
  overrideAgents: InstanceWorkbenchAgent[],
): InstanceWorkbenchAgent[] {
  const orderedIds: string[] = [];
  const mergedAgents = new Map<string, InstanceWorkbenchAgent>();
  const baseAgentsById = new Map<string, InstanceWorkbenchAgent>();

  baseAgents.forEach((agent) => {
    const normalizedAgent = normalizeWorkbenchAgent(agent);
    baseAgentsById.set(normalizedAgent.agent.id, normalizedAgent);
  });

  overrideAgents.forEach((agent) => {
    const normalizedAgent = normalizeWorkbenchAgent(agent);
    orderedIds.push(normalizedAgent.agent.id);
    mergedAgents.set(
      normalizedAgent.agent.id,
      baseAgentsById.has(normalizedAgent.agent.id)
        ? mergeWorkbenchAgents(baseAgentsById.get(normalizedAgent.agent.id)!, normalizedAgent)
        : normalizedAgent,
    );
  });

  baseAgentsById.forEach((agent, agentId) => {
    if (!mergedAgents.has(agentId)) {
      orderedIds.push(agentId);
      mergedAgents.set(agentId, agent);
    }
  });

  return orderedIds
    .map((agentId) => mergedAgents.get(agentId))
    .filter(Boolean)
    .map((agent) => cloneWorkbenchAgent(agent!));
}

function buildManagedOpenClawAgents(
  agentSnapshots: ManagedOpenClawAgentSnapshot[],
  runtimeAgents: InstanceWorkbenchAgent[],
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
): InstanceWorkbenchAgent[] {
  const runtimeAgentsById = new Map(
    runtimeAgents.map((agent) => {
      const normalizedAgent = normalizeWorkbenchAgent(agent);
      return [normalizedAgent.agent.id, normalizedAgent] as const;
    }),
  );
  const managedAgents = agentSnapshots.map((agentSnapshot) =>
    mapManagedAgent(
      agentSnapshot,
      tasks,
      skills,
      runtimeAgentsById.get(normalizeOpenClawAgentId(agentSnapshot.id)),
    ),
  );
  const managedAgentIds = new Set(managedAgents.map((agent) => agent.agent.id));

  return [
    ...managedAgents,
    ...runtimeAgents
      .filter((agent) => !managedAgentIds.has(normalizeOpenClawAgentId(agent.agent.id)))
      .map(cloneWorkbenchAgent),
  ];
}

function cloneWorkbenchTask(task: InstanceWorkbenchTask): InstanceWorkbenchTask {
  const normalizedTask = normalizeWorkbenchTask(task);
  if (!normalizedTask) {
    return {
      ...(task as InstanceWorkbenchTask),
      scheduleConfig: {},
      latestExecution: null,
    };
  }

  const hasLatestExecution = Object.prototype.hasOwnProperty.call(
    normalizedTask,
    'latestExecution',
  );

  return {
    ...normalizedTask,
    scheduleConfig: { ...normalizedTask.scheduleConfig },
    latestExecution: hasLatestExecution
      ? normalizedTask.latestExecution
        ? cloneTaskExecution(normalizedTask.latestExecution)
        : normalizedTask.latestExecution
      : undefined,
    rawDefinition: cloneWorkbenchRawDefinition(normalizedTask.rawDefinition),
  };
}

function mergeWorkbenchTasks(
  baseTask: InstanceWorkbenchTask,
  overrideTask: InstanceWorkbenchTask,
): InstanceWorkbenchTask {
  const mergedTask = {
    ...baseTask,
    ...overrideTask,
    id: getStringValue(overrideTask, ['id']) || baseTask.id,
    name: getStringValue(overrideTask, ['name']) || baseTask.name,
    description: getStringValue(overrideTask, ['description']) || baseTask.description,
    prompt: getStringValue(overrideTask, ['prompt']) || baseTask.prompt,
    schedule: getStringValue(overrideTask, ['schedule']) || baseTask.schedule,
    scheduleMode: isWorkbenchTaskScheduleMode(overrideTask.scheduleMode)
      ? overrideTask.scheduleMode
      : baseTask.scheduleMode,
    scheduleConfig: {
      ...baseTask.scheduleConfig,
      ...(isRecord(overrideTask.scheduleConfig) ? overrideTask.scheduleConfig : {}),
    },
    cronExpression: getStringValue(overrideTask, ['cronExpression']) || baseTask.cronExpression,
    actionType: isWorkbenchTaskActionType(overrideTask.actionType)
      ? overrideTask.actionType
      : baseTask.actionType,
    status: isWorkbenchTaskStatus(overrideTask.status) ? overrideTask.status : baseTask.status,
    sessionMode: isWorkbenchTaskSessionMode(overrideTask.sessionMode)
      ? overrideTask.sessionMode
      : baseTask.sessionMode,
    customSessionId: getStringValue(overrideTask, ['customSessionId']) || baseTask.customSessionId,
    wakeUpMode: isWorkbenchTaskWakeUpMode(overrideTask.wakeUpMode)
      ? overrideTask.wakeUpMode
      : baseTask.wakeUpMode,
    executionContent: isWorkbenchTaskExecutionContent(overrideTask.executionContent)
      ? overrideTask.executionContent
      : baseTask.executionContent,
    timeoutSeconds:
      getNumberValue(overrideTask, ['timeoutSeconds']) ?? baseTask.timeoutSeconds,
    deleteAfterRun:
      getBooleanValue(overrideTask, ['deleteAfterRun']) ?? baseTask.deleteAfterRun,
    agentId:
      (getStringValue(overrideTask, ['agentId'])
        ? normalizeOpenClawAgentId(getStringValue(overrideTask, ['agentId']))
        : undefined) || baseTask.agentId,
    model: getStringValue(overrideTask, ['model']) || baseTask.model,
    thinking: isWorkbenchTaskThinking(overrideTask.thinking)
      ? overrideTask.thinking
      : baseTask.thinking,
    lightContext:
      getBooleanValue(overrideTask, ['lightContext']) ?? baseTask.lightContext,
    deliveryMode: isWorkbenchTaskDeliveryMode(overrideTask.deliveryMode)
      ? overrideTask.deliveryMode
      : baseTask.deliveryMode,
    deliveryBestEffort:
      getBooleanValue(overrideTask, ['deliveryBestEffort']) ?? baseTask.deliveryBestEffort,
    deliveryChannel:
      getStringValue(overrideTask, ['deliveryChannel']) || baseTask.deliveryChannel,
    deliveryLabel:
      getStringValue(overrideTask, ['deliveryLabel']) || baseTask.deliveryLabel,
    recipient: getStringValue(overrideTask, ['recipient']) || baseTask.recipient,
    lastRun: getStringValue(overrideTask, ['lastRun']) || baseTask.lastRun,
    nextRun: getStringValue(overrideTask, ['nextRun']) || baseTask.nextRun,
    latestExecution:
      overrideTask.latestExecution === undefined
        ? baseTask.latestExecution
        : overrideTask.latestExecution
          ? cloneTaskExecution(overrideTask.latestExecution)
          : overrideTask.latestExecution,
    rawDefinition:
      cloneWorkbenchRawDefinition(overrideTask.rawDefinition) ||
      cloneWorkbenchRawDefinition(baseTask.rawDefinition),
  } satisfies InstanceWorkbenchTask;

  return cloneWorkbenchTask(mergedTask);
}

function mergeOpenClawTaskCollections(
  baseTasks: InstanceWorkbenchTask[],
  overrideTasks: InstanceWorkbenchTask[],
): InstanceWorkbenchTask[] {
  const normalizedBaseTasks = normalizeWorkbenchTaskCollection(baseTasks);
  const normalizedOverrideTasks = normalizeWorkbenchTaskCollection(overrideTasks);
  const orderedIds: string[] = [];
  const mergedTasks = new Map<string, InstanceWorkbenchTask>();

  normalizedOverrideTasks.forEach((task) => {
    const baseTask = normalizedBaseTasks.find((entry) => entry.id === task.id);
    orderedIds.push(task.id);
    mergedTasks.set(
      task.id,
      baseTask ? mergeWorkbenchTasks(baseTask, task) : cloneWorkbenchTask(task),
    );
  });

  normalizedBaseTasks.forEach((task) => {
    if (!mergedTasks.has(task.id)) {
      orderedIds.push(task.id);
      mergedTasks.set(task.id, cloneWorkbenchTask(task));
    }
  });

  return orderedIds
    .map((taskId) => mergedTasks.get(taskId))
    .filter(Boolean) as InstanceWorkbenchTask[];
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
  const mappedTasks = normalizeWorkbenchTaskCollection(workbench.cronTasks.tasks);
  const mappedSkills = workbench.skills.map((skill) => ({ ...skill }));
  const runtimeAgents: InstanceWorkbenchAgent[] = workbench.agents.map(
    ({ agent, focusAreas, automationFitScore }) => ({
      agent: {
        ...agent,
        id: normalizeOpenClawAgentId(agent.id),
      },
      focusAreas: [...focusAreas],
      automationFitScore,
      configSource: 'runtime' as const,
    }),
  );
  const mappedAgents: InstanceWorkbenchAgent[] =
    (managedConfigSnapshot?.agentSnapshots.length || 0) > 0
      ? buildManagedOpenClawAgents(
          managedConfigSnapshot!.agentSnapshots,
          runtimeAgents,
          mappedTasks,
          mappedSkills,
        )
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
    config: buildManagedConfigSectionCount(openClawConfigService.resolveInstanceConfigPath(detail)),
  } as const;

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    managedConfigPath: openClawConfigService.resolveInstanceConfigPath(detail),
    managedChannels: managedConfigSnapshot?.channelSnapshots.map(cloneManagedChannel),
    managedConfigInsights: buildManagedConfigInsights(managedConfigSnapshot),
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
    config:
      counts.config > 0
        ? {
            status: 'ready',
            detail:
              'The authoritative OpenClaw config file is attached and can be inspected from this workbench.',
          }
        : {
            status: 'planned',
            detail:
              'This instance does not currently expose an attached OpenClaw config file for structured configuration inspection.',
          },
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
    searchMemory(
      instanceId: string,
      args: { query: string; maxResults?: number; minScore?: number },
    ): Promise<OpenClawMemorySearchResult>;
    getDoctorMemoryStatus(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
    listWorkbenchCronJobs(instanceId: string): Promise<InstanceWorkbenchTask[]>;
    listWorkbenchCronRuns(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution[]>;
    addCronJob(instanceId: string, payload: Record<string, unknown>): Promise<{ id?: string }>;
    updateCronJob(
      instanceId: string,
      taskId: string,
      patch: Record<string, unknown>,
    ): Promise<{ id?: string }>;
    removeCronJob(instanceId: string, taskId: string): Promise<boolean>;
    runCronJob(
      instanceId: string,
      taskId: string,
    ): Promise<{ ok?: boolean; enqueued?: boolean; runId?: string }>;
  };
}

function toCreateTaskInput(
  task: InstanceWorkbenchTask,
  overrides: Partial<InstanceWorkbenchTask> = {},
) {
  return {
    name: overrides.name ?? task.name,
    description: overrides.description ?? task.description,
    prompt: overrides.prompt ?? task.prompt,
    schedule: overrides.schedule ?? task.schedule,
    scheduleMode: overrides.scheduleMode ?? task.scheduleMode,
    scheduleConfig: overrides.scheduleConfig ?? task.scheduleConfig,
    cronExpression: overrides.cronExpression ?? task.cronExpression,
    actionType: overrides.actionType ?? task.actionType,
    status: overrides.status ?? task.status,
    sessionMode: overrides.sessionMode ?? task.sessionMode,
    customSessionId: overrides.customSessionId ?? task.customSessionId,
    wakeUpMode: overrides.wakeUpMode ?? task.wakeUpMode,
    executionContent: overrides.executionContent ?? task.executionContent,
    timeoutSeconds: overrides.timeoutSeconds ?? task.timeoutSeconds,
    deleteAfterRun: overrides.deleteAfterRun ?? task.deleteAfterRun,
    agentId: overrides.agentId ?? task.agentId,
    model: overrides.model ?? task.model,
    thinking: overrides.thinking ?? task.thinking,
    lightContext: overrides.lightContext ?? task.lightContext,
    deliveryMode: overrides.deliveryMode ?? task.deliveryMode,
    deliveryBestEffort: overrides.deliveryBestEffort ?? task.deliveryBestEffort,
    deliveryChannel: overrides.deliveryChannel ?? task.deliveryChannel,
    recipient: overrides.recipient ?? task.recipient,
    lastRun: overrides.lastRun ?? task.lastRun,
    nextRun: overrides.nextRun ?? task.nextRun,
  };
}

export interface InstanceWorkbenchServiceDependencyOverrides {
  studioApi?: Partial<InstanceWorkbenchServiceDependencies['studioApi']>;
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
      searchMemory: (instanceId, args) => openClawGatewayClient.searchMemory(instanceId, args),
      getDoctorMemoryStatus: (instanceId, args) =>
        openClawGatewayClient.getDoctorMemoryStatus(instanceId, args),
      listWorkbenchCronJobs: (instanceId) => openClawGatewayClient.listWorkbenchCronJobs(instanceId),
      listWorkbenchCronRuns: (instanceId, taskId) =>
        openClawGatewayClient.listWorkbenchCronRuns(instanceId, taskId),
      addCronJob: (instanceId, payload) => openClawGatewayClient.addCronJob(instanceId, payload as never),
      updateCronJob: (instanceId, taskId, patch) =>
        openClawGatewayClient.updateCronJob(instanceId, taskId, patch as never),
      removeCronJob: (instanceId, taskId) => openClawGatewayClient.removeCronJob(instanceId, taskId),
      runCronJob: (instanceId, taskId) => openClawGatewayClient.runCronJob(instanceId, taskId),
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

type OpenClawInstanceDetailRecord = StudioInstanceDetailRecord & {
  instance: StudioInstanceDetailRecord['instance'] & {
    runtimeKind: 'openclaw';
  };
};

function isOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
): detail is OpenClawInstanceDetailRecord {
  return detail?.instance.runtimeKind === 'openclaw';
}

function isProviderCenterManagedOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return detail?.instance.runtimeKind === 'openclaw' && detail.instance.deploymentMode !== 'remote';
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
    config: 0,
  };
}

function buildManagedConfigSectionCount(managedConfigPath: string | null | undefined) {
  return managedConfigPath ? 1 : 0;
}

function buildManagedConfigInsights(
  managedConfigSnapshot: ManagedOpenClawConfigSnapshot | null | undefined,
): InstanceManagedOpenClawConfigInsights | null {
  if (!managedConfigSnapshot) {
    return null;
  }

  const root = managedConfigSnapshot.root;
  const sessionsVisibility = getStringValue(root, ['tools', 'sessions', 'visibility']);

  return {
    defaultAgentId:
      managedConfigSnapshot.agentSnapshots.find((agent) => agent.isDefault)?.id || null,
    defaultModelRef: getStringValue(root, ['agents', 'defaults', 'model', 'primary']) || null,
    sessionsVisibility:
      sessionsVisibility === 'self' ||
      sessionsVisibility === 'tree' ||
      sessionsVisibility === 'agent' ||
      sessionsVisibility === 'all'
        ? sessionsVisibility
        : null,
    agentToAgentEnabled: Boolean(getBooleanValue(root, ['tools', 'agentToAgent', 'enabled'])),
    agentToAgentAllow: (getArrayValue(root, ['tools', 'agentToAgent', 'allow']) || [])
      .filter(isNonEmptyString)
      .map((value) => value.trim()),
  };
}

function buildOpenClawSnapshotFromSections(
  detail: StudioInstanceDetailRecord,
  sections: OpenClawGatewaySections,
): InstanceWorkbenchSnapshot {
  const normalizedTasks = normalizeWorkbenchTaskCollection(sections.tasks);
  const connectedChannelCount = sections.channels.filter(
    (channel) => channel.status === 'connected' && channel.enabled,
  ).length;
  const activeTaskCount = normalizedTasks.filter((task) => task.status === 'active').length;
  const readyToolCount = sections.tools.filter((tool) => tool.status === 'ready').length;
  const sectionCounts = buildOpenClawSectionCounts(detail, {
    ...sections,
    tasks: normalizedTasks,
  });
  const capabilityMap = getCapabilityMap(detail);

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
    sectionAvailability: {
      ...buildSectionAvailability(detail, {
        channels: sections.channels.length,
        cronTasks: normalizedTasks.length,
        llmProviders: sections.llmProviders.length,
        agents: sections.agents.length,
        skills: sections.skills.length,
        files: sections.files.length,
        memory: sections.memories.length,
        tools: sections.tools.length,
        config: 0,
      }),
      files:
        sections.files.length > 0
          ? {
              status: 'ready',
              detail: 'Runtime file data is available for this instance workbench.',
            }
          : resolveCapabilityAvailability(capabilityMap.get('files')),
    },
    channels: sections.channels,
    tasks: normalizedTasks.map(cloneWorkbenchTask),
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
    channels: mergeOpenClawChannelCollections(base.channels, live.channels),
    tasks: mergeOpenClawTaskCollections(base.tasks, live.tasks),
    llmProviders: live.llmProviders.length > 0 ? live.llmProviders : base.llmProviders,
    agents: mergeOpenClawAgentCollections(base.agents, live.agents),
    skills: live.skills.length > 0 ? live.skills : base.skills,
    files: base.files.length > 0 ? base.files : live.files,
    memories: base.memories.length > 0 ? base.memories : live.memories,
    tools: live.tools.length > 0 ? live.tools : base.tools,
  });
}

function finalizeOpenClawSnapshot(
  detail: StudioInstanceDetailRecord,
  snapshot: InstanceWorkbenchSnapshot,
  managedConfigPath: string | null,
  managedConfigSnapshot: ManagedOpenClawConfigSnapshot | null,
): InstanceWorkbenchSnapshot {
  const configSectionCount = buildManagedConfigSectionCount(managedConfigPath);
  const llmProviders =
    isProviderCenterManagedOpenClawDetail(detail) &&
    (managedConfigSnapshot?.providerSnapshots.length || 0) > 0
      ? managedConfigSnapshot!.providerSnapshots.map(mapManagedProvider)
      : snapshot.llmProviders;
  const agents =
    (managedConfigSnapshot?.agentSnapshots.length || 0) > 0
      ? buildManagedOpenClawAgents(
          managedConfigSnapshot!.agentSnapshots,
          snapshot.agents,
          snapshot.tasks,
          snapshot.skills,
        )
      : snapshot.agents.map(cloneWorkbenchAgent);
  const channels = mergeOpenClawChannelCollections(
    buildOpenClawChannelCatalog(managedConfigSnapshot),
    snapshot.channels,
  );
  const finalizedSnapshot = buildOpenClawSnapshotFromSections(detail, {
    channels,
    tasks: snapshot.tasks,
    agents,
    skills: snapshot.skills,
    files: snapshot.files,
    llmProviders,
    memories: snapshot.memories,
    tools: snapshot.tools,
  });

  return {
    ...finalizedSnapshot,
    managedConfigPath,
    managedChannels: managedConfigSnapshot?.channelSnapshots.map(cloneManagedChannel),
    managedConfigInsights: buildManagedConfigInsights(managedConfigSnapshot),
    managedWebSearchConfig: cloneManagedWebSearchConfig(managedConfigSnapshot?.webSearchConfig),
    managedAuthCooldownsConfig: cloneManagedAuthCooldownsConfig(
      managedConfigSnapshot?.authCooldownsConfig,
    ),
    sectionCounts: {
      ...finalizedSnapshot.sectionCounts,
      config: configSectionCount,
    },
    sectionAvailability: {
      ...finalizedSnapshot.sectionAvailability,
      config: buildSectionAvailability(detail, {
        channels: finalizedSnapshot.sectionCounts.channels,
        cronTasks: finalizedSnapshot.sectionCounts.cronTasks,
        llmProviders: finalizedSnapshot.sectionCounts.llmProviders,
        agents: finalizedSnapshot.sectionCounts.agents,
        skills: finalizedSnapshot.sectionCounts.skills,
        files: finalizedSnapshot.sectionCounts.files,
        memory: finalizedSnapshot.sectionCounts.memory,
        tools: finalizedSnapshot.sectionCounts.tools,
        config: configSectionCount,
      }).config,
    },
  };
}

function normalizeChannelConnectionStatus(
  value: unknown,
): InstanceWorkbenchChannel['status'] | null {
  return value === 'connected' || value === 'disconnected' || value === 'not_configured'
    ? value
    : null;
}

function formatChannelAccountState(status: InstanceWorkbenchChannel['status']) {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    default:
      return 'not configured';
  }
}

function buildOpenClawChannelAccounts(
  status: OpenClawChannelStatusResult,
  channelId: string,
  rawChannel: Record<string, unknown>,
): NonNullable<InstanceWorkbenchChannel['accounts']> {
  const embeddedAccounts = getObjectValue(rawChannel, ['accounts']) || {};
  const runtimeAccounts = getObjectValue(status, ['channelAccounts', channelId]) || {};
  const accountIds = Array.from(
    new Set([...Object.keys(embeddedAccounts), ...Object.keys(runtimeAccounts)]),
  ).sort((left, right) => left.localeCompare(right));

  return accountIds
    .map((accountId) => {
      const embedded = getRecordValue(embeddedAccounts, [accountId]) || {};
      const runtime = getRecordValue(runtimeAccounts, [accountId]) || {};
      const configured =
        (getBooleanValue(runtime, ['configured']) ??
          getBooleanValue(embedded, ['configured']) ??
          false) ||
        Object.keys(getObjectValue(runtime, ['fields']) || {}).length > 0 ||
        Object.keys(getObjectValue(embedded, ['fields']) || {}).length > 0;
      const enabled =
        getBooleanValue(runtime, ['enabled']) ??
        getBooleanValue(embedded, ['enabled']) ??
        configured;
      const normalizedStatus =
        normalizeChannelConnectionStatus(getStringValue(runtime, ['status'])) ||
        normalizeChannelConnectionStatus(getStringValue(embedded, ['status'])) ||
        (configured ? (enabled ? 'connected' : 'disconnected') : 'not_configured');

      return {
        id: accountId,
        name:
          getStringValue(runtime, ['label']) ||
          getStringValue(runtime, ['name']) ||
          getStringValue(embedded, ['label']) ||
          getStringValue(embedded, ['name']) ||
          titleCaseIdentifier(accountId),
        status: normalizedStatus,
        enabled,
        configured,
        detail:
          getStringValue(runtime, ['detail']) ||
          getStringValue(runtime, ['message']) ||
          getStringValue(embedded, ['detail']) ||
          undefined,
      };
    })
    .filter((account) => account.id.length > 0);
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
      const isConfigurationFree = channelId === 'sdkworkchat';
      const rawChannel = rawChannels[channelId];
      if (!isRecord(rawChannel)) {
        return null;
      }

      const channelName = status.channelLabels?.[channelId] || titleCaseIdentifier(channelId);
      const rawFields = getObjectValue(rawChannel, ['fields']) || {};
      const accounts = buildOpenClawChannelAccounts(status, channelId, rawChannel);
      const fieldCount = Object.keys(rawFields).length;
      const accountCount = accounts.length;
      const connectedAccountCount = accounts.filter((account) => account.status === 'connected').length;
      const configuredFieldCount = Object.values(rawFields).filter((value) => isConfiguredValue(value)).length;
      const enabled = getBooleanValue(rawChannel, ['enabled']) ?? false;
      const configured =
        (getBooleanValue(rawChannel, ['configured']) ?? false) ||
        configuredFieldCount > 0 ||
        accountCount > 0;
      const setupSteps = isConfigurationFree
        ? [
            'Download the Sdkwork Chat app or open the existing Sdkwork Chat workspace.',
            enabled
              ? 'Sdkwork Chat delivery is ready for runtime handoff.'
              : 'Enable the channel when this runtime should deliver into Sdkwork Chat.',
          ]
        : accounts.length > 0
          ? [
              `${channelName} runtime reports ${connectedAccountCount}/${accountCount} connected accounts.`,
              ...accounts.map(
                (account) =>
                  `${account.name} (${account.id}): ${formatChannelAccountState(account.status)}${
                    account.detail ? ` - ${account.detail}` : ''
                  }`,
              ),
            ]
        : configured
          ? [
              `${channelName} channel is configured for the gateway runtime.`,
              enabled
                ? 'Channel is enabled for runtime delivery.'
                : 'Enable the channel after validating connectivity.',
            ]
          : [
              `Configure credentials or routing for ${channelName}.`,
              'Add at least one account or destination target.',
            ];

      return {
        id: channelId,
        name: channelName,
        description:
          status.channelDetailLabels?.[channelId] ||
          (accounts.length > 0
            ? `${channelName} integration managed by the OpenClaw gateway. Accounts: ${accounts
                .map(
                  (account) =>
                    `${account.name} (${formatChannelAccountState(account.status)})`,
                )
                .join(', ')}.`
            : `${channelName} integration managed by the OpenClaw gateway.`),
        status: isConfigurationFree
          ? enabled
            ? 'connected'
            : 'disconnected'
          : configured
            ? enabled
              ? 'connected'
              : 'disconnected'
            : 'not_configured',
        enabled,
        configurationMode: isConfigurationFree ? 'none' : 'required',
        fieldCount: isConfigurationFree ? 0 : Math.max(fieldCount, accountCount, configured ? 1 : 0),
        configuredFieldCount: isConfigurationFree
          ? 0
          : configured
            ? Math.max(configuredFieldCount, accountCount, 1)
            : 0,
        setupSteps,
        accounts,
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

function mergeUniqueValues(current: string[] | undefined, next: string[] | undefined) {
  const merged = [...(current || [])];

  (next || []).forEach((value) => {
    if (value && !merged.includes(value)) {
      merged.push(value);
    }
  });

  return merged.length > 0 ? merged : undefined;
}

function mergeToolStatus(
  current: InstanceWorkbenchTool['status'],
  next: InstanceWorkbenchTool['status'],
): InstanceWorkbenchTool['status'] {
  const priority = {
    ready: 0,
    beta: 1,
    restricted: 2,
  } as const;

  return priority[next] > priority[current] ? next : current;
}

function buildOpenClawTools(
  catalog: OpenClawToolsCatalogResult,
  agentNameById: ReadonlyMap<string, string> = new Map(),
): InstanceWorkbenchTool[] {
  const toolMap = new Map<string, InstanceWorkbenchTool>();
  const scopedAgentIds =
    typeof catalog.agentId === 'string' && catalog.agentId.trim()
      ? [normalizeOpenClawAgentId(catalog.agentId)]
      : [];
  const scopedAgentNames = scopedAgentIds
    .map((agentId) => agentNameById.get(agentId) || titleCaseIdentifier(agentId))
    .filter((value) => value.length > 0);

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
        agentIds: scopedAgentIds.length > 0 ? [...scopedAgentIds] : undefined,
        agentNames: scopedAgentNames.length > 0 ? [...scopedAgentNames] : undefined,
      });
    });
  });

  return [...toolMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildOpenClawScopedTools(
  catalogs: OpenClawToolsCatalogResult[],
  agents: InstanceWorkbenchAgent[],
): InstanceWorkbenchTool[] {
  const toolMap = new Map<string, InstanceWorkbenchTool>();
  const agentNameById = new Map(
    agents.map((agent) => [agent.agent.id, agent.agent.name] as const),
  );

  catalogs.forEach((catalog) => {
    buildOpenClawTools(catalog, agentNameById).forEach((tool) => {
      const current = toolMap.get(tool.id);
      if (!current) {
        toolMap.set(tool.id, {
          ...tool,
          agentIds: tool.agentIds ? [...tool.agentIds] : undefined,
          agentNames: tool.agentNames ? [...tool.agentNames] : undefined,
        });
        return;
      }

      toolMap.set(tool.id, {
        ...current,
        status: mergeToolStatus(current.status, tool.status),
        agentIds: mergeUniqueValues(current.agentIds, tool.agentIds),
        agentNames: mergeUniqueValues(current.agentNames, tool.agentNames),
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

function mapOpenClawFileEntryToWorkbenchFile(params: {
  agent: InstanceWorkbenchAgent;
  entry: Record<string, unknown>;
  workspace?: string;
  content?: string;
}): InstanceWorkbenchFile | null {
  const entryPath =
    typeof params.entry.path === 'string' && params.entry.path.trim()
      ? params.entry.path.trim()
      : null;
  const requestPath = deriveOpenClawFileRequestPath(
    typeof params.entry.name === 'string' ? params.entry.name : null,
    entryPath,
    params.workspace,
  );
  if (!requestPath) {
    return null;
  }

  const displayName = getWorkbenchPathBasename(requestPath) || requestPath;
  const fallbackPath =
    (params.workspace ? `${params.workspace.replace(/\/+$/, '')}/${requestPath}` : '') ||
    `/${params.agent.agent.id}/${requestPath}`;
  const path = entryPath || fallbackPath;
  const content =
    typeof params.content === 'string'
      ? params.content
      : typeof params.entry.content === 'string'
        ? params.entry.content
        : '';

  return {
    id: buildOpenClawAgentFileId(params.agent.agent.id, requestPath),
    name: displayName,
    path,
    category: inferOpenClawFileCategory(requestPath, path),
    language: inferLanguageFromPath(path),
    size: formatSize(typeof params.entry.size === 'number' ? params.entry.size : undefined),
    updatedAt: toIsoStringFromMs(
      typeof params.entry.updatedAtMs === 'number' ? params.entry.updatedAtMs : undefined,
    ) || 'Unknown',
    status: params.entry.missing === true ? 'missing' : 'synced',
    description: `${requestPath} workspace file for ${params.agent.agent.name}.`,
    content,
    isReadonly: false,
  };
}

function normalizeOpenClawFilePath(path?: string | null) {
  if (typeof path !== 'string') {
    return null;
  }

  const normalized = path.replace(/\\/g, '/').trim();
  if (!normalized) {
    return null;
  }

  if (normalized === '/') {
    return normalized;
  }

  return normalized.replace(/\/+$/, '');
}

function isRootedOpenClawFilePath(path: string) {
  return (
    path.startsWith('/') ||
    /^[A-Za-z]:\//.test(path) ||
    path.startsWith('//')
  );
}

function shouldCompareOpenClawPathCaseInsensitively(path: string) {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('//');
}

function normalizeOpenClawComparablePath(path: string) {
  return shouldCompareOpenClawPathCaseInsensitively(path) ? path.toLowerCase() : path;
}

function trimComparableOpenClawPathPrefix(path: string, prefix: string) {
  const comparablePath = normalizeOpenClawComparablePath(path);
  const comparablePrefix = normalizeOpenClawComparablePath(prefix);

  if (comparablePath === comparablePrefix) {
    return '';
  }

  if (!comparablePath.startsWith(`${comparablePrefix}/`)) {
    return null;
  }

  return path.slice(prefix.length + 1);
}

function getWorkbenchPathBasename(path: string) {
  return path.split('/').filter(Boolean).slice(-1)[0] || path;
}

function trimOpenClawWorkspacePrefix(path: string | null, workspace?: string) {
  const normalizedPath = normalizeOpenClawFilePath(path);
  const normalizedWorkspace = normalizeOpenClawFilePath(workspace);

  if (!normalizedPath || !normalizedWorkspace) {
    return null;
  }

  const relativePath = trimComparableOpenClawPathPrefix(normalizedPath, normalizedWorkspace);
  if (relativePath === '') {
    return null;
  }

  if (relativePath === null) {
    return null;
  }

  return relativePath;
}

function normalizeOpenClawRequestPath(name?: string | null) {
  const normalizedName = normalizeOpenClawFilePath(name);
  if (!normalizedName) {
    return null;
  }

  return normalizedName.replace(/^\/+/, '');
}

function deriveOpenClawFileRequestPath(
  name: string | null,
  path: string | null,
  workspace?: string,
) {
  const relativeFromWorkspace = trimOpenClawWorkspacePrefix(path, workspace);
  if (relativeFromWorkspace) {
    return relativeFromWorkspace;
  }

  const normalizedPath = normalizeOpenClawFilePath(path);
  if (normalizedPath && !isRootedOpenClawFilePath(normalizedPath)) {
    return normalizedPath;
  }

  const normalizedName = normalizeOpenClawRequestPath(name);
  if (normalizedName) {
    return normalizedName;
  }

  if (!normalizedPath) {
    return null;
  }

  return getWorkbenchPathBasename(normalizedPath);
}

function buildDetailOnlyWorkbenchSnapshot(
  detail: StudioInstanceDetailRecord,
  managedConfigPath: string | null = null,
  managedConfigSnapshot: ManagedOpenClawConfigSnapshot | null = null,
): InstanceWorkbenchSnapshot {
  const emptySectionCounts = {
    channels: 0,
    cronTasks: 0,
    llmProviders: 0,
    agents: 0,
    skills: 0,
    files: 0,
    memory: 0,
    tools: 0,
    config: buildManagedConfigSectionCount(managedConfigPath),
  } as const;

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    managedConfigPath,
    managedChannels: managedConfigSnapshot?.channelSnapshots.map(cloneManagedChannel),
    managedConfigInsights: buildManagedConfigInsights(managedConfigSnapshot),
    managedWebSearchConfig: cloneManagedWebSearchConfig(managedConfigSnapshot?.webSearchConfig),
    managedAuthCooldownsConfig: cloneManagedAuthCooldownsConfig(
      managedConfigSnapshot?.authCooldownsConfig,
    ),
    healthScore: detail.health.score,
    runtimeStatus: detail.health.status,
    connectedChannelCount: 0,
    activeTaskCount: 0,
    installedSkillCount: 0,
    readyToolCount: 0,
    sectionCounts: {
      overview: countOverviewEntries(detail),
      ...emptySectionCounts,
    },
    sectionAvailability: buildSectionAvailability(detail, emptySectionCounts),
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

function buildRegistryBackedDetail(
  instance: RegistryInstanceRecord,
  config: RegistryInstanceConfig,
  token: string | undefined,
  logs: string,
): StudioInstanceDetailRecord {
  const evaluatedAt = Date.now();
  const healthScore = instance.status === 'online' ? 80 : 35;
  const healthStatus =
    instance.status === 'online'
      ? 'healthy'
      : instance.status === 'offline'
        ? 'offline'
        : 'attention';

  return {
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
        authToken: token || undefined,
      },
      createdAt: evaluatedAt,
      updatedAt: evaluatedAt,
      lastSeenAt: evaluatedAt,
    },
    config: {
      port: config.port,
      sandbox: config.sandbox,
      autoUpdate: config.autoUpdate,
      logLevel: config.logLevel,
      corsOrigins: config.corsOrigins,
      authToken: token || undefined,
    },
    logs,
    health: {
      score: healthScore,
      status: healthStatus,
      checks: [],
      evaluatedAt,
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: false,
      configWritable: true,
      notes: ['Registry-backed detail projection.'],
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
      status: logs ? 'limited' : 'unavailable',
      logAvailable: Boolean(logs),
      logPreview: logs ? logs.split('\n').filter(Boolean).slice(-5) : [],
      metricsSource: 'derived',
      lastSeenAt: evaluatedAt,
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
          detail: 'Registry-backed detail projects configuration from Claw Studio metadata.',
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
          detail: 'Registry-backed detail only exposes derived log preview lines.',
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
        detail: 'Registry-backed detail projects storage metadata only.',
        source: 'storage',
      },
    ],
    capabilities: [
      {
        id: 'chat',
        status: 'ready',
        detail: 'Registry-backed detail projection.',
        source: 'runtime',
      },
      {
        id: 'health',
        status: 'ready',
        detail: 'Registry-backed detail projection.',
        source: 'runtime',
      },
    ],
    officialRuntimeNotes: [],
  };
}

function buildRegistryWorkbenchSnapshot(
  instance: RegistryInstanceRecord,
  config: RegistryInstanceConfig,
  token: string | undefined,
  logs: string,
): InstanceWorkbenchSnapshot {
  return buildDetailOnlyWorkbenchSnapshot(buildRegistryBackedDetail(instance, config, token, logs));
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
        return id ? [normalizeOpenClawAgentId(id), entry] as const : null;
      })
      .filter(Boolean) as Array<readonly [string, Record<string, unknown>]>,
  );
  const sourceAgents =
    (Array.isArray(agentsResult?.agents) ? agentsResult?.agents : configuredAgents).filter(isRecord);

  return sourceAgents.map((entry) => {
    const agentId = normalizeOpenClawAgentId(getStringValue(entry, ['id']));
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

async function buildOpenClawFilesCatalog(
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

      return listed.files
        .filter(isRecord)
        .map((entry) =>
          mapOpenClawFileEntryToWorkbenchFile({
            agent,
            entry,
            workspace,
            content: '',
          }),
        )
        .filter(Boolean) as InstanceWorkbenchFile[];
    }),
  );

  return files.flat().sort((left, right) => left.path.localeCompare(right.path));
}

async function buildOpenClawMemoryFiles(
  instanceId: string,
  agents: InstanceWorkbenchAgent[],
  dependencies: InstanceWorkbenchServiceDependencies,
): Promise<InstanceWorkbenchFile[]> {
  const files = await Promise.all(
    agents.map(async (agent) => {
      const fetched = await dependencies.openClawGatewayClient
        .getAgentFile(instanceId, {
          agentId: agent.agent.id,
          name: 'MEMORY.md',
        })
        .catch(() => null);

      if (!isRecord(fetched?.file) || fetched.file.missing === true) {
        return null;
      }

      const file = mapOpenClawFileEntryToWorkbenchFile({
        agent,
        entry: fetched.file,
        workspace:
          typeof fetched.workspace === 'string' && fetched.workspace.trim()
            ? fetched.workspace
            : agent.workspace,
        content: typeof fetched.file.content === 'string' ? fetched.file.content : '',
      });

      if (!file || file.category !== 'memory' || !file.content.trim()) {
        return null;
      }

      return file;
    }),
  );

  return files
    .filter(Boolean)
    .sort((left, right) => left!.path.localeCompare(right!.path)) as InstanceWorkbenchFile[];
}

function mergeOpenClawFileCollections(
  baseFiles: InstanceWorkbenchFile[],
  overrideFiles: InstanceWorkbenchFile[],
): InstanceWorkbenchFile[] {
  const mergedFiles = new Map<string, InstanceWorkbenchFile>();

  baseFiles.forEach((file) => {
    mergedFiles.set(file.id, { ...file });
  });

  overrideFiles.forEach((file) => {
    const current = mergedFiles.get(file.id);
    mergedFiles.set(file.id, current ? { ...current, ...file } : { ...file });
  });

  return [...mergedFiles.values()].sort((left, right) => left.path.localeCompare(right.path));
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
    const parsedAgentId = parsed ? normalizeOpenClawAgentId(parsed.agentId) : null;
    const agentName = parsedAgentId
      ? agentNameById.get(parsedAgentId) || titleCaseIdentifier(parsedAgentId)
      : file.name;

    entries.push({
      id: `memory-${file.id}`,
      title: `${agentName} Memory`,
      type: 'conversation',
      summary: summarizeMarkdown(file.content, 220),
      source: parsedAgentId && parsedAgentId !== 'main' ? 'agent' : 'system',
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

function getPathLeaf(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function inferRuntimeMemoryEntryType(path: string) {
  const normalized = path.toLowerCase();
  if (normalized.endsWith('memory.md') || normalized.includes('/sessions/')) {
    return 'conversation' as const;
  }
  if (
    normalized.includes('runbook') ||
    normalized.includes('playbook') ||
    normalized.includes('guide')
  ) {
    return 'runbook' as const;
  }
  return 'artifact' as const;
}

function inferRuntimeMemoryEntrySource(path: string) {
  return path.toLowerCase().includes('/sessions/') ? ('task' as const) : ('system' as const);
}

function extractRuntimeMemorySnippet(entry: Record<string, unknown>) {
  return (
    getStringValue(entry, ['text']) ||
    getStringValue(entry, ['snippet']) ||
    getStringValue(entry, ['content']) ||
    ''
  );
}

function formatRuntimeMemoryLineRange(entry: Record<string, unknown>) {
  const start =
    getNumberValue(entry, ['from']) ??
    getNumberValue(entry, ['lineStart']) ??
    getNumberValue(entry, ['startLine']);
  const end =
    getNumberValue(entry, ['to']) ??
    getNumberValue(entry, ['lineEnd']) ??
    getNumberValue(entry, ['endLine']);

  if (typeof start !== 'number' && typeof end !== 'number') {
    return null;
  }

  if (typeof start === 'number' && typeof end === 'number' && end >= start) {
    return `${start}-${end}`;
  }

  return `${start ?? end}`;
}

function buildOpenClawRuntimeMemories(
  doctorStatus: Record<string, unknown> | null,
  searchResult: OpenClawMemorySearchResult | null,
): InstanceWorkbenchMemoryEntry[] {
  const results = (searchResult?.results || []).filter(isRecord);
  const provider = getStringValue(doctorStatus, ['provider']);
  const agentId = getStringValue(doctorStatus, ['agentId']);
  const embeddingOk = getBooleanValue(doctorStatus, ['embedding', 'ok']);
  const embeddingError = getStringValue(doctorStatus, ['embedding', 'error']);
  const searchDisabled = searchResult?.disabled === true;
  const hasRuntimeSnapshot = Boolean(doctorStatus) || results.length > 0 || searchDisabled;

  if (!hasRuntimeSnapshot) {
    return [];
  }

  const statusParts: string[] = [];
  if (provider) {
    statusParts.push(`Provider=${provider}`);
  }
  if (agentId) {
    statusParts.push(`Agent=${agentId}`);
  }
  if (embeddingOk === true) {
    statusParts.push('Embedding ready');
  } else if (embeddingError) {
    statusParts.push(`Embedding issue: ${embeddingError}`);
  }
  if (searchDisabled) {
    statusParts.push('Semantic recall disabled');
  }
  if (results.length > 0) {
    statusParts.push(`${results.length} indexed hit${results.length === 1 ? '' : 's'} available`);
  }

  const entries: InstanceWorkbenchMemoryEntry[] = [
    {
      id: 'memory-runtime',
      title: 'Memory Runtime',
      type: 'fact',
      summary:
        statusParts.length > 0
          ? `${statusParts.join('. ')}.`.replace(/\.\./g, '.')
          : 'Indexed memory runtime is available.',
      source: 'system',
      updatedAt: 'Live',
      retention: embeddingOk === false || searchDisabled ? 'expiring' : 'rolling',
      tokens: 24,
    },
  ];

  results.forEach((result, index) => {
    const path =
      getStringValue(result, ['path']) ||
      getStringValue(result, ['file']) ||
      getStringValue(result, ['uri']) ||
      '';
    const snippet = summarizeMarkdown(extractRuntimeMemorySnippet(result), 220);
    const score = getNumberValue(result, ['score']);
    const lineRange = formatRuntimeMemoryLineRange(result);
    const prefixParts = [path];

    if (lineRange) {
      prefixParts.push(`lines ${lineRange}`);
    }
    if (typeof score === 'number') {
      prefixParts.push(`score ${score.toFixed(2)}`);
    }

    const summary = [prefixParts.filter(Boolean).join(' • '), snippet]
      .filter((part) => part && part.trim())
      .join('. ');

    if (!summary) {
      return;
    }

    entries.push({
      id: `memory-runtime-hit-${index}`,
      title: path ? getPathLeaf(path) : `Memory Hit ${index + 1}`,
      type: inferRuntimeMemoryEntryType(path),
      summary,
      source: inferRuntimeMemoryEntrySource(path),
      updatedAt: 'Live',
      retention: 'pinned',
      tokens: tokenEstimate(summary),
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
      const normalizedTask = normalizeWorkbenchTask(task);
      if (!normalizedTask) {
        return;
      }

      const rawTaskId = getStringValue(task, ['id']) || normalizedTask.id;
      const executions =
        workbench.cronTasks.taskExecutionsById[normalizedTask.id] ||
        workbench.cronTasks.taskExecutionsById[rawTaskId] ||
        [];

      this.openClawTaskInstanceById.set(normalizedTask.id, detail.instance.id);
      this.backendTaskExecutionsById.set(
        normalizedTask.id,
        executions.map(cloneTaskExecution),
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
      agentsResult,
      tasksResult,
    ] = await Promise.allSettled([
      this.dependencies.openClawGatewayClient.getConfig(instanceId),
      this.dependencies.openClawGatewayClient.listModels(instanceId),
      this.dependencies.openClawGatewayClient.getChannelStatus(instanceId, {}),
      this.dependencies.openClawGatewayClient.getSkillsStatus(instanceId, {}),
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
    const toolCatalogResults = await Promise.allSettled(
      (agents.length > 0
        ? agents.map((agent) =>
            this.dependencies.openClawGatewayClient.getToolsCatalog(instanceId, {
              agentId: agent.agent.id,
            }),
          )
        : [this.dependencies.openClawGatewayClient.getToolsCatalog(instanceId, {})]),
    );
    const tools = buildOpenClawScopedTools(
      toolCatalogResults
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<OpenClawToolsCatalogResult> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value),
      agents,
    );

    const hasGatewayData =
      channels.length > 0 ||
      tasks.length > 0 ||
      llmProviders.length > 0 ||
      agents.length > 0 ||
      skills.length > 0 ||
      tools.length > 0;

    if (!hasGatewayData) {
      return null;
    }

    return buildOpenClawSnapshotFromSections(detail, {
      channels,
      tasks,
      agents,
      skills,
      files: [],
      llmProviders,
      memories: [],
      tools,
    });
  }

  private async getOpenClawWorkbench(
    instanceId: string,
    detail: StudioInstanceDetailRecord,
    managedConfigSnapshot: ManagedOpenClawConfigSnapshot | null,
  ): Promise<InstanceWorkbenchSnapshot> {
    const managedConfigPath = openClawConfigService.resolveInstanceConfigPath(detail);
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
    const finalizedSnapshot = finalizeOpenClawSnapshot(
      detail,
      snapshot ||
        buildOpenClawSnapshotFromSections(detail, {
          channels: [],
          tasks: [],
          agents: [],
          skills: [],
          files: [],
          llmProviders: [],
          memories: [],
          tools: [],
        }),
      managedConfigPath,
      managedConfigSnapshot,
    );

    this.rememberOpenClawTasks(
      instanceId,
      finalizedSnapshot.tasks,
      detail.workbench?.cronTasks.taskExecutionsById || {},
    );

    return finalizedSnapshot;
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

    if (detail?.workbench) {
      return mapBackendWorkbench(detail, managedConfigSnapshot);
    }

    if (detail) {
      return buildDetailOnlyWorkbenchSnapshot(detail, managedConfigPath, managedConfigSnapshot);
    }

    const [liveInstance, liveConfig, liveToken, liveLogs] = await Promise.all([
      this.dependencies.instanceService.getInstanceById(id),
      this.dependencies.instanceService.getInstanceConfig(id),
      this.dependencies.instanceService.getInstanceToken(id),
      this.dependencies.instanceService.getInstanceLogs(id),
    ]);

    if (!liveInstance || !liveConfig) {
      return null;
    }

    return buildRegistryWorkbenchSnapshot(liveInstance, liveConfig, liveToken, liveLogs);
  }

  async listInstanceFiles(
    instanceId: string,
    agents: InstanceWorkbenchAgent[] = [],
  ): Promise<InstanceWorkbenchFile[]> {
    if (agents.length > 0) {
      return buildOpenClawFilesCatalog(instanceId, agents, this.dependencies);
    }

    return [];
  }

  async listInstanceMemories(
    instanceId: string,
    agents: InstanceWorkbenchAgent[] = [],
  ): Promise<InstanceWorkbenchMemoryEntry[]> {
    const [configSnapshot, memoryFiles, doctorMemoryStatus, runtimeSearchResult] = await Promise.all([
      this.dependencies.openClawGatewayClient.getConfig(instanceId).catch(() => null),
      agents.length > 0
        ? buildOpenClawMemoryFiles(instanceId, agents, this.dependencies).catch(() => [])
        : Promise.resolve([] as InstanceWorkbenchFile[]),
      agents.length > 0
        ? this.dependencies.openClawGatewayClient.getDoctorMemoryStatus(instanceId).catch(() => null)
        : Promise.resolve(null),
      agents.length > 0
        ? this.dependencies.openClawGatewayClient
            .searchMemory(instanceId, {
              query: 'recent work decisions runbook',
              maxResults: 6,
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    const runtimeMemories = buildOpenClawRuntimeMemories(doctorMemoryStatus, runtimeSearchResult);

    if (runtimeMemories.some((entry) => entry.id.startsWith('memory-runtime-hit-'))) {
      return runtimeMemories;
    }

    if (runtimeMemories.length > 0) {
      return [
        ...runtimeMemories,
        ...buildOpenClawMemories(configSnapshot, memoryFiles, agents).filter(
          (entry) => entry.id !== 'memory-backend',
        ),
      ];
    }

    if (agents.length > 0 || configSnapshot) {
      return buildOpenClawMemories(configSnapshot, memoryFiles, agents);
    }

    return [];
  }

  async createTask(instanceId: string, payload: Record<string, unknown>): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId);
    if (isOpenClawDetail(detail)) {
      await this.dependencies.openClawGatewayClient.addCronJob(instanceId, payload);
      return;
    }

    await studio.createInstanceTask(instanceId, payload);
  }

  async updateTask(
    instanceId: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId);
    if (isOpenClawDetail(detail)) {
      await this.dependencies.openClawGatewayClient.updateCronJob(instanceId, id, payload);
      return;
    }

    await studio.updateInstanceTask(instanceId, id, payload);
  }

  async cloneTask(id: string, name?: string): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (!instanceId) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }

    const tasks = await this.dependencies.openClawGatewayClient.listWorkbenchCronJobs(instanceId);
    const current = tasks.find((task) => task.id === id);
    if (!current) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }

    await this.dependencies.openClawGatewayClient.addCronJob(
      instanceId,
      buildOpenClawCronTaskPayload(
        toCreateTaskInput(current, {
          name: name || current.name,
        }),
        current.rawDefinition,
      ),
    );
  }

  async runTaskNow(id: string): Promise<InstanceWorkbenchTaskExecution> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (!instanceId) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }

    await this.dependencies.openClawGatewayClient.runCronJob(instanceId, id);
    const executions = await this.dependencies.openClawGatewayClient.listWorkbenchCronRuns(
      instanceId,
      id,
    );
    if (executions.length > 0) {
      this.backendTaskExecutionsById.set(id, executions.map(cloneTaskExecution));
      return cloneTaskExecution(executions[0]!);
    }

    const execution: InstanceWorkbenchTaskExecution = {
      id: `${id}-${Date.now()}`,
      taskId: id,
      status: 'running',
      trigger: 'manual',
      startedAt: new Date().toISOString(),
      summary: 'Cron job has been queued.',
      details: undefined,
    };
    const current = this.backendTaskExecutionsById.get(id) || [];
    this.backendTaskExecutionsById.set(id, [cloneTaskExecution(execution), ...current]);
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

    const executions = this.backendTaskExecutionsById.get(id) || [];
    return executions.map(cloneTaskExecution);
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (!instanceId) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }

    await this.dependencies.openClawGatewayClient.updateCronJob(instanceId, id, {
      enabled: status === 'active',
    });
  }

  async deleteTask(id: string): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (!instanceId) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }

    const deleted = await this.dependencies.openClawGatewayClient.removeCronJob(instanceId, id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
    this.openClawTaskInstanceById.delete(id);
    this.backendTaskExecutionsById.delete(id);
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
