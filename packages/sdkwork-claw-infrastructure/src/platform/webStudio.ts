import type {
  StudioConversationMessage,
  StudioConversationRecord,
  StudioConversationSummary,
  StudioInstanceAuthMode,
  StudioInstanceArtifactRecord,
  StudioInstanceCapability,
  StudioInstanceCapabilitySnapshot,
  StudioInstanceCapabilityStatus,
  StudioInstanceConfig,
  StudioInstanceConnectivityEndpoint,
  StudioInstanceDataAccessEntry,
  StudioInstanceDataAccessSnapshot,
  StudioInstanceDetailRecord,
  StudioInstanceEndpointKind,
  StudioInstanceEndpointStatus,
  StudioInstanceExposure,
  StudioInstanceHealthCheck,
  StudioInstanceHealthSnapshot,
  StudioInstanceHealthStatus,
  StudioInstanceLifecycleOwner,
  StudioInstanceLifecycleSnapshot,
  StudioInstanceObservabilitySnapshot,
  StudioInstanceRecord,
  StudioInstanceStatus,
  StudioInstanceStorageSnapshot,
  StudioInstanceStorageStatus,
  StudioInstanceRuntimeNote,
  StudioStorageBinding,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-types';
import type {
  StudioCreateInstanceInput,
  StudioInstanceTaskMutationPayload,
  StudioPlatformAPI,
  StudioUpdateInstanceInput,
} from './contracts/studio.ts';

const INSTANCE_STORAGE_KEY = 'claw-studio:studio:instances:v1';
const CONVERSATION_STORAGE_KEY = 'claw-studio:studio:conversations:v1';
type StudioMockService = typeof import('../services/index.ts')['studioMockService'];
type StudioMockTask = Awaited<ReturnType<StudioMockService['listTasks']>>[number];

async function getStudioMockService(): Promise<StudioMockService> {
  const module = await import('../services/index.ts');
  return module.getStudioMockService();
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mapSessionTarget(
  sessionTarget: string | undefined,
): Pick<StudioMockTask, 'sessionMode' | 'customSessionId'> {
  if (sessionTarget === 'main') {
    return { sessionMode: 'main' };
  }

  if (sessionTarget === 'current') {
    return { sessionMode: 'current' };
  }

  if (sessionTarget?.startsWith('session:')) {
    const customSessionId = sessionTarget.slice('session:'.length).trim();
    if (customSessionId) {
      return {
        sessionMode: 'custom',
        customSessionId,
      };
    }
  }

  return { sessionMode: 'isolated' };
}

function mapDelivery(
  delivery: Record<string, unknown>,
  sessionMode: StudioMockTask['sessionMode'],
): Pick<StudioMockTask, 'deliveryMode' | 'deliveryBestEffort' | 'deliveryChannel' | 'recipient'> {
  const deliveryMode = asString(delivery.mode);
  const recipient = asString(delivery.to);
  const deliveryBestEffort = asBoolean(delivery.bestEffort) ? true : undefined;

  if (deliveryMode === 'webhook') {
    return {
      deliveryMode: 'webhook',
      deliveryBestEffort,
      deliveryChannel: undefined,
      recipient,
    };
  }

  if (deliveryMode === 'none' || (!deliveryMode && sessionMode === 'main')) {
    return {
      deliveryMode: 'none',
      deliveryBestEffort: undefined,
      deliveryChannel: undefined,
      recipient: undefined,
    };
  }

  return {
    deliveryMode: 'publishSummary',
    deliveryBestEffort,
    deliveryChannel: asString(delivery.channel),
    recipient,
  };
}

function mapOpenClawTaskPayloadToMockTask(
  payload: StudioInstanceTaskMutationPayload,
): Omit<StudioMockTask, 'id' | 'instanceId'> {
  const root = asObject(payload);
  const schedule = asObject(root.schedule);
  const jobPayload = asObject(root.payload);
  const delivery = asObject(root.delivery);
  const scheduleKind = asString(schedule.kind) || 'cron';
  const payloadKind = asString(jobPayload.kind);
  const session = mapSessionTarget(asString(root.sessionTarget));
  const deliveryState = mapDelivery(delivery, session.sessionMode);

  if (scheduleKind === 'every') {
    const everyMs = asNumber(schedule.everyMs) || 30 * 60 * 1000;
    const intervalMinutes = Math.max(1, Math.round(everyMs / (60 * 1000)));
    return {
      name: asString(root.name) || 'Untitled task',
      description: asString(root.description),
      prompt: asString(jobPayload.message) || asString(jobPayload.text) || '',
      schedule: `@every ${intervalMinutes}m`,
      scheduleMode: 'interval',
      scheduleConfig: {
        intervalValue: intervalMinutes,
        intervalUnit: 'minute',
      },
      cronExpression: undefined,
      actionType: payloadKind === 'systemEvent' ? 'message' : 'skill',
      status: asBoolean(root.enabled) === false ? 'paused' : 'active',
      ...session,
      wakeUpMode: asString(root.wakeMode) === 'next-heartbeat' ? 'nextCycle' : 'immediate',
      executionContent: payloadKind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
      timeoutSeconds: asNumber(jobPayload.timeoutSeconds),
      deleteAfterRun: asBoolean(root.deleteAfterRun),
      agentId: asString(root.agentId),
      model: asString(jobPayload.model),
      thinking: asString(jobPayload.thinking) as StudioMockTask['thinking'],
      lightContext: asBoolean(jobPayload.lightContext),
      ...deliveryState,
      lastRun: undefined,
      nextRun: undefined,
    };
  }

  if (scheduleKind === 'at') {
    const at = asString(schedule.at) || '';
    const parsed = at ? new Date(at) : null;
    const year = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getFullYear() : 2026;
    const month = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getMonth() + 1).padStart(2, '0') : '01';
    const day = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getDate()).padStart(2, '0') : '01';
    const hours = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getHours()).padStart(2, '0') : '09';
    const minutes = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getMinutes()).padStart(2, '0') : '00';
    const scheduledDate = `${year}-${month}-${day}`;
    const scheduledTime = `${hours}:${minutes}`;

    return {
      name: asString(root.name) || 'Untitled task',
      description: asString(root.description),
      prompt: asString(jobPayload.message) || asString(jobPayload.text) || '',
      schedule: `at ${scheduledDate} ${scheduledTime}`,
      scheduleMode: 'datetime',
      scheduleConfig: {
        scheduledDate,
        scheduledTime,
      },
      cronExpression: `${Number(minutes)} ${Number(hours)} ${Number(day)} ${Number(month)} *`,
      actionType: payloadKind === 'systemEvent' ? 'message' : 'skill',
      status: asBoolean(root.enabled) === false ? 'paused' : 'active',
      ...session,
      wakeUpMode: asString(root.wakeMode) === 'next-heartbeat' ? 'nextCycle' : 'immediate',
      executionContent: payloadKind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
      timeoutSeconds: asNumber(jobPayload.timeoutSeconds),
      deleteAfterRun: asBoolean(root.deleteAfterRun),
      agentId: asString(root.agentId),
      model: asString(jobPayload.model),
      thinking: asString(jobPayload.thinking) as StudioMockTask['thinking'],
      lightContext: asBoolean(jobPayload.lightContext),
      ...deliveryState,
      lastRun: undefined,
      nextRun: undefined,
    };
  }

  return {
    name: asString(root.name) || 'Untitled task',
    description: asString(root.description),
    prompt: asString(jobPayload.message) || asString(jobPayload.text) || '',
    schedule: asString(schedule.expr) || '* * * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: asString(schedule.expr) || '* * * * *',
      cronTimezone: asString(schedule.tz),
      staggerMs: asNumber(schedule.staggerMs),
    },
    cronExpression: asString(schedule.expr) || '* * * * *',
    actionType: payloadKind === 'systemEvent' ? 'message' : 'skill',
    status: asBoolean(root.enabled) === false ? 'paused' : 'active',
    ...session,
    wakeUpMode: asString(root.wakeMode) === 'next-heartbeat' ? 'nextCycle' : 'immediate',
    executionContent: payloadKind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
    timeoutSeconds: asNumber(jobPayload.timeoutSeconds),
    deleteAfterRun: asBoolean(root.deleteAfterRun),
    agentId: asString(root.agentId),
    model: asString(jobPayload.model),
    thinking: asString(jobPayload.thinking) as StudioMockTask['thinking'],
    lightContext: asBoolean(jobPayload.lightContext),
    ...deliveryState,
    lastRun: undefined,
    nextRun: undefined,
  };
}
const DEFAULT_INSTANCE_ID = 'local-built-in';

interface StudioInstanceRegistryDocument {
  version: 1;
  instances: StudioInstanceRecord[];
}

interface StudioConversationRegistryDocument {
  version: 1;
  conversations: StudioConversationRecord[];
}

function now() {
  return Date.now();
}

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function createDefaultStorageBinding(): StudioStorageBinding {
  return {
    profileId: 'default-local',
    provider: 'localFile',
    namespace: 'claw-studio',
    database: null,
    connectionHint: null,
    endpoint: null,
  };
}

function createDefaultInstanceConfig(
  input?: Partial<StudioInstanceConfig>,
): StudioInstanceConfig {
  return {
    port: input?.port ?? '18789',
    sandbox: input?.sandbox ?? true,
    autoUpdate: input?.autoUpdate ?? true,
    logLevel: input?.logLevel ?? 'info',
    corsOrigins: input?.corsOrigins ?? '*',
    workspacePath: input?.workspacePath ?? null,
    baseUrl: input?.baseUrl ?? 'http://127.0.0.1:18789',
    websocketUrl: input?.websocketUrl ?? 'ws://127.0.0.1:18789',
    authToken: input?.authToken ?? null,
  };
}

function createDefaultBuiltInInstance(): StudioInstanceRecord {
  const createdAt = now();

  return {
    id: DEFAULT_INSTANCE_ID,
    name: 'Local Built-In',
    description: 'Bundled local OpenClaw runtime managed by Claw Studio.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: 'bundled',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18789,
    baseUrl: 'http://127.0.0.1:18789',
    websocketUrl: 'ws://127.0.0.1:18789',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'],
    storage: createDefaultStorageBinding(),
    config: createDefaultInstanceConfig(),
    createdAt,
    updatedAt: createdAt,
    lastSeenAt: createdAt,
  };
}

function readInstances(): StudioInstanceRegistryDocument {
  const storage = getStorage();
  const fallback: StudioInstanceRegistryDocument = {
    version: 1,
    instances: [createDefaultBuiltInInstance()],
  };

  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(INSTANCE_STORAGE_KEY);
  if (!raw) {
    storage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudioInstanceRegistryDocument>;
    const instances = Array.isArray(parsed.instances) ? parsed.instances : [];
    if (!instances.some((instance) => instance.id === DEFAULT_INSTANCE_ID)) {
      instances.unshift(createDefaultBuiltInInstance());
    }

    return {
      version: 1,
      instances,
    };
  } catch {
    storage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function writeInstances(document: StudioInstanceRegistryDocument) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(document));
}

function readConversations(): StudioConversationRegistryDocument {
  const storage = getStorage();
  const fallback: StudioConversationRegistryDocument = {
    version: 1,
    conversations: [],
  };

  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(CONVERSATION_STORAGE_KEY);
  if (!raw) {
    storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudioConversationRegistryDocument>;
    return {
      version: 1,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    };
  } catch {
    storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function writeConversations(document: StudioConversationRegistryDocument) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(document));
}

function createInstanceId() {
  return `instance-${Math.random().toString(36).slice(2, 10)}`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function resolveHealthStatus(instance: StudioInstanceRecord): StudioInstanceHealthStatus {
  if (instance.status === 'offline') {
    return 'offline';
  }
  if (instance.status === 'error') {
    return 'degraded';
  }
  if (instance.status === 'starting' || instance.status === 'syncing') {
    return 'attention';
  }
  return 'healthy';
}

function buildHealthSnapshot(instance: StudioInstanceRecord): StudioInstanceHealthSnapshot {
  const runtimeStatus = resolveHealthStatus(instance);
  const score = clampScore(
    (runtimeStatus === 'healthy' ? 88 : runtimeStatus === 'attention' ? 62 : runtimeStatus === 'offline' ? 30 : 18) -
      instance.cpu * 0.25 -
      instance.memory * 0.22,
  );

  const checks: StudioInstanceHealthCheck[] = [
    {
      id: 'runtime-status',
      label: 'Runtime status',
      status: runtimeStatus,
      detail: `Instance is ${instance.status}.`,
    },
    {
      id: 'transport',
      label: 'Connectivity',
      status: instance.baseUrl || instance.websocketUrl ? 'healthy' : 'attention',
      detail: instance.baseUrl || instance.websocketUrl ? 'Endpoint metadata is configured.' : 'No endpoint metadata configured.',
    },
    {
      id: 'storage',
      label: 'Storage binding',
      status: resolveStorageStatus(instance.storage) === 'ready' ? 'healthy' : 'attention',
      detail: `Storage provider is ${instance.storage.provider}.`,
    },
  ];

  return {
    score,
    status:
      score >= 80 ? 'healthy' : score >= 55 ? 'attention' : runtimeStatus === 'offline' ? 'offline' : 'degraded',
    checks,
    evaluatedAt: now(),
  };
}

function resolveLifecycleOwner(instance: StudioInstanceRecord): StudioInstanceLifecycleOwner {
  if (instance.deploymentMode === 'local-managed') {
    return 'appManaged';
  }
  if (instance.deploymentMode === 'local-external') {
    return 'externalProcess';
  }
  return 'remoteService';
}

function buildLifecycleSnapshot(instance: StudioInstanceRecord): StudioInstanceLifecycleSnapshot {
  const owner = resolveLifecycleOwner(instance);

  return {
    owner,
    startStopSupported: owner === 'appManaged',
    configWritable: owner !== 'remoteService',
    notes:
      owner === 'appManaged'
        ? ['Lifecycle is managed by Claw Studio.']
        : owner === 'externalProcess'
          ? ['Lifecycle is owned by an external local process.']
          : ['Lifecycle is owned by a remote deployment.'],
  };
}

function resolveStorageStatus(storage: StudioStorageBinding): StudioInstanceStorageStatus {
  switch (storage.provider) {
    case 'memory':
    case 'localFile':
      return 'ready';
    case 'sqlite':
      return storage.namespace ? 'ready' : 'configurationRequired';
    case 'postgres':
      return storage.connectionHint ? 'ready' : 'configurationRequired';
    case 'remoteApi':
      return storage.endpoint ? 'planned' : 'configurationRequired';
    default:
      return 'unavailable';
  }
}

function buildStorageSnapshot(instance: StudioInstanceRecord): StudioInstanceStorageSnapshot {
  const status = resolveStorageStatus(instance.storage);

  return {
    status,
    profileId: instance.storage.profileId ?? null,
    provider: instance.storage.provider,
    namespace: instance.storage.namespace,
    database: instance.storage.database ?? null,
    connectionHint: instance.storage.connectionHint ?? null,
    endpoint: instance.storage.endpoint ?? null,
    durable: instance.storage.provider !== 'memory',
    queryable: instance.storage.provider === 'sqlite' || instance.storage.provider === 'postgres' || instance.storage.provider === 'remoteApi',
    transactional: instance.storage.provider === 'sqlite' || instance.storage.provider === 'postgres',
    remote: instance.storage.provider === 'postgres' || instance.storage.provider === 'remoteApi',
  };
}

function inferExposure(instance: StudioInstanceRecord): StudioInstanceExposure {
  return instance.deploymentMode === 'remote' ? 'remote' : instance.host === '127.0.0.1' ? 'loopback' : 'private';
}

function inferAuthMode(instance: StudioInstanceRecord): StudioInstanceAuthMode {
  if (instance.config.authToken) {
    return 'token';
  }
  if (instance.deploymentMode === 'remote') {
    return 'external';
  }
  return 'unknown';
}

function buildEndpoint(
  instance: StudioInstanceRecord,
  id: string,
  label: string,
  kind: StudioInstanceEndpointKind,
  url: string | null | undefined,
  source: 'config' | 'derived' | 'runtime',
): StudioInstanceConnectivityEndpoint {
  return {
    id,
    label,
    kind,
    status: url ? 'ready' : 'configurationRequired',
    url: url ?? null,
    exposure: inferExposure(instance),
    auth: inferAuthMode(instance),
    source,
  };
}

function buildConnectivityEndpoints(instance: StudioInstanceRecord): StudioInstanceConnectivityEndpoint[] {
  const endpoints: StudioInstanceConnectivityEndpoint[] = [];

  if (instance.baseUrl) {
    endpoints.push(buildEndpoint(instance, 'gateway-http', 'HTTP endpoint', 'http', instance.baseUrl, 'config'));
  }
  if (instance.websocketUrl) {
    endpoints.push(buildEndpoint(instance, 'gateway-ws', 'Gateway WebSocket', 'websocket', instance.websocketUrl, 'config'));
  }
  if (instance.runtimeKind === 'openclaw' && instance.baseUrl) {
    endpoints.push(
      buildEndpoint(
        instance,
        'openai-http-chat',
        'OpenAI Chat Completions',
        'openaiChatCompletions',
        `${instance.baseUrl.replace(/\/$/, '')}/v1/chat/completions`,
        'derived',
      ),
    );
  }
  if (instance.runtimeKind === 'zeroclaw' && instance.baseUrl) {
    endpoints.push(buildEndpoint(instance, 'dashboard', 'Gateway Dashboard', 'dashboard', instance.baseUrl, 'derived'));
  }
  if (instance.runtimeKind === 'ironclaw' && instance.baseUrl) {
    endpoints.push(buildEndpoint(instance, 'gateway-sse', 'Realtime Gateway', 'sse', instance.baseUrl, 'derived'));
  }

  return endpoints;
}

function buildCapabilities(instance: StudioInstanceRecord): StudioInstanceCapabilitySnapshot[] {
  const allCapabilities: StudioInstanceCapability[] = ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'];
  const supported = new Set(instance.capabilities);
  const storageStatus = resolveStorageStatus(instance.storage);

  return allCapabilities.map((capability) => {
    let status: StudioInstanceCapabilityStatus = supported.has(capability) ? 'ready' : 'unsupported';
    let detail = supported.has(capability)
      ? 'Advertised by the instance record.'
      : 'This runtime is not currently modeled as supporting this capability.';

    if (supported.has(capability) && (capability === 'memory' || capability === 'tasks') && storageStatus !== 'ready') {
      status = 'configurationRequired';
      detail = 'Capability depends on a configured durable storage binding.';
    } else if (supported.has(capability) && instance.deploymentMode !== 'local-managed' && (capability === 'files' || capability === 'tools')) {
      status = 'planned';
      detail = 'Runtime may support this, but Claw Studio has not integrated this external detail surface yet.';
    }

    return {
      id: capability,
      status,
      detail,
      source: capability === 'memory' || capability === 'tasks' ? 'storage' : 'runtime',
    };
  });
}

function buildObservabilitySnapshot(
  instance: StudioInstanceRecord,
  logs: string,
): StudioInstanceObservabilitySnapshot {
  const lines = logs
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    status: lines.length > 0 ? 'ready' : 'limited',
    logAvailable: lines.length > 0,
    logFilePath: null,
    logPreview: lines.slice(-5),
    lastSeenAt: instance.lastSeenAt ?? null,
    metricsSource: 'derived',
  };
}

function createDataAccessEntry(
  entry: StudioInstanceDataAccessEntry,
): StudioInstanceDataAccessEntry {
  return entry;
}

function getStorageTarget(snapshot: StudioInstanceStorageSnapshot) {
  return snapshot.endpoint ?? snapshot.database ?? snapshot.namespace;
}

function buildDataAccessSnapshot(
  instance: StudioInstanceRecord,
  storage: StudioInstanceStorageSnapshot,
  observability: StudioInstanceObservabilitySnapshot,
): StudioInstanceDataAccessSnapshot {
  const routes: StudioInstanceDataAccessEntry[] = [
    createDataAccessEntry({
      id: 'config',
      label: 'Configuration',
      scope: 'config',
      mode: instance.deploymentMode === 'local-managed' ? 'metadataOnly' : 'metadataOnly',
      status: 'ready',
      target: INSTANCE_STORAGE_KEY,
      readonly: false,
      authoritative: false,
      detail:
        'Web fallback projects instance configuration from Claw Studio metadata instead of direct runtime-owned files.',
      source: 'integration',
    }),
    createDataAccessEntry({
      id: 'logs',
      label: 'Logs',
      scope: 'logs',
      mode: 'metadataOnly',
      status: observability.logAvailable ? 'limited' : 'planned',
      target: null,
      readonly: true,
      authoritative: false,
      detail: observability.logAvailable
        ? 'Web fallback shows derived log preview lines only.'
        : 'No direct log transport is available in the web fallback.',
      source: 'derived',
    }),
  ];

  if (instance.config.workspacePath) {
    routes.push(
      createDataAccessEntry({
        id: 'files',
        label: 'Workspace',
        scope: 'files',
        mode: 'managedDirectory',
        status: 'limited',
        target: instance.config.workspacePath,
        readonly: false,
        authoritative: false,
        detail:
          'A workspace path is configured, but the web fallback does not directly mount runtime files.',
        source: 'config',
      }),
    );
  } else {
    routes.push(
      createDataAccessEntry({
        id: 'files',
        label: 'Workspace',
        scope: 'files',
        mode: 'metadataOnly',
        status: 'planned',
        target: null,
        readonly: false,
        authoritative: false,
        detail:
          'Runtime file access requires a desktop-backed adapter or explicit workspace metadata.',
        source: 'integration',
      }),
    );
  }

  const storageStatus =
    storage.status === 'ready'
      ? 'ready'
      : storage.status === 'configurationRequired'
        ? 'configurationRequired'
        : storage.status === 'planned'
          ? 'planned'
          : 'unavailable';

  routes.push(
    createDataAccessEntry({
      id: 'memory',
      label: 'Memory',
      scope: 'memory',
      mode: 'storageBinding',
      status: storageStatus,
      target: getStorageTarget(storage),
      readonly: false,
      authoritative: storage.status === 'ready',
      detail:
        'Memory detail is described through the configured storage binding in the web fallback.',
      source: 'storage',
    }),
    createDataAccessEntry({
      id: 'tasks',
      label: 'Tasks',
      scope: 'tasks',
      mode: instance.baseUrl ? 'remoteEndpoint' : 'metadataOnly',
      status: instance.baseUrl ? 'planned' : 'configurationRequired',
      target: instance.baseUrl ?? null,
      readonly: false,
      authoritative: false,
      detail:
        'Task operations depend on runtime-specific adapters and are not directly mounted in the web fallback.',
      source: 'integration',
    }),
    createDataAccessEntry({
      id: 'tools',
      label: 'Tools',
      scope: 'tools',
      mode: instance.baseUrl ? 'remoteEndpoint' : 'metadataOnly',
      status: instance.baseUrl ? 'planned' : 'configurationRequired',
      target: instance.baseUrl ?? null,
      readonly: true,
      authoritative: false,
      detail:
        'Tool detail is currently limited to endpoint and metadata posture in the web fallback.',
      source: 'integration',
    }),
    createDataAccessEntry({
      id: 'models',
      label: 'Models',
      scope: 'models',
      mode: instance.baseUrl ? 'remoteEndpoint' : 'metadataOnly',
      status: instance.baseUrl ? 'planned' : 'configurationRequired',
      target: instance.baseUrl ?? null,
      readonly: false,
      authoritative: false,
      detail:
        'Provider and model surfaces require runtime-specific adapters beyond the web fallback.',
      source: 'integration',
    }),
  );

  return { routes };
}

function buildArtifacts(
  instance: StudioInstanceRecord,
  storage: StudioInstanceStorageSnapshot,
  observability: StudioInstanceObservabilitySnapshot,
): StudioInstanceArtifactRecord[] {
  const artifacts: StudioInstanceArtifactRecord[] = [];

  if (instance.baseUrl) {
    artifacts.push({
      id: 'gateway-endpoint',
      label: 'Gateway Endpoint',
      kind: 'endpoint',
      status: instance.deploymentMode === 'remote' ? 'remote' : 'configured',
      location: instance.baseUrl,
      readonly: true,
      detail: 'Primary runtime HTTP endpoint configured for this instance.',
      source: 'config',
    });
  }

  if (instance.runtimeKind === 'zeroclaw' && instance.baseUrl) {
    artifacts.push({
      id: 'dashboard-endpoint',
      label: 'Dashboard',
      kind: 'dashboard',
      status: 'remote',
      location: instance.baseUrl,
      readonly: true,
      detail: 'ZeroClaw dashboard surface derived from the configured gateway URL.',
      source: 'derived',
    });
  }

  if (instance.config.workspacePath) {
    artifacts.push({
      id: 'workspace',
      label: 'Workspace Directory',
      kind: 'workspaceDirectory',
      status: 'configured',
      location: instance.config.workspacePath,
      readonly: false,
      detail: 'Workspace path configured for this instance.',
      source: 'config',
    });
  }

  if (observability.logFilePath) {
    artifacts.push({
      id: 'log-file',
      label: 'Log File',
      kind: 'logFile',
      status: 'configured',
      location: observability.logFilePath,
      readonly: true,
      detail: 'Configured log file path projected by the runtime detail snapshot.',
      source: 'derived',
    });
  }

  artifacts.push({
    id: 'storage-binding',
    label: 'Storage Binding',
    kind: 'storageBinding',
    status:
      storage.status === 'ready'
        ? 'configured'
        : storage.status === 'configurationRequired'
          ? 'missing'
          : storage.status === 'planned'
            ? 'planned'
            : 'missing',
    location: getStorageTarget(storage),
    readonly: false,
    detail: 'Storage profile, namespace, and database binding used by this instance.',
    source: 'storage',
  });

  return artifacts;
}

function buildOfficialRuntimeNotes(instance: StudioInstanceRecord): StudioInstanceRuntimeNote[] {
  if (instance.runtimeKind === 'openclaw') {
    return [
      {
        title: 'Gateway-first transport',
        content: 'OpenClaw centers its runtime around the Gateway WebSocket and can also expose an OpenAI-compatible HTTP chat endpoint on the same gateway port.',
        sourceUrl: 'https://docs.openclaw.ai/gateway/openai-http-api',
      },
    ];
  }
  if (instance.runtimeKind === 'zeroclaw') {
    return [
      {
        title: 'Gateway and dashboard',
        content: 'ZeroClaw ships as a single Rust binary and exposes a gateway/dashboard surface that can be run locally or remotely.',
        sourceUrl: 'https://github.com/zeroclaw-labs/zeroclaw',
      },
    ];
  }
  if (instance.runtimeKind === 'ironclaw') {
    return [
      {
        title: 'Database-first runtime',
        content: 'IronClaw expects PostgreSQL plus pgvector and emphasizes persistent storage, routines, and realtime gateway streaming.',
        sourceUrl: 'https://github.com/nearai/ironclaw',
      },
    ];
  }

  return [
    {
      title: 'Custom runtime',
      content: 'This instance uses a custom runtime binding. Connectivity and capability surfaces depend on the configured metadata.',
    },
  ];
}

function buildInstanceDetailRecord(
  instance: StudioInstanceRecord,
  logs: string,
): StudioInstanceDetailRecord {
  const storage = buildStorageSnapshot(instance);
  const observability = buildObservabilitySnapshot(instance, logs);

  return {
    instance,
    config: instance.config,
    logs,
    health: buildHealthSnapshot(instance),
    lifecycle: buildLifecycleSnapshot(instance),
    storage,
    connectivity: {
      primaryTransport: instance.transportKind,
      endpoints: buildConnectivityEndpoints(instance),
    },
    observability,
    dataAccess: buildDataAccessSnapshot(instance, storage, observability),
    artifacts: buildArtifacts(instance, storage, observability),
    capabilities: buildCapabilities(instance),
    officialRuntimeNotes: buildOfficialRuntimeNotes(instance),
  };
}

function summarizeConversation(
  conversation: StudioConversationRecord,
): StudioConversationSummary {
  const lastMessage = conversation.messages[conversation.messages.length - 1];

  return {
    id: conversation.id,
    title: conversation.title,
    primaryInstanceId: conversation.primaryInstanceId,
    participantInstanceIds: [...conversation.participantInstanceIds],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    lastMessagePreview: lastMessage?.content?.slice(0, 120) || '',
  };
}

function normalizeConversationMessages(
  conversation: StudioConversationRecord,
): StudioConversationMessage[] {
  return (conversation.messages || []).map((message) => ({
    ...message,
    conversationId: conversation.id,
    updatedAt: message.updatedAt ?? message.createdAt,
    status: message.status ?? 'complete',
  }));
}

function withConversationDerivedFields(
  conversation: StudioConversationRecord,
): StudioConversationRecord {
  const messages = normalizeConversationMessages(conversation);
  const summary = summarizeConversation({
    ...conversation,
    messages,
  });

  return {
    ...conversation,
    ...summary,
    messages,
  };
}

function buildInstanceRecord(input: StudioCreateInstanceInput): StudioInstanceRecord {
  const createdAt = now();
  const baseUrl = input.baseUrl ?? input.config?.baseUrl ?? null;
  const websocketUrl = input.websocketUrl ?? input.config?.websocketUrl ?? null;
  const port =
    input.port ??
    (input.config?.port ? Number.parseInt(input.config.port, 10) : null) ??
    null;
  const config = createDefaultInstanceConfig({
    ...input.config,
    baseUrl,
    websocketUrl,
    port: port != null ? String(port) : input.config?.port,
  });

  return {
    id: createInstanceId(),
    name: input.name,
    description: input.description,
    runtimeKind: input.runtimeKind,
    deploymentMode: input.deploymentMode,
    transportKind: input.transportKind,
    status: 'offline',
    isBuiltIn: false,
    isDefault: false,
    iconType: input.iconType ?? 'server',
    version: input.version ?? 'custom',
    typeLabel: input.typeLabel ?? `${input.runtimeKind} (${input.deploymentMode})`,
    host: input.host ?? '127.0.0.1',
    port,
    baseUrl,
    websocketUrl,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      ...createDefaultStorageBinding(),
      ...(input.storage || {}),
      provider: input.storage?.provider ?? 'localFile',
      namespace: input.storage?.namespace ?? 'claw-studio',
    },
    config,
    createdAt,
    updatedAt: createdAt,
    lastSeenAt: null,
  };
}

export class WebStudioPlatform implements StudioPlatformAPI {
  async listInstances(): Promise<StudioInstanceRecord[]> {
    return readInstances().instances;
  }

  async getInstance(id: string): Promise<StudioInstanceRecord | null> {
    return readInstances().instances.find((instance) => instance.id === id) ?? null;
  }

  async getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null> {
    const instance = await this.getInstance(id);
    if (!instance) {
      return null;
    }

    const logs = await this.getInstanceLogs(id);
    return buildInstanceDetailRecord(instance, logs);
  }

  async createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord> {
    const document = readInstances();
    const instance = buildInstanceRecord(input);
    document.instances.push(instance);
    writeInstances(document);
    return instance;
  }

  async updateInstance(
    id: string,
    input: StudioUpdateInstanceInput,
  ): Promise<StudioInstanceRecord> {
    const document = readInstances();
    const current = document.instances.find((instance) => instance.id === id);
    if (!current) {
      throw new Error(`Instance "${id}" not found`);
    }

    if (input.isDefault) {
      document.instances = document.instances.map((instance) => ({
        ...instance,
        isDefault: instance.id === id,
      }));
    }

    const nextPort =
      input.port ??
      (input.config?.port ? Number.parseInt(input.config.port, 10) : current.port) ??
      null;
    const updated: StudioInstanceRecord = {
      ...current,
      ...input,
      port: nextPort,
      storage: {
        ...current.storage,
        ...(input.storage || {}),
        provider: input.storage?.provider ?? current.storage.provider,
        namespace: input.storage?.namespace ?? current.storage.namespace,
      },
      config: createDefaultInstanceConfig({
        ...current.config,
        ...(input.config || {}),
        port: nextPort != null ? String(nextPort) : current.config.port,
      }),
      updatedAt: now(),
    };

    document.instances = document.instances.map((instance) =>
      instance.id === id ? updated : instance,
    );
    writeInstances(document);
    return updated;
  }

  async deleteInstance(id: string): Promise<boolean> {
    const document = readInstances();
    const target = document.instances.find((instance) => instance.id === id);
    if (!target) {
      return false;
    }

    if (target.isBuiltIn) {
      throw new Error('The built-in instance cannot be deleted');
    }

    document.instances = document.instances.filter((instance) => instance.id !== id);
    if (!document.instances.some((instance) => instance.isDefault)) {
      document.instances = document.instances.map((instance, index) => ({
        ...instance,
        isDefault: index === 0,
      }));
    }
    writeInstances(document);

    const conversations = readConversations();
    conversations.conversations = conversations.conversations.filter(
      (conversation) =>
        conversation.primaryInstanceId !== id &&
        !conversation.participantInstanceIds.includes(id),
    );
    writeConversations(conversations);
    return true;
  }

  async startInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.setInstanceStatus(id, 'online');
  }

  async stopInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.setInstanceStatus(id, 'offline');
  }

  async restartInstance(id: string): Promise<StudioInstanceRecord | null> {
    const stopped = await this.stopInstance(id);
    if (!stopped) {
      return null;
    }

    return this.startInstance(id);
  }

  async setInstanceStatus(
    id: string,
    status: StudioInstanceStatus,
  ): Promise<StudioInstanceRecord | null> {
    const current = await this.getInstance(id);
    if (!current) {
      return null;
    }

    return this.updateInstance(id, { status });
  }

  async getInstanceConfig(id: string): Promise<StudioInstanceConfig | null> {
    return (await this.getInstance(id))?.config ?? null;
  }

  async updateInstanceConfig(
    id: string,
    config: StudioInstanceConfig,
  ): Promise<StudioInstanceConfig | null> {
    const updated = await this.updateInstance(id, {
      config,
      port: Number.parseInt(config.port, 10),
      baseUrl: config.baseUrl ?? null,
      websocketUrl: config.websocketUrl ?? null,
    });
    return updated.config;
  }

  async getInstanceLogs(id: string): Promise<string> {
    const instance = await this.getInstance(id);
    if (!instance) {
      return '';
    }

    return [
      `[${new Date(instance.updatedAt).toISOString()}] instance=${instance.id} status=${instance.status}`,
      `[${new Date().toISOString()}] transport=${instance.transportKind} baseUrl=${instance.baseUrl || '-'}`,
    ].join('\n');
  }

  async createInstanceTask(
    instanceId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void> {
    const studioMockService = await getStudioMockService();
    await studioMockService.createTask(instanceId, mapOpenClawTaskPayloadToMockTask(payload));
  }

  async updateInstanceTask(
    _instanceId: string,
    taskId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void> {
    const studioMockService = await getStudioMockService();
    const updated = await studioMockService.updateTask(taskId, mapOpenClawTaskPayloadToMockTask(payload));
    if (!updated) {
      throw new Error(`Task "${taskId}" not found`);
    }
  }

  async cloneInstanceTask(
    _instanceId: string,
    taskId: string,
    name?: string,
  ): Promise<void> {
    const studioMockService = await getStudioMockService();
    const cloned = await studioMockService.cloneTask(taskId, name ? { name } : {});
    if (!cloned) {
      throw new Error(`Task "${taskId}" not found`);
    }
  }

  async runInstanceTaskNow(
    _instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord> {
    const studioMockService = await getStudioMockService();
    const execution = await studioMockService.runTaskNow(taskId);
    if (!execution) {
      throw new Error(`Task "${taskId}" not found`);
    }
    return execution;
  }

  async listInstanceTaskExecutions(
    _instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord[]> {
    const studioMockService = await getStudioMockService();
    return studioMockService.listTaskExecutions(taskId);
  }

  async updateInstanceTaskStatus(
    _instanceId: string,
    taskId: string,
    status: 'active' | 'paused',
  ): Promise<void> {
    const studioMockService = await getStudioMockService();
    const updated = await studioMockService.updateTaskStatus(taskId, status);
    if (!updated) {
      throw new Error(`Task "${taskId}" not found`);
    }
  }

  async deleteInstanceTask(_instanceId: string, taskId: string): Promise<boolean> {
    const studioMockService = await getStudioMockService();
    return studioMockService.deleteTask(taskId);
  }

  async listConversations(instanceId: string): Promise<StudioConversationRecord[]> {
    return readConversations()
      .conversations
      .filter((conversation) => conversation.primaryInstanceId === instanceId)
      .map(withConversationDerivedFields)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async putConversation(
    record: StudioConversationRecord,
  ): Promise<StudioConversationRecord> {
    const document = readConversations();
    const normalized = withConversationDerivedFields(record);
    const existingIndex = document.conversations.findIndex(
      (conversation) => conversation.id === normalized.id,
    );

    if (existingIndex >= 0) {
      document.conversations[existingIndex] = normalized;
    } else {
      document.conversations.unshift(normalized);
    }

    writeConversations(document);
    return normalized;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const document = readConversations();
    const next = document.conversations.filter((conversation) => conversation.id !== id);
    const existed = next.length !== document.conversations.length;
    if (!existed) {
      return false;
    }

    document.conversations = next;
    writeConversations(document);
    return true;
  }
}
