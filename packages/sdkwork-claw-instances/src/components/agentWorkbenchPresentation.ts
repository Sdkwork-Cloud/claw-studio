import type { AgentWorkbenchSnapshot } from '../services';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';

export type AgentWorkbenchTabId =
  | 'overview'
  | 'channels'
  | 'cronTasks'
  | 'skills'
  | 'tools'
  | 'files';

export const agentWorkbenchTabIds: AgentWorkbenchTabId[] = [
  'overview',
  'channels',
  'cronTasks',
  'skills',
  'tools',
  'files',
];

export interface AgentWorkbenchTabCountMap {
  overview: null;
  channels: number;
  cronTasks: number;
  skills: number;
  tools: number;
  files: number;
}

export function buildAgentWorkbenchTabCounts(
  snapshot: AgentWorkbenchSnapshot,
): AgentWorkbenchTabCountMap {
  return {
    overview: null,
    channels: snapshot.channels.length,
    cronTasks: snapshot.tasks.length,
    skills: snapshot.skills.length,
    tools: snapshot.tools.length,
    files: snapshot.files.length,
  };
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function buildAgentSearchHaystack(
  agent: InstanceWorkbenchSnapshot['agents'][number],
) {
  return [
    agent.agent.id,
    agent.agent.name,
    agent.agent.description,
    agent.agent.creator,
    ...(agent.focusAreas || []),
    agent.workspace,
    agent.agentDir,
    agent.model?.primary,
    ...(agent.model?.fallbacks || []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();
}

export function filterAgentWorkbenchAgents(
  agents: InstanceWorkbenchSnapshot['agents'],
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return agents;
  }

  return agents.filter((agent) => buildAgentSearchHaystack(agent).includes(normalizedQuery));
}
