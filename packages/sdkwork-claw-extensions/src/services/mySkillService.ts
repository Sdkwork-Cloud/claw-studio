import { getI18n } from 'react-i18next';
import {
  localizedText,
  normalizeLanguage,
  resolveLocalizedText,
  type LocalizedText,
} from '@sdkwork/claw-i18n';
import type { Skill } from '@sdkwork/claw-types';
import { delay, type ListParams, type PaginatedResult } from './serviceTypes.ts';

export interface MySkillService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Skill>>;
  getMySkills(instanceId: string): Promise<Skill[]>;
  uninstallSkill(instanceId: string, skillId: string): Promise<void>;
}

type SkillSeed = Omit<Skill, 'description'> & {
  description: LocalizedText;
};

function resolveCurrentLanguage() {
  return normalizeLanguage(getI18n()?.resolvedLanguage ?? getI18n()?.language);
}

function materializeSkill(skill: SkillSeed): Skill {
  return {
    ...skill,
    description: resolveLocalizedText(skill.description, resolveCurrentLanguage()),
  };
}

const SEEDED_SKILLS: Record<string, SkillSeed[]> = {
  'inst-1': [
    {
      id: 'skill-1',
      name: 'System Monitor',
      description: localizedText(
        'Monitor CPU, RAM, and network usage in real-time.',
        '\u5b9e\u65f6\u76d1\u63a7 CPU\u3001\u5185\u5b58\u548c\u7f51\u7edc\u4f7f\u7528\u60c5\u51b5\u3002',
      ),
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
      description: localizedText(
        'Automatically format code based on standard conventions.',
        '\u6839\u636e\u6807\u51c6\u89c4\u8303\u81ea\u52a8\u683c\u5f0f\u5316\u4ee3\u7801\u3002',
      ),
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

export function createMySkillService(seedSkills: Record<string, SkillSeed[]> = SEEDED_SKILLS): MySkillService {
  const skillsByInstance = Object.fromEntries(
    Object.entries(seedSkills).map(([instanceId, skills]) => [instanceId, [...skills]]),
  ) as Record<string, SkillSeed[]>;

  return {
    async getList(instanceId, params: ListParams = {}) {
      await delay();

      let filtered = (skillsByInstance[instanceId] || []).map(materializeSkill);
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
      return (skillsByInstance[instanceId] || []).map(materializeSkill);
    },

    async uninstallSkill(instanceId, skillId) {
      await delay();
      skillsByInstance[instanceId] = (skillsByInstance[instanceId] || []).filter((skill) => skill.id !== skillId);
    },
  };
}

export const mySkillService = createMySkillService();
