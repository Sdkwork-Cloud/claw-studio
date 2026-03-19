import { ListParams, PaginatedResult, delay } from '@sdkwork/claw-types';

export interface ApiKey {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  lastUsedAt: string | null;
  monthlyUsageUsd: number;
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

  getApiKeys(): Promise<ApiKey[]>;
  createApiKey(name: string): Promise<CreateApiKeyResponse>;
  revokeApiKey(id: string): Promise<void>;
}

function maskToken(prefix: string, fullToken: string) {
  return `${prefix}${'*'.repeat(16)}${fullToken.slice(-4)}`;
}

class ApiKeyService implements IApiKeyService {
  private data: ApiKey[] = [
    {
      id: '1',
      name: 'Production Gateway',
      token: 'oc_live_****************a1b2',
      createdAt: '2023-10-24T08:00:00.000Z',
      lastUsedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      monthlyUsageUsd: 24.5,
    },
    {
      id: '2',
      name: 'Development Testing',
      token: 'oc_test_****************z9y8',
      createdAt: '2023-11-12T08:00:00.000Z',
      lastUsedAt: null,
      monthlyUsageUsd: 0,
    },
  ];

  async getList(params: ListParams = {}): Promise<PaginatedResult<ApiKey>> {
    await delay();
    let filtered = [...this.data];

    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter((key) => key.name.toLowerCase().includes(lowerKeyword));
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
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<ApiKey | null> {
    await delay();
    return this.data.find((key) => key.id === id) || null;
  }

  async create(data: CreateApiKeyDTO): Promise<CreateApiKeyResponse> {
    await delay();
    const prefix = data.name.toLowerCase().includes('test') ? 'oc_test_' : 'oc_live_';
    const randomString = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const fullToken = `${prefix}${randomString}`;

    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: data.name,
      token: maskToken(prefix, fullToken),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      monthlyUsageUsd: 0,
    };

    this.data.push(newKey);
    return { key: newKey, fullToken };
  }

  async update(id: string, data: UpdateApiKeyDTO): Promise<ApiKey> {
    await delay();
    const index = this.data.findIndex((key) => key.id === id);
    if (index === -1) {
      throw new Error('API key not found');
    }

    this.data[index] = { ...this.data[index], ...data };
    return this.data[index];
  }

  async delete(id: string): Promise<boolean> {
    await delay();
    const initialLength = this.data.length;
    this.data = this.data.filter((key) => key.id !== id);
    return this.data.length < initialLength;
  }

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
