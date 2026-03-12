import type { Review, Skill, SkillPack } from '@sdkwork/claw-studio-domain';
import { getJson, postJson } from '@sdkwork/claw-studio-infrastructure';

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
      } else {
        onProgress(progress);
      }
    }, 500);
  });
}

export const marketService = {
  getSkills: async (): Promise<Skill[]> => {
    try {
      return await getJson<Skill[]>('/api/skills');
    } catch {
      throw new Error('Failed to fetch skills');
    }
  },

  getSkill: async (id: string): Promise<Skill> => {
    try {
      return await getJson<Skill>(`/api/skills/${id}`);
    } catch {
      throw new Error('Failed to fetch skill');
    }
  },

  getSkillReviews: async (id: string): Promise<Review[]> => {
    try {
      return await getJson<Review[]>(`/api/skills/${id}/reviews`);
    } catch {
      throw new Error('Failed to fetch reviews');
    }
  },

  getPacks: async (): Promise<SkillPack[]> => {
    try {
      return await getJson<SkillPack[]>('/api/packs');
    } catch {
      throw new Error('Failed to fetch packs');
    }
  },

  getPack: async (id: string): Promise<SkillPack> => {
    try {
      return await getJson<SkillPack>(`/api/packs/${id}`);
    } catch {
      throw new Error('Failed to fetch pack details');
    }
  },

  installSkill: async (instanceId: string, skillId: string): Promise<any> => {
    try {
      return await postJson<any>('/api/installations', {
        device_id: instanceId,
        skill_id: skillId,
      });
    } catch {
      throw new Error('Installation failed');
    }
  },

  installPack: async (instanceId: string, packId: string): Promise<any> => {
    try {
      return await postJson<any>('/api/installations/pack', {
        device_id: instanceId,
        pack_id: packId,
      });
    } catch {
      throw new Error('Pack installation failed');
    }
  },

  installPackWithSkills: async (
    instanceId: string,
    packId: string,
    skillIds: string[],
  ): Promise<any> => {
    try {
      return await postJson<any>('/api/installations/pack', {
        pack_id: packId,
        device_id: instanceId,
        skill_ids: skillIds,
      });
    } catch {
      throw new Error('Installation failed');
    }
  },

  downloadSkillLocal: async (
    skill: Skill,
    onProgress: (progress: number) => void,
  ): Promise<void> => simulateLocalDownload(`${skill.id}-skill.json`, skill, onProgress),

  downloadPackLocal: async (
    pack: SkillPack,
    onProgress: (progress: number) => void,
  ): Promise<void> => simulateLocalDownload(`${pack.id}-pack.json`, pack, onProgress),
};
