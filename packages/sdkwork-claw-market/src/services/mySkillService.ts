import type { ListParams, PaginatedResult, Skill } from '@sdkwork/claw-types';
import {
  getFallbackInstalledSkills,
  removeFallbackInstalledSkill,
  snapshotFallbackInstallations,
} from './fallbackData';

export interface MySkillService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Skill>>;
  getMySkills(instanceId: string): Promise<Skill[]>;
  uninstallSkill(instanceId: string, skillId: string): Promise<void>;
}

function paginateSkills(skills: Skill[], params: ListParams = {}): PaginatedResult<Skill> {
  let filteredSkills = [...skills];

  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredSkills = filteredSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(keyword) ||
        skill.description.toLowerCase().includes(keyword),
    );
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const total = filteredSkills.length;
  const start = (page - 1) * pageSize;

  return {
    items: filteredSkills.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export function createMySkillService(
  seedSkills: Record<string, Skill[]> = snapshotFallbackInstallations(),
): MySkillService {
  const skillsByInstance = Object.fromEntries(
    Object.entries(seedSkills).map(([instanceId, skills]) => [instanceId, [...skills]]),
  ) as Record<string, Skill[]>;

  return {
    async getList(instanceId, params = {}) {
      return paginateSkills(skillsByInstance[instanceId] || [], params);
    },

    async getMySkills(instanceId) {
      return [...(skillsByInstance[instanceId] || [])];
    },

    async uninstallSkill(instanceId, skillId) {
      skillsByInstance[instanceId] = (skillsByInstance[instanceId] || []).filter(
        (skill) => skill.id !== skillId,
      );
    },
  };
}

export const mySkillService: MySkillService = {
  async getList(instanceId, params = {}) {
    const skills = await this.getMySkills(instanceId);
    return paginateSkills(skills, params);
  },

  async getMySkills(instanceId) {
    try {
      const response = await fetch(`/api/devices/${instanceId}/skills`);
      if (!response.ok) {
        throw new Error('Failed to fetch my skills');
      }

      return response.json() as Promise<Skill[]>;
    } catch {
      return getFallbackInstalledSkills(instanceId);
    }
  },

  async uninstallSkill(instanceId, skillId) {
    try {
      const response = await fetch('/api/installations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: instanceId, skill_id: skillId }),
      });

      if (!response.ok) {
        throw new Error('Failed to uninstall skill');
      }
    } catch {
      removeFallbackInstalledSkill(instanceId, skillId);
    }
  },
};
