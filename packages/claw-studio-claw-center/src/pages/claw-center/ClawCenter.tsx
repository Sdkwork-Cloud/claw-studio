import React, { useState, useEffect } from 'react';
import { Search, Network, Server, Cpu, Activity, Shield, Clock, ChevronRight, Globe, HardDrive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clawService, ClawInstance } from '../../services/clawService';

export function ClawCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [claws, setClaws] = useState<ClawInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClaws = async () => {
      setIsLoading(true);
      try {
        const data = await clawService.getClaws();
        setClaws(data);
      } catch (error) {
        console.error('Failed to fetch claws:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClaws();
  }, []);

  const filteredClaws = claws.filter(claw => 
    claw.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    claw.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    claw.ip.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center shadow-sm">
              <Network className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Claw Center</h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Manage and monitor all registered Claw instances across your network. View real-time telemetry, manage configurations, and orchestrate deployments.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Network Map
          </button>
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm shadow-primary-500/20 text-sm flex items-center gap-2">
            <Server className="w-4 h-4" />
            Register New Claw
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Total Claws</div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{claws.length}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Online</div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{claws.filter(c => c.status === 'online').length}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Offline</div>
          <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">{claws.filter(c => c.status === 'offline').length}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Avg CPU Load</div>
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
            {claws.length > 0 ? Math.round(claws.reduce((acc, c) => acc + c.cpuUsage, 0) / claws.length) : 0}%
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search by name, ID, or IP..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm dark:text-zinc-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <select className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2 shadow-sm outline-none cursor-pointer">
              <option>All Status</option>
              <option>Online</option>
              <option>Offline</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">Claw Instance</th>
                <th scope="col" className="px-6 py-4 font-semibold">Status</th>
                <th scope="col" className="px-6 py-4 font-semibold">IP Address</th>
                <th scope="col" className="px-6 py-4 font-semibold">Resources</th>
                <th scope="col" className="px-6 py-4 font-semibold">Version</th>
                <th scope="col" className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredClaws.map((claw) => (
                <tr key={claw.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${claw.status === 'online' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{claw.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{claw.id} • {claw.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      claw.status === 'online' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${claw.status === 'online' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-500'}`}></span>
                      {claw.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <Globe className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                      {claw.ip}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {claw.status === 'online' ? (
                      <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex items-center gap-2 text-[10px] font-medium">
                          <Cpu className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                          <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${claw.cpuUsage > 80 ? 'bg-rose-500' : claw.cpuUsage > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${claw.cpuUsage}%` }}></div>
                          </div>
                          <span className="w-6 text-right">{claw.cpuUsage}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium">
                          <HardDrive className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                          <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${claw.ramUsage > 80 ? 'bg-rose-500' : claw.ramUsage > 50 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${claw.ramUsage}%` }}></div>
                          </div>
                          <span className="w-6 text-right">{claw.ramUsage}%</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">Unavailable</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-mono font-medium">
                      {claw.version}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate(`/claw-center/${claw.id}`)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredClaws.length === 0 && (
            <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
              No claws found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
