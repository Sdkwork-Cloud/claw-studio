import type {
  ApiRouterChannel,
  ApiRouterUsageRecordApiKeyOption,
  ApiRouterUsageRecordSummary,
  ApiRouterUsageRecordsQuery,
  ApiRouterUsageRecordsResult,
  ModelMapping,
  ModelMappingCatalogChannel,
  ModelMappingCreate,
  ModelMappingStatus,
  ModelMappingUpdate,
  ProxyProvider,
  ProxyProviderCreate,
  ProxyProviderGroup,
  ProxyProviderStatus,
  ProxyProviderUpdate,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeyUpdate,
} from '@sdkwork/claw-types';

export type ApiRouterOwnershipMode =
  | 'uninitialized'
  | 'attached'
  | 'managed'
  | 'stopped';

export interface ApiRouterRuntimeStatus {
  ownership: ApiRouterOwnershipMode;
  routerHomeDir: string;
  metadataDir: string;
  databasePath: string;
  extractionDir: string;
  adminBaseUrl: string;
  gatewayBaseUrl: string;
  adminHealthy: boolean;
  gatewayHealthy: boolean;
  authSessionReady: boolean;
  adminAuthReady: boolean;
  adminPid?: number | null;
  gatewayPid?: number | null;
}

export interface ApiRouterProviderQuery {
  channelId?: string;
  keyword?: string;
  groupId?: string;
}

export interface ApiRouterUnifiedApiKeyQuery {
  keyword?: string;
  groupId?: string;
}

export interface ApiRouterModelMappingQuery {
  keyword?: string;
}

export interface ApiRouterPlatformAPI {
  getRuntimeStatus(): Promise<ApiRouterRuntimeStatus>;
  getChannels(): Promise<ApiRouterChannel[]>;
  getGroups(): Promise<ProxyProviderGroup[]>;
  getProxyProviders(query?: ApiRouterProviderQuery): Promise<ProxyProvider[]>;
  createProxyProvider(input: ProxyProviderCreate): Promise<ProxyProvider>;
  updateProxyProviderGroup(id: string, groupId: string): Promise<ProxyProvider>;
  updateProxyProviderStatus(id: string, status: ProxyProviderStatus): Promise<ProxyProvider>;
  updateProxyProvider(id: string, update: ProxyProviderUpdate): Promise<ProxyProvider>;
  deleteProxyProvider(id: string): Promise<boolean>;
  getUsageRecordApiKeys(): Promise<ApiRouterUsageRecordApiKeyOption[]>;
  getUsageRecordSummary(query?: ApiRouterUsageRecordsQuery): Promise<ApiRouterUsageRecordSummary>;
  getUsageRecords(query?: ApiRouterUsageRecordsQuery): Promise<ApiRouterUsageRecordsResult>;
  getUnifiedApiKeys(query?: ApiRouterUnifiedApiKeyQuery): Promise<UnifiedApiKey[]>;
  createUnifiedApiKey(input: UnifiedApiKeyCreate): Promise<UnifiedApiKey>;
  updateUnifiedApiKeyGroup(id: string, groupId: string): Promise<UnifiedApiKey>;
  updateUnifiedApiKeyStatus(id: string, status: ProxyProviderStatus): Promise<UnifiedApiKey>;
  assignUnifiedApiKeyModelMapping(
    id: string,
    modelMappingId: string | null,
  ): Promise<UnifiedApiKey>;
  updateUnifiedApiKey(id: string, update: UnifiedApiKeyUpdate): Promise<UnifiedApiKey>;
  deleteUnifiedApiKey(id: string): Promise<boolean>;
  getModelCatalog(): Promise<ModelMappingCatalogChannel[]>;
  getModelMappings(query?: ApiRouterModelMappingQuery): Promise<ModelMapping[]>;
  createModelMapping(input: ModelMappingCreate): Promise<ModelMapping>;
  updateModelMapping(id: string, update: ModelMappingUpdate): Promise<ModelMapping>;
  updateModelMappingStatus(id: string, status: ModelMappingStatus): Promise<ModelMapping>;
  deleteModelMapping(id: string): Promise<boolean>;
}
