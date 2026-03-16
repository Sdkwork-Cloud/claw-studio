import type { Skill } from '@sdkwork/claw-types';
import { delay, type ListParams, type PaginatedResult } from './serviceTypes.ts';

export interface MySkillService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Skill>>;
  getMySkills(instanceId: string): Promise<Skill[]>;
  uninstallSkill(instanceId: string, skillId: string): Promise<void>;
}

const SEEDED_SKILLS: Record<string, Skill[]> = {
  'inst-1': [
    {
      id: 'skill-1',
      name: 'System Monitor',
      description: 'Monitor CPU, RAM, and network usage in real-time.',
      readme: '# System Monitor\n\nProvides real-time system metrics.',
      author: 'OpenClaw',
      version: '1.2.0',
      icon: 'Cpu',
      category: 'System',
      downloads: 12500,
      rating: 4.8,
      size: '2.4 MB',
    },
    {
      id: 'skill-2',
      name: 'Code Formatter',
      description: 'Automatically format code based on standard conventions.',
      readme: '# Code Formatter\n\nFormats code.',
      author: 'DevTools',
      version: '2.0.1',
      icon: 'Code',
      category: 'Productivity',
      downloads: 8400,
      rating: 4.5,
      size: '1.1 MB',
    },
  ],
};

export function createMySkillService(seedSkills: Record<string, Skill[]> = SEEDED_SKILLS): MySkillService {
  const skillsByInstance = Object.fromEntries(
    Object.entries(seedSkills).map(([instanceId, skills]) => [instanceId, [...skills]]),
  ) as Record<string, Skill[]>;

  return {
    async getList(instanceId, params: ListParams = {}) {
      await delay();

      let filtered = [...(skillsByInstance[instanceId] || [])];
      if (params.keyword) {
        const keyword = params.keyword.toLowerCase();
        filtered = filtered.filter((skill) =>
          skill.name.toLowerCase().includes(keyword) ||
          skill.description.toLowerCase().includes(keyword),
        );
      }

      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const total = filtered.length;
      const start = (page - 1) * pageSize;

      return {
        items: filtered.slice(start, start + pageSize),
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
      };
    },

    async getMySkills(instanceId) {
      await delay();
      return [...(skillsByInstance[instanceId] || [])];
    },

    async uninstallSkill(instanceId, skillId) {
      await delay();
      skillsByInstance[instanceId] = (skillsByInstance[instanceId] || []).filter((skill) => skill.id !== skillId);
    },
  };
}

export const mySkillService = createMySkillService();
