import { Agent } from '../types';
import { ListParams, PaginatedResult, delay } from '../types/service';

export interface CreateAgentDTO {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  creator: string;
}

export interface UpdateAgentDTO extends Partial<CreateAgentDTO> {}

export interface IAgentService {
  getList(params?: ListParams): Promise<PaginatedResult<Agent>>;
  getById(id: string): Promise<Agent | null>;
  create(data: CreateAgentDTO): Promise<Agent>;
  update(id: string, data: UpdateAgentDTO): Promise<Agent>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods for backward compatibility
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent>;
}

class AgentService implements IAgentService {
  private data: Agent[] = [
    {
      id: 'agent-1',
      name: 'Code Master',
      description: 'Expert in software development and architecture.',
      avatar: '👨‍💻',
      systemPrompt: 'You are an expert software developer. Provide clean, efficient, and well-documented code.',
      creator: 'OpenClaw'
    },
    {
      id: 'agent-2',
      name: 'Creative Writer',
      description: 'Specializes in creative writing, storytelling, and content creation.',
      avatar: '✍️',
      systemPrompt: 'You are a creative writer. Write engaging, imaginative, and compelling content.',
      creator: 'OpenClaw'
    },
    {
      id: 'agent-3',
      name: 'Data Analyst',
      description: 'Analyzes data, creates visualizations, and provides insights.',
      avatar: '📊',
      systemPrompt: 'You are a data analyst. Provide clear, accurate, and insightful analysis of data.',
      creator: 'OpenClaw'
    }
  ];

  async getList(params: ListParams = {}): Promise<PaginatedResult<Agent>> {
    await delay();
    let filtered = [...this.data];
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(lowerKeyword) || 
        a.description.toLowerCase().includes(lowerKeyword)
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

  async getById(id: string): Promise<Agent | null> {
    await delay();
    return this.data.find(a => a.id === id) || null;
  }

  async create(data: CreateAgentDTO): Promise<Agent> {
    await delay();
    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      ...data
    };
    this.data.push(newAgent);
    return newAgent;
  }

  async update(id: string, data: UpdateAgentDTO): Promise<Agent> {
    await delay();
    const index = this.data.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Agent not found');
    
    this.data[index] = { ...this.data[index], ...data };
    return this.data[index];
  }

  async delete(id: string): Promise<boolean> {
    await delay();
    const initialLength = this.data.length;
    this.data = this.data.filter(a => a.id !== id);
    return this.data.length < initialLength;
  }

  // Legacy methods
  async getAgents(): Promise<Agent[]> {
    await delay();
    return [...this.data];
  }

  async getAgent(id: string): Promise<Agent> {
    await delay();
    const agent = this.data.find(a => a.id === id);
    if (!agent) throw new Error('Agent not found');
    return agent;
  }
}

export const agentService = new AgentService();
