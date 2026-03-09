export interface Task {
  id: string;
  name: string;
  schedule: string;
  actionType: 'message' | 'skill';
  status: 'active' | 'paused' | 'failed';
  lastRun?: string;
  nextRun?: string;
}

const MOCK_TASKS: Task[] = [
  {
    id: 'task-1',
    name: 'Daily System Check',
    schedule: '0 0 * * *',
    actionType: 'skill',
    status: 'active',
    lastRun: '2 hours ago',
    nextRun: 'in 22 hours'
  },
  {
    id: 'task-2',
    name: 'Weekly Report',
    schedule: '0 9 * * 1',
    actionType: 'message',
    status: 'paused',
    lastRun: '3 days ago',
    nextRun: '-'
  }
];

export const taskService = {
  getTasks: async (): Promise<Task[]> => {
    return new Promise(resolve => setTimeout(() => resolve([...MOCK_TASKS]), 300));
  },

  createTask: async (task: Omit<Task, 'id'>): Promise<Task> => {
    return new Promise(resolve => {
      setTimeout(() => {
        const newTask: Task = {
          ...task,
          id: `task-${Date.now()}`,
          nextRun: 'In 5 minutes'
        };
        resolve(newTask);
      }, 400);
    });
  },

  updateTaskStatus: async (id: string, status: 'active' | 'paused'): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 300));
  },

  deleteTask: async (id: string): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 300));
  }
};
