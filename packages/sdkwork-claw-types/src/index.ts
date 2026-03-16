export * from './service';

export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  creator: string;
}

export interface Device {
  id: string;
  name: string;
  battery: number;
  ip_address: string;
  status?: 'online' | 'offline' | 'starting' | 'error';
  created_at?: string;
  hardwareSpecs?: {
    soc: string;
    ram: string;
    storage: string;
    latency: string;
  };
}

export interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  status: 'running' | 'stopped' | 'error';
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  author: string;
  rating: number;
  downloads: number;
  category: string;
  icon?: string;
  version?: string;
  size?: string;
  updatedAt?: string;
  readme?: string;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  author: string;
  rating: number;
  downloads: number;
  skills: Skill[];
  category: string;
}

export interface Review {
  id: string;
  user: string;
  user_name: string;
  rating: number;
  comment: string;
  date: string;
  created_at: string;
}
