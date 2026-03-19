import { studioMockService } from '@sdkwork/claw-infrastructure';
import type { ListParams, PaginatedResult, Review, Skill, SkillPack } from '@sdkwork/claw-types';

export interface InstallationResult {
  success: boolean;
  fallback?: boolean;
}

export interface IMarketService {
  getSkillList(params?: ListParams): Promise<PaginatedResult<Skill>>;
  getPackList(params?: ListParams): Promise<PaginatedResult<SkillPack>>;
  getSkills(): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill>;
  getSkillReviews(id: string): Promise<Review[]>;
  getPacks(): Promise<SkillPack[]>;
  getPack(id: string): Promise<SkillPack>;
  installSkill(instanceId: string, skillId: string): Promise<InstallationResult>;
  installPack(instanceId: string, packId: string): Promise<InstallationResult>;
  installPackWithSkills(
    instanceId: string,
    packId: string,
    skillIds: string[],
  ): Promise<InstallationResult>;
  downloadSkillLocal(skill: Skill, onProgress: (progress: number) => void): Promise<void>;
  downloadPackLocal(pack: SkillPack, onProgress: (progress: number) => void): Promise<void>;
}

function paginateItems<T>(items: T[], params: ListParams = {}): PaginatedResult<T> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

function simulateLocalDownload(
  filename: string,
  payload: unknown,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      if (progress >= 100) {
        clearInterval(interval);
        onProgress(100);

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        resolve();
        return;
      }

      onProgress(progress);
    }, 500);
  });
}

class MarketService implements IMarketService {
  async getSkillList(params: ListParams = {}): Promise<PaginatedResult<Skill>> {
    const skills = await this.getSkills();
    const keyword = params.keyword?.toLowerCase();
    const filteredSkills = keyword
      ? skills.filter(
          (skill) =>
            skill.name.toLowerCase().includes(keyword) ||
            skill.description.toLowerCase().includes(keyword) ||
            skill.category.toLowerCase().includes(keyword),
        )
      : skills;

    return paginateItems(filteredSkills, params);
  }

  async getPackList(params: ListParams = {}): Promise<PaginatedResult<SkillPack>> {
    const packs = await this.getPacks();
    const keyword = params.keyword?.toLowerCase();
    const filteredPacks = keyword
      ? packs.filter(
          (pack) =>
            pack.name.toLowerCase().includes(keyword) ||
            pack.description.toLowerCase().includes(keyword) ||
            pack.category.toLowerCase().includes(keyword),
        )
      : packs;

    return paginateItems(filteredPacks, params);
  }

  async getSkills(): Promise<Skill[]> {
    return studioMockService.listSkills();
  }

  async getSkill(id: string): Promise<Skill> {
    const skill = await studioMockService.getSkill(id);
    if (!skill) {
      throw new Error('Failed to fetch skill');
    }
    return skill;
  }

  async getSkillReviews(id: string): Promise<Review[]> {
    return studioMockService.listSkillReviews(id);
  }

  async getPacks(): Promise<SkillPack[]> {
    return studioMockService.listPacks();
  }

  async getPack(id: string): Promise<SkillPack> {
    const pack = await studioMockService.getPack(id);
    if (!pack) {
      throw new Error('Failed to fetch pack details');
    }
    return pack;
  }

  async installSkill(instanceId: string, skillId: string): Promise<InstallationResult> {
    return studioMockService.installSkill(instanceId, skillId);
  }

  async installPack(instanceId: string, packId: string): Promise<InstallationResult> {
    return studioMockService.installPack(instanceId, packId);
  }

  async installPackWithSkills(
    instanceId: string,
    packId: string,
    skillIds: string[],
  ): Promise<InstallationResult> {
    return studioMockService.installPack(instanceId, packId, skillIds);
  }

  async downloadSkillLocal(skill: Skill, onProgress: (progress: number) => void): Promise<void> {
    return simulateLocalDownload(`${skill.id}-skill.json`, skill, onProgress);
  }

  async downloadPackLocal(
    pack: SkillPack,
    onProgress: (progress: number) => void,
  ): Promise<void> {
    return simulateLocalDownload(`${pack.id}-pack.json`, pack, onProgress);
  }
}

export const marketService = new MarketService();
