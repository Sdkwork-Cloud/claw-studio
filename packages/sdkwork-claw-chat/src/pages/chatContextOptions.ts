import type { Agent, Skill } from '@sdkwork/claw-types';

export interface ChatContextOption {
  id: string | null;
  name: string;
  description: string;
  avatarLabel: string | null;
}

export function buildChatAgentOptions(params: {
  agents: Agent[];
  defaultLabel: string;
  defaultDescription: string;
}) {
  return [
    {
      id: null,
      name: params.defaultLabel,
      description: params.defaultDescription,
      avatarLabel: null,
    },
    ...params.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description ?? '',
      avatarLabel: agent.avatar || agent.name.slice(0, 2).toUpperCase(),
    })),
  ] satisfies ChatContextOption[];
}

export function buildChatSkillOptions(params: {
  skills: Skill[];
  defaultLabel: string;
  defaultDescription: string;
}) {
  return [
    {
      id: null,
      name: params.defaultLabel,
      description: params.defaultDescription,
      avatarLabel: null,
    },
    ...params.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description ?? '',
      avatarLabel: skill.name.slice(0, 2).toUpperCase(),
    })),
  ] satisfies ChatContextOption[];
}
