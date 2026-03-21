import { studio, studioMockService } from '@sdkwork/claw-infrastructure';
import type {
  ListParams,
  PaginatedResult,
  StudioWorkbenchTaskExecutionRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/claw-types';
import {
  buildOpenClawCronTaskPayload,
  cloneOpenClawCronTaskPayload,
  type CronTaskCreateInput,
  type OpenClawCronTaskPayload,
} from './cronTaskPayload';
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
} from './taskSchedule';

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

function cloneTaskRecord(task: Task): Task {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
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
    deliveryMode: data.deliveryMode ?? task.deliveryMode,
    deliveryBestEffort: data.deliveryBestEffort ?? task.deliveryBestEffort,
    deliveryChannel: data.deliveryChannel ?? task.deliveryChannel,
    recipient: data.recipient ?? task.recipient,
    lastRun: data.lastRun ?? task.lastRun,
    nextRun: data.nextRun ?? task.nextRun,
  };
}

class TaskService implements ITaskService {
  private readonly openClawTaskInstanceById = new Map<string, string>();

  private rememberTasks(instanceId: string, tasks: Task[]) {
    tasks.forEach((task) => {
      this.openClawTaskInstanceById.set(task.id, instanceId);
    });
  }

  private forgetTask(id: string) {
    this.openClawTaskInstanceById.delete(id);
  }

  private resolveTaskInstanceId(taskId: string, instanceId?: string) {
    return instanceId || this.openClawTaskInstanceById.get(taskId);
  }

  private async getOpenClawDetail(instanceId: string) {
    const detail = await studio.getInstanceDetail(instanceId);
    if (detail?.instance.runtimeKind === 'openclaw' && detail.workbench) {
      return detail;
    }
    return null;
  }

  private async getOpenClawTask(instanceId: string, id: string) {
    const tasks = await this.getTasks(instanceId);
    return tasks.find((task) => task.id === id) || null;
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
    const detail = await this.getOpenClawDetail(instanceId);
    if (detail) {
      const tasks = detail.workbench.cronTasks.tasks.map(mapStudioTask);
      this.rememberTasks(instanceId, tasks);
      return tasks.map(cloneTaskRecord);
    }

    return (await studioMockService.listTasks(instanceId)).map((task) => ({ ...task }));
  }

  async createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const detail = await this.getOpenClawDetail(instanceId);
    if (detail) {
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

    return studioMockService.createTask(instanceId, task);
  }

  async updateTask(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task> {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const detail = await this.getOpenClawDetail(resolvedInstanceId);
      if (detail) {
        const current = await this.getOpenClawTask(resolvedInstanceId, id);
        if (!current) {
          throw new Error('Failed to update task');
        }

        await studio.updateInstanceTask(
          resolvedInstanceId,
          id,
          buildOpenClawCronTaskPayload(toCreateTaskInput(current, data), current.rawDefinition),
        );
        const refreshed = await this.getOpenClawTask(resolvedInstanceId, id);
        if (!refreshed) {
          throw new Error('Failed to update task');
        }
        return refreshed;
      }
    }

    const updated = await studioMockService.updateTask(id, data);
    if (!updated) {
      throw new Error('Failed to update task');
    }
    return updated;
  }

  async cloneTask(id: string, overrides: UpdateTaskDTO = {}, instanceId?: string): Promise<Task> {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const detail = await this.getOpenClawDetail(resolvedInstanceId);
      if (detail) {
        await studio.cloneInstanceTask(resolvedInstanceId, id, overrides.name);
        const tasks = await this.getTasks(resolvedInstanceId);
        const cloned = tasks.find((candidate) => candidate.name === overrides.name) || tasks[0];
        if (!cloned) {
          throw new Error('Failed to clone task');
        }
        return cloned;
      }
    }

    const cloned = await studioMockService.cloneTask(id, overrides);
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
    return cloned;
  }

  async runTaskNow(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry> {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const detail = await this.getOpenClawDetail(resolvedInstanceId);
      if (detail) {
        return mapStudioTaskExecution(await studio.runInstanceTaskNow(resolvedInstanceId, id));
      }
    }

    const execution = await studioMockService.runTaskNow(id);
    if (!execution) {
      throw new Error('Failed to run task');
    }
    return execution;
  }

  async listTaskExecutions(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry[]> {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const detail = await this.getOpenClawDetail(resolvedInstanceId);
      if (detail) {
        return (await studio.listInstanceTaskExecutions(resolvedInstanceId, id)).map(mapStudioTaskExecution);
      }
    }

    return studioMockService.listTaskExecutions(id);
  }

  async listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]> {
    const detail = await this.getOpenClawDetail(instanceId);
    if (detail) {
      return detail.workbench.channels
        .filter((channel) => channel.enabled && channel.status === 'connected')
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
        }));
    }

    const channels = await studioMockService.listChannels(instanceId);
    return channels
      .filter((channel) => channel.enabled && channel.status === 'connected')
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
      }));
  }

  async updateTaskStatus(
    id: string,
    status: Extract<TaskStatus, 'active' | 'paused'>,
    instanceId?: string,
  ): Promise<void> {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const detail = await this.getOpenClawDetail(resolvedInstanceId);
      if (detail) {
        await studio.updateInstanceTaskStatus(resolvedInstanceId, id, status);
        return;
      }
    }

    const updated = await studioMockService.updateTaskStatus(id, status);
    if (!updated) {
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(id: string, instanceId?: string): Promise<void> {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const detail = await this.getOpenClawDetail(resolvedInstanceId);
      if (detail) {
        const deleted = await studio.deleteInstanceTask(resolvedInstanceId, id);
        if (!deleted) {
          throw new Error('Failed to delete task');
        }
        this.forgetTask(id);
        return;
      }
    }

    const deleted = await studioMockService.deleteTask(id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
  }
}

export const taskService = new TaskService();
