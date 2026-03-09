import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, XCircle, RefreshCw, Plus, MoreVertical, Calendar, MessageSquare, Zap, Trash2, Edit2 } from 'lucide-react';
import { taskService, Task } from '../../services/taskService';
import { toast } from 'sonner';

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    name: '',
    schedule: '0 * * * *',
    actionType: 'message',
    status: 'active'
  });

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const data = await taskService.getTasks();
      setTasks(data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const stats = {
    total: tasks.length,
    active: tasks.filter(t => t.status === 'active').length,
    paused: tasks.filter(t => t.status === 'paused').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.schedule) return;
    
    setIsSaving(true);
    try {
      const task = await taskService.createTask({
        name: newTask.name,
        schedule: newTask.schedule,
        actionType: newTask.actionType as 'message' | 'skill',
        status: 'active'
      });
      setTasks([...tasks, task]);
      setIsCreating(false);
      setNewTask({ name: '', schedule: '0 * * * *', actionType: 'message', status: 'active' });
      toast.success('Task created successfully');
    } catch (error) {
      toast.error('Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTaskStatus = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'active' ? 'paused' : 'active';
    try {
      await taskService.updateTaskStatus(id, newStatus);
      setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
      toast.success(`Task ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskService.deleteTask(id);
      setTasks(tasks.filter(t => t.id !== id));
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-[1400px] mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">Scheduled Tasks</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-[15px]">Automate AI workflows with scheduled tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm shadow-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Total Tasks */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none mb-1">{stats.total}</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Tasks</div>
          </div>
        </div>

        {/* Active */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0">
            <Play className="w-6 h-6 text-primary-500 dark:text-primary-400 ml-1" />
          </div>
          <div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none mb-1">{stats.active}</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active</div>
          </div>
        </div>

        {/* Paused */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <Pause className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none mb-1">{stats.paused}</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Paused</div>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none mb-1">{stats.failed}</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Failed</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {tasks.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 md:p-24 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 rounded-full bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-primary-500 dark:text-primary-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">No scheduled tasks</h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
            Create scheduled tasks to automate AI workflows. Tasks can send messages, run queries, or perform actions at specified times.
          </p>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create Your First Task
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Task Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Next Run</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{task.name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">{task.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                      <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs">{task.schedule}</code>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {task.actionType === 'message' ? <MessageSquare className="w-4 h-4 text-primary-500 dark:text-primary-400" /> : <Zap className="w-4 h-4 text-primary-500 dark:text-primary-400" />}
                      <span className="capitalize">{task.actionType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      task.status === 'active' ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20' :
                      task.status === 'paused' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
                      'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        task.status === 'active' ? 'bg-primary-500' :
                        task.status === 'paused' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}></span>
                      <span className="capitalize">{task.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {task.nextRun || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleTaskStatus(task.id)}
                        className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title={task.status === 'active' ? 'Pause Task' : 'Resume Task'}
                      >
                        {task.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setIsCreating(false)}></div>
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Create Scheduled Task</h3>
              <button onClick={() => setIsCreating(false)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Task Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Daily Morning Briefing"
                  value={newTask.name}
                  onChange={e => setNewTask({...newTask, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 dark:text-zinc-100 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Schedule (Cron Expression)</label>
                <input 
                  type="text" 
                  placeholder="0 9 * * *"
                  value={newTask.schedule}
                  onChange={e => setNewTask({...newTask, schedule: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 dark:text-zinc-100 text-sm font-mono"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Format: Minute Hour Day Month Weekday. E.g., <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">0 9 * * *</code> for 9:00 AM daily.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Action Type</label>
                <select 
                  value={newTask.actionType}
                  onChange={e => setNewTask({...newTask, actionType: e.target.value as any})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 dark:text-zinc-100 text-sm"
                >
                  <option value="message">Send Message to Channel</option>
                  <option value="skill">Execute Skill</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsCreating(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTask}
                disabled={!newTask.name || !newTask.schedule}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
