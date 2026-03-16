import type { ListParams, PaginatedResult, Review, Skill, SkillPack } from '@sdkwork/claw-types';
import {
  addFallbackInstalledSkills,
  getFallbackPack,
  getFallbackPacks,
  getFallbackReviews,
  getFallbackSkill,
  getFallbackSkills,
} from './fallbackData';

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

async function getJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, payload: unknown, errorMessage: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
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
    try {
      return await getJson<Skill[]>('/api/skills', 'Failed to fetch skills');
    } catch {
      return getFallbackSkills();
    }
  }

  async getSkill(id: string): Promise<Skill> {
    try {
      return await getJson<Skill>(`/api/skills/${id}`, 'Failed to fetch skill');
    } catch {
      const fallbackSkill = getFallbackSkill(id);
      if (!fallbackSkill) {
        throw new Error('Failed to fetch skill');
      }

      return fallbackSkill;
    }
  }

  async getSkillReviews(id: string): Promise<Review[]> {
    try {
      return await getJson<Review[]>(`/api/skills/${id}/reviews`, 'Failed to fetch reviews');
    } catch {
      return getFallbackReviews(id);
    }
  }

  async getPacks(): Promise<SkillPack[]> {
    try {
      return await getJson<SkillPack[]>('/api/packs', 'Failed to fetch packs');
    } catch {
      return getFallbackPacks();
    }
  }

  async getPack(id: string): Promise<SkillPack> {
    try {
      return await getJson<SkillPack>(`/api/packs/${id}`, 'Failed to fetch pack details');
    } catch {
      const fallbackPack = getFallbackPack(id);
      if (!fallbackPack) {
        throw new Error('Failed to fetch pack details');
      }

      return fallbackPack;
    }
  }

  async installSkill(instanceId: string, skillId: string): Promise<InstallationResult> {
    try {
      return await postJson<InstallationResult>(
        '/api/installations',
        { device_id: instanceId, skill_id: skillId },
        'Installation failed',
      );
    } catch {
      addFallbackInstalledSkills(instanceId, [skillId]);
      return { success: true, fallback: true };
    }
  }

  async installPack(instanceId: string, packId: string): Promise<InstallationResult> {
    try {
      return await postJson<InstallationResult>(
        '/api/installations/pack',
        { device_id: instanceId, pack_id: packId },
        'Pack installation failed',
      );
    } catch {
      const fallbackPack = getFallbackPack(packId);
      if (!fallbackPack) {
        throw new Error('Pack installation failed');
      }

      addFallbackInstalledSkills(
        instanceId,
        fallbackPack.skills.map((skill) => skill.id),
      );
      return { success: true, fallback: true };
    }
  }

  async installPackWithSkills(
    instanceId: string,
    packId: string,
    skillIds: string[],
  ): Promise<InstallationResult> {
    try {
      return await postJson<InstallationResult>(
        '/api/installations/pack',
        {
          pack_id: packId,
          device_id: instanceId,
          skill_ids: skillIds,
        },
        'Installation failed',
      );
    } catch {
      addFallbackInstalledSkills(instanceId, skillIds);
      return { success: true, fallback: true };
    }
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
