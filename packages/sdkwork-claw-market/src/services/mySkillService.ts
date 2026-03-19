import { studioMockService } from '@sdkwork/claw-infrastructure';
import type { ListParams, PaginatedResult, Skill } from '@sdkwork/claw-types';

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

export const mySkillService: MySkillService = {
  async getList(instanceId, params = {}) {
    const skills = await this.getMySkills(instanceId);
    return paginateSkills(skills, params);
  },

  async getMySkills(instanceId) {
    return studioMockService.listInstalledSkills(instanceId);
  },

  async uninstallSkill(instanceId, skillId) {
    const result = await studioMockService.uninstallSkill(instanceId, skillId);
    if (!result.success) {
      throw new Error('Failed to uninstall skill');
    }
  },
};
