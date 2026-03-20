import type {
  Agent,
  ApiRouterChannel,
  ApiRouterUsageRecord,
  ApiRouterUsageRecordApiKeyOption,
  ApiRouterUsageRecordSortField,
  ApiRouterUsageRecordSummary,
  ApiRouterUsageRecordsQuery,
  ApiRouterUsageRecordsResult,
  ApiRouterUsageTimeRangePreset,
  Device,
  InstalledSkill,
  ModelMapping,
  ModelMappingCatalogChannel,
  ModelMappingCreate,
  ModelMappingModelRef,
  ModelMappingRule,
  ModelMappingRuleInput,
  ModelMappingStatus,
  ModelMappingUpdate,
  ProxyProviderCreate,
  ProxyProvider,
  ProxyProviderGroup,
  ProxyProviderModel,
  ProxyProviderStatus,
  ProxyProviderUpdate,
  Review,
  Skill,
  SkillPack,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeySource,
  UnifiedApiKeyUpdate,
} from '@sdkwork/claw-types';

export interface MockInstance {
  id: string;
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
  status: 'online' | 'offline' | 'starting' | 'error';
  version: string;
  uptime: string;
  ip: string;
  cpu: number;
  memory: number;
  totalMemory: string;
}

export interface MockInstanceConfig {
  port: string;
  sandbox: boolean;
  autoUpdate: boolean;
  logLevel: string;
  corsOrigins: string;
}

export interface MockTask {
  id: string;
  instanceId: string | null;
  name: string;
  description?: string;
  prompt: string;
  schedule: string;
  scheduleMode: 'interval' | 'datetime' | 'cron';
  scheduleConfig: {
    intervalValue?: number;
    intervalUnit?: 'minute' | 'hour' | 'day';
    scheduledDate?: string;
    scheduledTime?: string;
    cronExpression?: string;
  };
  cronExpression?: string;
  actionType: 'message' | 'skill';
  status: 'active' | 'paused' | 'failed';
  sessionMode: 'isolated' | 'main';
  wakeUpMode: 'immediate' | 'nextCycle';
  executionContent: 'runAssistantTask' | 'sendPromptMessage';
  timeoutSeconds?: number;
  deliveryMode: 'publishSummary' | 'none';
  deliveryChannel?: string;
  recipient?: string;
  lastRun?: string;
  nextRun?: string;
}

export interface MockTaskExecutionHistoryEntry {
  id: string;
  taskId: string;
  status: 'success' | 'failed' | 'running';
  trigger: 'schedule' | 'manual' | 'clone';
  startedAt: string;
  finishedAt?: string;
  summary: string;
  details?: string;
}

export interface MockChannelField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  value?: string;
  helpText?: string;
}

export interface MockChannel {
  id: string;
  instanceId: string | null;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  fields: MockChannelField[];
  setupGuide: string[];
}

export interface MockInstanceFile {
  id: string;
  instanceId: string;
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

export interface MockInstanceLLMProviderModel {
  id: string;
  name: string;
  role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
  contextWindow: string;
}

export interface MockInstanceLLMProviderConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
  streaming: boolean;
}

export interface MockInstanceLLMProvider {
  id: string;
  instanceId: string;
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
  models: MockInstanceLLMProviderModel[];
  config: MockInstanceLLMProviderConfig;
}

export interface MockInstanceLLMProviderUpdate {
  endpoint?: string;
  apiKeySource?: string;
  defaultModelId?: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config?: Partial<MockInstanceLLMProviderConfig>;
}

export interface MockInstanceLLMProviderCreate {
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
  models: MockInstanceLLMProviderModel[];
  config: MockInstanceLLMProviderConfig;
}

export interface MockInstanceMemoryEntry {
  id: string;
  instanceId: string;
  title: string;
  type: 'runbook' | 'conversation' | 'fact' | 'artifact';
  summary: string;
  source: 'operator' | 'agent' | 'system' | 'task';
  updatedAt: string;
  retention: 'pinned' | 'rolling' | 'expiring';
  tokens: number;
}

export interface MockInstanceTool {
  id: string;
  instanceId: string;
  name: string;
  description: string;
  category: 'filesystem' | 'automation' | 'observability' | 'integration' | 'reasoning';
  status: 'ready' | 'beta' | 'restricted';
  access: 'read' | 'write' | 'execute';
  command: string;
  lastUsedAt?: string;
}

export interface MockUserProfile {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export interface MockUserPreferences {
  general: {
    launchOnStartup: boolean;
    startMinimized: boolean;
  };
  notifications: {
    systemUpdates: boolean;
    taskFailures: boolean;
    securityAlerts: boolean;
    taskCompletions: boolean;
    newMessages: boolean;
  };
  privacy: {
    shareUsageData: boolean;
    personalizedRecommendations: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    loginAlerts: boolean;
  };
}

export interface MockAppItem {
  id: string;
  name: string;
  developer: string;
  category: string;
  description?: string;
  banner?: string;
  icon: string;
  rating: number;
  rank?: number;
  reviewsCount?: string;
  screenshots?: string[];
  version?: string;
  size?: string;
  releaseDate?: string;
  compatibility?: string;
  ageRating?: string;
  featured?: boolean;
  topChart?: boolean;
}

export interface MockAppCategory {
  title: string;
  subtitle: string;
  appIds: string[];
}

interface StudioMockServiceOptions {
  latencyMs?: number;
}

function createProxyProviderModel(id: string, name?: string): ProxyProviderModel {
  const normalizedId = id.trim();
  const normalizedName = (name || id).trim();

  return {
    id: normalizedId,
    name: normalizedName,
  };
}

function normalizeProxyProviderModels(models: ProxyProviderModel[]) {
  return models
    .map((model) => createProxyProviderModel(model.id, model.name))
    .filter((model) => model.id && model.name);
}

function cloneSkill(skill: Skill): Skill {
  return { ...skill };
}

function cloneReview(review: Review): Review {
  return { ...review };
}

function clonePack(pack: SkillPack): SkillPack {
  return {
    ...pack,
    skills: pack.skills.map(cloneSkill),
  };
}

function cloneDevice(device: Device): Device {
  return {
    ...device,
    hardwareSpecs: device.hardwareSpecs ? { ...device.hardwareSpecs } : undefined,
  };
}

function cloneAgent(agent: Agent): Agent {
  return { ...agent };
}

function cloneInstalledSkill(skill: InstalledSkill): InstalledSkill {
  return { ...skill };
}

function cloneInstance(instance: MockInstance): MockInstance {
  return { ...instance };
}

function cloneInstanceConfig(config: MockInstanceConfig): MockInstanceConfig {
  return { ...config };
}

function cloneTask(task: MockTask): MockTask {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
  };
}

function cloneTaskExecutionHistoryEntry(
  entry: MockTaskExecutionHistoryEntry,
): MockTaskExecutionHistoryEntry {
  return { ...entry };
}

function cloneChannelField(field: MockChannelField): MockChannelField {
  return { ...field };
}

function cloneChannel(channel: MockChannel): MockChannel {
  return {
    ...channel,
    fields: channel.fields.map(cloneChannelField),
    setupGuide: [...channel.setupGuide],
  };
}

function cloneProxyProviderUsage(usage: ProxyProvider['usage']): ProxyProvider['usage'] {
  return { ...usage };
}

function cloneProxyProviderGroup(group: ProxyProviderGroup): ProxyProviderGroup {
  return { ...group };
}

function cloneProxyProvider(provider: ProxyProvider): ProxyProvider {
  return {
    ...provider,
    usage: cloneProxyProviderUsage(provider.usage),
    models: provider.models.map((model) => ({ ...model })),
  };
}

function cloneUnifiedApiKey(item: UnifiedApiKey): UnifiedApiKey {
  return {
    ...item,
    usage: cloneProxyProviderUsage(item.usage),
  };
}

function cloneModelMappingModelRef(ref: ModelMappingModelRef): ModelMappingModelRef {
  return { ...ref };
}

function cloneModelMappingRule(rule: ModelMappingRule): ModelMappingRule {
  return {
    ...rule,
    source: cloneModelMappingModelRef(rule.source),
    target: cloneModelMappingModelRef(rule.target),
  };
}

function cloneModelMapping(item: ModelMapping): ModelMapping {
  return {
    ...item,
    rules: item.rules.map(cloneModelMappingRule),
  };
}

function cloneModelMappingCatalogChannel(
  channel: ModelMappingCatalogChannel,
): ModelMappingCatalogChannel {
  return {
    ...channel,
    models: channel.models.map((model) => ({ ...model })),
  };
}

function cloneApiRouterChannel(channel: ApiRouterChannel): ApiRouterChannel {
  return { ...channel };
}

function cloneApiRouterUsageRecordApiKeyOption(
  option: ApiRouterUsageRecordApiKeyOption,
): ApiRouterUsageRecordApiKeyOption {
  return { ...option };
}

function cloneApiRouterUsageRecord(item: ApiRouterUsageRecord): ApiRouterUsageRecord {
  return { ...item };
}

function cloneApiRouterUsageRecordSummary(
  summary: ApiRouterUsageRecordSummary,
): ApiRouterUsageRecordSummary {
  return { ...summary };
}

function cloneInstanceFile(file: MockInstanceFile): MockInstanceFile {
  return { ...file };
}

function cloneInstanceLLMProviderModel(
  model: MockInstanceLLMProviderModel,
): MockInstanceLLMProviderModel {
  return { ...model };
}

function cloneInstanceLLMProviderConfig(
  config: MockInstanceLLMProviderConfig,
): MockInstanceLLMProviderConfig {
  return { ...config };
}

function cloneInstanceLLMProvider(provider: MockInstanceLLMProvider): MockInstanceLLMProvider {
  return {
    ...provider,
    capabilities: [...provider.capabilities],
    models: provider.models.map(cloneInstanceLLMProviderModel),
    config: cloneInstanceLLMProviderConfig(provider.config),
  };
}

function formatByteSize(content: string) {
  const bytes = new TextEncoder().encode(content).length;

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${bytes} B`;
}

function serializeInstanceConfigContent(fileName: string, config: MockInstanceConfig) {
  if (fileName.endsWith('.json')) {
    return JSON.stringify(
      {
        port: Number(config.port),
        corsOrigins: config.corsOrigins,
        sandbox: config.sandbox,
        autoUpdate: config.autoUpdate,
        logLevel: config.logLevel,
      },
      null,
      2,
    );
  }

  if (fileName.endsWith('.toml')) {
    return [
      `port = "${config.port}"`,
      `cors_origins = "${config.corsOrigins}"`,
      `sandbox = ${config.sandbox}`,
      `auto_update = ${config.autoUpdate}`,
      `log_level = "${config.logLevel}"`,
    ].join('\n');
  }

  return [
    `CLAW_PORT=${config.port}`,
    `CLAW_CORS_ORIGINS=${config.corsOrigins}`,
    `CLAW_SANDBOX=${config.sandbox}`,
    `CLAW_AUTO_UPDATE=${config.autoUpdate}`,
    `CLAW_LOG_LEVEL=${config.logLevel}`,
  ].join('\n');
}

function parseBooleanValue(value: string | undefined, fallback: boolean) {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return fallback;
}

function parseInstanceConfigContent(
  fileName: string,
  content: string,
  current: MockInstanceConfig,
): MockInstanceConfig {
  if (fileName.endsWith('.json')) {
    const parsed = JSON.parse(content) as Partial<Record<keyof MockInstanceConfig, unknown>>;
    return {
      port: String(parsed.port ?? current.port),
      corsOrigins: String(parsed.corsOrigins ?? current.corsOrigins),
      sandbox: Boolean(parsed.sandbox ?? current.sandbox),
      autoUpdate: Boolean(parsed.autoUpdate ?? current.autoUpdate),
      logLevel: String(parsed.logLevel ?? current.logLevel),
    };
  }

  if (fileName.endsWith('.toml')) {
    const entries = Object.fromEntries(
      content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const [rawKey, ...rest] = line.split('=');
          return [rawKey.trim(), rest.join('=').trim().replace(/^"|"$/g, '')];
        }),
    );

    return {
      port: entries.port || current.port,
      corsOrigins: entries.cors_origins || current.corsOrigins,
      sandbox: parseBooleanValue(entries.sandbox, current.sandbox),
      autoUpdate: parseBooleanValue(entries.auto_update, current.autoUpdate),
      logLevel: entries.log_level || current.logLevel,
    };
  }

  const entries = Object.fromEntries(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [rawKey, ...rest] = line.split('=');
        return [rawKey.trim(), rest.join('=').trim()];
      }),
  );

  return {
    port: entries.CLAW_PORT || current.port,
    corsOrigins: entries.CLAW_CORS_ORIGINS || current.corsOrigins,
    sandbox: parseBooleanValue(entries.CLAW_SANDBOX, current.sandbox),
    autoUpdate: parseBooleanValue(entries.CLAW_AUTO_UPDATE, current.autoUpdate),
    logLevel: entries.CLAW_LOG_LEVEL || current.logLevel,
  };
}

function cloneInstanceMemoryEntry(entry: MockInstanceMemoryEntry): MockInstanceMemoryEntry {
  return { ...entry };
}

function cloneInstanceTool(tool: MockInstanceTool): MockInstanceTool {
  return { ...tool };
}

function cloneProfile(profile: MockUserProfile): MockUserProfile {
  return { ...profile };
}

function clonePreferences(preferences: MockUserPreferences): MockUserPreferences {
  return {
    general: { ...preferences.general },
    notifications: { ...preferences.notifications },
    privacy: { ...preferences.privacy },
    security: { ...preferences.security },
  };
}

function cloneAppItem(app: MockAppItem): MockAppItem {
  return {
    ...app,
    screenshots: app.screenshots ? [...app.screenshots] : undefined,
  };
}

function mergePreferences(
  current: MockUserPreferences,
  next: Partial<MockUserPreferences>,
): MockUserPreferences {
  return {
    general: { ...current.general, ...next.general },
    notifications: { ...current.notifications, ...next.notifications },
    privacy: { ...current.privacy, ...next.privacy },
    security: { ...current.security, ...next.security },
  };
}

function createInitialInstances(): MockInstance[] {
  return [
    {
      id: 'local-built-in',
      name: 'Local Workspace',
      type: 'macOS Native',
      iconType: 'apple',
      status: 'online',
      version: 'v0.3.1',
      uptime: '6d 4h',
      ip: '127.0.0.1',
      cpu: 12,
      memory: 36,
      totalMemory: '32 GB',
    },
    {
      id: 'home-nas',
      name: 'Home NAS Gateway',
      type: 'Docker Container',
      iconType: 'box',
      status: 'online',
      version: 'v0.3.0',
      uptime: '21d 9h',
      ip: '192.168.1.100',
      cpu: 42,
      memory: 61,
      totalMemory: '16 GB',
    },
    {
      id: 'edge-prod',
      name: 'Edge Production Node',
      type: 'Ubuntu Linux',
      iconType: 'server',
      status: 'offline',
      version: 'v0.2.9',
      uptime: '-',
      ip: '10.0.8.17',
      cpu: 0,
      memory: 0,
      totalMemory: '64 GB',
    },
  ];
}

function createInitialInstanceConfigs(): Record<string, MockInstanceConfig> {
  return {
    'local-built-in': {
      port: '18789',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
    },
    'home-nas': {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'warn',
      corsOrigins: 'http://localhost:3001',
    },
    'edge-prod': {
      port: '8080',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'error',
      corsOrigins: '*',
    },
  };
}

function createInitialInstanceTokens(): Record<string, string> {
  return {
    'local-built-in': 'oc_token_local_builtin_9f8e7d6c5b4a',
    'home-nas': 'oc_token_home_nas_1a2b3c4d5e6f',
    'edge-prod': 'oc_token_edge_prod_q1w2e3r4t5y6',
  };
}

function createInitialTasks(): MockTask[] {
  return [
    {
      id: 'task-1',
      instanceId: 'local-built-in',
      name: 'Daily System Check',
      description: 'Run the core system verification workflow every morning.',
      prompt: 'Check system health, summarize any drift, and post the operator summary.',
      schedule: '0 8 * * *',
      scheduleMode: 'cron',
      scheduleConfig: {
        cronExpression: '0 8 * * *',
      },
      cronExpression: '0 8 * * *',
      actionType: 'skill',
      status: 'active',
      sessionMode: 'isolated',
      wakeUpMode: 'immediate',
      executionContent: 'runAssistantTask',
      timeoutSeconds: 90,
      deliveryMode: 'publishSummary',
      deliveryChannel: 'qq',
      recipient: 'ops-room',
      lastRun: '2 hours ago',
      nextRun: 'in 22 hours',
    },
    {
      id: 'task-2',
      instanceId: null,
      name: 'Weekly Workspace Summary',
      description: 'Collect highlights from the last week for workspace operators.',
      prompt: 'Summarize the most important activity from the last 7 days.',
      schedule: '0 9 * * 1',
      scheduleMode: 'cron',
      scheduleConfig: {
        cronExpression: '0 9 * * 1',
      },
      cronExpression: '0 9 * * 1',
      actionType: 'message',
      status: 'paused',
      sessionMode: 'main',
      wakeUpMode: 'nextCycle',
      executionContent: 'sendPromptMessage',
      timeoutSeconds: 60,
      deliveryMode: 'publishSummary',
      deliveryChannel: 'qq',
      recipient: 'strategy-room',
      lastRun: '3 days ago',
      nextRun: '-',
    },
  ];
}

function createInitialTaskExecutions(): Record<string, MockTaskExecutionHistoryEntry[]> {
  return {
    'task-1': [
      {
        id: 'task-1-run-1',
        taskId: 'task-1',
        status: 'success',
        trigger: 'schedule',
        startedAt: 'Today 08:00',
        finishedAt: 'Today 08:01',
        summary: 'Daily system check completed and published a summary.',
        details: 'The isolated assistant task finished successfully and posted the operator digest.',
      },
      {
        id: 'task-1-run-2',
        taskId: 'task-1',
        status: 'success',
        trigger: 'schedule',
        startedAt: 'Yesterday 08:00',
        finishedAt: 'Yesterday 08:01',
        summary: 'Daily system check completed and found no blocking issues.',
        details: 'No drift was detected. The summary was delivered to the configured channel.',
      },
    ],
    'task-2': [
      {
        id: 'task-2-run-1',
        taskId: 'task-2',
        status: 'failed',
        trigger: 'schedule',
        startedAt: '3 days ago 09:00',
        finishedAt: '3 days ago 09:02',
        summary: 'Weekly summary stopped because the destination channel was unavailable.',
        details: 'The prompt ran, but delivery failed because the downstream channel was offline.',
      },
    ],
  };
}

function createInitialChannels(): MockChannel[] {
  return [
    {
      id: 'feishu',
      instanceId: null,
      name: 'Feishu',
      description: 'Route agent notifications and approval requests into Feishu groups.',
      icon: 'MessageCircle',
      status: 'not_configured',
      enabled: false,
      setupGuide: [
        'Create a custom bot in your Feishu group settings.',
        'Copy the webhook URL and verification token.',
        'Save the configuration and send a test message.',
      ],
      fields: [
        {
          key: 'webhookUrl',
          label: 'Webhook URL',
          type: 'text',
          placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
        },
        {
          key: 'verificationToken',
          label: 'Verification Token',
          type: 'password',
          placeholder: 'Enter verification token',
        },
      ],
    },
    {
      id: 'qq',
      instanceId: null,
      name: 'QQ Bot',
      description: 'Forward operational alerts and command approvals into QQ groups.',
      icon: 'Smile',
      status: 'connected',
      enabled: true,
      setupGuide: [
        'Enable the QQ bot for your target group.',
        'Copy the bot key and endpoint.',
        'Validate delivery with a dry-run notification.',
      ],
      fields: [
        {
          key: 'botKey',
          label: 'Bot Key',
          type: 'password',
          placeholder: 'Enter QQ bot key',
          value: 'qq_bot_key_live',
        },
        {
          key: 'groupId',
          label: 'Group ID',
          type: 'text',
          placeholder: '123456789',
          value: '1029384756',
          helpText: 'The target QQ group that receives automation updates.',
        },
      ],
    },
    {
      id: 'dingtalk',
      instanceId: null,
      name: 'DingTalk',
      description: 'Connect operational broadcasts and task notifications to DingTalk.',
      icon: 'Zap',
      status: 'disconnected',
      enabled: false,
      setupGuide: [
        'Create a custom robot in DingTalk.',
        'Copy the access token and secret.',
        'Save the configuration to enable outbound messages.',
      ],
      fields: [
        {
          key: 'accessToken',
          label: 'Access Token',
          type: 'password',
          placeholder: 'Enter access token',
        },
        {
          key: 'secret',
          label: 'Secret',
          type: 'password',
          placeholder: 'Enter signing secret',
        },
      ],
    },
    {
      id: 'wecom',
      instanceId: null,
      name: 'WeCom',
      description: 'Sync Claw Studio status changes with enterprise WeCom channels.',
      icon: 'Building2',
      status: 'not_configured',
      enabled: false,
      setupGuide: [
        'Create a WeCom application with bot permissions.',
        'Provide the corp ID, agent ID, and secret.',
        'Run a connectivity check after saving.',
      ],
      fields: [
        {
          key: 'corpId',
          label: 'Corp ID',
          type: 'text',
          placeholder: 'Enter corp ID',
        },
        {
          key: 'agentId',
          label: 'Agent ID',
          type: 'text',
          placeholder: 'Enter agent ID',
        },
        {
          key: 'secret',
          label: 'Secret',
          type: 'password',
          placeholder: 'Enter secret',
        },
      ],
    },
  ];
}

interface ProxyProviderSeedModel {
  id: string;
  name?: string;
}

interface ProxyProviderSeed {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  groupId: string;
  requestCount: number;
  tokenCount: number;
  spendUsd: number;
  period?: ProxyProvider['usage']['period'];
  expiresAt: string | null;
  status: ProxyProviderStatus;
  createdAt: string;
  baseUrl: string;
  models: ProxyProviderSeedModel[];
  notes?: string;
}

function createSeedProxyProvider(seed: ProxyProviderSeed): ProxyProvider {
  return {
    id: seed.id,
    channelId: seed.channelId,
    name: seed.name,
    apiKey: seed.apiKey,
    groupId: seed.groupId,
    usage: {
      requestCount: seed.requestCount,
      tokenCount: seed.tokenCount,
      spendUsd: seed.spendUsd,
      period: seed.period ?? '30d',
    },
    expiresAt: seed.expiresAt,
    status: seed.status,
    createdAt: seed.createdAt,
    baseUrl: seed.baseUrl,
    models: seed.models.map((model) => createProxyProviderModel(model.id, model.name)),
    notes: seed.notes,
  };
}

interface UnifiedApiKeySeed {
  id: string;
  name: string;
  apiKey: string;
  source: UnifiedApiKeySource;
  groupId: string;
  modelMappingId?: string;
  requestCount: number;
  tokenCount: number;
  spendUsd: number;
  period?: UnifiedApiKey['usage']['period'];
  expiresAt: string | null;
  status: ProxyProviderStatus;
  createdAt: string;
  notes?: string;
}

function createSeedUnifiedApiKey(seed: UnifiedApiKeySeed): UnifiedApiKey {
  return {
    id: seed.id,
    name: seed.name,
    apiKey: seed.apiKey,
    source: seed.source,
    groupId: seed.groupId,
    usage: {
      requestCount: seed.requestCount,
      tokenCount: seed.tokenCount,
      spendUsd: seed.spendUsd,
      period: seed.period ?? '30d',
    },
    expiresAt: seed.expiresAt,
    status: seed.status,
    createdAt: seed.createdAt,
    modelMappingId: seed.modelMappingId,
    notes: seed.notes,
  };
}

interface ModelMappingSeedRuleRef {
  channelId: string;
  modelId: string;
  modelName: string;
}

interface ModelMappingSeedRule {
  id: string;
  source: ModelMappingSeedRuleRef;
  target: ModelMappingSeedRuleRef;
}

interface ModelMappingSeed {
  id: string;
  name: string;
  description?: string;
  status: ModelMappingStatus;
  effectiveFrom: string;
  effectiveTo: string;
  createdAt: string;
  rules: ModelMappingSeedRule[];
}

function createSeedModelMapping(seed: ModelMappingSeed): ModelMapping {
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description || '',
    status: seed.status,
    effectiveFrom: seed.effectiveFrom,
    effectiveTo: seed.effectiveTo,
    createdAt: seed.createdAt,
    rules: seed.rules.map((rule) => ({
      id: rule.id,
      source: createModelMappingModelRef(
        rule.source.channelId,
        rule.source.modelId,
        rule.source.modelName,
      ),
      target: createModelMappingModelRef(
        rule.target.channelId,
        rule.target.modelId,
        rule.target.modelName,
      ),
    })),
  };
}

interface ApiRouterUsageRecordSeed {
  id: string;
  apiKeyId: string;
  apiKeyName: string;
  model: string;
  reasoningEffort: ApiRouterUsageRecord['reasoningEffort'];
  endpoint: string;
  type: ApiRouterUsageRecord['type'];
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costUsd: number;
  ttftMs: number;
  durationMs: number;
  startedAt: string;
  userAgent: string;
}

function createSeedApiRouterUsageRecord(seed: ApiRouterUsageRecordSeed): ApiRouterUsageRecord {
  return { ...seed };
}

const apiRouterUsageRecordReferenceTime = '2026-03-19T23:59:59.000Z';

const apiRouterUsageRecordSeeds: ApiRouterUsageRecordSeed[] = [
  {
    id: 'usage-record-1',
    apiKeyId: 'team-web-dev',
    apiKeyName: 'Team Web Dev',
    model: 'gpt-5.4',
    reasoningEffort: 'xhigh',
    endpoint: '/responses',
    type: 'streaming',
    promptTokens: 16840,
    completionTokens: 4210,
    cachedTokens: 1200,
    costUsd: 0.083421,
    ttftMs: 482,
    durationMs: 6840,
    startedAt: '2026-03-19T16:42:18.000Z',
    userAgent: 'Claw Studio Web/3.2.0 Chrome/134.0 macOS 15.3',
  },
  {
    id: 'usage-record-2',
    apiKeyId: 'team-web-dev',
    apiKeyName: 'Team Web Dev',
    model: 'gpt-5.4-mini',
    reasoningEffort: 'medium',
    endpoint: '/responses',
    type: 'standard',
    promptTokens: 6240,
    completionTokens: 960,
    cachedTokens: 0,
    costUsd: 0.011642,
    ttftMs: 214,
    durationMs: 1420,
    startedAt: '2026-03-18T11:08:33.000Z',
    userAgent: 'Codex CLI/0.41.0 Node/22 Windows/11',
  },
  {
    id: 'usage-record-3',
    apiKeyId: 'team-mobile-prod',
    apiKeyName: 'Team Mobile Prod',
    model: 'claude-sonnet-4',
    reasoningEffort: 'high',
    endpoint: '/responses',
    type: 'streaming',
    promptTokens: 9800,
    completionTokens: 2980,
    cachedTokens: 240,
    costUsd: 0.057318,
    ttftMs: 531,
    durationMs: 4380,
    startedAt: '2026-03-18T03:21:09.000Z',
    userAgent: 'iOSApp/6.8.1 Darwin/24.3.0 iPhone17,2',
  },
  {
    id: 'usage-record-4',
    apiKeyId: 'partner-lab',
    apiKeyName: 'Partner Lab',
    model: 'gemini-2.5-pro',
    reasoningEffort: 'high',
    endpoint: '/responses',
    type: 'standard',
    promptTokens: 14220,
    completionTokens: 2210,
    cachedTokens: 520,
    costUsd: 0.044811,
    ttftMs: 388,
    durationMs: 2960,
    startedAt: '2026-03-17T21:05:55.000Z',
    userAgent: 'PartnerGateway/2.4.3 Go-http-client/2.0 linux/amd64',
  },
  {
    id: 'usage-record-5',
    apiKeyId: 'team-web-dev',
    apiKeyName: 'Team Web Dev',
    model: 'o4-mini',
    reasoningEffort: 'high',
    endpoint: '/responses',
    type: 'streaming',
    promptTokens: 11840,
    completionTokens: 5120,
    cachedTokens: 0,
    costUsd: 0.049782,
    ttftMs: 603,
    durationMs: 7025,
    startedAt: '2026-03-17T08:44:12.000Z',
    userAgent: 'Claw Studio Desktop/3.2.0 Tauri/2 Windows/11',
  },
  {
    id: 'usage-record-6',
    apiKeyId: 'finance-ops',
    apiKeyName: 'Finance Ops',
    model: 'gpt-5.4',
    reasoningEffort: 'minimal',
    endpoint: '/responses',
    type: 'standard',
    promptTokens: 2840,
    completionTokens: 640,
    cachedTokens: 0,
    costUsd: 0.007264,
    ttftMs: 176,
    durationMs: 980,
    startedAt: '2026-03-16T14:17:40.000Z',
    userAgent: 'BackofficeBatch/1.9 Java/21 Linux/x86_64',
  },
  {
    id: 'usage-record-7',
    apiKeyId: 'team-mobile-prod',
    apiKeyName: 'Team Mobile Prod',
    model: 'gpt-5.4-mini',
    reasoningEffort: 'medium',
    endpoint: '/responses',
    type: 'streaming',
    promptTokens: 5520,
    completionTokens: 1880,
    cachedTokens: 80,
    costUsd: 0.017452,
    ttftMs: 271,
    durationMs: 2240,
    startedAt: '2026-03-15T09:56:27.000Z',
    userAgent: 'AndroidApp/5.9.0 Android/15 Pixel9Pro',
  },
  {
    id: 'usage-record-8',
    apiKeyId: 'team-web-dev',
    apiKeyName: 'Team Web Dev',
    model: 'claude-sonnet-4',
    reasoningEffort: 'xhigh',
    endpoint: '/responses',
    type: 'streaming',
    promptTokens: 23210,
    completionTokens: 6080,
    cachedTokens: 680,
    costUsd: 0.096214,
    ttftMs: 692,
    durationMs: 8220,
    startedAt: '2026-03-14T19:12:05.000Z',
    userAgent: 'Codex CLI/0.41.0 Node/22 macOS/15.3',
  },
  {
    id: 'usage-record-9',
    apiKeyId: 'partner-lab',
    apiKeyName: 'Partner Lab',
    model: 'deepseek-r1',
    reasoningEffort: 'xhigh',
    endpoint: '/responses',
    type: 'standard',
    promptTokens: 18990,
    completionTokens: 3310,
    cachedTokens: 0,
    costUsd: 0.036508,
    ttftMs: 744,
    durationMs: 9510,
    startedAt: '2026-03-14T07:40:14.000Z',
    userAgent: 'ResearchRunner/0.18 Python/3.12 Ubuntu/24.04',
  },
  {
    id: 'usage-record-10',
    apiKeyId: 'finance-ops',
    apiKeyName: 'Finance Ops',
    model: 'gemini-2.5-flash',
    reasoningEffort: 'low',
    endpoint: '/responses',
    type: 'standard',
    promptTokens: 1740,
    completionTokens: 420,
    cachedTokens: 32,
    costUsd: 0.003842,
    ttftMs: 131,
    durationMs: 740,
    startedAt: '2026-03-13T10:08:49.000Z',
    userAgent: 'OpsAutomation/4.2 Python/3.11 Debian/12',
  },
  {
    id: 'usage-record-11',
    apiKeyId: 'team-mobile-prod',
    apiKeyName: 'Team Mobile Prod',
    model: 'gpt-4.1',
    reasoningEffort: 'medium',
    endpoint: '/responses',
    type: 'streaming',
    promptTokens: 7840,
    completionTokens: 1540,
    cachedTokens: 160,
    costUsd: 0.018694,
    ttftMs: 344,
    durationMs: 2610,
    startedAt: '2026-03-10T05:33:11.000Z',
    userAgent: 'MobileGateway/8.0 Kotlin/2.1 Android/15',
  },
  {
    id: 'usage-record-12',
    apiKeyId: 'team-web-dev',
    apiKeyName: 'Team Web Dev',
    model: 'gpt-4o-mini',
    reasoningEffort: 'low',
    endpoint: '/responses',
    type: 'standard',
    promptTokens: 4280,
    completionTokens: 720,
    cachedTokens: 0,
    costUsd: 0.006314,
    ttftMs: 158,
    durationMs: 1160,
    startedAt: '2026-02-24T13:22:40.000Z',
    userAgent: 'Claw Studio Web/3.1.9 Chrome/133.0 macOS 15.2',
  },
];

const syntheticApiRouterUsageRecordCount = 14;

function roundApiRouterUsageCost(value: number) {
  return Number(value.toFixed(6));
}

function createSyntheticApiRouterUsageRecord(
  seed: ApiRouterUsageRecordSeed,
  index: number,
): ApiRouterUsageRecord {
  const referenceTime = new Date(apiRouterUsageRecordReferenceTime).getTime();
  const promptTokens = Math.max(240, Math.round(seed.promptTokens * (0.7 + (index % 4) * 0.12)));
  const completionTokens = Math.max(120, Math.round(seed.completionTokens * (0.68 + (index % 5) * 0.09)));
  const cachedTokens =
    seed.cachedTokens === 0
      ? index % 3 === 0
        ? 48
        : 0
      : Math.max(0, Math.round(seed.cachedTokens * (0.6 + (index % 3) * 0.15)));
  const ttftMs = Math.max(90, seed.ttftMs + (index % 5 - 2) * 24 + index * 7);
  const durationMs = Math.max(
    ttftMs + 180,
    Math.round(seed.durationMs * (0.76 + (index % 4) * 0.08)),
  );
  const type =
    index % 3 === 0
      ? seed.type
      : seed.type === 'streaming'
        ? 'standard'
        : 'streaming';

  return {
    ...seed,
    id: `usage-record-${apiRouterUsageRecordSeeds.length + index + 1}`,
    type,
    promptTokens,
    completionTokens,
    cachedTokens,
    costUsd: roundApiRouterUsageCost(seed.costUsd * (0.72 + (index % 5) * 0.07)),
    ttftMs,
    durationMs,
    startedAt: new Date(referenceTime - (index + 1) * 19 * 60 * 60 * 1000).toISOString(),
  };
}

function createInitialApiRouterUsageRecords(): ApiRouterUsageRecord[] {
  const seededRecords = apiRouterUsageRecordSeeds.map(createSeedApiRouterUsageRecord);
  const syntheticRecords = Array.from({ length: syntheticApiRouterUsageRecordCount }, (_, index) =>
    createSyntheticApiRouterUsageRecord(
      apiRouterUsageRecordSeeds[index % apiRouterUsageRecordSeeds.length],
      index,
    ),
  );

  return [...seededRecords, ...syntheticRecords];
}

function listApiRouterUsageRecordOptions(
  records: ApiRouterUsageRecord[],
): ApiRouterUsageRecordApiKeyOption[] {
  const options = new Map<string, string>();

  records.forEach((item) => {
    options.set(item.apiKeyId, item.apiKeyName);
  });

  return [
    {
      id: 'all',
      label: 'All API Keys',
    },
    ...[...options.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  ];
}

function normalizeApiRouterUsageRecordsQuery(query: ApiRouterUsageRecordsQuery = {}) {
  return {
    apiKeyId: query.apiKeyId || 'all',
    timeRange: query.timeRange || '30d',
    startDate: query.startDate,
    endDate: query.endDate,
    sortBy: query.sortBy || 'time',
    sortOrder: query.sortOrder || 'desc',
    page: Math.max(1, query.page || 1),
    pageSize: Math.max(1, query.pageSize || 20),
  } as const;
}

function getApiRouterUsageRangeStart(timeRange: ApiRouterUsageTimeRangePreset) {
  const end = new Date(apiRouterUsageRecordReferenceTime).getTime();

  switch (timeRange) {
    case '24h':
      return end - 24 * 60 * 60 * 1000;
    case '7d':
      return end - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return end - 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function parseUsageDateStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function parseUsageDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`).getTime();
}

function matchesApiRouterUsageRecordRange(
  item: ApiRouterUsageRecord,
  query: ReturnType<typeof normalizeApiRouterUsageRecordsQuery>,
) {
  const itemTime = new Date(item.startedAt).getTime();

  if (query.timeRange === 'custom') {
    const start = query.startDate ? parseUsageDateStart(query.startDate) : null;
    const end = query.endDate ? parseUsageDateEnd(query.endDate) : null;

    if (start != null && end != null && start > end) {
      return false;
    }

    if (start != null && itemTime < start) {
      return false;
    }

    if (end != null && itemTime > end) {
      return false;
    }

    return true;
  }

  const rangeStart = getApiRouterUsageRangeStart(query.timeRange);
  return rangeStart == null ? true : itemTime >= rangeStart;
}

function sortApiRouterUsageRecords(
  items: ApiRouterUsageRecord[],
  sortBy: ApiRouterUsageRecordSortField,
  sortOrder: 'asc' | 'desc',
) {
  const direction = sortOrder === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    if (sortBy === 'model') {
      return left.model.localeCompare(right.model) * direction;
    }

    return (new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()) * direction;
  });
}

function buildApiRouterUsageRecordSummary(
  items: ApiRouterUsageRecord[],
): ApiRouterUsageRecordSummary {
  const promptTokens = items.reduce((sum, item) => sum + item.promptTokens, 0);
  const completionTokens = items.reduce((sum, item) => sum + item.completionTokens, 0);
  const cachedTokens = items.reduce((sum, item) => sum + item.cachedTokens, 0);
  const totalSpendUsd = items.reduce((sum, item) => sum + item.costUsd, 0);
  const totalDurationMs = items.reduce((sum, item) => sum + item.durationMs, 0);
  const totalRequests = items.length;

  return {
    totalRequests,
    totalTokens: promptTokens + completionTokens + cachedTokens,
    promptTokens,
    completionTokens,
    cachedTokens,
    totalSpendUsd,
    averageDurationMs: totalRequests === 0 ? 0 : Math.round(totalDurationMs / totalRequests),
  };
}

function queryApiRouterUsageRecords(
  records: ApiRouterUsageRecord[],
  rawQuery: ApiRouterUsageRecordsQuery = {},
) {
  const query = normalizeApiRouterUsageRecordsQuery(rawQuery);

  const filtered = records.filter((item) => {
    if (query.apiKeyId !== 'all' && item.apiKeyId !== query.apiKeyId) {
      return false;
    }

    return matchesApiRouterUsageRecordRange(item, query);
  });

  const sorted = sortApiRouterUsageRecords(filtered, query.sortBy, query.sortOrder);
  const startIndex = (query.page - 1) * query.pageSize;
  const items = sorted.slice(startIndex, startIndex + query.pageSize);

  return {
    query,
    filtered,
    paginated: {
      items: items.map(cloneApiRouterUsageRecord),
      total: sorted.length,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: startIndex + query.pageSize < sorted.length,
    } satisfies ApiRouterUsageRecordsResult,
  };
}

const apiRouterChannelCatalog: Array<
  Pick<ApiRouterChannel, 'id' | 'name' | 'vendor' | 'description' | 'modelFamily'>
> = [
  {
    id: 'openai',
    name: 'OpenAI',
    vendor: 'OpenAI',
    description: 'GPT family routing, enterprise gateway connectivity, and ecosystem compatibility.',
    modelFamily: 'GPT-4.1 / o-series',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    vendor: 'Anthropic',
    description: 'Claude routing for long-context, safe completion, and tool orchestration workloads.',
    modelFamily: 'Claude 3.7 / 4',
  },
  {
    id: 'google',
    name: 'Google',
    vendor: 'Google DeepMind',
    description: 'Gemini class models for multimodal, retrieval, and enterprise productivity use cases.',
    modelFamily: 'Gemini 2.x',
  },
  {
    id: 'xai',
    name: 'xAI',
    vendor: 'xAI',
    description: 'Grok-oriented proxies for fast conversational and reasoning-heavy traffic.',
    modelFamily: 'Grok 2 / 3',
  },
  {
    id: 'meta',
    name: 'Meta',
    vendor: 'Meta AI',
    description: 'Llama family routing for open ecosystem deployment and partner cloud inference lanes.',
    modelFamily: 'Llama 4 / Llama 3',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    vendor: 'Mistral AI',
    description: 'European frontier model routing with strong coding, multilingual, and agentic workloads.',
    modelFamily: 'Mistral Large / Codestral',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    vendor: 'Cohere',
    description: 'Enterprise-grade command, retrieval, and embedding traffic for production assistants.',
    modelFamily: 'Command / Embed',
  },
  {
    id: 'amazon-nova',
    name: 'Amazon Nova',
    vendor: 'Amazon Web Services',
    description: 'Bedrock-native Nova routes for enterprise scaling, governance, and multimodal orchestration.',
    modelFamily: 'Nova Pro / Nova Micro',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    vendor: 'Microsoft AI',
    description: 'Phi and Azure AI inference routes for cost-sensitive agents and enterprise hosting.',
    modelFamily: 'Phi / MAI',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    vendor: 'NVIDIA',
    description: 'Nemotron and NIM-ready gateways for accelerated inference and private deployment stacks.',
    modelFamily: 'Nemotron / NIM',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    vendor: 'DeepSeek',
    description: 'High-efficiency Chinese and coding-oriented model gateways with cost leverage.',
    modelFamily: 'DeepSeek V3 / R1',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    vendor: 'Alibaba Cloud',
    description: 'Alibaba Qwen routing for bilingual enterprise and tool-augmented workloads.',
    modelFamily: 'Qwen 2.5 / QwQ',
  },
  {
    id: 'zhipu',
    name: 'Zhipu',
    vendor: 'Zhipu AI',
    description: 'GLM model access for mainland connectivity and compliant enterprise integration.',
    modelFamily: 'GLM-4.x',
  },
  {
    id: 'baidu',
    name: 'Baidu',
    vendor: 'Baidu AI Cloud',
    description: 'ERNIE and Qianfan routing for enterprise Chinese language, reasoning, and search-heavy flows.',
    modelFamily: 'ERNIE / X1',
  },
  {
    id: 'tencent-hunyuan',
    name: 'Tencent Hunyuan',
    vendor: 'Tencent Cloud',
    description: 'Hunyuan routing for consumer-scale assistants, mainland traffic, and enterprise copilots.',
    modelFamily: 'Hunyuan Turbo / T1',
  },
  {
    id: 'doubao',
    name: 'Doubao',
    vendor: 'ByteDance',
    description: 'Volcengine Ark and Doubao routes for high-throughput consumer and business traffic.',
    modelFamily: 'Doubao / Seed',
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    vendor: 'Moonshot AI',
    description: 'Kimi-oriented routing for long context, web-native reasoning, and global Chinese users.',
    modelFamily: 'Kimi / K1',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    vendor: 'MiniMax',
    description: 'Multi-protocol model routing for multimodal chat, voice, and Claude-compatible workflows.',
    modelFamily: 'MiniMax Text / M1',
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    vendor: 'StepFun',
    description: 'Step series routing for reasoning, long-context orchestration, and fast domestic deployment.',
    modelFamily: 'Step / Step-R',
  },
  {
    id: 'sensenova',
    name: 'SenseNova',
    vendor: 'SenseTime',
    description: 'SenseNova gateways for regulated enterprise deployments and multimodal industrial workloads.',
    modelFamily: 'SenseChat / SenseNova',
  },
  {
    id: 'baichuan',
    name: 'Baichuan',
    vendor: 'Baichuan Intelligence',
    description: 'Baichuan family routes tuned for business assistants, bilingual chat, and finance use cases.',
    modelFamily: 'Baichuan 4 / M1',
  },
  {
    id: 'yi',
    name: 'Yi',
    vendor: '01.AI',
    description: 'Yi model routing for lean deployment, multilingual assistants, and pragmatic enterprise workloads.',
    modelFamily: 'Yi / Yi Vision',
  },
  {
    id: 'iflytek-spark',
    name: 'iFlytek Spark',
    vendor: 'iFlytek',
    description: 'Spark routes for education, voice-rich interactions, and Chinese enterprise productivity flows.',
    modelFamily: 'Spark / Xinghuo',
  },
  {
    id: 'huawei-pangu',
    name: 'Huawei Pangu',
    vendor: 'Huawei Cloud',
    description: 'Pangu model routing for sovereign cloud deployments and large-scale industry solutions.',
    modelFamily: 'Pangu / Pangu Pro',
  },
];

function createInitialProxyProviderGroups(): ProxyProviderGroup[] {
  return [
    {
      id: 'team-ops',
      name: 'Ops Routing',
      description: 'Production-grade providers used by operator workflows and automations.',
    },
    {
      id: 'shared-core',
      name: 'Shared Core',
      description: 'Shared team pool for chat, experiments, and cross-workspace use.',
    },
    {
      id: 'client-vip',
      name: 'Client VIP',
      description: 'Premium routes reserved for latency-sensitive or SLA-backed traffic.',
    },
    {
      id: 'sandbox-lab',
      name: 'Sandbox Lab',
      description: 'Disposable or low-risk providers for experiments and feature validation.',
    },
  ];
}

const unifiedApiKeySeeds: UnifiedApiKeySeed[] = [
  {
    id: 'unified-key-default-prod',
    name: 'Global Production Key',
    apiKey: 'sk-ar-v1-7w3n2m9k4h8d1q5r6t0y2u4i8o1p3s5',
    source: 'system-generated',
    groupId: 'team-ops',
    modelMappingId: 'mapping-global-assistant',
    requestCount: 68420,
    tokenCount: 91244320,
    spendUsd: 2864.18,
    expiresAt: '2026-12-31T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-01-15T09:20:00.000Z',
    notes: 'Primary customer-facing key for the unified API Router gateway.',
  },
  {
    id: 'unified-key-client-vip',
    name: 'Client VIP Key',
    apiKey: 'sk-ar-v1-4p8q2s6v1x9z5c7n3m0k2j4h6g8f1d3',
    source: 'system-generated',
    groupId: 'client-vip',
    modelMappingId: 'mapping-vip-multimodal',
    requestCount: 22810,
    tokenCount: 30881120,
    spendUsd: 1198.44,
    expiresAt: '2026-09-30T23:59:59.000Z',
    status: 'warning',
    createdAt: '2026-02-03T03:10:00.000Z',
    notes: 'Reserved for enterprise customers requiring isolated routing quotas.',
  },
  {
    id: 'unified-key-sandbox-custom',
    name: 'Sandbox Partner Key',
    apiKey: 'sk-ar-v1-sandboxpartner0000000000001',
    source: 'custom',
    groupId: 'sandbox-lab',
    requestCount: 1940,
    tokenCount: 2110480,
    spendUsd: 46.83,
    expiresAt: null,
    status: 'active',
    createdAt: '2026-02-28T16:45:00.000Z',
    notes: 'Customer-supplied key used for partner integration dry runs.',
  },
];

const apiRouterProxyProviderSeeds: ProxyProviderSeed[] = [
  {
    id: 'provider-openai-direct',
    channelId: 'openai',
    name: 'OpenAI Direct Production',
    apiKey: 'sk-live-openai-prod-7ab91f3cdd4492aab8e4',
    groupId: 'team-ops',
    requestCount: 182430,
    tokenCount: 148200340,
    spendUsd: 4286.14,
    expiresAt: '2026-12-31T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-10-24T08:00:00.000Z',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'o4-mini', name: 'o4-mini' },
    ],
    notes: 'Primary provider for production assistant traffic.',
  },
  {
    id: 'provider-openai-azure',
    channelId: 'openai',
    name: 'Azure OpenAI East US',
    apiKey: 'az-oai-eastus-prod-1a9d3f58b6c17e1142aa',
    groupId: 'shared-core',
    requestCount: 92110,
    tokenCount: 62440850,
    spendUsd: 1739.48,
    expiresAt: '2026-04-05T23:59:59.000Z',
    status: 'warning',
    createdAt: '2025-11-03T12:30:00.000Z',
    baseUrl: 'https://sdkwork-eastus.openai.azure.com/openai/deployments',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    notes: 'Expires soon and should be rotated within this sprint.',
  },
  {
    id: 'provider-anthropic-relay',
    channelId: 'anthropic',
    name: 'Claude Relay',
    apiKey: 'claude-relay-prod-88e0c91d2f6c44ac930d',
    groupId: 'team-ops',
    requestCount: 64220,
    tokenCount: 86210440,
    spendUsd: 2194.77,
    expiresAt: '2026-09-30T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-09-19T10:45:00.000Z',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
    ],
    notes: 'Preferred long-context provider for review and planning tasks.',
  },
  {
    id: 'provider-google-gemini',
    channelId: 'google',
    name: 'Gemini Enterprise Proxy',
    apiKey: 'gemini-enterprise-31ca7711b48f49d5a4b1',
    groupId: 'client-vip',
    requestCount: 53400,
    tokenCount: 42100330,
    spendUsd: 996.05,
    expiresAt: '2026-08-01T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-02T09:15:00.000Z',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
    notes: 'Reserved for VIP multimodal workflows.',
  },
  {
    id: 'provider-xai-grok',
    channelId: 'xai',
    name: 'Grok Global Bridge',
    apiKey: 'grok-global-bridge-55f39eb1cb81457ca304',
    groupId: 'sandbox-lab',
    requestCount: 18320,
    tokenCount: 14323980,
    spendUsd: 336.12,
    expiresAt: '2026-06-30T23:59:59.000Z',
    status: 'disabled',
    createdAt: '2026-01-06T15:20:00.000Z',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-2-latest', name: 'Grok 2 Latest' },
      { id: 'grok-3-beta', name: 'Grok 3 Beta' },
    ],
    notes: 'Disabled pending compliance review.',
  },
  {
    id: 'provider-meta-llama',
    channelId: 'meta',
    name: 'Meta Llama Enterprise',
    apiKey: 'meta-llama-enterprise-1c8b690d5fe845c0b8a4',
    groupId: 'client-vip',
    requestCount: 41240,
    tokenCount: 38620410,
    spendUsd: 732.88,
    expiresAt: '2026-10-31T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-11T11:10:00.000Z',
    baseUrl: 'https://api.llama.com/compat/v1',
    models: [
      { id: 'llama-4-maverick', name: 'Llama 4 Maverick' },
      { id: 'llama-4-scout', name: 'Llama 4 Scout' },
    ],
    notes: 'Primary open-weight route for regulated customer deployments.',
  },
  {
    id: 'provider-mistral-eu',
    channelId: 'mistral',
    name: 'Mistral Europe Relay',
    apiKey: 'mistral-eu-relay-913a84216fe742d6b7bb',
    groupId: 'shared-core',
    requestCount: 29110,
    tokenCount: 20510880,
    spendUsd: 518.27,
    expiresAt: '2026-11-15T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-11-28T14:00:00.000Z',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large' },
      { id: 'codestral-latest', name: 'Codestral' },
    ],
    notes: 'European fallback for coding and multilingual assistant workloads.',
  },
  {
    id: 'provider-cohere-command',
    channelId: 'cohere',
    name: 'Cohere Command Core',
    apiKey: 'cohere-command-core-980cb6ac9f234cc4b40a',
    groupId: 'shared-core',
    requestCount: 22480,
    tokenCount: 16422800,
    spendUsd: 468.33,
    expiresAt: '2026-04-12T23:59:59.000Z',
    status: 'warning',
    createdAt: '2025-10-14T16:25:00.000Z',
    baseUrl: 'https://api.cohere.com/v1',
    models: [
      { id: 'command-r-plus', name: 'Command R+' },
      { id: 'embed-english-v3.0', name: 'Embed English v3.0' },
    ],
    notes: 'Key rotation pending after procurement merged the enterprise tenant.',
  },
  {
    id: 'provider-amazon-nova-bedrock',
    channelId: 'amazon-nova',
    name: 'Amazon Nova Bedrock',
    apiKey: 'aws-nova-bedrock-08c37dba683b4060ac85',
    groupId: 'team-ops',
    requestCount: 34720,
    tokenCount: 24011120,
    spendUsd: 581.74,
    expiresAt: '2026-12-20T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-01-09T09:35:00.000Z',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com/model',
    models: [
      { id: 'amazon.nova-pro-v1:0', name: 'Amazon Nova Pro' },
      { id: 'amazon.nova-micro-v1:0', name: 'Amazon Nova Micro' },
    ],
    notes: 'Default Bedrock route for enterprise accounts requiring AWS-native governance.',
  },
  {
    id: 'provider-microsoft-phi',
    channelId: 'microsoft',
    name: 'Microsoft Phi Inference',
    apiKey: 'ms-phi-inference-50059b2d787a49489b5d',
    groupId: 'sandbox-lab',
    requestCount: 19140,
    tokenCount: 13702080,
    spendUsd: 201.63,
    expiresAt: '2026-09-18T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-20T07:15:00.000Z',
    baseUrl: 'https://models.inference.ai.azure.com',
    models: [
      { id: 'Phi-4', name: 'Phi-4' },
      { id: 'Phi-4-multimodal-instruct', name: 'Phi-4 Multimodal Instruct' },
    ],
    notes: 'Low-cost inference lane used for benchmark and evaluation workloads.',
  },
  {
    id: 'provider-nvidia-nemotron',
    channelId: 'nvidia',
    name: 'NVIDIA Nemotron NIM',
    apiKey: 'nvidia-nemotron-nim-0d912db0fe0b4e3694af',
    groupId: 'client-vip',
    requestCount: 13880,
    tokenCount: 10822460,
    spendUsd: 284.91,
    expiresAt: '2026-11-30T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-02-03T10:40:00.000Z',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      { id: 'nemotron-ultra', name: 'Nemotron Ultra' },
      { id: 'nemotron-mini', name: 'Nemotron Mini' },
    ],
    notes: 'Reserved for customers validating accelerated on-prem NIM deployment paths.',
  },
  {
    id: 'provider-deepseek-cn',
    channelId: 'deepseek',
    name: 'DeepSeek China Gateway',
    apiKey: 'deepseek-cn-gateway-f3b52ca9812b4cc3aee1',
    groupId: 'shared-core',
    requestCount: 228430,
    tokenCount: 204133280,
    spendUsd: 1480.3,
    expiresAt: '2026-07-18T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-28T07:40:00.000Z',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
    notes: 'Lowest blended cost for Chinese reasoning traffic.',
  },
  {
    id: 'provider-qwen-bailian',
    channelId: 'qwen',
    name: 'Qwen Bailian Enterprise',
    apiKey: 'qwen-bailian-ent-0cf0efab9db44d4f95a7',
    groupId: 'shared-core',
    requestCount: 70410,
    tokenCount: 55249830,
    spendUsd: 744.56,
    expiresAt: '2026-03-25T23:59:59.000Z',
    status: 'warning',
    createdAt: '2025-11-15T13:50:00.000Z',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwq-plus', name: 'QwQ Plus' },
    ],
    notes: 'Quota renewal pending finance approval.',
  },
  {
    id: 'provider-zhipu-glm',
    channelId: 'zhipu',
    name: 'Zhipu GLM Edge',
    apiKey: 'zhipu-glm-edge-6475d4b338ea4e2d9db5',
    groupId: 'team-ops',
    requestCount: 28310,
    tokenCount: 21842210,
    spendUsd: 409.4,
    expiresAt: '2026-02-28T23:59:59.000Z',
    status: 'expired',
    createdAt: '2025-08-21T09:00:00.000Z',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4-air', name: 'GLM-4 Air' },
    ],
    notes: 'Expired key retained only for audit visibility until cleanup.',
  },
  {
    id: 'provider-baidu-qianfan',
    channelId: 'baidu',
    name: 'Baidu Qianfan Prime',
    apiKey: 'baidu-qianfan-prime-d3ca1e2456f84b5d8bc2',
    groupId: 'team-ops',
    requestCount: 51120,
    tokenCount: 40218640,
    spendUsd: 688.12,
    expiresAt: '2026-08-22T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-11-22T12:05:00.000Z',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: [
      { id: 'ernie-4.5-8k', name: 'ERNIE 4.5' },
      { id: 'ernie-x1-turbo-32k', name: 'ERNIE X1 Turbo' },
    ],
    notes: 'Primary Baidu route for enterprise mainland deployments.',
  },
  {
    id: 'provider-tencent-hunyuan',
    channelId: 'tencent-hunyuan',
    name: 'Tencent Hunyuan Core',
    apiKey: 'tencent-hunyuan-core-0b0e412e4e744e3eaf13',
    groupId: 'shared-core',
    requestCount: 43770,
    tokenCount: 33200410,
    spendUsd: 590.48,
    expiresAt: '2026-09-12T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-18T08:30:00.000Z',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: [
      { id: 'hunyuan-turbo', name: 'Hunyuan Turbo' },
      { id: 'hunyuan-t1-latest', name: 'Hunyuan T1' },
    ],
    notes: 'Balanced domestic route for assistant traffic with Tencent ecosystem dependencies.',
  },
  {
    id: 'provider-doubao-ark',
    channelId: 'doubao',
    name: 'Doubao Ark Production',
    apiKey: 'doubao-ark-prod-c7240cd6738942439f91',
    groupId: 'team-ops',
    requestCount: 88410,
    tokenCount: 71408240,
    spendUsd: 863.39,
    expiresAt: '2026-10-20T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-01-12T09:50:00.000Z',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32K' },
      { id: 'doubao-seed-1.6', name: 'Doubao Seed 1.6' },
    ],
    notes: 'High-throughput route for customer-facing assistants running in mainland regions.',
  },
  {
    id: 'provider-moonshot-kimi',
    channelId: 'moonshot',
    name: 'Kimi Global Route',
    apiKey: 'moonshot-kimi-global-67d8856a7afd4d9a9d26',
    groupId: 'client-vip',
    requestCount: 39640,
    tokenCount: 30199520,
    spendUsd: 622.84,
    expiresAt: '2026-11-06T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-04T10:15:00.000Z',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'kimi-k2-0905-preview', name: 'Kimi K2 Preview' },
      { id: 'moonshot-v1-128k', name: 'Moonshot 128K' },
    ],
    notes: 'Long-context route used for research and product planning traffic.',
  },
  {
    id: 'provider-minimax-bridge',
    channelId: 'minimax',
    name: 'MiniMax Claude Bridge',
    apiKey: 'minimax-claude-bridge-1037b3a8cc3840d29922',
    groupId: 'shared-core',
    requestCount: 27830,
    tokenCount: 21036780,
    spendUsd: 388.91,
    expiresAt: '2026-08-15T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-11-09T17:20:00.000Z',
    baseUrl: 'https://api.minimax.chat/v1',
    models: [
      { id: 'MiniMax-M1-80k', name: 'MiniMax M1 80K' },
      { id: 'MiniMax-Text-01', name: 'MiniMax Text 01' },
    ],
    notes: 'Configured for teams that need both Anthropic-style and domestic deployment options.',
  },
  {
    id: 'provider-stepfun-reasoning',
    channelId: 'stepfun',
    name: 'StepFun Reasoning Route',
    apiKey: 'stepfun-reasoning-route-d10406df67fd433c8d53',
    groupId: 'sandbox-lab',
    requestCount: 18910,
    tokenCount: 16648110,
    spendUsd: 244.58,
    expiresAt: '2026-09-30T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-01-16T14:40:00.000Z',
    baseUrl: 'https://api.stepfun.com/v1',
    models: [
      { id: 'step-2-16k', name: 'Step-2 16K' },
      { id: 'step-r1', name: 'Step-R1' },
    ],
    notes: 'Fast domestic reasoning lane used for exploratory automation workloads.',
  },
  {
    id: 'provider-sensenova-enterprise',
    channelId: 'sensenova',
    name: 'SenseNova Enterprise',
    apiKey: 'sensenova-enterprise-f19e76b9903142a69022',
    groupId: 'client-vip',
    requestCount: 14220,
    tokenCount: 11770210,
    spendUsd: 319.47,
    expiresAt: '2026-04-02T23:59:59.000Z',
    status: 'warning',
    createdAt: '2025-10-31T08:45:00.000Z',
    baseUrl: 'https://api.sensenova.cn/compatible-mode/v1',
    models: [
      { id: 'sensechat-5', name: 'SenseChat 5' },
      { id: 'sensenova-v6', name: 'SenseNova V6' },
    ],
    notes: 'Enterprise route retained for regulated customers and needs contract renewal.',
  },
  {
    id: 'provider-baichuan-business',
    channelId: 'baichuan',
    name: 'Baichuan Business Edge',
    apiKey: 'baichuan-business-edge-e8b33ab2f84247ea99d1',
    groupId: 'shared-core',
    requestCount: 16340,
    tokenCount: 13290640,
    spendUsd: 276.35,
    expiresAt: '2026-07-30T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-12-06T11:25:00.000Z',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: [
      { id: 'Baichuan4-Turbo', name: 'Baichuan 4 Turbo' },
      { id: 'Baichuan-M1-32k', name: 'Baichuan M1 32K' },
    ],
    notes: 'Used for finance and business knowledge copilots that prefer local vendor coverage.',
  },
  {
    id: 'provider-yi-platform',
    channelId: 'yi',
    name: 'Yi Platform Core',
    apiKey: 'yi-platform-core-1b399f577ea44bc49d91',
    groupId: 'sandbox-lab',
    requestCount: 11840,
    tokenCount: 9210480,
    spendUsd: 168.44,
    expiresAt: '2026-08-10T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-02-01T13:15:00.000Z',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    models: [
      { id: 'yi-lightning', name: 'Yi Lightning' },
      { id: 'yi-vision', name: 'Yi Vision' },
    ],
    notes: 'Lean route for cost-sensitive Chinese and multilingual workloads.',
  },
  {
    id: 'provider-iflytek-spark',
    channelId: 'iflytek-spark',
    name: 'Spark Enterprise Voice',
    apiKey: 'iflytek-spark-voice-4b5e03086cae44109e67',
    groupId: 'team-ops',
    requestCount: 20560,
    tokenCount: 15849030,
    spendUsd: 309.72,
    expiresAt: '2026-10-08T23:59:59.000Z',
    status: 'active',
    createdAt: '2025-11-26T10:00:00.000Z',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    models: [
      { id: 'spark-max-32k', name: 'Spark Max 32K' },
      { id: 'spark-4.0-ultra', name: 'Spark 4.0 Ultra' },
    ],
    notes: 'Selected when speech, education, and voice-assistant workloads need a domestic route.',
  },
  {
    id: 'provider-huawei-pangu',
    channelId: 'huawei-pangu',
    name: 'Huawei Pangu Sovereign',
    apiKey: 'huawei-pangu-sovereign-0deef3a4eb0e44e38296',
    groupId: 'client-vip',
    requestCount: 9800,
    tokenCount: 8124060,
    spendUsd: 214.82,
    expiresAt: '2026-05-16T23:59:59.000Z',
    status: 'disabled',
    createdAt: '2025-10-09T09:25:00.000Z',
    baseUrl: 'https://infer-modelarts.cn-southwest-2.myhuaweicloud.com/v1/infers',
    models: [
      { id: 'pangu-pro', name: 'Pangu Pro' },
      { id: 'pangu-ultra', name: 'Pangu Ultra' },
    ],
    notes: 'Disabled until the customer finishes VPC peering and sovereign cloud whitelisting.',
  },
];

function createInitialProxyProviders(): ProxyProvider[] {
  return apiRouterProxyProviderSeeds.map(createSeedProxyProvider);
}

function createInitialUnifiedApiKeys(): UnifiedApiKey[] {
  return unifiedApiKeySeeds.map(createSeedUnifiedApiKey);
}

const managedApiKeyAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateUnifiedApiKeyValue() {
  const bytes = new Uint8Array(32);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  const suffix = Array.from(bytes, (value) => managedApiKeyAlphabet[value % managedApiKeyAlphabet.length]).join('');
  return `sk-ar-v1-${suffix}`;
}

function listApiRouterChannelsFromProviders(providers: ProxyProvider[]): ApiRouterChannel[] {
  return apiRouterChannelCatalog.map((channel) => {
    const channelProviders = providers.filter((provider) => provider.channelId === channel.id);
    return {
      ...channel,
      providerCount: channelProviders.length,
      activeProviderCount: channelProviders.filter((provider) => provider.status === 'active').length,
      warningProviderCount: channelProviders.filter(
        (provider) => provider.status === 'warning' || provider.status === 'expired',
      ).length,
      disabledProviderCount: channelProviders.filter((provider) => provider.status === 'disabled').length,
    };
  });
}

function getApiRouterChannelName(channelId: string) {
  return apiRouterChannelCatalog.find((channel) => channel.id === channelId)?.name || channelId;
}

function createModelMappingModelRef(
  channelId: string,
  modelId: string,
  modelName: string,
): ModelMappingModelRef {
  return {
    channelId,
    channelName: getApiRouterChannelName(channelId),
    modelId,
    modelName,
  };
}

const modelMappingSeeds: ModelMappingSeed[] = [
  {
    id: 'mapping-global-assistant',
    name: 'Global Assistant Mapping',
    description: 'Standard assistant fallback map for shared production traffic.',
    status: 'active',
    effectiveFrom: '2026-03-01T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-03-02T08:30:00.000Z',
    rules: [
      {
        id: 'mapping-rule-global-openai',
        source: {
          channelId: 'openai',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: {
          channelId: 'google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
      },
      {
        id: 'mapping-rule-global-anthropic',
        source: {
          channelId: 'anthropic',
          modelId: 'claude-sonnet-4',
          modelName: 'Claude Sonnet 4',
        },
        target: {
          channelId: 'openai',
          modelId: 'gpt-4.1-mini',
          modelName: 'GPT-4.1 Mini',
        },
      },
    ],
  },
  {
    id: 'mapping-vip-multimodal',
    name: 'VIP Multimodal Mapping',
    description: 'VIP traffic mapping for multimodal and customer-facing workloads.',
    status: 'warning',
    effectiveFrom: '2026-03-15T00:00:00.000Z',
    effectiveTo: '2026-09-30T23:59:59.000Z',
    createdAt: '2026-03-15T13:45:00.000Z',
    rules: [
      {
        id: 'mapping-rule-vip-google',
        source: {
          channelId: 'google',
          modelId: 'gemini-2.0-flash',
          modelName: 'Gemini 2.0 Flash',
        },
        target: {
          channelId: 'openai',
          modelId: 'gpt-4o-mini',
          modelName: 'GPT-4o Mini',
        },
      },
      {
        id: 'mapping-rule-vip-openai',
        source: {
          channelId: 'openai',
          modelId: 'gpt-4.1-mini',
          modelName: 'GPT-4.1 Mini',
        },
        target: {
          channelId: 'google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
      },
    ],
  },
];

function createInitialModelMappings(): ModelMapping[] {
  return modelMappingSeeds.map(createSeedModelMapping);
}

function createModelMappingCatalogFromProviders(
  providers: ProxyProvider[],
): ModelMappingCatalogChannel[] {
  return apiRouterChannelCatalog
    .map((channel) => {
      const modelsById = new Map<string, string>();

      providers
        .filter((provider) => provider.channelId === channel.id)
        .forEach((provider) => {
          provider.models.forEach((model) => {
            if (!modelsById.has(model.id)) {
              modelsById.set(model.id, model.name);
            }
          });
        });

      return {
        channelId: channel.id,
        channelName: channel.name,
        models: [...modelsById.entries()]
          .map(([modelId, modelName]) => ({
            modelId,
            modelName,
          }))
          .sort((left, right) => left.modelName.localeCompare(right.modelName)),
      };
    })
    .filter((channel) => channel.models.length > 0);
}

function createInitialInstanceFiles(): Record<string, MockInstanceFile[]> {
  return {
    'local-built-in': [
      {
        id: 'file-local-config',
        instanceId: 'local-built-in',
        name: 'claw.config.json',
        path: '/workspace/.claw/claw.config.json',
        category: 'config',
        language: 'json',
        size: '1 KB',
        updatedAt: '12 minutes ago',
        status: 'modified',
        description: 'Primary gateway configuration for local runtime policies and ports.',
        content: JSON.stringify(
          {
            port: 18789,
            corsOrigins: '*',
            sandbox: true,
            autoUpdate: false,
            logLevel: 'info',
          },
          null,
          2,
        ),
        isReadonly: false,
      },
      {
        id: 'file-local-logs',
        instanceId: 'local-built-in',
        name: 'runtime.log',
        path: '/workspace/.claw/logs/runtime.log',
        category: 'log',
        language: 'log',
        size: '2 KB',
        updatedAt: 'just now',
        status: 'generated',
        description: 'Live daemon log stream for operator diagnostics and tracebacks.',
        content: `[2026-03-18 09:32:01] INFO Runtime bootstrap complete
[2026-03-18 09:32:04] INFO Loading workspace prompt router
[2026-03-18 09:32:05] INFO QQ delivery channel connected
[2026-03-18 09:32:07] WARN Feishu delivery channel awaiting configuration
[2026-03-18 09:32:11] INFO Scheduler heartbeat healthy`,
        isReadonly: true,
      },
      {
        id: 'file-local-prompts',
        instanceId: 'local-built-in',
        name: 'router.prompt.md',
        path: '/workspace/prompts/router.prompt.md',
        category: 'prompt',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '2 hours ago',
        status: 'synced',
        description: 'Routing prompt used by local orchestration and agent delegation.',
        content: `# Runtime Router

You are the routing layer for the local OpenClaw workspace.

## Goals

- Prefer installed skills before generic reasoning
- Route urgent approvals to connected channels
- Keep operator-facing summaries concise
- Escalate tool failures with direct next actions`,
        isReadonly: false,
      },
      {
        id: 'file-local-memory',
        instanceId: 'local-built-in',
        name: 'operator-runbook.md',
        path: '/workspace/memory/operator-runbook.md',
        category: 'memory',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '1 day ago',
        status: 'synced',
        description: 'Pinned runbook for incident response, approvals, and escalation rules.',
        content: `# Operator Runbook

## Channel Failure

1. Retry the delivery job once.
2. Notify the on-duty operator in QQ.
3. Switch summary mode to local-only if both channels are unavailable.

## Gateway Restart

1. Snapshot pending tasks.
2. Restart runtime services.
3. Verify scheduler heartbeat and tool registry.`,
        isReadonly: false,
      },
      {
        id: 'file-local-data',
        instanceId: 'local-built-in',
        name: 'lead-qualification.csv',
        path: '/workspace/data/lead-qualification.csv',
        category: 'dataset',
        language: 'csv',
        size: '1 KB',
        updatedAt: '3 hours ago',
        status: 'generated',
        description: 'Fresh dataset generated by automation for prompt and workflow evaluation.',
        content: `lead_id,company,score,owner,status
L-1001,Northwind,92,Ava,qualified
L-1002,Contoso,84,Ryan,review
L-1003,Fabrikam,79,Jules,watch`,
        isReadonly: true,
      },
    ],
    'home-nas': [
      {
        id: 'file-nas-config',
        instanceId: 'home-nas',
        name: 'gateway.toml',
        path: '/srv/openclaw/gateway.toml',
        category: 'config',
        language: 'toml',
        size: '1 KB',
        updatedAt: '4 hours ago',
        status: 'synced',
        description: 'Container gateway settings, update channel, and sandbox policy.',
        content: [
          'port = "18789"',
          'cors_origins = "http://localhost:3001"',
          'sandbox = true',
          'auto_update = true',
          'log_level = "warn"',
        ].join('\n'),
        isReadonly: false,
      },
      {
        id: 'file-nas-backups',
        instanceId: 'home-nas',
        name: 'nightly-backup.log',
        path: '/srv/openclaw/logs/nightly-backup.log',
        category: 'log',
        language: 'log',
        size: '1 KB',
        updatedAt: '8 hours ago',
        status: 'generated',
        description: 'Backup audit log for overnight automation runs on the NAS node.',
        content: `[2026-03-18 02:00:00] INFO Starting backup pipeline
[2026-03-18 02:03:11] INFO Snapshot archived to nas://nightly/2026-03-18
[2026-03-18 02:03:29] INFO Integrity check passed`,
        isReadonly: true,
      },
      {
        id: 'file-nas-prompts',
        instanceId: 'home-nas',
        name: 'summary-template.md',
        path: '/srv/openclaw/prompts/summary-template.md',
        category: 'prompt',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '1 day ago',
        status: 'synced',
        description: 'Shared prompt template for weekly summaries and async handoffs.',
        content: `# Weekly Summary Template

- Highlights
- Risks
- Pending approvals
- Recommended next actions`,
        isReadonly: false,
      },
    ],
    'edge-prod': [
      {
        id: 'file-edge-config',
        instanceId: 'edge-prod',
        name: 'edge.env',
        path: '/opt/openclaw/.env',
        category: 'config',
        language: 'shell',
        size: '1 KB',
        updatedAt: '5 days ago',
        status: 'missing',
        description: 'Environment contract for production edge routing and credentials.',
        content: [
          'CLAW_PORT=8080',
          'CLAW_CORS_ORIGINS=*',
          'CLAW_SANDBOX=true',
          'CLAW_AUTO_UPDATE=true',
          'CLAW_LOG_LEVEL=error',
        ].join('\n'),
        isReadonly: false,
      },
      {
        id: 'file-edge-trace',
        instanceId: 'edge-prod',
        name: 'crash.trace',
        path: '/opt/openclaw/logs/crash.trace',
        category: 'artifact',
        language: 'plaintext',
        size: '1 KB',
        updatedAt: '5 days ago',
        status: 'generated',
        description: 'Most recent crash trace captured before the edge node dropped offline.',
        content: `Runtime panic: delivery-router unavailable
at services/router.ts:188
at bootstrap/runtime.ts:74
Caused by: missing edge environment contract`,
        isReadonly: true,
      },
    ],
  };
}

function createInitialInstanceLlmProviders(): Record<string, MockInstanceLLMProvider[]> {
  return {
    'local-built-in': [
      {
        id: 'provider-openai-primary',
        instanceId: 'local-built-in',
        name: 'OpenAI',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKeySource: 'OPENAI_API_KEY',
        status: 'ready',
        defaultModelId: 'gpt-4.1',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        description: 'Primary cloud provider for coding, orchestration, and structured operator workflows.',
        icon: 'OA',
        lastCheckedAt: '2 minutes ago',
        capabilities: ['Code', 'Reasoning', 'Vision'],
        models: [
          { id: 'gpt-4.1', name: 'GPT-4.1', role: 'primary', contextWindow: '128K' },
          { id: 'o4-mini', name: 'o4-mini', role: 'reasoning', contextWindow: '200K' },
          {
            id: 'text-embedding-3-large',
            name: 'text-embedding-3-large',
            role: 'embedding',
            contextWindow: '8K',
          },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', role: 'fallback', contextWindow: '128K' },
        ],
        config: {
          temperature: 0.4,
          topP: 1,
          maxTokens: 8192,
          timeoutMs: 60000,
          streaming: true,
        },
      },
      {
        id: 'provider-deepseek-ops',
        instanceId: 'local-built-in',
        name: 'DeepSeek',
        provider: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1',
        apiKeySource: 'DEEPSEEK_API_KEY',
        status: 'ready',
        defaultModelId: 'deepseek-chat',
        reasoningModelId: 'deepseek-reasoner',
        description: 'Cost-efficient reasoning lane for analysis, drafts, and large-context operator reviews.',
        icon: 'DS',
        lastCheckedAt: '5 minutes ago',
        capabilities: ['Reasoning', 'Long Context'],
        models: [
          { id: 'deepseek-chat', name: 'DeepSeek Chat', role: 'primary', contextWindow: '64K' },
          {
            id: 'deepseek-reasoner',
            name: 'DeepSeek Reasoner',
            role: 'reasoning',
            contextWindow: '64K',
          },
          {
            id: 'deepseek-coder',
            name: 'DeepSeek Coder',
            role: 'fallback',
            contextWindow: '32K',
          },
        ],
        config: {
          temperature: 0.2,
          topP: 0.95,
          maxTokens: 4096,
          timeoutMs: 45000,
          streaming: true,
        },
      },
      {
        id: 'provider-gemini-research',
        instanceId: 'local-built-in',
        name: 'Google Gemini',
        provider: 'google',
        endpoint: 'https://generativelanguage.googleapis.com',
        apiKeySource: '',
        status: 'configurationRequired',
        defaultModelId: 'gemini-3-flash-preview',
        reasoningModelId: 'gemini-3.1-pro-preview',
        description: 'Research and multimodal lane kept available for burst workflows and evaluation traffic.',
        icon: 'GM',
        lastCheckedAt: '11 minutes ago',
        capabilities: ['Research', 'Multimodal'],
        models: [
          {
            id: 'gemini-3-flash-preview',
            name: 'Gemini 3 Flash',
            role: 'primary',
            contextWindow: '1M',
          },
          {
            id: 'gemini-3.1-pro-preview',
            name: 'Gemini 3.1 Pro',
            role: 'reasoning',
            contextWindow: '1M',
          },
        ],
        config: {
          temperature: 0.6,
          topP: 1,
          maxTokens: 4096,
          timeoutMs: 60000,
          streaming: true,
        },
      },
    ],
    'home-nas': [
      {
        id: 'provider-vllm-cluster',
        instanceId: 'home-nas',
        name: 'vLLM Cluster',
        provider: 'openai-compatible',
        endpoint: 'http://nas-gateway.internal:8000/v1',
        apiKeySource: 'NAS_LLM_TOKEN',
        status: 'ready',
        defaultModelId: 'qwen2.5-72b-instruct',
        reasoningModelId: 'deepseek-r1-distill-qwen-32b',
        embeddingModelId: 'bge-m3',
        description: 'Self-hosted inference gateway for lower-latency home-lab automations and private datasets.',
        icon: 'VL',
        lastCheckedAt: '7 minutes ago',
        capabilities: ['Private', 'Low Latency', 'Batch Jobs'],
        models: [
          {
            id: 'qwen2.5-72b-instruct',
            name: 'Qwen2.5 72B Instruct',
            role: 'primary',
            contextWindow: '128K',
          },
          {
            id: 'deepseek-r1-distill-qwen-32b',
            name: 'DeepSeek R1 Distill Qwen 32B',
            role: 'reasoning',
            contextWindow: '64K',
          },
          { id: 'bge-m3', name: 'BGE M3', role: 'embedding', contextWindow: '8K' },
        ],
        config: {
          temperature: 0.3,
          topP: 0.9,
          maxTokens: 6144,
          timeoutMs: 75000,
          streaming: true,
        },
      },
    ],
    'edge-prod': [
      {
        id: 'provider-edge-failover',
        instanceId: 'edge-prod',
        name: 'Edge Failover',
        provider: 'openai-compatible',
        endpoint: 'https://edge-gateway.internal/v1',
        apiKeySource: 'EDGE_GATEWAY_TOKEN',
        status: 'degraded',
        defaultModelId: 'claude-sonnet-edge',
        reasoningModelId: 'claude-opus-edge',
        description: 'Production failover lane used when the edge runtime needs premium recovery and escalation help.',
        icon: 'ED',
        lastCheckedAt: '1 hour ago',
        capabilities: ['Failover', 'Incident Response'],
        models: [
          {
            id: 'claude-sonnet-edge',
            name: 'Claude Sonnet Edge',
            role: 'primary',
            contextWindow: '200K',
          },
          {
            id: 'claude-opus-edge',
            name: 'Claude Opus Edge',
            role: 'reasoning',
            contextWindow: '200K',
          },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', role: 'fallback', contextWindow: '128K' },
        ],
        config: {
          temperature: 0.1,
          topP: 0.85,
          maxTokens: 4096,
          timeoutMs: 120000,
          streaming: false,
        },
      },
    ],
  };
}

function createInitialInstanceMemories(): Record<string, MockInstanceMemoryEntry[]> {
  return {
    'local-built-in': [
      {
        id: 'memory-local-runbook',
        instanceId: 'local-built-in',
        title: 'Operator escalation runbook',
        type: 'runbook',
        summary: 'Escalation ladder for channel failures, task pauses, and agent approval requests.',
        source: 'operator',
        updatedAt: '1 day ago',
        retention: 'pinned',
        tokens: 842,
      },
      {
        id: 'memory-local-session',
        instanceId: 'local-built-in',
        title: 'Prompt tuning retrospective',
        type: 'conversation',
        summary: 'Captured the last three tuning iterations and accepted routing adjustments.',
        source: 'agent',
        updatedAt: '6 hours ago',
        retention: 'rolling',
        tokens: 516,
      },
      {
        id: 'memory-local-facts',
        instanceId: 'local-built-in',
        title: 'Workspace guardrails',
        type: 'fact',
        summary: 'Pinned facts about default branch policy, deployment targets, and alerting thresholds.',
        source: 'system',
        updatedAt: '2 hours ago',
        retention: 'pinned',
        tokens: 228,
      },
    ],
    'home-nas': [
      {
        id: 'memory-nas-backup',
        instanceId: 'home-nas',
        title: 'Backup verification notes',
        type: 'artifact',
        summary: 'Recent nightly snapshots verified against retention policy and restore checklist.',
        source: 'task',
        updatedAt: '8 hours ago',
        retention: 'rolling',
        tokens: 304,
      },
      {
        id: 'memory-nas-routing',
        instanceId: 'home-nas',
        title: 'Delivery routing heuristics',
        type: 'fact',
        summary: 'Rules for routing summaries to QQ first and escalating errors into Feishu groups.',
        source: 'operator',
        updatedAt: '3 days ago',
        retention: 'pinned',
        tokens: 190,
      },
    ],
    'edge-prod': [
      {
        id: 'memory-edge-incident',
        instanceId: 'edge-prod',
        title: 'Last incident timeline',
        type: 'artifact',
        summary: 'Incident memory from the final healthy deploy before the edge node went offline.',
        source: 'system',
        updatedAt: '5 days ago',
        retention: 'expiring',
        tokens: 412,
      },
    ],
  };
}

function createInitialInstanceTools(): Record<string, MockInstanceTool[]> {
  return {
    'local-built-in': [
      {
        id: 'tool-local-shell',
        instanceId: 'local-built-in',
        name: 'shell.exec',
        description: 'Execute local commands inside the sandboxed workspace runtime.',
        category: 'filesystem',
        status: 'ready',
        access: 'execute',
        command: 'shell.exec(command)',
        lastUsedAt: '10 minutes ago',
      },
      {
        id: 'tool-local-files',
        instanceId: 'local-built-in',
        name: 'files.read',
        description: 'Read configuration, prompts, datasets, and runtime artifacts.',
        category: 'filesystem',
        status: 'ready',
        access: 'read',
        command: 'files.read(path)',
        lastUsedAt: '26 minutes ago',
      },
      {
        id: 'tool-local-memory',
        instanceId: 'local-built-in',
        name: 'memory.append',
        description: 'Append validated operator context into the instance memory bank.',
        category: 'reasoning',
        status: 'ready',
        access: 'write',
        command: 'memory.append(entry)',
        lastUsedAt: '2 hours ago',
      },
      {
        id: 'tool-local-workflow',
        instanceId: 'local-built-in',
        name: 'workflow.schedule',
        description: 'Create and fan out scheduled automation runs from the active workspace.',
        category: 'automation',
        status: 'beta',
        access: 'execute',
        command: 'workflow.schedule(cron, action)',
      },
    ],
    'home-nas': [
      {
        id: 'tool-nas-sync',
        instanceId: 'home-nas',
        name: 'storage.sync',
        description: 'Synchronize generated artifacts into persistent NAS storage.',
        category: 'filesystem',
        status: 'ready',
        access: 'write',
        command: 'storage.sync(path)',
        lastUsedAt: '1 hour ago',
      },
      {
        id: 'tool-nas-observe',
        instanceId: 'home-nas',
        name: 'observe.metrics',
        description: 'Collect runtime CPU, memory, and task execution telemetry.',
        category: 'observability',
        status: 'ready',
        access: 'read',
        command: 'observe.metrics()',
        lastUsedAt: '18 minutes ago',
      },
      {
        id: 'tool-nas-webhook',
        instanceId: 'home-nas',
        name: 'delivery.webhook',
        description: 'Dispatch structured automation payloads into external channels.',
        category: 'integration',
        status: 'beta',
        access: 'execute',
        command: 'delivery.webhook(channelId, payload)',
      },
    ],
    'edge-prod': [
      {
        id: 'tool-edge-debug',
        instanceId: 'edge-prod',
        name: 'edge.debug',
        description: 'Restricted recovery tool for inspecting the failed production edge runtime.',
        category: 'observability',
        status: 'restricted',
        access: 'read',
        command: 'edge.debug(traceId)',
      },
    ],
  };
}

function createInitialDevices(): Device[] {
  return [
    {
      id: 'device-alpha',
      name: 'OpenClaw Alpha',
      battery: 92,
      ip_address: '192.168.1.45',
      status: 'online',
      created_at: '2026-03-10T08:00:00.000Z',
      hardwareSpecs: {
        soc: 'RK3588',
        ram: '8 GB',
        storage: '128 GB',
        latency: '12 ms',
      },
    },
    {
      id: 'device-beta',
      name: 'OpenClaw Beta',
      battery: 68,
      ip_address: '192.168.1.52',
      status: 'online',
      created_at: '2026-03-11T09:30:00.000Z',
      hardwareSpecs: {
        soc: 'Jetson Orin Nano',
        ram: '16 GB',
        storage: '256 GB',
        latency: '18 ms',
      },
    },
  ];
}

function createInitialAgents(): Agent[] {
  return [
    {
      id: 'agent-1',
      name: 'Code Master',
      description: 'Expert in software development, debugging, and architecture decisions.',
      avatar: '\u{1F468}\u200D\u{1F4BB}',
      systemPrompt:
        'You are an expert software developer. Provide clean, efficient, and well-documented code.',
      creator: 'SDKWork',
    },
    {
      id: 'agent-2',
      name: 'Creative Writer',
      description: 'Specializes in creative writing, storytelling, and polished content creation.',
      avatar: '\u270D\uFE0F',
      systemPrompt:
        'You are a creative writer. Write engaging, imaginative, and compelling content.',
      creator: 'SDKWork',
    },
    {
      id: 'agent-3',
      name: 'Data Analyst',
      description: 'Analyzes data, builds summaries, and highlights operational insights.',
      avatar: '\u{1F4CA}',
      systemPrompt:
        'You are a data analyst. Provide clear, accurate, and insightful analysis of data.',
      creator: 'SDKWork',
    },
    {
      id: 'agent-4',
      name: 'Ops Orchestrator',
      description: 'Coordinates automations, incident response, and runtime operations.',
      avatar: '\u2699\uFE0F',
      systemPrompt:
        'You are an operations orchestrator. Optimize reliability, observability, and workflow execution.',
      creator: 'SDKWork',
    },
  ];
}

function createInitialSkills(): Skill[] {
  return [
    {
      id: 'skill-system-monitor',
      name: 'System Monitor',
      description: 'Monitor CPU, RAM, and network usage in real time.',
      readme:
        '# System Monitor\n\nTrack CPU, memory, network, and latency metrics for your local and remote instances.',
      author: 'SDKWork',
      version: '1.4.0',
      icon: 'Cpu',
      category: 'System',
      downloads: 12500,
      rating: 4.9,
      size: '2.4 MB',
    },
    {
      id: 'skill-code-formatter',
      name: 'Code Formatter',
      description: 'Format codebases across TypeScript, Rust, and Python projects.',
      readme:
        '# Code Formatter\n\nApply opinionated formatting presets and automate repository-wide cleanup.',
      author: 'SDKWork',
      version: '2.1.3',
      icon: 'Code',
      category: 'Development',
      downloads: 9400,
      rating: 4.7,
      size: '1.3 MB',
    },
    {
      id: 'skill-prompt-lab',
      name: 'Prompt Lab',
      description: 'Prototype, compare, and refine prompt workflows for multiple models.',
      readme:
        '# Prompt Lab\n\nBuild prompt experiments, compare outputs, and capture reusable prompt snippets.',
      author: 'SDKWork',
      version: '0.9.8',
      icon: 'Sparkles',
      category: 'AI Models',
      downloads: 7100,
      rating: 4.8,
      size: '3.1 MB',
    },
    {
      id: 'skill-api-inspector',
      name: 'API Inspector',
      description: 'Inspect HTTP requests, headers, payloads, and response timings.',
      readme:
        '# API Inspector\n\nTrace REST calls, inspect payloads, and replay requests against local endpoints.',
      author: 'SDKWork',
      version: '1.2.4',
      icon: 'Terminal',
      category: 'Utilities',
      downloads: 5600,
      rating: 4.6,
      size: '1.8 MB',
    },
    {
      id: 'skill-team-notes',
      name: 'Team Notes',
      description: 'Capture operational notes, runbooks, and handoff context per instance.',
      readme:
        '# Team Notes\n\nStore operational notes, handoff summaries, and per-instance annotations in one place.',
      author: 'SDKWork',
      version: '1.0.2',
      icon: 'NotebookPen',
      category: 'Productivity',
      downloads: 4300,
      rating: 4.5,
      size: '1.0 MB',
    },
  ];
}

function createInitialReviews(): Record<string, Review[]> {
  return {
    'skill-system-monitor': [
      {
        id: 'review-system-monitor-1',
        user: 'ops-lead',
        user_name: 'Ops Lead',
        rating: 5,
        comment: 'Excellent visibility into local instance health and resource spikes.',
        date: '2026-02-12',
        created_at: '2026-02-12T10:00:00.000Z',
      },
    ],
    'skill-prompt-lab': [
      {
        id: 'review-prompt-lab-1',
        user: 'ai-pm',
        user_name: 'AI PM',
        rating: 5,
        comment: 'The fastest way to iterate on multi-model prompt workflows.',
        date: '2026-01-20',
        created_at: '2026-01-20T08:30:00.000Z',
      },
    ],
  };
}

function createInitialPacks(skills: Skill[]): SkillPack[] {
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  return [
    {
      id: 'pack-starter-stack',
      name: 'Starter Stack',
      description:
        'A balanced starter environment for monitoring, formatting, and prompt iteration.',
      author: 'SDKWork',
      rating: 4.9,
      downloads: 18400,
      category: 'Productivity',
      skills: [
        cloneSkill(skillById.get('skill-system-monitor')!),
        cloneSkill(skillById.get('skill-code-formatter')!),
        cloneSkill(skillById.get('skill-prompt-lab')!),
      ],
    },
    {
      id: 'pack-dev-ops',
      name: 'Developer Ops Pack',
      description:
        'Essential tooling for debugging APIs, monitoring systems, and capturing runbooks.',
      author: 'SDKWork',
      rating: 4.7,
      downloads: 12600,
      category: 'Development',
      skills: [
        cloneSkill(skillById.get('skill-system-monitor')!),
        cloneSkill(skillById.get('skill-api-inspector')!),
        cloneSkill(skillById.get('skill-team-notes')!),
      ],
    },
  ];
}

function createInitialInstallations(): Map<string, string[]> {
  return new Map<string, string[]>([
    ['local-built-in', ['skill-system-monitor', 'skill-code-formatter']],
    ['home-nas', ['skill-system-monitor']],
    ['device-alpha', ['skill-system-monitor', 'skill-api-inspector']],
    ['device-beta', ['skill-code-formatter']],
  ]);
}

function createInitialProfile(): MockUserProfile {
  return {
    firstName: 'Claw',
    lastName: 'Operator',
    email: 'operator@sdkwork.dev',
    avatarUrl: 'https://picsum.photos/seed/claw-user/128/128',
  };
}

function createInitialPreferences(): MockUserPreferences {
  return {
    general: {
      launchOnStartup: true,
      startMinimized: false,
    },
    notifications: {
      systemUpdates: true,
      taskFailures: true,
      securityAlerts: true,
      taskCompletions: false,
      newMessages: true,
    },
    privacy: {
      shareUsageData: true,
      personalizedRecommendations: true,
    },
    security: {
      twoFactorAuth: false,
      loginAlerts: true,
    },
  };
}

function createInitialApps(): MockAppItem[] {
  return [
    {
      id: 'app-openclaw',
      name: 'OpenClaw',
      developer: 'OpenClaw',
      category: 'AI Agents',
      description:
        'Install the OpenClaw gateway with host-aware defaults, dependency inspection, and guided runtime setup.',
      banner: 'https://picsum.photos/seed/openclaw-banner/1600/900',
      icon: 'https://picsum.photos/seed/openclaw-icon/256/256',
      rating: 4.9,
      rank: 1,
      reviewsCount: '24.8K',
      screenshots: [
        'https://picsum.photos/seed/openclaw-shot-1/1200/800',
        'https://picsum.photos/seed/openclaw-shot-2/1200/800',
      ],
      version: '2026.3.19',
      size: '118 MB',
      releaseDate: '2026-03-19',
      compatibility: 'Windows 11 (WSL), macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
      featured: true,
      topChart: true,
    },
    {
      id: 'app-codex',
      name: 'Codex',
      developer: 'OpenAI',
      category: 'AI Agents',
      description:
        'Install the Codex CLI with a Rust-backed source or release bootstrap workflow.',
      banner: 'https://picsum.photos/seed/codex-banner/1600/900',
      icon: 'https://picsum.photos/seed/codex-icon/256/256',
      rating: 4.8,
      rank: 2,
      reviewsCount: '18.3K',
      screenshots: ['https://picsum.photos/seed/codex-shot-1/1200/800'],
      version: '0.31.0',
      size: '41 MB',
      releaseDate: '2026-03-12',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
      topChart: true,
    },
    {
      id: 'app-nodejs',
      name: 'Node.js',
      developer: 'Node.js Foundation',
      category: 'Runtimes',
      description:
        'Install the Node.js runtime with package-manager defaults tailored to the current operating system.',
      icon: 'https://picsum.photos/seed/nodejs-icon/256/256',
      rating: 4.7,
      rank: 3,
      reviewsCount: '32.5K',
      screenshots: ['https://picsum.photos/seed/nodejs-shot-1/1200/800'],
      version: '24 LTS',
      size: '95 MB',
      releaseDate: '2026-03-08',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
      topChart: true,
    },
    {
      id: 'app-npm',
      name: 'npm',
      developer: 'npm, Inc.',
      category: 'Package Managers',
      description:
        'Install or repair npm as a first-class Node.js package manager managed by hub-installer.',
      icon: 'https://picsum.photos/seed/npm-icon/256/256',
      rating: 4.8,
      screenshots: ['https://picsum.photos/seed/npm-shot-1/1200/800'],
      version: '11.x',
      size: '16 MB',
      releaseDate: '2026-03-08',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
    },
    {
      id: 'app-pnpm',
      name: 'pnpm',
      developer: 'pnpm',
      category: 'Package Managers',
      description:
        'Install pnpm as a fast Node.js package manager with dependency checks and Corepack-aware activation.',
      icon: 'https://picsum.photos/seed/pnpm-icon/256/256',
      rating: 4.8,
      rank: 4,
      screenshots: ['https://picsum.photos/seed/pnpm-shot-1/1200/800'],
      version: '10.x',
      size: '17 MB',
      releaseDate: '2026-03-08',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
      topChart: true,
    },
    {
      id: 'app-homebrew',
      name: 'Homebrew',
      developer: 'Homebrew',
      category: 'Package Managers',
      description:
        'Install Homebrew on macOS, Linux, or inside WSL as a reusable base dependency for developer tooling.',
      icon: 'https://picsum.photos/seed/homebrew-icon/256/256',
      rating: 4.7,
      screenshots: ['https://picsum.photos/seed/homebrew-shot-1/1200/800'],
      version: '4.x',
      size: '22 MB',
      releaseDate: '2026-03-09',
      compatibility: 'Windows 11 (WSL), macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
    },
    {
      id: 'app-python',
      name: 'Python',
      developer: 'Python Software Foundation',
      category: 'Runtimes',
      description:
        'Install Python with platform-aware options such as OS packages, pyenv, or uv.',
      icon: 'https://picsum.photos/seed/python-icon/256/256',
      rating: 4.8,
      screenshots: ['https://picsum.photos/seed/python-shot-1/1200/800'],
      version: '3.13',
      size: '36 MB',
      releaseDate: '2026-03-08',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
    },
    {
      id: 'app-git',
      name: 'Git',
      developer: 'Git SCM',
      category: 'Developer Tools',
      description:
        'Install Git source control tooling with platform-specific package manager support.',
      icon: 'https://picsum.photos/seed/git-icon/256/256',
      rating: 4.9,
      screenshots: ['https://picsum.photos/seed/git-shot-1/1200/800'],
      version: '2.49',
      size: '48 MB',
      releaseDate: '2026-03-08',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
    },
    {
      id: 'app-ffmpeg',
      name: 'FFmpeg',
      developer: 'FFmpeg',
      category: 'Media Tooling',
      description:
        'Install FFmpeg for local audio, video, and media-processing workflows.',
      icon: 'https://picsum.photos/seed/ffmpeg-icon/256/256',
      rating: 4.7,
      screenshots: ['https://picsum.photos/seed/ffmpeg-shot-1/1200/800'],
      version: '7.1',
      size: '82 MB',
      releaseDate: '2026-03-08',
      compatibility: 'Windows 11, macOS 13+, Ubuntu 22.04+',
      ageRating: '4+',
    },
  ];
}

function createInitialAppCategories(): MockAppCategory[] {
  return [
    {
      title: 'AI Agents',
      subtitle: 'Agent runtimes and operator-facing gateways for developer workflows.',
      appIds: ['app-openclaw', 'app-codex'],
    },
    {
      title: 'Runtimes & Package Managers',
      subtitle: 'Core language runtimes and package managers required by developer tooling.',
      appIds: ['app-nodejs', 'app-python', 'app-npm', 'app-pnpm', 'app-homebrew'],
    },
    {
      title: 'Developer Foundations',
      subtitle: 'Common base tools that unlock source control and local media workflows.',
      appIds: ['app-git', 'app-ffmpeg'],
    },
  ];
}

function getTaskNextRun(task: MockTask) {
  if (task.status === 'paused') {
    return '-';
  }

  if (task.scheduleMode === 'datetime') {
    if (task.scheduleConfig.scheduledDate && task.scheduleConfig.scheduledTime) {
      return `${task.scheduleConfig.scheduledDate} ${task.scheduleConfig.scheduledTime}`;
    }
    return 'Scheduled';
  }

  if (
    task.scheduleMode === 'interval' &&
    task.scheduleConfig.intervalValue &&
    task.scheduleConfig.intervalUnit
  ) {
    return `In ${task.scheduleConfig.intervalValue} ${task.scheduleConfig.intervalUnit}${task.scheduleConfig.intervalValue === 1 ? '' : 's'}`;
  }

  return 'As scheduled';
}

function buildTaskExecutionSummary(task: MockTask, trigger: MockTaskExecutionHistoryEntry['trigger']) {
  const triggerLabel = trigger === 'manual' ? 'Manual run' : trigger === 'clone' ? 'Cloned run' : 'Scheduled run';
  const executionLabel =
    task.executionContent === 'sendPromptMessage' ? 'prompt message' : 'assistant task';
  const deliveryLabel =
    task.deliveryMode === 'publishSummary'
      ? `Delivered via ${task.deliveryChannel || 'default channel'}`
      : 'No delivery configured';

  return {
    summary: `${triggerLabel} finished successfully with ${executionLabel}.`,
    details: `${deliveryLabel}. Wake-up mode: ${task.wakeUpMode}. Session: ${task.sessionMode}.`,
  };
}

export function createStudioMockService(options: StudioMockServiceOptions = {}) {
  const latencyMs = options.latencyMs ?? 0;
  const wait = async () => {
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
  };

  const instances = createInitialInstances();
  const instanceConfigs = createInitialInstanceConfigs();
  const instanceTokens = createInitialInstanceTokens();
  const tasks = createInitialTasks();
  const taskExecutions = createInitialTaskExecutions();
  const channels = createInitialChannels();
  const proxyProviderGroups = createInitialProxyProviderGroups();
  const proxyProviders = createInitialProxyProviders();
  const unifiedApiKeys = createInitialUnifiedApiKeys();
  const modelMappings = createInitialModelMappings();
  const apiRouterUsageRecords = createInitialApiRouterUsageRecords();
  const instanceFiles = createInitialInstanceFiles();
  const instanceLlmProviders = createInitialInstanceLlmProviders();
  const instanceMemories = createInitialInstanceMemories();
  const instanceTools = createInitialInstanceTools();
  const devices = createInitialDevices();
  const agents = createInitialAgents();
  const skills = createInitialSkills();
  const reviews = createInitialReviews();
  const packs = createInitialPacks(skills);
  const installations = createInitialInstallations();
  const apps = createInitialApps();
  const appCategories = createInitialAppCategories();
  let profile = createInitialProfile();
  let preferences = createInitialPreferences();
  let deviceCounter = devices.length + 1;
  let taskCounter = tasks.length + 1;
  let taskExecutionCounter =
    Object.values(taskExecutions).flat().length + 1;
  let proxyProviderCounter = proxyProviders.length + 1;
  let unifiedApiKeyCounter = unifiedApiKeys.length + 1;
  let modelMappingCounter = modelMappings.length + 1;
  let modelMappingRuleCounter = modelMappings.flatMap((mapping) => mapping.rules).length + 1;

  const skillMap = () => new Map(skills.map((skill) => [skill.id, skill]));
  const appMap = () => new Map(apps.map((app) => [app.id, app]));

  function listInstalledSkillIds(targetId: string) {
    return [...(installations.get(targetId) || [])];
  }

  function writeInstalledSkillIds(targetId: string, skillIds: string[]) {
    installations.set(targetId, [...new Set(skillIds)]);
  }

  function syncInstanceConfigFile(instanceId: string, config: MockInstanceConfig) {
    const configFile = (instanceFiles[instanceId] || []).find((file) => file.category === 'config');
    if (!configFile) {
      return;
    }

    const nextContent = serializeInstanceConfigContent(configFile.name, config);
    configFile.content = nextContent;
    configFile.size = formatByteSize(nextContent);
    configFile.updatedAt = 'just now';
    configFile.status = 'modified';
  }

  return {
    async listInstances(): Promise<MockInstance[]> {
      await wait();
      return instances.map(cloneInstance);
    },

    async getInstance(id: string): Promise<MockInstance | undefined> {
      await wait();
      const instance = instances.find((item) => item.id === id);
      return instance ? cloneInstance(instance) : undefined;
    },

    async setInstanceStatus(
      id: string,
      status: MockInstance['status'],
    ): Promise<MockInstance | undefined> {
      await wait();
      const instance = instances.find((item) => item.id === id);
      if (!instance) {
        return undefined;
      }
      instance.status = status;
      if (status === 'online') {
        instance.uptime = 'just now';
      }
      if (status === 'offline') {
        instance.cpu = 0;
        instance.memory = 0;
        instance.uptime = '-';
      }
      return cloneInstance(instance);
    },

    async getInstanceConfig(id: string): Promise<MockInstanceConfig | undefined> {
      await wait();
      const config = instanceConfigs[id];
      return config ? cloneInstanceConfig(config) : undefined;
    },

    async updateInstanceConfig(
      id: string,
      config: MockInstanceConfig,
    ): Promise<MockInstanceConfig | undefined> {
      await wait();
      if (!instanceConfigs[id]) {
        return undefined;
      }
      instanceConfigs[id] = cloneInstanceConfig(config);
      syncInstanceConfigFile(id, instanceConfigs[id]);
      return cloneInstanceConfig(instanceConfigs[id]);
    },

    async getInstanceToken(id: string): Promise<string | undefined> {
      await wait();
      return instanceTokens[id];
    },

    async deleteInstance(id: string): Promise<boolean> {
      await wait();
      if (id === 'local-built-in') {
        throw new Error('Cannot delete built-in instance');
      }

      const index = instances.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }
      instances.splice(index, 1);
      delete instanceConfigs[id];
      delete instanceTokens[id];
      delete instanceFiles[id];
      delete instanceLlmProviders[id];
      delete instanceMemories[id];
      delete instanceTools[id];
      return true;
    },

    async getInstanceLogs(id: string): Promise<string> {
      await wait();
      const instance = instances.find((item) => item.id === id);
      if (!instance) {
        throw new Error('Instance not found');
      }

      return `[2026-03-18 08:32:01] INFO Starting Claw runtime for ${instance.name}
[2026-03-18 08:32:02] INFO Loading workspace configuration
[2026-03-18 08:32:03] INFO Hydrating shared service adapters
[2026-03-18 08:32:04] SUCCESS Runtime ready on ${instance.ip}:${instanceConfigs[id]?.port ?? '18789'}`;
    },

    async listTasks(instanceId: string): Promise<MockTask[]> {
      await wait();
      return tasks
        .filter((task) => task.instanceId === instanceId || task.instanceId === null)
        .map(cloneTask);
    },

    async createTask(
      instanceId: string,
      data: Omit<MockTask, 'id' | 'instanceId'>,
    ): Promise<MockTask> {
      await wait();
      const task: MockTask = {
        id: `task-${taskCounter++}`,
        instanceId,
        ...data,
      };
      task.nextRun = data.nextRun ?? getTaskNextRun(task);
      tasks.unshift(task);
      taskExecutions[task.id] = taskExecutions[task.id] || [];
      return cloneTask(task);
    },

    async updateTask(
      id: string,
      update: Partial<Omit<MockTask, 'id' | 'instanceId'>>,
    ): Promise<MockTask | undefined> {
      await wait();
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        return undefined;
      }

      Object.assign(task, update);
      task.nextRun = getTaskNextRun(task);
      return cloneTask(task);
    },

    async cloneTask(
      id: string,
      overrides: Partial<Omit<MockTask, 'id' | 'instanceId'>> = {},
    ): Promise<MockTask | undefined> {
      await wait();
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        return undefined;
      }

      const cloned: MockTask = {
        ...cloneTask(task),
        ...overrides,
        id: `task-${taskCounter++}`,
        status: overrides.status ?? 'paused',
        lastRun: undefined,
        nextRun: '-',
      };

      tasks.unshift(cloned);
      taskExecutions[cloned.id] = [
        {
          id: `task-run-${taskExecutionCounter++}`,
          taskId: cloned.id,
          status: 'success',
          trigger: 'clone',
          startedAt: 'just now',
          finishedAt: 'just now',
          summary: 'Task was cloned from an existing automation.',
          details: `Cloned from ${task.name}. The cloned task starts paused to avoid duplicate schedules.`,
        },
      ];

      return cloneTask(cloned);
    },

    async runTaskNow(id: string): Promise<MockTaskExecutionHistoryEntry | undefined> {
      await wait();
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        return undefined;
      }

      const result = buildTaskExecutionSummary(task, 'manual');
      const execution: MockTaskExecutionHistoryEntry = {
        id: `task-run-${taskExecutionCounter++}`,
        taskId: id,
        status: 'success',
        trigger: 'manual',
        startedAt: 'just now',
        finishedAt: 'just now',
        summary: result.summary,
        details: result.details,
      };

      task.lastRun = 'just now';
      if (task.status !== 'paused') {
        task.status = 'active';
      }
      task.nextRun = getTaskNextRun(task);
      taskExecutions[id] = [execution, ...(taskExecutions[id] || [])];

      return cloneTaskExecutionHistoryEntry(execution);
    },

    async listTaskExecutions(id: string): Promise<MockTaskExecutionHistoryEntry[]> {
      await wait();
      return (taskExecutions[id] || []).map(cloneTaskExecutionHistoryEntry);
    },

    async updateTaskStatus(
      id: string,
      status: MockTask['status'],
    ): Promise<MockTask | undefined> {
      await wait();
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        return undefined;
      }
      task.status = status;
      task.nextRun = getTaskNextRun(task);
      return cloneTask(task);
    },

    async deleteTask(id: string): Promise<boolean> {
      await wait();
      const index = tasks.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }
      tasks.splice(index, 1);
      delete taskExecutions[id];
      return true;
    },

    async listChannels(instanceId: string): Promise<MockChannel[]> {
      await wait();
      return channels
        .filter((channel) => channel.instanceId === instanceId || channel.instanceId === null)
        .map(cloneChannel);
    },

    async listApiRouterChannels(): Promise<ApiRouterChannel[]> {
      await wait();
      return listApiRouterChannelsFromProviders(proxyProviders).map(cloneApiRouterChannel);
    },

    async listProxyProviderGroups(): Promise<ProxyProviderGroup[]> {
      await wait();
      return proxyProviderGroups.map(cloneProxyProviderGroup);
    },

    async listApiRouterUsageRecordApiKeys(): Promise<ApiRouterUsageRecordApiKeyOption[]> {
      await wait();
      return listApiRouterUsageRecordOptions(apiRouterUsageRecords).map(
        cloneApiRouterUsageRecordApiKeyOption,
      );
    },

    async getApiRouterUsageRecordSummary(
      query: ApiRouterUsageRecordsQuery = {},
    ): Promise<ApiRouterUsageRecordSummary> {
      await wait();
      const result = queryApiRouterUsageRecords(apiRouterUsageRecords, query);
      return cloneApiRouterUsageRecordSummary(buildApiRouterUsageRecordSummary(result.filtered));
    },

    async listApiRouterUsageRecords(
      query: ApiRouterUsageRecordsQuery = {},
    ): Promise<ApiRouterUsageRecordsResult> {
      await wait();
      return queryApiRouterUsageRecords(apiRouterUsageRecords, query).paginated;
    },

    async listUnifiedApiKeys(): Promise<UnifiedApiKey[]> {
      await wait();
      return unifiedApiKeys.map(cloneUnifiedApiKey);
    },

    async createUnifiedApiKey(input: UnifiedApiKeyCreate): Promise<UnifiedApiKey> {
      await wait();

      const source =
        input.source ?? (input.apiKey?.trim() ? 'custom' : 'system-generated');
      const customApiKey = input.apiKey?.trim() || '';
      const apiKey =
        source === 'custom' ? customApiKey : generateUnifiedApiKeyValue();

      if (source === 'custom' && !apiKey) {
        throw new Error('Custom unified API keys require an API key value');
      }

      const key: UnifiedApiKey = {
        id: `unified-key-${unifiedApiKeyCounter++}`,
        name: input.name.trim(),
        apiKey,
        source,
        groupId: input.groupId,
        usage: {
          requestCount: 0,
          tokenCount: 0,
          spendUsd: 0,
          period: '30d',
        },
        expiresAt: input.expiresAt ?? null,
        status: 'active',
        createdAt: new Date().toISOString(),
        modelMappingId: undefined,
        notes: input.notes?.trim() || undefined,
      };

      unifiedApiKeys.unshift(key);
      return cloneUnifiedApiKey(key);
    },

    async updateUnifiedApiKey(
      id: string,
      update: UnifiedApiKeyUpdate,
    ): Promise<UnifiedApiKey | undefined> {
      await wait();
      const key = unifiedApiKeys.find((item) => item.id === id);
      if (!key) {
        return undefined;
      }

      const nextSource = update.source ?? key.source;
      const nextApiKeyValue = update.apiKey?.trim();

      if (nextSource === 'custom' && update.apiKey !== undefined && !nextApiKeyValue) {
        throw new Error('Custom unified API keys require an API key value');
      }

      key.name = update.name?.trim() || key.name;
      key.groupId = update.groupId ?? key.groupId;
      key.expiresAt = update.expiresAt === undefined ? key.expiresAt : update.expiresAt;
      key.status = update.status ?? key.status;
      key.modelMappingId =
        update.modelMappingId === undefined
          ? key.modelMappingId
          : update.modelMappingId || undefined;
      key.notes = update.notes === undefined ? key.notes : update.notes?.trim() || undefined;

      if (nextSource === 'system-generated' && key.source !== 'system-generated') {
        key.apiKey = generateUnifiedApiKeyValue();
      } else if (nextSource === 'custom' && nextApiKeyValue) {
        key.apiKey = nextApiKeyValue;
      }

      key.source = nextSource;
      return cloneUnifiedApiKey(key);
    },

    async updateUnifiedApiKeyGroup(
      id: string,
      groupId: string,
    ): Promise<UnifiedApiKey | undefined> {
      return this.updateUnifiedApiKey(id, { groupId });
    },

    async updateUnifiedApiKeyStatus(
      id: string,
      status: ProxyProviderStatus,
    ): Promise<UnifiedApiKey | undefined> {
      return this.updateUnifiedApiKey(id, { status });
    },

    async assignUnifiedApiKeyModelMapping(
      id: string,
      modelMappingId: string | null,
    ): Promise<UnifiedApiKey | undefined> {
      if (modelMappingId && !modelMappings.some((mapping) => mapping.id === modelMappingId)) {
        throw new Error('Model mapping not found');
      }

      return this.updateUnifiedApiKey(id, { modelMappingId });
    },

    async deleteUnifiedApiKey(id: string): Promise<boolean> {
      await wait();
      const index = unifiedApiKeys.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }

      unifiedApiKeys.splice(index, 1);
      return true;
    },

    async listModelMappingCatalog(): Promise<ModelMappingCatalogChannel[]> {
      await wait();
      return createModelMappingCatalogFromProviders(proxyProviders).map(cloneModelMappingCatalogChannel);
    },

    async listModelMappings(): Promise<ModelMapping[]> {
      await wait();
      return modelMappings.map(cloneModelMapping);
    },

    async createModelMapping(input: ModelMappingCreate): Promise<ModelMapping> {
      await wait();

      const mapping: ModelMapping = {
        id: `model-mapping-${modelMappingCounter++}`,
        name: input.name.trim(),
        description: input.description?.trim() || '',
        status: 'active',
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdAt: new Date().toISOString(),
        rules: input.rules.map((rule) => ({
          id: rule.id?.trim() || `model-mapping-rule-${modelMappingRuleCounter++}`,
          source: cloneModelMappingModelRef(rule.source),
          target: cloneModelMappingModelRef(rule.target),
        })),
      };

      modelMappings.unshift(mapping);
      return cloneModelMapping(mapping);
    },

    async updateModelMapping(
      id: string,
      update: ModelMappingUpdate,
    ): Promise<ModelMapping | undefined> {
      await wait();
      const mapping = modelMappings.find((item) => item.id === id);
      if (!mapping) {
        return undefined;
      }

      mapping.name = update.name?.trim() || mapping.name;
      mapping.description =
        update.description === undefined ? mapping.description : update.description.trim();
      mapping.status = update.status ?? mapping.status;
      mapping.effectiveFrom = update.effectiveFrom ?? mapping.effectiveFrom;
      mapping.effectiveTo = update.effectiveTo ?? mapping.effectiveTo;

      if (update.rules) {
        mapping.rules = update.rules.map((rule) => ({
          id: rule.id?.trim() || `model-mapping-rule-${modelMappingRuleCounter++}`,
          source: cloneModelMappingModelRef(rule.source),
          target: cloneModelMappingModelRef(rule.target),
        }));
      }

      return cloneModelMapping(mapping);
    },

    async updateModelMappingStatus(
      id: string,
      status: ModelMappingStatus,
    ): Promise<ModelMapping | undefined> {
      return this.updateModelMapping(id, { status });
    },

    async deleteModelMapping(id: string): Promise<boolean> {
      await wait();
      const index = modelMappings.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }

      modelMappings.splice(index, 1);
      unifiedApiKeys.forEach((key) => {
        if (key.modelMappingId === id) {
          key.modelMappingId = undefined;
        }
      });
      return true;
    },

    async listProxyProviders(channelId?: string): Promise<ProxyProvider[]> {
      await wait();
      return proxyProviders
        .filter((provider) => !channelId || provider.channelId === channelId)
        .map(cloneProxyProvider);
    },

    async createProxyProvider(input: ProxyProviderCreate): Promise<ProxyProvider> {
      await wait();

      const provider: ProxyProvider = {
        id: `provider-${input.channelId}-${proxyProviderCounter++}`,
        channelId: input.channelId,
        name: input.name.trim(),
        apiKey: input.apiKey.trim(),
        groupId: input.groupId,
        usage: {
          requestCount: 0,
          tokenCount: 0,
          spendUsd: 0,
          period: '30d',
        },
        expiresAt: input.expiresAt ?? null,
        status: 'active',
        createdAt: new Date().toISOString(),
        baseUrl: input.baseUrl.trim(),
        models: normalizeProxyProviderModels(input.models),
        notes: input.notes?.trim() || undefined,
      };

      proxyProviders.unshift(provider);
      return cloneProxyProvider(provider);
    },

    async updateProxyProvider(
      id: string,
      update: ProxyProviderUpdate,
    ): Promise<ProxyProvider | undefined> {
      await wait();
      const provider = proxyProviders.find((item) => item.id === id);
      if (!provider) {
        return undefined;
      }

      provider.name = update.name ?? provider.name;
      provider.apiKey = update.apiKey ?? provider.apiKey;
      provider.groupId = update.groupId ?? provider.groupId;
      provider.expiresAt =
        update.expiresAt === undefined ? provider.expiresAt : update.expiresAt;
      provider.status = update.status ?? provider.status;
      provider.baseUrl = update.baseUrl ?? provider.baseUrl;
      provider.models = update.models ? normalizeProxyProviderModels(update.models) : provider.models;
      provider.notes = update.notes ?? provider.notes;

      return cloneProxyProvider(provider);
    },

    async updateProxyProviderGroup(
      id: string,
      groupId: string,
    ): Promise<ProxyProvider | undefined> {
      return this.updateProxyProvider(id, { groupId });
    },

    async updateProxyProviderStatus(
      id: string,
      status: ProxyProviderStatus,
    ): Promise<ProxyProvider | undefined> {
      return this.updateProxyProvider(id, { status });
    },

    async deleteProxyProvider(id: string): Promise<boolean> {
      await wait();
      const index = proxyProviders.findIndex((provider) => provider.id === id);
      if (index === -1) {
        return false;
      }

      proxyProviders.splice(index, 1);
      return true;
    },

    async listInstanceFiles(instanceId: string): Promise<MockInstanceFile[]> {
      await wait();
      return (instanceFiles[instanceId] || []).map(cloneInstanceFile);
    },

    async listInstanceLlmProviders(instanceId: string): Promise<MockInstanceLLMProvider[]> {
      await wait();
      return (instanceLlmProviders[instanceId] || []).map(cloneInstanceLLMProvider);
    },

    async updateInstanceLlmProviderConfig(
      instanceId: string,
      providerId: string,
      update: MockInstanceLLMProviderUpdate,
    ): Promise<MockInstanceLLMProvider | undefined> {
      await wait();

      const provider = (instanceLlmProviders[instanceId] || []).find((item) => item.id === providerId);
      if (!provider) {
        return undefined;
      }

      provider.endpoint = update.endpoint ?? provider.endpoint;
      provider.apiKeySource = update.apiKeySource ?? provider.apiKeySource;
      provider.defaultModelId = update.defaultModelId ?? provider.defaultModelId;
      provider.reasoningModelId = update.reasoningModelId ?? provider.reasoningModelId;
      provider.embeddingModelId = update.embeddingModelId ?? provider.embeddingModelId;
      provider.config = {
        ...provider.config,
        ...(update.config || {}),
      };
      provider.lastCheckedAt = 'just now';

      if (!provider.apiKeySource.trim()) {
        provider.status = 'configurationRequired';
      } else if (provider.status === 'configurationRequired') {
        provider.status = 'ready';
      }

      return cloneInstanceLLMProvider(provider);
    },

    async upsertInstanceLlmProvider(
      instanceId: string,
      input: MockInstanceLLMProviderCreate,
    ): Promise<MockInstanceLLMProvider> {
      await wait();

      const instance = instances.find((item) => item.id === instanceId);
      if (!instance) {
        throw new Error('Instance not found');
      }

      const providerList = instanceLlmProviders[instanceId] || [];
      instanceLlmProviders[instanceId] = providerList;

      const nextProvider: MockInstanceLLMProvider = {
        id: input.id,
        instanceId,
        name: input.name,
        provider: input.provider,
        endpoint: input.endpoint,
        apiKeySource: input.apiKeySource,
        status: input.apiKeySource.trim() ? input.status : 'configurationRequired',
        defaultModelId: input.defaultModelId,
        reasoningModelId: input.reasoningModelId,
        embeddingModelId: input.embeddingModelId,
        description: input.description,
        icon: input.icon,
        lastCheckedAt: input.lastCheckedAt,
        capabilities: [...input.capabilities],
        models: input.models.map(cloneInstanceLLMProviderModel),
        config: cloneInstanceLLMProviderConfig(input.config),
      };

      const existingIndex = providerList.findIndex((provider) => provider.id === input.id);
      if (existingIndex >= 0) {
        providerList[existingIndex] = nextProvider;
      } else {
        providerList.unshift(nextProvider);
      }

      return cloneInstanceLLMProvider(nextProvider);
    },

    async updateInstanceFileContent(
      instanceId: string,
      fileId: string,
      content: string,
    ): Promise<MockInstanceFile | undefined> {
      await wait();

      const file = (instanceFiles[instanceId] || []).find((item) => item.id === fileId);
      if (!file) {
        return undefined;
      }

      if (file.isReadonly) {
        throw new Error('File is read-only');
      }

      if (file.category === 'config' && instanceConfigs[instanceId]) {
        instanceConfigs[instanceId] = parseInstanceConfigContent(file.name, content, instanceConfigs[instanceId]);
      }

      file.content = content;
      file.size = formatByteSize(content);
      file.updatedAt = 'just now';
      file.status = 'modified';

      return cloneInstanceFile(file);
    },

    async listInstanceMemories(instanceId: string): Promise<MockInstanceMemoryEntry[]> {
      await wait();
      return (instanceMemories[instanceId] || []).map(cloneInstanceMemoryEntry);
    },

    async listInstanceTools(instanceId: string): Promise<MockInstanceTool[]> {
      await wait();
      return (instanceTools[instanceId] || []).map(cloneInstanceTool);
    },

    async updateChannelStatus(
      channelId: string,
      enabled: boolean,
    ): Promise<MockChannel | undefined> {
      await wait();
      const channel = channels.find((item) => item.id === channelId);
      if (!channel) {
        return undefined;
      }
      channel.enabled = enabled;
      channel.status = enabled ? 'connected' : 'disconnected';
      return cloneChannel(channel);
    },

    async saveChannelConfig(
      channelId: string,
      configData: Record<string, string>,
    ): Promise<MockChannel | undefined> {
      await wait();
      const channel = channels.find((item) => item.id === channelId);
      if (!channel) {
        return undefined;
      }
      channel.fields = channel.fields.map((field) => ({
        ...field,
        value: configData[field.key] ?? field.value,
      }));
      channel.enabled = true;
      channel.status = 'connected';
      return cloneChannel(channel);
    },

    async deleteChannelConfig(channelId: string): Promise<MockChannel | undefined> {
      await wait();
      const channel = channels.find((item) => item.id === channelId);
      if (!channel) {
        return undefined;
      }
      channel.fields = channel.fields.map((field) => ({
        ...field,
        value: undefined,
      }));
      channel.enabled = false;
      channel.status = 'not_configured';
      return cloneChannel(channel);
    },

    async listDevices(): Promise<Device[]> {
      await wait();
      return devices.map(cloneDevice);
    },

    async listAgents(): Promise<Agent[]> {
      await wait();
      return agents.map(cloneAgent);
    },

    async getAgent(id: string): Promise<Agent | undefined> {
      await wait();
      const agent = agents.find((item) => item.id === id);
      return agent ? cloneAgent(agent) : undefined;
    },

    async createDevice(name: string): Promise<Device> {
      await wait();
      const device: Device = {
        id: `device-${deviceCounter++}`,
        name,
        battery: 70,
        ip_address: `192.168.1.${60 + deviceCounter}`,
        status: 'online',
        created_at: new Date().toISOString(),
        hardwareSpecs: {
          soc: 'RK3588',
          ram: '8 GB',
          storage: '128 GB',
          latency: '24 ms',
        },
      };
      devices.unshift(device);
      return cloneDevice(device);
    },

    async deleteDevice(id: string): Promise<boolean> {
      await wait();
      const index = devices.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }
      devices.splice(index, 1);
      installations.delete(id);
      return true;
    },

    async listDeviceInstalledSkills(deviceId: string): Promise<InstalledSkill[]> {
      await wait();
      const skillsById = skillMap();
      return listInstalledSkillIds(deviceId)
        .map((skillId) => skillsById.get(skillId))
        .filter((skill): skill is Skill => Boolean(skill))
        .map((skill) =>
          cloneInstalledSkill({
            id: skill.id,
            name: skill.name,
            version: skill.version || '1.0.0',
            status: 'running',
          }),
        );
    },

    async listSkills(): Promise<Skill[]> {
      await wait();
      return skills.map(cloneSkill);
    },

    async getSkill(id: string): Promise<Skill | undefined> {
      await wait();
      const skill = skills.find((item) => item.id === id);
      return skill ? cloneSkill(skill) : undefined;
    },

    async listSkillReviews(id: string): Promise<Review[]> {
      await wait();
      return (reviews[id] || []).map(cloneReview);
    },

    async listPacks(): Promise<SkillPack[]> {
      await wait();
      return packs.map(clonePack);
    },

    async getPack(id: string): Promise<SkillPack | undefined> {
      await wait();
      const pack = packs.find((item) => item.id === id);
      return pack ? clonePack(pack) : undefined;
    },

    async listInstalledSkills(targetId: string): Promise<Skill[]> {
      await wait();
      const skillsById = skillMap();
      return listInstalledSkillIds(targetId)
        .map((skillId) => skillsById.get(skillId))
        .filter((skill): skill is Skill => Boolean(skill))
        .map(cloneSkill);
    },

    async installSkill(targetId: string, skillId: string): Promise<{ success: boolean }> {
      await wait();
      const skill = skills.find((item) => item.id === skillId);
      if (!skill) {
        throw new Error('Skill not found');
      }
      writeInstalledSkillIds(targetId, [...listInstalledSkillIds(targetId), skillId]);
      skill.downloads += 1;
      return { success: true };
    },

    async installPack(
      targetId: string,
      packId: string,
      skillIds?: string[],
    ): Promise<{ success: boolean }> {
      await wait();
      const pack = packs.find((item) => item.id === packId);
      if (!pack) {
        throw new Error('Pack not found');
      }
      const targetSkillIds = skillIds?.length ? skillIds : pack.skills.map((skill) => skill.id);
      const currentIds = new Set(listInstalledSkillIds(targetId));
      targetSkillIds.forEach((skillId) => currentIds.add(skillId));
      writeInstalledSkillIds(targetId, [...currentIds]);
      pack.downloads += 1;

      const skillsById = skillMap();
      targetSkillIds.forEach((skillId) => {
        const skill = skillsById.get(skillId);
        if (skill) {
          skill.downloads += 1;
        }
      });

      return { success: true };
    },

    async uninstallSkill(targetId: string, skillId: string): Promise<{ success: boolean }> {
      await wait();
      writeInstalledSkillIds(
        targetId,
        listInstalledSkillIds(targetId).filter((currentSkillId) => currentSkillId !== skillId),
      );
      return { success: true };
    },

    async getProfile(): Promise<MockUserProfile> {
      await wait();
      return cloneProfile(profile);
    },

    async updateProfile(nextProfile: MockUserProfile): Promise<MockUserProfile> {
      await wait();
      profile = cloneProfile(nextProfile);
      return cloneProfile(profile);
    },

    async getPreferences(): Promise<MockUserPreferences> {
      await wait();
      return clonePreferences(preferences);
    },

    async updatePreferences(
      nextPreferences: Partial<MockUserPreferences>,
    ): Promise<MockUserPreferences> {
      await wait();
      preferences = mergePreferences(preferences, nextPreferences);
      return clonePreferences(preferences);
    },

    async getFeaturedApp(): Promise<MockAppItem | undefined> {
      await wait();
      const app = apps.find((item) => item.featured);
      return app ? cloneAppItem(app) : undefined;
    },

    async getTopChartApps(): Promise<MockAppItem[]> {
      await wait();
      return apps
        .filter((item) => item.topChart)
        .sort((left, right) => (left.rank || 0) - (right.rank || 0))
        .map(cloneAppItem);
    },

    async getAppCategories(): Promise<Array<{ title: string; subtitle: string; apps: MockAppItem[] }>> {
      await wait();
      const appsById = appMap();
      return appCategories.map((category) => ({
        title: category.title,
        subtitle: category.subtitle,
        apps: category.appIds
          .map((appId) => appsById.get(appId))
          .filter((app): app is MockAppItem => Boolean(app))
          .map(cloneAppItem),
      }));
    },

    async getApp(id: string): Promise<MockAppItem | undefined> {
      await wait();
      const app = apps.find((item) => item.id === id);
      return app ? cloneAppItem(app) : undefined;
    },
  };
}

export const studioMockService = createStudioMockService();
