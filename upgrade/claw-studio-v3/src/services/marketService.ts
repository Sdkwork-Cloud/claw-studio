import { Skill, SkillPack, Review } from '../types';
import { ListParams, PaginatedResult } from '../types/service';

export interface IMarketService {
  getSkillList(params?: ListParams): Promise<PaginatedResult<Skill>>;
  getPackList(params?: ListParams): Promise<PaginatedResult<SkillPack>>;
  
  // Legacy methods
  getSkills(): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill>;
  getSkillReviews(id: string): Promise<Review[]>;
  getPacks(): Promise<SkillPack[]>;
  getPack(id: string): Promise<SkillPack>;
  installSkill(instanceId: string, skillId: string): Promise<any>;
  installPack(instanceId: string, packId: string): Promise<any>;
  installPackWithSkills(instanceId: string, packId: string, skillIds: string[]): Promise<any>;
  downloadSkillLocal(skill: Skill, onProgress: (progress: number) => void): Promise<void>;
  downloadPackLocal(pack: SkillPack, onProgress: (progress: number) => void): Promise<void>;
}

class MarketService implements IMarketService {
  async downloadPackLocal(pack: SkillPack, onProgress: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          clearInterval(interval);
          onProgress(100);
          
          // Simulate actual file download trigger
          const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${pack.id}-pack.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          resolve();
        } else {
          onProgress(progress);
        }
      }, 500);
    });
  }

  async downloadSkillLocal(skill: Skill, onProgress: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          clearInterval(interval);
          onProgress(100);
          
          // Simulate actual file download trigger
          const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${skill.id}-skill.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          resolve();
        } else {
          onProgress(progress);
        }
      }, 500);
    });
  }

  async getSkillList(params: ListParams = {}): Promise<PaginatedResult<Skill>> {
    const skills = await this.getSkills();
    
    let filtered = skills;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(lowerKeyword) || 
        s.description.toLowerCase().includes(lowerKeyword) ||
        s.category.toLowerCase().includes(lowerKeyword)
      );
    }
    
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total
    };
  }

  async getPackList(params: ListParams = {}): Promise<PaginatedResult<SkillPack>> {
    const packs = await this.getPacks();
    
    let filtered = packs;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(lowerKeyword) || 
        p.description.toLowerCase().includes(lowerKeyword)
      );
    }
    
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total
    };
  }

  async getSkills(): Promise<Skill[]> {
    const res = await fetch('/api/skills');
    if (!res.ok) throw new Error('Failed to fetch skills');
    return res.json();
  }

  async getSkill(id: string): Promise<Skill> {
    const res = await fetch(`/api/skills/${id}`);
    if (!res.ok) throw new Error('Failed to fetch skill');
    return res.json();
  }

  async getSkillReviews(id: string): Promise<Review[]> {
    const res = await fetch(`/api/skills/${id}/reviews`);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
  }

  async getPacks(): Promise<SkillPack[]> {
    const res = await fetch('/api/packs');
    if (!res.ok) throw new Error('Failed to fetch packs');
    return res.json();
  }

  async getPack(id: string): Promise<SkillPack> {
    const res = await fetch(`/api/packs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch pack details');
    return res.json();
  }

  async installSkill(instanceId: string, skillId: string): Promise<any> {
    const res = await fetch('/api/installations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: instanceId, skill_id: skillId })
    });
    if (!res.ok) throw new Error('Installation failed');
    return res.json();
  }

  async installPack(instanceId: string, packId: string): Promise<any> {
    const res = await fetch('/api/installations/pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: instanceId, pack_id: packId })
    });
    if (!res.ok) throw new Error('Pack installation failed');
    return res.json();
  }

  async installPackWithSkills(instanceId: string, packId: string, skillIds: string[]): Promise<any> {
    const res = await fetch('/api/installations/pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_id: packId,
        device_id: instanceId,
        skill_ids: skillIds
      })
    });
    if (!res.ok) throw new Error('Installation failed');
    return res.json();
  }
}

export const marketService = new MarketService();
