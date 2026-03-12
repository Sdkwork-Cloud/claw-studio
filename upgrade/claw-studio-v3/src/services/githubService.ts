import { ListParams, PaginatedResult } from '../types/service';

export interface GithubRepo {
  id: string;
  name: string;
  author: string;
  description: string;
  stars: number;
  forks: number;
  tags: string[];
  iconUrl: string;
}

export interface CreateGithubRepoDTO {
  name: string;
  author: string;
  description: string;
  tags: string[];
  iconUrl: string;
}

export interface UpdateGithubRepoDTO extends Partial<CreateGithubRepoDTO> {}

export interface IGithubService {
  getList(params?: ListParams): Promise<PaginatedResult<GithubRepo>>;
  getById(id: string): Promise<GithubRepo | null>;
  create(data: CreateGithubRepoDTO): Promise<GithubRepo>;
  update(id: string, data: UpdateGithubRepoDTO): Promise<GithubRepo>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getRepos(): Promise<GithubRepo[]>;
  installRepo(id: string, name: string): Promise<void>;
  downloadRepo(id: string, name: string): Promise<void>;
}

class GithubService implements IGithubService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<GithubRepo>> {
    const repos = await this.getRepos();
    
    let filtered = repos;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(lowerKeyword) || 
        r.description.toLowerCase().includes(lowerKeyword) ||
        r.author.toLowerCase().includes(lowerKeyword)
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

  async getById(id: string): Promise<GithubRepo | null> {
    const repos = await this.getRepos();
    return repos.find(r => r.id === id) || null;
  }

  async create(data: CreateGithubRepoDTO): Promise<GithubRepo> {
    throw new Error('Method not implemented.');
  }

  async update(id: string, data: UpdateGithubRepoDTO): Promise<GithubRepo> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  // Legacy methods
  async getRepos(): Promise<GithubRepo[]> {
    // Mock data for frontend development
    return [
      {
        id: '1',
        name: 'AutoGPT',
        author: 'Significant-Gravitas',
        description: 'An experimental open-source attempt to make GPT-4 fully autonomous.',
        stars: 150000,
        forks: 35000,
        tags: ['ai', 'agent', 'gpt-4', 'autonomous'],
        iconUrl: 'https://picsum.photos/seed/autogpt/100/100'
      },
      {
        id: '2',
        name: 'LangChain',
        author: 'hwchase17',
        description: 'Building applications with LLMs through composability.',
        stars: 75000,
        forks: 12000,
        tags: ['llm', 'framework', 'python', 'javascript'],
        iconUrl: 'https://picsum.photos/seed/langchain/100/100'
      },
      {
        id: '3',
        name: 'Stable Diffusion WebUI',
        author: 'AUTOMATIC1111',
        description: 'Stable Diffusion web UI.',
        stars: 110000,
        forks: 22000,
        tags: ['image-generation', 'stable-diffusion', 'ui'],
        iconUrl: 'https://picsum.photos/seed/sdwebui/100/100'
      },
      {
        id: '4',
        name: 'BabyAGI',
        author: 'yoheinakajima',
        description: 'An AI-powered task management system.',
        stars: 18000,
        forks: 2500,
        tags: ['ai', 'agent', 'task-management'],
        iconUrl: 'https://picsum.photos/seed/babyagi/100/100'
      },
      {
        id: '5',
        name: 'PrivateGPT',
        author: 'imartinez',
        description: 'Interact privately with your documents using the power of GPT, 100% privately, no data leaks.',
        stars: 45000,
        forks: 5000,
        tags: ['privacy', 'llm', 'documents'],
        iconUrl: 'https://picsum.photos/seed/privategpt/100/100'
      },
      {
        id: '6',
        name: 'LlamaIndex',
        author: 'jerryjliu',
        description: 'LlamaIndex (formerly GPT Index) is a data framework for your LLM applications.',
        stars: 28000,
        forks: 3200,
        tags: ['data', 'llm', 'framework'],
        iconUrl: 'https://picsum.photos/seed/llamaindex/100/100'
      }
    ];
  }

  async installRepo(id: string, name: string): Promise<void> {
    // Installation logic is handled by the component via task store, 
    // but we can simulate the backend call here.
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async downloadRepo(id: string, name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export const githubService = new GithubService();
