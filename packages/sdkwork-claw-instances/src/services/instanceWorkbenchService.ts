import {
  studioMockService,
  type MockInstanceLLMProvider,
  type MockInstanceMemoryEntry,
  type MockInstanceTool,
} from '@sdkwork/claw-infrastructure';
import type { Agent, Skill } from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchAgent,
  InstanceWorkbenchChannel,
  InstanceWorkbenchFile,
  InstanceWorkbenchLLMProvider,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSnapshot,
  InstanceWorkbenchTask,
  InstanceWorkbenchTool,
} from '../types';

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

class InstanceWorkbenchService {
  async getInstanceWorkbench(id: string): Promise<InstanceWorkbenchSnapshot | null> {
    const [
      instance,
      config,
      token,
      logs,
      channels,
      tasks,
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

    if (!instance || !config) {
      return null;
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

    const mappedTasks: InstanceWorkbenchTask[] = tasks.map((task) => ({ ...task }));
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
      healthScore,
      runtimeStatus: healthScore >= 80 ? 'healthy' : healthScore >= 55 ? 'attention' : 'degraded',
      connectedChannelCount,
      activeTaskCount,
      installedSkillCount: skills.length,
      readyToolCount,
      sectionCounts: {
        channels: mappedChannels.length,
        cronTasks: mappedTasks.length,
        llmProviders: mappedLlmProviders.length,
        agents: agents.length,
        skills: skills.length,
        files: mappedFiles.length,
        memory: mappedMemories.length,
        tools: mappedTools.length,
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
}

export const instanceWorkbenchService = new InstanceWorkbenchService();
