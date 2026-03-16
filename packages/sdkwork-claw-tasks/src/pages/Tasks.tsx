import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInstanceStore } from '@sdkwork/claw-core';
import { Task, taskService } from '../services';

export function Tasks() {
  const { activeInstanceId } = useInstanceStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    name: '',
    schedule: '0 * * * *',
    actionType: 'message',
    status: 'active',
  });

  const fetchTasks = async () => {
    if (!activeInstanceId) {
      return;
    }
    setIsLoading(true);
    try {
      const data = await taskService.getTasks(activeInstanceId);
      setTasks(data);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, [activeInstanceId]);

  const stats = {
    total: tasks.length,
    active: tasks.filter((task) => task.status === 'active').length,
    paused: tasks.filter((task) => task.status === 'paused').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  };

  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.schedule || !activeInstanceId) {
      return;
    }

    setIsSaving(true);
    try {
      const task = await taskService.createTask(activeInstanceId, {
        name: newTask.name,
        schedule: newTask.schedule,
        actionType: newTask.actionType as 'message' | 'skill',
        status: 'active',
      });
      setTasks([...tasks, task]);
      setIsCreating(false);
      setNewTask({
        name: '',
        schedule: '0 * * * *',
        actionType: 'message',
        status: 'active',
      });
      toast.success('Task created successfully');
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTaskStatus = async (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      return;
    }

    const newStatus = task.status === 'active' ? 'paused' : 'active';
    try {
      await taskService.updateTaskStatus(id, newStatus);
      setTasks(tasks.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));
      toast.success(`Task ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch {
      toast.error('Failed to update task status');
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await taskService.deleteTask(id);
      setTasks(tasks.filter((task) => task.id !== id));
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 md:p-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-[28px]">
                Scheduled Tasks
              </h1>
              <p className="text-[15px] text-zinc-500 dark:text-zinc-400">
                Automate AI workflows with scheduled tasks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void fetchTasks()}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>
            </div>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                <Clock className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <div className="mb-1.5 text-3xl font-bold leading-none text-zinc-900 dark:text-zinc-100">
                  {stats.total}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Total Tasks
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-500/10">
                <Play className="ml-1 h-6 w-6 text-primary-500 dark:text-primary-400" />
              </div>
              <div>
                <div className="mb-1.5 text-3xl font-bold leading-none text-zinc-900 dark:text-zinc-100">
                  {stats.active}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Active
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
                <Pause className="h-6 w-6 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <div className="mb-1.5 text-3xl font-bold leading-none text-zinc-900 dark:text-zinc-100">
                  {stats.paused}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Paused
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <div className="mb-1.5 text-3xl font-bold leading-none text-zinc-900 dark:text-zinc-100">
                  {stats.failed}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Failed
                </div>
              </div>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-24">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
                <Clock className="h-10 w-10 text-primary-500 dark:text-primary-400" />
              </div>
              <h2 className="mb-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                No scheduled tasks
              </h2>
              <p className="mb-8 max-w-md leading-relaxed text-zinc-500 dark:text-zinc-400">
                Create scheduled tasks to automate AI workflows. Tasks can send messages, run queries,
                or perform actions at specified times.
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
              >
                <Plus className="h-5 w-5" />
                Create Your First Task
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/80">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Task Name
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Schedule
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Action
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Next Run
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="group transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{task.name}</div>
                        <div className="mt-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                          {task.id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <Calendar className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                          <code className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-bold tracking-wider dark:bg-zinc-800">
                            {task.schedule}
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {task.actionType === 'message' ? (
                            <MessageSquare className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                          ) : (
                            <Zap className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                          )}
                          <span className="capitalize">{task.actionType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                            task.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : task.status === 'paused'
                                ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400'
                                : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              task.status === 'active'
                                ? 'bg-emerald-500'
                                : task.status === 'paused'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {task.nextRun || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => void toggleTaskStatus(task.id)}
                            className={`rounded-md p-2 transition-colors ${
                              task.status === 'active'
                                ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10'
                            }`}
                            title={task.status === 'active' ? 'Pause' : 'Resume'}
                          >
                            {task.status === 'active' ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            title="Edit Task"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void deleteTask(task.id)}
                            className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                            title="Delete Task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {renderContent()}

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Create New Task</h2>
              <button
                onClick={() => setIsCreating(false)}
                className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Task Name
                </label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(event) => setNewTask({ ...newTask, name: event.target.value })}
                  placeholder="e.g., Daily Morning Briefing"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Schedule
                </label>
                <input
                  type="text"
                  value={newTask.schedule}
                  onChange={(event) => setNewTask({ ...newTask, schedule: event.target.value })}
                  placeholder="0 9 * * *"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-mono text-zinc-900 shadow-sm transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Cron format. Example: `0 9 * * *` runs daily at 9:00 AM
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Action Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewTask({ ...newTask, actionType: 'message' })}
                    className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${
                      newTask.actionType === 'message'
                        ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10'
                        : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <MessageSquare className="h-5 w-5 text-primary-500 dark:text-primary-400" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Message
                    </span>
                  </button>
                  <button
                    onClick={() => setNewTask({ ...newTask, actionType: 'skill' })}
                    className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${
                      newTask.actionType === 'skill'
                        ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10'
                        : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Zap className="h-5 w-5 text-primary-500 dark:text-primary-400" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Skill
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setIsCreating(false)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreateTask()}
                  disabled={isSaving}
                  className="rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
