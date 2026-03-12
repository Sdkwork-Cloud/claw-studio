export interface ListParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

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
  getTasks(): Promise<Task[]>;
  createTask(task: Omit<Task, 'id'>): Promise<Task>;
  updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void>;
  deleteTask(id: string): Promise<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tasksData: Task[] = [
  {
    id: 'task-1',
    name: 'Daily System Check',
    schedule: '0 0 * * *',
    actionType: 'skill',
    status: 'active',
    lastRun: '2 hours ago',
    nextRun: 'in 22 hours',
  },
  {
    id: 'task-2',
    name: 'Weekly Report',
    schedule: '0 9 * * 1',
    actionType: 'message',
    status: 'paused',
    lastRun: '3 days ago',
    nextRun: '-',
  },
];

function cloneTask(task: Task): Task {
  return { ...task };
}

class TaskService implements ITaskService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<Task>> {
    const tasks = await this.getTasks();
    let items = tasks;

    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      items = items.filter((task) => task.name.toLowerCase().includes(keyword));
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = items.length;
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<Task | null> {
    return (await this.getTasks()).find((task) => task.id === id) ?? null;
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

  async getTasks(): Promise<Task[]> {
    await delay(50);
    return tasksData.map(cloneTask);
  }

  async createTask(task: Omit<Task, 'id'>): Promise<Task> {
    await delay(50);
    const created: Task = {
      ...task,
      id: `task-${Date.now()}`,
      nextRun: 'In 5 minutes',
    };
    tasksData.push(created);
    return cloneTask(created);
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    await delay(50);
    const task = tasksData.find((item) => item.id === id);
    if (task) {
      task.status = status;
    }
  }

  async deleteTask(id: string): Promise<void> {
    await delay(50);
    const index = tasksData.findIndex((item) => item.id === id);
    if (index >= 0) {
      tasksData.splice(index, 1);
    }
  }
}

export const taskService = new TaskService();

