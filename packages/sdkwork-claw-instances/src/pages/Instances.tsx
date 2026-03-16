import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Apple,
  Box,
  CheckCircle2,
  ChevronRight,
  Cpu,
  DollarSign,
  FileText,
  MemoryStick,
  MoreVertical,
  Play,
  Power,
  RefreshCw,
  Server,
  Sparkles,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useInstanceStore } from '@sdkwork/claw-core';
import { instanceService } from '../services';
import { Instance } from '../types';

export function Instances() {
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();

  useEffect(() => {
    const fetchInstances = async () => {
      setIsLoading(true);
      try {
        const data = await instanceService.getInstances();
        setInstances(data);
      } catch (error) {
        console.error('Failed to fetch instances:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchInstances();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'apple':
        return <Apple className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />;
      case 'box':
        return <Box className="h-5 w-5 text-primary-500" />;
      case 'server':
        return <Server className="h-5 w-5 text-primary-500" />;
      default:
        return <Server className="h-5 w-5 text-zinc-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500 shadow-emerald-500/50';
      case 'offline':
        return 'bg-zinc-400';
      case 'starting':
        return 'bg-amber-500 animate-pulse shadow-amber-500/50';
      case 'error':
        return 'bg-red-500 shadow-red-500/50';
      default:
        return 'bg-zinc-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'offline':
        return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
      case 'starting':
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400';
      default:
        return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
    }
  };

  const handleAction = async (event: React.MouseEvent, action: string, id: string) => {
    event.stopPropagation();
    setActiveDropdown(null);

    try {
      if (action === 'start') {
        await instanceService.startInstance(id);
        toast.success('Instance started');
      } else if (action === 'stop') {
        await instanceService.stopInstance(id);
        toast.success('Instance stopped');
      } else if (action === 'restart') {
        await instanceService.restartInstance(id);
        toast.success('Instance restarted');
      } else if (action === 'delete') {
        if (!window.confirm('Are you sure you want to uninstall this instance?')) {
          return;
        }

        await instanceService.deleteInstance(id);
        toast.success('Instance uninstalled');
        if (activeInstanceId === id) {
          setActiveInstanceId(null);
        }
      }

      const data = await instanceService.getInstances();
      setInstances(data);
    } catch (error: any) {
      console.error(`Failed to ${action} instance:`, error);
      toast.error(`Failed to ${action} instance`, { description: error.message });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-7xl items-center justify-center p-6 md:p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="scrollbar-hide mx-auto h-full max-w-7xl overflow-y-auto p-6 md:p-10">
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Instances
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Manage, monitor, and configure your Claw Studio compute nodes.
          </p>
        </div>
        <button
          onClick={() => navigate('/install')}
          className="flex w-fit items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <Server className="h-4 w-4" />
          Deploy Instance
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {instances.map((instance, index) => {
          const isActive = activeInstanceId === instance.id;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              key={instance.id}
              className={`group relative flex flex-col rounded-[1.5rem] border bg-white p-6 transition-all duration-300 dark:bg-zinc-900 ${
                isActive
                  ? 'border-primary-500 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/50'
                  : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/20 dark:border-zinc-800/80 dark:hover:border-zinc-700 dark:hover:shadow-none'
              }`}
            >
              {isActive && (
                <div className="absolute -right-3 -top-3 flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </div>
              )}

              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border shadow-sm transition-transform duration-300 group-hover:scale-105 ${
                      isActive
                        ? 'border-primary-200 bg-primary-50 dark:border-primary-500/20 dark:bg-primary-500/10'
                        : 'border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                    }`}
                  >
                    {getIcon(instance.iconType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3
                        onClick={() => navigate(`/instances/${instance.id}`)}
                        className="cursor-pointer text-lg font-bold tracking-tight text-zinc-900 transition-colors hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400"
                      >
                        {instance.name}
                      </h3>
                      <div
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(
                          instance.status,
                        )}`}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full shadow-sm ${getStatusColor(instance.status)}`} />
                        {instance.status}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {instance.type}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {instance.ip}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center gap-2">
                  {!isActive && instance.status === 'online' && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveInstanceId(instance.id);
                      }}
                      className="hidden items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 sm:flex dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setActiveDropdown(activeDropdown === instance.id ? null : instance.id)
                    }
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {activeDropdown === instance.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActiveDropdown(null)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                        {instance.status === 'online' ? (
                          <>
                            {!isActive && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveInstanceId(instance.id);
                                  setActiveDropdown(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 sm:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                <CheckCircle2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                Set as Active
                              </button>
                            )}
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                              <Terminal className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                              Open Terminal
                            </button>
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                              <FileText className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                              View Logs
                            </button>
                            <button
                              onClick={(event) => void handleAction(event, 'restart', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <RefreshCw className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                              Restart
                            </button>
                            <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                            <button
                              onClick={(event) => void handleAction(event, 'stop', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-500/10"
                            >
                              <Square className="h-4 w-4" />
                              Stop Instance
                            </button>
                            <button
                              onClick={(event) => void handleAction(event, 'delete', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Uninstall
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(event) => void handleAction(event, 'start', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
                            >
                              <Play className="h-4 w-4" />
                              Start Instance
                            </button>
                            <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                            <button
                              onClick={(event) => void handleAction(event, 'delete', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Uninstall
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Cpu className="h-3.5 w-3.5" /> CPU
                    </div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {instance.cpu}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${instance.cpu}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <MemoryStick className="h-3.5 w-3.5" /> Memory
                    </div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {instance.memory} MB
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min((instance.memory / 1024) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    Total: {instance.totalMemory}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <DollarSign className="h-3.5 w-3.5" /> Est. Cost
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {instance.status === 'online' ? '$14.40/mo' : '$0.00/mo'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    Based on $0.02/hr rate
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Sparkles className="h-3.5 w-3.5" /> API Tokens
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {instance.status === 'online' ? '1.2M' : '0'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    This billing cycle
                  </div>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Uptime: {instance.status === 'online' ? instance.uptime : 'Offline'}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="font-mono">v{instance.version}</span>
                </div>

                <button
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="flex items-center gap-1 text-sm font-medium text-zinc-900 transition-colors hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400"
                >
                  Details <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
