export interface ApiKey {
  id: string;
  name: string;
  token: string;
  created: string;
  lastUsed: string;
}

export interface CreateApiKeyResponse {
  key: ApiKey;
  fullToken: string;
}

export interface IApiKeyService {
  getApiKeys(): Promise<ApiKey[]>;
  createApiKey(name: string): Promise<CreateApiKeyResponse>;
  revokeApiKey(id: string): Promise<void>;
}

class ApiKeyService implements IApiKeyService {
  private mockApiKeys: ApiKey[] = [
    { id: '1', name: 'Production Gateway', token: 'oc_live_••••••••••••••••a1b2', created: 'Oct 24, 2023', lastUsed: '2 mins ago' },
    { id: '2', name: 'Development Testing', token: 'oc_test_••••••••••••••••x9y8', created: 'Nov 12, 2023', lastUsed: 'Never' }
  ];

  async getApiKeys(): Promise<ApiKey[]> {
    return new Promise(resolve => setTimeout(() => resolve([...this.mockApiKeys]), 300));
  }

  async createApiKey(name: string): Promise<CreateApiKeyResponse> {
    return new Promise(resolve => {
      setTimeout(() => {
        const prefix = name.toLowerCase().includes('test') ? 'oc_test_' : 'oc_live_';
        const randomString = Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const fullToken = `${prefix}${randomString}`;
        
        const newKey: ApiKey = {
          id: Date.now().toString(),
          name,
          token: `${prefix}••••••••••••••••${fullToken.slice(-4)}`,
          created: 'Just now',
          lastUsed: 'Never'
        };
        
        this.mockApiKeys = [...this.mockApiKeys, newKey];
        resolve({ key: newKey, fullToken });
      }, 500);
    });
  }

  async revokeApiKey(id: string): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.mockApiKeys = this.mockApiKeys.filter(key => key.id !== id);
        resolve();
      }, 400);
    });
  }
}

export const apiKeyService = new ApiKeyService();
