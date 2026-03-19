import type { PaginatedResult } from './service';

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

export type ProxyProviderStatus = 'active' | 'warning' | 'disabled' | 'expired';

export interface ProxyProviderUsage {
  requestCount: number;
  tokenCount: number;
  spendUsd: number;
  period: '24h' | '7d' | '30d';
}

export interface ProxyProviderGroup {
  id: string;
  name: string;
  description: string;
}

export interface ProxyProviderModel {
  id: string;
  name: string;
}

export interface ProxyProvider {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  groupId: string;
  usage: ProxyProviderUsage;
  expiresAt: string | null;
  status: ProxyProviderStatus;
  createdAt: string;
  baseUrl: string;
  models: ProxyProviderModel[];
  notes?: string;
}

export interface ProxyProviderCreate {
  channelId: string;
  name: string;
  apiKey: string;
  groupId: string;
  baseUrl: string;
  models: ProxyProviderModel[];
  expiresAt?: string | null;
  notes?: string;
}

export interface ProxyProviderUpdate {
  name?: string;
  apiKey?: string;
  groupId?: string;
  expiresAt?: string | null;
  status?: ProxyProviderStatus;
  baseUrl?: string;
  models?: ProxyProviderModel[];
  notes?: string;
}

export type UnifiedApiKeySource = 'system-generated' | 'custom';

export interface UnifiedApiKey {
  id: string;
  name: string;
  apiKey: string;
  source: UnifiedApiKeySource;
  groupId: string;
  usage: ProxyProviderUsage;
  expiresAt: string | null;
  status: ProxyProviderStatus;
  createdAt: string;
  modelMappingId?: string;
  notes?: string;
}

export interface UnifiedApiKeyCreate {
  name: string;
  groupId: string;
  apiKey?: string;
  source?: UnifiedApiKeySource;
  expiresAt?: string | null;
  notes?: string;
}

export interface UnifiedApiKeyUpdate {
  name?: string;
  apiKey?: string;
  source?: UnifiedApiKeySource;
  groupId?: string;
  expiresAt?: string | null;
  status?: ProxyProviderStatus;
  modelMappingId?: string | null;
  notes?: string;
}

export type ModelMappingStatus = ProxyProviderStatus;

export interface ModelMappingModelRef {
  channelId: string;
  channelName: string;
  modelId: string;
  modelName: string;
}

export interface ModelMappingRule {
  id: string;
  source: ModelMappingModelRef;
  target: ModelMappingModelRef;
}

export interface ModelMappingRuleInput {
  id?: string;
  source: ModelMappingModelRef;
  target: ModelMappingModelRef;
}

export interface ModelMapping {
  id: string;
  name: string;
  description: string;
  status: ModelMappingStatus;
  effectiveFrom: string;
  effectiveTo: string;
  createdAt: string;
  rules: ModelMappingRule[];
}

export interface ModelMappingCreate {
  name: string;
  description?: string;
  effectiveFrom: string;
  effectiveTo: string;
  rules: ModelMappingRuleInput[];
}

export interface ModelMappingUpdate {
  name?: string;
  description?: string;
  status?: ModelMappingStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
  rules?: ModelMappingRuleInput[];
}

export interface ModelMappingCatalogModel {
  modelId: string;
  modelName: string;
}

export interface ModelMappingCatalogChannel {
  channelId: string;
  channelName: string;
  models: ModelMappingCatalogModel[];
}

export interface ApiRouterChannel {
  id: string;
  name: string;
  vendor: string;
  description: string;
  modelFamily: string;
  providerCount: number;
  activeProviderCount: number;
  warningProviderCount: number;
  disabledProviderCount: number;
}

export type ApiRouterUsageRecordSortField = 'model' | 'time';

export type ApiRouterUsageTimeRangePreset = '24h' | '7d' | '30d' | 'custom';

export type ApiRouterUsageRecordType = 'streaming' | 'standard';

export interface ApiRouterUsageRecordApiKeyOption {
  id: string;
  label: string;
}

export interface ApiRouterUsageRecord {
  id: string;
  apiKeyId: string;
  apiKeyName: string;
  model: string;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  endpoint: string;
  type: ApiRouterUsageRecordType;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costUsd: number;
  ttftMs: number;
  durationMs: number;
  startedAt: string;
  userAgent: string;
}

export interface ApiRouterUsageRecordSummary {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalSpendUsd: number;
  averageDurationMs: number;
}

export interface ApiRouterUsageRecordsQuery {
  apiKeyId?: string;
  timeRange?: ApiRouterUsageTimeRangePreset;
  startDate?: string;
  endDate?: string;
  sortBy?: ApiRouterUsageRecordSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type ApiRouterUsageRecordsResult = PaginatedResult<ApiRouterUsageRecord>;
