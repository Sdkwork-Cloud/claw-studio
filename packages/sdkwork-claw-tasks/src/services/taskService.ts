import { studioMockService } from '@sdkwork/claw-infrastructure';
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

  // Legacy methods
  getTasks(instanceId: string): Promise<Task[]>;
  createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task>;
  updateTask(id: string, data: UpdateTaskDTO): Promise<Task>;
  updateTaskStatus(id: string, status: Extract<TaskStatus, 'active' | 'paused'>): Promise<void>;
  deleteTask(id: string): Promise<void>;
}

class TaskService implements ITaskService {
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
    return studioMockService.listTasks(instanceId);
  }

  async createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task> {
    return studioMockService.createTask(instanceId, task);
  }

  async updateTask(id: string, data: UpdateTaskDTO): Promise<Task> {
    const updated = await studioMockService.updateTask(id, data);
    if (!updated) {
      throw new Error('Failed to update task');
    }
    return updated;
  }

  async cloneTask(id: string, overrides: UpdateTaskDTO = {}): Promise<Task> {
    const cloned = await studioMockService.cloneTask(id, overrides);
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
    return cloned;
  }

  async runTaskNow(id: string): Promise<TaskExecutionHistoryEntry> {
    const execution = await studioMockService.runTaskNow(id);
    if (!execution) {
      throw new Error('Failed to run task');
    }
    return execution;
  }

  async listTaskExecutions(id: string): Promise<TaskExecutionHistoryEntry[]> {
    return studioMockService.listTaskExecutions(id);
  }

  async listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]> {
    const channels = await studioMockService.listChannels(instanceId);
    return channels
      .filter((channel) => channel.enabled && channel.status === 'connected')
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
      }));
  }

  async updateTaskStatus(id: string, status: Extract<TaskStatus, 'active' | 'paused'>): Promise<void> {
    const updated = await studioMockService.updateTaskStatus(id, status);
    if (!updated) {
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(id: string): Promise<void> {
    const deleted = await studioMockService.deleteTask(id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
  }
}

export const taskService = new TaskService();
