export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  battery: number;
  ip_address: string;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  readme: string;
  author: string;
  version: string;
  icon: string;
  category: string;
  downloads: number;
  rating: number;
  size: string;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: string;
  category: string;
  downloads: number;
  rating: number;
  skills?: Skill[];
}

export interface InstalledSkill extends Skill {
  installed_at: string;
}

export interface Review {
  id: string;
  skill_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}
