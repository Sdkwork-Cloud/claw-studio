import { openClawGatewayClient, studio } from '@sdkwork/claw-infrastructure';
import type {
  ListParams,
  PaginatedResult,
  StudioInstanceDetailRecord,
  StudioWorkbenchTaskExecutionRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/claw-types';
import {
  buildOpenClawCronTaskPayload,
  cloneOpenClawCronTaskPayload,
  type CronTaskCreateInput,
  type OpenClawCronTaskPayload,
} from './cronTaskPayload.ts';
import type {
  TaskActionType,
  TaskDeliveryMode,
  TaskExecutionContent,
  TaskScheduleConfig,
  TaskScheduleMode,
  TaskSessionMode,
  TaskStatus,
  TaskThinkingLevel,
  TaskWakeUpMode,
} from './taskSchedule.ts';

export interface Task extends CronTaskCreateInput {
  id: string;
  deliveryLabel?: string;
  lastRun?: string;
  nextRun?: string;
  rawDefinition?: OpenClawCronTaskPayload;
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
  customSessionId?: string;
  wakeUpMode: TaskWakeUpMode;
  executionContent: TaskExecutionContent;
  timeoutSeconds?: number;
  deleteAfterRun?: boolean;
  agentId?: string;
  model?: string;
  thinking?: TaskThinkingLevel;
  lightContext?: boolean;
  toolAllowlist?: string[];
  deliveryMode: TaskDeliveryMode;
  deliveryBestEffort?: boolean;
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
  update(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task>;
  delete(id: string, instanceId?: string): Promise<boolean>;
  cloneTask(id: string, overrides?: UpdateTaskDTO, instanceId?: string): Promise<Task>;
  runTaskNow(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry>;
  listTaskExecutions(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry[]>;
  listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]>;
  getTasks(instanceId: string): Promise<Task[]>;
  createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task>;
  updateTask(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task>;
  updateTaskStatus(
    id: string,
    status: Extract<TaskStatus, 'active' | 'paused'>,
    instanceId?: string,
  ): Promise<void>;
  deleteTask(id: string, instanceId?: string): Promise<void>;
}

const TASK_MANAGEMENT_UNAVAILABLE_ERROR =
  'Task management is not available for this instance.';
const TASK_INSTANCE_CONTEXT_UNAVAILABLE_ERROR =
  'Failed to resolve the task instance context.';

function readToolAllowlistFromRawDefinition(
  rawDefinition?: OpenClawCronTaskPayload,
): string[] | undefined {
  const payload =
    rawDefinition?.payload &&
    typeof rawDefinition.payload === 'object' &&
    !Array.isArray(rawDefinition.payload)
      ? (rawDefinition.payload as Record<string, unknown>)
      : null;
  const tools = Array.isArray(payload?.tools)
    ? payload.tools.filter((value): value is string => typeof value === 'string')
    : undefined;

  return tools?.length ? [...tools] : undefined;
}

function cloneTaskRecord(task: Task): Task {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
    toolAllowlist: task.toolAllowlist ? [...task.toolAllowlist] : undefined,
    rawDefinition: cloneOpenClawCronTaskPayload(task.rawDefinition),
  };
}

function mapStudioTaskExecution(
  execution: StudioWorkbenchTaskExecutionRecord,
): TaskExecutionHistoryEntry {
  return { ...execution };
}

function mapStudioTask(task: StudioWorkbenchTaskRecord): Task {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    prompt: task.prompt,
    schedule: task.schedule,
    scheduleMode: task.scheduleMode,
    scheduleConfig: { ...task.scheduleConfig },
    cronExpression: task.cronExpression,
    actionType: task.actionType,
    status: task.status,
    sessionMode: task.sessionMode,
    customSessionId: task.customSessionId,
    wakeUpMode: task.wakeUpMode,
    executionContent: task.executionContent,
    timeoutSeconds: task.timeoutSeconds,
    deleteAfterRun: task.deleteAfterRun,
    agentId: task.agentId,
    model: task.model,
    thinking: task.thinking,
    lightContext: task.lightContext,
    toolAllowlist: readToolAllowlistFromRawDefinition(task.rawDefinition),
    deliveryMode: task.deliveryMode,
    deliveryBestEffort: task.deliveryBestEffort,
    deliveryChannel: task.deliveryChannel,
    deliveryLabel: task.deliveryLabel,
    recipient: task.recipient,
    lastRun: task.lastRun,
    nextRun: task.nextRun,
    rawDefinition: cloneOpenClawCronTaskPayload(task.rawDefinition),
  };
}

function normalizeId(id: string | null | undefined): string | null {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  return normalizedId || null;
}

function normalizeUniqueById<T extends { id: string }>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const normalizedItems: T[] = [];

  items.forEach((item) => {
    const normalizedId = normalizeId(item.id);
    if (!normalizedId || seenIds.has(normalizedId)) {
      return;
    }

    seenIds.add(normalizedId);
    normalizedItems.push(
      normalizedId === item.id
        ? item
        : ({
            ...item,
            id: normalizedId,
          } as T),
    );
  });

  return normalizedItems;
}

function toCreateTaskInput(task: Task, data: UpdateTaskDTO = {}): CreateTaskDTO {
  return {
    name: data.name ?? task.name,
    description: data.description ?? task.description,
    prompt: data.prompt ?? task.prompt,
    schedule: data.schedule ?? task.schedule,
    scheduleMode: data.scheduleMode ?? task.scheduleMode,
    scheduleConfig: data.scheduleConfig ?? task.scheduleConfig,
    cronExpression: data.cronExpression ?? task.cronExpression,
    actionType: data.actionType ?? task.actionType,
    status: data.status ?? task.status,
    sessionMode: data.sessionMode ?? task.sessionMode,
    customSessionId: data.customSessionId ?? task.customSessionId,
    wakeUpMode: data.wakeUpMode ?? task.wakeUpMode,
    executionContent: data.executionContent ?? task.executionContent,
    timeoutSeconds: data.timeoutSeconds ?? task.timeoutSeconds,
    deleteAfterRun: data.deleteAfterRun ?? task.deleteAfterRun,
    agentId: data.agentId ?? task.agentId,
    model: data.model ?? task.model,
    thinking: data.thinking ?? task.thinking,
    lightContext: data.lightContext ?? task.lightContext,
    toolAllowlist: data.toolAllowlist ?? task.toolAllowlist,
    deliveryMode: data.deliveryMode ?? task.deliveryMode,
    deliveryBestEffort: data.deliveryBestEffort ?? task.deliveryBestEffort,
    deliveryChannel: data.deliveryChannel ?? task.deliveryChannel,
    recipient: data.recipient ?? task.recipient,
    lastRun: data.lastRun ?? task.lastRun,
    nextRun: data.nextRun ?? task.nextRun,
  };
}

function hasWorkbench(detail: StudioInstanceDetailRecord | null | undefined) {
  return Boolean(detail?.workbench);
}

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function canManageTasks(detail: StudioInstanceDetailRecord | null | undefined) {
  return Boolean(detail) && (hasWorkbench(detail) || isOpenClawDetail(detail));
}

export class TaskService implements ITaskService {
  private readonly taskInstanceById = new Map<string, string>();

  private clearTasksForInstance(instanceId: string) {
    for (const [taskId, currentInstanceId] of [...this.taskInstanceById.entries()]) {
      if (currentInstanceId === instanceId) {
        this.taskInstanceById.delete(taskId);
      }
    }
  }

  private rememberTasks(instanceId: string, tasks: Task[]) {
    this.clearTasksForInstance(instanceId);
    tasks.forEach((task) => {
      this.taskInstanceById.set(task.id, instanceId);
    });
  }

  private forgetTask(id: string) {
    this.taskInstanceById.delete(id);
  }

  private resolveTaskInstanceId(taskId: string, instanceId?: string) {
    return instanceId || this.taskInstanceById.get(taskId);
  }

  private async getTaskWorkbenchDetail(
    instanceId: string,
  ): Promise<StudioInstanceDetailRecord | null> {
    const detail = await studio.getInstanceDetail(instanceId);
    return canManageTasks(detail) ? detail : null;
  }

  private async requireTaskWorkbenchDetail(instanceId: string) {
    const detail = await this.getTaskWorkbenchDetail(instanceId);
    if (!detail) {
      throw new Error(TASK_MANAGEMENT_UNAVAILABLE_ERROR);
    }

    return detail;
  }

  private async getWorkbenchTask(instanceId: string, id: string) {
    const tasks = await this.getTasks(instanceId);
    return tasks.find((task) => task.id === id) || null;
  }

  private requireResolvedInstanceId(taskId: string, instanceId?: string) {
    const resolvedInstanceId = this.resolveTaskInstanceId(taskId, instanceId);
    if (!resolvedInstanceId) {
      throw new Error(TASK_INSTANCE_CONTEXT_UNAVAILABLE_ERROR);
    }

    return resolvedInstanceId;
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

  async update(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task> {
    return this.updateTask(id, data, instanceId);
  }

  async delete(id: string, instanceId?: string): Promise<boolean> {
    await this.deleteTask(id, instanceId);
    return true;
  }

  async getTasks(instanceId: string): Promise<Task[]> {
    const detail = await this.getTaskWorkbenchDetail(instanceId);
    if (!detail) {
      this.clearTasksForInstance(instanceId);
      return [];
    }

    const tasks = normalizeUniqueById(
      isOpenClawDetail(detail)
        ? (await openClawGatewayClient.listWorkbenchCronJobs(instanceId)).map(mapStudioTask)
        : detail.workbench!.cronTasks.tasks.map(mapStudioTask),
    );
    this.rememberTasks(instanceId, tasks);
    return tasks.map(cloneTaskRecord);
  }

  async createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const detail = await this.requireTaskWorkbenchDetail(instanceId);
    if (isOpenClawDetail(detail)) {
      const createdJob = await openClawGatewayClient.addCronJob(
        instanceId,
        buildOpenClawCronTaskPayload(task) as never,
      );
      const tasks = await this.getTasks(instanceId);
      const created =
        tasks.find((candidate) => candidate.id === createdJob.id) ||
        tasks.find((candidate) => candidate.name === task.name && candidate.prompt === task.prompt) ||
        tasks[0];
      if (!created) {
        throw new Error('Failed to create task');
      }

      return created;
    }

    await studio.createInstanceTask(instanceId, buildOpenClawCronTaskPayload(task));
    const tasks = await this.getTasks(instanceId);
    const created =
      tasks.find((candidate) => candidate.name === task.name && candidate.prompt === task.prompt) ||
      tasks[0];
    if (!created) {
      throw new Error('Failed to create task');
    }

    return created;
  }

  async updateTask(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const detail = await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    const current = await this.getWorkbenchTask(resolvedInstanceId, id);
    if (!current) {
      throw new Error('Failed to update task');
    }

    const nextPayload = buildOpenClawCronTaskPayload(
      toCreateTaskInput(current, data),
      current.rawDefinition,
    );
    if (isOpenClawDetail(detail)) {
      await openClawGatewayClient.updateCronJob(resolvedInstanceId, id, nextPayload as never);
    } else {
      await studio.updateInstanceTask(resolvedInstanceId, id, nextPayload);
    }
    const refreshed = await this.getWorkbenchTask(resolvedInstanceId, id);
    if (!refreshed) {
      throw new Error('Failed to update task');
    }
    return refreshed;
  }

  async cloneTask(id: string, overrides: UpdateTaskDTO = {}, instanceId?: string): Promise<Task> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const detail = await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    if (isOpenClawDetail(detail)) {
      const current = await this.getWorkbenchTask(resolvedInstanceId, id);
      if (!current) {
        throw new Error('Failed to clone task');
      }
      return this.createTask(resolvedInstanceId, toCreateTaskInput(current, overrides));
    }

    await studio.cloneInstanceTask(resolvedInstanceId, id, overrides.name);
    const tasks = await this.getTasks(resolvedInstanceId);
    const cloned = tasks.find((candidate) => candidate.name === overrides.name) || tasks[0];
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
    return cloned;
  }

  async runTaskNow(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const detail = await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    if (isOpenClawDetail(detail)) {
      await openClawGatewayClient.runCronJob(resolvedInstanceId, id);
      const [latest] = await openClawGatewayClient.listWorkbenchCronRuns(resolvedInstanceId, id);
      if (latest) {
        return mapStudioTaskExecution(latest);
      }

      return {
        id: `${id}-${Date.now()}`,
        taskId: id,
        status: 'running',
        trigger: 'manual',
        startedAt: new Date().toISOString(),
        summary: 'Cron job has been queued.',
      };
    }

    return mapStudioTaskExecution(await studio.runInstanceTaskNow(resolvedInstanceId, id));
  }

  async listTaskExecutions(
    id: string,
    instanceId?: string,
  ): Promise<TaskExecutionHistoryEntry[]> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const detail = await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    if (isOpenClawDetail(detail)) {
      return (await openClawGatewayClient.listWorkbenchCronRuns(resolvedInstanceId, id)).map(
        mapStudioTaskExecution,
      );
    }

    return (await studio.listInstanceTaskExecutions(resolvedInstanceId, id)).map(mapStudioTaskExecution);
  }

  async listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]> {
    const detail = await this.getTaskWorkbenchDetail(instanceId);
    if (!detail) {
      return [];
    }

    const channels = detail.workbench?.channels ?? [];

    return normalizeUniqueById(
      channels
        .filter((channel) => channel.enabled && channel.status === 'connected')
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
        })),
    );
  }

  async updateTaskStatus(
    id: string,
    status: Extract<TaskStatus, 'active' | 'paused'>,
    instanceId?: string,
  ): Promise<void> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const detail = await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    if (isOpenClawDetail(detail)) {
      await openClawGatewayClient.updateCronJob(resolvedInstanceId, id, {
        enabled: status === 'active',
      });
      return;
    }

    await studio.updateInstanceTaskStatus(resolvedInstanceId, id, status);
  }

  async deleteTask(id: string, instanceId?: string): Promise<void> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const detail = await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    const deleted = isOpenClawDetail(detail)
      ? await openClawGatewayClient.removeCronJob(resolvedInstanceId, id)
      : await studio.deleteInstanceTask(resolvedInstanceId, id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
    this.forgetTask(id);
  }
}

export const taskService = new TaskService();
