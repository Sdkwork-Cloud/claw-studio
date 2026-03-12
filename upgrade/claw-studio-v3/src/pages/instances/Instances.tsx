import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Activity, Power, RefreshCw, Terminal, Settings, ChevronRight, Apple, Box, Play, Square, FileText, MoreVertical, Cpu, MemoryStick, CheckCircle2, Trash2, DollarSign, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { instanceService, Instance } from '../../services/instanceService';
import { useInstanceStore } from '../../store/useInstanceStore';

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
    fetchInstances();
  }, []);

  const getIcon = (type: string) => {
    switch(type) {
      case 'apple': return <Apple className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />;
      case 'box': return <Box className="w-5 h-5 text-primary-500" />;
      case 'server': return <Server className="w-5 h-5 text-primary-500" />;
      default: return <Server className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'offline': return 'bg-zinc-400';
      case 'starting': return 'bg-amber-500 shadow-amber-500/50 animate-pulse';
      case 'error': return 'bg-red-500 shadow-red-500/50';
      default: return 'bg-zinc-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'online': return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
      case 'offline': return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
      case 'starting': return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
      case 'error': return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
  };

  const handleAction = async (e: React.MouseEvent, action: string, id: string) => {
    e.stopPropagation();
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
        if (!window.confirm('Are you sure you want to uninstall this instance?')) return;
        await instanceService.deleteInstance(id);
        toast.success('Instance uninstalled');
        if (activeInstanceId === id) {
          setActiveInstanceId(null);
        }
      }
      // Refresh instances
      const data = await instanceService.getInstances();
      setInstances(data);
    } catch (error: any) {
      console.error(`Failed to ${action} instance:`, error);
      toast.error(`Failed to ${action} instance`, { description: error.message });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto h-full overflow-y-auto scrollbar-hide">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Instances</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 text-sm">Manage, monitor, and configure your Claw Studio compute nodes.</p>
        </div>
        <button 
          onClick={() => navigate('/install')}
          className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm flex items-center gap-2 w-fit"
        >
          <Server className="w-4 h-4" />
          Deploy Instance
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {instances.map((instance, idx) => {
          const isActive = activeInstanceId === instance.id;
          return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            key={instance.id}
            className={`bg-white dark:bg-zinc-900 border ${isActive ? 'border-primary-500 ring-1 ring-primary-500/50 shadow-md shadow-primary-500/10' : 'border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:shadow-zinc-200/20 dark:hover:shadow-none'} rounded-[1.5rem] p-6 transition-all duration-300 group flex flex-col relative`}
          >
            {isActive && (
              <div className="absolute -top-3 -right-3 bg-primary-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </div>
            )}
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center border shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0 ${isActive ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/20' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
                  {getIcon(instance.iconType)}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 
                      onClick={() => navigate(`/instances/${instance.id}`)}
                      className="text-lg font-bold text-zinc-900 dark:text-zinc-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer tracking-tight"
                    >
                      {instance.name}
                    </h3>
                    <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getStatusBadge(instance.status)}`}>
                      <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${getStatusColor(instance.status)}`}></div>
                      {instance.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{instance.type}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{instance.ip}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Dropdown */}
              <div className="relative flex items-center gap-2">
                {!isActive && instance.status === 'online' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveInstanceId(instance.id);
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors"
                  >
                    Set Active
                  </button>
                )}
                <button 
                  onClick={() => setActiveDropdown(activeDropdown === instance.id ? null : instance.id)}
                  className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                
                {activeDropdown === instance.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActiveDropdown(null)}></div>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                      {instance.status === 'online' ? (
                        <>
                          {!isActive && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveInstanceId(instance.id);
                                setActiveDropdown(null);
                              }}
                              className="w-full flex sm:hidden items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Set as Active
                            </button>
                          )}
                          <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <Terminal className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Open Terminal
                          </button>
                          <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <FileText className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> View Logs
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(e, 'restart', instance.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Restart
                          </button>
                          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(e, 'stop', instance.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                          >
                            <Square className="w-4 h-4" /> Stop Instance
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(e, 'delete', instance.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Uninstall
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(e, 'start', instance.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                          >
                            <Play className="w-4 h-4" /> Start Instance
                          </button>
                          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(e, 'delete', instance.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Uninstall
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Estimated Cost */}
              <div className="bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <DollarSign className="w-3.5 h-3.5" /> Est. Cost
                  </div>
                  <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {instance.status === 'online' ? '$14.40/mo' : '$0.00/mo'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Based on $0.02/hr rate
                </div>
              </div>

              {/* Token Usage */}
              <div className="bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> API Tokens
                  </div>
                  <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {instance.status === 'online' ? '1.2M' : '0'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  This billing cycle
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Uptime: {instance.status === 'online' ? instance.uptime : 'Offline'}
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                <span className="font-mono">v{instance.version}</span>
              </div>
              
              <button 
                onClick={() => navigate(`/instances/${instance.id}`)}
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 transition-colors"
              >
                Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
          );
        })}
      </div>
    </div>
  );
}
