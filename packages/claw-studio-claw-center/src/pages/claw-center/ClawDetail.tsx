import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Activity, Cpu, HardDrive, Network, Shield, Clock, Terminal, Settings, RefreshCw, Power } from 'lucide-react';
import { clawService, ClawDetail as ClawDetailType } from '../../services/clawService';

export function ClawDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claw, setClaw] = useState<ClawDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClaw = async () => {
      setIsLoading(true);
      try {
        if (id) {
          const data = await clawService.getClawDetail(id);
          if (data) setClaw(data);
        }
      } catch (error) {
        console.error('Failed to fetch claw details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClaw();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!claw) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Claw Instance Not Found</h2>
        <button onClick={() => navigate('/claw-center')} className="text-primary-600 dark:text-primary-400 hover:underline">
          Return to Claw Center
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto">
      <button 
        onClick={() => navigate('/claw-center')}
        className="flex items-center gap-2 text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-8 font-medium text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Claw Center
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${
            claw.status === 'online' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
          }`}>
            <Server className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{claw.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                claw.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${claw.status === 'online' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-500'}`}></span>
                {claw.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
              <span>{claw.id}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span>{claw.ip}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span>{claw.location}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Console
          </button>
          <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configure
          </button>
          <button className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-sm text-sm flex items-center gap-2">
            <Power className="w-4 h-4" />
            Restart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-sm mb-4">
            <Cpu className="w-4 h-4" />
            CPU Usage
          </div>
          <div className="flex-1 flex items-end gap-4">
            <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{claw.cpuUsage}%</div>
            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary-500 dark:bg-primary-400 rounded-full" style={{ width: `${claw.cpuUsage}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-sm mb-4">
            <Activity className="w-4 h-4" />
            Memory Usage
          </div>
          <div className="flex-1 flex items-end gap-4">
            <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{claw.ramUsage}%</div>
            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary-500 dark:bg-primary-400 rounded-full" style={{ width: `${claw.ramUsage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-sm mb-4">
            <HardDrive className="w-4 h-4" />
            Disk Usage
          </div>
          <div className="flex-1 flex items-end gap-4">
            <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{claw.diskUsage}%</div>
            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary-500 dark:bg-primary-400 rounded-full" style={{ width: `${claw.diskUsage}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-500 dark:text-primary-400" />
              System Information
            </h3>
          </div>
          <div className="p-6">
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">OS Version</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono">{claw.os}</dd>
              </div>
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Kernel</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono">{claw.kernel}</dd>
              </div>
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Claw Version</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono">{claw.version}</dd>
              </div>
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">MAC Address</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono">{claw.macAddress}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Uptime</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono">{claw.uptime}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Network className="w-4 h-4 text-primary-500 dark:text-primary-400" />
              Network & Activity
            </h3>
            <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1 uppercase tracking-wider">Connected Devices</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{claw.connectedDevices}</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1 uppercase tracking-wider">Active Tasks</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{claw.activeTasks}</div>
              </div>
            </div>
            
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">Recent Activity</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">Device <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">temp-sensor-1</span> connected</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">Task <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">daily-backup</span> completed successfully</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">1 hour ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">CPU usage spiked to 92%</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">3 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
