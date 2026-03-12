import { ListParams, PaginatedResult, delay } from '../types/service';

export interface ApiKey {
  id: string;
  name: string;
  token: string;
  created: string;
  lastUsed: string;
}

export interface CreateApiKeyDTO {
  name: string;
}

export interface UpdateApiKeyDTO {
  name?: string;
}

export interface CreateApiKeyResponse {
  key: ApiKey;
  fullToken: string;
}

export interface IApiKeyService {
  getList(params?: ListParams): Promise<PaginatedResult<ApiKey>>;
  getById(id: string): Promise<ApiKey | null>;
  create(data: CreateApiKeyDTO): Promise<CreateApiKeyResponse>;
  update(id: string, data: UpdateApiKeyDTO): Promise<ApiKey>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getApiKeys(): Promise<ApiKey[]>;
  createApiKey(name: string): Promise<CreateApiKeyResponse>;
  revokeApiKey(id: string): Promise<void>;
}

class ApiKeyService implements IApiKeyService {
  private data: ApiKey[] = [
    { id: '1', name: 'Production Gateway', token: 'oc_live_••••••••••••••••a1b2', created: 'Oct 24, 2023', lastUsed: '2 mins ago' },
    { id: '2', name: 'Development Testing', token: 'oc_test_••••••••••••••••x9y8', created: 'Nov 12, 2023', lastUsed: 'Never' }
  ];

  async getList(params: ListParams = {}): Promise<PaginatedResult<ApiKey>> {
    await delay();
    let filtered = [...this.data];
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(k => k.name.toLowerCase().includes(lowerKeyword));
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

  async getById(id: string): Promise<ApiKey | null> {
    await delay();
    return this.data.find(k => k.id === id) || null;
  }

  async create(data: CreateApiKeyDTO): Promise<CreateApiKeyResponse> {
    await delay();
    const prefix = data.name.toLowerCase().includes('test') ? 'oc_test_' : 'oc_live_';
    const randomString = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const fullToken = `${prefix}${randomString}`;
    
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: data.name,
      token: `${prefix}••••••••••••••••${fullToken.slice(-4)}`,
      created: 'Just now',
      lastUsed: 'Never'
    };
    
    this.data.push(newKey);
    return { key: newKey, fullToken };
  }

  async update(id: string, data: UpdateApiKeyDTO): Promise<ApiKey> {
    await delay();
    const index = this.data.findIndex(k => k.id === id);
    if (index === -1) throw new Error('API Key not found');
    
    this.data[index] = { ...this.data[index], ...data };
    return this.data[index];
  }

  async delete(id: string): Promise<boolean> {
    await delay();
    const initialLength = this.data.length;
    this.data = this.data.filter(k => k.id !== id);
    return this.data.length < initialLength;
  }

  // Legacy methods
  async getApiKeys(): Promise<ApiKey[]> {
    await delay();
    return [...this.data];
  }

  async createApiKey(name: string): Promise<CreateApiKeyResponse> {
    return this.create({ name });
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.delete(id);
  }
}

export const apiKeyService = new ApiKeyService();
