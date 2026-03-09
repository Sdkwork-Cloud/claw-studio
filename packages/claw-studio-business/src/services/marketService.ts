import { Skill, SkillPack, Review } from '@sdkwork/claw-studio-domain';
import { getJson, postJson } from '@sdkwork/claw-studio-infrastructure/http/httpClient';

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
      return await postJson<any>('/api/installations', { instance_id: instanceId, skill_id: skillId });
    } catch {
      throw new Error('Installation failed');
    }
  },

  installPack: async (instanceId: string, packId: string): Promise<any> => {
    // Simulated pack installation
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true };
  },

  installPackWithSkills: async (instanceId: string, packId: string, skillIds: string[]): Promise<any> => {
    try {
      return await postJson<any>('/api/installations/pack', {
        pack_id: packId,
        instance_id: instanceId,
        skill_ids: skillIds
      });
    } catch {
      throw new Error('Installation failed');
    }
  }
};
