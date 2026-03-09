import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Loader2, HardDriveDownload, Package, Terminal, Trash2 } from 'lucide-react';
import { useTaskStore, Task } from '@sdkwork/claw-studio-business/stores/useTaskStore';

const TaskIcon = ({ type, status }: { type: Task['type'], status: Task['status'] }) => {
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === 'error') return <AlertCircle className="w-5 h-5 text-red-500" />;
  
  switch (type) {
    case 'download': return <HardDriveDownload className="w-5 h-5 text-primary-500" />;
    case 'install': return <Package className="w-5 h-5 text-amber-500" />;
    case 'build': return <Terminal className="w-5 h-5 text-purple-500" />;
    default: return <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />;
  }
};

export function GlobalTaskManager() {
  const { tasks, isPanelOpen, setPanelOpen, removeTask, clearCompleted } = useTaskStore();
  const activeTasksCount = tasks.filter(t => t.status === 'running').length;

  if (!isPanelOpen && tasks.length === 0) return null;

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 right-6 w-96 bg-white/90 backdrop-blur-xl border border-zinc-200/80 shadow-2xl rounded-2xl z-50 overflow-hidden flex flex-col max-h-[600px]"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Loader2 className={`w-4 h-4 text-zinc-900 ${activeTasksCount > 0 ? 'animate-spin' : 'hidden'}`} />
                {activeTasksCount === 0 && <CheckCircle2 className="w-4 h-4 text-zinc-900" />}
              </div>
              <span className="text-sm font-bold text-zinc-900">
                {activeTasksCount > 0 ? `${activeTasksCount} Active Tasks` : 'All Tasks Completed'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {tasks.some(t => t.status === 'success') && (
                <button 
                  onClick={clearCompleted}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-lg transition-colors"
                  title="Clear completed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setPanelOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="overflow-y-auto p-2 space-y-1 bg-zinc-50/30">
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-sm">No recent tasks</div>
            ) : (
              tasks.map(task => (
                <motion.div 
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-3 bg-white border border-zinc-100 rounded-xl shadow-sm group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <TaskIcon type={task.type} status={task.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-zinc-900 truncate">{task.title}</h4>
                        <button 
                          onClick={() => removeTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {task.subtitle && (
                        <p className="text-xs text-zinc-500 truncate mb-2">{task.subtitle}</p>
                      )}
                      
                      {/* Progress Bar */}
                      {task.status === 'running' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] font-medium text-zinc-500 mb-1 uppercase tracking-wider">
                            <span>{task.progress < 100 ? 'Processing...' : 'Finalizing...'}</span>
                            <span>{Math.round(task.progress)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-zinc-900 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress}%` }}
                              transition={{ ease: "linear", duration: 0.5 }}
                            />
                          </div>
                        </div>
                      )}
                      {task.status === 'error' && (
                        <p className="text-xs text-red-500 mt-1 font-medium">Task failed. Please try again.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
