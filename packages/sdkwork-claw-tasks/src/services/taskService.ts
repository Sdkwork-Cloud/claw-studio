import { type ListParams, type PaginatedResult } from '@sdkwork/claw-types';

export interface Task {
  id: string;
  name: string;
  schedule: string;
  actionType: 'message' | 'skill';
  status: 'active' | 'paused' | 'failed';
  lastRun?: string;
  nextRun?: string;
}

export interface CreateTaskDTO {
  name: string;
  schedule: string;
  actionType: 'message' | 'skill';
  status: 'active' | 'paused' | 'failed';
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

  // Legacy methods
  getTasks(instanceId: string): Promise<Task[]>;
  createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task>;
  updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void>;
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

  async update(_id: string, _data: UpdateTaskDTO): Promise<Task> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteTask(id);
    return true;
  }

  async getTasks(instanceId: string): Promise<Task[]> {
    const res = await fetch(`/api/instances/${instanceId}/tasks`);
    if (!res.ok) {
      throw new Error('Failed to fetch tasks');
    }
    return res.json();
  }

  async createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const res = await fetch(`/api/instances/${instanceId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) {
      throw new Error('Failed to create task');
    }
    return res.json();
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to delete task');
    }
  }
}

export const taskService = new TaskService();
