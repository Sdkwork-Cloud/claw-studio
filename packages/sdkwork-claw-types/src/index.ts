import type { PaginatedResult } from './service.ts';

export * from './service.ts';

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
  skillKey?: string;
  name: string;
  description: string;
  author: string;
  rating: number;
  ratingCount?: number;
  downloads: number;
  category: string;
  icon?: string;
  version?: string;
  size?: string;
  updatedAt?: string;
  readme?: string;
  repositoryUrl?: string;
  homepageUrl?: string;
  documentationUrl?: string;
}

export interface SkillPack {
  id: string;
  packageKey?: string;
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
  createdAt: string | null;
  baseUrl: string;
  models: ProxyProviderModel[];
  notes?: string;
  canCopyApiKey?: boolean;
  credentialReference?: string;
  tenantId?: string;
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
export type UnifiedApiKeyRouteMode = 'sdkwork-remote' | 'custom';

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
  routeMode?: UnifiedApiKeyRouteMode;
  routeProviderId?: string | null;
  notes?: string;
  canCopyApiKey?: boolean;
  hashedKey?: string;
  tenantId?: string;
  projectId?: string;
  environment?: string;
}

export interface UnifiedApiKeyCreate {
  name: string;
  groupId: string;
  groupName?: string;
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
  routeMode?: UnifiedApiKeyRouteMode;
  routeProviderId?: string | null;
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

export type StudioRuntimeKind = 'openclaw' | 'zeroclaw' | 'ironclaw' | 'custom';

export type StudioInstanceDeploymentMode =
  | 'local-managed'
  | 'local-external'
  | 'remote';

export type StudioInstanceTransportKind =
  | 'openclawGatewayWs'
  | 'zeroclawHttp'
  | 'ironclawWeb'
  | 'openaiHttp'
  | 'customHttp'
  | 'customWs';

export type StudioInstanceStatus =
  | 'online'
  | 'offline'
  | 'starting'
  | 'error'
  | 'syncing';

export type StudioStorageProviderKind =
  | 'memory'
  | 'localFile'
  | 'sqlite'
  | 'postgres'
  | 'remoteApi';

export type StudioInstanceCapability =
  | 'chat'
  | 'health'
  | 'files'
  | 'memory'
  | 'tasks'
  | 'tools'
  | 'models';

export interface StudioStorageBinding {
  profileId?: string | null;
  provider: StudioStorageProviderKind;
  namespace: string;
  database?: string | null;
  connectionHint?: string | null;
  endpoint?: string | null;
}

export interface StudioInstanceConfig {
  port: string;
  sandbox: boolean;
  autoUpdate: boolean;
  logLevel: string;
  corsOrigins: string;
  workspacePath?: string | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  authToken?: string | null;
}

export interface StudioInstanceRecord {
  id: string;
  name: string;
  description?: string;
  runtimeKind: StudioRuntimeKind;
  deploymentMode: StudioInstanceDeploymentMode;
  transportKind: StudioInstanceTransportKind;
  status: StudioInstanceStatus;
  isBuiltIn: boolean;
  isDefault: boolean;
  iconType: 'apple' | 'box' | 'server';
  version: string;
  typeLabel: string;
  host: string;
  port?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  cpu: number;
  memory: number;
  totalMemory: string;
  uptime: string;
  capabilities: StudioInstanceCapability[];
  storage: StudioStorageBinding;
  config: StudioInstanceConfig;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number | null;
}

export type StudioConversationRole = 'user' | 'assistant' | 'system';
export type StudioConversationMessageStatus = 'complete' | 'streaming' | 'error';
export type StudioConversationAttachmentKind =
  | 'file'
  | 'image'
  | 'audio'
  | 'video'
  | 'screenshot'
  | 'screen-recording'
  | 'link';

export interface StudioConversationAttachment {
  id: string;
  kind: StudioConversationAttachmentKind;
  name: string;
  url?: string;
  previewUrl?: string;
  objectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileId?: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface StudioConversationMessage {
  id: string;
  conversationId: string;
  role: StudioConversationRole;
  content: string;
  createdAt: number;
  updatedAt: number;
  model?: string;
  senderInstanceId?: string | null;
  status: StudioConversationMessageStatus;
  attachments?: StudioConversationAttachment[];
}

export interface StudioConversationSummary {
  id: string;
  title: string;
  primaryInstanceId: string;
  participantInstanceIds: string[];
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview?: string;
}

export interface StudioConversationRecord extends StudioConversationSummary {
  messages: StudioConversationMessage[];
}

export type StudioInstanceHealthStatus =
  | 'healthy'
  | 'attention'
  | 'degraded'
  | 'offline';

export type StudioInstanceCapabilityStatus =
  | 'ready'
  | 'degraded'
  | 'configurationRequired'
  | 'unsupported'
  | 'planned';

export type StudioInstanceLifecycleOwner =
  | 'appManaged'
  | 'externalProcess'
  | 'remoteService';

export type StudioInstanceAuthMode = 'token' | 'none' | 'external' | 'unknown';

export type StudioInstanceEndpointKind =
  | 'http'
  | 'websocket'
  | 'openaiChatCompletions'
  | 'openaiResponses'
  | 'dashboard'
  | 'sse';

export type StudioInstanceEndpointStatus =
  | 'ready'
  | 'configurationRequired'
  | 'unavailable';

export type StudioInstanceExposure = 'loopback' | 'private' | 'remote';

export type StudioInstanceStorageStatus =
  | 'ready'
  | 'configurationRequired'
  | 'planned'
  | 'unavailable';

export type StudioInstanceObservabilityStatus = 'ready' | 'limited' | 'unavailable';
export type StudioInstanceDetailSource =
  | 'runtime'
  | 'config'
  | 'storage'
  | 'integration'
  | 'derived';

export type StudioInstanceDataAccessScope =
  | 'config'
  | 'logs'
  | 'files'
  | 'memory'
  | 'tasks'
  | 'tools'
  | 'models'
  | 'connectivity'
  | 'storage';

export type StudioInstanceDataAccessMode =
  | 'managedFile'
  | 'managedDirectory'
  | 'storageBinding'
  | 'remoteEndpoint'
  | 'metadataOnly';

export type StudioInstanceDataAccessStatus =
  | 'ready'
  | 'limited'
  | 'configurationRequired'
  | 'planned'
  | 'unavailable';

export type StudioInstanceArtifactKind =
  | 'configFile'
  | 'logFile'
  | 'workspaceDirectory'
  | 'runtimeDirectory'
  | 'endpoint'
  | 'storageBinding'
  | 'dashboard';

export type StudioInstanceArtifactStatus =
  | 'available'
  | 'configured'
  | 'missing'
  | 'remote'
  | 'planned';

export interface StudioInstanceHealthCheck {
  id: string;
  label: string;
  status: StudioInstanceHealthStatus;
  detail: string;
}

export interface StudioInstanceHealthSnapshot {
  score: number;
  status: StudioInstanceHealthStatus;
  checks: StudioInstanceHealthCheck[];
  evaluatedAt: number;
}

export interface StudioInstanceLifecycleSnapshot {
  owner: StudioInstanceLifecycleOwner;
  startStopSupported: boolean;
  configWritable: boolean;
  notes: string[];
}

export interface StudioInstanceConnectivityEndpoint {
  id: string;
  label: string;
  kind: StudioInstanceEndpointKind;
  status: StudioInstanceEndpointStatus;
  url?: string | null;
  exposure: StudioInstanceExposure;
  auth: StudioInstanceAuthMode;
  source: 'config' | 'derived' | 'runtime';
}

export interface StudioInstanceConnectivitySnapshot {
  primaryTransport: StudioInstanceTransportKind;
  endpoints: StudioInstanceConnectivityEndpoint[];
}

export interface StudioInstanceStorageSnapshot {
  status: StudioInstanceStorageStatus;
  profileId?: string | null;
  provider: StudioStorageProviderKind;
  namespace: string;
  database?: string | null;
  connectionHint?: string | null;
  endpoint?: string | null;
  durable: boolean;
  queryable: boolean;
  transactional: boolean;
  remote: boolean;
}

export interface StudioInstanceCapabilitySnapshot {
  id: StudioInstanceCapability;
  status: StudioInstanceCapabilityStatus;
  detail: string;
  source: 'runtime' | 'config' | 'storage' | 'integration';
}

export interface StudioInstanceObservabilitySnapshot {
  status: StudioInstanceObservabilityStatus;
  logAvailable: boolean;
  logFilePath?: string | null;
  logPreview: string[];
  lastSeenAt?: number | null;
  metricsSource: 'runtime' | 'derived';
}

export interface StudioInstanceDataAccessEntry {
  id: string;
  label: string;
  scope: StudioInstanceDataAccessScope;
  mode: StudioInstanceDataAccessMode;
  status: StudioInstanceDataAccessStatus;
  target?: string | null;
  readonly: boolean;
  authoritative: boolean;
  detail: string;
  source: StudioInstanceDetailSource;
}

export interface StudioInstanceDataAccessSnapshot {
  routes: StudioInstanceDataAccessEntry[];
}

export interface StudioInstanceArtifactRecord {
  id: string;
  label: string;
  kind: StudioInstanceArtifactKind;
  status: StudioInstanceArtifactStatus;
  location?: string | null;
  readonly: boolean;
  detail: string;
  source: StudioInstanceDetailSource;
}

export interface StudioInstanceRuntimeNote {
  title: string;
  content: string;
  sourceUrl?: string;
}

export type StudioInstanceConsoleKind = 'openclawControlUi';

export type StudioInstanceConsoleAuthMode =
  | 'token'
  | 'password'
  | 'none'
  | 'external'
  | 'unknown';

export type StudioInstanceConsoleAuthSource =
  | 'managedConfig'
  | 'installRecord'
  | 'workspaceConfig'
  | 'secretRef'
  | 'unresolved';

export type StudioInstanceConsoleInstallMethod =
  | 'bundled'
  | 'installerScript'
  | 'cliScript'
  | 'npm'
  | 'pnpm'
  | 'source'
  | 'git'
  | 'wsl'
  | 'docker'
  | 'podman'
  | 'ansible'
  | 'bun'
  | 'nix'
  | 'unknown';

export interface StudioInstanceConsoleAccessRecord {
  kind: StudioInstanceConsoleKind;
  available: boolean;
  url?: string | null;
  autoLoginUrl?: string | null;
  gatewayUrl?: string | null;
  authMode: StudioInstanceConsoleAuthMode;
  authSource?: StudioInstanceConsoleAuthSource | null;
  installMethod?: StudioInstanceConsoleInstallMethod | null;
  reason?: string | null;
}

export interface StudioWorkbenchChannelRecord {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode?: 'required' | 'none';
  fieldCount: number;
  configuredFieldCount: number;
  setupSteps: string[];
}

export interface StudioWorkbenchTaskScheduleConfig {
  intervalValue?: number;
  intervalUnit?: 'minute' | 'hour' | 'day';
  scheduledDate?: string;
  scheduledTime?: string;
  cronExpression?: string;
  cronTimezone?: string;
  staggerMs?: number;
}

export interface StudioWorkbenchTaskExecutionRecord {
  id: string;
  taskId: string;
  status: 'success' | 'failed' | 'running';
  trigger: 'schedule' | 'manual' | 'clone';
  startedAt: string;
  finishedAt?: string;
  summary: string;
  details?: string;
}

export interface StudioWorkbenchTaskRecord {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  schedule: string;
  scheduleMode: 'interval' | 'datetime' | 'cron';
  scheduleConfig: StudioWorkbenchTaskScheduleConfig;
  cronExpression?: string;
  actionType: 'message' | 'skill';
  status: 'active' | 'paused' | 'failed';
  sessionMode: 'isolated' | 'main' | 'current' | 'custom';
  customSessionId?: string;
  wakeUpMode: 'immediate' | 'nextCycle';
  executionContent: 'runAssistantTask' | 'sendPromptMessage';
  timeoutSeconds?: number;
  deleteAfterRun?: boolean;
  agentId?: string;
  model?: string;
  thinking?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  lightContext?: boolean;
  deliveryMode: 'publishSummary' | 'webhook' | 'none';
  deliveryBestEffort?: boolean;
  deliveryChannel?: string;
  deliveryLabel?: string;
  recipient?: string;
  lastRun?: string;
  nextRun?: string;
  latestExecution?: StudioWorkbenchTaskExecutionRecord | null;
  rawDefinition?: Record<string, unknown>;
}

export interface StudioWorkbenchCronTasksSnapshot {
  tasks: StudioWorkbenchTaskRecord[];
  taskExecutionsById: Record<string, StudioWorkbenchTaskExecutionRecord[]>;
}

export interface StudioWorkbenchLLMProviderModelRecord {
  id: string;
  name: string;
  role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
  contextWindow: string;
}

export interface StudioWorkbenchLLMProviderConfigRecord {
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
  streaming: boolean;
}

export interface StudioWorkbenchLLMProviderRecord {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  apiKeySource: string;
  status: 'ready' | 'degraded' | 'configurationRequired';
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  description: string;
  icon: string;
  lastCheckedAt: string;
  capabilities: string[];
  models: StudioWorkbenchLLMProviderModelRecord[];
  config: StudioWorkbenchLLMProviderConfigRecord;
}

export interface StudioWorkbenchAgentProfile {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  creator: string;
}

export interface StudioWorkbenchAgentRecord {
  agent: StudioWorkbenchAgentProfile;
  focusAreas: string[];
  automationFitScore: number;
}

export interface StudioWorkbenchSkillRecord {
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

export interface StudioWorkbenchFileRecord {
  id: string;
  name: string;
  path: string;
  category: 'config' | 'log' | 'prompt' | 'dataset' | 'memory' | 'artifact';
  language: string;
  size: string;
  updatedAt: string;
  status: 'synced' | 'modified' | 'generated' | 'missing';
  description: string;
  content: string;
  isReadonly: boolean;
}

export interface StudioWorkbenchMemoryEntryRecord {
  id: string;
  title: string;
  type: 'runbook' | 'conversation' | 'fact' | 'artifact';
  summary: string;
  source: 'operator' | 'agent' | 'system' | 'task';
  updatedAt: string;
  retention: 'pinned' | 'rolling' | 'expiring';
  tokens: number;
}

export interface StudioWorkbenchToolRecord {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'automation' | 'observability' | 'integration' | 'reasoning';
  status: 'ready' | 'beta' | 'restricted';
  access: 'read' | 'write' | 'execute';
  command: string;
  lastUsedAt?: string;
}

export interface StudioWorkbenchSnapshot {
  channels: StudioWorkbenchChannelRecord[];
  cronTasks: StudioWorkbenchCronTasksSnapshot;
  llmProviders: StudioWorkbenchLLMProviderRecord[];
  agents: StudioWorkbenchAgentRecord[];
  skills: StudioWorkbenchSkillRecord[];
  files: StudioWorkbenchFileRecord[];
  memory: StudioWorkbenchMemoryEntryRecord[];
  tools: StudioWorkbenchToolRecord[];
}

export interface StudioInstanceDetailRecord {
  instance: StudioInstanceRecord;
  config: StudioInstanceConfig;
  logs: string;
  health: StudioInstanceHealthSnapshot;
  lifecycle: StudioInstanceLifecycleSnapshot;
  storage: StudioInstanceStorageSnapshot;
  connectivity: StudioInstanceConnectivitySnapshot;
  observability: StudioInstanceObservabilitySnapshot;
  dataAccess: StudioInstanceDataAccessSnapshot;
  artifacts: StudioInstanceArtifactRecord[];
  capabilities: StudioInstanceCapabilitySnapshot[];
  officialRuntimeNotes: StudioInstanceRuntimeNote[];
  consoleAccess?: StudioInstanceConsoleAccessRecord | null;
  workbench?: StudioWorkbenchSnapshot | null;
}
