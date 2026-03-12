import { Skill } from '../types';
import { ListParams, PaginatedResult, delay } from '../types/service';

export interface IMySkillService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Skill>>;
  
  // Legacy methods
  getMySkills(instanceId: string): Promise<Skill[]>;
  uninstallSkill(instanceId: string, skillId: string): Promise<void>;
}

class MySkillService implements IMySkillService {
  private mockMySkills: Record<string, Skill[]> = {
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
        size: '2.4 MB'
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
        size: '1.1 MB'
      }
    ]
  };

  async getList(instanceId: string, params: ListParams = {}): Promise<PaginatedResult<Skill>> {
    await delay();
    const skills = this.mockMySkills[instanceId] || [];
    
    let filtered = [...skills];
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(lowerKeyword) || 
        s.description.toLowerCase().includes(lowerKeyword)
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

  async getMySkills(instanceId: string): Promise<Skill[]> {
    await delay();
    return this.mockMySkills[instanceId] || [];
  }

  async uninstallSkill(instanceId: string, skillId: string): Promise<void> {
    await delay();
    if (this.mockMySkills[instanceId]) {
      this.mockMySkills[instanceId] = this.mockMySkills[instanceId].filter(s => s.id !== skillId);
    }
  }
}

export const mySkillService = new MySkillService();
