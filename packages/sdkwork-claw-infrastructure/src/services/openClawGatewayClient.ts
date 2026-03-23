import type {
  StudioInstanceDetailRecord,
  StudioWorkbenchTaskExecutionRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/claw-types';
import { studio } from '../platform/index.ts';

export interface OpenClawInvokeRequest<TArgs extends object = object> {
  tool: string;
  action?: string;
  args?: TArgs;
  sessionKey?: string;
  dryRun?: boolean;
}

export interface OpenClawGatewayRequestOptions {
  messageChannel?: string;
  accountId?: string;
  headers?: Record<string, string>;
}

export interface OpenClawInvokeSuccess<TResult> {
  ok: true;
  result: TResult;
}

export interface OpenClawInvokeFailure {
  ok: false;
  error?: {
    type?: string;
    message?: string;
  };
}

export type OpenClawGatewayValidationStatus =
  | 'ok'
  | 'missing_endpoint'
  | 'missing_auth'
  | 'unauthorized'
  | 'rate_limited'
  | 'unreachable'
  | 'tool_denied'
  | 'invalid_response'
  | 'unsupported_runtime';

export interface OpenClawGatewayValidationResult {
  status: OpenClawGatewayValidationStatus;
  message: string;
  endpoint?: string | null;
  httpStatus?: number;
}

export interface OpenClawGatewayAccessDescriptor {
  instanceId: string;
  runtimeKind: string;
  endpoint: string | null;
  token: string | null;
  detail: StudioInstanceDetailRecord | null;
}

export interface OpenClawGatewayHttpRequestInfo {
  instanceId: string;
  runtimeKind: string;
  endpoint: string | null;
  url: string | null;
  headers: Record<string, string>;
  request: OpenClawInvokeRequest<object>;
  validation: OpenClawGatewayValidationResult;
}

export interface OpenClawSessionStatusArgs {
  sessionKey?: string;
  model?: string;
}

export interface OpenClawSessionStatusResult {
  sessionKey?: string;
  model?: string;
  [key: string]: unknown;
}

export interface OpenClawSessionsListArgs {
  kinds?: string[];
  limit?: number;
  activeMinutes?: number;
  messageLimit?: number;
}

export interface OpenClawSessionsListResult {
  sessions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OpenClawSessionHistoryArgs {
  sessionKey: string;
  limit?: number;
  includeTools?: boolean;
}

export interface OpenClawSessionHistoryResult {
  sessionKey?: string;
  messages?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OpenClawGatewaySessionResolveResult {
  ok?: boolean;
  key?: string;
  [key: string]: unknown;
}

export interface OpenClawGatewaySessionGetArgs {
  key?: string;
  sessionKey?: string;
  limit?: number;
  [key: string]: unknown;
}

export interface OpenClawGatewaySessionGetResult {
  messages?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OpenClawGatewaySessionUsageResult {
  [key: string]: unknown;
}

export interface OpenClawGatewaySessionUsageLogsResult {
  logs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OpenClawWebLoginArgs {
  accountId?: string;
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface OpenClawWebLoginStartArgs extends OpenClawWebLoginArgs {
  force?: boolean;
  verbose?: boolean;
}

export interface OpenClawChatInjectArgs {
  sessionKey: string;
  message: string;
  label?: string;
  [key: string]: unknown;
}

export interface OpenClawChatInjectResult {
  ok?: boolean;
  messageId?: string;
  [key: string]: unknown;
}

export interface OpenClawSessionSendArgs {
  sessionKey?: string;
  label?: string;
  agentId?: string;
  message: string;
  timeoutSeconds?: number;
}

export interface OpenClawSessionSendResult {
  ok?: boolean;
  enqueued?: boolean;
  [key: string]: unknown;
}

export interface OpenClawSessionSpawnArgs {
  task: string;
  label?: string;
  runtime?: string;
  agentId?: string;
  resumeSessionId?: string;
  model?: string;
  thinking?: string;
  cwd?: string;
  runTimeoutSeconds?: number;
  timeoutSeconds?: number;
  thread?: boolean;
  mode?: string;
}

export interface OpenClawSessionSpawnResult {
  ok?: boolean;
  sessionKey?: string;
  [key: string]: unknown;
}

export interface OpenClawSubagentsArgs {
  recentMinutes?: number;
  target?: string;
  message?: string;
}

export interface OpenClawSubagentsResult {
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OpenClawAgentsListResult {
  requester?: string;
  agents?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface OpenClawMemorySearchArgs {
  query: string;
  maxResults?: number;
  minScore?: number;
}

export interface OpenClawMemorySearchResult {
  results?: Array<Record<string, unknown>>;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface OpenClawMemoryGetArgs {
  path: string;
  from?: number;
  lines?: number;
}

export interface OpenClawMemoryGetResult {
  path?: string;
  lines?: unknown;
  [key: string]: unknown;
}

export interface OpenClawModelRecord {
  id?: string;
  provider?: string;
  model?: string;
  label?: string;
  title?: string;
  [key: string]: unknown;
}

export interface OpenClawConfigSnapshot {
  path?: string;
  baseHash?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OpenClawConfigOpenFileResult {
  ok?: boolean;
  path?: string;
  error?: string;
  [key: string]: unknown;
}

export interface OpenClawConfigSchemaLookupArgs {
  path: string;
}

export interface OpenClawConfigMutationArgs {
  raw: string;
  baseHash?: string;
  sessionKey?: string;
  note?: string;
  restartDelayMs?: number;
  deliveryContext?: Record<string, unknown>;
  threadId?: string;
}

export interface OpenClawConfigMutationResult {
  ok?: boolean;
  path?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OpenClawChannelStatusArgs {
  probe?: boolean;
  timeoutMs?: number;
}

export interface OpenClawChannelStatusResult {
  channelOrder?: string[];
  channels?: Record<string, unknown>;
  channelAccounts?: Record<string, unknown>;
  channelLabels?: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelMeta?: unknown;
  [key: string]: unknown;
}

export interface OpenClawLogTailArgs {
  cursor?: number;
  limit?: number;
  maxBytes?: number;
}

export interface OpenClawLogTailResult {
  file?: string;
  cursor?: number;
  content?: string;
  [key: string]: unknown;
}

export interface OpenClawSkillStatusEntry {
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  version?: string;
  size?: string;
  updatedAt?: string;
  readme?: string;
  source?: string;
  bundled?: boolean;
  filePath?: string;
  baseDir?: string;
  skillKey?: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always?: boolean;
  disabled?: boolean;
  blockedByAllowlist?: boolean;
  eligible?: boolean;
  requirements?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    [key: string]: unknown;
  };
  missing?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    [key: string]: unknown;
  };
  configChecks?: Array<Record<string, unknown>>;
  install?: Array<{
    id?: string;
    kind?: string;
    label?: string;
    bins?: string[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface OpenClawSkillsStatusResult {
  agentId?: string;
  workspace?: string;
  skills?: OpenClawSkillStatusEntry[];
  entries?: OpenClawSkillStatusEntry[];
  [key: string]: unknown;
}

export interface OpenClawToolsCatalogArgs {
  agentId?: string;
  includePlugins?: boolean;
}

export interface OpenClawToolCatalogProfile {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface OpenClawToolCatalogEntry {
  id: string;
  label: string;
  description?: string;
  source?: string;
  pluginId?: string;
  optional?: boolean;
  defaultProfiles?: string[];
  [key: string]: unknown;
}

export interface OpenClawToolCatalogGroup {
  id: string;
  label: string;
  source?: string;
  pluginId?: string;
  tools: OpenClawToolCatalogEntry[];
  [key: string]: unknown;
}

export interface OpenClawToolsCatalogResult {
  agentId?: string;
  profiles: OpenClawToolCatalogProfile[];
  groups: OpenClawToolCatalogGroup[];
  [key: string]: unknown;
}

export interface OpenClawAgentFilesListArgs {
  agentId: string;
}

export interface OpenClawAgentFileRequest {
  agentId: string;
  name: string;
}

export interface OpenClawAgentFileEntry {
  name: string;
  path?: string;
  missing?: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
  [key: string]: unknown;
}

export interface OpenClawAgentFilesListResult {
  agentId?: string;
  workspace?: string;
  files: OpenClawAgentFileEntry[];
  [key: string]: unknown;
}

export interface OpenClawAgentFileResult {
  agentId?: string;
  workspace?: string;
  file?: OpenClawAgentFileEntry;
  ok?: boolean;
  [key: string]: unknown;
}

export type OpenClawGatewayMethodArgs = Record<string, unknown>;
export type OpenClawGatewayMethodResult = Record<string, unknown>;

export const OPENCLAW_GATEWAY_OFFICIAL_METHODS = [
  'health',
  'doctor.memory.status',
  'logs.tail',
  'channels.status',
  'channels.logout',
  'status',
  'usage.status',
  'usage.cost',
  'tts.status',
  'tts.providers',
  'tts.enable',
  'tts.disable',
  'tts.convert',
  'tts.setProvider',
  'config.get',
  'config.openFile',
  'config.set',
  'config.apply',
  'config.patch',
  'config.schema',
  'config.schema.lookup',
  'exec.approvals.get',
  'exec.approvals.set',
  'exec.approvals.node.get',
  'exec.approvals.node.set',
  'exec.approval.request',
  'exec.approval.waitDecision',
  'exec.approval.resolve',
  'wizard.start',
  'wizard.next',
  'wizard.cancel',
  'wizard.status',
  'talk.config',
  'talk.mode',
  'models.list',
  'tools.catalog',
  'agents.list',
  'agents.create',
  'agents.update',
  'agents.delete',
  'agents.files.list',
  'agents.files.get',
  'agents.files.set',
  'skills.status',
  'skills.bins',
  'skills.install',
  'skills.update',
  'update.run',
  'voicewake.get',
  'voicewake.set',
  'secrets.reload',
  'secrets.resolve',
  'sessions.list',
  'sessions.preview',
  'sessions.resolve',
  'sessions.patch',
  'sessions.reset',
  'sessions.delete',
  'sessions.get',
  'sessions.compact',
  'sessions.usage',
  'sessions.usage.timeseries',
  'sessions.usage.logs',
  'last-heartbeat',
  'set-heartbeats',
  'wake',
  'node.pair.request',
  'node.pair.list',
  'node.pair.approve',
  'node.pair.reject',
  'node.pair.verify',
  'device.pair.list',
  'device.pair.approve',
  'device.pair.reject',
  'device.pair.remove',
  'device.token.rotate',
  'device.token.revoke',
  'node.rename',
  'node.list',
  'node.describe',
  'node.pending.drain',
  'node.pending.enqueue',
  'node.invoke',
  'node.pending.pull',
  'node.pending.ack',
  'node.invoke.result',
  'node.event',
  'node.canvas.capability.refresh',
  'cron.list',
  'cron.status',
  'cron.add',
  'cron.update',
  'cron.remove',
  'cron.run',
  'cron.runs',
  'gateway.identity.get',
  'system-presence',
  'system-event',
  'send',
  'agent',
  'agent.identity.get',
  'agent.wait',
  'browser.request',
  'chat.history',
  'chat.abort',
  'chat.send',
  'chat.inject',
  'push.test',
  'web.login.start',
  'web.login.wait',
] as const;

export type OpenClawGatewayOfficialMethod =
  typeof OPENCLAW_GATEWAY_OFFICIAL_METHODS[number];

interface OpenClawGatewayMethodDescriptor {
  tool: string;
  action?: string;
}

const OPENCLAW_GATEWAY_METHOD_OVERRIDES: Partial<
  Record<OpenClawGatewayOfficialMethod, OpenClawGatewayMethodDescriptor>
> = {
  'config.schema': {
    tool: 'config',
    action: 'schema',
  },
  'config.schema.lookup': {
    tool: 'config',
    action: 'schema.lookup',
  },
  'sessions.usage.timeseries': {
    tool: 'sessions',
    action: 'usage.timeseries',
  },
  'sessions.usage.logs': {
    tool: 'sessions',
    action: 'usage.logs',
  },
  'web.login.start': {
    tool: 'web',
    action: 'login.start',
  },
  'web.login.wait': {
    tool: 'web',
    action: 'login.wait',
  },
};

function resolveOfficialGatewayMethodDescriptor(
  method: OpenClawGatewayOfficialMethod,
): OpenClawGatewayMethodDescriptor {
  const override = OPENCLAW_GATEWAY_METHOD_OVERRIDES[method];
  if (override) {
    return override;
  }

  const separatorIndex = method.lastIndexOf('.');
  if (separatorIndex <= 0) {
    return {
      tool: method,
    };
  }

  return {
    tool: method.slice(0, separatorIndex),
    action: method.slice(separatorIndex + 1),
  };
}

export interface OpenClawCronScheduleAt {
  kind: 'at';
  at: string;
}

export interface OpenClawCronScheduleEvery {
  kind: 'every';
  everyMs: number;
  anchorMs?: number;
}

export interface OpenClawCronScheduleCron {
  kind: 'cron';
  expr: string;
  tz?: string;
  staggerMs?: number;
}

export type OpenClawCronSchedule =
  | OpenClawCronScheduleAt
  | OpenClawCronScheduleEvery
  | OpenClawCronScheduleCron;

export interface OpenClawCronAgentTurnPayload {
  kind: 'agentTurn';
  message: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
  lightContext?: boolean;
}

export interface OpenClawCronSystemEventPayload {
  kind: 'systemEvent';
  text: string;
}

export type OpenClawCronPayload =
  | OpenClawCronAgentTurnPayload
  | OpenClawCronSystemEventPayload;

export interface OpenClawCronDelivery {
  mode: 'none' | 'announce' | 'webhook';
  channel?: string;
  to?: string;
  bestEffort?: boolean;
}

export interface OpenClawCronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: 'ok' | 'error' | 'skipped';
  lastStatus?: 'ok' | 'error' | 'skipped';
  lastError?: string;
  lastErrorReason?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
  lastDelivered?: boolean;
  lastDeliveryStatus?: string;
  lastDeliveryError?: string;
  lastFailureAlertAtMs?: number;
}

export interface OpenClawCronJob {
  id: string;
  agentId?: string;
  sessionKey?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: OpenClawCronSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: OpenClawCronPayload;
  delivery?: OpenClawCronDelivery;
  state: OpenClawCronJobState;
}

export interface OpenClawCronJobCreateInput {
  name: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  agentId?: string;
  sessionKey?: string;
  schedule: OpenClawCronSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: OpenClawCronPayload;
  delivery?: OpenClawCronDelivery;
}

export interface OpenClawCronJobUpdatePatch {
  name?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  agentId?: string | null;
  sessionKey?: string;
  schedule?: OpenClawCronSchedule;
  sessionTarget?: 'main' | 'isolated';
  wakeMode?: 'now' | 'next-heartbeat';
  payload?: Partial<OpenClawCronPayload>;
  delivery?: Partial<OpenClawCronDelivery>;
  state?: Partial<OpenClawCronJobState>;
}

export interface OpenClawCronRunRecord {
  ts: number;
  jobId: string;
  action: 'finished';
  status?: 'ok' | 'error' | 'skipped';
  error?: string;
  summary?: string;
  delivered?: boolean;
  deliveryStatus?: string;
  deliveryError?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  model?: string;
  provider?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
  };
  jobName?: string;
}

export interface OpenClawCronRunResult {
  ok?: boolean;
  enqueued?: boolean;
  ran?: boolean;
  runId?: string;
  reason?: string;
}

export interface OpenClawGatewayClientDependencies {
  fetchImpl?: typeof fetch;
  getInstanceDetail?: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
}

export class OpenClawGatewayAccessError extends Error {
  readonly validation: OpenClawGatewayValidationResult;

  constructor(validation: OpenClawGatewayValidationResult) {
    super(validation.message);
    this.name = 'OpenClawGatewayAccessError';
    this.validation = validation;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toIsoString(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return new Date(value).toISOString();
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeEndpoint(detail: StudioInstanceDetailRecord | null): string | null {
  const candidates = [
    detail?.instance.baseUrl,
    detail?.config.baseUrl,
    detail?.instance.config.baseUrl,
  ];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return trimTrailingSlashes(candidate.trim());
    }
  }

  if (isNonEmptyString(detail?.instance.host) && detail?.instance.port) {
    return `http://${detail.instance.host}:${detail.instance.port}`;
  }

  if (isNonEmptyString(detail?.config.port) && isNonEmptyString(detail?.instance.host)) {
    return `http://${detail.instance.host}:${detail.config.port}`;
  }

  return null;
}

function resolveToken(detail: StudioInstanceDetailRecord | null) {
  const candidates = [detail?.config.authToken, detail?.instance.config.authToken];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}

function createValidationResult(
  status: OpenClawGatewayValidationStatus,
  message: string,
  endpoint?: string | null,
  httpStatus?: number,
): OpenClawGatewayValidationResult {
  return {
    status,
    message,
    ...(endpoint !== undefined ? { endpoint } : {}),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
  };
}

function buildInvokeUrl(access: Pick<OpenClawGatewayAccessDescriptor, 'endpoint'>) {
  return access.endpoint ? `${access.endpoint}/tools/invoke` : null;
}

function buildInvokeHeaders(
  access: Pick<OpenClawGatewayAccessDescriptor, 'token'>,
  options: OpenClawGatewayRequestOptions = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (isNonEmptyString(access.token)) {
    headers.Authorization = `Bearer ${access.token}`;
  }

  if (isNonEmptyString(options.messageChannel)) {
    headers['x-openclaw-message-channel'] = options.messageChannel.trim();
  }

  if (isNonEmptyString(options.accountId)) {
    headers['x-openclaw-account-id'] = options.accountId.trim();
  }

  Object.entries(options.headers || {}).forEach(([key, value]) => {
    if (isNonEmptyString(key) && isNonEmptyString(value)) {
      headers[key.trim()] = value.trim();
    }
  });

  return headers;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || null;
}

function classifyHttpFailure(
  response: Response,
  payload: unknown,
  endpoint: string | null,
): OpenClawGatewayValidationResult {
  const message =
    isRecord(payload) && isRecord(payload.error) && isNonEmptyString(payload.error.message)
      ? payload.error.message
      : typeof payload === 'string' && payload.trim()
        ? payload
        : `OpenClaw Gateway request failed with HTTP ${response.status}.`;

  if (response.status === 401) {
    return createValidationResult('unauthorized', message, endpoint, response.status);
  }
  if (response.status === 429) {
    return createValidationResult('rate_limited', message, endpoint, response.status);
  }
  if (response.status === 404) {
    return createValidationResult('tool_denied', message, endpoint, response.status);
  }

  return createValidationResult('invalid_response', message, endpoint, response.status);
}

function mapCronStatusToExecutionStatus(
  status?: OpenClawCronRunRecord['status'] | OpenClawCronJobState['lastRunStatus'],
): StudioWorkbenchTaskExecutionRecord['status'] {
  if (status === 'error') {
    return 'failed';
  }
  return 'success';
}

function buildRunSummary(run: Pick<OpenClawCronRunRecord, 'status' | 'summary' | 'error'>) {
  if (isNonEmptyString(run.summary)) {
    return run.summary.trim();
  }
  if (run.status === 'error') {
    return 'Cron job failed.';
  }
  if (run.status === 'skipped') {
    return 'Cron job was skipped.';
  }
  return 'Cron job completed successfully.';
}

function mapOpenClawRunToWorkbenchExecution(
  run: OpenClawCronRunRecord,
): StudioWorkbenchTaskExecutionRecord {
  const startedAt = toIsoString(run.runAtMs ?? run.ts) || new Date(run.ts).toISOString();
  const finishedAt = toIsoString(
    typeof run.runAtMs === 'number' && typeof run.durationMs === 'number'
      ? run.runAtMs + run.durationMs
      : run.ts,
  );

  return {
    id: `${run.jobId}-${run.ts}`,
    taskId: run.jobId,
    status: mapCronStatusToExecutionStatus(run.status),
    trigger: 'schedule',
    startedAt,
    finishedAt,
    summary: buildRunSummary(run),
    details: isNonEmptyString(run.error) ? run.error.trim() : undefined,
  };
}

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(value: Date) {
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function mapEveryScheduleToInterval(everyMs: number) {
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (everyMs % dayMs === 0) {
    return {
      schedule: `@every ${everyMs / dayMs}d`,
      scheduleMode: 'interval' as const,
      scheduleConfig: {
        intervalValue: everyMs / dayMs,
        intervalUnit: 'day' as const,
      },
      cronExpression: undefined,
    };
  }

  if (everyMs % hourMs === 0) {
    return {
      schedule: `@every ${everyMs / hourMs}h`,
      scheduleMode: 'interval' as const,
      scheduleConfig: {
        intervalValue: everyMs / hourMs,
        intervalUnit: 'hour' as const,
      },
      cronExpression: undefined,
    };
  }

  const minutes = Math.max(1, Math.round(everyMs / minuteMs));
  return {
    schedule: `@every ${minutes}m`,
    scheduleMode: 'interval' as const,
    scheduleConfig: {
      intervalValue: minutes,
      intervalUnit: 'minute' as const,
    },
    cronExpression: undefined,
  };
}

function mapOpenClawJobToWorkbenchTask(job: OpenClawCronJob): StudioWorkbenchTaskRecord {
  let schedule: string;
  let scheduleMode: StudioWorkbenchTaskRecord['scheduleMode'];
  let scheduleConfig: StudioWorkbenchTaskRecord['scheduleConfig'];
  let cronExpression: string | undefined;

  if (job.schedule.kind === 'cron') {
    schedule = job.schedule.expr;
    scheduleMode = 'cron';
    scheduleConfig = {
      cronExpression: job.schedule.expr,
    };
    cronExpression = job.schedule.expr;
  } else if (job.schedule.kind === 'every') {
    const intervalSchedule = mapEveryScheduleToInterval(job.schedule.everyMs);
    schedule = intervalSchedule.schedule;
    scheduleMode = intervalSchedule.scheduleMode;
    scheduleConfig = intervalSchedule.scheduleConfig;
    cronExpression = intervalSchedule.cronExpression;
  } else {
    const scheduledAt = new Date(job.schedule.at);
    schedule = `at ${formatLocalDate(scheduledAt)} ${formatLocalTime(scheduledAt)}`;
    scheduleMode = 'datetime';
    scheduleConfig = {
      scheduledDate: formatLocalDate(scheduledAt),
      scheduledTime: formatLocalTime(scheduledAt),
    };
    cronExpression = undefined;
  }

  const prompt =
    job.payload.kind === 'systemEvent' ? job.payload.text : job.payload.message;
  const actionType = job.payload.kind === 'systemEvent' ? 'message' : 'skill';
  const executionContent =
    job.payload.kind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask';
  const status =
    !job.enabled
      ? 'paused'
      : job.state.lastRunStatus === 'error' && (job.state.consecutiveErrors || 0) > 0
        ? 'failed'
        : 'active';
  const lastRun = toIsoString(job.state.lastRunAtMs);
  const nextRun = toIsoString(job.state.nextRunAtMs);
  const latestExecution =
    job.state.runningAtMs
      ? {
          id: `${job.id}-latest`,
          taskId: job.id,
          status: 'running' as const,
          trigger: 'schedule' as const,
          startedAt: toIsoString(job.state.runningAtMs) || new Date().toISOString(),
          finishedAt: undefined,
          summary: 'Cron job is currently running.',
          details: undefined,
        }
      : job.state.lastRunAtMs
        ? {
            id: `${job.id}-latest`,
            taskId: job.id,
            status: mapCronStatusToExecutionStatus(job.state.lastRunStatus),
            trigger: 'schedule' as const,
            startedAt: toIsoString(job.state.lastRunAtMs) || new Date().toISOString(),
            finishedAt: toIsoString(
              typeof job.state.lastRunAtMs === 'number' &&
                typeof job.state.lastDurationMs === 'number'
                ? job.state.lastRunAtMs + job.state.lastDurationMs
                : job.state.lastRunAtMs,
            ),
            summary: buildRunSummary({
              status: job.state.lastRunStatus,
              summary: undefined,
              error: job.state.lastError,
            }),
            details: isNonEmptyString(job.state.lastError) ? job.state.lastError.trim() : undefined,
          }
        : null;

  return {
    id: job.id,
    name: job.name,
    description: job.description,
    prompt,
    schedule,
    scheduleMode,
    scheduleConfig,
    cronExpression,
    actionType,
    status,
    sessionMode: job.sessionTarget === 'main' ? 'main' : 'isolated',
    wakeUpMode: job.wakeMode === 'next-heartbeat' ? 'nextCycle' : 'immediate',
    executionContent,
    deliveryMode: job.delivery?.mode === 'none' ? 'none' : 'publishSummary',
    deliveryChannel: job.delivery?.channel,
    deliveryLabel: job.delivery?.channel,
    recipient: job.delivery?.to,
    lastRun,
    nextRun,
    latestExecution,
  };
}

function normalizeCronJob(value: unknown): OpenClawCronJob | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    return null;
  }

  return {
    id: value.id,
    agentId: isNonEmptyString(value.agentId) ? value.agentId : undefined,
    sessionKey: isNonEmptyString(value.sessionKey) ? value.sessionKey : undefined,
    name: value.name,
    description: isNonEmptyString(value.description) ? value.description : undefined,
    enabled: value.enabled !== false,
    deleteAfterRun: typeof value.deleteAfterRun === 'boolean' ? value.deleteAfterRun : undefined,
    createdAtMs: typeof value.createdAtMs === 'number' ? value.createdAtMs : 0,
    updatedAtMs: typeof value.updatedAtMs === 'number' ? value.updatedAtMs : 0,
    schedule: value.schedule as OpenClawCronSchedule,
    sessionTarget: value.sessionTarget === 'main' ? 'main' : 'isolated',
    wakeMode: value.wakeMode === 'now' ? 'now' : 'next-heartbeat',
    payload: value.payload as OpenClawCronPayload,
    delivery: isRecord(value.delivery)
      ? (value.delivery as unknown as OpenClawCronDelivery)
      : undefined,
    state: isRecord(value.state) ? (value.state as OpenClawCronJobState) : {},
  };
}

function normalizeCronJobCollection(result: unknown): OpenClawCronJob[] {
  if (Array.isArray(result)) {
    return result.map(normalizeCronJob).filter(Boolean) as OpenClawCronJob[];
  }

  if (isRecord(result)) {
    const candidates = [result.items, result.jobs];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeCronJob).filter(Boolean) as OpenClawCronJob[];
      }
    }

    const single = normalizeCronJob(result);
    if (single) {
      return [single];
    }
  }

  return [];
}

function normalizeCronRun(value: unknown): OpenClawCronRunRecord | null {
  if (!isRecord(value) || !isNonEmptyString(value.jobId) || typeof value.ts !== 'number') {
    return null;
  }

  return {
    ts: value.ts,
    jobId: value.jobId,
    action: 'finished',
    status:
      value.status === 'ok' || value.status === 'error' || value.status === 'skipped'
        ? value.status
        : undefined,
    error: isNonEmptyString(value.error) ? value.error : undefined,
    summary: isNonEmptyString(value.summary) ? value.summary : undefined,
    delivered: typeof value.delivered === 'boolean' ? value.delivered : undefined,
    deliveryStatus: isNonEmptyString(value.deliveryStatus) ? value.deliveryStatus : undefined,
    deliveryError: isNonEmptyString(value.deliveryError) ? value.deliveryError : undefined,
    sessionId: isNonEmptyString(value.sessionId) ? value.sessionId : undefined,
    sessionKey: isNonEmptyString(value.sessionKey) ? value.sessionKey : undefined,
    runAtMs: typeof value.runAtMs === 'number' ? value.runAtMs : undefined,
    durationMs: typeof value.durationMs === 'number' ? value.durationMs : undefined,
    nextRunAtMs: typeof value.nextRunAtMs === 'number' ? value.nextRunAtMs : undefined,
    model: isNonEmptyString(value.model) ? value.model : undefined,
    provider: isNonEmptyString(value.provider) ? value.provider : undefined,
    usage: isRecord(value.usage) ? (value.usage as OpenClawCronRunRecord['usage']) : undefined,
    jobName: isNonEmptyString(value.jobName) ? value.jobName : undefined,
  };
}

function normalizeCronRunCollection(result: unknown): OpenClawCronRunRecord[] {
  if (Array.isArray(result)) {
    return result.map(normalizeCronRun).filter(Boolean) as OpenClawCronRunRecord[];
  }

  if (isRecord(result)) {
    const candidates = [result.items, result.runs];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeCronRun).filter(Boolean) as OpenClawCronRunRecord[];
      }
    }
  }

  return [];
}

function normalizeModelCollection(result: unknown): OpenClawModelRecord[] {
  if (Array.isArray(result)) {
    return result.filter(isRecord) as OpenClawModelRecord[];
  }

  if (isRecord(result) && Array.isArray(result.models)) {
    return result.models.filter(isRecord) as OpenClawModelRecord[];
  }

  return [];
}

function normalizeAgentFilesListResult(result: unknown): OpenClawAgentFilesListResult {
  if (isRecord(result)) {
    return {
      ...result,
      agentId: isNonEmptyString(result.agentId) ? result.agentId : undefined,
      workspace: isNonEmptyString(result.workspace) ? result.workspace : undefined,
      files: Array.isArray(result.files)
        ? (result.files.filter(isRecord) as OpenClawAgentFileEntry[])
        : [],
    };
  }

  return {
    files: [],
  };
}

function normalizeToolsCatalogResult(result: unknown): OpenClawToolsCatalogResult {
  const profiles =
    isRecord(result) && Array.isArray(result.profiles)
      ? (result.profiles.filter(isRecord) as OpenClawToolCatalogProfile[])
      : [];
  const groups =
    isRecord(result) && Array.isArray(result.groups)
      ? (result.groups.filter(isRecord) as OpenClawToolCatalogGroup[])
      : [];

  return {
    ...(isRecord(result) ? result : {}),
    agentId: isRecord(result) && isNonEmptyString(result.agentId) ? result.agentId : undefined,
    profiles,
    groups,
  };
}

export function createOpenClawGatewayClient(
  dependencies: OpenClawGatewayClientDependencies = {},
) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const getInstanceDetail =
    dependencies.getInstanceDetail ?? ((instanceId: string) => studio.getInstanceDetail(instanceId));

  async function resolveAccess(instanceId: string): Promise<OpenClawGatewayAccessDescriptor> {
    const detail = await getInstanceDetail(instanceId);
    return {
      instanceId,
      runtimeKind: detail?.instance.runtimeKind || 'unknown',
      endpoint: normalizeEndpoint(detail),
      token: resolveToken(detail),
      detail,
    };
  }

  async function invokeResolvedTool<TResult>(
    access: OpenClawGatewayAccessDescriptor,
    request: OpenClawInvokeRequest<object>,
    options: OpenClawGatewayRequestOptions = {},
  ): Promise<TResult> {
    if (access.runtimeKind !== 'openclaw') {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'unsupported_runtime',
          'The selected instance is not an OpenClaw runtime.',
          access.endpoint,
        ),
      );
    }
    if (!access.endpoint) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'missing_endpoint',
          'OpenClaw Gateway endpoint is missing for this instance.',
          access.endpoint,
        ),
      );
    }
    if (!access.token) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'missing_auth',
          'OpenClaw Gateway auth token is missing for this instance.',
          access.endpoint,
        ),
      );
    }

    let response: Response;
    try {
      response = await fetchImpl(buildInvokeUrl(access)!, {
        method: 'POST',
        headers: buildInvokeHeaders(access, options),
        body: JSON.stringify(request),
      });
    } catch (error) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'unreachable',
          error instanceof Error ? error.message : 'Unable to reach the OpenClaw Gateway.',
          access.endpoint,
        ),
      );
    }

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new OpenClawGatewayAccessError(classifyHttpFailure(response, payload, access.endpoint));
    }

    if (!isRecord(payload)) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'invalid_response',
          'OpenClaw Gateway returned a non-JSON response.',
          access.endpoint,
          response.status,
        ),
      );
    }

    if (payload.ok === true) {
      return payload.result as TResult;
    }

    if (payload.ok === false) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'invalid_response',
          isRecord(payload.error) && isNonEmptyString(payload.error.message)
            ? payload.error.message
            : 'OpenClaw Gateway tool invocation failed.',
          access.endpoint,
          response.status,
        ),
      );
    }

    throw new OpenClawGatewayAccessError(
      createValidationResult(
        'invalid_response',
        'OpenClaw Gateway returned an unexpected response payload.',
        access.endpoint,
        response.status,
      ),
    );
  }

  async function invokeTool<TResult>(
    instanceId: string,
    request: OpenClawInvokeRequest<object>,
    options: OpenClawGatewayRequestOptions = {},
  ): Promise<TResult> {
    const access = await resolveAccess(instanceId);
    return invokeResolvedTool<TResult>(access, request, options);
  }

  async function invokeMethod<TResult>(
    instanceId: string,
    tool: string,
    action: string,
    args: object = {},
    options: OpenClawGatewayRequestOptions = {},
  ) {
    return invokeTool<TResult>(instanceId, {
      tool,
      action,
      args,
    }, options);
  }

  async function invokeOfficialMethod<TResult = OpenClawGatewayMethodResult>(
    instanceId: string,
    method: OpenClawGatewayOfficialMethod,
    args: OpenClawGatewayMethodArgs = {},
    options: OpenClawGatewayRequestOptions = {},
  ) {
    const descriptor = resolveOfficialGatewayMethodDescriptor(method);
    if (descriptor.action) {
      return invokeMethod<TResult>(instanceId, descriptor.tool, descriptor.action, args, options);
    }

    return invokeTool<TResult>(instanceId, {
      tool: descriptor.tool,
      args,
    }, options);
  }

  async function validateResolvedAccess(
    access: OpenClawGatewayAccessDescriptor,
  ): Promise<OpenClawGatewayValidationResult> {
    if (access.runtimeKind !== 'openclaw') {
      return createValidationResult(
        'unsupported_runtime',
        'The selected instance is not an OpenClaw runtime.',
        access.endpoint,
      );
    }
    if (!access.endpoint) {
      return createValidationResult(
        'missing_endpoint',
        'OpenClaw Gateway endpoint is missing for this instance.',
        access.endpoint,
      );
    }
    if (!access.token) {
      return createValidationResult(
        'missing_auth',
        'OpenClaw Gateway auth token is missing for this instance.',
        access.endpoint,
      );
    }

    try {
      await invokeResolvedTool(access, {
        tool: 'session_status',
        args: {
          sessionKey: 'main',
        },
      });
      return createValidationResult('ok', 'OpenClaw Gateway access validated.', access.endpoint);
    } catch (error) {
      if (error instanceof OpenClawGatewayAccessError) {
        return error.validation;
      }

      return createValidationResult(
        'unreachable',
        error instanceof Error ? error.message : 'Unable to reach the OpenClaw Gateway.',
        access.endpoint,
      );
    }
  }

  async function validateAccess(instanceId: string): Promise<OpenClawGatewayValidationResult> {
    const access = await resolveAccess(instanceId);
    return validateResolvedAccess(access);
  }

  async function getInvokeHttpRequestInfo(
    instanceId: string,
    request: OpenClawInvokeRequest<object>,
    options: OpenClawGatewayRequestOptions = {},
  ): Promise<OpenClawGatewayHttpRequestInfo> {
    const access = await resolveAccess(instanceId);
    return {
      instanceId,
      runtimeKind: access.runtimeKind,
      endpoint: access.endpoint,
      url: buildInvokeUrl(access),
      headers: buildInvokeHeaders(access, options),
      request,
      validation: await validateResolvedAccess(access),
    };
  }

  async function listCronJobs(instanceId: string) {
    const result = await invokeMethod<unknown>(instanceId, 'cron', 'list', {
      includeDisabled: true,
    });
    return normalizeCronJobCollection(result);
  }

  async function listWorkbenchCronJobs(instanceId: string) {
    const jobs = await listCronJobs(instanceId);
    return jobs.map(mapOpenClawJobToWorkbenchTask);
  }

  async function listCronRuns(instanceId: string, jobId: string) {
    const result = await invokeMethod<unknown>(instanceId, 'cron', 'runs', {
      id: jobId,
    });
    return normalizeCronRunCollection(result);
  }

  async function listWorkbenchCronRuns(instanceId: string, jobId: string) {
    const runs = await listCronRuns(instanceId, jobId);
    return runs.map(mapOpenClawRunToWorkbenchExecution);
  }

  async function addCronJob(instanceId: string, job: OpenClawCronJobCreateInput) {
    const access = await resolveAccess(instanceId);
    const result = await invokeResolvedTool<unknown>(access, {
      tool: 'cron',
      action: 'add',
      args: {
        job,
      },
    });
    const [normalized] = normalizeCronJobCollection(result);
    if (!normalized) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'invalid_response',
          'OpenClaw Gateway did not return the created cron job.',
          access.endpoint,
        ),
      );
    }
    return normalized;
  }

  async function updateCronJob(
    instanceId: string,
    jobId: string,
    patch: OpenClawCronJobUpdatePatch,
  ) {
    const access = await resolveAccess(instanceId);
    const result = await invokeResolvedTool<unknown>(access, {
      tool: 'cron',
      action: 'update',
      args: {
        id: jobId,
        patch,
      },
    });
    const [normalized] = normalizeCronJobCollection(result);
    if (!normalized) {
      throw new OpenClawGatewayAccessError(
        createValidationResult(
          'invalid_response',
          'OpenClaw Gateway did not return the updated cron job.',
          access.endpoint,
        ),
      );
    }
    return normalized;
  }

  async function removeCronJob(instanceId: string, jobId: string) {
    const result = await invokeMethod<unknown>(instanceId, 'cron', 'remove', {
      id: jobId,
    });

    if (typeof result === 'boolean') {
      return result;
    }
    if (isRecord(result) && typeof result.ok === 'boolean') {
      return result.ok;
    }
    return true;
  }

  async function runCronJob(instanceId: string, jobId: string) {
    return invokeMethod<OpenClawCronRunResult>(instanceId, 'cron', 'run', {
      id: jobId,
      mode: 'force',
    });
  }

  async function getSessionStatus(
    instanceId: string,
    args: OpenClawSessionStatusArgs = {},
  ) {
    return invokeTool<OpenClawSessionStatusResult>(instanceId, {
      tool: 'session_status',
      args,
    });
  }

  async function listSessions(instanceId: string, args: OpenClawSessionsListArgs = {}) {
    return invokeTool<OpenClawSessionsListResult>(instanceId, {
      tool: 'sessions_list',
      args,
    });
  }

  async function listSessionHistory(instanceId: string, args: OpenClawSessionHistoryArgs) {
    return invokeTool<OpenClawSessionHistoryResult>(instanceId, {
      tool: 'sessions_history',
      args,
    });
  }

  async function sendToSession(instanceId: string, args: OpenClawSessionSendArgs) {
    return invokeTool<OpenClawSessionSendResult>(instanceId, {
      tool: 'sessions_send',
      args,
    });
  }

  async function spawnSession(instanceId: string, args: OpenClawSessionSpawnArgs) {
    return invokeTool<OpenClawSessionSpawnResult>(instanceId, {
      tool: 'sessions_spawn',
      args,
    });
  }

  async function listSubagents(instanceId: string, args: OpenClawSubagentsArgs = {}) {
    return invokeMethod<OpenClawSubagentsResult>(instanceId, 'subagents', 'list', args);
  }

  async function listAgents(instanceId: string) {
    return invokeTool<OpenClawAgentsListResult>(instanceId, {
      tool: 'agents_list',
      args: {},
    });
  }

  async function searchMemory(instanceId: string, args: OpenClawMemorySearchArgs) {
    return invokeTool<OpenClawMemorySearchResult>(instanceId, {
      tool: 'memory_search',
      args,
    });
  }

  async function getMemoryContent(instanceId: string, args: OpenClawMemoryGetArgs) {
    return invokeTool<OpenClawMemoryGetResult>(instanceId, {
      tool: 'memory_get',
      args,
    });
  }

  async function getMemory(instanceId: string, args: OpenClawMemoryGetArgs) {
    return getMemoryContent(instanceId, args);
  }

  async function listModels(instanceId: string) {
    const result = await invokeMethod<unknown>(instanceId, 'models', 'list', {});
    return normalizeModelCollection(result);
  }

  async function getChannelStatus(
    instanceId: string,
    args: OpenClawChannelStatusArgs = {},
  ) {
    return invokeMethod<OpenClawChannelStatusResult>(instanceId, 'channels', 'status', args);
  }

  async function tailLogs(instanceId: string, args: OpenClawLogTailArgs = {}) {
    return invokeMethod<OpenClawLogTailResult>(instanceId, 'logs', 'tail', args);
  }

  async function getSkillsStatus(
    instanceId: string,
    args: { agentId?: string } = {},
  ) {
    return invokeMethod<OpenClawSkillsStatusResult>(instanceId, 'skills', 'status', args);
  }

  async function getToolsCatalog(
    instanceId: string,
    args: OpenClawToolsCatalogArgs = {},
  ) {
    const result = await invokeMethod<unknown>(instanceId, 'tools', 'catalog', args);
    return normalizeToolsCatalogResult(result);
  }

  async function getConfig(instanceId: string) {
    return invokeMethod<OpenClawConfigSnapshot>(instanceId, 'config', 'get', {});
  }

  async function openConfigFile(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod<OpenClawConfigOpenFileResult>(instanceId, 'config.openFile', args);
  }

  async function getConfigSchema(instanceId: string) {
    return invokeMethod<Record<string, unknown>>(instanceId, 'config', 'schema', {});
  }

  async function lookupConfigSchema(
    instanceId: string,
    args: OpenClawConfigSchemaLookupArgs,
  ) {
    return invokeMethod<Record<string, unknown>>(instanceId, 'config', 'schema.lookup', args);
  }

  async function setConfig(instanceId: string, args: Pick<OpenClawConfigMutationArgs, 'raw' | 'baseHash'>) {
    return invokeMethod<OpenClawConfigMutationResult>(instanceId, 'config', 'set', args);
  }

  async function patchConfig(instanceId: string, args: OpenClawConfigMutationArgs) {
    return invokeMethod<OpenClawConfigMutationResult>(instanceId, 'config', 'patch', args);
  }

  async function applyConfig(instanceId: string, args: OpenClawConfigMutationArgs) {
    return invokeMethod<OpenClawConfigMutationResult>(instanceId, 'config', 'apply', args);
  }

  async function listAgentFiles(instanceId: string, args: OpenClawAgentFilesListArgs) {
    const result = await invokeMethod<unknown>(instanceId, 'agents.files', 'list', args);
    return normalizeAgentFilesListResult(result);
  }

  async function getAgentFile(instanceId: string, args: OpenClawAgentFileRequest) {
    return invokeMethod<OpenClawAgentFileResult>(instanceId, 'agents.files', 'get', args);
  }

  async function setAgentFile(
    instanceId: string,
    args: OpenClawAgentFileRequest & { content: string },
  ) {
    return invokeMethod<OpenClawAgentFileResult>(instanceId, 'agents.files', 'set', args);
  }

  async function getStatus(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeTool<OpenClawGatewayMethodResult>(instanceId, {
      tool: 'status',
      args,
    });
  }

  async function logoutChannel(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'channels', 'logout', args);
  }

  async function getUsageStatus(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'usage', 'status', args);
  }

  async function getUsageCost(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'usage', 'cost', args);
  }

  async function getTtsStatus(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'tts', 'status', args);
  }

  async function enableTts(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'tts', 'enable', args);
  }

  async function disableTts(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'tts', 'disable', args);
  }

  async function convertTts(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'tts', 'convert', args);
  }

  async function setTtsProvider(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'tts', 'setProvider', args);
  }

  async function listAgentsMethod(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'agents', 'list', args);
  }

  async function createAgent(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'agents', 'create', args);
  }

  async function updateAgent(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'agents', 'update', args);
  }

  async function deleteAgent(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'agents', 'delete', args);
  }

  async function listSkillBins(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'skills', 'bins', args);
  }

  async function installSkill(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'skills', 'install', args);
  }

  async function updateSkill(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'skills', 'update', args);
  }

  async function runUpdate(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'update', 'run', args);
  }

  async function getVoicewake(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'voicewake', 'get', args);
  }

  async function setVoicewake(instanceId: string, args: OpenClawGatewayMethodArgs) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'voicewake', 'set', args);
  }

  async function reloadSecrets(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'secrets', 'reload', args);
  }

  async function resolveSecrets(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeMethod<OpenClawGatewayMethodResult>(instanceId, 'secrets', 'resolve', args);
  }

  async function getHealth(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'health', args);
  }

  async function getDoctorMemoryStatus(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'doctor.memory.status', args);
  }

  async function getTtsProviders(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'tts.providers', args);
  }

  async function getExecApprovals(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'exec.approvals.get', args);
  }

  async function setExecApprovals(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'exec.approvals.set', args);
  }

  async function getNodeExecApprovals(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'exec.approvals.node.get', args);
  }

  async function setNodeExecApprovals(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'exec.approvals.node.set', args);
  }

  async function requestExecApproval(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'exec.approval.request', args);
  }

  async function waitExecApprovalDecision(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'exec.approval.waitDecision', args);
  }

  async function resolveExecApproval(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'exec.approval.resolve', args);
  }

  async function startWizard(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'wizard.start', args);
  }

  async function nextWizard(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'wizard.next', args);
  }

  async function cancelWizard(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'wizard.cancel', args);
  }

  async function getWizardStatus(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'wizard.status', args);
  }

  async function getTalkConfig(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'talk.config', args);
  }

  async function setTalkMode(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'talk.mode', args);
  }

  async function listGatewaySessions(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'sessions.list', args);
  }

  async function previewGatewaySession(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'sessions.preview', args);
  }

  async function resolveGatewaySession(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod<OpenClawGatewaySessionResolveResult>(
      instanceId,
      'sessions.resolve',
      args,
    );
  }

  async function patchGatewaySession(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'sessions.patch', args);
  }

  async function resetGatewaySession(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'sessions.reset', args);
  }

  async function deleteGatewaySession(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'sessions.delete', args);
  }

  async function getGatewaySession(
    instanceId: string,
    args: OpenClawGatewaySessionGetArgs = {},
  ) {
    return invokeOfficialMethod<OpenClawGatewaySessionGetResult>(
      instanceId,
      'sessions.get',
      args,
    );
  }

  async function compactGatewaySession(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'sessions.compact', args);
  }

  async function getGatewaySessionUsage(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod<OpenClawGatewaySessionUsageResult>(
      instanceId,
      'sessions.usage',
      args,
    );
  }

  async function getGatewaySessionUsageTimeseries(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod<OpenClawGatewaySessionUsageResult>(
      instanceId,
      'sessions.usage.timeseries',
      args,
    );
  }

  async function getGatewaySessionUsageLogs(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod<OpenClawGatewaySessionUsageLogsResult>(
      instanceId,
      'sessions.usage.logs',
      args,
    );
  }

  async function getLastHeartbeat(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'last-heartbeat', args);
  }

  async function setHeartbeats(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'set-heartbeats', args);
  }

  async function wakeGateway(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'wake', args);
  }

  async function requestNodePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pair.request', args);
  }

  async function listNodePairings(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pair.list', args);
  }

  async function approveNodePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pair.approve', args);
  }

  async function rejectNodePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pair.reject', args);
  }

  async function verifyNodePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pair.verify', args);
  }

  async function listDevicePairings(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'device.pair.list', args);
  }

  async function approveDevicePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'device.pair.approve', args);
  }

  async function rejectDevicePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'device.pair.reject', args);
  }

  async function removeDevicePairing(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'device.pair.remove', args);
  }

  async function rotateDeviceToken(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'device.token.rotate', args);
  }

  async function revokeDeviceToken(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'device.token.revoke', args);
  }

  async function renameNode(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'node.rename', args);
  }

  async function listNodes(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'node.list', args);
  }

  async function describeNode(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'node.describe', args);
  }

  async function drainNodePending(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pending.drain', args);
  }

  async function enqueueNodePending(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pending.enqueue', args);
  }

  async function invokeNode(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'node.invoke', args);
  }

  async function pullNodePending(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.pending.pull', args);
  }

  async function ackNodePending(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'node.pending.ack', args);
  }

  async function getNodeInvokeResult(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.invoke.result', args);
  }

  async function publishNodeEvent(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.event', args);
  }

  async function refreshNodeCanvasCapability(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'node.canvas.capability.refresh', args);
  }

  async function getCronStatus(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'cron.status', args);
  }

  async function getGatewayIdentity(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'gateway.identity.get', args);
  }

  async function getSystemPresence(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'system-presence', args);
  }

  async function emitSystemEvent(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'system-event', args);
  }

  async function sendGatewayMessage(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'send', args);
  }

  async function invokeAgentMethod(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'agent', args);
  }

  async function getAgentIdentity(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'agent.identity.get', args);
  }

  async function waitForAgent(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'agent.wait', args);
  }

  async function requestBrowser(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'browser.request', args);
  }

  async function getChatHistory(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'chat.history', args);
  }

  async function abortChat(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'chat.abort', args);
  }

  async function sendChat(instanceId: string, args: OpenClawGatewayMethodArgs = {}) {
    return invokeOfficialMethod(instanceId, 'chat.send', args);
  }

  async function injectChatMessage(
    instanceId: string,
    args: OpenClawChatInjectArgs,
  ) {
    return invokeOfficialMethod<OpenClawChatInjectResult>(instanceId, 'chat.inject', args);
  }

  async function testPushDelivery(
    instanceId: string,
    args: OpenClawGatewayMethodArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'push.test', args);
  }

  async function startWebLogin(
    instanceId: string,
    args: OpenClawWebLoginStartArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'web.login.start', args);
  }

  async function waitForWebLogin(
    instanceId: string,
    args: OpenClawWebLoginArgs = {},
  ) {
    return invokeOfficialMethod(instanceId, 'web.login.wait', args);
  }

  return {
    invokeTool,
    invokeMethod,
    invokeOfficialMethod,
    getInvokeHttpRequestInfo,
    resolveAccess,
    validateAccess,
    officialMethods: OPENCLAW_GATEWAY_OFFICIAL_METHODS,
    getSessionStatus,
    listSessions,
    listSessionHistory,
    sendToSession,
    spawnSession,
    listSubagents,
    listAgents,
    searchMemory,
    getMemoryContent,
    getMemory,
    listModels,
    getChannelStatus,
    tailLogs,
    getSkillsStatus,
    getToolsCatalog,
    getConfig,
    openConfigFile,
    getConfigSchema,
    lookupConfigSchema,
    setConfig,
    patchConfig,
    applyConfig,
    listAgentFiles,
    getAgentFile,
    setAgentFile,
    getHealth,
    getDoctorMemoryStatus,
    getStatus,
    logoutChannel,
    getUsageStatus,
    getUsageCost,
    getTtsStatus,
    getTtsProviders,
    enableTts,
    disableTts,
    convertTts,
    setTtsProvider,
    getExecApprovals,
    setExecApprovals,
    getNodeExecApprovals,
    setNodeExecApprovals,
    requestExecApproval,
    waitExecApprovalDecision,
    resolveExecApproval,
    startWizard,
    nextWizard,
    cancelWizard,
    getWizardStatus,
    getTalkConfig,
    setTalkMode,
    listAgentsMethod,
    createAgent,
    updateAgent,
    deleteAgent,
    listSkillBins,
    installSkill,
    updateSkill,
    runUpdate,
    getVoicewake,
    setVoicewake,
    reloadSecrets,
    resolveSecrets,
    listGatewaySessions,
    previewGatewaySession,
    resolveGatewaySession,
    patchGatewaySession,
    resetGatewaySession,
    deleteGatewaySession,
    getGatewaySession,
    compactGatewaySession,
    getGatewaySessionUsage,
    getGatewaySessionUsageTimeseries,
    getGatewaySessionUsageLogs,
    getLastHeartbeat,
    setHeartbeats,
    wakeGateway,
    requestNodePairing,
    listNodePairings,
    approveNodePairing,
    rejectNodePairing,
    verifyNodePairing,
    listDevicePairings,
    approveDevicePairing,
    rejectDevicePairing,
    removeDevicePairing,
    rotateDeviceToken,
    revokeDeviceToken,
    renameNode,
    listNodes,
    describeNode,
    drainNodePending,
    enqueueNodePending,
    invokeNode,
    pullNodePending,
    ackNodePending,
    getNodeInvokeResult,
    publishNodeEvent,
    refreshNodeCanvasCapability,
    listCronJobs,
    getCronStatus,
    listWorkbenchCronJobs,
    listCronRuns,
    listWorkbenchCronRuns,
    addCronJob,
    updateCronJob,
    removeCronJob,
    runCronJob,
    getGatewayIdentity,
    getSystemPresence,
    emitSystemEvent,
    sendGatewayMessage,
    invokeAgentMethod,
    getAgentIdentity,
    waitForAgent,
    requestBrowser,
    getChatHistory,
    abortChat,
    sendChat,
    injectChatMessage,
    testPushDelivery,
    startWebLogin,
    waitForWebLogin,
  };
}

export const openClawGatewayClient = createOpenClawGatewayClient();
