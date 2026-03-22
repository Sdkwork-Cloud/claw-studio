import { studioMockService } from '@sdkwork/claw-infrastructure';
import {
  openClawGatewayClient,
  studio,
  type OpenClawCronJob,
  type OpenClawCronJobCreateInput,
  type OpenClawCronJobUpdatePatch,
  type OpenClawCronRunRecord,
  type OpenClawCronRunResult,
  type StudioInstanceDetailRecord,
} from '@sdkwork/claw-infrastructure';
import { type ListParams, type PaginatedResult } from '@sdkwork/claw-types';
import type {
  TaskActionType,
  TaskCreateInput,
  TaskDeliveryMode,
  TaskExecutionConfig,
  TaskExecutionContent,
  TaskScheduleConfig,
  TaskScheduleMode,
  TaskSessionMode,
  TaskStatus,
  TaskWakeUpMode,
} from './taskSchedule';

export interface Task extends TaskCreateInput {
  id: string;
  lastRun?: string;
  nextRun?: string;
}

export interface TaskExecutionHistoryEntry {
  id: string;
  taskId: string;
  status: 'success' | 'failed' | 'running';
  trigger: 'schedule' | 'manual' | 'clone';
  startedAt: string;
  finishedAt?: string;
  summary: string;
  details?: string;
}

export interface TaskDeliveryChannelOption {
  id: string;
  name: string;
}

export interface CreateTaskDTO {
  name: string;
  description?: string;
  prompt: string;
  schedule: string;
  scheduleMode: TaskScheduleMode;
  scheduleConfig: TaskScheduleConfig;
  cronExpression?: string;
  actionType: TaskActionType;
  status: TaskStatus;
  sessionMode: TaskSessionMode;
  wakeUpMode: TaskWakeUpMode;
  executionContent: TaskExecutionContent;
  timeoutSeconds?: number;
  deliveryMode: TaskDeliveryMode;
  deliveryChannel?: string;
  recipient?: string;
  lastRun?: string;
  nextRun?: string;
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {}

export interface ITaskService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Task>>;
  getById(instanceId: string, id: string): Promise<Task | null>;
  create(instanceId: string, data: CreateTaskDTO): Promise<Task>;
  update(id: string, data: UpdateTaskDTO): Promise<Task>;
  delete(id: string): Promise<boolean>;
  cloneTask(id: string, overrides?: UpdateTaskDTO): Promise<Task>;
  runTaskNow(id: string): Promise<TaskExecutionHistoryEntry>;
  listTaskExecutions(id: string): Promise<TaskExecutionHistoryEntry[]>;
  listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]>;

  getTasks(instanceId: string): Promise<Task[]>;
  createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task>;
  updateTask(id: string, data: UpdateTaskDTO): Promise<Task>;
  updateTaskStatus(id: string, status: Extract<TaskStatus, 'active' | 'paused'>): Promise<void>;
  deleteTask(id: string): Promise<void>;
}

interface TaskServiceDependencies {
  getInstanceDetail(instanceId: string): Promise<StudioInstanceDetailRecord | null>;
  studioMockService: {
    listTasks(instanceId: string): Promise<Task[]>;
    createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task>;
    updateTask(id: string, data: UpdateTaskDTO): Promise<Task | null>;
    cloneTask(id: string, overrides?: UpdateTaskDTO): Promise<Task | null>;
    runTaskNow(id: string): Promise<TaskExecutionHistoryEntry | null>;
    listTaskExecutions(id: string): Promise<TaskExecutionHistoryEntry[]>;
    listChannels(
      instanceId: string,
    ): Promise<Array<{ id: string; name: string; enabled: boolean; status: string }>>;
    updateTaskStatus(id: string, status: Extract<TaskStatus, 'active' | 'paused'>): Promise<boolean>;
    deleteTask(id: string): Promise<boolean>;
  };
  openClawGatewayClient: {
    listCronJobs(instanceId: string): Promise<OpenClawCronJob[]>;
    listCronRuns(instanceId: string, jobId: string): Promise<OpenClawCronRunRecord[]>;
    addCronJob(instanceId: string, job: OpenClawCronJobCreateInput): Promise<OpenClawCronJob>;
    updateCronJob(
      instanceId: string,
      jobId: string,
      patch: OpenClawCronJobUpdatePatch,
    ): Promise<OpenClawCronJob>;
    removeCronJob(instanceId: string, jobId: string): Promise<boolean>;
    runCronJob(instanceId: string, jobId: string): Promise<OpenClawCronRunResult>;
  };
}

export interface TaskServiceDependencyOverrides {
  getInstanceDetail?: TaskServiceDependencies['getInstanceDetail'];
  studioMockService?: Partial<TaskServiceDependencies['studioMockService']>;
  openClawGatewayClient?: Partial<TaskServiceDependencies['openClawGatewayClient']>;
}

function createDefaultDependencies(): TaskServiceDependencies {
  return {
    getInstanceDetail: (instanceId) => studio.getInstanceDetail(instanceId),
    studioMockService: {
      listTasks: (instanceId) => studioMockService.listTasks(instanceId),
      createTask: (instanceId, task) => studioMockService.createTask(instanceId, task),
      updateTask: (id, data) => studioMockService.updateTask(id, data),
      cloneTask: (id, overrides) => studioMockService.cloneTask(id, overrides),
      runTaskNow: (id) => studioMockService.runTaskNow(id),
      listTaskExecutions: (id) => studioMockService.listTaskExecutions(id),
      listChannels: (instanceId) => studioMockService.listChannels(instanceId),
      updateTaskStatus: (id, status) => studioMockService.updateTaskStatus(id, status).then(Boolean),
      deleteTask: (id) => studioMockService.deleteTask(id),
    },
    openClawGatewayClient: {
      listCronJobs: (instanceId) => openClawGatewayClient.listCronJobs(instanceId),
      listCronRuns: (instanceId, jobId) => openClawGatewayClient.listCronRuns(instanceId, jobId),
      addCronJob: (instanceId, job) => openClawGatewayClient.addCronJob(instanceId, job),
      updateCronJob: (instanceId, jobId, patch) =>
        openClawGatewayClient.updateCronJob(instanceId, jobId, patch),
      removeCronJob: (instanceId, jobId) => openClawGatewayClient.removeCronJob(instanceId, jobId),
      runCronJob: (instanceId, jobId) => openClawGatewayClient.runCronJob(instanceId, jobId),
    },
  };
}

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function toIsoString(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return new Date(value).toISOString();
}

function mapCronStatusToTaskStatus(job: OpenClawCronJob): TaskStatus {
  if (!job.enabled) {
    return 'paused';
  }
  if (job.state.lastRunStatus === 'error' && (job.state.consecutiveErrors || 0) > 0) {
    return 'failed';
  }
  return 'active';
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

function mapEveryScheduleToTaskConfig(everyMs: number) {
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

function mapOpenClawJobToTask(job: OpenClawCronJob): Task {
  let schedule: string;
  let scheduleMode: TaskScheduleMode;
  let scheduleConfig: TaskScheduleConfig;
  let cronExpression: string | undefined;

  if (job.schedule.kind === 'cron') {
    schedule = job.schedule.expr;
    scheduleMode = 'cron';
    scheduleConfig = {
      cronExpression: job.schedule.expr,
    };
    cronExpression = job.schedule.expr;
  } else if (job.schedule.kind === 'every') {
    const interval = mapEveryScheduleToTaskConfig(job.schedule.everyMs);
    schedule = interval.schedule;
    scheduleMode = interval.scheduleMode;
    scheduleConfig = interval.scheduleConfig;
    cronExpression = interval.cronExpression;
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

  return {
    id: job.id,
    name: job.name,
    description: job.description,
    prompt,
    schedule,
    scheduleMode,
    scheduleConfig,
    cronExpression,
    actionType: job.payload.kind === 'systemEvent' ? 'message' : 'skill',
    status: mapCronStatusToTaskStatus(job),
    sessionMode: job.sessionTarget === 'main' ? 'main' : 'isolated',
    wakeUpMode: job.wakeMode === 'now' ? 'immediate' : 'nextCycle',
    executionContent: job.payload.kind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
    timeoutSeconds:
      job.payload.kind === 'agentTurn' ? job.payload.timeoutSeconds : undefined,
    deliveryMode: job.delivery?.mode === 'none' ? 'none' : 'publishSummary',
    deliveryChannel: job.delivery?.channel,
    recipient: job.delivery?.to,
    lastRun: toIsoString(job.state.lastRunAtMs),
    nextRun: toIsoString(job.state.nextRunAtMs),
  };
}

function mapOpenClawRunToExecution(run: OpenClawCronRunRecord): TaskExecutionHistoryEntry {
  const startedAt = toIsoString(run.runAtMs ?? run.ts) || new Date(run.ts).toISOString();
  const finishedAt = toIsoString(
    typeof run.runAtMs === 'number' && typeof run.durationMs === 'number'
      ? run.runAtMs + run.durationMs
      : run.ts,
  );

  return {
    id: `${run.jobId}-${run.ts}`,
    taskId: run.jobId,
    status: run.status === 'error' ? 'failed' : 'success',
    trigger: 'schedule',
    startedAt,
    finishedAt,
    summary: run.summary || (run.status === 'error' ? 'Cron job failed.' : 'Cron job completed successfully.'),
    details: run.error,
  };
}

function mergeTask(base: Task, patch: UpdateTaskDTO): Task {
  return {
    ...base,
    ...patch,
    scheduleConfig: {
      ...base.scheduleConfig,
      ...(patch.scheduleConfig || {}),
    },
  };
}

function buildOpenClawSchedule(task: Omit<Task, 'id'> | Task): OpenClawCronJobCreateInput['schedule'] {
  if (task.scheduleMode === 'interval') {
    const intervalValue = task.scheduleConfig.intervalValue || 1;
    const intervalUnit = task.scheduleConfig.intervalUnit || 'minute';
    const multiplier =
      intervalUnit === 'day' ? 24 * 60 * 60_000 : intervalUnit === 'hour' ? 60 * 60_000 : 60_000;

    return {
      kind: 'every',
      everyMs: intervalValue * multiplier,
    };
  }

  if (task.scheduleMode === 'datetime') {
    const scheduledDate = task.scheduleConfig.scheduledDate;
    const scheduledTime = task.scheduleConfig.scheduledTime || '00:00';
    if (!scheduledDate) {
      throw new Error('Scheduled date is required for datetime tasks.');
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error('Invalid scheduled date or time.');
    }

    return {
      kind: 'at',
      at: scheduledAt.toISOString(),
    };
  }

  const expr = task.cronExpression || task.scheduleConfig.cronExpression || task.schedule;
  return {
    kind: 'cron',
    expr,
  };
}

function buildOpenClawPayload(task: Omit<Task, 'id'> | Task): OpenClawCronJobCreateInput['payload'] {
  if (task.executionContent === 'sendPromptMessage' || task.sessionMode === 'main') {
    return {
      kind: 'systemEvent',
      text: task.prompt,
    };
  }

  return {
    kind: 'agentTurn',
    message: task.prompt,
    ...(task.timeoutSeconds ? { timeoutSeconds: task.timeoutSeconds } : {}),
  };
}

function buildOpenClawDelivery(task: Omit<Task, 'id'> | Task): OpenClawCronJobCreateInput['delivery'] {
  if (task.deliveryMode === 'none') {
    return {
      mode: 'none',
    };
  }

  return {
    mode: 'announce',
    ...(task.deliveryChannel ? { channel: task.deliveryChannel } : {}),
    ...(task.recipient ? { to: task.recipient } : {}),
  };
}

function buildOpenClawJobCreateInput(task: Omit<Task, 'id'> | Task): OpenClawCronJobCreateInput {
  return {
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    enabled: task.status !== 'paused',
    schedule: buildOpenClawSchedule(task),
    sessionTarget:
      task.executionContent === 'sendPromptMessage' || task.sessionMode === 'main'
        ? 'main'
        : 'isolated',
    wakeMode: task.wakeUpMode === 'immediate' ? 'now' : 'next-heartbeat',
    payload: buildOpenClawPayload(task),
    delivery: buildOpenClawDelivery(task),
  };
}

function buildOpenClawJobPatch(task: Task): OpenClawCronJobUpdatePatch {
  const next = buildOpenClawJobCreateInput(task);
  return {
    name: next.name,
    description: next.description,
    enabled: next.enabled,
    schedule: next.schedule,
    sessionTarget: next.sessionTarget,
    wakeMode: next.wakeMode,
    payload: next.payload,
    delivery: next.delivery,
  };
}

class TaskService implements ITaskService {
  private readonly openClawTaskInstanceById = new Map<string, string>();

  private readonly openClawTaskCache = new Map<string, Task>();

  private readonly dependencies: TaskServiceDependencies;

  constructor(dependencies: TaskServiceDependencies) {
    this.dependencies = dependencies;
  }

  private clearOpenClawTasksForInstance(instanceId: string) {
    for (const [taskId, currentInstanceId] of [...this.openClawTaskInstanceById.entries()]) {
      if (currentInstanceId === instanceId) {
        this.openClawTaskInstanceById.delete(taskId);
        this.openClawTaskCache.delete(taskId);
      }
    }
  }

  private rememberOpenClawTasks(instanceId: string, tasks: Task[]) {
    this.clearOpenClawTasksForInstance(instanceId);
    tasks.forEach((task) => {
      this.openClawTaskInstanceById.set(task.id, instanceId);
      this.openClawTaskCache.set(task.id, task);
    });
  }

  private async getOpenClawDetail(instanceId: string) {
    const detail = await this.dependencies.getInstanceDetail(instanceId).catch(() => null);
    return isOpenClawDetail(detail) ? detail : null;
  }

  private async tryGetOpenClawTasks(instanceId: string): Promise<Task[] | null> {
    const detail = await this.getOpenClawDetail(instanceId);
    if (!detail) {
      return null;
    }

    try {
      const jobs = await this.dependencies.openClawGatewayClient.listCronJobs(instanceId);
      const tasks = jobs.map(mapOpenClawJobToTask);
      this.rememberOpenClawTasks(instanceId, tasks);
      return tasks;
    } catch {
      return null;
    }
  }

  async getList(instanceId: string, params: ListParams = {}): Promise<PaginatedResult<Task>> {
    const tasks = await this.getTasks(instanceId);

    let filtered = tasks;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter((task) => task.name.toLowerCase().includes(lowerKeyword));
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

  async getById(instanceId: string, id: string): Promise<Task | null> {
    const tasks = await this.getTasks(instanceId);
    return tasks.find((task) => task.id === id) || null;
  }

  async create(instanceId: string, data: CreateTaskDTO): Promise<Task> {
    return this.createTask(instanceId, data);
  }

  async update(id: string, data: UpdateTaskDTO): Promise<Task> {
    return this.updateTask(id, data);
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteTask(id);
    return true;
  }

  async getTasks(instanceId: string): Promise<Task[]> {
    const openClawTasks = await this.tryGetOpenClawTasks(instanceId);
    if (openClawTasks) {
      return openClawTasks;
    }

    return this.dependencies.studioMockService.listTasks(instanceId);
  }

  async createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const detail = await this.getOpenClawDetail(instanceId);
    if (detail) {
      const created = await this.dependencies.openClawGatewayClient.addCronJob(
        instanceId,
        buildOpenClawJobCreateInput(task),
      );
      const mapped = mapOpenClawJobToTask(created);
      this.rememberOpenClawTasks(instanceId, [...this.openClawTaskCache.values(), mapped].filter(
        (candidate) => this.openClawTaskInstanceById.get(candidate.id) === instanceId || candidate.id === mapped.id,
      ));
      return mapped;
    }

    return this.dependencies.studioMockService.createTask(instanceId, task);
  }

  async updateTask(id: string, data: UpdateTaskDTO): Promise<Task> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const current = this.openClawTaskCache.get(id);
      if (!current) {
        throw new Error('OpenClaw task cache is missing for the selected task.');
      }

      const merged = mergeTask(current, data);
      const updated = await this.dependencies.openClawGatewayClient.updateCronJob(
        instanceId,
        id,
        buildOpenClawJobPatch(merged),
      );
      const mapped = mapOpenClawJobToTask(updated);
      this.openClawTaskCache.set(id, mapped);
      return mapped;
    }

    const updated = await this.dependencies.studioMockService.updateTask(id, data);
    if (!updated) {
      throw new Error('Failed to update task');
    }
    return updated;
  }

  async cloneTask(id: string, overrides: UpdateTaskDTO = {}): Promise<Task> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const current = this.openClawTaskCache.get(id);
      if (!current) {
        throw new Error('OpenClaw task cache is missing for the selected task.');
      }

      const cloneSource: Omit<Task, 'id'> = {
        ...mergeTask(current, overrides),
        status: 'paused',
        lastRun: undefined,
        nextRun: undefined,
      };

      return this.createTask(instanceId, cloneSource);
    }

    const cloned = await this.dependencies.studioMockService.cloneTask(id, overrides);
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
    return cloned;
  }

  async runTaskNow(id: string): Promise<TaskExecutionHistoryEntry> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const result = await this.dependencies.openClawGatewayClient.runCronJob(instanceId, id);
      if (result.ran === false) {
        throw new Error(result.reason || 'Failed to queue the OpenClaw cron job.');
      }

      return {
        id: result.runId || `${id}-${Date.now()}`,
        taskId: id,
        status: 'running',
        trigger: 'manual',
        startedAt: new Date().toISOString(),
        summary: result.enqueued === false ? 'Cron job was not queued.' : 'Cron job queued successfully.',
        details: result.reason,
      };
    }

    const execution = await this.dependencies.studioMockService.runTaskNow(id);
    if (!execution) {
      throw new Error('Failed to run task');
    }
    return execution;
  }

  async listTaskExecutions(id: string): Promise<TaskExecutionHistoryEntry[]> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      try {
        const runs = await this.dependencies.openClawGatewayClient.listCronRuns(instanceId, id);
        return runs.map(mapOpenClawRunToExecution);
      } catch {
        return this.dependencies.studioMockService.listTaskExecutions(id);
      }
    }

    return this.dependencies.studioMockService.listTaskExecutions(id);
  }

  async listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]> {
    const detail = await this.getOpenClawDetail(instanceId);
    if (detail?.workbench?.channels?.length) {
      return detail.workbench.channels
        .filter((channel) => channel.enabled && channel.status === 'connected')
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
        }));
    }

    const channels = await this.dependencies.studioMockService.listChannels(instanceId);
    return channels
      .filter((channel) => channel.enabled && channel.status === 'connected')
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
      }));
  }

  async updateTaskStatus(id: string, status: Extract<TaskStatus, 'active' | 'paused'>): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      await this.dependencies.openClawGatewayClient.updateCronJob(instanceId, id, {
        enabled: status === 'active',
      });
      const current = this.openClawTaskCache.get(id);
      if (current) {
        this.openClawTaskCache.set(id, {
          ...current,
          status,
        });
      }
      return;
    }

    const updated = await this.dependencies.studioMockService.updateTaskStatus(id, status);
    if (!updated) {
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(id: string): Promise<void> {
    const instanceId = this.openClawTaskInstanceById.get(id);
    if (instanceId) {
      const deleted = await this.dependencies.openClawGatewayClient.removeCronJob(instanceId, id);
      if (!deleted) {
        throw new Error('Failed to delete task');
      }
      this.openClawTaskInstanceById.delete(id);
      this.openClawTaskCache.delete(id);
      return;
    }

    const deleted = await this.dependencies.studioMockService.deleteTask(id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
  }
}

export function createTaskService(overrides: TaskServiceDependencyOverrides = {}) {
  const defaults = createDefaultDependencies();

  return new TaskService({
    getInstanceDetail: overrides.getInstanceDetail ?? defaults.getInstanceDetail,
    studioMockService: {
      ...defaults.studioMockService,
      ...(overrides.studioMockService || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
  });
}

export const taskService = createTaskService();
