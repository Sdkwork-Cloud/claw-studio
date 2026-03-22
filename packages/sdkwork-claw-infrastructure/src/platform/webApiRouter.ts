import type {
  ApiRouterModelMappingQuery,
  ApiRouterPlatformAPI,
  ApiRouterProviderQuery,
  ApiRouterRuntimeStatus,
  ApiRouterUnifiedApiKeyQuery,
} from './contracts/apiRouter.ts';

const DEFAULT_UNAVAILABLE_MESSAGE =
  'API Router live access is not configured for this runtime.';

export class ApiRouterUnavailableError extends Error {
  constructor(operation: string, message = DEFAULT_UNAVAILABLE_MESSAGE) {
    super(`API Router ${operation} is unavailable: ${message}`);
    this.name = 'ApiRouterUnavailableError';
  }
}

function throwUnavailable(operation: string): never {
  throw new ApiRouterUnavailableError(operation);
}

export class WebApiRouterPlatform implements ApiRouterPlatformAPI {
  async getRuntimeStatus(): Promise<ApiRouterRuntimeStatus> {
    return throwUnavailable('runtime status');
  }

  async getChannels() {
    return throwUnavailable('channel access');
  }

  async getGroups() {
    return throwUnavailable('group access');
  }

  async getProxyProviders(_query: ApiRouterProviderQuery = {}) {
    return throwUnavailable('proxy provider access');
  }

  async createProxyProvider(_input) {
    return throwUnavailable('proxy provider creation');
  }

  async updateProxyProviderGroup(_id: string, _groupId: string) {
    return throwUnavailable('proxy provider group updates');
  }

  async updateProxyProviderStatus(_id: string, _status) {
    return throwUnavailable('proxy provider status updates');
  }

  async updateProxyProvider(_id: string, _update) {
    return throwUnavailable('proxy provider updates');
  }

  async deleteProxyProvider(_id: string) {
    return throwUnavailable('proxy provider deletion');
  }

  async getUsageRecordApiKeys() {
    return throwUnavailable('usage record API key access');
  }

  async getUsageRecordSummary(_query = {}) {
    return throwUnavailable('usage record summary access');
  }

  async getUsageRecords(_query = {}) {
    return throwUnavailable('usage record access');
  }

  async getUnifiedApiKeys(_query: ApiRouterUnifiedApiKeyQuery = {}) {
    return throwUnavailable('unified API key access');
  }

  async createUnifiedApiKey(_input) {
    return throwUnavailable('unified API key creation');
  }

  async updateUnifiedApiKeyGroup(_id: string, _groupId: string) {
    return throwUnavailable('unified API key group updates');
  }

  async updateUnifiedApiKeyStatus(_id: string, _status) {
    return throwUnavailable('unified API key status updates');
  }

  async assignUnifiedApiKeyModelMapping(_id: string, _modelMappingId: string | null) {
    return throwUnavailable('unified API key model mapping updates');
  }

  async updateUnifiedApiKey(_id: string, _update) {
    return throwUnavailable('unified API key updates');
  }

  async deleteUnifiedApiKey(_id: string) {
    return throwUnavailable('unified API key deletion');
  }

  async getModelCatalog() {
    return throwUnavailable('model catalog access');
  }

  async getModelMappings(_query: ApiRouterModelMappingQuery = {}) {
    return throwUnavailable('model mapping access');
  }

  async createModelMapping(_input) {
    return throwUnavailable('model mapping creation');
  }

  async updateModelMapping(_id: string, _update) {
    return throwUnavailable('model mapping updates');
  }

  async updateModelMappingStatus(_id: string, _status) {
    return throwUnavailable('model mapping status updates');
  }

  async deleteModelMapping(_id: string) {
    return throwUnavailable('model mapping deletion');
  }
}
