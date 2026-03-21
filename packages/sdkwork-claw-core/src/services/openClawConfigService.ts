import JSON5 from 'json5';
import { platform } from '@sdkwork/claw-infrastructure';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue | undefined;
}
type JsonArray = JsonValue[];

export interface OpenClawConfigPathInput {
  installRoot?: string | null;
  workRoot?: string | null;
  dataRoot?: string | null;
  homeRoots?: string[];
}

export interface OpenClawConfigBackedRoute {
  scope: string;
  mode: string;
  target?: string | null;
  authoritative?: boolean;
}

export interface OpenClawConfigBackedArtifact {
  kind: string;
  location?: string | null;
}

export interface OpenClawConfigBackedDetail {
  dataAccess?: {
    routes?: OpenClawConfigBackedRoute[];
  } | null;
  artifacts?: OpenClawConfigBackedArtifact[] | null;
}

export interface OpenClawProviderModelInput {
  id: string;
  name: string;
}

export interface OpenClawProviderInput {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: OpenClawProviderModelInput[];
  notes?: string;
  config?: Partial<OpenClawProviderRuntimeConfig>;
}

export interface OpenClawModelSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawChannelFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
}

export interface OpenClawChannelDefinition {
  id: string;
  name: string;
  description: string;
  setupSteps: string[];
  fields: OpenClawChannelFieldDefinition[];
}

export interface OpenClawChannelSnapshot {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  fieldCount: number;
  configuredFieldCount: number;
  setupSteps: string[];
  values: Record<string, string>;
  fields: OpenClawChannelFieldDefinition[];
}

export interface OpenClawProviderSnapshot {
  id: string;
  providerKey: string;
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
  models: Array<{
    id: string;
    name: string;
    role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
    contextWindow: string;
  }>;
  config: OpenClawProviderRuntimeConfig;
}

export interface OpenClawProviderRuntimeConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
  streaming: boolean;
}

export interface OpenClawConfigSnapshot {
  configPath: string;
  providerSnapshots: OpenClawProviderSnapshot[];
  channelSnapshots: OpenClawChannelSnapshot[];
  root: JsonObject;
}

export interface SaveOpenClawChannelConfigurationInput {
  configPath: string;
  channelId: string;
  values: Record<string, string>;
  enabled?: boolean;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

function pushCandidatePath(target: string[], nextPath?: string | null) {
  if (!nextPath) {
    return;
  }

  const normalized = normalizePath(nextPath);
  if (!normalized || target.includes(normalized)) {
    return;
  }

  target.push(normalized);
}

function joinPath(root?: string | null, ...segments: string[]) {
  if (!root) {
    return null;
  }

  const normalizedRoot = normalizePath(root).replace(/\/+$/, '');
  if (!normalizedRoot) {
    return null;
  }

  return [normalizedRoot, ...segments].join('/');
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function ensureArray(parent: JsonObject, key: string): JsonArray {
  const current = parent[key];
  if (!Array.isArray(current)) {
    parent[key] = [];
  }

  return parent[key] as JsonArray;
}

function readScalar(value: JsonValue | undefined) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function readNumber(value: JsonValue | undefined, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function setOptionalScalar(target: JsonObject, key: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[key];
    return;
  }

  target[key] = normalized;
}

function isReasoningModel(modelId: string, modelName: string, explicitReasoning?: JsonValue) {
  if (typeof explicitReasoning === 'boolean') {
    return explicitReasoning;
  }

  return /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(`${modelId} ${modelName}`);
}

function isEmbeddingModel(modelId: string, modelName: string) {
  return /(embed|embedding|bge|vector)/i.test(`${modelId} ${modelName}`);
}

function inferContextWindow(
  role: 'primary' | 'reasoning' | 'embedding' | 'fallback',
  explicitContextWindow?: JsonValue,
) {
  if (typeof explicitContextWindow === 'number') {
    if (explicitContextWindow >= 1000) {
      return `${Math.round(explicitContextWindow / 1000)}K`;
    }

    return String(explicitContextWindow);
  }

  if (role === 'embedding') {
    return '8K';
  }

  if (role === 'reasoning') {
    return '200K';
  }

  return '128K';
}

function getProviderIcon(channelId: string) {
  const iconMap: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AT',
    xai: 'XI',
    deepseek: 'DS',
    qwen: 'QW',
    zhipu: 'ZP',
    baidu: 'BD',
    'tencent-hunyuan': 'TH',
    doubao: 'DB',
    moonshot: 'KI',
    minimax: 'MM',
    stepfun: 'SF',
    'iflytek-spark': 'IF',
  };

  return iconMap[channelId] || 'AR';
}

function buildProviderKey(providerId: string) {
  return `api-router-${providerId}`;
}

function buildModelRef(providerKey: string, modelId: string) {
  return `${providerKey}/${modelId}`;
}

function parseModelRef(value: JsonValue | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const slashIndex = value.indexOf('/');
  if (slashIndex <= 0 || slashIndex === value.length - 1) {
    return null;
  }

  return {
    providerKey: value.slice(0, slashIndex),
    modelId: value.slice(slashIndex + 1),
  };
}

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function titleizeProviderKey(providerKey: string) {
  return providerKey
    .replace(/^api-router-/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

const OPENCLAW_CHANNEL_DEFINITIONS: OpenClawChannelDefinition[] = [
  {
    id: 'feishu',
    name: 'Feishu',
    description: 'Connect a Feishu bot so OpenClaw can receive and reply to team messages.',
    setupSteps: [
      'Create a Feishu app in the open platform.',
      'Copy the App ID and App Secret into this form.',
      'Add the event callback URL from your OpenClaw deployment if needed.',
    ],
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'cli_xxxxxxxxxxxxx',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        placeholder: 'App secret',
        required: true,
        sensitive: true,
      },
      {
        key: 'encryptKey',
        label: 'Encrypt Key',
        placeholder: 'Optional encrypt key',
        sensitive: true,
      },
      {
        key: 'verificationToken',
        label: 'Verification Token',
        placeholder: 'Optional verification token',
        sensitive: true,
      },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Use a Telegram bot token to bring OpenClaw into direct messages or group chats.',
    setupSteps: [
      'Create a bot with BotFather and copy the bot token.',
      'Optionally set a webhook URL if Telegram should push events to your host.',
      'Enable the channel after the required credentials are filled.',
    ],
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: '123456:AA...',
        required: true,
        sensitive: true,
      },
      {
        key: 'tokenFile',
        label: 'Token File',
        placeholder: 'Optional token file path',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/openclaw/telegram',
        inputMode: 'url',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Optional webhook secret',
        sensitive: true,
      },
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        placeholder: '/telegram/webhook',
      },
      {
        key: 'webhookHost',
        label: 'Webhook Host',
        placeholder: '0.0.0.0',
      },
      {
        key: 'webhookPort',
        label: 'Webhook Port',
        placeholder: '8443',
        inputMode: 'numeric',
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Attach OpenClaw to a Discord bot for server and DM conversations.',
    setupSteps: [
      'Create a Discord application and bot in the developer portal.',
      'Paste the bot token here and invite the bot to your server.',
      'Turn the channel on once the token has been validated.',
    ],
    fields: [
      {
        key: 'token',
        label: 'Bot Token',
        placeholder: 'Discord bot token',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Configure bot and app tokens so OpenClaw can work inside Slack workspaces.',
    setupSteps: [
      'Create or open your Slack app and install it to the target workspace.',
      'Paste the bot token and app token below.',
      'Add a signing secret if your workspace uses slash commands or events.',
    ],
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: 'xoxb-...',
        required: true,
        sensitive: true,
      },
      {
        key: 'appToken',
        label: 'App Token',
        placeholder: 'xapp-...',
        required: true,
        sensitive: true,
      },
      {
        key: 'signingSecret',
        label: 'Signing Secret',
        placeholder: 'Optional signing secret',
        sensitive: true,
      },
    ],
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    description: 'Provide Google Chat service account or ref details for enterprise workspace delivery.',
    setupSteps: [
      'Create a Google Chat app and service account.',
      'Provide either the inline service account JSON or a service account reference.',
      'Fill audience or webhook information if your deployment requires it.',
    ],
    fields: [
      {
        key: 'serviceAccount',
        label: 'Service Account JSON',
        placeholder: '{ \"type\": \"service_account\", ... }',
        multiline: true,
      },
      {
        key: 'serviceAccountRef',
        label: 'Service Account Ref',
        placeholder: 'secret://googlechat/service-account',
      },
      {
        key: 'audienceType',
        label: 'Audience Type',
        placeholder: 'SPACE or DM',
      },
      {
        key: 'audience',
        label: 'Audience',
        placeholder: 'spaces/AAAA12345',
      },
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        placeholder: '/googlechat/webhook',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/openclaw/googlechat',
        inputMode: 'url',
      },
    ],
  },
];

function getChannelDefinition(channelId: string) {
  return OPENCLAW_CHANNEL_DEFINITIONS.find((definition) => definition.id === channelId) || null;
}

async function readConfigRoot(configPath: string) {
  const raw = await platform.readFile(configPath);
  const parsed = raw.trim() ? JSON5.parse(raw) : {};

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {} as JsonObject;
  }

  return parsed as JsonObject;
}

async function writeConfigRoot(configPath: string, root: JsonObject) {
  const content = `${JSON5.stringify(root, null, 2)}\n`;
  await platform.writeFile(configPath, content);
}

function buildChannelSnapshots(root: JsonObject): OpenClawChannelSnapshot[] {
  const channelsRoot =
    root.channels && typeof root.channels === 'object' && !Array.isArray(root.channels)
      ? (root.channels as JsonObject)
      : {};

  return OPENCLAW_CHANNEL_DEFINITIONS.map((definition) => {
    const channelConfig =
      channelsRoot[definition.id] &&
      typeof channelsRoot[definition.id] === 'object' &&
      !Array.isArray(channelsRoot[definition.id])
        ? (channelsRoot[definition.id] as JsonObject)
        : {};
    const values = Object.fromEntries(
      definition.fields.map((field) => [field.key, readScalar(channelConfig[field.key])]),
    );
    const configuredFieldCount = definition.fields.filter((field) => Boolean(values[field.key])).length;
    const enabled = Boolean(channelConfig.enabled ?? configuredFieldCount > 0);
    const status =
      configuredFieldCount === 0 ? 'not_configured' : enabled ? 'connected' : 'disconnected';

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      status,
      enabled,
      fieldCount: definition.fields.length,
      configuredFieldCount,
      setupSteps: [...definition.setupSteps],
      values,
      fields: definition.fields.map((field) => ({ ...field })),
    };
  });
}

function buildProviderSnapshots(root: JsonObject): OpenClawProviderSnapshot[] {
  const providersRoot =
    root.models &&
    typeof root.models === 'object' &&
    !Array.isArray(root.models) &&
    (root.models as JsonObject).providers &&
    typeof (root.models as JsonObject).providers === 'object' &&
    !Array.isArray((root.models as JsonObject).providers)
      ? ((root.models as JsonObject).providers as JsonObject)
      : {};
  const defaultsRoot =
    root.agents &&
    typeof root.agents === 'object' &&
    !Array.isArray(root.agents) &&
    (root.agents as JsonObject).defaults &&
    typeof (root.agents as JsonObject).defaults === 'object' &&
    !Array.isArray((root.agents as JsonObject).defaults)
      ? ((root.agents as JsonObject).defaults as JsonObject)
      : {};
  const primaryRef = parseModelRef(
    defaultsRoot.model &&
      typeof defaultsRoot.model === 'object' &&
      !Array.isArray(defaultsRoot.model)
      ? (defaultsRoot.model as JsonObject).primary
      : undefined,
  );
  const fallbackRefs = readArray(
    defaultsRoot.model &&
      typeof defaultsRoot.model === 'object' &&
      !Array.isArray(defaultsRoot.model)
      ? (defaultsRoot.model as JsonObject).fallbacks
      : undefined,
  )
    .map((entry) => parseModelRef(entry))
    .filter((entry): entry is { providerKey: string; modelId: string } => Boolean(entry));

  return Object.entries(providersRoot).flatMap(([providerKey, rawProvider]) => {
    if (!rawProvider || typeof rawProvider !== 'object' || Array.isArray(rawProvider)) {
      return [];
    }

    const provider = rawProvider as JsonObject;
    const rawModels = readArray(provider.models).filter(
      (entry): entry is JsonObject => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
    );
    if (rawModels.length === 0) {
      return [];
    }

    const defaultModelId =
      primaryRef?.providerKey === providerKey ? primaryRef.modelId : readScalar(rawModels[0]?.id);
    const reasoningFallback = fallbackRefs.find((entry) => entry.providerKey === providerKey);
    const reasoningModelId =
      reasoningFallback?.modelId ||
      rawModels.find((model) => isReasoningModel(readScalar(model.id), readScalar(model.name), model.reasoning))
        ?.id;
    const embeddingModelId = rawModels.find((model) =>
      isEmbeddingModel(readScalar(model.id), readScalar(model.name)),
    )?.id;
    const status = readScalar(provider.apiKey).trim() ? 'ready' : 'configurationRequired';

    return [
      {
        id: providerKey,
        providerKey,
        name: `API Router ${titleizeProviderKey(providerKey)}`.trim(),
        provider: 'api-router',
        endpoint: readScalar(provider.baseUrl),
        apiKeySource: readScalar(provider.apiKey),
        status,
        defaultModelId,
        reasoningModelId: reasoningModelId ? readScalar(reasoningModelId) : undefined,
        embeddingModelId: embeddingModelId ? readScalar(embeddingModelId) : undefined,
        description: 'Managed from Claw Studio install and instance configuration flows.',
        icon: getProviderIcon(titleizeProviderKey(providerKey).toLowerCase()),
        lastCheckedAt: new Date().toISOString(),
        capabilities: ['Guided Install', 'API Router', 'OpenClaw'],
        models: rawModels.map((model) => {
          const modelId = readScalar(model.id);
          const modelName = readScalar(model.name) || modelId;
          const role =
            modelId === defaultModelId
              ? 'primary'
              : modelId === embeddingModelId
                ? 'embedding'
                : modelId === reasoningModelId
                  ? 'reasoning'
                  : 'fallback';

          return {
            id: modelId,
            name: modelName,
            role,
            contextWindow: inferContextWindow(role, model.contextWindow),
          };
        }),
        config: {
          temperature: readNumber(provider.temperature, 0.2),
          topP: readNumber(provider.topP, 1),
          maxTokens: readNumber(provider.maxTokens, 8192),
          timeoutMs: readNumber(provider.timeoutMs, 60000),
          streaming:
            typeof provider.streaming === 'boolean'
              ? provider.streaming
              : readScalar(provider.streaming) !== 'false',
        },
      },
    ];
  });
}

function updateProviderConfig(root: JsonObject, provider: OpenClawProviderInput, selection: OpenClawModelSelection) {
  const modelsRoot = ensureObject(root, 'models');
  const providersRoot = ensureObject(modelsRoot, 'providers');
  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const modelRoot = ensureObject(defaultsRoot, 'model');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  const providerKey = buildProviderKey(provider.id);
  const providerRoot = ensureObject(providersRoot, providerKey);

  providerRoot.baseUrl = provider.baseUrl;
  providerRoot.apiKey = provider.apiKey;
  providerRoot.api = 'openai-completions';
  providerRoot.auth = 'api-key';
  if (typeof provider.config?.temperature === 'number') {
    providerRoot.temperature = provider.config.temperature;
  }
  if (typeof provider.config?.topP === 'number') {
    providerRoot.topP = provider.config.topP;
  }
  if (typeof provider.config?.maxTokens === 'number') {
    providerRoot.maxTokens = provider.config.maxTokens;
  }
  if (typeof provider.config?.timeoutMs === 'number') {
    providerRoot.timeoutMs = provider.config.timeoutMs;
  }
  if (typeof provider.config?.streaming === 'boolean') {
    providerRoot.streaming = provider.config.streaming;
  }
  providerRoot.models = provider.models.map((model) => ({
    id: model.id,
    name: model.name,
    reasoning: model.id === selection.reasoningModelId,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: model.id === selection.embeddingModelId ? 8192 : model.id === selection.reasoningModelId ? 200000 : 128000,
    maxTokens: model.id === selection.embeddingModelId ? 8192 : 32000,
  })) as JsonValue;

  const selectedModelIds = [
    selection.defaultModelId,
    selection.reasoningModelId,
    selection.embeddingModelId,
  ].filter((value): value is string => Boolean(value));
  const uniqueSelectedModelIds = [...new Set(selectedModelIds)];
  const modelNamesById = Object.fromEntries(provider.models.map((model) => [model.id, model.name]));

  for (const modelId of uniqueSelectedModelIds) {
    catalogRoot[buildModelRef(providerKey, modelId)] = {
      alias: modelNamesById[modelId] || modelId,
      streaming: modelId !== selection.embeddingModelId,
    };
  }

  modelRoot.primary = buildModelRef(providerKey, selection.defaultModelId);
  const fallbacks = ensureArray(modelRoot, 'fallbacks');
  fallbacks.length = 0;
  if (selection.reasoningModelId) {
    fallbacks.push(buildModelRef(providerKey, selection.reasoningModelId));
  }
}

function updateChannelConfig(root: JsonObject, input: SaveOpenClawChannelConfigurationInput) {
  const channelsRoot = ensureObject(root, 'channels');
  const channelRoot = ensureObject(channelsRoot, input.channelId);
  const definition = getChannelDefinition(input.channelId);

  if (!definition) {
    throw new Error(`Unsupported OpenClaw channel: ${input.channelId}`);
  }

  for (const field of definition.fields) {
    setOptionalScalar(channelRoot, field.key, input.values[field.key]);
  }

  const configuredFieldCount = definition.fields.filter(
    (field) => Boolean(input.values[field.key]?.trim()),
  ).length;
  channelRoot.enabled = input.enabled ?? configuredFieldCount > 0;
}

class OpenClawConfigService {
  getChannelDefinitions() {
    return OPENCLAW_CHANNEL_DEFINITIONS.map((definition) => ({
      ...definition,
      fields: definition.fields.map((field) => ({ ...field })),
      setupSteps: [...definition.setupSteps],
    }));
  }

  async resolveInstallConfigPath(input: OpenClawConfigPathInput) {
    const candidates: string[] = [];

    for (const homeRoot of input.homeRoots || []) {
      pushCandidatePath(candidates, joinPath(homeRoot, '.openclaw', 'openclaw.json'));
    }

    pushCandidatePath(candidates, joinPath(input.workRoot, '.openclaw', 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.installRoot, '.openclaw', 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.dataRoot, 'config', 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.dataRoot, 'openclaw.json'));
    pushCandidatePath(candidates, joinPath(input.dataRoot, '.openclaw', 'openclaw.json'));

    for (const candidate of candidates) {
      if (await platform.pathExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  resolveInstanceConfigPath(detail: OpenClawConfigBackedDetail | null | undefined) {
    const configRoute = detail?.dataAccess?.routes?.find(
      (route) => route.scope === 'config' && route.mode === 'managedFile' && route.target,
    );
    if (configRoute?.target) {
      return normalizePath(configRoute.target);
    }

    const configArtifact = detail?.artifacts?.find(
      (artifact) => artifact.kind === 'configFile' && artifact.location,
    );
    if (configArtifact?.location) {
      return normalizePath(configArtifact.location);
    }

    return null;
  }

  async readConfigSnapshot(configPath: string): Promise<OpenClawConfigSnapshot> {
    const root = await readConfigRoot(configPath);
    return {
      configPath: normalizePath(configPath),
      providerSnapshots: buildProviderSnapshots(root),
      channelSnapshots: buildChannelSnapshots(root),
      root,
    };
  }

  async saveProviderSelection(input: {
    configPath: string;
    provider: OpenClawProviderInput;
    selection: OpenClawModelSelection;
  }) {
    const root = await readConfigRoot(input.configPath);
    updateProviderConfig(root, input.provider, input.selection);
    await writeConfigRoot(input.configPath, root);

    const providerKey = buildProviderKey(input.provider.id);
    return buildProviderSnapshots(root).find((provider) => provider.providerKey === providerKey) || null;
  }

  async saveChannelConfiguration(input: SaveOpenClawChannelConfigurationInput) {
    const root = await readConfigRoot(input.configPath);
    updateChannelConfig(root, input);
    await writeConfigRoot(input.configPath, root);

    return buildChannelSnapshots(root).find((channel) => channel.id === input.channelId) || null;
  }

  async setChannelEnabled(input: {
    configPath: string;
    channelId: string;
    enabled: boolean;
  }) {
    const root = await readConfigRoot(input.configPath);
    const channelsRoot = ensureObject(root, 'channels');
    const channelRoot = ensureObject(channelsRoot, input.channelId);
    channelRoot.enabled = input.enabled;
    await writeConfigRoot(input.configPath, root);

    return buildChannelSnapshots(root).find((channel) => channel.id === input.channelId) || null;
  }
}

export const openClawConfigService = new OpenClawConfigService();
