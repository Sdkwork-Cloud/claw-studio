import { ListParams, PaginatedResult } from '../types/service';

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
  getList(params?: ListParams): Promise<PaginatedResult<Task>>;
  getById(id: string): Promise<Task | null>;
  create(data: CreateTaskDTO): Promise<Task>;
  update(id: string, data: UpdateTaskDTO): Promise<Task>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getTasks(): Promise<Task[]>;
  createTask(task: Omit<Task, 'id'>): Promise<Task>;
  updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void>;
  deleteTask(id: string): Promise<void>;
}

class TaskService implements ITaskService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<Task>> {
    const tasks = await this.getTasks();
    
    let filtered = tasks;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(lowerKeyword)
      );
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
      hasMore: start + pageSize < total
    };
  }

  async getById(id: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === id) || null;
  }

  async create(data: CreateTaskDTO): Promise<Task> {
    return this.createTask(data);
  }

  async update(id: string, data: UpdateTaskDTO): Promise<Task> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteTask(id);
    return true;
  }

  // Legacy methods
  async getTasks(): Promise<Task[]> {
    const res = await fetch(`/api/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  }

  async createTask(task: Omit<Task, 'id'>): Promise<Task> {
    const res = await fetch(`/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update task status');
  }

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete task');
  }
}

export const taskService = new TaskService();
