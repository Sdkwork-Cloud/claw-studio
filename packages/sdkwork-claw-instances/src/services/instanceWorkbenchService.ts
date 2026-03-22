import {
  studio,
  studioMockService,
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
} from '../types';
import { instanceService } from './instanceService';

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

class InstanceWorkbenchService {
  private readonly backendTaskExecutionsById = new Map<string, InstanceWorkbenchTaskExecution[]>();

  private readonly openClawTaskInstanceById = new Map<string, string>();

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

  async getInstanceWorkbench(id: string): Promise<InstanceWorkbenchSnapshot | null> {
    const detail = await studio.getInstanceDetail(id);
    const managedConfigPath =
      detail?.instance.runtimeKind === 'openclaw'
        ? openClawConfigService.resolveInstanceConfigPath(detail)
        : null;
    const managedConfigSnapshot = managedConfigPath
      ? await openClawConfigService.readConfigSnapshot(managedConfigPath).catch(() => null)
      : null;

    if (detail?.instance.runtimeKind === 'openclaw' && detail.workbench) {
      this.rememberBackendTaskExecutions(detail);
      return mapBackendWorkbench(detail, managedConfigSnapshot);
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
      studioMockService.getInstance(id),
      studioMockService.getInstanceConfig(id),
      studioMockService.getInstanceToken(id),
      studioMockService.getInstanceLogs(id),
      studioMockService.listChannels(id),
      studioMockService.listTasks(id),
      studioMockService.listInstalledSkills(id),
      studioMockService.listAgents(),
      studioMockService.listInstanceFiles(id),
      studioMockService.listInstanceLlmProviders(id),
      studioMockService.listInstanceMemories(id),
      studioMockService.listInstanceTools(id),
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
                  const executions = await studioMockService.listTaskExecutions(task.id);
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
        instanceService.getInstanceById(id),
        instanceService.getInstanceConfig(id),
        instanceService.getInstanceToken(id),
        instanceService.getInstanceLogs(id),
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
        const executions = await studioMockService.listTaskExecutions(task.id);
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
      await studio.cloneInstanceTask(instanceId, id, name);
      return;
    }
    const cloned = await studioMockService.cloneTask(id, name ? { name } : {});
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
  }

  async runTaskNow(id: string): Promise<InstanceWorkbenchTaskExecution> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const execution = await studio.runInstanceTaskNow(instanceId, id);
      const current = this.backendTaskExecutionsById.get(id) || [];
      this.backendTaskExecutionsById.set(id, [cloneTaskExecution(execution), ...current]);
      return execution;
    }
    const execution = await studioMockService.runTaskNow(id);
    if (!execution) {
      throw new Error('Failed to run task');
    }
    return execution;
  }

  async listTaskExecutions(id: string): Promise<InstanceWorkbenchTaskExecution[]> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const executions = await studio.listInstanceTaskExecutions(instanceId, id);
      this.backendTaskExecutionsById.set(
        id,
        executions.map(cloneTaskExecution),
      );
      return executions;
    }
    return studioMockService.listTaskExecutions(id);
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      await studio.updateInstanceTaskStatus(instanceId, id, status);
      return;
    }
    const updated = await studioMockService.updateTaskStatus(id, status);
    if (!updated) {
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(id: string): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const deleted = await studio.deleteInstanceTask(instanceId, id);
      if (!deleted) {
        throw new Error('Failed to delete task');
      }
      this.openClawTaskInstanceById.delete(id);
      this.backendTaskExecutionsById.delete(id);
      return;
    }
    const deleted = await studioMockService.deleteTask(id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
  }
}

export const instanceWorkbenchService = new InstanceWorkbenchService();
