import { delay, type ListParams, type PaginatedResult } from './serviceTypes.ts';

export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  creator: string;
}

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
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent>;
}

export interface AgentServiceOptions {
  delayMs?: number;
  seedData?: Agent[];
}

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Code Master',
    description: 'Expert in software development and architecture.',
    avatar: 'CM',
    systemPrompt:
      'You are an expert software developer. Provide clean, efficient, and well-documented code.',
    creator: 'OpenClaw',
  },
  {
    id: 'agent-2',
    name: 'Creative Writer',
    description: 'Specializes in creative writing, storytelling, and content creation.',
    avatar: 'CW',
    systemPrompt:
      'You are a creative writer. Write engaging, imaginative, and compelling content.',
    creator: 'OpenClaw',
  },
  {
    id: 'agent-3',
    name: 'Data Analyst',
    description: 'Analyzes data, creates visualizations, and provides insights.',
    avatar: 'DA',
    systemPrompt:
      'You are a data analyst. Provide clear, accurate, and insightful analysis of data.',
    creator: 'OpenClaw',
  },
];

export function createAgentService(options: AgentServiceOptions = {}): IAgentService {
  const delayMs = options.delayMs ?? 300;
  let data = (options.seedData ?? DEFAULT_AGENTS).map((agent) => ({ ...agent }));

  return {
    async getList(params: ListParams = {}) {
      await delay(delayMs);

      let filtered = [...data];
      if (params.keyword) {
        const keyword = params.keyword.toLowerCase();
        filtered = filtered.filter(
          (agent) =>
            agent.name.toLowerCase().includes(keyword) ||
            agent.description.toLowerCase().includes(keyword),
        );
      }

      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 10;
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return {
        items,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
      };
    },

    async getById(id: string) {
      await delay(delayMs);
      return data.find((agent) => agent.id === id) ?? null;
    },

    async create(payload: CreateAgentDTO) {
      await delay(delayMs);
      const agent: Agent = {
        id: `agent-${Date.now()}`,
        ...payload,
      };
      data.push(agent);
      return agent;
    },

    async update(id: string, payload: UpdateAgentDTO) {
      await delay(delayMs);
      const index = data.findIndex((agent) => agent.id === id);
      if (index === -1) {
        throw new Error('Agent not found');
      }

      data[index] = {
        ...data[index],
        ...payload,
      };

      return data[index];
    },

    async delete(id: string) {
      await delay(delayMs);
      const previousLength = data.length;
      data = data.filter((agent) => agent.id !== id);
      return data.length < previousLength;
    },

    async getAgents() {
      await delay(delayMs);
      return data.map((agent) => ({ ...agent }));
    },

    async getAgent(id: string) {
      await delay(delayMs);
      const agent = data.find((item) => item.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      return { ...agent };
    },
  };
}

export const agentService = createAgentService();
